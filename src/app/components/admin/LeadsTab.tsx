import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { GlassCard } from '../shared/GlassCard';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { AdminSelect } from './AdminSelect';
import {
  Download, RefreshCw, Search, Mail, Calendar,
  Wrench, ChevronUp, ChevronDown, ChevronsUpDown, Users,
  UserPlus, Tag, Layers, Monitor, Globe, Smartphone, Tablet,
  MousePointer2, Clock, TrendingUp, CheckCircle2, Activity,
  Chrome, Navigation, ShoppingCart,
} from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

// ── Types ──────────────────────────────────────────────────────────────────────

interface Lead {
  email:         string;
  source:        'free_download' | 'signup';
  tier:          'Free' | 'Pro' | 'Studio' | 'Registered';
  toolName:      string;
  toolSlug:      string;
  toolCategory:  string;
  toolVersionId: string;
  createdAt:     string;
  displayName?:  string;
}

interface LeadBehavior {
  sessionCount:  number;
  firstSeen:     string;
  lastSeen:      string;
  totalDuration: number;
  pagesVisited:  string[];
  toolsViewed:   string[];
  funnelStage:   'visit' | 'tool_view' | 'buy_click' | 'purchase';
  converted:     boolean;
  device:        string;
  browser:       string;
  os:            string;
  referrer:      string;
  utmSource?:    string | null;
  utmMedium?:    string | null;
  utmCampaign?:  string | null;
}

type SortKey = 'email' | 'toolName' | 'toolCategory' | 'tier' | 'source' | 'createdAt';
type SortDir = 'asc' | 'desc';

// ── Helpers ───────────────────────────────────────────────────────────────────

function getAuthHeaders() {
  const token = localStorage.getItem('admin_token');
  return {
    'Authorization': `Bearer ${publicAnonKey}`,
    'X-Admin-Token': token || '',
  };
}

function exportCSV(leads: Lead[]) {
  const header = ['Email', 'Display Name', 'Source', 'Tier', 'Tool', 'Tool Slug', 'Category', 'Date'];
  const rows = leads.map(l => [
    l.email,
    l.displayName || '',
    l.source === 'free_download' ? 'Free Download' : 'Sign-up',
    l.tier,
    l.toolName,
    l.toolSlug,
    l.toolCategory,
    l.createdAt ? new Date(l.createdAt).toISOString() : '',
  ]);
  const csv = [header, ...rows]
    .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `fastoosh-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function fmtDuration(sec: number): string {
  if (!sec || sec <= 0) return '0s';
  if (sec < 60)   return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${sec % 60}s`;
  return `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`;
}

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function shortDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// ── Badge config ──────────────────────────────────────────────────────────────

const TIER_STYLES: Record<string, string> = {
  Free:       'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20',
  Pro:        'bg-amber-500/15 text-amber-300 border border-amber-500/20',
  Studio:     'bg-purple-500/15 text-purple-300 border border-purple-500/20',
  Registered: 'bg-sky-500/15 text-sky-300 border border-sky-500/20',
};

const SOURCE_STYLES: Record<string, string> = {
  free_download: 'bg-emerald-500/10 text-emerald-400',
  signup:        'bg-sky-500/10 text-sky-400',
};

const SOURCE_LABELS: Record<string, string> = {
  free_download: 'Free Download',
  signup:        'Sign-up',
};

const FUNNEL_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  visit:     { label: 'Visited',   color: 'bg-white/10 text-white/50 border-white/10',          icon: <Navigation   className="w-3 h-3" /> },
  tool_view: { label: 'Tool View', color: 'bg-blue-500/15 text-blue-300 border-blue-500/20',    icon: <MousePointer2 className="w-3 h-3" /> },
  buy_click: { label: 'Buy Click', color: 'bg-amber-500/15 text-amber-300 border-amber-500/20', icon: <TrendingUp   className="w-3 h-3" /> },
  purchase:  { label: 'Purchased', color: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/20', icon: <ShoppingCart className="w-3 h-3" /> },
};

// ── Filter pill component ─────────────────────────────────────────────────────

function Pill({
  active, onClick, children,
}: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer whitespace-nowrap
        ${active
          ? 'bg-purple-600 text-white shadow-[0_0_12px_rgba(147,51,234,0.4)]'
          : 'bg-white/5 text-white/45 hover:bg-white/10 hover:text-white/70 border border-white/8'
        }`}
    >
      {children}
    </button>
  );
}

// ── Sort icon ─────────────────────────────────────────────────────────────────

function SortIcon({ k, sortKey, sortDir }: { k: SortKey; sortKey: SortKey; sortDir: SortDir }) {
  if (sortKey !== k) return <ChevronsUpDown className="w-3.5 h-3.5 text-white/25" />;
  return sortDir === 'asc'
    ? <ChevronUp   className="w-3.5 h-3.5 text-purple-400" />
    : <ChevronDown className="w-3.5 h-3.5 text-purple-400" />;
}

// ── Behavior panel ────────────────────────────────────────────────────────────

function DeviceIcon({ device }: { device: string }) {
  if (device === 'mobile')  return <Smartphone className="w-3.5 h-3.5 text-white/40" />;
  if (device === 'tablet')  return <Tablet     className="w-3.5 h-3.5 text-white/40" />;
  return <Monitor className="w-3.5 h-3.5 text-white/40" />;
}

interface LeadBehaviorPanelProps {
  email: string;
  cache: Record<string, LeadBehavior | null | 'loading'>;
  onCached: (email: string, data: LeadBehavior | null) => void;
}

function LeadBehaviorPanel({ email, cache, onCached }: LeadBehaviorPanelProps) {
  const [state, setState] = useState<LeadBehavior | null | 'loading'>(
    cache[email] !== undefined ? cache[email] : 'loading'
  );

  useEffect(() => {
    if (cache[email] !== undefined) {
      setState(cache[email]);
      return;
    }
    setState('loading');
    fetch(`${API_BASE}/admin/leads/behavior?email=${encodeURIComponent(email)}`, {
      headers: getAuthHeaders(),
    })
      .then(r => r.json())
      .then(d => {
        const val = d.success ? (d.data ?? null) : null;
        onCached(email, val);
        setState(val);
      })
      .catch(() => {
        onCached(email, null);
        setState(null);
      });
  }, [email]);

  if (state === 'loading') {
    return (
      <div className="flex items-center gap-2 py-4 px-2 text-white/25 text-xs animate-pulse">
        <Activity className="w-3.5 h-3.5" />
        Loading behavioral data…
      </div>
    );
  }

  if (!state) {
    return (
      <div className="flex items-center gap-2 py-4 px-2 text-white/20 text-xs">
        <Activity className="w-3.5 h-3.5" />
        No behavioral sessions found for this email yet.
      </div>
    );
  }

  const funnel = FUNNEL_CONFIG[state.funnelStage] ?? FUNNEL_CONFIG.visit;

  return (
    <div className="py-3 px-1 space-y-3 animate-[fadeIn_0.2s_ease]">

      {/* ── Stats row ── */}
      <div className="flex flex-wrap gap-2">

        {/* Sessions */}
        <div className="flex items-center gap-1.5 bg-white/4 border border-white/8 rounded-lg px-3 py-1.5">
          <Globe className="w-3.5 h-3.5 text-purple-400 flex-shrink-0" />
          <span className="text-white font-semibold text-xs">{state.sessionCount}</span>
          <span className="text-white/35 text-xs">session{state.sessionCount !== 1 ? 's' : ''}</span>
        </div>

        {/* Time on site */}
        <div className="flex items-center gap-1.5 bg-white/4 border border-white/8 rounded-lg px-3 py-1.5">
          <Clock className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
          <span className="text-white font-semibold text-xs">{fmtDuration(state.totalDuration)}</span>
          <span className="text-white/35 text-xs">total time</span>
        </div>

        {/* First → last seen */}
        <div className="flex items-center gap-1.5 bg-white/4 border border-white/8 rounded-lg px-3 py-1.5">
          <Calendar className="w-3.5 h-3.5 text-white/30 flex-shrink-0" />
          <span className="text-white/50 text-xs">{shortDate(state.firstSeen)}</span>
          {state.firstSeen !== state.lastSeen && (
            <>
              <span className="text-white/20 text-xs">→</span>
              <span className="text-white/50 text-xs">{shortDate(state.lastSeen)}</span>
            </>
          )}
        </div>

        {/* Funnel stage */}
        <div className={`flex items-center gap-1.5 border rounded-lg px-3 py-1.5 ${funnel.color}`}>
          {funnel.icon}
          <span className="text-xs font-medium">{funnel.label}</span>
        </div>

        {/* Converted */}
        {state.converted && (
          <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-lg px-3 py-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
            <span className="text-emerald-300 text-xs font-medium">Converted</span>
          </div>
        )}
      </div>

      {/* ── Two-column details ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">

        {/* Pages visited */}
        <div className="space-y-1.5">
          <p className="text-white/25 text-[10px] uppercase tracking-widest font-medium flex items-center gap-1">
            <Navigation className="w-3 h-3" /> Pages visited
          </p>
          {state.pagesVisited.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {state.pagesVisited.map(p => (
                <span key={p}
                  className="px-2 py-0.5 rounded-md text-[10px] bg-white/5 border border-white/8 text-white/50 font-mono">
                  {p}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-white/20 text-xs">—</span>
          )}
        </div>

        {/* Tools viewed */}
        <div className="space-y-1.5">
          <p className="text-white/25 text-[10px] uppercase tracking-widest font-medium flex items-center gap-1">
            <Wrench className="w-3 h-3" /> Tools viewed
          </p>
          {state.toolsViewed.length > 0 ? (
            <div className="flex flex-wrap gap-1">
              {state.toolsViewed.map(t => (
                <span key={t}
                  className="px-2 py-0.5 rounded-md text-[10px] bg-purple-500/10 border border-purple-500/20 text-purple-300">
                  {t}
                </span>
              ))}
            </div>
          ) : (
            <span className="text-white/20 text-xs">—</span>
          )}
        </div>

        {/* Device + env */}
        <div className="space-y-1.5">
          <p className="text-white/25 text-[10px] uppercase tracking-widest font-medium flex items-center gap-1">
            <Monitor className="w-3 h-3" /> Environment
          </p>
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="flex items-center gap-1 text-white/45 text-xs">
              <DeviceIcon device={state.device} />
              {state.device}
            </span>
            {state.browser && (
              <span className="flex items-center gap-1 text-white/45 text-xs">
                <Chrome className="w-3 h-3 text-white/30" />
                {state.browser}
              </span>
            )}
            {state.os && (
              <span className="text-white/30 text-xs">{state.os}</span>
            )}
          </div>
        </div>

        {/* Referrer + UTM */}
        <div className="space-y-1.5">
          <p className="text-white/25 text-[10px] uppercase tracking-widest font-medium flex items-center gap-1">
            <Globe className="w-3 h-3" /> Traffic source
          </p>
          <div className="flex flex-wrap gap-1.5">
            {state.referrer ? (
              <span className="text-white/40 text-xs truncate max-w-[200px]">
                {state.referrer.replace(/^https?:\/\//, '').split('/')[0]}
              </span>
            ) : (
              <span className="text-white/20 text-xs">Direct</span>
            )}
            {state.utmSource && (
              <span className="px-2 py-0.5 rounded-md text-[10px] bg-pink-500/10 border border-pink-500/20 text-pink-300">
                utm: {state.utmSource}{state.utmMedium ? ` / ${state.utmMedium}` : ''}
              </span>
            )}
            {state.utmCampaign && (
              <span className="px-2 py-0.5 rounded-md text-[10px] bg-amber-500/10 border border-amber-500/20 text-amber-300">
                {state.utmCampaign}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function LeadsTab() {
  const [leads,   setLeads]   = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  // Expandable rows
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const behaviorCacheRef = useRef<Record<string, LeadBehavior | null | 'loading'>>({});
  const [, forceUpdate] = useState(0); // trigger re-render when cache updates

  // Filters
  const [search,       setSearch]       = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('');
  const [tierFilter,   setTierFilter]   = useState<string>('');
  const [toolFilter,   setToolFilter]   = useState('');
  const [catFilter,    setCatFilter]    = useState('');

  // Sort
  const [sortKey, setSortKey] = useState<SortKey>('createdAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const loadLeads = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res  = await fetch(`${API_BASE}/leads`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load leads');
      setLeads(data.data || []);
    } catch (err: any) {
      console.error('[LeadsTab]', err);
      setError(err.message || 'Could not load leads');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadLeads(); }, [loadLeads]);

  // ── Row expand / collapse ─────────────────────────────────────────────────

  const toggleRow = (key: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleCached = (email: string, data: LeadBehavior | null) => {
    behaviorCacheRef.current[email] = data;
    forceUpdate(n => n + 1);
  };

  // ── Derived lists ─────────────────────────────────────────────────────────

  const toolNames  = useMemo(() =>
    [...new Set(leads.map(l => l.toolName).filter(Boolean))].sort(), [leads]);
  const categories = useMemo(() =>
    [...new Set(leads.map(l => l.toolCategory).filter(Boolean))].sort(), [leads]);
  const tiers      = useMemo(() =>
    [...new Set(leads.map(l => l.tier))].sort(), [leads]);

  // ── Filter + sort ─────────────────────────────────────────────────────────

  const filtered = useMemo(() => leads.filter(l => {
    const q = search.toLowerCase();
    if (q && !l.email.toLowerCase().includes(q) &&
             !l.toolName.toLowerCase().includes(q) &&
             !(l.displayName || '').toLowerCase().includes(q)) return false;
    if (sourceFilter && l.source !== sourceFilter)       return false;
    if (tierFilter   && l.tier   !== tierFilter)         return false;
    if (toolFilter   && l.toolName !== toolFilter)        return false;
    if (catFilter    && l.toolCategory !== catFilter)     return false;
    return true;
  }), [leads, search, sourceFilter, tierFilter, toolFilter, catFilter]);

  const sorted = useMemo(() => [...filtered].sort((a, b) => {
    const va: any = sortKey === 'createdAt'
      ? new Date(a[sortKey]).getTime()
      : String(a[sortKey] ?? '').toLowerCase();
    const vb: any = sortKey === 'createdAt'
      ? new Date(b[sortKey]).getTime()
      : String(b[sortKey] ?? '').toLowerCase();
    if (va < vb) return sortDir === 'asc' ? -1 : 1;
    if (va > vb) return sortDir === 'asc' ?  1 : -1;
    return 0;
  }), [filtered, sortKey, sortDir]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  // ── Stats ─────────────────────────────────────────────────────────────────

  const totalUnique = new Set(leads.map(l => l.email.toLowerCase())).size;
  const freeCount   = leads.filter(l => l.source === 'free_download').length;
  const signupCount = leads.filter(l => l.source === 'signup').length;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <GlassCard className="p-6">

      {/* ── Header ── */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-5 h-5 text-purple-400" />
            All Leads
          </h2>
          <p className="text-white/40 text-sm mt-1">
            Free download emails &amp; registered accounts, unified
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <Button variant="outline" size="sm" onClick={loadLeads} disabled={loading} className="cursor-pointer border-white/30 text-white hover:bg-white/10 hover:border-white/50">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => exportCSV(sorted)}
            disabled={sorted.length === 0}
            className="cursor-pointer bg-emerald-600 hover:bg-emerald-500 text-white"
          >
            <Download className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total entries',   value: leads.length,  icon: <Mail     className="w-4 h-4 text-white/40"   /> },
          { label: 'Unique emails',   value: totalUnique,   icon: <Users    className="w-4 h-4 text-purple-400" /> },
          { label: 'Free downloads',  value: freeCount,     icon: <Download className="w-4 h-4 text-emerald-400"/> },
          { label: 'Signed-up users', value: signupCount,   icon: <UserPlus className="w-4 h-4 text-sky-400"    /> },
        ].map(s => (
          <div key={s.label} className="bg-white/5 border border-white/8 rounded-xl px-4 py-3 flex items-center gap-3">
            {s.icon}
            <div>
              <div className="text-xl font-bold text-white leading-none">{s.value}</div>
              <div className="text-white/35 text-xs mt-0.5">{s.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* ── Search + dropdown filters ── */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30 pointer-events-none" />
          <Input
            placeholder="Search email, name, tool…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-white/5 border-white/10 text-white placeholder:text-white/25"
          />
        </div>

        {toolNames.length > 0 && (
          <AdminSelect
            value={toolFilter}
            onChange={setToolFilter}
            options={[
              { value: '', label: 'All tools' },
              ...toolNames.map(t => ({ value: t, label: t })),
            ]}
            placeholder="All tools"
            className="min-w-[9rem]"
          />
        )}

        {categories.length > 0 && (
          <AdminSelect
            value={catFilter}
            onChange={setCatFilter}
            options={[
              { value: '', label: 'All categories' },
              ...categories.map(c => ({ value: c, label: c })),
            ]}
            placeholder="All categories"
            className="min-w-[10rem]"
          />
        )}
      </div>

      {/* ── Filter pills: Source ── */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-white/25 text-xs uppercase tracking-wide flex items-center gap-1 mr-1">
          <Layers className="w-3 h-3" /> Source
        </span>
        <Pill active={sourceFilter === ''}              onClick={() => setSourceFilter('')}>All</Pill>
        <Pill active={sourceFilter === 'free_download'} onClick={() => setSourceFilter('free_download')}>
          Free Downloads
        </Pill>
        <Pill active={sourceFilter === 'signup'}        onClick={() => setSourceFilter('signup')}>
          Sign-ups
        </Pill>
      </div>

      {/* ── Filter pills: Tier ── */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <span className="text-white/25 text-xs uppercase tracking-wide flex items-center gap-1 mr-1">
          <Tag className="w-3 h-3" /> Tier
        </span>
        <Pill active={tierFilter === ''} onClick={() => setTierFilter('')}>All</Pill>
        {['Free', 'Pro', 'Studio', 'Registered'].map(t => (
          tiers.includes(t as any) && (
            <Pill key={t} active={tierFilter === t} onClick={() => setTierFilter(t)}>{t}</Pill>
          )
        ))}
      </div>

      {/* ── Table ── */}
      {loading ? (
        <div className="py-16 text-center text-white/30 text-sm animate-pulse">Loading leads…</div>
      ) : error ? (
        <div className="py-16 text-center text-red-400 text-sm">{error}</div>
      ) : sorted.length === 0 ? (
        <div className="py-16 text-center">
          <Users className="w-8 h-8 text-white/15 mx-auto mb-3" />
          <p className="text-white/30 text-sm">
            {leads.length === 0
              ? "No leads yet. They'll appear here once someone downloads a free tool or signs up."
              : 'No leads match your filters.'}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-white/8">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/8 bg-white/3">
                {([
                  ['email',        'Email'],
                  ['source',       'Source'],
                  ['tier',         'Tier'],
                  ['toolName',     'Tool'],
                  ['toolCategory', 'Category'],
                  ['createdAt',    'Date'],
                ] as [SortKey, string][]).map(([key, label]) => (
                  <th key={key} className="text-left px-4 py-3">
                    <button
                      onClick={() => toggleSort(key)}
                      className="flex items-center gap-1.5 text-white/50 hover:text-white transition-colors
                        font-semibold text-xs tracking-wide uppercase"
                    >
                      {label}
                      <SortIcon k={key} sortKey={sortKey} sortDir={sortDir} />
                    </button>
                  </th>
                ))}
                {/* expand column */}
                <th className="w-10 px-3 py-3" />
              </tr>
            </thead>
            {sorted.map((lead, i) => {
              const rowKey     = `${lead.email}-${lead.source}-${lead.toolVersionId}-${i}`;
              const isExpanded = expandedRows.has(rowKey);

              return (
                <tbody key={rowKey} className="divide-y divide-white/5 border-b border-white/5">
                  {/* ── Main row ── */}
                  <tr className={`transition-colors ${isExpanded ? 'bg-white/3' : 'hover:bg-white/3'}`}>
                    {/* Email */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0
                          ${lead.source === 'signup'
                            ? 'bg-sky-500/15 border border-sky-500/20'
                            : 'bg-emerald-500/15 border border-emerald-500/20'}`}>
                          {lead.source === 'signup'
                            ? <UserPlus className="w-3 h-3 text-sky-400" />
                            : <Download className="w-3 h-3 text-emerald-400" />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-white font-medium truncate max-w-48">{lead.email}</div>
                          {lead.displayName && (
                            <div className="text-white/35 text-xs truncate">{lead.displayName}</div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Source */}
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${SOURCE_STYLES[lead.source]}`}>
                        {SOURCE_LABELS[lead.source]}
                      </span>
                    </td>

                    {/* Tier */}
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${TIER_STYLES[lead.tier] || ''}`}>
                        {lead.tier}
                      </span>
                    </td>

                    {/* Tool */}
                    <td className="px-4 py-3">
                      {lead.toolName ? (
                        <div className="flex items-center gap-1.5">
                          <Wrench className="w-3.5 h-3.5 text-white/25 flex-shrink-0" />
                          <span className="text-white/70 truncate max-w-32">{lead.toolName}</span>
                        </div>
                      ) : (
                        <span className="text-white/15">—</span>
                      )}
                    </td>

                    {/* Category */}
                    <td className="px-4 py-3">
                      {lead.toolCategory ? (
                        <span className="text-white/45 text-xs">{lead.toolCategory}</span>
                      ) : (
                        <span className="text-white/15">—</span>
                      )}
                    </td>

                    {/* Date */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5 text-white/40">
                        <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
                        <span className="whitespace-nowrap">{fmtDate(lead.createdAt)}</span>
                      </div>
                    </td>

                    {/* Expand toggle */}
                    <td className="px-3 py-3 w-10">
                      <button
                        onClick={() => toggleRow(rowKey)}
                        title={isExpanded ? 'Hide behavior' : 'Show behavior'}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-all cursor-pointer
                          ${isExpanded
                            ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                            : 'bg-white/5 text-white/25 border border-white/8 hover:bg-white/10 hover:text-white/60'}`}
                      >
                        <Activity className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>

                  {/* ── Behavior detail row ── */}
                  {isExpanded && (
                    <tr className="bg-white/[0.015]">
                      <td colSpan={7} className="px-6 pb-4 pt-0 border-t border-white/5">
                        <LeadBehaviorPanel
                          email={lead.email}
                          cache={behaviorCacheRef.current}
                          onCached={handleCached}
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              );
            })}
          </table>
        </div>
      )}

      {/* ── Footer ── */}
      {!loading && sorted.length > 0 && (
        <p className="text-white/25 text-xs mt-3 text-right">
          {sorted.length} {sorted.length === 1 ? 'entry' : 'entries'}
          {leads.length !== sorted.length && ` (filtered from ${leads.length})`}
          {' · '}
          <span className="text-white/15">Click <Activity className="w-3 h-3 inline" /> to view behavioral data</span>
        </p>
      )}
    </GlassCard>
  );
}