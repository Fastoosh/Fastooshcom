import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

type Phase = 'idle' | 'loading' | 'ready' | 'expired' | 'error';

/**
 * Invisible component mounted inside Layout. Detects the `?dl=<token>` query
 * parameter that is placed in email download links, calls GET /dl/:token with
 * the anon key Authorization header (JS fetch can do this; a plain browser
 * navigation cannot), marks the lead as email-verified, then triggers the
 * file download — all without requiring SPA-fallback hosting config.
 */
export function DownloadHandler() {
  const [searchParams, setSearchParams] = useSearchParams();
  const token = searchParams.get('dl');

  const [phase, setPhase] = useState<Phase>('idle');
  const [toolName, setToolName] = useState('');
  const [downloadUrl, setDownloadUrl] = useState('');
  const ranRef = useRef(false);

  useEffect(() => {
    if (!token || ranRef.current) return;
    ranRef.current = true;

    // Strip ?dl= from the URL immediately so a refresh doesn't re-trigger
    setSearchParams(prev => {
      const next = new URLSearchParams(prev);
      next.delete('dl');
      return next;
    }, { replace: true });

    setPhase('loading');

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/dl/${encodeURIComponent(token)}`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        });

        if (res.status === 410) {
          setPhase('expired');
          return;
        }
        if (!res.ok) {
          setPhase('error');
          return;
        }

        const data = await res.json();
        if (!data.downloadUrl) { setPhase('error'); return; }

        setToolName(data.toolName || '');
        setDownloadUrl(data.downloadUrl);
        setPhase('ready');

        // Trigger the download
        window.location.href = data.downloadUrl;
      } catch {
        setPhase('error');
      }
    })();
  }, [token]); // eslint-disable-line react-hooks/exhaustive-deps

  if (phase === 'idle') return null;

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'rgba(5,5,5,0.92)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        color: '#fff', gap: 16, padding: 24, textAlign: 'center',
      }}
      onClick={() => phase !== 'loading' && setPhase('idle')}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          padding: '40px 36px',
          maxWidth: 400,
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}
      >
        {/* Loading / ready */}
        {(phase === 'loading' || phase === 'ready') && (
          <>
            <svg
              width="48" height="48" viewBox="0 0 40 40"
              style={{ animation: 'dl-spin 0.9s linear infinite' }}
            >
              <style>{`@keyframes dl-spin { to { transform: rotate(360deg); } }`}</style>
              <circle cx="20" cy="20" r="16" fill="none"
                stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
              <path d="M 20 4 A 16 16 0 0 1 36 20" fill="none"
                stroke="#a855f7" strokeWidth="3" strokeLinecap="round" />
            </svg>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>
              {phase === 'ready' ? 'Download starting…' : 'Preparing your download…'}
            </p>
            {toolName && (
              <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>
                {toolName}
              </p>
            )}
            {phase === 'ready' && downloadUrl && (
              <>
                <p style={{ margin: 0, fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>
                  If the download didn't start automatically:
                </p>
                <a
                  href={downloadUrl}
                  download
                  style={{
                    display: 'inline-block',
                    padding: '11px 28px',
                    background: 'rgba(168,85,247,0.18)',
                    border: '1px solid rgba(168,85,247,0.45)',
                    borderRadius: 8,
                    color: '#c084fc',
                    fontSize: 14,
                    fontWeight: 600,
                    textDecoration: 'none',
                    letterSpacing: '0.02em',
                  }}
                >
                  Click to download
                </a>
              </>
            )}
          </>
        )}

        {/* Expired */}
        {phase === 'expired' && (
          <>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none"
              stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Link expired</p>
            <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
              This download link has already been used or has expired.<br />
              Go back to the Tools page and request a fresh one.
            </p>
            <button
              onClick={() => setPhase('idle')}
              style={{
                padding: '10px 24px',
                background: 'rgba(168,85,247,0.15)',
                border: '1px solid rgba(168,85,247,0.4)',
                borderRadius: 8,
                color: '#c084fc',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                letterSpacing: '0.02em',
              }}
            >
              Close
            </button>
          </>
        )}

        {/* Error */}
        {phase === 'error' && (
          <>
            <svg width="44" height="44" viewBox="0 0 24 24" fill="none"
              stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Something went wrong</p>
            <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
              We couldn't process your download link.<br />
              Please try again or contact support.
            </p>
            <button
              onClick={() => setPhase('idle')}
              style={{
                padding: '10px 24px',
                background: 'rgba(248,113,113,0.1)',
                border: '1px solid rgba(248,113,113,0.35)',
                borderRadius: 8,
                color: '#fca5a5',
                fontSize: 14,
                fontWeight: 600,
                cursor: 'pointer',
                letterSpacing: '0.02em',
              }}
            >
              Close
            </button>
          </>
        )}
      </div>
    </div>
  );
}
