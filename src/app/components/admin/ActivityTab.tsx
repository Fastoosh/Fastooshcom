// Admin activity log: who changed what, and when. Written by the server for
// every admin change (see the audit middleware in the edge function).
import { useCallback, useEffect, useRef, useState } from 'react';
import { History, Search, Loader2, AlertTriangle, RefreshCw } from 'lucide-react';
import { GlassCard } from '../shared/GlassCard';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

interface ActivityEntry {
  at: string;
  email: string;
  action: string;
  entity: string;
  subject?: string;
  changedKeys?: string[];
  method: string;
  path: string;
  status: number;
  ok: boolean;
}

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86400000);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
};
const timeLabel = (iso: string) => new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

// Colour by kind of action
const tone = (action: string) =>
  /^(Deleted|Removed|Revoked|Reset)/.test(action) ? 'bg-red-500/15 text-red-300 border-red-500/25'
  : /^(Created|Added|Uploaded|Seeded)/.test(action) ? 'bg-emerald-500/12 text-emerald-300 border-emerald-500/25'
  : /^(Sent|Resent)/.test(action) ? 'bg-sky-500/12 text-sky-300 border-sky-500/25'
  : 'bg-purple-500/12 text-purple-300 border-purple-500/25';

export function ActivityTab() {
  const [items, setItems] = useState<ActivityEntry[]>([]);
  const [nextBefore, setNextBefore] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const debounce = useRef<number | null>(null);

  const fetchPage = useCallback(async (before: string | null, q: string) => {
    const qs = new URLSearchParams({ limit: '100' });
    if (before) qs.set('before', before);
    if (q.trim()) qs.set('q', q.trim());
    const res = await fetch(`${API_BASE}/admin/activity?${qs}`, {
      headers: { Authorization: `Bearer ${publicAnonKey}`, 'X-Admin-Token': localStorage.getItem('admin_token') || '' },
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.error || 'Could not load activity.');
    return json as { data: ActivityEntry[]; nextBefore: string | null };
  }, []);

  const load = useCallback(async (q: string) => {
    setLoading(true);
    setError('');
    try {
      const page = await fetchPage(null, q);
      setItems(page.data);
      setNextBefore(page.nextBefore);
    } catch (err: any) {
      setError(err?.message || String(err));
    }
    setLoading(false);
  }, [fetchPage]);

  useEffect(() => {
    if (debounce.current) window.clearTimeout(debounce.current);
    debounce.current = window.setTimeout(() => load(query), query ? 350 : 0);
    return () => { if (debounce.current) window.clearTimeout(debounce.current); };
  }, [query, load]);

  const loadMore = async () => {
    if (!nextBefore) return;
    setLoadingMore(true);
    try {
      const page = await fetchPage(nextBefore, query);
      setItems(prev => [...prev, ...page.data]);
      setNextBefore(page.nextBefore);
    } catch (err: any) {
      setError(err?.message || String(err));
    }
    setLoadingMore(false);
  };

  // Group by day
  const groups: { day: string; entries: ActivityEntry[] }[] = [];
  for (const e of items) {
    const d = dayLabel(e.at);
    if (!groups.length || groups[groups.length - 1].day !== d) groups.push({ day: d, entries: [] });
    groups[groups.length - 1].entries.push(e);
  }

  return (
    <GlassCard className="p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <History className="w-6 h-6 text-purple-400" /> Activity
          </h2>
          <p className="text-white/40 text-sm mt-1">Every change made in the admin — who, what and when.</p>
        </div>
        <div className="flex gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/35 pointer-events-none" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search actions, items, people…"
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:ring-1 focus:ring-purple-500"
            />
          </div>
          <button
            type="button"
            onClick={() => load(query)}
            className="px-3 rounded-lg bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

      {loading ? (
        <p className="text-white/40 text-sm flex items-center gap-2 py-8 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading activity…</p>
      ) : items.length === 0 ? (
        <p className="text-white/35 text-sm text-center py-10">
          {query ? `Nothing matches "${query}".` : 'No activity recorded yet. Changes you make from now on will show up here.'}
        </p>
      ) : (
        <div className="space-y-6">
          {groups.map(g => (
            <div key={g.day}>
              <p className="text-[11px] font-semibold uppercase tracking-wider text-white/30 mb-2">{g.day}</p>
              <ul className="space-y-1.5">
                {g.entries.map((e, i) => (
                  <li key={`${e.at}-${i}`} className="flex items-start gap-3 rounded-lg px-3 py-2.5 bg-white/3 border border-white/6">
                    <span className="text-white/35 text-xs tabular-nums w-11 flex-shrink-0 pt-0.5">{timeLabel(e.at)}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${tone(e.action)}`}>{e.action}</span>
                        {e.subject && <span className="text-white/80 text-sm truncate max-w-full">{e.subject}</span>}
                        {!e.ok && (
                          <span className="inline-flex items-center gap-1 text-[11px] text-red-300">
                            <AlertTriangle className="w-3 h-3" /> failed ({e.status})
                          </span>
                        )}
                      </div>
                      {e.changedKeys?.length ? (
                        <p className="text-white/35 text-[11px] mt-1">Changed: {e.changedKeys.join(', ')}</p>
                      ) : null}
                      <p className="text-white/30 text-[11px] mt-0.5">{e.email || 'unknown admin'}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          {nextBefore && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className="px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/70 hover:bg-white/10 disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </div>
      )}
    </GlassCard>
  );
}
