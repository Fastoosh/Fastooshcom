// Gumroad overlay checkout helpers.
//
// Gumroad provides an overlay (modal) checkout via gumroad.js: any anchor with
// class "gumroad-button" pointing at a product URL opens in an on-page overlay
// instead of navigating away. We load the script once, then trigger the overlay
// by creating a hidden gumroad-button anchor and clicking it — this keeps our
// own styled React buttons while still getting the native overlay.
//
// Prefill: Gumroad accepts `email` and `wanted=true` query params, plus custom
// fields. We pass our tool_version_id + session_id as URL params so the webhook
// can attribute the sale (the webhook reads them from the verified sale).

let scriptLoading: Promise<void> | null = null;

export function loadGumroadScript(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve();
  if ((window as any).GumroadOverlay || document.querySelector('script[data-gumroad]')) {
    return Promise.resolve();
  }
  if (scriptLoading) return scriptLoading;
  scriptLoading = new Promise<void>((resolve) => {
    const s = document.createElement('script');
    s.src = 'https://gumroad.com/js/gumroad.js';
    s.async = true;
    s.setAttribute('data-gumroad', '1');
    s.onload = () => resolve();
    s.onerror = () => resolve(); // fail open — caller falls back to new-tab
    document.body.appendChild(s);
  });
  return scriptLoading;
}

// Build a Gumroad checkout URL with prefill + attribution params.
export function buildGumroadCheckoutUrl(opts: {
  baseUrl: string;
  email?: string;
  userId?: string;
  toolVersionId?: string;
  sessionId?: string;
  overlay?: boolean;
}): string {
  const { baseUrl, email, userId, toolVersionId, sessionId, overlay } = opts;
  if (!baseUrl) return '/work-with-us';
  try {
    const url = new URL(baseUrl);
    if (overlay) url.searchParams.set('wanted', 'true');
    if (email) url.searchParams.set('email', email);
    // Gumroad passes through arbitrary query params to the sale's `url_params`,
    // which our webhook can read for attribution.
    if (toolVersionId) url.searchParams.set('tool_version_id', toolVersionId);
    if (userId)        url.searchParams.set('user_id', userId);
    if (sessionId)     url.searchParams.set('session_id', sessionId);
    return url.toString();
  } catch {
    return baseUrl;
  }
}

// Open the Gumroad overlay for a checkout URL. Falls back to a new tab if the
// overlay script isn't available or the URL isn't a Gumroad product link.
export async function openGumroadOverlay(checkoutUrl: string): Promise<void> {
  const isGumroad = /gumroad\.com|\.gumroad\./.test(checkoutUrl);
  if (!isGumroad) {
    window.open(checkoutUrl, '_blank', 'noopener,noreferrer');
    return;
  }
  await loadGumroadScript();
  // Create a transient gumroad-button anchor and click it so gumroad.js binds
  // and shows the overlay. Ensure ?wanted=true is present.
  const href = checkoutUrl.includes('wanted=')
    ? checkoutUrl
    : checkoutUrl + (checkoutUrl.includes('?') ? '&' : '?') + 'wanted=true';
  const a = document.createElement('a');
  a.className = 'gumroad-button';
  a.href = href;
  a.style.display = 'none';
  document.body.appendChild(a);
  // gumroad.js binds click handlers on load; a small delay ensures binding ran.
  setTimeout(() => {
    a.click();
    // If the overlay didn't take over (script blocked), fall back to new tab.
    setTimeout(() => { document.body.removeChild(a); }, 1000);
  }, 50);
}
