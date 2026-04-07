import React, { useState, useEffect, useCallback } from 'react';
import { GlassCard } from '../shared/GlassCard';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import {
  AlertTriangle, Trash2, RefreshCw, CheckCircle2, XCircle,
  Globe, Mail, Star, Download, Users, ShieldAlert, Loader2,
  ArrowRight, Lock, TriangleAlert, Film,
} from 'lucide-react';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

interface CategoryStats {
  traffic:  number;
  messages: number;
  reviews:  number;
  leads:    number;
  users:    number;
  videos:   number;
}

interface ResetReport {
  traffic?:  { deleted: number; error?: string };
  messages?: { deleted: number; error?: string };
  reviews?:  { deleted: number; error?: string };
  leads?:    { deleted: number; error?: string };
  users?:    { deleted: number; error?: string };
  videos?:   { deleted: number; error?: string };
}

// 'idle' → 'warn' → 'password' → 'result'
type ModalStep = 'idle' | 'warn' | 'password' | 'result';

const CATEGORIES = [
  {
    key: 'traffic' as const,
    label: 'Traffic & Sessions',
    icon: Globe,
    color: 'from-blue-500/20 to-cyan-500/20 border-blue-500/30',
    iconColor: 'text-blue-400',
    description: 'All visitor sessions, page views, funnel analytics, UTM tracking records, and heatmap click data.',
  },
  {
    key: 'messages' as const,
    label: 'Contact Messages',
    icon: Mail,
    color: 'from-yellow-500/20 to-amber-500/20 border-yellow-500/30',
    iconColor: 'text-yellow-400',
    description: 'All contact form submissions and tool support inquiry messages.',
  },
  {
    key: 'reviews' as const,
    label: 'Reviews & Ratings',
    icon: Star,
    color: 'from-orange-500/20 to-amber-500/20 border-orange-500/30',
    iconColor: 'text-orange-400',
    description: 'All tool reviews and star ratings submitted by users.',
  },
  {
    key: 'leads' as const,
    label: 'Free Download Leads',
    icon: Download,
    color: 'from-green-500/20 to-emerald-500/20 border-green-500/30',
    iconColor: 'text-green-400',
    description: 'Email addresses collected through the free download flow, plus OTP verification codes.',
  },
  {
    key: 'users' as const,
    label: 'User Accounts',
    icon: Users,
    color: 'from-red-500/20 to-rose-500/20 border-red-500/30',
    iconColor: 'text-red-400',
    description: 'All registered user accounts (except your admin account), their profiles, purchases, and download history.',
  },
  {
    key: 'videos' as const,
    label: 'Video Analytics',
    icon: Film,
    color: 'from-violet-500/20 to-purple-500/20 border-violet-500/30',
    iconColor: 'text-violet-400',
    description: 'All project video view counts and watch-time data, plus showreel analytics.',
  },
] as const;

type CategoryKey = typeof CATEGORIES[number]['key'];

export function ResetTab() {
  const [stats,        setStats]        = useState<CategoryStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const [selected, setSelected] = useState<Record<CategoryKey, boolean>>({
    traffic: false, messages: false, reviews: false, leads: false, users: false, videos: false,
  });

  const [step,       setStep]       = useState<ModalStep>('idle');
  const [email,      setEmail]      = useState('');
  const [password,   setPassword]   = useState('');
  const [resetting,  setResetting]  = useState(false);
  const [report,     setReport]     = useState<ResetReport | null>(null);
  const [modalError, setModalError] = useState('');

  /* ── Stats loader ──────────────────────────────────────────────────────── */
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/admin/reset/stats`, {
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'X-Admin-Token': token || '',
        },
      });
      const data = await res.json();
      if (data.success) setStats(data.data);
    } catch (err) {
      console.error('[ResetTab] Failed to fetch stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  /* ── Helpers ───────────────────────────────────────────────────────────── */
  const selectedCount    = Object.values(selected).filter(Boolean).length;
  const allSelected      = selectedCount === CATEGORIES.length;
  const selectedCats     = CATEGORIES.filter(c => selected[c.key]);
  const totalRecords     = stats
    ? selectedCats.reduce((sum, c) => sum + (stats[c.key] ?? 0), 0)
    : null;

  const formatCount = (n: number) => n.toLocaleString();

  const toggleAll = () => {
    const next = !allSelected;
    setSelected({ traffic: next, messages: next, reviews: next, leads: next, users: next, videos: next });
  };

  const closeModal = () => {
    setStep('idle');
    setEmail('');
    setPassword('');
    setModalError('');
    setReport(null);
  };

  /* ── Step 1 → Step 2 ───────────────────────────────────────────────────── */
  const handleProceedToPassword = () => {
    setEmail('');
    setPassword('');
    setModalError('');
    setStep('password');
  };

  /* ── Final reset call ──────────────────────────────────────────────────── */
  const handleReset = async () => {
    if (!email || !password) { setModalError('Please enter your email and password.'); return; }
    setResetting(true);
    setModalError('');
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/admin/reset`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
          'X-Admin-Token': token || '',
        },
        body: JSON.stringify({ email, password, categories: selected }),
      });
      const data = await res.json();
      if (!data.success) {
        setModalError(data.error || 'Reset failed. Please try again.');
      } else {
        setReport(data.report);
        setStep('result');
        fetchStats();
      }
    } catch (err) {
      setModalError(`Network error: ${err}`);
    } finally {
      setResetting(false);
    }
  };

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6">

      {/* ── Warning Banner ─────────────────────────────────────────────────── */}
      <GlassCard className="p-6 border border-red-500/30 bg-gradient-to-r from-red-500/10 to-rose-500/5">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="w-5 h-5 text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-red-300 mb-1">Danger Zone — Data Reset</h2>
            <p className="text-white/60 text-sm leading-relaxed">
              Use this panel to wipe transient dashboard data before going live.
              Select the categories you want to clear, then confirm with your admin password.
              <strong className="text-white/80"> This action is permanent and cannot be undone.</strong>
              <br />
              <span className="text-green-400 font-medium">Projects, Tools, Team members, Client Logos, Home content, Style, SEO, and Translations are never affected.</span>
            </p>
          </div>
        </div>
      </GlassCard>

      {/* ── Header + Select All ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h3 className="text-white font-semibold text-base">Select data to initialize</h3>
        <button
          onClick={toggleAll}
          className="text-sm text-purple-400 hover:text-purple-300 transition-colors underline-offset-2 hover:underline"
        >
          {allSelected ? 'Deselect All' : 'Select All'}
        </button>
      </div>

      {/* ── Category Cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {CATEGORIES.map(cat => {
          const Icon    = cat.icon;
          const checked = selected[cat.key];
          const count   = stats ? stats[cat.key] : null;

          return (
            <button
              key={cat.key}
              onClick={() => setSelected(s => ({ ...s, [cat.key]: !s[cat.key] }))}
              className={`text-left rounded-xl border bg-gradient-to-br p-5 transition-all duration-200 ${cat.color}
                ${checked
                  ? 'ring-2 ring-white/30 shadow-lg scale-[1.01]'
                  : 'opacity-70 hover:opacity-90 hover:scale-[1.005]'
                }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* Checkbox */}
                  <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors
                    ${checked ? 'bg-white border-white' : 'border-white/30 bg-transparent'}`}>
                    {checked && (
                      <svg className="w-3 h-3 text-black" fill="none" viewBox="0 0 12 12">
                        <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                  </div>
                  <div className="w-8 h-8 rounded-lg bg-black/20 flex items-center justify-center">
                    <Icon className={`w-4 h-4 ${cat.iconColor}`} />
                  </div>
                </div>

                {/* Count badge */}
                {statsLoading ? (
                  <div className="w-12 h-5 rounded bg-white/10 animate-pulse" />
                ) : count !== null ? (
                  <span className={`text-xs font-mono px-2 py-0.5 rounded-full
                    ${count > 0 ? 'bg-white/15 text-white/80' : 'bg-white/5 text-white/30'}`}>
                    {formatCount(count)}
                  </span>
                ) : null}
              </div>

              <div className="mt-3">
                <p className="text-white font-medium text-sm mb-1">{cat.label}</p>
                <p className="text-white/50 text-xs leading-relaxed">{cat.description}</p>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── Reset Button ──────────────────────────────────────────────────── */}
      <div className="flex justify-end">
        <Button
          onClick={() => setStep('warn')}
          disabled={selectedCount === 0}
          className={`flex items-center gap-2 px-6 py-2.5 font-semibold transition-all
            ${selectedCount > 0
              ? 'bg-red-600 hover:bg-red-500 text-white cursor-pointer shadow-lg shadow-red-900/30'
              : 'bg-white/5 text-white/30 cursor-not-allowed'
            }`}
        >
          <Trash2 className="w-4 h-4" />
          Reset {selectedCount > 0 ? `${selectedCount} categor${selectedCount === 1 ? 'y' : 'ies'}` : 'Selected'}
        </Button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          MODALS  (step = warn | password | result)
      ══════════════════════════════════════════════════════════════════════ */}
      {step !== 'idle' && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.80)', backdropFilter: 'blur(8px)' }}
        >

          {/* ── STEP 1 — Final Warning ──────────────────────────────────────── */}
          {step === 'warn' && (
            <div className="w-full max-w-lg bg-[#0d0d1a] border border-red-500/40 rounded-2xl shadow-2xl shadow-red-950/50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">

              {/* Glowing red header */}
              <div className="relative bg-gradient-to-r from-red-700/50 to-rose-700/40 border-b border-red-500/30 px-6 pt-8 pb-6 text-center overflow-hidden">
                {/* Ambient glow */}
                <div className="absolute inset-0 bg-red-600/10 blur-2xl pointer-events-none" />

                <div className="relative flex flex-col items-center gap-3">
                  {/* Pulsing icon */}
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-red-500/30 animate-ping" />
                    <div className="relative w-14 h-14 rounded-full bg-red-500/20 border-2 border-red-500/50 flex items-center justify-center">
                      <TriangleAlert className="w-7 h-7 text-red-400" />
                    </div>
                  </div>
                  <h2 className="text-xl font-bold text-white">Are you absolutely sure?</h2>
                  <p className="text-red-300/90 text-sm font-medium">
                    This operation is <span className="underline decoration-red-400">permanent</span> and <span className="underline decoration-red-400">cannot be undone</span>.
                  </p>
                </div>
              </div>

              <div className="p-6 space-y-5">

                {/* Total record count warning */}
                {totalRecords !== null && totalRecords > 0 && (
                  <div className="flex items-center gap-3 rounded-xl bg-red-500/10 border border-red-500/25 px-4 py-3">
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <p className="text-red-200 text-sm">
                      You are about to permanently delete{' '}
                      <strong className="text-red-100">{formatCount(totalRecords)} records</strong>
                      {' '}across{' '}
                      <strong className="text-red-100">{selectedCount} {selectedCount === 1 ? 'category' : 'categories'}</strong>.
                    </p>
                  </div>
                )}

                {/* What will be deleted */}
                <div className="rounded-xl border border-white/8 bg-white/3 divide-y divide-white/8 overflow-hidden">
                  {selectedCats.map((cat, i) => {
                    const Icon  = cat.icon;
                    const count = stats ? stats[cat.key] : null;
                    return (
                      <div key={cat.key} className="flex items-center justify-between px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <Icon className={`w-4 h-4 ${cat.iconColor}`} />
                          <span className="text-white/80 text-sm">{cat.label}</span>
                        </div>
                        {count !== null && (
                          <span className="text-xs font-mono text-white/40">
                            {formatCount(count)} records
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-1">
                  <Button
                    onClick={closeModal}
                    className="flex-1 bg-white/6 hover:bg-white/12 text-white border border-white/10 cursor-pointer"
                  >
                    Cancel — Keep Data
                  </Button>
                  <Button
                    onClick={handleProceedToPassword}
                    className="flex-1 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-500 text-white font-semibold cursor-pointer shadow-lg shadow-red-900/40"
                  >
                    Yes, I'm sure
                    <ArrowRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 2 — Admin Password Gate ────────────────────────────────── */}
          {step === 'password' && (
            <div className="w-full max-w-md bg-[#0d0d1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

              {/* Header */}
              <div className="bg-gradient-to-r from-red-600/25 to-rose-600/15 border-b border-red-500/20 px-6 py-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
                  <Lock className="w-4 h-4 text-red-400" />
                </div>
                <div>
                  <h3 className="text-white font-semibold text-sm">Admin Authorization Required</h3>
                  <p className="text-white/40 text-xs">Enter your credentials to authorize this reset</p>
                </div>
              </div>

              <div className="p-6 space-y-5">

                {/* Mini summary of what's being deleted */}
                <div className="rounded-lg bg-red-500/8 border border-red-500/20 px-4 py-3">
                  <p className="text-red-300 text-xs font-medium mb-1.5">About to delete:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedCats.map(cat => (
                      <span key={cat.key} className="text-xs bg-red-500/15 border border-red-500/20 text-red-200/80 px-2 py-0.5 rounded-full">
                        {cat.label}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Credentials */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs text-white/50 mb-1.5 font-medium">Admin Email</label>
                    <Input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-red-500/50"
                      disabled={resetting}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-white/50 mb-1.5 font-medium">Admin Password</label>
                    <Input
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="bg-white/5 border-white/10 text-white placeholder:text-white/25 focus:border-red-500/50"
                      disabled={resetting}
                      onKeyDown={e => { if (e.key === 'Enter') handleReset(); }}
                    />
                  </div>

                  {/* Error */}
                  {modalError && (
                    <div className="flex items-start gap-2 rounded-lg bg-red-500/10 border border-red-500/25 px-3 py-2.5">
                      <XCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <p className="text-red-300 text-xs leading-relaxed">{modalError}</p>
                    </div>
                  )}
                </div>

                {/* Buttons */}
                <div className="flex gap-3 pt-1">
                  <Button
                    onClick={() => { setStep('warn'); setModalError(''); }}
                    disabled={resetting}
                    className="flex-1 bg-white/5 hover:bg-white/10 text-white border border-white/10 cursor-pointer"
                  >
                    ← Back
                  </Button>
                  <Button
                    onClick={handleReset}
                    disabled={resetting || !email || !password}
                    className={`flex-1 flex items-center justify-center gap-2 font-semibold transition-all
                      ${resetting || !email || !password
                        ? 'bg-red-900/40 text-red-300/40 cursor-not-allowed'
                        : 'bg-red-600 hover:bg-red-500 text-white cursor-pointer shadow-lg shadow-red-900/40'}`}
                  >
                    {resetting ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Resetting…</>
                    ) : (
                      <><Trash2 className="w-4 h-4" /> Confirm Reset</>
                    )}
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── STEP 3 — Results ────────────────────────────────────────────── */}
          {step === 'result' && report && (
            <div className="w-full max-w-md bg-[#0d0d1a] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">

              {/* Header */}
              <div className="bg-gradient-to-r from-green-600/20 to-emerald-600/15 border-b border-green-500/20 px-6 py-4 flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                <h3 className="text-white font-semibold">Reset Complete</h3>
              </div>

              <div className="p-6 space-y-4">
                <p className="text-white/50 text-sm">The following categories were processed:</p>

                <div className="space-y-2">
                  {selectedCats.map(cat => {
                    const r  = report[cat.key];
                    const ok = r && !r.error;
                    return (
                      <div
                        key={cat.key}
                        className={`flex items-center justify-between rounded-lg px-4 py-3
                          ${ok
                            ? 'bg-green-500/8 border border-green-500/20'
                            : 'bg-red-500/8 border border-red-500/20'}`}
                      >
                        <div className="flex items-center gap-2.5">
                          {ok
                            ? <CheckCircle2 className="w-4 h-4 text-green-400" />
                            : <XCircle      className="w-4 h-4 text-red-400" />}
                          <span className="text-white/80 text-sm">{cat.label}</span>
                        </div>
                        <span className={`text-xs font-mono ${ok ? 'text-green-400' : 'text-red-400'}`}>
                          {ok ? `${formatCount(r!.deleted)} deleted` : (r?.error || 'error')}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <Button
                  onClick={closeModal}
                  className="w-full bg-white/8 hover:bg-white/15 text-white border border-white/10 cursor-pointer mt-2"
                >
                  Done
                </Button>
              </div>
            </div>
          )}

        </div>
      )}

      {/* ── Refresh stats ─────────────────────────────────────────────────── */}
      <div className="flex justify-start">
        <button
          onClick={fetchStats}
          disabled={statsLoading}
          className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${statsLoading ? 'animate-spin' : ''}`} />
          Refresh counts
        </button>
      </div>
    </div>
  );
}