// Admin → Use cases. Edit the "how to automate X" guides (/use-cases/…) and
// each tool's "Who it's for" / "What it automates" lists. Saved as the site
// settings `useCases` and `toolExtras` (POST /settings).
import { useEffect, useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ExternalLink, FileText, Loader2, Plus, Save, Sparkles, Trash2 } from 'lucide-react';
import { GlassCard } from '../shared/GlassCard';
import { Input } from '../ui/input';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import {
  DRAFT_TOOL_EXTRAS, DRAFT_USE_CASES, slugify,
  type ToolExtras, type UseCase,
} from '../../utils/useCases';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;
const headers = () => ({
  Authorization: `Bearer ${publicAnonKey}`,
  'X-Admin-Token': localStorage.getItem('admin_token') || '',
  'Content-Type': 'application/json',
});
const field = 'bg-black/50 border-white/20 text-white';
const area = 'w-full rounded-md bg-black/50 border border-white/20 text-white text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500';
const lines = (s: string) => s.split('\n').map(x => x.trim()).filter(Boolean);
const newId = () => (crypto as any).randomUUID?.() || String(Date.now() + Math.random());

export function UseCasesTab() {
  const [items, setItems] = useState<UseCase[]>([]);
  const [extras, setExtras] = useState<Record<string, ToolExtras>>({});
  const [tools, setTools] = useState<{ slug: string; name: string }[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE}/settings`, { headers: headers() }).then(r => r.json()),
      fetch(`${API_BASE}/tools`, { headers: headers() }).then(r => r.json()),
    ]).then(([s, t]) => {
      const list: UseCase[] = Array.isArray(s?.data?.useCases) ? s.data.useCases : [];
      setItems(list);
      setExtras(s?.data?.toolExtras && typeof s.data.toolExtras === 'object' ? s.data.toolExtras : {});
      setTools((t?.data || []).filter((x: any) => x.slug).map((x: any) => ({ slug: x.slug, name: x.name })));
      setSelected(list[0]?.id ?? null);
    }).catch(() => setMessage({ ok: false, text: 'Could not load use cases.' }))
      .finally(() => setLoading(false));
  }, []);

  // Warn before leaving with unsaved edits.
  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', h);
    return () => window.removeEventListener('beforeunload', h);
  }, [dirty]);

  const current = useMemo(() => items.find(i => i.id === selected) || null, [items, selected]);
  const update = (patch: Partial<UseCase>) => {
    if (!current) return;
    setItems(list => list.map(i => i.id === current.id ? { ...i, ...patch, updatedAt: new Date().toISOString() } : i));
    setDirty(true);
  };
  const setExtra = (slug: string, patch: Partial<ToolExtras>) => {
    setExtras(e => ({ ...e, [slug]: { ...(e[slug] || {}), ...patch } }));
    setDirty(true);
  };

  const addBlank = () => {
    const uc: UseCase = {
      id: newId(), slug: '', title: 'New use case', toolSlug: tools[0]?.slug || '', summary: '',
      audience: [], problem: '', steps: [{ title: '', text: '' }], example: '', faq: [], published: false,
    };
    setItems(list => [uc, ...list]);
    setSelected(uc.id);
    setDirty(true);
  };

  const loadDrafts = () => {
    const have = new Set(items.map(i => i.slug));
    const fresh = DRAFT_USE_CASES.filter(d => !have.has(d.slug)).map(d => ({ ...d, id: newId() }));
    if (!fresh.length) { setMessage({ ok: true, text: 'All drafts are already in your list.' }); return; }
    setItems(list => [...list, ...fresh]);
    setSelected(fresh[0].id);
    // Fill tool audience lists that are still empty.
    setExtras(e => {
      const next = { ...e };
      for (const [slug, d] of Object.entries(DRAFT_TOOL_EXTRAS)) {
        if (!tools.some(t => t.slug === slug)) continue;
        next[slug] = {
          audience: next[slug]?.audience?.length ? next[slug].audience : d.audience,
          automates: next[slug]?.automates?.length ? next[slug].automates : d.automates,
        };
      }
      return next;
    });
    setDirty(true);
    setMessage({ ok: true, text: `Added ${fresh.length} drafts (unpublished). Review each one, publish, then Save.` });
  };

  const remove = (id: string) => {
    if (!confirm('Delete this use case?')) return;
    setItems(list => list.filter(i => i.id !== id));
    if (selected === id) setSelected(null);
    setDirty(true);
  };

  const save = async () => {
    // Validate: published items need a unique slug, a tool and a summary.
    const seen = new Set<string>();
    for (const i of items) {
      const slug = i.slug || slugify(i.title);
      if (seen.has(slug)) { setMessage({ ok: false, text: `Two use cases share the URL "${slug}".` }); return; }
      seen.add(slug);
      if (i.published && (!i.summary.trim() || !i.toolSlug)) {
        setMessage({ ok: false, text: `"${i.title}" needs a summary and a tool before it can be published.` });
        setSelected(i.id);
        return;
      }
    }
    setSaving(true);
    setMessage(null);
    try {
      const clean = items.map(i => ({ ...i, slug: i.slug || slugify(i.title) }));
      const res = await fetch(`${API_BASE}/settings`, { method: 'POST', headers: headers(), body: JSON.stringify({ useCases: clean, toolExtras: extras }) });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Save failed');
      setItems(clean);
      setDirty(false);
      setMessage({ ok: true, text: 'Saved. Visitors see the changes now; search engines and AI assistants after the next site deploy.' });
    } catch (err: any) {
      setMessage({ ok: false, text: err?.message || String(err) });
    }
    setSaving(false);
  };

  const moveStep = (i: number, d: -1 | 1) => {
    if (!current) return;
    const steps = [...current.steps];
    const j = i + d;
    if (j < 0 || j >= steps.length) return;
    [steps[i], steps[j]] = [steps[j], steps[i]];
    update({ steps });
  };

  if (loading) return <p className="text-white/40 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>;

  return (
    <div className="space-y-6">
      <GlassCard className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-white">Use cases</h2>
            <p className="text-white/45 text-sm mt-1 max-w-2xl">
              Guides that answer what people actually search: "how do I automate X in After Effects?". Each one becomes a page at
              <span className="text-white/70"> /use-cases/…</span>, is linked from its tool page, and is shared with Google and AI assistants.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button onClick={loadDrafts} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/80 hover:bg-white/10">
              <Sparkles className="w-4 h-4 text-purple-300" /> Load drafts
            </button>
            <button onClick={addBlank} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-sm text-white/80 hover:bg-white/10">
              <Plus className="w-4 h-4" /> New
            </button>
            <button onClick={save} disabled={saving || !dirty} className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-violet-600 hover:bg-violet-500 disabled:opacity-40 text-sm text-white">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {dirty ? 'Save' : 'Saved'}
            </button>
          </div>
        </div>
        {message && <p className={`mt-4 text-sm ${message.ok ? 'text-emerald-300' : 'text-red-400'}`}>{message.text}</p>}
      </GlassCard>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        {/* List */}
        <GlassCard className="p-3 h-fit">
          {items.length === 0 ? (
            <p className="text-white/40 text-sm p-3">No use cases yet. Click <strong className="text-white/70">Load drafts</strong> to start from 5 ready-made guides.</p>
          ) : (
            <ul className="space-y-1">
              {items.map(i => (
                <li key={i.id}>
                  <button
                    onClick={() => setSelected(i.id)}
                    className={`w-full text-left px-3 py-2.5 rounded-lg text-sm ${selected === i.id ? 'bg-purple-500/15 text-white' : 'text-white/70 hover:bg-white/5'}`}
                  >
                    <span className="block truncate">{i.title || 'Untitled'}</span>
                    <span className={`text-[10px] uppercase tracking-wider ${i.published ? 'text-emerald-300/80' : 'text-amber-300/70'}`}>{i.published ? 'Published' : 'Draft'}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </GlassCard>

        {/* Editor */}
        {current ? (
          <GlassCard className="p-4 sm:p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="inline-flex items-center gap-2 text-sm text-white/80 cursor-pointer">
                <input type="checkbox" checked={current.published} onChange={e => update({ published: e.target.checked })} className="w-4 h-4 accent-violet-500" />
                Published
              </label>
              <div className="flex gap-2">
                {current.published && current.slug && (
                  <a href={`/use-cases/${current.slug}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-purple-300 hover:text-purple-200">
                    <ExternalLink className="w-3.5 h-3.5" /> View
                  </a>
                )}
                <button onClick={() => remove(current.id)} className="inline-flex items-center gap-1 text-xs text-red-400 hover:text-red-300">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Title — phrase it like the search</label>
              <Input value={current.title} onChange={e => update({ title: e.target.value, slug: current.slug && current.published ? current.slug : slugify(e.target.value) })} className={field} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm text-gray-300 mb-1.5">URL</label>
                <div className="flex items-center gap-1 text-sm text-white/40">
                  /use-cases/
                  <Input value={current.slug} onChange={e => update({ slug: slugify(e.target.value) })} className={field} />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1.5">Tool</label>
                <select value={current.toolSlug} onChange={e => update({ toolSlug: e.target.value })} className={`${area} h-10`}>
                  {tools.map(t => <option key={t.slug} value={t.slug}>{t.name}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Short answer (1–2 sentences, shown first and used as the description)</label>
              <textarea rows={3} value={current.summary} onChange={e => update({ summary: e.target.value })} className={area} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm text-gray-300 mb-1.5">Who it's for <span className="text-gray-500">(one per line)</span></label>
                <textarea rows={4} value={(current.audience || []).join('\n')} onChange={e => update({ audience: lines(e.target.value) })} className={area} />
              </div>
              <div>
                <label className="block text-sm text-gray-300 mb-1.5">The problem (why doing it by hand hurts)</label>
                <textarea rows={4} value={current.problem} onChange={e => update({ problem: e.target.value })} className={area} />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-gray-300">Steps</label>
                <button onClick={() => update({ steps: [...current.steps, { title: '', text: '' }] })} className="inline-flex items-center gap-1 text-xs text-purple-300 hover:text-purple-200">
                  <Plus className="w-3.5 h-3.5" /> Add step
                </button>
              </div>
              <div className="space-y-2">
                {current.steps.map((s, i) => (
                  <div key={i} className="rounded-lg border border-white/10 bg-white/3 p-3 space-y-2">
                    <div className="flex gap-2 items-center">
                      <span className="text-xs text-white/40 w-5">{i + 1}.</span>
                      <Input placeholder="Step title" value={s.title} onChange={e => update({ steps: current.steps.map((x, j) => j === i ? { ...x, title: e.target.value } : x) })} className={field} />
                      <button onClick={() => moveStep(i, -1)} className="p-1.5 text-white/40 hover:text-white" aria-label="Move up"><ArrowUp className="w-4 h-4" /></button>
                      <button onClick={() => moveStep(i, 1)} className="p-1.5 text-white/40 hover:text-white" aria-label="Move down"><ArrowDown className="w-4 h-4" /></button>
                      <button onClick={() => update({ steps: current.steps.filter((_, j) => j !== i) })} className="p-1.5 text-red-400 hover:text-red-300" aria-label="Remove step"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <textarea rows={2} placeholder="What to do in this step" value={s.text} onChange={e => update({ steps: current.steps.map((x, j) => j === i ? { ...x, text: e.target.value } : x) })} className={area} />
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-300 mb-1.5">Example (concrete numbers help)</label>
              <textarea rows={2} value={current.example || ''} onChange={e => update({ example: e.target.value })} className={area} />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm text-gray-300">Questions</label>
                <button onClick={() => update({ faq: [...(current.faq || []), { q: '', a: '' }] })} className="inline-flex items-center gap-1 text-xs text-purple-300 hover:text-purple-200">
                  <Plus className="w-3.5 h-3.5" /> Add question
                </button>
              </div>
              <div className="space-y-2">
                {(current.faq || []).map((f, i) => (
                  <div key={i} className="rounded-lg border border-white/10 bg-white/3 p-3 space-y-2">
                    <div className="flex gap-2">
                      <Input placeholder="Question" value={f.q} onChange={e => update({ faq: current.faq.map((x, j) => j === i ? { ...x, q: e.target.value } : x) })} className={field} />
                      <button onClick={() => update({ faq: current.faq.filter((_, j) => j !== i) })} className="p-1.5 text-red-400 hover:text-red-300" aria-label="Remove question"><Trash2 className="w-4 h-4" /></button>
                    </div>
                    <textarea rows={2} placeholder="Answer" value={f.a} onChange={e => update({ faq: current.faq.map((x, j) => j === i ? { ...x, a: e.target.value } : x) })} className={area} />
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        ) : (
          <GlassCard className="p-6 text-white/40 text-sm flex items-center gap-2"><FileText className="w-4 h-4" /> Select a use case to edit it.</GlassCard>
        )}
      </div>

      {/* Tool audience */}
      <GlassCard className="p-4 sm:p-6">
        <h3 className="text-lg font-semibold text-white mb-1">Who each tool is for</h3>
        <p className="text-white/45 text-sm mb-5">Shown on each tool page and added to its structured data.</p>
        <div className="space-y-6">
          {tools.map(t => (
            <div key={t.slug}>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-white/85 font-medium">{t.name}</h4>
                {DRAFT_TOOL_EXTRAS[t.slug] && (
                  <button onClick={() => setExtra(t.slug, DRAFT_TOOL_EXTRAS[t.slug])} className="text-xs text-purple-300 hover:text-purple-200">Use suggested lists</button>
                )}
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Who it's for (one per line)</label>
                  <textarea rows={5} value={(extras[t.slug]?.audience || []).join('\n')} onChange={e => setExtra(t.slug, { audience: lines(e.target.value) })} className={area} />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">What it automates (one per line)</label>
                  <textarea rows={5} value={(extras[t.slug]?.automates || []).join('\n')} onChange={e => setExtra(t.slug, { automates: lines(e.target.value) })} className={area} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}
