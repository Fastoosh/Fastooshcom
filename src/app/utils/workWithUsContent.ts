// Editable text of the Work With Us page (Admin → Work With Us).
// Saved as the site setting `workWithUsContent` = { en: {...}, fr: {...}, ar: {...} }.
// Any field left out falls back to the built-in text in src/locales/*.json.

export type WwuLang = 'en' | 'fr' | 'ar';
export type WwuStep = { title: string; body: string };
export type WwuValue = string | string[] | WwuStep[];
export type WwuOverrides = Partial<Record<WwuLang, Record<string, WwuValue>>>;

export type WwuFieldKind = 'text' | 'multiline' | 'steps' | 'lines';
export interface WwuField { key: string; label: string; kind: WwuFieldKind; hint?: string }
export interface WwuGroup { title: string; fields: WwuField[] }

export const WWU_GROUPS: WwuGroup[] = [
  { title: 'Page header', fields: [
    { key: 'titleLine1', label: 'Heading — line 1', kind: 'text' },
    { key: 'titleLine2', label: 'Heading — line 2 (gradient)', kind: 'text' },
    { key: 'subtitle',   label: 'Intro text', kind: 'multiline' },
  ]},
  { title: 'Option 1 — Discovery call', fields: [
    { key: 'bookCall',          label: 'Title', kind: 'text' },
    { key: 'tagRecommended',    label: 'Tag', kind: 'text' },
    { key: 'bookCallDesc',      label: 'Description', kind: 'multiline' },
    { key: 'callSteps',         label: 'How it works — steps', kind: 'steps' },
    { key: 'prescreenTitle',    label: 'Pre-screen form title', kind: 'text' },
    { key: 'prescreenSubtitle', label: 'Pre-screen form subtitle', kind: 'multiline' },
    { key: 'freeNoCommitment',  label: 'Note under the form', kind: 'text' },
  ]},
  { title: 'Option 2 — Written brief', fields: [
    { key: 'sendBrief',     label: 'Title', kind: 'text' },
    { key: 'tagAsync',      label: 'Tag', kind: 'text' },
    { key: 'sendBriefDesc', label: 'Description', kind: 'multiline' },
    { key: 'briefSteps',    label: 'How it works — steps', kind: 'steps' },
    { key: 'formTitle',     label: 'Brief form title', kind: 'text' },
    { key: 'formSubtitle',  label: 'Brief form subtitle', kind: 'multiline' },
    { key: 'successMsg',    label: 'Message after sending', kind: 'multiline' },
  ]},
  { title: 'Why teams choose Fastoosh', fields: [
    { key: 'whyChooseTitle', label: 'Section title', kind: 'text' },
    { key: 'trustSignals',   label: 'Reasons', kind: 'steps' },
    { key: 'trustBadges',    label: 'Badges', kind: 'lines', hint: 'One per line, e.g. ✓ NDA-friendly' },
  ]},
  { title: 'Form choices', fields: [
    { key: 'projectTypes', label: 'Project types', kind: 'lines', hint: 'One per line' },
    { key: 'budgetRanges', label: 'Budget ranges', kind: 'lines', hint: 'One per line' },
    { key: 'timelines',    label: 'Timelines',     kind: 'lines', hint: 'One per line' },
  ]},
];

export const WWU_FIELDS: WwuField[] = WWU_GROUPS.flatMap(g => g.fields);

export const baseLang = (lng?: string): WwuLang => {
  const l = (lng || 'en').split('-')[0];
  return l === 'fr' || l === 'ar' ? l : 'en';
};

/** True when an override value is filled in (non-empty). */
export function hasValue(v: unknown): boolean {
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return false;
}

const CACHE_KEY = 'wwu_content_cache';
export function readCachedOverrides(): WwuOverrides {
  try { return JSON.parse(localStorage.getItem(CACHE_KEY) || '{}') || {}; } catch { return {}; }
}
export function writeCachedOverrides(o: WwuOverrides) {
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(o || {})); } catch { /* ignore */ }
}

/** Flattens a language's values into "key" / "key.0.title" strings (for AI translation). */
export function flattenForTranslation(values: Record<string, WwuValue>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    if (typeof v === 'string') out[k] = v;
    else if (Array.isArray(v)) v.forEach((item, i) => {
      if (typeof item === 'string') out[`${k}.${i}`] = item;
      else { out[`${k}.${i}.title`] = item.title; out[`${k}.${i}.body`] = item.body; }
    });
  }
  return out;
}

/** Rebuilds the shape of `template` from translated flat strings. */
export function unflattenTranslation(template: Record<string, WwuValue>, flat: Record<string, string>): Record<string, WwuValue> {
  const out: Record<string, WwuValue> = {};
  for (const [k, v] of Object.entries(template)) {
    if (typeof v === 'string') out[k] = flat[k] ?? v;
    else if (Array.isArray(v)) out[k] = v.map((item, i) => typeof item === 'string'
      ? (flat[`${k}.${i}`] ?? item)
      : { title: flat[`${k}.${i}.title`] ?? item.title, body: flat[`${k}.${i}.body`] ?? item.body }) as WwuValue;
  }
  return out;
}
