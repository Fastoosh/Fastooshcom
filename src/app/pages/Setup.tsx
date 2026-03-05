import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2, XCircle, AlertCircle, Loader2,
  Shield, Palette, Database, PartyPopper,
  ChevronRight, ChevronLeft, Eye, EyeOff,
  ExternalLink, RefreshCw, Terminal, Users2, Copy, Check,
} from 'lucide-react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGoogle, faDiscord } from '@fortawesome/free-brands-svg-icons';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import sampleData from './setupSeedData';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

// ─── Types ────────────────────────────────────────────────────────────────────

type EnvStatus = 'loading' | 'ok' | 'missing';

interface EnvVar {
  key: string;
  label: string;
  required: boolean;
  hint: string;
  docUrl: string;
  status: EnvStatus;
}

const ENV_DEFS: Omit<EnvVar, 'status'>[] = [
  { key: 'SUPABASE_URL',               label: 'Supabase URL',                required: true,  hint: 'Auto-injected by Supabase Edge Functions.', docUrl: 'https://supabase.com/dashboard/project/_/settings/api' },
  { key: 'SUPABASE_ANON_KEY',          label: 'Supabase Anon Key',           required: true,  hint: 'Auto-injected by Supabase Edge Functions.', docUrl: 'https://supabase.com/dashboard/project/_/settings/api' },
  { key: 'SUPABASE_SERVICE_ROLE_KEY',  label: 'Supabase Service Role Key',   required: true,  hint: 'Auto-injected by Supabase Edge Functions.', docUrl: 'https://supabase.com/dashboard/project/_/settings/api' },
  { key: 'RESEND_API_KEY',             label: 'Resend API Key',              required: true,  hint: 'Transactional emails, security alerts & password-reset emails.', docUrl: 'https://resend.com/api-keys' },
  { key: 'GEMINI_API_KEY',             label: 'Gemini AI API Key',           required: true,  hint: 'Powers AI content generation & auto-translation in the admin panel.', docUrl: 'https://aistudio.google.com/app/apikey' },
  { key: 'VIMEO_ACCESS_TOKEN',         label: 'Vimeo Access Token',          required: false, hint: 'Required for the Vimeo video picker in the admin media gallery.', docUrl: 'https://developer.vimeo.com/apps' },
  { key: 'LEMON_SQUEEZY_API_KEY',      label: 'Lemon Squeezy API Key',       required: false, hint: 'Required only if you sell tools via Lemon Squeezy.', docUrl: 'https://app.lemonsqueezy.com/settings/api' },
  { key: 'LEMON_SQUEEZY_WEBHOOK_SECRET', label: 'Lemon Squeezy Webhook Secret', required: false, hint: 'Required only if you sell tools via Lemon Squeezy.', docUrl: 'https://app.lemonsqueezy.com/settings/webhooks' },
];

const STEPS = [
  { id: 'welcome', label: 'Welcome',        icon: PartyPopper  },
  { id: 'env',     label: 'API Keys',       icon: Terminal     },
  { id: 'oauth',   label: 'OAuth',          icon: Users2       },
  { id: 'admin',   label: 'Admin Account',  icon: Shield       },
  { id: 'brand',   label: 'Brand Basics',   icon: Palette      },
  { id: 'seed',    label: 'Sample Data',    icon: Database     },
  { id: 'done',    label: 'Done',           icon: CheckCircle2 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const authHeaders = { Authorization: `Bearer ${publicAnonKey}` };

async function apiGet(path: string) {
  const r = await fetch(`${API_BASE}${path}`, { headers: authHeaders });
  return r.json();
}

async function apiPost(path: string, body: object) {
  const r = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { ...authHeaders, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return r.json();
}

// ─── Small components ─────────────────────────────────────────────────────────

function StepDot({ index, current, label, Icon }: { index: number; current: number; label: string; Icon: any }) {
  const done   = index < current;
  const active = index === current;
  return (
    <div className="flex flex-col items-center gap-1 min-w-[48px]">
      <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 ${
        done   ? 'bg-violet-600 border-violet-600' :
        active ? 'bg-violet-600/20 border-violet-500' :
                 'bg-white/5 border-white/10'
      }`}>
        {done
          ? <CheckCircle2 className="w-4 h-4 text-white" />
          : <Icon className={`w-4 h-4 ${active ? 'text-violet-400' : 'text-white/30'}`} />}
      </div>
      <span className={`text-[9px] font-medium hidden sm:block ${
        active ? 'text-violet-400' : done ? 'text-white/60' : 'text-white/25'
      }`}>{label}</span>
    </div>
  );
}

function EnvRow({ v }: { v: EnvVar }) {
  const icon = v.status === 'loading'
    ? <Loader2 className="w-4 h-4 text-white/30 animate-spin" />
    : v.status === 'ok'
      ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
      : v.required
        ? <XCircle className="w-4 h-4 text-red-400" />
        : <AlertCircle className="w-4 h-4 text-amber-400" />;
  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl border transition-colors ${
      v.status === 'ok'                       ? 'bg-emerald-500/5 border-emerald-500/20'  :
      v.status === 'missing' && v.required    ? 'bg-red-500/5 border-red-500/20'          :
      v.status === 'missing'                  ? 'bg-amber-500/5 border-amber-500/20'      :
                                                'bg-white/5 border-white/10'
    }`}>
      <div className="shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{v.label}
          {!v.required && <span className="ml-2 text-[10px] text-white/30 font-normal">optional</span>}
        </p>
        <p className="text-xs text-white/40 truncate">{v.hint}</p>
      </div>
      <a href={v.docUrl} target="_blank" rel="noreferrer"
        className="shrink-0 p-1.5 rounded-lg hover:bg-white/10 transition-colors">
        <ExternalLink className="w-3.5 h-3.5 text-white/30" />
      </a>
    </div>
  );
}

function CopyBox({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };
  return (
    <div className="flex items-center gap-2 rounded-xl bg-black/40 border border-white/10 px-3 py-2.5">
      {label && <span className="text-[10px] text-white/30 shrink-0 font-medium">{label}</span>}
      <code className="flex-1 text-xs text-purple-300/90 font-mono truncate">{value}</code>
      <button onClick={copy} className="shrink-0 text-white/30 hover:text-purple-400 transition-colors">
        {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function Setup() {
  const navigate = useNavigate();
  const [step,    setStep]    = useState(0);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');

  // Env step
  const [envVars,    setEnvVars]    = useState<EnvVar[]>(ENV_DEFS.map(d => ({ ...d, status: 'loading' as EnvStatus })));
  const [envChecked, setEnvChecked] = useState(false);

  // OAuth step
  const [oauthGoogle,  setOauthGoogle]  = useState(false);
  const [oauthDiscord, setOauthDiscord] = useState(false);

  // Admin step
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPass,  setAdminPass]  = useState('');
  const [adminPass2, setAdminPass2] = useState('');
  const [showPass,   setShowPass]   = useState(false);
  const [adminDone,  setAdminDone]  = useState(false);

  // Brand step
  const [brand, setBrand] = useState({
    studioName: '', contactEmail: '', siteUrl: '', calendlyUrl: '',
    showreelUrl: '', instagram: '', linkedin: '', twitter: '', tiktok: '',
    behance: '', dribbble: '',
  });

  // Seed step
  const [seedChoice, setSeedChoice] = useState<'seed' | 'skip' | null>(null);
  const [seedLog,    setSeedLog]    = useState<{ type: 'ok' | 'err' | 'info'; text: string }[]>([]);
  const [seedDone,   setSeedDone]   = useState(false);

  // Derived URLs
  const supabaseCallbackUrl = `https://${projectId}.supabase.co/auth/v1/callback`;
  const appCallbackUrl      = `${window.location.origin}/auth/callback`;

  // ── On mount: if already configured, only allow access when logged in ────
  useEffect(() => {
    apiGet('/setup/status').then(d => {
      if (d.isComplete) {
        const token = localStorage.getItem('admin_token');
        if (!token) navigate('/admin/login');
        // Admin has a valid token → allow access to re-run wizard steps
      }
    }).catch(() => {});
  }, [navigate]);

  // ── Env check ─────────────────────────────────────────────────────────────
  const checkEnv = useCallback(async () => {
    setEnvChecked(false);
    setEnvVars(prev => prev.map(v => ({ ...v, status: 'loading' })));
    try {
      const d = await apiGet('/setup/check-env');
      if (d.success) {
        setEnvVars(ENV_DEFS.map(def => ({
          ...def,
          status: d.vars[def.key] ? 'ok' : 'missing',
        })));
      }
    } catch {
      setEnvVars(prev => prev.map(v => ({ ...v, status: 'missing' })));
    }
    setEnvChecked(true);
  }, []);

  useEffect(() => { if (step === 1) checkEnv(); }, [step, checkEnv]);

  // ── Navigation ─────────────────────────────────────────────────────────────
  const prev = () => { setError(''); setStep(s => Math.max(0, s - 1)); };
  const next = () => { setError(''); setStep(s => Math.min(STEPS.length - 1, s + 1)); };

  // ── Step actions ───────────────────────────────────────────────────────────
  const handleCreateAdmin = async () => {
    setError('');
    if (!adminEmail) return setError('Email is required.');
    if (adminPass.length < 8) return setError('Password must be at least 8 characters.');
    if (adminPass !== adminPass2) return setError('Passwords do not match.');
    setLoading(true);
    try {
      const d = await apiPost('/setup/create-admin', { email: adminEmail, password: adminPass });
      if (!d.success) return setError(d.error || 'Failed to create admin account.');

      // Auto sign-in immediately so subsequent wizard steps (seed) can hit
      // protected endpoints without asking the deployer to log in separately.
      try {
        const loginRes = await fetch(`${API_BASE}/login`, {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: adminEmail, password: adminPass }),
        });
        const loginData = await loginRes.json();
        if (loginData.session?.access_token) {
          localStorage.setItem('admin_token', loginData.session.access_token);
        }
      } catch {
        // Non-fatal — token will be obtained on next manual login
      }

      setAdminDone(true);
      next();
    } catch (e: any) {
      setError(e.message || 'Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveBrand = async () => {
    setLoading(true);
    setError('');
    try {
      const d = await apiPost('/setup/brand', brand);
      if (!d.success) return setError(d.error || 'Failed to save brand settings.');
      next();
    } catch (e: any) {
      setError(e.message || 'Network error.');
    } finally {
      setLoading(false);
    }
  };

  const handleSeed = async () => {
    if (!seedChoice) return;
    if (seedChoice === 'skip') { next(); return; }
    setSeedLog([]);
    setLoading(true);
    setSeedLog(l => [...l, { type: 'info', text: 'Connecting to database…' }]);
    try {
      setSeedLog(l => [...l, { type: 'info', text: `Seeding ${sampleData.projects.length} projects, ${sampleData.tools.length} tools, ${sampleData.team.length} team members…` }]);
      const adminToken = localStorage.getItem('admin_token') || '';
      const initRes = await fetch(`${API_BASE}/init`, {
        method: 'POST',
        headers: {
          ...authHeaders,
          'Content-Type': 'application/json',
          'X-Admin-Token': adminToken,
        },
        body: JSON.stringify({ projects: sampleData.projects, tools: sampleData.tools, team: sampleData.team }),
      });
      const d = await initRes.json();
      if (d.success) {
        const c = d.counts;
        setSeedLog(l => [
          ...l,
          { type: 'ok', text: `✓ ${c.projects} projects inserted` },
          { type: 'ok', text: `✓ ${c.tools} tools inserted` },
          { type: 'ok', text: `✓ ${c.versions} tool versions inserted` },
          { type: 'ok', text: `✓ ${c.team} team members inserted` },
          { type: 'ok', text: `✓ ${c.settings} site settings seeded (incl. 4 legal pages)` },
        ]);
        if (d.errors?.length) {
          d.errors.forEach((e: string) => setSeedLog(l => [...l, { type: 'err', text: e }]));
        }
        setSeedDone(true);
      } else {
        setSeedLog(l => [...l, { type: 'err', text: d.error || 'Unknown error from server.' }]);
      }
    } catch (e: any) {
      setSeedLog(l => [...l, { type: 'err', text: e.message || 'Network error.' }]);
    } finally {
      setLoading(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────
  const requiredEnvOk = envVars.filter(v => v.required).every(v => v.status === 'ok');
  const allEnvOk      = envVars.every(v => v.status === 'ok');

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Background glow */}
      <div className="fixed inset-0 pointer-events-none"
        style={{ background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(124,58,237,0.15) 0%, transparent 70%)' }} />

      <div className="relative flex-1 flex flex-col items-center justify-start py-10 px-4">

        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-violet-500/30 bg-violet-500/10 text-violet-300 text-xs font-medium mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-pulse" />
            Deployment Setup Wizard
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold text-white">Set up your studio site</h1>
          <p className="text-white/40 mt-2 text-sm">Complete these steps once to deploy the app for a new client.</p>
        </div>

        {/* Step progress */}
        <div className="flex items-center gap-1 mb-10 w-full max-w-2xl overflow-x-auto pb-1">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center flex-1 min-w-0">
              <StepDot index={i} current={step} label={s.label} Icon={s.icon} />
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-px mx-0.5 sm:mx-1 transition-colors duration-500 ${i < step ? 'bg-violet-600' : 'bg-white/10'}`} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.25 }}
              className="rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-xl p-8"
            >

              {/* ── STEP 0: Welcome ────────────────────────────────────── */}
              {step === 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                      <PartyPopper className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Welcome to the Setup Wizard</h2>
                      <p className="text-white/40 text-sm">~5 minutes to complete</p>
                    </div>
                  </div>
                  <p className="text-white/60 text-sm leading-relaxed mb-3">
                    This wizard deploys the full Fastoosh studio platform for a new client. It covers
                    API keys (Supabase, Resend, Gemini AI, Vimeo, Lemon Squeezy), OAuth social sign-in,
                    the first admin account, brand basics, and optional sample content seeding.
                  </p>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {['i18n (EN · FR · AR)', 'Vimeo Media Gallery', 'UTM & Traffic Analytics', 'Forgot-Password via Resend', 'Lemon Squeezy Payments', 'Gemini AI Translations', 'Google & Discord OAuth'].map(tag => (
                      <span key={tag} className="text-[10px] font-medium px-2.5 py-1 rounded-full bg-white/5 border border-white/10 text-white/40">{tag}</span>
                    ))}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
                    {[
                      { icon: Terminal,  label: 'Check all API keys',          color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/20' },
                      { icon: Users2,    label: 'Configure OAuth providers',   color: 'text-cyan-400',    bg: 'bg-cyan-500/10',    border: 'border-cyan-500/20' },
                      { icon: Shield,    label: 'Create the admin account',    color: 'text-violet-400',  bg: 'bg-violet-500/10',  border: 'border-violet-500/20' },
                      { icon: Palette,   label: 'Set up brand basics',         color: 'text-pink-400',    bg: 'bg-pink-500/10',    border: 'border-pink-500/20' },
                      { icon: Database,  label: 'Seed sample content',         color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
                    ].map(({ icon: Icon, label, color, bg, border }) => (
                      <div key={label} className={`flex items-center gap-3 p-4 rounded-xl border ${border} ${bg}`}>
                        <Icon className={`w-5 h-5 ${color} shrink-0`} />
                        <span className="text-sm text-white/80">{label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 text-amber-300 text-sm mb-6">
                    <strong>⚠️ One-time only:</strong> This page automatically locks itself once an admin account exists.
                    Run it on a fresh project only.
                  </div>
                  <Button onClick={next} className="w-full h-11 font-semibold text-white"
                    style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                    Get Started <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </div>
              )}

              {/* ── STEP 1: API Key check ───────────────────────────────── */}
              {step === 1 && (
                <div>
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-xl font-bold text-white">API Key Checklist</h2>
                      <p className="text-white/40 text-sm mt-1">Checking Supabase Edge Function secrets…</p>
                    </div>
                    <button onClick={checkEnv}
                      className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/80 transition-colors px-3 py-1.5 rounded-lg hover:bg-white/5">
                      <RefreshCw className="w-3.5 h-3.5" /> Refresh
                    </button>
                  </div>

                  <div className="space-y-2 mb-6">
                    {envVars.map(v => <EnvRow key={v.key} v={v} />)}
                  </div>

                  {envChecked && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className={`p-4 rounded-xl border text-sm mb-6 ${
                        requiredEnvOk
                          ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300'
                          : 'border-red-500/20 bg-red-500/5 text-red-300'
                      }`}>
                      {requiredEnvOk
                        ? allEnvOk
                          ? '✓ All secrets are configured. You\'re good to go!'
                          : '✓ Required secrets are set. Optional ones (Lemon Squeezy) can be added later.'
                        : '✗ One or more required secrets are missing. Add them in Supabase → Edge Functions → Secrets, then click Refresh.'}
                    </motion.div>
                  )}

                  <div className="flex gap-3">
                    <Button onClick={prev} variant="outline" className="h-10 border-white/10 text-white/60 hover:bg-white/5">
                      <ChevronLeft className="w-4 h-4 mr-1" /> Back
                    </Button>
                    <Button onClick={next} disabled={!requiredEnvOk}
                      className="flex-1 h-10 font-semibold text-white disabled:opacity-40"
                      style={requiredEnvOk ? { background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' } : {}}>
                      Continue <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}

              {/* ── STEP 2: OAuth Providers ─────────────────────────────── */}
              {step === 2 && (
                <div>
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg,#0891b2,#7c3aed)' }}>
                      <Users2 className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">OAuth Providers</h2>
                      <p className="text-white/40 text-sm">Enable Google and Discord social sign-in.</p>
                    </div>
                  </div>

                  <p className="text-white/40 text-xs mb-5 leading-relaxed">
                    Both providers are optional — you can skip this step and enable them later in
                    Supabase → Authentication → Providers. Each provider requires an app/project
                    on the provider's portal, and a matching entry in Supabase.
                  </p>

                  {/* Shared callback URL */}
                  <div className="mb-5 p-4 rounded-xl border border-white/10 bg-white/5 space-y-2">
                    <p className="text-xs font-semibold text-white/60 mb-1">
                      Supabase callback URL — paste into <strong>both</strong> provider portals as the Redirect / Authorised URI:
                    </p>
                    <CopyBox value={supabaseCallbackUrl} />
                    <p className="text-xs font-semibold text-white/60 mt-3 mb-1">
                      App callback URL — add this to Supabase → Auth → URL Configuration → Redirect URLs:
                    </p>
                    <CopyBox value={appCallbackUrl} />
                  </div>

                  {/* Google card */}
                  <div className={`rounded-xl border mb-4 transition-all duration-200 overflow-hidden ${
                    oauthGoogle ? 'border-cyan-500/30 bg-cyan-500/5' : 'border-white/10 bg-white/[0.03]'
                  }`}>
                    {/* Header row */}
                    <button
                      className="w-full flex items-center gap-3 p-4 text-left"
                      onClick={() => setOauthGoogle(v => !v)}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                        oauthGoogle ? 'bg-white/10' : 'bg-white/5'
                      }`}>
                        <FontAwesomeIcon icon={faGoogle} className={`text-base ${oauthGoogle ? 'text-cyan-400' : 'text-white/30'}`} />
                      </div>
                      <div className="flex-1">
                        <p className={`font-semibold text-sm ${oauthGoogle ? 'text-white' : 'text-white/50'}`}>Google OAuth</p>
                        <p className="text-xs text-white/30">Sign in with Google account</p>
                      </div>
                      {/* Toggle */}
                      <div className={`w-10 h-5.5 rounded-full transition-colors relative flex items-center ${
                        oauthGoogle ? 'bg-cyan-500' : 'bg-white/10'
                      }`} style={{ minWidth: '40px', height: '22px' }}>
                        <span className={`absolute w-4 h-4 rounded-full bg-white shadow transition-transform ${
                          oauthGoogle ? 'translate-x-5' : 'translate-x-1'
                        }`} />
                      </div>
                    </button>

                    {/* Instructions */}
                    <AnimatePresence>
                      {oauthGoogle && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 space-y-2.5 border-t border-white/10 pt-4">
                            {[
                              { n: 1, text: 'Go to Google Cloud Console → APIs & Services → Credentials', href: 'https://console.cloud.google.com/apis/credentials', linkText: 'Open Console' },
                              { n: 2, text: 'Create an OAuth 2.0 Client ID → Web application' },
                              { n: 3, text: 'Add the Supabase callback URL above as an Authorised redirect URI' },
                              { n: 4, text: 'Copy the Client ID and Client Secret from Google Console' },
                              { n: 5, text: 'In Supabase → Auth → Providers → Google: enable, paste Client ID and Secret', href: `https://supabase.com/dashboard/project/${projectId}/auth/providers`, linkText: 'Open Supabase' },
                            ].map(step => (
                              <div key={step.n} className="flex items-start gap-3">
                                <span className="shrink-0 w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-400 text-[10px] font-bold flex items-center justify-center mt-0.5">{step.n}</span>
                                <p className="text-xs text-white/60 leading-relaxed flex-1">
                                  {step.text}
                                  {step.href && (
                                    <a href={step.href} target="_blank" rel="noreferrer"
                                      className="ml-2 inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors font-medium">
                                      {step.linkText} <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </p>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Discord card */}
                  <div className={`rounded-xl border mb-6 transition-all duration-200 overflow-hidden ${
                    oauthDiscord ? 'border-indigo-500/30 bg-indigo-500/5' : 'border-white/10 bg-white/[0.03]'
                  }`}>
                    {/* Header row */}
                    <button
                      className="w-full flex items-center gap-3 p-4 text-left"
                      onClick={() => setOauthDiscord(v => !v)}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
                        oauthDiscord ? 'bg-white/10' : 'bg-white/5'
                      }`}>
                        <FontAwesomeIcon icon={faDiscord} className={`text-base ${oauthDiscord ? 'text-indigo-400' : 'text-white/30'}`} />
                      </div>
                      <div className="flex-1">
                        <p className={`font-semibold text-sm ${oauthDiscord ? 'text-white' : 'text-white/50'}`}>Discord OAuth</p>
                        <p className="text-xs text-white/30">Sign in with Discord account</p>
                      </div>
                      {/* Toggle */}
                      <div className={`w-10 rounded-full transition-colors relative flex items-center ${
                        oauthDiscord ? 'bg-indigo-500' : 'bg-white/10'
                      }`} style={{ minWidth: '40px', height: '22px' }}>
                        <span className={`absolute w-4 h-4 rounded-full bg-white shadow transition-transform ${
                          oauthDiscord ? 'translate-x-5' : 'translate-x-1'
                        }`} />
                      </div>
                    </button>

                    {/* Instructions */}
                    <AnimatePresence>
                      {oauthDiscord && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="px-4 pb-4 space-y-2.5 border-t border-white/10 pt-4">
                            {[
                              { n: 1, text: 'Go to Discord Developer Portal → Your Application → OAuth2 → Redirects', href: 'https://discord.com/developers/applications', linkText: 'Open Portal' },
                              { n: 2, text: 'Click "Add Redirect" and paste the Supabase callback URL above' },
                              { n: 3, text: 'Copy the Client ID and Client Secret from Discord Developer Portal → General Information' },
                              { n: 4, text: 'In Supabase → Auth → Providers → Discord: enable, paste Client ID and Secret', href: `https://supabase.com/dashboard/project/${projectId}/auth/providers`, linkText: 'Open Supabase' },
                              { n: 5, text: 'Important: the Client Secret is regenerated each time — copy it immediately after creation' },
                            ].map(step => (
                              <div key={step.n} className="flex items-start gap-3">
                                <span className="shrink-0 w-5 h-5 rounded-full bg-indigo-500/20 text-indigo-400 text-[10px] font-bold flex items-center justify-center mt-0.5">{step.n}</span>
                                <p className="text-xs text-white/60 leading-relaxed flex-1">
                                  {step.text}
                                  {step.href && (
                                    <a href={step.href} target="_blank" rel="noreferrer"
                                      className="ml-2 inline-flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors font-medium">
                                      {step.linkText} <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </p>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Status summary */}
                  <div className={`flex items-center gap-2 p-3 rounded-xl border text-xs mb-6 ${
                    oauthGoogle || oauthDiscord
                      ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300'
                      : 'border-white/10 bg-white/5 text-white/30'
                  }`}>
                    {oauthGoogle || oauthDiscord
                      ? <CheckCircle2 className="w-4 h-4 shrink-0" />
                      : <AlertCircle className="w-4 h-4 shrink-0" />}
                    {oauthGoogle && oauthDiscord
                      ? 'Both Google and Discord OAuth are being configured.'
                      : oauthGoogle
                        ? 'Google OAuth is being configured. Discord will be skipped.'
                        : oauthDiscord
                          ? 'Discord OAuth is being configured. Google will be skipped.'
                          : 'No OAuth providers selected. Users can still sign in with email & password.'}
                  </div>

                  <div className="flex gap-3">
                    <Button onClick={prev} variant="outline" className="h-10 border-white/10 text-white/60 hover:bg-white/5">
                      <ChevronLeft className="w-4 h-4 mr-1" /> Back
                    </Button>
                    <Button onClick={next}
                      className="flex-1 h-10 font-semibold text-white"
                      style={{ background: 'linear-gradient(135deg,#0891b2,#7c3aed)' }}>
                      {oauthGoogle || oauthDiscord ? 'Continue' : 'Skip & Continue'}
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}

              {/* ── STEP 3: Create admin ────────────────────────────────── */}
              {step === 3 && (
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                      <Shield className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Create Admin Account</h2>
                      <p className="text-white/40 text-sm">This will be the client's login to the admin panel.</p>
                    </div>
                  </div>

                  {adminDone ? (
                    <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 text-emerald-300 text-sm mb-6">
                      <CheckCircle2 className="w-5 h-5 shrink-0" />
                      Admin account created for <strong>{adminEmail}</strong>. Continuing…
                    </div>
                  ) : (
                    <div className="space-y-4 mb-6">
                      <div>
                        <label className="block text-sm font-medium text-white/60 mb-2">Email address</label>
                        <Input type="email" placeholder="admin@theirstudio.com" value={adminEmail}
                          onChange={e => setAdminEmail(e.target.value)}
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/20" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/60 mb-2">Password <span className="text-white/30">(min 8 chars)</span></label>
                        <div className="relative">
                          <Input type={showPass ? 'text' : 'password'} placeholder="••••••••••" value={adminPass}
                            onChange={e => setAdminPass(e.target.value)}
                            className="bg-white/5 border-white/10 text-white placeholder:text-white/20 pr-10" />
                          <button type="button" onClick={() => setShowPass(s => !s)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors">
                            {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-white/60 mb-2">Confirm password</label>
                        <Input type={showPass ? 'text' : 'password'} placeholder="••••••••••" value={adminPass2}
                          onChange={e => setAdminPass2(e.target.value)}
                          className={`bg-white/5 border text-white placeholder:text-white/20 ${
                            adminPass2 && adminPass !== adminPass2 ? 'border-red-500/50' : 'border-white/10'
                          }`} />
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-300 text-sm mb-4">
                      <XCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button onClick={prev} variant="outline" className="h-10 border-white/10 text-white/60 hover:bg-white/5">
                      <ChevronLeft className="w-4 h-4 mr-1" /> Back
                    </Button>
                    {adminDone
                      ? (
                        <Button onClick={next} className="flex-1 h-10 font-semibold text-white"
                          style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                          Continue <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      ) : (
                        <Button onClick={handleCreateAdmin} disabled={loading}
                          className="flex-1 h-10 font-semibold text-white disabled:opacity-40"
                          style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                          {loading
                            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating…</>
                            : <>Create Account <ChevronRight className="w-4 h-4 ml-1" /></>}
                        </Button>
                      )}
                  </div>
                </div>
              )}

              {/* ── STEP 4: Brand basics ────────────────────────────────── */}
              {step === 4 && (
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg,#ec4899,#a855f7)' }}>
                      <Palette className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Brand Basics</h2>
                      <p className="text-white/40 text-sm">All fields are optional — can be changed later in Admin → Settings.</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                    {[
                      { field: 'studioName',   label: 'Studio Name',     placeholder: 'Fastoosh Studio',          type: 'text'  },
                      { field: 'contactEmail', label: 'Contact Email',   placeholder: 'hello@theirstudio.com',    type: 'email' },
                      { field: 'siteUrl',      label: 'Site URL',        placeholder: 'https://theirstudio.com',  type: 'url'   },
                      { field: 'calendlyUrl',  label: 'Calendly URL',    placeholder: 'https://calendly.com/…',   type: 'url'   },
                      { field: 'showreelUrl',  label: 'Showreel URL',    placeholder: 'https://vimeo.com/…',      type: 'url'   },
                    ].map(({ field, label, placeholder, type }) => (
                      <div key={field} className={field === 'siteUrl' || field === 'showreelUrl' ? 'sm:col-span-2' : ''}>
                        <label className="block text-sm font-medium text-white/60 mb-2">{label}</label>
                        <Input type={type} placeholder={placeholder} value={(brand as any)[field]}
                          onChange={e => setBrand(b => ({ ...b, [field]: e.target.value }))}
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/20" />
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-white/30 font-semibold uppercase tracking-widest mb-3">Social Links</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                    {[
                      { field: 'instagram', placeholder: 'https://instagram.com/…' },
                      { field: 'linkedin',  placeholder: 'https://linkedin.com/in/…' },
                      { field: 'twitter',   placeholder: 'https://twitter.com/…' },
                      { field: 'tiktok',    placeholder: 'https://tiktok.com/@…' },
                      { field: 'behance',   placeholder: 'https://behance.net/…' },
                      { field: 'dribbble',  placeholder: 'https://dribbble.com/…' },
                    ].map(({ field, placeholder }) => (
                      <div key={field}>
                        <label className="block text-xs text-white/40 mb-1.5 capitalize">{field}</label>
                        <Input placeholder={placeholder} value={(brand as any)[field]}
                          onChange={e => setBrand(b => ({ ...b, [field]: e.target.value }))}
                          className="bg-white/5 border-white/10 text-white placeholder:text-white/20 text-sm h-9" />
                      </div>
                    ))}
                  </div>

                  {error && (
                    <div className="flex items-start gap-2 p-3 rounded-xl border border-red-500/20 bg-red-500/5 text-red-300 text-sm mb-4">
                      <XCircle className="w-4 h-4 shrink-0 mt-0.5" />{error}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button onClick={prev} variant="outline" className="h-10 border-white/10 text-white/60 hover:bg-white/5">
                      <ChevronLeft className="w-4 h-4 mr-1" /> Back
                    </Button>
                    <Button onClick={handleSaveBrand} disabled={loading}
                      className="flex-1 h-10 font-semibold text-white disabled:opacity-40"
                      style={{ background: 'linear-gradient(135deg,#ec4899,#a855f7)' }}>
                      {loading
                        ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Saving…</>
                        : <>Save & Continue <ChevronRight className="w-4 h-4 ml-1" /></>}
                    </Button>
                  </div>
                </div>
              )}

              {/* ── STEP 5: Seed data ───────────────────────────────────── */}
              {step === 5 && (
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                      <Database className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <h2 className="text-xl font-bold text-white">Sample Data</h2>
                      <p className="text-white/40 text-sm">Pre-fill the site so the client sees it live from day one.</p>
                    </div>
                  </div>

                  {!seedDone && seedLog.length === 0 && (
                    <>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                        {[
                          { id: 'seed' as const, title: 'Seed sample content', desc: '6 projects · 3 tools · 3 team members · site settings', icon: Database, color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
                          { id: 'skip' as const, title: 'Start with empty database', desc: 'The client will fill everything in via the admin panel.', icon: ChevronRight, color: 'text-white/50', bg: 'bg-white/5', border: 'border-white/10' },
                        ].map(opt => (
                          <button key={opt.id} onClick={() => setSeedChoice(opt.id)}
                            className={`text-left p-5 rounded-xl border-2 transition-all duration-200 ${
                              seedChoice === opt.id ? opt.border + ' ' + opt.bg : 'border-white/10 bg-white/5 hover:bg-white/8'
                            }`}>
                            <div className="flex items-center gap-2 mb-2">
                              <opt.icon className={`w-5 h-5 ${seedChoice === opt.id ? opt.color : 'text-white/40'}`} />
                              <span className="font-semibold text-sm text-white">{opt.title}</span>
                            </div>
                            <p className="text-xs text-white/40">{opt.desc}</p>
                          </button>
                        ))}
                      </div>

                      <div className="flex gap-3">
                        <Button onClick={prev} variant="outline" className="h-10 border-white/10 text-white/60 hover:bg-white/5">
                          <ChevronLeft className="w-4 h-4 mr-1" /> Back
                        </Button>
                        <Button onClick={handleSeed} disabled={!seedChoice || loading}
                          className="flex-1 h-10 font-semibold text-white disabled:opacity-40"
                          style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                          {loading
                            ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Seeding…</>
                            : seedChoice === 'skip' ? 'Skip & Continue' : 'Seed Data & Continue'}
                        </Button>
                      </div>
                    </>
                  )}

                  {/* Seed log */}
                  {seedLog.length > 0 && (
                    <div className="space-y-3">
                      <div className="font-mono text-xs space-y-1.5 p-4 bg-black/40 rounded-xl border border-white/10 max-h-56 overflow-y-auto">
                        {seedLog.map((l, i) => (
                          <div key={i} className={`flex gap-2 ${
                            l.type === 'ok' ? 'text-emerald-400' : l.type === 'err' ? 'text-red-400' : 'text-white/40'
                          }`}>
                            <span className="shrink-0">{l.type === 'ok' ? '✓' : l.type === 'err' ? '✗' : '›'}</span>
                            <span>{l.text}</span>
                          </div>
                        ))}
                        {loading && <div className="flex items-center gap-2 text-white/30"><Loader2 className="w-3 h-3 animate-spin" /> Working…</div>}
                      </div>
                      {seedDone && (
                        <Button onClick={next} className="w-full h-10 font-semibold text-white"
                          style={{ background: 'linear-gradient(135deg,#10b981,#059669)' }}>
                          Continue <ChevronRight className="w-4 h-4 ml-1" />
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* ── STEP 6: Done ────────────────────────────────────────── */}
              {step === 6 && (
                <div className="text-center">
                  <div className="mb-6">
                    <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center mb-4"
                      style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}>
                      <PartyPopper className="w-8 h-8 text-white" />
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">You're all set! 🎉</h2>
                    <p className="text-white/50 text-sm">
                      The site is fully configured and ready to hand off to the client.
                    </p>
                  </div>

                  <div className="space-y-3 mb-8 text-left">
                    {[
                      { label: 'Log into the admin panel', href: '/admin/login', hint: 'Manage all site content',   color: 'from-violet-600 to-indigo-600' },
                      { label: 'Visit the live site',      href: '/home',        hint: 'See the site as a visitor', color: 'from-pink-600 to-purple-600'  },
                    ].map(({ label, href, hint, color }) => (
                      <a key={href} href={href}
                        className={`flex items-center justify-between p-4 rounded-xl bg-gradient-to-r ${color} bg-opacity-10 border border-white/10 hover:border-white/20 transition-all group`}>
                        <div>
                          <p className="font-semibold text-sm text-white">{label}</p>
                          <p className="text-xs text-white/40">{hint}</p>
                        </div>
                        <ExternalLink className="w-4 h-4 text-white/30 group-hover:text-white/70 transition-colors" />
                      </a>
                    ))}
                  </div>

                  <div className="p-4 rounded-xl border border-violet-500/20 bg-violet-500/5 text-left">
                    <p className="text-xs font-semibold text-violet-400 mb-2">📋 Remind the client to:</p>
                    <ul className="text-xs text-white/50 space-y-1.5">
                      <li>• Replace sample projects &amp; tools with their real work</li>
                      <li>• Upload their logo in Admin → Style</li>
                      <li>• Add their real showreel URL in Admin → Settings</li>
                      <li>• Verify their Resend domain for email deliverability</li>
                      <li>• Add <code className="text-violet-300/80 font-mono">VIMEO_ACCESS_TOKEN</code> in Supabase → Edge Functions → Secrets to enable the Vimeo video picker</li>
                      <li>• Run AI translations in Admin → Translations for French &amp; Arabic content</li>
                      <li>• Monitor visitor traffic in Admin → Traffic once the site goes live</li>
                      <li>• Set up Lemon Squeezy products &amp; webhook if they sell tools</li>
                      <li>• Test the forgot-password email flow end-to-end</li>
                      {(oauthGoogle || oauthDiscord) && (
                        <li>• Test {oauthGoogle && 'Google'}{oauthGoogle && oauthDiscord && ' and '}{oauthDiscord && 'Discord'} sign-in on the live site</li>
                      )}
                    </ul>
                  </div>
                </div>
              )}

            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}