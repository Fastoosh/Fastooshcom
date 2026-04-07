import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

type State = 'loading' | 'redirecting' | 'expired' | 'error';

// This page is a fallback for users who navigate to /dl/:token via the React
// SPA (e.g. by copying the Supabase link into the address bar). The canonical
// download flow goes through the Supabase Edge Function URL directly, which
// serves a self-contained HTML redirect page without needing SPA routing.
export function DownloadRedirect() {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<State>('loading');

  useEffect(() => {
    if (!token) { setState('error'); return; }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/dl/${token}`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        });

        if (cancelled) return;

        if (!res.ok) {
          // 410 = token already used (email link was clicked via Supabase URL)
          setState('expired');
          return;
        }

        // The server now returns HTML, not JSON — this branch handles the
        // edge case where someone hits this React route with a still-valid
        // token. Redirect them using the Location header if present, or fall
        // back to the tools page.
        const ct = res.headers.get('content-type') ?? '';
        if (ct.includes('application/json')) {
          const { downloadUrl } = await res.json();
          if (!downloadUrl) { setState('error'); return; }
          setState('redirecting');
          setTimeout(() => { if (!cancelled) window.location.replace(downloadUrl); }, 400);
        } else {
          // HTML page returned — download already triggered on the server side;
          // just send the user to the tools page.
          setState('redirecting');
          setTimeout(() => { if (!cancelled) window.location.replace('https://www.fastoosh.com/tools'); }, 1200);
        }
      } catch {
        if (!cancelled) setState('error');
      }
    })();

    return () => { cancelled = true; };
  }, [token]);

  const containerStyle: React.CSSProperties = {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#050505',
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    color: '#fff',
    gap: '16px',
    padding: '24px',
    textAlign: 'center',
  };

  return (
    <div style={containerStyle}>
      {(state === 'loading' || state === 'redirecting') && (
        <>
          <svg
            width="40" height="40" viewBox="0 0 40 40"
            style={{ animation: 'spin 0.9s linear infinite' }}
          >
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <circle cx="20" cy="20" r="16" fill="none"
              stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
            <path d="M 20 4 A 16 16 0 0 1 36 20" fill="none"
              stroke="#a855f7" strokeWidth="3" strokeLinecap="round" />
          </svg>
          <p style={{ margin: 0, fontSize: '15px', color: 'rgba(255,255,255,0.55)', letterSpacing: '0.01em' }}>
            {state === 'redirecting' ? 'Starting download…' : 'Preparing your download…'}
          </p>
        </>
      )}

      {state === 'expired' && (
        <>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
            stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <p style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: '#fff' }}>Link already used</p>
          <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255,255,255,0.45)', maxWidth: 340, lineHeight: 1.6 }}>
            This download link was already activated — your file should have started downloading
            when you clicked the button in the email.
            <br /><br />
            If you still need the file, request a new download link from the Tools page.
          </p>
          <Link to="/tools" style={{
            marginTop: 8, display: 'inline-block', padding: '10px 24px',
            background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.4)',
            borderRadius: 8, color: '#c084fc', fontSize: 14, fontWeight: 600,
            textDecoration: 'none', letterSpacing: '0.02em',
          }}>
            Back to Tools
          </Link>
        </>
      )}

      {state === 'error' && (
        <>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none"
            stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
          <p style={{ margin: 0, fontSize: '17px', fontWeight: 600, color: '#fff' }}>Something went wrong</p>
          <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255,255,255,0.45)', maxWidth: 320, lineHeight: 1.6 }}>
            We couldn't process your download link. Please try again or contact support.
          </p>
          <Link to="/tools" style={{
            marginTop: 8, display: 'inline-block', padding: '10px 24px',
            background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.35)',
            borderRadius: 8, color: '#fca5a5', fontSize: 14, fontWeight: 600,
            textDecoration: 'none', letterSpacing: '0.02em',
          }}>
            Back to Tools
          </Link>
        </>
      )}
    </div>
  );
}
