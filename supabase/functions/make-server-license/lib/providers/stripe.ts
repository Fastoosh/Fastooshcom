// TODO: Stripe adapter (future). When we move to Stripe (likely via Stripe Atlas),
// this converts Stripe webhook events into InternalEvents:
//   checkout.session.completed / invoice.paid  -> purchase.completed
//   invoice.paid (renewal)                      -> subscription.renewed
//   customer.subscription.deleted               -> subscription.canceled
//   invoice.payment_failed                      -> subscription.past_due
//   charge.refunded                             -> payment.refunded
// Stripe HAS HMAC signatures (stripe-signature header) — verify those instead of
// the API-roundtrip Gumroad needs. The dispatcher in events.ts stays untouched.

import type { ProviderAdapter } from './types.ts';

export const stripeAdapter: ProviderAdapter = async () => {
  throw new Error('Not implemented: Stripe adapter is a stub.');
};
