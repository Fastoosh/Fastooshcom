import { useState, useEffect, useCallback } from 'react';
import { GlassCard } from '../shared/GlassCard';
import {
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  RefreshCw, Link2, TrendingUp, ShoppingCart, Users,
  ChevronDown, ChevronUp, Globe, Clock, ArrowUpRight,
  Zap, MousePointer, BarChart2, Filter, Calendar,
  Copy, CheckCheck, ExternalLink, Wand2,
  Bookmark, BookmarkCheck, Trash2, RotateCcw,
  Files, Tag, X, Pencil, Activity,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import type { IconDefinition } from '@fortawesome/fontawesome-svg-core';
import {
  faLinkedin, faYoutube, faXTwitter, faInstagram, faTiktok,
  faFacebook, faDiscord, faGoogle, faPinterest,
} from '@fortawesome/free-brands-svg-icons';
import { faEnvelope, faPaperPlane, faGlobe } from '@fortawesome/free-solid-svg-icons';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;
function getAuthHeaders() {
  const token = localStorage.getItem('admin_token');
  return { 'Authorization': `Bearer ${publicAnonKey}`, 'X-Admin-Token': token || '' };
}

// ── Source config ──────────────────────────────────────────────────────────────
type SourceCfg = { color: string; bg: string; border: string; icon: IconDefinition };
const SOURCE_CFG: Record<string, SourceCfg> = {
  'LinkedIn':          { color: '#60a5fa', bg: 'bg-blue-500/15',   border: 'border-blue-500/30',   icon: faLinkedin },
  'YouTube':           { color: '#f87171', bg: 'bg-red-500/15',    border: 'border-red-500/30',    icon: faYoutube },
  'X / Twitter':       { color: '#e2e8f0', bg: 'bg-white/10',      border: 'border-white/20',      icon: faXTwitter },
  'Instagram':         { color: '#f472b6', bg: 'bg-pink-500/15',   border: 'border-pink-500/30',   icon: faInstagram },
  'TikTok':            { color: '#22d3ee', bg: 'bg-cyan-500/15',   border: 'border-cyan-500/30',   icon: faTiktok },
  'Facebook':          { color: '#818cf8', bg: 'bg-indigo-500/15', border: 'border-indigo-500/30', icon: faFacebook },
  'Discord':           { color: '#a78bfa', bg: 'bg-violet-500/15', border: 'border-violet-500/30', icon: faDiscord },
  'Email / Newsletter':{ color: '#fbbf24', bg: 'bg-amber-500/15',  border: 'border-amber-500/30',  icon: faEnvelope },
  'Google':            { color: '#34d399', bg: 'bg-emerald-500/15',border: 'border-emerald-500/30',icon: faGoogle },
  'Direct / DM':       { color: '#a855f7', bg: 'bg-purple-500/15', border: 'border-purple-500/30', icon: faPaperPlane },
  'Pinterest':         { color: '#f43f5e', bg: 'bg-rose-500/15',   border: 'border-rose-500/30',   icon: faPinterest },
};
const DEFAULT_CFG: SourceCfg = { color: '#94a3b8', bg: 'bg-white/8', border: 'border-white/15', icon: faGlobe };
function srcCfg(name: string): SourceCfg { return SOURCE_CFG[name] ?? DEFAULT_CFG; }

const PIE_COLORS = [
  '#60a5fa','#f87171','#e2e8f0','#f472b6','#22d3ee',
  '#818cf8','#a78bfa','#fbbf24','#34d399','#a855f7','#94a3b8',
];

// ── Types ──────────────────────────────────────────────────────────────────────
interface SourceRow {
  name: string; sessions: number; converted: number; buyClicks: number;
  bounces: number; convRate: number; bounceRate: number; avgDuration: number;
  topPages: { page: string; count: number }[];
}
interface PageRow { page: string; total: number; sources: Record<string, number> }
interface CountryRow { code: string; sessions: number; converted: number; }
interface ReferrersData {
  sources: SourceRow[];
  dailySeries: Record<string, any>[];
  pageBreakdown: PageRow[];
  topSourceNames: string[];
  total: number;
  byCountry?: CountryRow[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDur(s: number) {
  if (!s) return '—';
  if (s < 60)   return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}
function shortDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// ── Country helpers ────────────────────────────────────────────────────────────
function countryFlag(code: string): string {
  if (!code || code === 'Unknown' || code.length !== 2) return '🌍';
  const offset = 0x1F1E6 - 65; // regional indicator A = U+1F1E6
  try {
    return String.fromCodePoint(code.charCodeAt(0) + offset, code.charCodeAt(1) + offset);
  } catch { return '🌍'; }
}
const COUNTRY_NAMES: Record<string, string> = {
  US:'United States', GB:'United Kingdom', FR:'France', DE:'Germany', MA:'Morocco',
  DZ:'Algeria', TN:'Tunisia', SA:'Saudi Arabia', AE:'UAE', EG:'Egypt',
  CA:'Canada', AU:'Australia', BR:'Brazil', IN:'India', JP:'Japan',
  CN:'China', RU:'Russia', MX:'Mexico', ZA:'South Africa', NG:'Nigeria',
  NL:'Netherlands', ES:'Spain', IT:'Italy', PT:'Portugal', SE:'Sweden',
  NO:'Norway', DK:'Denmark', FI:'Finland', CH:'Switzerland', AT:'Austria',
  BE:'Belgium', PL:'Poland', CZ:'Czechia', RO:'Romania', TR:'Turkey',
  KR:'South Korea', SG:'Singapore', MY:'Malaysia', ID:'Indonesia', PH:'Philippines',
  TH:'Thailand', VN:'Vietnam', PK:'Pakistan', BD:'Bangladesh', IR:'Iran',
  IQ:'Iraq', KW:'Kuwait', QA:'Qatar', BH:'Bahrain', OM:'Oman', JO:'Jordan',
  LB:'Lebanon', SY:'Syria', LY:'Libya', SD:'Sudan', ET:'Ethiopia',
  KE:'Kenya', GH:'Ghana', SN:'Senegal', CM:'Cameroon', CI:"Côte d'Ivoire",
  AR:'Argentina', CO:'Colombia', CL:'Chile', PE:'Peru', VE:'Venezuela',
  NZ:'New Zealand', IL:'Israel', UA:'Ukraine', HU:'Hungary', SK:'Slovakia',
};
function countryName(code: string): string {
  if (!code || code === 'Unknown') return 'Unknown';
  return COUNTRY_NAMES[code] ?? code;
}

// ── Custom tooltip ─────────────────────────────────────────────────────────────
function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#1a1025]/95 backdrop-blur px-3 py-2.5 shadow-xl text-xs">
      <p className="text-white/40 mb-1.5 font-medium">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="flex items-center gap-2 text-white mb-0.5">
          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: p.color || p.fill }} />
          <span className="text-white/50">{p.name}:</span>
          <span className="font-semibold">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ── Date range presets ─────────────────────────────────────────────────────────
const RANGES = [
  { label: '7d',  days: 7   },
  { label: '30d', days: 30  },
  { label: '90d', days: 90  },
  { label: 'All', days: 999 },
] as const;

// ── UTM Platforms presets ───────────────────────────────────────────────────────
const UTM_PLATFORMS: { name: string; source: string; medium: string; icon: IconDefinition; color: string }[] = [
  { name: 'LinkedIn',    source: 'linkedin',   medium: 'social',     icon: faLinkedin,  color: '#60a5fa' },
  { name: 'YouTube',     source: 'youtube',    medium: 'video',      icon: faYoutube,   color: '#f87171' },
  { name: 'X / Twitter', source: 'x',          medium: 'social',     icon: faXTwitter,  color: '#e2e8f0' },
  { name: 'Instagram',   source: 'instagram',  medium: 'social',     icon: faInstagram, color: '#f472b6' },
  { name: 'TikTok',      source: 'tiktok',     medium: 'video',      icon: faTiktok,    color: '#22d3ee' },
  { name: 'Discord',     source: 'discord',    medium: 'community',  icon: faDiscord,   color: '#a78bfa' },
  { name: 'Email',       source: 'email',      medium: 'newsletter', icon: faEnvelope,  color: '#fbbf24' },
  { name: 'Facebook',    source: 'facebook',   medium: 'social',     icon: faFacebook,  color: '#818cf8' },
  { name: 'Google',      source: 'google',     medium: 'cpc',        icon: faGoogle,    color: '#34d399' },
  { name: 'Pinterest',   source: 'pinterest',  medium: 'social',     icon: faPinterest, color: '#f43f5e' },
];

const SITE_PAGES = [
  { label: 'Home',         path: '/'             },
  { label: 'Projects',     path: '/projects'     },
  { label: 'Tools',        path: '/tools'        },
  { label: 'About',        path: '/about'        },
  { label: 'Work with us', path: '/work-with-us' },
];

const BASE_URL = 'https://fastoosh.com';

// ── Clipboard helper (fallback for sandboxed iframes) ──────────────────────────
function copyToClipboard(text: string) {
  try {
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => fallbackCopy(text));
    } else {
      fallbackCopy(text);
    }
  } catch {
    fallbackCopy(text);
  }
}
function fallbackCopy(text: string) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;top:-9999px;left:-9999px;opacity:0';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  document.execCommand('copy');
  document.body.removeChild(ta);
}

// ── UTM Builder sub-component ──────────────────────────────────────────────────
interface SavedUTM {
  id: string;
  label: string;
  platform: string | null;
  page: string;
  source: string;
  medium: string;
  campaign: string;
  content: string;
  url: string;
  tags: string[];
  savedAt: string;
}

interface UtmStats {
  exact:          Record<string, { sessions: number; converted: number }>;
  bySourceMedium: Record<string, { sessions: number; converted: number }>;
  bySource:       Record<string, { sessions: number; converted: number }>;
}

const TAG_PALETTE = [
  { bg: 'bg-blue-500/15',    text: 'text-blue-300',    border: 'border-blue-500/25'    },
  { bg: 'bg-purple-500/15',  text: 'text-purple-300',  border: 'border-purple-500/25'  },
  { bg: 'bg-emerald-500/15', text: 'text-emerald-300', border: 'border-emerald-500/25' },
  { bg: 'bg-amber-500/15',   text: 'text-amber-300',   border: 'border-amber-500/25'   },
  { bg: 'bg-rose-500/15',    text: 'text-rose-300',    border: 'border-rose-500/25'    },
  { bg: 'bg-cyan-500/15',    text: 'text-cyan-300',    border: 'border-cyan-500/25'    },
  { bg: 'bg-pink-500/15',    text: 'text-pink-300',    border: 'border-pink-500/25'    },
  { bg: 'bg-indigo-500/15',  text: 'text-indigo-300',  border: 'border-indigo-500/25'  },
];
function tagColor(tag: string) {
  let h = 0;
  for (let i = 0; i < tag.length; i++) h = ((h << 5) - h) + tag.charCodeAt(i);
  return TAG_PALETTE[Math.abs(h) % TAG_PALETTE.length];
}
function normUtm(s: string) { return s.trim().toLowerCase().replace(/\s+/g, '_'); }

function UTMBuilder() {
  const [page,          setPage]          = useState('/');
  const [source,        setSource]        = useState('');
  const [medium,        setMedium]        = useState('');
  const [campaign,      setCampaign]      = useState('');
  const [content,       setContent]       = useState('');
  const [activePlat,    setActivePlat]    = useState<string | null>(null);
  const [copied,        setCopied]        = useState(false);
  const [tools,         setTools]         = useState<{ name: string; slug: string }[]>([]);
  const [toolSearch,    setToolSearch]    = useState('');
  const [showTools,     setShowTools]     = useState(false);
  // saved links
  const [savedLinks,    setSavedLinks]    = useState<SavedUTM[]>([]);
  const [loadingSaved,  setLoadingSaved]  = useState(false);
  const [showSaveInput, setShowSaveInput] = useState(false);
  const [saveLabel,     setSaveLabel]     = useState('');
  const [saveTags,      setSaveTags]      = useState<string[]>([]);
  const [tagInput,      setTagInput]      = useState('');
  const [saving,        setSaving]        = useState(false);
  const [savedOk,       setSavedOk]       = useState(false);
  const [deletingId,    setDeletingId]    = useState<string | null>(null);
  const [copiedId,      setCopiedId]      = useState<string | null>(null);
  // stats
  const [utmStats,      setUtmStats]      = useState<UtmStats | null>(null);
  // tag filter
  const [activeTag,     setActiveTag]     = useState<string | null>(null);
  // inline edit
  const [editingId,     setEditingId]     = useState<string | null>(null);
  const [editLabel,     setEditLabel]     = useState('');
  const [editTags,      setEditTags]      = useState<string[]>([]);
  const [editTagInput,  setEditTagInput]  = useState('');
  const [patching,      setPatching]      = useState(false);

  // Fetch tools list on mount
  useEffect(() => {
    fetch(`${API_BASE}/tools`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(j => {
        if (j.success && Array.isArray(j.data)) {
          setTools(j.data.map((t: any) => ({ name: t.name, slug: t.slug })).filter((t: any) => t.slug));
        }
      })
      .catch(() => {/* silently ignore */});
  }, []);

  // Fetch saved UTM links on mount
  function fetchSaved() {
    setLoadingSaved(true);
    fetch(`${API_BASE}/utm-saved`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(j => { if (j.success) setSavedLinks(j.data ?? []); })
      .catch(() => {})
      .finally(() => setLoadingSaved(false));
  }
  useEffect(() => { fetchSaved(); fetchStats(); }, []);

  // Auto-generate label from current form state
  function autoLabel() {
    const pageName = page === '/' ? 'Home'
      : SITE_PAGES.find(p => p.path === page)?.label
      ?? page.replace(/^\/tools\//, '').replace(/-/g, ' ');
    const parts = [activePlat ?? source, '→', pageName];
    if (campaign.trim()) parts.push(`(${campaign.trim()})`);
    return parts.join(' ');
  }

  function openSaveInput() {
    setSaveLabel(autoLabel());
    setSaveTags([]);
    setTagInput('');
    setShowSaveInput(true);
    setSavedOk(false);
  }

  async function handleSave() {
    if (!isValid || saving) return;
    setSaving(true);
    // Auto-commit any text still sitting in the tag input that the user didn't press Enter for
    const pendingTag = tagInput.trim().toLowerCase().replace(/,/g, '');
    const finalTags  = pendingTag && !saveTags.includes(pendingTag)
      ? [...saveTags, pendingTag]
      : saveTags;
    try {
      const res = await fetch(`${API_BASE}/utm-saved`, {
        method: 'POST',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: saveLabel || autoLabel(), platform: activePlat, page, source, medium, campaign, content, url: finalUrl, tags: finalTags }),
      });
      const j = await res.json();
      if (j.success) {
        setSavedLinks(prev => [j.data, ...prev]);
        setSavedOk(true);
        setTimeout(() => { setSavedOk(false); setShowSaveInput(false); }, 1500);
      }
    } catch (err) {
      console.error('[utm-saved] save error:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      await fetch(`${API_BASE}/utm-saved/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      setSavedLinks(prev => prev.filter(l => l.id !== id));
    } catch (err) {
      console.error('[utm-saved] delete error:', err);
    } finally {
      setDeletingId(null);
    }
  }

  function handleLoad(link: SavedUTM) {
    setPage(link.page);
    setSource(link.source);
    setMedium(link.medium);
    setCampaign(link.campaign);
    setContent(link.content);
    setActivePlat(link.platform);
    setShowSaveInput(false);
  }

  function handleCopySaved(url: string, id: string) {
    copyToClipboard(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  // Fetch session stats per UTM combo
  function fetchStats() {
    fetch(`${API_BASE}/utm-saved/stats`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(j => { if (j.success) setUtmStats(j.data); })
      .catch(() => {});
  }

  // Lookup stats for a saved link (exact → source+medium → source)
  function getStats(link: SavedUTM) {
    if (!utmStats) return null;
    const src = normUtm(link.source);
    const med = normUtm(link.medium);
    const cmp = normUtm(link.campaign);
    return utmStats.exact[`${src}|${med}|${cmp}`]
        ?? utmStats.bySourceMedium[`${src}|${med}`]
        ?? utmStats.bySource[src]
        ?? null;
  }

  // Clone: load into form + open save input with "Copy of" label
  function handleClone(link: SavedUTM) {
    setPage(link.page);
    setSource(link.source);
    setMedium(link.medium);
    setCampaign(link.campaign);
    setContent(link.content);
    setActivePlat(link.platform);
    setSaveTags([...(link.tags ?? [])]);
    setSaveLabel(`Copy of ${link.label}`);
    setSavedOk(false);
    setShowSaveInput(true);
  }

  // Patch: update label + tags of an existing saved link
  async function handlePatch(id: string) {
    setPatching(true);
    // Auto-commit any text still sitting in the edit tag input
    const pendingEditTag = editTagInput.trim().toLowerCase().replace(/,/g, '');
    const finalEditTags  = pendingEditTag && !editTags.includes(pendingEditTag)
      ? [...editTags, pendingEditTag]
      : editTags;
    try {
      const res = await fetch(`${API_BASE}/utm-saved/${id}`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: editLabel, tags: finalEditTags }),
      });
      const j = await res.json();
      if (j.success) {
        setSavedLinks(prev => prev.map(l => l.id === id ? j.data : l));
        setEditingId(null);
      }
    } catch (err) {
      console.error('[utm-saved] patch error:', err);
    } finally {
      setPatching(false);
    }
  }

  // Tag chip helpers
  function addTag(tag: string, list: string[], setter: (v: string[]) => void) {
    const t = tag.trim().toLowerCase().replace(/,/g, '');
    if (t && !list.includes(t)) setter([...list, t]);
  }
  function removeTag(tag: string, list: string[], setter: (v: string[]) => void) {
    setter(list.filter(t => t !== tag));
  }
  function handleTagKeyDown(
    e: React.KeyboardEvent<HTMLInputElement>,
    val: string, setVal: (v: string) => void,
    list: string[], setList: (v: string[]) => void,
  ) {
    if ((e.key === 'Enter' || e.key === ',') && val.trim()) {
      e.preventDefault();
      addTag(val, list, setList);
      setVal('');
    } else if (e.key === 'Backspace' && !val && list.length > 0) {
      setList(list.slice(0, -1));
    }
  }

  const filteredTools = tools.filter(t =>
    t.name.toLowerCase().includes(toolSearch.toLowerCase()) ||
    t.slug.toLowerCase().includes(toolSearch.toLowerCase())
  );

  const selectedTool = page.startsWith('/tools/') ? tools.find(t => `/tools/${t.slug}` === page) : null;

  // Build final URL
  const params = new URLSearchParams();
  if (source.trim())   params.set('utm_source',   source.trim().toLowerCase().replace(/\s+/g, '_'));
  if (medium.trim())   params.set('utm_medium',   medium.trim().toLowerCase().replace(/\s+/g, '_'));
  if (campaign.trim()) params.set('utm_campaign', campaign.trim().toLowerCase().replace(/\s+/g, '_'));
  if (content.trim())  params.set('utm_content',  content.trim().toLowerCase().replace(/\s+/g, '_'));
  const query     = params.toString();
  const finalUrl  = `${BASE_URL}${page}${query ? '?' + query : ''}`;
  const isValid   = source.trim().length > 0;

  function selectPlatform(plat: typeof UTM_PLATFORMS[number]) {
    setActivePlat(plat.name);
    setSource(plat.source);
    setMedium(plat.medium);
  }

  function handleCopy() {
    if (!isValid) return;
    copyToClipboard(finalUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleReset() {
    setSource(''); setMedium(''); setCampaign(''); setContent('');
    setActivePlat(null);
  }

  return (
    <motion.div
      key="utm"
      initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
      className="space-y-5"
    >
      {/* Header */}
      <GlassCard className="p-5 border-purple-500/20 bg-purple-500/5">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
            <Wand2 className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="text-white font-semibold text-sm">UTM Link Builder</h3>
            <p className="text-white/40 text-xs">Generate trackable links to share across platforms. Every click will appear in your referrer analytics.</p>
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ── Left: Form ── */}
        <div className="space-y-4">

          {/* Platform quick-pick */}
          <GlassCard className="p-5">
            <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">
              1 — Pick a platform (or fill manually below)
            </p>
            <div className="grid grid-cols-4 gap-2">
              {UTM_PLATFORMS.map(plat => {
                const active = activePlat === plat.name;
                return (
                  <button
                    key={plat.name}
                    onClick={() => selectPlatform(plat)}
                    className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border transition-all text-center ${
                      active
                        ? 'border-purple-500/50 bg-purple-500/15 scale-[1.04]'
                        : 'border-white/10 bg-white/4 hover:bg-white/8 hover:border-white/20'
                    }`}
                  >
                    <FontAwesomeIcon icon={plat.icon} className="text-lg leading-none text-white" />
                    <span className="text-[10px] text-white/50 leading-tight font-medium line-clamp-1">
                      {plat.name.replace(' / Twitter', '')}
                    </span>
                  </button>
                );
              })}
            </div>
          </GlassCard>

          {/* Fields */}
          <GlassCard className="p-5 space-y-4">
            <p className="text-white/40 text-xs font-semibold uppercase tracking-widest">
              2 — Configure your link
            </p>

            {/* Page */}
            <div>
              <label className="text-white/50 text-xs font-medium mb-1.5 flex items-center gap-1.5 uppercase tracking-wider">
                <Globe className="w-3 h-3" /> Destination page
              </label>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5 mb-2">
                {SITE_PAGES.map(p => (
                  <button
                    key={p.path}
                    onClick={() => { setPage(p.path); setShowTools(false); if (p.path !== '/tools') setToolSearch(''); }}
                    className={`px-2 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      page === p.path
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'bg-white/4 border-white/10 text-white/50 hover:text-white/80 hover:bg-white/8'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {/* Tool detail page picker — only when Tools page is selected */}
              {page === '/tools' && <div className="rounded-xl border border-white/10 overflow-hidden">
                <button
                  onClick={() => setShowTools(v => !v)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-xs transition-all ${
                    selectedTool
                      ? 'bg-purple-500/10 border-b border-purple-500/20'
                      : 'bg-white/4 hover:bg-white/8'
                  }`}
                >
                  <span className={`font-medium flex items-center gap-2 ${selectedTool ? 'text-purple-300' : 'text-white/50'}`}>
                    <span>🔧</span>
                    {selectedTool ? selectedTool.name : 'Specific tool detail page…'}
                  </span>
                  <ChevronDown className={`w-3.5 h-3.5 text-white/30 transition-transform ${showTools ? 'rotate-180' : ''}`} />
                </button>

                <AnimatePresence>
                  {showTools && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.18 }}
                      className="border-t border-white/8"
                    >
                      {/* Search */}
                      <div className="p-2 border-b border-white/8">
                        <input
                          type="text"
                          value={toolSearch}
                          onChange={e => setToolSearch(e.target.value)}
                          placeholder="Search tools…"
                          className="w-full bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white
                            placeholder:text-white/25 focus:outline-none focus:border-purple-500/40 transition-all"
                        />
                      </div>

                      {/* Tool list */}
                      <div className="max-h-44 overflow-y-auto">
                        {tools.length === 0 ? (
                          <p className="text-white/25 text-xs text-center py-4">No tools found</p>
                        ) : filteredTools.length === 0 ? (
                          <p className="text-white/25 text-xs text-center py-4">No results for "{toolSearch}"</p>
                        ) : (
                          filteredTools.map(t => {
                            const toolPath = `/tools/${t.slug}`;
                            const isSelected = page === toolPath;
                            return (
                              <button
                                key={t.slug}
                                onClick={() => { setPage(toolPath); setShowTools(false); setToolSearch(''); }}
                                className={`w-full flex items-center justify-between px-3 py-2 text-xs transition-all text-left
                                  hover:bg-white/6 border-b border-white/5 last:border-0 ${isSelected ? 'bg-purple-500/10' : ''}`}
                              >
                                <div>
                                  <p className={`font-medium ${isSelected ? 'text-purple-300' : 'text-white/70'}`}>{t.name}</p>
                                  <p className="text-white/25 font-mono">/tools/{t.slug}</p>
                                </div>
                                {isSelected && <CheckCheck className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />}
                              </button>
                            );
                          })
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>}
            </div>

            {/* utm_source */}
            <div>
              <label className="text-white/50 text-xs font-medium mb-1.5 flex items-center gap-1 uppercase tracking-wider">
                utm_source <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={source}
                onChange={e => { setSource(e.target.value); setActivePlat(null); }}
                placeholder="linkedin, youtube, discord…"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white
                  placeholder:text-white/25 focus:outline-none focus:border-purple-500/50 focus:bg-purple-500/5
                  transition-all"
              />
            </div>

            {/* utm_medium */}
            <div>
              <label className="text-white/50 text-xs font-medium mb-1.5 flex items-center gap-1 uppercase tracking-wider">
                utm_medium
              </label>
              <input
                type="text"
                value={medium}
                onChange={e => setMedium(e.target.value)}
                placeholder="social, video, email, community…"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white
                  placeholder:text-white/25 focus:outline-none focus:border-purple-500/50 focus:bg-purple-500/5
                  transition-all"
              />
            </div>

            {/* utm_campaign */}
            <div>
              <label className="text-white/50 text-xs font-medium mb-1.5 flex items-center gap-1 uppercase tracking-wider">
                utm_campaign <span className="text-white/25 text-[10px] font-normal normal-case tracking-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={campaign}
                onChange={e => setCampaign(e.target.value)}
                placeholder="spring-launch, plugin-v2, tutorial…"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white
                  placeholder:text-white/25 focus:outline-none focus:border-purple-500/50 focus:bg-purple-500/5
                  transition-all"
              />
            </div>

            {/* utm_content */}
            <div>
              <label className="text-white/50 text-xs font-medium mb-1.5 flex items-center gap-1 uppercase tracking-wider">
                utm_content <span className="text-white/25 text-[10px] font-normal normal-case tracking-normal">(optional — to A/B test different posts)</span>
              </label>
              <input
                type="text"
                value={content}
                onChange={e => setContent(e.target.value)}
                placeholder="reel-1, story-2, banner-top…"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white
                  placeholder:text-white/25 focus:outline-none focus:border-purple-500/50 focus:bg-purple-500/5
                  transition-all"
              />
            </div>

            <button
              onClick={handleReset}
              className="text-xs text-white/30 hover:text-white/60 transition-colors underline underline-offset-2"
            >
              Reset fields
            </button>
          </GlassCard>
        </div>

        {/* ── Right: Preview + Copy ── */}
        <div className="space-y-4">
          <GlassCard className="p-5">
            <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3">
              3 — Your link
            </p>

            {/* URL preview box */}
            <div className={`rounded-xl border p-4 transition-all ${
              isValid
                ? 'border-purple-500/30 bg-purple-500/8'
                : 'border-white/10 bg-white/4'
            }`}>
              <p className="text-white/30 text-[10px] uppercase tracking-widest mb-2 font-semibold">Generated URL</p>
              <p className="text-sm font-mono break-all leading-relaxed">
                <span className="text-white/40">{BASE_URL}</span>
                <span className="text-white/70">{page}</span>
                {query && (
                  <>
                    <span className="text-white/30">?</span>
                    {query.split('&').map((pair, i, arr) => {
                      const [k, v] = pair.split('=');
                      return (
                        <span key={i}>
                          <span className="text-purple-300">{k}</span>
                          <span className="text-white/30">=</span>
                          <span className="text-emerald-300">{decodeURIComponent(v)}</span>
                          {i < arr.length - 1 && <span className="text-white/30">&</span>}
                        </span>
                      );
                    })}
                  </>
                )}
              </p>
            </div>

            {/* Params legend */}
            {isValid && (
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  { key: 'source',   val: source,   color: 'text-purple-300 bg-purple-500/10 border-purple-500/20' },
                  medium   && { key: 'medium',   val: medium,   color: 'text-blue-300 bg-blue-500/10 border-blue-500/20' },
                  campaign && { key: 'campaign', val: campaign, color: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20' },
                  content  && { key: 'content',  val: content,  color: 'text-amber-300 bg-amber-500/10 border-amber-500/20' },
                ].filter(Boolean).map((item: any) => (
                  <span key={item.key} className={`text-[10px] px-2 py-0.5 rounded-full border font-mono ${item.color}`}>
                    {item.key}={item.val.toLowerCase().replace(/\s+/g, '_')}
                  </span>
                ))}
              </div>
            )}

            {/* Copy + Save + Open buttons */}
            <div className="flex gap-2 mt-4">
              <button
                onClick={handleCopy}
                disabled={!isValid}
                className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm
                  transition-all ${
                  copied
                    ? 'bg-emerald-600 text-white border border-emerald-500'
                    : isValid
                      ? 'bg-purple-600 hover:bg-purple-500 text-white border border-purple-500 hover:scale-[1.01] active:scale-[0.99]'
                      : 'bg-white/5 text-white/25 border border-white/10 cursor-not-allowed'
                }`}
              >
                {copied
                  ? <><CheckCheck className="w-4 h-4" /> Copied!</>
                  : <><Copy className="w-4 h-4" /> Copy link</>
                }
              </button>
              {isValid && (
                <button
                  onClick={() => showSaveInput ? setShowSaveInput(false) : openSaveInput()}
                  title="Save link"
                  className={`flex items-center justify-center w-12 rounded-xl border transition-all ${
                    showSaveInput
                      ? 'bg-purple-600/30 border-purple-500/60 text-purple-300'
                      : 'bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-white/50 hover:text-white'
                  }`}
                >
                  <Bookmark className="w-4 h-4" />
                </button>
              )}
              {isValid && (
                <a
                  href={finalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center w-12 rounded-xl border border-white/10 bg-white/5
                    hover:bg-white/10 hover:border-white/20 text-white/50 hover:text-white transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>

            {/* Inline save label form */}
            <AnimatePresence>
              {showSaveInput && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.18 }}
                  className="overflow-hidden"
                >
                  <div className="mt-3 p-3 rounded-xl border border-purple-500/25 bg-purple-500/8 space-y-2.5">
                    <p className="text-white/40 text-[10px] font-semibold uppercase tracking-widest">
                      Label &amp; tags
                    </p>
                    {/* Label row */}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={saveLabel}
                        onChange={e => setSaveLabel(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setShowSaveInput(false); }}
                        autoFocus
                        placeholder="e.g. LinkedIn post → Tools (spring)"
                        className="flex-1 bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white
                          placeholder:text-white/25 focus:outline-none focus:border-purple-500/50 transition-all"
                      />
                      <button
                        onClick={handleSave}
                        disabled={saving || savedOk}
                        className={`flex items-center justify-center gap-1.5 px-4 rounded-lg text-sm font-semibold transition-all flex-shrink-0 ${
                          savedOk
                            ? 'bg-emerald-600 border border-emerald-500 text-white'
                            : 'bg-purple-600 hover:bg-purple-500 border border-purple-500 text-white disabled:opacity-50'
                        }`}
                      >
                        {savedOk
                          ? <><BookmarkCheck className="w-3.5 h-3.5" /> Saved!</>
                          : saving
                            ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            : <><Bookmark className="w-3.5 h-3.5" /> Save</>
                        }
                      </button>
                    </div>

                    {/* Tag chips input */}
                    <div className="flex flex-wrap items-center gap-1.5 min-h-[32px] bg-white/4 border border-white/10
                      rounded-lg px-2 py-1.5 cursor-text focus-within:border-purple-500/40 transition-all"
                      onClick={e => (e.currentTarget.querySelector('input') as HTMLInputElement)?.focus()}
                    >
                      <Tag className="w-3 h-3 text-white/20 flex-shrink-0" />
                      {saveTags.map(tag => {
                        const c = tagColor(tag);
                        return (
                          <span key={tag} className={`flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold ${c.bg} ${c.text} ${c.border}`}>
                            {tag}
                            <button onClick={() => removeTag(tag, saveTags, setSaveTags)} className="hover:opacity-70 transition-opacity">
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        );
                      })}
                      <input
                        type="text"
                        value={tagInput}
                        onChange={e => setTagInput(e.target.value.replace(',', ''))}
                        onKeyDown={e => handleTagKeyDown(e, tagInput, setTagInput, saveTags, setSaveTags)}
                        placeholder={saveTags.length === 0 ? 'Add tags… (Enter or comma)' : ''}
                        className="flex-1 min-w-[80px] bg-transparent text-[11px] text-white placeholder:text-white/20
                          focus:outline-none"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {!isValid && (
              <p className="text-white/25 text-xs text-center mt-2">
                Fill in <span className="text-purple-400">utm_source</span> to generate your link
              </p>
            )}
          </GlassCard>

          {/* Quick examples */}
          <GlassCard className="p-5">
            <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-3 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" /> Quick examples — click to load
            </p>
            <div className="space-y-2">
              {[
                { label: 'LinkedIn post → Tools',       source: 'linkedin',  medium: 'social',     campaign: '',          page: '/tools'        },
                { label: 'YouTube description → Home',  source: 'youtube',   medium: 'video',      campaign: 'tutorial',  page: '/'             },
                { label: 'Discord DM → Work with us',   source: 'discord',   medium: 'community',  campaign: '',          page: '/work-with-us' },
                { label: 'Email newsletter → Projects', source: 'email',     medium: 'newsletter', campaign: 'march-drop',page: '/projects'     },
              ].map(ex => (
                <button
                  key={ex.label}
                  onClick={() => {
                    setSource(ex.source); setMedium(ex.medium);
                    setCampaign(ex.campaign); setPage(ex.page);
                    setActivePlat(UTM_PLATFORMS.find(p => p.source === ex.source)?.name ?? null);
                  }}
                  className="w-full text-left px-3 py-2.5 rounded-xl bg-white/4 border border-white/8
                    hover:bg-white/8 hover:border-white/15 transition-all group"
                >
                  <p className="text-white/60 text-xs group-hover:text-white/80 transition-colors">{ex.label}</p>
                  <p className="text-white/25 text-[10px] font-mono mt-0.5">
                    {ex.source}{ex.medium ? ` · ${ex.medium}` : ''}{ex.campaign ? ` · ${ex.campaign}` : ''}
                  </p>
                </button>
              ))}
            </div>
          </GlassCard>

          {/* Saved Links */}
          <GlassCard className="p-5">
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <p className="text-white/40 text-xs font-semibold uppercase tracking-widest flex items-center gap-1.5">
                <Bookmark className="w-3.5 h-3.5 text-purple-400" />
                Saved links
                {savedLinks.length > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold leading-none">
                    {savedLinks.length}
                  </span>
                )}
              </p>
              <button
                onClick={() => { fetchSaved(); fetchStats(); }}
                disabled={loadingSaved}
                className="text-white/25 hover:text-white/60 transition-colors"
                title="Refresh"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingSaved ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Tag filter bar */}
            {(() => {
              const allTags = [...new Set(savedLinks.flatMap(l => l.tags ?? []))].sort();
              if (allTags.length === 0) return null;
              return (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  <button
                    onClick={() => setActiveTag(null)}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all ${
                      activeTag === null
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'bg-white/4 border-white/10 text-white/40 hover:text-white/70 hover:bg-white/8'
                    }`}
                  >
                    All
                  </button>
                  {allTags.map(tag => {
                    const c = tagColor(tag);
                    const active = activeTag === tag;
                    return (
                      <button
                        key={tag}
                        onClick={() => setActiveTag(active ? null : tag)}
                        className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold border transition-all ${
                          active ? `${c.bg} ${c.text} ${c.border} scale-[1.05]` : 'bg-white/4 border-white/10 text-white/40 hover:text-white/70 hover:bg-white/8'
                        }`}
                      >
                        <Tag className="w-2.5 h-2.5" />{tag}
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            {/* List */}
            {loadingSaved && savedLinks.length === 0 ? (
              <div className="flex items-center justify-center py-6">
                <span className="w-5 h-5 border-2 border-white/15 border-t-purple-400 rounded-full animate-spin" />
              </div>
            ) : savedLinks.length === 0 ? (
              <div className="text-center py-6 space-y-1">
                <Bookmark className="w-6 h-6 text-white/15 mx-auto" />
                <p className="text-white/25 text-xs">No saved links yet</p>
                <p className="text-white/15 text-[10px]">Click the <span className="text-purple-400">bookmark</span> icon after building a link</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                <AnimatePresence initial={false}>
                  {savedLinks
                    .filter(l => activeTag === null || (l.tags ?? []).includes(activeTag))
                    .map(link => {
                      const cfg        = link.platform ? srcCfg(link.platform) : srcCfg(link.source);
                      const isDeleting = deletingId === link.id;
                      const isCopied   = copiedId   === link.id;
                      const isEditing  = editingId  === link.id;
                      const stats      = getStats(link);
                      const tags       = link.tags ?? [];
                      return (
                        <motion.div
                          key={link.id}
                          layout
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95, height: 0 }}
                          transition={{ duration: 0.15 }}
                          className="group rounded-xl border border-white/8 bg-white/3 hover:bg-white/5 hover:border-white/14 transition-all overflow-hidden"
                        >
                          {/* Main row */}
                          <div className="flex items-center gap-2.5 p-2.5">
                            {/* Platform icon */}
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg} border ${cfg.border}`}>
                              <FontAwesomeIcon icon={cfg.icon} className="text-sm text-white" />
                            </div>

                            {/* Label + URL + tags */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <p className="text-white/80 text-xs font-semibold truncate leading-tight max-w-[160px]">{link.label}</p>
                                {/* Stats badge */}
                                {stats && stats.sessions > 0 && (
                                  <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-teal-500/15 border border-teal-500/25 text-teal-300 text-[9px] font-bold">
                                    <Activity className="w-2 h-2" />
                                    {stats.sessions}
                                    {stats.converted > 0 && (
                                      <span className="text-emerald-300 ml-0.5">·{stats.converted}✓</span>
                                    )}
                                  </span>
                                )}
                              </div>
                              <p className="text-white/25 text-[10px] font-mono truncate mt-0.5">{link.url}</p>
                              {/* Tag chips */}
                              {tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5">
                                  {tags.map(tag => {
                                    const c = tagColor(tag);
                                    return (
                                      <span key={tag} className={`px-1.5 py-0.5 rounded-full border text-[9px] font-semibold ${c.bg} ${c.text} ${c.border}`}>
                                        {tag}
                                      </span>
                                    );
                                  })}
                                </div>
                              )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                              {/* Edit */}
                              <button
                                onClick={() => {
                                  if (isEditing) { setEditingId(null); return; }
                                  setEditingId(link.id);
                                  setEditLabel(link.label);
                                  setEditTags([...(link.tags ?? [])]);
                                  setEditTagInput('');
                                }}
                                title="Edit label & tags"
                                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${
                                  isEditing
                                    ? 'bg-purple-500/25 text-purple-300'
                                    : 'bg-white/5 hover:bg-purple-500/15 hover:text-purple-300 text-white/40'
                                }`}
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                              {/* Clone */}
                              <button
                                onClick={() => handleClone(link)}
                                title="Clone into builder"
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-amber-500/15
                                  hover:text-amber-300 text-white/40 transition-all"
                              >
                                <Files className="w-3 h-3" />
                              </button>
                              {/* Load */}
                              <button
                                onClick={() => handleLoad(link)}
                                title="Load into builder"
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-purple-500/20
                                  hover:text-purple-300 text-white/40 transition-all"
                              >
                                <RotateCcw className="w-3 h-3" />
                              </button>
                              {/* Copy URL */}
                              <button
                                onClick={() => handleCopySaved(link.url, link.id)}
                                title="Copy URL"
                                className={`w-7 h-7 flex items-center justify-center rounded-lg transition-all ${
                                  isCopied
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70'
                                }`}
                              >
                                {isCopied ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                              </button>
                              {/* Delete */}
                              <button
                                onClick={() => handleDelete(link.id)}
                                disabled={isDeleting}
                                title="Delete"
                                className="w-7 h-7 flex items-center justify-center rounded-lg bg-white/5 hover:bg-red-500/20
                                  hover:text-red-400 text-white/40 transition-all disabled:opacity-40"
                              >
                                {isDeleting
                                  ? <span className="w-3 h-3 border border-white/30 border-t-red-400 rounded-full animate-spin" />
                                  : <Trash2 className="w-3 h-3" />
                                }
                              </button>
                            </div>
                          </div>

                          {/* Inline edit panel */}
                          <AnimatePresence>
                            {isEditing && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.18 }}
                                className="overflow-hidden"
                              >
                                <div className="px-2.5 pb-2.5 space-y-2 border-t border-white/6 pt-2.5">
                                  {/* Edit label */}
                                  <input
                                    type="text"
                                    value={editLabel}
                                    onChange={e => setEditLabel(e.target.value)}
                                    onKeyDown={e => { if (e.key === 'Enter') handlePatch(link.id); if (e.key === 'Escape') setEditingId(null); }}
                                    autoFocus
                                    placeholder="Link label…"
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white
                                      placeholder:text-white/20 focus:outline-none focus:border-purple-500/40 transition-all"
                                  />
                                  {/* Edit tags */}
                                  <div
                                    className="flex flex-wrap items-center gap-1.5 min-h-[28px] bg-white/4 border border-white/10
                                      rounded-lg px-2 py-1 cursor-text focus-within:border-purple-500/40 transition-all"
                                    onClick={e => (e.currentTarget.querySelector('input') as HTMLInputElement)?.focus()}
                                  >
                                    <Tag className="w-2.5 h-2.5 text-white/20 flex-shrink-0" />
                                    {editTags.map(tag => {
                                      const c = tagColor(tag);
                                      return (
                                        <span key={tag} className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full border text-[9px] font-semibold ${c.bg} ${c.text} ${c.border}`}>
                                          {tag}
                                          <button onClick={() => removeTag(tag, editTags, setEditTags)} className="hover:opacity-70">
                                            <X className="w-2 h-2" />
                                          </button>
                                        </span>
                                      );
                                    })}
                                    <input
                                      type="text"
                                      value={editTagInput}
                                      onChange={e => setEditTagInput(e.target.value.replace(',', ''))}
                                      onKeyDown={e => handleTagKeyDown(e, editTagInput, setEditTagInput, editTags, setEditTags)}
                                      placeholder={editTags.length === 0 ? 'Tags…' : ''}
                                      className="flex-1 min-w-[60px] bg-transparent text-[10px] text-white placeholder:text-white/20
                                        focus:outline-none"
                                    />
                                  </div>
                                  {/* Edit actions */}
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => handlePatch(link.id)}
                                      disabled={patching}
                                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold
                                        bg-purple-600 hover:bg-purple-500 border border-purple-500 text-white transition-all disabled:opacity-50"
                                    >
                                      {patching
                                        ? <span className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        : <><CheckCheck className="w-3 h-3" /> Save changes</>
                                      }
                                    </button>
                                    <button
                                      onClick={() => setEditingId(null)}
                                      className="px-3 py-1.5 rounded-lg text-xs text-white/40 hover:text-white/70 border border-white/10
                                        bg-white/4 hover:bg-white/8 transition-all"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                </AnimatePresence>
                {activeTag && savedLinks.filter(l => (l.tags ?? []).includes(activeTag)).length === 0 && (
                  <p className="text-center text-white/25 text-xs py-4">No links tagged <span className="text-white/50">#{activeTag}</span></p>
                )}
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </motion.div>
  );
}

// ── Helpers for overview campaigns ─────────────────────────────────────────────
function getOverviewStats(link: SavedUTM, stats: UtmStats | null) {
  if (!stats) return null;
  const src = normUtm(link.source);
  const med = normUtm(link.medium);
  const cmp = normUtm(link.campaign);
  return stats.exact[`${src}|${med}|${cmp}`]
      ?? stats.bySourceMedium[`${src}|${med}`]
      ?? stats.bySource[src]
      ?? null;
}
function pageLabel(path: string): string {
  const found = SITE_PAGES.find(p => p.path === path);
  if (found) return found.label;
  if (path.startsWith('/tools/')) return path.replace('/tools/', '').replace(/-/g, ' ');
  return path;
}

// ── Main component ─────────────────────────────────────────────────────────────
export function ReferrersTab() {
  const [data,             setData]             = useState<ReferrersData | null>(null);
  const [loading,          setLoading]          = useState(false);
  const [error,            setError]            = useState('');
  const [range,            setRange]            = useState<number>(30);
  const [expanded,         setExpanded]         = useState<string | null>(null);
  const [activeView,       setActiveView]       = useState<'overview' | 'pages' | 'daily' | 'utm' | 'countries'>('overview');
  // campaigns overlay for overview card
  const [overviewLinks,    setOverviewLinks]    = useState<SavedUTM[]>([]);
  const [overviewStats,    setOverviewStats]    = useState<UtmStats | null>(null);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [statsDiag,        setStatsDiag]        = useState<{ totalSessions: number; utmSessions: number; utmKeys: string[] } | null>(null);
  // Session inspector
  const [debugOpen,        setDebugOpen]        = useState(false);
  const [debugSessions,    setDebugSessions]    = useState<any[]>([]);
  const [debugTotal,       setDebugTotal]       = useState(0);
  const [debugLoading,     setDebugLoading]     = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams();
      if (range < 999) {
        const from = new Date(); from.setDate(from.getDate() - range);
        params.set('from', from.toISOString().split('T')[0]);
      }
      const res  = await fetch(`${API_BASE}/admin/referrers?${params}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) setData(json.data);
      else setError(json.error || 'Failed to load referrer data');
    } catch (err: any) {
      setError(err.message || 'Network error');
    } finally {
      setLoading(false);
    }
  }, [range]);

  useEffect(() => { load(); }, [load]);

  // ── Load saved links + session stats for the overview campaigns card ────────
  const loadCampaigns = useCallback(async () => {
    setCampaignsLoading(true);
    try {
      const [linksRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/utm-saved`,       { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/utm-saved/stats`, { headers: getAuthHeaders() }),
      ]);
      const [linksJson, statsJson] = await Promise.all([linksRes.json(), statsRes.json()]);
      if (linksJson.success) setOverviewLinks(linksJson.data ?? []);
      if (statsJson.success) {
        setOverviewStats(statsJson.data);
        if (statsJson._diag) setStatsDiag(statsJson._diag);
      }
    } catch (err) {
      console.error('[ReferrersTab] campaigns load error:', err);
    } finally {
      setCampaignsLoading(false);
    }
  }, []);

  useEffect(() => { loadCampaigns(); }, [loadCampaigns]);

  const loadDebugSessions = useCallback(async () => {
    setDebugLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/admin/debug/sessions`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) { setDebugSessions(json.data.recent); setDebugTotal(json.data.total); }
    } catch (err) { console.error('[ReferrersTab] debug sessions error:', err); }
    finally { setDebugLoading(false); }
  }, []);

  const bestConverter = data?.sources.reduce<SourceRow | null>((best, s) =>
    s.sessions >= 3 && (!best || s.convRate > best.convRate) ? s : best, null);
  const topByVisits = data?.sources[0] ?? null;

  // ── Ranked campaigns sorted by sessions desc ────────────────────────────────
  const topCampaigns = overviewLinks
    .map(link => {
      const st = getOverviewStats(link, overviewStats);
      return { link, sessions: st?.sessions ?? 0, converted: st?.converted ?? 0 };
    })
    .sort((a, b) => b.sessions - a.sessions)
    .slice(0, 8);
  const maxCampaignSessions = topCampaigns[0]?.sessions || 1;

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Link2 className="w-5 h-5 text-purple-400" />
            Traffic Sources
          </h2>
          <p className="text-white/40 text-sm mt-0.5">Where your visitors come from — and which channels convert</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Range picker */}
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl p-1">
            <Calendar className="w-3.5 h-3.5 text-white/30 ml-1.5" />
            {RANGES.map(r => (
              <button
                key={r.label}
                onClick={() => setRange(r.days)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  range === r.days
                    ? 'bg-purple-600 text-white shadow'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => { load(); loadCampaigns(); }}
            disabled={loading || campaignsLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/5 border border-white/10
              text-white/50 hover:text-white/80 transition-colors text-sm disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading || campaignsLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Error ── */}
      {error && (
        <GlassCard className="p-4 border-red-500/20 bg-red-500/5">
          <p className="text-red-400 text-sm">{error}</p>
        </GlassCard>
      )}

      {/* ── Loading skeleton ── */}
      {loading && !data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <GlassCard key={i} className="p-5 animate-pulse">
              <div className="h-3 w-24 bg-white/10 rounded mb-3" />
              <div className="h-8 w-16 bg-white/10 rounded" />
            </GlassCard>
          ))}
        </div>
      )}

      {data && (
        <>
          {/* ── KPI cards ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <GlassCard className="p-5">
              <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-1">Total Sessions</p>
              <p className="text-3xl font-bold text-white">{data.total.toLocaleString()}</p>
              <p className="text-white/30 text-xs mt-1 flex items-center gap-1">
                <Users className="w-3 h-3" /> from all sources
              </p>
            </GlassCard>

            <GlassCard className="p-5">
              <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-1">Top Source</p>
              {topByVisits ? (
                <>
                  <p className="text-xl font-bold text-white flex items-center gap-2">
                    <FontAwesomeIcon icon={srcCfg(topByVisits.name).icon} className="text-white" />
                    <span>{topByVisits.name}</span>
                  </p>
                  <p className="text-white/30 text-xs mt-1 flex items-center gap-1">
                    <Globe className="w-3 h-3" /> {topByVisits.sessions} sessions
                  </p>
                </>
              ) : <p className="text-white/30 text-sm">No data yet</p>}
            </GlassCard>

            <GlassCard className="p-5">
              <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-1">Best Converter</p>
              {bestConverter ? (
                <>
                  <p className="text-xl font-bold text-white flex items-center gap-2">
                    <FontAwesomeIcon icon={srcCfg(bestConverter.name).icon} className="text-white" />
                    <span>{bestConverter.name}</span>
                  </p>
                  <p className="text-white/30 text-xs mt-1 flex items-center gap-1">
                    <Zap className="w-3 h-3 text-amber-400" />
                    <span className="text-amber-400">{bestConverter.convRate}%</span> conv. rate
                  </p>
                </>
              ) : <p className="text-white/30 text-sm">No conversions yet</p>}
            </GlassCard>

            <GlassCard className="p-5">
              <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-1">Total Conversions</p>
              <p className="text-3xl font-bold text-emerald-400">
                {data.sources.reduce((s, r) => s + r.converted, 0)}
              </p>
              <p className="text-white/30 text-xs mt-1 flex items-center gap-1">
                <ShoppingCart className="w-3 h-3" /> purchases tracked
              </p>
            </GlassCard>
          </div>

          {/* ── View switcher ── */}
          <div className="flex gap-1 bg-white/5 border border-white/10 rounded-xl p-1 w-fit flex-wrap">
            {(['overview', 'daily', 'pages', 'countries', 'utm'] as const).map(v => (
              <button
                key={v}
                onClick={() => setActiveView(v)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold capitalize transition-all ${
                  activeView === v ? 'bg-purple-600 text-white' : 'text-white/40 hover:text-white/70'
                }`}
              >
                {v === 'overview' ? '📊 Overview'
                  : v === 'daily' ? '📈 Daily trend'
                  : v === 'pages' ? '📄 By page'
                  : v === 'countries' ? '🌍 Countries'
                  : '🔗 UTM Builder'}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* ────────── OVERVIEW ────────── */}
            {activeView === 'overview' && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="space-y-5"
              >
                {/* Charts row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* Donut — sessions by source */}
                  <GlassCard className="p-5">
                    <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-4 flex items-center gap-2">
                      <Users className="w-3.5 h-3.5" /> Sessions by source
                    </p>
                    <div className="flex items-center gap-4">
                      <ResponsiveContainer width="55%" height={200}>
                        <PieChart>
                          <Pie
                            data={data.sources}
                            dataKey="sessions"
                            nameKey="name"
                            cx="50%" cy="50%"
                            innerRadius={54} outerRadius={82}
                            paddingAngle={2}
                          >
                            {data.sources.map((s, i) => (
                              <Cell key={s.name} fill={srcCfg(s.name).color ?? PIE_COLORS[i % PIE_COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip content={<ChartTip />} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex-1 space-y-1.5 text-xs overflow-hidden">
                        {data.sources.slice(0, 8).map((s, i) => {
                          const pct = data.total > 0 ? Math.round(s.sessions / data.total * 100) : 0;
                          return (
                            <div key={s.name} className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full flex-shrink-0"
                                style={{ background: srcCfg(s.name).color ?? PIE_COLORS[i % PIE_COLORS.length] }} />
                              <span className="text-white/60 truncate flex-1">{s.name}</span>
                              <span className="text-white font-semibold">{pct}%</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </GlassCard>

                  {/* Bar — conversions by source */}
                  <GlassCard className="p-5">
                    <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-4 flex items-center gap-2">
                      <ShoppingCart className="w-3.5 h-3.5" /> Conversions by source
                    </p>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart
                        data={data.sources.filter(s => s.converted > 0).slice(0, 8)}
                        layout="vertical"
                        margin={{ left: 8, right: 30, top: 0, bottom: 0 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" horizontal={false} />
                        <XAxis type="number" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis type="category" dataKey="name" tick={{ fill: 'rgba(255,255,255,0.5)', fontSize: 10 }} axisLine={false} tickLine={false} width={90} />
                        <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                        <Bar dataKey="converted" name="Conversions" radius={[0, 4, 4, 0]}>
                          {data.sources.filter(s => s.converted > 0).slice(0, 8).map((s, i) => (
                            <Cell key={s.name} fill={srcCfg(s.name).color ?? PIE_COLORS[i % PIE_COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </GlassCard>
                </div>

                {/* ── Top Campaigns ── */}
                <GlassCard className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-white/60 text-xs font-semibold uppercase tracking-widest flex items-center gap-2">
                      <Bookmark className="w-3.5 h-3.5 text-purple-400" /> Top Campaigns
                    </p>
                    <div className="flex items-center gap-2">
                      {campaignsLoading && <RefreshCw className="w-3 h-3 text-white/25 animate-spin" />}
                      <button
                        onClick={loadCampaigns}
                        title="Refresh campaigns"
                        className="p-1 text-white/20 hover:text-purple-400 transition-colors"
                      >
                        <RefreshCw className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => setActiveView('utm')}
                        className="text-purple-400 hover:text-purple-300 text-xs flex items-center gap-1 transition-colors"
                      >
                        View all <ArrowUpRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Diagnostic strip — shows KV session counts for debugging */}
                  {statsDiag && (
                    <div className="flex items-center gap-3 mb-3 px-2 py-1.5 rounded-lg bg-white/3 border border-white/6 text-[10px] text-white/30">
                      <span>KV sessions: <span className="text-white/50 font-mono">{statsDiag.totalSessions}</span></span>
                      <span className="text-white/10">|</span>
                      <span>With UTM: <span className={`font-mono ${statsDiag.utmSessions > 0 ? 'text-green-400/70' : 'text-white/50'}`}>{statsDiag.utmSessions}</span></span>
                      {statsDiag.utmKeys.length > 0 && (
                        <>
                          <span className="text-white/10">|</span>
                          <span className="truncate font-mono text-purple-400/50">{statsDiag.utmKeys.slice(0, 2).join(', ')}</span>
                        </>
                      )}
                    </div>
                  )}

                  {campaignsLoading && overviewLinks.length === 0 ? (
                    <div className="space-y-2">
                      {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-14 rounded-xl bg-white/5 animate-pulse" />
                      ))}
                    </div>
                  ) : overviewLinks.length === 0 ? (
                    <div className="py-8 text-center">
                      <Link2 className="w-8 h-8 text-white/10 mx-auto mb-2" />
                      <p className="text-white/25 text-sm">No campaigns saved yet</p>
                      <button
                        onClick={() => setActiveView('utm')}
                        className="mt-2 text-purple-400 hover:text-purple-300 text-xs underline transition-colors"
                      >
                        Open UTM Builder →
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {topCampaigns.map(({ link, sessions, converted }, i) => {
                        const cfg      = srcCfg(link.platform ?? link.source);
                        const convRate = sessions > 0 ? Math.round(converted / sessions * 100) : 0;
                        const pct      = maxCampaignSessions > 0 ? Math.round(sessions / maxCampaignSessions * 100) : 0;
                        const tags     = (link.tags ?? []).slice(0, 2);
                        const extra    = (link.tags ?? []).length - 2;
                        return (
                          <div
                            key={link.id}
                            className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${cfg.border} hover:bg-white/4 transition-colors`}
                          >
                            {/* rank */}
                            <span className="text-white/20 text-[10px] font-mono w-4 text-center flex-shrink-0">
                              #{i + 1}
                            </span>

                            {/* platform icon */}
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${cfg.bg} border ${cfg.border}`}>
                              <FontAwesomeIcon icon={cfg.icon} className="text-sm" style={{ color: cfg.color }} />
                            </div>

                            {/* label + page + tags */}
                            <div className="flex-1 min-w-0">
                              <p className="text-white/85 text-xs font-medium truncate leading-tight">{link.label}</p>
                              <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <code className="text-white/30 text-[10px] font-mono">{pageLabel(link.page)}</code>
                                {tags.map(tag => {
                                  const tc = tagColor(tag);
                                  return (
                                    <span key={tag} className={`text-[9px] px-1.5 py-px rounded-full border font-medium ${tc.bg} ${tc.text} ${tc.border}`}>
                                      {tag}
                                    </span>
                                  );
                                })}
                                {extra > 0 && (
                                  <span className="text-white/20 text-[9px]">+{extra}</span>
                                )}
                              </div>
                            </div>

                            {/* mini progress bar */}
                            <div className="hidden sm:block w-20 flex-shrink-0">
                              <div className="h-1 rounded-full bg-white/8 overflow-hidden">
                                <div
                                  className="h-full rounded-full transition-all duration-500"
                                  style={{ width: `${pct}%`, background: cfg.color }}
                                />
                              </div>
                            </div>

                            {/* sessions count */}
                            <div className="text-right flex-shrink-0 min-w-[42px]">
                              <p className="text-white font-bold text-sm tabular-nums leading-tight">{sessions}</p>
                              <p className="text-white/25 text-[9px] uppercase tracking-wide">sessions</p>
                            </div>

                            {/* conv rate pill */}
                            <div className="flex-shrink-0 w-[52px] text-right">
                              {convRate > 0 ? (
                                <span className="text-[10px] font-semibold bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 px-2 py-0.5 rounded-full">
                                  {convRate}% CR
                                </span>
                              ) : (
                                <span className="text-white/15 text-[10px]">—</span>
                              )}
                            </div>
                          </div>
                        );
                      })}

                      {overviewLinks.length > 8 && (
                        <p className="text-center text-white/20 text-[10px] pt-1">
                          +{overviewLinks.length - 8} more —{' '}
                          <button
                            onClick={() => setActiveView('utm')}
                            className="text-purple-400/60 hover:text-purple-400 underline transition-colors"
                          >
                            view all in UTM Builder
                          </button>
                        </p>
                      )}
                    </div>
                  )}
                </GlassCard>

                {/* Source cards */}
                <div className="space-y-3">
                  <h3 className="text-white/50 text-xs font-semibold uppercase tracking-widest flex items-center gap-2">
                    <Filter className="w-3.5 h-3.5" /> Source breakdown
                  </h3>
                  {data.sources.map(s => {
                    const cfg = srcCfg(s.name);
                    const isOpen = expanded === s.name;
                    return (
                      <GlassCard key={s.name} className={`overflow-hidden border ${cfg.border} transition-all`}>
                        <button
                          onClick={() => setExpanded(isOpen ? null : s.name)}
                          className="w-full p-4 flex items-center gap-4 text-left hover:bg-white/2 transition-colors"
                        >
                          {/* Source name */}
                          <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.bg} border ${cfg.border}`}>
                            <FontAwesomeIcon icon={cfg.icon} className="text-base text-white" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-semibold text-sm">{s.name}</p>
                            <p className="text-white/30 text-xs">{s.sessions} sessions</p>
                          </div>

                          {/* Stats */}
                          <div className="hidden sm:flex items-center gap-6 text-center">
                            <div>
                              <p className="text-white font-bold text-sm">{s.sessions}</p>
                              <p className="text-white/30 text-[10px] uppercase">Visits</p>
                            </div>
                            <div>
                              <p className="text-emerald-400 font-bold text-sm">{s.converted}</p>
                              <p className="text-white/30 text-[10px] uppercase">Sales</p>
                            </div>
                            <div>
                              <p style={{ color: cfg.color }} className="font-bold text-sm">{s.convRate}%</p>
                              <p className="text-white/30 text-[10px] uppercase">Conv.</p>
                            </div>
                            <div>
                              <p className="text-white font-bold text-sm">{s.bounceRate}%</p>
                              <p className="text-white/30 text-[10px] uppercase">Bounce</p>
                            </div>
                            <div>
                              <p className="text-white font-bold text-sm">{fmtDur(s.avgDuration)}</p>
                              <p className="text-white/30 text-[10px] uppercase">Avg. time</p>
                            </div>
                          </div>

                          {/* Conv bar */}
                          <div className="hidden md:block w-24">
                            <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{ width: `${Math.min(s.convRate, 100)}%`, background: cfg.color }}
                              />
                            </div>
                            <p className="text-right text-[10px] text-white/30 mt-0.5">{s.convRate}% CR</p>
                          </div>

                          {isOpen ? <ChevronUp className="w-4 h-4 text-white/30 flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-white/30 flex-shrink-0" />}
                        </button>

                        {/* Expanded: top pages */}
                        <AnimatePresence>
                          {isOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }}
                              className="border-t border-white/8 px-4 pb-4 pt-3"
                            >
                              {/* Mobile stats */}
                              <div className="grid grid-cols-4 gap-3 mb-4 sm:hidden">
                                {[
                                  { label: 'Visits',   value: s.sessions,    color: '' },
                                  { label: 'Sales',    value: s.converted,   color: 'text-emerald-400' },
                                  { label: 'Conv.',    value: `${s.convRate}%`, color: '' },
                                  { label: 'Bounce',   value: `${s.bounceRate}%`, color: '' },
                                ].map(m => (
                                  <div key={m.label} className="text-center bg-white/4 rounded-xl p-2">
                                    <p className={`text-white font-bold text-sm ${m.color}`}>{m.value}</p>
                                    <p className="text-white/30 text-[10px]">{m.label}</p>
                                  </div>
                                ))}
                              </div>

                              <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2 flex items-center gap-1.5">
                                <ArrowUpRight className="w-3 h-3" /> Top landing pages from this source
                              </p>
                              {s.topPages.length === 0 ? (
                                <p className="text-white/25 text-xs">No page data yet</p>
                              ) : (
                                <div className="space-y-1.5">
                                  {s.topPages.map(pg => {
                                    const max = s.topPages[0]?.count || 1;
                                    return (
                                      <div key={pg.page} className="flex items-center gap-3">
                                        <code className="text-white/60 text-xs font-mono flex-1 truncate">{pg.page}</code>
                                        <div className="w-24 h-1.5 rounded-full bg-white/10 overflow-hidden flex-shrink-0">
                                          <div
                                            className="h-full rounded-full"
                                            style={{ width: `${(pg.count / max) * 100}%`, background: cfg.color }}
                                          />
                                        </div>
                                        <span className="text-white/50 text-xs w-6 text-right">{pg.count}</span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </GlassCard>
                    );
                  })}

                  {data.sources.length === 0 && (
                    <GlassCard className="p-10 text-center">
                      <Link2 className="w-8 h-8 text-white/20 mx-auto mb-3" />
                      <p className="text-white/30 text-sm">No traffic data yet for this period.</p>
                      <p className="text-white/20 text-xs mt-1">
                        Add <code className="bg-white/10 px-1 rounded">?utm_source=linkedin</code> to your links for instant attribution.
                      </p>
                    </GlassCard>
                  )}
                </div>

                {/* ── Session Inspector ── */}
                <GlassCard className="overflow-hidden">
                  <button
                    onClick={() => {
                      setDebugOpen(o => !o);
                      if (!debugOpen && debugSessions.length === 0) loadDebugSessions();
                    }}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-white/3 transition-colors"
                  >
                    <span className="text-white/35 text-xs font-semibold uppercase tracking-widest flex items-center gap-2">
                      <Activity className="w-3.5 h-3.5 text-purple-400/60" />
                      Session Inspector
                      {statsDiag && (
                        <span className="font-normal text-white/20 normal-case tracking-normal">
                          — {statsDiag.totalSessions} total · {statsDiag.utmSessions} with UTM
                        </span>
                      )}
                    </span>
                    <div className="flex items-center gap-2">
                      {debugOpen && (
                        <button
                          onClick={e => { e.stopPropagation(); loadDebugSessions(); }}
                          className="p-1 text-white/20 hover:text-purple-400 transition-colors"
                        >
                          <RefreshCw className={`w-3 h-3 ${debugLoading ? 'animate-spin' : ''}`} />
                        </button>
                      )}
                      <ChevronDown className={`w-4 h-4 text-white/20 transition-transform ${debugOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </button>

                  {debugOpen && (
                    <div className="border-t border-white/8">
                      {debugLoading && debugSessions.length === 0 ? (
                        <div className="flex items-center justify-center py-8 gap-2 text-white/25 text-sm">
                          <RefreshCw className="w-4 h-4 animate-spin" /> Loading sessions…
                        </div>
                      ) : debugSessions.length === 0 ? (
                        <div className="py-8 text-center text-white/25 text-sm">
                          No sessions in KV yet — visit a page from your UTM link first.
                        </div>
                      ) : (
                        <div className="divide-y divide-white/5 max-h-72 overflow-y-auto">
                          {debugSessions.map((s, i) => (
                            <div key={s.sessionId ?? i} className="px-5 py-3 flex items-start gap-3 hover:bg-white/2 transition-colors">
                              {/* time */}
                              <span className="text-white/20 text-[10px] font-mono flex-shrink-0 pt-0.5 w-28">
                                {new Date(s.startedAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
                              {/* device */}
                              <span className="text-white/30 text-[10px] flex-shrink-0 pt-0.5 w-14">{s.device}</span>
                              {/* pages */}
                              <div className="flex-1 min-w-0">
                                <div className="flex flex-wrap gap-1">
                                  {(s.pages as string[]).map(p => (
                                    <code key={p} className="text-[10px] bg-white/6 px-1.5 py-0.5 rounded text-white/50">{p || '/'}</code>
                                  ))}
                                  {s.pageViews === 0 && <span className="text-white/15 text-[10px]">no page_views</span>}
                                </div>
                              </div>
                              {/* utm */}
                              <div className="flex-shrink-0 text-right min-w-[80px]">
                                {s.utmSource ? (
                                  <span className="text-[10px] font-mono text-green-400/80 bg-green-500/10 px-1.5 py-0.5 rounded border border-green-500/20">
                                    {s.utmSource}{s.utmMedium ? `/${s.utmMedium}` : ''}
                                  </span>
                                ) : (
                                  <span className="text-white/15 text-[10px]">no UTM</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="px-5 py-2 border-t border-white/5 text-white/20 text-[10px] flex items-center justify-between">
                        <span>Showing latest 20 of {debugTotal} total sessions</span>
                        <span className="font-mono">{statsDiag?.utmKeys.slice(0,3).join(' · ') || '—'}</span>
                      </div>
                    </div>
                  )}
                </GlassCard>
              </motion.div>
            )}

            {/* ────────── DAILY TREND ────────── */}
            {activeView === 'daily' && (
              <motion.div
                key="daily"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              >
                <GlassCard className="p-5">
                  <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-4 flex items-center gap-2">
                    <TrendingUp className="w-3.5 h-3.5" /> Daily sessions by source — last 30 days
                  </p>
                  {data.dailySeries.length === 0 ? (
                    <p className="text-white/30 text-sm text-center py-10">No data for this period</p>
                  ) : (
                    <ResponsiveContainer width="100%" height={360}>
                      <LineChart data={data.dailySeries} margin={{ left: -10, right: 16, top: 4, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                        <XAxis
                          dataKey="date"
                          tickFormatter={shortDate}
                          tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }}
                          axisLine={false} tickLine={false}
                          interval={4}
                        />
                        <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTip />} />
                        <Legend
                          formatter={(v) => <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 11 }}>{v}</span>}
                        />
                        {data.topSourceNames.map((src, i) => (
                          <Line
                            key={src}
                            type="monotone"
                            dataKey={src}
                            stroke={srcCfg(src).color ?? PIE_COLORS[i % PIE_COLORS.length]}
                            strokeWidth={2}
                            dot={false}
                            activeDot={{ r: 4 }}
                          />
                        ))}
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </GlassCard>

                {/* Conv rate bar chart by source */}
                <GlassCard className="p-5 mt-5">
                  <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-4 flex items-center gap-2">
                    <MousePointer className="w-3.5 h-3.5" /> Conversion rate by source (%)
                  </p>
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={data.sources.slice(0, 10)} margin={{ left: -10, right: 16 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                      <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 9 }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fill: 'rgba(255,255,255,0.3)', fontSize: 10 }} axisLine={false} tickLine={false} unit="%" />
                      <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                      <Bar dataKey="convRate" name="Conv. Rate (%)" radius={[4, 4, 0, 0]}>
                        {data.sources.slice(0, 10).map((s, i) => (
                          <Cell key={s.name} fill={srcCfg(s.name).color ?? PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </GlassCard>
              </motion.div>
            )}

            {/* ────────── BY PAGE ────────── */}
            {activeView === 'pages' && (
              <motion.div
                key="pages"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              >
                <GlassCard className="p-5">
                  <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-4 flex items-center gap-2">
                    <BarChart2 className="w-3.5 h-3.5" /> Pages × sources — where each channel lands
                  </p>
                  {data.pageBreakdown.length === 0 ? (
                    <p className="text-white/30 text-sm text-center py-10">No page data yet</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs text-left">
                        <thead>
                          <tr className="border-b border-white/8">
                            <th className="text-white/30 font-semibold py-2 pr-4 uppercase tracking-wider">Page</th>
                            <th className="text-white/30 font-semibold py-2 pr-4 uppercase tracking-wider text-right">Total</th>
                            {/* Show top source names as columns */}
                            {data.topSourceNames.slice(0, 5).map(src => (
                              <th key={src} className="text-white/30 font-semibold py-2 px-3 uppercase tracking-wider text-right whitespace-nowrap">
                                <FontAwesomeIcon icon={srcCfg(src).icon} className="mr-1 text-white/60" />{src}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {data.pageBreakdown.map(row => (
                            <tr key={row.page} className="border-b border-white/5 hover:bg-white/2 transition-colors group">
                              <td className="py-2.5 pr-4">
                                <code className="text-purple-300/80 font-mono group-hover:text-purple-300 transition-colors">
                                  {row.page}
                                </code>
                              </td>
                              <td className="py-2.5 pr-4 text-right">
                                <span className="text-white font-semibold">{row.total}</span>
                              </td>
                              {data.topSourceNames.slice(0, 5).map(src => {
                                const count = row.sources[src] || 0;
                                const cfg   = srcCfg(src);
                                return (
                                  <td key={src} className="py-2.5 px-3 text-right">
                                    {count > 0 ? (
                                      <span className={`inline-flex items-center justify-center px-2 py-0.5 rounded-full font-semibold
                                        ${cfg.bg} border ${cfg.border}`} style={{ color: cfg.color }}>
                                        {count}
                                      </span>
                                    ) : (
                                      <span className="text-white/15">—</span>
                                    )}
                                  </td>
                                );
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </GlassCard>

                {/* Heatmap-style: top source per page */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mt-5">
                  {data.pageBreakdown.slice(0, 9).map(row => {
                    const topSrc = Object.entries(row.sources).sort(([, a], [, b]) => b - a)[0];
                    const cfg = topSrc ? srcCfg(topSrc[0]) : DEFAULT_CFG;
                    return (
                      <GlassCard key={row.page} className={`p-4 border ${cfg.border}`}>
                        <code className="text-white/70 text-xs font-mono block truncate mb-2">{row.page}</code>
                        <p className="text-white/30 text-[10px] uppercase tracking-wider mb-1">Top source</p>
                        {topSrc ? (
                          <p className="font-semibold text-sm" style={{ color: cfg.color }}>
                            <FontAwesomeIcon icon={cfg.icon} className="mr-1 text-white" />{topSrc[0]}
                            <span className="text-white/30 font-normal ml-1">({topSrc[1]})</span>
                          </p>
                        ) : (
                          <p className="text-white/25 text-sm">—</p>
                        )}
                        <div className="mt-2 flex flex-wrap gap-1">
                          {Object.entries(row.sources)
                            .sort(([, a], [, b]) => b - a).slice(0, 4)
                            .map(([src, cnt]) => {
                              const sc = srcCfg(src);
                              return (
                                <span key={src} className={`text-[10px] px-1.5 py-0.5 rounded-full ${sc.bg} border ${sc.border}`}
                                  style={{ color: sc.color }}>
                                  <FontAwesomeIcon icon={sc.icon} className="mr-0.5 text-white" />{cnt}
                                </span>
                              );
                            })}
                        </div>
                      </GlassCard>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ────────── COUNTRIES ────────── */}
            {activeView === 'countries' && (
              <motion.div
                key="countries"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="space-y-5"
              >
                {!data.byCountry || data.byCountry.length === 0 ? (
                  <GlassCard className="p-10 text-center">
                    <p className="text-4xl mb-3">🌍</p>
                    <p className="text-white/40 text-sm">No country data yet.</p>
                    <p className="text-white/25 text-xs mt-1">Country tracking is active — data will appear as new sessions arrive.</p>
                  </GlassCard>
                ) : (() => {
                  const total = data.byCountry!.reduce((s, c) => s + c.sessions, 0) || 1;
                  const max   = data.byCountry![0]?.sessions || 1;
                  return (
                    <>
                      {/* KPI strip */}
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <GlassCard className="p-5">
                          <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-1">Countries</p>
                          <p className="text-3xl font-bold text-white">{data.byCountry!.filter(c => c.code !== 'Unknown').length}</p>
                          <p className="text-white/30 text-xs mt-1">unique countries detected</p>
                        </GlassCard>
                        <GlassCard className="p-5">
                          <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-1">Top Country</p>
                          <p className="text-2xl font-bold text-white flex items-center gap-2">
                            <span className="text-3xl leading-none">{countryFlag(data.byCountry![0].code)}</span>
                            <span className="truncate">{countryName(data.byCountry![0].code)}</span>
                          </p>
                          <p className="text-white/30 text-xs mt-1">{data.byCountry![0].sessions} sessions</p>
                        </GlassCard>
                        <GlassCard className="p-5 col-span-2 sm:col-span-1">
                          <p className="text-white/40 text-xs font-semibold uppercase tracking-widest mb-1">Top Share</p>
                          <p className="text-3xl font-bold text-purple-400">
                            {Math.round((data.byCountry![0].sessions / total) * 100)}%
                          </p>
                          <p className="text-white/30 text-xs mt-1">of total sessions</p>
                        </GlassCard>
                      </div>

                      {/* Ranked list */}
                      <GlassCard className="p-5">
                        <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-5 flex items-center gap-2">
                          <Globe className="w-3.5 h-3.5" /> Sessions by country
                        </p>
                        <div className="space-y-3">
                          {data.byCountry!.map((row, i) => {
                            const pct     = Math.round((row.sessions / total) * 100);
                            const barPct  = Math.round((row.sessions / max) * 100);
                            const convPct = row.sessions > 0 ? Math.round((row.converted / row.sessions) * 100) : 0;
                            return (
                              <div key={row.code} className="group">
                                <div className="flex items-center gap-3 mb-1">
                                  {/* rank */}
                                  <span className="text-white/20 text-xs font-mono w-5 text-right flex-shrink-0">{i + 1}</span>
                                  {/* flag + name */}
                                  <span className="text-xl leading-none flex-shrink-0">{countryFlag(row.code)}</span>
                                  <span className="text-white/80 text-sm font-medium flex-1 truncate">
                                    {countryName(row.code)}
                                    {row.code !== 'Unknown' && (
                                      <span className="text-white/25 text-xs font-mono ml-1.5">{row.code}</span>
                                    )}
                                  </span>
                                  {/* conversion badge */}
                                  {row.converted > 0 && (
                                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 flex-shrink-0">
                                      {convPct}% conv
                                    </span>
                                  )}
                                  {/* sessions count + pct */}
                                  <span className="text-white font-bold text-sm flex-shrink-0">{row.sessions.toLocaleString()}</span>
                                  <span className="text-white/30 text-xs w-10 text-right flex-shrink-0">{pct}%</span>
                                </div>
                                {/* progress bar */}
                                <div className="ml-8 h-1.5 rounded-full bg-white/5 overflow-hidden">
                                  <motion.div
                                    className="h-full rounded-full bg-gradient-to-r from-purple-500 to-violet-400"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${barPct}%` }}
                                    transition={{ duration: 0.6, delay: i * 0.03, ease: 'easeOut' }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </GlassCard>

                      {/* Pie chart */}
                      <GlassCard className="p-5">
                        <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-4 flex items-center gap-2">
                          <Users className="w-3.5 h-3.5" /> Distribution (top 10)
                        </p>
                        <div className="flex items-center gap-6 flex-wrap">
                          <PieChart width={200} height={200}>
                            <Pie
                              data={data.byCountry!.slice(0, 10)}
                              dataKey="sessions"
                              nameKey="code"
                              cx="50%" cy="50%"
                              innerRadius={55} outerRadius={90}
                              paddingAngle={2}
                            >
                              {data.byCountry!.slice(0, 10).map((row, i) => (
                                <Cell key={row.code} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                              ))}
                            </Pie>
                            <Tooltip
                              formatter={(v: number, _n: any, p: any) => [v, countryName(p.payload.code)]}
                              contentStyle={{ background: 'rgba(15,10,30,0.95)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 10, fontSize: 11 }}
                              labelStyle={{ display: 'none' }}
                            />
                          </PieChart>
                          <div className="flex flex-col gap-1.5 flex-1 min-w-[160px]">
                            {data.byCountry!.slice(0, 10).map((row, i) => (
                              <div key={row.code} className="flex items-center gap-2 text-xs">
                                <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                                <span className="text-base leading-none">{countryFlag(row.code)}</span>
                                <span className="text-white/60 truncate flex-1">{countryName(row.code)}</span>
                                <span className="text-white font-semibold">{row.sessions}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </GlassCard>
                    </>
                  );
                })()}
              </motion.div>
            )}

            {/* ────────── UTM BUILDER ────────── */}
            {activeView === 'utm' && <UTMBuilder />}
          </AnimatePresence>

          {/* ── UTM tip ── */}
          <GlassCard className="p-4 border-purple-500/20 bg-purple-500/5">
            <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-2 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-purple-400" /> UTM tip — get precise attribution
            </p>
            <p className="text-white/40 text-xs leading-relaxed">
              Add UTM parameters to your links for exact source tracking. Without them, only referrer headers are used (which DMs and some apps strip).
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {[
                { src: 'linkedin',  medium: 'social' },
                { src: 'youtube',   medium: 'video'  },
                { src: 'x',        medium: 'social' },
                { src: 'discord',   medium: 'community' },
                { src: 'email',     medium: 'email'  },
              ].map(({ src, medium }) => (
                <code key={src} className="text-purple-300/70 bg-purple-500/10 border border-purple-500/20
                  rounded px-2 py-1 text-[10px] font-mono">
                  ?utm_source={src}&utm_medium={medium}
                </code>
              ))}
            </div>
          </GlassCard>
        </>
      )}
    </div>
  );
}