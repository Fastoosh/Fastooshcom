import { useState, useEffect, useCallback, useMemo } from 'react';
import { GlassCard } from '../shared/GlassCard';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { AdminSelect } from './AdminSelect';
import {
  Download, RefreshCw, Search, Mail, Calendar,
  Wrench, ChevronUp, ChevronDown, ChevronsUpDown, Users,
  UserPlus, Tag, Layers,
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

// ── Main component ────────────────────────────────────────────────────────────

export function LeadsTab() {
  const [leads,   setLeads]   = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  // Filters
  const [search,       setSearch]       = useState('');
  const [sourceFilter, setSourceFilter] = useState<string>('');   // '' = All
  const [tierFilter,   setTierFilter]   = useState<string>('');   // '' = All
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

  // ── Derived lists for filter options ──────────────────────────────────────

  const toolNames  = useMemo(() =>
    [...new Set(leads.map(l => l.toolName).filter(Boolean))].sort(), [leads]);
  const categories = useMemo(() =>
    [...new Set(leads.map(l => l.toolCategory).filter(Boolean))].sort(), [leads]);
  const tiers      = useMemo(() =>
    [...new Set(leads.map(l => l.tier))].sort(), [leads]);

  // ── Filter + sort ──────────────────────────────────────────────────────────

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

  // ── Stats ──────────────────────────────────────────────────────────────────

  const totalUnique    = new Set(leads.map(l => l.email.toLowerCase())).size;
  const freeCount      = leads.filter(l => l.source === 'free_download').length;
  const signupCount    = leads.filter(l => l.source === 'signup').length;

  // ── Render ─────────────────────────────────────────────────────────────────

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
          <Button variant="outline" size="sm" onClick={loadLeads} disabled={loading} className="cursor-pointer">
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
          { label: 'Total entries',    value: leads.length,   icon: <Mail     className="w-4 h-4 text-white/40"   />, color: '' },
          { label: 'Unique emails',    value: totalUnique,    icon: <Users    className="w-4 h-4 text-purple-400" />, color: '' },
          { label: 'Free downloads',   value: freeCount,      icon: <Download className="w-4 h-4 text-emerald-400"/>, color: '' },
          { label: 'Signed-up users',  value: signupCount,    icon: <UserPlus className="w-4 h-4 text-sky-400"    />, color: '' },
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
                  ['email',     'Email'],
                  ['source',    'Source'],
                  ['tier',      'Tier'],
                  ['toolName',  'Tool'],
                  ['toolCategory', 'Category'],
                  ['createdAt', 'Date'],
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
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {sorted.map((lead, i) => (
                <tr
                  key={`${lead.email}-${lead.source}-${lead.toolVersionId}-${i}`}
                  className="hover:bg-white/3 transition-colors"
                >
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
                      <span className="whitespace-nowrap">
                        {lead.createdAt
                          ? new Date(lead.createdAt).toLocaleString('en-US', {
                              month: 'short', day: 'numeric', year: 'numeric',
                              hour: '2-digit', minute: '2-digit',
                            })
                          : '—'}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Footer ── */}
      {!loading && sorted.length > 0 && (
        <p className="text-white/25 text-xs mt-3 text-right">
          {sorted.length} {sorted.length === 1 ? 'entry' : 'entries'}
          {leads.length !== sorted.length && ` (filtered from ${leads.length})`}
        </p>
      )}
    </GlassCard>
  );
}