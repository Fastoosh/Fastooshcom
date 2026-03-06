import { useState, useEffect, useCallback } from 'react';
import { GlassCard } from '../shared/GlassCard';
import { Button } from '../ui/button';
import {
  Wrench, RefreshCw, Trash2, ChevronDown, ChevronUp,
  Mail, Clock, DollarSign, Calendar, MessageSquare,
  Zap, StickyNote, Package, Inbox,
} from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

interface ToolRequest {
  id:          string;
  name:        string;
  email:       string;
  softwares:   string[];
  workflow:    string;
  automate:    string;
  timeline:    string;
  budget:      string;
  notes:       string;
  submittedAt: string;
}

function getAuthHeaders() {
  const token = localStorage.getItem('admin_token');
  return {
    'Authorization': `Bearer ${publicAnonKey}`,
    'X-Admin-Token': token || '',
  };
}

function fmtDate(iso: string) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

// ── Individual card ────────────────────────────────────────────────────────────

function RequestCard({
  req,
  onDelete,
}: {
  req: ToolRequest;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`Delete request from ${req.name}?`)) return;
    setDeleting(true);
    try {
      await fetch(`${API_BASE}/admin/tool-requests/${req.id}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      onDelete(req.id);
    } catch (err) {
      console.error('[ToolRequestsTab] delete error', err);
      setDeleting(false);
    }
  };

  return (
    <div className="border border-white/8 rounded-xl overflow-hidden bg-white/[0.02] hover:bg-white/[0.035] transition-colors">

      {/* ── Collapsed row ── */}
      <div className="flex items-center gap-3 px-5 py-4">

        {/* Avatar */}
        <div className="w-9 h-9 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
          <span className="text-purple-300 font-semibold text-sm">
            {req.name.charAt(0).toUpperCase()}
          </span>
        </div>

        {/* Name + email */}
        <div className="min-w-0 flex-1">
          <p className="text-white font-medium text-sm truncate">{req.name}</p>
          <a
            href={`mailto:${req.email}`}
            className="text-purple-400 text-xs hover:text-purple-300 transition-colors truncate block"
          >
            {req.email}
          </a>
        </div>

        {/* Budget badge */}
        <span className="hidden sm:inline-flex px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-medium whitespace-nowrap">
          {req.budget}
        </span>

        {/* Timeline badge */}
        <span className="hidden md:inline-flex px-2.5 py-1 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-300 text-xs whitespace-nowrap">
          {req.timeline}
        </span>

        {/* Time ago */}
        <span className="text-white/30 text-xs whitespace-nowrap hidden sm:block">
          {timeAgo(req.submittedAt)}
        </span>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <a
            href={`mailto:${req.email}?subject=Re: Your custom tool request — Fastoosh`}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-purple-500/20 border border-white/8 hover:border-purple-500/30 flex items-center justify-center transition-all"
            title="Reply by email"
          >
            <Mail className="w-3.5 h-3.5 text-white/40 hover:text-purple-300" />
          </a>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-red-500/20 border border-white/8 hover:border-red-500/30 flex items-center justify-center transition-all disabled:opacity-40"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5 text-white/40 hover:text-red-400" />
          </button>
          <button
            onClick={() => setExpanded(e => !e)}
            className="w-7 h-7 rounded-lg bg-white/5 hover:bg-white/10 border border-white/8 flex items-center justify-center transition-all"
            title={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded
              ? <ChevronUp   className="w-3.5 h-3.5 text-white/40" />
              : <ChevronDown className="w-3.5 h-3.5 text-white/40" />
            }
          </button>
        </div>
      </div>

      {/* ── Expanded details ── */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-white/6 pt-4 space-y-4">

          {/* Meta row */}
          <div className="flex flex-wrap gap-3">
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              <DollarSign className="w-3.5 h-3.5 text-emerald-400" />
              <span className="text-emerald-300 font-medium">{req.budget}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-blue-300">{req.timeline}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-white/40">
              <Clock className="w-3.5 h-3.5" />
              {fmtDate(req.submittedAt)}
            </div>
          </div>

          {/* Softwares */}
          {req.softwares?.length > 0 && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/25 font-medium mb-2 flex items-center gap-1">
                <Package className="w-3 h-3" /> Software
              </p>
              <div className="flex flex-wrap gap-1.5">
                {req.softwares.map(sw => (
                  <span
                    key={sw}
                    className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-white/60 text-xs"
                  >
                    {sw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Workflow */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/25 font-medium mb-2 flex items-center gap-1">
              <MessageSquare className="w-3 h-3" /> Current workflow / problem
            </p>
            <div className="bg-white/3 border-l-2 border-purple-500/40 rounded-r-lg px-4 py-3">
              <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{req.workflow}</p>
            </div>
          </div>

          {/* What the tool should do */}
          <div>
            <p className="text-[10px] uppercase tracking-widest text-white/25 font-medium mb-2 flex items-center gap-1">
              <Zap className="w-3 h-3" /> What the tool should do
            </p>
            <div className="bg-white/3 border-l-2 border-indigo-500/40 rounded-r-lg px-4 py-3">
              <p className="text-white/70 text-sm leading-relaxed whitespace-pre-wrap">{req.automate}</p>
            </div>
          </div>

          {/* Notes */}
          {req.notes && (
            <div>
              <p className="text-[10px] uppercase tracking-widest text-white/25 font-medium mb-2 flex items-center gap-1">
                <StickyNote className="w-3 h-3" /> Additional notes
              </p>
              <div className="bg-white/3 border-l-2 border-white/15 rounded-r-lg px-4 py-3">
                <p className="text-white/55 text-sm leading-relaxed whitespace-pre-wrap">{req.notes}</p>
              </div>
            </div>
          )}

          {/* Reply CTA */}
          <div className="pt-1">
            <a
              href={`mailto:${req.email}?subject=Re: Your custom tool request — Fastoosh`}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white transition-all"
              style={{ background: 'linear-gradient(135deg,#7c3aed,#4f46e5)' }}
            >
              <Mail className="w-3.5 h-3.5" />
              Reply to {req.name}
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────

export function ToolRequestsTab() {
  const [requests, setRequests] = useState<ToolRequest[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res  = await fetch(`${API_BASE}/admin/tool-requests`, { headers: getAuthHeaders() });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to load requests');
      setRequests(data.data || []);
    } catch (err: any) {
      console.error('[ToolRequestsTab]', err);
      setError(err.message || 'Could not load tool requests');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = (id: string) =>
    setRequests(prev => prev.filter(r => r.id !== id));

  // ── Stats ────────────────────────────────────────────────────────────────

  const budgetCounts = requests.reduce<Record<string, number>>((acc, r) => {
    acc[r.budget] = (acc[r.budget] || 0) + 1;
    return acc;
  }, {});

  const topBudget = Object.entries(budgetCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

  const recentCount = requests.filter(r => {
    const daysAgo = (Date.now() - new Date(r.submittedAt).getTime()) / 86_400_000;
    return daysAgo <= 7;
  }).length;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <GlassCard className="p-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Wrench className="w-5 h-5 text-purple-400" />
            Custom Tool Requests
          </h2>
          <p className="text-white/40 text-sm mt-1">
            Inbound requests from the "Request Your Custom Tool" form on the Tools page
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={load}
          disabled={loading}
          className="cursor-pointer border-white/30 text-white hover:bg-white/10 hover:border-white/50"
        >
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      {!loading && !error && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          <div className="bg-white/5 border border-white/8 rounded-xl px-4 py-3 flex items-center gap-3">
            <Inbox className="w-4 h-4 text-purple-400 flex-shrink-0" />
            <div>
              <div className="text-xl font-bold text-white leading-none">{requests.length}</div>
              <div className="text-xs text-white/35 mt-0.5">Total requests</div>
            </div>
          </div>
          <div className="bg-white/5 border border-white/8 rounded-xl px-4 py-3 flex items-center gap-3">
            <Clock className="w-4 h-4 text-blue-400 flex-shrink-0" />
            <div>
              <div className="text-xl font-bold text-white leading-none">{recentCount}</div>
              <div className="text-xs text-white/35 mt-0.5">Last 7 days</div>
            </div>
          </div>
          <div className="bg-white/5 border border-white/8 rounded-xl px-4 py-3 flex items-center gap-3 col-span-2 sm:col-span-1">
            <DollarSign className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <div>
              <div className="text-sm font-bold text-white leading-none truncate">{topBudget}</div>
              <div className="text-xs text-white/35 mt-0.5">Top budget range</div>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="py-16 text-center text-white/30 text-sm animate-pulse">
          Loading tool requests…
        </div>
      ) : error ? (
        <div className="py-16 text-center text-red-400 text-sm">{error}</div>
      ) : requests.length === 0 ? (
        <div className="py-16 text-center">
          <Wrench className="w-10 h-10 text-white/10 mx-auto mb-3" />
          <p className="text-white/30 text-sm">
            No tool requests yet. They'll appear here once someone submits the form.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(req => (
            <RequestCard key={req.id} req={req} onDelete={handleDelete} />
          ))}
        </div>
      )}
    </GlassCard>
  );
}
