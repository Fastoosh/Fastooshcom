// Admin → Work With Us. Edit the English text of /work-with-us, with ✨ AI
// help on every field. French and Arabic are edited in Admin → Translations →
// Work With Us. Saved as the site setting `workWithUsContent`
// ({ en, fr, ar }); only fields that differ from the built-in text are stored,
// and each screen saves only its own language.
import { useEffect, useState } from 'react';
import { ExternalLink, Languages, Loader2, Plus, RotateCcw, Save, Sparkles, Trash2 } from 'lucide-react';
import { GlassCard } from '../shared/GlassCard';
import { Input } from '../ui/input';
import { AIImproveModal } from './AIImproveModal';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import en from '../../../locales/en.json';
import fr from '../../../locales/fr.json';
import ar from '../../../locales/ar.json';
import {
  WWU_FIELDS, WWU_GROUPS,
  type WwuField, type WwuLang, type WwuOverrides, type WwuStep, type WwuValue,
} from '../../utils/workWithUsContent';

export const WWU_API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;
export const wwuHeaders = () => ({
  Authorization: `Bearer ${publicAnonKey}`,
  'X-Admin-Token': localStorage.getItem('admin_token') || '',
  'Content-Type': 'application/json',
});
const field = 'bg-black/50 border-white/20 text-white';
const area = 'w-full rounded-md bg-black/50 border border-white/20 text-white text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500';

export const WWU_DEFAULTS: Record<WwuLang, Record<string, WwuValue>> = {
  en: ((en as any).workWithUs || {}),
  fr: ((fr as any).workWithUs || {}),
  ar: ((ar as any).workWithUs || {}),
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
export const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/** The value shown for a field: the saved edit, else the built-in text. */
export const wwuValueOf = (vals: Record<string, WwuValue> | undefined, code: WwuLang, key: string): WwuValue =>
  vals?.[key] !== undefined ? vals[key] : clone(WWU_DEFAULTS[code][key] ?? '');

export const wwuIsEdited = (vals: Record<string, WwuValue> | undefined, code: WwuLang, key: string) =>
  vals?.[key] !== undefined && !same(vals[key], WWU_DEFAULTS[code][key]);

/** One language's values, keeping only fields that differ from the built-in text. */
export function cleanLang(code: WwuLang, vals: Record<string, WwuValue> = {}): Record<string, WwuValue> {
  const kept: Record<string, WwuValue> = {};
  for (const f of WWU_FIELDS) {
    let v = vals[f.key];
    if (v === undefined) continue;
    if (f.kind === 'lines' && Array.isArray(v)) v = (v as string[]).map(x => x.trim()).filter(Boolean);
    if (f.kind === 'steps' && Array.isArray(v)) v = (v as WwuStep[]).filter(s => s.title?.trim() || s.body?.trim());
    if (typeof v === 'string' && !v.trim()) continue;
    if (Array.isArray(v) && !v.length) continue;
    if (!same(v, WWU_DEFAULTS[code][f.key])) kept[f.key] = v;
  }
  return kept;
}

export async function loadWwuContent(): Promise<WwuOverrides> {
  const s = await fetch(`${WWU_API_BASE}/settings`, { headers: wwuHeaders() }).then(r => r.json());
  const o = s?.data?.workWithUsContent;
  return o && typeof o === 'object' ? o : {};
}

/** Saves one language only: re-reads the latest saved text so the other
 *  languages (edited on another screen) are never overwritten. */
export async function saveWwuLang(code: WwuLang, vals: Record<string, WwuValue>): Promise<WwuOverrides> {
  const latest = await loadWwuContent();
  const kept = cleanLang(code, vals);
  const next: WwuOverrides = { ...latest };
  if (Object.keys(kept).length) next[code] = kept; else delete next[code];
  const res = await fetch(`${WWU_API_BASE}/settings`, { method: 'POST', headers: wwuHeaders(), body: JSON.stringify({ workWithUsContent: next }) });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Save failed');
  try { localStorage.setItem('wwu_content_cache', JSON.stringify(next)); } catch { /* ignore */ }
  return next;
}

// ── AI help ───────────────────────────────────────────────────────────────────
// The server's improve-field endpoint knows a fixed set of field styles; each
// page field borrows the closest one, and the hidden context tells the AI
// which page and field it is writing for.
const AI_FIELD_KEY: Record<string, string> = {
  titleLine1: 'heroLine1', titleLine2: 'heroLine2', subtitle: 'heroSubtitle',
  bookCall: 'sectionHeading', sendBrief: 'sectionHeading', whyChooseTitle: 'sectionHeading',
  prescreenTitle: 'sectionHeading', formTitle: 'sectionHeading',
  tagRecommended: 'processStepTitle', tagAsync: 'processStepTitle',
  bookCallDesc: 'sectionSubtitle', sendBriefDesc: 'sectionSubtitle', prescreenSubtitle: 'sectionSubtitle',
  formSubtitle: 'sectionSubtitle', successMsg: 'sectionSubtitle',
  freeNoCommitment: 'turnaroundNote',
};
const aiFieldKey = (f: WwuField) =>
  f.kind === 'steps' ? 'howItWorks' : f.kind === 'lines' ? 'deliverables' : (AI_FIELD_KEY[f.key] || 'sectionSubtitle');

const toAiText = (f: WwuField, v: WwuValue): string =>
  f.kind === 'steps' ? (v as WwuStep[]).map((s, i) => `Step ${i + 1}: ${s.title} | ${s.body}`).join('\n')
  : f.kind === 'lines' ? (v as string[]).join('\n')
  : String(v ?? '');

const fromAiText = (f: WwuField, text: string): WwuValue | null => {
  const rows = text.split('\n').map(l => l.trim()).filter(Boolean);
  if (f.kind === 'lines') return rows.map(l => l.replace(/^([-*•]|\d+[.)])\s+/, '')).filter(Boolean);
  if (f.kind === 'steps') {
    const steps = rows.map(l => l.replace(/^([-*•]|\d+[.)])\s+/, '').replace(/^step\s*\d+\s*[:.\-–—]\s*/i, ''))
      .map(l => { const i = l.indexOf('|'); return i < 0 ? null : { title: l.slice(0, i).trim(), body: l.slice(i + 1).trim() }; })
      .filter(Boolean) as WwuStep[];
    return steps.length ? steps : null;
  }
  return text.trim();
};

const aiContext = (f: WwuField, v: WwuValue) => {
  const n = Array.isArray(v) ? v.length : 0;
  const extra =
    f.kind === 'steps' ? ` Return exactly ${n || 4} items, one per line, each as "Title | Description".`
    : f.kind === 'lines' ? ` Return ${n || 4} short items, one per line, no numbering.`
    : '';
  return `This text is for Fastoosh's "Work With Us" page (where brands and studios hire Fastoosh for motion design / video work or a discovery call), not the home page. Field: "${f.label}".${extra}`;
};

// ── Editor ────────────────────────────────────────────────────────────────────
export function WorkWithUsTab({ onOpenTranslations }: { onOpenTranslations?: () => void }) {
  const [vals, setVals] = useState<Record<string, WwuValue>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [ai, setAi] = useState<WwuField | null>(null);

  useEffect(() => {
    loadWwuContent()
      .then(o => setVals(clone(o.en || {})))
      .catch(() => setMessage({ ok: false, text: 'Could not load the saved text.' }))
      .finally(() => setLoading(false));
  }, []);

  const setValue = (key: string, v: WwuValue) => { setVals(d => ({ ...d, [key]: v })); setDirty(true); setMessage(null); };
  const resetField = (key: string) => { setVals(d => { const n = { ...d }; delete n[key]; return n; }); setDirty(true); setMessage(null); };

  const save = async () => {
    setSaving(true); setMessage(null);
    try {
      const next = await saveWwuLang('en', vals);
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

  const editedCount = WWU_FIELDS.filter(f => wwuIsEdited(vals, 'en', f.key)).length;

  return (
    <div className="space-y-4">
      <GlassCard className="p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-white">Work With Us page</h2>
            <p className="text-white/50 text-sm mt-1">
              The English text of <a href="/work-with-us" target="_blank" rel="noreferrer" className="text-purple-300 hover:underline inline-flex items-center gap-1">/work-with-us <ExternalLink className="w-3 h-3" /></a>.
              Use <Sparkles className="w-3 h-3 inline text-purple-300" /> on any field to write it with AI. Unchanged fields keep the built-in text.
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
            <Languages className="w-3.5 h-3.5" /> French & Arabic: Translations → Work With Us
          </button>
        </div>
        {message && <p className={`mt-3 text-sm ${message.ok ? 'text-emerald-300' : 'text-red-300'}`}>{message.text}</p>}
      </GlassCard>

      {WWU_GROUPS.map(group => (
        <GlassCard key={group.title} className="p-4 sm:p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">{group.title}</h3>
          {group.fields.map(f => (
            <WwuFieldEditor key={f.key} field={f}
              value={wwuValueOf(vals, 'en', f.key)} edited={wwuIsEdited(vals, 'en', f.key)}
              onChange={v => setValue(f.key, v)} onReset={() => resetField(f.key)} onAi={() => setAi(f)} />
          ))}
        </GlassCard>
      ))}

      {ai && (
        <AIImproveModal
          fieldLabel={ai.label}
          fieldKey={aiFieldKey(ai)}
          currentValue={toAiText(ai, wwuValueOf(vals, 'en', ai.key))}
          context={{ entityType: 'home' }}
          extraInstruction={aiContext(ai, wwuValueOf(vals, 'en', ai.key))}
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

export function WwuFieldEditor({ field: f, value, edited, rtl = false, onChange, onReset, onAi }: {
  field: WwuField; value: WwuValue; edited: boolean; rtl?: boolean;
  onChange: (v: WwuValue) => void; onReset: () => void; onAi?: () => void;
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
        <textarea dir={dir} rows={2} className={area} value={value as string} onChange={e => onChange(e.target.value)} />
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
          {(value as WwuStep[]).map((s, i) => (
            <div key={i} className="flex gap-2 items-start rounded-lg border border-white/10 bg-white/3 p-2">
              <span className="w-6 h-6 shrink-0 rounded-full bg-purple-500/20 text-purple-200 text-xs flex items-center justify-center mt-1.5">{i + 1}</span>
              <div className="flex-1 space-y-1.5">
                <Input dir={dir} className={field} placeholder="Title" value={s.title}
                  onChange={e => { const n = clone(value as WwuStep[]); n[i].title = e.target.value; onChange(n); }} />
                <textarea dir={dir} rows={2} className={area} placeholder="Text" value={s.body}
                  onChange={e => { const n = clone(value as WwuStep[]); n[i].body = e.target.value; onChange(n); }} />
              </div>
              <button type="button" title="Remove" onClick={() => onChange((value as WwuStep[]).filter((_, j) => j !== i))}
                className="p-1.5 text-white/40 hover:text-red-300 mt-1"><Trash2 className="w-4 h-4" /></button>
            </div>
          ))}
          <button type="button" onClick={() => onChange([...(value as WwuStep[]), { title: '', body: '' }])}
            className="flex items-center gap-1.5 text-xs text-purple-300 hover:text-purple-200">
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </div>
      )}
    </div>
  );
}
