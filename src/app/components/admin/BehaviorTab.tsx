import { useState, useCallback, useEffect, useRef } from 'react';
import { GlassCard } from '../shared/GlassCard';
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts';
import {
  Globe, Wrench, ShoppingCart, Play, Download, CheckCircle2,
  RefreshCw, ChevronDown, ChevronUp, Smartphone, Monitor, Tablet,
  Clock, ArrowRight, MousePointer, TrendingUp, Users, Activity,
  Filter, X, Eye, AlertTriangle, Mail, ExternalLink, Layers,
  BarChart2, ListFilter, Search, Crosshair, MoveDown,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { AdminSelect } from './AdminSelect';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

function getAuthHeaders() {
  const token = localStorage.getItem('admin_token');
  return { 'Authorization': `Bearer ${publicAnonKey}`, 'X-Admin-Token': token || '' };
}

// ── Colour palette ─────────────────────────────────────────────────────────────
const C = {
  purple: '#a855f7', blue: '#60a5fa', green: '#34d399',
  amber:  '#f59e0b', red:  '#f87171', cyan: '#22d3ee',
  pink:   '#f472b6',
};
const CHART_PALETTE = [C.purple, C.blue, C.green, C.amber, C.red, C.cyan];

// ── Types ──────────────────────────────────────────────────────────────────────
interface FunnelStep { stage: string; label: string; count: number; pct: number; dropOff: number; }
interface PageItem    { path: string; count: number; avgDuration: number; }
interface ToolItem    { slug: string; name: string; views: number; buyClicks: number; videoPlays: number; convRate: number; }
interface DeviceItem  { device: string; count: number; }
interface SeriesPoint { date: string; sessions: number; toolViews: number; buyClicks: number; }
interface BehaviorSummary {
  totalSessions: number; bounceRate: number; avgPageViews: number;
  avgDuration: number; convRate: number;
}
interface Session {
  sessionId: string; userId?: string; userEmail?: string;
  startedAt: string; lastSeenAt: string; device: string; browser: string; os: string;
  referrer: string; utmSource?: string; utmMedium?: string; utmCampaign?: string;
  pageCount: number; totalDuration: number; toolsViewed: string[]; toolNamesViewed: string[];
  buyClickCount: number; videoPlayCount: number;
  converted: boolean; isBounce: boolean; lastPath: string;
  funnelStage: 'visit' | 'tool_view' | 'buy_click' | 'purchase';
  eventCount: number;
}
interface BehaviorData {
  total: number; page: number; limit: number;
  sessions: Session[];
  funnel: FunnelStep[];
  topPages: PageItem[];
  toolFunnel: ToolItem[];
  dailySeries: SeriesPoint[];
  deviceBreakdown: DeviceItem[];
  summary: BehaviorSummary;
}
interface FullSession extends Session {
  events: Array<{ type: string; timestamp: string; data: Record<string, any> }>;
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function fmtDur(s: number) {
  if (s < 60)  return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}
function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function shortDate(iso: string) {
  const d = new Date(iso);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}
function shortId(id: string) { return id.slice(0, 8); }

const STAGE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  visit:     { label: 'Browsing',   color: 'text-blue-400',   bg: 'bg-blue-500/15',   border: 'border-blue-500/25' },
  tool_view: { label: 'Tool View',  color: 'text-purple-400', bg: 'bg-purple-500/15', border: 'border-purple-500/25' },
  buy_click: { label: 'Buy Click',  color: 'text-amber-400',  bg: 'bg-amber-500/15',  border: 'border-amber-500/25' },
  purchase:  { label: 'Purchased',  color: 'text-green-400',  bg: 'bg-green-500/15',  border: 'border-green-500/25' },
};
const EVENT_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  page_view:        { label: 'Page View',       color: 'text-blue-400',   icon: <Globe className="w-3.5 h-3.5" /> },
  page_exit:        { label: 'Left Page',        color: 'text-white/30',   icon: <ArrowRight className="w-3.5 h-3.5" /> },
  tool_view:        { label: 'Viewed Tool',      color: 'text-purple-400', icon: <Wrench className="w-3.5 h-3.5" /> },
  buy_click:        { label: 'Clicked Buy',      color: 'text-amber-400',  icon: <ShoppingCart className="w-3.5 h-3.5" /> },
  video_play:       { label: 'Played Video',     color: 'text-pink-400',   icon: <Play className="w-3.5 h-3.5" /> },
  free_download:    { label: 'Free Download',    color: 'text-cyan-400',   icon: <Download className="w-3.5 h-3.5" /> },
  purchase_complete:{ label: 'Purchased',        color: 'text-green-400',  icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
};

function DeviceIcon({ device }: { device: string }) {
  if (device === 'mobile') return <Smartphone className="w-3.5 h-3.5 text-cyan-400" />;
  if (device === 'tablet') return <Tablet    className="w-3.5 h-3.5 text-purple-400" />;
  return <Monitor className="w-3.5 h-3.5 text-blue-400" />;
}

function StageBadge({ stage }: { stage: string }) {
  const cfg = STAGE_CONFIG[stage] || STAGE_CONFIG.visit;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function ChartTip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#1a1025]/95 backdrop-blur px-3 py-2.5 shadow-xl text-xs">
      <p className="text-white/40 mb-1.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="flex items-center gap-2 text-white">
          <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
          <span className="text-white/50">{p.name}:</span>
          <span className="font-semibold tabular-nums">{p.value}</span>
        </p>
      ))}
    </div>
  );
}

// ── Canvas heatmap renderer ────────────────────────────────────────────────────
function renderHeatmap(canvas: HTMLCanvasElement, clicks: Array<{ x: number; y: number }>) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const W = canvas.width, H = canvas.height;
  ctx.clearRect(0, 0, W, H);
  if (clicks.length === 0) return;

  // Draw accumulating radial gradients on an offscreen canvas (alpha = density)
  const off = document.createElement('canvas');
  off.width = W; off.height = H;
  const offCtx = off.getContext('2d')!;
  const R = Math.max(W * 0.07, 24); // spot radius

  for (const pt of clicks) {
    const cx = (pt.x / 100) * W;
    const cy = (pt.y / 100) * H;
    const g = offCtx.createRadialGradient(cx, cy, 0, cx, cy, R);
    g.addColorStop(0, 'rgba(255,255,255,0.18)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    offCtx.fillStyle = g;
    offCtx.beginPath();
    offCtx.arc(cx, cy, R, 0, Math.PI * 2);
    offCtx.fill();
  }

  // Map alpha intensity to a cool → hot colormap
  const src = offCtx.getImageData(0, 0, W, H);
  const dst = ctx.createImageData(W, H);
  const s = src.data, d = dst.data;
  for (let i = 0; i < s.length; i += 4) {
    const intensity = s[i + 3] / 255;
    if (intensity === 0) continue;
    let r = 0, g = 0, b = 0;
    const t = Math.min(intensity * 2.5, 1); // amplify low values
    if      (t < 0.25) { const v = t / 0.25;       r = 50;  g = Math.floor(v*120); b = 230; }
    else if (t < 0.50) { const v = (t-0.25)/0.25;  r = 0;   g = Math.floor(120+v*135); b = Math.floor(230*(1-v)); }
    else if (t < 0.75) { const v = (t-0.50)/0.25;  r = Math.floor(v*255); g = 255; b = 0; }
    else               { const v = (t-0.75)/0.25;  r = 255; g = Math.floor(255*(1-v)); b = 0; }
    d[i] = r; d[i+1] = g; d[i+2] = b; d[i+3] = Math.floor(intensity * 230);
  }
  ctx.putImageData(dst, 0, 0);
}

// ── Heatmap panel ──────────────────────────────────────────────────────────────
function HeatmapPanel() {
  const [availablePaths, setAvailablePaths] = useState<string[]>([]);
  const [selectedPath,   setSelectedPath]   = useState('');
  const [clicks,         setClicks]         = useState<Array<{ x: number; y: number }>>([]);
  const [scrollDepth,    setScrollDepth]    = useState<Array<{ percent: number; count: number; pct: number }>>([]);
  const [scrollVisitors, setScrollVisitors] = useState(0);
  const [totalClicks,    setTotalClicks]    = useState(0);
  const [loading,        setLoading]        = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load available paths on mount
  useEffect(() => {
    fetch(`${API_BASE}/admin/behavior/heatmap?path=`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(d => { if (d.success) setAvailablePaths(d.data.availablePaths || []); })
      .catch(console.error);
  }, []);

  // Load click + scroll data when path changes
  useEffect(() => {
    if (!selectedPath) return;
    setLoading(true);
    fetch(`${API_BASE}/admin/behavior/heatmap?path=${encodeURIComponent(selectedPath)}`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setClicks(d.data.clicks || []);
          setScrollDepth(d.data.scrollDepth || []);
          setScrollVisitors(d.data.scrollVisitors || 0);
          setTotalClicks(d.data.totalClicks || 0);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [selectedPath]);

  // Re-render heatmap when clicks change
  useEffect(() => {
    if (canvasRef.current) renderHeatmap(canvasRef.current, clicks);
  }, [clicks]);

  // Page wireframe zones (normalised %)
  const wireframeZones = [
    { y: 0,  h: 6,  label: 'Navigation', color: '#ffffff08' },
    { y: 6,  h: 22, label: 'Hero',        color: '#ffffff05' },
    { y: 28, h: 18, label: 'Content A',   color: '#ffffff04' },
    { y: 46, h: 18, label: 'Content B',   color: '#ffffff05' },
    { y: 64, h: 18, label: 'Pricing',     color: '#ffffff04' },
    { y: 82, h: 12, label: 'Footer',      color: '#ffffff08' },
  ];

  return (
    <div className="space-y-4">
      {/* Page selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[220px] max-w-xs">
          <AdminSelect
            value={selectedPath}
            onChange={setSelectedPath}
            options={[
              { value: '', label: '— Select a page —' },
              ...availablePaths.map(p => ({ value: p, label: p })),
            ]}
            placeholder="— Select a page —"
          />
        </div>
        {totalClicks > 0 && (
          <span className="text-white/30 text-xs">{totalClicks.toLocaleString()} clicks recorded</span>
        )}
      </div>

      {availablePaths.length === 0 && (
        <div className="py-8 text-center">
          <Crosshair className="w-8 h-8 text-white/10 mx-auto mb-2" />
          <p className="text-white/25 text-sm">No click data yet — users need to interact with the site first.</p>
        </div>
      )}

      {selectedPath && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-5">

          {/* Heatmap canvas */}
          <div>
            <p className="text-white/30 text-xs mb-2 flex items-center gap-1.5">
              <Crosshair className="w-3 h-3" />
              Click density — <span className="text-purple-400">warmer = more clicks</span>
            </p>
            <div className="relative rounded-2xl overflow-hidden border border-white/8 bg-[#0a0612]"
              style={{ aspectRatio: '9/16', maxHeight: 560 }}>
              {loading && (
                <div className="absolute inset-0 flex items-center justify-center z-20">
                  <RefreshCw className="w-6 h-6 text-purple-400 animate-spin" />
                </div>
              )}
              {/* Wireframe backdrop */}
              {wireframeZones.map((z, i) => (
                <div
                  key={i}
                  className="absolute left-0 right-0 border-b border-white/4 flex items-center px-3"
                  style={{ top: `${z.y}%`, height: `${z.h}%`, background: z.color }}
                >
                  <span className="text-white/10 text-[9px] font-mono">{z.label}</span>
                </div>
              ))}
              {/* Heatmap overlay */}
              <canvas
                ref={canvasRef}
                width={360}
                height={640}
                className="absolute inset-0 w-full h-full mix-blend-screen"
              />
              {/* Empty state */}
              {!loading && clicks.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <p className="text-white/15 text-xs">No click data for this page</p>
                </div>
              )}
            </div>
            {/* Color legend */}
            <div className="mt-2 flex items-center justify-between">
              <span className="text-white/20 text-[10px]">Low</span>
              <div className="flex-1 mx-3 h-1.5 rounded-full"
                style={{ background: 'linear-gradient(90deg, #3264e6, #00e5ff, #00ff88, #ffdd00, #ff4400)' }} />
              <span className="text-white/20 text-[10px]">High</span>
            </div>
          </div>

          {/* Scroll depth chart */}
          <div className="space-y-4">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <MoveDown className="w-3.5 h-3.5 text-cyan-400" />
                <span className="text-white/60 text-sm font-semibold">Scroll Depth</span>
                {scrollVisitors > 0 && <span className="text-white/20 text-xs">({scrollVisitors} visitors)</span>}
              </div>
              {scrollDepth.length === 0 ? (
                <p className="text-white/20 text-xs">No scroll data yet</p>
              ) : (
                <div className="space-y-3">
                  {scrollDepth.map(({ percent, count, pct }) => (
                    <div key={percent}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-white/40 text-xs">{percent}% of page</span>
                        <div className="flex items-center gap-2">
                          <span className="text-white/50 text-xs tabular-nums">{count} visitors</span>
                          <span className="text-cyan-400 text-xs font-bold tabular-nums">{pct}%</span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-white/5">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.7, delay: percent / 400 }}
                          className="h-2 rounded-full"
                          style={{
                            background: `linear-gradient(90deg, ${
                              percent <= 25 ? '#22d3ee' :
                              percent <= 50 ? '#60a5fa' :
                              percent <= 75 ? '#a855f7' : '#f59e0b'
                            }, ${
                              percent <= 25 ? '#60a5fa' :
                              percent <= 50 ? '#a855f7' :
                              percent <= 75 ? '#f59e0b' : '#f87171'
                            })`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Hot zones summary */}
            {clicks.length > 0 && (() => {
              // Find the top 5 Y-coordinate buckets (0-9, 10-19, etc.)
              const buckets: Record<number, number> = {};
              for (const c of clicks) {
                const bucket = Math.floor(c.y / 10) * 10;
                buckets[bucket] = (buckets[bucket] || 0) + 1;
              }
              const topBuckets = Object.entries(buckets)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([bucket, count]) => ({ bucket: parseInt(bucket), count }));

              const getZoneName = (y: number) => {
                for (const z of wireframeZones) {
                  if (y >= z.y && y < z.y + z.h) return z.label;
                }
                return `${y}–${y+10}%`;
              };

              return (
                <div>
                  <p className="text-white/30 text-xs font-medium mb-2">🔥 Hot zones</p>
                  <div className="space-y-1.5">
                    {topBuckets.map(({ bucket, count }) => (
                      <div key={bucket} className="flex items-center justify-between">
                        <span className="text-white/40 text-xs">{getZoneName(bucket)}</span>
                        <span className="text-amber-400/80 text-xs font-semibold tabular-nums">{count} clicks</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Session timeline (expanded) ───────────────────────────────────────────────
function SessionTimeline({ sessionId }: { sessionId: string }) {
  const [session, setSession] = useState<FullSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`${API_BASE}/admin/behavior/session/${sessionId}`, { headers: getAuthHeaders() })
      .then(r => r.json())
      .then(d => { if (d.success) setSession(d.data); })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [sessionId]);

  if (loading) return (
    <div className="py-6 flex items-center justify-center gap-2 text-white/25 text-xs">
      <RefreshCw className="w-3.5 h-3.5 animate-spin" />Loading timeline…
    </div>
  );
  if (!session) return <p className="text-white/30 text-xs py-4 text-center">Could not load session.</p>;

  const events = session.events || [];

  return (
    <div className="pt-3 pb-2 px-4">
      {/* Meta row */}
      <div className="flex flex-wrap gap-x-5 gap-y-1 mb-4 text-xs text-white/30">
        {session.userEmail && <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{session.userEmail}</span>}
        <span>{session.browser} · {session.os}</span>
        {session.referrer && <span className="flex items-center gap-1 truncate max-w-[200px]">From: {session.referrer}</span>}
        {session.utmSource && <span>UTM: {[session.utmSource, session.utmMedium, session.utmCampaign].filter(Boolean).join(' / ')}</span>}
      </div>

      {/* Event stream */}
      {events.length === 0 ? (
        <p className="text-white/20 text-xs text-center py-3">No events recorded.</p>
      ) : (
        <div className="relative">
          {/* Vertical line */}
          <div className="absolute left-[15px] top-0 bottom-0 w-px bg-white/8" />
          <div className="space-y-2">
            {events.map((e, i) => {
              const cfg = EVENT_CONFIG[e.type] || { label: e.type, color: 'text-white/30', icon: <Activity className="w-3.5 h-3.5" /> };
              return (
                <div key={i} className="flex items-start gap-3 pl-1">
                  {/* Dot */}
                  <div className={`relative z-10 w-8 h-8 rounded-full bg-[#0d0817] border border-white/10 flex-shrink-0 flex items-center justify-center ${cfg.color}`}>
                    {cfg.icon}
                  </div>
                  {/* Content */}
                  <div className="flex-1 min-w-0 pt-1.5">
                    <div className="flex items-center justify-between flex-wrap gap-x-3">
                      <span className={`text-xs font-semibold ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-white/20 text-[10px] flex-shrink-0">{fmtDate(e.timestamp)}</span>
                    </div>
                    {/* Event data */}
                    <div className="flex flex-wrap gap-x-3 mt-0.5">
                      {e.data?.path        && <span className="text-white/30 text-[10px]">{e.data.path}</span>}
                      {e.data?.toolName    && <span className="text-white/30 text-[10px]">{e.data.toolName}</span>}
                      {e.data?.duration    !== undefined && <span className="text-white/30 text-[10px]">{fmtDur(e.data.duration)}</span>}
                      {e.data?.versionType && <span className="text-amber-400/60 text-[10px]">{e.data.versionType} · {e.data.price}</span>}
                      {e.data?.videoId     && <span className="text-white/20 text-[10px]">video {e.data.videoId}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Funnel Bar ─────────────────────────────────────────────────────────────────
function FunnelSteps({ funnel }: { funnel: FunnelStep[] }) {
  const icons = [<Globe className="w-5 h-5" />, <Wrench className="w-5 h-5" />, <ShoppingCart className="w-5 h-5" />, <CheckCircle2 className="w-5 h-5" />];
  const colors = [C.blue, C.purple, C.amber, C.green];

  return (
    <div className="flex flex-col sm:flex-row items-stretch gap-0">
      {funnel.map((step, i) => (
        <div key={step.stage} className="flex sm:flex-col items-center sm:items-start flex-1">
          {/* Step card */}
          <div className="flex-1 sm:w-full relative p-5 rounded-2xl border border-white/8 bg-white/3 hover:bg-white/5 transition-colors">
            {/* Arrow connector */}
            {i < funnel.length - 1 && (
              <div className="hidden sm:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-[#0d0817] border border-white/10 items-center justify-center">
                <ArrowRight className="w-3 h-3 text-white/30" />
              </div>
            )}
            <div className="flex sm:flex-col items-center sm:items-start gap-3 sm:gap-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: `${colors[i]}15`, border: `1px solid ${colors[i]}25` }}>
                <span style={{ color: colors[i] }}>{icons[i]}</span>
              </div>
              <div>
                <p className="text-white font-bold text-xl sm:text-2xl tabular-nums">{step.count.toLocaleString()}</p>
                <p className="text-white/40 text-xs">{step.label}</p>
              </div>
            </div>

            {/* Conversion rate */}
            <div className="mt-3 sm:mt-4">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-white/25 text-[10px]">vs total visits</span>
                <span className="font-bold text-xs" style={{ color: colors[i] }}>{step.pct}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${step.pct}%` }}
                  transition={{ duration: 0.8, delay: i * 0.12 }}
                  className="h-1.5 rounded-full"
                  style={{ background: `linear-gradient(90deg, ${colors[i]}, ${colors[(i + 1) % colors.length]})` }}
                />
              </div>
            </div>

            {/* Drop-off */}
            {step.dropOff > 0 && (
              <p className="text-red-400/50 text-[10px] mt-1.5 flex items-center gap-1">
                <AlertTriangle className="w-2.5 h-2.5" />
                {step.dropOff} dropped off before this step
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────
export function BehaviorTab() {
  const [data,    setData]    = useState<BehaviorData | null>(null);
  const [loading, setLoading] = useState(false);
  const [page,    setPage]    = useState(1);
  const [activeSection, setActiveSection] = useState<'overview' | 'heatmap'>('overview');

  // Filters
  const [dateRange,   setDateRange]   = useState<'7d' | '30d' | '90d' | 'all'>('30d');
  const [deviceFilter, setDeviceFilter] = useState('all');
  const [stageFilter,  setStageFilter]  = useState('all');
  const [convFilter,   setConvFilter]   = useState('all');
  const [searchEmail,  setSearchEmail]  = useState('');

  // Expanded sessions
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const buildQuery = useCallback(() => {
    const params = new URLSearchParams({ page: String(page), limit: '20' });
    if (dateRange !== 'all') {
      const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
      const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      params.set('from', from);
    }
    if (deviceFilter !== 'all') params.set('device', deviceFilter);
    if (stageFilter  !== 'all') params.set('stage',  stageFilter);
    if (convFilter   !== 'all') params.set('converted', convFilter === 'converted' ? 'true' : 'false');
    return params.toString();
  }, [page, dateRange, deviceFilter, stageFilter, convFilter]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res  = await fetch(`${API_BASE}/admin/behavior?${buildQuery()}`, { headers: getAuthHeaders() });
      const json = await res.json();
      if (json.success) setData(json.data);
      else console.error('[BehaviorTab]', json.error);
    } catch (err) {
      console.error('[BehaviorTab]', err);
    } finally {
      setLoading(false);
    }
  }, [buildQuery]);

  useEffect(() => { load(); }, [load]);

  const toggleExpand = (sid: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(sid)) next.delete(sid); else next.add(sid);
      return next;
    });
  };

  // Apply client-side email filter
  const filteredSessions = data?.sessions.filter(s =>
    !searchEmail || (s.userEmail || '').toLowerCase().includes(searchEmail.toLowerCase())
  ) ?? [];

  const summary = data?.summary;
  const hasFilters = dateRange !== '30d' || deviceFilter !== 'all' || stageFilter !== 'all' || convFilter !== 'all';

  const clearFilters = () => {
    setDateRange('30d'); setDeviceFilter('all'); setStageFilter('all'); setConvFilter('all');
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/30 flex items-center justify-center">
            <Activity className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h3 className="text-white font-bold text-lg">User Behavior</h3>
            <p className="text-white/30 text-xs">
              {data ? `${data.total.toLocaleString()} sessions tracked` : 'Tracking visitor journeys'}
            </p>
          </div>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/40 hover:text-white/80 text-xs disabled:opacity-40 transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />Refresh
        </button>
      </div>

      {/* ── Filter Bar ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2 items-center">
        {/* Date range */}
        <div className="flex gap-0.5 p-0.5 rounded-lg bg-white/5 border border-white/8">
          {(['7d', '30d', '90d', 'all'] as const).map(r => (
            <button key={r} onClick={() => { setDateRange(r); setPage(1); }}
              className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${dateRange === r ? 'bg-purple-500/20 text-purple-300' : 'text-white/30 hover:text-white/60'}`}>
              {r === 'all' ? 'All time' : r}
            </button>
          ))}
        </div>

        {/* Device */}
        <AdminSelect
          value={deviceFilter}
          onChange={v => { setDeviceFilter(v); setPage(1); }}
          options={[
            { value: 'all',     label: 'All devices' },
            { value: 'desktop', label: 'Desktop' },
            { value: 'mobile',  label: 'Mobile' },
            { value: 'tablet',  label: 'Tablet' },
          ]}
          className="w-36"
        />

        {/* Funnel stage */}
        <AdminSelect
          value={stageFilter}
          onChange={v => { setStageFilter(v); setPage(1); }}
          options={[
            { value: 'all',       label: 'All stages' },
            { value: 'visit',     label: 'Browsing only' },
            { value: 'tool_view', label: 'Viewed a tool' },
            { value: 'buy_click', label: 'Clicked buy' },
            { value: 'purchase',  label: 'Purchased' },
          ]}
          className="w-40"
        />

        {/* Conversion */}
        <AdminSelect
          value={convFilter}
          onChange={v => { setConvFilter(v); setPage(1); }}
          options={[
            { value: 'all',           label: 'All outcomes' },
            { value: 'converted',     label: 'Converted' },
            { value: 'not_converted', label: 'Not converted' },
          ]}
          className="w-40"
        />

        {hasFilters && (
          <button onClick={clearFilters}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs hover:bg-red-500/20 transition-all">
            <X className="w-3 h-3" />Clear
          </button>
        )}
      </div>

      {/* Loading skeleton */}
      {loading && !data && (
        <GlassCard className="p-8 text-center">
          <RefreshCw className="w-7 h-7 text-purple-400 animate-spin mx-auto mb-3" />
          <p className="text-white/30 text-sm">Loading behavior data…</p>
        </GlassCard>
      )}

      {data && (
        <>
          {/* ── Summary KPI row ──────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              { label: 'Sessions',     value: summary!.totalSessions.toLocaleString(), icon: <Users className="w-4 h-4" />,      color: C.purple },
              { label: 'Bounce Rate',  value: `${summary!.bounceRate}%`,                icon: <AlertTriangle className="w-4 h-4" />, color: C.red    },
              { label: 'Avg Pages',    value: `${summary!.avgPageViews}`,               icon: <Globe className="w-4 h-4" />,        color: C.blue   },
              { label: 'Avg Duration', value: fmtDur(summary!.avgDuration),             icon: <Clock className="w-4 h-4" />,        color: C.cyan   },
              { label: 'Buy Rate',     value: `${summary!.convRate}%`,                  icon: <MousePointer className="w-4 h-4" />, color: C.amber  },
            ].map((m, i) => (
              <div key={i} className="rounded-2xl border border-white/8 bg-white/3 p-4 relative overflow-hidden">
                <div className="absolute -top-4 -right-4 w-14 h-14 rounded-full blur-xl opacity-15 pointer-events-none" style={{ background: m.color }} />
                <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2" style={{ background: `${m.color}15`, border: `1px solid ${m.color}25` }}>
                  <span style={{ color: m.color }}>{m.icon}</span>
                </div>
                <p className="text-white font-bold text-xl tabular-nums">{m.value}</p>
                <p className="text-white/35 text-[11px]">{m.label}</p>
              </div>
            ))}
          </div>

          {/* ── Conversion Funnel ────────────────────────────────────────── */}
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-5">
              <Layers className="w-4 h-4 text-purple-400" />
              <h3 className="text-white font-semibold">Conversion Funnel</h3>
            </div>
            <FunnelSteps funnel={data.funnel} />
          </GlassCard>

          {/* ── Daily activity chart ────────────────────────────────────── */}
          <GlassCard className="p-5">
            <div className="flex items-center gap-2 mb-5">
              <TrendingUp className="w-4 h-4 text-blue-400" />
              <h3 className="text-white font-semibold">Daily Activity (last 30 days)</h3>
            </div>
            {data.dailySeries.every(d => d.sessions === 0) ? (
              <div className="h-44 flex items-center justify-center">
                <p className="text-white/20 text-sm">No sessions recorded yet</p>
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data.dailySeries} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
                  <defs>
                    {['sessions','toolViews','buyClicks'].map((k, i) => (
                      <linearGradient key={k} id={`bg${k}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%"  stopColor={CHART_PALETTE[i]} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={CHART_PALETTE[i]} stopOpacity={0} />
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff08" />
                  <XAxis dataKey="date" tickFormatter={shortDate} tick={{ fill: '#ffffff25', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#ffffff20', fontSize: 9 }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip content={<ChartTip />} />
                  <Area type="monotone" dataKey="sessions"  stroke={C.blue}   strokeWidth={2} fill="url(#bgsessions)"  name="Sessions"   />
                  <Area type="monotone" dataKey="toolViews" stroke={C.purple} strokeWidth={1.5} fill="url(#bgtoolViews)" name="Tool Views" />
                  <Area type="monotone" dataKey="buyClicks" stroke={C.amber}  strokeWidth={1.5} fill="url(#bgbuyClicks)" name="Buy Clicks" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </GlassCard>

          {/* ── Top Pages + Device breakdown ────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-5">

            {/* Top pages */}
            <GlassCard className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-4 h-4 text-blue-400" />
                <h3 className="text-white font-semibold">Most Visited Pages</h3>
              </div>
              {data.topPages.length === 0 ? (
                <p className="text-white/20 text-sm text-center py-6">No page data yet</p>
              ) : (
                <div className="space-y-3">
                  {data.topPages.map((p, i) => {
                    const max = data.topPages[0]?.count ?? 1;
                    const pct = Math.round((p.count / max) * 100);
                    const pageName = p.path === '/' ? 'Home' : p.path.replace('/','').replace(/-/g,' ');
                    return (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-white/60 text-xs truncate max-w-[55%] capitalize">{pageName}</span>
                          <div className="flex items-center gap-3">
                            {p.avgDuration > 0 && (
                              <span className="text-white/20 text-[10px]">{fmtDur(p.avgDuration)} avg</span>
                            )}
                            <span className="text-white/50 text-xs tabular-nums">{p.count}</span>
                          </div>
                        </div>
                        <div className="h-1.5 rounded-full bg-white/5">
                          <div className="h-1.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 transition-all" style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </GlassCard>

            {/* Device breakdown */}
            <GlassCard className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <Monitor className="w-4 h-4 text-cyan-400" />
                <h3 className="text-white font-semibold">Devices</h3>
              </div>
              {data.deviceBreakdown.length === 0 ? (
                <p className="text-white/20 text-sm text-center py-6">No data</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={130}>
                    <PieChart>
                      <Pie data={data.deviceBreakdown} cx="50%" cy="50%" innerRadius={35} outerRadius={58}
                        paddingAngle={3} dataKey="count" nameKey="device">
                        {data.deviceBreakdown.map((_, i) => (
                          <Cell key={i} fill={CHART_PALETTE[i % CHART_PALETTE.length]} />
                        ))}
                      </Pie>
                      <Tooltip content={({ active, payload }: any) => {
                        if (!active || !payload?.length) return null;
                        const p = payload[0].payload;
                        const total = data.deviceBreakdown.reduce((s, d) => s + d.count, 0);
                        return (
                          <div className="rounded-lg border border-white/10 bg-[#1a1025]/95 px-3 py-1.5 text-xs shadow-xl">
                            <p className="text-white capitalize">{p.device}: {p.count} ({Math.round(p.count/total*100)}%)</p>
                          </div>
                        );
                      }} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1.5 mt-1">
                    {data.deviceBreakdown.map((d, i) => {
                      const total = data.deviceBreakdown.reduce((s, x) => s + x.count, 0);
                      return (
                        <div key={i} className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full" style={{ background: CHART_PALETTE[i % CHART_PALETTE.length] }} />
                            <span className="text-white/50 text-xs capitalize">{d.device}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-white/30 text-xs">{Math.round(d.count/total*100)}%</span>
                            <span className="text-white text-xs font-semibold tabular-nums">{d.count}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </GlassCard>
          </div>

          {/* ── Tool Conversion Funnel ──────────────────────────────────── */}
          {data.toolFunnel.length > 0 && (
            <GlassCard className="p-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 className="w-4 h-4 text-amber-400" />
                <h3 className="text-white font-semibold">Per-Tool Funnel</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-white/8">
                      <th className="text-left text-white/25 pb-3 pr-6 font-medium">Tool</th>
                      <th className="text-right text-white/25 pb-3 pr-4 font-medium">Views</th>
                      <th className="text-right text-white/25 pb-3 pr-4 font-medium">Video Plays</th>
                      <th className="text-right text-white/25 pb-3 pr-4 font-medium">Buy Clicks</th>
                      <th className="text-right text-white/25 pb-3 font-medium">Conv. Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.toolFunnel.map((t, i) => (
                      <tr key={i} className="border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
                        <td className="py-3 pr-6 text-white/70 font-medium">{t.name}</td>
                        <td className="py-3 pr-4 text-right text-white/50 tabular-nums">{t.views}</td>
                        <td className="py-3 pr-4 text-right">
                          {t.videoPlays > 0
                            ? <span className="text-pink-400/80 tabular-nums">{t.videoPlays}</span>
                            : <span className="text-white/15">—</span>}
                        </td>
                        <td className="py-3 pr-4 text-right">
                          {t.buyClicks > 0
                            ? <span className="text-amber-400/80 tabular-nums">{t.buyClicks}</span>
                            : <span className="text-white/15">—</span>}
                        </td>
                        <td className="py-3 text-right">
                          <span className={`font-bold tabular-nums ${
                            t.convRate >= 20 ? 'text-green-400' :
                            t.convRate >= 10 ? 'text-amber-400' :
                            t.convRate > 0  ? 'text-white/60'  : 'text-white/20'
                          }`}>
                            {t.convRate > 0 ? `${t.convRate}%` : '—'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </GlassCard>
          )}

          {/* ── Click Heatmap + Scroll Depth ──────────────────────────── */}
          <GlassCard className="p-5">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
              <div className="flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-pink-400" />
                <h3 className="text-white font-semibold">Click Heatmap & Scroll Depth</h3>
              </div>
              <p className="text-white/25 text-xs">Select a page to visualise where users click and how far they scroll</p>
            </div>
            <HeatmapPanel />
          </GlassCard>

          {/* ── Sessions Table ───────────────────────────────────────────── */}
          <GlassCard className="p-5">
            <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
              <div className="flex items-center gap-2">
                <ListFilter className="w-4 h-4 text-purple-400" />
                <h3 className="text-white font-semibold">Sessions</h3>
                <span className="text-white/25 text-xs">({data.total} total)</span>
              </div>
              {/* Email search */}
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/25" />
                <input
                  type="text"
                  placeholder="Search email…"
                  value={searchEmail}
                  onChange={e => setSearchEmail(e.target.value)}
                  className="pl-8 pr-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white/60 text-xs placeholder-white/20 outline-none focus:border-purple-500/40 w-44 transition-all"
                />
              </div>
            </div>

            {filteredSessions.length === 0 ? (
              <div className="py-10 text-center">
                <Users className="w-8 h-8 text-white/10 mx-auto mb-2" />
                <p className="text-white/25 text-sm">No sessions match your filters</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredSessions.map(s => (
                  <div key={s.sessionId} className="rounded-xl border border-white/8 bg-white/2 overflow-hidden">
                    {/* Session row */}
                    <button
                      className="w-full text-left"
                      onClick={() => toggleExpand(s.sessionId)}
                    >
                      <div className="flex items-center gap-3 p-3 hover:bg-white/3 transition-colors flex-wrap">
                        {/* Device icon */}
                        <div className="w-7 h-7 rounded-lg bg-white/5 border border-white/8 flex items-center justify-center flex-shrink-0">
                          <DeviceIcon device={s.device} />
                        </div>

                        {/* Identity */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            {s.userEmail ? (
                              <span className="text-white/70 text-xs font-medium truncate max-w-[180px]">{s.userEmail}</span>
                            ) : (
                              <span className="text-white/25 text-xs font-mono">#{shortId(s.sessionId)}</span>
                            )}
                            <StageBadge stage={s.funnelStage} />
                            {s.converted && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-green-500/15 border border-green-500/25 text-green-400">
                                ✓ Converted
                              </span>
                            )}
                            {s.isBounce && (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] border border-white/8 text-white/20">
                                Bounce
                              </span>
                            )}
                          </div>
                          <p className="text-white/25 text-[10px] mt-0.5">{fmtDate(s.startedAt)}</p>
                        </div>

                        {/* Stats */}
                        <div className="flex items-center gap-4 flex-shrink-0">
                          <div className="text-center">
                            <p className="text-white/60 text-xs font-semibold tabular-nums">{s.pageCount}</p>
                            <p className="text-white/20 text-[9px]">pages</p>
                          </div>
                          <div className="text-center">
                            <p className="text-white/60 text-xs font-semibold">{fmtDur(s.totalDuration)}</p>
                            <p className="text-white/20 text-[9px]">duration</p>
                          </div>
                          {s.videoPlayCount > 0 && (
                            <div className="text-center">
                              <p className="text-pink-400/80 text-xs font-semibold tabular-nums">{s.videoPlayCount}</p>
                              <p className="text-white/20 text-[9px]">videos</p>
                            </div>
                          )}
                          {s.buyClickCount > 0 && (
                            <div className="text-center">
                              <p className="text-amber-400/80 text-xs font-semibold tabular-nums">{s.buyClickCount}</p>
                              <p className="text-white/20 text-[9px]">buy clicks</p>
                            </div>
                          )}
                          <div className="text-white/20">
                            {expanded.has(s.sessionId)
                              ? <ChevronUp className="w-3.5 h-3.5" />
                              : <ChevronDown className="w-3.5 h-3.5" />}
                          </div>
                        </div>
                      </div>

                      {/* Tools viewed chips */}
                      {s.toolNamesViewed?.length > 0 && !expanded.has(s.sessionId) && (
                        <div className="px-3 pb-2 flex flex-wrap gap-1">
                          {s.toolNamesViewed.map((name, i) => (
                            <span key={i} className="px-2 py-0.5 rounded-full text-[10px] bg-purple-500/10 border border-purple-500/20 text-purple-400">
                              {name}
                            </span>
                          ))}
                        </div>
                      )}
                    </button>

                    {/* Expanded timeline */}
                    <AnimatePresence initial={false}>
                      {expanded.has(s.sessionId) && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22 }}
                          className="overflow-hidden border-t border-white/6"
                        >
                          <SessionTimeline sessionId={s.sessionId} />
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                ))}
              </div>
            )}

            {/* Pagination */}
            {data.total > data.limit && (
              <div className="flex items-center justify-between mt-5 pt-4 border-t border-white/8">
                <p className="text-white/25 text-xs">
                  Showing {(data.page - 1) * data.limit + 1}–{Math.min(data.page * data.limit, data.total)} of {data.total}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-white/40 text-xs disabled:opacity-30 hover:text-white/70 transition-all"
                  >← Prev</button>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={data.page * data.limit >= data.total}
                    className="px-3 py-1 rounded-lg bg-white/5 border border-white/10 text-white/40 text-xs disabled:opacity-30 hover:text-white/70 transition-all"
                  >Next →</button>
                </div>
              </div>
            )}
          </GlassCard>
        </>
      )}
    </div>
  );
}