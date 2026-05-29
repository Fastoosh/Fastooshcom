# Fastoosh License Server — Build Specification

## Context

We are building a license server for **Fastoosh Data Automator**, an Adobe After Effects CEP extension. The extension is sold as multiple tiers, with both lifetime licenses and monthly/yearly subscriptions. The licensing system must:

- Work **offline** after first activation (signed tokens, no constant network calls)
- Support **multiple machines** per customer
- Be **portable across payment providers** (we start with Gumroad and design so we can swap to Stripe, Paddle, or Polar later by writing one adapter file)
- Survive any single payment provider suspending the account — existing customers keep working

The existing stack is already deployed:
- **Hosting**: Vercel (Next.js app at `fastoosh.com`)
- **Database**: Supabase (Postgres)
- **Email**: Resend
- **Frontend**: Existing marketing site at `fastoosh.com`
- **Payment provider (primary)**: Gumroad — we keep this; the license server attaches to it via webhooks
- **Future payment providers**: Stripe (via Atlas), Paddle, Polar — implemented as stubs initially

You will build the license server as API routes inside the existing Next.js app, with a Supabase schema and supporting libraries.

---

## Goals

1. **Provider-agnostic core**: The license issuance/validation logic must not know or care which payment provider sent the webhook. Provider-specific adapters convert webhook events into a common internal event shape.
2. **Offline-capable activation**: After first online activation, the CEP extension verifies the license offline using signed tokens (Ed25519). Network is required only for activation, periodic refresh, and revocation checks.
3. **Multi-machine support**: A license has a configurable `machine_limit`. Activations are tracked per machine fingerprint.
4. **Subscription + lifetime support**: Subscription licenses expire and must be refreshed; lifetime licenses get long-expiry tokens that silently auto-renew when online.
5. **Revocable**: Refunds, chargebacks, or manual revocation invalidate licenses on the next online check, with a denylist as the source of truth.
6. **Auditable**: Every meaningful event (activation, refresh, revocation, refund) is logged.
7. **Payment-provider independence**: We own the customer relationship through email + licenses. If we switch payment providers, customers don't notice — their keys keep working.

---

## Tech stack

- **Runtime**: Next.js App Router on Vercel, Node.js runtime (NOT Edge — we need `@noble/ed25519` and full crypto)
- **Database**: Supabase Postgres, accessed via `@supabase/supabase-js` with the **service role key** (server-side only)
- **Email**: Resend via `resend` npm package
- **Crypto**: `@noble/ed25519` for token signing/verification (works in Node and in the CEP extension's browser context)
- **Validation**: `zod` for request body validation
- **Types**: Strict TypeScript

---

## File / route layout

Create the following inside the existing Next.js project:

```
/app/api/
  /license/
    /activate/route.ts        POST  — Extension activates a key on a machine
    /refresh/route.ts         POST  — Extension refreshes an expiring token
    /deactivate/route.ts      POST  — Extension removes its own activation
    /status/route.ts          POST  — Extension checks if its key is still valid
  /webhook/
    /gumroad/[secret]/route.ts POST — Gumroad Ping (primary provider)
    /stripe/route.ts          POST  — Stripe events (STUB for future)
    /paddle/route.ts          POST  — Paddle events (STUB for future)
    /polar/route.ts           POST  — Polar events (STUB for future)
  /admin/
    /licenses/route.ts        GET   — List licenses (protected)
    /revoke/route.ts          POST  — Revoke a license (protected)
    /reissue/route.ts         POST  — Resend license email (protected)

/lib/license/
  schema.ts                   Zod schemas for all API inputs
  keys.ts                     License key generation (format: FSTH-XXXX-XXXX-XXXX)
  tokens.ts                   Ed25519 sign + verify + claim helpers
  fingerprint.ts              Machine fingerprint validation/normalization
  denylist.ts                 Denylist read/write helpers
  db.ts                       Supabase client (server-side, service role)
  events.ts                   Internal event shape + dispatcher
  email.ts                    Resend wrappers for license emails

/lib/providers/
  types.ts                    Common internal event type
  gumroad.ts                  Gumroad Ping -> internal event (PRIMARY)
  stripe.ts                   Stub — TODO comment, exports adapter shape
  paddle.ts                   Stub
  polar.ts                    Stub

/scripts/
  generate-keypair.ts         One-time Ed25519 keypair generator (run locally)
  migrate-gumroad.ts          Backfill licenses for existing Gumroad customers
```

---

## Environment variables

Add these to Vercel (and `.env.local` for development):

```
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=         # Server-only. Never expose.

# License signing
LICENSE_SIGNING_PRIVATE_KEY=       # 64-char hex from generate-keypair.ts
LICENSE_SIGNING_PUBLIC_KEY=        # 64-char hex (also embedded in CEP extension)
LICENSE_TOKEN_ISSUER=fastoosh.com

# Token expiry policy (in seconds)
LICENSE_TOKEN_TTL_SUBSCRIPTION=604800     # 7 days
LICENSE_TOKEN_TTL_LIFETIME=7776000        # 90 days

# Resend
RESEND_API_KEY=
RESEND_FROM_EMAIL=licenses@fastoosh.com

# Gumroad (primary provider)
GUMROAD_ACCESS_TOKEN=              # From Gumroad Settings -> Advanced -> Applications
GUMROAD_PING_SECRET=               # Long random string used in Ping URL path

# Stripe (future — leave blank for now)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Admin auth
ADMIN_API_TOKEN=                   # Long random string, Bearer token for /api/admin/*
```

---

## Supabase schema

Run this SQL in the Supabase SQL editor. RLS is enabled on every table; only the service role key can read/write (no public access).

```sql
-- ============================================================
-- Tables
-- ============================================================

create table customers (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  name text,
  country text,
  gumroad_customer_id text,
  stripe_customer_id text unique,
  paddle_customer_id text unique,
  polar_customer_id text unique,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table licenses (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references customers(id) on delete cascade,
  license_key text unique not null,
  product_id text not null,                  -- e.g. 'fastoosh_data_automator'
  plan_tier text not null,                   -- e.g. 'basic', 'pro'
  type text not null check (type in ('lifetime','subscription')),
  status text not null default 'active'
    check (status in ('active','revoked','expired','past_due')),
  machine_limit int not null default 1,
  expires_at timestamptz,                    -- null for lifetime
  provider text not null,                    -- 'gumroad' | 'stripe' | 'paddle' | 'polar' | 'manual'
  provider_subscription_id text,
  provider_payment_id text,
  metadata jsonb default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index licenses_key_idx on licenses(license_key);
create index licenses_customer_idx on licenses(customer_id);
create index licenses_status_idx on licenses(status);
create index licenses_provider_sub_idx on licenses(provider, provider_subscription_id);
create index licenses_provider_payment_idx on licenses(provider, provider_payment_id);

create table activations (
  id uuid primary key default gen_random_uuid(),
  license_id uuid not null references licenses(id) on delete cascade,
  machine_fingerprint text not null,
  machine_name text,
  os text,                                   -- 'win' | 'mac' | 'linux'
  app_version text,
  ip_address inet,
  activated_at timestamptz default now(),
  last_seen_at timestamptz default now(),
  unique(license_id, machine_fingerprint)
);

create index activations_license_idx on activations(license_id);
create index activations_fingerprint_idx on activations(machine_fingerprint);

create table denylist (
  license_key text primary key,
  reason text,
  added_at timestamptz default now()
);

create table events (
  id uuid primary key default gen_random_uuid(),
  license_id uuid references licenses(id) on delete set null,
  customer_id uuid references customers(id) on delete set null,
  event_type text not null,                  -- 'license.created', 'license.activated',
                                              -- 'license.refreshed', 'license.revoked',
                                              -- 'license.refunded', 'machine.deactivated',
                                              -- 'webhook.received', 'webhook.failed'
  provider text,
  provider_event_id text,                    -- For idempotency
  payload jsonb,
  created_at timestamptz default now()
);

create index events_license_idx on events(license_id);
create index events_type_idx on events(event_type);
create index events_provider_event_idx on events(provider, provider_event_id);
create index events_created_idx on events(created_at desc);

-- ============================================================
-- updated_at triggers
-- ============================================================

create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger customers_updated_at before update on customers
  for each row execute function set_updated_at();
create trigger licenses_updated_at before update on licenses
  for each row execute function set_updated_at();

-- ============================================================
-- Row Level Security
-- ============================================================

alter table customers enable row level security;
alter table licenses enable row level security;
alter table activations enable row level security;
alter table denylist enable row level security;
alter table events enable row level security;

-- No public policies. Service role bypasses RLS automatically.
-- If a customer portal is added later, add narrow read policies then.
```

---

## License key format

Generate keys with this format: `FSTH-XXXX-XXXX-XXXX-XXXX`

- Prefix `FSTH` identifies Fastoosh products (helps with support).
- Four groups of four uppercase alphanumeric characters using a Crockford-style alphabet (no `I`, `O`, `0`, `1` to avoid confusion).
- Generated via `crypto.randomBytes` mapped to the alphabet.
- Total entropy: ~80 bits — more than enough.
- Implementation in `/lib/license/keys.ts`.

Example: `FSTH-A8KM-9P4L-XQ7H-T3BZ`

---

## Signed token format

Use Ed25519-signed JWT (compact JWS, alg = `EdDSA`). The CEP extension verifies signatures locally with the embedded public key.

**Claims payload:**

```ts
{
  iss: "fastoosh.com",
  sub: "<license_id>",                // license UUID
  jti: "<random>",                    // unique token ID for revocation
  email: "<customer_email>",
  product: "fastoosh_data_automator",
  plan: "pro",
  type: "lifetime" | "subscription",
  machine: "<machine_fingerprint>",
  machine_limit: 2,
  iat: 1715000000,
  exp: 1715604800,                    // 7d for sub, 90d for lifetime
  features: ["watch_mode", "google_sheets", "batch_render"]
}
```

Notes:
- `exp` is enforced both server-side (on refresh) and client-side (in the extension).
- `jti` is logged in the `events` table so we can build a revocation-by-jti list later if needed.
- `features` array lets us gate features by tier without re-issuing tokens for new feature flags — the extension reads it.

Implementation in `/lib/license/tokens.ts`. Provide:
- `signLicenseToken(claims) -> string`
- `verifyLicenseToken(token) -> { valid, claims, reason? }`
- `decodeWithoutVerifying(token) -> claims` (for diagnostics only)

---

## Internal event shape (provider-agnostic core)

All provider webhook handlers normalize events into this internal type, then call the same core handler.

```ts
// /lib/providers/types.ts

export type Provider = 'gumroad' | 'stripe' | 'paddle' | 'polar' | 'manual';

export type InternalEvent =
  | { type: 'purchase.completed';
      provider: Provider;
      providerEventId: string;
      customer: { email: string; name?: string; country?: string;
                  providerCustomerId?: string };
      product: { id: string; tier: string };
      license: { type: 'lifetime' | 'subscription';
                 machineLimit: number };
      subscription?: { providerSubscriptionId: string;
                       currentPeriodEnd: number };
      payment: { providerPaymentId: string;
                 amount: number; currency: string };
    }
  | { type: 'subscription.renewed';
      provider: Provider;
      providerEventId: string;
      providerSubscriptionId: string;
      currentPeriodEnd: number;
    }
  | { type: 'subscription.canceled';
      provider: Provider;
      providerEventId: string;
      providerSubscriptionId: string;
      effectiveAt: number;
    }
  | { type: 'subscription.past_due';
      provider: Provider;
      providerEventId: string;
      providerSubscriptionId: string;
    }
  | { type: 'payment.refunded';
      provider: Provider;
      providerEventId: string;
      providerPaymentId: string;
    };
```

The core dispatcher in `/lib/license/events.ts` handles all internal events identically regardless of provider:

- `purchase.completed` → upsert customer, create license, generate key, send email
- `subscription.renewed` → extend `expires_at`
- `subscription.canceled` → keep `status='active'` until `expires_at`, then `'expired'`
- `subscription.past_due` → set `status='past_due'` (tokens issued during past_due get short TTL)
- `payment.refunded` → set `status='revoked'`, add `license_key` to denylist

---

## Provider adapter: Gumroad (PRIMARY — build this first)

Gumroad is our primary payment provider. We use their "Ping" webhook system and ignore their built-in license key feature entirely (we generate our own keys).

### Webhook URL setup

The Ping URL configured in Gumroad must include the secret in the path:

```
https://fastoosh.com/api/webhook/gumroad/<GUMROAD_PING_SECRET>
```

Route file location:

```
/app/api/webhook/gumroad/[secret]/route.ts
```

### Route handler logic

1. Compares `params.secret` against `process.env.GUMROAD_PING_SECRET` using **constant-time compare**. Mismatch → return 404 (not 401 — don't leak that the path is a secret).
2. Parses the form-encoded body (Gumroad sends `application/x-www-form-urlencoded`, not JSON).
3. Extracts `sale_id` and calls Gumroad's API to **verify the sale is real** (see below). Required for security — Gumroad has no HMAC signatures.
4. Checks `events` table for prior `provider_event_id` — if found, return 200 immediately (idempotency).
5. Maps the verified Ping into an `InternalEvent` using the product map.
6. Dispatches to the core handler in `/lib/license/events.ts`.
7. Logs to `events` table.
8. Returns 200. Gumroad will retry on non-2xx for ~24 hours.

### Verifying the Ping is real

In `/lib/providers/gumroad.ts`, add a helper:

```ts
async function verifySaleWithGumroad(saleId: string): Promise<GumroadSale | null> {
  const res = await fetch(
    `https://api.gumroad.com/v2/sales/${saleId}`,
    {
      headers: {
        Authorization: `Bearer ${process.env.GUMROAD_ACCESS_TOKEN}`,
      },
    }
  );
  if (!res.ok) return null;
  const data = await res.json();
  return data.success ? data.sale : null;
}
```

If the API call returns null or the sale data doesn't match the Ping payload (email, product, amount), reject the Ping. Log a `webhook.failed` event with the discrepancy.

### Mapping Gumroad Pings to internal events

| Gumroad signal | Internal event |
|---|---|
| First-time sale (no `subscription_id`) | `purchase.completed` (lifetime) |
| First-time sale (with `subscription_id`) | `purchase.completed` (subscription) |
| `resource_name=sale` + same `subscription_id` already seen | `subscription.renewed` |
| `resource_name=subscription_cancelled` | `subscription.canceled` |
| `resource_name=subscription_ended` | `subscription.canceled` (immediate) |
| `refunded=true` | `payment.refunded` |
| `disputed=true` | `payment.refunded` (treat dispute as refund) |

Idempotency key: use `sale_id` for new sales, `subscription_id + sale_timestamp` for renewals.

### Mapping Gumroad products to license config

Gumroad uses **product permalinks** and **variants** rather than Stripe-style Price IDs. Define a static map in `/lib/providers/gumroad.ts`:

```ts
type GumroadProductConfig = {
  productId: string;
  tier: string;
  type: 'lifetime' | 'subscription';
  machineLimit: number;
};

// Key format: "<product_permalink>::<variant_name>" (empty variant = base product)
const GUMROAD_PRODUCT_MAP: Record<string, GumroadProductConfig> = {
  'fastoosh-data-automator::Basic Lifetime': {
    productId: 'fastoosh_data_automator',
    tier: 'basic', type: 'lifetime', machineLimit: 1,
  },
  'fastoosh-data-automator::Pro Lifetime': {
    productId: 'fastoosh_data_automator',
    tier: 'pro', type: 'lifetime', machineLimit: 2,
  },
  'fastoosh-data-automator::Basic Monthly': {
    productId: 'fastoosh_data_automator',
    tier: 'basic', type: 'subscription', machineLimit: 1,
  },
  'fastoosh-data-automator::Pro Monthly': {
    productId: 'fastoosh_data_automator',
    tier: 'pro', type: 'subscription', machineLimit: 2,
  },
  // ... etc — I will provide exact variant names from Gumroad
};
```

Lookup logic: try `permalink::variant_name`, fall back to `permalink::` (no variant) if not found. If neither key matches, log an error event and return 200 anyway (we don't want Gumroad to retry forever for an unconfigured product).

### Subscription expiry calculation

Gumroad doesn't always send a precise `current_period_end` like Stripe does. Compute it from `recurrence`:

- `monthly` → `expires_at = now + 31 days + 2 day buffer` (33 days total)
- `quarterly` → `expires_at = now + 92 days + 2 day buffer`
- `biannually` → `expires_at = now + 183 days + 2 day buffer`
- `yearly` → `expires_at = now + 366 days + 2 day buffer`

The buffer absorbs any delay in Gumroad firing the renewal Ping. If the renewal Ping arrives, we extend `expires_at` again. If it doesn't (subscription canceled or failed), the license naturally lapses a couple days after the real period end.

### Disabling Gumroad's default emails

In Gumroad's product settings, disable the default download email — we send our own from Resend with the license key. Gumroad's purchase receipt will still go through, which is fine.

---

## Provider stubs: Stripe, Paddle, Polar

Create stub files at `/lib/providers/stripe.ts`, `/lib/providers/paddle.ts`, `/lib/providers/polar.ts`. Each should:

1. Export the same adapter function shape as `gumroad.ts` (so the dispatcher signature is uniform).
2. Throw `Error('Not implemented')` when called.
3. Have a `// TODO` comment at the top explaining what the adapter will do when implemented.

The webhook routes at `/app/api/webhook/stripe/route.ts`, `paddle/route.ts`, `polar/route.ts` should each return `501 Not Implemented` for now, but exist as files so the URL structure is reserved and the routing is wired up.

This keeps the system ready to swap providers in a few hours of work whenever we decide to.

---

## Extension-facing endpoints

### POST `/api/license/activate`

Request:
```json
{
  "license_key": "FSTH-A8KM-9P4L-XQ7H-T3BZ",
  "machine_fingerprint": "sha256_hash_64_chars",
  "machine_name": "Yassine's MBP",
  "os": "mac",
  "app_version": "2.2.0"
}
```

Logic:
1. Validate input with Zod.
2. Check denylist → if denied, return 403 with reason.
3. Look up license by `license_key`. If not found → 404.
4. Check `status` is `active` or `past_due`. If `revoked`/`expired` → 403.
5. Check `expires_at` if set. If past → mark `expired`, return 403.
6. Check if this `machine_fingerprint` already has an activation for this license:
   - If yes → update `last_seen_at`, proceed to issue token.
   - If no → count current activations. If `>= machine_limit` → return 409 with list of activated machines (so user can deactivate one).
   - If under limit → insert activation.
7. Sign and return token + token expiry.
8. Log event.

Response (200):
```json
{
  "token": "<jwt>",
  "expires_at": "2026-06-05T12:00:00Z",
  "license": { "tier": "pro", "type": "lifetime",
               "machine_limit": 2, "features": [...] }
}
```

Error responses (409 — machine limit reached):
```json
{
  "error": "machine_limit_reached",
  "message": "This license is already active on 2 machines. Deactivate one to continue.",
  "activations": [
    { "machine_name": "Render Box", "last_seen_at": "...", "id": "..." },
    { "machine_name": "MBP", "last_seen_at": "...", "id": "..." }
  ]
}
```

### POST `/api/license/refresh`

Request:
```json
{
  "token": "<current_jwt>",
  "machine_fingerprint": "..."
}
```

Logic:
1. Decode current token (without verifying expiry).
2. Verify signature is ours.
3. Look up license, validate as above.
4. Update `last_seen_at` on the activation.
5. Issue and return new token.

### POST `/api/license/deactivate`

Lets a customer free up a machine slot from inside the extension.

Request:
```json
{
  "license_key": "FSTH-...",
  "machine_fingerprint": "..."
}
```

Logic: Delete the activation row matching that fingerprint. Log event. Return 200.

### POST `/api/license/status`

Lightweight check — does this key still work? Returns `valid`/`invalid` and reason. Used by extension for non-disruptive periodic health checks.

---

## Admin endpoints

All `/api/admin/*` routes require header `Authorization: Bearer <ADMIN_API_TOKEN>`.

- **`GET /api/admin/licenses?email=...&status=...`** — list/search licenses
- **`POST /api/admin/revoke`** — revoke a license, add to denylist, send revocation email
- **`POST /api/admin/reissue`** — resend the license email to the customer

Keep these simple. A real admin UI can come later — for now JSON endpoints + curl/Postman are enough.

---

## Email templates (Resend)

Three transactional emails, all sent via Resend:

1. **License delivery** (on `purchase.completed`):
   - Subject: `Your Fastoosh Data Automator license`
   - Contains: license key, plan tier, download link, activation instructions, support link.
2. **Subscription renewal failed** (on `subscription.past_due`):
   - Subject: `Action needed: payment failed for your Fastoosh subscription`
   - Link to update payment method on Gumroad.
3. **License revoked** (on manual revoke or refund):
   - Subject: `Your Fastoosh license has been deactivated`
   - Brief reason, contact link.

Each template lives in `/lib/license/email.ts` as a function that takes typed params and returns `{ subject, html, text }`. Use plain HTML strings or React Email — your choice. Keep them simple and brand-consistent.

---

## Machine fingerprint guidance

The CEP extension will compute and send the fingerprint. On the server, just validate the format (64-character hex, sha256-shaped). Do not try to verify the fingerprint server-side — trust the client. The point is to **identify the same machine across launches**, not to be tamper-proof.

Recommended client-side composition (document this but don't implement client here):
```
sha256(
  os_username + "|" +
  hostname + "|" +
  primary_mac_address + "|" +
  cpu_model
)
```

---

## Idempotency

Every webhook event has a `providerEventId`. Before processing, check `events` table for a row with this `provider_event_id` already logged — if found, return 200 immediately without re-processing. This prevents duplicate license creation when providers retry webhooks.

---

## Rate limiting

For now, rely on Vercel's per-IP rate limits. Add proper rate limiting (Upstash Redis) later if abuse becomes a problem. Don't over-engineer this now.

---

## Testing

For each endpoint, write a small test script in `/scripts/test-*.ts` that hits the local dev server with realistic payloads. Don't set up a full test framework yet — just runnable scripts that exercise the happy path and one or two error cases per endpoint.

For Gumroad webhooks specifically: use `ngrok http 3000` during development to expose a public URL, then point Gumroad's Ping URL at the ngrok endpoint with the secret path. Make a $1 test product in Gumroad and buy it with your own card to exercise the real flow.

---

## Migrating existing Gumroad customers

After the system is live, run `/scripts/migrate-gumroad.ts` to backfill licenses for everyone who already bought:

1. Use Gumroad's `/v2/sales` endpoint with pagination to list all sales.
2. For each sale, check if a license already exists (by `provider_payment_id`).
3. If not, create the customer + license + (optionally) send the license email.

The script must be **idempotent** — running it twice should not create duplicates or re-send emails. Use a `--dry-run` flag (default: on) and a `--send-emails` flag (default: off) so the first run only prints what it would do.

---

## Build order (do it in this sequence)

1. **Set up env vars and Supabase schema.** Run the SQL. Confirm tables exist. Add env vars to Vercel and `.env.local`.
2. **Generate the Ed25519 keypair** with `/scripts/generate-keypair.ts`. Add to env. Save the public key for me to embed in the CEP extension later.
3. **Build `/lib/license/`** primitives: `db.ts`, `keys.ts`, `tokens.ts`, `email.ts`, `denylist.ts`, `events.ts`.
4. **Build `/lib/providers/types.ts`** and the **`gumroad.ts` adapter**.
5. **Build `/app/api/webhook/gumroad/[secret]/route.ts`**. Test end-to-end with ngrok + a real Gumroad test purchase. **PAUSE HERE** and show me the result before proceeding.
6. **Build `/app/api/license/activate/route.ts`**. Test with curl using a test license you just created.
7. **Build `/app/api/license/refresh/route.ts`**, **`/deactivate`**, and **`/status`**. **PAUSE HERE** and show me the result.
8. **Build admin endpoints**.
9. **Build the email templates** in Resend. Send a test purchase end-to-end and verify the license email arrives.
10. **Build the stubs** for Stripe, Paddle, Polar adapters and webhook routes (returning 501).
11. **Write `/scripts/migrate-gumroad.ts`** to backfill my existing Gumroad customers.

---

## What I will provide separately

- The exact Gumroad product variant names (so the product map is accurate).
- The Resend domain verification (already done at `fastoosh.com`).
- A list of feature flags to associate with each tier.
- Confirmation when I'm ready to run the migration script for existing customers.

---

## Reality check on Gumroad as primary provider

Be aware of the tradeoffs we accept:

- **10% fee** vs. Stripe's ~3%. On every sale, forever — until we switch.
- **No HMAC signature** on webhooks (we mitigate with secret URL + API verification, but it's weaker than Stripe's design).
- **Less granular subscription events** than Stripe Billing.
- **Customer's card on file lives at Gumroad**, not with us. If we ever leave Gumroad, customers re-enter their cards.
- **We still depend on Gumroad's risk team.** They're more lenient than LemonSqueezy, but they can still suspend us. The license server design means a suspension doesn't break existing customers — their tokens keep working for the token TTL period (7-90 days), but we can't take new payments until we switch providers.

The license server is portable. The payment provider is not. That's the whole point of this architecture.

---

## What I want you to do

Implement the full system above in order, using strict TypeScript, with clear inline comments on the non-obvious bits (especially the token signing/verifying, the Ping verification, and the webhook idempotency logic). Pause at each milestone marked **PAUSE HERE** in the build order, show me a summary of what was built, what to test, and what's next, so I can verify it works before moving on.

Where you have design choices not specified above, pick the simpler option and note the decision in a comment. Don't add features I didn't ask for.
