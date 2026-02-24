/**
 * /auth/reset-password
 *
 * Supabase sends the user here after clicking the "Reset password" email link.
 * The URL arrives as:
 *   PKCE:     ?code=xxx          → exchangeCodeForSession() is called automatically
 *                                   by detectSessionInUrl; we just wait for onAuthStateChange
 *   Implicit: #access_token=xxx&type=recovery  → same auto-detection
 *
 * Once Supabase signals PASSWORD_RECOVERY (or SIGNED_IN with a recovery token),
 * we show the "set new password" form. On success → /account.
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { Lock, Eye, EyeOff, AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { getSupabaseClient } from '../utils/supabase-client';
import { GlassCard } from '../components/shared/GlassCard';

export function ResetPassword() {
  const navigate = useNavigate();

  // 'waiting'  — checking URL / waiting for Supabase to parse the token
  // 'ready'    — recovery session confirmed, show the form
  // 'success'  — password updated
  // 'error'    — something went wrong (expired link etc.)
  const [stage, setStage]       = useState<'waiting' | 'ready' | 'success' | 'error'>('waiting');
  const [errorMsg, setErrorMsg] = useState('');

  const [newPass,    setNewPass]    = useState('');
  const [confirm,    setConfirm]    = useState('');
  const [showPw,     setShowPw]     = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [saving,     setSaving]     = useState(false);

  /* ── Listen for the recovery event ──────────────────────────────────────── */
  useEffect(() => {
    const supabase = getSupabaseClient();

    // onAuthStateChange fires PASSWORD_RECOVERY when the reset link is valid
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('[ResetPassword] auth event:', event, session?.user?.email);

      if (event === 'PASSWORD_RECOVERY') {
        setStage('ready');
        return;
      }

      // With PKCE the session comes in as SIGNED_IN; check the recovery flag
      if (event === 'SIGNED_IN' && session) {
        setStage('ready');
        return;
      }
    });

    // Also handle the case where the page loads with a hash / code already present
    // (some browsers fire the event before this listener is registered)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setStage('ready');
      }
    });

    // Safety timeout: if nothing fires in 8 s, show error
    const timeout = setTimeout(() => {
      setStage(s => {
        if (s === 'waiting') {
          setErrorMsg('This reset link has expired or is invalid. Please request a new one.');
          return 'error';
        }
        return s;
      });
    }, 8000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  /* ── Submit new password ─────────────────────────────────────────────────── */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!newPass)             errs.pass    = 'Password is required';
    else if (newPass.length < 8) errs.pass = 'At least 8 characters';
    if (newPass !== confirm)  errs.confirm = 'Passwords do not match';
    setFormErrors(errs);
    if (Object.keys(errs).length) return;

    setSaving(true);
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.updateUser({ password: newPass });
      if (error) throw new Error(error.message);
      setStage('success');
      setTimeout(() => navigate('/account', { replace: true }), 2000);
    } catch (err: any) {
      setFormErrors({ form: err.message || 'Failed to update password' });
    } finally {
      setSaving(false);
    }
  };

  /* ── UI ─────────────────────────────────────────────────────────────────── */
  return (
    <div className="min-h-screen bg-[#080810] flex items-center justify-center px-4">
      {/* Subtle background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[600px] h-[600px]
          rounded-full bg-purple-600/10 blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-sm relative z-10"
      >
        <GlassCard className="overflow-hidden">
          {/* Header */}
          <div className="px-7 pt-8 pb-5 text-center">
            <div className="relative w-12 h-12 mx-auto mb-4">
              <div className="absolute inset-0 rounded-full bg-purple-500/30 blur-xl" />
              <div className="relative w-12 h-12 rounded-full border border-purple-500/40
                bg-purple-500/15 flex items-center justify-center">
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="#c084fc" strokeWidth="1.5" strokeLinejoin="round"/>
                  <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="#a855f7" strokeWidth="1.5" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            <h1 className="text-xl font-bold text-white">
              {stage === 'success' ? 'Password updated!' : 'Set new password'}
            </h1>
            {stage === 'ready' && (
              <p className="text-white/40 text-xs mt-1.5">Choose a strong password — at least 8 characters.</p>
            )}
          </div>

          <div className="px-7 pb-7">

            {/* ── Waiting ── */}
            {stage === 'waiting' && (
              <div className="flex flex-col items-center gap-3 py-6">
                <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-400
                  rounded-full animate-spin" />
                <p className="text-white/35 text-sm">Verifying reset link…</p>
              </div>
            )}

            {/* ── Error ── */}
            {stage === 'error' && (
              <div className="space-y-4 py-2">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-red-300 text-sm leading-relaxed">{errorMsg}</p>
                </div>
                <button
                  onClick={() => navigate('/account', { replace: true })}
                  className="w-full py-2.5 rounded-xl text-white/40 hover:text-white/70 text-sm
                    transition-colors border border-white/8 hover:border-white/15"
                >
                  ← Back to account
                </button>
              </div>
            )}

            {/* ── Form ── */}
            {stage === 'ready' && (
              <form onSubmit={handleSubmit} className="space-y-3">
                {/* New password */}
                <div>
                  <div className={`relative flex items-center rounded-xl border transition-colors
                    ${formErrors.pass
                      ? 'border-red-500/60 bg-red-500/5'
                      : 'border-white/10 bg-white/5 focus-within:border-purple-500/50'}`}>
                    <Lock className="absolute left-3.5 w-4 h-4 text-white/30 pointer-events-none" />
                    <input
                      type={showPw ? 'text' : 'password'}
                      placeholder="New password"
                      value={newPass}
                      autoComplete="new-password"
                      onChange={e => setNewPass(e.target.value)}
                      className="w-full bg-transparent pl-10 pr-10 py-3 text-sm text-white
                        placeholder:text-white/25 focus:outline-none"
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 text-white/25 hover:text-white/60 transition-colors">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  {formErrors.pass && (
                    <p className="flex items-center gap-1 mt-1.5 text-xs text-red-400">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />{formErrors.pass}
                    </p>
                  )}
                </div>

                {/* Confirm password */}
                <div>
                  <div className={`relative flex items-center rounded-xl border transition-colors
                    ${formErrors.confirm
                      ? 'border-red-500/60 bg-red-500/5'
                      : 'border-white/10 bg-white/5 focus-within:border-purple-500/50'}`}>
                    <Lock className="absolute left-3.5 w-4 h-4 text-white/30 pointer-events-none" />
                    <input
                      type="password"
                      placeholder="Confirm new password"
                      value={confirm}
                      autoComplete="new-password"
                      onChange={e => setConfirm(e.target.value)}
                      className="w-full bg-transparent pl-10 pr-4 py-3 text-sm text-white
                        placeholder:text-white/25 focus:outline-none"
                    />
                  </div>
                  {formErrors.confirm && (
                    <p className="flex items-center gap-1 mt-1.5 text-xs text-red-400">
                      <AlertCircle className="w-3 h-3 flex-shrink-0" />{formErrors.confirm}
                    </p>
                  )}
                </div>

                {formErrors.form && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <p className="text-red-400 text-xs">{formErrors.form}</p>
                  </div>
                )}

                <button type="submit" disabled={saving}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600
                    hover:from-purple-500 hover:to-blue-500 text-white font-semibold text-sm
                    transition-all shadow-lg shadow-purple-500/20 disabled:opacity-60
                    flex items-center justify-center gap-2">
                  {saving
                    ? <><Loader2 className="w-4 h-4 animate-spin" />Updating…</>
                    : 'Update Password'}
                </button>
              </form>
            )}

            {/* ── Success ── */}
            {stage === 'success' && (
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-6 text-center space-y-3"
              >
                <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30
                  flex items-center justify-center mx-auto">
                  <CheckCircle className="w-7 h-7 text-emerald-400" />
                </div>
                <div>
                  <p className="text-white font-semibold">Password updated!</p>
                  <p className="text-white/40 text-xs mt-1">Redirecting to your account…</p>
                </div>
              </motion.div>
            )}
          </div>
        </GlassCard>
      </motion.div>
    </div>
  );
}
