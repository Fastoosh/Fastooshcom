// Provider-agnostic event types.
//
// Every payment-provider webhook handler normalizes its raw payload into one of
// these InternalEvent shapes, then hands it to the single core dispatcher in
// lib/license/events.ts. The dispatcher never knows which provider an event came
// from — that's the whole point: swapping providers = writing one adapter, the
// core stays untouched.

export type Provider = 'gumroad' | 'stripe' | 'paddle' | 'polar' | 'manual';

export type LicenseType = 'lifetime' | 'subscription';

// A purchase that should result in a new (or upserted) license.
export interface PurchaseCompletedEvent {
  type: 'purchase.completed';
  provider: Provider;
  providerEventId: string;            // dedupe key (e.g. Gumroad sale_id)
  customer: {
    email: string;
    name?: string;
    country?: string;
    providerCustomerId?: string;
  };
  product: {
    id: string;                       // internal product id, e.g. 'fastoosh_data_automator'
    tier: string;                     // internal tier, e.g. 'pro'
  };
  license: {
    type: LicenseType;
    machineLimit: number;             // seeded from checkout (quantity), admin-editable later
    features?: string[];              // feature flags baked into the token
  };
  subscription?: {
    providerSubscriptionId: string;
    currentPeriodEnd: number;         // unix seconds
  };
  payment: {
    providerPaymentId: string;
    amount: number;                   // in dollars
    currency: string;
  };
}

export interface SubscriptionRenewedEvent {
  type: 'subscription.renewed';
  provider: Provider;
  providerEventId: string;
  providerSubscriptionId: string;
  currentPeriodEnd: number;           // unix seconds
}

export interface SubscriptionCanceledEvent {
  type: 'subscription.canceled';
  provider: Provider;
  providerEventId: string;
  providerSubscriptionId: string;
  effectiveAt: number;                // unix seconds; when access actually ends
}

export interface SubscriptionPastDueEvent {
  type: 'subscription.past_due';
  provider: Provider;
  providerEventId: string;
  providerSubscriptionId: string;
}

export interface PaymentRefundedEvent {
  type: 'payment.refunded';
  provider: Provider;
  providerEventId: string;
  providerPaymentId: string;
}

export type InternalEvent =
  | PurchaseCompletedEvent
  | SubscriptionRenewedEvent
  | SubscriptionCanceledEvent
  | SubscriptionPastDueEvent
  | PaymentRefundedEvent;

// Every provider adapter exports a function of this shape: it takes the raw
// request (already-parsed body + headers) and returns a normalized InternalEvent,
// or null when the event is one we intentionally ignore (e.g. a $0 free sale).
export interface AdapterContext {
  body: Record<string, unknown>;
  headers: Headers;
  testMode: boolean;                  // skip provider-side verification when true
}

export type ProviderAdapter = (ctx: AdapterContext) => Promise<InternalEvent | null>;
