import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useTranslation } from 'react-i18next';
import { fetchTranslations, deepMergeTranslations } from '../utils/translations';
import { api } from '../utils/api';
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
interface FreeDownload {
  toolVersionId: string;
  toolId: string;
  toolName: string;
  toolSlug: string;
  toolImageUrl: string;
  downloadUrl: string;
  downloadedAt: string;
}

/* -------------------------------------------------------------------------- */
/* DownloadCard                                                                */
/* -------------------------------------------------------------------------- */
function DownloadCard({ item, index }: { item: FreeDownload; index: number }) {
  const { t } = useTranslation();
  const date = item.downloadedAt
    ? new Date(item.downloadedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    : '';

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }}>
      <GlassCard className="overflow-hidden">
        <div className="flex items-start gap-4 p-5 rtl:flex-row-reverse">
          {/* Tool image */}
          <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-white/5 border border-white/10 flex items-center justify-center relative">
            {item.toolImageUrl ? (
              <img src={item.toolImageUrl} alt={item.toolName} className="w-full h-full object-cover" />
            ) : (
              <Download className="w-6 h-6 text-white/20" />
            )}
          </div>
          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap rtl:flex-row-reverse">
              <div>
                <h3 className="text-white font-bold text-base leading-tight mb-1.5">{item.toolName}</h3>
                <div className="flex items-center gap-2 flex-wrap rtl:flex-row-reverse">
                  {/* Free badge */}
                  <span className="inline-flex items-center gap-1 rtl:flex-row-reverse px-2 py-0.5 rounded-full text-xs font-bold border text-emerald-300 bg-emerald-500/15 border-emerald-500/30">
                    <Gift className="w-3 h-3" /> Free
                  </span>
                  {date && (
                    <span className="flex items-center gap-1 rtl:flex-row-reverse text-white/30 text-xs">
                      <Calendar className="w-3 h-3" />{t('account.downloadedOn')} {date}
                    </span>
                  )}
                </div>
              </div>
              {item.toolSlug && (
                <Link
                  to={`/tools/${item.toolSlug}`}
                  className="inline-flex items-center gap-1 rtl:flex-row-reverse text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors flex-shrink-0"
                >
                  {t('account.viewTool')} <ArrowUpRight className="w-3 h-3" />
                </Link>
              )}
            </div>
          </div>
        </div>
        {/* Actions */}
        <div className="h-px bg-white/6 mx-5" />
        <div className="px-5 py-4 flex flex-wrap gap-2 rtl:flex-row-reverse">
          {item.downloadUrl && (
            <a
              href={item.downloadUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rtl:flex-row-reverse px-4 py-2 rounded-lg text-sm font-semibold bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/25 transition-all"
            >
              <Download className="w-3.5 h-3.5" />{t('account.reDownload')}
            </a>
          )}
          {item.toolSlug && (
            <Link
              to={`/tools/${item.toolSlug}`}
              className="inline-flex items-center gap-2 rtl:flex-row-reverse px-4 py-2 rounded-lg text-sm font-semibold bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/25 transition-all"
            >
              <Sparkles className="w-3.5 h-3.5" />{t('account.openToolPage')}
            </Link>
          )}
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
  const { t } = useTranslation();
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
    if (!newPw)              errs.pw      = t('auth.required');
    else if (newPw.length < 8) errs.pw   = t('auth.atLeast8');
    if (newPw !== confirmPw) errs.confirm = t('auth.passwordsDoNotMatch');
    setPwErrors(errs);
    if (Object.keys(errs).length) return;
    setPwLoading(true);
    try {
      await updatePassword(newPw);
      setPwOk(true);
      setNewPw(''); setConfirmPw('');
      setTimeout(() => { setPwOk(false); setPwOpen(false); }, 2000);
    } catch (err: any) {
      setPwErrors({ form: err.message || t('account.failedUpdatePassword') });
    } finally {
      setPwLoading(false);
    }
  };

  const handleEmSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setEmError('');
    if (!newEmail.trim() || !/\S+@\S+/.test(newEmail)) { setEmError(t('auth.validEmailRequired')); return; }
    if (newEmail.trim().toLowerCase() === userEmail.toLowerCase()) { setEmError(t('account.alreadyYourEmail')); return; }
    setEmLoading(true);
    try {
      await updateEmail(newEmail.trim());
      setEmOk(true);
      setTimeout(() => { setEmOk(false); setEmOpen(false); setNewEmail(''); }, 4000);
    } catch (err: any) {
      setEmError(err.message || t('account.failedUpdateEmail'));
    } finally {
      setEmLoading(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="mt-8">
      <div className="flex items-center gap-3 mb-4">
        <Shield className="w-5 h-5 text-purple-400" />
        <h2 className="text-xl font-bold text-white">{t('account.security')}</h2>
      </div>
      <GlassCard className="divide-y divide-white/8">

        {/* ── Change password ── */}
        <div>
          <button
            onClick={() => { setPwOpen(o => !o); setEmOpen(false); setPwErrors({}); setPwOk(false); }}
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/3 transition-colors"
          >
            <div className="flex items-center">
              <KeyRound className="w-4 h-4 text-white/40 mr-3" />
              <div className="rtl:text-right">
                <p className="text-white/80 text-sm font-semibold text-left">{t('account.changePassword')}</p>
                <p className="text-white/30 text-xs mt-0.5">{t('account.updatePasswordDesc')}</p>
              </div>
            </div>
            {pwOpen ? <ChevronUp className="w-4 h-4 text-white/30" /> : <ChevronDown className="w-4 h-4 text-white/30" />}
          </button>
          <AnimatePresence initial={false}>
            {pwOpen && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                {pwOk ? (
                  <div className="px-5 pb-5 pt-1 flex items-center gap-2 rtl:flex-row-reverse text-emerald-400 text-sm">
                    <CheckCircle className="w-4 h-4" />{t('account.passwordUpdated')}
                  </div>
                ) : (
                  <form onSubmit={handlePwSubmit} className="px-5 pb-5 pt-1 space-y-3">
                    <div>
                      <div className={`relative flex items-center rounded-xl border transition-colors ${pwErrors.pw ? 'border-red-500/50 bg-red-500/5' : 'border-white/10 bg-white/5 focus-within:border-purple-500/50'}`}>
                        <Lock className="absolute left-3.5 rtl:left-auto rtl:right-3.5 w-4 h-4 text-white/30 pointer-events-none" />
                        <input type={showPw ? 'text' : 'password'} placeholder={t('auth.newPasswordMin8')} value={newPw} autoComplete="new-password"
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
                        <input type="password" placeholder={t('auth.confirmNewPassword')} value={confirmPw} autoComplete="new-password"
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
                      {pwLoading ? <><Loader2 className="w-4 h-4 animate-spin" />{t('account.updating')}</> : t('account.updatePassword')}
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
            className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/3 transition-colors"
          >
            <div className="flex items-center">
              <Mail className="w-4 h-4 text-white/40 mr-3" />
              <div className="rtl:text-right">
                <p className="text-white/80 text-sm font-semibold text-left">{t('account.changeEmail')}</p>
                <p className="text-white/30 text-xs mt-0.5">{t('account.currentEmail', { email: userEmail })}</p>
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
                      <CheckCircle className="w-4 h-4" />{t('account.confirmationSent')}
                    </div>
                    <p className="text-white/35 text-xs pl-6 rtl:pl-0 rtl:pr-6">{t('account.emailChangeConfirm')}</p>
                  </div>
                ) : (
                  <form onSubmit={handleEmSubmit} className="px-5 pb-5 pt-1 space-y-3">
                    <div>
                      <div className={`relative flex items-center rounded-xl border transition-colors ${emError ? 'border-red-500/50 bg-red-500/5' : 'border-white/10 bg-white/5 focus-within:border-purple-500/50'}`}>
                        <Mail className="absolute left-3.5 rtl:left-auto rtl:right-3.5 w-4 h-4 text-white/30 pointer-events-none" />
                        <input type="email" placeholder={t('account.newEmailAddress')} value={newEmail} autoComplete="email"
                          onChange={e => setNewEmail(e.target.value)}
                          className="w-full bg-transparent pl-10 rtl:pl-4 rtl:pr-10 pr-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none" />
                      </div>
                      {emError && <p className="text-xs text-red-400 mt-1 flex items-center gap-1 rtl:flex-row-reverse"><AlertCircle className="w-3 h-3" />{emError}</p>}
                    </div>
                    <p className="text-white/25 text-xs">{t('account.confirmationLinkHint')}</p>
                    <button type="submit" disabled={emLoading}
                      className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-purple-500/20 disabled:opacity-60 flex items-center gap-2 rtl:flex-row-reverse">
                      {emLoading ? <><Loader2 className="w-4 h-4 animate-spin" />{t('auth.sending')}</> : t('account.sendConfirmation')}
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
/* My Licenses (FSTH license server) — self-contained section                  */
/* -------------------------------------------------------------------------- */
interface UserLicense {
  id: string;
  licenseKey: string;
  productId: string;
  productName: string;
  productImage: string | null;
  productSlug: string | null;
  planTier: string;
  type: 'lifetime' | 'subscription';
  status: 'active' | 'revoked' | 'expired' | 'past_due';
  machineLimit: number;
  expiresAt: string | null;
  activations: Array<{
    id: string; machineName: string | null; os: string | null;
    appVersion: string | null; lastSeenAt: string; activatedAt: string;
  }>;
}

function MyLicensesSection({ token }: { token: string | undefined }) {
  const { t } = useTranslation();
  const [licenses, setLicenses] = useState<UserLicense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  // Post-checkout banner: ?purchase=success|failed (set via Gumroad redirect URL)
  const [purchaseFlag, setPurchaseFlag] = useState<'success' | 'failed' | null>(null);
  const [awaitingLicense, setAwaitingLicense] = useState(false);

  const load = async () => {
    if (!token) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/user/licenses`, {
        headers: { Authorization: `Bearer ${publicAnonKey}`, 'X-User-Token': token },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load licenses');
      setLicenses(data.licenses ?? []);
      return (data.licenses ?? []).length as number;
    } catch (e: any) {
      setError(e.message || 'Could not load your licenses.');
      return 0;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [token]);

  // On mount, read ?purchase= from the URL. On success, poll for the new license
  // (the webhook creates it asynchronously, usually within a few seconds).
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const flag = params.get('purchase');
    if (flag === 'success' || flag === 'failed') {
      setPurchaseFlag(flag);
      // Clean the URL so a refresh doesn't re-show the banner.
      const url = new URL(window.location.href);
      url.searchParams.delete('purchase');
      window.history.replaceState({}, '', url.toString());

      if (flag === 'success' && token) {
        setAwaitingLicense(true);
        const before = licenses.length;
        let tries = 0;
        const poll = async () => {
          tries++;
          const count = await load();
          if ((count ?? 0) > before || tries >= 5) {
            setAwaitingLicense(false);
            return;
          }
          setTimeout(poll, 2500);
        };
        setTimeout(poll, 1500);
      }
    }
    /* eslint-disable-next-line */
  }, [token]);

  const deactivate = async (licenseKey: string, activationId: string) => {
    if (!token) return;
    setBusy(activationId);
    try {
      const res = await fetch(`${API_BASE}/user/licenses/deactivate`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${publicAnonKey}`, 'X-User-Token': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ license_key: licenseKey, activation_id: activationId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to deactivate');
      await load();
    } catch (e) {
      console.error('deactivate failed:', e);
    } finally {
      setBusy(null);
    }
  };

  const copyKey = (key: string) => {
    navigator.clipboard.writeText(key);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const fmtDate = (d: string | null) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

  const STATUS = {
    active:   { label: 'Active',   cls: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30' },
    expired:  { label: 'Expired',  cls: 'text-white/40 bg-white/8 border-white/15' },
    revoked:  { label: 'Revoked',  cls: 'text-red-300 bg-red-500/15 border-red-500/30' },
    past_due: { label: 'Past due', cls: 'text-amber-300 bg-amber-500/15 border-amber-500/30' },
  } as const;

  // Hide the whole section if the user has no FSTH licenses AND there's no
  // post-checkout banner to show (keeps the page clean for non-buyers).
  if (!loading && !error && licenses.length === 0 && !purchaseFlag) return null;

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }} className="mt-10">
      {/* Post-checkout banner */}
      {purchaseFlag === 'success' && (
        <GlassCard className="p-4 mb-5 border border-emerald-500/25 bg-emerald-500/8">
          <div className="flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-emerald-200 text-sm font-semibold">Payment successful — thank you!</p>
              <p className="text-emerald-300/60 text-xs mt-0.5">
                {awaitingLicense
                  ? 'Your license is being issued and will appear below in a few seconds. We also emailed it to you.'
                  : 'Your license is ready below and on its way to your email.'}
              </p>
            </div>
            {awaitingLicense && <Loader2 className="w-4 h-4 text-emerald-400 animate-spin ml-auto flex-shrink-0" />}
          </div>
        </GlassCard>
      )}
      {purchaseFlag === 'failed' && (
        <GlassCard className="p-4 mb-5 border border-red-500/25 bg-red-500/8">
          <div className="flex items-start gap-3">
            <XCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-200 text-sm font-semibold">Payment was not completed</p>
              <p className="text-red-300/60 text-xs mt-0.5">No charge was made. You can try again from the tool page anytime.</p>
            </div>
          </div>
        </GlassCard>
      )}

      <div className="flex items-center gap-3 mb-5">
        <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
          <KeyRound className="w-4 h-4 text-purple-400" />
        </div>
        <h2 className="text-xl font-bold text-white">{t('account.myLicenses', { defaultValue: 'My Licenses' })}</h2>
        {!loading && (
          <button onClick={load} className="ml-auto p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white/70 transition-colors" title="Refresh">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {loading && (
        <GlassCard className="p-6 flex items-center justify-center gap-2 text-white/40 text-sm">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading your licenses…
        </GlassCard>
      )}
      {error && !loading && (
        <GlassCard className="p-4 text-red-400/70 text-sm">{error}</GlassCard>
      )}

      {!loading && !error && (
        <div className="space-y-4">
          {licenses.map((l) => {
            const st = STATUS[l.status] ?? STATUS.expired;
            return (
              <GlassCard key={l.id} className="p-5">
                <div className="flex items-start gap-4">
                  {/* Tool thumbnail */}
                  {l.productImage ? (
                    <img src={l.productImage} alt={l.productName} className="w-12 h-12 rounded-lg object-cover border border-white/10 flex-shrink-0" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center flex-shrink-0">
                      <Package className="w-5 h-5 text-white/20" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <h3 className="text-white font-bold text-base leading-tight">{l.productName}</h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-bold border border-purple-500/30 bg-purple-500/15 text-purple-300 capitalize">{l.planTier}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${st.cls}`}>{st.label}</span>
                    </div>
                    <p className="text-white/40 text-xs flex items-center gap-3">
                      <span className="inline-flex items-center gap-1">
                        {l.type === 'lifetime'
                          ? <><CheckCircle className="w-3 h-3 text-amber-400/70" /> Lifetime</>
                          : <><Clock className="w-3 h-3 text-sky-400/70" /> Renews · expires {fmtDate(l.expiresAt)}</>}
                      </span>
                    </p>
                  </div>
                </div>

                {/* License key */}
                {l.licenseKey && (
                  <button
                    type="button"
                    onClick={() => copyKey(l.licenseKey)}
                    className="mt-3 w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-black/40 border border-white/10 hover:border-purple-400/30 transition-colors group"
                  >
                    <span className="font-mono text-sm text-purple-300">{l.licenseKey}</span>
                    {copied === l.licenseKey ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-white/30 group-hover:text-white/60" />}
                  </button>
                )}

                {/* Machines */}
                <div className="mt-4">
                  <p className="text-[11px] uppercase tracking-wider text-white/35 mb-2">
                    Machines · {l.activations.length}/{l.machineLimit}
                  </p>
                  {l.activations.length === 0 ? (
                    <p className="text-white/30 text-xs italic">Not activated on any machine yet.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {l.activations.map((a) => (
                        <div key={a.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-white/3 border border-white/8">
                          <div className="min-w-0">
                            <p className="text-white/80 text-sm truncate">{a.machineName || 'Unnamed machine'}</p>
                            <p className="text-white/30 text-[11px]">
                              {[a.os, a.appVersion].filter(Boolean).join(' · ')}
                              {a.lastSeenAt ? ` · last seen ${fmtDate(a.lastSeenAt)}` : ''}
                            </p>
                          </div>
                          <button
                            type="button"
                            disabled={busy === a.id}
                            onClick={() => deactivate(l.licenseKey, a.id)}
                            className="flex-shrink-0 px-2.5 py-1 rounded-md text-xs font-medium text-white/50 hover:text-red-300 hover:bg-red-500/10 border border-white/10 hover:border-red-500/30 transition-colors disabled:opacity-40"
                          >
                            {busy === a.id ? 'Removing…' : 'Deactivate'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-white/25 text-[11px] mt-2">
                    Deactivate a machine to free a seat, then re-enter your key in the extension on the new machine.
                  </p>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

/* -------------------------------------------------------------------------- */
/* Main Account page                                                           */
/* -------------------------------------------------------------------------- */
export function Account() {
  const { t, i18n } = useTranslation();
  const { user, session, loading, signInWithEmail, signUpWithEmail, signInWithOAuth, forgotPassword, updatePassword, updateEmail, signOut } = useUserAuth();
  const navigate = useNavigate();

  const [purchases,        setPurchases]        = useState<Purchase[]>([]);
  const [purchasesLoading, setPurchasesLoading] = useState(false);
  const [purchasesError,   setPurchasesError]   = useState('');
  const [supportOpen,      setSupportOpen]      = useState(false);

  const [downloads,        setDownloads]        = useState<FreeDownload[]>([]);
  const [downloadsLoading, setDownloadsLoading] = useState(false);
  const [downloadsError,   setDownloadsError]   = useState('');

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

  const didSync        = useRef(false);

  useEffect(() => {
    if (session?.access_token) {
      // On first login, auto-sync orphan purchases then fetch
      if (!didSync.current) {
        didSync.current = true;
        syncAndFetch(session.access_token);
      } else {
        fetchPurchases(session.access_token);
        fetchDownloads(session.access_token);
      }
    }
  }, [session]);

  const syncAndFetch = async (token: string) => {
    // Loads licenses + reviews + downloads in parallel. (The old LS orphan-
    // purchase sync was removed — FSTH licenses are auto-matched by email.)
    await Promise.all([fetchPurchases(token), fetchUserReviews(token), fetchDownloads(token)]);
  };

  const fetchDownloads = async (token: string) => {
    setDownloadsLoading(true); setDownloadsError('');
    try {
      const res  = await fetch(`${API_BASE}/user/downloads`, {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'X-User-Token': token,
        },
      });
      const data = await res.json();
      if (data.success) {
        setDownloads(data.data || []);
      } else {
        setDownloadsError(data.error || 'Failed to load downloads');
      }
    } catch (err) {
      console.error('Error fetching downloads:', err);
      setDownloadsError('Could not load your downloads. Please try again.');
    } finally {
      setDownloadsLoading(false);
    }
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

  // Load the user's FSTH licenses and project them onto the Purchase shape so
  // the existing stats bar (activeCount / lifetimeCount / subscriptionCount)
  // keeps working from real license data. The old Lemon Squeezy /user/purchases
  // endpoint is gone; everything below is driven by /user/licenses.
  const fetchPurchases = async (token: string) => {
    setPurchasesLoading(true); setPurchasesError('');
    try {
      const res = await fetch(`${API_BASE}/user/licenses`, {
        headers: { Authorization: `Bearer ${publicAnonKey}`, 'X-User-Token': token },
      });
      const data = await res.json();
      if (data.success) {
        const mapped: Purchase[] = (data.licenses || []).map((l: any): Purchase => ({
          id:                  l.id,
          productName:         l.productName || '',
          variantName:         l.planTier || '',
          licenseKey:          l.licenseKey || '',
          status:              (l.status === 'active' || l.status === 'past_due') ? 'active'
                                : l.status === 'revoked' ? 'cancelled'
                                : 'expired',
          amount:              0,
          currency:            'USD',
          purchasedAt:         l.createdAt || '',
          expiresAt:           l.expiresAt || null,
          lemonSqueezyOrderId: '',
          toolVersions:        null,
        }));
        setPurchases(mapped);
      } else {
        setPurchasesError(data.error || 'Failed to load licenses');
      }
    } catch (err) {
      console.error('Error fetching licenses:', err);
      setPurchasesError('Could not load your licenses. Please try again.');
    } finally {
      setPurchasesLoading(false);
    }
  };

  const handleSignOut    = async () => { await signOut(); navigate('/tools'); };

  const handleSignInEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!authEmail.trim()) errs.email = t('auth.emailRequired'); else if (!/\S+@\S+/.test(authEmail)) errs.email = t('auth.invalidEmail');
    if (!authPass) errs.password = t('auth.passwordRequired');
    setAuthErrors(errs); if (Object.keys(errs).length) return;
    setAuthLoading(true);
    try { await signInWithEmail(authEmail.trim(), authPass); }
    catch (err: any) { setAuthErrors({ form: err.message || t('auth.invalidEmailOrPassword') }); }
    finally { setAuthLoading(false); }
  };

  const handleSignUpEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs: Record<string, string> = {};
    if (!authEmail.trim()) errs.email = t('auth.emailRequired'); else if (!/\S+@\S+/.test(authEmail)) errs.email = t('auth.invalidEmail');
    if (!authPass) errs.password = t('auth.passwordRequired'); else if (authPass.length < 8) errs.password = t('auth.atLeast8');
    if (authPass !== authConfirm) errs.confirm = t('auth.passwordsDoNotMatch');
    setAuthErrors(errs); if (Object.keys(errs).length) return;
    setAuthLoading(true);
    try { await signUpWithEmail(authEmail.trim(), authPass, authName.trim() || undefined); setAuthSuccess(true); }
    catch (err: any) { setAuthErrors({ form: err.message || t('auth.failedCreateAccount') }); }
    finally { setAuthLoading(false); }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthErrors({});
    if (!authEmail.trim() || !/\S+@\S+/.test(authEmail)) { setAuthErrors({ email: t('auth.validEmailRequired') }); return; }
    setAuthLoading(true);
    try { await forgotPassword(authEmail.trim()); setFpSent(true); }
    catch (err: any) { setAuthErrors({ form: err.message || t('auth.failedSendReset') }); }
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
                {authTab === 'forgot' ? t('auth.resetPassword') : t('account.title')}
              </h1>
              <p className="text-white/40 text-xs">
                {authTab === 'forgot' ? t('auth.secureLink') : t('account.subtitle')}
              </p>
            </div>

            {/* Tab switcher — hidden on forgot panel */}
            {authTab !== 'forgot' && (
              <div className="mx-6 mb-5 flex rounded-xl bg-white/5 border border-white/8 p-1">
                {(['signin', 'signup'] as const).map(tab => (
                  <button key={tab} onClick={() => { setAuthTab(tab); setAuthErrors({}); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${authTab === tab ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'text-white/40 hover:text-white/70'}`}>
                    {tab === 'signin' ? t('auth.signInTab') : t('auth.createAccountTab')}
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
                          <span>{t('auth.continueWith', { provider: p.charAt(0).toUpperCase() + p.slice(1) })}</span>
                        </button>
                      ))}
                    </div>
                    {oauthError && <p className="text-xs text-red-400 flex items-center gap-1 rtl:flex-row-reverse"><AlertCircle className="w-3 h-3 shrink-0"/>{oauthError}</p>}
                    <div className="flex items-center gap-3"><div className="flex-1 h-px bg-white/8"/><span className="text-white/25 text-xs">{t('auth.or')}</span><div className="flex-1 h-px bg-white/8"/></div>

                    <form onSubmit={handleSignInEmail} className="space-y-3">
                    <div className={`relative flex items-center rounded-xl border transition-colors ${authErrors.email ? 'border-red-500/50 bg-red-500/5' : 'border-white/10 bg-white/5 focus-within:border-purple-500/50'}`}>
                      <Mail className="absolute left-3.5 rtl:left-auto rtl:right-3.5 w-4 h-4 text-white/30 pointer-events-none" />
                      <input type="email" placeholder={t('auth.emailLabel')} value={authEmail} autoComplete="email" onChange={e => setAuthEmail(e.target.value)} className="w-full bg-transparent pl-10 rtl:pl-4 rtl:pr-10 pr-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none" />
                    </div>
                    {authErrors.email && <p className="text-xs text-red-400 -mt-1 flex items-center gap-1 rtl:flex-row-reverse"><AlertCircle className="w-3 h-3"/>{authErrors.email}</p>}
                    <div>
                      <div className={`relative flex items-center rounded-xl border transition-colors ${authErrors.password ? 'border-red-500/50 bg-red-500/5' : 'border-white/10 bg-white/5 focus-within:border-purple-500/50'}`}>
                        <Lock className="absolute left-3.5 rtl:left-auto rtl:right-3.5 w-4 h-4 text-white/30 pointer-events-none" />
                        <input type={authShowPw ? 'text' : 'password'} placeholder={t('auth.passwordLabel')} value={authPass} autoComplete="current-password" onChange={e => setAuthPass(e.target.value)} className="w-full bg-transparent pl-10 rtl:pl-3 rtl:pr-10 pr-10 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none" />
                        <button type="button" onClick={() => setAuthShowPw(v => !v)} className="absolute right-3 rtl:right-auto rtl:left-3 text-white/25 hover:text-white/60 transition-colors">
                          {authShowPw ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                        </button>
                      </div>
                      <div className="flex justify-end rtl:justify-start mt-1.5">
                        <button type="button" onClick={() => { setAuthTab('forgot'); setAuthErrors({}); setFpSent(false); }} className="text-xs text-purple-400 hover:text-purple-300 transition-colors">{t('auth.forgotPassword')}</button>
                      </div>
                    </div>
                    {authErrors.password && <p className="text-xs text-red-400 -mt-1 flex items-center gap-1 rtl:flex-row-reverse"><AlertCircle className="w-3 h-3"/>{authErrors.password}</p>}
                    {authErrors.form && <div className="flex items-center gap-2 rtl:flex-row-reverse p-3 rounded-xl bg-red-500/10 border border-red-500/20"><AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" /><p className="text-red-400 text-xs">{authErrors.form}</p></div>}
                    <button type="submit" disabled={authLoading || !!oauthLoading} className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-purple-500/20 disabled:opacity-60 flex items-center justify-center gap-2 rtl:flex-row-reverse">
                      {authLoading ? <><Loader2 className="w-4 h-4 animate-spin"/>{t('auth.signingIn')}</> : t('auth.signInTab')}
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
                            <span>{t('auth.signUpWith', { provider: p.charAt(0).toUpperCase() + p.slice(1) })}</span>
                          </button>
                        ))}
                      </div>
                      {oauthError && <p className="text-xs text-red-400 flex items-center gap-1 rtl:flex-row-reverse"><AlertCircle className="w-3 h-3 shrink-0"/>{oauthError}</p>}
                      <div className="flex items-center gap-3"><div className="flex-1 h-px bg-white/8"/><span className="text-white/25 text-xs">{t('auth.or')}</span><div className="flex-1 h-px bg-white/8"/></div>
                    </>)}
                    <form onSubmit={handleSignUpEmail} className="space-y-3">
                    {authSuccess ? (
                      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-8 text-center">
                        <div className="w-12 h-12 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto mb-3"><Check className="w-6 h-6 text-emerald-400" /></div>
                        <p className="text-white font-semibold">{t('auth.accountCreated')}</p>
                        <p className="text-white/45 text-xs mt-1">{t('auth.signingYouIn')}</p>
                      </motion.div>
                    ) : (
                      <>
                        <div className="relative flex items-center rounded-xl border border-white/10 bg-white/5 focus-within:border-purple-500/50 transition-colors">
                          <User className="absolute left-3.5 rtl:left-auto rtl:right-3.5 w-4 h-4 text-white/30 pointer-events-none" />
                          <input type="text" placeholder={t('auth.fullNameOptional')} value={authName} autoComplete="name" onChange={e => setAuthName(e.target.value)} className="w-full bg-transparent pl-10 rtl:pl-4 rtl:pr-10 pr-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none" />
                        </div>
                        <div className={`relative flex items-center rounded-xl border transition-colors ${authErrors.email ? 'border-red-500/50 bg-red-500/5' : 'border-white/10 bg-white/5 focus-within:border-purple-500/50'}`}>
                          <Mail className="absolute left-3.5 rtl:left-auto rtl:right-3.5 w-4 h-4 text-white/30 pointer-events-none" />
                          <input type="email" placeholder={t('auth.emailLabel')} value={authEmail} autoComplete="email" onChange={e => setAuthEmail(e.target.value)} className="w-full bg-transparent pl-10 rtl:pl-4 rtl:pr-10 pr-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none" />
                        </div>
                        {authErrors.email && <p className="text-xs text-red-400 -mt-1 flex items-center gap-1 rtl:flex-row-reverse"><AlertCircle className="w-3 h-3"/>{authErrors.email}</p>}
                        <div className={`relative flex items-center rounded-xl border transition-colors ${authErrors.password ? 'border-red-500/50 bg-red-500/5' : 'border-white/10 bg-white/5 focus-within:border-purple-500/50'}`}>
                          <Lock className="absolute left-3.5 rtl:left-auto rtl:right-3.5 w-4 h-4 text-white/30 pointer-events-none" />
                          <input type={authShowPw ? 'text' : 'password'} placeholder={t('auth.passwordMin8')} value={authPass} autoComplete="new-password" onChange={e => setAuthPass(e.target.value)} className="w-full bg-transparent pl-10 rtl:pl-3 rtl:pr-10 pr-10 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none" />
                          <button type="button" onClick={() => setAuthShowPw(v => !v)} className="absolute right-3 rtl:right-auto rtl:left-3 text-white/25 hover:text-white/60 transition-colors">
                            {authShowPw ? <EyeOff className="w-4 h-4"/> : <Eye className="w-4 h-4"/>}
                          </button>
                        </div>
                        {authErrors.password && <p className="text-xs text-red-400 -mt-1 flex items-center gap-1 rtl:flex-row-reverse"><AlertCircle className="w-3 h-3"/>{authErrors.password}</p>}
                        <div className={`relative flex items-center rounded-xl border transition-colors ${authErrors.confirm ? 'border-red-500/50 bg-red-500/5' : 'border-white/10 bg-white/5 focus-within:border-purple-500/50'}`}>
                          <Lock className="absolute left-3.5 rtl:left-auto rtl:right-3.5 w-4 h-4 text-white/30 pointer-events-none" />
                          <input type="password" placeholder={t('auth.confirmPassword')} value={authConfirm} autoComplete="new-password" onChange={e => setAuthConfirm(e.target.value)} className="w-full bg-transparent pl-10 rtl:pl-4 rtl:pr-10 pr-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none" />
                        </div>
                        {authErrors.confirm && <p className="text-xs text-red-400 -mt-1 flex items-center gap-1 rtl:flex-row-reverse"><AlertCircle className="w-3 h-3"/>{authErrors.confirm}</p>}
                        {authErrors.form && <div className="flex items-center gap-2 rtl:flex-row-reverse p-3 rounded-xl bg-red-500/10 border border-red-500/20"><AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" /><p className="text-red-400 text-xs">{authErrors.form}</p></div>}
                        <button type="submit" disabled={authLoading || !!oauthLoading} className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-purple-500/20 disabled:opacity-60 flex items-center justify-center gap-2 rtl:flex-row-reverse">
                          {authLoading ? <><Loader2 className="w-4 h-4 animate-spin"/>{t('auth.creatingAccount')}</> : t('auth.createAccountTab')}
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
                          <p className="text-white font-semibold mb-1">{t('auth.checkYourInbox')}</p>
                          <p className="text-white/40 text-xs leading-relaxed">{t('auth.resetLinkSentPre')} <span className="text-purple-300">{authEmail}</span>. {t('auth.resetLinkSentPost')}</p>
                        </div>
                        <button type="button" onClick={() => setAuthTab('signin')} className="flex items-center gap-1.5 rtl:flex-row-reverse mx-auto text-xs text-white/40 hover:text-white/70 transition-colors">
                          <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />{t('auth.backToSignIn')}
                        </button>
                      </div>
                    ) : (
                      <form onSubmit={handleForgotPassword} className="space-y-3">
                        <div className={`relative flex items-center rounded-xl border transition-colors ${authErrors.email ? 'border-red-500/50 bg-red-500/5' : 'border-white/10 bg-white/5 focus-within:border-purple-500/50'}`}>
                          <Mail className="absolute left-3.5 rtl:left-auto rtl:right-3.5 w-4 h-4 text-white/30 pointer-events-none" />
                          <input type="email" placeholder={t('auth.yourAccountEmail')} value={authEmail} autoComplete="email" onChange={e => setAuthEmail(e.target.value)} className="w-full bg-transparent pl-10 rtl:pl-4 rtl:pr-10 pr-4 py-3 text-sm text-white placeholder:text-white/25 focus:outline-none" />
                        </div>
                        {authErrors.email && <p className="text-xs text-red-400 -mt-1 flex items-center gap-1 rtl:flex-row-reverse"><AlertCircle className="w-3 h-3"/>{authErrors.email}</p>}
                        {authErrors.form && <div className="flex items-center gap-2 rtl:flex-row-reverse p-3 rounded-xl bg-red-500/10 border border-red-500/20"><AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" /><p className="text-red-400 text-xs">{authErrors.form}</p></div>}
                        <button type="submit" disabled={authLoading} className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold text-sm transition-all shadow-lg shadow-purple-500/20 disabled:opacity-60 flex items-center justify-center gap-2 rtl:flex-row-reverse">
                          {authLoading ? <><Loader2 className="w-4 h-4 animate-spin"/>{t('auth.sending')}</> : t('auth.sendResetLink')}
                        </button>
                        <button type="button" onClick={() => setAuthTab('signin')} className="flex items-center gap-1.5 rtl:flex-row-reverse mx-auto text-xs text-white/35 hover:text-white/65 transition-colors pt-1">
                          <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />{t('auth.backToSignIn')}
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
  const downloadsCount    = downloads.length;

  return (
    <>
    <div className="min-h-screen pt-8 pb-28">
      <div className="max-w-3xl mx-auto px-6">

        <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}>
          <Link to="/tools" className="inline-flex items-center gap-1.5 rtl:flex-row-reverse text-sm text-white/40 hover:text-white/80 transition-colors mb-10">
            <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />{t('account.backToTools')}
          </Link>
        </motion.div>

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
                      <Star className="w-2.5 h-2.5" />{t('account.memberBadge')}
                    </span>
                  </div>
                </div>
                <button onClick={handleSignOut} className="flex items-center gap-2 rtl:flex-row-reverse px-4 py-2 rounded-xl text-sm text-white/50 hover:text-white/80 border border-white/10 hover:border-white/20 bg-white/5 hover:bg-white/8 transition-all">
                  <LogOut className="w-4 h-4" />{t('nav.signOut')}
                </button>
              </div>

              {/* Stats row */}
              <div className="mt-5 pt-5 border-t border-white/8 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                {[
                  { label: t('account.activeLicenses'),      value: activeCount,                 icon: <Key className="w-3.5 h-3.5" />,         color: 'text-white',       glow: '' },
                  { label: t('account.lifetimeLabel'),        value: lifetimeCount,               icon: <CheckCircle className="w-3.5 h-3.5" />, color: 'text-emerald-400', glow: 'drop-shadow-[0_0_6px_rgba(52,211,153,0.5)]' },
                  { label: t('account.subscriptionsLabel'),   value: subscriptionCount,           icon: <RefreshCw className="w-3.5 h-3.5" />,   color: 'text-purple-400',  glow: 'drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]' },
                  { label: t('account.freeDownloadsLabel'),   value: downloadsCount,              icon: <Gift className="w-3.5 h-3.5" />,        color: 'text-teal-400',    glow: 'drop-shadow-[0_0_6px_rgba(45,212,191,0.5)]' },
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


        {/* ── My Licenses (FSTH) ── */}
        <MyLicensesSection token={session?.access_token} />

        {/* ── My Downloads ── */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="mt-10">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/15 border border-teal-500/25 flex items-center justify-center">
              <Gift className="w-4 h-4 text-teal-400" />
            </div>
            <h2 className="text-xl font-bold text-white">{t('account.myDownloads')}</h2>
            {downloads.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-teal-500/20 text-teal-300 border border-teal-500/30">{downloads.length}</span>
            )}
          </div>

          {downloadsLoading && (
            <div className="flex items-center gap-3 py-16 justify-center">
              <div className="w-5 h-5 border-2 border-teal-400/40 border-t-teal-400 rounded-full animate-spin" />
              <span className="text-white/40 text-sm">{t('account.loadingDownloads')}</span>
            </div>
          )}

          {downloadsError && !downloadsLoading && (
            <GlassCard className="p-6 border border-red-500/20 bg-red-500/5">
              <div className="flex items-start gap-3 rtl:flex-row-reverse">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-400 text-sm font-semibold mb-1">{t('account.couldNotLoadDownloads')}</p>
                  <p className="text-red-400/60 text-xs">{downloadsError}</p>
                  <button onClick={() => session && fetchDownloads(session.access_token)} className="mt-3 text-sm text-teal-400 hover:text-teal-300 underline">
                    {t('account.tryAgain')}
                  </button>
                </div>
              </div>
            </GlassCard>
          )}

          {!downloadsLoading && !downloadsError && downloads.length === 0 && (
            <GlassCard className="overflow-hidden">
              <div className="p-14 text-center">
                <div className="relative w-16 h-16 mx-auto mb-5">
                  <div className="absolute inset-0 rounded-full bg-teal-500/15 blur-2xl" />
                  <div className="relative w-16 h-16 rounded-full border border-teal-500/20 bg-teal-500/8 flex items-center justify-center">
                    <Gift className="w-7 h-7 text-white/15" />
                  </div>
                </div>
                <h3 className="text-white/70 font-bold text-lg mb-2">{t('account.noDownloads')}</h3>
                <p className="text-white/30 text-sm max-w-xs mx-auto leading-relaxed">{t('account.noDownloadsDesc')}</p>
                <div className="flex justify-center mt-6">
                  <NeonButton href="/tools" variant="primary">
                    <Sparkles className="w-4 h-4 mr-2 rtl:mr-0 rtl:ml-2" />{t('account.browseTools')}
                  </NeonButton>
                </div>
              </div>
            </GlassCard>
          )}

          {!downloadsLoading && downloads.length > 0 && (
            <div className="space-y-4">
              {downloads.map((dl, i) => (
                <DownloadCard key={`${dl.toolVersionId}-${i}`} item={dl} index={i} />
              ))}
            </div>
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