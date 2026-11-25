// Admin → Work With Us. Edit the text of /work-with-us in English, French and
// Arabic. Saved as the site setting `workWithUsContent` (POST /settings);
// only fields that differ from the built-in text are stored.
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ExternalLink, Languages, Loader2, Plus, RotateCcw, Save, Trash2 } from 'lucide-react';
import { GlassCard } from '../shared/GlassCard';
import { Input } from '../ui/input';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import en from '../../../locales/en.json';
import fr from '../../../locales/fr.json';
import ar from '../../../locales/ar.json';
import {
  WWU_FIELDS, WWU_GROUPS, flattenForTranslation, unflattenTranslation,
  type WwuField, type WwuLang, type WwuOverrides, type WwuStep, type WwuValue,
} from '../../utils/workWithUsContent';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;
const headers = () => ({
  Authorization: `Bearer ${publicAnonKey}`,
  'X-Admin-Token': localStorage.getItem('admin_token') || '',
  'Content-Type': 'application/json',
});
const field = 'bg-black/50 border-white/20 text-white';
const area = 'w-full rounded-md bg-black/50 border border-white/20 text-white text-sm px-3 py-2 focus:outline-none focus:ring-1 focus:ring-purple-500';

const LANGS: { code: WwuLang; label: string; name: string }[] = [
  { code: 'en', label: 'English', name: 'English' },
  { code: 'fr', label: 'Français', name: 'French' },
  { code: 'ar', label: 'العربية', name: 'Arabic' },
];
const DEFAULTS: Record<WwuLang, Record<string, WwuValue>> = {
  en: ((en as any).workWithUs || {}),
  fr: ((fr as any).workWithUs || {}),
  ar: ((ar as any).workWithUs || {}),
};

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

/** Keeps only the fields that differ from the built-in text. */
function cleanOverrides(draft: WwuOverrides): WwuOverrides {
  const out: WwuOverrides = {};
  for (const { code } of LANGS) {
    const vals = draft[code] || {};
    const kept: Record<string, WwuValue> = {};
    for (const f of WWU_FIELDS) {
      let v = vals[f.key];
      if (v === undefined) continue;
      if (f.kind === 'lines' && Array.isArray(v)) v = (v as string[]).map(x => x.trim()).filter(Boolean);
      if (f.kind === 'steps' && Array.isArray(v)) v = (v as WwuStep[]).filter(s => s.title?.trim() || s.body?.trim());
      if (typeof v === 'string' && !v.trim()) continue;
      if (Array.isArray(v) && !v.length) continue;
      if (!same(v, DEFAULTS[code][f.key])) kept[f.key] = v;
    }
    if (Object.keys(kept).length) out[code] = kept;
  }
  return out;
}

export function WorkWithUsTab() {
  const [lang, setLang] = useState<WwuLang>('en');
  const [draft, setDraft] = useState<WwuOverrides>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/settings`, { headers: headers() })
      .then(r => r.json())
      .then(s => {
        const o = s?.data?.workWithUsContent;
        setDraft(o && typeof o === 'object' ? clone(o) : {});
      })
      .catch(() => setMessage({ ok: false, text: 'Could not load the saved text.' }))
      .finally(() => setLoading(false));
  }, []);

  const valueOf = (code: WwuLang, key: string): WwuValue => {
    const v = draft[code]?.[key];
    return v !== undefined ? v : clone(DEFAULTS[code][key] ?? '');
  };
  const isEdited = (code: WwuLang, key: string) =>
    draft[code]?.[key] !== undefined && !same(draft[code]?.[key], DEFAULTS[code][key]);

  const setValue = (key: string, v: WwuValue) => {
    setDraft(d => ({ ...d, [lang]: { ...(d[lang] || {}), [key]: v } }));
    setDirty(true); setMessage(null);
  };
  const resetField = (key: string) => {
    setDraft(d => {
      const vals = { ...(d[lang] || {}) };
      delete vals[key];
      return { ...d, [lang]: vals };
    });
    setDirty(true); setMessage(null);
  };

  // English fields changed but not (yet) in this language → it still shows old text.
  const outOfSync = useMemo(() => {
    if (lang === 'en') return [];
    return WWU_FIELDS.filter(f => isEdited('en', f.key) && !isEdited(lang, f.key)).map(f => f.label);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, lang]);
  const editedCount = WWU_FIELDS.filter(f => isEdited(lang, f.key)).length;

  const save = async () => {
    setSaving(true); setMessage(null);
    try {
      const clean = cleanOverrides(draft);
      const res = await fetch(`${API_BASE}/settings`, { method: 'POST', headers: headers(), body: JSON.stringify({ workWithUsContent: clean }) });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Save failed');
      setDraft(clone(clean));
      setDirty(false);
      try { localStorage.setItem('wwu_content_cache', JSON.stringify(clean)); } catch { /* ignore */ }
      setMessage({ ok: true, text: 'Saved — live on the page now. Click Republish so Google & AI see it too.' });
    } catch (err: any) {
      setMessage({ ok: false, text: err?.message || String(err) });
    }
    setSaving(false);
  };

  const translateFromEnglish = async () => {
    if (lang === 'en') return;
    const target = LANGS.find(l => l.code === lang)!;
    if (!confirm(`Replace the ${target.name} text with an AI translation of the current English text? You can review it before saving.`)) return;
    setTranslating(true); setMessage(null);
    try {
      const source: Record<string, WwuValue> = {};
      for (const f of WWU_FIELDS) source[f.key] = valueOf('en', f.key);
      const res = await fetch(`${API_BASE}/admin/translate`, {
        method: 'POST', headers: headers(),
        body: JSON.stringify({ lang, langName: target.name, fields: flattenForTranslation(source) }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Translation failed');
      const translated = unflattenTranslation(source, json.data || {});
      setDraft(d => ({ ...d, [lang]: { ...(d[lang] || {}), ...translated } }));
      setDirty(true);
      setMessage({ ok: true, text: `Translated to ${target.name}. Review it, then click Save.` });
    } catch (err: any) {
      setMessage({ ok: false, text: err?.message || String(err) });
    }
    setTranslating(false);
  };

  if (loading) {
    return <GlassCard className="p-6 text-white/50 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</GlassCard>;
  }

  const rtl = lang === 'ar';

  return (
    <div className="space-y-4">
      <GlassCard className="p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold text-white">Work With Us page</h2>
            <p className="text-white/50 text-sm mt-1">
              Edit the text of <a href="/work-with-us" target="_blank" rel="noreferrer" className="text-purple-300 hover:underline inline-flex items-center gap-1">/work-with-us <ExternalLink className="w-3 h-3" /></a>.
              Empty or unchanged fields keep the built-in text.
            </p>
          </div>
          <button type="button" onClick={save} disabled={saving || !dirty}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold disabled:opacity-40">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mt-4">
          {LANGS.map(l => {
            const n = WWU_FIELDS.filter(f => isEdited(l.code, f.key)).length;
            return (
              <button key={l.code} type="button" onClick={() => setLang(l.code)}
                className={`px-3 py-1.5 rounded-lg text-sm border ${lang === l.code ? 'bg-purple-500/25 border-purple-400/50 text-white' : 'bg-white/5 border-white/10 text-white/60 hover:text-white'}`}>
                {l.label}{n ? <span className="ml-1.5 text-[10px] text-purple-200">{n} edited</span> : null}
              </button>
            );
          })}
          {lang !== 'en' && (
            <button type="button" onClick={translateFromEnglish} disabled={translating}
              className="ml-auto flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm bg-white/5 border border-white/10 text-white/70 hover:text-white disabled:opacity-50">
              {translating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Languages className="w-4 h-4" />}
              {translating ? 'Translating…' : 'Translate from English ✨'}
            </button>
          )}
        </div>

        {outOfSync.length > 0 && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>English was changed but this language still shows its old text for: {outOfSync.join(', ')}. Use “Translate from English” or edit them here.</span>
          </div>
        )}
        {message && (
          <p className={`mt-3 text-sm ${message.ok ? 'text-emerald-300' : 'text-red-300'}`}>{message.text}</p>
        )}
        {lang !== 'en' && editedCount === 0 && !outOfSync.length && (
          <p className="mt-3 text-xs text-white/40">Showing the built-in {LANGS.find(l => l.code === lang)!.name} text.</p>
        )}
      </GlassCard>

      {WWU_GROUPS.map(group => (
        <GlassCard key={group.title} className="p-4 sm:p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white">{group.title}</h3>
          {group.fields.map(f => (
            <FieldEditor key={`${lang}-${f.key}`} field={f} rtl={rtl}
              value={valueOf(lang, f.key)} edited={isEdited(lang, f.key)}
              onChange={v => setValue(f.key, v)} onReset={() => resetField(f.key)} />
          ))}
        </GlassCard>
      ))}
    </div>
  );
}

function FieldEditor({ field: f, value, edited, rtl, onChange, onReset }: {
  field: WwuField; value: WwuValue; edited: boolean; rtl: boolean;
  onChange: (v: WwuValue) => void; onReset: () => void;
}) {
  const dir = rtl ? 'rtl' : 'ltr';
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <label className="text-sm text-white/80">
          {f.label}
          {edited && <span className="ml-2 text-[10px] uppercase tracking-wider text-purple-300">edited</span>}
        </label>
        {edited && (
          <button type="button" onClick={onReset} className="text-xs text-white/40 hover:text-white flex items-center gap-1">
            <RotateCcw className="w-3 h-3" /> Reset
          </button>
        )}
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
