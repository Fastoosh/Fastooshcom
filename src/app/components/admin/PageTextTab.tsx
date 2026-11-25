// Admin → Page Text. Edit the English text of Work With Us, About, Projects
// and Tools, with ✨ AI help on every field. French and Arabic are edited in
// Admin → Translations → Page Text. Each page is saved as its own site
// setting ({ en, fr, ar }); only fields that differ from the built-in text are
// stored, and each screen saves only its own language.
import { useEffect, useState } from 'react';
import { ExternalLink, Languages, Loader2, Plus, RotateCcw, Save, Sparkles, Trash2 } from 'lucide-react';
import { GlassCard } from '../shared/GlassCard';
import { Input } from '../ui/input';
import { AIImproveModal } from './AIImproveModal';
import { bustApiCache } from '../../utils/api';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import en from '../../../locales/en.json';
import fr from '../../../locales/fr.json';
import ar from '../../../locales/ar.json';
import {
  PAGES, PAGE_LIST, pageFields, writePageCache,
  type PageConfig, type PageField, type PageId, type PageLang, type PageOverrides, type PageStep, type PageValue,
} from '../../utils/pageContent';

export const PAGE_API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;
export const pageHeaders = () => ({
  Authorization: `Bearer ${publicAnonKey}`,
  'X-Admin-Token': localStorage.getItem('admin_token') || '',
  'Content-Type': 'application/json',
});
const field = 'bg-black/50 border-white/20 text-white';
const area = 'w-full rounded-md bg-black/50 border border-white/20 text-white text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500';

const LOCALES: Record<PageLang, any> = { en, fr, ar };
const defaultsCache = new Map<string, Record<string, PageValue>>();
/** The built-in text of a page in one language. */
export function pageDefaults(p: PageConfig, code: PageLang): Record<string, PageValue> {
  const id = `${p.id}:${code}`;
  if (!defaultsCache.has(id)) {
    const section = LOCALES[code]?.[p.localeSection] || {};
    defaultsCache.set(id, { ...section, ...(p.prepareDefaults?.(section) || {}) });
  }
  return defaultsCache.get(id)!;
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/** The value shown for a field: the saved edit, else the built-in text. */
export const pageValueOf = (p: PageConfig, vals: Record<string, PageValue> | undefined, code: PageLang, key: string): PageValue =>
  vals?.[key] !== undefined ? vals[key] : clone(pageDefaults(p, code)[key] ?? '');

export const pageIsEdited = (p: PageConfig, vals: Record<string, PageValue> | undefined, code: PageLang, key: string) =>
  vals?.[key] !== undefined && !same(vals[key], pageDefaults(p, code)[key]);

/** One language's values, keeping only fields that differ from the built-in text. */
function cleanLang(p: PageConfig, code: PageLang, vals: Record<string, PageValue> = {}): Record<string, PageValue> {
  const kept: Record<string, PageValue> = {};
  for (const f of pageFields(p)) {
    let v = vals[f.key];
    if (v === undefined) continue;
    if (f.kind === 'lines' && Array.isArray(v)) v = (v as string[]).map(x => x.trim()).filter(Boolean);
    if (f.kind === 'steps' && Array.isArray(v)) v = (v as PageStep[]).filter(s => s.title?.trim() || s.body?.trim());
    if (typeof v === 'string' && !v.trim()) continue;
    if (Array.isArray(v) && !v.length) continue;
    if (!same(v, pageDefaults(p, code)[f.key])) kept[f.key] = v;
  }
  return kept;
}

export async function loadPageContent(p: PageConfig): Promise<PageOverrides> {
  const s = await fetch(`${PAGE_API_BASE}/settings`, { headers: pageHeaders() }).then(r => r.json());
  const o = s?.data?.[p.settingKey];
  return o && typeof o === 'object' ? o : {};
}

/** Saves one language only: re-reads the latest saved text so the other
 *  languages (edited on another screen) are never overwritten. */
export async function savePageLang(p: PageConfig, code: PageLang, vals: Record<string, PageValue>): Promise<PageOverrides> {
  const latest = await loadPageContent(p);
  const kept = cleanLang(p, code, vals);
  const next: PageOverrides = { ...latest };
  if (Object.keys(kept).length) next[code] = kept; else delete next[code];
  const res = await fetch(`${PAGE_API_BASE}/settings`, { method: 'POST', headers: pageHeaders(), body: JSON.stringify({ [p.settingKey]: next }) });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Save failed');
  writePageCache(p, next);
  bustApiCache('settings');
  return next;
}

/** Page picker shared by the English editor and the Translations screen. */
export function PagePicker({ value, onChange }: { value: PageId; onChange: (id: PageId) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {PAGE_LIST.map(p => (
        <button key={p.id} type="button" onClick={() => onChange(p.id)}
          className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${value === p.id
            ? 'bg-purple-600 border-purple-500 text-white'
            : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'}`}>
          {p.label}
        </button>
      ))}
    </div>
  );
}

// ── AI help ───────────────────────────────────────────────────────────────────
// The server's improve-field endpoint knows a fixed set of field styles; each
// page field borrows the closest one, and the hidden context tells the AI
// which page and field it is writing for.
const aiFieldKey = (f: PageField) =>
  f.kind === 'steps' ? 'howItWorks' : f.kind === 'lines' ? 'deliverables' : (f.ai || 'sectionSubtitle');

const toAiText = (f: PageField, v: PageValue): string =>
  f.kind === 'steps' ? (v as PageStep[]).map((s, i) => `Step ${i + 1}: ${s.title} | ${s.body}`).join('\n')
  : f.kind === 'lines' ? (v as string[]).join('\n')
  : String(v ?? '');

const fromAiText = (f: PageField, text: string): PageValue | null => {
  const rows = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (f.kind === 'lines') return rows.map(l => l.replace(/^([-*•]|\d+[.)])\s+/, '')).filter(Boolean);
  if (f.kind === 'steps') {
    const steps = rows.map(l => l.replace(/^([-*•]|\d+[.)])\s+/, '').replace(/^step\s*\d+\s*[:.\-–—]\s*/i, ''))
      .map(l => { const i = l.indexOf('|'); return i < 0 ? null : { title: l.slice(0, i).trim(), body: l.slice(i + 1).trim() }; })
      .filter(Boolean) as PageStep[];
    return steps.length ? steps : null;
  }
  return text.trim();
};

const aiContext = (p: PageConfig, f: PageField, v: PageValue) => {
  const n = Array.isArray(v) ? v.length : 0;
  const extra =
    f.kind === 'steps' ? ` Return exactly ${n || 4} items, one per line, each as "Title | Description".`
    : f.kind === 'lines' ? ` Return ${n || 4} short items, one per line, no numbering.`
    : '';
  const bold = f.hint?.includes('**') ? ' Keep 2–3 key phrases wrapped in **double stars**.' : '';
  return `This text is for ${p.aiAbout}, not the home page. Field: "${f.label}".${extra}${bold}`;
};

// ── Editor ────────────────────────────────────────────────────────────────────
export function PageTextTab({ onOpenTranslations }: { onOpenTranslations?: (page: PageId) => void }) {
  const [pageId, setPageId] = useState<PageId>('workWithUs');
  return (
    <div className="space-y-4">
      <GlassCard className="p-4 sm:p-6 space-y-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Page Text</h2>
          <p className="text-white/50 text-sm mt-1">
            Headings, intros and section text of pages whose items are managed elsewhere.
            Use <Sparkles className="w-3 h-3 inline text-purple-300" /> on any field to write it with AI. Unchanged fields keep the built-in text.
          </p>
        </div>
        <PagePicker value={pageId} onChange={setPageId} />
      </GlassCard>
      <PageTextEditor key={pageId} page={PAGES[pageId]} onOpenTranslations={() => onOpenTranslations?.(pageId)} />
    </div>
  );
}

function PageTextEditor({ page, onOpenTranslations }: { page: PageConfig; onOpenTranslations?: () => void }) {
  const [vals, setVals] = useState<Record<string, PageValue>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [ai, setAi] = useState<PageField | null>(null);

  useEffect(() => {
    loadPageContent(page)
      .then(o => setVals(clone(o.en || {})))
      .catch(() => setMessage({ ok: false, text: 'Could not load the saved text.' }))
      .finally(() => setLoading(false));
  }, [page]);

  const setValue = (key: string, v: PageValue) => { setVals(d => ({ ...d, [key]: v })); setDirty(true); setMessage(null); };
  const resetField = (key: string) => { setVals(d => { const n = { ...d }; delete n[key]; return n; }); setDirty(true); setMessage(null); };

  const save = async () => {
    setSaving(true); setMessage(null);
    try {
      const next = await savePageLang(page, 'en', vals);
      setVals(clone(next.en || {}));
      setDirty(false);
      setMessage({ ok: true, text: 'Saved — live on the page now. Update French & Arabic in Translations, then Republish so Google & AI see it.' });
    } catch (err: any) {
      setMessage({ ok: false, text: err?.message || String(err) });
    }
    setSaving(false);
  };

  if (loading) {
    return <GlassCard className="p-6 text-white/50 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</GlassCard>;
  }

  const editedCount = pageFields(page).filter(f => pageIsEdited(page, vals, 'en', f.key)).length;

  return (
    <div className="space-y-4">
      <GlassCard className="p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-white">{page.label}</h3>
            <p className="text-white/50 text-sm mt-1">
              The English text of <a href={page.path} target="_blank" rel="noreferrer" className="text-purple-300 hover:underline inline-flex items-center gap-1">{page.path} <ExternalLink className="w-3 h-3" /></a>.
            </p>
          </div>
          <button type="button" onClick={save} disabled={saving || !dirty}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold disabled:opacity-40">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-white/45">
          <span>{editedCount ? `${editedCount} field${editedCount === 1 ? '' : 's'} edited` : 'Showing the built-in text'}</span>
          <span>·</span>
          <button type="button" onClick={onOpenTranslations} className="inline-flex items-center gap-1 text-purple-300 hover:text-purple-200">
            <Languages className="w-3.5 h-3.5" /> French & Arabic: Translations → Page Text
          </button>
        </div>
        {message && <p className={`mt-3 text-sm ${message.ok ? 'text-emerald-300' : 'text-red-300'}`}>{message.text}</p>}
      </GlassCard>

      {page.groups.map(group => (
        <GlassCard key={group.title} className="p-4 sm:p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">{group.title}</h3>
          {group.fields.map(f => (
            <PageFieldEditor key={f.key} field={f}
              value={pageValueOf(page, vals, 'en', f.key)} edited={pageIsEdited(page, vals, 'en', f.key)}
              onChange={v => setValue(f.key, v)} onReset={() => resetField(f.key)} onAi={() => setAi(f)} />
          ))}
        </GlassCard>
      ))}

      {ai && (
        <AIImproveModal
          fieldLabel={ai.label}
          fieldKey={aiFieldKey(ai)}
          currentValue={toAiText(ai, pageValueOf(page, vals, 'en', ai.key))}
          context={{ entityType: 'home' }}
          extraInstruction={aiContext(page, ai, pageValueOf(page, vals, 'en', ai.key))}
          onApply={text => {
            const v = fromAiText(ai, text);
            if (v === null) setMessage({ ok: false, text: 'Could not read the AI result for that list. Try again.' });
            else setValue(ai.key, v);
          }}
          onClose={() => setAi(null)}
        />
      )}
    </div>
  );
}

export function PageFieldEditor({ field: f, value, edited, rtl = false, onChange, onReset, onAi }: {
  field: PageField; value: PageValue; edited: boolean; rtl?: boolean;
  onChange: (v: PageValue) => void; onReset: () => void; onAi?: () => void;
}) {
  const dir = rtl ? 'rtl' : 'ltr';
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <label className="text-sm text-white/80">
          {f.label}
          {edited && <span className="ml-2 text-[10px] uppercase tracking-wider text-purple-300">edited</span>}
        </label>
        <div className="flex items-center gap-3">
          {edited && (
            <button type="button" onClick={onReset} className="text-xs text-white/40 hover:text-white flex items-center gap-1">
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          )}
          {onAi && (
            <button type="button" onClick={onAi} title="Write with AI"
              className="text-xs text-purple-300 hover:text-purple-200 flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> AI
            </button>
          )}
        </div>
      </div>

      {f.kind === 'text' && (
        <Input dir={dir} className={field} value={value as string} onChange={e => onChange(e.target.value)} />
      )}
      {f.kind === 'multiline' && (
        <>
          <textarea dir={dir} rows={Math.max(2, Math.ceil(String(value).length / 90))} className={area} value={value as string} onChange={e => onChange(e.target.value)} />
          {f.hint && <p className="text-[11px] text-white/35 mt-1">{f.hint}</p>}
        </>
      )}
      {f.kind === 'lines' && (
        <>
          <textarea dir={dir} rows={Math.max(3, (value as string[]).length + 1)} className={area}
            value={(value as string[]).join('\n')} onChange={e => onChange(e.target.value.split('\n'))} />
          {f.hint && <p className="text-[11px] text-white/35 mt-1">{f.hint}</p>}
        </>
      )}
      {f.kind === 'steps' && (
        <div className="space-y-2">
          {(value as PageStep[]).map((s, i) => (
            <div key={i} className="flex gap-2 items-start rounded-lg border border-white/10 bg-white/3 p-2">
              <span className="w-6 h-6 shrink-0 rounded-full bg-purple-500/20 text-purple-200 text-xs flex items-center justify-center mt-1.5">{i + 1}</span>
              <div className="flex-1 space-y-1.5">
                <Input dir={dir} className={field} placeholder="Title" value={s.title}
                  onChange={e => { const n = clone(value as PageStep[]); n[i].title = e.target.value; onChange(n); }} />
                <textarea dir={dir} rows={2} className={area} placeholder="Text" value={s.body}
                  onChange={e => { const n = clone(value as PageStep[]); n[i].body = e.target.value; onChange(n); }} />
              </div>
              <button type="button" title="Remove" onClick={() => onChange((value as PageStep[]).filter((_, j) => j !== i))}
                className="p-1.5 text-white/40 hover:text-red-300 mt-1"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <button type="button" onClick={() => onChange([...(value as PageStep[]), { title: '', body: '' }])}
            className="flex items-center gap-1.5 text-xs text-purple-300 hover:text-purple-200">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
      )}
    </div>
  );
}
