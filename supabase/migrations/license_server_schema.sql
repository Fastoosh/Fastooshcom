-- =====================================================
-- FASTOOSH LICENSE SERVER SCHEMA
-- =====================================================
-- Product-agnostic licensing tables for the Fastoosh keygen.
-- Independent of the content tables (tools/tool_versions): products are
-- referenced by a free-text product_id (e.g. 'fastoosh_data_automator') so
-- this schema can serve any current or future Fastoosh product.
--
-- Run this in the Supabase SQL Editor (separate from schema.sql).
-- RLS is enabled on every table; only the service role key (used by the
-- license Edge Function) can read/write. No public policies.
-- =====================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ========== CUSTOMERS ==========
-- One row per buyer, keyed by email. We own this relationship regardless of
-- which payment provider processed the sale (provider-portability).
CREATE TABLE license_customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  country TEXT,
  gumroad_customer_id TEXT,
  stripe_customer_id TEXT UNIQUE,
  paddle_customer_id TEXT UNIQUE,
  polar_customer_id TEXT UNIQUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========== LICENSES ==========
-- One row per issued license key. The license_key is our own FSTH- format,
-- never the provider's key. Lifetime licenses have expires_at = NULL.
CREATE TABLE licenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES license_customers(id) ON DELETE CASCADE,
  license_key TEXT UNIQUE NOT NULL,
  product_id TEXT NOT NULL,                  -- e.g. 'fastoosh_data_automator'
  plan_tier TEXT NOT NULL,                   -- e.g. 'free', 'pro', 'studio'
  type TEXT NOT NULL CHECK (type IN ('lifetime', 'subscription')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked', 'expired', 'past_due')),
  machine_limit INT NOT NULL DEFAULT 1,
  expires_at TIMESTAMPTZ,                     -- NULL for lifetime
  provider TEXT NOT NULL,                     -- 'gumroad' | 'stripe' | 'paddle' | 'polar' | 'manual'
  provider_subscription_id TEXT,
  provider_payment_id TEXT,
  features TEXT[] DEFAULT '{}',               -- feature flags baked into the token
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_licenses_key ON licenses(license_key);
CREATE INDEX idx_licenses_customer ON licenses(customer_id);
CREATE INDEX idx_licenses_status ON licenses(status);
CREATE INDEX idx_licenses_provider_sub ON licenses(provider, provider_subscription_id);
CREATE INDEX idx_licenses_provider_payment ON licenses(provider, provider_payment_id);

-- ========== ACTIVATIONS ==========
-- One row per (license, machine). Enforces machine_limit. The fingerprint is
-- trusted from the client — we only validate its shape server-side.
CREATE TABLE activations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  machine_fingerprint TEXT NOT NULL,
  machine_name TEXT,
  os TEXT,                                    -- 'win' | 'mac' | 'linux'
  app_version TEXT,
  ip_address INET,
  activated_at TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(license_id, machine_fingerprint)
);

CREATE INDEX idx_activations_license ON activations(license_id);
CREATE INDEX idx_activations_fingerprint ON activations(machine_fingerprint);

-- ========== DENYLIST ==========
-- Source of truth for revocation. A key here is rejected on the next online
-- check regardless of license.status (defense in depth).
CREATE TABLE denylist (
  license_key TEXT PRIMARY KEY,
  reason TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW()
);

-- ========== EVENTS ==========
-- Audit log + webhook idempotency. provider_event_id is the dedupe key.
CREATE TABLE license_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  license_id UUID REFERENCES licenses(id) ON DELETE SET NULL,
  customer_id UUID REFERENCES license_customers(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,                   -- 'license.created', 'license.activated',
                                              -- 'license.refreshed', 'license.revoked',
                                              -- 'license.refunded', 'machine.deactivated',
                                              -- 'webhook.received', 'webhook.failed'
  provider TEXT,
  provider_event_id TEXT,                     -- for idempotency
  payload JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_license_events_license ON license_events(license_id);
CREATE INDEX idx_license_events_type ON license_events(event_type);
CREATE INDEX idx_license_events_provider_event ON license_events(provider, provider_event_id);
CREATE INDEX idx_license_events_created ON license_events(created_at DESC);

-- ========== updated_at TRIGGERS ==========
-- Reuse the existing update_updated_at_column() function from schema.sql.
-- If running this file standalone (function not present), uncomment below:
-- CREATE OR REPLACE FUNCTION update_updated_at_column()
-- RETURNS TRIGGER AS $$
-- BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
-- $$ LANGUAGE plpgsql;

CREATE TRIGGER update_license_customers_updated_at BEFORE UPDATE ON license_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_licenses_updated_at BEFORE UPDATE ON licenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ========== ROW LEVEL SECURITY ==========
-- No public policies. The license Edge Function uses the service role key,
-- which bypasses RLS. Enabling RLS with no policy = deny-all for anon/auth.
ALTER TABLE license_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE licenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE activations ENABLE ROW LEVEL SECURITY;
ALTER TABLE denylist ENABLE ROW LEVEL SECURITY;
ALTER TABLE license_events ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- DONE. Verify the 5 tables exist in Table Editor:
-- license_customers, licenses, activations, denylist, license_events
-- =====================================================
