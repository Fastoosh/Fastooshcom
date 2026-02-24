import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, CheckCircle2, Loader2, Wrench, Bug, Lightbulb, Key, HelpCircle } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { NeonButton } from './NeonButton';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

const INQUIRY_TYPES = [
  { value: 'Technical Support', icon: Wrench,    color: 'text-blue-400',   bg: 'bg-blue-400/10 border-blue-400/20' },
  { value: 'Bug Report',        icon: Bug,        color: 'text-red-400',    bg: 'bg-red-400/10 border-red-400/20' },
  { value: 'Licensing',         icon: Key,        color: 'text-yellow-400', bg: 'bg-yellow-400/10 border-yellow-400/20' },
  { value: 'Feature Request',   icon: Lightbulb,  color: 'text-emerald-400',bg: 'bg-emerald-400/10 border-emerald-400/20' },
  { value: 'Other',             icon: HelpCircle, color: 'text-violet-300', bg: 'bg-violet-400/10 border-violet-400/30' },
];

interface Props {
  toolName: string;
  onClose: () => void;
}

export function ToolSupportModal({ toolName, onClose }: Props) {
  const [form, setForm] = useState({ name: '', email: '', inquiryType: '', otherDetail: '', message: '' });
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.inquiryType || !form.message) return;

    setSubmitting(true);
    setErrorMsg('');

    try {
      const res = await fetch(`${API_BASE}/tool-support`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
        },
        body: JSON.stringify({ ...form, toolName }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus('success');
      } else {
        setErrorMsg(data.error || 'Something went wrong.');
        setStatus('error');
      }
    } catch (err) {
      console.error('Tool support form error:', err);
      setErrorMsg('Network error. Please try again.');
      setStatus('error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {/* Backdrop */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ type: 'spring', stiffness: 300, damping: 28 }}
          className="relative z-10 w-full max-w-lg"
          onClick={e => e.stopPropagation()}
        >
          <GlassCard className="p-7 relative overflow-hidden">
            {/* Subtle top glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-px bg-gradient-to-r from-transparent via-purple-400/60 to-transparent" />

            {/* Close */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 w-7 h-7 rounded-lg flex items-center justify-center
                text-white/30 hover:text-white/70 hover:bg-white/8 transition-all"
            >
              <X className="w-4 h-4" />
            </button>

            {status === 'success' ? (
              /* ── Success state ── */
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="py-6 flex flex-col items-center text-center gap-4"
              >
                <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30
                  flex items-center justify-center">
                  <CheckCircle2 className="w-7 h-7 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white mb-1">Message sent!</h3>
                  <p className="text-white/50 text-sm">
                    We'll get back to you within 24 hours. Check your inbox.
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="mt-2 text-sm text-white/40 hover:text-white/70 transition-colors"
                >
                  Close
                </button>
              </motion.div>
            ) : (
              /* ── Form ── */
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Header */}
                <div className="mb-2 pr-6">
                  <p className="text-xs font-bold tracking-widest uppercase text-white/30 mb-1">Tool support</p>
                  <h2 className="text-xl font-black text-white leading-tight">{toolName}</h2>
                </div>

                {/* Inquiry type selector */}
                <div>
                  <label className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-2.5 block">
                    What can we help with?
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {INQUIRY_TYPES.map(({ value, icon: Icon, color, bg }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => set('inquiryType', value)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium
                          transition-all duration-150 text-left
                          ${form.inquiryType === value
                            ? `${bg} ${color} border-current scale-[1.02]`
                            : 'bg-white/4 border-white/8 text-white/40 hover:bg-white/8 hover:text-white/60'
                          }`}
                      >
                        <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${form.inquiryType === value ? color : ''}`} />
                        {value}
                      </button>
                    ))}
                  </div>

                  {/* "Other" detail field */}
                  {form.inquiryType === 'Other' && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.18 }}
                      className="mt-2.5 overflow-hidden"
                    >
                      <input
                        type="text"
                        value={form.otherDetail}
                        onChange={e => set('otherDetail', e.target.value)}
                        placeholder="Please specify…"
                        autoFocus
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/15
                          text-white placeholder-white/25 text-sm
                          focus:outline-none focus:border-white/30 focus:bg-white/8
                          transition-colors"
                      />
                    </motion.div>
                  )}
                </div>

                {/* Name + Email */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'name',  label: 'Your name',  type: 'text',  placeholder: 'Jane Doe' },
                    { key: 'email', label: 'Email',       type: 'email', placeholder: 'jane@studio.com' },
                  ].map(({ key, label, type, placeholder }) => (
                    <div key={key}>
                      <label className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-1.5 block">
                        {label}
                      </label>
                      <input
                        type={type}
                        value={form[key as keyof typeof form]}
                        onChange={e => set(key, e.target.value)}
                        placeholder={placeholder}
                        required
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10
                          text-white placeholder-white/20 text-sm
                          focus:outline-none focus:border-purple-500/50 focus:bg-white/8
                          transition-colors"
                      />
                    </div>
                  ))}
                </div>

                {/* Message */}
                <div>
                  <label className="text-xs font-semibold text-white/40 uppercase tracking-widest mb-1.5 block">
                    Message
                  </label>
                  <textarea
                    value={form.message}
                    onChange={e => set('message', e.target.value)}
                    placeholder="Describe your issue or question in detail…"
                    required
                    rows={4}
                    className="w-full px-3.5 py-2.5 rounded-xl bg-white/5 border border-white/10
                      text-white placeholder-white/20 text-sm resize-none
                      focus:outline-none focus:border-purple-500/50 focus:bg-white/8
                      transition-colors"
                  />
                </div>

                {/* Error */}
                {status === 'error' && (
                  <p className="text-red-400 text-xs">{errorMsg}</p>
                )}

                {/* Submit */}
                <NeonButton
                  type="submit"
                  className="w-full justify-center"
                  disabled={submitting || !form.inquiryType}
                >
                  {submitting ? (
                    <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />Sending…</>
                  ) : (
                    <><Send className="w-3.5 h-3.5 mr-2" />Send message</>
                  )}
                </NeonButton>
              </form>
            )}
          </GlassCard>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}