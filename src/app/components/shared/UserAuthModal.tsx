import { motion, AnimatePresence } from 'motion/react';
import { X, Loader2, Eye, EyeOff, Mail, Lock, User, AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { GlassCard } from './GlassCard';

/* -------------------------------------------------------------------------- */
/* OAuth provider icons (inline SVG — no extra deps)                          */
/* -------------------------------------------------------------------------- */

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  );
}

function DiscordIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" fill="#5865F2"/>
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/* OAuth button                                                                */
/* -------------------------------------------------------------------------- */

function OAuthButton({
  provider, label, icon: Icon, onClick, loading,
}: {
  provider: 'google' | 'discord';
  label: string;
  icon: React.ElementType;
  onClick: () => void;
  loading: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 rounded-xl
        border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20
        text-white/80 hover:text-white text-sm font-medium
        transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading
        ? <Loader2 className="w-4 h-4 animate-spin text-white/40" />
        : <Icon />}
      <span>{label}</span>
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/* Divider                                                                     */
/* -------------------------------------------------------------------------- */

function OrDivider() {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 my-1">
      <div className="flex-1 h-px bg-white/8" />
      <span className="text-white/25 text-xs">{t('auth.or')}</span>
      <div className="flex-1 h-px bg-white/8" />
    </div>
  );
}

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
        <Icon className="absolute left-3.5 rtl:left-auto rtl:right-3.5 w-4 h-4 text-white/30 pointer-events-none" />
        <input
          type={type} placeholder={placeholder} value={value}
          autoComplete={autoComplete}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-transparent pl-10 rtl:pl-3 rtl:pr-10 pr-10 py-3 text-sm text-white
            placeholder:text-white/25 focus:outline-none"
        />
        {rightSlot && <div className="absolute right-3 rtl:right-auto rtl:left-3">{rightSlot}</div>}
      </div>
      {error && (
        <p className="flex items-center gap-1 rtl:flex-row-reverse mt-1.5 text-xs text-red-400">
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
  onSignInOAuth:   (provider: 'google' | 'discord') => Promise<void>;
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
  onSignInOAuth,
  defaultTab = 'signin',
  message,
}: UserAuthModalProps) {
  const { t } = useTranslation();
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

  /* ── OAuth state ── */
  const [oauthLoading, setOauthLoading] = useState<'google' | 'discord' | null>(null);
  const [oauthError,   setOauthError]   = useState('');

  const anyLoading = siLoading || suLoading || fpLoading || !!oauthLoading;

  const handleOAuth = async (provider: 'google' | 'discord') => {
    setOauthError('');
    setOauthLoading(provider);
    try {
      await onSignInOAuth(provider);
    } catch (err: any) {
      setOauthError(err.message || `Failed to sign in with ${provider}`);
      setOauthLoading(null);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!siEmail.trim()) errs.email = t('auth.emailRequired');
    else if (!/\S+@\S+/.test(siEmail)) errs.email = t('auth.invalidEmail');
    if (!siPass) errs.password = t('auth.passwordRequired');
    setSiErrors(errs);
    if (Object.keys(errs).length) return;
    setSiLoading(true);
    try {
      await onSignInEmail(siEmail.trim(), siPass);
      onClose();
    } catch (err: any) {
      setSiErrors({ form: err.message || t('auth.invalidEmailOrPassword') });
    } finally {
      setSiLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!suEmail.trim()) errs.email = t('auth.emailRequired');
    else if (!/\S+@\S+/.test(suEmail)) errs.email = t('auth.invalidEmail');
    if (!suPass) errs.password = t('auth.passwordRequired');
    else if (suPass.length < 8) errs.password = t('auth.atLeast8');
    if (suPass !== suConfirm) errs.confirm = t('auth.passwordsDoNotMatch');
    setSuErrors(errs);
    if (Object.keys(errs).length) return;
    setSuLoading(true);
    try {
      await onSignUpEmail(suEmail.trim(), suPass, suName.trim() || undefined);
      setSuSuccess(true);
      setTimeout(onClose, 1400);
    } catch (err: any) {
      setSuErrors({ form: err.message || t('auth.failedCreateAccount') });
    } finally {
      setSuLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFpError('');
    if (!fpEmail.trim() || !/\S+@\S+/.test(fpEmail)) {
      setFpError(t('auth.validEmailRequired'));
      return;
    }
    setFpLoading(true);
    try {
      await onForgotPassword(fpEmail.trim());
      setFpSent(true);
    } catch (err: any) {
      setFpError(err.message || t('auth.failedSendReset'));
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
                    <path d="M12 2L2 7l10 5 10-5-10-5z" stroke="var(--color-violet-300, #c084fc)" strokeWidth="1.5" strokeLinejoin="round"/>
                    <path d="M2 17l10 5 10-5M2 12l10 5 10-5" stroke="var(--color-violet-500, #a855f7)" strokeWidth="1.5" strokeLinejoin="round"/>
                  </svg>
                </div>
              </div>
              <h2 className="text-xl font-bold text-white">
                {panel === 'signin'  ? t('auth.welcomeBack')       :
                 panel === 'signup'  ? t('auth.createYourAccount') :
                                      t('auth.resetYourPassword')}
              </h2>
              {message && panel !== 'forgot' && (
                <p className="text-white/45 text-xs mt-1.5 leading-relaxed">{message}</p>
              )}
              {panel === 'forgot' && !fpSent && (
                <p className="text-white/40 text-xs mt-1.5 leading-relaxed">
                  {t('auth.secureLink')}
                </p>
              )}
            </div>

            {/* Tab switcher — only for signin / signup */}
            {panel !== 'forgot' && (
              <div className="mx-7 mb-5 flex rounded-xl bg-white/5 border border-white/8 p-1">
                {(['signin', 'signup'] as const).map(tab => (
                  <button key={tab} onClick={() => setPanel(tab)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                      panel === tab
                        ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/25'
                        : 'text-white/40 hover:text-white/70'
                    }`}>
                    {tab === 'signin' ? t('auth.signInTab') : t('auth.createAccountTab')}
                  </button>
                ))}
              </div>
            )}

            {/* Forms */}
            <div className="px-7 pb-7">
              <AnimatePresence mode="wait" initial={false}>

                {/* ═══ SIGN IN ═══ */}
                {panel === 'signin' && (
                  <motion.div key="si"
                    initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }} transition={{ duration: 0.15 }}
                    className="space-y-3">

                    {/* OAuth buttons */}
                    <div className="space-y-2">
                      <OAuthButton provider="google" label={t('auth.continueWith', { provider: 'Google' })}
                        icon={GoogleIcon} loading={oauthLoading === 'google'}
                        onClick={() => handleOAuth('google')} />
                      <OAuthButton provider="discord" label={t('auth.continueWith', { provider: 'Discord' })}
                        icon={DiscordIcon} loading={oauthLoading === 'discord'}
                        onClick={() => handleOAuth('discord')} />
                    </div>

                    {oauthError && (
                      <div className="flex items-center gap-2 rtl:flex-row-reverse p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                        <p className="text-red-400 text-xs">{oauthError}</p>
                      </div>
                    )}

                    <OrDivider />

                    <form onSubmit={handleSignIn} className="space-y-3">
                      <FieldInput icon={Mail} type="email" placeholder={t('auth.emailLabel')}
                        value={siEmail} onChange={setSiEmail}
                        error={siErrors.email} autoComplete="email" />

                      <div>
                        <FieldInput icon={Lock}
                          type={siShowPw ? 'text' : 'password'} placeholder={t('auth.passwordLabel')}
                          value={siPass} onChange={setSiPass}
                          error={siErrors.password} autoComplete="current-password"
                          rightSlot={
                            <button type="button" onClick={() => setSiShowPw(v => !v)}
                              className="text-white/25 hover:text-white/60 transition-colors">
                              {siShowPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          } />
                        <div className="flex justify-end rtl:justify-start mt-1.5">
                          <button type="button" onClick={goToForgot}
                            className="text-xs text-purple-400 hover:text-purple-300 transition-colors">
                            {t('auth.forgotPassword')}
                          </button>
                        </div>
                      </div>

                      {siErrors.form && (
                        <div className="flex items-center gap-2 rtl:flex-row-reverse p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                          <p className="text-red-400 text-xs">{siErrors.form}</p>
                        </div>
                      )}

                      <button type="submit" disabled={anyLoading}
                        className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600
                          hover:from-purple-500 hover:to-blue-500 text-white font-semibold text-sm
                          transition-all shadow-lg shadow-purple-500/20 disabled:opacity-60
                          flex items-center justify-center gap-2 rtl:flex-row-reverse">
                        {siLoading
                          ? <><Loader2 className="w-4 h-4 animate-spin" />{t('auth.signingIn')}</>
                          : t('auth.signInTab')}
                      </button>

                      <p className="text-center text-white/25 text-xs pt-2">
                        {t('auth.noAccount')}{' '}
                        <button type="button" onClick={() => setPanel('signup')}
                          className="text-purple-400 hover:text-purple-300 underline">
                          {t('auth.createOneFree')}
                        </button>
                      </p>
                    </form>
                  </motion.div>
                )}

                {/* ═══ SIGN UP ═══ */}
                {panel === 'signup' && (
                  <motion.div key="su"
                    initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.15 }}
                    className="space-y-3">

                    {!suSuccess && (
                      <>
                        {/* OAuth buttons */}
                        <div className="space-y-2">
                          <OAuthButton provider="google" label={t('auth.signUpWith', { provider: 'Google' })}
                            icon={GoogleIcon} loading={oauthLoading === 'google'}
                            onClick={() => handleOAuth('google')} />
                          <OAuthButton provider="discord" label={t('auth.signUpWith', { provider: 'Discord' })}
                            icon={DiscordIcon} loading={oauthLoading === 'discord'}
                            onClick={() => handleOAuth('discord')} />
                        </div>

                        {oauthError && (
                          <div className="flex items-center gap-2 rtl:flex-row-reverse p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                            <p className="text-red-400 text-xs">{oauthError}</p>
                          </div>
                        )}

                        <OrDivider />
                      </>
                    )}

                    <form onSubmit={handleSignUp} className="space-y-3">
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
                          <p className="text-white font-semibold">{t('auth.accountCreated')}</p>
                          <p className="text-white/45 text-xs mt-1">{t('auth.signingYouIn')}</p>
                        </motion.div>
                      ) : (
                        <>
                          <FieldInput icon={User} type="text" placeholder={t('auth.fullNameOptional')}
                            value={suName} onChange={setSuName} autoComplete="name" />
                          <FieldInput icon={Mail} type="email" placeholder={t('auth.emailLabel')}
                            value={suEmail} onChange={setSuEmail}
                            error={suErrors.email} autoComplete="email" />
                          <FieldInput icon={Lock}
                            type={suShowPw ? 'text' : 'password'} placeholder={t('auth.passwordMin8')}
                            value={suPass} onChange={setSuPass}
                            error={suErrors.password} autoComplete="new-password"
                            rightSlot={
                              <button type="button" onClick={() => setSuShowPw(v => !v)}
                                className="text-white/25 hover:text-white/60 transition-colors">
                                {suShowPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                              </button>
                            } />
                          <FieldInput icon={Lock} type="password" placeholder={t('auth.confirmPassword')}
                            value={suConfirm} onChange={setSuConfirm}
                            error={suErrors.confirm} autoComplete="new-password" />

                          {suErrors.form && (
                            <div className="flex items-center gap-2 rtl:flex-row-reverse p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                              <p className="text-red-400 text-xs">{suErrors.form}</p>
                            </div>
                          )}

                          <button type="submit" disabled={anyLoading}
                            className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600
                              hover:from-purple-500 hover:to-blue-500 text-white font-semibold text-sm
                              transition-all shadow-lg shadow-purple-500/20 disabled:opacity-60
                              flex items-center justify-center gap-2 rtl:flex-row-reverse">
                            {suLoading
                              ? <><Loader2 className="w-4 h-4 animate-spin" />{t('auth.creatingAccount')}</>
                              : t('auth.createAccountTab')}
                          </button>

                          <p className="text-center text-white/25 text-xs pt-2">
                            {t('auth.haveAccount')}{' '}
                            <button type="button" onClick={() => setPanel('signin')}
                              className="text-purple-400 hover:text-purple-300 underline">
                              {t('auth.signInTab')}
                            </button>
                          </p>
                        </>
                      )}
                    </form>
                  </motion.div>
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
                          <p className="text-white font-semibold mb-1">{t('auth.checkYourInbox')}</p>
                          <p className="text-white/40 text-xs leading-relaxed">
                            {t('auth.resetLinkSentPre')}{' '}
                            <span className="text-purple-300">{fpEmail}</span>.{' '}
                            {t('auth.resetLinkSentPost')}
                          </p>
                        </div>
                        <button type="button" onClick={() => setPanel('signin')}
                          className="flex items-center gap-1.5 mx-auto text-xs text-white/40
                            hover:text-white/70 transition-colors mt-2">
                          <ArrowLeft className="w-3.5 h-3.5" />
                          {t('auth.backToSignIn')}
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleForgotPassword} className="space-y-3">
                        <FieldInput icon={Mail} type="email" placeholder={t('auth.yourAccountEmail')}
                          value={fpEmail} onChange={setFpEmail}
                          error={fpError} autoComplete="email" />

                        <button type="submit" disabled={anyLoading}
                          className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600
                            hover:from-purple-500 hover:to-blue-500 text-white font-semibold text-sm
                            transition-all shadow-lg shadow-purple-500/20 disabled:opacity-60
                            flex items-center justify-center gap-2">
                          {fpLoading
                            ? <><Loader2 className="w-4 h-4 animate-spin" />{t('auth.sending')}</>
                            : t('auth.sendResetLink')}
                        </button>

                        <button type="button" onClick={() => setPanel('signin')}
                          className="flex items-center gap-1.5 mx-auto text-xs text-white/35
                            hover:text-white/65 transition-colors pt-1">
                          <ArrowLeft className="w-3.5 h-3.5" />
                          {t('auth.backToSignIn')}
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
