import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, Eye, EyeOff, Mail, Lock, User, AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import { GlassCard } from './GlassCard';

/* -------------------------------------------------------------------------- */
/* Shared field input                                                          */
/* -------------------------------------------------------------------------- */

function FieldInput({
  icon: Icon, type, placeholder, value, onChange, error, rightSlot, autoComplete,
}: {
  icon: React.ElementType;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  error?: string;
  rightSlot?: React.ReactNode;
  autoComplete?: string;
}) {
  return (
    <div>
      <div className={`relative flex items-center rounded-xl border transition-colors
        ${error
          ? 'border-red-500/60 bg-red-500/5'
          : 'border-white/10 bg-white/5 focus-within:border-purple-500/50 focus-within:bg-purple-500/5'
        }`}
      >
        <Icon className="absolute left-3.5 w-4 h-4 text-white/30 pointer-events-none" />
        <input
          type={type} placeholder={placeholder} value={value}
          autoComplete={autoComplete}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-transparent pl-10 pr-10 py-3 text-sm text-white
            placeholder:text-white/25 focus:outline-none"
        />
        {rightSlot && <div className="absolute right-3">{rightSlot}</div>}
      </div>
      {error && (
        <p className="flex items-center gap-1 mt-1.5 text-xs text-red-400">
          <AlertCircle className="w-3 h-3 flex-shrink-0" />{error}
        </p>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Props                                                                       */
/* -------------------------------------------------------------------------- */

export interface UserAuthModalProps {
  onClose: () => void;
  onSignInEmail:   (email: string, password: string) => Promise<void>;
  onSignUpEmail:   (email: string, password: string, name?: string) => Promise<void>;
  onForgotPassword:(email: string) => Promise<void>;
  defaultTab?: 'signin' | 'signup';
  message?: string;
}

/* -------------------------------------------------------------------------- */
/* Main modal                                                                  */
/* -------------------------------------------------------------------------- */

type Panel = 'signin' | 'signup' | 'forgot';

export function UserAuthModal({
  onClose,
  onSignInEmail,
  onSignUpEmail,
  onForgotPassword,
  defaultTab = 'signin',
  message,
}: UserAuthModalProps) {
  const [panel, setPanel] = useState<Panel>(defaultTab);

  /* ── Sign in state ── */
  const [siEmail,   setSiEmail]   = useState('');
  const [siPass,    setSiPass]    = useState('');
  const [siShowPw,  setSiShowPw]  = useState(false);
  const [siErrors,  setSiErrors]  = useState<Record<string, string>>({});
  const [siLoading, setSiLoading] = useState(false);

  /* ── Sign up state ── */
  const [suName,    setSuName]    = useState('');
  const [suEmail,   setSuEmail]   = useState('');
  const [suPass,    setSuPass]    = useState('');
  const [suConfirm, setSuConfirm] = useState('');
  const [suShowPw,  setSuShowPw]  = useState(false);
  const [suErrors,  setSuErrors]  = useState<Record<string, string>>({});
  const [suLoading, setSuLoading] = useState(false);
  const [suSuccess, setSuSuccess] = useState(false);

  /* ── Forgot password state ── */
  const [fpEmail,   setFpEmail]   = useState(siEmail);
  const [fpError,   setFpError]   = useState('');
  const [fpLoading, setFpLoading] = useState(false);
  const [fpSent,    setFpSent]    = useState(false);

  const anyLoading = siLoading || suLoading || fpLoading;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!siEmail.trim()) errs.email = 'Email is required';
    else if (!/\S+@\S+/.test(siEmail)) errs.email = 'Invalid email';
    if (!siPass) errs.password = 'Password is required';
    setSiErrors(errs);
    if (Object.keys(errs).length) return;
    setSiLoading(true);
    try {
      await onSignInEmail(siEmail.trim(), siPass);
      onClose();
    } catch (err: any) {
      setSiErrors({ form: err.message || 'Invalid email or password' });
    } finally {
      setSiLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!suEmail.trim()) errs.email = 'Email is required';
    else if (!/\S+@\S+/.test(suEmail)) errs.email = 'Invalid email';
    if (!suPass) errs.password = 'Password is required';
    else if (suPass.length < 8) errs.password = 'At least 8 characters';
    if (suPass !== suConfirm) errs.confirm = 'Passwords do not match';
    setSuErrors(errs);
    if (Object.keys(errs).length) return;
    setSuLoading(true);
    try {
      await onSignUpEmail(suEmail.trim(), suPass, suName.trim() || undefined);
      setSuSuccess(true);
      setTimeout(onClose, 1400);
    } catch (err: any) {
      setSuErrors({ form: err.message || 'Failed to create account' });
    } finally {
      setSuLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFpError('');
    if (!fpEmail.trim() || !/\S+@\S+/.test(fpEmail)) {
      setFpError('Please enter a valid email address');
      return;
    }
    setFpLoading(true);
    try {
      await onForgotPassword(fpEmail.trim());
      setFpSent(true);
    } catch (err: any) {
      setFpError(err.message || 'Failed to send reset email');
    } finally {
      setFpLoading(false);
    }
  };

  const goToForgot = () => {
    setFpEmail(siEmail);
    setFpError('');
    setFpSent(false);
    setPanel('forgot');
  };

  return (
    <AnimatePresence>
      <motion.div
        key="auth-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          key="auth-panel"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-sm"
        >
          <GlassCard className="relative overflow-hidden">
            {/* Close */}
            <button onClick={onClose}
              className="absolute top-4 right-4 z-10 text-white/25 hover:text-white transition-colors"
              aria-label="Close">
              <X className="w-5 h-5" />
            </button>

            {/* Logo + context */}
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
              <h2 className="text-xl font-bold text-white">
                {panel === 'signin'  ? 'Welcome back'        :
                 panel === 'signup'  ? 'Create your account' :
                                      'Reset your password'}
              </h2>
              {message && panel !== 'forgot' && (
                <p className="text-white/45 text-xs mt-1.5 leading-relaxed">{message}</p>
              )}
              {panel === 'forgot' && !fpSent && (
                <p className="text-white/40 text-xs mt-1.5 leading-relaxed">
                  We'll send a secure link to your email.
                </p>
              )}
            </div>

            {/* Tab switcher — only for signin / signup */}
            {panel !== 'forgot' && (
              <div className="mx-7 mb-5 flex rounded-xl bg-white/5 border border-white/8 p-1">
                {(['signin', 'signup'] as const).map(t => (
                  <button key={t} onClick={() => setPanel(t)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                      panel === t
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25'
                        : 'text-white/40 hover:text-white/70'
                    }`}>
                    {t === 'signin' ? 'Sign In' : 'Create Account'}
                  </button>
                ))}
              </div>
            )}

            {/* Forms */}
            <div className="px-7 pb-7">
              <AnimatePresence mode="wait" initial={false}>

                {/* ═══ SIGN IN ═══ */}
                {panel === 'signin' && (
                  <motion.form key="si"
                    initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.15 }}
                    onSubmit={handleSignIn} className="space-y-3">

                    <FieldInput icon={Mail} type="email" placeholder="Email"
                      value={siEmail} onChange={setSiEmail}
                      error={siErrors.email} autoComplete="email" />

                    <div>
                      <FieldInput icon={Lock}
                        type={siShowPw ? 'text' : 'password'} placeholder="Password"
                        value={siPass} onChange={setSiPass}
                        error={siErrors.password} autoComplete="current-password"
                        rightSlot={
                          <button type="button" onClick={() => setSiShowPw(v => !v)}
                            className="text-white/25 hover:text-white/60 transition-colors">
                            {siShowPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        } />
                      <div className="flex justify-end mt-1.5">
                        <button type="button" onClick={goToForgot}
                          className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
                          Forgot password?
                        </button>
                      </div>
                    </div>

                    {siErrors.form && (
                      <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                        <p className="text-red-400 text-xs">{siErrors.form}</p>
                      </div>
                    )}

                    <button type="submit" disabled={anyLoading}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600
                        hover:from-purple-500 hover:to-blue-500 text-white font-semibold text-sm
                        transition-all shadow-lg shadow-purple-500/20 disabled:opacity-60
                        flex items-center justify-center gap-2">
                      {siLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Signing in…</> : 'Sign In'}
                    </button>

                    <p className="text-center text-white/25 text-xs pt-2">
                      No account?{' '}
                      <button type="button" onClick={() => setPanel('signup')}
                        className="text-purple-400 hover:text-purple-300 underline">
                        Create one free
                      </button>
                    </p>
                  </motion.form>
                )}

                {/* ═══ SIGN UP ═══ */}
                {panel === 'signup' && (
                  <motion.form key="su"
                    initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }}
                    onSubmit={handleSignUp} className="space-y-3">

                    {suSuccess ? (
                      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                        className="py-8 text-center">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30
                          flex items-center justify-center mx-auto mb-3">
                          <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24"
                            stroke="currentColor" strokeWidth="2">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <p className="text-white font-semibold">Account created!</p>
                        <p className="text-white/45 text-xs mt-1">Signing you in…</p>
                      </motion.div>
                    ) : (
                      <>
                        <FieldInput icon={User} type="text" placeholder="Full name (optional)"
                          value={suName} onChange={setSuName} autoComplete="name" />
                        <FieldInput icon={Mail} type="email" placeholder="Email"
                          value={suEmail} onChange={setSuEmail}
                          error={suErrors.email} autoComplete="email" />
                        <FieldInput icon={Lock}
                          type={suShowPw ? 'text' : 'password'} placeholder="Password (min 8 chars)"
                          value={suPass} onChange={setSuPass}
                          error={suErrors.password} autoComplete="new-password"
                          rightSlot={
                            <button type="button" onClick={() => setSuShowPw(v => !v)}
                              className="text-white/25 hover:text-white/60 transition-colors">
                              {suShowPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          } />
                        <FieldInput icon={Lock} type="password" placeholder="Confirm password"
                          value={suConfirm} onChange={setSuConfirm}
                          error={suErrors.confirm} autoComplete="new-password" />

                        {suErrors.form && (
                          <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                            <p className="text-red-400 text-xs">{suErrors.form}</p>
                          </div>
                        )}

                        <button type="submit" disabled={anyLoading}
                          className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600
                            hover:from-purple-500 hover:to-blue-500 text-white font-semibold text-sm
                            transition-all shadow-lg shadow-purple-500/20 disabled:opacity-60
                            flex items-center justify-center gap-2">
                          {suLoading
                            ? <><Loader2 className="w-4 h-4 animate-spin" />Creating account…</>
                            : 'Create Account'}
                        </button>

                        <p className="text-center text-white/25 text-xs pt-2">
                          Already have an account?{' '}
                          <button type="button" onClick={() => setPanel('signin')}
                            className="text-purple-400 hover:text-purple-300 underline">
                            Sign in
                          </button>
                        </p>
                      </>
                    )}
                  </motion.form>
                )}

                {/* ═══ FORGOT PASSWORD ═══ */}
                {panel === 'forgot' && (
                  <motion.div key="fp"
                    initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }}>

                    {fpSent ? (
                      <div className="py-6 text-center space-y-3">
                        <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30
                          flex items-center justify-center mx-auto">
                          <CheckCircle className="w-7 h-7 text-emerald-400" />
                        </div>
                        <div>
                          <p className="text-white font-semibold mb-1">Check your inbox</p>
                          <p className="text-white/40 text-xs leading-relaxed">
                            We sent a reset link to <span className="text-purple-300">{fpEmail}</span>.
                            It expires in 1 hour.
                          </p>
                        </div>
                        <button type="button" onClick={() => setPanel('signin')}
                          className="flex items-center gap-1.5 mx-auto text-xs text-white/40
                            hover:text-white/70 transition-colors mt-2">
                          <ArrowLeft className="w-3.5 h-3.5" />
                          Back to sign in
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleForgotPassword} className="space-y-3">
                        <FieldInput icon={Mail} type="email" placeholder="Your account email"
                          value={fpEmail} onChange={setFpEmail}
                          error={fpError} autoComplete="email" />

                        <button type="submit" disabled={anyLoading}
                          className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600
                            hover:from-purple-500 hover:to-blue-500 text-white font-semibold text-sm
                            transition-all shadow-lg shadow-purple-500/20 disabled:opacity-60
                            flex items-center justify-center gap-2">
                          {fpLoading
                            ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</>
                            : 'Send Reset Link'}
                        </button>

                        <button type="button" onClick={() => setPanel('signin')}
                          className="flex items-center gap-1.5 mx-auto text-xs text-white/35
                            hover:text-white/65 transition-colors pt-1">
                          <ArrowLeft className="w-3.5 h-3.5" />
                          Back to sign in
                        </button>
                      </form>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
