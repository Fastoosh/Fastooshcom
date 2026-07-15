import { useState, useEffect, useCallback } from 'react';
import { GlassCard } from '../shared/GlassCard';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import {
  Play, Eye, Clock, TrendingUp, RefreshCw, Video,
  ExternalLink, Film,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

function getAuthHeaders() {
  const token = localStorage.getItem('admin_token');
  return { 'Authorization': `Bearer ${publicAnonKey}`, 'X-Admin-Token': token || '' };
}

// ── Types ──────────────────────────────────────────────────────────────────────

interface VideoStat {
  projectId:         string;
  title:             string;
  slug:              string | null;
  imageUrl:          string | null;
  hasVideo:          boolean;
  videoUrl?:         string | null;
  isShowreel?:       boolean;
  views:             number;
  totalWatchSeconds: number;
  avgWatchSeconds:   number;
  lastViewed:        string | null;
}

type Provider = 'vimeo' | 'bunny' | 'youtube' | 'direct' | 'unknown';
function detectProvider(url: string | null | undefined): Provider {
  if (!url) return 'unknown';
  const u = url.toLowerCase();
  if (u.includes('iframe.mediadelivery.net') || u.includes('b-cdn.net')) return 'bunny';
  if (u.includes('vimeo.com') || u.includes('player.vimeo')) return 'vimeo';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (/\.(mp4|webm|mov|avi|m3u8)(\?|$)/i.test(url)) return 'direct';
  return 'unknown';
}

const PROVIDER_META: Record<Provider, { label: string; cls: string }> = {
  vimeo:   { label: 'Vimeo',   cls: 'bg-sky-500/15 text-sky-300 border-sky-500/30' },
  bunny:   { label: 'Bunny',   cls: 'bg-orange-500/15 text-orange-300 border-orange-500/30' },
  youtube: { label: 'YouTube', cls: 'bg-red-500/15 text-red-300 border-red-500/30' },
  direct:  { label: 'Direct',  cls: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
  unknown: { label: '—',       cls: 'bg-white/5 text-white/40 border-white/10' },
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDuration(totalSeconds: number): string {
  if (totalSeconds <= 0) return '—';
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7)  return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

const NEON_PURPLE = '#a855f7';
const NEON_BLUE   = '#60a5fa';
const NEON_GREEN  = '#34d399';
const NEON_PINK   = '#f472b6';
const PALETTE     = [NEON_PURPLE, NEON_BLUE, NEON_GREEN, NEON_PINK, '#fbbf24', '#fb7185', '#22d3ee', '#a3e635'];

// ── Tooltip ────────────────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#1a1025]/95 backdrop-blur px-3 py-2.5 shadow-xl text-xs">
      <p className="text-white/50 mb-1.5 truncate max-w-[180px]">{label}</p>
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

// ── Stat mini-card ─────────────────────────────────────────────────────────────

function MiniStat({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-2xl border bg-white/3 backdrop-blur-sm p-5 flex flex-col gap-2"
      style={{ borderColor: `${color}30` }}
    >
      <div className="absolute -top-6 -right-6 w-20 h-20 rounded-full blur-2xl opacity-20 pointer-events-none" style={{ background: color }} />
      <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: `${color}18`, border: `1px solid ${color}30` }}>
        <span style={{ color }}>{icon}</span>
      </div>
      <div>
        <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
        <p className="text-white/50 text-xs font-medium uppercase tracking-wider mt-0.5">{label}</p>
      </div>
    </motion.div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export function VideoStatsTab() {
  const [stats,       setStats]       = useState<VideoStat[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [refreshing,  setRefreshing]  = useState(false);
  const [sortBy,      setSortBy]      = useState<'views' | 'totalWatchSeconds' | 'avgWatchSeconds'>('views');
  const [chartMetric, setChartMetric] = useState<'views' | 'totalWatchSeconds' | 'avgWatchSeconds'>('views');
  const [providerFilter, setProviderFilter] = useState<'all' | Provider>('all');

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/admin/video-stats`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) setStats(json.data || []);
      else console.error('[VideoStatsTab] load error:', json.error);
    } catch (err) {
      console.error('[VideoStatsTab] fetch error:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ── Derived numbers ──────────────────────────────────────────────────────────
  const totalViews        = stats.reduce((a, s) => a + s.views, 0);
  const totalWatchSecs    = stats.reduce((a, s) => a + s.totalWatchSeconds, 0);
  const avgWatchPerView   = totalViews > 0 ? Math.round(totalWatchSecs / totalViews) : 0;
  const projectsWithVideo = stats.filter(s => s.hasVideo && !s.isShowreel).length;

  // Separate showreel from project rows
  const showreelStat = stats.find(s => s.isShowreel);
  const projectStatsAll = stats.filter(s => !s.isShowreel);
  // Provider filter — 'all' shows everything (including videoless projects);
  // any other value narrows to that provider only.
  const projectStats = providerFilter === 'all'
    ? projectStatsAll
    : projectStatsAll.filter(s => detectProvider(s.videoUrl) === providerFilter);

  // ── Sorted table data ────────────────────────────────────────────────────────
  const sorted = [...projectStats].sort((a, b) => b[sortBy] - a[sortBy]);

  // ── Chart data (top 8 by selected metric) ────────────────────────────────────
  const chartData = [...projectStats]
    .filter(s => s.hasVideo)
    .sort((a, b) => b[chartMetric] - a[chartMetric])
    .slice(0, 8)
    .map(s => ({
      name:              s.title.length > 20 ? s.title.slice(0, 18) + '…' : s.title,
      views:             s.views,
      totalWatchSeconds: s.totalWatchSeconds,
      avgWatchSeconds:   s.avgWatchSeconds,
    }));

  const chartLabel =
    chartMetric === 'views'              ? 'Views'
    : chartMetric === 'totalWatchSeconds' ? 'Total Watch (s)'
    : 'Avg Watch (s)';

  // ── Loading skeleton ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-24 rounded-2xl bg-white/5 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-white/5 animate-pulse" />
          ))}
        </div>
        <div className="h-72 rounded-2xl bg-white/5 animate-pulse" />
        <div className="h-64 rounded-2xl bg-white/5 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-pink-500/15 border border-pink-500/25 flex items-center justify-center">
            <Film className="w-5 h-5 text-pink-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Video Analytics</h2>
            <p className="text-white/35 text-xs">Views and estimated watch time per project video</p>
          </div>
        </div>
        <button
          onClick={() => { setRefreshing(true); load(true); }}
          disabled={refreshing}
          className="p-2 rounded-lg text-white/30 hover:text-white/70 hover:bg-white/5 transition-all disabled:opacity-40"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* ── Showreel card — pinned just below the header ─────────────────────── */}
      {showreelStat && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard className="p-5">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500/30 to-pink-500/30 border border-purple-500/30 flex items-center justify-center">
                <Play className="w-4 h-4 text-purple-300" />
              </div>
              <h3 className="text-white font-semibold">Showreel</h3>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/25 font-medium uppercase tracking-wider">Home page</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                { label: 'Views',       value: showreelStat.views.toLocaleString(),          color: NEON_PURPLE },
                { label: 'Total Watch', value: fmtDuration(showreelStat.totalWatchSeconds),  color: NEON_BLUE   },
                { label: 'Avg / View',  value: fmtDuration(showreelStat.avgWatchSeconds),    color: NEON_GREEN  },
                { label: 'Last Played', value: relativeTime(showreelStat.lastViewed),        color: NEON_PINK   },
              ].map(kpi => (
                <div key={kpi.label} className="rounded-xl p-3.5 bg-white/4 border border-white/6">
                  <p className="text-lg font-bold tabular-nums" style={{ color: kpi.color }}>{kpi.value}</p>
                  <p className="text-white/40 text-xs font-medium uppercase tracking-wider mt-0.5">{kpi.label}</p>
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* ── KPI strip ───────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        <GlassCard className="p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500/30 to-purple-500/30 border border-blue-500/30 flex items-center justify-center">
              <Play className="w-4 h-4 text-blue-300" />
            </div>
            <h3 className="text-white font-semibold">Projects</h3>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <MiniStat label="Total Video Views"   value={totalViews}                   icon={<Eye        className="w-4 h-4" />} color={NEON_PURPLE} />
            <MiniStat label="Total Watch Time"    value={fmtDuration(totalWatchSecs)}  icon={<Clock      className="w-4 h-4" />} color={NEON_BLUE}   />
            <MiniStat label="Avg Watch / View"    value={fmtDuration(avgWatchPerView)} icon={<TrendingUp className="w-4 h-4" />} color={NEON_GREEN}  />
            <MiniStat label="Projects with Video" value={projectsWithVideo}            icon={<Video      className="w-4 h-4" />} color={NEON_PINK}   />
          </div>
        </GlassCard>
      </motion.div>

      {/* ── Bar chart ───────────────────────────────────────────────────────── */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-purple-400" />
            <h3 className="text-white font-semibold">Top Projects by Metric</h3>
          </div>
          <div className="flex gap-1 p-1 rounded-lg bg-white/5 border border-white/8">
            {([
              { id: 'views',             label: 'Views'       },
              { id: 'totalWatchSeconds', label: 'Total Watch' },
              { id: 'avgWatchSeconds',   label: 'Avg Watch'   },
            ] as const).map(opt => (
              <button
                key={opt.id}
                onClick={() => setChartMetric(opt.id)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  chartMetric === opt.id
                    ? 'bg-purple-500/25 text-white border border-purple-500/30'
                    : 'text-white/40 hover:text-white/70'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {chartData.length === 0 ? (
          <div className="py-16 text-center">
            <Play className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <p className="text-white/30 text-sm">No video plays recorded yet</p>
            <p className="text-white/20 text-xs mt-1">Views will appear here once visitors watch project videos</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="name" tick={{ fill: 'rgba(255,255,255,0.4)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: 'rgba(255,255,255,0.35)', fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
              <Bar dataKey={chartMetric} name={chartLabel} radius={[6, 6, 0, 0]}>
                {chartData.map((_, i) => (
                  <Cell key={`vs-${i}`} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.85} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </GlassCard>

      {/* ── Per-project table ────────────────────────────────────────────────── */}
      <GlassCard className="p-5">
        <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Play className="w-4 h-4 text-blue-400" />
            <h3 className="text-white font-semibold">All Projects</h3>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Provider filter — narrows the table to videos hosted on a
                specific provider. Vimeo is here so you can still see the
                old-account stats after the Bunny migration. */}
            <div className="flex items-center gap-1.5">
              <span className="text-white/40 text-[10px] uppercase tracking-wider font-bold">Provider</span>
              <select
                value={providerFilter}
                onChange={e => setProviderFilter(e.target.value as 'all' | Provider)}
                className="bg-white/5 border border-white/10 rounded-md px-2 py-1 text-xs text-white/80 focus:outline-none focus:border-blue-400/50"
              >
                <option value="all"     className="bg-[#0a0a0f]">All</option>
                <option value="bunny"   className="bg-[#0a0a0f]">Bunny</option>
                <option value="vimeo"   className="bg-[#0a0a0f]">Vimeo</option>
                <option value="youtube" className="bg-[#0a0a0f]">YouTube</option>
                <option value="direct"  className="bg-[#0a0a0f]">Direct MP4</option>
                <option value="unknown" className="bg-[#0a0a0f]">No video / Other</option>
              </select>
            </div>
            <div className="flex gap-1 p-1 rounded-lg bg-white/5 border border-white/8">
              {([
                { id: 'views',             label: 'Views'      },
                { id: 'totalWatchSeconds', label: 'Watch Time' },
                { id: 'avgWatchSeconds',   label: 'Avg Watch'  },
              ] as const).map(opt => (
                <button
                  key={opt.id}
                  onClick={() => setSortBy(opt.id)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    sortBy === opt.id
                      ? 'bg-blue-500/20 text-white border border-blue-500/30'
                      : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {sorted.length === 0 ? (
          <p className="text-white/30 text-sm text-center py-8">No projects found</p>
        ) : (
          <div className="space-y-2">
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-3 py-2 text-[10px] font-bold text-white/25 uppercase tracking-wider border-b border-white/5">
              <span>Project</span>
              <span className="text-right w-16">Views</span>
              <span className="text-right w-24">Total Watch</span>
              <span className="text-right w-24">Avg / View</span>
              <span className="text-right w-20">Last Seen</span>
            </div>

            <AnimatePresence initial={false}>
              {sorted.map((stat, i) => {
                const maxViews = Math.max(...projectStats.map(s => s.views), 1);
                const maxWatch = Math.max(...projectStats.map(s => s.totalWatchSeconds), 1);
                const viewsBar    = Math.round((stat.views / maxViews) * 100);
                const watchBar    = Math.round((stat.totalWatchSeconds / maxWatch) * 100);
                const accentColor = PALETTE[i % PALETTE.length];
                return (
                  <motion.div
                    key={stat.projectId}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="group grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 items-center px-3 py-3 rounded-xl hover:bg-white/4 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="text-white/20 text-xs font-mono w-5 flex-shrink-0">#{i + 1}</span>
                      {stat.imageUrl ? (
                        <img
                          src={stat.imageUrl}
                          alt={stat.title}
                          className="w-10 h-7 object-cover rounded-md flex-shrink-0 opacity-80"
                        />
                      ) : (
                        <div className="w-10 h-7 rounded-md bg-white/5 flex-shrink-0 flex items-center justify-center">
                          <Film className="w-3.5 h-3.5 text-white/20" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <p className="text-white/85 text-sm font-medium truncate">{stat.title}</p>
                          {stat.hasVideo ? (
                            (() => {
                              const p = detectProvider(stat.videoUrl);
                              const meta = PROVIDER_META[p];
                              return (
                                <span className={`shrink-0 text-[9px] px-1.5 py-0.5 rounded-full border ${meta.cls}`}>
                                  {meta.label}
                                </span>
                              );
                            })()
                          ) : (
                            <span className="shrink-0 text-[9px] px-1.5 py-0.5 rounded-full bg-white/5 text-white/25 border border-white/8">
                              no video
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2 mt-1.5">
                          <div className="flex-1 h-1 rounded-full bg-white/8 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700" style={{ width: `${viewsBar}%`, background: accentColor }} />
                          </div>
                          <div className="flex-1 h-1 rounded-full bg-white/8 overflow-hidden">
                            <div className="h-full rounded-full transition-all duration-700 opacity-60" style={{ width: `${watchBar}%`, background: accentColor }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="w-16 text-right">
                      <span className="text-white font-semibold tabular-nums text-sm">{stat.views.toLocaleString()}</span>
                    </div>

                    <div className="w-24 text-right">
                      <span className="text-white/70 tabular-nums text-sm">{fmtDuration(stat.totalWatchSeconds)}</span>
                    </div>

                    <div className="w-24 text-right">
                      <span className="text-white/70 tabular-nums text-sm">{fmtDuration(stat.avgWatchSeconds)}</span>
                    </div>

                    <div className="w-20 text-right flex items-center justify-end gap-1.5">
                      <p className="text-white/40 text-xs">{relativeTime(stat.lastViewed)}</p>
                      {stat.slug && (
                        <a
                          href={`/projects/${stat.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-white/8"
                          title="View project page"
                        >
                          <ExternalLink className="w-3 h-3 text-white/40 hover:text-white/70" />
                        </a>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </GlassCard>

      {/* ── Legend note ──────────────────────────────────────────────────────── */}
      <p className="text-white/20 text-xs text-center">
        Watch time is estimated — timer runs while the video iframe is active and pauses when the tab is hidden.
      </p>
    </div>
  );
}
