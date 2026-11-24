// Command-palette style search across the admin: pages, projects, tools,
// team, leads and licenses. Open with Ctrl/Cmd+K or the search button.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Loader2, LayoutGrid, Film, Wrench, Users, Mail, KeyRound, CornerDownLeft } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

export type AdminSearchResult =
  | { kind: 'page'; value: string; label: string }
  | { kind: 'project'; item: any }
  | { kind: 'tool'; item: any }
  | { kind: 'team'; item: any }
  | { kind: 'lead'; email: string; detail: string }
  | { kind: 'license'; email: string; key: string; detail: string };

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (r: AdminSearchResult) => void;
  pages: { value: string; label: string }[];
  projects: any[];
  tools: any[];
  team: any[];
}

const norm = (s: unknown) => String(s ?? '').toLowerCase();

// Leads and licenses are fetched once per page load, the first time search opens.
let leadsCache: any[] | null = null;
let licensesCache: any[] | null = null;

export function AdminSearch({ open, onClose, onPick, pages, projects, tools, team }: Props) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const [leads, setLeads] = useState<any[]>(leadsCache ?? []);
  const [licenses, setLicenses] = useState<any[]>(licensesCache ?? []);
  const [remoteLoading, setRemoteLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setActive(0);
    window.setTimeout(() => inputRef.current?.focus(), 30);
    if (leadsCache && licensesCache) return;
    const headers = { Authorization: `Bearer ${publicAnonKey}`, 'X-Admin-Token': localStorage.getItem('admin_token') || '' };
    setRemoteLoading(true);
    Promise.allSettled([
      fetch(`${API_BASE}/leads`, { headers }).then(r => r.json()),
      fetch(`${API_BASE}/admin/licenses`, { headers }).then(r => r.json()),
    ]).then(([l, lic]) => {
      if (l.status === 'fulfilled' && l.value?.success) { leadsCache = l.value.data || []; setLeads(leadsCache!); }
      if (lic.status === 'fulfilled' && lic.value?.success) { licensesCache = lic.value.licenses || []; setLicenses(licensesCache!); }
    }).finally(() => setRemoteLoading(false));
  }, [open]);

  const sections = useMemo(() => {
    const term = norm(q).trim();
    const match = (...fields: unknown[]) => !term || fields.some(f => norm(f).includes(term));
    const out: { title: string; icon: any; results: AdminSearchResult[] }[] = [];

    const pageHits = pages.filter(p => match(p.label, p.value)).slice(0, term ? 6 : 8)
      .map(p => ({ kind: 'page', value: p.value, label: p.label }) as AdminSearchResult);
    if (pageHits.length) out.push({ title: 'Pages', icon: LayoutGrid, results: pageHits });
    if (!term) return out; // empty query: just offer the pages

    const projHits = projects.filter(p => match(p.title, p.client, p.category, p.year, ...(p.tags || []))).slice(0, 6)
      .map(item => ({ kind: 'project', item }) as AdminSearchResult);
    if (projHits.length) out.push({ title: 'Projects', icon: Film, results: projHits });

    const toolHits = tools.filter(t => match(t.name, t.slug, t.category, t.tagline)).slice(0, 6)
      .map(item => ({ kind: 'tool', item }) as AdminSearchResult);
    if (toolHits.length) out.push({ title: 'Tools', icon: Wrench, results: toolHits });

    const teamHits = team.filter(m => match(m.name, m.role)).slice(0, 4)
      .map(item => ({ kind: 'team', item }) as AdminSearchResult);
    if (teamHits.length) out.push({ title: 'Team', icon: Users, results: teamHits });

    // Leads: one row per email
    const seen = new Set<string>();
    const leadHits: AdminSearchResult[] = [];
    for (const l of leads) {
      const email = norm(l.email);
      if (!email || seen.has(email) || !match(l.email, l.displayName, l.toolName)) continue;
      seen.add(email);
      leadHits.push({ kind: 'lead', email: l.email, detail: l.source === 'signup' ? 'Registered account' : `Downloaded ${l.toolName || 'a free tool'}` });
      if (leadHits.length >= 6) break;
    }
    if (leadHits.length) out.push({ title: 'Leads', icon: Mail, results: leadHits });

    const licHits = licenses.filter(l => match(l.email, l.license_key, l.customer_name, l.product_name)).slice(0, 6)
      .map(l => ({ kind: 'license', email: l.email, key: l.license_key, detail: `${l.product_name} · ${l.plan_tier} · ${l.status}` }) as AdminSearchResult);
    if (licHits.length) out.push({ title: 'Licenses', icon: KeyRound, results: licHits });

    return out;
  }, [q, pages, projects, tools, team, leads, licenses]);

  const flat = useMemo(() => sections.flatMap(s => s.results), [sections]);
  useEffect(() => { setActive(0); }, [q]);
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  if (!open) return null;

  const pick = (r: AdminSearchResult) => { onPick(r); onClose(); };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(a => Math.min(flat.length - 1, a + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (flat[active]) pick(flat[active]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose(); }
  };

  const rowText = (r: AdminSearchResult): { title: string; sub: string } => {
    switch (r.kind) {
      case 'page':    return { title: r.label, sub: 'Open section' };
      case 'project': return { title: r.item.title || 'Untitled project', sub: [r.item.category, r.item.year].filter(Boolean).join(' · ') };
      case 'tool':    return { title: r.item.name || 'Untitled tool', sub: r.item.category || '' };
      case 'team':    return { title: r.item.name, sub: r.item.role || '' };
      case 'lead':    return { title: r.email, sub: r.detail };
      case 'license': return { title: r.email || r.key, sub: `${r.key} · ${r.detail}` };
    }
  };

  let idx = -1;
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-3 pt-[10vh] bg-black/70 backdrop-blur-sm" onMouseDown={onClose}>
      <div
        className="w-full max-w-xl rounded-2xl border border-white/12 bg-[#0d0d14] shadow-2xl overflow-hidden"
        onMouseDown={e => e.stopPropagation()}
        role="dialog"
        aria-label="Search the admin"
      >
        <div className="flex items-center gap-2 px-4 border-b border-white/10">
          <Search className="w-4 h-4 text-white/40 flex-shrink-0" />
          <input
            ref={inputRef}
            value={q}
            onChange={e => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search projects, tools, leads, licenses, pages…"
            className="flex-1 bg-transparent py-3.5 text-white placeholder-white/30 focus:outline-none text-[16px] sm:text-sm"
          />
          {remoteLoading && <Loader2 className="w-4 h-4 text-white/30 animate-spin" />}
          <button type="button" onClick={onClose} className="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div ref={listRef} className="max-h-[60vh] overflow-y-auto py-2">
          {flat.length === 0 ? (
            <p className="px-4 py-8 text-center text-white/35 text-sm">
              {remoteLoading ? 'Loading leads and licenses…' : `No results for "${q}".`}
            </p>
          ) : sections.map(sec => (
            <div key={sec.title} className="mb-1">
              <p className="px-4 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-white/30">{sec.title}</p>
              {sec.results.map(r => {
                idx++;
                const i = idx;
                const { title, sub } = rowText(r);
                const Icon = sec.icon;
                return (
                  <button
                    key={`${sec.title}-${i}`}
                    type="button"
                    data-idx={i}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(r)}
                    className={`w-full flex items-center gap-3 px-4 py-2 text-left ${i === active ? 'bg-purple-500/15' : ''}`}
                  >
                    <Icon className="w-4 h-4 text-white/35 flex-shrink-0" />
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm text-white/85 truncate">{title}</span>
                      {sub && <span className="block text-[11px] text-white/35 truncate">{sub}</span>}
                    </span>
                    {i === active && <CornerDownLeft className="w-3.5 h-3.5 text-white/30 hidden sm:block" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>

        <div className="hidden sm:flex items-center gap-4 px-4 py-2 border-t border-white/8 text-[11px] text-white/30">
          <span>↑↓ to move</span><span>Enter to open</span><span>Esc to close</span>
        </div>
      </div>
    </div>
  );
}
