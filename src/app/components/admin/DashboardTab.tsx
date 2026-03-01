import { useState, useEffect, useCallback, useRef } from 'react';
import { GlassCard } from '../shared/GlassCard';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  Download, Users, MessageSquare, Wrench, FolderOpen, TrendingUp,
  RefreshCw, Mail, Bell, BellDot, Eye, EyeOff, Trash2,
  CheckCheck, ChevronDown, ChevronUp, BarChart2, LayoutDashboard,
  Inbox, Calendar, Tag, Clock, ArrowUpRight, Activity,
  Sparkles, Circle, CheckCircle2, ExternalLink, DollarSign, ShoppingCart,
  RotateCcw, BadgeDollarSign, TrendingDown, Play, Globe,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { LSRevenuePanel } from './LSRevenuePanel';
import { BehaviorTab } from './BehaviorTab';
import { VideoStatsTab } from './VideoStatsTab';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

function getAuthHeaders() {
  const token = localStorage.getItem('admin_token');
  return {
    'Authorization': `Bearer ${publicAnonKey}`,
    'X-Admin-Token': token || '',
  };
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface DashboardStats {
  totalLeads: number;
  freeDownloads: number;
  signups: number;
  totalTools: number;
  totalProjects: number;
  totalMessages: number;
  unreadMessages: number;
  newLeads30d: number;
  // Revenue
  totalRevenue: number;
  revenue30d: number;
  revenue7d: number;
  totalSales: number;
  totalRefunded: number;
  refundCount: number;
}

interface SeriesPoint {
  date: string;
  downloads: number;
  signups: number;
  messages: number;
  revenue: number;
  sales: number;
}

interface TopTool {
  name: string;
  category: string;
  slug: string;
  count: number;
}

interface DownloadsByTool {
  name: string;
  count: number;
}

interface LeadSource {
  name: string;
  value: number;
}

interface ActivityItem {
  email: string;
  displayName?: string;
  toolName?: string;
  toolSlug?: string;
  productName?: string;
  variantName?: string;
  amount?: number;
  currency?: string;
  activityType: 'download' | 'signup' | 'purchase';
  downloadedAt?: string;
  createdAt?: string;
}

interface Message {
  kvKey: string;
  id: string;
  type: 'contact' | 'support';
  name: string;
  email: string;
  message: string;
  projectType?: string;
  timeline?: string;
  budget?: string;
  toolName?: string;
  inquiryType?: string;
  read: boolean;
  createdAt: string;
}

interface RevenueItem {
  name: string;
  revenue: number;
  sales: number;
}

interface Purchase {
  id: string;
  amount: number;
  currency: string;
  status: string;
  product_name: string;
  variant_name: string;
  purchased_at: string;
  lemon_squeezy_order_id: string;
}

interface DashboardData {
  stats: DashboardStats;
  series: SeriesPoint[];
  topTools: TopTool[];
  downloadsByTool: DownloadsByTool[];
  leadSources: LeadSource[];
  revenueByProduct: RevenueItem[];
  revenueByTier: RevenueItem[];
  recentMessages: Message[];
  recentPurchases: Purchase[];
  activity: ActivityItem[];
}

interface CountryRow { code: string; sessions: number; converted: number; }

// ── Country helpers ─────────────────────────────────────────────────────────────
function countryFlag(code: string): string {
  if (!code || code === 'Unknown' || code.length !== 2) return '🌍';
  const offset = 0x1F1E6 - 65;
  try { return String.fromCodePoint(code.charCodeAt(0) + offset, code.charCodeAt(1) + offset); }
  catch { return '🌍'; }
}
const COUNTRY_NAMES: Record<string, string> = {
  US:'United States', GB:'United Kingdom', FR:'France', DE:'Germany', MA:'Morocco',
  DZ:'Algeria', TN:'Tunisia', SA:'Saudi Arabia', AE:'UAE', EG:'Egypt',
  CA:'Canada', AU:'Australia', BR:'Brazil', IN:'India', JP:'Japan',
  NL:'Netherlands', ES:'Spain', IT:'Italy', PT:'Portugal', SE:'Sweden',
  BE:'Belgium', CH:'Switzerland', PL:'Poland', TR:'Turkey', KR:'South Korea',
  SG:'Singapore', MY:'Malaysia', NG:'Nigeria', ZA:'South Africa', MX:'Mexico',
  LB:'Lebanon', JO:'Jordan', KW:'Kuwait', QA:'Qatar', BH:'Bahrain', OM:'Oman',
  IQ:'Iraq', IR:'Iran', PK:'Pakistan', ID:'Indonesia', PH:'Philippines',
  UA:'Ukraine', RU:'Russia', CN:'China', AR:'Argentina', CO:'Colombia',
};
function countryName(code: string): string {
  if (!code || code === 'Unknown') return 'Unknown';
  return COUNTRY_NAMES[code] ?? code;
}

// ── Colour tokens ──────────────────────────────────────────────────────────────

const NEON_PURPLE = '#a855f7';
const NEON_BLUE   = '#60a5fa';
const NEON_GREEN  = '#34d399';
const NEON_PINK   = '#f472b6';
const NEON_GOLD   = '#f59e0b';
const CHART_COLORS = [NEON_PURPLE, NEON_BLUE, NEON_GREEN, NEON_PINK, '#fbbf24', '#fb7185'];

// ── Tiny helpers ───────────────────────────────────────────────────────────────

function relativeTime(iso: string) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function shortDate(iso: string) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

function fmtUSD(n: number) {
  return n === 0 ? '$0' : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// ── Stat Card ──────────────────────────────────────────────────────────────────

interface StatCardProps {
  label:    string;
  value:    number | string;
  icon:     React.ReactNode;
  color:    string;
  sub?:     string;
  pulse?:   boolean;
  onClick?: () => void;
}

function StatCard({ label, value, icon, color, sub, pulse, onClick }: StatCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={onClick ? { scale: 1.02 } : {}}
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border bg-white/3 backdrop-blur-sm p-5 flex flex-col gap-2 ${
        onClick ? 'cursor-pointer' : ''
      }`}
      style={{ borderColor: `${color}30` }}
    >
      {/* Glow blob */}
      <div
        className="absolute -top-6 -right-6 w-24 h-24 rounded-full blur-2xl opacity-20 pointer-events-none"
        style={{ background: color }}
      />

      <div className="flex items-start justify-between">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: `${color}18`, border: `1px solid ${color}30` }}
        >
          <span style={{ color }}>{icon}</span>
        </div>
        {pulse && (
          <span className="w-2 h-2 rounded-full bg-red-400 animate-pulse mt-1" />
        )}
      </div>

      <div>
        <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
        <p className="text-white/50 text-xs font-medium uppercase tracking-wider mt-0.5">{label}</p>
        {sub && <p className="text-white/30 text-xs mt-1">{sub}</p>}
      </div>
    </motion.div>
  );
}

// ── Custom tooltip for charts ──────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#1a1025]/95 backdrop-blur px-3 py-2.5 shadow-xl text-xs">
      <p className="text-white/50 mb-1.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="flex items-center gap-2 text-white">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
          <span className="text-white/60 capitalize">{p.name}:</span>
          <span className="font-semibold tabular-nums">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ── Activity feed item ─────────────────────────────────────────────────────────

function ActivityRow({ item }: { item: ActivityItem }) {
  const isDownload = item.activityType === 'download';
  const isPurchase = item.activityType === 'purchase';
  const ts = item.downloadedAt || item.createdAt || '';

  let iconEl: React.ReactNode;
  let iconClass: string;
  let primaryText: string;
  let subText: string;

  if (isPurchase) {
    iconEl = <ShoppingCart className="w-3.5 h-3.5" />;
    iconClass = 'bg-amber-500/15 text-amber-400';
    primaryText = item.productName || 'Purchase';
    subText = `${item.variantName || ''} · ${fmtUSD(item.amount ?? 0)}`;
  } else if (isDownload) {
    iconEl = <Download className="w-3.5 h-3.5" />;
    iconClass = 'bg-purple-500/15 text-purple-400';
    primaryText = item.displayName || item.email;
    subText = `Downloaded ${item.toolName || 'a tool'}`;
  } else {
    iconEl = <Users className="w-3.5 h-3.5" />;
    iconClass = 'bg-blue-500/15 text-blue-400';
    primaryText = item.displayName || item.email;
    subText = 'New sign-up';
  }

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-white/5 last:border-0">
      <div className={`mt-0.5 w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${iconClass}`}>
        {iconEl}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-white/80 text-sm truncate">{primaryText}</p>
        <p className="text-white/35 text-xs truncate">{subText}</p>
      </div>
      {isPurchase && item.amount ? (
        <span className="text-amber-400 text-xs font-semibold tabular-nums flex-shrink-0">{fmtUSD(item.amount)}</span>
      ) : (
        <span className="text-white/25 text-xs whitespace-nowrap flex-shrink-0">{relativeTime(ts)}</span>
      )}
    </div>
  );
}

// ── Message card ───────────────────────────────────────────────────────────────

interface MessageCardProps {
  msg:         Message;
  expanded:    boolean;
  onExpand:    () => void;
  onMarkRead:  (kvKey: string) => void;
  onDelete:    (kvKey: string) => void;
  marking:     boolean;
}

function MessageCard({ msg, expanded, onExpand, onMarkRead, onDelete, marking }: MessageCardProps) {
  const isContact = msg.type === 'contact';
  return (
    <motion.div
      layout
      className={`rounded-2xl border transition-all ${
        msg.read
          ? 'border-white/8 bg-white/2'
          : 'border-purple-500/25 bg-purple-500/5'
      }`}
    >
      {/* Header row */}
      <button
        onClick={onExpand}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-white/3 transition-colors rounded-2xl"
      >
        {/* Unread dot */}
        <div className="mt-1.5 flex-shrink-0">
          {msg.read
            ? <CheckCircle2 className="w-4 h-4 text-white/20" />
            : <Circle className="w-4 h-4 text-purple-400 fill-purple-400" />}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-white font-semibold text-sm">{msg.name}</span>
            <span className="text-white/35 text-xs">{msg.email}</span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              isContact
                ? 'bg-blue-500/15 text-blue-400'
                : 'bg-orange-500/15 text-orange-400'
            }`}>
              {isContact ? 'Contact' : 'Support'}
            </span>
            {isContact && msg.projectType && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-white/5 text-white/40">
                {msg.projectType}
              </span>
            )}
            {!isContact && msg.toolName && (
              <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-white/5 text-white/40">
                {msg.toolName}
              </span>
            )}
          </div>
          <p className="text-white/50 text-xs mt-0.5 truncate">{msg.message}</p>
        </div>

        <div className="flex-shrink-0 flex items-center gap-2">
          <span className="text-white/25 text-xs">{relativeTime(msg.createdAt)}</span>
          {expanded
            ? <ChevronUp className="w-3.5 h-3.5 text-white/30" />
            : <ChevronDown className="w-3.5 h-3.5 text-white/30" />}
        </div>
      </button>

      {/* Expanded body */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-white/8 pt-3">
              {/* Extra meta */}
              <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                {msg.timeline && (
                  <span className="text-white/40">
                    <Clock className="w-3 h-3 inline mr-1" />Timeline: <strong className="text-white/60">{msg.timeline}</strong>
                  </span>
                )}
                {msg.budget && (
                  <span className="text-white/40">
                    <Tag className="w-3 h-3 inline mr-1" />Budget: <strong className="text-white/60">{msg.budget}</strong>
                  </span>
                )}
                {msg.inquiryType && (
                  <span className="text-white/40">
                    <Wrench className="w-3 h-3 inline mr-1" />Type: <strong className="text-white/60">{msg.inquiryType}</strong>
                  </span>
                )}
                <span className="text-white/40">
                  <Calendar className="w-3 h-3 inline mr-1" />{shortDate(msg.createdAt)}
                </span>
              </div>

              {/* Full message */}
              <div className="p-3 rounded-xl bg-white/4 border border-white/8">
                <p className="text-white/75 text-sm leading-relaxed whitespace-pre-wrap">{msg.message}</p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-wrap">
                <a
                  href={`mailto:${msg.email}?subject=Re: Your message to Fastoosh`}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-500/15 border border-purple-500/25 text-purple-300 hover:bg-purple-500/25 transition-all text-xs font-medium"
                >
                  <Mail className="w-3 h-3" />Reply
                  <ExternalLink className="w-2.5 h-2.5 opacity-60" />
                </a>

                {!msg.read && (
                  <button
                    onClick={() => onMarkRead(msg.kvKey)}
                    disabled={marking}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/15 border border-green-500/25 text-green-400 hover:bg-green-500/25 transition-all text-xs font-medium disabled:opacity-50"
                  >
                    <CheckCheck className="w-3 h-3" />Mark read
                  </button>
                )}

                <button
                  onClick={() => onDelete(msg.kvKey)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 transition-all text-xs font-medium"
                >
                  <Trash2 className="w-3 h-3" />Delete
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function DashboardTab({ onNavigate }: { onNavigate?: (tab: string) => void }) {
  const [data,          setData]          = useState<DashboardData | null>(null);
  const [messages,      setMessages]      = useState<Message[]>([]);
  const [countriesData, setCountriesData] = useState<CountryRow[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [refreshing,    setRefreshing]    = useState(false);
  const [view,        setView]        = useState<'overview' | 'analytics' | 'revenue' | 'behavior' | 'messages' | 'videos'>('overview');
  const [msgFilter,   setMsgFilter]   = useState<'all' | 'contact' | 'support' | 'unread'>('all');
  const [expandedMsg, setExpandedMsg] = useState<string | null>(null);
  const [marking,     setMarking]     = useState<string | null>(null);
  const [prevUnread,  setPrevUnread]  = useState(0);
  const [hasNewMsg,   setHasNewMsg]   = useState(false);
  const [chartRange,  setChartRange]  = useState<7 | 14 | 30>(30);

  const pollRef = useRef<ReturnType<typeof setInterval>>();

  // ── Loaders ────────────────────────────────────────────────────────────────

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [dashRes, msgRes, refRes] = await Promise.all([
        fetch(`${API_BASE}/admin/dashboard`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/admin/messages`,  { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/admin/referrers`, { headers: getAuthHeaders() }),
      ]);
      const dashJson = await dashRes.json();
      const msgJson  = await msgRes.json();
      const refJson  = await refRes.json();

      if (dashJson.success) {
        setData(dashJson.data);
        const unread = dashJson.data.stats.unreadMessages ?? 0;
        setPrevUnread(prev => {
          if (unread > prev && prev > 0) setHasNewMsg(true);
          return unread;
        });
      }
      if (msgJson.success) setMessages(msgJson.data || []);
      if (refJson.success && Array.isArray(refJson.data?.byCountry)) {
        setCountriesData(refJson.data.byCountry.filter((r: CountryRow) => r.code !== 'Unknown').slice(0, 5));
      }
    } catch (err) {
      console.error('[DashboardTab] load error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
    pollRef.current = setInterval(() => loadDashboard(true), 30000);
    return () => clearInterval(pollRef.current);
  }, [loadDashboard]);

  // ── Mark read ──────────────────────────────────────────────────────────────

  const handleMarkRead = useCallback(async (kvKey: string) => {
    setMarking(kvKey);
    try {
      await fetch(`${API_BASE}/admin/messages/mark-read`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ kvKey }),
      });
      setMessages(prev => prev.map(m => m.kvKey === kvKey ? { ...m, read: true } : m));
      if (data) {
        setData(prev => prev ? {
          ...prev,
          stats: { ...prev.stats, unreadMessages: Math.max(0, (prev.stats.unreadMessages || 0) - 1) },
        } : prev);
      }
      setHasNewMsg(false);
    } catch (err) {
      console.error('[DashboardTab] mark-read error:', err);
    }
    setMarking(null);
  }, [data]);

  const handleMarkAllRead = useCallback(async () => {
    try {
      await fetch(`${API_BASE}/admin/messages/mark-read`, {
        method: 'PUT',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ markAll: true }),
      });
      setMessages(prev => prev.map(m => ({ ...m, read: true })));
      if (data) setData(prev => prev ? { ...prev, stats: { ...prev.stats, unreadMessages: 0 } } : prev);
      setHasNewMsg(false);
    } catch (err) {
      console.error('[DashboardTab] mark-all-read error:', err);
    }
  }, [data]);

  const handleDelete = useCallback(async (kvKey: string) => {
    try {
      await fetch(`${API_BASE}/admin/messages/delete`, {
        method: 'DELETE',
        headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ kvKey }),
      });
      setMessages(prev => prev.filter(m => m.kvKey !== kvKey));
      if (expandedMsg === kvKey) setExpandedMsg(null);
    } catch (err) {
      console.error('[DashboardTab] delete error:', err);
    }
  }, [expandedMsg]);

  // ── Filtered messages ──────────────────────────────────────────────────────

  const filteredMessages = messages.filter(m => {
    if (msgFilter === 'contact') return m.type === 'contact';
    if (msgFilter === 'support') return m.type === 'support';
    if (msgFilter === 'unread')  return !m.read;
    return true;
  });

  // ── Chart data sliced by range ─────────────────────────────────────────────

  const chartSeries = data?.series.slice(-chartRange) ?? [];

  // ── Helpers ────────────────────────────────────────────────────────────────
  const formatXDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  const unreadCount = data?.stats.unreadMessages ?? 0;

  // ── Loading skeleton ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-2xl bg-white/5 animate-pulse" />
      </div>
    );
  }

  const stats = data?.stats;

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/25 flex items-center justify-center">
            <LayoutDashboard className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Dashboard</h2>
            <p className="text-white/35 text-xs">Real-time overview of Fastoosh performance</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* New message toast */}
          <AnimatePresence>
            {hasNewMsg && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={() => { setView('messages'); setHasNewMsg(false); }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/20 border border-purple-500/40 text-purple-300 text-xs font-semibold animate-pulse"
              >
                <BellDot className="w-3.5 h-3.5" />New message!
              </motion.button>
            )}
          </AnimatePresence>

          <button
            onClick={() => { setRefreshing(true); loadDashboard(); }}
            disabled={refreshing}
            className="p-2 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-all disabled:opacity-40"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────────── */}

      {/* Revenue highlight strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="sm:col-span-2 relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-5"
        >
          <div className="absolute -top-8 -right-8 w-32 h-32 rounded-full blur-3xl opacity-15 bg-amber-400 pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-amber-400" />
            </div>
            <span className="text-white/25 text-xs">All time</span>
          </div>
          <p className="text-3xl font-bold text-white tabular-nums">{fmtUSD(stats?.totalRevenue ?? 0)}</p>
          <p className="text-amber-300/60 text-xs font-medium uppercase tracking-wider mt-1">Total Revenue</p>
          <div className="flex gap-4 mt-3 pt-3 border-t border-white/8">
            <div>
              <p className="text-white/70 font-semibold tabular-nums">{fmtUSD(stats?.revenue30d ?? 0)}</p>
              <p className="text-white/25 text-xs">Last 30 days</p>
            </div>
            <div>
              <p className="text-white/70 font-semibold tabular-nums">{fmtUSD(stats?.revenue7d ?? 0)}</p>
              <p className="text-white/25 text-xs">Last 7 days</p>
            </div>
            <div>
              <p className="text-white/70 font-semibold tabular-nums">{stats?.totalSales ?? 0}</p>
              <p className="text-white/25 text-xs">Sales</p>
            </div>
            {(stats?.totalRefunded ?? 0) > 0 && (
              <div>
                <p className="text-red-400/80 font-semibold tabular-nums">-{fmtUSD(stats?.totalRefunded ?? 0)}</p>
                <p className="text-white/25 text-xs">{stats?.refundCount} refund{(stats?.refundCount ?? 0) !== 1 ? 's' : ''}</p>
              </div>
            )}
          </div>
        </motion.div>

        <StatCard
          label="Total Sales"
          value={stats?.totalSales ?? 0}
          icon={<ShoppingCart className="w-5 h-5" />}
          color={NEON_GOLD}
          sub={`${fmtUSD(stats?.revenue30d ?? 0)} last 30d`}
          onClick={() => setView('analytics')}
        />
        <StatCard
          label="Refunds"
          value={fmtUSD(stats?.totalRefunded ?? 0)}
          icon={<RotateCcw className="w-5 h-5" />}
          color={stats && stats.refundCount > 0 ? '#f87171' : '#6b7280'}
          sub={`${stats?.refundCount ?? 0} order${(stats?.refundCount ?? 0) !== 1 ? 's' : ''}`}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        <StatCard
          label="Total Leads"
          value={stats?.totalLeads ?? 0}
          icon={<Users className="w-5 h-5" />}
          color={NEON_PURPLE}
          sub={`+${stats?.newLeads30d ?? 0} in 30 days`}
          onClick={() => setView('analytics')}
        />
        <StatCard
          label="Free Downloads"
          value={stats?.freeDownloads ?? 0}
          icon={<Download className="w-5 h-5" />}
          color={NEON_BLUE}
          sub="Captured emails"
          onClick={() => setView('analytics')}
        />
        <StatCard
          label="Registered Users"
          value={stats?.signups ?? 0}
          icon={<Sparkles className="w-5 h-5" />}
          color={NEON_GREEN}
          sub="Signed up accounts"
          onClick={() => onNavigate?.('leads')}
        />
        <StatCard
          label="Messages"
          value={stats?.totalMessages ?? 0}
          icon={unreadCount > 0 ? <BellDot className="w-5 h-5" /> : <MessageSquare className="w-5 h-5" />}
          color={unreadCount > 0 ? '#f472b6' : NEON_PINK}
          sub={unreadCount > 0 ? `${unreadCount} unread` : 'All read'}
          pulse={unreadCount > 0}
          onClick={() => setView('messages')}
        />
        <StatCard
          label="Tools"
          value={stats?.totalTools ?? 0}
          icon={<Wrench className="w-5 h-5" />}
          color="#fbbf24"
          sub="Published tools"
          onClick={() => onNavigate?.('tools')}
        />
        <StatCard
          label="Projects"
          value={stats?.totalProjects ?? 0}
          icon={<FolderOpen className="w-5 h-5" />}
          color="#fb7185"
          sub="In portfolio"
          onClick={() => onNavigate?.('projects')}
        />
        <StatCard
          label="30-Day Growth"
          value={`+${stats?.newLeads30d ?? 0}`}
          icon={<TrendingUp className="w-5 h-5" />}
          color={NEON_GREEN}
          sub="New leads"
        />
        <StatCard
          label="Unread"
          value={unreadCount}
          icon={<Inbox className="w-5 h-5" />}
          color={unreadCount > 0 ? '#f59e0b' : NEON_PURPLE}
          sub="Inbox messages"
          pulse={unreadCount > 0}
          onClick={() => setView('messages')}
        />
      </div>

      {/* ── View Tabs ───────────────────────────────────────────────────── */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/5 border border-white/8 w-fit flex-wrap">
        {([
          { id: 'overview',  label: 'Overview',  icon: <LayoutDashboard className="w-3.5 h-3.5" /> },
          { id: 'analytics', label: 'Analytics', icon: <BarChart2 className="w-3.5 h-3.5" /> },
          { id: 'revenue',   label: 'LS Revenue', icon: <DollarSign className="w-3.5 h-3.5" /> },
          { id: 'behavior',  label: 'Behavior',   icon: <Activity className="w-3.5 h-3.5" /> },
          { id: 'messages',  label: 'Messages',   icon: <Inbox className="w-3.5 h-3.5" />, badge: unreadCount },
          { id: 'videos',    label: 'Videos',     icon: <Play  className="w-3.5 h-3.5" /> },
        ] as const).map(tab => (
          <button
            key={tab.id}
            onClick={() => setView(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all relative ${
              view === tab.id
                ? 'bg-purple-500/20 text-white border border-purple-500/30'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {tab.icon}
            {tab.label}
            {'badge' in tab && tab.badge > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center px-1">
                {tab.badge > 99 ? '99+' : tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ══ OVERVIEW VIEW ════════════════════════════════════════════════ */}
      {view === 'overview' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">

          {/* Activity feed */}
          <GlassCard className="xl:col-span-2 p-5">
            <div className="flex items-center gap-2 mb-4">
              <Activity className="w-4 h-4 text-purple-400" />
              <h3 className="text-white font-semibold">Recent Activity</h3>
              <span className="text-white/30 text-xs ml-auto">Live feed</span>
            </div>

            {(data?.activity ?? []).length === 0 ? (
              <div className="py-12 text-center">
                <Activity className="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm">No activity yet</p>
                <p className="text-white/20 text-xs mt-1">Downloads and sign-ups will appear here</p>
              </div>
            ) : (
              <div className="space-y-0 max-h-96 overflow-y-auto pr-1 scrollbar-thin">
                {(data?.activity ?? []).map((item, i) => (
                  <ActivityRow key={i} item={item} />
                ))}
              </div>
            )}
          </GlassCard>

          {/* Right column */}
          <div className="space-y-5">

            {/* Top tools */}
            <GlassCard className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-blue-400" />
                <h3 className="text-white font-semibold">Top Tools</h3>
              </div>
              {(data?.topTools ?? []).length === 0 ? (
                <p className="text-white/30 text-sm text-center py-6">No download data yet</p>
              ) : (
                <div className="space-y-3">
                  {(data?.topTools ?? []).slice(0, 5).map((tool, i) => {
                    const max = data?.topTools[0]?.count ?? 1;
                    const pct = Math.round((tool.count / max) * 100);
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-white/20 text-xs font-mono w-4 flex-shrink-0">#{i + 1}</span>
                            <span className="text-white/80 text-xs truncate">{tool.name}</span>
                          </div>
                          <span className="text-white/50 text-xs ml-2 flex-shrink-0 tabular-nums">{tool.count}</span>
                        </div>
                        <div className="h-1 rounded-full bg-white/5">
                          <div
                            className="h-1 rounded-full"
                            style={{
                              width: `${pct}%`,
                              background: `linear-gradient(90deg, ${CHART_COLORS[i % CHART_COLORS.length]}, ${CHART_COLORS[(i + 1) % CHART_COLORS.length]})`,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </GlassCard>

            {/* Countries mini-widget */}
            <GlassCard className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-4 h-4 text-cyan-400" />
                <h3 className="text-white font-semibold">Top Countries</h3>
                <span className="text-white/25 text-xs ml-auto">All time</span>
              </div>
              {countriesData.length === 0 ? (
                <p className="text-white/30 text-sm text-center py-4">No country data yet</p>
              ) : (
                <div className="space-y-2.5">
                  {(() => {
                    const max = countriesData[0]?.sessions ?? 1;
                    return countriesData.map((c, i) => {
                      const pct = Math.round((c.sessions / max) * 100);
                      return (
                        <div key={c.code}>
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-white/20 text-xs font-mono w-4 flex-shrink-0">#{i + 1}</span>
                              <span className="text-base leading-none flex-shrink-0">{countryFlag(c.code)}</span>
                              <span className="text-white/75 text-xs truncate">{countryName(c.code)}</span>
                            </div>
                            <span className="text-white/50 text-xs ml-2 flex-shrink-0 tabular-nums">{c.sessions}</span>
                          </div>
                          <div className="h-1 rounded-full bg-white/5">
                            <div
                              className="h-1 rounded-full transition-all duration-500"
                              style={{
                                width: `${pct}%`,
                                background: `linear-gradient(90deg, #22d3ee, #60a5fa)`,
                              }}
                            />
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              )}
            </GlassCard>

            {/* Recent messages preview */}
            <GlassCard className="p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-pink-400" />
                  <h3 className="text-white font-semibold">Recent Messages</h3>
                </div>
                <button
                  onClick={() => setView('messages')}
                  className="text-purple-400 hover:text-purple-300 text-xs flex items-center gap-1 transition-colors"
                >
                  View all <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>

              {(data?.recentMessages ?? []).length === 0 ? (
                <p className="text-white/30 text-sm text-center py-4">No messages yet</p>
              ) : (
                <div className="space-y-3">
                  {(data?.recentMessages ?? []).slice(0, 4).map((msg, i) => (
                    <div
                      key={i}
                      onClick={() => { setView('messages'); setExpandedMsg(msg.kvKey); }}
                      className={`p-3 rounded-xl border cursor-pointer hover:bg-white/5 transition-colors ${
                        msg.read ? 'border-white/8 bg-white/2' : 'border-purple-500/25 bg-purple-500/5'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            {!msg.read && <Circle className="w-2 h-2 text-purple-400 fill-purple-400 flex-shrink-0" />}
                            <span className="text-white/80 text-xs font-medium truncate">{msg.name}</span>
                          </div>
                          <p className="text-white/35 text-xs truncate mt-0.5">{msg.message}</p>
                        </div>
                        <span className="text-white/20 text-[10px] flex-shrink-0">{relativeTime(msg.createdAt)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassCard>
          </div>
        </div>
      )}

      {/* ══ ANALYTICS VIEW ═══════════════════════════════════════════════ */}
      {view === 'analytics' && (
        <div className="space-y-6">

          {/* Downloads + Signups over time */}
          <GlassCard className="p-5">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-400" />
                <h3 className="text-white font-semibold">Downloads & Sign-ups Over Time</h3>
              </div>
              <div className="flex gap-1 p-0.5 rounded-lg bg-white/5 border border-white/8">
                {([7, 14, 30] as const).map(r => (
                  <button
                    key={r}
                    onClick={() => setChartRange(r)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                      chartRange === r ? 'bg-purple-500/25 text-white' : 'text-white/30 hover:text-white/60'
                    }`}
                  >
                    {r}d
                  </button>
                ))}
              </div>
            </div>

            {chartSeries.every(d => d.downloads === 0 && d.signups === 0) ? (
              <div className="h-52 flex items-center justify-center">
                <div className="text-center">
                  <BarChart2 className="w-10 h-10 text-white/10 mx-auto mb-2" />
                  <p className="text-white/30 text-sm">No data for this period</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartSeries} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradDownloads" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={NEON_PURPLE} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={NEON_PURPLE} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradSignups" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={NEON_BLUE} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={NEON_BLUE} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={formatXDate}
                    tick={{ fill: '#ffffff30', fontSize: 10 }}
                    axisLine={{ stroke: '#ffffff10' }}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: '#ffffff30', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    allowDecimals={false}
                  />
                  <Tooltip content={<ChartTooltip />} />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: '11px', color: '#ffffff50' }}
                  />
                  <Area type="monotone" dataKey="downloads" stroke={NEON_PURPLE} strokeWidth={2} fill="url(#gradDownloads)" name="Downloads" />
                  <Area type="monotone" dataKey="signups"   stroke={NEON_BLUE}   strokeWidth={2} fill="url(#gradSignups)"   name="Sign-ups"  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </GlassCard>

          {/* Row: Bar chart + Pie chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Downloads by tool */}
            <GlassCard className="p-5">
              <div className="flex items-center gap-2 mb-5">
                <Download className="w-4 h-4 text-blue-400" />
                <h3 className="text-white font-semibold">Downloads by Tool</h3>
              </div>

              {(data?.downloadsByTool ?? []).length === 0 ? (
                <div className="h-52 flex items-center justify-center">
                  <p className="text-white/30 text-sm">No download data</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data?.downloadsByTool ?? []} margin={{ top: 5, right: 10, left: -20, bottom: 30 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" vertical={false} />
                    <XAxis
                      dataKey="name"
                      tick={{ fill: '#ffffff40', fontSize: 9 }}
                      axisLine={{ stroke: '#ffffff10' }}
                      tickLine={false}
                      angle={-35}
                      textAnchor="end"
                    />
                    <YAxis
                      tick={{ fill: '#ffffff30', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip content={<ChartTooltip />} cursor={{ fill: '#ffffff05' }} />
                    <Bar dataKey="count" name="Downloads" radius={[5, 5, 0, 0]}>
                      {(data?.downloadsByTool ?? []).map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </GlassCard>

            {/* Lead sources pie */}
            <GlassCard className="p-5">
              <div className="flex items-center gap-2 mb-5">
                <Users className="w-4 h-4 text-green-400" />
                <h3 className="text-white font-semibold">Lead Sources</h3>
              </div>

              {(data?.leadSources ?? []).every(s => s.value === 0) ? (
                <div className="h-52 flex items-center justify-center">
                  <p className="text-white/30 text-sm">No lead data yet</p>
                </div>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="60%" height={200}>
                    <PieChart>
                      <Pie
                        data={data?.leadSources ?? []}
                        cx="50%"
                        cy="50%"
                        innerRadius={55}
                        outerRadius={85}
                        paddingAngle={3}
                        dataKey="value"
                      >
                        {(data?.leadSources ?? []).map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>

                  <div className="flex-1 space-y-3">
                    {(data?.leadSources ?? []).map((src, i) => (
                      <div key={i} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                        <div className="min-w-0">
                          <p className="text-white/60 text-xs">{src.name}</p>
                          <p className="text-white font-bold text-lg tabular-nums">{src.value}</p>
                        </div>
                      </div>
                    ))}
                    <div className="pt-2 border-t border-white/8">
                      <p className="text-white/30 text-xs">Total</p>
                      <p className="text-white font-bold text-lg">
                        {(data?.leadSources ?? []).reduce((s, l) => s + l.value, 0)}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </GlassCard>
          </div>

          {/* Messages over time */}
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-5">
              <MessageSquare className="w-4 h-4 text-pink-400" />
              <h3 className="text-white font-semibold">Incoming Messages Over Time</h3>
            </div>

            {chartSeries.every(d => d.messages === 0) ? (
              <div className="h-40 flex items-center justify-center">
                <p className="text-white/30 text-sm">No messages received in this period</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={160}>
                <AreaChart data={chartSeries} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradMsg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={NEON_PINK} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={NEON_PINK} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                  <XAxis dataKey="date" tickFormatter={formatXDate} tick={{ fill: '#ffffff30', fontSize: 10 }} axisLine={{ stroke: '#ffffff10' }} tickLine={false} />
                  <YAxis tick={{ fill: '#ffffff30', fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="messages" stroke={NEON_PINK} strokeWidth={2} fill="url(#gradMsg)" name="Messages" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </GlassCard>

          {/* ── REVENUE SECTION ── */}

          {/* Revenue over time */}
          <GlassCard className="p-5">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-amber-400" />
                <h3 className="text-white font-semibold">Revenue Over Time</h3>
              </div>
              <span className="text-white/25 text-xs">USD · {chartRange}d</span>
            </div>

            {chartSeries.every(d => d.revenue === 0) ? (
              <div className="h-52 flex items-center justify-center">
                <div className="text-center">
                  <DollarSign className="w-10 h-10 text-white/10 mx-auto mb-2" />
                  <p className="text-white/30 text-sm">No sales recorded yet</p>
                  <p className="text-white/20 text-xs mt-1">Revenue appears here once Lemon Squeezy webhooks fire</p>
                </div>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={chartSeries} margin={{ top: 5, right: 10, left: 5, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={NEON_GOLD} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={NEON_GOLD} stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradSalesLine" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor={NEON_GREEN} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={NEON_GREEN} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                  <XAxis dataKey="date" tickFormatter={formatXDate} tick={{ fill: '#ffffff30', fontSize: 10 }} axisLine={{ stroke: '#ffffff10' }} tickLine={false} />
                  <YAxis yAxisId="rev" tick={{ fill: '#ffffff30', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v}`} />
                  <YAxis yAxisId="cnt" orientation="right" tick={{ fill: '#ffffff20', fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    content={({ active, payload, label }: any) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="rounded-xl border border-white/10 bg-[#1a1025]/95 backdrop-blur px-3 py-2.5 shadow-xl text-xs">
                          <p className="text-white/50 mb-1.5">{label}</p>
                          {payload.map((p: any, i: number) => (
                            <p key={i} className="flex items-center gap-2 text-white">
                              <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
                              <span className="text-white/60">{p.name}:</span>
                              <span className="font-semibold tabular-nums">{p.name === 'Revenue' ? `$${p.value}` : p.value}</span>
                            </p>
                          ))}
                        </div>
                      );
                    }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', color: '#ffffff50' }} />
                  <Area yAxisId="rev" type="monotone" dataKey="revenue" stroke={NEON_GOLD}  strokeWidth={2.5} fill="url(#gradRevenue)"   name="Revenue" />
                  <Area yAxisId="cnt" type="monotone" dataKey="sales"   stroke={NEON_GREEN} strokeWidth={1.5} fill="url(#gradSalesLine)" name="Sales"   />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </GlassCard>

          {/* Revenue by product + by tier */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Revenue by product */}
            <GlassCard className="p-5">
              <div className="flex items-center gap-2 mb-5">
                <BadgeDollarSign className="w-4 h-4 text-amber-400" />
                <h3 className="text-white font-semibold">Revenue by Product</h3>
              </div>

              {(data?.revenueByProduct ?? []).length === 0 ? (
                <div className="h-48 flex items-center justify-center">
                  <p className="text-white/30 text-sm">No revenue data yet</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data?.revenueByProduct ?? []} layout="vertical" margin={{ top: 0, right: 55, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" horizontal={false} />
                    <XAxis type="number" tick={{ fill: '#ffffff30', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v}`} />
                    <YAxis type="category" dataKey="name" width={90} tick={{ fill: '#ffffff50', fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      content={({ active, payload }: any) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0].payload;
                        return (
                          <div className="rounded-xl border border-white/10 bg-[#1a1025]/95 px-3 py-2 text-xs shadow-xl">
                            <p className="text-white font-semibold">{p.name}</p>
                            <p className="text-amber-400">{fmtUSD(p.revenue)}</p>
                            <p className="text-white/40">{p.sales} sale{p.sales !== 1 ? 's' : ''}</p>
                          </div>
                        );
                      }}
                      cursor={{ fill: '#ffffff05' }}
                    />
                    <Bar dataKey="revenue" name="Revenue" radius={[0, 5, 5, 0]}>
                      {(data?.revenueByProduct ?? []).map((_, i) => (
                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </GlassCard>

            {/* Revenue by tier */}
            <GlassCard className="p-5">
              <div className="flex items-center gap-2 mb-5">
                <ShoppingCart className="w-4 h-4 text-green-400" />
                <h3 className="text-white font-semibold">Revenue by Tier</h3>
              </div>

              {(data?.revenueByTier ?? []).length === 0 ? (
                <div className="h-48 flex items-center justify-center">
                  <p className="text-white/30 text-sm">No sales yet</p>
                </div>
              ) : (
                <div className="flex items-center gap-6">
                  <ResponsiveContainer width="55%" height={200}>
                    <PieChart>
                      <Pie data={data?.revenueByTier ?? []} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="revenue">
                        {(data?.revenueByTier ?? []).map((_, i) => (
                          <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        content={({ active, payload }: any) => {
                          if (!active || !payload?.length) return null;
                          const p = payload[0].payload;
                          return (
                            <div className="rounded-xl border border-white/10 bg-[#1a1025]/95 px-3 py-2 text-xs shadow-xl">
                              <p className="text-white font-semibold">{p.name}</p>
                              <p className="text-amber-400">{fmtUSD(p.revenue)}</p>
                              <p className="text-white/40">{p.sales} sale{p.sales !== 1 ? 's' : ''}</p>
                            </div>
                          );
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex-1 space-y-3">
                    {(data?.revenueByTier ?? []).map((tier, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-0.5">
                          <div className="flex items-center gap-2">
                            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                            <span className="text-white/60 text-xs">{tier.name}</span>
                          </div>
                          <span className="text-white text-xs font-semibold tabular-nums">{fmtUSD(tier.revenue)}</span>
                        </div>
                        <p className="text-white/25 text-[10px] ml-4">{tier.sales} sale{tier.sales !== 1 ? 's' : ''}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </GlassCard>
          </div>

          {/* Recent purchases table */}
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-5">
              <ShoppingCart className="w-4 h-4 text-amber-400" />
              <h3 className="text-white font-semibold">Recent Sales</h3>
              <span className="ml-auto text-white/25 text-xs">{(data?.recentPurchases ?? []).length} records</span>
            </div>

            {(data?.recentPurchases ?? []).length === 0 ? (
              <div className="py-12 text-center">
                <ShoppingCart className="w-10 h-10 text-white/10 mx-auto mb-3" />
                <p className="text-white/30 text-sm">No purchases recorded yet</p>
                <p className="text-white/20 text-xs mt-1">Sales will appear here once Lemon Squeezy webhooks are configured</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/8">
                      <th className="text-left text-white/30 font-medium pb-3 pr-4">Product</th>
                      <th className="text-left text-white/30 font-medium pb-3 pr-4">Tier</th>
                      <th className="text-right text-white/30 font-medium pb-3 pr-4">Amount</th>
                      <th className="text-left text-white/30 font-medium pb-3 pr-4">Status</th>
                      <th className="text-left text-white/30 font-medium pb-3">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data?.recentPurchases ?? []).map((p, i) => (
                      <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
                        <td className="py-3 pr-4 text-white/80 font-medium max-w-[160px] truncate">{p.product_name || '—'}</td>
                        <td className="py-3 pr-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.variant_name === 'Pro'    ? 'bg-purple-500/20 text-purple-400' :
                            p.variant_name === 'Studio' ? 'bg-amber-500/20 text-amber-400'  :
                            p.variant_name === 'Free'   ? 'bg-cyan-500/20 text-cyan-400'    :
                                                          'bg-white/10 text-white/50'
                          }`}>{p.variant_name || '—'}</span>
                        </td>
                        <td className="py-3 pr-4 text-right text-amber-400 font-bold tabular-nums">{fmtUSD(parseFloat(String(p.amount)) || 0)}</td>
                        <td className="py-3 pr-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            p.status === 'active'   ? 'bg-green-500/15 text-green-400' :
                            p.status === 'refunded' ? 'bg-red-500/15 text-red-400'    :
                                                      'bg-white/10 text-white/40'
                          }`}>{p.status}</span>
                        </td>
                        <td className="py-3 text-white/30">{shortDate(p.purchased_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </GlassCard>

        </div>
      )}

      {/* ══ LS REVENUE VIEW ══════════════════════════════════════════════ */}
      {view === 'revenue' && <LSRevenuePanel />}

      {/* ══ BEHAVIOR VIEW ════════════════════════════════════════════════ */}
      {view === 'behavior' && <BehaviorTab />}

      {/* ══ VIDEOS VIEW ══════════════════════════════════════════════════ */}
      {view === 'videos' && <VideoStatsTab />}

      {/* ══ MESSAGES VIEW ════════════════════════════════════════════════ */}
      {view === 'messages' && (
        <GlassCard className="p-5">
          {/* Inbox header */}
          <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
            <div className="flex items-center gap-2">
              <Inbox className="w-4 h-4 text-purple-400" />
              <h3 className="text-white font-semibold">Message Inbox</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-red-500/20 border border-red-500/30 text-red-400 text-xs font-bold">
                  {unreadCount} unread
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Filters */}
              <div className="flex gap-1 p-0.5 rounded-lg bg-white/5 border border-white/8">
                {(['all', 'contact', 'support', 'unread'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setMsgFilter(f)}
                    className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-all ${
                      msgFilter === f ? 'bg-purple-500/25 text-white' : 'text-white/30 hover:text-white/60'
                    }`}
                  >
                    {f}
                    {f === 'unread' && unreadCount > 0 && (
                      <span className="ml-1 text-red-400">({unreadCount})</span>
                    )}
                  </button>
                ))}
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 hover:bg-green-500/20 transition-all text-xs font-medium"
                >
                  <CheckCheck className="w-3.5 h-3.5" />Mark all read
                </button>
              )}
            </div>
          </div>

          {/* Message list */}
          {filteredMessages.length === 0 ? (
            <div className="py-16 text-center">
              <Inbox className="w-12 h-12 text-white/10 mx-auto mb-3" />
              <p className="text-white/40 font-semibold">
                {msgFilter === 'unread' ? 'All caught up!' : 'No messages yet'}
              </p>
              <p className="text-white/20 text-sm mt-1">
                {msgFilter === 'unread'
                  ? 'No unread messages in your inbox.'
                  : 'Messages from your contact and tool-support forms will appear here.'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredMessages.map(msg => (
                <MessageCard
                  key={msg.kvKey || msg.id}
                  msg={msg}
                  expanded={expandedMsg === msg.kvKey}
                  onExpand={() => setExpandedMsg(expandedMsg === msg.kvKey ? null : msg.kvKey)}
                  onMarkRead={handleMarkRead}
                  onDelete={handleDelete}
                  marking={marking === msg.kvKey}
                />
              ))}
            </div>
          )}
        </GlassCard>
      )}
    </div>
  );
}