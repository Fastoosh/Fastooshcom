// SEO health check: reads every public page of the live site as crawlers see
// it and lists problems per page. Clicking a page opens it in the editor.
import { useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, Loader2, Play, XCircle } from 'lucide-react';
import { GlassCard } from '../shared/GlassCard';
import { checkPage, fetchLivePage, imageLoads, SITE_ORIGIN, type Issue, type LivePage } from '../../utils/liveSeo';

export interface HealthPage { key: string; label: string; path: string }

interface Result { page: HealthPage; live: LivePage; issues: Issue[] }

async function pool<T, R>(items: T[], n: number, fn: (t: T) => Promise<R>, onEach?: () => void): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); onEach?.(); }
  }));
  return out;
}

export function SeoHealthPanel({ pages, onOpen }: { pages: HealthPage[]; onOpen: (key: string) => void }) {
  const [results, setResults] = useState<Result[] | null>(null);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(0);
  const [filter, setFilter] = useState<'problems' | 'errors' | 'all'>('problems');
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [collapsed, setCollapsed] = useState(false);

  const run = async () => {
    setRunning(true); setDone(0); setResults(null); setCollapsed(false);
    const lives = await pool(pages, 6, p => fetchLivePage(p.path), () => setDone(d => d + 1));
    // Check each distinct preview image once, without a Referer like a crawler.
    const imgs = [...new Set(lives.map(l => l.ogImage).filter(Boolean))];
    const imgOk = new Map<string, boolean>();
    await pool(imgs, 6, async src => { imgOk.set(src, await imageLoads(src)); });
    const count = (vals: string[]) => vals.reduce((m, v) => (v ? m.set(v, (m.get(v) || 0) + 1) : m), new Map<string, number>());
    const published = lives.filter(l => l.published && !l.noindex);
    const dupTitles = count(published.map(l => l.title));
    const dupDescs = count(published.map(l => l.description));
    setResults(pages.map((page, i) => ({
      page, live: lives[i],
      issues: checkPage(lives[i], {
        imageOk: lives[i].ogImage ? imgOk.get(lives[i].ogImage) : undefined,
        dupTitles, dupDescs, expectedCanonical: `${SITE_ORIGIN}${page.path === '/' ? '/' : page.path}`,
      }),
    })));
    setRunning(false);
  };

  const summary = useMemo(() => {
    if (!results) return null;
    const errors = results.filter(r => r.issues.some(i => i.severity === 'error')).length;
    const warns = results.filter(r => !r.issues.some(i => i.severity === 'error') && r.issues.length > 0).length;
    const clean = results.length - errors - warns;
    const unpublished = results.filter(r => r.live.ok && !r.live.published).length;
    return { errors, warns, clean, unpublished, score: Math.round(((clean + warns * 0.6) / Math.max(1, results.length)) * 100) };
  }, [results]);

  const shown = (results || [])
    .filter(r => filter === 'all' ? true : filter === 'errors' ? r.issues.some(i => i.severity === 'error') : r.issues.length > 0)
    .sort((a, b) => b.issues.filter(i => i.severity === 'error').length - a.issues.filter(i => i.severity === 'error').length || b.issues.length - a.issues.length);

  return (
    <GlassCard className="p-4 sm:p-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <button type="button" onClick={() => results && setCollapsed(c => !c)} className="text-left flex items-start gap-2">
          {results && (collapsed ? <ChevronRight className="w-4 h-4 text-white/40 mt-1" /> : <ChevronDown className="w-4 h-4 text-white/40 mt-1" />)}
          <span>
            <span className="block text-white font-semibold">SEO health check</span>
            <span className="block text-white/40 text-xs mt-0.5">Reads all {pages.length} public pages of the live site exactly as Google and AI assistants receive them.</span>
          </span>
        </button>
        <button
          type="button" onClick={run} disabled={running}
          className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-sm text-white flex-shrink-0"
        >
          {running ? <><Loader2 className="w-4 h-4 animate-spin" /> Checking {done}/{pages.length}…</> : <><Play className="w-4 h-4" /> {results ? 'Run again' : 'Run check'}</>}
        </button>
      </div>

      {summary && !collapsed && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
            <div className="rounded-xl bg-white/5 border border-white/10 p-3">
              <p className={`text-2xl font-bold tabular-nums ${summary.score >= 85 ? 'text-emerald-300' : summary.score >= 60 ? 'text-amber-300' : 'text-red-300'}`}>{summary.score}</p>
              <p className="text-[11px] uppercase tracking-wider text-white/40">Score</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-3">
              <p className="text-2xl font-bold tabular-nums text-emerald-300">{summary.clean}</p>
              <p className="text-[11px] uppercase tracking-wider text-white/40">All good</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-3">
              <p className="text-2xl font-bold tabular-nums text-amber-300">{summary.warns}</p>
              <p className="text-[11px] uppercase tracking-wider text-white/40">Warnings</p>
            </div>
            <div className="rounded-xl bg-white/5 border border-white/10 p-3">
              <p className="text-2xl font-bold tabular-nums text-red-300">{summary.errors}</p>
              <p className="text-[11px] uppercase tracking-wider text-white/40">Errors</p>
            </div>
          </div>
          {summary.unpublished > 0 && (
            <p className="mt-3 text-sm text-amber-200/90 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
              {summary.unpublished} page{summary.unpublished > 1 ? 's are' : ' is'} not in the published site yet. Use <strong>Republish</strong> in the sidebar.
            </p>
          )}

          <div className="flex flex-wrap gap-1.5 mt-4 mb-2">
            {([['problems', 'With issues'], ['errors', 'Errors only'], ['all', 'All pages']] as const).map(([v, l]) => (
              <button key={v} type="button" onClick={() => setFilter(v)}
                className={`px-3 py-1 rounded-full text-xs border ${filter === v ? 'bg-purple-500/20 border-purple-400/40 text-white' : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'}`}>
                {l}
              </button>
            ))}
          </div>

          {shown.length === 0 ? (
            <p className="text-sm text-emerald-300/90 flex items-center gap-2 py-3"><CheckCircle2 className="w-4 h-4" /> No issues in this view.</p>
          ) : (
            <ul className="divide-y divide-white/6 rounded-xl border border-white/8 overflow-hidden">
              {shown.map(r => {
                const errs = r.issues.filter(i => i.severity === 'error').length;
                const isOpen = !!open[r.page.key];
                return (
                  <li key={r.page.key}>
                    <button type="button" onClick={() => setOpen(o => ({ ...o, [r.page.key]: !o[r.page.key] }))}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/4">
                      {errs ? <XCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                        : r.issues.length ? <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
                        : <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />}
                      <span className="flex-1 min-w-0">
                        <span className="block text-sm text-white/85 truncate">{r.page.label}</span>
                        <span className="block text-[11px] text-white/35 truncate">{r.page.path}</span>
                      </span>
                      <span className="text-[11px] text-white/40 flex-shrink-0">{r.issues.length ? `${r.issues.length} issue${r.issues.length > 1 ? 's' : ''}` : 'OK'}</span>
                    </button>
                    {isOpen && (
                      <div className="px-3 pb-3 pl-10 space-y-1.5">
                        {r.issues.map((i, k) => (
                          <p key={k} className={`text-xs ${i.severity === 'error' ? 'text-red-300' : 'text-amber-200/90'}`}>• {i.text}</p>
                        ))}
                        {r.live.ok && r.live.published && (
                          <p className="text-[11px] text-white/35 pt-1">
                            {r.live.words} words · {r.live.jsonLdTypes.length ? r.live.jsonLdTypes.join(', ') : 'no structured data'}
                          </p>
                        )}
                        <button type="button" onClick={() => onOpen(r.page.key)} className="text-xs text-purple-300 hover:text-purple-200 pt-1">
                          Open in editor →
                        </button>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </>
      )}
    </GlassCard>
  );
}
