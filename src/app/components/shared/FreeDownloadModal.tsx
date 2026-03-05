import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Mail, AlertCircle, CheckCircle, Loader2, Download,
  RotateCcw, KeyRound,
} from 'lucide-react';
import { GlassCard } from './GlassCard';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

export interface FreeDownloadModalProps {
  toolName: string;
  toolSlug: string;
  toolVersionId: string;
  downloadUrl?: string; // unused — download URL comes from the server after OTP
  onClose: () => void;
}

type Step = 'email' | 'otp' | 'done';

const OTP_LENGTH = 6;
const RESEND_COOLDOWN = 30; // seconds

export function FreeDownloadModal({
  toolName,
  toolSlug,
  toolVersionId,
  onClose,
}: FreeDownloadModalProps) {
  // ── Step 1: email ────────────────────────────────────────────────────────
  const [email,       setEmail]       = useState('');
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  // ── Step 2: OTP ─────────────────────────────────────────────────────────
  const [otp,         setOtp]         = useState('');
  const [resendLeft,  setResendLeft]  = useState(0);
  const [downloadUrl, setDownloadUrl] = useState('');
  // ── Shared ──────────────────────────────────────────────────────────────
  const [step,    setStep]    = useState<Step>('email');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  const otpInputRef   = useRef<HTMLInputElement>(null);
  const resendTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Focus OTP input when step changes
  useEffect(() => {
    if (step === 'otp') {
      setTimeout(() => otpInputRef.current?.focus(), 120);
      startResendCooldown();
    }
    return () => {
      if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    };
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  function startResendCooldown() {
    setResendLeft(RESEND_COOLDOWN);
    if (resendTimerRef.current) clearInterval(resendTimerRef.current);
    resendTimerRef.current = setInterval(() => {
      setResendLeft(n => {
        if (n <= 1) { clearInterval(resendTimerRef.current!); return 0; }
        return n - 1;
      });
    }, 1000);
  }

  // ── Step 1 submit ────────────────────────────────────────────────────────
  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }
    if (!acceptedTerms) {
      setError('Please accept the Terms of Service to continue');
      return;
    }

    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/free-download`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body:    JSON.stringify({ email: email.trim().toLowerCase(), toolVersionId, toolName, toolSlug }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to send code');
      setStep('otp');
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Resend OTP ───────────────────────────────────────────────────────────
  async function handleResend() {
    if (resendLeft > 0) return;
    setError('');
    setOtp('');
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/free-download`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body:    JSON.stringify({ email: email.trim().toLowerCase(), toolVersionId, toolName, toolSlug }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to resend code');
      startResendCooldown();
    } catch (err: any) {
      setError(err.message || 'Could not resend code. Try again.');
    } finally {
      setLoading(false);
    }
  }

  // ── Step 2 submit ────────────────────────────────────────────────────────
  async function handleOtpSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const clean = otp.replace(/\s/g, '');
    if (clean.length !== OTP_LENGTH) {
      setError(`Please enter the full ${OTP_LENGTH}-digit code`);
      return;
    }

    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/free-download/verify`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body:    JSON.stringify({ email: email.trim().toLowerCase(), code: clean, toolVersionId }),
      });
      const data = await res.json();

      if (data.expired || data.tooMany) {
        setStep('email');
        setOtp('');
        setError(data.error || 'Please request a new code.');
        return;
      }
      if (!data.success) {
        setError(data.error || 'Incorrect code. Please try again.');
        return;
      }

      // ✅ Verified — trigger download and show success
      setDownloadUrl(data.downloadUrl);
      setStep('done');
      if (data.downloadUrl) {
        window.location.href = data.downloadUrl;
      }
    } catch (err: any) {
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  // Prevent typing non-digits in OTP field
  function handleOtpChange(val: string) {
    const digits = val.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setOtp(digits);
    setError('');
  }

  // Strip spaces, dashes, and non-digit chars from pasted text
  function handleOtpPaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text');
    const digits = pasted.replace(/\D/g, '').slice(0, OTP_LENGTH);
    setOtp(digits);
    setError('');
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <AnimatePresence>
      <motion.div
        key="fdl-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={step === 'done' ? onClose : undefined}
      >
        <motion.div
          key="fdl-panel"
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: 'spring', stiffness: 320, damping: 28 }}
          onClick={e => e.stopPropagation()}
          className="w-full max-w-sm"
        >
          <GlassCard className="relative overflow-hidden">
            {/* Ambient glow — colour shifts per step */}
            <div className={`pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2
              w-48 h-48 rounded-full blur-3xl transition-colors duration-700
              ${step === 'done' ? 'bg-emerald-500/20' : step === 'otp' ? 'bg-violet-500/20' : 'bg-emerald-500/15'}`}
            />

            {/* Close */}
            <button onClick={onClose}
              className="absolute top-4 right-4 z-10 text-white/25 hover:text-white transition-colors"
              aria-label="Close">
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="px-7 pt-8 pb-5 text-center relative">
              {/* Icon */}
              <div className="relative w-14 h-14 mx-auto mb-4">
                <AnimatePresence mode="wait">
                  {step === 'done' ? (
                    <motion.div key="icon-done"
                      initial={{ scale: 0 }} animate={{ scale: 1 }}
                      className="absolute inset-0 rounded-full border border-emerald-500/35
                        bg-emerald-500/12 flex items-center justify-center">
                      <CheckCircle className="w-6 h-6 text-emerald-400" />
                    </motion.div>
                  ) : step === 'otp' ? (
                    <motion.div key="icon-otp"
                      initial={{ scale: 0 }} animate={{ scale: 1 }}
                      className="absolute inset-0 rounded-full border border-violet-500/35
                        bg-violet-500/12 flex items-center justify-center">
                      <KeyRound className="w-6 h-6 text-violet-400" />
                    </motion.div>
                  ) : (
                    <motion.div key="icon-email"
                      initial={{ scale: 0 }} animate={{ scale: 1 }}
                      className="absolute inset-0 rounded-full border border-emerald-500/35
                        bg-emerald-500/12 flex items-center justify-center">
                      <Download className="w-6 h-6 text-emerald-400" />
                    </motion.div>
                  )}
                </AnimatePresence>
                {/* Glow ring */}
                <div className={`absolute inset-0 rounded-full blur-xl
                  ${step === 'otp' ? 'bg-violet-500/25' : 'bg-emerald-500/25'}`} />
              </div>

              <AnimatePresence mode="wait">
                {step === 'done' ? (
                  <motion.div key="h-done" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                    <h2 className="text-xl font-bold text-white mb-1">Download started!</h2>
                    <p className="text-white/40 text-xs leading-relaxed">
                      Your file{' '}<span className="text-white/65 font-medium">{toolName}</span>{' '}
                      is downloading. Check your browser's download bar.
                    </p>
                  </motion.div>
                ) : step === 'otp' ? (
                  <motion.div key="h-otp" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                    <h2 className="text-xl font-bold text-white mb-1">Check your inbox</h2>
                    <p className="text-white/40 text-xs leading-relaxed">
                      We sent a 6-digit code to{' '}
                      <span className="text-white/65 font-medium">{email}</span>.
                      <br />Enter it below to start your download.
                    </p>
                  </motion.div>
                ) : (
                  <motion.div key="h-email" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
                    <h2 className="text-xl font-bold text-white mb-1">Get Free Download</h2>
                    <p className="text-white/40 text-xs leading-relaxed">
                      Enter your email — we'll send you a code to verify and download{' '}
                      <span className="text-white/65 font-medium">{toolName}</span>.
                      <br />No spam, ever.
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Body */}
            <div className="px-7 pb-7 relative">
              <AnimatePresence mode="wait" initial={false}>

                {/* ── Done state ── */}
                {step === 'done' && (
                  <motion.div key="body-done"
                    initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
                    className="space-y-3 pt-1"
                  >
                    {downloadUrl && (
                      <a
                        href={downloadUrl}
                        download
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl
                          bg-gradient-to-r from-emerald-600 to-teal-600
                          hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm
                          transition-all shadow-lg shadow-emerald-500/20"
                      >
                        <Download className="w-4 h-4" />
                        Download again
                      </a>
                    )}
                    <button
                      onClick={onClose}
                      className="w-full py-2.5 rounded-xl border border-white/10 text-white/50
                        hover:text-white hover:border-white/20 text-sm transition-colors"
                    >
                      Close
                    </button>
                  </motion.div>
                )}

                {/* ── OTP step ── */}
                {step === 'otp' && (
                  <motion.form key="body-otp"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    onSubmit={handleOtpSubmit}
                    className="space-y-3"
                  >
                    {/* Big OTP input */}
                    <div>
                      <div className={`relative flex items-center rounded-xl border transition-colors
                        ${error
                          ? 'border-red-500/60 bg-red-500/5'
                          : 'border-white/10 bg-white/5 focus-within:border-violet-500/50 focus-within:bg-violet-500/5'
                        }`}
                      >
                        <KeyRound className="absolute left-3.5 w-4 h-4 text-white/30 pointer-events-none" />
                        <input
                          ref={otpInputRef}
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          placeholder="123456"
                          value={otp}
                          onChange={e => handleOtpChange(e.target.value)}
                          onPaste={handleOtpPaste}
                          maxLength={OTP_LENGTH}
                          className="w-full bg-transparent pl-10 pr-4 py-3 text-sm text-white
                            placeholder:text-white/20 focus:outline-none tracking-[0.3em] font-mono"
                        />
                      </div>
                      {error && (
                        <p className="flex items-center gap-1 mt-1.5 text-xs text-red-400">
                          <AlertCircle className="w-3 h-3 flex-shrink-0" />{error}
                        </p>
                      )}
                    </div>

                    <button
                      type="submit"
                      disabled={loading || otp.length < OTP_LENGTH}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-violet-600 to-purple-600
                        hover:from-violet-500 hover:to-purple-500 text-white font-semibold text-sm
                        transition-all shadow-lg shadow-violet-500/20
                        disabled:opacity-50 disabled:cursor-not-allowed
                        flex items-center justify-center gap-2"
                    >
                      {loading
                        ? <><Loader2 className="w-4 h-4 animate-spin" />Verifying…</>
                        : <><Download className="w-4 h-4" />Verify & Download</>
                      }
                    </button>

                    {/* Resend */}
                    <div className="flex items-center justify-between pt-1">
                      <button
                        type="button"
                        onClick={() => { setStep('email'); setError(''); setOtp(''); }}
                        className="text-xs text-white/30 hover:text-white/60 transition-colors flex items-center gap-1"
                      >
                        <Mail className="w-3 h-3" /> Change email
                      </button>
                      <button
                        type="button"
                        onClick={handleResend}
                        disabled={resendLeft > 0 || loading}
                        className="text-xs flex items-center gap-1 transition-colors
                          disabled:text-white/20 disabled:cursor-not-allowed
                          text-white/40 hover:text-white/70 enabled:text-violet-400"
                      >
                        <RotateCcw className="w-3 h-3" />
                        {resendLeft > 0 ? `Resend in ${resendLeft}s` : 'Resend code'}
                      </button>
                    </div>
                  </motion.form>
                )}

                {/* ── Email step ── */}
                {step === 'email' && (
                  <motion.form key="body-email"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onSubmit={handleEmailSubmit}
                    className="space-y-3"
                  >
                    <div>
                      <div className={`relative flex items-center rounded-xl border transition-colors
                        ${error
                          ? 'border-red-500/60 bg-red-500/5'
                          : 'border-white/10 bg-white/5 focus-within:border-emerald-500/50 focus-within:bg-emerald-500/5'
                        }`}
                      >
                        <Mail className="absolute left-3.5 w-4 h-4 text-white/30 pointer-events-none" />
                        <input
                          type="email"
                          placeholder="your@email.com"
                          value={email}
                          autoComplete="email"
                          autoFocus
                          onChange={e => { setEmail(e.target.value); setError(''); }}
                          className="w-full bg-transparent pl-10 pr-4 py-3 text-sm text-white
                            placeholder:text-white/25 focus:outline-none"
                        />
                      </div>
                      {error && (
                        <p className="flex items-center gap-1 mt-1.5 text-xs text-red-400">
                          <AlertCircle className="w-3 h-3 flex-shrink-0" />{error}
                        </p>
                      )}
                    </div>

                    {/* Terms Acceptance Checkbox */}
                    <label className="flex items-start gap-2.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={acceptedTerms}
                        onChange={(e) => { setAcceptedTerms(e.target.checked); setError(''); }}
                        className="mt-0.5 w-4 h-4 rounded border-white/20 bg-white/5 text-emerald-600 
                          focus:ring-2 focus:ring-emerald-500/30 focus:ring-offset-0 cursor-pointer"
                      />
                      <span className="text-xs text-white/50 group-hover:text-white/70 transition-colors leading-relaxed">
                        I agree to the{' '}
                        <Link 
                          to="/terms" 
                          target="_blank" 
                          className="text-emerald-400 hover:text-emerald-300 underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Terms of Service
                        </Link>
                        {' '}and{' '}
                        <Link 
                          to="/privacy" 
                          target="_blank" 
                          className="text-emerald-400 hover:text-emerald-300 underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          Privacy Policy
                        </Link>
                      </span>
                    </label>

                    <button
                      type="submit"
                      disabled={loading || !acceptedTerms}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600
                        hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm
                        transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-60 disabled:cursor-not-allowed
                        flex items-center justify-center gap-2"
                    >
                      {loading
                        ? <><Loader2 className="w-4 h-4 animate-spin" />Sending code…</>
                        : <><Mail className="w-4 h-4" />Send Download Code</>
                      }
                    </button>

                    <p className="text-center text-white/20 text-[11px] leading-relaxed pt-1">
                      By submitting you agree to receive occasional updates about{' '}
                      {toolName} and Fastoosh tools. Unsubscribe anytime.
                    </p>
                  </motion.form>
                )}

              </AnimatePresence>
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}