import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ToolSupportModal } from '../components/shared/ToolSupportModal';
import { Link, useNavigate } from 'react-router';
import { GlassCard } from '../components/shared/GlassCard';
import { NeonButton } from '../components/shared/NeonButton';
import { useUserAuth } from '../hooks/useUserAuth';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import {
  LogOut, ShoppingBag, Key, Download, ExternalLink,
  ArrowLeft, User, Calendar, CheckCircle, Clock, XCircle,
  Eye, EyeOff, Copy, Check, RefreshCw, Sparkles, ChevronDown,
  ChevronUp, Zap, ArrowUpRight, Package, Mail, Lock, AlertCircle,
  Loader2, Shield, KeyRound, Bell, Star, Gift, Info, Send, MessageSquarePlus,
} from 'lucide-react';
import { ReviewModal, type ReviewData } from '../components/shared/ReviewModal';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

interface ToolInfo { id: string; name: string; slug: string; imageUrl: string; }
interface ToolVersionInfo {
  id: string; versionType: 'Free' | 'Pro' | 'Studio';
  downloadUrl: string | null; tools: ToolInfo | null;
  activationSteps?: string[];
}
interface Purchase {
  id: string; productName: string; variantName: string;
  licenseKey: string; status: 'active' | 'expired' | 'cancelled' | 'refunded';
  amount: number; currency: string; purchasedAt: string; expiresAt: string | null;
  lemonSqueezyOrderId: string; toolVersions: ToolVersionInfo | null;
}

/* -------------------------------------------------------------------------- */
/* Status config                                                               */
/* -------------------------------------------------------------------------- */

const STATUS_CONFIG = {
  active:    { label: 'Active',    color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20', icon: <CheckCircle className="w-3.5 h-3.5" /> },
  expired:   { label: 'Expired',   color: 'text-yellow-400 bg-yellow-400/10 border-yellow-400/20',   icon: <Clock       className="w-3.5 h-3.5" /> },
  cancelled: { label: 'Cancelled', color: 'text-red-400 bg-red-400/10 border-red-400/20',            icon: <XCircle     className="w-3.5 h-3.5" /> },
  refunded:  { label: 'Refunded',  color: 'text-gray-400 bg-gray-400/10 border-gray-400/20',         icon: <XCircle     className="w-3.5 h-3.5" /> },
} as const;

/* -------------------------------------------------------------------------- */
/* Helper: map raw API row → Purchase                                          */
/* -------------------------------------------------------------------------- */
function mapPurchase(p: any): Purchase {
  // Server enriches with `tool_version` (singular) + top-level `tool`.
  // Supabase FK joins use `tool_versions` (plural) with `tools` nested inside.
  // Support both shapes so the mapper works regardless of which path was used.
  const tv   = p.tool_versions ?? p.tool_version ?? null;
  const tool = tv?.tools ?? p.tool ?? null;
  return {
    id:                  p.id,
    productName:         p.product_name  || '',
    variantName:         p.variant_name  || '',
    licenseKey:          p.license_key   || '',
    status:              p.status,
    amount:              p.amount,
    currency:            p.currency      || 'USD',
    purchasedAt:         p.purchased_at  || '',
    expiresAt:           p.expires_at    || null,
    lemonSqueezyOrderId: p.lemon_squeezy_order_id || '',
    toolVersions: tv ? {
      id:          tv.id,
      versionType: tv.version_type,
      downloadUrl: tv.download_url || null,
      tools: tool ? { id: tool.id, name: tool.name, slug: tool.slug, imageUrl: tool.image_url } : null,
      activationSteps: Array.isArray(tv.activation_steps) && tv.activation_steps.length > 0
        ? tv.activation_steps
        : undefined,
    } : null,
  };
}

/* -------------------------------------------------------------------------- */
/* LicenseKey                                                                  */
/* -------------------------------------------------------------------------- */
function LicenseKey({ value }: { value: string }) {
  const [visible, setVisible] = useState(false);
  const [copied,  setCopied]  = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };
  const masked = value.replace(/[^-]/g, '•').slice(0, 36) + (value.length > 36 ? '…' : '');
  return (
    <div className="mt-4 rounded-xl bg-black/50 border border-white/10 overflow-hidden">
      <div className="flex items-center gap-3 rtl:flex-row-reverse px-4 py-3">
        <Key className="w-4 h-4 text-purple-400 flex-shrink-0" />
        <code className="flex-1 text-xs font-mono text-white/70 truncate select-all">{visible ? value : masked}</code>
        <button onClick={() => setVisible(v => !v)} className="text-white/30 hover:text-white/70 transition-colors flex-shrink-0" title={visible ? 'Hide key' : 'Reveal key'}>
          {visible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
        <button onClick={copy} className="text-white/30 hover:text-purple-400 transition-colors flex-shrink-0" title="Copy">
          {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
        </button>
      </div>
      <div className="px-4 pb-3 flex items-center gap-2 rtl:flex-row-reverse">
        <span className="text-[10px] text-white/25 uppercase font-semibold">License Key</span>
        {copied && <motion.span initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} className="text-[10px] text-emerald-400">✓ Copied!</motion.span>}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* ActivationGuide                                                             */
/* -------------------------------------------------------------------------- */
function ActivationGuide({ versionType, activationSteps }: { versionType?: string; activationSteps?: string[] }) {
  const [open, setOpen] = useState(false);
  const defaultSteps = [
    { n: 1, text: 'Download and install the plugin file in After Effects (File → Scripts → Install Script File).' },
    { n: 2, text: 'Open the plugin panel (Window → Extensions → Plugin Name).' },
    { n: 3, text: 'Paste your license key in the Activation field and click "Activate".' },
    { n: 4, text: "Restart After Effects if prompted. You're ready to go!" },
  ];
  const steps = activationSteps && activationSteps.length > 0
    ? activationSteps.map((text, i) => ({ n: i + 1, text }))
    : defaultSteps;
  return (
    <div className="mt-3 rounded-xl border border-white/8 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between rtl:flex-row-reverse px-4 py-3 text-white/40 hover:text-white/70 transition-colors text-left rtl:text-right">
        <span className="flex items-center gap-2 rtl:flex-row-reverse text-xs font-semibold">
          <Zap className="w-3.5 h-3.5 text-purple-400" />
          How to activate {versionType && `(${versionType})`}
        </span>
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <ol className="px-4 pb-4 space-y-2.5">
              {steps.map(s => (
                <li key={s.n} className="flex gap-3 items-start rtl:flex-row-reverse">
                  <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-400 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{s.n}</span>
                  <p className="text-white/45 text-xs leading-relaxed">{s.text}</p>
                </li>
              ))}
            </ol>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* StarDisplay — read-only inline stars                                        */
/* -------------------------------------------------------------------------- */
function StarDisplay({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'xs' }) {
  const sz = size === 'xs' ? 'w-3 h-3' : 'w-3.5 h-3.5';
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <Star key={n} className={`${sz} ${n <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-white/15'}`} />
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* PurchaseCard                                                                */
/* -------------------------------------------------------------------------- */
function PurchaseCard({
  purchase,
  index,
  existingReview,
  onOpenReview,
}: {
  purchase: Purchase;
  index: number;
  existingReview: ReviewData | null;
  onOpenReview: (toolId: string, toolName: string, toolImageUrl: string, review: ReviewData | null) => void;
}) {
  const status      = STATUS_CONFIG[purchase.status] ?? STATUS_CONFIG.active;
  const isActive    = purchase.status === 'active';
  const tool        = purchase.toolVersions?.tools ?? null;
  const isFree      = purchase.toolVersions?.versionType === 'Free';
  const downloadUrl = purchase.toolVersions?.downloadUrl;
  const date        = purchase.purchasedAt ? new Date(purchase.purchasedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '';
  const expiryDate  = purchase.expiresAt   ? new Date(purchase.expiresAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : null;
  const variantColor = { Pro: 'text-purple-300 bg-purple-500/15 border-purple-500/30', Studio: 'text-sky-300 bg-sky-500/15 border-sky-500/30', Free: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30' }[purchase.toolVersions?.versionType ?? ''] ?? 'text-white/50 bg-white/8 border-white/15';

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}>
      <GlassCard className={`overflow-hidden ${isActive ? '' : 'opacity-70'}`}>
        <div className="flex items-start gap-4 p-5 rtl:flex-row-reverse">
          <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-white/5 border border-white/10">
            {tool?.imageUrl ? <img src={tool.imageUrl} alt={tool.name} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center relative">
              {tool?.imageUrl && (
                <img
                  src={tool.imageUrl}
                  alt={tool.name ?? ''}
                  className="absolute inset-0 w-full h-full object-cover"
                  onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                />
              )}
              <Package className="w-6 h-6 text-white/20" />
            </div>}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap rtl:flex-row-reverse">
              <div>
                <h3 className="text-white font-bold text-base leading-tight mb-1">{tool?.name || purchase.productName}</h3>
                <div className="flex items-center gap-2 flex-wrap rtl:flex-row-reverse">
                  <span className={`inline-flex items-center gap-1 rtl:flex-row-reverse px-2 py-0.5 rounded-full text-xs font-semibold border ${status.color}`}>{status.icon}{status.label}</span>
                  {purchase.toolVersions?.versionType && <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${variantColor}`}>{purchase.toolVersions.versionType}</span>}
                  {date && <span className="flex items-center gap-1 rtl:flex-row-reverse text-white/30 text-xs"><Calendar className="w-3 h-3" />{date}</span>}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 rtl:flex-row-reverse">
                {purchase.amount != null && <span className="text-white/30 text-xs font-mono">{purchase.currency} {Number(purchase.amount).toFixed(2)}</span>}
                {tool?.slug && <Link to={`/tools/${tool.slug}`} className="inline-flex items-center gap-1 rtl:flex-row-reverse text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors">View Tool <ArrowUpRight className="w-3 h-3" /></Link>}
              </div>
            </div>
          </div>
        </div>
        <div className="h-px bg-white/6 mx-5" />
        <div className="p-5 space-y-3">
          {purchase.licenseKey && <LicenseKey value={purchase.licenseKey} />}
          {expiryDate && (
            <p className={`text-xs flex items-center gap-1.5 rtl:flex-row-reverse ${isActive ? 'text-white/30' : 'text-yellow-400/70'}`}>
              <Clock className="w-3.5 h-3.5" />
              {isActive ? 'Renews on' : 'Expired on'}:
              <span className={isActive ? 'text-white/50' : 'text-yellow-400'}>{expiryDate}</span>
            </p>
          )}
          {!expiryDate && isActive && (
            <p className="text-white/25 text-xs flex items-center gap-1.5 rtl:flex-row-reverse">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-400/70" />Lifetime license — never expires
            </p>
          )}
          {/* Expired / cancelled warning banner */}
          {!isActive && purchase.status !== 'refunded' && (
            <div className="flex items-center gap-2 rtl:flex-row-reverse px-3 py-2 rounded-lg bg-yellow-400/8 border border-yellow-400/20">
              <AlertCircle className="w-3.5 h-3.5 text-yellow-400 flex-shrink-0" />
              <p className="text-yellow-400/80 text-xs flex-1">
                {purchase.status === 'cancelled' ? 'Your subscription has been cancelled.' : 'Your subscription has expired.'}
                {' '}Renew to regain access.
              </p>
            </div>
          )}
          <div className="flex flex-wrap gap-2 pt-1 rtl:flex-row-reverse">
            {/* Free download — only when active */}
            {isFree && downloadUrl && isActive && (
              <a href={downloadUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rtl:flex-row-reverse px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/25 transition-all">
                <Download className="w-3.5 h-3.5" />Download
              </a>
            )}
            {/* Active paid — manage */}
            {!isFree && isActive && purchase.lemonSqueezyOrderId && (
              <a href="https://app.lemonsqueezy.com/my-orders/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 rtl:flex-row-reverse px-4 py-2 rounded-lg text-sm font-semibold bg-white/8 hover:bg-white/12 text-white/60 hover:text-white border border-white/10 transition-all">
                <ExternalLink className="w-3.5 h-3.5" />Manage on Lemon Squeezy
              </a>
            )}
            {/* Expired / cancelled — renew CTA */}
            {!isActive && purchase.status !== 'refunded' && (
              tool?.slug ? (
                <Link
                  to={`/tools/${tool.slug}`}
                  className="inline-flex items-center gap-2 rtl:flex-row-reverse px-4 py-2 rounded-lg text-sm font-semibold bg-yellow-400/15 hover:bg-yellow-400/25 text-yellow-300 border border-yellow-400/30 transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />Renew Subscription
                </Link>
              ) : (
                <a
                  href="https://app.lemonsqueezy.com/my-orders/"
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rtl:flex-row-reverse px-4 py-2 rounded-lg text-sm font-semibold bg-yellow-400/15 hover:bg-yellow-400/25 text-yellow-300 border border-yellow-400/30 transition-all"
                >
                  <RefreshCw className="w-3.5 h-3.5" />Renew on Lemon Squeezy
                </a>
              )
            )}
            {tool?.slug && (
              <Link to={`/tools/${tool.slug}`} className="inline-flex items-center gap-2 rtl:flex-row-reverse px-4 py-2 rounded-lg text-sm font-semibold bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/25 transition-all">
                <Sparkles className="w-3.5 h-3.5" />Open Tool Page
              </Link>
            )}
            {/* Review button — only when tool is known */}
            {tool?.id && isActive && (
              <button
                onClick={() => onOpenReview(tool.id, tool.name, tool.imageUrl, existingReview)}
                className={`inline-flex items-center gap-2 rtl:flex-row-reverse px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                  existingReview
                    ? 'bg-yellow-400/10 hover:bg-yellow-400/20 text-yellow-300 border border-yellow-400/25'
                    : 'bg-white/6 hover:bg-white/10 text-white/50 hover:text-white/80 border border-white/10'
                }`}
              >
                {existingReview ? (
                  <>
                    <StarDisplay rating={existingReview.rating} size="xs" />
                    Edit review
                  </>
                ) : (
                  <>
                    <MessageSquarePlus className="w-3.5 h-3.5" />
                    Write a review
                  </>
                )}
              </button>
            )}
          </div>
          <ActivationGuide versionType={purchase.toolVersions?.versionType} activationSteps={purchase.toolVersions?.activationSteps} />
        </div>
      </GlassCard>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* SecuritySection — change password + change email (shown when logged in)    */
/* -------------------------------------------------------------------------- */
function SecuritySection({
  userEmail,
  updatePassword,
  updateEmail,
}: {
  userEmail: string;
  updatePassword: (p: string) => Promise<void>;
  updateEmail: (e: string) => Promise<void>;
}) {
  /* ── Password change ── */
  const [pwOpen,    setPwOpen]    = useState(false);
  const [newPw,     setNewPw]     = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw,    setShowPw]    = useState(false);
  const [pwErrors,  setPwErrors]  = useState<Record<string, string>>({});
  const [pwLoading, setPwLoading] = useState(false);
  const [pwOk,      setPwOk]      = useState(false);

  /* ── Email change ── */
  const [emOpen,    setEmOpen]    = useState(false);
  const [newEmail,  setNewEmail]  = useState('');
  const [emError,   setEmError]   = useState('');
  const [emLoading, setEmLoading] = useState(false);
  const [emOk,      setEmOk]      = useState(false);

  const handlePwSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!newPw)              errs.pw      = 'Required';
    else if (newPw.length < 8) errs.pw   = 'At least 8 characters';
    if (newPw !== confirmPw) errs.confirm = 'Passwords do not match';
    setPwErrors(errs);
    if (Object.keys(errs).length) return;
    setPwLoading(true);
    try {
      await updatePassword(newPw);
      setPwOk(true);
      setNewPw(''); setConfirmPw('');
      setTimeout(() => { setPwOk(false); setPwOpen(false); }, 2000);
    } catch (err: any) {
      setPwErrors({ form: err.message || 'Failed to update password' });
    } finally {
      setPwLoading(false);
    }
  };

  const handleEmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmError('');
    if (!newEmail.trim() || !/\S+@\S+/.test(newEmail)) { setEmError('Valid email required'); return; }
    if (newEmail.trim().toLowerCase() === userEmail.toLowerCase()) { setEmError('This is already your email'); return; }
    setEmLoading(true);
    try {
      await updateEmail(newEmail.trim());
      setEmOk(true);
      setTimeout(() => { setEmOk(false); setEmOpen(false); setNewEmail(''); }, 4000);
    } catch (err: any) {
      setEmError(err.message || 'Failed to update email');
    } finally {
      setEmLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="mt-8">
      <div className="flex items-center gap-3 rtl:flex-row-reverse mb-4">
        <Shield className="w-5 h-5 text-purple-400" />
        <h2 className="text-xl font-bold text-white">Security</h2>
      </div>
      <GlassCard className="divide-y divide-white/8">

        {/* ── Change password ── */}
        <div>
          <button
            onClick={() => { setPwOpen(o => !o); setEmOpen(false); setPwErrors({}); setPwOk(false); }}
            className="w-full flex items-center justify-between rtl:flex-row-reverse px-5 py-4 text-left rtl:text-right hover:bg-white/3 transition-colors"
          >
            <div className="flex items-center gap-3 rtl:flex-row-reverse">
              <KeyRound className="w-4 h-4 text-white/40" />
              <div>
                <p className="text-white/80 text-sm font-semibold">Change password</p>
                <p className="text-white/30 text-xs mt-0.5">Update your account password</p>
              </div>
            </div>
            {pwOpen ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
          </button>
          <AnimatePresence initial={false}>
            {pwOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                {pwOk ? (
                  <div className="px-5 pb-5 pt-1 flex items-center gap-2 rtl:flex-row-reverse text-emerald-400 text-sm">
                    <CheckCircle className="w-4 h-4" />Password updated successfully!
                  </div>
                ) : (
                  <form onSubmit={handlePwSubmit} className="px-5 pb-5 pt-1 space-y-3">
                    <div>
                      <div className={`relative flex items-center rounded-xl border transition-colors ${pwErrors.pw ? 'border-red-500/50 bg-red-500/5' : 'border-white/10 bg-white/5 focus-within:border-purple-500/50'}`}>
                        <Lock className="absolute left-3.5 rtl:left-auto rtl:right-3.5 w-4 h-4 text-white/30 pointer-events-none" />
                        <input type={showPw ? 'text' : 'password'} placeholder="New password (min 8 chars)" value={newPw} autoComplete="new-password"
                          onChange={e => setNewPw(e.target.value)}
                          className="w-full bg-transparent pl-10 rtl:pl-3 rtl:pr-10 pr-10 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none" />
                        <button type="button" onClick={() => setShowPw(v => !v)} className="absolute right-3 rtl:right-auto rtl:left-3 text-white/25 hover:text-white/60 transition-colors">
                          {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                      {pwErrors.pw && <p className="text-xs text-red-400 mt-1 flex items-center gap-1 rtl:flex-row-reverse"><AlertCircle className="w-3 h-3" />{pwErrors.pw}</p>}
                    </div>
                    <div>
                      <div className={`relative flex items-center rounded-xl border transition-colors ${pwErrors.confirm ? 'border-red-500/50 bg-red-500/5' : 'border-white/10 bg-white/5 focus-within:border-purple-500/50'}`}>
                        <Lock className="absolute left-3.5 rtl:left-auto rtl:right-3.5 w-4 h-4 text-white/30 pointer-events-none" />
                        <input type="password" placeholder="Confirm new password" value={confirmPw} autoComplete="new-password"
                          onChange={e => setConfirmPw(e.target.value)}
                          className="w-full bg-transparent pl-10 rtl:pl-4 rtl:pr-10 pr-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none" />
                      </div>
                      {pwErrors.confirm && <p className="text-xs text-red-400 mt-1 flex items-center gap-1 rtl:flex-row-reverse"><AlertCircle className="w-3 h-3" />{pwErrors.confirm}</p>}
                    </div>
                    {pwErrors.form && (
                      <div className="flex items-center gap-2 rtl:flex-row-reverse p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                        <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                        <p className="text-red-400 text-xs">{pwErrors.form}</p>
                      </div>
                    )}
                    <button type="submit" disabled={pwLoading}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-purple-500/20 disabled:opacity-60 flex items-center gap-2 rtl:flex-row-reverse">
                      {pwLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Updating…</> : 'Update Password'}
                    </button>
                  </form>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Change email ── */}
        <div>
          <button
            onClick={() => { setEmOpen(o => !o); setPwOpen(false); setEmError(''); setEmOk(false); }}
            className="w-full flex items-center justify-between rtl:flex-row-reverse px-5 py-4 text-left rtl:text-right hover:bg-white/3 transition-colors"
          >
            <div className="flex items-center gap-3 rtl:flex-row-reverse">
              <Mail className="w-4 h-4 text-white/40" />
              <div>
                <p className="text-white/80 text-sm font-semibold">Change email</p>
                <p className="text-white/30 text-xs mt-0.5">Current: {userEmail}</p>
              </div>
            </div>
            {emOpen ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
          </button>
          <AnimatePresence initial={false}>
            {emOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                {emOk ? (
                  <div className="px-5 pb-5 pt-1 space-y-1">
                    <div className="flex items-center gap-2 rtl:flex-row-reverse text-emerald-400 text-sm">
                      <CheckCircle className="w-4 h-4" />Confirmation sent!
                    </div>
                    <p className="text-white/35 text-xs pl-6 rtl:pl-0 rtl:pr-6">Check your new inbox — click the link to confirm the change.</p>
                  </div>
                ) : (
                  <form onSubmit={handleEmSubmit} className="px-5 pb-5 pt-1 space-y-3">
                    <div>
                      <div className={`relative flex items-center rounded-xl border transition-colors ${emError ? 'border-red-500/50 bg-red-500/5' : 'border-white/10 bg-white/5 focus-within:border-purple-500/50'}`}>
                        <Mail className="absolute left-3.5 rtl:left-auto rtl:right-3.5 w-4 h-4 text-white/30 pointer-events-none" />
                        <input type="email" placeholder="New email address" value={newEmail} autoComplete="email"
                          onChange={e => setNewEmail(e.target.value)}
                          className="w-full bg-transparent pl-10 rtl:pl-4 rtl:pr-10 pr-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none" />
                      </div>
                      {emError && <p className="text-xs text-red-400 mt-1 flex items-center gap-1 rtl:flex-row-reverse"><AlertCircle className="w-3 h-3" />{emError}</p>}
                    </div>
                    <p className="text-white/25 text-xs">A confirmation link will be sent to the new address.</p>
                    <button type="submit" disabled={emLoading}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-purple-500/20 disabled:opacity-60 flex items-center gap-2 rtl:flex-row-reverse">
                      {emLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</> : 'Send Confirmation'}
                    </button>
                  </form>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

      </GlassCard>
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main Account page                                                           */
/* -------------------------------------------------------------------------- */
export function Account() {
  const { user, session, loading, signInWithEmail, signUpWithEmail, signInWithOAuth, forgotPassword, updatePassword, updateEmail, signOut } = useUserAuth();
  const navigate = useNavigate();

  const [purchases,        setPurchases]        = useState<Purchase[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [purchasesError,   setPurchasesError]   = useState('');
  const [supportOpen,      setSupportOpen]      = useState(false);

  // Review state
  const [userReviews, setUserReviews] = useState<Record<string, ReviewData | null>>({});
  const [reviewTarget, setReviewTarget] = useState<{
    toolId: string; toolName: string; toolImageUrl: string; review: ReviewData | null;
  } | null>(null);

  /* ── Auth gate state ── */
  const [authTab,     setAuthTab]     = useState<'signin' | 'signup' | 'forgot'>('signin');
  const [authEmail,   setAuthEmail]   = useState('');
  const [authPass,    setAuthPass]    = useState('');
  const [authName,    setAuthName]    = useState('');
  const [authConfirm, setAuthConfirm] = useState('');
  const [authShowPw,  setAuthShowPw]  = useState(false);
  const [authErrors,  setAuthErrors]  = useState<Record<string, string>>({});
  const [authLoading, setAuthLoading] = useState(false);
  const [authSuccess, setAuthSuccess] = useState(false);
  const [fpSent,      setFpSent]      = useState(false);

  /* ── OAuth state ── */
  const [oauthLoading, setOauthLoading] = useState<'google' | 'discord' | null>(null);
  const [oauthError,   setOauthError]   = useState('');

  const handleOAuth = async (provider: 'google' | 'discord') => {
    setOauthError('');
    setOauthLoading(provider);
    try { await signInWithOAuth(provider); }
    catch (err: any) { setOauthError(err.message || `Failed to sign in with ${provider}`); setOauthLoading(null); }
  };

  const [syncedCount, setSyncedCount] = useState(0);
  const didSync = useRef(false);

  useEffect(() => {
    if (session?.access_token) {
      // On first login, auto-sync orphan purchases then fetch
      if (!didSync.current) {
        didSync.current = true;
        syncAndFetch(session.access_token);
      } else {
        fetchPurchases(session.access_token);
      }
    }
  }, [session]);

  const syncAndFetch = async (token: string) => {
    try {
      // Silently attempt to claim any pre-signup purchases
      const syncRes  = await fetch(`${API_BASE}/user/sync-purchases`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'X-User-Token': token,
        },
      });
      const syncData = await syncRes.json();
      if (syncData.success && syncData.synced > 0) {
        setSyncedCount(syncData.synced);
        console.log(`✅ Claimed ${syncData.synced} purchase(s) from before sign-up`);
      }
    } catch (err) {
      console.error('Sync error (non-fatal):', err);
    }
    await Promise.all([fetchPurchases(token), fetchUserReviews(token)]);
  };

  const fetchUserReviews = async (token: string) => {
    try {
      const res = await fetch(`${API_BASE}/user/reviews`, {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'X-User-Token': token,
        },
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.data)) {
        const map: Record<string, ReviewData | null> = {};
        for (const item of data.data) {
          map[item.toolId] = item.review || null;
        }
        setUserReviews(map);
      }
    } catch (err) {
      console.error('Error fetching user reviews (non-fatal):', err);
    }
  };

  const fetchPurchases = async (token: string) => {
    setPurchasesLoading(true); setPurchasesError('');
    try {
      const res  = await fetch(`${API_BASE}/user/purchases`, {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'X-User-Token': token,
        },
      });
      const data = await res.json();
      if (data.success) setPurchases((data.data || []).map(mapPurchase));
      else setPurchasesError(data.error || 'Failed to load purchases');
    } catch (err) {
      console.error('Error fetching purchases:', err);
      setPurchasesError('Could not load your purchases. Please try again.');
    } finally {
      setPurchasesLoading(false);
    }
  };

  const handleSignOut    = async () => { await signOut(); navigate('/tools'); };

  const handleSignInEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!authEmail.trim()) errs.email = 'Required'; else if (!/\S+@\S+/.test(authEmail)) errs.email = 'Invalid email';
    if (!authPass) errs.password = 'Required';
    setAuthErrors(errs); if (Object.keys(errs).length) return;
    setAuthLoading(true);
    try { await signInWithEmail(authEmail.trim(), authPass); }
    catch (err: any) { setAuthErrors({ form: err.message || 'Invalid email or password' }); }
    finally { setAuthLoading(false); }
  };

  const handleSignUpEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!authEmail.trim()) errs.email = 'Required'; else if (!/\S+@\S+/.test(authEmail)) errs.email = 'Invalid email';
    if (!authPass) errs.password = 'Required'; else if (authPass.length < 8) errs.password = 'At least 8 characters';
    if (authPass !== authConfirm) errs.confirm = 'Passwords do not match';
    setAuthErrors(errs); if (Object.keys(errs).length) return;
    setAuthLoading(true);
    try { await signUpWithEmail(authEmail.trim(), authPass, authName.trim() || undefined); setAuthSuccess(true); }
    catch (err: any) { setAuthErrors({ form: err.message || 'Failed to create account' }); }
    finally { setAuthLoading(false); }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthErrors({});
    if (!authEmail.trim() || !/\S+@\S+/.test(authEmail)) { setAuthErrors({ email: 'Valid email required' }); return; }
    setAuthLoading(true);
    try { await forgotPassword(authEmail.trim()); setFpSent(true); }
    catch (err: any) { setAuthErrors({ form: err.message || 'Failed to send reset link' }); }
    finally { setAuthLoading(false); }
  };

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-400 rounded-full animate-spin" />
      </div>
    );
  }

  /* ── Not signed in ── */
  if (!user) {
    return (
      <div className="min-h-screen pt-12 pb-24 flex items-center justify-center px-6">
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <GlassCard className="overflow-hidden">
            {/* Header */}
            <div className="px-8 pt-8 pb-5 text-center">
              <div className="relative w-14 h-14 mx-auto mb-5">
                <div className="absolute inset-0 rounded-full bg-purple-500/25 blur-xl" />
                <div className="relative w-14 h-14 rounded-full border border-purple-500/35 bg-purple-500/12 flex items-center justify-center">
                  <User className="w-6 h-6 text-purple-400" />
                </div>
              </div>
              <h1 className="text-xl font-bold text-white mb-1">
                {authTab === 'forgot' ? 'Reset password' : 'My Account'}
              </h1>
              <p className="text-white/40 text-xs">
                {authTab === 'forgot' ? "We'll send a link to your email" : 'Purchases, licenses & downloads'}
              </p>
            </div>

            {/* Tab switcher — hidden on forgot panel */}
            {authTab !== 'forgot' && (
              <div className="mx-6 mb-5 flex rounded-xl bg-white/5 border border-white/8 p-1">
                {(['signin', 'signup'] as const).map(t => (
                  <button key={t} onClick={() => { setAuthTab(t); setAuthErrors({}); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${authTab === t ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'text-white/40 hover:text-white/70'}`}>
                    {t === 'signin' ? 'Sign In' : 'Create Account'}
                  </button>
                ))}
              </div>
            )}

            <div className="px-6 pb-7">
              <AnimatePresence mode="wait" initial={false}>

                {/* ── Sign In ── */}
                {authTab === 'signin' && (
                  <motion.div key="si" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} transition={{ duration: 0.14 }}
                    className="space-y-3">

                    {/* OAuth */}
                    <div className="space-y-2">
                      {(['google', 'discord'] as const).map(p => (
                        <button key={p} type="button" onClick={() => handleOAuth(p)} disabled={!!oauthLoading || authLoading}
                          className="w-full flex items-center justify-center gap-2.5 rtl:flex-row-reverse py-2.5 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 text-white/80 hover:text-white text-sm font-medium transition-all duration-150 disabled:opacity-50">
                          {oauthLoading === p
                            ? <Loader2 className="w-4 h-4 animate-spin text-white/40" />
                            : p === 'google'
                              ? <svg viewBox="0 0 24 24" className="w-4 h-4"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                              : <svg viewBox="0 0 24 24" className="w-4 h-4"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" fill="#5865F2"/></svg>}
                          <span>Continue with {p.charAt(0).toUpperCase() + p.slice(1)}</span>
                        </button>
                      ))}
                    </div>
                    {oauthError && <p className="text-xs text-red-400 flex items-center gap-1 rtl:flex-row-reverse"><AlertCircle className="w-3 h-3 shrink-0"/>{oauthError}</p>}
                    <div className="flex items-center gap-3"><div className="flex-1 h-px bg-white/8"/><span className="text-white/25 text-xs">or</span><div className="flex-1 h-px bg-white/8"/></div>

                    <form onSubmit={handleSignInEmail} className="space-y-3">
                    <div className={`relative flex items-center rounded-xl border transition-colors ${authErrors.email ? 'border-red-500/50 bg-red-500/5' : 'border-white/10 bg-white/5 focus-within:border-purple-500/50'}`}>
                      <Mail className="absolute left-3.5 rtl:left-auto rtl:right-3.5 w-4 h-4 text-white/30 pointer-events-none" />
                      <input type="email" placeholder="Email" value={authEmail} autoComplete="email" onChange={e => setAuthEmail(e.target.value)} className="w-full bg-transparent pl-10 rtl:pl-4 rtl:pr-10 pr-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none" />
                    </div>
                    {authErrors.email && <p className="text-xs text-red-400 -mt-1 flex items-center gap-1 rtl:flex-row-reverse"><AlertCircle className="w-3 h-3"/>{authErrors.email}</p>}
                    <div>
                      <div className={`relative flex items-center rounded-xl border transition-colors ${authErrors.password ? 'border-red-500/50 bg-red-500/5' : 'border-white/10 bg-white/5 focus-within:border-purple-500/50'}`}>
                        <Lock className="absolute left-3.5 rtl:left-auto rtl:right-3.5 w-4 h-4 text-white/30 pointer-events-none" />
                        <input type={authShowPw ? 'text' : 'password'} placeholder="Password" value={authPass} autoComplete="current-password" onChange={e => setAuthPass(e.target.value)} className="w-full bg-transparent pl-10 rtl:pl-3 rtl:pr-10 pr-10 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none" />
                        <button type="button" onClick={() => setAuthShowPw(v => !v)} className="absolute right-3 rtl:right-auto rtl:left-3 text-white/25 hover:text-white/60 transition-colors">
                          {authShowPw ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                        </button>
                      </div>
                      <div className="flex justify-end rtl:justify-start mt-1.5">
                        <button type="button" onClick={() => { setAuthTab('forgot'); setAuthErrors({}); setFpSent(false); }} className="text-xs text-purple-400 hover:text-purple-300 transition-colors">Forgot password?</button>
                      </div>
                    </div>
                    {authErrors.password && <p className="text-xs text-red-400 -mt-1 flex items-center gap-1 rtl:flex-row-reverse"><AlertCircle className="w-3 h-3"/>{authErrors.password}</p>}
                    {authErrors.form && <div className="flex items-center gap-2 rtl:flex-row-reverse p-3 rounded-xl bg-red-500/10 border border-red-500/20"><AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" /><p className="text-red-400 text-xs">{authErrors.form}</p></div>}
                    <button type="submit" disabled={authLoading || !!oauthLoading} className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-purple-500/20 disabled:opacity-60 flex items-center justify-center gap-2 rtl:flex-row-reverse">
                      {authLoading ? <><Loader2 className="w-4 h-4 animate-spin"/>Signing in…</> : 'Sign In'}
                    </button>
                    </form>
                  </motion.div>
                )}

                {/* ── Sign Up ── */}
                {authTab === 'signup' && (
                  <motion.div key="su" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.14 }}
                    className="space-y-3">
                    {!authSuccess && (<>
                      <div className="space-y-2">
                        {(['google', 'discord'] as const).map(p => (
                          <button key={p} type="button" onClick={() => handleOAuth(p)} disabled={!!oauthLoading || authLoading}
                            className="w-full flex items-center justify-center gap-2.5 rtl:flex-row-reverse py-2.5 px-4 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20 text-white/80 hover:text-white text-sm font-medium transition-all duration-150 disabled:opacity-50">
                            {oauthLoading === p ? <Loader2 className="w-4 h-4 animate-spin text-white/40" />
                              : p === 'google'
                                ? <svg viewBox="0 0 24 24" className="w-4 h-4"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                                : <svg viewBox="0 0 24 24" className="w-4 h-4"><path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03z" fill="#5865F2"/></svg>}
                            <span>Sign up with {p.charAt(0).toUpperCase() + p.slice(1)}</span>
                          </button>
                        ))}
                      </div>
                      {oauthError && <p className="text-xs text-red-400 flex items-center gap-1 rtl:flex-row-reverse"><AlertCircle className="w-3 h-3 shrink-0"/>{oauthError}</p>}
                      <div className="flex items-center gap-3"><div className="flex-1 h-px bg-white/8"/><span className="text-white/25 text-xs">or</span><div className="flex-1 h-px bg-white/8"/></div>
                    </>)}
                    <form onSubmit={handleSignUpEmail} className="space-y-3">
                    {authSuccess ? (
                      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-8 text-center">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3"><Check className="w-6 h-6 text-emerald-400" /></div>
                        <p className="text-white font-semibold">Account created!</p>
                        <p className="text-white/45 text-xs mt-1">Signing you in…</p>
                      </motion.div>
                    ) : (
                      <>
                        <div className="relative flex items-center rounded-xl border border-white/10 bg-white/5 focus-within:border-purple-500/50 transition-colors">
                          <User className="absolute left-3.5 rtl:left-auto rtl:right-3.5 w-4 h-4 text-white/30 pointer-events-none" />
                          <input type="text" placeholder="Full name (optional)" value={authName} autoComplete="name" onChange={e => setAuthName(e.target.value)} className="w-full bg-transparent pl-10 rtl:pl-4 rtl:pr-10 pr-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none" />
                        </div>
                        <div className={`relative flex items-center rounded-xl border transition-colors ${authErrors.email ? 'border-red-500/50 bg-red-500/5' : 'border-white/10 bg-white/5 focus-within:border-purple-500/50'}`}>
                          <Mail className="absolute left-3.5 rtl:left-auto rtl:right-3.5 w-4 h-4 text-white/30 pointer-events-none" />
                          <input type="email" placeholder="Email" value={authEmail} autoComplete="email" onChange={e => setAuthEmail(e.target.value)} className="w-full bg-transparent pl-10 rtl:pl-4 rtl:pr-10 pr-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none" />
                        </div>
                        {authErrors.email && <p className="text-xs text-red-400 -mt-1 flex items-center gap-1 rtl:flex-row-reverse"><AlertCircle className="w-3 h-3"/>{authErrors.email}</p>}
                        <div className={`relative flex items-center rounded-xl border transition-colors ${authErrors.password ? 'border-red-500/50 bg-red-500/5' : 'border-white/10 bg-white/5 focus-within:border-purple-500/50'}`}>
                          <Lock className="absolute left-3.5 rtl:left-auto rtl:right-3.5 w-4 h-4 text-white/30 pointer-events-none" />
                          <input type={authShowPw ? 'text' : 'password'} placeholder="Password (min 8 chars)" value={authPass} autoComplete="new-password" onChange={e => setAuthPass(e.target.value)} className="w-full bg-transparent pl-10 rtl:pl-3 rtl:pr-10 pr-10 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none" />
                          <button type="button" onClick={() => setAuthShowPw(v => !v)} className="absolute right-3 rtl:right-auto rtl:left-3 text-white/25 hover:text-white/60 transition-colors">
                            {authShowPw ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                          </button>
                        </div>
                        {authErrors.password && <p className="text-xs text-red-400 -mt-1 flex items-center gap-1 rtl:flex-row-reverse"><AlertCircle className="w-3 h-3"/>{authErrors.password}</p>}
                        <div className={`relative flex items-center rounded-xl border transition-colors ${authErrors.confirm ? 'border-red-500/50 bg-red-500/5' : 'border-white/10 bg-white/5 focus-within:border-purple-500/50'}`}>
                          <Lock className="absolute left-3.5 rtl:left-auto rtl:right-3.5 w-4 h-4 text-white/30 pointer-events-none" />
                          <input type="password" placeholder="Confirm password" value={authConfirm} autoComplete="new-password" onChange={e => setAuthConfirm(e.target.value)} className="w-full bg-transparent pl-10 rtl:pl-4 rtl:pr-10 pr-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none" />
                        </div>
                        {authErrors.confirm && <p className="text-xs text-red-400 -mt-1 flex items-center gap-1 rtl:flex-row-reverse"><AlertCircle className="w-3 h-3"/>{authErrors.confirm}</p>}
                        {authErrors.form && <div className="flex items-center gap-2 rtl:flex-row-reverse p-3 rounded-xl bg-red-500/10 border border-red-500/20"><AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" /><p className="text-red-400 text-xs">{authErrors.form}</p></div>}
                        <button type="submit" disabled={authLoading || !!oauthLoading} className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-purple-500/20 disabled:opacity-60 flex items-center justify-center gap-2 rtl:flex-row-reverse">
                          {authLoading ? <><Loader2 className="w-4 h-4 animate-spin"/>Creating account…</> : 'Create Account'}
                        </button>
                      </>
                    )}
                    </form>
                  </motion.div>
                )}

                {/* ── Forgot password ── */}
                {authTab === 'forgot' && (
                  <motion.div key="fp" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} transition={{ duration: 0.14 }}>
                    {fpSent ? (
                      <div className="py-6 text-center space-y-3">
                        <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto"><CheckCircle className="w-7 h-7 text-emerald-400" /></div>
                        <div>
                          <p className="text-white font-semibold mb-1">Check your inbox</p>
                          <p className="text-white/40 text-xs leading-relaxed">We sent a reset link to <span className="text-purple-300">{authEmail}</span>. It expires in 1 hour.</p>
                        </div>
                        <button type="button" onClick={() => setAuthTab('signin')} className="flex items-center gap-1.5 rtl:flex-row-reverse mx-auto text-xs text-white/40 hover:text-white/70 transition-colors">
                          <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />Back to sign in
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleForgotPassword} className="space-y-3">
                        <div className={`relative flex items-center rounded-xl border transition-colors ${authErrors.email ? 'border-red-500/50 bg-red-500/5' : 'border-white/10 bg-white/5 focus-within:border-purple-500/50'}`}>
                          <Mail className="absolute left-3.5 rtl:left-auto rtl:right-3.5 w-4 h-4 text-white/30 pointer-events-none" />
                          <input type="email" placeholder="Your account email" value={authEmail} autoComplete="email" onChange={e => setAuthEmail(e.target.value)} className="w-full bg-transparent pl-10 rtl:pl-4 rtl:pr-10 pr-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none" />
                        </div>
                        {authErrors.email && <p className="text-xs text-red-400 -mt-1 flex items-center gap-1 rtl:flex-row-reverse"><AlertCircle className="w-3 h-3"/>{authErrors.email}</p>}
                        {authErrors.form && <div className="flex items-center gap-2 rtl:flex-row-reverse p-3 rounded-xl bg-red-500/10 border border-red-500/20"><AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" /><p className="text-red-400 text-xs">{authErrors.form}</p></div>}
                        <button type="submit" disabled={authLoading} className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-purple-500/20 disabled:opacity-60 flex items-center justify-center gap-2 rtl:flex-row-reverse">
                          {authLoading ? <><Loader2 className="w-4 h-4 animate-spin"/>Sending…</> : 'Send Reset Link'}
                        </button>
                        <button type="button" onClick={() => setAuthTab('signin')} className="flex items-center gap-1.5 rtl:flex-row-reverse mx-auto text-xs text-white/35 hover:text-white/65 transition-colors pt-1">
                          <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />Back to sign in
                        </button>
                      </form>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </GlassCard>
        </motion.div>
      </div>
    );
  }

  /* ── Signed in ── */
  const avatarUrl         = user.user_metadata?.avatar_url;
  const displayName       = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'User';
  const activeCount       = purchases.filter(p => p.status === 'active').length;
  const lifetimeCount     = purchases.filter(p => p.status === 'active' && !p.expiresAt).length;
  const subscriptionCount = purchases.filter(p => p.status === 'active' && !!p.expiresAt).length;
  const totalSpent        = purchases.reduce((sum, p) => sum + (p.amount || 0), 0);

  return (
    <>
    <div className="min-h-screen pt-8 pb-28">
      <div className="max-w-3xl mx-auto px-6">

        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
          <Link to="/tools" className="inline-flex items-center gap-1.5 rtl:flex-row-reverse text-sm text-white/40 hover:text-white/80 transition-colors mb-10">
            <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />Back to Tools
          </Link>
        </motion.div>

        {/* ── Synced banner ── */}
        <AnimatePresence>
          {syncedCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              className="mb-5"
            >
              <div className="flex items-center gap-3 rtl:flex-row-reverse px-5 py-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25">
                <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                  <Gift className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-emerald-300 font-semibold text-sm">
                    {syncedCount === 1 ? '1 purchase' : `${syncedCount} purchases`} linked to your account!
                  </p>
                  <p className="text-emerald-400/60 text-xs mt-0.5">
                    Purchases made before creating your account have been automatically claimed.
                  </p>
                </div>
                <button onClick={() => setSyncedCount(0)} className="text-emerald-500/40 hover:text-emerald-400 transition-colors flex-shrink-0">
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Profile hero ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
          <GlassCard className="overflow-hidden">
            {/* Top gradient bar */}
            <div className="h-1 w-full bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500" />
            <div className="p-6">
              <div className="flex items-center justify-between gap-4 flex-wrap rtl:flex-row-reverse">
                <div className="flex items-center gap-4 rtl:flex-row-reverse">
                  <div className="relative">
                    {avatarUrl ? (
                      <img src={avatarUrl} alt={displayName} className="w-14 h-14 rounded-full object-cover border-2 border-purple-500/40 shadow-lg shadow-purple-500/20" />
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-purple-500/40 to-blue-500/40 border border-purple-500/40 flex items-center justify-center shadow-lg shadow-purple-500/20">
                        <User className="w-6 h-6 text-purple-300" />
                      </div>
                    )}
                    <div className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-emerald-400 border-2 border-black shadow" />
                  </div>
                  <div>
                    <p className="text-white font-bold text-lg leading-tight">{displayName}</p>
                    <p className="text-white/40 text-sm">{user.email}</p>
                    <span className="inline-flex items-center gap-1 rtl:flex-row-reverse mt-1.5 px-2 py-0.5 rounded-full bg-purple-500/15 border border-purple-500/25 text-purple-300 text-[10px] font-semibold">
                      <Star className="w-2.5 h-2.5" />Fastoosh Member
                    </span>
                  </div>
                </div>
                <button onClick={handleSignOut} className="flex items-center gap-2 rtl:flex-row-reverse px-4 py-2 rounded-xl text-sm text-white/50 hover:text-white/80 border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/8 transition-all">
                  <LogOut className="w-4 h-4" />Sign out
                </button>
              </div>

              {/* Stats row */}
              <div className="mt-5 pt-5 border-t border-white/8 grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  { label: 'Active licenses', value: activeCount,       icon: <Key className="w-3.5 h-3.5" />,      color: 'text-white',        glow: '' },
                  { label: 'Lifetime',         value: lifetimeCount,     icon: <CheckCircle className="w-3.5 h-3.5" />, color: 'text-emerald-400', glow: 'drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]' },
                  { label: 'Subscriptions',    value: subscriptionCount, icon: <RefreshCw className="w-3.5 h-3.5" />,  color: 'text-purple-400',  glow: 'drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]' },
                  { label: 'Total spent',      value: `$${totalSpent.toFixed(0)}`, icon: <ShoppingBag className="w-3.5 h-3.5" />, color: 'text-sky-400', glow: 'drop-shadow-[0_0_6px_rgba(56,189,248,0.5)]' },
                ].map(stat => (
                  <div key={stat.label} className="text-center p-3 rounded-xl bg-white/3 border border-white/6">
                    <div className={`flex items-center justify-center gap-1.5 ${stat.color} ${stat.glow} mb-1`}>
                      {stat.icon}
                      <span className="text-xl font-black">{stat.value}</span>
                    </div>
                    <div className="text-white/30 text-[11px] font-medium">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </motion.div>

        {/* ── Licenses ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <div className="flex items-center justify-between rtl:flex-row-reverse mb-5">
            <div className="flex items-center gap-3 rtl:flex-row-reverse">
              <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 text-purple-400" />
              </div>
              <h2 className="text-xl font-bold text-white">My Licenses</h2>
              {purchases.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">{purchases.length}</span>
              )}
            </div>
            {session && (
              <button
                onClick={() => syncAndFetch(session.access_token)}
                disabled={purchasesLoading}
                className="flex items-center gap-1.5 rtl:flex-row-reverse text-xs text-white/30 hover:text-white/60 transition-colors disabled:opacity-50 px-3 py-1.5 rounded-lg border border-white/8 hover:border-white/15 bg-white/3 hover:bg-white/6"
                title="Refresh & sync purchases"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${purchasesLoading ? 'animate-spin' : ''}`} />
                Sync
              </button>
            )}
          </div>

          {purchasesLoading && (
            <div className="flex items-center gap-3 py-20 justify-center">
              <div className="w-5 h-5 border-2 border-purple-400/40 border-t-purple-400 rounded-full animate-spin" />
              <span className="text-white/40 text-sm">Loading your licenses…</span>
            </div>
          )}

          {purchasesError && !purchasesLoading && (
            <GlassCard className="p-6 border border-red-500/20 bg-red-500/5">
              <div className="flex items-start gap-3 rtl:flex-row-reverse">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-400 text-sm font-semibold mb-1">Could not load purchases</p>
                  <p className="text-red-400/60 text-xs">{purchasesError}</p>
                  <button onClick={() => session && fetchPurchases(session.access_token)} className="mt-3 text-sm text-purple-400 hover:text-purple-300 underline">
                    Try again
                  </button>
                </div>
              </div>
            </GlassCard>
          )}

          {!purchasesLoading && !purchasesError && purchases.length === 0 && (
            <GlassCard className="overflow-hidden">
              <div className="p-16 text-center">
                <div className="relative w-20 h-20 mx-auto mb-6">
                  <div className="absolute inset-0 rounded-full bg-purple-500/15 blur-2xl" />
                  <div className="relative w-20 h-20 rounded-full border border-purple-500/20 bg-purple-500/8 flex items-center justify-center">
                    <ShoppingBag className="w-9 h-9 text-white/15" />
                  </div>
                </div>
                <h3 className="text-white/70 font-bold text-xl mb-2">No licenses yet</h3>
                <p className="text-white/30 text-sm mb-8 max-w-xs mx-auto leading-relaxed">
                  Once you purchase a tool, your license keys, downloads and activation instructions will appear here.
                </p>
                <div className="flex flex-wrap justify-center gap-3">
                  <NeonButton href="/tools" variant="primary">
                    <Sparkles className="w-4 h-4 mr-2 rtl:mr-0 rtl:ml-2" />Browse Tools
                  </NeonButton>
                </div>
              </div>
              {/* Info tip */}
              <div className="border-t border-white/6 px-6 py-4 flex items-start gap-3 rtl:flex-row-reverse bg-white/2">
                <Info className="w-4 h-4 text-white/25 flex-shrink-0 mt-0.5" />
                <p className="text-white/25 text-xs leading-relaxed">
                  Purchased a tool before creating your account? Hit the <strong className="text-white/40">Sync</strong> button above — we'll automatically link it to your email.
                </p>
              </div>
            </GlassCard>
          )}

          {!purchasesLoading && purchases.length > 0 && (
            <div className="space-y-4">
              {purchases.map((p, i) => (
                <PurchaseCard
                  key={p.id}
                  purchase={p}
                  index={i}
                  existingReview={p.toolVersions?.tools?.id ? (userReviews[p.toolVersions.tools.id] ?? null) : null}
                  onOpenReview={(toolId, toolName, toolImageUrl, review) =>
                    setReviewTarget({ toolId, toolName, toolImageUrl, review })
                  }
                />
              ))}
            </div>
          )}

          {!purchasesLoading && purchases.length > 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="mt-8">
              <GlassCard className="p-6 flex flex-col items-center text-center gap-4">
                <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center -mt-2">
                  <Bell className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">Need help with a tool?</p>
                  <p className="text-white/35 text-xs mt-0.5">We reply to all license & activation issues within 24h.</p>
                </div>
                <button
                  onClick={() => setSupportOpen(true)}
                  className="inline-flex items-center gap-2 rtl:flex-row-reverse px-4 py-2 rounded-xl text-sm font-semibold bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 hover:text-purple-200 border border-purple-500/25 hover:border-purple-500/40 transition-all"
                >
                  <Send className="w-3.5 h-3.5" />Get Support
                </button>
              </GlassCard>
            </motion.div>
          )}
        </motion.div>

        {/* ── Security ── */}
        <SecuritySection
          userEmail={user.email ?? ''}
          updatePassword={updatePassword}
          updateEmail={updateEmail}
        />

      </div>
    </div>

      {supportOpen && (
        <ToolSupportModal toolName="License & Activation" onClose={() => setSupportOpen(false)} />
      )}

      {/* ── Review modal ── */}
      {reviewTarget && session?.access_token && (
        <ReviewModal
          toolId={reviewTarget.toolId}
          toolName={reviewTarget.toolName}
          toolImageUrl={reviewTarget.toolImageUrl}
          accessToken={session.access_token}
          existingReview={reviewTarget.review}
          onClose={() => setReviewTarget(null)}
          onSaved={(review) => {
            setUserReviews(prev => ({ ...prev, [reviewTarget.toolId]: review }));
            setReviewTarget(null);
          }}
          onDeleted={() => {
            setUserReviews(prev => ({ ...prev, [reviewTarget.toolId]: null }));
            setReviewTarget(null);
          }}
        />
      )}
    </>
  );
}