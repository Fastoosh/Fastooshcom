// Admin → Translations → Work With Us. French / Arabic text of /work-with-us,
// shown beside the English. Saves only the selected language.
import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Loader2, RefreshCw, Save, Sparkles } from 'lucide-react';
import { GlassCard } from '../shared/GlassCard';
import {
  WWU_API_BASE, WwuFieldEditor, clone, loadWwuContent, saveWwuLang, wwuHeaders, wwuIsEdited, wwuValueOf,
} from './WorkWithUsTab';
import {
  WWU_FIELDS, WWU_GROUPS, flattenForTranslation, unflattenTranslation,
  type WwuField, type WwuLang, type WwuStep, type WwuValue,
} from '../../utils/workWithUsContent';

const LANG_NAME: Record<string, string> = { fr: 'French', ar: 'Arabic' };

function EnglishPreview({ field: f, value }: { field: WwuField; value: WwuValue }) {
  if (f.kind === 'steps') {
    return (
      <ol className="space-y-1.5 list-decimal list-inside">
        {(value as WwuStep[]).map((s, i) => <li key={i}><span className="text-white/80">{s.title}</span> — {s.body}</li>)}
      </ol>
    );
  }
  if (f.kind === 'lines') return <ul className="space-y-0.5">{(value as string[]).map((l, i) => <li key={i}>{l}</li>)}</ul>;
  return <p className="whitespace-pre-line">{String(value)}</p>;
}

export function WorkWithUsTranslations({ lang }: { lang: WwuLang }) {
  const [enVals, setEnVals] = useState<Record<string, WwuValue>>({});
  const [vals, setVals] = useState<Record<string, WwuValue>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [translating, setTranslating] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const name = LANG_NAME[lang] || lang;

  useEffect(() => {
    setLoading(true); setDirty(false); setMessage(null);
    loadWwuContent()
      .then(o => { setEnVals(o.en || {}); setVals(clone(o[lang] || {})); })
      .catch(() => setMessage({ ok: false, text: 'Could not load the saved text.' }))
      .finally(() => setLoading(false));
  }, [lang]);

  // English was changed but this language still has its built-in text.
  const needsUpdate = useMemo(
    () => new Set(WWU_FIELDS.filter(f => wwuIsEdited(enVals, 'en', f.key) && !wwuIsEdited(vals, lang, f.key)).map(f => f.key)),
    [enVals, vals, lang],
  );

  const setValue = (key: string, v: WwuValue) => { setVals(d => ({ ...d, [key]: v })); setDirty(true); setMessage(null); };
  const resetField = (key: string) => { setVals(d => { const n = { ...d }; delete n[key]; return n; }); setDirty(true); setMessage(null); };

  const translate = async (onlyNeeded: boolean) => {
    const keys = onlyNeeded ? WWU_FIELDS.filter(f => needsUpdate.has(f.key)) : WWU_FIELDS;
    if (!keys.length) { setMessage({ ok: true, text: `Nothing to update — ${name} is in sync with English.` }); return; }
    if (!onlyNeeded && !confirm(`Replace all ${name} text with an AI translation of the English? You can review it before saving.`)) return;
    setTranslating(true); setMessage(null);
    try {
      const source: Record<string, WwuValue> = {};
      for (const f of keys) source[f.key] = wwuValueOf(enVals, 'en', f.key);
      const res = await fetch(`${WWU_API_BASE}/admin/translate`, {
        method: 'POST', headers: wwuHeaders(),
        body: JSON.stringify({ lang, langName: name, fields: flattenForTranslation(source) }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Translation failed');
      const out = unflattenTranslation(source, json.data || {});
      setVals(d => ({ ...d, ...out }));
      setDirty(true);
      setMessage({ ok: true, text: `Translated ${keys.length} field${keys.length === 1 ? '' : 's'}. Review, then click Save.` });
    } catch (err: any) {
      setMessage({ ok: false, text: err?.message || String(err) });
    }
    setTranslating(false);
  };

  const save = async () => {
    setSaving(true); setMessage(null);
    try {
      const next = await saveWwuLang(lang, vals);
      setVals(clone(next[lang] || {}));
      setEnVals(next.en || {});
      setDirty(false);
      setMessage({ ok: true, text: `${name} saved — live on the page now.` });
    } catch (err: any) {
      setMessage({ ok: false, text: err?.message || String(err) });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <GlassCard className="p-12 text-center text-gray-400">
        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-purple-400" /> Loading content...
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      <GlassCard className="p-4 sm:p-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-48 text-sm">
            {needsUpdate.size ? (
              <span className="inline-flex items-center gap-2 text-amber-200">
                <AlertTriangle className="w-4 h-4" /> {needsUpdate.size} field{needsUpdate.size === 1 ? '' : 's'} changed in English but not yet in {name}
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 text-emerald-300">
                <CheckCircle2 className="w-4 h-4" /> {name} is in sync with English
              </span>
            )}
          </div>
          <button type="button" onClick={() => translate(true)} disabled={translating || !needsUpdate.size}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-purple-600/20 border border-purple-500/40 text-purple-200 hover:bg-purple-600/30 disabled:opacity-40">
            {translating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />} Translate Missing
          </button>
          <button type="button" onClick={() => translate(false)} disabled={translating}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-violet-600/20 border border-violet-500/40 text-violet-200 hover:bg-violet-600/30 disabled:opacity-40">
            {translating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Translate All
          </button>
          <button type="button" onClick={save} disabled={saving || !dirty}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-green-600/20 border border-green-500/40 text-green-200 hover:bg-green-600/30 disabled:opacity-40">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />} {dirty ? 'Save Translations' : 'Saved'}
          </button>
        </div>
        {message && <p className={`mt-3 text-sm ${message.ok ? 'text-emerald-300' : 'text-red-300'}`}>{message.text}</p>}
        <p className="mt-2 text-xs text-white/40">English is edited in Admin → Work With Us. Fields you leave unchanged keep the built-in {name} text.</p>
      </GlassCard>

      {WWU_GROUPS.map(group => (
        <GlassCard key={group.title} className="p-4 sm:p-6 space-y-5">
          <h3 className="text-lg font-semibold text-white">{group.title}</h3>
          {group.fields.map(f => (
            <div key={`${lang}-${f.key}`} className={`grid gap-3 md:grid-cols-2 rounded-lg ${needsUpdate.has(f.key) ? 'ring-1 ring-amber-400/30 p-2 -m-2' : ''}`}>
              <div className="text-xs text-white/50 leading-relaxed">
                <p className="text-[10px] uppercase tracking-wider text-white/30 mb-1.5">
                  English{needsUpdate.has(f.key) && <span className="ml-2 text-amber-300 normal-case tracking-normal">changed — update the translation</span>}
                </p>
                <EnglishPreview field={f} value={wwuValueOf(enVals, 'en', f.key)} />
              </div>
              <WwuFieldEditor field={f} rtl={lang === 'ar'}
                value={wwuValueOf(vals, lang, f.key)} edited={wwuIsEdited(vals, lang, f.key)}
                onChange={v => setValue(f.key, v)} onReset={() => resetField(f.key)} />
            </div>
          ))}
        </GlassCard>
      ))}
    </div>
  );
}
