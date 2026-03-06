import { useState, useCallback } from 'react';
import { GlassCard } from '../shared/GlassCard';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  DollarSign, RefreshCw, ExternalLink, TrendingUp, ShoppingCart,
  RotateCcw, AlertCircle, CheckCircle2, Clock, Zap, BadgeDollarSign,
  TrendingDown, Calendar, Mail,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

function getAuthHeaders() {
  const token = localStorage.getItem('admin_token');
  return {
    'Authorization': `Bearer ${publicAnonKey}`,
    'X-Admin-Token': token || '',
  };
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface LSSummary {
  totalOrders: number;
  paidOrders: number;
  refundedOrders: number;
  totalRevenue: number;
  totalRefunded: number;
  netRevenue: number;
  revenue30d: number;
  revenue7d: number;
  revenueToday: number;
}

interface LSStatusItem   { status: string; count: number; total: number; }
interface LSProductItem  { name: string; revenue: number; sales: number; }
interface LSVariantItem  { name: string; revenue: number; sales: number; }
interface LSSeriesPoint  { date: string; revenue: number; sales: number; refunds: number; }

interface LSOrder {
  id: string;
  orderNumber: number;
  status: string;
  email: string;
  productName: string;
  variantName: string;
  total: number;
  currency: string;
  createdAt: string;
  refundedAt: string | null;
  lsUrl: string;
}

interface LSData {
  summary: LSSummary;
  byStatus: LSStatusItem[];
  byProduct: LSProductItem[];
  byVariant: LSVariantItem[];
  series: LSSeriesPoint[];
  recentOrders: LSOrder[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const NEON_GOLD   = '#f59e0b';
const NEON_GREEN  = '#34d399';
const NEON_RED    = '#f87171';
const NEON_PURPLE = '#a855f7';
const NEON_BLUE   = '#60a5fa';
const CHART_COLORS = [NEON_GOLD, NEON_PURPLE, NEON_BLUE, NEON_GREEN, '#fb7185', '#fbbf24'];

function fmtUSD(n: number) {
  return n === 0 ? '$0.00' : `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function shortDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

function fmtDate(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function statusColor(s: string) {
  if (s === 'paid')           return 'bg-green-500/15 text-green-400 border-green-500/25';
  if (s === 'refunded')       return 'bg-red-500/15 text-red-400 border-red-500/25';
  if (s === 'partial_refund') return 'bg-orange-500/15 text-orange-400 border-orange-500/25';
  if (s === 'pending')        return 'bg-yellow-500/15 text-yellow-400 border-yellow-500/25';
  if (s === 'failed')         return 'bg-red-800/15 text-red-600 border-red-800/25';
  if (s === 'fraud')          return 'bg-red-900/15 text-red-700 border-red-900/25';
  return 'bg-white/10 text-white/40 border-white/10';
}

// ── Small metric tile ──────────────────────────────────────────────────────────

function MetricTile({
  label, value, sub, icon, color, highlight = false,
}: {
  label: string; value: string; sub?: string; icon: React.ReactNode;
  color: string; highlight?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden rounded-2xl border p-4 flex flex-col gap-1.5 ${
        highlight ? 'bg-gradient-to-br from-amber-500/10 to-orange-500/5' : 'bg-white/3'
      }`}
      style={{ borderColor: `${color}30` }}
    >
      <div className="absolute -top-5 -right-5 w-20 h-20 rounded-full blur-2xl opacity-15 pointer-events-none" style={{ background: color }} />
      <div className="flex items-center justify-between">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
          <span style={{ color }}>{icon}</span>
        </div>
      </div>
      <p className="text-xl font-bold text-white tabular-nums mt-1">{value}</p>
      <p className="text-white/45 text-[11px] font-medium uppercase tracking-wider">{label}</p>
      {sub && <p className="text-white/25 text-[10px]">{sub}</p>}
    </div>
  );
}

// ── Custom chart tooltip ───────────────────────────────────────────────────────

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#1a1025]/95 backdrop-blur px-3 py-2.5 shadow-xl text-xs">
      <p className="text-white/50 mb-1.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="flex items-center gap-2 text-white">
          <span className="w-2 h-2 rounded-full inline-block" style={{ background: p.color }} />
          <span className="text-white/60">{p.name}:</span>
          <span className="font-semibold tabular-nums">
            {p.name === 'Revenue' ? `$${p.value}` : p.value}
          </span>
        </p>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function LSRevenuePanel() {
  const [data,      setData]      = useState<LSData | null>(null);
  const [loading,   setLoading]   = useState(false);
  const [loaded,    setLoaded]    = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [chartRange, setChartRange] = useState<7 | 14 | 30>(30);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res  = await fetch(`${API_BASE}/admin/ls-revenue`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Unknown error');
      setData(json.data);
      setLoaded(true);
    } catch (err: any) {
      setError(err.message || String(err));
      console.error('[LSRevenuePanel]', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const chartSeries = data?.series.slice(-chartRange) ?? [];

  // ── Not yet loaded ─────────────────────────────────────────────────────────
  if (!loaded && !loading) {
    return (
      <GlassCard className="p-8 text-center">
        <div className="max-w-sm mx-auto space-y-5">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/25 flex items-center justify-center mx-auto">
            <DollarSign className="w-8 h-8 text-amber-400" />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">Live Revenue from Lemon Squeezy</h3>
            <p className="text-white/40 text-sm mt-2 leading-relaxed">
              Pull your complete order history directly from the Lemon Squeezy API — authoritative numbers,
              never missing a sale, with full breakdown by product, tier, and status.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-3 text-xs text-white/30">
            {['All orders', 'Refunds', 'By product', 'By tier', 'Daily chart', 'Order table'].map(f => (
              <span key={f} className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-green-400" />{f}
              </span>
            ))}
          </div>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 hover:bg-amber-500/25 font-semibold transition-all"
          >
            <Zap className="w-4 h-4" />Fetch Live Data
          </button>
        </div>
      </GlassCard>
    );
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <GlassCard className="p-8 text-center">
        <RefreshCw className="w-8 h-8 text-amber-400 animate-spin mx-auto mb-3" />
        <p className="text-white/50 text-sm">Fetching orders from Lemon Squeezy…</p>
        <p className="text-white/25 text-xs mt-1">This may take a moment for large stores</p>
      </GlassCard>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <GlassCard className="p-6">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/25 flex items-center justify-center flex-shrink-0">
            <AlertCircle className="w-5 h-5 text-red-400" />
          </div>
          <div className="flex-1">
            <p className="text-white font-semibold">Failed to fetch Lemon Squeezy data</p>
            <p className="text-red-400/80 text-sm mt-1 font-mono">{error}</p>
            {error.includes('LEMON_SQUEEZY_API_KEY') && (
              <p className="text-white/40 text-xs mt-2">
                Make sure you've set the <span className="text-amber-400 font-mono">LEMON_SQUEEZY_API_KEY</span> secret in Supabase Edge Function settings.
                You can find your API key at{' '}
                <a href="https://app.lemonsqueezy.com/settings/api" target="_blank" rel="noreferrer" className="text-amber-400 underline">
                  app.lemonsqueezy.com/settings/api
                </a>.
              </p>
            )}
          </div>
          <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/50 hover:text-white text-xs transition-all">
            <RefreshCw className="w-3 h-3" />Retry
          </button>
        </div>
      </GlassCard>
    );
  }

  if (!data) return null;
  const { summary, byStatus, byProduct, byVariant, recentOrders } = data;

  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          {/* LS logo-ish badge */}
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
            <DollarSign className="w-5 h-5 text-amber-400" />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg flex items-center gap-2">
              Lemon Squeezy
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-amber-400 uppercase tracking-wider">Live</span>
            </h3>
            <p className="text-white/30 text-xs">{summary.totalOrders} orders fetched directly from the API</p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white/80 hover:bg-white/8 transition-all text-xs disabled:opacity-40"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* ── Summary KPI tiles ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">

        {/* Net revenue — wide hero */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="sm:col-span-3 lg:col-span-2 relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-600/5 p-5"
        >
          <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full blur-3xl opacity-10 bg-amber-400 pointer-events-none" />
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center">
              <BadgeDollarSign className="w-5 h-5 text-amber-400" />
            </div>
            <span className="text-white/25 text-xs">Net (all time)</span>
          </div>
          <p className="text-4xl font-bold text-white tabular-nums">{fmtUSD(summary.netRevenue)}</p>
          <p className="text-amber-300/60 text-xs font-medium uppercase tracking-wider mt-1">Net Revenue</p>
          <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-white/8">
            <div>
              <p className="text-white font-semibold tabular-nums">{fmtUSD(summary.totalRevenue)}</p>
              <p className="text-white/25 text-xs">Gross</p>
            </div>
            <div>
              <p className="text-red-400/80 font-semibold tabular-nums">-{fmtUSD(summary.totalRefunded)}</p>
              <p className="text-white/25 text-xs">Refunded</p>
            </div>
            <div>
              <p className="text-white font-semibold tabular-nums">{summary.paidOrders}</p>
              <p className="text-white/25 text-xs">Paid orders</p>
            </div>
          </div>
        </motion.div>

        <MetricTile
          label="Today"
          value={fmtUSD(summary.revenueToday)}
          sub="Revenue today"
          icon={<Calendar className="w-4 h-4" />}
          color={NEON_GOLD}
        />
        <MetricTile
          label="Last 7 Days"
          value={fmtUSD(summary.revenue7d)}
          sub={`${summary.revenue30d > 0 ? ((summary.revenue7d / summary.revenue30d) * 100).toFixed(0) : 0}% of 30d`}
          icon={<TrendingUp className="w-4 h-4" />}
          color={NEON_GREEN}
        />
        <MetricTile
          label="Last 30 Days"
          value={fmtUSD(summary.revenue30d)}
          sub="Rolling month"
          icon={<ShoppingCart className="w-4 h-4" />}
          color={NEON_BLUE}
        />
      </div>

      {/* Refund alert if any */}
      {summary.refundedOrders > 0 && (
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3 px-4 py-3 rounded-xl border border-red-500/25 bg-red-500/8"
        >
          <RotateCcw className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-red-300/80 text-sm">
            <span className="font-semibold">{summary.refundedOrders} refund{summary.refundedOrders !== 1 ? 's' : ''}</span>
            {' '}totalling <span className="font-semibold">{fmtUSD(summary.totalRefunded)}</span> have been processed.
          </p>
        </motion.div>
      )}

      {/* ── Revenue over time chart ──────────────────────────────────────── */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-amber-400" />
            <h3 className="text-white font-semibold">Revenue Over Time</h3>
            <span className="text-white/20 text-xs">(from LS API)</span>
          </div>
          <div className="flex gap-1 p-0.5 rounded-lg bg-white/5 border border-white/8">
            {([7, 14, 30] as const).map(r => (
              <button
                key={r}
                onClick={() => setChartRange(r)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  chartRange === r ? 'bg-amber-500/20 text-amber-300' : 'text-white/30 hover:text-white/60'
                }`}
              >
                {r}d
              </button>
            ))}
          </div>
        </div>

        {chartSeries.every(d => d.revenue === 0) ? (
          <div className="h-52 flex items-center justify-center">
            <div className="text-center">
              <DollarSign className="w-10 h-10 text-white/8 mx-auto mb-2" />
              <p className="text-white/25 text-sm">No revenue in this period</p>
            </div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={230}>
            <AreaChart data={chartSeries} margin={{ top: 5, right: 10, left: 5, bottom: 0 }}>
              <defs key="defs-ls-rev">
                <linearGradient id="lsGradRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={NEON_GOLD}  stopOpacity={0.4} />
                  <stop offset="95%" stopColor={NEON_GOLD}  stopOpacity={0} />
                </linearGradient>
                <linearGradient id="lsGradSales" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={NEON_GREEN} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={NEON_GREEN} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="lsGradRefunds" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={NEON_RED} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={NEON_RED} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
              <XAxis dataKey="date" tickFormatter={fmtDate} tick={{ fill: '#ffffff30', fontSize: 10 }} axisLine={{ stroke: '#ffffff10' }} tickLine={false} />
              <YAxis yAxisId="rev" tick={{ fill: '#ffffff30', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `$${v}`} />
              <YAxis yAxisId="cnt" orientation="right" tick={{ fill: '#ffffff20', fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip content={<ChartTip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '11px', color: '#ffffff50' }} />
              <Area key="revenue" yAxisId="rev" type="monotone" dataKey="revenue" stroke={NEON_GOLD}  strokeWidth={2.5} fill="url(#lsGradRevenue)" name="Revenue" />
              <Area key="sales"   yAxisId="cnt" type="monotone" dataKey="sales"   stroke={NEON_GREEN} strokeWidth={1.5} fill="url(#lsGradSales)"   name="Sales"   />
              <Area key="refunds" yAxisId="cnt" type="monotone" dataKey="refunds" stroke={NEON_RED}   strokeWidth={1.5} fill="url(#lsGradRefunds)" name="Refunds"  />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </GlassCard>

      {/* ── By product + By variant ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* By product */}
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-5">
            <BadgeDollarSign className="w-4 h-4 text-purple-400" />
            <h3 className="text-white font-semibold">Revenue by Product</h3>
          </div>

          {byProduct.length === 0 ? (
            <div className="h-40 flex items-center justify-center">
              <p className="text-white/25 text-sm">No data</p>
            </div>
          ) : (
            <div className="space-y-3">
              {byProduct.map((p, i) => {
                const max = byProduct[0]?.revenue ?? 1;
                const pct = Math.round((p.revenue / max) * 100);
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white/70 text-xs truncate max-w-[60%]">{p.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="text-white/30 text-xs">{p.sales} sale{p.sales !== 1 ? 's' : ''}</span>
                        <span className="text-amber-400 text-xs font-semibold tabular-nums">{fmtUSD(p.revenue)}</span>
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5">
                      <div
                        className="h-1.5 rounded-full transition-all"
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

        {/* By variant / tier */}
        <GlassCard className="p-5">
          <div className="flex items-center gap-2 mb-5">
            <ShoppingCart className="w-4 h-4 text-blue-400" />
            <h3 className="text-white font-semibold">Revenue by Tier</h3>
          </div>

          {byVariant.length === 0 ? (
            <div className="h-40 flex items-center justify-center">
              <p className="text-white/25 text-sm">No data</p>
            </div>
          ) : (
            <div className="flex items-center gap-4">
              <ResponsiveContainer width="50%" height={180}>
                <PieChart>
                  <Pie
                    data={byVariant}
                    cx="50%" cy="50%"
                    innerRadius={45} outerRadius={75}
                    paddingAngle={3}
                    dataKey="revenue"
                  >
                    {byVariant.map((_, i) => (
                      <Cell key={`var-${i}`} fill={CHART_COLORS[i % CHART_COLORS.length]} />
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
              <div className="flex-1 space-y-2.5">
                {byVariant.map((v, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CHART_COLORS[i % CHART_COLORS.length] }} />
                      <span className="text-white/60 text-xs truncate">{v.name}</span>
                    </div>
                    <div className="text-right flex-shrink-0 ml-2">
                      <p className="text-white text-xs font-semibold tabular-nums">{fmtUSD(v.revenue)}</p>
                      <p className="text-white/25 text-[10px]">{v.sales}×</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </GlassCard>
      </div>

      {/* ── Order status breakdown ───────────────────────────────────────── */}
      <GlassCard className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle2 className="w-4 h-4 text-green-400" />
          <h3 className="text-white font-semibold">Orders by Status</h3>
        </div>
        <div className="flex flex-wrap gap-3">
          {byStatus.map((s, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border ${statusColor(s.status)}`}
            >
              <span className="font-semibold capitalize text-sm">{s.status.replace('_', ' ')}</span>
              <span className="text-xs opacity-60">{s.count} order{s.count !== 1 ? 's' : ''}</span>
              {s.total > 0 && <span className="text-xs font-bold tabular-nums">· {fmtUSD(s.total)}</span>}
            </div>
          ))}
        </div>
      </GlassCard>

      {/* ── Recent orders table ──────────────────────────────────────────── */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <h3 className="text-white font-semibold">Recent Orders</h3>
          </div>
          <a
            href="https://app.lemonsqueezy.com/orders"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 text-xs transition-colors"
          >
            View all in LS <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {recentOrders.length === 0 ? (
          <div className="py-10 text-center">
            <ShoppingCart className="w-8 h-8 text-white/10 mx-auto mb-2" />
            <p className="text-white/25 text-sm">No orders yet</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/8">
                  <th className="text-left text-white/30 font-medium pb-3 pr-4">#Order</th>
                  <th className="text-left text-white/30 font-medium pb-3 pr-4">Product</th>
                  <th className="text-left text-white/30 font-medium pb-3 pr-4">Tier</th>
                  <th className="text-left text-white/30 font-medium pb-3 pr-4">Customer</th>
                  <th className="text-right text-white/30 font-medium pb-3 pr-4">Total</th>
                  <th className="text-left text-white/30 font-medium pb-3 pr-4">Status</th>
                  <th className="text-left text-white/30 font-medium pb-3 pr-4">Date</th>
                  <th className="text-center text-white/30 font-medium pb-3">Link</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((o, i) => (
                  <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
                    <td className="py-3 pr-4 text-white/40 font-mono">#{o.orderNumber}</td>
                    <td className="py-3 pr-4 text-white/80 font-medium max-w-[140px] truncate">{o.productName || '—'}</td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                        o.variantName === 'Pro'    ? 'bg-purple-500/20 text-purple-400 border-purple-500/25' :
                        o.variantName === 'Studio' ? 'bg-amber-500/20 text-amber-400 border-amber-500/25'   :
                        o.variantName === 'Free'   ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/25'      :
                                                     'bg-white/10 text-white/40 border-white/10'
                      }`}>{o.variantName || '—'}</span>
                    </td>
                    <td className="py-3 pr-4 text-white/40 truncate max-w-[140px]">
                      {o.email ? (
                        <a href={`mailto:${o.email}`} className="flex items-center gap-1 hover:text-white/70 transition-colors">
                          <Mail className="w-2.5 h-2.5 flex-shrink-0" />
                          <span className="truncate">{o.email}</span>
                        </a>
                      ) : '—'}
                    </td>
                    <td className="py-3 pr-4 text-right">
                      <span className={`font-bold tabular-nums ${o.status === 'refunded' ? 'text-red-400 line-through' : 'text-amber-400'}`}>
                        {fmtUSD(o.total)}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${statusColor(o.status)}`}>
                        {o.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="py-3 pr-4 text-white/30">
                      <div>{shortDate(o.createdAt)}</div>
                      {o.refundedAt && (
                        <div className="text-red-400/60 text-[10px]">Refunded {shortDate(o.refundedAt)}</div>
                      )}
                    </td>
                    <td className="py-3 text-center">
                      <a
                        href={o.lsUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center justify-center w-6 h-6 rounded-md bg-amber-500/10 border border-amber-500/20 text-amber-400 hover:bg-amber-500/20 transition-colors"
                        title="Open in Lemon Squeezy"
                      >
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </GlassCard>
    </div>
  );
}
