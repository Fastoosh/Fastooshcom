// Gumroad hosted-checkout helpers.
//
// The buy button opens Gumroad's hosted checkout in a new tab (keeping
// fastoosh.com open behind it). After paying, the customer gets their license
// by email and sees it in their account's My Licenses. We don't use Gumroad's
// overlay widget — it doesn't bind reliably to SPA-rendered anchors.
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

export function openGumroadCheckout(checkoutUrl: string): void {
  if (!checkoutUrl) return;
  window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
}
