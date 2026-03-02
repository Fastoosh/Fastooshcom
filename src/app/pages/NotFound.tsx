import { useEffect, useState } from 'react';
import { useLocation, Link } from 'react-router';
import { motion } from 'motion/react';
import { GlassCard } from '../components/shared/GlassCard';
import { NeonButton } from '../components/shared/NeonButton';
import { Home } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

// Match /dl/<token> — handles the case where React Router doesn't match the
// dedicated /dl/:token route (e.g. stale deployed build, route-scoring edge
// case in RR v7). Acts as a guaranteed fallback for the download flow.
const DL_PATTERN = /^\/dl\/([A-Za-z0-9]+)\/?$/;

type DlState = 'loading' | 'redirecting' | 'expired' | 'error';

function DownloadHandler({ token }: { token: string }) {
  const [state, setState] = useState<DlState>('loading');

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(`${API_BASE}/dl/${token}`, {
          headers: { Authorization: `Bearer ${publicAnonKey}` },
        });

        if (cancelled) return;

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          setState(body?.error === 'link_expired' ? 'expired' : 'error');
          return;
        }

        const { downloadUrl } = await res.json();
        if (!downloadUrl) { setState('error'); return; }

        setState('redirecting');
        setTimeout(() => { if (!cancelled) window.location.replace(downloadUrl); }, 400);
      } catch {
        if (!cancelled) setState('error');
      }
    })();

    return () => { cancelled = true; };
  }, [token]);

  return (
    <div style={{
      minHeight: '60vh',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 16,
      textAlign: 'center',
      padding: 24,
    }}>
      {(state === 'loading' || state === 'redirecting') && (
        <>
          <svg width="40" height="40" viewBox="0 0 40 40"
            style={{ animation: 'spin 0.9s linear infinite' }}>
            <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            <circle cx="20" cy="20" r="16" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3"/>
            <path d="M 20 4 A 16 16 0 0 1 36 20" fill="none" stroke="#a855f7" strokeWidth="3" strokeLinecap="round"/>
          </svg>
          <p style={{ margin: 0, fontSize: 15, color: 'rgba(255,255,255,0.55)' }}>
            {state === 'redirecting' ? 'Starting download…' : 'Preparing your download…'}
          </p>
        </>
      )}

      {state === 'expired' && (
        <>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
          </svg>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 600, color: '#fff' }}>Link expired</p>
          <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.45)', maxWidth: 320, lineHeight: 1.6 }}>
            Download links are single-use and expire after 1 hour.<br/>
            Go back to the Tools page and request a new one.
          </p>
          <Link to="/tools" style={{
            marginTop: 8, display: 'inline-block', padding: '10px 24px',
            background: 'rgba(168,85,247,0.15)', border: '1px solid rgba(168,85,247,0.4)',
            borderRadius: 8, color: '#c084fc', fontSize: 14, fontWeight: 600,
            textDecoration: 'none',
          }}>Back to Tools</Link>
        </>
      )}

      {state === 'error' && (
        <>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/>
          </svg>
          <p style={{ margin: 0, fontSize: 17, fontWeight: 600, color: '#fff' }}>Something went wrong</p>
          <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.45)', maxWidth: 320, lineHeight: 1.6 }}>
            We couldn't process your download link. Please try again or contact support.
          </p>
          <Link to="/tools" style={{
            marginTop: 8, display: 'inline-block', padding: '10px 24px',
            background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.35)',
            borderRadius: 8, color: '#fca5a5', fontSize: 14, fontWeight: 600,
            textDecoration: 'none',
          }}>Back to Tools</Link>
        </>
      )}
    </div>
  );
}

export function NotFound() {
  const { pathname } = useLocation();
  const dlMatch = pathname.match(DL_PATTERN);

  // If the URL looks like a download link, intercept it here instead of
  // showing 404. This fires when the dedicated /dl/:token route doesn't match
  // (stale deployment, route-ranking edge case, etc.).
  if (dlMatch) {
    return <DownloadHandler token={dlMatch[1]} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-2xl w-full"
      >
        <GlassCard neonBorder className="p-12 text-center">
          <div className="text-8xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent mb-6">
            404
          </div>
          <h1 className="text-3xl md:text-4xl mb-4">Page not found</h1>
          <p className="text-white/60 mb-8">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <NeonButton href="/">
            <Home className="w-5 h-5 mr-2 rtl:mr-0 rtl:ml-2 inline" />
            Back to home
          </NeonButton>
        </GlassCard>
      </motion.div>
    </div>
  );
}
