// Editable page text (Admin → Page Text). Each page's edits are saved as one
// site setting = { en: {...}, fr: {...}, ar: {...} }. Any field left out
// falls back to the built-in text in src/locales/*.json.
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { api } from './api';

export type PageLang = 'en' | 'fr' | 'ar';
export type PageStep = { title: string; body: string };
export type PageValue = string | string[] | PageStep[];
export type PageOverrides = Partial<Record<PageLang, Record<string, PageValue>>>;

export type PageFieldKind = 'text' | 'multiline' | 'steps' | 'lines';
/** `ai` = the improve-field style the AI borrows (see AIImproveModal). */
export interface PageField { key: string; label: string; kind: PageFieldKind; hint?: string; ai?: string }
export interface PageGroup { title: string; fields: PageField[] }

export type PageId = 'workWithUs' | 'about' | 'projects' | 'tools';
export interface PageConfig {
  id: PageId;
  label: string;
  path: string;
  /** Site setting the edits are saved under. */
  settingKey: string;
  /** Section of src/locales/*.json holding the built-in text. */
  localeSection: string;
  cacheKey: string;
  /** Tells the AI which page it writes for. */
  aiAbout: string;
  groups: PageGroup[];
  /** Built-in values that need reshaping before they can be edited. */
  prepareDefaults?: (section: Record<string, any>) => Record<string, PageValue>;
}

const header = (l1: string, l2: string): PageField[] => [
  { key: l1, label: 'Heading — part 1', kind: 'text', ai: 'heroLine1' },
  { key: l2, label: 'Heading — part 2 (gradient)', kind: 'text', ai: 'heroLine2' },
  { key: 'subtitle', label: 'Intro text', kind: 'multiline', ai: 'heroSubtitle' },
];

export const PAGES: Record<PageId, PageConfig> = {
  workWithUs: {
    id: 'workWithUs', label: 'Work With Us', path: '/work-with-us',
    settingKey: 'workWithUsContent', localeSection: 'workWithUs', cacheKey: 'wwu_content_cache',
    aiAbout: 'Fastoosh\'s "Work With Us" page (where brands and studios hire Fastoosh for motion design / video work or a discovery call)',
    groups: [
      { title: 'Page header', fields: header('titleLine1', 'titleLine2') },
      { title: 'Option 1 — Discovery call', fields: [
        { key: 'bookCall',          label: 'Title', kind: 'text', ai: 'sectionHeading' },
        { key: 'tagRecommended',    label: 'Tag', kind: 'text', ai: 'processStepTitle' },
        { key: 'bookCallDesc',      label: 'Description', kind: 'multiline' },
        { key: 'callSteps',         label: 'How it works — steps', kind: 'steps' },
        { key: 'prescreenTitle',    label: 'Pre-screen form title', kind: 'text', ai: 'sectionHeading' },
        { key: 'prescreenSubtitle', label: 'Pre-screen form subtitle', kind: 'multiline' },
        { key: 'freeNoCommitment',  label: 'Note under the form', kind: 'text', ai: 'turnaroundNote' },
      ]},
      { title: 'Option 2 — Written brief', fields: [
        { key: 'sendBrief',     label: 'Title', kind: 'text', ai: 'sectionHeading' },
        { key: 'tagAsync',      label: 'Tag', kind: 'text', ai: 'processStepTitle' },
        { key: 'sendBriefDesc', label: 'Description', kind: 'multiline' },
        { key: 'briefSteps',    label: 'How it works — steps', kind: 'steps' },
        { key: 'formTitle',     label: 'Brief form title', kind: 'text', ai: 'sectionHeading' },
        { key: 'formSubtitle',  label: 'Brief form subtitle', kind: 'multiline' },
        { key: 'successMsg',    label: 'Message after sending', kind: 'multiline' },
      ]},
      { title: 'Why teams choose Fastoosh', fields: [
        { key: 'whyChooseTitle', label: 'Section title', kind: 'text', ai: 'sectionHeading' },
        { key: 'trustSignals',   label: 'Reasons', kind: 'steps' },
        { key: 'trustBadges',    label: 'Badges', kind: 'lines', hint: 'One per line, e.g. ✓ NDA-friendly' },
      ]},
      { title: 'Form choices', fields: [
        { key: 'projectTypes', label: 'Project types', kind: 'lines', hint: 'One per line' },
        { key: 'budgetRanges', label: 'Budget ranges', kind: 'lines', hint: 'One per line' },
        { key: 'timelines',    label: 'Timelines',     kind: 'lines', hint: 'One per line' },
      ]},
    ],
  },

  about: {
    id: 'about', label: 'About', path: '/about',
    settingKey: 'aboutContent', localeSection: 'about', cacheKey: 'about_content_cache',
    aiAbout: 'Fastoosh\'s "About" page (the story, values and team of the Fastoosh motion design studio)',
    groups: [
      { title: 'Page header', fields: header('titleLine1', 'titleLine2') },
      { title: 'Our story', fields: [
        { key: 'story1', label: 'Paragraph 1', kind: 'multiline' },
        { key: 'story2', label: 'Paragraph 2', kind: 'multiline', hint: 'Wrap words in **double stars** to show them in white.' },
        { key: 'story3', label: 'Paragraph 3', kind: 'multiline' },
        { key: 'story4', label: 'Closing line (white)', kind: 'multiline' },
      ]},
      { title: 'Values', fields: [
        { key: 'valuesHeading', label: 'Section title', kind: 'text', ai: 'sectionHeading' },
        { key: 'values', label: 'Values (4 cards — icons stay the same)', kind: 'steps' },
      ]},
      { title: 'Section titles', fields: [
        { key: 'teamHeading',    label: 'Team section title', kind: 'text', ai: 'sectionHeading' },
        { key: 'clientsHeading', label: 'Clients section title', kind: 'text', ai: 'sectionHeading' },
      ]},
      { title: 'Call to action', fields: [
        { key: 'ctaHeading',  label: 'Heading', kind: 'text', ai: 'sectionHeading' },
        { key: 'ctaSubtitle', label: 'Text', kind: 'multiline' },
      ]},
    ],
    // story2 is stored as 7 pieces in the locale files; it is edited as one
    // paragraph with **bold** marks. Values use { title, description }.
    prepareDefaults: s => ({
      story2: [s.story2Pre, `**${s.story2Bold1 ?? ''}**`, s.story2Mid1, `**${s.story2Bold2 ?? ''}**`, s.story2Mid2, `**${s.story2Bold3 ?? ''}**`, s.story2Post].map(x => x ?? '').join(''),
      values: Array.isArray(s.values) ? s.values.map((v: any) => ({ title: v.title ?? '', body: v.description ?? v.body ?? '' })) : [],
    }),
  },

  projects: {
    id: 'projects', label: 'Projects page', path: '/projects',
    settingKey: 'projectsPageContent', localeSection: 'projects', cacheKey: 'projects_page_content_cache',
    aiAbout: 'the header and closing call to action of Fastoosh\'s "Projects" page (the portfolio of motion design and video work)',
    groups: [
      { title: 'Page header', fields: [...header('titlePart1', 'titlePart2'),
        { key: 'allFilter', label: '"All" filter button', kind: 'text', ai: 'processStepTitle' }] },
      { title: 'Call to action (bottom)', fields: [
        { key: 'ctaHeading',  label: 'Heading', kind: 'text', ai: 'sectionHeading' },
        { key: 'ctaSubtitle', label: 'Text', kind: 'multiline' },
      ]},
    ],
  },

  tools: {
    id: 'tools', label: 'Tools page', path: '/tools',
    settingKey: 'toolsPageContent', localeSection: 'tools', cacheKey: 'tools_page_content_cache',
    aiAbout: 'the header and closing call to action of Fastoosh\'s "Tools" page (After Effects scripts, plugins and automation tools for motion designers)',
    groups: [
      { title: 'Page header', fields: [
        { key: 'labBadge', label: 'Badge above the heading', kind: 'text', ai: 'processStepTitle' },
        ...header('titlePart1', 'titlePart2'),
        { key: 'getIt', label: 'Button on each tool card', kind: 'text', ai: 'processStepTitle' }] },
      { title: 'Custom tool request (bottom)', fields: [
        { key: 'customCtaHeading',  label: 'Heading', kind: 'text', ai: 'sectionHeading' },
        { key: 'customCtaSubtitle', label: 'Text', kind: 'multiline' },
        { key: 'customCtaBtn',      label: 'Button', kind: 'text', ai: 'processStepTitle' },
      ]},
    ],
  },
};

export const PAGE_LIST: PageConfig[] = [PAGES.workWithUs, PAGES.about, PAGES.projects, PAGES.tools];
export const pageFields = (p: PageConfig): PageField[] => p.groups.flatMap(g => g.fields);

export const baseLang = (lng?: string): PageLang => {
  const l = (lng || 'en').split('-')[0];
  return l === 'fr' || l === 'ar' ? l : 'en';
};

/** True when an override value is filled in (non-empty). */
export function hasValue(v: unknown): boolean {
  if (typeof v === 'string') return v.trim() !== '';
  if (Array.isArray(v)) return v.length > 0;
  return false;
}

export function readPageCache(p: PageConfig): PageOverrides {
  try { return JSON.parse(localStorage.getItem(p.cacheKey) || '{}') || {}; } catch { return {}; }
}
export function writePageCache(p: PageConfig, o: PageOverrides) {
  try { localStorage.setItem(p.cacheKey, JSON.stringify(o || {})); } catch { /* ignore */ }
}

/**
 * For public pages: returns `pt(key)` = the admin's edit for the current
 * language, else undefined (callers then use their built-in text).
 */
export function usePageOverrides(id: PageId) {
  const page = PAGES[id];
  const { i18n } = useTranslation();
  const [ov, setOv] = useState<PageOverrides>(() => readPageCache(page));
  useEffect(() => {
    let alive = true;
    api.getSettings().then((res: any) => {
      if (!alive || !res?.success) return;
      const o = res.data?.[page.settingKey];
      const next = o && typeof o === 'object' ? o : {};
      setOv(next);
      writePageCache(page, next);
    }).catch(() => {});
    return () => { alive = false; };
  }, [page]);
  const lang = baseLang(i18n.language);
  const pt = (key: string): any => {
    const v = ov?.[lang]?.[key];
    return hasValue(v) ? v : undefined;
  };
  return { pt, overrides: ov, lang };
}

/** Splits "a **b** c" into text / bold parts. */
export function splitBold(text: string): { text: string; bold: boolean }[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map(part =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4
      ? { text: part.slice(2, -2), bold: true }
      : { text: part, bold: false });
}

/** Flattens a language's values into "key" / "key.0.title" strings (for AI translation). */
export function flattenForTranslation(values: Record<string, PageValue>): Record<string, string> {
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
export function unflattenTranslation(template: Record<string, PageValue>, flat: Record<string, string>): Record<string, PageValue> {
  const out: Record<string, PageValue> = {};
  for (const [k, v] of Object.entries(template)) {
    if (typeof v === 'string') out[k] = flat[k] ?? v;
    else if (Array.isArray(v)) out[k] = v.map((item, i) => typeof item === 'string'
      ? (flat[`${k}.${i}`] ?? item)
      : { title: flat[`${k}.${i}.title`] ?? item.title, body: flat[`${k}.${i}.body`] ?? item.body }) as PageValue;
  }
  return out;
}
