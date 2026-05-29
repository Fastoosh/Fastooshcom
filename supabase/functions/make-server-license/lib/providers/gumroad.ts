// Gumroad adapter — PRIMARY provider.
//
// Gumroad has no HMAC webhook signatures, so we secure the Ping two ways:
//   1. A secret in the webhook URL path (checked in index.ts before we get here).
//   2. Verifying the sale against Gumroad's API using the access token (below).
//      Unless test mode is on, we never trust the Ping payload alone.
//
// Gumroad sends application/x-www-form-urlencoded, already parsed into ctx.body
// by index.ts. Field names below match Gumroad's Ping documentation.

import type { AdapterContext, InternalEvent, LicenseType } from './types.ts';

// ── Product map ───────────────────────────────────────────────────────────────
// Key format: "<permalink>::<variant_name>" (verbatim from Gumroad).
// Free is intentionally absent — free tier requires no license.
// machine_limit here is the DEFAULT/base; actual limit is seeded from the
// purchase quantity at runtime (see deriveMachineLimit) and is admin-editable.
interface GumroadProductConfig {
  productId: string;          // internal product id
  tier: string;               // internal tier
  type: LicenseType;
  features: string[];         // baked into the token; edit as the extension's flags firm up
}

const GUMROAD_PRODUCT_MAP: Record<string, GumroadProductConfig> = {
  'data-automator::Pro Lifetime': {
    productId: 'fastoosh_data_automator',
    tier: 'pro',
    type: 'lifetime',
    features: ['unlimited_rows', 'auto_render', 'precomps_policy'],
  },
  'data-automator::Pro Monthly': {
    productId: 'fastoosh_data_automator',
    tier: 'pro',
    type: 'subscription',
    features: ['unlimited_rows', 'auto_render', 'precomps_policy'],
  },
  'data-automator::Pro Yearly': {
    productId: 'fastoosh_data_automator',
    tier: 'pro',
    type: 'subscription',
    features: ['unlimited_rows', 'auto_render', 'precomps_policy'],
  },
};

function lookupProduct(permalink: string, variantName: string): GumroadProductConfig | null {
  // Try permalink::variant, then permalink:: (no variant / base product).
  return (
    GUMROAD_PRODUCT_MAP[`${permalink}::${variantName}`] ??
    GUMROAD_PRODUCT_MAP[`${permalink}::`] ??
    null
  );
}

// ── Gumroad sale shape (only the fields we use) ───────────────────────────────
interface GumroadSale {
  id?: string;
  email?: string;
  full_name?: string;
  ip_country?: string;
  product_permalink?: string;
  permalink?: string;
  product_name?: string;
  variants?: string;            // e.g. "(Pro Monthly)" or "Tier: Pro Monthly"
  variants_and_quantity?: string;
  price?: number;               // cents
  quantity?: number;
  recurrence?: string;          // 'monthly' | 'quarterly' | 'biannually' | 'yearly'
  subscription_id?: string;
  refunded?: boolean;
  disputed?: boolean;
  sale_id?: string;
}

// Verify the sale is real by fetching it from Gumroad's API.
async function verifySaleWithGumroad(saleId: string): Promise<GumroadSale | null> {
  const token = Deno.env.get('GUMROAD_ACCESS_TOKEN');
  if (!token) {
    console.error('[gumroad] GUMROAD_ACCESS_TOKEN not set — cannot verify sale');
    return null;
  }
  try {
    const res = await fetch(`https://api.gumroad.com/v2/sales/${saleId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.success ? (data.sale as GumroadSale) : null;
  } catch (e) {
    console.error('[gumroad] sale verification error:', e);
    return null;
  }
}

// Subscription expiry from Gumroad recurrence + a 2-day grace buffer. Gumroad
// doesn't send a precise period end, so we compute it; if the renewal Ping fires
// we extend again, otherwise the license lapses ~2 days after the real end.
function computePeriodEnd(recurrence: string | undefined): number {
  const now = Math.floor(Date.now() / 1000);
  const day = 86400;
  switch (recurrence) {
    case 'monthly':    return now + (31 + 2) * day;
    case 'quarterly':  return now + (92 + 2) * day;
    case 'biannually': return now + (183 + 2) * day;
    case 'yearly':     return now + (366 + 2) * day;
    default:           return now + (31 + 2) * day; // safe default: monthly
  }
}

// machine_limit from purchase quantity. Default 1 (one license per machine);
// if the buyer purchased quantity > 1, grant that many machines.
function deriveMachineLimit(sale: GumroadSale, body: Record<string, unknown>): number {
  const q = Number(sale.quantity ?? body.quantity ?? 1);
  return Number.isFinite(q) && q >= 1 ? Math.floor(q) : 1;
}

// Extract the variant name from Gumroad's various representations.
// Real Gumroad Pings send the variant as bracketed form fields, e.g.
//   variants[Tier]=Pro Monthly
// which our form parser turns into a key literally named "variants[Tier]".
// The API/sample formats may instead use "variants" (string or "(Pro Monthly)").
// We coerce everything to a string so a non-string value can never crash us.
function asString(v: unknown): string {
  if (typeof v === 'string') return v;
  if (v == null) return '';
  if (Array.isArray(v)) return v.map(asString).join(', ');
  if (typeof v === 'object') {
    // e.g. { Tier: 'Pro Monthly' } → take the first string value
    const vals = Object.values(v as Record<string, unknown>);
    return vals.length ? asString(vals[0]) : '';
  }
  return String(v);
}

function extractVariantName(sale: GumroadSale, body: Record<string, unknown>): string {
  // Find any "variants[...]" bracketed key (real Ping format).
  let bracketed = '';
  for (const [k, v] of Object.entries(body)) {
    if (/^variants\[/i.test(k)) { bracketed = asString(v); break; }
  }
  const raw = bracketed
    || asString((sale as Record<string, unknown>).variants)
    || asString(body.variants)
    || asString(body['variants[Tier]']);
  // Strip surrounding parens and "Tier:" style prefixes.
  return raw.replace(/^\(|\)$/g, '').replace(/^Tier:\s*/i, '').trim();
}

// Idempotency id for a Ping. New sales use sale_id; renewals reuse subscription
// id + the sale timestamp so each renewal is distinct.
function deriveEventId(sale: GumroadSale, body: Record<string, unknown>): string {
  const saleId = sale.id ?? sale.sale_id ?? (body.sale_id as string) ?? '';
  const subId = sale.subscription_id ?? (body.subscription_id as string) ?? '';
  const ts = (body.sale_timestamp as string) ?? (body.timestamp as string) ?? '';
  // For renewals, sale_id is unique per charge anyway, so sale_id alone is fine.
  return saleId || (subId && ts ? `${subId}:${ts}` : crypto.randomUUID());
}

// ── Adapter ───────────────────────────────────────────────────────────────────
export const gumroadAdapter = async (ctx: AdapterContext): Promise<InternalEvent | null> => {
  const { body, testMode } = ctx;

  const saleId = (body.sale_id as string) ?? (body.id as string) ?? '';
  const resourceName = (body.resource_name as string) ?? 'sale';

  // ── Refund / dispute → payment.refunded ─────────────────────────────────────
  const refunded = body.refunded === 'true' || body.refunded === true;
  const disputed = body.disputed === 'true' || body.disputed === true;
  if (refunded || disputed) {
    return {
      type: 'payment.refunded',
      provider: 'gumroad',
      providerEventId: `${saleId}:refund`,
      providerPaymentId: saleId,
    };
  }

  // ── Subscription lifecycle events ────────────────────────────────────────────
  if (resourceName === 'subscription_cancelled') {
    const subId = (body.subscription_id as string) ?? '';
    return {
      type: 'subscription.canceled',
      provider: 'gumroad',
      providerEventId: `${subId}:cancelled`,
      providerSubscriptionId: subId,
      effectiveAt: Math.floor(Date.now() / 1000), // Gumroad cancel = end of current period; refined by renewal data if present
    };
  }
  if (resourceName === 'subscription_ended') {
    const subId = (body.subscription_id as string) ?? '';
    return {
      type: 'subscription.canceled',
      provider: 'gumroad',
      providerEventId: `${subId}:ended`,
      providerSubscriptionId: subId,
      effectiveAt: Math.floor(Date.now() / 1000), // immediate
    };
  }

  // ── Sale (new purchase or renewal) ───────────────────────────────────────────
  // Verify the sale is real unless test mode is on.
  let sale: GumroadSale;
  if (testMode) {
    sale = body as GumroadSale; // trust the payload in test mode
  } else {
    if (!saleId) return null;
    const verified = await verifySaleWithGumroad(saleId);
    if (!verified) {
      // Caller logs webhook.failed. Returning null = ignore (don't create license).
      return null;
    }
    sale = verified;
  }

  // Real Gumroad sends BOTH `permalink` (clean slug, e.g. "data-automator") and
  // `product_permalink` (full URL, e.g. "https://fastoosh.gumroad.com/l/data-automator").
  // Prefer the clean slug; if we only have a URL, extract the slug after "/l/".
  const slugFromUrl = (u: string) => u.includes('/l/') ? u.split('/l/').pop()!.split(/[?#]/)[0] : u;
  const rawPermalink =
    (sale.permalink as string) ||
    (body.permalink as string) ||
    (sale.product_permalink as string) ||
    (body.product_permalink as string) ||
    '';
  const permalink = slugFromUrl(rawPermalink);
  const variantName = extractVariantName(sale, body);
  const config = lookupProduct(permalink, variantName);

  // Unconfigured product/variant (e.g. the Free $0 version, or a product we
  // don't license). Return null → caller logs and returns 200 (no Gumroad retry).
  if (!config) return null;

  // Free safety net: never issue a license for a $0 sale even if mapped.
  const priceCents = Number(sale.price ?? body.price ?? 0);
  if (priceCents <= 0) return null;

  const subId = (sale.subscription_id as string) ?? (body.subscription_id as string) ?? '';
  const isSubscription = config.type === 'subscription';

  return {
    type: 'purchase.completed',
    provider: 'gumroad',
    providerEventId: deriveEventId(sale, body),
    customer: {
      email: (sale.email as string) ?? (body.email as string) ?? '',
      name: (sale.full_name as string) ?? (body.full_name as string) ?? undefined,
      country: (sale.ip_country as string) ?? (body.ip_country as string) ?? undefined,
      providerCustomerId: subId || undefined,
    },
    product: { id: config.productId, tier: config.tier },
    license: {
      type: config.type,
      machineLimit: deriveMachineLimit(sale, body),
      features: config.features,
    },
    subscription:
      isSubscription && subId
        ? { providerSubscriptionId: subId, currentPeriodEnd: computePeriodEnd(sale.recurrence) }
        : undefined,
    payment: {
      providerPaymentId: saleId,
      amount: priceCents / 100,
      currency: (sale as Record<string, unknown>).currency as string ?? 'USD',
    },
  };
};
