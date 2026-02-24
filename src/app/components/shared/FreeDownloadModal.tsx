import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Mail, Download, AlertCircle, CheckCircle, Loader2, Sparkles } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

export interface FreeDownloadModalProps {
  toolName: string;
  toolSlug: string;
  toolVersionId: string;
  downloadUrl: string;
  onClose: () => void;
}

export function FreeDownloadModal({
  toolName,
  toolSlug,
  toolVersionId,
  downloadUrl,
  onClose,
}: FreeDownloadModalProps) {
  const [email,   setEmail]   = useState('');
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [done,    setDone]    = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/free-download`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({
          email:         email.trim().toLowerCase(),
          toolVersionId,
          toolName,
          toolSlug,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to process download');
      }

      // Show success state, then trigger download
      setDone(true);
      setTimeout(() => {
        window.open(downloadUrl, '_blank', 'noopener,noreferrer');
        setTimeout(onClose, 800);
      }, 900);

    } catch (err: any) {
      console.error('[FreeDownloadModal] Error:', err);
      setError(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        key="fdl-backdrop"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={onClose}
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
            {/* Ambient glow */}
            <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2
              w-48 h-48 rounded-full bg-emerald-500/15 blur-3xl" />

            {/* Close */}
            <button onClick={onClose}
              className="absolute top-4 right-4 z-10 text-white/25 hover:text-white transition-colors"
              aria-label="Close">
              <X className="w-5 h-5" />
            </button>

            {/* Header */}
            <div className="px-7 pt-8 pb-5 text-center relative">
              <div className="relative w-14 h-14 mx-auto mb-4">
                <div className="absolute inset-0 rounded-full bg-emerald-500/25 blur-xl" />
                <div className="relative w-14 h-14 rounded-full border border-emerald-500/35
                  bg-emerald-500/12 flex items-center justify-center">
                  <Download className="w-6 h-6 text-emerald-400" />
                </div>
              </div>
              <h2 className="text-xl font-bold text-white mb-1">Download Free</h2>
              <p className="text-white/40 text-xs leading-relaxed">
                Enter your email to get{' '}
                <span className="text-white/65 font-medium">{toolName}</span> for free.
                <br />No spam, ever.
              </p>
            </div>

            {/* Body */}
            <div className="px-7 pb-7 relative">
              <AnimatePresence mode="wait" initial={false}>

                {/* ── Success state ── */}
                {done ? (
                  <motion.div
                    key="success"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="py-5 text-center space-y-3"
                  >
                    <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30
                      flex items-center justify-center mx-auto">
                      <CheckCircle className="w-7 h-7 text-emerald-400" />
                    </div>
                    <div>
                      <p className="text-white font-semibold">You're all set!</p>
                      <p className="text-white/40 text-xs mt-1">Your download is starting…</p>
                    </div>
                    <div className="flex items-center justify-center gap-1.5 text-xs text-white/25">
                      <Sparkles className="w-3 h-3" />
                      Enjoy {toolName}
                    </div>
                  </motion.div>
                ) : (

                  /* ── Form ── */
                  <motion.form
                    key="form"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    onSubmit={handleSubmit}
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

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600
                        hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-sm
                        transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-60
                        flex items-center justify-center gap-2"
                    >
                      {loading
                        ? <><Loader2 className="w-4 h-4 animate-spin" />Processing…</>
                        : <><Download className="w-4 h-4" />Get Free Download</>
                      }
                    </button>

                    <p className="text-center text-white/20 text-[11px] leading-relaxed pt-1">
                      By downloading you agree to receive occasional updates about{' '}
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
