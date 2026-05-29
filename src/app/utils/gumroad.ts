// Gumroad checkout helpers (full-page hosted checkout).
//
// We use Gumroad's hosted checkout: the buy button sends the customer to the
// Gumroad product page to pay, then Gumroad redirects them back to
// fastoosh.com/account?purchase=success (configured in the Gumroad product's
// "after purchase" redirect). This is Gumroad's reliable, intended flow.
//
// Prefill/attribution: Gumroad forwards query params to the sale's url_params,
// which the webhook can read. We pass email + tool_version_id + session_id.

export function buildGumroadCheckoutUrl(opts: {
  baseUrl: string;
  email?: string;
  userId?: string;
  toolVersionId?: string;
  sessionId?: string;
}): string {
  const { baseUrl, email, userId, toolVersionId, sessionId } = opts;
  if (!baseUrl) return '/work-with-us';
  try {
    const url = new URL(baseUrl);
    if (email) url.searchParams.set('email', email);
    if (toolVersionId) url.searchParams.set('tool_version_id', toolVersionId);
    if (userId)        url.searchParams.set('user_id', userId);
    if (sessionId)     url.searchParams.set('session_id', sessionId);
    return url.toString();
  } catch {
    return baseUrl;
  }
}

// Open the Gumroad checkout. Full-page navigation in the same tab so Gumroad can
// redirect the customer back to fastoosh.com after purchase.
export function openGumroadCheckout(checkoutUrl: string): void {
  if (!checkoutUrl) return;
  window.location.href = checkoutUrl;
}
