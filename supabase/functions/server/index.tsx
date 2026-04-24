import * as kv from './kv_store.tsx';
import { DEFAULT_HOME_CONTENT } from './defaultHomeContent.tsx';

import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import { Resend } from "npm:resend";

// ── Disposable email domain blocklist ────────────────────────────────────────
// Common throwaway / temp-mail providers — blocked at signup time.
const DISPOSABLE_DOMAINS = new Set([
  'mailinator.com','mailinator2.com','guerrillamail.com','guerrillamail.info',
  'guerrillamail.biz','guerrillamail.de','guerrillamail.net','guerrillamail.org',
  'guerrillamailblock.com','sharklasers.com','grr.la','spam4.me',
  'trashmail.com','trashmail.at','trashmail.io','trashmail.me','trashmail.net',
  'trashmail.org','trashmail.de','trashmail.xyz','trashmail.se','trashdevil.com',
  'trashdevil.de','dispostable.com','yopmail.com','yopmail.fr','yopmail.net',
  'cool.fr.nf','jetable.fr.nf','nospam.ze.tc','nomail.xl.cx','mega.zik.dj',
  'speed.1s.fr','courriel.fr.nf','moncourrier.fr.nf','monemail.fr.nf','monmail.fr.nf',
  'mailnull.com','spamgourmet.com','spamgourmet.net','spamgourmet.org',
  'spamfree24.org','spamfree24.de','spamfree24.info','spamfree24.biz',
  'spamfree24.net','spamfree24.com','spamfree.eu','spamex.com','spaml.de','spaml.com',
  'spamtrap.ro','spamcowboy.com','spamcowboy.net','spamcowboy.org',
  'tempmail.com','tempmail.de','tempmail.eu','tempmail.it','tempmail.us',
  'tempmail.win','tempmail2.com','temp-mail.org','temp-mail.de','temp-mail.ru',
  'tempemail.com','tempemail.net','tempemail.us','tempinbox.com','tempinbox.co.uk',
  'fakeinbox.com','fakeinbox.net','fakeinbox.org','fakemailgenerator.com',
  'throwam.com','throwaway.email','throwamail.com','getairmail.com',
  'filzmail.com','maileater.com','mailexpire.com','mailguard.me','mailnew.com',
  'mailtemporaire.com','mailtemporaire.fr','mailbidon.com','mailbucket.org',
  'discard.email','mintemail.com','selfdestructingmail.com','sofort-mail.de',
  'wegwerfmail.de','wegwerfmail.net','wegwerfmail.org','wegwerfadresse.de',
  'zehnminuten.de','zehnminutenmail.de','dodgeit.com','dodgit.com',
  'mailismagic.com','mail-temporaire.fr','inboxalias.com','instantemailaddress.com',
  'owlpic.com','tempalias.com','incognitomail.com','incognitomail.net',
  'incognitomail.org','rcpt.at','rejectmail.com','spam.la','spam.su',
  'spambox.us','spambox.info','mailde.icu','mailjunk.cf','mailjunk.ga',
  'mailjunk.gq','mailjunk.ml','mailjunk.tk','mailfree.ga',
]);

// ── Domain email validation (MX record + disposable check) ───────────────────
async function checkEmailDomain(email: string): Promise<{ ok: boolean; reason?: string }> {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return { ok: false, reason: 'Invalid email address.' };

  // Layer 2a — disposable blocklist (instant, no network)
  if (DISPOSABLE_DOMAINS.has(domain)) {
    return { ok: false, reason: 'Disposable email addresses are not allowed. Please use a real inbox.' };
  }

  // Layer 2b — MX record check (Deno built-in DNS, no extra package)
  try {
    const records = await Deno.resolveDns(domain, 'MX');
    if (!records || records.length === 0) {
      return { ok: false, reason: 'This email domain has no mail server. Please use a valid email address.' };
    }
  } catch {
    return { ok: false, reason: 'Could not verify the email domain. Please use a valid email address.' };
  }

  return { ok: true };
}

// Service-role client — for DB operations and admin tasks (bypasses RLS)
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);



// Initialize storage buckets on startup
const BUCKET_NAME       = 'make-e07959ec-images';
const VIDEO_BUCKET_NAME = 'make-e07959ec-videos';
const BRAND_BUCKET_NAME = 'make-e07959ec-brand';
const GUIDE_BUCKET_NAME = 'make-e07959ec-guides';

/** Attempt to create a bucket, treating 409 as success. Retries up to 3× on 5xx. */
async function ensureBucket(
  name: string,
  options: { public: boolean; fileSizeLimit?: number },
  attempt = 1
): Promise<void> {
  try {
    const { error } = await supabase.storage.createBucket(name, options);
    if (!error) {
      console.log(`[storage] Bucket "${name}" created.`);
    } else if (
      error.message?.toLowerCase().includes('already exists') ||
      (error as any)?.statusCode === '409' ||
      (error as any)?.status === 409
    ) {
      console.log(`[storage] Bucket "${name}" already exists — OK.`);
    } else if (
      attempt < 3 &&
      (Number((error as any)?.status) >= 500 || Number((error as any)?.statusCode) >= 500)
    ) {
      const delay = attempt * 1500;
      console.log(`[storage] Bucket "${name}" got ${(error as any)?.status ?? (error as any)?.statusCode} on attempt ${attempt}, retrying in ${delay}ms…`);
      await new Promise(r => setTimeout(r, delay));
      return ensureBucket(name, options, attempt + 1);
    } else {
      console.error(`[storage] Error ensuring bucket "${name}" (attempt ${attempt}):`, error);
    }
  } catch (err) {
    if (attempt < 3) {
      const delay = attempt * 1500;
      console.log(`[storage] Unexpected error for bucket "${name}" on attempt ${attempt}, retrying in ${delay}ms…`, err);
      await new Promise(r => setTimeout(r, delay));
      return ensureBucket(name, options, attempt + 1);
    }
    console.error(`[storage] Failed to ensure bucket "${name}" after ${attempt} attempts:`, err);
  }
}

async function initializeStorage() {
  console.log('[storage] Initializing buckets…');
  await Promise.all([
    ensureBucket(BUCKET_NAME,       { public: true, fileSizeLimit: 10485760 }),
    ensureBucket(VIDEO_BUCKET_NAME, { public: true }),
    ensureBucket(BRAND_BUCKET_NAME, { public: true, fileSizeLimit: 5242880 }),
    ensureBucket(GUIDE_BUCKET_NAME, { public: true, fileSizeLimit: 5242880 }),
  ]);
  console.log('[storage] Bucket initialization complete.');
}

// Initialize storage on startup (non-blocking with error handling)
initializeStorage().catch(err => {
  console.error('[storage] Initialization error (non-fatal, buckets may already exist):', err);
});

const app = new Hono();

// Enable logger
app.use('*', logger(console.log));

// Add detailed request/response logging
app.use('*', async (c, next) => {
  const start = Date.now();
  const path = c.req.path;
  const method = c.req.method;
  
  console.log(`[REQUEST START] ${method} ${path}`);
  
  try {
    await next();
    const duration = Date.now() - start;
    console.log(`[REQUEST END] ${method} ${path} - ${c.res.status} (${duration}ms)`);
  } catch (error) {
    const duration = Date.now() - start;
    console.error(`[REQUEST FAILED] ${method} ${path} - Error after ${duration}ms:`, error);
    throw error;
  }
});

// Add timeout middleware to prevent hanging requests
app.use('*', async (c, next) => {
  const timeoutPromise = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Request timeout')), 55000) // 55 second timeout
  );
  
  try {
    await Promise.race([next(), timeoutPromise]);
  } catch (error) {
    if (error instanceof Error && error.message === 'Request timeout') {
      console.error('[TIMEOUT]', c.req.url);
      return c.json({ success: false, error: 'Request timeout' }, 504);
    }
    throw error; // Re-throw to be caught by error handler
  }
});

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "X-Admin-Token", "X-User-Token"],
    allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-e07959ec/health", (c) => {
  return c.json({ status: "ok" });
});

// ========== AUTH MIDDLEWARE ==========

// ── Field-name helpers ──────────────────────────────────────────────────────
// The frontend uses camelCase; the DB uses snake_case.
// These helpers translate at the API boundary so neither side has to change.

const camelToSnake = (s: string) =>
  s.replace(/[A-Z]/g, l => `_${l.toLowerCase()}`);

const snakeToCamel = (s: string) =>
  s.replace(/_([a-z])/g, (_, l) => l.toUpperCase());

/** Converts all top-level keys of an object from camelCase → snake_case. */
const toDbRow = (obj: Record<string, any>): Record<string, any> => {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) out[camelToSnake(k)] = v;
  return out;
};

/** Converts all keys of an object (and nested arrays) from snake_case → camelCase. */
const fromDbRow = (obj: Record<string, any>): Record<string, any> => {
  const out: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    const ck = snakeToCamel(k);
    if (Array.isArray(v)) {
      out[ck] = v.map(item =>
        item !== null && typeof item === 'object' ? fromDbRow(item) : item
      );
    } else {
      out[ck] = v;
    }
  }
  return out;
};

/**
 * Like fromDbRow but also remaps the Supabase join key `toolVersions`
 * (which comes from the `tool_versions` table name) to `versions`,
 * which is what every frontend page expects.
 */
const normalizeTool = (tool: Record<string, any>): Record<string, any> => {
  const t = fromDbRow(tool);
  // Remap toolVersions → versions
  if (t.toolVersions !== undefined) {
    t.versions = t.toolVersions;
    delete t.toolVersions;
  }
  // Extract hidden sentinel entries from faqs and surface them as first-class fields:
  //   🎬  → tool.demoUrl      (video URL)
  //   📋  → tool.howItWorks   (JSON array of { title, description } steps)
  //   🖥️  → tool.systemRequirements
  //   🏷️  → tool.tagline
  //   🗂️  → tool.toolCategory (type category tag)
  //   🆓  → tool.freeCtaText
  //   🔵  → tool.freeCtaIcon
  //   💵  → tool.paidCtaText
  //   🟣  → tool.paidCtaIcon
  //   🎯  → tool.showcasePaidCtaText
  if (Array.isArray(t.faqs)) {
    const demoEntry = t.faqs.find((f: any) => f.question === '🎬');
    if (demoEntry) {
      t.demoUrl = demoEntry.answer;
    }
    const hiwEntry = t.faqs.find((f: any) => f.question === '📋');
    if (hiwEntry) {
      try { t.howItWorks = JSON.parse(hiwEntry.answer); } catch { t.howItWorks = []; }
    }
    const sysReqEntry = t.faqs.find((f: any) => f.question === '🖥️');
    if (sysReqEntry) {
      t.systemRequirements = sysReqEntry.answer;
    }
    const taglineEntry = t.faqs.find((f: any) => f.question === '🏷️');
    if (taglineEntry) {
      t.tagline = taglineEntry.answer;
    }
    const toolCategoryEntry = t.faqs.find((f: any) => f.question === '🗂️');
    if (toolCategoryEntry) {
      t.toolCategory = toolCategoryEntry.answer;
    }
    const freeCtaTextEntry = t.faqs.find((f: any) => f.question === '🆓');
    if (freeCtaTextEntry) {
      t.freeCtaText = freeCtaTextEntry.answer;
    }
    const freeCtaIconEntry = t.faqs.find((f: any) => f.question === '🔵');
    if (freeCtaIconEntry) {
      t.freeCtaIcon = freeCtaIconEntry.answer;
    }
    const paidCtaTextEntry = t.faqs.find((f: any) => f.question === '💵');
    if (paidCtaTextEntry) {
      t.paidCtaText = paidCtaTextEntry.answer;
    }
    const paidCtaIconEntry = t.faqs.find((f: any) => f.question === '🟣');
    if (paidCtaIconEntry) {
      t.paidCtaIcon = paidCtaIconEntry.answer;
    }
    const showcasePaidCtaTextEntry = t.faqs.find((f: any) => f.question === '🎯');
    if (showcasePaidCtaTextEntry) {
      t.showcasePaidCtaText = showcasePaidCtaTextEntry.answer;
    }
    // Strip sentinels so they never appear in the visible FAQ list
    t.faqs = t.faqs.filter((f: any) =>
      f.question !== '🎬' && f.question !== '📋' && f.question !== '🖥️' &&
      f.question !== '🏷️' && f.question !== '🗂️' && f.question !== '🆓' &&
      f.question !== '🔵' && f.question !== '💵' && f.question !== '🟣' &&
      f.question !== '🎯'
    );
  }

  // Decode version-level sentinel info stored in features[]
  // 💰 <encoded>  → version.pricingModel + individual price fields + pricingDisplay
  //   "Free"                      → pricingDisplay = 'Free'
  //   "subscription|<mo>|<yr>"   → pricingModel, monthlyPrice, yearlyPrice, pricingDisplay
  //   "lifetime|<price>"          → pricingModel, lifetimePrice, pricingDisplay
  // 📦 <item>     → version.whatsIncluded[]
  if (Array.isArray(t.versions)) {
    t.versions = t.versions.map((v: any) => {
      if (!Array.isArray(v.features)) return v;
      const priceEntry = v.features.find((f: string) => typeof f === 'string' && f.startsWith('💰 '));
      if (priceEntry) {
        const raw = (priceEntry as string).replace('💰 ', '');
        if (raw === 'Free') {
          v.pricingDisplay = 'Free';
        } else if (raw.startsWith('subscription|') || raw.startsWith('lifetime|')) {
          // Unambiguous pipe-delimited format introduced to replace the old plain-text format
          const [model, p1, p2, p3] = raw.split('|');
          v.pricingModel = model;
          if (model === 'subscription') {
            v.monthlyPrice   = p1 || '';
            v.yearlyPrice    = p2 || '';
            v.pricingDisplay = [v.monthlyPrice, v.yearlyPrice ? v.yearlyPrice + '/yr' : ''].filter(Boolean).join(' / ');
          } else {
            // lifetime|<price>|<buyUrl>
            v.lifetimePrice  = p1 || '';
            v.lifetimeBuyUrl = p2 || '';
            v.pricingDisplay = v.lifetimePrice;
          }
        } else {
          // Legacy plain-text format — surface for display only; admin must re-enter prices on edit
          v.pricingDisplay = raw;
        }
      }
      const includedEntries = v.features.filter((f: string) => typeof f === 'string' && f.startsWith('📦 '));
      if (includedEntries.length > 0) {
        v.whatsIncluded = includedEntries.map((f: string) => f.replace('📦 ', ''));
      }
      // Decode activation steps
      const stepEntries = v.features.filter((f: string) => typeof f === 'string' && f.startsWith('🔑 '));
      if (stepEntries.length > 0) {
        v.activationSteps = stepEntries.map((f: string) => f.replace('🔑 ', ''));
      }
      // Decode rich features with screenshots (🎨 JSON)
      // Decode old-style 🎨 full-feature JSON (kept for migration — normalizeTool promotes these to tool level)
      const richFeatEntries = v.features.filter((f: string) => typeof f === 'string' && f.startsWith('🎨 '));
      if (richFeatEntries.length > 0) {
        v.richFeatures = richFeatEntries.map((f: string) => {
          try { return JSON.parse(f.replace('🎨 ', '')); } catch { return null; }
        }).filter(Boolean);
      }
      // Decode version accent color: 🖌️ color|#hex
      const colorEntry = v.features.find((f: string) => typeof f === 'string' && f.startsWith('🖌️ '));
      if (colorEntry) {
        const parts = (colorEntry as string).replace('🖌️ ', '').split('|');
        v.color = parts[1] || parts[0] || '';
      }
      // Decode includedFeatureIds: ✅ featureId entries
      const featureIdEntries = v.features.filter((f: string) => typeof f === 'string' && f.startsWith('✅ '));
      if (featureIdEntries.length > 0) {
        v.includedFeatureIds = featureIdEntries.map((f: string) => f.replace('✅ ', ''));
      }
      // Decode feature label: 📝 <text>
      const featureLabelEntry = v.features.find((f: string) => typeof f === 'string' && f.startsWith('📝 '));
      if (featureLabelEntry) {
        v.featureLabel = (featureLabelEntry as string).replace('📝 ', '');
      }
      // Remove the raw features array after decoding
      delete v.features;
      return v;
    });
  }

  // Decode tool-level rich_features (stored as JSONB array in tools.rich_features)
  if (Array.isArray(t.richFeatures)) {
    // already camelCased by fromDbRow — nothing to do
  }

  // ── Migration: if tool has no richFeatures but versions have old 🎨 data,
  // promote them to tool level and derive includedFeatureIds per version.
  if ((!t.richFeatures || t.richFeatures.length === 0) && Array.isArray(t.versions)) {
    const seen = new Set<string>();
    const pool: any[] = [];
    for (const v of t.versions) {
      for (const f of (v.richFeatures ?? [])) {
        if (f.id && !seen.has(f.id)) { seen.add(f.id); pool.push(f); }
      }
    }
    if (pool.length > 0) {
      t.richFeatures = pool;
      for (const v of t.versions) {
        const oldIds = new Set((v.richFeatures ?? []).map((f: any) => f.id));
        v.includedFeatureIds = pool.filter(f => oldIds.has(f.id)).map(f => f.id);
        delete v.richFeatures;
      }
    }
  }

  return t;
};
// ────────────────────────────────────────────────────────────────────────────

// ── Brute-force rate limiter ─────────────────────��────────────────────────
// Tracks failed login attempts per IP in memory.  Edge-function instances are
// ephemeral so this doesn't survive a cold-start — that's acceptable because
// the Resend alert adds a persistent, out-of-band notification layer on top.

interface LoginAttemptRecord {
  count: number;        // consecutive failures
  lockedUntil: number;  // epoch ms — 0 means not locked
  alertSent: boolean;   // true once the 5-failure email has been sent this window
}

const loginAttempts = new Map<string, LoginAttemptRecord>();
const MAX_LOGIN_FAILURES = 5;
const LOCKOUT_MS         = 15 * 60 * 1000; // 15 minutes

function getAttemptRecord(ip: string): LoginAttemptRecord {
  if (!loginAttempts.has(ip)) {
    loginAttempts.set(ip, { count: 0, lockedUntil: 0, alertSent: false });
  }
  return loginAttempts.get(ip)!;
}

async function sendBruteForceAlert(ip: string, attemptedEmail: string) {
  try {
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      console.warn('⚠️  RESEND_API_KEY not set — cannot send brute-force alert');
      return;
    }

    // Fetch the admin contact email from site_settings
    const { data: row } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'contactEmail')
      .maybeSingle();

    const adminEmail = row?.value as string | undefined;
    if (!adminEmail) {
      console.warn('⚠️  contactEmail not set in site_settings — cannot send brute-force alert');
      return;
    }

    const resend = new Resend(resendKey);
    const now    = new Date().toUTCString();

    await resend.emails.send({
      from: 'Fastoosh Security <security@contact.fastoosh.com>',
      to:   adminEmail,
      subject: '🚨 Admin Login — 5 Failed Attempts Detected',
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#e5e5e5;border-radius:12px;overflow:hidden;">
          <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:28px 32px;">
            <h1 style="margin:0;font-size:22px;color:#fff;">🚨 Security Alert — Fastoosh Admin</h1>
          </div>
          <div style="padding:32px;">
            <p style="font-size:16px;line-height:1.6;color:#d4d4d4;">
              <strong>5 consecutive failed login attempts</strong> were recorded on your admin panel.
              The IP has been locked out for <strong>15 minutes</strong>.
            </p>
            <table style="width:100%;border-collapse:collapse;margin-top:24px;">
              <tr>
                <td style="padding:10px 14px;background:#1a1a1a;border-radius:6px 6px 0 0;color:#a3a3a3;font-size:13px;width:140px;">IP Address</td>
                <td style="padding:10px 14px;background:#1a1a1a;border-radius:6px 6px 0 0;color:#fff;font-size:13px;font-family:monospace;">${ip}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;background:#141414;color:#a3a3a3;font-size:13px;">Targeted Email</td>
                <td style="padding:10px 14px;background:#141414;color:#fff;font-size:13px;font-family:monospace;">${attemptedEmail || 'unknown'}</td>
              </tr>
              <tr>
                <td style="padding:10px 14px;background:#1a1a1a;border-radius:0 0 6px 6px;color:#a3a3a3;font-size:13px;">Time (UTC)</td>
                <td style="padding:10px 14px;background:#1a1a1a;border-radius:0 0 6px 6px;color:#fff;font-size:13px;">${now}</td>
              </tr>
            </table>
            <p style="margin-top:28px;font-size:14px;color:#a3a3a3;">
              If this was you, simply wait 15 minutes and try again.
              If it wasn't, consider changing your admin password immediately.
            </p>
            <p style="margin-top:8px;font-size:12px;color:#525252;">
              This alert was generated automatically by Fastoosh's login security system.
            </p>
          </div>
        </div>
      `,
    });

    console.log(`✅ Brute-force alert email sent to ${adminEmail}`);
  } catch (err) {
    console.error('❌ Failed to send brute-force alert email:', err);
  }
}
// ─────────────────────────────────────────────────────────────────────────────

// ── Admin session auth ────────────────────────────────────────────────────
// The Supabase edge-function gateway validates the standard `Authorization`
// header BEFORE the request reaches Hono — sending a UUID there causes a 401
// from Supabase itself, never reaching our code.
//
// Solution: `Authorization: Bearer <anonKey>` satisfies Supabase's gateway;
// our opaque UUID session token travels in a separate `X-Admin-Token` header
// that Supabase ignores entirely.
const requireAuth = async (c: any, next: any) => {
  try {
    const token = c.req.header('X-Admin-Token')?.trim();

    if (!token) {
      console.log('❌ Admin auth: no X-Admin-Token header');
      return c.json({ success: false, error: 'Unauthorized' }, 401);
    }

    const session = await kv.get(`admin_session:${token}`);

    if (!session) {
      console.log('❌ Admin auth: session not found for token prefix', token.substring(0, 8));
      return c.json({ success: false, error: 'Invalid or expired session' }, 401);
    }

    if (new Date(session.expiresAt) < new Date()) {
      console.log('❌ Admin auth: session expired');
      await kv.del(`admin_session:${token}`);
      return c.json({ success: false, error: 'Session expired — please log in again' }, 401);
    }

    console.log('✅ Admin auth OK:', session.email);
    c.set('user', { id: session.userId, email: session.email });
    await next();
  } catch (error) {
    console.log('❌ Error in admin auth middleware:', error);
    return c.json({ success: false, error: `Unauthorized - ${String(error)}` }, 401);
  }
};

// ── User JWT auth middleware ───────────────────────────────────────────────
const requireUserAuth = async (c: any, next: any) => {
  try {
    // Read the user JWT from the custom X-User-Token header.
    // We avoid Authorization for user JWTs because the Supabase gateway
    // (verify_jwt = true default) rejects ES256 asymmetric tokens before
    // they reach our code. The anon key rides in Authorization; the real
    // user JWT comes in X-User-Token, which the gateway never inspects.
    const token = c.req.header('X-User-Token') || '';
    if (!token) {
      console.log('requireUserAuth: missing X-User-Token header');
      return c.json({ success: false, error: 'Unauthorized — no X-User-Token header' }, 401);
    }
    const { data: { user }, error } = await supabase.auth.getUser(token);
    if (error || !user) {
      console.log('requireUserAuth: token rejected —', error?.message);
      return c.json({ success: false, error: `Invalid or expired session — ${error?.message}` }, 401);
    }
    c.set('user', { id: user.id, email: user.email });
    await next();
  } catch (err) {
    console.log('requireUserAuth: unexpected error —', String(err));
    return c.json({ success: false, error: `Unauthorized — ${String(err)}` }, 401);
  }
};
// ────────────────────────────────────────────────────────────────────────────

// ========== AUTH ENDPOINTS ==========

// Sign up endpoint — protected: only an existing admin can create another admin account
app.post("/make-server-e07959ec/signup", requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, fullName } = body;

    if (!email || !password) {
      return c.json({ success: false, error: "Email and password are required" }, 400);
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { full_name: fullName || '' },
      email_confirm: true, // Auto-confirm since email server not configured
    });

    if (error) {
      console.log(`Error creating user: ${error.message}`);
      return c.json({ success: false, error: error.message }, 400);
    }

    return c.json({ 
      success: true, 
      data: { 
        user: {
          id: data.user.id,
          email: data.user.email,
        }
      } 
    });
  } catch (error) {
    console.log(`Error in signup: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Login endpoint — rate-limited: 5 failures per IP → 15-minute lockout + alert email
app.post('/make-server-e07959ec/login', async (c) => {
  try {
    const { email, password } = await c.req.json();

    // ── Resolve client IP ────────────────────────────────────────────────────
    const ip = (
      c.req.header('cf-connecting-ip') ||
      c.req.header('x-real-ip') ||
      (c.req.header('x-forwarded-for') ?? '').split(',')[0].trim() ||
      'unknown'
    );

    const record = getAttemptRecord(ip);
    const now    = Date.now();

    // Reject immediately if still locked out
    if (record.lockedUntil > now) {
      const remainingSecs = Math.ceil((record.lockedUntil - now) / 1000);
      const remainingMins = Math.ceil(remainingSecs / 60);
      console.log(`🔒 Login blocked for IP ${ip} — ${remainingSecs}s remaining`);
      return c.json(
        { success: false, error: `Too many failed attempts. Try again in ${remainingMins} minute${remainingMins !== 1 ? 's' : ''}.` },
        429,
      );
    }

    // Auto-reset counter if lockout window has expired (IP was locked, then unlocked)
    if (record.lockedUntil > 0 && record.lockedUntil <= now) {
      loginAttempts.delete(ip);
    }
    // ────────────────────────────────────────────────────────────────────────

    // Create a client with anon key for auth
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );
    
    const { data, error } = await authClient.auth.signInWithPassword({
      email,
      password,
    });
    
    if (error || !data.user || !data.session) {
      // ── Record failure ─────────────────────────────────────────────────────
      const rec = getAttemptRecord(ip); // re-fetch in case it was deleted above
      rec.count += 1;
      console.log(`❌ Login failed for IP ${ip} (attempt ${rec.count}/${MAX_LOGIN_FAILURES}):`, error?.message);

      if (rec.count >= MAX_LOGIN_FAILURES) {
        rec.lockedUntil = Date.now() + LOCKOUT_MS;

        // Fire alert email once per lockout window
        if (!rec.alertSent) {
          rec.alertSent = true;
          sendBruteForceAlert(ip, email).catch(() => {}); // fire-and-forget
        }

        console.log(`🔒 IP ${ip} locked out for 15 minutes`);
        return c.json(
          { success: false, error: 'Too many failed attempts. You have been locked out for 15 minutes. The site owner has been notified.' },
          429,
        );
      }

      const remaining = MAX_LOGIN_FAILURES - rec.count;
      return c.json(
        { success: false, error: `Invalid credentials. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining before lockout.` },
        401,
      );
      // ──────────────────────────────────────────────────────────────────────
    }

    // ── Successful login — wipe rate-limit record for this IP ────────────────
    loginAttempts.delete(ip);
    // ─────────────────────────────────────────────────────────────────────────

    console.log('✅ Credentials verified for:', data.user.email);

    // Mint an opaque server-side session token (UUID) stored in KV.
    const sessionToken = crypto.randomUUID();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30); // 30-day session

    await kv.set(`admin_session:${sessionToken}`, {
      userId:    data.user.id,
      email:     data.user.email,
      expiresAt: expiresAt.toISOString(),
    });

    console.log('✅ Admin session created for:', data.user.email);

    return c.json({
      success: true,
      session: {
        access_token: sessionToken,
      },
      user: {
        id:    data.user.id,
        email: data.user.email,
      },
    });
  } catch (error) {
    console.log('Login error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ── Public user registration with OTP email verification ─────────────────────
// Layer 2: MX check + disposable blocklist
// Layer 3: OTP via Resend — account is NOT confirmed until /auth/register/verify

app.post('/make-server-e07959ec/auth/register', async (c) => {
  try {
    const { email, password, fullName } = await c.req.json();

    if (!email || !password) {
      return c.json({ success: false, error: 'Email and password are required.' }, 400);
    }

    const cleanEmail = email.toLowerCase().trim();

    // Basic format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return c.json({ success: false, error: 'Invalid email address.' }, 400);
    }
    if (password.length < 8) {
      return c.json({ success: false, error: 'Password must be at least 8 characters.' }, 400);
    }

    // Layer 2: domain check (disposable blocklist + MX records)
    const domainCheck = await checkEmailDomain(cleanEmail);
    if (!domainCheck.ok) {
      console.log(`[register] Domain blocked for ${cleanEmail}: ${domainCheck.reason}`);
      return c.json({ success: false, error: domainCheck.reason }, 400);
    }

    // Create unconfirmed user (email_confirm: false → can't sign in yet)
    const { data, error: createError } = await supabase.auth.admin.createUser({
      email: cleanEmail,
      password,
      user_metadata: { full_name: fullName || '' },
      email_confirm: false,
    });

    if (createError) {
      console.log(`[register] createUser error: ${createError.message}`);
      // Surface duplicate-email as a friendly message
      if (createError.message.toLowerCase().includes('already registered') ||
          createError.message.toLowerCase().includes('already been registered')) {
        return c.json({ success: false, error: 'An account with this email already exists.' }, 409);
      }
      return c.json({ success: false, error: createError.message }, 400);
    }

    const userId    = data.user.id;
    const safeEmail = encodeURIComponent(cleanEmail).replace(/%/g, '_');
    const otpKey    = `signup_otp:${safeEmail}`;
    const otp       = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = Date.now() + 15 * 60 * 1000; // 15 min

    await kv.set(otpKey, { code: otp, userId, email: cleanEmail, expiresAt, attempts: 0 });

    console.log(`[register] ⏳ OTP generated for ${cleanEmail} (userId: ${userId})`);

    // Layer 3: send OTP via Resend
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (resendKey) {
      const resend      = new Resend(resendKey);
      const displayCode = `${otp.slice(0, 3)} ${otp.slice(3)}`;
      const year        = new Date().getFullYear();

      await resend.emails.send({
        from:    'Fastoosh <noreply@contact.fastoosh.com>',
        to:      cleanEmail,
        subject: `Your Fastoosh verification code: ${displayCode}`,
        text:    `Your Fastoosh verification code is: ${otp}\n\nEnter this code to complete your account creation. It expires in 15 minutes.\n\nIf you didn't create a Fastoosh account, you can safely ignore this email — no action is needed.\n\n— Fastoosh\nhttps://fastoosh.com`,
        html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Verify your Fastoosh account</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111111;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" style="max-width:520px;" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding-bottom:32px;">
              <span style="font-size:20px;font-weight:800;letter-spacing:-0.5px;color:#111111;">Fastoosh</span>
            </td>
          </tr>
          <tr>
            <td style="border-top:2px solid #111111;padding-top:28px;">
              <p style="margin:0 0 6px;font-size:13px;color:#888888;text-transform:uppercase;letter-spacing:0.08em;">Account verification</p>
              <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#111111;line-height:1.3;">Verify your email address</h1>
              <p style="margin:0 0 24px;font-size:15px;color:#444444;line-height:1.6;">
                Enter this code in the Fastoosh sign-up form to activate your account:
              </p>
              <div style="margin:0 0 28px;padding:24px;background:#f5f5f5;border-radius:10px;text-align:center;">
                <span style="font-size:42px;font-weight:800;letter-spacing:10px;color:#111111;font-variant-numeric:tabular-nums;">${displayCode}</span>
              </div>
              <p style="margin:0;font-size:12px;color:#999999;line-height:1.7;border-top:1px solid #eeeeee;padding-top:20px;">
                This code expires in 15 minutes. If you didn't create a Fastoosh account, you can safely ignore this email — nothing will happen.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-top:32px;">
              <p style="margin:0;font-size:11px;color:#bbbbbb;">© ${year} Fastoosh · <a href="https://fastoosh.com" style="color:#bbbbbb;text-decoration:none;">fastoosh.com</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      });
      console.log(`[register] ✉️  OTP emailed to ${cleanEmail}`);
    } else {
      console.warn('[register] RESEND_API_KEY not set — OTP email not sent');
    }

    return c.json({ success: true, message: 'Verification code sent.' });
  } catch (err) {
    console.log(`[register] Error: ${err}`);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// POST /auth/register/verify — confirm 6-digit OTP, activate account
app.post('/make-server-e07959ec/auth/register/verify', async (c) => {
  try {
    const { email, otp } = await c.req.json();

    if (!email || !otp) {
      return c.json({ success: false, error: 'Email and code are required.' }, 400);
    }

    const cleanEmail = email.toLowerCase().trim();
    const safeEmail  = encodeURIComponent(cleanEmail).replace(/%/g, '_');
    const otpKey     = `signup_otp:${safeEmail}`;
    const entry      = await kv.get(otpKey);

    if (!entry) {
      return c.json({ success: false, error: 'Code not found. Please sign up again.' }, 404);
    }

    if (Date.now() > entry.expiresAt) {
      await kv.del(otpKey);
      // Clean up the unconfirmed user so the email can be reused
      await supabase.auth.admin.deleteUser(entry.userId).catch(() => {});
      return c.json({ success: false, error: 'Code expired. Please sign up again.', expired: true }, 410);
    }

    const attempts = (entry.attempts || 0) + 1;
    if (attempts > 5) {
      await kv.del(otpKey);
      await supabase.auth.admin.deleteUser(entry.userId).catch(() => {});
      return c.json({ success: false, error: 'Too many incorrect attempts. Please sign up again.', tooMany: true }, 429);
    }

    if (entry.code !== String(otp).replace(/\s/g, '')) {
      await kv.set(otpKey, { ...entry, attempts });
      const remaining = 5 - attempts;
      return c.json({
        success: false,
        error: remaining > 0
          ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Too many incorrect attempts. Please sign up again.',
      }, 400);
    }

    // ✅ Correct — flip email_confirm → true so the user can now sign in
    const { error: confirmErr } = await supabase.auth.admin.updateUserById(entry.userId, {
      email_confirm: true,
    });

    if (confirmErr) {
      console.log(`[register/verify] Error confirming user: ${confirmErr.message}`);
      return c.json({ success: false, error: 'Failed to activate account. Please try again.' }, 500);
    }

    await kv.del(otpKey);
    console.log(`[register/verify] ✅ Account activated: ${cleanEmail}`);
    return c.json({ success: true });
  } catch (err) {
    console.log('[register/verify] Error:', err);
    return c.json({ success: false, error: 'Server error. Please try again.' }, 500);
  }
});

// Get current user
app.get("/make-server-e07959ec/auth/me", requireAuth, async (c) => {
  try {
    const user = c.get('user');
    
    // Get user profile
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    
    if (error) {
      console.log(`Error fetching user profile: ${error.message}`);
    }
    
    return c.json({ 
      success: true, 
      data: {
        id: user.id,
        email: user.email,
        ...(profile ?? {}),
      }
    });
  } catch (error) {
    console.log(`Error in auth/me: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Test auth endpoint (for debugging)
app.get("/make-server-e07959ec/auth/test", requireAuth, async (c) => {
  try {
    const user = c.get('user');
    console.log('Auth test successful for user:', user.id, user.email);
    
    return c.json({ 
      success: true, 
      message: 'Authentication working!',
      user: {
        id: user.id,
        email: user.email,
      }
    });
  } catch (error) {
    console.log(`Error in auth test: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Logout endpoint — deletes the server-side KV session
app.post("/make-server-e07959ec/logout", requireAuth, async (c) => {
  try {
    const token = c.req.header('X-Admin-Token')?.trim();
    if (token) {
      await kv.del(`admin_session:${token}`);
      console.log('✅ Admin session deleted');
    }
    return c.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    console.log(`Error in logout: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ========== JSON REPAIR HELPER ==========
// Closes truncated JSON strings/objects that result from token-limit cutoffs
function repairJson(raw: string): string {
  let s = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
  try { JSON.parse(s); return s; } catch {}

  const opens: string[] = [];
  let inString = false;
  let escaped = false;

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\' && inString) { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (!inString) {
      if (ch === '{') opens.push('}');
      else if (ch === '[') opens.push(']');
      else if (ch === '}' || ch === ']') opens.pop();
    }
  }

  if (inString) s += '"';
  s += opens.reverse().join('');
  return s;
}

// ========== GEMINI HELPERS ==========

/** Returns { apiKey, model } from site_settings (with env var fallback for the key). */
async function getGeminiConfig(): Promise<{ apiKey: string; model: string }> {
  const { data } = await supabase.from('site_settings').select('key, value').in('key', ['geminiApiKey', 'geminiModel']);
  const row = (data || []).reduce((acc: any, item: any) => { acc[item.key] = item.value; return acc; }, {});
  const apiKey: string = row.geminiApiKey || Deno.env.get('GEMINI_API_KEY') || '';
  const model: string  = row.geminiModel  || 'gemini-2.5-flash';
  return { apiKey, model };
}

function geminiUrl(model: string, apiKey: string): string {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
}

// ========== AI CONTENT GENERATION ==========

app.post("/make-server-e07959ec/admin/generate-tool-content", requireAuth, async (c) => {
  try {
    const { tool, versions, instruction = '', improveExisting = false } = await c.req.json();

    const { apiKey, model: geminiModel } = await getGeminiConfig();
    if (!apiKey) {
      return c.json({ success: false, error: 'GEMINI_API_KEY not configured in environment' }, 500);
    }

    const toolName = (tool.name || '').trim();
    if (!toolName) {
      return c.json({ success: false, error: 'Tool name is required to generate content' }, 400);
    }
    const toolCategory = (tool.category || 'After Effects').trim();

    // ── Determine which fields need generation ──────────────────────────────
    // improveExisting=true  → rewrite mode: all fields are regenerated
    // improveExisting=false → fill mode: only empty fields are generated
    const gen: Record<string, boolean> = {};
    if (improveExisting || !tool.description?.trim())         gen.description        = true;
    if (improveExisting || !tool.tagline?.trim())             gen.tagline            = true;
    if (improveExisting || !tool.systemRequirements?.trim())  gen.systemRequirements = true;

    const hiwEmpty = !tool.howItWorks || tool.howItWorks.length === 0 ||
      tool.howItWorks.every((s: any) => !s.title?.trim() && !s.description?.trim());
    if (improveExisting || hiwEmpty) gen.howItWorks = true;

    const faqsEmpty = !tool.faqs || tool.faqs.length === 0 ||
      tool.faqs.every((f: any) => !f.question?.trim());
    if (improveExisting || faqsEmpty) gen.faqs = true;

    const versionsNeedGen = (versions || []).map((v: any) => {
      const featEmpty  = !v.features        || v.features.filter((f: string)       => f?.trim()).length === 0;
      const inclEmpty  = !v.whatsIncluded   || v.whatsIncluded.filter((f: string)  => f?.trim()).length === 0;
      const stepsEmpty = !v.activationSteps || v.activationSteps.filter((s: string)=> s?.trim()).length === 0;
      return {
        id: v.id,
        versionType: v.versionType,
        existingFeatures:        (v.features        || []).filter((f: string) => f?.trim()),
        existingWhatsIncluded:   (v.whatsIncluded   || []).filter((f: string) => f?.trim()),
        existingActivationSteps: (v.activationSteps || []).filter((s: string) => s?.trim()),
        genFeatures:        improveExisting || featEmpty,
        genWhatsIncluded:   improveExisting || inclEmpty,
        genActivationSteps: improveExisting || stepsEmpty,
        needsAny: improveExisting || featEmpty || inclEmpty || stepsEmpty,
      };
    }).filter((v: any) => v.needsAny);

    const hasToolFields    = Object.values(gen).some(Boolean);
    const hasVersionFields = versionsNeedGen.length > 0;

    if (!hasToolFields && !hasVersionFields) {
      return c.json({
        success: true,
        data: {},
        message: 'All fields are already filled — nothing to generate.',
        nothingToGenerate: true,
      });
    }

    // ── Build Gemini prompt ─────────────────────────────────────────────────

    const instructionLine = instruction?.trim()
      ? `\nUser instruction: "${instruction.trim()}" — let this guide your tone, focus, and style.`
      : '';

    // Rewrite mode: surface existing values so Gemini can improve them meaningfully
    const existingToolContext = improveExisting ? [
      tool.description?.trim()        ? `Current description: "${tool.description.trim()}"` : '',
      tool.tagline?.trim()            ? `Current tagline: "${tool.tagline.trim()}"` : '',
      tool.systemRequirements?.trim() ? `Current system requirements: "${tool.systemRequirements.trim()}"` : '',
    ].filter(Boolean).join('\n') : (
      tool.description?.trim() ? `Existing description (use as context): "${tool.description.trim()}"` : ''
    );

    const modeInstruction = improveExisting
      ? `Your task: IMPROVE and REWRITE the marketing copy below. Make it more specific, compelling, and polished${instruction?.trim() ? ' per the user instruction above' : ''}.`
      : `Your task: Generate marketing copy for the following tool.`;

    let schemaLines = '';
    if (gen.description) {
      schemaLines += `  "description": "<2-3 sentence product description. Professional, benefit-focused, concrete>",\n`;
    }
    if (gen.tagline) {
      schemaLines += `  "tagline": "<One punchy tagline max 10 words. E.g. Automate the boring. Amplify the creative.>",\n`;
    }
    if (gen.systemRequirements) {
      schemaLines += `  "systemRequirements": "<Technical requirements. E.g. After Effects CC 2022 or later · Windows 10 / macOS 11+ · 8 GB RAM>",\n`;
    }
    if (gen.howItWorks) {
      schemaLines += `  "howItWorks": [\n    { "title": "<short step name>", "description": "<1-sentence explanation>" },\n    { "title": "...", "description": "..." },\n    { "title": "...", "description": "..." },\n    { "title": "...", "description": "..." }\n  ],\n`;
    }
    if (gen.faqs) {
      schemaLines += `  "faqs": [\n    { "question": "...", "answer": "..." },\n    { "question": "...", "answer": "..." },\n    { "question": "...", "answer": "..." },\n    { "question": "...", "answer": "..." }\n  ],\n`;
    }
    if (versionsNeedGen.length > 0) {
      schemaLines += `  "versions": [\n`;
      for (const v of versionsNeedGen) {
        schemaLines += `    {\n      "id": "${v.id}",\n`;
        if (v.genFeatures) {
          const hint = improveExisting && v.existingFeatures.length > 0
            ? ` /* improve these: ${JSON.stringify(v.existingFeatures.slice(0, 2))} */`
            : '';
          schemaLines += `      "features": ["<feature 1>", "<feature 2>", "<feature 3>", "<feature 4>", "<feature 5>"],${hint}\n`;
        }
        if (v.genWhatsIncluded) {
          schemaLines += `      "whatsIncluded": ["<item 1>", "<item 2>", "<item 3>"],\n`;
        }
        if (v.genActivationSteps) {
          schemaLines += `      "activationSteps": ["<step 1>", "<step 2>", "<step 3>", "<step 4>"]\n`;
        }
        schemaLines += `    },\n`;
      }
      schemaLines += `  ],\n`;
    }

    const versionContext = versionsNeedGen.length > 0
      ? `\nVersions to process: ${versionsNeedGen.map((v: any) => `${v.versionType} (id: ${v.id})`).join(', ')}.`
      : '';

    const prompt = `You are a professional copywriter for Fastoosh, a premium motion design studio that creates After Effects plugins, scripts, and automation tools for professional motion designers and VFX artists.

${modeInstruction} Return ONLY valid JSON — no markdown fences, no extra text.

Tool Name: "${toolName}"
Category: "${toolCategory}"${instructionLine}${existingToolContext ? '\n' + existingToolContext : ''}${versionContext}

Rules:
- description: 1-2 sentences, professional and benefit-focused, no buzzword fluff. HARD LIMIT: 250 characters maximum (count carefully — this is strict)
- tagline: max 10 words, punchy, active voice
- systemRequirements: concise, use middle dot as separator
- howItWorks: exactly 4 steps, each title is short (2-4 words), description is 1 sentence
- faqs: 4 realistic questions a buyer would ask; answers helpful and concise
- features per version: 5 bullet points specific to the tier. Free = limited/basic, Pro = full set, Studio = everything plus team perks. Write as short capability statements like "Batch process 500 layers in seconds"
- whatsIncluded per version: 3-4 items like "After Effects .jsx script file", "PDF quick-start guide", "Free updates for 12 months"
- activationSteps per version: 4 clear numbered steps after purchase. E.g. "Download the .jsx file from your Fastoosh account dashboard", "In After Effects choose File > Scripts > Install Script File", "Restart After Effects to complete installation", "Open the panel under Window > Extensions > ${toolName}"
- Tailor all content specifically to "${toolName}" — make it specific, not generic
${improveExisting ? '- REWRITE mode: improve and elevate existing copy — do not repeat it verbatim\n' : ''}
Return exactly this JSON shape:
{
${schemaLines}}`;

    console.log(`Calling Gemini for "${toolName}" [${improveExisting ? 'REWRITE' : 'FILL'}]${instruction ? ` instruction="${instruction.substring(0,60)}"` : ''} — fields: ${Object.keys(gen).join(', ')}${versionsNeedGen.length ? ` + ${versionsNeedGen.length} version(s)` : ''}`);

    const geminiRes = await fetch(
      geminiUrl(geminiModel, apiKey),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0.75,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.log('Gemini API error:', errText);
      return c.json({ success: false, error: `Gemini API error (${geminiRes.status}): ${errText}` }, 500);
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!rawText) {
      console.log('Gemini empty response:', JSON.stringify(geminiData));
      return c.json({ success: false, error: 'Gemini returned an empty response' }, 500);
    }

    let generated: Record<string, any>;
    try {
      const repaired = repairJson(rawText);
      generated = JSON.parse(repaired);
    } catch (parseErr) {
      console.log('Tool content JSON repair failed. Raw (first 500):', rawText.substring(0, 500));
      return c.json({ success: false, error: `AI response was not valid JSON: ${String(parseErr)}` }, 500);
    }

    console.log(`✅ Gemini generation complete for "${toolName}"`);
    return c.json({ success: true, data: generated });

  } catch (error) {
    console.log('Error in generate-tool-content:', error);
    return c.json({ success: false, error: `Content generation failed: ${String(error)}` }, 500);
  }
});

// ========== AI RICH FEATURES GENERATION ==========

app.post("/make-server-e07959ec/admin/generate-rich-features", requireAuth, async (c) => {
  try {
    const { toolName, category, description, versionType, instruction, count = 5 } = await c.req.json();

    const { apiKey, model: geminiModel } = await getGeminiConfig();
    if (!apiKey) return c.json({ success: false, error: 'GEMINI_API_KEY not configured' }, 500);
    if (!toolName?.trim()) return c.json({ success: false, error: 'toolName is required' }, 400);

    const instructionLine = instruction?.trim() ? `\nInstruction: "${instruction.trim()}"` : '';
    const descLine = description?.trim() ? `\nTool description: "${description.trim()}"` : '';
    const tierHint = versionType === 'Free' ? 'basic/limited capabilities'
      : versionType === 'Pro' ? 'full professional feature set'
      : 'all features plus team/studio extras';

    const prompt = `You are a professional copywriter for Fastoosh, a premium motion design studio (After Effects plugins & scripts).

Generate exactly ${count} feature items for the "${versionType ?? 'Pro'}" tier of the tool "${toolName}" (category: ${category ?? 'After Effects'}).${descLine}${instructionLine}

Tier context: ${tierHint}

Rules:
- title: 3-7 words, capability-focused, specific to this tool (e.g. "Batch Process 500+ Layers at Once")
- description: max 100 characters, benefit-focused, starts with an action verb, no filler
- Make each feature distinct — no repetition
- Tailor everything specifically to "${toolName}", not generic

Return ONLY valid JSON:
{
  "richFeatures": [
    { "title": "...", "description": "..." },
    { "title": "...", "description": "..." }
  ]
}`;

    const geminiRes = await fetch(
      geminiUrl(geminiModel, apiKey),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.8, maxOutputTokens: 2048 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const err = await geminiRes.text();
      return c.json({ success: false, error: `Gemini API error: ${err}` }, 500);
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return c.json({ success: false, error: 'Empty response from Gemini' }, 500);

    let parsed: any;
    try {
      const repaired = repairJson(rawText);
      parsed = JSON.parse(repaired);
    } catch (e) {
      return c.json({ success: false, error: `Invalid JSON from AI: ${String(e)}` }, 500);
    }

    const richFeatures = (parsed.richFeatures ?? []).map((f: any) => ({
      id: `feat-${crypto.randomUUID()}`,
      title: (f.title ?? '').slice(0, 80),
      description: (f.description ?? '').slice(0, 100),
      screenshots: [],
      featured: true,  // AI-generated features default to featured
    }));

    console.log(`✅ Generated ${richFeatures.length} rich features for "${toolName}" [${versionType}]`);
    return c.json({ success: true, richFeatures });

  } catch (error) {
    console.log('Error in generate-rich-features:', error);
    return c.json({ success: false, error: `Feature generation failed: ${String(error)}` }, 500);
  }
});

// ========== AI PROJECT CONTENT GENERATION ==========

app.post("/make-server-e07959ec/admin/generate-project-content", requireAuth, async (c) => {
  try {
    const { project, instruction = '', improveExisting = false } = await c.req.json();

    const { apiKey, model: geminiModel } = await getGeminiConfig();
    if (!apiKey) return c.json({ success: false, error: 'GEMINI_API_KEY not configured' }, 500);

    const title = (project.title || '').trim();
    if (!title) return c.json({ success: false, error: 'Project title is required' }, 400);

    const category = (project.category || 'Motion Design').trim();

    const gen: Record<string, boolean> = {};
    if (improveExisting || !project.description?.trim())  gen.description  = true;
    if (improveExisting || !project.goal?.trim())         gen.goal         = true;
    if (improveExisting || !project.approach?.trim())     gen.approach     = true;
    if (improveExisting || !project.outcome?.trim())      gen.outcome      = true;
    const tagsEmpty = !project.tags || project.tags.length === 0 || project.tags.every((t: string) => !t?.trim());
    if (improveExisting || tagsEmpty) gen.tags = true;
    const delivEmpty = !project.deliverables || project.deliverables.length === 0 || project.deliverables.every((d: string) => !d?.trim());
    if (improveExisting || delivEmpty) gen.deliverables = true;

    if (!Object.values(gen).some(Boolean)) {
      return c.json({ success: true, data: {}, nothingToGenerate: true });
    }

    const instructionLine = instruction?.trim() ? `\nUser instruction: "${instruction.trim()}"` : '';
    const existingCtx = improveExisting ? [
      project.description?.trim() ? `Current description: "${project.description.trim()}"` : '',
      project.goal?.trim()        ? `Current goal: "${project.goal.trim()}"` : '',
      project.approach?.trim()    ? `Current approach: "${project.approach.trim()}"` : '',
      project.outcome?.trim()     ? `Current outcome: "${project.outcome.trim()}"` : '',
    ].filter(Boolean).join('\n') : (project.description?.trim() ? `Existing description (context): "${project.description.trim()}"` : '');

    let schemaLines = '';
    if (gen.description)  schemaLines += `  "description": "<1-2 sentence card description. HARD LIMIT: 250 characters>",\n`;
    if (gen.goal)         schemaLines += `  "goal": "<2-3 sentences: what the client needed and why>",\n`;
    if (gen.approach)     schemaLines += `  "approach": "<2-3 sentences: creative process and techniques used>",\n`;
    if (gen.outcome)      schemaLines += `  "outcome": "<2-3 sentences: results, impact, client reaction>",\n`;
    if (gen.tags)         schemaLines += `  "tags": ["<tag1>", "<tag2>", "<tag3>", "<tag4>"],\n`;
    if (gen.deliverables) schemaLines += `  "deliverables": ["<deliverable 1>", "<deliverable 2>", "<deliverable 3>"],\n`;

    const clientHint = project.client?.trim() ? `\nClient: "${project.client.trim()}"` : '';
    const modeInstruction = improveExisting
      ? `REWRITE and IMPROVE the existing copy. Make it more compelling and polished.`
      : `Generate professional marketing copy for this project.`;

    const prompt = `You are a copywriter for Fastoosh, a premium motion design studio. ${modeInstruction} Return ONLY valid JSON — no markdown fences, no extra text.

Project Title: "${title}"
Category: "${category}"${clientHint}${instructionLine}${existingCtx ? '\n' + existingCtx : ''}

Rules:
- description: 1-2 sentences, max 250 characters HARD LIMIT, shown on project cards
- goal: what challenge the client faced and what they needed
- approach: the creative process, tools, and techniques Fastoosh used
- outcome: the impact, results, and client reaction — specific and compelling
- tags: 3-5 short industry tags like "Motion Design", "After Effects", "Brand Identity"
- deliverables: 3-5 concrete deliverables like "90-second hero video", "Social media cutdowns (9:16 + 1:1)"
- Be specific to "${title}" — avoid generic filler
${improveExisting ? '- REWRITE mode: elevate existing copy, do not repeat it verbatim\n' : ''}
Return exactly this JSON:
{
${schemaLines}}`;

    console.log(`Calling Gemini for project "${title}" [${improveExisting ? 'REWRITE' : 'FILL'}] fields: ${Object.keys(gen).join(', ')}`);

    const geminiRes = await fetch(
      geminiUrl(geminiModel, apiKey),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.75, maxOutputTokens: 4096 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return c.json({ success: false, error: `Gemini API error (${geminiRes.status}): ${errText}` }, 500);
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return c.json({ success: false, error: 'Gemini returned empty response' }, 500);

    let generated: Record<string, any>;
    try {
      const repaired = repairJson(rawText);
      generated = JSON.parse(repaired);
    } catch (parseErr) {
      console.log('Project content JSON repair failed. Raw (first 500):', rawText.substring(0, 500));
      return c.json({ success: false, error: `AI response was not valid JSON: ${String(parseErr)}` }, 500);
    }

    console.log(`✅ Gemini project generation complete for "${title}"`);
    return c.json({ success: true, data: generated });

  } catch (error) {
    console.log('Error in generate-project-content:', error);
    return c.json({ success: false, error: `Content generation failed: ${String(error)}` }, 500);
  }
});

// ========== AI FIELD-LEVEL IMPROVE ==========

app.post("/make-server-e07959ec/admin/improve-field", requireAuth, async (c) => {
  try {
    const { fieldKey, currentValue, context, instruction = '', isAlternative = false } = await c.req.json();

    const { apiKey, model: geminiModel } = await getGeminiConfig();
    if (!apiKey) return c.json({ success: false, error: 'GEMINI_API_KEY not configured' }, 500);
    if (!fieldKey) return c.json({ success: false, error: 'fieldKey is required' }, 400);

    const entityName = context?.name || context?.title || 'this item';
    const entityType = (context?.entityType as string) || 'tool';
    const versionCtx  = context?.versionType ? ` (${context.versionType} version)` : '';
    const categoryCtx = context?.category    ? ` in category "${context.category}"` : '';

    const instructionLine = instruction?.trim()
      ? `\nUser instruction: "${instruction.trim()}" — let this guide your tone, focus, and style.`
      : '';

    const alternativeDirective = isAlternative
      ? '\nIMPORTANT: Produce a COMPLETELY DIFFERENT version — different angle, different phrasing, different structure. Do NOT rephrase the current text verbatim.'
      : '\nImprove and refine the existing content �� make it more compelling, specific, and professional.';

    type FieldRule = { label: string; rule: string; format: string };
    const fieldRules: Record<string, FieldRule> = {
      description: {
        label: 'Description',
        rule: 'Professional, benefit-focused, concrete. Be clear and compelling. No buzzword fluff.',
        format: 'Return plain text only (no JSON, no quotes around the result).',
      },
      tagline: {
        label: 'Tagline',
        rule: 'Max 10 words. Punchy, active voice. E.g. "Automate the boring. Amplify the creative."',
        format: 'Return plain text only — one single line.',
      },
      systemRequirements: {
        label: 'System Requirements',
        rule: 'Concise technical requirements. Use middle dot (·) as separator for multiple items.',
        format: 'Return plain text only.',
      },
      howItWorks: {
        label: 'How It Works',
        rule: 'Exactly 4 steps. Each step has a short title (2-4 words) and a 1-sentence description.',
        format: 'Return plain text, one step per line, format: "Step N: Title | Description".',
      },
      faqs: {
        label: 'FAQs',
        rule: '4 realistic buyer questions with helpful, concise answers.',
        format: 'Return plain text in this exact format (blank line between each Q/A pair):\nQ: Question 1\nA: Answer 1\n\nQ: Question 2\nA: Answer 2',
      },
      whatsIncluded: {
        label: "What's Included",
        rule: '3-4 items that buyers receive. E.g. "After Effects .jsx script file", "PDF quick-start guide", "Free updates for 12 months".',
        format: 'Return plain text, one item per line.',
      },
      activationSteps: {
        label: 'Activation Steps',
        rule: '4 clear post-purchase steps. Specific and actionable. Written as imperative sentences.',
        format: 'Return plain text, one step per line. No numbering — the UI numbers them automatically.',
      },
      goal: {
        label: 'Project Goal',
        rule: '2-3 sentences describing the project objectives and what success looks like.',
        format: 'Return plain text only.',
      },
      approach: {
        label: 'Creative Approach',
        rule: '2-3 sentences explaining the creative process, techniques, and tools used.',
        format: 'Return plain text only.',
      },
      outcome: {
        label: 'Project Outcome',
        rule: '2-3 sentences describing results, measurable impact, and client satisfaction.',
        format: 'Return plain text only.',
      },
      tags: {
        label: 'Tags',
        rule: '4-6 relevant tags. Each tag is 1-3 words. Relevant to the project/tool category.',
        format: 'Return comma-separated values only. E.g. "Motion Design, Branding, 3D Animation"',
      },
      deliverables: {
        label: 'Deliverables',
        rule: '3-6 specific deliverable items. E.g. "90-second explainer video", "Social media cutdowns (9:16)", "Brand guidelines PDF".',
        format: 'Return plain text, one item per line.',
      },
      client: {
        label: 'Client',
        rule: 'A concise, professional client name or company description.',
        format: 'Return plain text only — just the name or short description.',
      },
      // ── Home page fields ──────────────────────────────────────────────────
      heroLine1: {
        label: 'Hero Heading Line 1',
        rule: 'Short, powerful phrase (3-6 words). Plain text. E.g. "Premium motion design", "Stunning visuals", "Motion that moves".',
        format: 'Return plain text only — one short phrase.',
      },
      heroLine2: {
        label: 'Hero Heading Line 2 (gradient)',
        rule: 'Completes the hero headline from Line 1. 3-6 words. Aspirational. E.g. "for ambitious teams", "that drives results".',
        format: 'Return plain text only — one short phrase.',
      },
      heroSubtitle: {
        label: 'Hero Subtitle',
        rule: '1-2 sentences, 100-200 characters. Describes what Fastoosh does and the value delivered. Clear, benefit-focused, no buzzwords.',
        format: 'Return plain text only.',
      },
      heroCta: {
        label: 'CTA Button Label',
        rule: 'Action-oriented, 2-4 words. E.g. "Work with us", "Start a project", "Get in touch".',
        format: 'Return plain text only — a short action phrase.',
      },
      testimonialQuote: {
        label: 'Testimonial Quote',
        rule: '2-3 sentences. Sounds genuine and specific, from a satisfied client. Mentions quality, speed, or business impact. No clichés.',
        format: 'Return plain text only — quote body without surrounding quotation marks.',
      },
      sectionHeading: {
        label: 'Section Heading',
        rule: '2-5 words. Clear, compelling section title that fits a premium motion design studio.',
        format: 'Return plain text only — a short heading phrase.',
      },
      sectionSubtitle: {
        label: 'Section Subtitle',
        rule: '1 sentence, 50-100 characters. Adds context below a section heading. Conversational and direct.',
        format: 'Return plain text only.',
      },
      capabilityTitle: {
        label: 'Capability Card Title',
        rule: '2-3 words describing a core studio competency. E.g. "Premium Craft", "Fast Turnaround", "Business Impact".',
        format: 'Return plain text only — a short title.',
      },
      capabilityDescription: {
        label: 'Capability Card Description',
        rule: '1-2 sentences, max 130 characters. Explains the capability in concrete, benefit-driven terms. No jargon.',
        format: 'Return plain text only.',
      },
      processStepTitle: {
        label: 'Process Step Title',
        rule: '1-2 words describing a production phase. E.g. "Discovery", "Concept", "Production", "Delivery".',
        format: 'Return plain text only — a very short title.',
      },
      processStepDescription: {
        label: 'Process Step Description',
        rule: '1 sentence, max 80 characters. Concise description of what happens in this phase.',
        format: 'Return plain text only.',
      },
      turnaroundNote: {
        label: 'Turnaround Timeline Note',
        rule: 'A short footer note about rush options or caveats. Max 50 chars. E.g. "Rush options available".',
        format: 'Return plain text only — one short note.',
      },
      deliverableItem: {
        label: 'Deliverable Item',
        rule: 'A single specific deliverable. Max 70 chars. E.g. "Final rendered videos (all formats)", "Editable source files (AEP)".',
        format: 'Return plain text only — one item on a single line.',
      },
      ctaHeading: {
        label: 'CTA Heading (first line)',
        rule: '3-5 words. Opening of a closing CTA — leaves room for a gradient word. E.g. "Ready to create something", "Let\'s build something".',
        format: 'Return plain text only — a short incomplete phrase.',
      },
      ctaGradient: {
        label: 'CTA Gradient Phrase',
        rule: '1-3 words. Completes the CTA heading in gradient. Impactful. E.g. "extraordinary?", "legendary.", "together?".',
        format: 'Return plain text only — one word or very short phrase.',
      },
      ctaSubtitle: {
        label: 'CTA Subtitle',
        rule: '1-2 sentences, 100-160 characters. Encourages action. Mention reply time (24-48h) or remote collaboration.',
        format: 'Return plain text only.',
      },
      // ── Team member fields ────────────────────────────────────────────────
      teamBio: {
        label: 'Team Member Bio',
        rule: '2-3 sentences. Professional and warm. Highlights expertise, background, and contribution to Fastoosh\'s motion design work. Avoid generic phrases.',
        format: 'Return plain text only — no bullet points, no headings, no line breaks.',
      },
      teamRole: {
        label: 'Team Member Role / Job Title',
        rule: 'A clear professional job title. E.g. "Motion Design Director", "Lead After Effects Artist", "Brand Strategist". 2-5 words.',
        format: 'Return plain text only — just the job title.',
      },
      // ── Version name translations ─────────────────────────────────────────
      versionType_ar: {
        label: 'Version Name (Arabic Translation)',
        rule: 'Translate the English version name to natural Arabic. Keep it short (1-3 words). E.g. "Free" → "مجاني", "Pro" → "محترف", "Starter" → "مبتدئ", "Agency" → "وكالة", "Studio" → "استوديو".',
        format: 'Return ONLY the Arabic translation — no English, no explanations, no quotes.',
      },
      versionType_fr: {
        label: 'Version Name (French Translation)',
        rule: 'Translate the English version name to natural French. Keep it short (1-3 words). E.g. "Free" → "Gratuit", "Pro" → "Pro", "Starter" → "Démarrage", "Agency" → "Agence", "Studio" → "Studio".',
        format: 'Return ONLY the French translation — no English, no explanations, no quotes.',
      },
    };

    const field = fieldRules[fieldKey];
    if (!field) {
      return c.json({ success: false, error: `Unknown fieldKey: "${fieldKey}"` }, 400);
    }

    let entityLine: string;
    if (entityType === 'home') {
      entityLine = `Page: Fastoosh home page (premium motion design studio website)`;
    } else if (entityType === 'team') {
      const memberRole = context?.role ? ` — ${context.role}` : '';
      entityLine = `Team member: "${entityName}"${memberRole} at Fastoosh (premium motion design studio)`;
    } else if (entityType === 'project') {
      entityLine = `Project: "${entityName}"${categoryCtx}`;
    } else {
      entityLine = `Tool: "${entityName}"${categoryCtx}${versionCtx}`;
    }

    // Special handling for version name translations
    let contextNote = '';
    if ((fieldKey === 'versionType_ar' || fieldKey === 'versionType_fr') && context?.versionType) {
      const descLine = context?.description ? `\nTool description: "${context.description}"` : '';
      const pricingLine = context?.pricingModel ? `\nPricing model: ${context.pricingModel}` : '';
      contextNote = `\n\nEnglish version name to translate: "${context.versionType}"${descLine}${pricingLine}`;
    }

    const prompt = `You are a professional copywriter for Fastoosh, a premium motion design studio.
${entityLine}
Field to improve: ${field.label}${instructionLine}${alternativeDirective}${contextNote}

Current content:
"""
${currentValue?.trim() || '(empty — generate from scratch based on context)'}
"""

Rules for this field:
${field.rule}

Output format:
${field.format}

Return ONLY the improved text — no labels, no explanations, no markdown fences, no surrounding quotes.`;

    console.log(`[improve-field] fieldKey=${fieldKey} entity="${entityName}" alt=${isAlternative}${instruction ? ` inst="${instruction.substring(0, 60)}"` : ''}`);

    const geminiRes = await fetch(
      geminiUrl(geminiModel, apiKey),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: isAlternative ? 0.95 : 0.72,
            maxOutputTokens: 2048,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return c.json({ success: false, error: `Gemini API error (${geminiRes.status}): ${errText}` }, 500);
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!rawText) {
      return c.json({ success: false, error: 'Gemini returned an empty response' }, 500);
    }

    // Strip any accidental markdown code fences
    const cleaned = rawText
      .replace(/^```[\w]*\n?/m, '')
      .replace(/```$/m, '')
      .trim();

    console.log(`[improve-field] ✅ "${entityName}" / ${fieldKey} — ${cleaned.length} chars`);
    return c.json({ success: true, data: { result: cleaned } });

  } catch (error) {
    console.log('Error in improve-field:', error);
    return c.json({ success: false, error: `Field improvement failed: ${String(error)}` }, 500);
  }
});

// ========== AI TEAM MEMBER CONTENT GENERATION ==========

app.post("/make-server-e07959ec/admin/generate-team-content", requireAuth, async (c) => {
  try {
    const { member, instruction = '', improveExisting = false } = await c.req.json();

    const { apiKey, model: geminiModel } = await getGeminiConfig();
    if (!apiKey) return c.json({ success: false, error: 'GEMINI_API_KEY not configured' }, 500);

    const name = (member.name || '').trim();
    const role = (member.role || '').trim();
    if (!name || !role) return c.json({ success: false, error: 'Name and role are required to generate a bio' }, 400);

    const bioEmpty = !member.bio?.trim();
    if (!improveExisting && !bioEmpty) {
      return c.json({ success: true, data: {}, nothingToGenerate: true });
    }

    const instructionLine = instruction?.trim() ? `\nUser instruction: "${instruction.trim()}"` : '';
    const existingCtx = improveExisting && member.bio?.trim() ? `Current bio: "${member.bio.trim()}"` : '';
    const modeInstruction = improveExisting
      ? `REWRITE and IMPROVE the existing bio.`
      : `Write a professional bio for this team member.`;

    const prompt = `You are writing team bios for Fastoosh, a premium motion design studio. ${modeInstruction} Return ONLY valid JSON — no markdown fences.

Name: "${name}"
Role: "${role}"${instructionLine}${existingCtx ? '\n' + existingCtx : ''}

Rules:
- bio: 2-3 sentences in third-person. Mention their expertise, what they bring to Fastoosh, and one specific creative strength. Professional yet human tone. Max 400 characters.
- Be specific to "${name}" and their role as "${role}"
${improveExisting ? '- REWRITE mode: improve and elevate existing copy\n' : ''}
Return exactly this JSON:
{
  "bio": "<2-3 sentence professional bio>"
}`;

    const geminiRes = await fetch(
      geminiUrl(geminiModel, apiKey),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.8, maxOutputTokens: 2048 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return c.json({ success: false, error: `Gemini API error (${geminiRes.status}): ${errText}` }, 500);
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return c.json({ success: false, error: 'Gemini returned empty response' }, 500);

    let generated: Record<string, any>;
    try {
      const repaired = repairJson(rawText);
      generated = JSON.parse(repaired);
    } catch (parseErr) {
      console.log('Team bio JSON repair failed. Raw (first 300):', rawText.substring(0, 300));
      return c.json({ success: false, error: `AI response was not valid JSON: ${String(parseErr)}` }, 500);
    }

    console.log(`✅ Gemini team bio generated for "${name}"`);
    return c.json({ success: true, data: generated });

  } catch (error) {
    console.log('Error in generate-team-content:', error);
    return c.json({ success: false, error: `Content generation failed: ${String(error)}` }, 500);
  }
});

// ========== AI STYLE GENERATION ==========

app.post("/make-server-e07959ec/admin/generate-style", requireAuth, async (c) => {
  try {
    const { prompt, mode = 'dark' } = await c.req.json();

    const { apiKey, model: geminiModel } = await getGeminiConfig();
    if (!apiKey) return c.json({ success: false, error: 'GEMINI_API_KEY not configured' }, 500);
    if (!prompt?.trim()) return c.json({ success: false, error: 'Style prompt is required' }, 400);

    const isLight = mode === 'light';

    const headingFonts = ['Inter', 'Space Grotesk', 'Syne', 'Outfit', 'Orbitron', 'Exo 2', 'Rajdhani', 'Bebas Neue', 'Montserrat', 'DM Sans'];
    const bodyFonts    = ['Inter', 'DM Sans', 'Outfit', 'Plus Jakarta Sans', 'Nunito', 'Manrope', 'Rubik', 'Space Grotesk', 'IBM Plex Sans', 'Karla'];

    const systemPrompt = `You are a world-class UI/UX designer and color theorist specializing in premium ${isLight ? 'light' : 'dark'}-mode web applications with glassmorphism and neon gradient aesthetics.

Your task: Generate a complete, harmonious design system for "Fastoosh" — a premium motion design studio.
Style vibe requested: "${prompt.trim()}"

CRITICAL: ALL hex color values MUST be EXACTLY 6 hexadecimal digits after the # symbol.
Examples of VALID hex colors: #7c3aed, #ec4899, #000000, #ffffff, #0f0519
Examples of INVALID hex colors: #0, #, #fff, #7c3ae, rgb(0,0,0)

STRICT COLOR THEORY RULES:
1. Pick a PRIMARY HUE (0–360 in HSL) that best matches the mood
2. accentPrimary: primary hue, HSL saturation 75–95%, lightness ${isLight ? '45–60%' : '60–80%'}
3. accentSecondary: rotate 30–50° FORWARD from primary hue (analogous harmony), same saturation band
4. accentGlow: rotate 160–185° from primary (near-complement = visual pop / contrast)
5. All three accent hex colors must differ visually and be EXACTLY 6 hex digits
6. Background and overlay colors must be ${isLight ? 'very light (near white with subtle hue traces)' : 'very dark (near black with subtle hue traces)'}
${isLight ? `
LIGHT MODE SPECIFICS:
- bgBase: #f5f4fe or similar very soft cool white (L >= 94%), MUST be 6 hex digits
- bgGrad1: mix of white + primary hue at very low saturation (L 88-96%), MUST be 6 hex digits
- bgGrad2: even lighter / near white (L 95-99%), MUST be 6 hex digits
- textPrimary: deep near-black with a hue tint e.g. #0d0620, #120624, MUST be 6 hex digits
- overlayColor1: the primary accent hex (shows in gradient over light bg), MUST be 6 hex digits
- overlayColor2: a blue-violet e.g. #6366f1 or #7c3aed adjusted to mood, MUST be 6 hex digits
- headerBg: "rgba(255,255,255,0.65)" to "rgba(255,255,255,0.85)"
- footerBg: "rgba(245,244,254,0.70)" to "rgba(255,255,255,0.75)"
- cardBg: "rgba(255,255,255,0.55)" to "rgba(255,255,255,0.72)"
- cardDarkFill: "rgba(255,255,255,0.92)" to "rgba(255,255,255,0.97)"
- signinBg: use accent primary rgb values at 0.07 opacity
- navText: use textPrimary rgb values at 0.60 opacity` : `
DARK MODE SPECIFICS:
- bgBase: #000000 or near-black like #02010a (L <= 3%), MUST be 6 hex digits
- bgGrad1: very dark with primary hue trace e.g. #0f0519 (L 4-8%), MUST be 6 hex digits
- bgGrad2: very dark with secondary hue trace e.g. #05050f (L 3-5%), MUST be 6 hex digits
- textPrimary: #ffffff or #f8f8ff, MUST be 6 hex digits
- overlayColor1: saturated version of accentPrimary (keep the hue, S >= 60%, L 60-75%), MUST be 6 hex digits
- overlayColor2: a contrasting saturated blue-indigo in the #3b82f6 range (adjustable to mood), MUST be 6 hex digits
- headerBg: "rgba(0,0,0,0.08)" to "rgba(r,g,b,0.06)" using accent primary rgb
- footerBg: "rgba(0,0,0,0.28)" to "rgba(0,0,0,0.42)"
- cardBg: "rgba(255,255,255,0.018)" to "rgba(255,255,255,0.038)"
- cardDarkFill: "rgba(0,0,0,0.90)" to "rgba(0,0,0,0.97)"
- signinBg: "rgba(255,255,255,0.05)" to "rgba(255,255,255,0.08)"
- navText: "rgba(255,255,255,0.62)" to "rgba(255,255,255,0.78)"`}

TYPOGRAPHY PAIRING RULES:
- Available headingFont: ${headingFonts.join(', ')}
- Available bodyFont: ${bodyFonts.join(', ')}
- Pair expressive heading with clean body — they should complement, not compete
- Cyberpunk/tech vibes: Orbitron or Exo 2 heading + IBM Plex Sans or Manrope body
- Elegant/luxury vibes: Syne or Montserrat heading + Manrope or Karla body
- Minimal/clean vibes: Space Grotesk or DM Sans heading + Inter or Plus Jakarta Sans body
- Bold/studio vibes: Bebas Neue or Rajdhani heading + Rubik or Nunito body
- Do NOT use same font for both

CRITICAL OUTPUT RULES:
1. Return ONLY valid JSON - no markdown code blocks, no explanation text before or after
2. ALL hex color values MUST be exactly 6 hexadecimal characters after # (e.g., #7c3aed)
3. Double-check every hex color before responding
4. Do not use shorthand hex colors (e.g., #fff is INVALID, use #ffffff)

OUTPUT JSON SCHEMA:
{
  "accentPrimary":   "#XXXXXX",
  "accentSecondary": "#XXXXXX",
  "accentGlow":      "#XXXXXX",
  "bgBase":          "#XXXXXX",
  "bgGrad1":         "#XXXXXX",
  "bgGrad2":         "#XXXXXX",
  "overlayColor1":   "#XXXXXX",
  "overlayColor2":   "#XXXXXX",
  "textPrimary":     "#XXXXXX",
  "headingFont":     "FontName",
  "bodyFont":        "FontName",
  "headerBg":        "rgba(r,g,b,a)",
  "footerBg":        "rgba(r,g,b,a)",
  "cardBg":          "rgba(r,g,b,a)",
  "cardDarkFill":    "rgba(r,g,b,a)",
  "signinBg":        "rgba(r,g,b,a)",
  "navText":         "rgba(r,g,b,a)",
  "gradSpeed":       "medium",
  "themeName":       "Short evocative theme name (2-4 words)",
  "themeDescription":"One sentence capturing the visual mood."
}

Where XXXXXX represents exactly 6 hexadecimal digits (0-9, a-f). Example: #7c3aed, #000000, #ffffff`;

    console.log(`[generate-style] prompt="${prompt.trim().substring(0, 60)}" mode=${mode}`);

    const geminiRes = await fetch(
      geminiUrl(geminiModel, apiKey),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: systemPrompt }] }],
          generationConfig: { 
            temperature: 0.8,
            maxOutputTokens: 1500,
            responseSchema: {
              type: "object",
              properties: {
                accentPrimary: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
                accentSecondary: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
                accentGlow: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
                bgBase: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
                bgGrad1: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
                bgGrad2: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
                overlayColor1: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
                overlayColor2: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
                textPrimary: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
                headingFont: { type: "string" },
                bodyFont: { type: "string" },
                headerBg: { type: "string" },
                footerBg: { type: "string" },
                cardBg: { type: "string" },
                cardDarkFill: { type: "string" },
                signinBg: { type: "string" },
                navText: { type: "string" },
                gradSpeed: { type: "string" },
                themeName: { type: "string" },
                themeDescription: { type: "string" }
              },
              required: [
                "accentPrimary", "accentSecondary", "accentGlow", 
                "bgBase", "bgGrad1", "bgGrad2",
                "overlayColor1", "overlayColor2", "textPrimary",
                "headingFont", "bodyFont", "themeName", "themeDescription"
              ]
            },
            responseMimeType: "application/json"
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.log('[generate-style] Gemini error:', errText);
      return c.json({ success: false, error: `Gemini API error (${geminiRes.status}): ${errText}` }, 500);
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return c.json({ success: false, error: 'Gemini returned empty response' }, 500);

    let generated: Record<string, any>;
    try {
      const repaired = repairJson(rawText);
      generated = JSON.parse(repaired);
    } catch (parseErr) {
      console.log('[generate-style] JSON parse error. Raw:', rawText.substring(0, 400));
      return c.json({ success: false, error: `AI returned invalid JSON: ${String(parseErr)}` }, 500);
    }

    // Helper function to normalize hex colors
    const normalizeHex = (hex: string, fallback: string): string => {
      if (!hex || typeof hex !== 'string') return fallback;
      let cleaned = hex.trim();
      
      // Remove any # and whitespace
      cleaned = cleaned.replace(/^#/, '').replace(/\s/g, '');
      
      // If empty or invalid, use fallback
      if (cleaned.length === 0 || !/^[0-9a-fA-F]+$/.test(cleaned)) {
        console.log(`[generate-style] Invalid hex "${hex}", using fallback ${fallback}`);
        return fallback;
      }
      
      // If too short, pad with zeros or expand shorthand
      if (cleaned.length === 1) {
        cleaned = cleaned + cleaned + '0000';
      } else if (cleaned.length === 2) {
        cleaned = cleaned + '0000';
      } else if (cleaned.length === 3) {
        // Expand shorthand: #abc -> #aabbcc
        cleaned = cleaned[0] + cleaned[0] + cleaned[1] + cleaned[1] + cleaned[2] + cleaned[2];
      } else if (cleaned.length === 4) {
        cleaned = cleaned + '00';
      } else if (cleaned.length === 5) {
        cleaned = cleaned + '0';
      } else if (cleaned.length > 6) {
        // Truncate if too long
        cleaned = cleaned.substring(0, 6);
      }
      
      // Final validation
      if (!/^[0-9a-fA-F]{6}$/.test(cleaned)) {
        console.log(`[generate-style] Could not normalize "${hex}", using fallback ${fallback}`);
        return fallback;
      }
      
      return '#' + cleaned.toLowerCase();
    };

    // Default fallback colors based on mode
    const fallbacks = isLight ? {
      accentPrimary: '#7c3aed',
      accentSecondary: '#a855f7',
      accentGlow: '#ec4899',
      bgBase: '#f5f4fe',
      bgGrad1: '#ede9fe',
      bgGrad2: '#faf9ff',
      overlayColor1: '#7c3aed',
      overlayColor2: '#6366f1',
      textPrimary: '#0d0620',
    } : {
      accentPrimary: '#7c3aed',
      accentSecondary: '#a855f7',
      accentGlow: '#ec4899',
      bgBase: '#000000',
      bgGrad1: '#0f0519',
      bgGrad2: '#05050f',
      overlayColor1: '#8b5cf6',
      overlayColor2: '#3b82f6',
      textPrimary: '#ffffff',
    };

    // Normalize and validate all hex color fields
    const hexFields = ['accentPrimary','accentSecondary','accentGlow','bgBase','bgGrad1','bgGrad2','overlayColor1','overlayColor2','textPrimary'];
    for (const field of hexFields) {
      generated[field] = normalizeHex(generated[field], fallbacks[field as keyof typeof fallbacks]);
    }

    // Validate all required fields are present
    if (!generated.themeName) generated.themeName = 'Generated Theme';
    if (!generated.themeDescription) generated.themeDescription = 'A harmonious design system.';
    if (!generated.headingFont) generated.headingFont = 'Inter';
    if (!generated.bodyFont) generated.bodyFont = 'Inter';
    if (!generated.gradSpeed) generated.gradSpeed = 'medium';

    console.log(`[generate-style] Done. Theme: "${generated.themeName}"`);
    return c.json({ success: true, data: generated });

  } catch (error) {
    console.log('[generate-style] Error:', error);
    return c.json({ success: false, error: `Style generation failed: ${String(error)}` }, 500);
  }
});

// ========== FILE UPLOAD ENDPOINTS ==========

// Upload favicon to Supabase Storage (protected)
app.post('/make-server-e07959ec/upload-favicon', requireAuth, async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return c.json({ success: false, error: 'No file provided' }, 400);
    }

    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/x-icon', 'image/vnd.microsoft.icon', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ success: false, error: 'Invalid file type. Allowed: PNG, JPEG, WEBP, ICO, SVG' }, 400);
    }

    const maxSize = 1 * 1024 * 1024;
    if (file.size > maxSize) {
      return c.json({ success: false, error: 'File size exceeds 1MB limit' }, 400);
    }

    const fileExt = file.name.split('.').pop() || 'png';
    const fileName = `favicon.${fileExt}`;

    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, uint8Array, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: true,
      });

    if (error) {
      console.error('Favicon storage upload error:', error);
      return c.json({ success: false, error: `Upload failed: ${error.message}` }, 500);
    }

    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);

    const bustedUrl = `${urlData.publicUrl}?t=${Date.now()}`;

    return c.json({ success: true, data: { url: bustedUrl, path: fileName } });
  } catch (error) {
    console.error('Error in favicon upload:', error);
    return c.json({ success: false, error: `Upload error: ${String(error)}` }, 500);
  }
});

// Upload image to Supabase Storage (protected)
app.post('/make-server-e07959ec/upload-image', requireAuth, async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return c.json({ success: false, error: 'No file provided' }, 400);
    }
    
    // Validate file type
    const allowedTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ 
        success: false, 
        error: 'Invalid file type. Allowed types: PNG, JPEG, GIF, WEBP' 
      }, 400);
    }
    
    // Validate file size (10MB max)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return c.json({ 
        success: false, 
        error: 'File size exceeds 10MB limit' 
      }, 400);
    }
    
    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = crypto.randomUUID().split('-')[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${timestamp}-${randomStr}.${fileExt}`;
    
    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(BUCKET_NAME)
      .upload(fileName, uint8Array, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });
    
    if (error) {
      console.error('Storage upload error:', error);
      return c.json({ 
        success: false, 
        error: `Upload failed: ${error.message}` 
      }, 500);
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from(BUCKET_NAME)
      .getPublicUrl(fileName);
    
    return c.json({ 
      success: true, 
      data: {
        url: urlData.publicUrl,
        path: fileName,
      }
    });
  } catch (error) {
    console.error('Error in image upload:', error);
    return c.json({ 
      success: false, 
      error: `Upload error: ${String(error)}` 
    }, 500);
  }
});

// Upload video to Supabase Storage (protected)
app.post('/make-server-e07959ec/upload-video', requireAuth, async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File;
    
    if (!file) {
      return c.json({ success: false, error: 'No file provided' }, 400);
    }
    
    // Validate file type
    const allowedTypes = ['video/mp4', 'video/quicktime', 'video/x-msvideo', 'video/webm'];
    if (!allowedTypes.includes(file.type)) {
      return c.json({ 
        success: false, 
        error: 'Invalid file type. Allowed types: MP4, MOV, AVI, WebM' 
      }, 400);
    }
    
    // Validate file size (100MB max)
    const maxSize = 100 * 1024 * 1024;
    if (file.size > maxSize) {
      return c.json({ 
        success: false, 
        error: 'File size exceeds 100MB limit' 
      }, 400);
    }
    
    // Generate unique filename
    const timestamp = Date.now();
    const randomStr = crypto.randomUUID().split('-')[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${timestamp}-${randomStr}.${fileExt}`;
    
    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from(VIDEO_BUCKET_NAME)
      .upload(fileName, uint8Array, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });
    
    if (error) {
      console.error('Storage upload error:', error);
      return c.json({ 
        success: false, 
        error: `Upload failed: ${error.message}` 
      }, 500);
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from(VIDEO_BUCKET_NAME)
      .getPublicUrl(fileName);
    
    return c.json({ 
      success: true, 
      data: {
        url: urlData.publicUrl,
        path: fileName,
      }
    });
  } catch (error) {
    console.error('Error in video upload:', error);
    return c.json({ 
      success: false, 
      error: `Upload error: ${String(error)}` 
    }, 500);
  }
});

// ========== PROJECTS ENDPOINTS ==========

/** Converts a project title into a URL-safe slug. */
const generateSlug = (title: string): string =>
  title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/--+/g, '-')
    .replace(/^-+|-+$/g, '');

// Get all projects
// ── Vimeo thumbnails via API (admin only) ─────────────────────────────────────
app.get("/make-server-e07959ec/admin/vimeo-thumbnails/:videoId", requireAuth, async (c) => {
  try {
    const videoId = c.req.param("videoId");
    const accessToken = Deno.env.get("VIMEO_ACCESS_TOKEN");
    if (!accessToken) {
      return c.json({ success: false, error: "VIMEO_ACCESS_TOKEN not configured" }, 500);
    }

    // Fetch the video's picture sets from Vimeo API v3
    const res = await fetch(`https://api.vimeo.com/videos/${videoId}/pictures`, {
      headers: {
        Authorization: `bearer ${accessToken}`,
        Accept: "application/vnd.vimeo.*+json;version=3.4",
      },
    });

    if (!res.ok) {
      console.log(`[vimeo-thumbnails] API error ${res.status}`);
      return c.json({ success: false, error: `Vimeo API error: ${res.status}` }, 502);
    }

    const data = await res.json();
    const pictureSets: any[] = data.data || [];

    const thumbnails: string[] = [];
    for (const set of pictureSets) {
      const sizes: any[] = set.sizes || [];
      if (!sizes.length) continue;
      sizes.sort((a: any, b: any) => (b.width ?? 0) - (a.width ?? 0));
      if (sizes[0]?.link) thumbnails.push(sizes[0].link);
    }

    // Fallback: fetch from the video endpoint's embedded pictures field
    if (thumbnails.length === 0) {
      const vRes = await fetch(`https://api.vimeo.com/videos/${videoId}?fields=pictures`, {
        headers: { Authorization: `bearer ${accessToken}`, Accept: "application/vnd.vimeo.*+json;version=3.4" },
      });
      if (vRes.ok) {
        const vData = await vRes.json();
        const sizes: any[] = vData.pictures?.sizes || [];
        sizes.sort((a: any, b: any) => (b.width ?? 0) - (a.width ?? 0));
        for (const s of sizes.slice(0, 5)) { if (s.link) thumbnails.push(s.link); }
      }
    }

    return c.json({ success: true, thumbnails });
  } catch (err) {
    console.error("[vimeo-thumbnails] Error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// ── Vimeo frame extraction at a specific timestamp ────────────────────────────
app.post("/make-server-e07959ec/admin/vimeo-frame-capture", requireAuth, async (c) => {
  try {
    const { videoId, time } = await c.req.json();
    const accessToken = Deno.env.get("VIMEO_ACCESS_TOKEN");
    if (!accessToken) return c.json({ success: false, error: "VIMEO_ACCESS_TOKEN not configured" }, 500);
    if (!videoId || typeof time !== "number") return c.json({ success: false, error: "Missing videoId or time" }, 400);

    console.log(`[vimeo-frame-capture] Requesting frame at ${time}s for video ${videoId}`);

    const authHeaders = {
      Authorization: `bearer ${accessToken}`,
      Accept: "application/vnd.vimeo.*+json;version=3.4",
    };

    const pickBest = (sizes: any[]): { url: string; width: number; height: number } | null => {
      if (!sizes?.length) return null;
      const sorted = [...sizes].sort((a: any, b: any) => (b.width ?? 0) - (a.width ?? 0));
      const best = sorted[0];
      return best?.link ? { url: best.link, width: best.width ?? 0, height: best.height ?? 0 } : null;
    };

    // Load all Vimeo-auto-generated picture sets (read scope only) as fallback options
    const loadFallbackThumbnails = async (): Promise<string[]> => {
      try {
        const r = await fetch(`https://api.vimeo.com/videos/${videoId}/pictures?per_page=100`, { headers: authHeaders });
        if (!r.ok) return [];
        const d = await r.json();
        const urls: string[] = [];
        for (const set of (d.data ?? [])) {
          const best = pickBest(set.sizes ?? []);
          if (best) urls.push(best.url);
        }
        return urls;
      } catch { return []; }
    };

    // Ask Vimeo to create a picture at the given timecode — requires "upload" scope
    const createRes = await fetch(`https://api.vimeo.com/videos/${videoId}/pictures`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ time, active: false }),
    });

    // 403 means the token lacks the "upload" scope
    if (createRes.status === 403) {
      console.log(`[vimeo-frame-capture] 403 — token lacks upload scope, returning fallback thumbnails`);
      const fallbackThumbnails = await loadFallbackThumbnails();
      return c.json({
        success: false,
        needsUploadScope: true,
        fallbackThumbnails,
        error: "Your Vimeo access token does not have the \"upload\" scope required to extract a custom frame.",
      });
    }

    if (!createRes.ok) {
      const errText = await createRes.text();
      console.log(`[vimeo-frame-capture] Create failed ${createRes.status}: ${errText}`);
      const fallbackThumbnails = await loadFallbackThumbnails();
      return c.json({ success: false, fallbackThumbnails, error: `Vimeo API error ${createRes.status}` });
    }

    const picture = await createRes.json();
    const pictureUri: string = picture.uri;
    let result = pickBest(picture.sizes ?? []);

    // Poll up to 8×1.2s if Vimeo still needs to process the frame
    if (!result && pictureUri) {
      for (let attempt = 0; attempt < 8; attempt++) {
        await new Promise(r => setTimeout(r, 1200));
        const pollRes = await fetch(`https://api.vimeo.com${pictureUri}`, { headers: authHeaders });
        if (!pollRes.ok) break;
        result = pickBest((await pollRes.json()).sizes ?? []);
        if (result) { console.log(`[vimeo-frame-capture] Ready after ${attempt + 1} poll(s)`); break; }
      }
    }

    if (!result) {
      const fallbackThumbnails = await loadFallbackThumbnails();
      return c.json({ success: false, fallbackThumbnails, error: "Vimeo is still processing. Try again in a few seconds." }, 202);
    }

    return c.json({ success: true, url: result.url, width: result.width, height: result.height });
  } catch (err) {
    console.error("[vimeo-frame-capture] Error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// ── Vimeo direct-video proxy ─────────────────────────────────────────────────
// Adds CORS headers to the direct MP4 stream so the browser can canvas-capture
// any frame. Uses play.progressive which is accessible on FREE Vimeo accounts
// (read scope only, no Pro/upload scope needed).
const _vimeoFileCache = new Map<string, { url: string; exp: number }>();

async function _getVimeoFileUrl(videoId: string, accessToken: string): Promise<string | null> {
  const hit = _vimeoFileCache.get(videoId);
  if (hit && hit.exp > Date.now()) return hit.url;

  // ── Strategy 1: REST API (/videos/{id}?fields=files,download,play) ────
  // Needs "video_files" scope on the token.  If not present, play.progressive
  // comes back empty even for videos you own — log the raw body to confirm.
  try {
    const apiRes = await fetch(
      `https://api.vimeo.com/videos/${videoId}?fields=files,download,play`,
      { headers: { Authorization: `bearer ${accessToken}`, Accept: "application/vnd.vimeo.*+json;version=3.4" } }
    );
    const s1Body = await apiRes.text();
    console.log(`[vimeo-proxy] s1 status=${apiRes.status} body[0:400]=${s1Body.slice(0, 400)}`);
    if (apiRes.ok) {
      const data = JSON.parse(s1Body);
      const play = data.play ?? {};
      console.log(`[vimeo-proxy] s1 play.progressive=${play.progressive?.length ?? 0} files=${data.files?.length ?? 0} download=${data.download?.length ?? 0}`);
      const candidates: any[] = [
        ...(play.progressive ?? []),
        ...(data.files ?? []),
        ...(data.download ?? []),
      ];
      const withLink = candidates.filter(f => f.link || f.url);
      if (withLink.length) {
        const sorted = withLink.sort((a, b) => (b.width ?? b.size ?? 0) - (a.width ?? a.size ?? 0));
        const url: string = sorted[0].link ?? sorted[0].url;
        console.log(`[vimeo-proxy] s1 ✓ quality=${sorted[0].quality ?? "?"} ${sorted[0].width}×${sorted[0].height}`);
        _vimeoFileCache.set(videoId, { url, exp: Date.now() + 8 * 60 * 1000 });
        return url;
      }
    }
  } catch (e) {
    console.log(`[vimeo-proxy] s1 threw: ${e}`);
  }

  // ── Strategy 2: player config endpoint (no video_files scope needed) ─
  // player.vimeo.com/video/{id}/config is what the Vimeo embed player calls
  // to get its own stream URLs.  Auth goes via ?access_token= query param —
  // the player domain does NOT accept the Bearer header.
  const configUrls = [
    `https://player.vimeo.com/video/${videoId}/config?access_token=${accessToken}`,
    `https://player.vimeo.com/video/${videoId}/config`, // unauthenticated for public/unlisted
  ];
  for (const cfgUrl of configUrls) {
    try {
      const cfgRes = await fetch(cfgUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
          "Referer": `https://vimeo.com/${videoId}`,
          "Accept": "application/json, text/javascript, */*",
        },
      });
      const s2Body = await cfgRes.text();
      const label = cfgUrl.includes("access_token") ? "s2-auth" : "s2-public";
      console.log(`[vimeo-proxy] ${label} status=${cfgRes.status} ct=${cfgRes.headers.get("content-type")} body[0:400]=${s2Body.slice(0, 400)}`);
      if (!cfgRes.ok || !s2Body.trim().startsWith("{")) continue;
      const cfg = JSON.parse(s2Body);
      const progressive: any[] = cfg?.request?.files?.progressive ?? [];
      const fileKeys = Object.keys(cfg?.request?.files ?? {});
      console.log(`[vimeo-proxy] ${label} progressive=${progressive.length} file-keys=${fileKeys.join(",")}`);
      if (progressive.length) {
        const sorted = [...progressive].sort((a, b) => (b.height ?? 0) - (a.height ?? 0));
        const best = sorted[0];
        console.log(`[vimeo-proxy] ${label} ✓ ${best.quality} ${best.width}×${best.height}`);
        _vimeoFileCache.set(videoId, { url: best.url, exp: Date.now() + 8 * 60 * 1000 });
        return best.url;
      }
    } catch (e) {
      console.log(`[vimeo-proxy] s2 threw (${cfgUrl.slice(-30)}): ${e}`);
    }
  }

  // ── Strategy 3: /videos/{id}/files dedicated endpoint ────────────────
  // Different from ?fields=files — dedicated endpoint sometimes returns
  // data the combined-fields call misses.
  try {
    const fRes = await fetch(
      `https://api.vimeo.com/videos/${videoId}/files`,
      { headers: { Authorization: `bearer ${accessToken}`, Accept: "application/vnd.vimeo.*+json;version=3.4" } }
    );
    const s3Body = await fRes.text();
    console.log(`[vimeo-proxy] s3 /files status=${fRes.status} body[0:400]=${s3Body.slice(0, 400)}`);
    if (fRes.ok) {
      const files: any[] = JSON.parse(s3Body)?.data ?? [];
      const withLink = files.filter(f => (f.link || f.url) && f.type !== "hls");
      if (withLink.length) {
        const sorted = withLink.sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
        const url: string = sorted[0].link ?? sorted[0].url;
        console.log(`[vimeo-proxy] s3 ✓ quality=${sorted[0].quality ?? "?"} ${sorted[0].width}×${sorted[0].height}`);
        _vimeoFileCache.set(videoId, { url, exp: Date.now() + 8 * 60 * 1000 });
        return url;
      }
    }
  } catch (e) {
    console.log(`[vimeo-proxy] s3 threw: ${e}`);
  }

  console.log(`[vimeo-proxy] all 3 strategies exhausted for videoId=${videoId}`);
  return null;
}

app.options("/make-server-e07959ec/admin/vimeo-proxy/:videoId", async (_c) => {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Headers": "range, content-type, authorization, x-admin-token",
      "Access-Control-Max-Age": "86400",
    },
  });
});

// Proxy: no auth check — the <video> element can't send custom headers, the endpoint path
// is not public, and VIMEO_ACCESS_TOKEN already guards what videos can be resolved.
// The GET request itself acts as the availability check (video.onerror fires if unavailable).
app.get("/make-server-e07959ec/admin/vimeo-proxy/:videoId", async (c) => {
  const videoId = c.req.param("videoId");
  const accessToken = Deno.env.get("VIMEO_ACCESS_TOKEN");
  if (!accessToken) {
    return new Response("VIMEO_ACCESS_TOKEN not configured", { status: 500, headers: { "Access-Control-Allow-Origin": "*" } });
  }
  const fileUrl = await _getVimeoFileUrl(videoId, accessToken);
  if (!fileUrl) {
    return new Response(
      "No playable file found. The token may lack 'private' scope for private videos, or no progressive download exists.",
      { status: 404, headers: { "Access-Control-Allow-Origin": "*" } }
    );
  }
  const rangeHeader = c.req.header("range");
  const upstream = await fetch(fileUrl, rangeHeader ? { headers: { range: rangeHeader } } : undefined);
  console.log(`[vimeo-proxy] upstream ${upstream.status} videoId=${videoId}`);

  const out = new Headers({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "range, content-type",
    "Access-Control-Expose-Headers": "content-range, content-length, accept-ranges",
    "Accept-Ranges": "bytes",
  });
  for (const h of ["content-type", "content-length", "content-range"]) {
    const v = upstream.headers.get(h);
    if (v) out.set(h, v);
  }
  if (!out.get("content-type")) out.set("content-type", "video/mp4");
  return new Response(upstream.body, { status: upstream.status, headers: out });
});

// ── Vimeo sprite-based frame extraction (read scope only, no upload needed) ───
app.post("/make-server-e07959ec/admin/vimeo-sprite-frame", requireAuth, async (c) => {
  try {
    const { videoId, time } = await c.req.json();
    if (!videoId || typeof time !== "number") {
      return c.json({ success: false, error: "Missing videoId or time" }, 400);
    }

    const accessToken = Deno.env.get("VIMEO_ACCESS_TOKEN");
    console.log(`[vimeo-frame] videoId=${videoId} time=${time} hasToken=${!!accessToken}`);

    const apiHeaders = accessToken ? {
      Authorization: `bearer ${accessToken}`,
      Accept: "application/vnd.vimeo.*+json;version=3.4",
    } : {};

    // Helper: pick highest-resolution size from a Vimeo sizes array
    function bestSize(sizes: any[]): { url: string; w: number; h: number } | null {
      if (!sizes?.length) return null;
      const sorted = [...sizes].sort((a: any, b: any) => (b.width ?? 0) - (a.width ?? 0));
      const s = sorted[0];
      return s?.link ? { url: s.link, w: s.width ?? 0, h: s.height ?? 0 } : null;
    }

    // ── Strategy A: Pictures API — timestamp-matched (read scope, always works) ──
    if (accessToken) {
      try {
        const picRes = await fetch(
          `https://api.vimeo.com/videos/${videoId}/pictures?per_page=100`,
          { headers: apiHeaders }
        );
        console.log(`[vimeo-frame] pictures API: ${picRes.status}`);
        if (picRes.ok) {
          const picData = await picRes.json();
          const pics: any[] = picData.data ?? [];
          console.log(`[vimeo-frame] pictures: ${pics.length}, with-time: ${pics.filter((p: any) => typeof p.time === "number").length}`);
          const withTime = pics.filter((p: any) => typeof p.time === "number");

          if (withTime.length > 0) {
            // Has timestamp metadata — return the single closest frame
            const bestPic = withTime.reduce((b: any, p: any) =>
              Math.abs(p.time - time) < Math.abs(b.time - time) ? p : b
            );
            console.log(`[vimeo-frame] closest picture: ${bestPic.time}s (wanted ${time}s)`);
            const sz = bestSize(bestPic.sizes ?? []);
            if (sz) {
              return c.json({
                success: true, url: sz.url, width: sz.w, height: sz.h,
                time, actualTime: bestPic.time, source: "pictures",
              });
            }
          } else if (pics.length > 0) {
            // No timestamp metadata — try to CREATE a frame at the exact requested time.
            // POST /videos/{id}/pictures with time=X tells Vimeo to render that specific frame.
            console.log(`[vimeo-frame] no timestamps — attempting POST /pictures time=${time}`);
            let createdSz: { url: string; w: number; h: number } | null = null;
            let createdPicId: string | null = null;
            try {
              const createRes = await fetch(
                `https://api.vimeo.com/videos/${videoId}/pictures`,
                {
                  method: "POST",
                  headers: { ...apiHeaders, "Content-Type": "application/json" },
                  body: JSON.stringify({ time, active: false }),
                }
              );
              console.log(`[vimeo-frame] create picture: ${createRes.status}`);
              if (createRes.status === 403) {
                // Token lacks "upload" scope — surface this clearly so the user knows exactly what to fix
                console.log(`[vimeo-frame] 403 — token missing "upload" scope`);
                const allUrls2: string[] = [];
                let fw2 = 0, fh2 = 0;
                for (const p of pics) {
                  const sz = bestSize(p.sizes ?? []);
                  if (sz) { allUrls2.push(sz.url); if (!fw2) { fw2 = sz.w; fh2 = sz.h; } }
                }
                return c.json({
                  success: true,
                  urls: allUrls2.length ? allUrls2 : [],
                  width: fw2, height: fh2,
                  time, actualTime: null,
                  source: "pictures-notimestamp",
                  scopeError: true,
                });
              }
              if (createRes.ok) {
                const createData = await createRes.json();
                const picUri: string = createData.uri ?? "";
                createdPicId = picUri.split("/").pop() ?? null;
                console.log(`[vimeo-frame] created picId=${createdPicId} — polling for sizes…`);
                // Vimeo generates the frame asynchronously; poll until sizes array populates
                for (let attempt = 0; attempt < 12; attempt++) {
                  await new Promise(r => setTimeout(r, 700));
                  const pollRes = await fetch(
                    `https://api.vimeo.com/videos/${videoId}/pictures/${createdPicId}`,
                    { headers: apiHeaders }
                  );
                  if (pollRes.ok) {
                    const pollData = await pollRes.json();
                    const sz = bestSize(pollData.sizes ?? []);
                    if (sz) { createdSz = sz; break; }
                  }
                  console.log(`[vimeo-frame] poll ${attempt + 1}/12 — sizes not ready yet`);
                }
              }
            } catch (e) { console.log(`[vimeo-frame] create picture error:`, e); }

            if (createdSz && createdPicId) {
              console.log(`[vimeo-frame] ✅ generated frame at ${time}s → ${createdSz.w}×${createdSz.h}`);
              // Delay delete by 15s so the CDN URL stays alive long enough for the browser to load it
              setTimeout(() => {
                fetch(`https://api.vimeo.com/videos/${videoId}/pictures/${createdPicId}`, {
                  method: "DELETE", headers: apiHeaders,
                }).catch(() => {});
              }, 15_000);
              return c.json({
                success: true, url: createdSz.url, width: createdSz.w, height: createdSz.h,
                time, actualTime: time, source: "pictures-created",
              });
            }

            // Creation not supported (no write scope) — fall back to all existing thumbnails
            console.log(`[vimeo-frame] create failed — returning all ${pics.length} existing picture(s)`);
            const allUrls: string[] = [];
            let firstW = 0, firstH = 0;
            for (const p of pics) {
              const sz = bestSize(p.sizes ?? []);
              if (sz) { allUrls.push(sz.url); if (!firstW) { firstW = sz.w; firstH = sz.h; } }
            }
            if (allUrls.length > 0) {
              return c.json({
                success: true, urls: allUrls, width: firstW, height: firstH,
                time, actualTime: null, source: "pictures-notimestamp",
              });
            }
          }
        }
      } catch (e) { console.log(`[vimeo-frame] pictures error:`, e); }
    }

    // ── Strategy B: Sprite VTT (Vimeo Pro+ only) ─────────────────────────
    // ── Shared VTT parser ────────────────────────────────────────────────
    interface VttCue {
      start: number; end: number;
      url: string; x: number; y: number; w: number; h: number;
    }
    function parseVttTime(t: string): number {
      const parts = t.trim().replace(",", ".").split(":");
      const secs  = parseFloat(parts.pop() ?? "0");
      const mins  = parseInt(parts.pop()  ?? "0", 10);
      const hrs   = parseInt(parts.pop()  ?? "0", 10);
      return hrs * 3600 + mins * 60 + secs;
    }
    function parseVtt(text: string): VttCue[] {
      const cues: VttCue[] = [];
      const lines = text.split(/\r?\n/);
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line.includes("-->")) continue;
        const arrow    = line.indexOf("-->");
        const startStr = line.substring(0, arrow).trim();
        const endStr   = line.substring(arrow + 3).trim().split(/\s/)[0];
        let urlLine = "";
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          const cl = lines[j]?.trim();
          if (cl && (cl.startsWith("http") || cl.includes("#xywh="))) { urlLine = cl; break; }
        }
        const hi = urlLine.indexOf("#xywh=");
        if (hi === -1) continue;
        const imgUrl = urlLine.substring(0, hi);
        const coords = urlLine.substring(hi + 6).split(",").map(Number);
        const [x, y, w, h] = coords;
        if (imgUrl && coords.length >= 4 && w > 0 && h > 0 && !isNaN(x + y + w + h)) {
          cues.push({ start: parseVttTime(startStr), end: parseVttTime(endStr), url: imgUrl, x, y, w, h });
        }
      }
      return cues;
    }
    function pickBestCue(cues: VttCue[], t: number): VttCue {
      let best = cues[0];
      for (const cue of cues) {
        if (t >= cue.start && t < cue.end) return cue;
        if (Math.abs((cue.start + cue.end) / 2 - t) < Math.abs((best.start + best.end) / 2 - t)) best = cue;
      }
      return best;
    }

    let vttText: string | null = null;

    try {
      const cfgRes = await fetch(`https://player.vimeo.com/video/${videoId}/config`, {
        headers: { "User-Agent": "Mozilla/5.0", "Referer": "https://vimeo.com/", "Accept": "application/json" },
      });
      console.log(`[vimeo-frame] player config: ${cfgRes.status}`);
      if (cfgRes.ok) {
        const cfg = await cfgRes.json();
        const thumbs = cfg?.video?.thumbs;
        const hashes = new Set<string>([String(videoId)]);
        if (thumbs) {
          for (const v of Object.values(thumbs)) {
            if (typeof v !== "string") continue;
            const m = v.match(/\/video\/([^_/?#\s]+)/);
            if (m?.[1]) hashes.add(m[1]);
          }
        }
        console.log(`[vimeo-frame] sprite hashes:`, [...hashes]);
        outer: for (const hash of hashes) {
          for (const sz of ["1920", "960", "640", "320"]) {
            const url = `https://i.vimeocdn.com/video/${hash}/thumbs/${sz}.vtt`;
            try {
              const r = await fetch(url, { headers: { "Referer": "https://vimeo.com/" } });
              console.log(`[vimeo-frame] sprite VTT ${url}: ${r.status}`);
              if (r.ok) { const t = await r.text(); if (t.includes("WEBVTT")) { vttText = t; break outer; } }
            } catch {}
          }
        }
      }
    } catch (e) { console.log(`[vimeo-frame] config error:`, e); }

    if (vttText) {
      const cues = parseVtt(vttText);
      console.log(`[vimeo-frame] sprite cues: ${cues.length}`);
      if (cues.length > 0) {
        const best = pickBestCue(cues, time);
        return c.json({
          success: true,
          spriteUrl: best.url, x: best.x, y: best.y, w: best.w, h: best.h,
          time, actualTime: (best.start + best.end) / 2, source: "sprite",
        });
      }
    }

    // ── Strategy C: oEmbed static thumbnail (always available) ───────────
    try {
      const oeRes = await fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${videoId}&width=1920`);
      console.log(`[vimeo-frame] oembed: ${oeRes.status}`);
      if (oeRes.ok) {
        const oe = await oeRes.json();
        if (oe.thumbnail_url) {
          const base = oe.thumbnail_url.replace(/_\d+x\d+(\.\w+)?$/, "");
          const url  = `${base}_1920x1080`;
          console.log(`[vimeo-frame] oembed thumbnail: ${url}`);
          return c.json({
            success: true, url, width: 1920, height: 1080,
            time, actualTime: null, source: "oembed",
          });
        }
      }
    } catch (e) { console.log(`[vimeo-frame] oembed error:`, e); }

    return c.json({ success: false, error: "Could not retrieve any thumbnail for this video.", fallback: true });

  } catch (err) {
    console.error("[vimeo-frame] Unhandled error:", err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

app.get("/make-server-e07959ec/projects", async (c) => {
  try {
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('order_index', { ascending: true });
    
    if (error) {
      // Table may not exist yet — return empty array so the frontend can use its fallback
      console.log(`Error fetching projects (returning empty): ${error.message}`);
      return c.json({ success: true, data: [] });
    }
    
    return c.json({ success: true, data: (data || []).map(fromDbRow) });
  } catch (error) {
    console.log(`Error fetching projects: ${error}`);
    return c.json({ success: true, data: [] });
  }
});

// Get single project by slug OR UUID
app.get("/make-server-e07959ec/projects/:id", async (c) => {
  try {
    const idOrSlug = c.req.param("id");
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

    // Try slug lookup first (works for both slug and UUID columns)
    const isUuid = UUID_RE.test(idOrSlug);
    
    // Build query: if it looks like a UUID, match on id; otherwise match on slug
    let query = supabase.from('projects').select('*');
    if (isUuid) {
      // Could be either a real UUID id or a slug that happens to look like a UUID (unlikely)
      // Try id first, then fall back to slug
      const { data: byId, error: idErr } = await query.eq('id', idOrSlug).single();
      if (!idErr && byId) {
        return c.json({ success: true, data: fromDbRow(byId) });
      }
    }

    // Look up by slug (covers both slug-based URLs and UUID fallback miss above)
    const { data: bySlug, error: slugErr } = await supabase
      .from('projects')
      .select('*')
      .eq('slug', idOrSlug)
      .single();

    if (!slugErr && bySlug) {
      return c.json({ success: true, data: fromDbRow(bySlug) });
    }

    // Nothing found
    console.log(`Project not found for slug/id: ${idOrSlug}`);
    return c.json({ success: false, error: "Project not found" }, 404);
  } catch (error) {
    console.log(`Error fetching project: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Create project (protected)
app.post("/make-server-e07959ec/projects", requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    // Strip any temp client-side id so Supabase auto-generates a real UUID
    const { id: _tempId, ...rest } = body;
    // Always derive slug from title (override any client-supplied slug so it stays in sync)
    rest.slug = rest.slug?.trim() || (rest.title ? generateSlug(rest.title) : undefined);
    
    // Set order_index to be last (max + 1) if not provided
    if (rest.orderIndex === undefined) {
      const { data: maxProject } = await supabase
        .from('projects')
        .select('order_index')
        .order('order_index', { ascending: false })
        .limit(1)
        .single();
      rest.orderIndex = maxProject?.order_index !== undefined ? maxProject.order_index + 1 : 0;
    }
    
    const dbRow = toDbRow(rest);
    
    const { data, error } = await supabase
      .from('projects')
      .insert(dbRow)
      .select()
      .single();
    
    if (error) {
      console.log(`Error creating project: ${error.message}`);
      return c.json({ success: false, error: error.message }, 400);
    }
    
    return c.json({ success: true, data: fromDbRow(data) });
  } catch (error) {
    console.log(`Error creating project: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Update project (protected)
app.put("/make-server-e07959ec/projects/:id", requireAuth, async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { id: _bodyId, ...rest } = body;
    // Keep slug in sync: if a slug was explicitly provided use it, otherwise derive from title
    if (rest.title) {
      rest.slug = rest.slug?.trim() || generateSlug(rest.title);
    }
    const dbRow = toDbRow(rest);
    
    const { data, error } = await supabase
      .from('projects')
      .update(dbRow)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.log(`Error updating project: ${error.message}`);
      return c.json({ success: false, error: error.message }, 400);
    }
    
    return c.json({ success: true, data: fromDbRow(data) });
  } catch (error) {
    console.log(`Error updating project: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Delete project (protected)
app.delete("/make-server-e07959ec/projects/:id", requireAuth, async (c) => {
  try {
    const id = c.req.param("id");
    
    const { error } = await supabase
      .from('projects')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.log(`Error deleting project: ${error.message}`);
      return c.json({ success: false, error: error.message }, 500);
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.log(`Error deleting project: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Reorder projects (protected)
app.post("/make-server-e07959ec/projects/reorder", requireAuth, async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { projectIds } = body;
    
    if (!Array.isArray(projectIds)) {
      console.log('Reorder error: projectIds must be an array');
      return c.json({ success: false, error: 'projectIds must be an array' }, 400);
    }

    if (projectIds.length === 0) {
      console.log('Reorder: empty array, nothing to do');
      return c.json({ success: true }, 200);
    }

    console.log(`Reordering ${projectIds.length} projects...`);

    // Update each project's order_index based on its position in the array
    const updatePromises = projectIds.map(async (id, index) => {
      const { error } = await supabase
        .from('projects')
        .update({ order_index: index })
        .eq('id', id);
      
      if (error) {
        console.error(`Error updating order for project ${id}:`, error.message);
        throw new Error(`Failed to update project ${id}: ${error.message}`);
      }
      return true;
    });

    await Promise.all(updatePromises);
    
    console.log('✅ Successfully reordered all projects');
    return c.json({ success: true }, 200);
  } catch (error) {
    console.error(`Error reordering projects: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Reorder tools (protected)
app.post("/make-server-e07959ec/tools/reorder", requireAuth, async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const { toolIds } = body;
    
    if (!Array.isArray(toolIds)) {
      console.log('Reorder error: toolIds must be an array');
      return c.json({ success: false, error: 'toolIds must be an array' }, 400);
    }

    if (toolIds.length === 0) {
      console.log('Reorder: empty array, nothing to do');
      return c.json({ success: true }, 200);
    }

    console.log(`Reordering ${toolIds.length} tools...`);

    // Update each tool's order_index based on its position in the array
    const updatePromises = toolIds.map(async (id, index) => {
      const { error } = await supabase
        .from('tools')
        .update({ order_index: index })
        .eq('id', id);
      
      if (error) {
        console.error(`Error updating order for tool ${id}:`, error.message);
        throw new Error(`Failed to update tool ${id}: ${error.message}`);
      }
      return true;
    });

    await Promise.all(updatePromises);
    
    console.log('✅ Successfully reordered all tools');
    return c.json({ success: true }, 200);
  } catch (error) {
    console.error(`Error reordering tools: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ========== VIDEO TRACKING ENDPOINTS ==========

// Record a video view and/or accumulated watch time (public — called from frontend)
app.post("/make-server-e07959ec/projects/:id/video-view", async (c) => {
  try {
    const projectId = c.req.param("id");
    const body = await c.req.json().catch(() => ({}));
    const addView      = body.addView === true;
    const watchSeconds = typeof body.watchSeconds === 'number' ? Math.max(0, Math.round(body.watchSeconds)) : 0;

    // Resolve real UUID if a slug was passed
    let realId = projectId;
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(projectId)) {
      const { data: row } = await supabase.from('projects').select('id').eq('slug', projectId).single();
      if (row) realId = row.id;
    }

    const kvKey  = `project_video_stats:${realId}`;
    const existing = (await kv.get(kvKey)) ?? { views: 0, totalWatchSeconds: 0, lastViewed: null };

    const updated = {
      views:             (existing.views || 0) + (addView ? 1 : 0),
      totalWatchSeconds: (existing.totalWatchSeconds || 0) + watchSeconds,
      lastViewed:        addView ? new Date().toISOString() : (existing.lastViewed ?? null),
    };

    await kv.set(kvKey, updated);
    return c.json({ success: true, data: updated });
  } catch (error) {
    console.log(`Error recording video view: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Record showreel view / watch time (public — called from Home page)
app.post("/make-server-e07959ec/showreel/video-view", async (c) => {
  try {
    const body = await c.req.json().catch(() => ({}));
    const addView      = body.addView === true;
    const watchSeconds = typeof body.watchSeconds === 'number' ? Math.max(0, Math.round(body.watchSeconds)) : 0;

    const kvKey    = 'showreel_video_stats';
    const existing = (await kv.get(kvKey)) ?? { views: 0, totalWatchSeconds: 0, lastViewed: null };

    const updated = {
      views:             (existing.views || 0) + (addView ? 1 : 0),
      totalWatchSeconds: (existing.totalWatchSeconds || 0) + watchSeconds,
      lastViewed:        addView ? new Date().toISOString() : (existing.lastViewed ?? null),
    };

    await kv.set(kvKey, updated);
    return c.json({ success: true, data: updated });
  } catch (error) {
    console.log(`Error recording showreel view: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Get video stats for all projects + showreel (admin only)
app.get("/make-server-e07959ec/admin/video-stats", requireAuth, async (c) => {
  try {
    const { data: projects, error } = await supabase
      .from('projects')
      .select('id, title, slug, image_url, video_url')
      .order('order_index', { ascending: true });

    if (error) {
      console.log(`Error fetching projects for video stats: ${error.message}`);
      return c.json({ success: false, error: error.message }, 500);
    }

    const keys     = (projects || []).map(p => `project_video_stats:${p.id}`);
    const statsArr = keys.length > 0 ? await kv.mget(keys) : [];

    const result = (projects || []).map((project, i) => {
      const stats             = statsArr[i] ?? { views: 0, totalWatchSeconds: 0, lastViewed: null };
      const views             = stats.views || 0;
      const totalWatchSeconds = stats.totalWatchSeconds || 0;
      return {
        projectId:       project.id,
        title:           project.title,
        slug:            project.slug,
        imageUrl:        project.image_url,
        hasVideo:        !!project.video_url,
        isShowreel:      false,
        views,
        totalWatchSeconds,
        avgWatchSeconds: views > 0 ? Math.round(totalWatchSeconds / views) : 0,
        lastViewed:      stats.lastViewed ?? null,
      };
    });

    // Sort projects by views descending
    result.sort((a, b) => b.views - a.views);

    // Prepend showreel (always pinned at the top)
    const showreelRaw = (await kv.get('showreel_video_stats')) ?? { views: 0, totalWatchSeconds: 0, lastViewed: null };
    const srViews     = showreelRaw.views || 0;
    const srWatch     = showreelRaw.totalWatchSeconds || 0;
    result.unshift({
      projectId:        'showreel',
      title:            'Showreel',
      slug:             null,
      imageUrl:         null,
      hasVideo:         true,
      isShowreel:       true,
      views:            srViews,
      totalWatchSeconds: srWatch,
      avgWatchSeconds:  srViews > 0 ? Math.round(srWatch / srViews) : 0,
      lastViewed:       showreelRaw.lastViewed ?? null,
    });

    return c.json({ success: true, data: result });
  } catch (error) {
    console.log(`Error fetching video stats: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// DELETE /admin/video-stats — wipe all video view/watch-time data
// Body: { email, password }  — requires credential re-verification
app.delete('/make-server-e07959ec/admin/video-stats', requireAuth, async (c) => {
  try {
    const { email, password } = await c.req.json().catch(() => ({}));
    if (!email || !password) {
      return c.json({ success: false, error: 'Email and password are required.' }, 400);
    }

    // Re-verify admin credentials before destructive action
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({ email, password });
    if (authError || !authData.user) {
      console.log('[video-stats reset] Auth failed:', authError?.message);
      return c.json({ success: false, error: 'Incorrect password. Reset cancelled.' }, 401);
    }

    // Delete all project video stats + showreel stat
    const [projectRes, showreelRes] = await Promise.all([
      supabase.from('kv_store_e07959ec').delete().like('key', 'project_video_stats:%').select('key'),
      supabase.from('kv_store_e07959ec').delete().eq('key', 'showreel_video_stats').select('key'),
    ]);
    if (projectRes.error)  throw projectRes.error;
    if (showreelRes.error) throw showreelRes.error;

    const deleted = (projectRes.data?.length ?? 0) + (showreelRes.data?.length ?? 0);
    console.log(`[video-stats reset] ✅ Deleted ${deleted} video analytics entries`);
    return c.json({ success: true, deleted });
  } catch (err) {
    console.log('[video-stats reset] ❌ Error:', err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// ========== TOOLS ENDPOINTS ==========

// Get all tools with versions
app.get("/make-server-e07959ec/tools", async (c) => {
  try {
    const { data: tools, error: toolsError } = await supabase
      .from('tools')
      .select(`
        *,
        tool_versions (*)
      `)
      .order('order_index', { ascending: true });
    
    if (toolsError) {
      console.log(`Error fetching tools: ${toolsError.message}`);
      return c.json({ success: false, error: toolsError.message }, 500);
    }
    
    return c.json({ success: true, data: (tools || []).map(normalizeTool) });
  } catch (error) {
    console.log(`Error fetching tools: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Get single tool by ID with versions
app.get("/make-server-e07959ec/tools/:id", async (c) => {
  try {
    const id = c.req.param("id");
    
    const { data, error } = await supabase
      .from('tools')
      .select(`
        *,
        tool_versions (*)
      `)
      .eq('id', id)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return c.json({ success: false, error: "Tool not found" }, 404);
      }
      console.log(`Error fetching tool: ${error.message}`);
      return c.json({ success: false, error: error.message }, 500);
    }
    
    return c.json({ success: true, data: normalizeTool(data) });
  } catch (error) {
    console.log(`Error fetching tool: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Get tool by slug with versions
app.get("/make-server-e07959ec/tools/slug/:slug", async (c) => {
  try {
    const slug = c.req.param("slug");
    
    const { data, error } = await supabase
      .from('tools')
      .select(`
        *,
        tool_versions (*)
      `)
      .eq('slug', slug)
      .single();
    
    if (error) {
      if (error.code === 'PGRST116') {
        return c.json({ success: false, error: "Tool not found" }, 404);
      }
      console.log(`Error fetching tool: ${error.message}`);
      return c.json({ success: false, error: error.message }, 500);
    }
    
    return c.json({ success: true, data: normalizeTool(data) });
  } catch (error) {
    console.log(`Error fetching tool: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Get purchase counts for each version of a tool (public)
app.get("/make-server-e07959ec/tools/:toolId/version-stats", async (c) => {
  try {
    const toolId = c.req.param("toolId");
    
    // Get all version IDs for this tool
    const { data: versions, error: versionError } = await supabase
      .from('tool_versions')
      .select('id')
      .eq('tool_id', toolId);
    
    if (versionError) {
      console.log(`Error fetching tool versions: ${versionError.message}`);
      return c.json({ success: false, error: versionError.message }, 500);
    }
    
    if (!versions || versions.length === 0) {
      return c.json({ success: true, data: {} });
    }
    
    const versionIds = versions.map(v => v.id);
    
    // Count purchases per version (only active purchases, exclude free versions by checking amount > 0)
    const { data: purchases, error: purchaseError } = await supabase
      .from('user_purchases')
      .select('tool_version_id')
      .in('tool_version_id', versionIds)
      .eq('status', 'active')
      .gt('amount', 0);
    
    if (purchaseError) {
      console.log(`Error fetching purchase stats: ${purchaseError.message}`);
      return c.json({ success: false, error: purchaseError.message }, 500);
    }
    
    // Count purchases by version_id
    const stats: Record<string, number> = {};
    for (const p of (purchases || [])) {
      if (p.tool_version_id) {
        stats[p.tool_version_id] = (stats[p.tool_version_id] || 0) + 1;
      }
    }
    
    return c.json({ success: true, data: stats });
  } catch (error) {
    console.log(`Error fetching version stats: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Create tool (protected)
app.post("/make-server-e07959ec/tools", requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    // Strip temp client-side id and pull out versions + ALL fields that have no DB column.
    // tagline            → NO DB column → 🏷️ sentinel in faqs (plain string)
    // howItWorks         → NO DB column → 📋 sentinel in faqs (JSON-encoded array)
    // systemRequirements → NO DB column → 🖥️ sentinel in faqs (plain string)
    // demoUrl            → NO DB column → 🎬 sentinel in faqs (plain string)
    // freeCtaText        → NO DB column → 🆓 sentinel in faqs (plain string)
    // freeCtaIcon        → NO DB column → 🔵 sentinel in faqs (plain string)
    // paidCtaText        → NO DB column → 💵 sentinel in faqs (plain string)
    // paidCtaIcon        → NO DB column → 🟣 sentinel in faqs (plain string)
    // showcasePaidCtaText → NO DB column → 🎯 sentinel in faqs (plain string)
    const {
      versions,
      id: _tempId,
      demoUrl: toolDemoUrl,
      howItWorks: toolHowItWorks,
      systemRequirements: toolSysReq,
      tagline: toolTagline,
      toolCategory: toolCat,
      freeCtaText: toolFreeCtaText,
      freeCtaIcon: toolFreeCtaIcon,
      paidCtaText: toolPaidCtaText,
      paidCtaIcon: toolPaidCtaIcon,
      showcasePaidCtaText: toolShowcasePaidCtaText,
      richFeatures: toolRichFeatures,
      ...toolRest
    } = body;

    // Fold sentinel-encoded fields into faqs so they survive in the DB
    const toolFaqs = [
      ...(toolDemoUrl   ? [{ question: '🎬', answer: toolDemoUrl }]                          : []),
      ...(toolHowItWorks && toolHowItWorks.length > 0
                        ? [{ question: '📋', answer: JSON.stringify(toolHowItWorks) }]        : []),
      ...(toolSysReq    ? [{ question: '🖥️', answer: toolSysReq }]                           : []),
      ...(toolTagline   ? [{ question: '🏷️', answer: toolTagline }]                          : []),
      ...(toolCat       ? [{ question: '🗂️', answer: toolCat }]                              : []),
      ...(toolFreeCtaText ? [{ question: '🆓', answer: toolFreeCtaText }]                    : []),
      ...(toolFreeCtaIcon ? [{ question: '🔵', answer: toolFreeCtaIcon }]                    : []),
      ...(toolPaidCtaText ? [{ question: '💵', answer: toolPaidCtaText }]                    : []),
      ...(toolPaidCtaIcon ? [{ question: '🟣', answer: toolPaidCtaIcon }]                    : []),
      ...(toolShowcasePaidCtaText ? [{ question: '🎯', answer: toolShowcasePaidCtaText }]    : []),
      ...(toolRest.faqs ?? []),
    ];
    const toolDbRow = toDbRow({ ...toolRest, faqs: toolFaqs, richFeatures: toolRichFeatures ?? [] });

    // Insert tool
    const { data: tool, error: toolError } = await supabase
      .from('tools')
      .insert(toolDbRow)
      .select()
      .single();
    
    if (toolError) {
      console.log(`Error creating tool: ${toolError.message}`);
      return c.json({ success: false, error: toolError.message }, 400);
    }
    
    // Insert versions if provided
    if (versions && Array.isArray(versions) && versions.length > 0) {
      const versionsWithToolId = versions.map(v => {
        const priceSentinel = v.pricingModel === 'subscription'
          ? `subscription|${v.monthlyPrice ?? ''}|${v.yearlyPrice ?? ''}`
          : `lifetime|${v.lifetimePrice ?? ''}|${v.lifetimeBuyUrl ?? ''}`;
        const enrichedFeatures = [
          `💰 ${priceSentinel}`,
          ...(v.color ? [`🖌️ color|${v.color}`] : []),
          ...(v.featureLabel ? [`📝 ${v.featureLabel}`] : []),
          ...((v.whatsIncluded ?? []) as string[]).filter(Boolean).map((item: string) => `📦 ${item}`),
          ...((v.activationSteps ?? []) as string[]).filter(Boolean).map((step: string) => `🔑 ${step}`),
          ...((v.includedFeatureIds ?? []) as string[]).filter(Boolean).map((fid: string) => `✅ ${fid}`),
        ];
        return {
          tool_id:                  tool.id,
          version_type:             v.versionType ?? '',
          tagline:                  v.tagline ?? null,
          features:                 enrichedFeatures,
          how_it_works:             v.howItWorks ?? null,
          system_requirements:      v.systemRequirements ?? null,
          lemon_squeezy_product_id: v.lemonSqueezyProductId ?? null,
          lemon_squeezy_variant_id: v.lemonSqueezyVariantId ?? null,
          download_url:             v.downloadUrl ?? '',
          order_index:              v.orderIndex ?? 0,
        };
      });

      const { error: versionsError } = await supabase
        .from('tool_versions')
        .insert(versionsWithToolId);

      if (versionsError) {
        console.log(`Error creating tool versions: ${versionsError.message}`);
        // Roll back — delete the tool so we don't have orphaned records
        await supabase.from('tools').delete().eq('id', tool.id);
        return c.json({ success: false, error: `Version save failed: ${versionsError.message}` }, 400);
      }
    }
    
    // Fetch complete tool with versions
    const { data: completeData } = await supabase
      .from('tools')
      .select(`
        *,
        tool_versions (*)
      `)
      .eq('id', tool.id)
      .single();
    
    return c.json({ success: true, data: completeData ? normalizeTool(completeData) : null });
  } catch (error) {
    console.log(`Error creating tool: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Update tool (protected)
app.put("/make-server-e07959ec/tools/:id", requireAuth, async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    // Strip id and versions for separate handling. ALL non-DB fields must be extracted.
    // tagline            → NO DB column → 🏷️ sentinel in faqs (plain string)
    // howItWorks         → NO DB column → 📋 sentinel in faqs (JSON-encoded array)
    // systemRequirements → NO DB column → 🖥️ sentinel in faqs (plain string)
    // demoUrl            → NO DB column → 🎬 sentinel in faqs (plain string)
    // toolCategory       → NO DB column → 🗂️ sentinel in faqs (plain string)
    // freeCtaText        → NO DB column → 🆓 sentinel in faqs (plain string)
    // freeCtaIcon        → NO DB column → 🔵 sentinel in faqs (plain string)
    // paidCtaText        → NO DB column → 💵 sentinel in faqs (plain string)
    // paidCtaIcon        → NO DB column → 🟣 sentinel in faqs (plain string)
    // showcasePaidCtaText → NO DB column → 🎯 sentinel in faqs (plain string)
    const {
      versions,
      id: _bodyId,
      demoUrl: toolDemoUrl,
      howItWorks: toolHowItWorks,
      systemRequirements: toolSysReq,
      tagline: toolTagline,
      toolCategory: toolCat,
      freeCtaText: toolFreeCtaText,
      freeCtaIcon: toolFreeCtaIcon,
      paidCtaText: toolPaidCtaText,
      paidCtaIcon: toolPaidCtaIcon,
      showcasePaidCtaText: toolShowcasePaidCtaText,
      richFeatures: toolRichFeatures,
      ...toolRest
    } = body;

    // Fold sentinel-encoded fields into faqs so they survive in the DB
    const toolFaqs = [
      ...(toolDemoUrl   ? [{ question: '🎬', answer: toolDemoUrl }]                          : []),
      ...(toolHowItWorks && toolHowItWorks.length > 0
                        ? [{ question: '📋', answer: JSON.stringify(toolHowItWorks) }]        : []),
      ...(toolSysReq    ? [{ question: '🖥️', answer: toolSysReq }]                           : []),
      ...(toolTagline   ? [{ question: '🏷️', answer: toolTagline }]                          : []),
      ...(toolCat       ? [{ question: '🗂️', answer: toolCat }]                              : []),
      ...(toolFreeCtaText ? [{ question: '🆓', answer: toolFreeCtaText }]                    : []),
      ...(toolFreeCtaIcon ? [{ question: '🔵', answer: toolFreeCtaIcon }]                    : []),
      ...(toolPaidCtaText ? [{ question: '💵', answer: toolPaidCtaText }]                    : []),
      ...(toolPaidCtaIcon ? [{ question: '🟣', answer: toolPaidCtaIcon }]                    : []),
      ...(toolShowcasePaidCtaText ? [{ question: '🎯', answer: toolShowcasePaidCtaText }]    : []),
      ...(toolRest.faqs ?? []),
    ];
    const toolDbRow = toDbRow({ ...toolRest, faqs: toolFaqs, richFeatures: toolRichFeatures ?? [] });

    // Update tool
    const { data: tool, error: toolError } = await supabase
      .from('tools')
      .update(toolDbRow)
      .eq('id', id)
      .select()
      .single();
    
    if (toolError) {
      console.log(`Error updating tool: ${toolError.message}`);
      return c.json({ success: false, error: toolError.message }, 400);
    }
    
    // Update versions only when the caller sends a non-empty array.
    // An empty array most likely means the form state was uninitialised at
    // save-time (e.g. data hadn't loaded yet), so we skip the delete/insert
    // cycle entirely to avoid silently wiping existing version rows.
    if (versions && Array.isArray(versions) && versions.length > 0) {
      const versionsWithToolId = versions.map(v => {
        const priceSentinel = v.pricingModel === 'subscription'
          ? `subscription|${v.monthlyPrice ?? ''}|${v.yearlyPrice ?? ''}`
          : `lifetime|${v.lifetimePrice ?? ''}|${v.lifetimeBuyUrl ?? ''}`;
        const enrichedFeatures = [
          `💰 ${priceSentinel}`,
          ...(v.color ? [`🖌️ color|${v.color}`] : []),
          ...(v.featureLabel ? [`📝 ${v.featureLabel}`] : []),
          ...((v.whatsIncluded ?? []) as string[]).filter(Boolean).map((item: string) => `📦 ${item}`),
          ...((v.activationSteps ?? []) as string[]).filter(Boolean).map((step: string) => `🔑 ${step}`),
          ...((v.includedFeatureIds ?? []) as string[]).filter(Boolean).map((fid: string) => `✅ ${fid}`),
        ];
        return {
          tool_id:                  id,
          version_type:             v.versionType ?? '',
          tagline:                  v.tagline ?? null,
          features:                 enrichedFeatures,
          how_it_works:             v.howItWorks ?? null,
          system_requirements:      v.systemRequirements ?? null,
          lemon_squeezy_product_id: v.lemonSqueezyProductId ?? null,
          lemon_squeezy_variant_id: v.lemonSqueezyVariantId ?? null,
          download_url:             v.downloadUrl ?? '',
          order_index:              v.orderIndex ?? 0,
        };
      });

      // Snapshot existing version IDs before touching anything.
      // Insert new rows first — only delete old ones if insert succeeds.
      // This prevents data loss if the insert fails (e.g. a schema mismatch).
      const { data: existingVersions } = await supabase
        .from('tool_versions')
        .select('id')
        .eq('tool_id', id);
      const existingIds = (existingVersions ?? []).map((r: any) => r.id);

      const { error: versionsError } = await supabase
        .from('tool_versions')
        .insert(versionsWithToolId);

      if (versionsError) {
        console.log(`Error inserting tool versions: ${versionsError.message}`);
        return c.json({ success: false, error: `Version save failed: ${versionsError.message}` }, 400);
      }

      // Insert succeeded — now safe to remove the old rows by their snapshotted IDs
      if (existingIds.length > 0) {
        await supabase.from('tool_versions').delete().in('id', existingIds);
      }
    }
    
    // Fetch complete tool with versions
    const { data: completeData } = await supabase
      .from('tools')
      .select(`
        *,
        tool_versions (*)
      `)
      .eq('id', id)
      .single();
    
    return c.json({ success: true, data: completeData ? normalizeTool(completeData) : null });
  } catch (error) {
    console.log(`Error updating tool: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Delete tool (protected)
app.delete("/make-server-e07959ec/tools/:id", requireAuth, async (c) => {
  try {
    const id = c.req.param("id");
    
    // Versions will be deleted automatically due to CASCADE
    const { error } = await supabase
      .from('tools')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.log(`Error deleting tool: ${error.message}`);
      return c.json({ success: false, error: error.message }, 500);
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.log(`Error deleting tool: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ── DEBUG: raw tool_versions rows (public, read-only) ─────────────────────────
app.get("/make-server-e07959ec/debug/tool-versions", async (c) => {
  try {
    const { data, error } = await supabase
      .from('tool_versions')
      .select('*')
      .limit(50);
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, count: (data || []).length, data });
  } catch (err) {
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// ── DEBUG: raw tools rows with joined tool_versions (public, read-only) ────────
app.get("/make-server-e07959ec/debug/tools-raw", async (c) => {
  try {
    const { data, error } = await supabase
      .from('tools')
      .select('id, name, slug, tool_versions(*)')
      .limit(10);
    if (error) return c.json({ success: false, error: error.message }, 500);
    return c.json({ success: true, data });
  } catch (err) {
    return c.json({ success: false, error: String(err) }, 500);
  }
});
// ─────────────────────────────────────────────────────────────────────────────

// ========== TEAM MEMBERS ENDPOINTS ==========

// Get all team members
app.get("/make-server-e07959ec/team", async (c) => {
  try {
    const { data, error } = await supabase
      .from('team_members')
      .select('*')
      .order('order_index', { ascending: true });
    
    if (error) {
      console.log(`Error fetching team members: ${error.message}`);
      return c.json({ success: false, error: error.message }, 500);
    }
    
    return c.json({ success: true, data: (data || []).map(fromDbRow) });
  } catch (error) {
    console.log(`Error fetching team members: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Create team member (protected)
app.post("/make-server-e07959ec/team", requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { id: _tempId, ...rest } = body;
    const dbRow = toDbRow(rest);
    
    const { data, error } = await supabase
      .from('team_members')
      .insert(dbRow)
      .select()
      .single();
    
    if (error) {
      console.log(`Error creating team member: ${error.message}`);
      return c.json({ success: false, error: error.message }, 400);
    }
    
    return c.json({ success: true, data: fromDbRow(data) });
  } catch (error) {
    console.log(`Error creating team member: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Update team member (protected)
app.put("/make-server-e07959ec/team/:id", requireAuth, async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    const { id: _bodyId, ...rest } = body;
    const dbRow = toDbRow(rest);
    
    const { data, error } = await supabase
      .from('team_members')
      .update(dbRow)
      .eq('id', id)
      .select()
      .single();
    
    if (error) {
      console.log(`Error updating team member: ${error.message}`);
      return c.json({ success: false, error: error.message }, 400);
    }
    
    return c.json({ success: true, data: fromDbRow(data) });
  } catch (error) {
    console.log(`Error updating team member: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Delete team member (protected)
app.delete("/make-server-e07959ec/team/:id", requireAuth, async (c) => {
  try {
    const id = c.req.param("id");
    
    const { error } = await supabase
      .from('team_members')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.log(`Error deleting team member: ${error.message}`);
      return c.json({ success: false, error: error.message }, 500);
    }
    
    return c.json({ success: true });
  } catch (error) {
    console.log(`Error deleting team member: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ========== SITE SETTINGS ENDPOINT ==========

// Get site settings
app.get("/make-server-e07959ec/settings", async (c) => {
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('*');
    
    if (error) {
      console.log(`Error fetching settings: ${error.message}`);
      return c.json({ success: false, error: error.message }, 500);
    }
    
    // Convert array of key-value pairs to object
    const settings = (data || []).reduce((acc: any, item: any) => {
      acc[item.key] = item.value;
      return acc;
    }, {});
    
    return c.json({ success: true, data: settings });
  } catch (error) {
    console.log(`Error fetching settings: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Update site settings (protected)
app.post("/make-server-e07959ec/settings", requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    
    // Update or insert each setting
    for (const [key, value] of Object.entries(body)) {
      await supabase
        .from('site_settings')
        .upsert({ 
          key, 
          value,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        });
    }
    
    return c.json({ success: true, data: body });
  } catch (error) {
    console.log(`Error saving settings: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ========== LOGO MANAGEMENT ==========

// ── Shared logo upload helper ────────────────────────────────────────────────
const LOGO_EXTS = ['png', 'jpg', 'jpeg', 'svg', 'webp', 'gif'];

async function uploadLogoVariant(
  file: File,
  variant: 'dark' | 'light',
): Promise<{ logoUrl: string } | { error: string }> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  if (!LOGO_EXTS.includes(ext)) {
    return { error: 'Unsupported file type. Use PNG, JPG, SVG, WEBP, or GIF.' };
  }
  const path = `logo-${variant}.${ext}`;
  const buf  = await file.arrayBuffer();

  // Remove all previous variants of this slot (different extensions)
  await supabase.storage.from(BRAND_BUCKET_NAME).remove(
    LOGO_EXTS.map(e => `logo-${variant}.${e}`)
  );

  const { error: upErr } = await supabase.storage
    .from(BRAND_BUCKET_NAME)
    .upload(path, buf, { contentType: file.type, upsert: true });

  if (upErr) return { error: upErr.message };

  const { data: pubData } = supabase.storage.from(BRAND_BUCKET_NAME).getPublicUrl(path);
  const logoUrl = `${pubData.publicUrl}?v=${Date.now()}`;

  const settingKey = variant === 'dark' ? 'logoDarkUrl' : 'logoLightUrl';
  await supabase.from('site_settings').upsert(
    { key: settingKey, value: logoUrl, updated_at: new Date().toISOString() },
    { onConflict: 'key' }
  );
  return { logoUrl };
}

// Upload dark logo (admin-protected, multipart/form-data)
app.post('/make-server-e07959ec/logo/dark', requireAuth, async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return c.json({ success: false, error: 'No file uploaded' }, 400);
    const result = await uploadLogoVariant(file, 'dark');
    if ('error' in result) return c.json({ success: false, error: result.error }, 400);
    console.log('Dark logo uploaded:', result.logoUrl);
    return c.json({ success: true, logoUrl: result.logoUrl });
  } catch (err) {
    console.log('Dark logo upload error:', err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// Upload light logo (admin-protected, multipart/form-data)
app.post('/make-server-e07959ec/logo/light', requireAuth, async (c) => {
  try {
    const formData = await c.req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return c.json({ success: false, error: 'No file uploaded' }, 400);
    const result = await uploadLogoVariant(file, 'light');
    if ('error' in result) return c.json({ success: false, error: result.error }, 400);
    console.log('Light logo uploaded:', result.logoUrl);
    return c.json({ success: true, logoUrl: result.logoUrl });
  } catch (err) {
    console.log('Light logo upload error:', err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// Delete dark logo (admin-protected)
app.delete('/make-server-e07959ec/logo/dark', requireAuth, async (c) => {
  try {
    await supabase.storage.from(BRAND_BUCKET_NAME).remove(LOGO_EXTS.map(e => `logo-dark.${e}`));
    await supabase.from('site_settings').delete().eq('key', 'logoDarkUrl');
    console.log('Dark logo deleted');
    return c.json({ success: true });
  } catch (err) {
    console.log('Dark logo delete error:', err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// Delete light logo (admin-protected)
app.delete('/make-server-e07959ec/logo/light', requireAuth, async (c) => {
  try {
    await supabase.storage.from(BRAND_BUCKET_NAME).remove(LOGO_EXTS.map(e => `logo-light.${e}`));
    await supabase.from('site_settings').delete().eq('key', 'logoLightUrl');
    console.log('Light logo deleted');
    return c.json({ success: true });
  } catch (err) {
    console.log('Light logo delete error:', err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// ========== USER PURCHASES & LICENSES ==========

// Get user's purchases — accepts Supabase OAuth JWT (requireUserAuth)
app.get("/make-server-e07959ec/user/purchases", requireUserAuth, async (c) => {
  try {
    const user = c.get('user');

    // Simple select — avoids PostgREST FK-join errors if relationships aren't declared
    const { data, error } = await supabase
      .from('user_purchases')
      .select('*')
      .eq('user_id', user.id)
      .order('purchased_at', { ascending: false });

    if (error) {
      console.error(`Error fetching user purchases: ${error.message} | code: ${error.code} | details: ${error.details}`);
      return c.json({ success: false, error: `${error.message} (${error.code})` }, 500);
    }

    // Enrich each row with tool_version + tool data from the database
    const enriched = await Promise.all((data || []).map(async (row: any) => {
      try {
        let tv: any = null;
        let tool: any = null;

        console.log(`Enriching purchase id=${row.id} | tool_version_id=${row.tool_version_id} | product_name="${row.product_name}" | variant_name="${row.variant_name}" | amount=${row.amount}`);

        // Primary path: look up via tool_version_id FK
        if (row.tool_version_id) {
          const { data: tvData } = await supabase
            .from('tool_versions')
            .select('id, version_type, download_url, lemon_squeezy_variant_id, tool_id, features')
            .eq('id', row.tool_version_id)
            .maybeSingle();
          tv = tvData ?? null;
          console.log(`  → Primary path version: ${tv?.version_type ?? 'not found'}`);

          if (tv?.tool_id) {
            const { data: toolData } = await supabase
              .from('tools')
              .select('id, name, slug, image_url')
              .eq('id', tv.tool_id)
              .maybeSingle();
            tool = toolData ?? null;
          }
        }

        // Fallback: match tool by product_name when tool_version_id is missing or lookup failed
        if (!tool && row.product_name) {
          const { data: toolData } = await supabase
            .from('tools')
            .select('id, name, slug, image_url')
            .ilike('name', row.product_name.trim())
            .maybeSingle();
          tool = toolData ?? null;
          console.log(`  → Fallback tool by product_name: ${tool?.name ?? 'not found'}`);

          if (tool) {
            // 1. Match version via lemon_squeezy_variant_id on the purchase row
            if (!tv && row.lemon_squeezy_variant_id) {
              const { data: tvData } = await supabase
                .from('tool_versions')
                .select('id, version_type, download_url, lemon_squeezy_variant_id, tool_id, features')
                .eq('lemon_squeezy_variant_id', row.lemon_squeezy_variant_id)
                .maybeSingle();
              tv = tvData ?? null;
              console.log(`  → Step 1 (variant_id match): ${tv?.version_type ?? 'not found'}`);
            }

            // 2. Match version by variant_name keyword (LS can send "Pro License", "Studio Plan", etc.)
            if (!tv && row.variant_name) {
              const vn = row.variant_name.toLowerCase();
              let versionType: string | null = null;
              if (vn.includes('studio'))    versionType = 'Studio';
              else if (vn.includes('pro'))  versionType = 'Pro';
              else if (vn.includes('free')) versionType = 'Free';
              console.log(`  → Step 2 variant_name="${row.variant_name}" → keyword="${versionType}"`);
              if (versionType) {
                const { data: tvData } = await supabase
                  .from('tool_versions')
                  .select('id, version_type, download_url, lemon_squeezy_variant_id, tool_id, features')
                  .eq('tool_id', tool.id)
                  .eq('version_type', versionType)
                  .maybeSingle();
                tv = tvData ?? null;
                console.log(`  → Step 2 result: ${tv?.version_type ?? 'not found'}`);
              }
            }

            // 3. Last resort: use variant_name to decide paid vs free — NEVER use amount
            //    (amount is $0 in test mode even for Pro/Studio purchases)
            if (!tv) {
              const variantLower = (row.variant_name || '').toLowerCase();
              const isFreeVariant = variantLower.includes('free') || variantLower === '';
              console.log(`  → Step 3 last resort: isFreeVariant=${isFreeVariant}`);
              const { data: tvData } = await supabase
                .from('tool_versions')
                .select('id, version_type, download_url, lemon_squeezy_variant_id, tool_id, features')
                .eq('tool_id', tool.id)
                .neq('version_type', isFreeVariant ? '' : 'Free')
                .limit(1)
                .maybeSingle();
              tv = tvData ?? null;
              console.log(`  → Step 3 result: ${tv?.version_type ?? 'not found'}`);
            }
          }
        }

        // Extract activation steps from the raw features[] before returning
        let activationSteps: string[] = [];
        if (Array.isArray(tv?.features)) {
          activationSteps = (tv.features as string[])
            .filter((f: string) => typeof f === 'string' && f.startsWith('🔑 '))
            .map((f: string) => f.replace('🔑 ', ''));
        }

        console.log(`  → Final: tool="${tool?.name}" version="${tv?.version_type}" image="${tool?.image_url ? 'yes' : 'no'}" steps=${activationSteps.length}`);
        if (!tv && !tool) return row;
        return { ...row, tool_version: { ...tv, activation_steps: activationSteps }, tool };
      } catch (e) {
        console.warn('Could not enrich purchase with tool info:', e);
        return row;
      }
    }));

    console.log(`Purchases enriched: ${enriched.length} rows. Tool images found: ${enriched.filter((r: any) => r.tool?.image_url).length}`);
    return c.json({ success: true, data: enriched });
  } catch (error) {
    console.log(`Error fetching user purchases: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// Verify license key (public)
app.post("/make-server-e07959ec/verify-license", async (c) => {
  try {
    const { licenseKey } = await c.req.json();
    
    if (!licenseKey) {
      return c.json({ success: false, error: "License key is required" }, 400);
    }
    
    const { data, error } = await supabase
      .from('user_purchases')
      .select(`
        *,
        tool_versions (
          *,
          tools (*)
        )
      `)
      .eq('license_key', licenseKey)
      .eq('status', 'active')
      .single();
    
    if (error || !data) {
      return c.json({ 
        success: false, 
        valid: false,
        error: "Invalid or inactive license key" 
      }, 404);
    }
    
    // Check if subscription has expired
    if (data.expires_at && new Date(data.expires_at) < new Date()) {
      return c.json({ 
        success: false, 
        valid: false,
        error: "License has expired" 
      }, 400);
    }
    
    return c.json({ 
      success: true, 
      valid: true,
      data: {
        product_name: data.product_name,
        variant_name: data.variant_name,
        expires_at: data.expires_at,
      }
    });
  } catch (error) {
    console.log(`Error verifying license: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ========== USER PURCHASE SYNC ==========

// Sync orphan purchases — links purchases made before sign-up to the authenticated user
app.post("/make-server-e07959ec/user/sync-purchases", requireUserAuth, async (c) => {
  try {
    const user  = c.get('user');
    const email = user.email?.toLowerCase();

    if (!email) return c.json({ success: false, error: 'No email on account' }, 400);

    // Look up KV key written during the webhook for this email
    const orphanKey    = `ls_orphan:${email}`;
    const orphanOrders: string[] = (await kv.get(orphanKey)) || [];

    let synced = 0;

    if (orphanOrders.length > 0) {
      for (const orderId of orphanOrders) {
        const { error } = await supabase
          .from('user_purchases')
          .update({ user_id: user.id })
          .eq('lemon_squeezy_order_id', String(orderId))
          .is('user_id', null);
        if (!error) synced++;
        else console.log(`Error linking order ${orderId}:`, error.message);
      }
      if (synced > 0) {
        await kv.del(orphanKey);
        console.log(`✅ Synced ${synced} orphan purchase(s) for ${email}`);
      }
    }

    return c.json({ success: true, synced });
  } catch (error) {
    console.log('Error syncing purchases:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ========== LEMON SQUEEZY WEBHOOK ==========

// Helper: verify Lemon Squeezy HMAC-SHA256 signature
async function verifyLSSignature(secret: string, rawBody: string, signature: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw', encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false, ['sign']
    );
    const sig = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
    const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
    return hex === signature;
  } catch (e) {
    console.error('LS signature verification error:', e);
    return false;
  }
}

// Webhook endpoint to receive purchase notifications from Lemon Squeezy
app.post("/make-server-e07959ec/webhooks/lemon-squeezy", async (c) => {
  try {
    // Must read raw body first for HMAC verification
    const rawBody   = await c.req.text();
    const signature = c.req.header('X-Signature') || '';

    // ── Signature verification ──────────────────────────────────��─────────
    const webhookSecret = Deno.env.get('LEMON_SQUEEZY_WEBHOOK_SECRET');
    if (webhookSecret) {
      const valid = await verifyLSSignature(webhookSecret, rawBody, signature);
      if (!valid) {
        console.log('❌ Invalid Lemon Squeezy webhook signature');
        return c.json({ error: 'Invalid signature' }, 401);
      }
      console.log('✅ Webhook signature verified');
    } else {
      console.warn('⚠️  LEMON_SQUEEZY_WEBHOOK_SECRET not set — skipping verification');
    }

    const body      = JSON.parse(rawBody);
    const eventType = body.meta?.event_name;
    console.log('Lemon Squeezy webhook event:', eventType);

    // ─�� order_created ────────────────────────────────────────────────────
    if (eventType === 'order_created') {
      const orderData     = body.data;
      const customerEmail = orderData.attributes?.user_email;
      const orderId       = String(orderData.id);

      // Priority 1: user_id passed as custom checkout data
      let userId: string | null = body.meta?.custom_data?.user_id || null;

      // Priority 2: look up by email in user_profiles
      if (!userId && customerEmail) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('email', customerEmail)
          .maybeSingle();
        userId = profile?.id || null;
      }

      // Priority 3: search auth.users directly via admin API
      if (!userId && customerEmail) {
        try {
          const { data: { users } } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const found = users?.find((u: any) => u.email === customerEmail);
          if (found) userId = found.id;
        } catch (e) {
          console.warn('Could not list users for webhook lookup:', e);
        }
      }

      console.log(`order_created: email=${customerEmail}, resolved user_id=${userId}`);

      // If we have a tool_version_id from checkout custom data, look up our own version_type
      // from the DB so variant_name always stores our clean value ("Free", "Pro", "Studio")
      // instead of whatever arbitrary string Lemon Squeezy uses for the variant name.
      const toolVersionId: string | null = body.meta?.custom_data?.tool_version_id || null;
      let resolvedVariantName: string = orderData.attributes?.first_order_item?.variant_name || '';
      if (toolVersionId) {
        const { data: tvRow } = await supabase
          .from('tool_versions')
          .select('version_type')
          .eq('id', toolVersionId)
          .maybeSingle();
        if (tvRow?.version_type) {
          resolvedVariantName = tvRow.version_type;
          console.log(`  → variant_name resolved from DB: "${resolvedVariantName}" (LS sent: "${orderData.attributes?.first_order_item?.variant_name}")`);
        }
      }

      const { data: purchase, error: purchaseError } = await supabase
        .from('user_purchases')
        .insert({
          user_id:                   userId,
          tool_version_id:           toolVersionId,
          lemon_squeezy_order_id:    orderId,
          lemon_squeezy_customer_id: orderData.attributes?.customer_id,
          license_key:               orderData.attributes?.first_order_item?.license_key || null,
          product_name:              orderData.attributes?.first_order_item?.product_name,
          variant_name:              resolvedVariantName,
          status:                    'active',
          amount:                    parseFloat(orderData.attributes?.total || '0') / 100,
          currency:                  orderData.attributes?.currency || 'USD',
          purchased_at:              orderData.attributes?.created_at,
        })
        .select()
        .single();

      if (purchaseError) {
        console.log(`Error creating purchase: ${purchaseError.message}`);
        return c.json({ success: false, error: purchaseError.message }, 500);
      }

      console.log('✅ Purchase created:', purchase.id);

      // ── Mark the behavior tracking session as converted ──────────────────
      const trackingSessionId: string | null = body.meta?.custom_data?.session_id || null;
      if (trackingSessionId) {
        try {
          const tSession: any = await kv.get(`session:${trackingSessionId}`);
          if (tSession) {
            tSession.events = tSession.events || [];
            tSession.events.push({
              type: 'purchase_complete',
              timestamp: new Date().toISOString(),
              data: {
                orderId,
                toolVersionId: toolVersionId || null,
                productName: orderData.attributes?.first_order_item?.product_name || '',
                amount: parseFloat(orderData.attributes?.total || '0') / 100,
              },
            });
            tSession.converted   = true;
            tSession.funnelStage = 'purchase';
            if (customerEmail && !tSession.userEmail) tSession.userEmail = customerEmail;
            await kv.set(`session:${trackingSessionId}`, tSession);
            console.log(`✅ Tracking session ${trackingSessionId} marked as converted`);
          }
        } catch (e) {
          console.warn('Could not update tracking session on purchase:', e);
        }
      }

      // If no user found, track in KV so the user can claim it after sign-up
      if (!userId && customerEmail) {
        const orphanKey = `ls_orphan:${customerEmail.toLowerCase()}`;
        const existing: string[] = (await kv.get(orphanKey)) || [];
        if (!existing.includes(orderId)) {
          await kv.set(orphanKey, [...existing, orderId]);
          console.log(`📦 Orphan purchase tracked for ${customerEmail}`);
        }
      }

      return c.json({ success: true, data: purchase });
    }

    // ── license_key_created ───────────────────────────────────────────────
    // Lemon Squeezy fires this as a SEPARATE event — the key may not be
    // present in order_created yet, so we upsert it here.
    if (eventType === 'license_key_created') {
      const licenseData   = body.data;
      const licenseKey    = licenseData.attributes?.key;
      const orderId       = String(licenseData.attributes?.order_id);
      const customerEmail = licenseData.attributes?.user_email;

      console.log(`license_key_created: order_id=${orderId}, key=${licenseKey?.substring(0, 8)}…`);

      if (licenseKey && orderId) {
        const { error } = await supabase
          .from('user_purchases')
          .update({ license_key: licenseKey })
          .eq('lemon_squeezy_order_id', orderId);

        if (error) console.error('Error updating license key:', error.message);
        else console.log('✅ License key saved for order:', orderId);
      }

      // Keep orphan KV in sync
      if (customerEmail && orderId) {
        const orphanKey = `ls_orphan:${customerEmail.toLowerCase()}`;
        const existing: string[] = (await kv.get(orphanKey)) || [];
        if (!existing.includes(orderId)) {
          await kv.set(orphanKey, [...existing, orderId]);
        }
      }

      return c.json({ success: true, message: 'License key saved' });
    }

    // ── order_refunded ────────────────────────────────────────────────────
    if (eventType === 'order_refunded') {
      const orderId = String(body.data?.id);
      if (orderId) {
        const { error } = await supabase
          .from('user_purchases')
          .update({ status: 'refunded' })
          .eq('lemon_squeezy_order_id', orderId);
        if (error) console.error('Error marking refund:', error.message);
        else console.log('✅ Order marked refunded:', orderId);
      }
      return c.json({ success: true, message: 'Refund recorded' });
    }

    // ── subscription_created ──────────────────────────────────────────────
    // First event after checkout for subscription products.
    // Links the subscription ID to the purchase row and stores expires_at.
    if (eventType === 'subscription_created') {
      const sub       = body.data;
      const subId     = String(sub?.id);
      const orderId   = String(sub?.attributes?.order_id);
      const renewsAt  = sub?.attributes?.renews_at || null;
      const endsAt    = sub?.attributes?.ends_at   || null;
      const expiresAt = endsAt || renewsAt || null;

      console.log(`subscription_created: sub_id=${subId} order_id=${orderId} renews_at=${renewsAt} ends_at=${endsAt}`);

      if (subId && orderId) {
        const { error } = await supabase
          .from('user_purchases')
          .update({ lemon_squeezy_subscription_id: subId, status: 'active', expires_at: expiresAt })
          .eq('lemon_squeezy_order_id', orderId);
        if (error) console.error('subscription_created update error:', error.message);
        else console.log(`✅ Linked subscription ${subId} to order ${orderId}`);
      }
      return c.json({ success: true, message: 'Subscription linked' });
    }

    // ── subscription_updated ────────���─────────────────────────────────────
    // Fires whenever subscription data changes (renewals, plan changes, etc.)
    if (eventType === 'subscription_updated') {
      const sub      = body.data;
      const subId    = String(sub?.id);
      const lsStatus = sub?.attributes?.status; // active | cancelled | expired | on_trial | paused | past_due
      const renewsAt = sub?.attributes?.renews_at || null;
      const endsAt   = sub?.attributes?.ends_at   || null;
      const expiresAt = endsAt || renewsAt || null;

      const statusMap: Record<string, string> = {
        active:   'active',
        on_trial: 'active',
        past_due: 'active', // still has access
        paused:   'cancelled',
        cancelled: 'cancelled',
        expired:  'expired',
      };
      const newStatus = statusMap[lsStatus] ?? 'active';

      console.log(`subscription_updated: sub_id=${subId} ls_status=${lsStatus} → db_status=${newStatus} expires_at=${expiresAt}`);

      if (subId) {
        const { error } = await supabase
          .from('user_purchases')
          .update({ status: newStatus, expires_at: expiresAt })
          .eq('lemon_squeezy_subscription_id', subId);
        if (error) console.error('subscription_updated error:', error.message);
        else console.log(`✅ Subscription ${subId} updated → ${newStatus}`);
      }
      return c.json({ success: true, message: 'Subscription updated' });
    }

    // ── subscription_payment_success ──────────────────────────────────────
    // Fires on every successful renewal payment — restore active + new expires_at
    if (eventType === 'subscription_payment_success') {
      const sub       = body.data;
      const subId     = String(sub?.attributes?.subscription_id || sub?.id);
      const renewsAt  = sub?.attributes?.renews_at || null;
      const endsAt    = sub?.attributes?.ends_at   || null;
      const expiresAt = endsAt || renewsAt || null;

      console.log(`subscription_payment_success: sub_id=${subId} expires_at=${expiresAt}`);

      if (subId) {
        const { error } = await supabase
          .from('user_purchases')
          .update({ status: 'active', expires_at: expiresAt })
          .eq('lemon_squeezy_subscription_id', subId);
        if (error) console.error('subscription_payment_success error:', error.message);
        else console.log(`✅ Subscription ${subId} renewed → active`);
      }
      return c.json({ success: true, message: 'Subscription renewed' });
    }

    // ── subscription_resumed ──────────────────────────────────────────────
    // Fires when a paused/cancelled subscription is reactivated
    if (eventType === 'subscription_resumed') {
      const sub      = body.data;
      const subId    = String(sub?.id);
      const renewsAt = sub?.attributes?.renews_at || null;

      console.log(`subscription_resumed: sub_id=${subId}`);

      if (subId) {
        const { error } = await supabase
          .from('user_purchases')
          .update({ status: 'active', expires_at: renewsAt })
          .eq('lemon_squeezy_subscription_id', subId);
        if (error) console.error('subscription_resumed error:', error.message);
        else console.log(`✅ Subscription ${subId} resumed → active`);
      }
      return c.json({ success: true, message: 'Subscription resumed' });
    }

    // ── subscription_cancelled / subscription_expired ─────────────────────
    if (eventType === 'subscription_cancelled' || eventType === 'subscription_expired') {
      const sub       = body.data;
      const subId     = String(sub?.id);
      const orderId   = String(sub?.attributes?.order_id || '');
      const newStatus = eventType === 'subscription_expired' ? 'expired' : 'cancelled';
      const endsAt    = sub?.attributes?.ends_at || null;

      console.log(`${eventType}: sub_id=${subId} order_id=${orderId} ends_at=${endsAt}`);

      if (subId) {
        // Primary: match by subscription ID
        const { data: updated, error } = await supabase
          .from('user_purchases')
          .update({ status: newStatus, expires_at: endsAt })
          .eq('lemon_squeezy_subscription_id', subId)
          .select('id');
        if (error) console.error(`${eventType} error:`, error.message);

        // Fallback: if subscription ID wasn't stored yet, match by order ID
        if (!updated?.length && orderId) {
          const { error: err2 } = await supabase
            .from('user_purchases')
            .update({ status: newStatus, lemon_squeezy_subscription_id: subId, expires_at: endsAt })
            .eq('lemon_squeezy_order_id', orderId);
          if (err2) console.error(`${eventType} fallback error:`, err2.message);
          else console.log(`✅ Subscription ${subId} → ${newStatus} (matched via order_id fallback)`);
        } else {
          console.log(`✅ Subscription ${subId} → ${newStatus}`);
        }
      }
      return c.json({ success: true, message: 'Subscription status updated' });
    }

    return c.json({ success: true, message: 'Webhook received (unhandled event)' });
  } catch (error) {
    console.log(`Error in Lemon Squeezy webhook: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ========== CONTACT FORM ENDPOINT ==========

// Shared helper — fetches the admin notification email from site_settings.
// Falls back to undefined if not configured; callers must handle that case.
async function getAdminEmail(): Promise<string | undefined> {
  const { data: row, error } = await supabase
    .from('site_settings')
    .select('value')
    .eq('key', 'contactEmail')
    .maybeSingle();

  if (error) {
    console.error('[getAdminEmail] DB error fetching contactEmail:', error.message, error);
    return undefined;
  }

  const email = (row?.value as string | undefined)?.trim() || undefined;
  console.log('[getAdminEmail] contactEmail from site_settings:', email ?? '(not set — row was null/empty)');
  return email;
}

// Submit contact form (public, sends email)
app.post("/make-server-e07959ec/contact", async (c) => {
  try {
    const body = await c.req.json();
    const { name, email, projectType, timeline, budget, message } = body;

    if (!name || !email || !message) {
      return c.json({ 
        success: false, 
        error: "Name, email, and message are required" 
      }, 400);
    }

    // ── Store message in KV for admin dashboard (always, even if email fails) ──
    try {
      const msgTs    = Date.now();
      const msgUuid  = crypto.randomUUID().replace(/-/g, '').substring(0, 8);
      const msgKvKey = `msg:${msgTs}:contact:${msgUuid}`;
      const msgPayload = {
        kvKey: msgKvKey,
        id: `${msgTs}-${msgUuid}`,
        type: 'contact',
        name: name || '',
        email: email || '',
        projectType: projectType || '',
        timeline: timeline || '',
        budget: budget || '',
        message: message || '',
        read: false,
        createdAt: new Date().toISOString(),
      };
      await kv.set(msgKvKey, msgPayload);
      console.log(`[contact] ✅ Message stored in KV: ${msgKvKey}`);
    } catch (kvErr) {
      console.error('[contact] ❌ KV store FAILED — message will NOT appear in dashboard:', kvErr);
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.log('[contact] RESEND_API_KEY not configured — message saved to KV only');
      return c.json({ success: true, message: "Your message has been sent successfully! We'll reply within 24-48 hours." });
    }

    const adminEmail = await getAdminEmail();
    if (!adminEmail) {
      console.warn('[contact] ⚠️ contactEmail not found in site_settings — go to Admin → Settings and save your contact email. Notification skipped.');
      return c.json({ success: true, message: "Your message has been sent successfully! We'll reply within 24-48 hours." });
    }

    const resend = new Resend(resendApiKey);
    const submittedAt = new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });

    const emailHtml = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#e5e5e5;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:28px 32px;">
          <p style="margin:0 0 4px;font-size:12px;color:rgba(255,255,255,0.7);letter-spacing:0.1em;text-transform:uppercase;">Fastoosh Studio</p>
          <h1 style="margin:0;font-size:22px;color:#fff;">✉️ New Work Inquiry</h1>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 24px;font-size:15px;color:#d4d4d4;line-height:1.6;">
            Someone reached out through the <strong style="color:#fff;">Work With Us</strong> page. Here are the details:
          </p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
            <tr>
              <td style="padding:10px 14px;background:#1a1a1a;border-radius:6px 6px 0 0;color:#a3a3a3;font-size:13px;width:130px;">Name</td>
              <td style="padding:10px 14px;background:#1a1a1a;border-radius:6px 6px 0 0;color:#fff;font-size:13px;">${name}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;background:#141414;color:#a3a3a3;font-size:13px;">Email</td>
              <td style="padding:10px 14px;background:#141414;font-size:13px;"><a href="mailto:${email}" style="color:#a78bfa;text-decoration:none;">${email}</a></td>
            </tr>
            ${projectType ? `<tr><td style="padding:10px 14px;background:#1a1a1a;color:#a3a3a3;font-size:13px;">Project Type</td><td style="padding:10px 14px;background:#1a1a1a;color:#fff;font-size:13px;">${projectType}</td></tr>` : ''}
            ${timeline ? `<tr><td style="padding:10px 14px;background:#141414;color:#a3a3a3;font-size:13px;">Timeline</td><td style="padding:10px 14px;background:#141414;color:#fff;font-size:13px;">${timeline}</td></tr>` : ''}
            ${budget ? `<tr><td style="padding:10px 14px;background:#1a1a1a;color:#a3a3a3;font-size:13px;">Budget</td><td style="padding:10px 14px;background:#1a1a1a;color:#fff;font-size:13px;">${budget}</td></tr>` : ''}
          </table>
          <p style="margin:0 0 8px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Message</p>
          <div style="background:#111;border-left:3px solid #7c3aed;padding:16px 20px;border-radius:0 6px 6px 0;">
            <p style="margin:0;font-size:14px;color:#d4d4d4;line-height:1.7;white-space:pre-wrap;">${message.replace(/\n/g, '<br>')}</p>
          </div>
          <div style="margin-top:28px;text-align:center;">
            <a href="mailto:${email}?subject=Re: Your inquiry — Fastoosh"
               style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
              Reply to ${name}
            </a>
          </div>
          <p style="margin-top:28px;font-size:12px;color:#525252;text-align:center;">Submitted on ${submittedAt}</p>
        </div>
      </div>
    `;

    const { data, error } = await resend.emails.send({
      from: 'Fastoosh <contact@contact.fastoosh.com>',
      to: adminEmail,
      subject: `✉️ New inquiry from ${name}${projectType ? ` — ${projectType}` : ''}`,
      html: emailHtml,
      replyTo: email,
    });

    if (error) {
      console.log(`[contact] Error sending admin notification: ${JSON.stringify(error)}`);
    } else {
      console.log(`[contact] Admin notification sent to ${adminEmail}. Resend ID: ${data?.id}`);
    }

    return c.json({ 
      success: true, 
      message: "Your message has been sent successfully! We'll reply within 24-48 hours." 
    });
  } catch (error) {
    console.log(`Error in contact form: ${error}`);
    return c.json({ 
      success: false, 
      error: "An unexpected error occurred" 
    }, 500);
  }
});

// ─── Custom tool commission request ──────────────────────────────────────────
app.post("/make-server-e07959ec/custom-tool-request", async (c) => {
  try {
    const body = await c.req.json();
    const { name, email, softwares, workflow, automate, timeline, budget, notes } = body;

    if (!name || !email || !workflow || !automate || !timeline || !budget) {
      return c.json({ success: false, error: "Missing required fields" }, 400);
    }

    // Store in KV for admin reference (stored as object, not JSON string, with read:false)
    const requestId = `custom_tool_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const trKvKey = `custom_tool_request:${requestId}`;
    await kv.set(trKvKey, {
      kvKey: trKvKey,
      id: requestId, name, email,
      softwares: softwares || [],
      workflow, automate, timeline, budget,
      notes: notes || "",
      submittedAt: new Date().toISOString(),
      read: false,
    });
    console.log(`[custom-tool-request] ✅ Stored in KV: ${trKvKey}`);

    // Send email notification
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.warn('[custom-tool-request] No RESEND_API_KEY set, skipping email.');
      return c.json({ success: true });
    }

    const adminEmail = await getAdminEmail();
    if (!adminEmail) {
      console.warn('[custom-tool-request] No adminEmail configured, skipping email.');
      return c.json({ success: true });
    }

    const resend = new Resend(resendApiKey);
    const submittedAt = new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });
    const softwareList = Array.isArray(softwares) && softwares.length ? softwares.join(', ') : 'Not specified';

    const emailHtml = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#e5e5e5;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:28px 32px;">
          <p style="margin:0 0 4px;font-size:12px;color:rgba(255,255,255,0.7);letter-spacing:0.1em;text-transform:uppercase;">Fastoosh Studio</p>
          <h1 style="margin:0;font-size:22px;color:#fff;">🔧 Custom Tool Commission Request</h1>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 24px;font-size:15px;color:#d4d4d4;line-height:1.6;">
            A client has requested a <strong style="color:#fff;">custom tool commission</strong> through the Tools page. Here are the details:
          </p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
            <tr>
              <td style="padding:10px 14px;background:#1a1a1a;border-radius:6px 6px 0 0;color:#a3a3a3;font-size:13px;width:150px;">Name</td>
              <td style="padding:10px 14px;background:#1a1a1a;border-radius:6px 6px 0 0;color:#fff;font-size:13px;">${name}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;background:#141414;color:#a3a3a3;font-size:13px;">Email</td>
              <td style="padding:10px 14px;background:#141414;font-size:13px;"><a href="mailto:${email}" style="color:#a78bfa;text-decoration:none;">${email}</a></td>
            </tr>
            <tr>
              <td style="padding:10px 14px;background:#1a1a1a;color:#a3a3a3;font-size:13px;">Software</td>
              <td style="padding:10px 14px;background:#1a1a1a;color:#fff;font-size:13px;">${softwareList}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;background:#141414;color:#a3a3a3;font-size:13px;">Timeline</td>
              <td style="padding:10px 14px;background:#141414;color:#fff;font-size:13px;">${timeline}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;background:#1a1a1a;color:#a3a3a3;font-size:13px;">Budget</td>
              <td style="padding:10px 14px;background:#1a1a1a;color:#fff;font-size:13px;">${budget}</td>
            </tr>
          </table>

          <p style="margin:0 0 8px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Current Workflow / Problem</p>
          <div style="background:#111;border-left:3px solid #7c3aed;padding:16px 20px;border-radius:0 6px 6px 0;margin-bottom:20px;">
            <p style="margin:0;font-size:14px;color:#d4d4d4;line-height:1.7;white-space:pre-wrap;">${workflow.replace(/\n/g, '<br>')}</p>
          </div>

          <p style="margin:0 0 8px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">What the Tool Should Do</p>
          <div style="background:#111;border-left:3px solid #4f46e5;padding:16px 20px;border-radius:0 6px 6px 0;margin-bottom:${notes ? '20px' : '28px'};">
            <p style="margin:0;font-size:14px;color:#d4d4d4;line-height:1.7;white-space:pre-wrap;">${automate.replace(/\n/g, '<br>')}</p>
          </div>

          ${notes ? `
          <p style="margin:0 0 8px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Additional Notes</p>
          <div style="background:#111;border-left:3px solid #6b7280;padding:16px 20px;border-radius:0 6px 6px 0;margin-bottom:28px;">
            <p style="margin:0;font-size:14px;color:#d4d4d4;line-height:1.7;white-space:pre-wrap;">${notes.replace(/\n/g, '<br>')}</p>
          </div>` : ''}

          <div style="margin-top:28px;text-align:center;">
            <a href="mailto:${email}?subject=Re: Your custom tool request — Fastoosh"
               style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
              Reply to ${name}
            </a>
          </div>
          <p style="margin-top:28px;font-size:12px;color:#525252;text-align:center;">Submitted on ${submittedAt}</p>
        </div>
      </div>
    `;

    const { error } = await resend.emails.send({
      from: 'Fastoosh <contact@contact.fastoosh.com>',
      to: adminEmail,
      subject: `🔧 Custom tool request from ${name} — ${budget}`,
      html: emailHtml,
      replyTo: email,
    });

    if (error) {
      console.log(`[custom-tool-request] Email error: ${JSON.stringify(error)}`);
    } else {
      console.log(`[custom-tool-request] Notification sent to ${adminEmail}`);
    }

    return c.json({ success: true });
  } catch (err) {
    console.log(`[custom-tool-request] Error: ${err}`);
    return c.json({ success: false, error: `Server error: ${String(err)}` }, 500);
  }
});

// ─── Admin: list all custom tool requests ────────────────────────────────────
app.get("/make-server-e07959ec/admin/tool-requests", requireAuth, async (c) => {
  try {
    const records = await kv.getByPrefix("custom_tool_request:");
    const requests = records
      .map((r: any) => {
        try { 
          const parsed = typeof r === "string" ? JSON.parse(r) : r;
          // Normalize read field - default to false if missing (for old records)
          return { ...parsed, read: parsed.read ?? false };
        }
        catch { return null; }
      })
      .filter(Boolean)
      .sort((a: any, b: any) =>
        new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      );

    console.log(`[admin/tool-requests] Returning ${requests.length} tool requests`);
    return c.json({ success: true, data: requests });
  } catch (err) {
    console.error(`[admin/tool-requests] Error: ${err}`);
    return c.json({ success: false, error: `Server error: ${String(err)}` }, 500);
  }
});

// ─── Admin: delete a custom tool request ─────────────────────────────────────
app.delete("/make-server-e07959ec/admin/tool-requests/:id", requireAuth, async (c) => {
  try {
    const id = c.req.param("id");
    await kv.del(`custom_tool_request:${id}`);
    console.log(`[admin/tool-requests] Deleted request: ${id}`);
    return c.json({ success: true });
  } catch (err) {
    console.error(`[admin/tool-requests DELETE] Error: ${err}`);
    return c.json({ success: false, error: `Server error: ${String(err)}` }, 500);
  }
});

// ─── Admin: mark tool request(s) as read ─────────────────────────────────────
app.put("/make-server-e07959ec/admin/tool-requests/mark-read", requireAuth, async (c) => {
  try {
    const { kvKey, markAll } = await c.req.json();
    if (markAll) {
      const all: any[] = await kv.getByPrefix("custom_tool_request:");
      const unread = all.filter((r: any) => {
        const rec = typeof r === "string" ? JSON.parse(r) : r;
        // Treat missing read field as unread (for old records)
        return (rec.read ?? false) === false && rec.kvKey;
      });
      await Promise.all(
        unread.map((r: any) => {
          const rec = typeof r === "string" ? JSON.parse(r) : r;
          return kv.set(rec.kvKey, { ...rec, read: true });
        })
      );
      console.log(`[admin/tool-requests] Marked all ${unread.length} requests as read`);
    } else if (kvKey) {
      const rec = await kv.get(kvKey);
      if (rec) {
        const parsed = typeof rec === "string" ? JSON.parse(rec) : rec;
        await kv.set(kvKey, { ...parsed, read: true });
        console.log(`[admin/tool-requests] Marked ${kvKey} as read`);
      }
    }
    return c.json({ success: true });
  } catch (err) {
    console.error(`[admin/tool-requests mark-read] Error: ${err}`);
    return c.json({ success: false, error: `Server error: ${String(err)}` }, 500);
  }
});

// Tool support form (public, tool-specific email)
app.post("/make-server-e07959ec/tool-support", async (c) => {
  try {
    const body = await c.req.json();
    const { name, email, toolName, inquiryType, message } = body;

    if (!name || !email || !message || !toolName || !inquiryType) {
      return c.json({ success: false, error: "All fields are required" }, 400);
    }

    // ── Store message in KV for admin dashboard ──
    try {
      const msgTs    = Date.now();
      const msgUuid  = crypto.randomUUID().replace(/-/g, '').substring(0, 8);
      const msgKvKey = `msg:${msgTs}:support:${msgUuid}`;
      await kv.set(msgKvKey, {
        kvKey: msgKvKey,
        id: `${msgTs}-${msgUuid}`,
        type: 'support',
        name: name || '',
        email: email || '',
        toolName: toolName || '',
        inquiryType: inquiryType || '',
        message: message || '',
        read: false,
        createdAt: new Date().toISOString(),
      });
      console.log(`[tool-support] ✅ Message stored in KV: ${msgKvKey}`);
    } catch (kvErr) {
      console.error('[tool-support] ❌ KV store FAILED — message will NOT appear in dashboard:', kvErr);
    }

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!resendApiKey) {
      console.log('[tool-support] RESEND_API_KEY not configured — message saved to KV only');
      return c.json({ success: true, message: "Message sent! We'll reply within 24 hours." });
    }

    const adminEmail = await getAdminEmail();
    if (!adminEmail) {
      console.warn('[tool-support] ⚠️ contactEmail not found in site_settings — go to Admin → Settings and save your contact email. Notification skipped.');
      return c.json({ success: true, message: "Message sent! We'll reply within 24 hours." });
    }

    const resend = new Resend(resendApiKey);
    const submittedAt = new Date().toLocaleString('en-US', { dateStyle: 'full', timeStyle: 'short' });

    const emailHtml = `
      <div style="font-family:sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#e5e5e5;border-radius:12px;overflow:hidden;">
        <div style="background:linear-gradient(135deg,#0e7490,#4f46e5);padding:28px 32px;">
          <p style="margin:0 0 4px;font-size:12px;color:rgba(255,255,255,0.7);letter-spacing:0.1em;text-transform:uppercase;">Fastoosh Tools</p>
          <h1 style="margin:0;font-size:22px;color:#fff;">🛠️ New Support Request</h1>
        </div>
        <div style="padding:32px;">
          <p style="margin:0 0 24px;font-size:15px;color:#d4d4d4;line-height:1.6;">
            A customer submitted a support request for one of your tools.
          </p>
          <table style="width:100%;border-collapse:collapse;margin-bottom:28px;">
            <tr>
              <td style="padding:10px 14px;background:#1a1a1a;border-radius:6px 6px 0 0;color:#a3a3a3;font-size:13px;width:130px;">Tool</td>
              <td style="padding:10px 14px;background:#1a1a1a;border-radius:6px 6px 0 0;color:#fff;font-size:13px;font-weight:700;">${toolName}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;background:#141414;color:#a3a3a3;font-size:13px;">Inquiry Type</td>
              <td style="padding:10px 14px;background:#141414;color:#fff;font-size:13px;">${inquiryType}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;background:#1a1a1a;color:#a3a3a3;font-size:13px;">Name</td>
              <td style="padding:10px 14px;background:#1a1a1a;color:#fff;font-size:13px;">${name}</td>
            </tr>
            <tr>
              <td style="padding:10px 14px;background:#141414;border-radius:0 0 6px 6px;color:#a3a3a3;font-size:13px;">Email</td>
              <td style="padding:10px 14px;background:#141414;border-radius:0 0 6px 6px;font-size:13px;"><a href="mailto:${email}" style="color:#67e8f9;text-decoration:none;">${email}</a></td>
            </tr>
          </table>
          <p style="margin:0 0 8px;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Message</p>
          <div style="background:#111;border-left:3px solid #0e7490;padding:16px 20px;border-radius:0 6px 6px 0;">
            <p style="margin:0;font-size:14px;color:#d4d4d4;line-height:1.7;white-space:pre-wrap;">${message.replace(/\n/g, '<br>')}</p>
          </div>
          <div style="margin-top:28px;text-align:center;">
            <a href="mailto:${email}?subject=Re: ${toolName} Support — Fastoosh"
               style="display:inline-block;padding:12px 28px;background:linear-gradient(135deg,#0e7490,#4f46e5);color:#fff;text-decoration:none;border-radius:8px;font-size:14px;font-weight:600;">
              Reply to ${name}
            </a>
          </div>
          <p style="margin-top:28px;font-size:12px;color:#525252;text-align:center;">Submitted on ${submittedAt}</p>
        </div>
      </div>
    `;

    const { data, error } = await resend.emails.send({
      from: 'Fastoosh Tools <support@contact.fastoosh.com>',
      to: adminEmail,
      subject: `🛠️ [${inquiryType}] ${toolName} — ${name}`,
      html: emailHtml,
      replyTo: email,
    });

    if (error) {
      console.log(`[tool-support] Error sending admin notification: ${JSON.stringify(error)}`);
    } else {
      console.log(`[tool-support] Admin notification sent to ${adminEmail}. Resend ID: ${data?.id}`);
    }

    return c.json({ success: true, message: "Message sent! We'll reply within 24 hours." });
  } catch (error) {
    console.log(`Error in tool-support route: ${error}`);
    return c.json({ success: false, error: "An unexpected error occurred" }, 500);
  }
});

// ========== FREE TOOL DOWNLOAD LEAD CAPTURE ==========

// POST /free-download — saves lead as unverified, generates a 6-digit OTP,
// stores it in KV (10-min expiry), and emails it. The user enters the code
// directly in FreeDownloadModal; POST /free-download/verify marks the lead
// verified and returns { downloadUrl } so JS starts the download immediately.
app.post('/make-server-e07959ec/free-download', async (c) => {
  try {
    const { email, toolVersionId, toolName, toolSlug } = await c.req.json();

    if (!email || !toolVersionId) {
      return c.json({ success: false, error: 'email and toolVersionId are required' }, 400);
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return c.json({ success: false, error: 'Invalid email address' }, 400);
    }

    // Verify tool version exists and is Free
    const { data: version, error: vErr } = await supabase
      .from('tool_versions')
      .select('id, version_type, download_url')
      .eq('id', toolVersionId)
      .single();

    if (vErr || !version) {
      console.log(`[free-download] Tool version not found: ${toolVersionId}`);
      return c.json({ success: false, error: 'Tool version not found' }, 404);
    }

    if (version.version_type !== 'Free') {
      return c.json({ success: false, error: 'This endpoint is only for free tool downloads' }, 400);
    }

    if (!version.download_url) {
      console.log(`[free-download] No download_url set for version: ${toolVersionId}`);
      return c.json({ success: false, error: 'No download URL configured for this tool version' }, 400);
    }

    // ── Signed-in fast path: skip OTP, record as verified immediately ─────────
    const userToken = c.req.header('X-User-Token') || '';
    if (userToken) {
      const { data: { user: authUser }, error: authErr } = await supabase.auth.getUser(userToken);
      if (!authErr && authUser) {
        const userId    = authUser.id;
        const safeEmail = encodeURIComponent(email.toLowerCase().trim()).replace(/%/g, '_');
        const now       = new Date().toISOString();

        // Fetch tool image for the downloads list
        const { data: toolRow } = await supabase
          .from('tools')
          .select('id, image_url')
          .eq('slug', toolSlug)
          .maybeSingle();

        const leadData = {
          email:         email.toLowerCase().trim(),
          toolVersionId,
          toolName:      toolName || '',
          toolSlug:      toolSlug || '',
          requestedAt:   now,
          downloadedAt:  now,
          emailVerified: true,
          verifiedAt:    now,
          userId,
        };

        const kvKey  = `lead:free:${toolVersionId}:${safeEmail}`;
        const logKey = `lead:free:log:${Date.now()}:${safeEmail}`;
        await kv.set(kvKey,  leadData);
        await kv.set(logKey, leadData);

        // User-scoped download index (for Account page)
        const dlKey = `user:dl:${userId}:${toolVersionId}`;
        await kv.set(dlKey, {
          userId,
          toolVersionId,
          toolId:       toolRow?.id        || '',
          toolName:     toolName           || '',
          toolSlug:     toolSlug           || '',
          toolImageUrl: toolRow?.image_url || '',
          downloadUrl:  version.download_url,
          downloadedAt: now,
        });

        console.log(`[free-download] ✅ Signed-in fast path: ${email} → ${toolName}`);
        return c.json({ success: true, downloadUrl: version.download_url, skipOtp: true });
      }
    }

    // Save lead as UNVERIFIED — flipped to true only after OTP verification
    const safeEmail = encodeURIComponent(email.toLowerCase().trim()).replace(/%/g, '_');
    const kvKey     = `lead:free:${toolVersionId}:${safeEmail}`;
    const logKey    = `lead:free:log:${Date.now()}:${safeEmail}`;
    const now       = new Date().toISOString();

    const leadData = {
      email:         email.toLowerCase().trim(),
      toolVersionId,
      toolName:      toolName || '',
      toolSlug:      toolSlug || '',
      requestedAt:   now,
      downloadedAt:  now,
      emailVerified: false,
    };

    await kv.set(kvKey,  leadData);
    await kv.set(logKey, leadData);

    // 6-digit OTP — 10-minute window, max 5 verification attempts
    const otp       = String(Math.floor(100000 + Math.random() * 900000));
    const otpKey    = `otp:${toolVersionId}:${safeEmail}`;
    const expiresAt = Date.now() + 10 * 60 * 1000;

    await kv.set(otpKey, {
      code:         otp,
      expiresAt,
      attempts:     0,
      email:        email.toLowerCase().trim(),
      toolVersionId,
      toolName:     toolName || '',
      downloadUrl:  version.download_url,
      kvKey,
      logKey,
    });

    console.log(`[free-download] ⏳ OTP generated for ${email} → ${toolName}`);

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (resendKey) {
      const resend      = new Resend(resendKey);
      const year        = new Date().getFullYear();
      const name        = toolName || 'your Fastoosh tool';
      const displayCode = `${otp.slice(0, 3)} ${otp.slice(3)}`; // "XXX XXX"

      await resend.emails.send({
        from:    'Fastoosh <noreply@contact.fastoosh.com>',
        to:      email.toLowerCase().trim(),
        subject: `Your download code: ${displayCode}`,
        text:    `Your download code for ${name} is: ${otp}\n\nEnter this code in the Fastoosh website to start your download.\nThe code expires in 10 minutes.\n\nIf you didn't request this, you can safely ignore this email.\n\n— Fastoosh\nhttps://fastoosh.com`,
        html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Your download code</title>
</head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111111;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%" style="max-width:520px;" cellpadding="0" cellspacing="0">
          <tr>
            <td style="padding-bottom:32px;">
              <span style="font-size:20px;font-weight:800;letter-spacing:-0.5px;color:#111111;">Fastoosh</span>
            </td>
          </tr>
          <tr>
            <td style="border-top:2px solid #111111;padding-top:28px;">
              <p style="margin:0 0 6px;font-size:13px;color:#888888;text-transform:uppercase;letter-spacing:0.08em;">Download code</p>
              <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#111111;line-height:1.3;">${name}</h1>
              <p style="margin:0 0 24px;font-size:15px;color:#444444;line-height:1.6;">
                Enter this code in the Fastoosh website to start your download:
              </p>
              <div style="margin:0 0 28px;padding:24px;background:#f5f5f5;border-radius:10px;text-align:center;">
                <span style="font-size:42px;font-weight:800;letter-spacing:10px;color:#111111;font-variant-numeric:tabular-nums;">${displayCode}</span>
              </div>
              <p style="margin:0;font-size:12px;color:#999999;line-height:1.7;border-top:1px solid #eeeeee;padding-top:20px;">
                This code expires in 10 minutes. If you didn't request this, ignore this email — no account was created.
              </p>
            </td>
          </tr>
          <tr>
            <td style="padding-top:32px;">
              <p style="margin:0;font-size:11px;color:#bbbbbb;">© ${year} Fastoosh · <a href="https://fastoosh.com" style="color:#bbbbbb;text-decoration:none;">fastoosh.com</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      });
      console.log(`[free-download] ✉️  OTP emailed to ${email}`);
    } else {
      console.warn('[free-download] RESEND_API_KEY not set — OTP email not sent');
    }

    return c.json({ success: true });
  } catch (error) {
    console.log(`[free-download] Error: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// POST /free-download/verify — user types the 6-digit OTP from their inbox
// directly into FreeDownloadModal. Verifies the code, marks lead verified,
// returns { downloadUrl } so the React modal can start the download instantly.
app.post('/make-server-e07959ec/free-download/verify', async (c) => {
  try {
    const { email, code, toolVersionId } = await c.req.json();

    if (!email || !code || !toolVersionId) {
      return c.json({ success: false, error: 'email, code, and toolVersionId are required' }, 400);
    }

    const safeEmail = encodeURIComponent(email.toLowerCase().trim()).replace(/%/g, '_');
    const otpKey    = `otp:${toolVersionId}:${safeEmail}`;
    const entry     = await kv.get(otpKey);

    if (!entry) {
      return c.json({ success: false, error: 'Code not found. Please request a new one.' }, 404);
    }

    if (Date.now() > entry.expiresAt) {
      await kv.del(otpKey);
      return c.json({ success: false, error: 'Code expired. Please request a new one.', expired: true }, 410);
    }

    const attempts = (entry.attempts || 0) + 1;
    if (attempts > 5) {
      await kv.del(otpKey);
      return c.json({ success: false, error: 'Too many incorrect attempts. Please request a new code.', tooMany: true }, 429);
    }

    if (entry.code !== String(code).replace(/\s/g, '')) {
      await kv.set(otpKey, { ...entry, attempts });
      const remaining = 5 - attempts;
      return c.json({
        success: false,
        error: remaining > 0
          ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Too many incorrect attempts. Please request a new code.',
      }, 400);
    }

    // ✅ Correct — mark lead verified, delete OTP (single-use)
    const verifiedAt = new Date().toISOString();
    const updates    = { emailVerified: true, verifiedAt };

    const existing = await kv.get(entry.kvKey);
    if (existing) await kv.set(entry.kvKey, { ...existing, ...updates });

    const logExisting = await kv.get(entry.logKey);
    if (logExisting) await kv.set(entry.logKey, { ...logExisting, ...updates });

    await kv.del(otpKey);

    console.log(`[dl-verify] ✅ Verified: ${email} → ${entry.toolName}`);
    return c.json({ success: true, downloadUrl: entry.downloadUrl, toolName: entry.toolName || '' });
  } catch (err) {
    console.log('[dl-verify] Error:', err);
    return c.json({ success: false, error: 'Server error. Please try again.' }, 500);
  }
});

// GET /free-download/leads — admin: list all free download leads (protected)
app.get('/make-server-e07959ec/free-download/leads', requireAuth, async (c) => {
  try {
    const toolVersionId = c.req.query('toolVersionId');
    const prefix = toolVersionId
      ? `lead:free:${toolVersionId}:`
      : 'lead:free:log:';

    const leads = await kv.getByPrefix(prefix);
    return c.json({ success: true, data: leads, count: leads.length });
  } catch (error) {
    console.log(`[free-download/leads] Error: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// GET /user/downloads — authenticated user: list all free tools they have downloaded
app.get('/make-server-e07959ec/user/downloads', requireUserAuth, async (c) => {
  try {
    const user = c.get('user') as { id: string; email: string };
    const entries: any[] = await kv.getByPrefix(`user:dl:${user.id}:`);
    // Sort newest first
    entries.sort((a, b) => new Date(b.downloadedAt || 0).getTime() - new Date(a.downloadedAt || 0).getTime());
    console.log(`[user/downloads] ${user.email} → ${entries.length} download(s)`);
    return c.json({ success: true, data: entries });
  } catch (error) {
    console.log(`[user/downloads] Error: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ========== UNIFIED LEADS ENDPOINT ==========

// GET /leads — admin: all emails from every source (free downloads + signups), enriched
app.get('/make-server-e07959ec/leads', requireAuth, async (c) => {
  try {
    // ── 1. Free-download KV leads ───────────────────────────────────────────
    const kvLeads: any[] = await kv.getByPrefix('lead:free:log:');

    // Batch-enrich with tool category by joining tool_versions → tools
    const uniqueVersionIds = [...new Set(kvLeads.map((l: any) => l.toolVersionId).filter(Boolean))];
    const versionCategoryMap: Record<string, string> = {};

    if (uniqueVersionIds.length > 0) {
      const { data: versions, error: vErr } = await supabase
        .from('tool_versions')
        .select('id, tools(category)')
        .in('id', uniqueVersionIds);

      if (vErr) {
        console.log('[leads] Warning: could not enrich categories:', vErr.message);
      } else if (versions) {
        for (const v of versions) {
          versionCategoryMap[v.id] = (v as any).tools?.category || '';
        }
      }
    }

    const freeLeads = kvLeads.map((l: any) => ({
      email:         l.email || '',
      source:        'free_download',
      tier:          'Free',
      toolName:      l.toolName     || '',
      toolSlug:      l.toolSlug     || '',
      toolCategory:  versionCategoryMap[l.toolVersionId] || '',
      toolVersionId: l.toolVersionId || '',
      createdAt:     l.downloadedAt  || '',
      emailVerified: l.emailVerified === true,
      verifiedAt:    l.verifiedAt    || null,
    }));

    // ── 2. Supabase Auth registered users ───────────────────────────────────
    let signupLeads: any[] = [];
    const { data: usersData, error: usersErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });

    if (usersErr) {
      console.log('[leads] Warning: could not fetch auth users:', usersErr.message);
    } else {
      signupLeads = (usersData?.users || []).map((u: any) => ({
        email:         u.email || '',
        source:        'signup',
        tier:          'Registered',
        toolName:      '',
        toolSlug:      '',
        toolCategory:  '',
        toolVersionId: '',
        createdAt:     u.created_at || '',
        displayName:   u.user_metadata?.full_name || '',
      }));
    }

    // ── 3. Merge & sort newest-first ─────────────────────────────────────────
    const allLeads = [...freeLeads, ...signupLeads]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    console.log(`[leads] Returning ${allLeads.length} leads (${freeLeads.length} free downloads + ${signupLeads.length} signups)`);
    return c.json({ success: true, data: allLeads, count: allLeads.length });
  } catch (error) {
    console.log('[leads] Error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// GET /admin/leads/behavior?email=<email> — behavioral summary for a known lead
app.get('/make-server-e07959ec/admin/leads/behavior', requireAuth, async (c) => {
  try {
    const email = (c.req.query('email') || '').toLowerCase().trim();
    if (!email) return c.json({ success: false, error: 'email param required' }, 400);

    const allSessions: any[] = await kv.getByPrefix('session:');
    const matched = allSessions.filter((s: any) =>
      (s.userEmail || '').toLowerCase() === email
    );

    if (matched.length === 0) {
      return c.json({ success: true, data: null });
    }

    const FUNNEL_RANK: Record<string, number> = {
      visit: 0, tool_view: 1, buy_click: 2, purchase: 3,
    };

    let topFunnel     = 'visit';
    let converted     = false;
    let totalDuration = 0;
    const pagesSet    = new Set<string>();
    const toolsSet    = new Set<string>();
    let firstSeen     = matched[0].startedAt  || '';
    let lastSeen      = matched[0].lastSeenAt || '';

    for (const s of matched) {
      if (s.startedAt  && (!firstSeen || new Date(s.startedAt)  < new Date(firstSeen))) firstSeen = s.startedAt;
      if (s.lastSeenAt && (!lastSeen  || new Date(s.lastSeenAt) > new Date(lastSeen)))  lastSeen  = s.lastSeenAt;
      totalDuration += s.totalDuration || 0;
      if (s.converted) converted = true;
      if ((FUNNEL_RANK[s.funnelStage] ?? 0) > (FUNNEL_RANK[topFunnel] ?? 0)) topFunnel = s.funnelStage;
      for (const e of (s.events || [])) {
        if (e.type === 'page_view' && e.data?.path) pagesSet.add(e.data.path);
      }
      for (const t of (s.toolNamesViewed || [])) {
        if (t) toolsSet.add(t);
      }
    }

    // Most recent session for device / browser / referrer
    const recent = [...matched].sort((a: any, b: any) =>
      new Date(b.lastSeenAt || 0).getTime() - new Date(a.lastSeenAt || 0).getTime()
    )[0];

    return c.json({
      success: true,
      data: {
        sessionCount:  matched.length,
        firstSeen,
        lastSeen,
        totalDuration,
        pagesVisited:  [...pagesSet],
        toolsViewed:   [...toolsSet],
        funnelStage:   topFunnel,
        converted,
        device:        recent.device      || 'desktop',
        browser:       recent.browser     || '',
        os:            recent.os          || '',
        referrer:      recent.referrer    || '',
        utmSource:     recent.utmSource   || null,
        utmMedium:     recent.utmMedium   || null,
        utmCampaign:   recent.utmCampaign || null,
      },
    });
  } catch (error) {
    console.log('[admin/leads/behavior] Error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ========== LEMON SQUEEZY LIVE REVENUE ENDPOINT ==========

// Helper: fetch all pages from a Lemon Squeezy list endpoint
async function lsFetchAll(apiKey: string, path: string, extraParams: Record<string, string> = {}): Promise<any[]> {
  const results: any[] = [];
  let pageNumber = 1;
  const pageSize  = 100;
  while (true) {
    const params = new URLSearchParams({
      'page[size]':   String(pageSize),
      'page[number]': String(pageNumber),
      ...extraParams,
    });
    const res = await fetch(`https://api.lemonsqueezy.com/v1${path}?${params}`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept':        'application/vnd.api+json',
      },
    });
    if (!res.ok) {
      console.log(`[ls] ${path} page ${pageNumber} error ${res.status}: ${await res.text()}`);
      break;
    }
    const json = await res.json();
    const data = json.data ?? [];
    results.push(...data);
    if (data.length < pageSize) break;
    pageNumber++;
  }
  return results;
}

// GET /ls/variants — admin: fetch all LS products with their variants for the import picker
app.get('/make-server-e07959ec/ls/variants', requireAuth, async (c) => {
  try {
    // Check which mode the admin wants: test or production
    const mode = c.req.query('mode') || 'production';
    const envKey = mode === 'test' ? 'LEMON_SQUEEZY_API_KEY_TEST' : 'LEMON_SQUEEZY_API_KEY';
    const apiKey = Deno.env.get(envKey);
    
    if (!apiKey) {
      return c.json({ 
        success: false, 
        error: `${envKey} is not configured. Please set it in Supabase Edge Function settings.` 
      }, 500);
    }
    
    console.log(`[ls/variants] Fetching products/variants using ${mode} mode (${envKey})`);

    // Fetch store info to get the store slug for constructing checkout URLs
    const storeRes = await fetch('https://api.lemonsqueezy.com/v1/stores', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/vnd.api+json',
      },
    });
    
    let storeSlug = '';
    if (storeRes.ok) {
      const storeData = await storeRes.json();
      const firstStore = storeData.data?.[0];
      storeSlug = firstStore?.attributes?.slug ?? '';
      console.log(`[ls/variants] Found store slug: ${storeSlug}`);
    } else {
      console.log(`[ls/variants] Failed to fetch store info: ${storeRes.status}`);
    }

    const [rawProducts, rawVariants] = await Promise.all([
      lsFetchAll(apiKey, '/products'),
      lsFetchAll(apiKey, '/variants'),
    ]);

    // Group variants by product_id
    // Build product UUID map for constructing per-variant checkout URLs
    const productBuyUrls: Record<string, string> = {};
    for (const p of rawProducts as any[]) {
      const url: string = p.attributes?.buy_now_url || '';
      if (url) productBuyUrls[String(p.id)] = url;
    }

    const variantsByProduct: Record<string, any[]> = {};
    for (const v of rawVariants as any[]) {
      const pid = String(v.attributes?.product_id ?? '');
      if (!variantsByProduct[pid]) variantsByProduct[pid] = [];

      const variantId = String(v.id);
      // Build per-variant checkout URL: product UUID + ?enabled=variant_numeric_id
      // This pre-selects the exact variant on the LS checkout page.
      const productUrl = productBuyUrls[pid] || '';
      let buyNowUrl = '';
      if (productUrl) {
        const base = productUrl.includes('/checkout/buy/')
          ? productUrl
          : productUrl.replace('/buy/', '/checkout/buy/');
        buyNowUrl = `${base}?enabled=${variantId}`;
      }
      variantsByProduct[pid].push({
        id:             variantId,
        name:           v.attributes?.name ?? '',
        price:          v.attributes?.price ?? 0,
        interval:       v.attributes?.interval ?? null,
        isSubscription: !!v.attributes?.is_subscription,
        buyNowUrl,
        status:         v.attributes?.status ?? 'pending',
      });
    }

    const products = (rawProducts as any[]).map(p => ({
      id:       String(p.id),
      name:     p.attributes?.name ?? '',
      variants: (variantsByProduct[String(p.id)] ?? [])
        .sort((a: any, b: any) => {
          // sort: monthly → yearly → one-time, then by price asc
          const order = (v: any) => v.interval === 'month' ? 0 : v.interval === 'year' ? 1 : 2;
          return order(a) - order(b) || a.price - b.price;
        }),
    }));

    console.log(`[ls/variants] ${products.length} products, ${rawVariants.length} total variants`);
    return c.json({ success: true, products });
  } catch (error) {
    console.log(`[ls/variants] Error: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// GET /admin/ls-revenue — live revenue data pulled directly from Lemon Squeezy API
app.get('/make-server-e07959ec/admin/ls-revenue', requireAuth, async (c) => {
  try {
    // Check which mode the admin wants: test or production
    const mode = c.req.query('mode') || 'production';
    const envKey = mode === 'test' ? 'LEMON_SQUEEZY_API_KEY_TEST' : 'LEMON_SQUEEZY_API_KEY';
    const apiKey = Deno.env.get(envKey);
    
    if (!apiKey) {
      return c.json({ 
        success: false, 
        error: `${envKey} is not configured. Please set it in Supabase Edge Function settings.` 
      }, 500);
    }

    console.log(`[ls-revenue] Fetching orders using ${mode} mode (${envKey})`);
    const orders = await lsFetchAll(apiKey, '/orders');
    console.log(`[ls-revenue] Fetched ${orders.length} orders from Lemon Squeezy (${mode} mode)`);

    const now            = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000);
    const todayStr       = now.toISOString().split('T')[0];

    const paidOrders     = orders.filter((o: any) => ['paid', 'partial_refund'].includes(o.attributes?.status));
    const refundedOrders = orders.filter((o: any) => ['refunded', 'partial_refund'].includes(o.attributes?.status));

    const toUSD = (cents: number) => parseFloat((cents / 100).toFixed(2));
    const sumCents = (arr: any[]) => arr.reduce((s: number, o: any) => s + (o.attributes?.total_usd ?? o.attributes?.total ?? 0), 0);

    const totalRevenue  = sumCents(paidOrders);
    const totalRefunded = sumCents(refundedOrders);
    const revenue30d    = sumCents(paidOrders.filter((o: any) => new Date(o.attributes?.created_at || 0) >= thirtyDaysAgo));
    const revenue7d     = sumCents(paidOrders.filter((o: any) => new Date(o.attributes?.created_at || 0) >= sevenDaysAgo));
    const revenueToday  = sumCents(paidOrders.filter((o: any) => (o.attributes?.created_at || '').startsWith(todayStr)));

    // By status
    const statusMap: Record<string, { count: number; total: number }> = {};
    for (const o of orders as any[]) {
      const st = o.attributes?.status || 'unknown';
      if (!statusMap[st]) statusMap[st] = { count: 0, total: 0 };
      statusMap[st].count++;
      statusMap[st].total += o.attributes?.total_usd ?? o.attributes?.total ?? 0;
    }
    const byStatus = Object.entries(statusMap)
      .map(([status, v]) => ({ status, count: v.count, total: toUSD(v.total) }))
      .sort((a, b) => b.total - a.total);

    // By product
    const productMap: Record<string, { name: string; revenue: number; sales: number }> = {};
    for (const o of paidOrders as any[]) {
      const name = o.attributes?.first_order_item?.product_name || 'Unknown';
      if (!productMap[name]) productMap[name] = { name, revenue: 0, sales: 0 };
      productMap[name].revenue += o.attributes?.total_usd ?? o.attributes?.total ?? 0;
      productMap[name].sales++;
    }
    const byProduct = Object.values(productMap)
      .sort((a, b) => b.revenue - a.revenue)
      .map(p => ({ ...p, revenue: toUSD(p.revenue) }));

    // By variant / tier
    const variantMap: Record<string, { name: string; revenue: number; sales: number }> = {};
    for (const o of paidOrders as any[]) {
      const name = o.attributes?.first_order_item?.variant_name || 'Unknown';
      if (!variantMap[name]) variantMap[name] = { name, revenue: 0, sales: 0 };
      variantMap[name].revenue += o.attributes?.total_usd ?? o.attributes?.total ?? 0;
      variantMap[name].sales++;
    }
    const byVariant = Object.values(variantMap)
      .sort((a, b) => b.revenue - a.revenue)
      .map(v => ({ ...v, revenue: toUSD(v.revenue) }));

    // Daily series — last 30 days
    const seriesMap: Record<string, { revenue: number; sales: number; refunds: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      seriesMap[d.toISOString().split('T')[0]] = { revenue: 0, sales: 0, refunds: 0 };
    }
    for (const o of orders as any[]) {
      const dateStr = (o.attributes?.created_at || '').split('T')[0];
      if (!seriesMap[dateStr]) continue;
      const cents = o.attributes?.total_usd ?? o.attributes?.total ?? 0;
      if (['paid', 'partial_refund'].includes(o.attributes?.status)) {
        seriesMap[dateStr].revenue += cents;
        seriesMap[dateStr].sales++;
      }
      if (['refunded', 'partial_refund'].includes(o.attributes?.status)) {
        seriesMap[dateStr].refunds++;
      }
    }
    const series = Object.entries(seriesMap).map(([date, v]) => ({
      date,
      revenue: toUSD(v.revenue),
      sales:   v.sales,
      refunds: v.refunds,
    }));

    // Recent orders
    const recentOrders = [...orders as any[]]
      .sort((a, b) => new Date(b.attributes?.created_at || 0).getTime() - new Date(a.attributes?.created_at || 0).getTime())
      .slice(0, 20)
      .map((o: any) => ({
        id:          o.id,
        orderNumber: o.attributes?.order_number,
        status:      o.attributes?.status,
        email:       o.attributes?.user_email || '',
        productName: o.attributes?.first_order_item?.product_name || '',
        variantName: o.attributes?.first_order_item?.variant_name || '',
        total:       toUSD(o.attributes?.total_usd ?? o.attributes?.total ?? 0),
        currency:    o.attributes?.currency || 'USD',
        createdAt:   o.attributes?.created_at || '',
        refundedAt:  o.attributes?.refunded_at || null,
        lsUrl:       `https://app.lemonsqueezy.com/orders/${o.id}`,
      }));

    return c.json({
      success: true,
      data: {
        summary: {
          totalOrders:    orders.length,
          paidOrders:     paidOrders.length,
          refundedOrders: refundedOrders.length,
          totalRevenue:   toUSD(totalRevenue),
          totalRefunded:  toUSD(totalRefunded),
          netRevenue:     toUSD(totalRevenue - totalRefunded),
          revenue30d:     toUSD(revenue30d),
          revenue7d:      toUSD(revenue7d),
          revenueToday:   toUSD(revenueToday),
        },
        byStatus,
        byProduct,
        byVariant,
        series,
        recentOrders,
      },
    });
  } catch (error) {
    console.log('[admin/ls-revenue] Error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ========== BEHAVIOR TRACKING ENDPOINTS ==========

// POST /track/event — public, no auth. Called by frontend to record user behavior.
app.post('/make-server-e07959ec/track/event', async (c) => {
  try {
    const body = await c.req.json();
    const { sessionId, events, meta } = body;
    if (!sessionId || !Array.isArray(events)) {
      return c.json({ success: false, error: 'sessionId and events[] required' }, 400);
    }

    // ── Country detection via IP geolocation ─────────────────────────────────
    // CF-IPCountry is only injected inside Cloudflare *Workers* — NOT in
    // Supabase Edge Functions, which run on Deno Deploy (Fly.io).
    // cf-connecting-ip IS forwarded (it's the real client IP from CF's proxy),
    // so we use that as input to a free, no-key geolocation API instead.
    const clientIp = (
      c.req.header('cf-connecting-ip') ||
      c.req.header('x-real-ip') ||
      (c.req.header('x-forwarded-for') ?? '').split(',')[0].trim() ||
      ''
    ).trim();

    let country = 'Unknown';
    if (clientIp && clientIp !== '::1' && !clientIp.startsWith('127.')) {
      try {
        const geoRes = await fetch(`https://api.country.is/${clientIp}`, {
          signal: AbortSignal.timeout(1500),
        });
        if (geoRes.ok) {
          const geo = await geoRes.json() as { ip: string; country: string };
          const cc  = (geo.country || '').toUpperCase();
          if (cc && cc !== 'XX' && cc !== 'T1') country = cc;
        }
      } catch {
        // geo API timeout or unavailable — 'Unknown' is acceptable
      }
    }

    console.log(`[track/event] sid=${sessionId} events=${events.length} country=${country} utmSource=${meta?.utmSource ?? 'null'} utmMedium=${meta?.utmMedium ?? 'null'} utmCampaign=${meta?.utmCampaign ?? 'null'}`);

    let session: any = await kv.get(`session:${sessionId}`);
    if (!session) {
      session = {
        sessionId,
        startedAt:   new Date().toISOString(),
        events:      [],
        device:      meta?.device      || 'desktop',
        browser:     meta?.browser     || 'Other',
        os:          meta?.os          || 'Other',
        referrer:    meta?.referrer    || '',
        screenWidth: meta?.screenWidth || null,
        language:    meta?.language    || null,
        utmSource:   meta?.utmSource   || null,
        utmMedium:   meta?.utmMedium   || null,
        utmCampaign: meta?.utmCampaign || null,
        country,
      };
      console.log(`[track/event] NEW session created utmSource=${session.utmSource} country=${session.country}`);
    }

    if (meta?.userId    && !session.userId)    session.userId    = meta.userId;
    if (meta?.userEmail && !session.userEmail) session.userEmail = meta.userEmail;

    // Backfill UTM if this session was created before UTM params arrived
    // (e.g. first flush was the beforeunload beacon which lacked UTM)
    if (meta?.utmSource   && !session.utmSource)   session.utmSource   = meta.utmSource;
    if (meta?.utmMedium   && !session.utmMedium)   session.utmMedium   = meta.utmMedium;
    if (meta?.utmCampaign && !session.utmCampaign) session.utmCampaign = meta.utmCampaign;

    // Backfill country for sessions created before geo was fixed (stored 'Unknown')
    if ((!session.country || session.country === 'Unknown') && country !== 'Unknown') {
      session.country = country;
    }

    const all: any[] = [...(session.events || []), ...events];
    session.events     = all.slice(-500);
    session.lastSeenAt = new Date().toISOString();

    const evs: any[]  = session.events;
    const pageViews    = evs.filter((e: any) => e.type === 'page_view');
    const pageExits    = evs.filter((e: any) => e.type === 'page_exit');
    const toolViews    = evs.filter((e: any) => e.type === 'tool_view');
    const buyClicks    = evs.filter((e: any) => e.type === 'buy_click');
    const videoPlays   = evs.filter((e: any) => e.type === 'video_play');
    const purchases    = evs.filter((e: any) => e.type === 'purchase_complete');
    const freeDownloads = evs.filter((e: any) => e.type === 'free_download');

    session.pageCount        = pageViews.length;
    session.totalDuration    = pageExits.reduce((s: number, e: any) => s + (e.data?.duration || 0), 0);
    session.toolsViewed      = [...new Set(toolViews.map((e: any) => e.data?.toolSlug).filter(Boolean))];
    session.toolNamesViewed  = [...new Set(toolViews.map((e: any) => e.data?.toolName).filter(Boolean))];
    session.buyClickCount    = buyClicks.length;
    session.videoPlayCount   = videoPlays.length;
    session.downloadCount    = freeDownloads.length;
    session.toolsDownloaded  = [...new Set(freeDownloads.map((e: any) => e.data?.toolSlug).filter(Boolean))];
    session.converted        = purchases.length > 0;
    session.isBounce         = session.pageCount <= 1 && session.totalDuration < 30;
    session.lastPath         = pageViews.at(-1)?.data?.path || '';

    if (purchases.length > 0)        session.funnelStage = 'purchase';
    else if (freeDownloads.length > 0) session.funnelStage = 'free_download';
    else if (buyClicks.length > 0)   session.funnelStage = 'buy_click';
    else if (toolViews.length > 0)   session.funnelStage = 'tool_view';
    else                             session.funnelStage = 'visit';

    await kv.set(`session:${sessionId}`, session);
    return c.json({ success: true });
  } catch (error) {
    console.log('[track/event] Error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// GET /admin/behavior — admin auth. Paginated sessions + funnel analytics.
app.get('/make-server-e07959ec/admin/behavior', requireAuth, async (c) => {
  try {
    const { from, to, device, stage, converted, tool, page = '1', limit = '25' } = c.req.query();

    const allSessions: any[] = await kv.getByPrefix('session:');
    let sessions = [...allSessions];

    if (from) { const d = new Date(from); sessions = sessions.filter((s: any) => new Date(s.startedAt) >= d); }
    if (to)   { const d = new Date(to); d.setHours(23,59,59,999); sessions = sessions.filter((s: any) => new Date(s.startedAt) <= d); }
    if (device && device !== 'all')    sessions = sessions.filter((s: any) => (s.device || 'desktop') === device);
    if (stage  && stage  !== 'all')    sessions = sessions.filter((s: any) => s.funnelStage === stage);
    if (converted === 'true')          sessions = sessions.filter((s: any) => s.converted);
    if (converted === 'false')         sessions = sessions.filter((s: any) => !s.converted);
    if (tool) sessions = sessions.filter((s: any) => (s.toolsViewed || []).includes(tool));

    sessions.sort((a: any, b: any) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    const fVisits       = sessions.filter((s: any) => (s.pageCount || 0) > 0).length;
    const fToolViews    = sessions.filter((s: any) => (s.toolsViewed?.length || 0) > 0).length;
    const fBuyClicks    = sessions.filter((s: any) => (s.buyClickCount || 0) > 0).length;
    const fDownloads    = sessions.filter((s: any) => (s.downloadCount || 0) > 0).length;
    const fPurchases    = sessions.filter((s: any) => s.converted).length;
    const pct = (n: number) => fVisits > 0 ? Math.round((n / fVisits) * 1000) / 10 : 0;

    const funnel = [
      { stage: 'visit',         label: 'Page Visits',    count: fVisits,    pct: 100,             dropOff: 0 },
      { stage: 'tool_view',     label: 'Tool Views',     count: fToolViews, pct: pct(fToolViews), dropOff: fVisits    - fToolViews },
      { stage: 'buy_click',     label: 'Buy Clicks',     count: fBuyClicks, pct: pct(fBuyClicks), dropOff: fToolViews - fBuyClicks },
      { stage: 'free_download', label: 'Free Downloads', count: fDownloads, pct: pct(fDownloads), dropOff: fToolViews - fDownloads },
      { stage: 'purchase',      label: 'Purchases',      count: fPurchases, pct: pct(fPurchases), dropOff: fBuyClicks - fPurchases },
    ];

    const pageMap: Record<string, { count: number; totalDuration: number }> = {};
    for (const s of sessions) {
      for (const e of (s.events || []) as any[]) {
        if (e.type === 'page_view' && e.data?.path) {
          const p = e.data.path;
          if (!pageMap[p]) pageMap[p] = { count: 0, totalDuration: 0 };
          pageMap[p].count++;
        }
        if (e.type === 'page_exit' && e.data?.path) {
          const p = e.data.path;
          if (!pageMap[p]) pageMap[p] = { count: 0, totalDuration: 0 };
          pageMap[p].totalDuration += e.data.duration || 0;
        }
      }
    }
    const topPages = Object.entries(pageMap)
      .sort(([, a], [, b]) => b.count - a.count).slice(0, 12)
      .map(([path, v]) => ({ path, count: v.count, avgDuration: v.count > 0 ? Math.round(v.totalDuration / v.count) : 0 }));

    const toolMap: Record<string, { slug: string; name: string; views: number; buyClicks: number; videoPlays: number; downloads: number }> = {};
    for (const s of sessions) {
      for (const e of (s.events || []) as any[]) {
        const sl = e.data?.toolSlug;
        if (!sl) continue;
        if (!toolMap[sl]) toolMap[sl] = { slug: sl, name: e.data?.toolName || sl, views: 0, buyClicks: 0, videoPlays: 0, downloads: 0 };
        if (e.type === 'tool_view')    toolMap[sl].views++;
        if (e.type === 'buy_click')    toolMap[sl].buyClicks++;
        if (e.type === 'video_play')   toolMap[sl].videoPlays++;
        if (e.type === 'free_download') toolMap[sl].downloads++;
      }
    }
    const toolFunnel = Object.values(toolMap)
      .sort((a, b) => b.views - a.views)
      .map(t => ({ ...t, convRate: t.views > 0 ? Math.round((t.buyClicks / t.views) * 100) : 0 }));

    const deviceMap: Record<string, number> = {};
    for (const s of sessions) { const d = s.device || 'desktop'; deviceMap[d] = (deviceMap[d] || 0) + 1; }

    const now = new Date();
    const seriesMap: Record<string, { sessions: number; toolViews: number; buyClicks: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      seriesMap[d.toISOString().split('T')[0]] = { sessions: 0, toolViews: 0, buyClicks: 0 };
    }
    for (const s of sessions) {
      const ds = (s.startedAt || '').split('T')[0];
      if (!seriesMap[ds]) continue;
      seriesMap[ds].sessions++;
      if ((s.toolsViewed?.length || 0) > 0) seriesMap[ds].toolViews++;
      if ((s.buyClickCount || 0) > 0)       seriesMap[ds].buyClicks++;
    }
    const dailySeries = Object.entries(seriesMap).map(([date, v]) => ({ date, ...v }));

    const totalDur = sessions.reduce((s: number, sess: any) => s + (sess.totalDuration || 0), 0);
    const bounces  = sessions.filter((s: any) => s.isBounce).length;
    const summary  = {
      totalSessions: sessions.length,
      bounceRate:    sessions.length > 0 ? Math.round((bounces / sessions.length) * 100) : 0,
      avgPageViews:  sessions.length > 0 ? +(sessions.reduce((s: number, sess: any) => s + (sess.pageCount || 0), 0) / sessions.length).toFixed(1) : 0,
      avgDuration:   sessions.length > 0 ? Math.round(totalDur / sessions.length) : 0,
      convRate:      sessions.length > 0 ? Math.round((fBuyClicks / sessions.length) * 100) : 0,
    };

    const pageNum  = Math.max(1, parseInt(page,  10));
    const limitNum = Math.max(1, parseInt(limit, 10));
    const total    = sessions.length;
    const paged    = sessions
      .slice((pageNum - 1) * limitNum, pageNum * limitNum)
      .map((s: any) => ({
        sessionId:       s.sessionId,
        userId:          s.userId          || null,
        userEmail:       s.userEmail       || null,
        startedAt:       s.startedAt,
        lastSeenAt:      s.lastSeenAt      || s.startedAt,
        device:          s.device          || 'desktop',
        browser:         s.browser         || 'Other',
        os:              s.os              || 'Other',
        referrer:        s.referrer        || '',
        utmSource:       s.utmSource       || null,
        utmMedium:       s.utmMedium       || null,
        utmCampaign:     s.utmCampaign     || null,
        pageCount:       s.pageCount       || 0,
        totalDuration:   s.totalDuration   || 0,
        toolsViewed:     s.toolsViewed     || [],
        toolNamesViewed: s.toolNamesViewed || [],
        buyClickCount:   s.buyClickCount   || 0,
        videoPlayCount:  s.videoPlayCount  || 0,
        converted:       s.converted       || false,
        isBounce:        s.isBounce        || false,
        lastPath:        s.lastPath        || '',
        funnelStage:     s.funnelStage     || 'visit',
        eventCount:      (s.events || []).length,
      }));

    return c.json({
      success: true,
      data: { total, page: pageNum, limit: limitNum, sessions: paged, funnel, topPages, toolFunnel, dailySeries, deviceBreakdown: Object.entries(deviceMap).map(([device, count]) => ({ device, count })), summary },
    });
  } catch (error) {
    console.log('[admin/behavior] Error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ── Source classification ──────────────────────────────────────────────────────
function classifySource(referrer: string, utmSource?: string | null, utmMedium?: string | null): string {
  const utm    = (utmSource || '').toLowerCase().trim();
  const ref    = (referrer  || '').toLowerCase().trim();
  const medium = (utmMedium || '').toLowerCase().trim();
  if (utm) {
    if (utm.includes('linkedin'))                                           return 'LinkedIn';
    if (utm.includes('youtube') || utm === 'yt')                           return 'YouTube';
    if (utm.includes('twitter') || utm === 'x' || utm.includes('tweet'))   return 'X / Twitter';
    if (utm.includes('instagram') || utm === 'ig')                         return 'Instagram';
    if (utm.includes('tiktok'))                                             return 'TikTok';
    if (utm.includes('facebook') || utm === 'fb')                          return 'Facebook';
    if (utm.includes('discord'))                                            return 'Discord';
    if (utm.includes('email') || utm.includes('newsletter') || medium === 'email' || medium === 'newsletter') return 'Email / Newsletter';
    if (utm.includes('google') || medium === 'cpc' || medium === 'ppc')    return 'Google';
    return utm.charAt(0).toUpperCase() + utm.slice(1);
  }
  if (!ref) return 'Direct / DM';
  if (ref.includes('linkedin.com'))                              return 'LinkedIn';
  if (ref.includes('youtube.com') || ref.includes('youtu.be'))  return 'YouTube';
  if (ref.includes('twitter.com') || ref.includes('x.com') || ref.includes('t.co')) return 'X / Twitter';
  if (ref.includes('instagram.com'))                             return 'Instagram';
  if (ref.includes('tiktok.com'))                                return 'TikTok';
  if (ref.includes('facebook.com') || ref.includes('fb.com'))   return 'Facebook';
  if (ref.includes('discord.com')  || ref.includes('discord.gg')) return 'Discord';
  if (ref.includes('google.'))                                   return 'Google';
  if (medium === 'email' || medium === 'newsletter')             return 'Email / Newsletter';
  try { return new URL(referrer).hostname.replace(/^www\./, ''); } catch { return 'Other'; }
}

// GET /admin/referrers — backlink / traffic-source analytics
app.get('/make-server-e07959ec/admin/referrers', requireAuth, async (c) => {
  try {
    const { from, to } = c.req.query();
    let allSessions: any[] = await kv.getByPrefix('session:');
    if (from) { const d = new Date(from); allSessions = allSessions.filter((s: any) => new Date(s.startedAt) >= d); }
    if (to)   { const d = new Date(to); d.setHours(23, 59, 59, 999); allSessions = allSessions.filter((s: any) => new Date(s.startedAt) <= d); }

    type SD = { sessions: number; converted: number; buyClicks: number; bounces: number; totalDuration: number; pageVisits: Record<string, number> };
    const sourceMap: Record<string, SD> = {};

    for (const s of allSessions) {
      const src = classifySource(s.referrer || '', s.utmSource, s.utmMedium);
      if (!sourceMap[src]) sourceMap[src] = { sessions: 0, converted: 0, buyClicks: 0, bounces: 0, totalDuration: 0, pageVisits: {} };
      const sd = sourceMap[src];
      sd.sessions++;
      if (s.converted)                sd.converted++;
      if ((s.buyClickCount || 0) > 0) sd.buyClicks++;
      if (s.isBounce)                 sd.bounces++;
      sd.totalDuration += s.totalDuration || 0;
      for (const e of (s.events || []) as any[]) {
        if (e.type === 'page_view' && e.data?.path) {
          const p = e.data.path;
          sd.pageVisits[p] = (sd.pageVisits[p] || 0) + 1;
        }
      }
    }

    const sources = Object.entries(sourceMap)
      .map(([name, d]) => ({
        name, sessions: d.sessions, converted: d.converted, buyClicks: d.buyClicks, bounces: d.bounces,
        convRate:    d.sessions > 0 ? +(d.converted / d.sessions * 100).toFixed(1) : 0,
        bounceRate:  d.sessions > 0 ? Math.round(d.bounces / d.sessions * 100) : 0,
        avgDuration: d.sessions > 0 ? Math.round(d.totalDuration / d.sessions) : 0,
        topPages:    Object.entries(d.pageVisits).sort(([, a], [, b]) => b - a).slice(0, 5).map(([page, count]) => ({ page, count })),
      }))
      .sort((a, b) => b.sessions - a.sessions);

    const topNames = sources.slice(0, 6).map(s => s.name);
    const now = new Date();
    const dailyMap: Record<string, Record<string, number>> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now); d.setDate(d.getDate() - i);
      const ds = d.toISOString().split('T')[0];
      dailyMap[ds] = {};
      for (const src of topNames) dailyMap[ds][src] = 0;
    }
    for (const s of allSessions) {
      const ds  = (s.startedAt || '').split('T')[0];
      const src = classifySource(s.referrer || '', s.utmSource, s.utmMedium);
      if (dailyMap[ds] && topNames.includes(src)) dailyMap[ds][src] = (dailyMap[ds][src] || 0) + 1;
    }
    const dailySeries = Object.entries(dailyMap).map(([date, vals]) => ({ date, ...vals }));

    const pageSourceMap: Record<string, Record<string, number>> = {};
    for (const s of allSessions) {
      const src = classifySource(s.referrer || '', s.utmSource, s.utmMedium);
      for (const e of (s.events || []) as any[]) {
        if (e.type === 'page_view' && e.data?.path) {
          const p = e.data.path;
          if (!pageSourceMap[p]) pageSourceMap[p] = {};
          pageSourceMap[p][src] = (pageSourceMap[p][src] || 0) + 1;
        }
      }
    }
    const pageBreakdown = Object.entries(pageSourceMap)
      .map(([page, srcs]) => ({ page, total: Object.values(srcs).reduce((a, b) => a + b, 0), sources: srcs }))
      .sort((a, b) => b.total - a.total).slice(0, 15);

    // ── Country breakdown ──────────────────────────────────────────────────
    const countryMap: Record<string, { sessions: number; converted: number }> = {};
    for (const s of allSessions) {
      const cc = (s.country || 'Unknown').toUpperCase();
      if (!countryMap[cc]) countryMap[cc] = { sessions: 0, converted: 0 };
      countryMap[cc].sessions++;
      if (s.converted) countryMap[cc].converted++;
    }
    const byCountry = Object.entries(countryMap)
      .map(([code, d]) => ({ code, sessions: d.sessions, converted: d.converted }))
      .sort((a, b) => b.sessions - a.sessions)
      .slice(0, 30);

    return c.json({ success: true, data: { sources, dailySeries, pageBreakdown, topSourceNames: topNames, total: allSessions.length, byCountry } });
  } catch (error) {
    console.log('[admin/referrers] Error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// GET /admin/behavior/session/:sid — full session detail with all events
app.get('/make-server-e07959ec/admin/behavior/session/:sid', requireAuth, async (c) => {
  try {
    const { sid } = c.req.param();
    const session = await kv.get(`session:${sid}`);
    if (!session) return c.json({ success: false, error: 'Session not found' }, 404);
    return c.json({ success: true, data: session });
  } catch (error) {
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// GET /admin/behavior/heatmap?path=<path> — aggregate click coords + scroll depth for a page
app.get('/make-server-e07959ec/admin/behavior/heatmap', requireAuth, async (c) => {
  try {
    const { path: pagePath } = c.req.query();
    const allSessions: any[] = await kv.getByPrefix('session:');

    const clicks: Array<{ x: number; y: number }> = [];
    const pathSet = new Set<string>();

    // Scroll depth: sessions that visited this page and how far they scrolled
    const scrollTotals: Record<string, number> = { '25': 0, '50': 0, '75': 0, '100': 0 };
    let scrollVisitors = 0;

    for (const s of allSessions) {
      const evs: any[] = s.events || [];
      let visitedPage = false;

      for (const e of evs) {
        const ePath: string | undefined = e.data?.path;

        // Collect all visited paths for the dropdown (page_view, scroll_depth, click_map)
        if (ePath && (e.type === 'page_view' || e.type === 'scroll_depth' || e.type === 'click_map')) {
          pathSet.add(ePath);
        }

        // Click heatmap — sampled batches
        if (e.type === 'click_map' && ePath) {
          if (pagePath && ePath === pagePath && Array.isArray(e.data.clicks)) {
            for (const pt of e.data.clicks) {
              if (typeof pt.x === 'number' && typeof pt.y === 'number') clicks.push(pt);
            }
          }
        }

        // Scroll depth for selected page
        if (e.type === 'page_view' && ePath === pagePath) visitedPage = true;
        if (pagePath && e.type === 'scroll_depth' && ePath === pagePath) {
          const pct = String(e.data.percent);
          if (scrollTotals[pct] !== undefined) scrollTotals[pct]++;
        }
      }
      if (visitedPage && pagePath) scrollVisitors++;
    }

    const scrollDepth = Object.entries(scrollTotals).map(([percent, count]) => ({
      percent: parseInt(percent),
      count,
      pct: scrollVisitors > 0 ? Math.round((count / scrollVisitors) * 100) : 0,
    }));

    return c.json({
      success: true,
      data: {
        clicks,
        totalClicks: clicks.length,
        scrollDepth,
        scrollVisitors,
        availablePaths: [...pathSet].sort(),
      },
    });
  } catch (error) {
    console.log('[admin/behavior/heatmap] Error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ========== ADMIN MESSAGES ENDPOINTS ==========

// GET /admin/messages — all stored contact + support messages
app.get('/make-server-e07959ec/admin/messages', requireAuth, async (c) => {
  try {
    const all: any[] = await kv.getByPrefix('msg:');
    console.log(`[admin/messages] getByPrefix('msg:') returned ${all.length} record(s)`);
    // Normalize read field for old messages that might not have it
    const normalized = all.map((m: any) => ({ ...m, read: m.read ?? false }));
    const sorted = normalized.sort((a: any, b: any) =>
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    const unread = sorted.filter((m: any) => !m.read).length;
    console.log(`[admin/messages] Returning ${sorted.length} messages, ${unread} unread`);
    return c.json({ success: true, data: sorted, unread, count: sorted.length });
  } catch (error) {
    console.error('[admin/messages] Error fetching messages:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// PUT /admin/messages/mark-read — mark one or all messages as read
app.put('/make-server-e07959ec/admin/messages/mark-read', requireAuth, async (c) => {
  try {
    const { kvKey, markAll } = await c.req.json();
    if (markAll) {
      const all: any[] = await kv.getByPrefix('msg:');
      // Treat missing read field as unread (for old records)
      await Promise.all(
        all.filter((m: any) => (m.read ?? false) === false && m.kvKey)
           .map((m: any) => kv.set(m.kvKey, { ...m, read: true }))
      );
      console.log(`[admin/messages] Marked all ${all.length} messages as read`);
    } else if (kvKey) {
      const msg = await kv.get(kvKey);
      if (msg) {
        await kv.set(kvKey, { ...msg, read: true });
        console.log(`[admin/messages] Marked ${kvKey} as read`);
      }
    }
    return c.json({ success: true });
  } catch (error) {
    console.log('[admin/messages/mark-read] Error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// DELETE /admin/messages/:kvKey — delete a single message
app.delete('/make-server-e07959ec/admin/messages/delete', requireAuth, async (c) => {
  try {
    const { kvKey } = await c.req.json();
    if (kvKey) {
      await kv.del(kvKey);
      console.log(`[admin/messages] Deleted message: ${kvKey}`);
    }
    return c.json({ success: true });
  } catch (error) {
    console.log('[admin/messages/delete] Error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ========== ADMIN DASHBOARD ENDPOINT ==========

// GET /admin/dashboard — aggregated stats for the admin dashboard
app.get('/make-server-e07959ec/admin/dashboard', requireAuth, async (c) => {
  try {
    // Fetch all data sources in parallel
    const [
      toolsRes,
      projectsRes,
      purchasesRes,
      kvLeads,
      messages,
      toolRequestsRaw,
    ] = await Promise.all([
      supabase.from('tools').select('id, name, category, slug'),
      supabase.from('projects').select('id, title, category, created_at'),
      supabase
        .from('user_purchases')
        .select('id, amount, currency, status, product_name, variant_name, purchased_at, lemon_squeezy_order_id')
        .order('purchased_at', { ascending: false }),
      kv.getByPrefix('lead:free:log:'),
      kv.getByPrefix('msg:'),
      kv.getByPrefix('custom_tool_request:'),
    ]);

    const tools     = toolsRes.data     || [];
    const projects  = projectsRes.data  || [];
    const purchases = purchasesRes.data || [];

    // Normalize read field for messages (contact + support) - default to false if missing
    const messagesNormalized = (messages as any[]).map((m: any) => ({ 
      ...m, 
      read: m.read ?? false 
    }));

    // Parse tool requests (some may be legacy JSON strings) and normalize read field
    const toolRequestsParsed = (toolRequestsRaw as any[]).map((r: any) => {
      try { 
        const parsed = typeof r === 'string' ? JSON.parse(r) : r;
        // Normalize read field - default to false if missing (for old records)
        return { ...parsed, read: parsed.read ?? false };
      } catch { return null; }
    }).filter(Boolean);

    if (purchasesRes.error) {
      console.log('[admin/dashboard] Warning fetching purchases:', purchasesRes.error.message);
    }

    // Fetch registered users
    let signupUsers: any[] = [];
    const { data: usersData } = await supabase.auth.admin.listUsers({ perPage: 1000 });
    signupUsers = usersData?.users || [];

    // ── Revenue calculations ──────────────────────────────────────────────────
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sevenDaysAgo  = new Date(now.getTime() -  7 * 24 * 60 * 60 * 1000);

    const activePurchases   = purchases.filter((p: any) => p.status !== 'refunded');
    const refundedPurchases = purchases.filter((p: any) => p.status === 'refunded');

    const totalRevenue  = activePurchases.reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);
    const revenue30d    = activePurchases
      .filter((p: any) => new Date(p.purchased_at || 0) >= thirtyDaysAgo)
      .reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);
    const revenue7d     = activePurchases
      .filter((p: any) => new Date(p.purchased_at || 0) >= sevenDaysAgo)
      .reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);
    const totalRefunded = refundedPurchases.reduce((sum: number, p: any) => sum + (parseFloat(p.amount) || 0), 0);

    // ── Revenue by product ────────────────────────────────────────────────────
    const revenueByProduct: Record<string, { name: string; revenue: number; sales: number }> = {};
    for (const p of activePurchases as any[]) {
      const key = p.product_name || 'Unknown';
      if (!revenueByProduct[key]) revenueByProduct[key] = { name: key, revenue: 0, sales: 0 };
      revenueByProduct[key].revenue += parseFloat(p.amount) || 0;
      revenueByProduct[key].sales++;
    }
    const revenueByProductArr = Object.values(revenueByProduct)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 6)
      .map(r => ({ ...r, revenue: parseFloat(r.revenue.toFixed(2)) }));

    // ── Revenue by tier ───────────────────────────────────────────────────────
    const revenueByTier: Record<string, { name: string; revenue: number; sales: number }> = {};
    for (const p of activePurchases as any[]) {
      const key = p.variant_name || 'Unknown';
      if (!revenueByTier[key]) revenueByTier[key] = { name: key, revenue: 0, sales: 0 };
      revenueByTier[key].revenue += parseFloat(p.amount) || 0;
      revenueByTier[key].sales++;
    }
    const revenueByTierArr = Object.values(revenueByTier)
      .sort((a, b) => b.revenue - a.revenue)
      .map(r => ({ ...r, revenue: parseFloat(r.revenue.toFixed(2)) }));

    // ── Time series: last 30 days ─────────────────────────────────────────────
    const days = 30;
    const series: { date: string; downloads: number; signups: number; messages: number; revenue: number; sales: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];

      const downloads    = (kvLeads   as any[]).filter(l => (l.downloadedAt || '').startsWith(dateStr)).length;
      const signups      = signupUsers.filter((u: any)  => (u.created_at   || '').startsWith(dateStr)).length;
      const msgs         = (messages  as any[]).filter(m => (m.createdAt   || '').startsWith(dateStr)).length;
      const dayPurchases = activePurchases.filter((p: any) => (p.purchased_at || '').startsWith(dateStr));
      const revenue      = parseFloat(dayPurchases.reduce((s: number, p: any) => s + (parseFloat(p.amount) || 0), 0).toFixed(2));
      const sales        = dayPurchases.length;

      series.push({ date: dateStr, downloads, signups, messages: msgs, revenue, sales });
    }

    // ── Top tools by download count ──��───────────────────────────────────────
    const toolCountMap: Record<string, { name: string; category: string; slug: string; count: number }> = {};
    for (const lead of kvLeads as any[]) {
      const key = lead.toolSlug || lead.toolName || 'Unknown';
      if (!toolCountMap[key]) toolCountMap[key] = { name: lead.toolName || key, category: '', slug: key, count: 0 };
      toolCountMap[key].count++;
    }
    for (const t of tools as any[]) {
      const key = t.slug || t.name;
      if (toolCountMap[key]) toolCountMap[key].category = t.category || '';
    }
    const topTools = Object.values(toolCountMap).sort((a, b) => b.count - a.count).slice(0, 8);

    // ── Lead sources for pie chart ──
    const leadSources = [
      { name: 'Free Downloads', value: kvLeads.length },
      { name: 'Sign-ups',       value: signupUsers.length },
    ];

    // ── Downloads by tool ──
    const downloadsByTool = Object.values(toolCountMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 6)
      .map(t => ({ name: t.name.length > 14 ? t.name.substring(0, 14) + '…' : t.name, count: t.count }));

    // ── 30-day lead stats ──
    const newLeads30d       = (kvLeads as any[]).filter(l => new Date(l.downloadedAt || 0) >= thirtyDaysAgo).length;
    const newSignups30d     = signupUsers.filter((u: any) => new Date(u.created_at || 0) >= thirtyDaysAgo).length;
    const unreadMessages    = messagesNormalized.filter(m => !m.read).length
                            + toolRequestsParsed.filter((r: any) => !r.read).length;

    // ── Recent activity (downloads + signups + purchases) ────────────────────
    const recentLeads = [...kvLeads as any[]]
      .sort((a, b) => new Date(b.downloadedAt || 0).getTime() - new Date(a.downloadedAt || 0).getTime())
      .slice(0, 8)
      .map(l => ({ ...l, activityType: 'download' }));

    const recentSignups = [...signupUsers]
      .sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
      .slice(0, 5)
      .map((u: any) => ({
        email: u.email,
        displayName: u.user_metadata?.full_name || '',
        createdAt: u.created_at,
        activityType: 'signup',
      }));

    const recentPurchaseActivity = [...activePurchases]
      .slice(0, 8)
      .map((p: any) => ({
        email: '',
        productName: p.product_name || '',
        variantName: p.variant_name || '',
        amount: parseFloat(p.amount) || 0,
        currency: p.currency || 'USD',
        createdAt: p.purchased_at,
        activityType: 'purchase',
      }));

    const recentMessages = [...messagesNormalized]
      .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())
      .slice(0, 5);

    const activity = [...recentLeads, ...recentSignups, ...recentPurchaseActivity]
      .sort((a, b) => {
        const ta = new Date(a.downloadedAt || a.createdAt || 0).getTime();
        const tb = new Date(b.downloadedAt || b.createdAt || 0).getTime();
        return tb - ta;
      })
      .slice(0, 15);

    return c.json({
      success: true,
      data: {
        stats: {
          totalLeads:    kvLeads.length + signupUsers.length,
          freeDownloads: kvLeads.length,
          signups:       signupUsers.length,
          totalTools:    tools.length,
          totalProjects: projects.length,
          totalMessages: messagesNormalized.length + toolRequestsParsed.length,
          unreadMessages,
          newLeads30d:   newLeads30d + newSignups30d,
          totalRevenue:  parseFloat(totalRevenue.toFixed(2)),
          revenue30d:    parseFloat(revenue30d.toFixed(2)),
          revenue7d:     parseFloat(revenue7d.toFixed(2)),
          totalSales:    activePurchases.length,
          totalRefunded: parseFloat(totalRefunded.toFixed(2)),
          refundCount:   refundedPurchases.length,
        },
        series,
        topTools,
        downloadsByTool,
        leadSources,
        revenueByProduct: revenueByProductArr,
        revenueByTier:    revenueByTierArr,
        recentMessages,
        recentPurchases:  activePurchases.slice(0, 10),
        activity,
      },
    });
  } catch (error) {
    console.log('[admin/dashboard] Error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ========== DATA INITIALIZATION ENDPOINT ==========

// Init endpoint for seeding sample data — requires admin auth
app.post("/make-server-e07959ec/init", requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { projects = [], tools = [], team = [] } = body;

    const counts = { projects: 0, tools: 0, team: 0, versions: 0, settings: 0 };
    const errors: string[] = [];

    console.log(`🌱 Init: seeding ${projects.length} projects, ${tools.length} tools, ${team.length} team members`);

    // ── 1. Clear existing data (FK order: versions before tools) ──────────────
    const { error: delVersionsErr } = await supabase.from('tool_versions').delete().not('id', 'is', null);
    if (delVersionsErr) console.log('Warn clearing tool_versions:', delVersionsErr.message);

    const { error: delToolsErr } = await supabase.from('tools').delete().not('id', 'is', null);
    if (delToolsErr) console.log('Warn clearing tools:', delToolsErr.message);

    const { error: delProjectsErr } = await supabase.from('projects').delete().not('id', 'is', null);
    if (delProjectsErr) console.log('Warn clearing projects:', delProjectsErr.message);

    const { error: delTeamErr } = await supabase.from('team_members').delete().not('id', 'is', null);
    if (delTeamErr) console.log('Warn clearing team_members:', delTeamErr.message);

    // ── 2. Insert projects ────────────────────────────────────────────────────
    for (const project of projects) {
      const { id: _id, ...rest } = project;
      const dbRow = toDbRow(rest);
      const { error } = await supabase.from('projects').insert(dbRow);
      if (error) {
        console.log(`Error inserting project "${project.title}": ${error.message}`);
        errors.push(`Project "${project.title}": ${error.message}`);
      } else {
        counts.projects++;
      }
    }

    // ── 3. Insert tools (with versions) ──────────────────────────────────────
    for (const tool of tools) {
      const { versions, id: _id, howItWorks: _hiw, systemRequirements: _sr, tagline: _tl, demoUrl: toolDemoUrl, ...toolRest } = tool;

      // Fold demoUrl into faqs as a hidden 🎬 entry so it survives the DB
      const toolFaqs = [
        ...(toolDemoUrl ? [{ question: '🎬', answer: toolDemoUrl }] : []),
        ...(toolRest.faqs ?? []),
      ];
      const toolDbRow = toDbRow({ ...toolRest, faqs: toolFaqs });

      const { data: toolData, error: toolError } = await supabase
        .from('tools')
        .insert(toolDbRow)
        .select()
        .single();

      if (toolError) {
        console.log(`Error inserting tool "${tool.name}": ${toolError.message}`);
        errors.push(`Tool "${tool.name}": ${toolError.message}`);
        continue;
      }

      counts.tools++;

      // Insert versions for this tool
      if (versions && Array.isArray(versions) && versions.length > 0) {
        const versionsDbRows = versions.map((v: any) => {
          // Strip frontend-only / non-standard columns that may not exist in
          // the tool_versions table (demoUrl, whatsIncluded) before toDbRow.
          const {
            id: _vId,
            demoUrl: _demoUrl,
            whatsIncluded: _whatsIncluded,
            pricingModel: _pm,
            lifetimePrice: _lp,
            monthlyPrice: _mp,
            yearlyPrice: _yp,
            ...vRest
          } = v;

          // Fold pricing info as the first feature line (pipe-delimited, unambiguous):
          //   Free version    → "Free"
          //   Subscription    → "subscription|<monthly>|<yearly>"
          //   Lifetime        → "lifetime|<price>"
          const priceSentinel =
            v.versionType === 'Free'
              ? 'Free'
              : v.pricingModel === 'subscription'
              ? `subscription|${v.monthlyPrice ?? ''}|${v.yearlyPrice ?? ''}`
              : `lifetime|${v.lifetimePrice ?? ''}`;

          // Store all version metadata as sentinels - no plain features
          const enrichedFeatures = [
            ...(priceSentinel ? [`💰 ${priceSentinel}`] : []),
            ...(v.color ? [`🖌️ color|${v.color}`] : []),
            ...((v.whatsIncluded ?? []) as string[]).filter(Boolean).map((item: string) => `📦 ${item}`),
            ...((v.activationSteps ?? []) as string[]).filter(Boolean).map((step: string) => `🔑 ${step}`),
            ...((v.richFeatures ?? []) as any[]).filter(Boolean).map((f: any) => `🎨 ${JSON.stringify(f)}`),
          ];

          return {
            ...toDbRow(vRest),
            features: enrichedFeatures,
            tool_id: toolData.id,
          };
        });

        const { error: vError } = await supabase.from('tool_versions').insert(versionsDbRows);
        if (vError) {
          console.log(`Error inserting versions for tool "${tool.name}": ${vError.message}`);
          errors.push(`Versions for "${tool.name}": ${vError.message}`);
        } else {
          counts.versions += versions.length;
        }
      }
    }

    // ── 4. Insert team members ────────────────────────────────────────────────
    for (const member of team) {
      const { id: _id, ...rest } = member;
      const dbRow = toDbRow(rest);
      const { error } = await supabase.from('team_members').insert(dbRow);
      if (error) {
        console.log(`Error inserting team member "${member.name}": ${error.message}`);
        errors.push(`Team "${member.name}": ${error.message}`);
      } else {
        counts.team++;
      }
    }

    // ── 5. Seed default site settings ────────────────────────────────────────
    const defaultSettings = [
      {
        key: 'showreelUrl',
        value: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        updated_at: new Date().toISOString(),
      },
      {
        key: 'projectCategories',
        value: ['Motion Design', 'Branding', '3D Animation', 'Video Editing', 'VFX', 'UI/UX Animation', 'Product', 'Brand', 'Social', 'Campaign', 'Other'],
        updated_at: new Date().toISOString(),
      },
      {
        key: 'toolCategories',
        value: ['Automation', 'Animation', 'Workflow', 'Effects', 'Plugins'],
        updated_at: new Date().toISOString(),
      },
      {
        key: 'toolStatuses',
        value: [
          { label: 'New',     color: 'green'  },
          { label: 'Popular', color: 'purple' },
          { label: 'Pro',     color: 'amber'  },
          { label: 'Free',    color: 'cyan'   },
        ],
        updated_at: new Date().toISOString(),
      },
      {
        key: 'socialLinks',
        value: {
          linkedin: 'https://linkedin.com/company/fastoosh',
          instagram: 'https://instagram.com/fastoosh',
          twitter: '',
          dribbble: '',
          behance: '',
          tiktok: '',
        },
        updated_at: new Date().toISOString(),
      },
      // ── Legal pages (EN) ─��────────────────────────────────────────────────
      {
        key: 'termsContent',
        value: `<h2>1. Acceptance of Terms</h2>\n<p>By accessing and using this website, you accept and agree to be bound by the terms and provision of this agreement.</p>\n\n<h2>2. Use License</h2>\n<p>Permission is granted to temporarily download one copy of the materials on our website for personal, non-commercial transitory viewing only.</p>\n\n<h2>3. Disclaimer</h2>\n<p>The materials on our website are provided on an 'as is' basis. We make no warranties, expressed or implied, and hereby disclaim and negate all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.</p>\n\n<h2>4. Limitations</h2>\n<p>In no event shall Fastoosh or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on our website.</p>\n\n<h2>5. Contact Information</h2>\n<p>If you have any questions about these Terms, please contact us through our website.</p>`,
        updated_at: new Date().toISOString(),
      },
      {
        key: 'privacyContent',
        value: `<h2>1. Information We Collect</h2>\n<p>We collect information that you provide directly to us, including when you create an account, make a purchase, subscribe to our newsletter, or contact us for support.</p>\n\n<h2>2. How We Use Your Information</h2>\n<p>We use the information we collect to provide, maintain, and improve our services, process transactions, and communicate with you.</p>\n\n<h2>3. Data Security</h2>\n<p>We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.</p>\n\n<h2>4. Your Rights</h2>\n<p>You have the right to access, correct, or delete your personal information. Contact us for assistance.</p>\n\n<h2>5. Contact Us</h2>\n<p>If you have any questions about this Privacy Policy, please contact us through our website.</p>`,
        updated_at: new Date().toISOString(),
      },
      {
        key: 'refundsContent',
        value: `<h2>1. Refund Eligibility</h2>\n<p>We want you to be completely satisfied with your purchase. If you're not happy with your Fastoosh product, you may be eligible for a refund under certain conditions.</p>\n\n<h2>2. How to Request a Refund</h2>\n<p>To request a refund, please contact our support team with your order number and reason for the refund request.</p>\n\n<h2>3. Refund Processing Time</h2>\n<p>Once your refund request is approved, refunds are processed within 5-7 business days to your original payment method.</p>\n\n<h2>4. Contact Us</h2>\n<p>If you have any questions about our refund policy, please contact us through our website support form.</p>`,
        updated_at: new Date().toISOString(),
      },
      {
        key: 'disclaimerContent',
        value: `<h2>1. General Disclaimer</h2>\n<p>The information provided by Fastoosh on this website is for general informational and commercial purposes only. All information is provided in good faith; however, we make no representation or warranty of any kind regarding the accuracy, adequacy, validity, reliability, availability, or completeness of any information on the site.</p>\n\n<h2>2. No Professional Advice</h2>\n<p>The content on this website does not constitute professional advice of any kind. All tools, scripts, and plugins offered by Fastoosh are designed for use in creative production workflows.</p>\n\n<h2>3. Software & Tools Disclaimer</h2>\n<p>All software, scripts, and plugins provided by Fastoosh are delivered "as is" and "as available" without any warranty of any kind. You assume full responsibility for the use of any product downloaded or purchased from this website.</p>\n\n<h2>4. Limitation of Liability</h2>\n<p>Under no circumstances shall Fastoosh be liable for any direct, indirect, incidental, or consequential damages arising from your use of or inability to use any product or content on this site.</p>\n\n<h2>5. Third-Party Links</h2>\n<p>This website may contain links to third-party websites. Fastoosh has no control over, and assumes no responsibility for, the content or practices of any third-party websites.</p>\n\n<h2>6. Changes to This Disclaimer</h2>\n<p>We reserve the right to update or modify this disclaimer at any time without prior notice.</p>\n\n<h2>7. Contact Us</h2>\n<p>If you have any questions about this disclaimer, please contact us through our website.</p>`,
        updated_at: new Date().toISOString(),
      },
    ];

    // Fetch which keys already exist so we don't overwrite values
    // that /setup/brand already wrote with real client data.
    const { data: existingRows } = await supabase.from('site_settings').select('key');
    const existingKeys = new Set((existingRows || []).map((r: any) => r.key));

    // These keys are owned by /setup/brand — only seed them when no value exists yet.
    const skipIfExists = new Set(['showreelUrl', 'socialLinks']);

    for (const setting of defaultSettings) {
      if (skipIfExists.has(setting.key) && existingKeys.has(setting.key)) {
        counts.settings++; // already set by setup wizard — leave untouched
        continue;
      }
      const { error } = await supabase
        .from('site_settings')
        .upsert(setting, { onConflict: 'key' });
      if (error) {
        console.log(`Error seeding setting "${setting.key}": ${error.message}`);
      } else {
        counts.settings++;
      }
    }

    console.log(`✅ Init complete:`, counts);

    return c.json({
      success: true,
      counts,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    console.log(`Error in /init: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ========== SEO ENDPOINTS ==========

// Convert pageKey (e.g. "tool--my-slug") → KV key (e.g. "seo:tool:my-slug")
const toSeoKvKey = (pageKey: string) => `seo:${pageKey.replace(/--/g, ':')}`;

// GET /seo/:pageKey — public
app.get('/make-server-e07959ec/seo/:pageKey', async (c) => {
  try {
    const pageKey = c.req.param('pageKey');
    const data = await kv.get(toSeoKvKey(pageKey));
    return c.json({ success: true, data: data || null });
  } catch (error) {
    console.log(`[seo] GET error: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// PUT /seo/:pageKey — admin only
app.put('/make-server-e07959ec/seo/:pageKey', requireAuth, async (c) => {
  try {
    const pageKey = c.req.param('pageKey');
    const body = await c.req.json();
    const seoData = {
      title:              body.title              || '',
      description:        body.description        || '',
      keywords:           body.keywords           || '',
      ogTitle:            body.ogTitle            || '',
      ogDescription:      body.ogDescription      || '',
      ogImage:            body.ogImage            || '',
      twitterCard:        body.twitterCard        || 'summary_large_image',
      twitterTitle:       body.twitterTitle       || '',
      twitterDescription: body.twitterDescription || '',
      canonicalUrl:       body.canonicalUrl       || '',
      noIndex:            body.noIndex            || false,
      updatedAt:          new Date().toISOString(),
    };
    await kv.set(toSeoKvKey(pageKey), seoData);
    console.log(`[seo] Saved SEO for "${pageKey}"`);
    return c.json({ success: true, data: seoData });
  } catch (error) {
    console.log(`[seo] PUT error: ${error}`);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// POST /admin/generate-seo-content — admin only, Gemini AI
app.post('/make-server-e07959ec/admin/generate-seo-content', requireAuth, async (c) => {
  try {
    const { pageName, pageType, pageContext, existingSeo, instruction = '', improveExisting = false } = await c.req.json();
    const { apiKey, model: geminiModel } = await getGeminiConfig();
    if (!apiKey) return c.json({ success: false, error: 'GEMINI_API_KEY not configured' }, 500);
    if (!pageName) return c.json({ success: false, error: 'pageName is required' }, 400);

    const gen: Record<string, boolean> = {};
    if (improveExisting || !existingSeo?.title?.trim())              gen.title              = true;
    if (improveExisting || !existingSeo?.description?.trim())        gen.description        = true;
    if (improveExisting || !existingSeo?.keywords?.trim())           gen.keywords           = true;
    if (improveExisting || !existingSeo?.ogTitle?.trim())            gen.ogTitle            = true;
    if (improveExisting || !existingSeo?.ogDescription?.trim())      gen.ogDescription      = true;
    if (improveExisting || !existingSeo?.twitterTitle?.trim())       gen.twitterTitle       = true;
    if (improveExisting || !existingSeo?.twitterDescription?.trim()) gen.twitterDescription = true;

    if (!Object.values(gen).some(Boolean)) {
      return c.json({ success: true, data: {}, nothingToGenerate: true });
    }

    const instructionLine = instruction?.trim() ? `\nUser instruction: "${instruction.trim()}"` : '';
    const contextLine     = pageContext?.trim()  ? `\nPage context: "${pageContext.trim()}"` : '';
    const existingCtx = improveExisting && existingSeo ? [
      existingSeo.title?.trim()       ? `Current title: "${existingSeo.title.trim()}"` : '',
      existingSeo.description?.trim() ? `Current description: "${existingSeo.description.trim()}"` : '',
    ].filter(Boolean).join('\n') : '';

    let schemaLines = '';
    if (gen.title)              schemaLines += `  "title": "<SEO title max 60 chars, includes Fastoosh brand>",\n`;
    if (gen.description)        schemaLines += `  "description": "<Meta description 120-160 chars, compelling>",\n`;
    if (gen.keywords)           schemaLines += `  "keywords": "<comma-separated keywords, 6-10 terms>",\n`;
    if (gen.ogTitle)            schemaLines += `  "ogTitle": "<OG title for social sharing, max 60 chars>",\n`;
    if (gen.ogDescription)      schemaLines += `  "ogDescription": "<OG description for social, max 200 chars>",\n`;
    if (gen.twitterTitle)       schemaLines += `  "twitterTitle": "<Twitter title, max 70 chars>",\n`;
    if (gen.twitterDescription) schemaLines += `  "twitterDescription": "<Twitter description, max 200 chars>",\n`;

    const modeInstruction = improveExisting
      ? 'REWRITE and IMPROVE the existing SEO metadata. Make it more compelling and search-optimized.'
      : 'Generate professional SEO metadata for this page.';

    const prompt = `You are an SEO expert for Fastoosh, a premium motion design studio creating After Effects plugins and tools for professional motion designers.

${modeInstruction} Return ONLY valid JSON — no markdown fences, no extra text.

Page: "${pageName}"
Page Type: "${pageType || 'static'}"${contextLine}${instructionLine}${existingCtx ? '\n' + existingCtx : ''}

Rules:
- title: Include "Fastoosh" brand name, max 60 chars, page-specific
- description: 120-160 chars, value proposition + primary keywords
- keywords: 6-10 relevant terms, comma-separated
- ogTitle: Optimized for social, max 60 chars
- ogDescription: Engaging for social, max 200 chars
- twitterTitle: max 70 chars
- twitterDescription: max 200 chars
- Target: motion designers, VFX artists, After Effects users
- Be specific to "${pageName}" — no generic filler
${improveExisting ? '- REWRITE mode: elevate existing copy, do not repeat verbatim\n' : ''}
Return exactly this JSON:
{
${schemaLines}}`;

    console.log(`[seo] Gemini call for "${pageName}" [${improveExisting ? 'REWRITE' : 'FILL'}] fields: ${Object.keys(gen).join(', ')}`);

    const geminiRes = await fetch(
      geminiUrl(geminiModel, apiKey),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.7, maxOutputTokens: 2048 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return c.json({ success: false, error: `Gemini API error (${geminiRes.status}): ${errText}` }, 500);
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return c.json({ success: false, error: 'Gemini returned empty response' }, 500);

    let generated: Record<string, any>;
    try {
      const repaired = repairJson(rawText);
      generated = JSON.parse(repaired);
    } catch (parseErr) {
      console.log('[seo] JSON repair failed. Raw (first 300):', rawText.substring(0, 300));
      return c.json({ success: false, error: `AI response was not valid JSON: ${String(parseErr)}` }, 500);
    }

    console.log(`✅ SEO generated for "${pageName}"`);
    return c.json({ success: true, data: generated });
  } catch (error) {
    console.log('[seo] generate-seo-content error:', error);
    return c.json({ success: false, error: `Content generation failed: ${String(error)}` }, 500);
  }
});

// ========== HOME CONTENT ==========

// GET /home-content — public
app.get('/make-server-e07959ec/home-content', async (c) => {
  try {
    const raw = await kv.get('home_content');
    // kv may return a JSON string (stored via JSON.stringify) or an already-parsed object
    let parsed: any = null;
    if (raw !== null && raw !== undefined) {
      if (typeof raw === 'string') {
        try { parsed = JSON.parse(raw); } catch { parsed = null; }
      } else {
        parsed = raw; // already an object returned by kv
      }
    }
    // Return default content if nothing is stored, so the translation panel has fields to work with
    const data = parsed || DEFAULT_HOME_CONTENT;
    return c.json({ success: true, data });
  } catch (error) {
    console.log('[home-content GET] error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// PUT /home-content — admin only
app.put('/make-server-e07959ec/home-content', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    await kv.set('home_content', JSON.stringify(body));
    console.log('✅ Home content saved');
    return c.json({ success: true });
  } catch (error) {
    console.log('[home-content PUT] error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// POST /admin/generate-home-content — admin only, AI generation
app.post('/make-server-e07959ec/admin/generate-home-content', requireAuth, async (c) => {
  try {
    const { section = 'all', existingContent = {}, instruction = '', improveExisting = false } = await c.req.json();
    const { apiKey, model: geminiModel } = await getGeminiConfig();
    if (!apiKey) return c.json({ success: false, error: 'GEMINI_API_KEY not configured' }, 500);

    const instructionLine = instruction?.trim() ? `\nExtra instruction: "${instruction.trim()}"` : '';
    const modeInstruction = improveExisting ? 'REWRITE/IMPROVE the existing content.' : 'Generate fresh content for the following section(s).';

    const sectionGuides: Record<string, string> = {
      hero: `Return JSON with: heroLine1 (main heading — no gradient), heroLine2 (second line with gradient color — catchy), heroSubtitle (1-2 sentence value prop), heroCta1Text (primary CTA ~3 words), heroCta2Text (secondary CTA ~3 words).`,
      testimonial: `Return JSON with: testimonialQuote (compelling 1-2 sentence client quote), testimonialAuthor (realistic full name), testimonialRole (job title + company e.g. "Head of Marketing at TechCorp").`,
      featured: `Return JSON with: featuredHeading (e.g. "Featured work"), featuredSubtitle (1 sentence about curated selection).`,
      capabilities: `Return JSON with: capabilitiesHeading (e.g. "Why work with us"), capabilities (array of 3 objects, each: { icon: one of [sparkles|zap|target|star|shield|trending-up|award|heart|layers|globe], title: 2-3 words, description: 1-2 sentences }).`,
      process: `Return JSON with: processHeading (e.g. "Our process"), processSubtitle (1 sentence), processSteps (array of 4 objects: { number: "01"|"02"|"03"|"04", title: string, description: 1 sentence }).`,
      turnaround: `Return JSON with: turnaroundRows (array of 4 objects: { label: string e.g. "Short-form video", time: string e.g. "1-2 weeks" }), turnaroundNote (short e.g. "Rush options available").`,
      deliverables: `Return JSON with: deliverablesTitle (e.g. "What you get"), deliverables (array of 5-7 concise deliverable strings).`,
      cta: `Return JSON with: ctaHeading (e.g. "Ready to create something"), ctaHeadingGradient (1 dramatic word/phrase e.g. "extraordinary?"), ctaSubtitle (1-2 warm sentences), ctaBadges (array of 3 short trust signals e.g. ["✓ Reply in 24-48h","✓ NDA-friendly","✓ Remote worldwide"]).`,
    };

    const sectionsToGenerate = section === 'all' ? Object.keys(sectionGuides) : [section];
    const guideText = sectionsToGenerate.map(s => sectionGuides[s] || '').filter(Boolean).join('\n\n');
    const existingCtx = improveExisting && Object.keys(existingContent).length > 0
      ? `\nExisting content:\n${JSON.stringify(existingContent, null, 2)}`
      : '';

    const prompt = `You are a premium copywriter for Fastoosh, a high-end motion design studio that creates animations, After Effects tools, and visual storytelling for ambitious brands worldwide.

${modeInstruction}

Tone: Premium, confident, creative, modern. Not salesy. Short sentences. No clichés.${instructionLine}${existingCtx}

Generate all sections below and merge into ONE flat JSON object:

${guideText}

RULES: Return ONLY valid JSON, no markdown, no explanation. All strings concise and professional.`;

    const geminiRes = await fetch(
      geminiUrl(geminiModel, apiKey),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.7, maxOutputTokens: 3000 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return c.json({ success: false, error: `Gemini API error (${geminiRes.status}): ${errText}` }, 500);
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return c.json({ success: false, error: 'Gemini returned empty response' }, 500);

    let generated: Record<string, any>;
    try {
      generated = JSON.parse(repairJson(rawText));
    } catch (parseErr) {
      console.log('[home-content AI] JSON parse failed. Raw:', rawText.substring(0, 500));
      return c.json({ success: false, error: `AI response was not valid JSON: ${String(parseErr)}` }, 500);
    }

    console.log(`✅ Home content generated (section: ${section})`);
    return c.json({ success: true, data: generated });
  } catch (error) {
    console.log('[home-content AI] error:', error);
    return c.json({ success: false, error: `Generation failed: ${String(error)}` }, 500);
  }
});

// ========== AVAILABILITY CALENDAR ==========

// GET /availability-calendar — admin only
app.get('/make-server-e07959ec/availability-calendar', requireAuth, async (c) => {
  try {
    const raw = await kv.get('availability_calendar');
    let data: any = { calendar: {}, messages: { available: '', busy: '', booked: '' } };
    
    if (raw !== null && raw !== undefined) {
      if (typeof raw === 'string') {
        try { data = JSON.parse(raw); } catch { data = { calendar: {}, messages: { available: '', busy: '', booked: '' } }; }
      } else {
        data = raw;
      }
    }
    
    return c.json({ success: true, data });
  } catch (error) {
    console.log('[availability-calendar GET] error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// PUT /availability-calendar — admin only
app.put('/make-server-e07959ec/availability-calendar', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    await kv.set('availability_calendar', JSON.stringify(body));
    console.log('✅ Availability calendar saved');
    return c.json({ success: true });
  } catch (error) {
    console.log('[availability-calendar PUT] error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// GET /availability-calendar/current — public, returns current month + next 5 months
app.get('/make-server-e07959ec/availability-calendar/current', async (c) => {
  try {
    const raw = await kv.get('availability_calendar');
    let data: any = { calendar: {}, messages: { available: '', busy: '', booked: '' } };
    
    if (raw !== null && raw !== undefined) {
      if (typeof raw === 'string') {
        try { data = JSON.parse(raw); } catch { /* ignore */ }
      } else {
        data = raw;
      }
    }
    
    // Get current month and next 5 months
    const now = new Date();
    const months = [];
    
    for (let i = 0; i < 6; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthData = data.calendar[monthKey] || { status: 'available', message: '' };
      
      months.push({
        key: monthKey,
        month: date.toLocaleDateString('en-US', { month: 'long' }),
        year: date.getFullYear(),
        status: monthData.status || 'available',
        message: monthData.message || data.messages[monthData.status] || ''
      });
    }
    
    console.log(`[availability-calendar/current] Returning ${months.length} months:`, months);
    
    // Find the first available month
    const firstAvailable = months.find(m => m.status === 'available');
    const currentMonth = months[0];
    
    return c.json({
      success: true,
      data: {
        // For backward compatibility, keep the single status/message
        status: currentMonth.status,
        message: currentMonth.message,
        // Add the full months array
        months: months,
        firstAvailable: firstAvailable ? `${firstAvailable.month} ${firstAvailable.year}` : null
      }
    });
  } catch (error) {
    console.log('[availability-calendar/current GET] error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// POST /admin/generate-seo-jsonld — admin only, generates JSON-LD structured data
app.post('/make-server-e07959ec/admin/generate-seo-jsonld', requireAuth, async (c) => {
  try {
    const { pageName, pageType, pageContext, siteUrl, existingJsonLd, instruction = '', improveExisting = false } = await c.req.json();
    const { apiKey, model: geminiModel } = await getGeminiConfig();
    if (!apiKey) return c.json({ success: false, error: 'GEMINI_API_KEY not configured' }, 500);
    if (!pageName) return c.json({ success: false, error: 'pageName is required' }, 400);

    if (!improveExisting && existingJsonLd?.trim()) {
      return c.json({ success: true, data: {}, nothingToGenerate: true });
    }

    const instructionLine = instruction?.trim() ? `\nUser instruction: "${instruction.trim()}"` : '';
    const contextLine     = pageContext?.trim()  ? `\nPage context: "${pageContext.trim()}"` : '';
    const siteUrlLine     = siteUrl?.trim()       ? `\nSite URL: "${siteUrl.trim()}"` : '';
    const modeInstruction = improveExisting
      ? 'REWRITE and IMPROVE the existing JSON-LD.'
      : 'Generate JSON-LD structured data for this page.';

    // Build schema guidance based on page type
    let schemaGuidance = '';
    if (pageType === 'tool') {
      schemaGuidance = `Use "@type": "SoftwareApplication" with applicationCategory "MultimediaApplication", operatingSystem, offers (with price if known), description, name, and url. Include "softwareVersion" if relevant.`;
    } else if (pageType === 'project') {
      schemaGuidance = `Use "@type": "CreativeWork" with name, description, creator (Fastoosh), dateCreated, and genre (e.g. "Motion Design").`;
    } else if (pageName.toLowerCase() === 'home') {
      schemaGuidance = `Use "@type": "Organization" with name "Fastoosh", description, url, logo, sameAs (social links array placeholder), and contactPoint.`;
    } else {
      schemaGuidance = `Use "@type": "WebPage" with name, description, url, and publisher (Fastoosh Organization).`;
    }

    const existingCtx = improveExisting && existingJsonLd?.trim()
      ? `\nExisting JSON-LD:\n${existingJsonLd.trim()}`
      : '';

    const prompt = `You are an SEO expert generating JSON-LD structured data for Fastoosh, a premium motion design studio.

${modeInstruction} Return ONLY the raw JSON-LD object — no markdown fences, no extra text, no @context wrapper (include @context inside the object).

Page: "${pageName}"
Page Type: "${pageType || 'static'}"${siteUrlLine}${contextLine}${instructionLine}${existingCtx}

Schema guidance: ${schemaGuidance}

Rules:
- Include "@context": "https://schema.org"
- Fill in realistic values based on the page context
- Use the siteUrl to construct page URLs if provided
- For Fastoosh as publisher/creator: use name "Fastoosh", url from siteUrl if available
- Keep it concise but complete — no placeholder <values>, use real data from context or sensible defaults
- Return valid JSON only`;

    console.log(`[seo-jsonld] Gemini call for "${pageName}" [${pageType}] ${improveExisting ? 'REWRITE' : 'GENERATE'}`);

    const geminiRes = await fetch(
      geminiUrl(geminiModel, apiKey),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.5, maxOutputTokens: 2048 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return c.json({ success: false, error: `Gemini API error (${geminiRes.status}): ${errText}` }, 500);
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return c.json({ success: false, error: 'Gemini returned empty response' }, 500);

    let generated: Record<string, any>;
    try {
      const repaired = repairJson(rawText);
      generated = JSON.parse(repaired);
    } catch (parseErr) {
      console.log('[seo-jsonld] JSON repair failed. Raw (first 300):', rawText.substring(0, 300));
      return c.json({ success: false, error: `AI response was not valid JSON: ${String(parseErr)}` }, 500);
    }

    console.log(`✅ JSON-LD generated for "${pageName}"`);
    return c.json({ success: true, data: { structuredData: JSON.stringify(generated, null, 2) } });
  } catch (error) {
    console.log('[seo-jsonld] error:', error);
    return c.json({ success: false, error: `JSON-LD generation failed: ${String(error)}` }, 500);
  }
});

// ========== BROADCAST EMAIL ==========

// POST /admin/broadcast — send a one-time email to a list of recipients via Resend
app.post('/make-server-e07959ec/admin/broadcast', requireAuth, async (c) => {
  try {
    const { subject, body, recipients, replyTo, senderName } = await c.req.json() as {
      subject: string;
      body: string;
      recipients: { email: string; displayName?: string }[];
      replyTo?: string;
      senderName?: string;
    };

    if (!subject?.trim())        return c.json({ success: false, error: 'subject is required' }, 400);
    if (!body?.trim())           return c.json({ success: false, error: 'body is required' }, 400);
    if (!recipients?.length)     return c.json({ success: false, error: 'recipients list is empty' }, 400);

    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) return c.json({ success: false, error: 'RESEND_API_KEY not configured' }, 500);

    const resend = new Resend(resendKey);
    const fromName = senderName?.trim() || 'Fastoosh';
    const fromAddress = `${fromName} <noreply@contact.fastoosh.com>`;

    let sent   = 0;
    let failed = 0;
    const errors: string[] = [];

    // Send individually so each email is personalised and no recipient sees others
    for (const r of recipients) {
      const email = r.email?.toLowerCase().trim();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        failed++;
        errors.push(`Invalid email: ${r.email}`);
        continue;
      }

      // Replace {{name}} with first name or fallback to "there"
      const firstName = r.displayName?.split(' ')[0]?.trim() || 'there';
      const personalBody = body.replace(/\{\{name\}\}/g, firstName);

      // Convert body to HTML:
      // 1. Replace markdown links [text](url) with <a> tags BEFORE escaping
      // 2. HTML-escape the remaining plain text
      // 3. Convert bare URLs to links
      // 4. Convert newlines to <br>
      const htmlBody = personalBody
        // Step 1: extract markdown links as placeholders to protect them from escaping
        .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_m, text, url) =>
          `\x00LINK\x00${encodeURIComponent(url)}\x00${text}\x00ENDLINK\x00`
        )
        // Step 2: escape HTML special chars in the remaining text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        // Step 3: restore markdown link placeholders as real <a> tags
        .replace(/\x00LINK\x00([^\x00]+)\x00([^\x00]+)\x00ENDLINK\x00/g,
          (_m, encodedUrl, text) =>
            `<a href="${decodeURIComponent(encodedUrl)}" style="color:#a855f7;text-decoration:underline;">${text}</a>`
        )
        // Step 4: convert remaining bare URLs (not already inside an <a>) to links
        .replace(/(?<!href=")https?:\/\/[^\s<]+/g, url =>
          `<a href="${url}" style="color:#a855f7;text-decoration:underline;">${url}</a>`
        )
        // Step 5: newlines to <br>
        .replace(/\n/g, '<br>');

      const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#111111;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
    <tr><td align="center" style="padding:40px 16px;">
      <table role="presentation" width="100%" style="max-width:520px;" cellpadding="0" cellspacing="0">
        <tr><td style="padding-bottom:28px;">
          <span style="font-size:20px;font-weight:800;letter-spacing:-0.5px;color:#111111;">Fastoosh</span>
        </td></tr>
        <tr><td style="font-size:15px;line-height:1.7;color:#333333;">
          ${htmlBody}
        </td></tr>
        <tr><td style="padding-top:32px;border-top:1px solid #eeeeee;margin-top:32px;">
          <p style="font-size:12px;color:#999999;margin:0;">
            You received this email because you downloaded or purchased a Fastoosh tool.<br>
            <a href="https://fastoosh.com" style="color:#999999;">fastoosh.com</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

      try {
        await resend.emails.send({
          from:     fromAddress,
          to:       email,
          ...(replyTo?.trim() ? { reply_to: replyTo.trim() } : {}),
          subject:  subject.trim(),
          // Plain-text: convert [text](url) → "text (url)" for readability
          text:     personalBody.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1 ($2)'),
          html,
        });
        sent++;
      } catch (err) {
        failed++;
        errors.push(`${email}: ${String(err)}`);
      }
    }

    console.log(`[broadcast] sent=${sent} failed=${failed} total=${recipients.length}`);
    return c.json({ success: true, result: { sent, failed, errors } });
  } catch (err) {
    console.log(`[broadcast] Error: ${err}`);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// ========== TOOL REVIEWS ==========

// GET /reviews?toolId=xxx — public: list all reviews for a tool
app.get('/make-server-e07959ec/reviews', async (c) => {
  const toolId = c.req.query('toolId');
  if (!toolId) return c.json({ success: false, error: 'toolId query param required' }, 400);
  try {
    const reviews: any[] = await kv.getByPrefix(`review:${toolId}:`);
    const cleaned = reviews
      .filter(Boolean)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return c.json({ success: true, data: cleaned });
  } catch (error) {
    console.log('[reviews GET] error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// GET /tools-ratings — public: aggregate avg rating + count per toolId
app.get('/make-server-e07959ec/tools-ratings', async (c) => {
  try {
    const allReviews: any[] = await kv.getByPrefix('review:');
    const ratings: Record<string, { avg: number; count: number }> = {};
    for (const review of allReviews.filter(Boolean)) {
      if (!review?.toolId || !review?.rating) continue;
      if (!ratings[review.toolId]) ratings[review.toolId] = { avg: 0, count: 0 };
      ratings[review.toolId].count++;
      ratings[review.toolId].avg += review.rating;
    }
    for (const toolId in ratings) {
      ratings[toolId].avg = Math.round((ratings[toolId].avg / ratings[toolId].count) * 10) / 10;
    }
    return c.json({ success: true, data: ratings });
  } catch (error) {
    console.log('[tools-ratings] error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// GET /user/reviews — authenticated: all purchased tools + user's review for each
app.get('/make-server-e07959ec/user/reviews', requireUserAuth, async (c) => {
  const user = c.get('user');
  try {
    const { data: purchases, error: pErr } = await supabase
      .from('user_purchases')
      .select('tool_version_id, tool_versions!inner(tool_id, tools!inner(id, name, slug, image_url))')
      .eq('user_id', user.id);
    if (pErr) {
      console.log('[user/reviews] purchases error:', pErr.message);
      return c.json({ success: false, error: pErr.message }, 500);
    }
    // De-dup by tool_id
    const toolMap: Record<string, { name: string; slug: string; imageUrl: string }> = {};
    for (const p of (purchases || [])) {
      const tv = (p as any).tool_versions;
      if (tv?.tool_id && tv?.tools) {
        toolMap[tv.tool_id] = {
          name: tv.tools.name || '',
          slug: tv.tools.slug || '',
          imageUrl: tv.tools.image_url || '',
        };
      }
    }
    const toolIds = Object.keys(toolMap);
    const reviewResults = await Promise.all(
      toolIds.map(toolId => kv.get(`review:${toolId}:${user.id}`))
    );
    const result = reviewResults.map((review, i) => ({
      toolId: toolIds[i],
      toolName: toolMap[toolIds[i]].name,
      toolSlug: toolMap[toolIds[i]].slug,
      toolImageUrl: toolMap[toolIds[i]].imageUrl,
      review: review || null,
    }));
    return c.json({ success: true, data: result });
  } catch (error) {
    console.log('[user/reviews] error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// POST /reviews — authenticated: create or update own review
app.post('/make-server-e07959ec/reviews', requireUserAuth, async (c) => {
  const user = c.get('user');
  try {
    const { toolId, rating, comment } = await c.req.json();
    if (!toolId) return c.json({ success: false, error: 'toolId is required' }, 400);
    const ratingNum = Number(rating);
    if (!ratingNum || ratingNum < 1 || ratingNum > 5)
      return c.json({ success: false, error: 'rating must be 1–5' }, 400);

    // Verify user has purchased this tool
    const { data: toolVersions, error: tvErr } = await supabase
      .from('tool_versions').select('id').eq('tool_id', toolId);
    if (tvErr) return c.json({ success: false, error: tvErr.message }, 500);
    const versionIds = (toolVersions || []).map((v: any) => v.id);
    if (versionIds.length === 0) return c.json({ success: false, error: 'Tool not found' }, 404);

    // Primary check: match by tool_version_id (set when checkout had custom_data.tool_version_id)
    let hasPurchase = false;
    const { data: byVersion, error: pErr } = await supabase
      .from('user_purchases').select('id')
      .eq('user_id', user.id).in('tool_version_id', versionIds);
    if (pErr) return c.json({ success: false, error: pErr.message }, 500);
    hasPurchase = !!(byVersion && byVersion.length > 0);

    // Fallback: match by product_name — handles purchases where tool_version_id was NULL
    // (e.g. webhook received before the version ID was wired into the checkout link)
    if (!hasPurchase) {
      const { data: toolRow } = await supabase
        .from('tools').select('name').eq('id', toolId).maybeSingle();
      if (toolRow?.name) {
        const { data: byName } = await supabase
          .from('user_purchases').select('id')
          .eq('user_id', user.id)
          .ilike('product_name', toolRow.name);
        hasPurchase = !!(byName && byName.length > 0);
        if (hasPurchase)
          console.log(`[reviews POST] ✅ Purchase verified by product_name fallback: "${toolRow.name}"`);
      }
    }

    if (!hasPurchase)
      return c.json({ success: false, error: 'You must purchase this tool to leave a review' }, 403);

    const reviewKey = `review:${toolId}:${user.id}`;
    const existing: any = await kv.get(reviewKey);
    const now = new Date().toISOString();
    const review = {
      id: existing?.id || crypto.randomUUID(),
      toolId,
      userId: user.id,
      userName: user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Anonymous',
      rating: ratingNum,
      comment: (comment || '').trim(),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    await kv.set(reviewKey, review);
    console.log(`[reviews POST] ✅ Saved: tool=${toolId} user=${user.id} rating=${ratingNum}`);
    return c.json({ success: true, data: review });
  } catch (error) {
    console.log('[reviews POST] error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ── ADMIN REVIEW ENDPOINTS (requireAuth = X-Admin-Token) ──────────────────────

// GET /admin/reviews — list every review stored in KV (real + fake)
app.get('/make-server-e07959ec/admin/reviews', requireAuth, async (c) => {
  try {
    const all = await kv.getByPrefix('review:');
    const reviews = (all || []).filter(Boolean);
    console.log(`[admin/reviews GET] returning ${reviews.length} reviews`);
    return c.json({ success: true, data: reviews });
  } catch (error) {
    console.log('[admin/reviews GET] error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// POST /admin/reviews — create or update a fake review (no purchase check)
app.post('/make-server-e07959ec/admin/reviews', requireAuth, async (c) => {
  try {
    const { toolId, userId: existingUserId, userName, rating, comment, createdAt } = await c.req.json();
    if (!toolId) return c.json({ success: false, error: 'toolId is required' }, 400);
    const ratingNum = Number(rating);
    if (!ratingNum || ratingNum < 1 || ratingNum > 5)
      return c.json({ success: false, error: 'rating must be 1–5' }, 400);

    const { data: toolRow } = await supabase.from('tools').select('id').eq('id', toolId).maybeSingle();
    if (!toolRow) return c.json({ success: false, error: 'Tool not found' }, 404);

    const now = new Date().toISOString();
    const userId = existingUserId || `admin_${crypto.randomUUID()}`;
    const reviewKey = `review:${toolId}:${userId}`;
    const existing: any = await kv.get(reviewKey);

    const review = {
      id: existing?.id || crypto.randomUUID(),
      toolId,
      userId,
      userName: (userName || 'Anonymous').trim(),
      rating: ratingNum,
      comment: (comment || '').trim(),
      createdAt: createdAt ? new Date(createdAt).toISOString() : (existing?.createdAt || now),
      updatedAt: now,
      isFake: true,
    };
    await kv.set(reviewKey, review);
    console.log(`[admin/reviews POST] ✅ Saved fake review: tool=${toolId} user=${userId} rating=${ratingNum}`);
    return c.json({ success: true, data: review });
  } catch (error) {
    console.log('[admin/reviews POST] error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// DELETE /admin/reviews — delete any review by toolId + userId
app.delete('/make-server-e07959ec/admin/reviews', requireAuth, async (c) => {
  try {
    const { toolId, userId } = await c.req.json();
    if (!toolId || !userId) return c.json({ success: false, error: 'toolId and userId are required' }, 400);
    const reviewKey = `review:${toolId}:${userId}`;
    const existing = await kv.get(reviewKey);
    if (!existing) return c.json({ success: false, error: 'Review not found' }, 404);
    await kv.del(reviewKey);
    console.log(`[admin/reviews DELETE] ✅ Deleted: tool=${toolId} user=${userId}`);
    return c.json({ success: true });
  } catch (error) {
    console.log('[admin/reviews DELETE] error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ── END ADMIN REVIEW ENDPOINTS ─────────────────────────────────────────────────

// DELETE /reviews/:toolId — authenticated: delete own review
app.delete('/make-server-e07959ec/reviews/:toolId', requireUserAuth, async (c) => {
  const user = c.get('user');
  const toolId = c.req.param('toolId');
  try {
    const reviewKey = `review:${toolId}:${user.id}`;
    const existing = await kv.get(reviewKey);
    if (!existing) return c.json({ success: false, error: 'Review not found' }, 404);
    await kv.del(reviewKey);
    console.log(`[reviews DELETE] ✅ Deleted: tool=${toolId} user=${user.id}`);
    return c.json({ success: true });
  } catch (error) {
    console.log('[reviews DELETE] error:', error);
    return c.json({ success: false, error: String(error) }, 500);
  }
});

// ========== SETUP WIZARD ENDPOINTS ==========
// Power the one-time client deployment wizard at /setup.
// These are intentionally unauthenticated — each route has its own guard.

/** GET /setup/status — is setup complete? (any auth users exist?) */
app.get('/make-server-e07959ec/setup/status', async (c) => {
  try {
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
    if (error) return c.json({ success: false, error: error.message }, 500);
    const userCount = data?.users?.length ?? 0;
    return c.json({ success: true, isComplete: userCount > 0, userCount });
  } catch (err) {
    return c.json({ success: false, error: String(err) }, 500);
  }
});

/** GET /setup/check-env — which secrets are configured? (boolean only, never the values) */
app.get('/make-server-e07959ec/setup/check-env', (c) => {
  const keys = [
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
    'RESEND_API_KEY',
    'GEMINI_API_KEY',
    'LEMON_SQUEEZY_API_KEY',
    'LEMON_SQUEEZY_WEBHOOK_SECRET',
    'VIMEO_ACCESS_TOKEN',
  ];
  const vars: Record<string, boolean> = {};
  for (const k of keys) vars[k] = !!Deno.env.get(k);
  return c.json({ success: true, vars });
});

/** POST /setup/create-admin — creates the FIRST admin (blocked if any user exists) */
app.post('/make-server-e07959ec/setup/create-admin', async (c) => {
  try {
    const { email, password } = await c.req.json();
    if (!email || !password) return c.json({ success: false, error: 'Email and password are required' }, 400);
    if (password.length < 8)  return c.json({ success: false, error: 'Password must be at least 8 characters' }, 400);

    // Security gate — only works when no users exist yet
    const { data: existing } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 });
    if ((existing?.users?.length ?? 0) > 0) {
      return c.json({ success: false, error: 'An admin account already exists. Go to /admin/login.' }, 403);
    }

    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
    });
    if (error) return c.json({ success: false, error: error.message }, 400);

    console.log('✅ Setup: first admin created for', data.user.email);
    return c.json({ success: true, user: { id: data.user.id, email: data.user.email } });
  } catch (err) {
    return c.json({ success: false, error: String(err) }, 500);
  }
});

/** POST /setup/brand — saves initial brand settings to site_settings */
app.post('/make-server-e07959ec/setup/brand', async (c) => {
  try {
    const body = await c.req.json();

    // Scalar settings — each saved as its own row
    const scalarKeys = ['studioName', 'contactEmail', 'siteUrl', 'calendlyUrl', 'showreelUrl'];
    for (const key of scalarKeys) {
      if (body[key] !== undefined && body[key] !== '') {
        await supabase.from('site_settings').upsert(
          { key, value: body[key], updated_at: new Date().toISOString() },
          { onConflict: 'key' },
        );
      }
    }

    // Social links — save both individual keys (legacy) AND the combined
    // socialLinks object that the footer and StyleTab read from.
    const socialKeys = ['linkedin', 'instagram', 'twitter', 'tiktok', 'behance', 'dribbble'];
    const socialLinks: Record<string, string> = {};
    for (const key of socialKeys) {
      socialLinks[key] = body[key] || '';
      if (body[key] !== undefined && body[key] !== '') {
        await supabase.from('site_settings').upsert(
          { key, value: body[key], updated_at: new Date().toISOString() },
          { onConflict: 'key' },
        );
      }
    }
    // Always write the combined object so the footer resolves social links correctly
    await supabase.from('site_settings').upsert(
      { key: 'socialLinks', value: socialLinks, updated_at: new Date().toISOString() },
      { onConflict: 'key' },
    );

    console.log('✅ Setup: brand settings saved');
    return c.json({ success: true });
  } catch (err) {
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// ═══════════════════════════════════════════════════════════════════
// TRANSLATIONS  (Phase 2 — i18n dynamic content)
// KV key format:  translations:{lang}:{type}
//   lang  = 'fr' | 'ar'
//   type  = 'home' | 'projects' | 'tools' | 'team' | 'categories'
// The stored value is a nested JSON matching the source shape.
// ═══════════════════════════════════════════════════════════════════

const VALID_TRANS_LANGS = ['fr', 'ar'] as const;
const VALID_TRANS_TYPES = ['home', 'projects', 'tools', 'team', 'categories', 'legal'] as const;

/** GET /translations/:lang/:type — public */
app.get('/make-server-e07959ec/translations/:lang/:type', async (c) => {
  const lang = c.req.param('lang');
  const type = c.req.param('type');
  if (!VALID_TRANS_LANGS.includes(lang as any) || !VALID_TRANS_TYPES.includes(type as any)) {
    return c.json({ success: false, error: 'Invalid lang or type' }, 400);
  }
  try {
    const raw = await kv.get(`translations:${lang}:${type}`);
    const data = raw ? JSON.parse(raw) : {};
    return c.json({ success: true, data });
  } catch (err) {
    console.log('[translations GET] error:', err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

/** PUT /translations/:lang/:type — admin only */
app.put('/make-server-e07959ec/translations/:lang/:type', requireAuth, async (c) => {
  const lang = c.req.param('lang');
  const type = c.req.param('type');
  if (!VALID_TRANS_LANGS.includes(lang as any) || !VALID_TRANS_TYPES.includes(type as any)) {
    return c.json({ success: false, error: 'Invalid lang or type' }, 400);
  }
  try {
    const body = await c.req.json();
    await kv.set(`translations:${lang}:${type}`, JSON.stringify(body));
    console.log(`✅ Translations saved: ${lang}:${type}`);
    return c.json({ success: true });
  } catch (err) {
    console.log('[translations PUT] error:', err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

/** POST /admin/translate-legal-html — Gemini HTML-aware translation for legal pages.
 *  Body: { lang, langName, page, htmlContent }
 *  Returns: { success: true, data: { translatedHtml: string } }
 */
app.post('/make-server-e07959ec/admin/translate-legal-html', requireAuth, async (c) => {
  try {
    const { lang, langName, page, htmlContent } = await c.req.json() as {
      lang: string; langName: string; page: string; htmlContent: string;
    };
    if (!lang || !langName || !htmlContent) {
      return c.json({ success: false, error: 'lang, langName, and htmlContent are required' }, 400);
    }
    const { apiKey, model: geminiModel } = await getGeminiConfig();
    if (!apiKey) return c.json({ success: false, error: 'GEMINI_API_KEY not configured' }, 500);

    const arabicNote = lang === 'ar'
      ? '\n- Use formal Modern Standard Arabic (فصحى) with a professional, premium legal tone.\n- Numbers stay in their original Western form.'
      : '';

    const prompt = `You are a professional legal translator for Fastoosh, a premium motion design studio.

Translate the following HTML legal document (${page}) from English into ${langName}.

CRITICAL RULES — you MUST follow these exactly:
- Translate ONLY the visible text content inside HTML tags.
- Preserve ALL HTML tags, attributes, and structure exactly as they appear (<h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <a href="...">, etc.).
- Do NOT add, remove, or modify any HTML tags.
- Do NOT translate: brand names (Fastoosh, After Effects, Premiere Pro, Lemon Squeezy, Adobe), URLs, email addresses, technical terms.
- Keep a professional legal tone appropriate for a premium creative studio.
- Return ONLY the translated HTML — no markdown, no code fences, no explanation.${arabicNote}

HTML to translate:
${htmlContent}`;

    const geminiRes = await fetch(
      geminiUrl(geminiModel, apiKey),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 32000 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      const errorMsg = `Gemini API error (${geminiRes.status}): ${errText.substring(0, 400)}`;
      if (geminiRes.status === 429) {
        return c.json({ success: false, error: errorMsg, rateLimitExceeded: true }, 429);
      }
      return c.json({ success: false, error: errorMsg }, 500);
    }

    const geminiData = await geminiRes.json();
    const translatedHtml = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!translatedHtml) return c.json({ success: false, error: 'Gemini returned empty response' }, 500);

    // Strip possible code fences that Gemini sometimes adds despite instructions
    const cleaned = translatedHtml
      .replace(/^```html\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    console.log(`✅ Legal HTML translated (${page}) → ${langName} (${cleaned.length} chars)`);
    return c.json({ success: true, data: { translatedHtml: cleaned } });
  } catch (err) {
    console.log('[translate-legal-html] error:', err);
    return c.json({ success: false, error: `Translation failed: ${String(err)}` }, 500);
  }
});

/** POST /admin/translate — Gemini batch translation.
 *  Body: { lang, langName, fields: Record<string,string> }
 *  Returns: { success: true, data: Record<string,string> }
 */
app.post('/make-server-e07959ec/admin/translate', requireAuth, async (c) => {
  try {
    const { lang, langName, fields } = await c.req.json() as {
      lang: string; langName: string; fields: Record<string, string>;
    };
    if (!lang || !langName || !fields || Object.keys(fields).length === 0) {
      return c.json({ success: false, error: 'lang, langName, and fields are required' }, 400);
    }
    const { apiKey, model: geminiModel } = await getGeminiConfig();
    if (!apiKey) return c.json({ success: false, error: 'GEMINI_API_KEY not configured' }, 500);

    const arabicNote = lang === 'ar'
      ? '\n- Use formal Modern Standard Arabic (فصحى) with a professional, premium tone.\n- Numbers and brand names stay in their original form (Fastoosh, After Effects, Premiere Pro).'
      : '';

    const prompt = `You are a professional translator for Fastoosh, a premium motion design studio.

Translate ALL values in the JSON below from English into ${langName}.

Rules:
- Maintain brand voice: premium, confident, creative, modern. Not salesy.
- Do NOT translate: brand names (Fastoosh, After Effects, Premiere Pro, Lemon Squeezy), URLs, email addresses.
- Keep the same tone and approximate length as the English source.
- Empty strings remain empty strings.
- Return ONLY valid JSON — same keys, translated values. No markdown, no explanation.${arabicNote}

Input:
${JSON.stringify(fields, null, 2)}`;

    const geminiRes = await fetch(
      geminiUrl(geminiModel, apiKey),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseMimeType: 'application/json', temperature: 0.25, maxOutputTokens: 16000 },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      const errorMsg = `Gemini API error (${geminiRes.status}): ${errText.substring(0, 400)}`;
      
      // Return 429 status code for rate limit errors so frontend can detect them
      if (geminiRes.status === 429) {
        return c.json({ success: false, error: errorMsg, rateLimitExceeded: true }, 429);
      }
      
      return c.json({ success: false, error: errorMsg }, 500);
    }

    const geminiData = await geminiRes.json();
    const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!rawText) return c.json({ success: false, error: 'Gemini returned empty response' }, 500);

    let translated: Record<string, string>;
    try {
      translated = JSON.parse(repairJson(rawText));
    } catch (parseErr) {
      console.log('[translate] JSON parse failed. Raw:', rawText.substring(0, 500));
      return c.json({ success: false, error: `AI response was not valid JSON: ${String(parseErr)}` }, 500);
    }

    console.log(`✅ Translated ${Object.keys(translated).length} fields → ${langName}`);
    return c.json({ success: true, data: translated });
  } catch (err) {
    console.log('[translate] error:', err);
    return c.json({ success: false, error: `Translation failed: ${String(err)}` }, 500);
  }
});

// ========== BRANDED PASSWORD RESET EMAIL ==========

// Generates a cryptographically random 8-char alphanumeric ID for short links.
function generateShortId(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes).map(b => chars[b % chars.length]).join('');
}

// GET /r/:id — resolves a short reset link and redirects to the full Supabase URL.
// The entry is single-use and expires after 1 hour.
app.get('/make-server-e07959ec/r/:id', async (c) => {
  const id = c.req.param('id');
  const fallback = 'https://www.fastoosh.com/auth/reset-password?error=link_expired';
  try {
    const entry = await kv.get(`r:${id}`);
    if (!entry || !entry.url) return c.redirect(fallback, 302);
    if (Date.now() > entry.expiresAt) {
      await kv.del(`r:${id}`);
      return c.redirect(fallback, 302);
    }
    // Single-use: delete before redirecting
    await kv.del(`r:${id}`);
    return c.redirect(entry.url, 302);
  } catch (err) {
    console.log('[short-link] Error resolving short link:', err);
    return c.redirect(fallback, 302);
  }
});

// POST /auth/forgot-password
// Generates a Supabase recovery link via the admin API and delivers it through
// a fully-branded Resend email so it arrives from @contact.fastoosh.com, not Supabase.
// Always returns 200 to prevent email enumeration.
app.post('/make-server-e07959ec/auth/forgot-password', async (c) => {
  try {
    const { email, redirectTo } = await c.req.json();

    if (!email || typeof email !== 'string' || !/\S+@\S+\.\S+/.test(email)) {
      // Return 200 even for invalid input to prevent enumeration
      return c.json({ success: true });
    }

    const safeEmail = email.trim().toLowerCase();

    // The reset URL to embed in the email link — supplied by the frontend so
    // it works in both dev and production environments.
    const resetRedirect = redirectTo || 'https://www.fastoosh.com/auth/reset-password';

    // Generate the actual Supabase magic link (admin API, bypasses email sending)
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'recovery',
      email: safeEmail,
      options: { redirectTo: resetRedirect },
    });

    if (linkError) {
      // User not found — still return 200 silently
      console.log(`[forgot-password] generateLink skipped for ${safeEmail}: ${linkError.message}`);
      return c.json({ success: true });
    }

    const resetLink = linkData?.properties?.action_link;
    if (!resetLink) {
      console.log(`[forgot-password] No action_link returned for ${safeEmail}`);
      return c.json({ success: true });
    }

    // Shorten the link: store full URL in KV and expose a tiny redirect URL
    const shortId  = generateShortId();
    const baseUrl  = Deno.env.get('SUPABASE_URL') ?? '';
    const shortUrl = `${baseUrl}/functions/v1/make-server-e07959ec/r/${shortId}`;
    await kv.set(`r:${shortId}`, { url: resetLink, expiresAt: Date.now() + 3600 * 1000 });

    // Send via Resend
    const resendKey = Deno.env.get('RESEND_API_KEY');
    if (!resendKey) {
      console.warn('[forgot-password] RESEND_API_KEY not set — falling back silently');
      return c.json({ success: true });
    }

    // Fetch optional reply-to address from site settings
    const { data: replyToRow } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'emailReplyTo')
      .maybeSingle();
    const replyToAddress = replyToRow?.value as string | undefined;

    const resend = new Resend(resendKey);
    const year   = new Date().getFullYear();

    const { error: sendError } = await resend.emails.send({
      from:    'Fastoosh <noreply@contact.fastoosh.com>',
      to:      safeEmail,
      subject: 'Reset your Fastoosh password',
      ...(replyToAddress ? { replyTo: replyToAddress } : {}),
      html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#09090b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#09090b;padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;" cellpadding="0" cellspacing="0">

        <!-- Logo / brand header -->
        <tr>
          <td align="center" style="padding-bottom:32px;">
            <span style="font-size:22px;font-weight:800;letter-spacing:-0.5px;color:#fff;">
              fast<span style="background:linear-gradient(90deg,#a855f7,#6366f1);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;">oosh</span>
            </span>
          </td>
        </tr>

        <!-- Card -->
        <tr>
          <td style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:16px;overflow:hidden;">

            <!-- Gradient stripe -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="height:4px;background:linear-gradient(90deg,#a855f7,#6366f1,#3b82f6);"></td>
              </tr>
            </table>

            <!-- Body -->
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="padding:36px 36px 28px;">

                  <!-- Icon -->
                  <table cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
                    <tr>
                      <td style="width:48px;height:48px;background:rgba(168,85,247,0.12);border:1px solid rgba(168,85,247,0.25);border-radius:12px;text-align:center;vertical-align:middle;">
                        <span style="font-size:22px;">🔑</span>
                      </td>
                    </tr>
                  </table>

                  <h1 style="margin:0 0 8px;font-size:22px;font-weight:700;color:#fff;line-height:1.3;">
                    Reset your password
                  </h1>
                  <p style="margin:0 0 24px;font-size:15px;color:rgba(255,255,255,0.5);line-height:1.6;">
                    We received a request to reset the password for your Fastoosh account
                    associated with <strong style="color:rgba(255,255,255,0.75);">${safeEmail}</strong>.
                  </p>

                  <!-- CTA button -->
                  <table cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                    <tr>
                      <td style="background:linear-gradient(135deg,#a855f7,#6366f1);border-radius:10px;">
                        <a href="${shortUrl}"
                           style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:700;color:#fff;text-decoration:none;letter-spacing:0.01em;">
                          Reset my password →
                        </a>
                      </td>
                    </tr>
                  </table>

                  <!-- Fallback URL -->
                  <p style="margin:0 0 6px;font-size:12px;color:rgba(255,255,255,0.3);">
                    Button not working? Copy and paste this link into your browser:
                  </p>
                  <p style="margin:0 0 28px;font-size:11px;word-break:break-all;">
                    <a href="${shortUrl}" style="color:#a78bfa;text-decoration:none;">${shortUrl}</a>
                  </p>

                  <!-- Warning box -->
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:16px 18px;">
                        <p style="margin:0;font-size:13px;color:rgba(255,255,255,0.4);line-height:1.6;">
                          ⏱ This link <strong style="color:rgba(255,255,255,0.6);">expires in 1 hour</strong>.
                          If you didn't request a password reset, you can safely ignore this email —
                          your account remains secure.
                        </p>
                      </td>
                    </tr>
                  </table>

                </td>
              </tr>
            </table>

          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td align="center" style="padding-top:28px;">
            <p style="margin:0;font-size:12px;color:rgba(255,255,255,0.2);line-height:1.7;">
              © ${year} Fastoosh · Premium Motion Design Studio<br>
              <a href="https://www.fastoosh.com" style="color:rgba(255,255,255,0.25);text-decoration:none;">www.fastoosh.com</a>
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
    });

    if (sendError) {
      console.log(`[forgot-password] Resend error for ${safeEmail}:`, sendError);
    } else {
      console.log(`✅ [forgot-password] Branded reset email sent to ${safeEmail}`);
    }

    return c.json({ success: true });
  } catch (err) {
    console.log('[forgot-password] Unexpected error:', err);
    // Always 200 to prevent enumeration
    return c.json({ success: true });
  }
});

// ── UTM Saved Links ────────────────────────────────────────────────────────────

// GET /utm-saved — list all saved UTM links, newest first (admin only)
app.get('/make-server-e07959ec/utm-saved', requireAuth, async (c) => {
  try {
    const items = await kv.getByPrefix('utm:saved:');
    const links = items
      .filter((v: any) => v && v.id)
      .sort((a: any, b: any) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
    return c.json({ success: true, data: links });
  } catch (err) {
    console.log('[utm-saved] GET error:', err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// POST /utm-saved — persist a new UTM link (admin only)
app.post('/make-server-e07959ec/utm-saved', requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { label, platform, page, source, medium, campaign, content, url, tags } = body;
    if (!source || !url) {
      return c.json({ success: false, error: 'source and url are required' }, 400);
    }
    const id = String(Date.now());
    const entry = {
      id,
      label:    (label || source).trim(),
      platform: platform ?? null,
      page,
      source,
      medium:   medium   ?? '',
      campaign: campaign ?? '',
      content:  content  ?? '',
      url,
      tags:     Array.isArray(tags) ? tags.map((t: string) => t.trim().toLowerCase()).filter(Boolean) : [],
      savedAt:  new Date().toISOString(),
    };
    await kv.set(`utm:saved:${id}`, entry);
    return c.json({ success: true, data: entry });
  } catch (err) {
    console.log('[utm-saved] POST error:', err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// GET /utm-saved/stats — session counts keyed by utm source|medium|campaign (admin only)
// NOTE: registered BEFORE the PATCH/DELETE /:id routes to avoid path collision
app.get('/make-server-e07959ec/utm-saved/stats', requireAuth, async (c) => {
  try {
    const allSessions: any[] = await kv.getByPrefix('session:');
    const exact:          Record<string, { sessions: number; converted: number }> = {};
    const bySourceMedium: Record<string, { sessions: number; converted: number }> = {};
    const bySource:       Record<string, { sessions: number; converted: number }> = {};

    const inc = (map: typeof exact, key: string, converted: boolean) => {
      if (!map[key]) map[key] = { sessions: 0, converted: 0 };
      map[key].sessions++;
      if (converted) map[key].converted++;
    };

    let utmSessionCount = 0;
    const utmSamples: { src: string; med: string; cmp: string }[] = [];

    for (const s of allSessions) {
      const src  = (s.utmSource   || '').toLowerCase();
      const med  = (s.utmMedium   || '').toLowerCase();
      const cmp  = (s.utmCampaign || '').toLowerCase();
      const conv = !!s.converted;
      if (!src) continue;
      utmSessionCount++;
      if (utmSamples.length < 10) utmSamples.push({ src, med, cmp });
      inc(exact,          `${src}|${med}|${cmp}`, conv);
      inc(bySourceMedium, `${src}|${med}`,         conv);
      inc(bySource,        src,                    conv);
    }

    console.log(`[utm-saved/stats] total=${allSessions.length} withUTM=${utmSessionCount} keys=${Object.keys(exact).join(', ') || 'none'}`);

    return c.json({
      success: true,
      data: { exact, bySourceMedium, bySource },
      // Diagnostic fields visible in admin
      _diag: {
        totalSessions: allSessions.length,
        utmSessions:   utmSessionCount,
        utmKeys:       Object.keys(exact),
        samples:       utmSamples,
      },
    });
  } catch (err) {
    console.log('[utm-saved/stats] GET error:', err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// PATCH /utm-saved/:id — update label and/or tags of an existing saved link (admin only)
app.patch('/make-server-e07959ec/utm-saved/:id', requireAuth, async (c) => {
  try {
    const id      = c.req.param('id');
    const body    = await c.req.json();
    const current = await kv.get(`utm:saved:${id}`);
    if (!current) return c.json({ success: false, error: 'Not found' }, 404);
    const updated = {
      ...current,
      label: typeof body.label === 'string' ? body.label.trim() || current.label : current.label,
      tags:  Array.isArray(body.tags)
        ? body.tags.map((t: string) => t.trim().toLowerCase()).filter(Boolean)
        : current.tags ?? [],
    };
    await kv.set(`utm:saved:${id}`, updated);
    return c.json({ success: true, data: updated });
  } catch (err) {
    console.log('[utm-saved] PATCH error:', err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// DELETE /utm-saved/:id — remove a saved UTM link (admin only)
app.delete('/make-server-e07959ec/utm-saved/:id', requireAuth, async (c) => {
  try {
    const id = c.req.param('id');
    await kv.del(`utm:saved:${id}`);
    return c.json({ success: true });
  } catch (err) {
    console.log('[utm-saved] DELETE error:', err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// GET /admin/debug/sessions — returns the 20 most-recent raw KV sessions (admin only)
// Lets admins verify that page-view tracking is actually writing data to KV.
app.get('/make-server-e07959ec/admin/debug/sessions', requireAuth, async (c) => {
  try {
    const all: any[] = await kv.getByPrefix('session:');
    const recent = all
      .filter((s: any) => s && s.startedAt)
      .sort((a: any, b: any) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
      .slice(0, 20)
      .map((s: any) => ({
        sessionId:   s.sessionId,
        startedAt:   s.startedAt,
        device:      s.device,
        browser:     s.browser,
        utmSource:   s.utmSource   ?? null,
        utmMedium:   s.utmMedium   ?? null,
        utmCampaign: s.utmCampaign ?? null,
        referrer:    s.referrer    ?? '',
        pageViews:   (s.events || []).filter((e: any) => e.type === 'page_view').length,
        pages:       [...new Set((s.events || []).filter((e: any) => e.type === 'page_view').map((e: any) => e.data?.path))],
        converted:   !!s.converted,
      }));
    return c.json({ success: true, data: { total: all.length, recent } });
  } catch (err) {
    console.log('[admin/debug/sessions] error:', err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// ========== VIMEO INTEGRATION ==========

// GET /admin/vimeo/videos — proxy to Vimeo API, returns the admin's video library
app.get('/make-server-e07959ec/admin/vimeo/videos', requireAuth, async (c) => {
  try {
    const accessToken = Deno.env.get('VIMEO_ACCESS_TOKEN');
    if (!accessToken) {
      console.error('[vimeo] VIMEO_ACCESS_TOKEN is not set');
      return c.json({ success: false, error: 'Vimeo access token not configured on server.' }, 500);
    }

    const page      = c.req.query('page')      || '1';
    const query     = c.req.query('query')     || '';
    const sort      = c.req.query('sort')      || 'date';
    const direction = c.req.query('direction') || 'desc';
    const perPage   = 20;

    // Allowlist sort values to prevent injection
    const VALID_SORTS = ['date', 'alphabetical', 'plays', 'likes', 'comments', 'duration'];
    const safeSort      = VALID_SORTS.includes(sort) ? sort : 'date';
    const safeDirection = direction === 'asc' ? 'asc' : 'desc';

    let vimeoUrl =
      `https://api.vimeo.com/me/videos` +
      `?page=${page}&per_page=${perPage}` +
      `&fields=uri,name,description,duration,pictures,link,modified_time` +
      `&sort=${safeSort}&direction=${safeDirection}`;

    if (query.trim()) {
      vimeoUrl += `&query=${encodeURIComponent(query.trim())}`;
    }

    const res = await fetch(vimeoUrl, {
      headers: {
        Authorization: `bearer ${accessToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/vnd.vimeo.*+json;version=3.4',
      },
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error(`[vimeo] API error ${res.status}:`, errText);
      // Always return 200 so Supabase's edge-function proxy never rewrites the body
      return c.json({ success: false, error: `Vimeo API returned ${res.status}: ${errText}` });
    }

    const data = await res.json();

    const videos = (data.data || []).map((v: any) => {
      // Pick the best thumbnail ≥ 640 px wide, fallback to largest available
      const sizes: any[] = v.pictures?.sizes ?? [];
      const thumb =
        sizes.find((s: any) => s.width >= 640)?.link_with_play_button ||
        sizes.find((s: any) => s.width >= 640)?.link ||
        sizes[sizes.length - 1]?.link ||
        null;

      const id = (v.uri as string)?.split('/').pop() ?? '';

      return {
        id,
        title: v.name ?? '(Untitled)',
        description: v.description ?? '',
        duration: v.duration ?? 0,
        link: v.link ?? `https://vimeo.com/${id}`,
        thumbnail: thumb,
        modifiedTime: v.modified_time ?? null,
      };
    });

    return c.json({
      success:    true,
      videos,
      total:      data.total      ?? 0,
      page:       data.page       ?? 1,
      perPage:    data.per_page   ?? perPage,
      totalPages: Math.ceil((data.total ?? 0) / perPage),
    });
  } catch (err) {
    console.error('[vimeo] Unexpected error:', err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// ========== ADMIN RESET / INITIALIZE ==========

// GET /admin/reset/stats — live item counts for each resettable category
app.get('/make-server-e07959ec/admin/reset/stats', requireAuth, async (c) => {
  try {
    const [
      trafficRes,
      messagesRes,
      reviewsRes,
      leadsRes,
      usersData,
      videoProjectRes,
      videoShowreelRes,
    ] = await Promise.all([
      supabase.from('kv_store_e07959ec').select('key', { count: 'exact', head: true }).like('key', 'session:%'),
      supabase.from('kv_store_e07959ec').select('key', { count: 'exact', head: true }).like('key', 'msg:%'),
      supabase.from('kv_store_e07959ec').select('key', { count: 'exact', head: true }).like('key', 'review:%'),
      supabase.from('kv_store_e07959ec').select('key', { count: 'exact', head: true }).like('key', 'lead:%'),
      supabase.auth.admin.listUsers({ perPage: 1000 }),
      supabase.from('kv_store_e07959ec').select('key', { count: 'exact', head: true }).like('key', 'project_video_stats:%'),
      supabase.from('kv_store_e07959ec').select('key', { count: 'exact', head: true }).eq('key', 'showreel_video_stats'),
    ]);
    const userCount  = Math.max(0, (usersData.data?.users?.length ?? 1) - 1);
    const videoCount = (videoProjectRes.count ?? 0) + (videoShowreelRes.count ?? 0);
    return c.json({
      success: true,
      data: {
        traffic:  trafficRes.count  ?? 0,
        messages: messagesRes.count ?? 0,
        reviews:  reviewsRes.count  ?? 0,
        leads:    leadsRes.count    ?? 0,
        users:    userCount,
        videos:   videoCount,
      },
    });
  } catch (err) {
    console.log('[admin/reset/stats] Error:', err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// POST /admin/reset — selective data initialization
// Body: { email, password, categories: { traffic, messages, reviews, leads, users, videos } }
app.post('/make-server-e07959ec/admin/reset', requireAuth, async (c) => {
  try {
    const { email, password, categories } = await c.req.json();

    if (!email || !password) {
      return c.json({ success: false, error: 'Email and password are required for confirmation.' }, 400);
    }

    // ── Extra security gate: re-verify credentials before any destructive action ──
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
    );
    const { data: authData, error: authError } = await authClient.auth.signInWithPassword({ email, password });
    if (authError || !authData.user) {
      console.log('[admin/reset] Password re-verification failed:', authError?.message);
      return c.json({ success: false, error: 'Incorrect password. Reset cancelled for security.' }, 401);
    }

    const adminUserId = authData.user.id;
    const report: Record<string, { deleted: number; error?: string }> = {};

    // ── Traffic & Sessions ───���────────────────────────────────────────────────
    if (categories?.traffic) {
      try {
        const { data, error } = await supabase
          .from('kv_store_e07959ec')
          .delete()
          .like('key', 'session:%')
          .select('key');
        if (error) throw error;
        report.traffic = { deleted: data?.length ?? 0 };
        console.log(`[admin/reset] ✅ Traffic: deleted ${data?.length ?? 0} sessions`);
      } catch (err) {
        console.log('[admin/reset] ❌ Traffic error:', err);
        report.traffic = { deleted: 0, error: String(err) };
      }
    }

    // ── Contact Messages ──────────────────────────────────────────────────────
    if (categories?.messages) {
      try {
        const { data, error } = await supabase
          .from('kv_store_e07959ec')
          .delete()
          .like('key', 'msg:%')
          .select('key');
        if (error) throw error;
        report.messages = { deleted: data?.length ?? 0 };
        console.log(`[admin/reset] ✅ Messages: deleted ${data?.length ?? 0}`);
      } catch (err) {
        console.log('[admin/reset] ❌ Messages error:', err);
        report.messages = { deleted: 0, error: String(err) };
      }
    }

    // ── Reviews & Ratings ────────────────────────────────────────────────────
    if (categories?.reviews) {
      try {
        const { data, error } = await supabase
          .from('kv_store_e07959ec')
          .delete()
          .like('key', 'review:%')
          .select('key');
        if (error) throw error;
        report.reviews = { deleted: data?.length ?? 0 };
        console.log(`[admin/reset] ✅ Reviews: deleted ${data?.length ?? 0}`);
      } catch (err) {
        console.log('[admin/reset] ❌ Reviews error:', err);
        report.reviews = { deleted: 0, error: String(err) };
      }
    }

    // ── Free Download Leads + OTPs ────────────────────────────────────────────
    if (categories?.leads) {
      try {
        const [leadsRes, otpRes] = await Promise.all([
          supabase.from('kv_store_e07959ec').delete().like('key', 'lead:%').select('key'),
          supabase.from('kv_store_e07959ec').delete().like('key', 'otp:%').select('key'),
        ]);
        if (leadsRes.error) throw leadsRes.error;
        if (otpRes.error)   throw otpRes.error;
        const total = (leadsRes.data?.length ?? 0) + (otpRes.data?.length ?? 0);
        report.leads = { deleted: total };
        console.log(`[admin/reset] ✅ Leads: deleted ${total} entries`);
      } catch (err) {
        console.log('[admin/reset] ❌ Leads error:', err);
        report.leads = { deleted: 0, error: String(err) };
      }
    }

    // ── User Accounts ─────────────────────────────────────────────────────────
    if (categories?.users) {
      try {
        const { data: usersData, error: listErr } = await supabase.auth.admin.listUsers({ perPage: 1000 });
        if (listErr) throw new Error(`Failed to list users: ${listErr.message}`);

        const allUsers    = usersData?.users ?? [];
        const nonAdmins   = allUsers.filter(u => u.id !== adminUserId);
        const nonAdminIds = nonAdmins.map(u => u.id);

        // Delete auth accounts
        let deletedAuth = 0;
        for (const userId of nonAdminIds) {
          const { error } = await supabase.auth.admin.deleteUser(userId);
          if (error) console.warn(`[admin/reset] Warning: could not delete auth user ${userId}:`, error.message);
          else deletedAuth++;
        }

        // Delete DB rows for removed users
        if (nonAdminIds.length > 0) {
          await Promise.allSettled([
            supabase.from('user_profiles').delete().in('user_id', nonAdminIds),
            supabase.from('user_purchases').delete().in('user_id', nonAdminIds),
          ]);
        }

        // Clean KV download records + pending signup OTPs
        await Promise.allSettled([
          supabase.from('kv_store_e07959ec').delete().like('key', 'user:dl:%'),
          supabase.from('kv_store_e07959ec').delete().like('key', 'signup_otp:%'),
        ]);

        report.users = { deleted: deletedAuth };
        console.log(`[admin/reset] ✅ Users: deleted ${deletedAuth} of ${nonAdmins.length} non-admin accounts`);
      } catch (err) {
        console.log('[admin/reset] ❌ Users error:', err);
        report.users = { deleted: 0, error: String(err) };
      }
    }

    // ── Video Analytics ───────────────────────────────────────────────────────
    if (categories?.videos) {
      try {
        const [projectVidsRes, showreelRes] = await Promise.all([
          supabase.from('kv_store_e07959ec').delete().like('key', 'project_video_stats:%').select('key'),
          supabase.from('kv_store_e07959ec').delete().eq('key', 'showreel_video_stats').select('key'),
        ]);
        if (projectVidsRes.error) throw projectVidsRes.error;
        if (showreelRes.error)    throw showreelRes.error;
        const total = (projectVidsRes.data?.length ?? 0) + (showreelRes.data?.length ?? 0);
        report.videos = { deleted: total };
        console.log(`[admin/reset] ✅ Videos: deleted ${total} analytics entries`);
      } catch (err) {
        console.log('[admin/reset] ❌ Videos error:', err);
        report.videos = { deleted: 0, error: String(err) };
      }
    }

    console.log('[admin/reset] ✅ Reset complete:', JSON.stringify(report));
    return c.json({ success: true, report });
  } catch (error) {
    console.log('[admin/reset] Unexpected error:', error);
    return c.json({ success: false, error: `Reset failed: ${String(error)}` }, 500);
  }
});

// ========== TOOL GUIDES ==========

// GET /tools/:slug/guide-exists — public, check if a guide HTML exists for this tool
app.get('/make-server-e07959ec/tools/:slug/guide-exists', async (c) => {
  try {
    const slug = c.req.param('slug');
    const { data, error } = await supabase.storage
      .from(GUIDE_BUCKET_NAME)
      .list(slug, { limit: 5 });
    if (error) {
      console.log(`[guide-exists] Storage list error for "${slug}":`, error.message);
      return c.json({ exists: false });
    }
    const exists = Array.isArray(data) && data.some(f => f.name === 'guide.html');
    return c.json({ exists });
  } catch (err) {
    console.log('[guide-exists] Unexpected error:', err);
    return c.json({ exists: false });
  }
});

// GET /tools/:slug/guide-html — public, fetch the raw guide HTML
app.get('/make-server-e07959ec/tools/:slug/guide-html', async (c) => {
  try {
    const slug = c.req.param('slug');
    const path = `${slug}/guide.html`;
    const { data, error } = await supabase.storage
      .from(GUIDE_BUCKET_NAME)
      .download(path);
    if (error || !data) {
      console.log(`[guide-html] Not found for slug "${slug}":`, error?.message);
      return c.json({ success: false, error: 'Guide not found' }, 404);
    }
    const html = await data.text();
    return c.json({ success: true, html });
  } catch (err) {
    console.log('[guide-html] Unexpected error:', err);
    return c.json({ success: false, error: `Failed to fetch guide: ${String(err)}` }, 500);
  }
});

// ── Shared Gemini dark-theme transformation ───────────────────────────────────
async function applyDarkThemeWithGemini(originalHtml: string): Promise<{ ok: true; html: string } | { ok: false; error: string }> {
  const { apiKey, model: geminiModel } = await getGeminiConfig();
  if (!apiKey) return { ok: false, error: 'GEMINI_API_KEY not configured' };

  const prompt = `You are a dark-theme conversion expert. Transform this HTML document from a light theme to a dark theme.

CRITICAL RULES (must follow all):
1. Preserve the COMPLETE HTML structure — every tag, attribute, class, ID stays exactly the same.
2. Preserve ALL non-color CSS: font-size, font-weight, font-family, line-height, margin, padding, border-radius, border-width, width, height, display, flex, grid, transform, etc.
3. Preserve ALL text content exactly as-is.
4. ONLY modify color-related values: background, background-color, color, border-color, fill, stroke, outline-color, box-shadow colors.

DARK COLOR MAP:
• White/near-white bg (#fff, #ffffff, #fafafa, #f8f8f8, #f5f5f5) → #0a0a0f
• Light gray bg (#eee, #e8e8e8, #e0e0e0, #ddd) → rgba(255,255,255,0.05)
• Medium gray bg (#ccc, #bbb) → rgba(255,255,255,0.08)
• Black/very dark text (#000, #111, #1a1a1a, #222, #333) → rgba(255,255,255,0.85)
• Dark gray text (#444, #555) → rgba(255,255,255,0.65)
• Medium gray text (#666, #777, #888) → rgba(255,255,255,0.50)
• Light gray text (#999, #aaa, #bbb) → rgba(255,255,255,0.35)
• Blue/purple links → #a855f7
• Light borders (#ddd, #e0e0e0, #ccc) → rgba(255,255,255,0.10)
• Dark borders (#333, #444) → rgba(255,255,255,0.18)

HEADINGS — apply gradient text via inline style (keep all existing non-color styles):
• h1 → add: background: linear-gradient(135deg, #a855f7, #7c3aed); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
• h2, h3 → color: #a855f7
• h4, h5, h6 → color: rgba(168,85,247,0.80)

CODE: <code> → background: rgba(0,0,0,0.45); color: #a855f7
      <pre>  → background: rgba(0,0,0,0.45); color: rgba(255,255,255,0.80)

CALLOUT BOXES (class contains: tip, note, warning, caution, danger, error, info, success, alert, callout, admonition):
• tip / success / hint → background: rgba(124,58,237,0.10); border-color: rgba(124,58,237,0.35); color: rgba(196,181,253,0.90)
• warning / caution   → background: rgba(245,158,11,0.10); border-color: rgba(245,158,11,0.35); color: rgba(252,211,77,0.90)
• error / danger      → background: rgba(239,68,68,0.10);  border-color: rgba(239,68,68,0.35);  color: rgba(252,165,165,0.90)
• info / note         → background: rgba(99,102,241,0.10); border-color: rgba(99,102,241,0.35); color: rgba(165,180,252,0.90)

TABLES: header bg → rgba(124,58,237,0.15); header color → rgba(196,181,253,0.95); all borders → rgba(255,255,255,0.08)

BODY TAG:
• Remove ALL background, background-color, background-image properties from the <body> tag's inline style attribute.
• Inside every <style> block, find any rule that targets body or html (e.g. body { … }, html { … }, html,body { … }) and DELETE the background, background-color, and background-image declarations from those rules entirely — do not replace them, just remove those declarations.
• Then add this rule at the very end of the last <style> block (or create a new <style> block before </head> if none exists):
  body { background-color: rgba(0,0,0,0.55) !important; background-image: none !important; }
  html { background: transparent !important; }

DIV BACKGROUNDS:
• Any <div> element that has a background-color or background set to a solid light or coloured value (anything that is NOT transparent, rgba(...,0), or already a dark near-black value like #0a0a0f) should have that background-color/background set to transparent.
• Exception: divs that have a semantic callout/card class (tip, note, warning, caution, danger, error, info, success, alert, callout, admonition, card, panel, box) keep their callout background per the CALLOUT BOXES rules above.
• Do this for both inline style attributes and inside <style> blocks.

TABLE OF CONTENTS: The page provides its own sidebar navigation, so you MUST remove any inline Table of Contents section from the document. This includes:
• Any heading element (h1–h6) whose visible text matches: "Contents", "Table of Contents", "TOC", "Navigation", "In this guide", "In this article", "In this page" — remove the heading AND the immediately-following list/nav/div element.
• Any element whose id or class contains "toc", "table-of-contents", or "contents" (case-insensitive).
Do NOT add a new TOC. Leave the rest of the document structure unchanged.

Return ONLY the complete transformed HTML. No markdown fences. No explanation. Raw HTML only.

--- HTML DOCUMENT BELOW ---
${originalHtml}`;

  try {
    const res = await fetch(
      geminiUrl(geminiModel, apiKey),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 65536 },
        }),
      }
    );
    if (!res.ok) {
      const txt = await res.text();
      console.log('[guide-theme] Gemini error:', txt);
      return { ok: false, error: `Gemini API error (${res.status})` };
    }
    const json = await res.json();
    let themed = (json.candidates?.[0]?.content?.parts?.[0]?.text ?? '') as string;
    // Strip any accidental markdown fences
    themed = themed.replace(/^```html?\s*/i, '').replace(/```\s*$/, '').trim();
    if (!themed) return { ok: false, error: 'Gemini returned empty response' };
    return { ok: true, html: themed };
  } catch (err) {
    console.log('[guide-theme] Unexpected error:', err);
    return { ok: false, error: String(err) };
  }
}

// POST /tools/:id/guide — admin only, upload HTML guide { html, slug }
// Note: dark theming is handled at render time by ToolGuide.tsx CSS overrides,
// so we just save the original HTML as-is without any Gemini theming step.
app.post('/make-server-e07959ec/tools/:id/guide', requireAuth, async (c) => {
  try {
    const toolId = c.req.param('id');
    const body = await c.req.json();
    const { html, slug } = body;
    if (!html) return c.json({ success: false, error: 'html field is required' }, 400);
    if (!slug) return c.json({ success: false, error: 'slug field is required' }, 400);

    const path = `${slug}/guide.html`;
    const blob = new Blob([html], { type: 'text/html; charset=utf-8' });

    const { error } = await supabase.storage
      .from(GUIDE_BUCKET_NAME)
      .upload(path, blob, { contentType: 'text/html', upsert: true });

    if (error) {
      console.log(`[guide-upload] Error uploading guide for tool "${toolId}":`, error.message);
      return c.json({ success: false, error: error.message }, 500);
    }

    const { data: { publicUrl } } = supabase.storage
      .from(GUIDE_BUCKET_NAME)
      .getPublicUrl(path);

    console.log(`[guide-upload] ✅ Guide saved for tool "${toolId}" at path "${path}"`);
    return c.json({ success: true, url: publicUrl });
  } catch (err) {
    console.log('[guide-upload] Unexpected error:', err);
    return c.json({ success: false, error: `Upload failed: ${String(err)}` }, 500);
  }
});

// POST /tools/:slug/guide-retheme — admin only, re-apply dark theme to an existing guide
app.post('/make-server-e07959ec/tools/:slug/guide-retheme', requireAuth, async (c) => {
  try {
    const slug = c.req.param('slug');
    const path = `${slug}/guide.html`;

    const { data, error: fetchErr } = await supabase.storage
      .from(GUIDE_BUCKET_NAME)
      .download(path);
    if (fetchErr || !data) {
      return c.json({ success: false, error: 'Guide not found' }, 404);
    }
    const originalHtml = await data.text();

    console.log(`[guide-retheme] Re-theming guide for slug "${slug}" with Gemini…`);
    const themeResult = await applyDarkThemeWithGemini(originalHtml);
    if (!themeResult.ok) {
      return c.json({ success: false, error: `Theming failed: ${themeResult.error}` }, 500);
    }

    const blob = new Blob([themeResult.html], { type: 'text/html; charset=utf-8' });
    const { error: uploadErr } = await supabase.storage
      .from(GUIDE_BUCKET_NAME)
      .upload(path, blob, { contentType: 'text/html', upsert: true });

    if (uploadErr) {
      return c.json({ success: false, error: uploadErr.message }, 500);
    }

    console.log(`[guide-retheme] ✅ Re-themed guide for slug "${slug}"`);
    return c.json({ success: true, themedHtml: themeResult.html });
  } catch (err) {
    console.log('[guide-retheme] Unexpected error:', err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// DELETE /tools/:id/guide?slug= — admin only, remove guide
app.delete('/make-server-e07959ec/tools/:id/guide', requireAuth, async (c) => {
  try {
    const toolId = c.req.param('id');
    const slug = c.req.query('slug') || toolId;
    const path = `${slug}/guide.html`;

    const { error } = await supabase.storage
      .from(GUIDE_BUCKET_NAME)
      .remove([path]);

    if (error) {
      console.log(`[guide-delete] Error deleting guide for tool "${toolId}":`, error.message);
      return c.json({ success: false, error: error.message }, 500);
    }

    console.log(`[guide-delete] ✅ Guide deleted for tool "${toolId}"`);
    return c.json({ success: true });
  } catch (err) {
    console.log('[guide-delete] Unexpected error:', err);
    return c.json({ success: false, error: `Delete failed: ${String(err)}` }, 500);
  }
});

// ========== GUIDE TEMPLATE GENERATION ==========

/**
 * The locked guide template.
 * The AI fills ONLY the content inside each <!-- SLOT:xxx --> comment.
 * CSS, layout, and structure are NEVER modified by the AI.
 */
const GUIDE_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>{{TOOL_NAME}} — User Guide</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }

  :root {
    --accent: #a855f7;
    --accent-dim: rgba(168,85,247,0.12);
    --accent-border: rgba(168,85,247,0.30);
    --text: rgba(238,240,248,0.90);
    --text-soft: rgba(168,176,204,0.85);
    --muted: rgba(90,99,133,0.90);
    --border: rgba(255,255,255,0.07);
    --border-strong: rgba(255,255,255,0.12);
    --surface: rgba(255,255,255,0.03);
    --surface2: rgba(255,255,255,0.055);
    --code-bg: rgba(0,0,0,0.35);
    --radius: 8px;
    --mono: 'JetBrains Mono', 'SFMono-Regular', Menlo, Monaco, 'Courier New', monospace;
    --sans: system-ui, -apple-system, 'Segoe UI', sans-serif;
  }

  html, body {
    margin: 0; padding: 0;
    font-family: var(--sans);
    font-size: 15px;
    line-height: 1.65;
    color: var(--text);
    background: transparent;
  }

  body { padding: 28px 32px 48px; }

  @media (max-width: 680px) { body { padding: 16px 18px 40px; } }

  /* ── Typography ── */
  h1 { font-size: 1.75rem; font-weight: 800; letter-spacing: -0.02em; margin: 0 0 0.25rem; color: var(--accent); }
  h2 { font-size: 1.2rem; font-weight: 700; margin: 2.4rem 0 0.5rem; color: var(--accent);
       padding-bottom: 0.4rem; border-bottom: 1px solid var(--border); }
  h3 { font-size: 1.0rem; font-weight: 600; margin: 1.6rem 0 0.4rem; color: var(--accent); }
  h4 { font-size: 0.92rem; font-weight: 600; margin: 1.2rem 0 0.3rem; color: rgba(168,85,247,0.80); }
  p  { margin: 0.3rem 0 0.65rem; color: var(--text-soft); }

  a { color: var(--accent); text-decoration: none; }
  a:hover { text-decoration: underline; }

  ul, ol { margin: 0.3rem 0 0.75rem 0.9rem; padding-left: 0.4rem; color: var(--text-soft); }
  li { margin: 0.2rem 0; }

  /* ── Code ── */
  code {
    font-family: var(--mono); font-size: 0.82rem;
    background: var(--code-bg); color: var(--accent);
    border: 1px solid var(--border-strong); border-radius: 4px;
    padding: 1px 5px;
  }
  pre {
    font-family: var(--mono); font-size: 0.82rem;
    background: var(--code-bg); color: rgba(238,240,248,0.80);
    border: 1px solid var(--border); border-radius: var(--radius);
    padding: 12px 14px; overflow-x: auto; white-space: pre;
    margin: 0.5rem 0 0.85rem;
  }
  pre code { background: none; border: none; padding: 0; color: inherit; font-size: inherit; }

  /* ── Keyboard shortcut ── */
  kbd {
    font-family: var(--mono); font-size: 0.75rem;
    padding: 2px 5px; border-radius: 4px;
    border: 1px solid var(--border-strong);
    background: var(--code-bg); margin: 0 2px;
  }

  /* ── Callouts ── */
  .callout {
    border-radius: var(--radius); padding: 11px 14px;
    margin: 0.65rem 0 1rem; font-size: 0.875rem;
    display: flex; gap: 10px; align-items: flex-start;
    border: 1px solid var(--accent-border);
    background: var(--accent-dim); color: var(--text-soft);
  }
  .callout-icon { flex-shrink: 0; font-size: 1rem; margin-top: 1px; }
  .callout strong { color: rgba(196,181,253,0.95); }

  .callout-warning  { background: rgba(245,158,11,0.08); border-color: rgba(245,158,11,0.30); }
  .callout-warning strong { color: rgba(252,211,77,0.95); }
  .callout-danger   { background: rgba(239,68,68,0.08);  border-color: rgba(239,68,68,0.30); }
  .callout-danger strong  { color: rgba(252,165,165,0.95); }
  .callout-success  { background: rgba(52,211,153,0.08); border-color: rgba(52,211,153,0.28); }
  .callout-success strong { color: rgba(110,231,183,0.95); }
  .callout-info     { background: rgba(99,102,241,0.08); border-color: rgba(99,102,241,0.28); }
  .callout-info strong    { color: rgba(165,180,252,0.95); }

  /* ── Step blocks ── */
  .steps { display: flex; flex-direction: column; gap: 0; margin: 0.5rem 0 1.2rem; }
  .step {
    display: grid; grid-template-columns: 36px 1fr; gap: 14px;
  }
  .step-left { display: flex; flex-direction: column; align-items: center; }
  .step-num {
    width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0;
    background: var(--accent-dim); border: 1px solid var(--accent-border);
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 0.85rem; color: var(--accent);
  }
  .step-line {
    width: 2px; flex: 1; min-height: 16px;
    background: linear-gradient(to bottom, var(--accent-border), transparent);
    margin-top: 4px;
  }
  .step-body { padding: 6px 0 24px; }
  .step-title { font-weight: 700; font-size: 0.95rem; margin-bottom: 4px; color: var(--text); }
  .step-desc  { font-size: 0.875rem; color: var(--text-soft); line-height: 1.65; }

  /* ── Tables ── */
  table { width: 100%; border-collapse: collapse; font-size: 0.875rem; margin: 0.5rem 0 1rem; }
  th { background: rgba(168,85,247,0.10); color: rgba(196,181,253,0.95);
       font-weight: 600; padding: 7px 10px; text-align: left;
       border-bottom: 1px solid var(--border-strong); }
  td { padding: 7px 10px; border-bottom: 1px solid var(--border);
       color: var(--text-soft); vertical-align: top; }
  tr:last-child td { border-bottom: none; }

  /* ── Two-column grid ── */
  .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 0.5rem 0 1rem; }
  @media (max-width: 600px) { .grid-2 { grid-template-columns: 1fr; } }

  /* ── Card ── */
  .card {
    background: var(--surface); border: 1px solid var(--border);
    border-radius: var(--radius); padding: 14px 16px;
  }

  /* ── Pill / badge ── */
  .badge {
    display: inline-flex; align-items: center; gap: 5px;
    padding: 2px 8px; font-size: 0.72rem; border-radius: 999px;
    border: 1px solid var(--border-strong);
    background: var(--surface2); color: var(--muted);
  }
  .badge-success { border-color: rgba(52,211,153,0.40); color: rgba(110,231,183,0.90); }
  .badge-warning { border-color: rgba(245,158,11,0.40); color: rgba(252,211,77,0.90); }
  .badge-accent  { border-color: var(--accent-border); color: var(--accent); }

  /* ── Divider ── */
  hr { border: none; border-top: 1px solid var(--border); margin: 1.8rem 0 1.4rem; }

  /* ── Hero header ── */
  .guide-hero { margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid var(--border); }
  .guide-hero-meta { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-top: 0.5rem; }
  .guide-hero-meta span { font-size: 0.78rem; color: var(--muted); }

  /* ── Screenshot placeholder ── */
  .screenshot {
    border: 1px dashed var(--border-strong); border-radius: var(--radius);
    padding: 10px 12px; font-size: 0.78rem; color: var(--muted);
    margin: 0.5rem 0 0.85rem; background: rgba(0,0,0,0.20);
    font-style: italic;
  }

  /* ── App UI mock wrapper ── */
  .ui-mock {
    border: 1px solid var(--border-strong); border-radius: 10px;
    overflow: hidden; margin: 0.75rem 0 1.1rem;
    background: rgba(0,0,0,0.25);
  }
  .ui-mock-bar {
    padding: 8px 14px; border-bottom: 1px solid var(--border);
    background: var(--surface2);
    font-size: 0.75rem; color: var(--muted); font-weight: 600;
  }
  .ui-mock-body { padding: 16px; }
</style>
</head>
<body>

<!-- SLOT:HERO -->
<header class="guide-hero">
  <h1>{{TOOL_NAME}}</h1>
  <p style="color:var(--text-soft);margin:0.2rem 0 0;">{{TOOL_TAGLINE}}</p>
  <div class="guide-hero-meta">
    <span class="badge badge-accent">{{TOOL_CATEGORY}}</span>
    <span>·</span>
    <span>{{TOOL_VERSION_INFO}}</span>
    <span>·</span>
    <span>Built by Fastoosh</span>
  </div>
</header>
<!-- /SLOT:HERO -->

<!-- SLOT:CONTENT -->
{{GUIDE_SECTIONS}}
<!-- /SLOT:CONTENT -->

</body>
</html>`;

/**
 * POST /tools/:id/generate-guide
 * Accepts: { slug, sourceHtml? }
 * - If sourceHtml is provided: AI extracts content from it and injects into the locked template
 * - If not: AI generates content from the tool's database record
 * Saves the result to storage (no AI theming needed — template is already dark)
 */
app.post('/make-server-e07959ec/tools/:id/generate-guide', requireAuth, async (c) => {
  try {
    const toolId = c.req.param('id');
    const { slug, sourceHtml } = await c.req.json();
    if (!slug) return c.json({ success: false, error: 'slug is required' }, 400);

    // Fetch tool data from DB for context
    const { data: toolRow } = await supabase
      .from('tools')
      .select('*')
      .eq('id', toolId)
      .single();

    const { apiKey, model: geminiModel } = await getGeminiConfig();
    if (!apiKey) return c.json({ success: false, error: 'GEMINI_API_KEY not configured' }, 500);
    console.log(`[generate-guide] Using model="${geminiModel}" apiKey="${apiKey.slice(0, 8)}…"`);

    // Build version info string
    const versions = toolRow?.versions || [];
    const versionInfo = versions.length > 0
      ? versions.map((v: any) => `${v.versionType} (${v.pricingModel})`).join(' · ')
      : 'v1.0';

    // Fill template placeholders that are fixed (not AI-generated)
    const templateWithMeta = GUIDE_TEMPLATE
      .replace(/\{\{TOOL_NAME\}\}/g, toolRow?.name || slug)
      .replace('{{TOOL_TAGLINE}}', toolRow?.tagline || toolRow?.description || '')
      .replace('{{TOOL_CATEGORY}}', toolRow?.toolCategory || toolRow?.category || 'Tool')
      .replace('{{TOOL_VERSION_INFO}}', versionInfo);

    // Build the AI prompt
    const systemPrompt = sourceHtml
      ? `You are a technical writer. You will be given:
1. A locked HTML template with a <!-- SLOT:CONTENT --> placeholder
2. A source guide HTML file with existing content

Your task: Extract ALL content from the source guide (every section, paragraph, code block, table, callout, step, FAQ, etc.) and rewrite it using ONLY the HTML components defined in the template's CSS.

STRICT RULES:
- Output ONLY the HTML that goes between <!-- SLOT:CONTENT --> and <!-- /SLOT:CONTENT -->. Nothing else.
- Use ONLY these CSS classes from the template: callout, callout-warning, callout-danger, callout-success, callout-info, steps, step, step-left, step-num, step-line, step-body, step-title, step-desc, grid-2, card, badge, badge-success, badge-warning, badge-accent, screenshot, ui-mock, ui-mock-bar, ui-mock-body, hr
- Use standard HTML tags: h2, h3, h4, p, ul, ol, li, table, thead, tbody, tr, th, td, pre, code, kbd, strong, em, a, hr
- Do NOT add any <style> tags, inline styles, or classes not listed above
- Do NOT add navigation, sidebar, header, or TOC — the page provides its own
- Preserve ALL content from the source — do not skip or summarize any section
- For callouts: use <div class="callout"><span class="callout-icon">💡</span><div>...</div></div> (tip), callout-warning (⚠️), callout-danger (🚨), callout-success (✅), callout-info (ℹ️)
- For numbered steps: use <div class="steps"><div class="step"><div class="step-left"><div class="step-num">1</div><div class="step-line"></div></div><div class="step-body"><div class="step-title">Title</div><div class="step-desc">Description</div></div></div></div>
- For UI mockups that existed in the source: reproduce them using <div class="ui-mock"><div class="ui-mock-bar">Panel name</div><div class="ui-mock-body">...</div></div>
- For screenshot placeholders: use <div class="screenshot">📸 Screenshot: description</div>
- Start with the first section heading (h2), no wrapping div needed

Source guide HTML:
${sourceHtml?.slice(0, 80000)}`
      : `You are a technical writer. Generate a complete user guide for the following tool.

Your task: Write a professional user guide and output ONLY the HTML that goes between <!-- SLOT:CONTENT --> and <!-- /SLOT:CONTENT -->. Nothing else.

STRICT RULES:
- Output ONLY section HTML starting from the first h2. No wrapping divs, no styles, no scripts.
- Use ONLY these CSS classes: callout, callout-warning, callout-danger, callout-success, callout-info, steps, step, step-left, step-num, step-line, step-body, step-title, step-desc, grid-2, card, badge, badge-success, badge-warning, badge-accent, screenshot, ui-mock, ui-mock-bar, ui-mock-body
- Use standard tags: h2, h3, h4, p, ul, ol, li, table, thead, tbody, tr, th, td, pre, code, kbd, strong, em, a, hr
- Do NOT add any <style> tags, inline styles, or classes not listed above
- Do NOT add navigation, sidebar, TOC, or hero — already provided
- For callouts use: <div class="callout"><span class="callout-icon">💡</span><div>content</div></div>
- For steps use the steps/step/step-left/step-num/step-line/step-body/step-title/step-desc structure
- Include these sections (adapt as needed for this tool): Overview, Requirements, Installation, How to use, Key features explained, Tips & best practices, FAQ
- Be thorough and accurate based on the tool description below

Tool data:
Name: ${toolRow?.name || slug}
Description: ${toolRow?.description || ''}
Tagline: ${toolRow?.tagline || ''}
Category: ${toolRow?.toolCategory || toolRow?.category || ''}
How it works: ${JSON.stringify(toolRow?.howItWorks || [])}
System requirements: ${toolRow?.systemRequirements || ''}
FAQs: ${JSON.stringify(toolRow?.faqs || [])}
Features: ${JSON.stringify(toolRow?.features || [])}`;

    const geminiRes = await fetch(geminiUrl(geminiModel, apiKey), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: systemPrompt }] }],
        generationConfig: {
          responseMimeType: 'text/plain',
          temperature: 0.2,
          maxOutputTokens: 65536,
        },
      }),
      signal: AbortSignal.timeout(90_000),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.log(`[generate-guide] Gemini error for tool "${toolId}" model "${geminiModel}":`, errText.slice(0, 500));
      return c.json({ success: false, error: `Gemini error (${geminiModel}): ${errText.slice(0, 300)}` }, 500);
    }

    const geminiData = await geminiRes.json();
    const generatedSections = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!generatedSections.trim()) {
      return c.json({ success: false, error: 'Gemini returned empty content' }, 500);
    }

    // Inject generated content into the locked template
    const finalHtml = templateWithMeta.replace('{{GUIDE_SECTIONS}}', generatedSections.trim());

    // Save to storage
    const path = `${slug}/guide.html`;
    const { error: uploadErr } = await supabase.storage
      .from(GUIDE_BUCKET_NAME)
      .upload(path, new Blob([finalHtml], { type: 'text/html' }), {
        upsert: true,
        contentType: 'text/html; charset=utf-8',
      });

    if (uploadErr) return c.json({ success: false, error: uploadErr.message }, 500);

    return c.json({ success: true, html: finalHtml });
  } catch (err: any) {
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// ========== CHANGELOG ==========

// Semver sort helper — descending (newest first)
function sortChangelogDesc(entries: any[]): any[] {
  return [...entries].sort((a, b) => {
    const pa = (a.version ?? '0.0.0').split('.').map(Number);
    const pb = (b.version ?? '0.0.0').split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      const diff = (pb[i] || 0) - (pa[i] || 0);
      if (diff !== 0) return diff;
    }
    return 0;
  });
}

// GET /tools/:slug/changelog — public, full history
app.get('/make-server-e07959ec/tools/:slug/changelog', async (c) => {
  try {
    const slug = c.req.param('slug');
    const raw = await kv.get(`tool_changelog:${slug}`);
    const entries: any[] = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    return c.json({ success: true, data: sortChangelogDesc(entries) });
  } catch (err) {
    console.log('[changelog] GET error:', err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// GET /tools/:slug/latest-version — public, lightweight ping for in-app update checks
app.get('/make-server-e07959ec/tools/:slug/latest-version', async (c) => {
  try {
    const slug = c.req.param('slug');
    const raw = await kv.get(`tool_changelog:${slug}`);
    const entries: any[] = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    if (!entries.length) return c.json({ success: false, error: 'No changelog found' }, 404);
    const sorted = sortChangelogDesc(entries);
    const latest = sorted[0];
    return c.json({ success: true, data: { version: latest.version, releaseDate: latest.releaseDate, type: latest.type, title: latest.title } });
  } catch (err) {
    console.log('[latest-version] GET error:', err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// POST /tools/:slug/changelog — admin, add or update a release by version string
app.post('/make-server-e07959ec/tools/:slug/changelog', requireAuth, async (c) => {
  try {
    const slug = c.req.param('slug');
    const body = await c.req.json();
    const { version, releaseDate, type, title, changes } = body;
    if (!version?.trim()) return c.json({ success: false, error: 'version is required' }, 400);
    if (!releaseDate)       return c.json({ success: false, error: 'releaseDate is required' }, 400);
    if (!type)              return c.json({ success: false, error: 'type is required' }, 400);

    const raw = await kv.get(`tool_changelog:${slug}`);
    const entries: any[] = Array.isArray(raw) ? raw : (raw ? [raw] : []);

    const entry = { version: version.trim(), releaseDate, type, title: title?.trim() || '', changes: changes || [] };
    const idx = entries.findIndex((e: any) => e.version === entry.version);
    if (idx >= 0) entries[idx] = entry; else entries.push(entry);

    await kv.set(`tool_changelog:${slug}`, entries);
    console.log(`[changelog] Saved entry v${entry.version} for slug "${slug}"`);
    return c.json({ success: true, data: entry });
  } catch (err) {
    console.log('[changelog] POST error:', err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// DELETE /tools/:slug/changelog/:version — admin, remove a release
app.delete('/make-server-e07959ec/tools/:slug/changelog/:version', requireAuth, async (c) => {
  try {
    const slug    = c.req.param('slug');
    const version = c.req.param('version');
    const raw = await kv.get(`tool_changelog:${slug}`);
    const entries: any[] = Array.isArray(raw) ? raw : (raw ? [raw] : []);
    const updated = entries.filter((e: any) => e.version !== version);
    await kv.set(`tool_changelog:${slug}`, updated);
    console.log(`[changelog] Deleted entry v${version} for slug "${slug}"`);
    return c.json({ success: true });
  } catch (err) {
    console.log('[changelog] DELETE error:', err);
    return c.json({ success: false, error: String(err) }, 500);
  }
});

// ========== AI LEGAL HTML FORMATTER ==========

app.post("/make-server-e07959ec/admin/format-legal-html", requireAuth, async (c) => {
  try {
    const { rawText, pageType = 'legal' } = await c.req.json();

    const { apiKey, model: geminiModel } = await getGeminiConfig();
    if (!apiKey) return c.json({ success: false, error: 'GEMINI_API_KEY not configured' }, 500);
    if (!rawText?.trim()) return c.json({ success: false, error: 'rawText is required' }, 400);

    const prompt = `You are an expert web content formatter for Fastoosh, a premium motion design studio.

Your task: Convert the following raw legal text into clean, well-structured HTML.

STRICT RULES:
- Use ONLY these HTML tags: <h2>, <h3>, <p>, <ul>, <ol>, <li>, <strong>, <em>, <a>
- Every main section heading must use <h2>
- Sub-sections (if any) use <h3>
- All body text must be wrapped in <p> tags
- Lists must use <ul>/<ol> with <li> items
- Preserve ALL the original meaning and content — do NOT add, remove, or invent any information
- Keep numbered section headings as-is (e.g. "1. Acceptance of Terms" → <h2>1. Acceptance of Terms</h2>)
- Do NOT include <html>, <head>, <body>, <style>, or any wrapper tags
- Do NOT add any markdown, backticks, or code fences
- Output ONLY the raw HTML — nothing else before or after

Raw text to format:
"""
${rawText.trim()}
"""

Return ONLY the formatted HTML. No explanations, no markdown fences, no preamble.`;

    console.log(`[format-legal-html] pageType=${pageType} rawText length=${rawText.trim().length}`);

    const geminiRes = await fetch(
      geminiUrl(geminiModel, apiKey),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 8192,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return c.json({ success: false, error: `Gemini API error (${geminiRes.status}): ${errText}` }, 500);
    }

    const geminiData = await geminiRes.json();
    const rawResult = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();

    if (!rawResult) {
      return c.json({ success: false, error: 'Gemini returned an empty response' }, 500);
    }

    // Strip any accidental markdown code fences
    const cleaned = rawResult
      .replace(/^```[\w]*\n?/m, '')
      .replace(/```$/m, '')
      .trim();

    console.log(`[format-legal-html] ✅ formatted ${rawText.trim().length} chars → ${cleaned.length} chars HTML`);
    return c.json({ success: true, data: { html: cleaned } });

  } catch (error) {
    console.log('Error in format-legal-html:', error);
    return c.json({ success: false, error: `Legal HTML formatting failed: ${String(error)}` }, 500);
  }
});

// ── AI FAKE REVIEW GENERATOR ──────────────────────────────────────────────────
// POST /admin/generate-fake-reviews
// Body: { toolId: string, count: number (1-10) }
// Calls Gemini to produce realistic positive reviews, then bulk-saves to KV.
app.post('/make-server-e07959ec/admin/generate-fake-reviews', requireAuth, async (c) => {
  try {
    const { toolId, count = 3 } = await c.req.json();
    if (!toolId) return c.json({ success: false, error: 'toolId is required' }, 400);

    const safeCount = Math.min(10, Math.max(1, Number(count) || 3));

    const { apiKey, model: geminiModel } = await getGeminiConfig();
    if (!apiKey) return c.json({ success: false, error: 'GEMINI_API_KEY not configured' }, 500);

    // Fetch tool metadata from Supabase
    const { data: tool, error: toolErr } = await supabase
      .from('tools')
      .select('id, name, description, created_at')
      .eq('id', toolId)
      .single();

    if (toolErr || !tool) {
      return c.json({ success: false, error: `Tool not found: ${toolErr?.message || 'unknown'}` }, 404);
    }

    const toolName        = tool.name || 'this tool';
    const toolDescription = tool.description || '';
    const toolCreatedAt   = tool.created_at ? new Date(tool.created_at) : new Date('2024-01-01');
    const today           = new Date('2026-03-05');

    const releaseIso = toolCreatedAt.toISOString().slice(0, 10);
    const todayIso   = today.toISOString().slice(0, 10);

    const prompt = `You are helping a motion design studio populate realistic product reviews for their After Effects plugin called "${toolName}".

Tool description:
"""
${toolDescription.trim() || 'A powerful motion design plugin for After Effects.'}
"""

Generate exactly ${safeCount} distinct fake customer reviews that sound like real humans wrote them — not marketing copy.

LENGTH — vary naturally across the batch, like a real review section looks:
  • ~40% SHORT: 1 punchy sentence, strictly under 100 characters (e.g. "Saves me hours every week." or "Best AE plugin I bought this year.")
  • ~30% MEDIUM: 2 sentences, 100–220 characters total
  • ~30% DETAILED: 3–4 sentences, 220–400 characters max — mention a specific workflow win or feature
  Never exceed 400 characters. No padding, no filler, no repetition.

TONE & CONTENT:
  - Always positive (5 stars). Short ones = punchy reactions. Medium ones add one specific detail. Long ones explain a concrete benefit.
  - Reference the tool's actual purpose from the description — no generic "great product" reviews
  - Write casually, like a real user. No em-dashes (—), no overly formal language, no hashtags, no exclamation marks on every sentence.

NAMES — diverse international mix: English, French, Arabic, Spanish, Italian, German, Japanese (romanised). Use realistic full names.

DATES — createdAt must be BETWEEN ${releaseIso} (inclusive) and ${todayIso} (inclusive). Spread them naturally across that range.

Return ONLY a valid JSON array. No markdown, no commentary, no code fences:
[
  {
    "userName": "Full Name",
    "comment": "Review text here.",
    "createdAt": "YYYY-MM-DD"
  }
]`;

    console.log(`[generate-fake-reviews] tool="${toolName}" count=${safeCount} dateRange=${releaseIso}→${todayIso}`);

    const geminiRes = await fetch(
      geminiUrl(geminiModel, apiKey),
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.85,
            maxOutputTokens: 4096,
            responseMimeType: 'application/json',
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      return c.json({ success: false, error: `Gemini API error (${geminiRes.status}): ${errText}` }, 500);
    }

    const geminiData = await geminiRes.json();
    const rawText    = geminiData.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!rawText) return c.json({ success: false, error: 'Gemini returned an empty response' }, 500);

    // Strip any accidental markdown fences
    const cleaned = rawText.replace(/^```[\w]*\n?/m, '').replace(/```$/m, '').trim();

    let generated: Array<{ userName: string; comment: string; createdAt: string }>;
    try {
      generated = JSON.parse(cleaned);
      if (!Array.isArray(generated)) throw new Error('Not an array');
    } catch (parseErr) {
      console.log('[generate-fake-reviews] JSON parse error:', parseErr, 'raw:', cleaned.slice(0, 300));
      return c.json({ success: false, error: `Failed to parse Gemini response as JSON: ${parseErr}` }, 500);
    }

    // Bulk-save each generated review
    const saved: any[] = [];
    const now = new Date().toISOString();

    for (const item of generated) {
      const userId    = `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const reviewKey = `review:${toolId}:${userId}`;
      const review = {
        id:        reviewKey,
        toolId,
        userId,
        userName:  (item.userName || 'Anonymous').trim(),
        rating:    5,
        comment:   (item.comment  || '').trim(),
        createdAt: item.createdAt ? new Date(item.createdAt).toISOString() : now,
        updatedAt: now,
        isFake:    true,
      };
      await kv.set(reviewKey, review);
      saved.push(review);
      // Small delay to ensure unique timestamps in userId
      await new Promise(r => setTimeout(r, 5));
    }

    console.log(`[generate-fake-reviews] ✅ Saved ${saved.length} AI reviews for tool="${toolName}"`);
    return c.json({ success: true, data: saved, count: saved.length });

  } catch (error) {
    console.log('[generate-fake-reviews] error:', error);
    return c.json({ success: false, error: `AI review generation failed: ${String(error)}` }, 500);
  }
});

// ── Image proxy — strips CORS so the browser can draw any thumbnail to canvas ─
app.get("/make-server-e07959ec/admin/proxy-image", requireAuth, async (c) => {
  const url = c.req.query("url");
  if (!url) return c.json({ error: "Missing url param" }, 400);
  try {
    const upstream = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; FasToosh/1.0)" },
    });
    if (!upstream.ok) {
      return new Response(`Upstream error: ${upstream.status}`, {
        status: 502,
        headers: { "Access-Control-Allow-Origin": "*" },
      });
    }
    const contentType = upstream.headers.get("content-type") ?? "image/jpeg";
    const body = await upstream.arrayBuffer();
    return new Response(body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (err) {
    console.log(`[proxy-image] error fetching ${url}: ${err}`);
    return new Response(`Proxy error: ${String(err)}`, {
      status: 500,
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }
});

// Global error handler - catches all unhandled errors
app.onError((err, c) => {
  console.error('[SERVER ERROR]', {
    url: c.req.url,
    method: c.req.method,
    error: err.message,
    stack: err.stack
  });
  
  // Always return a proper JSON response
  try {
    return c.json({ 
      success: false, 
      error: err.message || 'Internal server error' 
    }, 500);
  } catch (e) {
    console.error('[ERROR HANDLER FAILED]', e);
    return new Response(JSON.stringify({ success: false, error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

// 404 handler - ensures all requests get a response
app.notFound((c) => {
  console.log('[404] Not found:', c.req.url);
  return c.json({ 
    success: false, 
    error: 'Not found' 
  }, 404);
});

// Global error handler for Hono
app.onError((err, c) => {
  console.error('[HONO ERROR HANDLER]', err);
  return c.json({ 
    success: false, 
    error: err.message || 'Internal server error' 
  }, 500);
});

// Global unhandled rejection handler
globalThis.addEventListener('unhandledrejection', (event) => {
  console.error('[UNHANDLED REJECTION]', event.reason);
  event.preventDefault();
});

// Start server with error handling
Deno.serve({
  onError: (error) => {
    console.error('[DENO SERVER ERROR]', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
}, async (req) => {
  const url = new URL(req.url);
  const method = req.method;
  console.log(`[DENO SERVE] ${method} ${url.pathname}`);
  
  try {
    const response = await app.fetch(req);
    
    // Ensure we have a valid response
    if (!response) {
      console.error(`[DENO SERVE] No response returned for ${method} ${url.pathname}`);
      return new Response(
        JSON.stringify({ success: false, error: 'No response generated' }),
        { 
          status: 500,
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          }
        }
      );
    }
    
    // Ensure response has proper headers
    const headers = new Headers(response.headers);
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    
    console.log(`[DENO SERVE] ${method} ${url.pathname} -> ${response.status}`);
    
    // Return response with guaranteed headers
    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: headers
    });
  } catch (error) {
    console.error(`[APP FETCH ERROR] ${method} ${url.pathname}:`, error);
    return new Response(
      JSON.stringify({ success: false, error: 'Server error' }),
      { 
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        }
      }
    );
  }
});