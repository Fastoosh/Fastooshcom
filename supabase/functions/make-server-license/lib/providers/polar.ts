// TODO: Polar adapter (future). Converts Polar webhook events into
// InternalEvents. Polar signs webhooks (verify the signature). The dispatcher
// in events.ts stays untouched.

import type { ProviderAdapter } from './types.ts';

export const polarAdapter: ProviderAdapter = async () => {
  throw new Error('Not implemented: Polar adapter is a stub.');
};
