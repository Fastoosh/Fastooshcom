import { useEffect, type ReactNode, type CSSProperties } from 'react';
import {
  loadGumroadScript, installGumroadSaleListener,
  buildGumroadCheckoutUrl, isGumroadUrl,
} from '../../utils/gumroad';

// Renders the buy action as a real <a class="gumroad-button"
// data-gumroad-overlay-checkout="true"> so gumroad.js binds the on-page overlay
// to it (its MutationObserver picks up anchors React adds after load). On a
// completed purchase the overlay posts a `sale` message → installGumroadSaleListener
// redirects to /account?purchase=success.
//
// Non-Gumroad URLs (e.g. a free direct-download link) render as a normal link.
export function GumroadBuyButton({
  baseUrl,
  email,
  userId,
  toolVersionId,
  sessionId,
  className,
  style,
  children,
  onBeforeBuy,
  requireAuth,
}: {
  baseUrl: string;
  email?: string;
  userId?: string;
  toolVersionId?: string;
  sessionId?: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
  // Called on click before navigating. Return false to block (e.g. not signed in).
  onBeforeBuy?: () => boolean | void;
  requireAuth?: boolean;
}) {
  useEffect(() => {
    loadGumroadScript();
    installGumroadSaleListener();
  }, []);

  const gum = isGumroadUrl(baseUrl);
  const href = buildGumroadCheckoutUrl({ baseUrl, email, userId, toolVersionId, sessionId });

  const handleClick = (e: React.MouseEvent) => {
    const ok = onBeforeBuy?.();
    if (ok === false) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  // Non-Gumroad → plain link (free download etc.), opens in a new tab.
  if (!gum) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} style={style} onClick={handleClick}>
        {children}
      </a>
    );
  }

  return (
    <a
      className={`gumroad-button ${className ?? ''}`}
      href={href}
      data-gumroad-overlay-checkout="true"
      style={style}
      onClick={handleClick}
    >
      {children}
    </a>
  );
}
