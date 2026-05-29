// Gumroad overlay checkout helpers.
//
// gumroad.js (→ gumroad-bundle.js) binds an overlay to any <a> anchor it finds,
// including anchors added after load (it runs a MutationObserver over the whole
// document). An anchor with data-gumroad-overlay-checkout="true" opens the
// checkout in an on-page overlay (keeping the buyer on fastoosh.com) instead of
// navigating away.
//
// On a completed purchase the overlay posts a `message` to the parent window:
//   JSON.parse(ev.data).post_message_name === "sale"
// We listen for that once and redirect to /account?purchase=success, where the
// success banner + license polling live.

let scriptLoading: Promise<void> | null = null;

export function loadGumroadScript(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  if (document.querySelector('script[data-gumroad]')) return Promise.resolve();
  if (scriptLoading) return scriptLoading;
  scriptLoading = new Promise<void>((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://gumroad.com/js/gumroad.js';
    s.async = true;
    s.setAttribute('data-gumroad', '1');
    s.onload = () => resolve();
    s.onerror = () => resolve();
    document.body.appendChild(s);
  });
  return scriptLoading;
}

// Install the global `sale` listener once. On a successful overlay purchase,
// redirect to the account success page.
let saleListenerInstalled = false;
export function installGumroadSaleListener(redirectTo = '/account?purchase=success'): void {
  if (typeof window === 'undefined' || saleListenerInstalled) return;
  saleListenerInstalled = true;
  window.addEventListener('message', (ev: MessageEvent) => {
    try {
      const data = typeof ev.data === 'string' ? JSON.parse(ev.data) : ev.data;
      if (data && data.post_message_name === 'sale') {
        window.location.href = redirectTo;
      }
    } catch {
      // Non-JSON messages from other sources — ignore.
    }
  });
}

// Build a Gumroad checkout URL with prefill + attribution params. Gumroad
// forwards arbitrary query params to the sale's url_params for the webhook.
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

export function isGumroadUrl(u: string): boolean {
  return /gumroad\.com|\.gumroad\./.test(u || '');
}

// Secondary CTAs (showcase, comparison modal) that aren't rendered as overlay
// anchors open the checkout in a new tab, keeping fastoosh.com open behind it.
export function openGumroadCheckout(checkoutUrl: string): void {
  if (!checkoutUrl) return;
  window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
}
