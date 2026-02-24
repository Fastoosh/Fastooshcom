/**
 * /auth/callback — OAuth landing page (implicit flow)
 *
 * With flowType:'implicit' + a hardcoded canonical redirectTo, Supabase
 * sends tokens directly to https://fastoosh.com/auth/callback#access_token=…
 * No server redirect happens (fastoosh.com is the final domain), so the URL
 * hash is preserved. detectSessionInUrl:true parses the hash automatically
 * during client initialisation; we just wait for getSession() to resolve.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { Copy, Check, AlertCircle } from 'lucide-react';
import { getSupabaseClient } from '../utils/supabase-client';

export function AuthCallback() {
  const navigate = useNavigate();
  const [errorMsg,        setErrorMsg]        = useState('');
  const [missingRedirect, setMissingRedirect] = useState(false);
  const [copied,          setCopied]          = useState(false);

  // This exact URL must be in Supabase → Authentication → Redirect URLs
  const callbackUrl = 'https://www.fastoosh.com/auth/callback';

  const copyUrl = () => {
    navigator.clipboard.writeText(callbackUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  useEffect(() => {
    const supabase    = getSupabaseClient();
    const hashParams  = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const searchParams = new URLSearchParams(window.location.search);

    const hasToken = hashParams.has('access_token');
    const hasCode  = searchParams.has('code');
    const hasError =
      hashParams.has('error')   || hashParams.has('error_description') ||
      searchParams.has('error') || searchParams.has('error_description');

    console.log('[AuthCallback] landed', {
      hasToken,
      hasCode,
      hasError,
      hash:   window.location.hash   || '(empty)',
      search: window.location.search || '(empty)',
    });

    // ── Provider error (user denied, misconfigured scope, etc.)
    if (hasError) {
      const msg =
        hashParams.get('error_description')   || hashParams.get('error') ||
        searchParams.get('error_description') || searchParams.get('error') ||
        'Authentication failed.';
      console.error('[AuthCallback] provider error:', msg);
      setErrorMsg(msg);
      setTimeout(() => navigate('/account', { replace: true }), 3000);
      return;
    }

    // ── Nothing in the URL → redirect URL not yet whitelisted
    if (!hasToken && !hasCode) {
      console.error(
        '[AuthCallback] No token or code received.\n' +
        'Add this exact URL to Supabase → Authentication → URL Configuration → Redirect URLs:\n' +
        callbackUrl
      );
      setMissingRedirect(true);
      return;
    }

    // ── Happy path: detectSessionInUrl parsed the hash during init;
    //    getSession() resolves once the session is stored.
    console.log('[AuthCallback] waiting for session…');
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error('[AuthCallback] session error:', error.message);
        setErrorMsg(error.message);
        setTimeout(() => navigate('/account', { replace: true }), 3000);
        return;
      }
      if (session) {
        console.log('[AuthCallback] ✅ signed in as', session.user.email);
      } else {
        console.warn('[AuthCallback] no session returned — navigating to /account anyway');
      }
      navigate('/account', { replace: true });
    });
  }, [navigate]);

  /* ── UI ─────────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center px-6">

      {/* Redirect URL not whitelisted */}
      {missingRedirect && (
        <div className="w-full max-w-lg space-y-4">
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/25">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-amber-300 font-semibold text-sm mb-1">
                Redirect URL not whitelisted in Supabase
              </p>
              <p className="text-amber-200/60 text-xs leading-relaxed">
                Supabase sent no tokens — the URL below must be added to the allow-list.
                Copy it, add it in Supabase, save, then try signing in again.
              </p>
            </div>
          </div>

          <div className="p-5 rounded-2xl bg-white/4 border border-white/10 space-y-3">
            <p className="text-white/80 text-sm font-semibold">
              Supabase → Authentication → URL Configuration → Redirect URLs
            </p>
            <div className="flex items-center gap-2 rounded-xl bg-black/50 border border-white/10 px-3 py-2.5">
              <code className="flex-1 text-xs text-purple-300 font-mono break-all">
                {callbackUrl}
              </code>
              <button
                onClick={copyUrl}
                className="flex-shrink-0 text-white/30 hover:text-purple-400 transition-colors"
                title="Copy URL"
              >
                {copied
                  ? <Check className="w-4 h-4 text-emerald-400" />
                  : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            onClick={() => navigate('/account', { replace: true })}
            className="w-full py-2.5 rounded-xl text-white/40 hover:text-white/70 text-sm
              transition-colors border border-white/8 hover:border-white/15"
          >
            ← Back to account page
          </button>
        </div>
      )}

      {/* Provider error */}
      {errorMsg && (
        <div className="text-center space-y-3 max-w-sm">
          <p className="text-red-400 text-sm">{errorMsg}</p>
          <p className="text-white/30 text-xs">Redirecting you back…</p>
        </div>
      )}

      {/* Normal: session exchange in progress */}
      {!missingRedirect && !errorMsg && (
        <div className="text-center space-y-4">
          <div className="w-10 h-10 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin mx-auto" />
          <p className="text-white/40 text-sm tracking-wide">Signing you in…</p>
        </div>
      )}

    </div>
  );
}