// Fastoosh License Server — Edge Function entry (Deno + Hono).
//
// Route prefix: /make-server-license/...
//   /health                               GET   health check
//   /webhook/gumroad/:secret              POST  Gumroad Ping (primary provider)
//   /webhook/stripe|paddle|polar          POST  501 stubs (URLs reserved)
//   /license/activate                     POST  extension activates a key
//   /license/refresh                      POST  extension refreshes a token
//   /license/deactivate                   POST  extension frees a machine slot
//   /license/status                       POST  lightweight validity check
//   /admin/licenses                       GET   list/search (X-Admin-Token)
//   /admin/revoke                         POST  revoke + denylist + email
//   /admin/reissue                        POST  resend license email
//   /admin/create                         POST  mint a license manually (test/comp)
//
// Security model:
//   - Webhook: secret-in-path (constant-time compare) + Gumroad API verification.
//   - Admin:   Bearer ADMIN_API_TOKEN.
//   - Extension endpoints: public, but a key + fingerprint is required; the
//     denylist and license status gate access.

import { Hono } from 'npm:hono';
import { cors } from 'npm:hono/cors';
import { logger } from 'npm:hono/logger';

import { supabase, getLicenseByKey, getLicenseById, getActivations, getActivation, updateLicense, type LicenseRow } from './lib/license/db.ts';
import { isValidKeyFormat, normalizeKey, generateLicenseKey } from './lib/license/keys.ts';
import { isValidFingerprint, normalizeFingerprint } from './lib/license/fingerprint.ts';
import { signLicenseToken, verifyLicenseToken, generateJti, tokenTtlSeconds, type LicenseClaims } from './lib/license/tokens.ts';
import { isDenied, addToDenylist } from './lib/license/denylist.ts';
import { dispatchEvent, logEvent, alreadyProcessed } from './lib/license/events.ts';
import { buildLicenseDeliveryEmail, buildRevokedEmail, sendEmail } from './lib/license/email.ts';
import { gumroadAdapter } from './lib/providers/gumroad.ts';

const PREFIX = '/make-server-license';
const app = new Hono();

app.use('*', logger());
app.use('*', cors({
  origin: '*',
  allowHeaders: ['Content-Type', 'Authorization', 'X-Admin-Token'],
  allowMethods: ['GET', 'POST', 'OPTIONS'],
}));

const ISSUER = Deno.env.get('LICENSE_TOKEN_ISSUER') ?? 'fastoosh.com';
const PRODUCT_NAMES: Record<string, string> = { fastoosh_data_automator: 'Fastoosh Data Automator' };
const productName = (id: string) => PRODUCT_NAMES[id] ?? 'Fastoosh';

// ── Constant-time string compare (for the webhook secret) ─────────────────────
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a);
  const bb = enc.encode(b);
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

// ── Helper: build claims + sign a token for a license + machine ───────────────
async function issueToken(license: {
  id: string; license_key: string; product_id: string; plan_tier: string;
  type: 'lifetime' | 'subscription'; status: string; machine_limit: number;
  features: string[]; expires_at?: string | null;
}, email: string, fingerprint: string): Promise<{ token: string; expiresAt: string }> {
  const now = Math.floor(Date.now() / 1000);
  const pastDue = license.status === 'past_due';
  const ttl = tokenTtlSeconds(license.type, pastDue);
  // Cap the token's exp to the license's expires_at when set, so a trial
  // (or a canceled-but-still-active sub) cannot keep Pro alive offline past
  // the license's real end. Token is only valid while the license is.
  let exp = now + ttl;
  if (license.expires_at) {
    const licenseExp = Math.floor(new Date(license.expires_at).getTime() / 1000);
    if (Number.isFinite(licenseExp) && licenseExp < exp) exp = licenseExp;
  }

  const claims: LicenseClaims = {
    iss: ISSUER,
    sub: license.id,
    jti: generateJti(),
    email,
    product: license.product_id,
    plan: license.plan_tier,
    type: license.type,
    machine: fingerprint,
    machine_limit: license.machine_limit,
    iat: now,
    exp,
    features: license.features ?? [],
  };
  const token = await signLicenseToken(claims);
  return { token, expiresAt: new Date(exp * 1000).toISOString() };
}

// ── Health ────────────────────────────────────────────────────────────────────
app.get(`${PREFIX}/health`, (c) => c.json({ ok: true, service: 'license', ts: Date.now() }));

// ════════════════════════════════════════════════════════════════════════════
// WEBHOOK — Gumroad
// ════════════════════════════════════════════════════════════════════════════
app.post(`${PREFIX}/webhook/gumroad/:secret`, async (c) => {
  const secret = c.req.param('secret');
  const expected = Deno.env.get('GUMROAD_PING_SECRET') ?? '';

  // Mismatch → 404 (don't reveal that the path segment is a secret).
  if (!expected || !timingSafeEqual(secret, expected)) {
    return c.json({ error: 'not_found' }, 404);
  }

  // Test mode: skip Gumroad API sale verification when the flag + header match.
  // Lets us exercise the full pipeline without a real purchase.
  const testModeEnabled = (Deno.env.get('LICENSE_TEST_MODE') ?? 'false') === 'true';
  const testHeader = c.req.header('X-Test-Secret') ?? '';
  const testSecret = Deno.env.get('LICENSE_TEST_SECRET') ?? '';
  const testMode = testModeEnabled && testSecret.length > 0 && timingSafeEqual(testHeader, testSecret);

  // Read the raw body ONCE as text, then parse based on content-type. This is
  // more robust than Hono's c.req.json()/parseBody() helpers, which can return
  // empty in edge cases. Gumroad sends application/x-www-form-urlencoded; our
  // test harness sends JSON.
  let body: Record<string, unknown> = {};
  const contentType = c.req.header('content-type') ?? '';
  try {
    const raw = await c.req.text();
    if (contentType.includes('application/json')) {
      body = raw ? JSON.parse(raw) : {};
    } else {
      // form-urlencoded (real Gumroad)
      body = Object.fromEntries(new URLSearchParams(raw)) as Record<string, unknown>;
    }
  } catch {
    body = {};
  }

  await logEvent({
    eventType: 'webhook.received',
    provider: 'gumroad',
    providerEventId: (body.sale_id as string) ?? (body.id as string) ?? undefined,
    payload: { resource_name: body.resource_name ?? 'sale', testMode },
  });

  try {
    const event = await gumroadAdapter({ body, headers: c.req.raw.headers, testMode });

    // null = intentionally ignored (free tier, unconfigured product, unverified sale).
    if (!event) {
      await logEvent({
        eventType: 'webhook.processed',
        provider: 'gumroad',
        providerEventId: (body.sale_id as string) ?? undefined,
        payload: { result: 'ignored' },
      });
      return c.json({ ok: true, ignored: true }, 200);
    }

    // Idempotency: skip if we already processed this providerEventId.
    if (await alreadyProcessed('gumroad', event.providerEventId)) {
      return c.json({ ok: true, duplicate: true }, 200);
    }

    const result = await dispatchEvent(event);

    await logEvent({
      eventType: 'webhook.processed',
      provider: 'gumroad',
      providerEventId: event.providerEventId,
      payload: { type: event.type, result },
    });

    // Always 200 on handled events so Gumroad doesn't retry indefinitely.
    return c.json({ ok: result.ok, detail: result.detail }, 200);
  } catch (err) {
    await logEvent({
      eventType: 'webhook.failed',
      provider: 'gumroad',
      providerEventId: (body.sale_id as string) ?? undefined,
      payload: { error: String(err) },
    });
    // 500 so Gumroad retries — this was an unexpected server error, not a
    // deliberate ignore.
    return c.json({ ok: false, error: String(err) }, 500);
  }
});

// ── Provider stubs (URLs reserved, not implemented) ───────────────────────────
for (const p of ['stripe', 'paddle', 'polar']) {
  app.post(`${PREFIX}/webhook/${p}`, (c) => c.json({ error: 'not_implemented', provider: p }, 501));
}

// ════════════════════════════════════════════════════════════════════════════
// EXTENSION ENDPOINTS
// ════════════════════════════════════════════════════════════════════════════

// Shared license-validity gate used by activate/refresh/status.
async function validateLicenseForUse(licenseKey: string): Promise<
  | { ok: false; code: 403 | 404; error: string; message: string }
  | { ok: true; license: LicenseRow; email: string }
> {
  const denied = await isDenied(licenseKey);
  if (denied.denied) {
    return { ok: false, code: 403, error: 'revoked', message: denied.reason ?? 'This license has been revoked.' };
  }

  const license = await getLicenseByKey(licenseKey);
  if (!license) {
    return { ok: false, code: 404, error: 'not_found', message: 'License key not found.' };
  }
  if (license.status === 'revoked') {
    return { ok: false, code: 403, error: 'revoked', message: 'This license has been revoked.' };
  }

  // Expiry check for subscriptions (and any license with expires_at set).
  if (license.expires_at && new Date(license.expires_at) < new Date()) {
    if (license.status !== 'expired') await updateLicense(license.id, { status: 'expired' });
    return { ok: false, code: 403, error: 'expired', message: 'This license has expired.' };
  }
  if (license.status === 'expired') {
    return { ok: false, code: 403, error: 'expired', message: 'This license has expired.' };
  }

  // active or past_due may proceed (past_due gets a short token).
  const { data: cust } = await supabase
    .from('license_customers')
    .select('email')
    .eq('id', license.customer_id)
    .maybeSingle();

  return { ok: true, license, email: cust?.email ?? '' };
}

// POST /license/activate
app.post(`${PREFIX}/license/activate`, async (c) => {
  let payload: any;
  try { payload = await c.req.json(); } catch { return c.json({ error: 'bad_request' }, 400); }

  const licenseKey = normalizeKey(String(payload.license_key ?? ''));
  const fingerprint = normalizeFingerprint(String(payload.machine_fingerprint ?? ''));

  if (!isValidKeyFormat(licenseKey)) return c.json({ error: 'invalid_key_format' }, 400);
  if (!isValidFingerprint(fingerprint)) return c.json({ error: 'invalid_fingerprint' }, 400);

  const gate = await validateLicenseForUse(licenseKey);
  if (!gate.ok) return c.json({ error: gate.error, message: gate.message }, gate.code);

  const license = gate.license!;
  const existing = await getActivation(license.id, fingerprint);

  if (existing) {
    // Known machine — bump last_seen and re-issue token.
    await supabase.from('activations').update({
      last_seen_at: new Date().toISOString(),
      machine_name: payload.machine_name ?? existing.machine_name,
      app_version: payload.app_version ?? existing.app_version,
    }).eq('id', existing.id);
  } else {
    const activations = await getActivations(license.id);
    if (activations.length >= license.machine_limit) {
      return c.json({
        error: 'machine_limit_reached',
        message: `This license is already active on ${license.machine_limit} machine(s). Deactivate one to continue.`,
        activations: activations.map((a) => ({ id: a.id, machine_name: a.machine_name, last_seen_at: a.last_seen_at })),
      }, 409);
    }
    const { error } = await supabase.from('activations').insert({
      license_id: license.id,
      machine_fingerprint: fingerprint,
      machine_name: payload.machine_name ?? null,
      os: payload.os ?? null,
      app_version: payload.app_version ?? null,
    });
    if (error) return c.json({ error: 'activation_failed', message: error.message }, 500);
  }

  const { token, expiresAt } = await issueToken(license, gate.email, fingerprint);
  await logEvent({ licenseId: license.id, customerId: license.customer_id, eventType: 'license.activated', payload: { fingerprint } });

  return c.json({
    token,
    expires_at: expiresAt,
    license: {
      tier: license.plan_tier,
      type: license.type,
      machine_limit: license.machine_limit,
      features: license.features ?? [],
    },
  });
});

// POST /license/refresh
app.post(`${PREFIX}/license/refresh`, async (c) => {
  let payload: any;
  try { payload = await c.req.json(); } catch { return c.json({ error: 'bad_request' }, 400); }

  const token = String(payload.token ?? '');
  const fingerprint = normalizeFingerprint(String(payload.machine_fingerprint ?? ''));
  if (!isValidFingerprint(fingerprint)) return c.json({ error: 'invalid_fingerprint' }, 400);

  // Verify signature but allow expired tokens (the whole point of refresh).
  const verified = await verifyLicenseToken(token, false);
  if (!verified.valid || !verified.claims) {
    return c.json({ error: 'invalid_token', message: verified.reason ?? 'Token signature invalid.' }, 403);
  }
  if (verified.claims.machine !== fingerprint) {
    return c.json({ error: 'fingerprint_mismatch', message: 'Token is bound to a different machine.' }, 403);
  }

  const license = await getLicenseById(verified.claims.sub);
  if (!license) return c.json({ error: 'not_found' }, 404);

  // Re-run the full validity gate by key (catches denylist + status + expiry).
  const gate = await validateLicenseForUse(license.license_key);
  if (!gate.ok) return c.json({ error: gate.error, message: gate.message }, gate.code);

  const activation = await getActivation(license.id, fingerprint);
  if (!activation) return c.json({ error: 'not_activated', message: 'This machine is not activated.' }, 403);
  await supabase.from('activations').update({ last_seen_at: new Date().toISOString() }).eq('id', activation.id);

  const { token: newToken, expiresAt } = await issueToken(gate.license!, gate.email, fingerprint);
  await logEvent({ licenseId: license.id, customerId: license.customer_id, eventType: 'license.refreshed', payload: { fingerprint } });

  return c.json({
    token: newToken,
    expires_at: expiresAt,
    license: {
      tier: gate.license!.plan_tier,
      type: gate.license!.type,
      machine_limit: gate.license!.machine_limit,
      features: gate.license!.features ?? [],
    },
  });
});

// POST /license/deactivate
app.post(`${PREFIX}/license/deactivate`, async (c) => {
  let payload: any;
  try { payload = await c.req.json(); } catch { return c.json({ error: 'bad_request' }, 400); }

  const licenseKey = normalizeKey(String(payload.license_key ?? ''));
  const fingerprint = normalizeFingerprint(String(payload.machine_fingerprint ?? ''));
  if (!isValidKeyFormat(licenseKey)) return c.json({ error: 'invalid_key_format' }, 400);
  if (!isValidFingerprint(fingerprint)) return c.json({ error: 'invalid_fingerprint' }, 400);

  const license = await getLicenseByKey(licenseKey);
  if (!license) return c.json({ error: 'not_found' }, 404);

  const { error } = await supabase.from('activations')
    .delete()
    .eq('license_id', license.id)
    .eq('machine_fingerprint', fingerprint);
  if (error) return c.json({ error: 'deactivation_failed', message: error.message }, 500);

  await logEvent({ licenseId: license.id, customerId: license.customer_id, eventType: 'machine.deactivated', payload: { fingerprint } });
  return c.json({ ok: true });
});

// POST /license/status — lightweight, non-disruptive validity check.
app.post(`${PREFIX}/license/status`, async (c) => {
  let payload: any;
  try { payload = await c.req.json(); } catch { return c.json({ error: 'bad_request' }, 400); }

  const licenseKey = normalizeKey(String(payload.license_key ?? ''));
  if (!isValidKeyFormat(licenseKey)) return c.json({ valid: false, reason: 'invalid_key_format' });

  const gate = await validateLicenseForUse(licenseKey);
  if (!gate.ok) return c.json({ valid: false, reason: gate.error });

  return c.json({
    valid: true,
    license: {
      tier: gate.license!.plan_tier,
      type: gate.license!.type,
      status: gate.license!.status,
      expires_at: gate.license!.expires_at,
      machine_limit: gate.license!.machine_limit,
    },
  });
});

// ════════════════════════════════════════════════════════════════════════════
// ADMIN ENDPOINTS (Bearer ADMIN_API_TOKEN)
// ════════════════════════════════════════════════════════════════════════════
const requireAdmin = async (c: any, next: any) => {
  const auth = c.req.header('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const expected = Deno.env.get('ADMIN_API_TOKEN') ?? '';
  if (!expected || !timingSafeEqual(token, expected)) {
    return c.json({ error: 'unauthorized' }, 401);
  }
  await next();
};

// GET /admin/licenses?email=&status=&product=&type=
// Returns licenses joined with customer + activation count, for the admin UI's
// by-user / by-tool views. Supports filtering by status (active/expired/...) and
// type (lifetime/subscription).
app.get(`${PREFIX}/admin/licenses`, requireAdmin, async (c) => {
  const email = c.req.query('email');
  const status = c.req.query('status');
  const product = c.req.query('product');
  const type = c.req.query('type');

  let query = supabase
    .from('licenses')
    .select('*, license_customers!inner(email, name, country)')
    .order('created_at', { ascending: false })
    .limit(500);

  if (status) query = query.eq('status', status);
  if (product) query = query.eq('product_id', product);
  if (type) query = query.eq('type', type);
  if (email) query = query.ilike('license_customers.email', `%${email}%`);

  const { data, error } = await query;
  if (error) return c.json({ error: error.message }, 500);

  // Attach activation counts so the UI can show "2/2 machines".
  const ids = (data ?? []).map((l: any) => l.id);
  const counts: Record<string, number> = {};
  if (ids.length) {
    const { data: acts } = await supabase.from('activations').select('license_id').in('license_id', ids);
    for (const a of acts ?? []) counts[a.license_id] = (counts[a.license_id] ?? 0) + 1;
  }

  const licenses = (data ?? []).map((l: any) => ({
    id: l.id,
    license_key: l.license_key,
    email: l.license_customers?.email,
    customer_name: l.license_customers?.name,
    product_id: l.product_id,
    product_name: productName(l.product_id),
    plan_tier: l.plan_tier,
    type: l.type,
    status: l.status,
    machine_limit: l.machine_limit,
    machines_used: counts[l.id] ?? 0,
    expires_at: l.expires_at,
    provider: l.provider,
    created_at: l.created_at,
  }));

  return c.json({ ok: true, licenses });
});

// POST /admin/revoke { license_key, reason }
app.post(`${PREFIX}/admin/revoke`, requireAdmin, async (c) => {
  const { license_key, reason } = await c.req.json();
  const key = normalizeKey(String(license_key ?? ''));
  const license = await getLicenseByKey(key);
  if (!license) return c.json({ error: 'not_found' }, 404);

  await updateLicense(license.id, { status: 'revoked' });
  await addToDenylist(key, reason ?? 'manual_revoke');
  await logEvent({ licenseId: license.id, customerId: license.customer_id, eventType: 'license.revoked', payload: { reason: reason ?? 'manual_revoke' } });

  const { data: cust } = await supabase.from('license_customers').select('email').eq('id', license.customer_id).maybeSingle();
  if (cust?.email) await sendEmail(cust.email, buildRevokedEmail({ productName: productName(license.product_id), reason }));

  return c.json({ ok: true });
});

// POST /admin/reissue { license_key } — resend the license email.
app.post(`${PREFIX}/admin/reissue`, requireAdmin, async (c) => {
  const { license_key } = await c.req.json();
  const key = normalizeKey(String(license_key ?? ''));
  const license = await getLicenseByKey(key);
  if (!license) return c.json({ error: 'not_found' }, 404);

  const { data: cust } = await supabase.from('license_customers').select('email').eq('id', license.customer_id).maybeSingle();
  if (!cust?.email) return c.json({ error: 'no_email' }, 400);

  const mail = buildLicenseDeliveryEmail({
    email: cust.email,
    licenseKey: license.license_key,
    productName: productName(license.product_id),
    planTier: license.plan_tier,
    type: license.type,
    machineLimit: license.machine_limit,
  });
  await sendEmail(cust.email, mail);
  await logEvent({ licenseId: license.id, customerId: license.customer_id, eventType: 'license.reissued' });
  return c.json({ ok: true });
});

// POST /admin/create — mint a license manually (test mode / comps / support).
// Bypasses any payment provider; provider = 'manual'.
app.post(`${PREFIX}/admin/create`, requireAdmin, async (c) => {
  const b = await c.req.json();
  const email = String(b.email ?? '').toLowerCase().trim();
  const productId = String(b.product_id ?? 'fastoosh_data_automator');
  const tier = String(b.plan_tier ?? 'pro');
  const type = (b.type === 'subscription' ? 'subscription' : 'lifetime') as 'lifetime' | 'subscription';
  const machineLimit = Number.isFinite(Number(b.machine_limit)) ? Math.max(1, Math.floor(Number(b.machine_limit))) : 1;
  const features: string[] = Array.isArray(b.features) ? b.features : [];
  const expiresAt = b.expires_at ?? (type === 'subscription' ? new Date(Date.now() + 33 * 86400 * 1000).toISOString() : null);
  const sendMail = b.send_email !== false; // default true

  if (!email) return c.json({ error: 'email_required' }, 400);

  // Upsert customer.
  const { data: existingCust } = await supabase.from('license_customers').select('*').eq('email', email).maybeSingle();
  let customerId = existingCust?.id;
  if (!customerId) {
    const { data: newCust, error } = await supabase.from('license_customers').insert({ email, name: b.name ?? null }).select().single();
    if (error) return c.json({ error: error.message }, 500);
    customerId = newCust.id;
  }

  const licenseKey = generateLicenseKey();
  const { data: license, error } = await supabase.from('licenses').insert({
    customer_id: customerId,
    license_key: licenseKey,
    product_id: productId,
    plan_tier: tier,
    type,
    status: 'active',
    machine_limit: machineLimit,
    expires_at: expiresAt,
    provider: 'manual',
    features,
  }).select().single();
  if (error) return c.json({ error: error.message }, 500);

  await logEvent({ licenseId: license.id, customerId, eventType: 'license.created', provider: 'manual', payload: { tier, type, machine_limit: machineLimit } });

  if (sendMail) {
    const mail = buildLicenseDeliveryEmail({ email, licenseKey, productName: productName(productId), planTier: tier, type, machineLimit });
    await sendEmail(email, mail);
  }

  return c.json({ ok: true, license_key: licenseKey, license_id: license.id });
});

Deno.serve(app.fetch);
