// Core event dispatcher + audit log.
//
// This is the provider-agnostic heart of the system. Every webhook adapter
// normalizes its payload into an InternalEvent and calls dispatchEvent(). This
// file never knows or cares which provider sent it — swapping providers means
// writing a new adapter, NOT touching this file.
//
// Idempotency: every event carries a providerEventId. We log a 'webhook.received'
// row first; if that providerEventId was already processed, we skip. This stops
// duplicate license creation when providers retry webhooks.

import { supabase } from './db.ts';
import {
  upsertCustomerByEmail,
  getLicenseBySubscription,
  getLicenseByPayment,
  updateLicense,
  type LicenseRow,
} from './db.ts';
import { generateLicenseKey } from './keys.ts';
import { addToDenylist } from './denylist.ts';
import {
  buildLicenseDeliveryEmail,
  buildPastDueEmail,
  buildRevokedEmail,
  sendEmail,
} from './email.ts';
import type { InternalEvent } from '../providers/types.ts';

// Product display names for emails, keyed by internal product_id.
// (Kept minimal; expand when more products are added.)
const PRODUCT_NAMES: Record<string, string> = {
  fastoosh_data_automator: 'Fastoosh Data Automator',
};
function productName(id: string): string {
  return PRODUCT_NAMES[id] ?? 'Fastoosh';
}

// ── Audit log ─────────────────────────────────────────────────────────────────
export async function logEvent(input: {
  licenseId?: string | null;
  customerId?: string | null;
  eventType: string;
  provider?: string;
  providerEventId?: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await supabase.from('license_events').insert({
    license_id: input.licenseId ?? null,
    customer_id: input.customerId ?? null,
    event_type: input.eventType,
    provider: input.provider ?? null,
    provider_event_id: input.providerEventId ?? null,
    payload: input.payload ?? null,
  });
  if (error) console.error('[events] log failed:', error.message);
}

// Idempotency check: has this providerEventId already been processed?
// We treat any prior 'webhook.received' OR a license-mutating event with this id
// as "already handled".
export async function alreadyProcessed(
  provider: string,
  providerEventId: string,
): Promise<boolean> {
  if (!providerEventId) return false;
  const { data } = await supabase
    .from('license_events')
    .select('id')
    .eq('provider', provider)
    .eq('provider_event_id', providerEventId)
    .in('event_type', ['license.created', 'license.refreshed', 'subscription.renewed', 'payment.refunded', 'webhook.processed'])
    .limit(1);
  return !!(data && data.length > 0);
}

// ── Subscription expiry from a unix-seconds period end ────────────────────────
function periodEndToIso(currentPeriodEnd: number): string {
  return new Date(currentPeriodEnd * 1000).toISOString();
}

// ── Dispatcher ────────────────────────────────────────────────────────────────
export async function dispatchEvent(event: InternalEvent): Promise<{ ok: boolean; detail?: string }> {
  switch (event.type) {
    case 'purchase.completed':
      return handlePurchaseCompleted(event);
    case 'subscription.renewed':
      return handleSubscriptionRenewed(event);
    case 'subscription.canceled':
      return handleSubscriptionCanceled(event);
    case 'subscription.past_due':
      return handleSubscriptionPastDue(event);
    case 'payment.refunded':
      return handlePaymentRefunded(event);
  }
}

async function handlePurchaseCompleted(
  event: Extract<InternalEvent, { type: 'purchase.completed' }>,
): Promise<{ ok: boolean; detail?: string }> {
  // If we've already created a license for this payment id, return idempotently.
  const existing = await getLicenseByPayment(event.provider, event.payment.providerPaymentId);
  if (existing) {
    return { ok: true, detail: 'already_created' };
  }

  const customer = await upsertCustomerByEmail({
    email: event.customer.email,
    name: event.customer.name,
    country: event.customer.country,
    gumroadCustomerId: event.provider === 'gumroad' ? event.customer.providerCustomerId : undefined,
  });

  const licenseKey = generateLicenseKey();
  const expiresAt =
    event.license.type === 'subscription' && event.subscription
      ? periodEndToIso(event.subscription.currentPeriodEnd)
      : null;

  const { data: license, error } = await supabase
    .from('licenses')
    .insert({
      customer_id: customer.id,
      license_key: licenseKey,
      product_id: event.product.id,
      plan_tier: event.product.tier,
      type: event.license.type,
      status: 'active',
      machine_limit: event.license.machineLimit,
      expires_at: expiresAt,
      provider: event.provider,
      provider_subscription_id: event.subscription?.providerSubscriptionId ?? null,
      provider_payment_id: event.payment.providerPaymentId,
      features: event.license.features ?? [],
    })
    .select()
    .single();

  if (error) {
    await logEvent({
      customerId: customer.id,
      eventType: 'webhook.failed',
      provider: event.provider,
      providerEventId: event.providerEventId,
      payload: { stage: 'insert_license', error: error.message },
    });
    return { ok: false, detail: error.message };
  }

  const row = license as LicenseRow;

  await logEvent({
    licenseId: row.id,
    customerId: customer.id,
    eventType: 'license.created',
    provider: event.provider,
    providerEventId: event.providerEventId,
    payload: { tier: row.plan_tier, type: row.type, machine_limit: row.machine_limit },
  });

  // Send the license email (failure is logged, not fatal).
  const mail = buildLicenseDeliveryEmail({
    email: customer.email,
    licenseKey,
    productName: productName(row.product_id),
    planTier: row.plan_tier,
    type: row.type,
    machineLimit: row.machine_limit,
  });
  await sendEmail(customer.email, mail);

  return { ok: true, detail: 'license_created' };
}

async function handleSubscriptionRenewed(
  event: Extract<InternalEvent, { type: 'subscription.renewed' }>,
): Promise<{ ok: boolean; detail?: string }> {
  const license = await getLicenseBySubscription(event.provider, event.providerSubscriptionId);
  if (!license) return { ok: true, detail: 'no_matching_license' };

  await updateLicense(license.id, {
    expires_at: periodEndToIso(event.currentPeriodEnd),
    status: 'active', // a renewal clears past_due
  });

  await logEvent({
    licenseId: license.id,
    customerId: license.customer_id,
    eventType: 'subscription.renewed',
    provider: event.provider,
    providerEventId: event.providerEventId,
    payload: { new_expires_at: periodEndToIso(event.currentPeriodEnd) },
  });
  return { ok: true, detail: 'renewed' };
}

async function handleSubscriptionCanceled(
  event: Extract<InternalEvent, { type: 'subscription.canceled' }>,
): Promise<{ ok: boolean; detail?: string }> {
  const license = await getLicenseBySubscription(event.provider, event.providerSubscriptionId);
  if (!license) return { ok: true, detail: 'no_matching_license' };

  // Keep status 'active' until expires_at passes — the customer paid for the
  // current period. We set expires_at to effectiveAt; the license naturally
  // lapses to 'expired' at the next activate/refresh after that time.
  await updateLicense(license.id, {
    expires_at: periodEndToIso(event.effectiveAt),
  });

  await logEvent({
    licenseId: license.id,
    customerId: license.customer_id,
    eventType: 'subscription.canceled',
    provider: event.provider,
    providerEventId: event.providerEventId,
    payload: { effective_at: periodEndToIso(event.effectiveAt) },
  });
  return { ok: true, detail: 'canceled' };
}

async function handleSubscriptionPastDue(
  event: Extract<InternalEvent, { type: 'subscription.past_due' }>,
): Promise<{ ok: boolean; detail?: string }> {
  const license = await getLicenseBySubscription(event.provider, event.providerSubscriptionId);
  if (!license) return { ok: true, detail: 'no_matching_license' };

  await updateLicense(license.id, { status: 'past_due' });

  await logEvent({
    licenseId: license.id,
    customerId: license.customer_id,
    eventType: 'subscription.past_due',
    provider: event.provider,
    providerEventId: event.providerEventId,
  });

  // Notify the customer to update payment.
  const { data: cust } = await supabase
    .from('license_customers')
    .select('email')
    .eq('id', license.customer_id)
    .maybeSingle();
  if (cust?.email) {
    await sendEmail(cust.email, buildPastDueEmail({ productName: productName(license.product_id) }));
  }
  return { ok: true, detail: 'past_due' };
}

async function handlePaymentRefunded(
  event: Extract<InternalEvent, { type: 'payment.refunded' }>,
): Promise<{ ok: boolean; detail?: string }> {
  const license = await getLicenseByPayment(event.provider, event.providerPaymentId);
  if (!license) return { ok: true, detail: 'no_matching_license' };

  await updateLicense(license.id, { status: 'revoked' });
  await addToDenylist(license.license_key, 'refund');

  await logEvent({
    licenseId: license.id,
    customerId: license.customer_id,
    eventType: 'license.refunded',
    provider: event.provider,
    providerEventId: event.providerEventId,
  });

  const { data: cust } = await supabase
    .from('license_customers')
    .select('email')
    .eq('id', license.customer_id)
    .maybeSingle();
  if (cust?.email) {
    await sendEmail(cust.email, buildRevokedEmail({ productName: productName(license.product_id), reason: 'refund' }));
  }
  return { ok: true, detail: 'refunded_revoked' };
}
