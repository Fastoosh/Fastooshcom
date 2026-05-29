// Server-side Supabase client (service role — bypasses RLS).
//
// SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are auto-injected into Edge
// Functions by Supabase; we don't set them ourselves. The service role key must
// never reach the client — it lives only in this Edge Function's environment.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

export const supabase: SupabaseClient = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

// ── Row types (mirror license_server_schema.sql) ─────────────────────────────
export interface LicenseCustomerRow {
  id: string;
  email: string;
  name: string | null;
  country: string | null;
  gumroad_customer_id: string | null;
  stripe_customer_id: string | null;
  paddle_customer_id: string | null;
  polar_customer_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface LicenseRow {
  id: string;
  customer_id: string;
  license_key: string;
  product_id: string;
  plan_tier: string;
  type: 'lifetime' | 'subscription';
  status: 'active' | 'revoked' | 'expired' | 'past_due';
  machine_limit: number;
  expires_at: string | null;
  provider: string;
  provider_subscription_id: string | null;
  provider_payment_id: string | null;
  features: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface ActivationRow {
  id: string;
  license_id: string;
  machine_fingerprint: string;
  machine_name: string | null;
  os: string | null;
  app_version: string | null;
  ip_address: string | null;
  activated_at: string;
  last_seen_at: string;
}

// ── Customer helpers ──────────────────────────────────────────────────────────
// Upsert by email (the stable identity we own across providers).
export async function upsertCustomerByEmail(input: {
  email: string;
  name?: string;
  country?: string;
  gumroadCustomerId?: string;
}): Promise<LicenseCustomerRow> {
  const email = input.email.toLowerCase().trim();

  const { data: existing } = await supabase
    .from('license_customers')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (existing) {
    // Backfill fields we didn't have before, without clobbering existing values.
    const patch: Record<string, unknown> = {};
    if (input.name && !existing.name) patch.name = input.name;
    if (input.country && !existing.country) patch.country = input.country;
    if (input.gumroadCustomerId && !existing.gumroad_customer_id) {
      patch.gumroad_customer_id = input.gumroadCustomerId;
    }
    if (Object.keys(patch).length === 0) return existing as LicenseCustomerRow;

    const { data, error } = await supabase
      .from('license_customers')
      .update(patch)
      .eq('id', existing.id)
      .select()
      .single();
    if (error) throw error;
    return data as LicenseCustomerRow;
  }

  const { data, error } = await supabase
    .from('license_customers')
    .insert({
      email,
      name: input.name ?? null,
      country: input.country ?? null,
      gumroad_customer_id: input.gumroadCustomerId ?? null,
    })
    .select()
    .single();
  if (error) throw error;
  return data as LicenseCustomerRow;
}

// ── License helpers ───────────────────────────────────────────────────────────
export async function getLicenseByKey(licenseKey: string): Promise<LicenseRow | null> {
  const { data } = await supabase
    .from('licenses')
    .select('*')
    .eq('license_key', licenseKey)
    .maybeSingle();
  return (data as LicenseRow) ?? null;
}

export async function getLicenseById(id: string): Promise<LicenseRow | null> {
  const { data } = await supabase
    .from('licenses')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  return (data as LicenseRow) ?? null;
}

export async function getLicenseBySubscription(
  provider: string,
  providerSubscriptionId: string,
): Promise<LicenseRow | null> {
  const { data } = await supabase
    .from('licenses')
    .select('*')
    .eq('provider', provider)
    .eq('provider_subscription_id', providerSubscriptionId)
    .maybeSingle();
  return (data as LicenseRow) ?? null;
}

export async function getLicenseByPayment(
  provider: string,
  providerPaymentId: string,
): Promise<LicenseRow | null> {
  const { data } = await supabase
    .from('licenses')
    .select('*')
    .eq('provider', provider)
    .eq('provider_payment_id', providerPaymentId)
    .maybeSingle();
  return (data as LicenseRow) ?? null;
}

export async function updateLicense(
  id: string,
  patch: Partial<LicenseRow>,
): Promise<LicenseRow> {
  const { data, error } = await supabase
    .from('licenses')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data as LicenseRow;
}

// ── Activation helpers ────────────────────────────────────────────────────────
export async function getActivations(licenseId: string): Promise<ActivationRow[]> {
  const { data } = await supabase
    .from('activations')
    .select('*')
    .eq('license_id', licenseId)
    .order('activated_at', { ascending: true });
  return (data as ActivationRow[]) ?? [];
}

export async function getActivation(
  licenseId: string,
  fingerprint: string,
): Promise<ActivationRow | null> {
  const { data } = await supabase
    .from('activations')
    .select('*')
    .eq('license_id', licenseId)
    .eq('machine_fingerprint', fingerprint)
    .maybeSingle();
  return (data as ActivationRow) ?? null;
}
