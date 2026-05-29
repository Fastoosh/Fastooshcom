// TODO: Paddle adapter (future). Converts Paddle webhook events into
// InternalEvents. Paddle signs webhooks (verify the signature), and acts as
// merchant of record. The dispatcher in events.ts stays untouched.

import type { ProviderAdapter } from './types.ts';

export const paddleAdapter: ProviderAdapter = async () => {
  throw new Error('Not implemented: Paddle adapter is a stub.');
};
