/**
 * /auth/callback — PKCE OAuth landing page
 *
 * flowType:'pkce' + detectSessionInUrl:false means the singleton never
 * auto-exchanges the ?code= param.  This page calls exchangeCodeForSession()
 * exactly once (with up to 3 retries for transient GoTrue replication lag).
 *
 * URL forms:
 *   PKCE:     ?code=xxx          → exchangeCodeForSession(code)
 *   Implicit: #access_token=xxx  → getSession() (legacy fallback)
 *
 * REQUIRED in Supabase → Authentication → URL Configuration → Redirect URLs:
 *   https://www.fastoosh.com/auth/callback
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Copy, Check, AlertCircle, RefreshCw, Loader2 } from 'lucide-react';
import { getSupabaseClient } from '../utils/supabase-client';

const CALLBACK_URL = 'https://www.fastoosh.com/auth/callback';

// Retry helper: waits `ms` milliseconds then calls `fn`; retries up to `maxAttempts`
async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number,
  delaysMs: number[],
  onRetry?: (attempt: number, error: string) => void,
): Promise<T> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, delaysMs[attempt - 1] ?? 1000));
      onRetry?.(attempt + 1, '');
    }
    try {
      return await fn();
    } catch (err) {
      if (attempt === maxAttempts - 1) throw err;
      onRetry?.(attempt + 2, (err as Error).message);
    }
  }
  throw new Error('Unreachable');
}

export function AuthCallback() {
  const navigate = useNavigate();

  const [status,   setStatus]   = useState<'loading' | 'error' | 'missing'>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [attempt,  setAttempt]  = useState(1);
  const [copied,   setCopied]   = useState(false);

  const copyUrl = () => {
    navigator.clipboard.writeText(CALLBACK_URL).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  useEffect(() => {
    const supabase     = getSupabaseClient();
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams   = new URLSearchParams(window.location.hash.replace(/^#/, ''));

    const code     = searchParams.get('code');
    const hasToken = hashParams.has('access_token');
    const hasError =
      searchParams.has('error') || searchParams.has('error_description') ||
      hashParams.has('error')   || hashParams.has('error_description');

    const storageKey = `sb-${new URL(`https://${location.hostname}`).hostname}-auth-token`;

    // ── Provider-level error ──────────────────────────────────────────────
    if (hasError) {
      const msg =
        searchParams.get('error_description') || searchParams.get('error') ||
        hashParams.get('error_description')   || hashParams.get('error') ||
        'Authentication failed.';
      setErrorMsg(msg);
      setStatus('error');
      return;
    }

    // ── PKCE flow — exchange with retry ───────────────────────────────────
    if (code) {
      retryWithBackoff(
        async () => {
          const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          return session;
        },
        3,           // max attempts
        [600, 1500], // delays between attempts (ms)
        (nextAttempt, _prevErr) => {
          setAttempt(nextAttempt);
        },
      ).then(_session => {
        navigate('/account', { replace: true });
      }).catch((err: any) => {
        const msg: string = err?.message ?? String(err);
        setErrorMsg(msg);
        setStatus('error');
      });

      return;
    }

    // ── Legacy implicit flow — #access_token in hash ──────────────────────
    if (hasToken) {
      supabase.auth.getSession().then(({ data: { session }, error }) => {
        if (error) { setErrorMsg(error.message); setStatus('error'); return; }
        if (session) { navigate('/account', { replace: true }); return; }
        setErrorMsg('Session could not be established. Please try signing in again.');
        setStatus('error');
      });
      return;
    }

    // ── Nothing in the URL → redirect URL not whitelisted ────────────────
    setStatus('missing');
  }, [navigate]);

  /* ── UI ─────────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6">

      {/* ── Redirect URL not whitelisted ── */}
      {status === 'missing' && (
        <div className="w-full max-w-lg space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-300 font-semibold text-sm mb-1">Redirect URL not whitelisted in Supabase</p>
              <p className="text-amber-200/60 text-xs leading-relaxed">
                Add the URL below to Supabase → Authentication → URL Configuration → Redirect URLs, then try again.
              </p>
            </div>
          </div>
          <div className="p-5 rounded-2xl bg-white/4 border border-white/10 space-y-3">
            <div className="flex items-center gap-2 rounded-xl bg-black/50 border border-white/10 px-3 py-2.5">
              <code className="flex-1 text-xs text-purple-300 font-mono break-all">{CALLBACK_URL}</code>
              <button onClick={copyUrl} className="flex-shrink-0 text-white/30 hover:text-purple-400 transition-colors">
                {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button onClick={() => navigate('/account', { replace: true })}
            className="w-full py-2.5 rounded-xl text-white/40 hover:text-white/70 text-sm
              transition-colors border border-white/8 hover:border-white/15">
            ← Back to account page
          </button>
        </div>
      )}

      {/* ── Exchange / provider error ── */}
      {status === 'error' && (
        <div className="w-full max-w-sm space-y-5 text-center">
          <div className="w-14 h-14 rounded-full bg-red-500/15 border border-red-500/30
            flex items-center justify-center mx-auto">
            <AlertCircle className="w-7 h-7 text-red-400" />
          </div>
          <div className="space-y-1.5">
            <p className="text-white font-semibold">Sign-in failed</p>
            <p className="text-red-300/80 text-xs leading-relaxed break-words px-2">{errorMsg}</p>
          </div>

          {/* Hint for "flow_state_not_found" errors */}
          {(errorMsg.toLowerCase().includes('exchange') || errorMsg.toLowerCase().includes('flow_state')) && (
            <div className="text-left p-4 rounded-xl bg-amber-500/8 border border-amber-500/20 space-y-2">
              <p className="text-amber-300 text-xs font-semibold">Checklist to fix this</p>
              <ul className="text-amber-200/60 text-xs space-y-1 leading-relaxed list-disc list-inside">
                <li>Supabase Dashboard → Authentication → Providers → <strong>Discord</strong> — confirm it's <strong>Enabled</strong></li>
                <li>Paste the correct <strong>Client ID</strong> and <strong>Client Secret</strong> from Discord's developer portal</li>
                <li>Supabase Dashboard → Logs → <strong>Auth</strong> — check for errors that happened a few seconds ago</li>
                <li>Discord portal → OAuth2 → Redirects: must contain <code className="text-purple-300">https://ksndambbafpzxquxsgdw.supabase.co/auth/v1/callback</code></li>
              </ul>
            </div>
          )}

          <button
            onClick={() => navigate('/account', { replace: true })}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl
              bg-white/6 hover:bg-white/10 border border-white/10 hover:border-white/20
              text-white/60 hover:text-white text-sm transition-all"
          >
            <RefreshCw className="w-4 h-4" />
            Try again
          </button>
        </div>
      )}

      {/* ── In progress ── */}
      {status === 'loading' && (
        <div className="text-center space-y-4">
          <div className="relative w-12 h-12 mx-auto">
            <Loader2 className="w-12 h-12 animate-spin text-purple-500/40" />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-purple-300/60 text-xs font-mono">{attempt}</span>
            </div>
          </div>
          <div className="space-y-1">
            <p className="text-white/50 text-sm tracking-wide">Signing you in…</p>
            {attempt > 1 && (
              <p className="text-white/25 text-xs">Retrying (attempt {attempt}/3)…</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
