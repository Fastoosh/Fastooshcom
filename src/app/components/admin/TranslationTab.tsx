import { useState, useEffect, useCallback, useMemo } from 'react';
import { GlassCard } from '../shared/GlassCard';
import { Button } from '../ui/button';
import {
  Sparkles, Save, CheckCircle2, AlertCircle, Loader2,
  Globe, RefreshCw, ChevronDown, ChevronRight, Languages,
} from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { bustTranslationCache } from '../../utils/translations';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

type Lang = 'fr' | 'ar';
type ContentType = 'home' | 'projects' | 'tools' | 'team' | 'categories';

const LANG_CONFIG: Record<Lang, { label: string; name: string; flag: string }> = {
  fr: { label: 'FR', name: 'French',  flag: '🇫🇷' },
  ar: { label: 'AR', name: 'Arabic',  flag: '🇸🇦' },
};

const CONTENT_TYPES: { key: ContentType; label: string }[] = [
  { key: 'home',       label: 'Home Content' },
  { key: 'projects',   label: 'Projects'     },
  { key: 'tools',      label: 'Tools'        },
  { key: 'team',       label: 'Team'         },
  { key: 'categories', label: 'Categories'   },
];

// ─── Flat row ──────────────────────────────────────────────────────────────
interface FlatField {
  key: string;        // unique dotted path used as translation key
  label: string;      // human label for the table
  section: string;    // collapsible group header
  enValue: string;    // English source
  multiline: boolean;
}

// ─── Flatten helpers ───────────────────────────────────────────────────────

// ─── Translatable-field guards ─────────────────────────────────────────────

/** Exact key names that are never human-readable text. */
const SKIP_KEYS = new Set([
  'id', '_id', 'slug', 'key', 'hash', 'token',
  'url', 'href', 'src', 'link', 'path', 'route',
  'order', 'index', 'position', 'sort', 'rank',
  'createdAt', 'updatedAt', 'deletedAt', 'publishedAt',
]);

/** Key suffixes that signal IDs or URLs regardless of prefix. */
const SKIP_SUFFIXES = [
  'Id', 'Url', 'URL', 'Href', 'Src', 'Link',
  'Path', 'Slug', 'Hash', 'Token', 'Key',
];

/** Returns false for keys that represent IDs, URLs or technical metadata. */
function isTranslatableKey(key: string): boolean {
  if (SKIP_KEYS.has(key)) return false;
  if (SKIP_SUFFIXES.some(s => key.endsWith(s))) return false;
  return true;
}

/** Returns false for string values that are obviously not human-readable text. */
function isTranslatableValue(val: string): boolean {
  if (!val.trim()) return false;
  // URLs
  if (/^https?:\/\//i.test(val)) return false;
  // UUIDs
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val)) return false;
  // Pure numbers / semver
  if (/^\d+(\.\d+)*$/.test(val)) return false;
  return true;
}

function flattenHome(src: Record<string, any>): FlatField[] {
  const rows: FlatField[] = [];
  const add = (key: string, label: string, section: string, multiline = false) => {
    const val = key.split('.').reduce((o, k) => o?.[k], src);
    if (typeof val === 'string' && isTranslatableKey(key) && isTranslatableValue(val)) rows.push({ key, label, section, enValue: val, multiline });
  };

  add('heroLine1',          'Title Line 1',       'Hero');
  add('heroLine2',          'Title Line 2',       'Hero');
  add('heroSubtitle',       'Subtitle',           'Hero', true);
  add('heroCta1Text',       'Primary CTA',        'Hero');
  add('heroCta2Text',       'Secondary CTA',      'Hero');
  add('testimonialQuote',   'Quote',              'Testimonial', true);
  add('testimonialAuthor',  'Author',             'Testimonial');
  add('testimonialRole',    'Role / Company',     'Testimonial');
  add('featuredHeading',    'Heading',            'Featured Projects');
  add('featuredSubtitle',   'Subtitle',           'Featured Projects', true);
  add('capabilitiesHeading','Heading',            'Capabilities');
  (src.capabilities ?? []).forEach((_: any, i: number) => {
    add(`capabilities.${i}.title`,       `Capability ${i + 1} Title`,       'Capabilities');
    add(`capabilities.${i}.description`, `Capability ${i + 1} Description`, 'Capabilities', true);
  });
  add('processHeading',     'Heading',            'Process');
  add('processSubtitle',    'Subtitle',           'Process', true);
  (src.processSteps ?? []).forEach((_: any, i: number) => {
    add(`processSteps.${i}.title`,       `Step ${i + 1} Title`,       'Process');
    add(`processSteps.${i}.description`, `Step ${i + 1} Description`, 'Process', true);
  });
  add('deliverablesTitle',  'Section Title',      'Deliverables');
  (src.deliverables ?? []).forEach((_: any, i: number) => {
    add(`deliverables.${i}`, `Deliverable ${i + 1}`, 'Deliverables');
  });
  (src.turnaroundRows ?? []).forEach((_: any, i: number) => {
    add(`turnaroundRows.${i}.label`, `Row ${i + 1} Label`, 'Turnaround');
    add(`turnaroundRows.${i}.time`,  `Row ${i + 1} Time`,  'Turnaround');
  });
  add('turnaroundNote',     'Footer Note',        'Turnaround', true);
  add('ctaHeading',         'Heading',            'CTA');
  add('ctaHeadingGradient', 'Gradient Text',      'CTA');
  add('ctaSubtitle',        'Subtitle',           'CTA', true);
  (src.ctaBadges ?? []).forEach((_: any, i: number) => {
    add(`ctaBadges.${i}`, `Badge ${i + 1}`, 'CTA');
  });
  return rows;
}

function flattenCategories(src: {
  projectCategories: string[];
  toolCategories: string[];
  toolStatuses: string[];
}): FlatField[] {
  const rows: FlatField[] = [];

  (src.projectCategories || []).forEach((cat) => {
    if (typeof cat !== 'string') return;
    rows.push({
      key: `projectCategories.${cat}`,
      label: cat,
      section: 'Project Categories',
      enValue: cat,
      multiline: false,
    });
  });

  (src.toolCategories || []).forEach((cat) => {
    if (typeof cat !== 'string') return;
    rows.push({
      key: `toolCategories.${cat}`,
      label: cat,
      section: 'Tool Categories',
      enValue: cat,
      multiline: false,
    });
  });

  (src.toolStatuses || []).forEach((label) => {
    if (typeof label !== 'string') return;
    rows.push({
      key: `toolStatuses.${label}`,
      label,
      section: 'Tool Statuses',
      enValue: label,
      multiline: false,
    });
  });

  return rows;
}

function flattenItems(
  items: any[],
  fields: { key: string; label: string; multiline?: boolean }[],
  idKey = 'id',
  titleKey = 'name',
): FlatField[] {
  const rows: FlatField[] = [];
  for (const item of items) {
    const section = item[titleKey] || item.title || item.name || item.id;
    for (const f of fields) {
      const keys = f.key.split('.');
      let val: any = item;
      
      // Navigate nested keys
      for (const k of keys) {
        if (val == null) break;
        val = val[k];
      }
      
      // Handle arrays
      if (Array.isArray(val)) {
        val.forEach((arrItem: any, i: number) => {
          if (typeof arrItem === 'string') {
            // Simple string array — skip non-translatable values
            if (!isTranslatableValue(arrItem)) return;
            rows.push({
              key: `${item[idKey]}.${f.key}.${i}`,
              label: `${f.label} ${i + 1}`,
              section,
              enValue: arrItem,
              multiline: f.multiline ?? false,
            });
          } else if (typeof arrItem === 'object' && arrItem !== null) {
            // Array of objects - flatten each field, skipping IDs/URLs
            for (const [subKey, subVal] of Object.entries(arrItem)) {
              if (!isTranslatableKey(subKey)) continue;
              if (typeof subVal === 'string') {
                if (!isTranslatableValue(subVal)) continue;
                rows.push({
                  key: `${item[idKey]}.${f.key}.${i}.${subKey}`,
                  label: `${f.label} ${i + 1} - ${subKey}`,
                  section,
                  enValue: subVal,
                  multiline: subKey === 'description' || subKey === 'answer' || subKey === 'bio',
                });
              } else if (Array.isArray(subVal)) {
                // Handle nested arrays (e.g., versions[0].features[])
                subVal.forEach((nestedItem: any, j: number) => {
                  if (typeof nestedItem === 'string') {
                    if (!isTranslatableValue(nestedItem)) return;
                    rows.push({
                      key: `${item[idKey]}.${f.key}.${i}.${subKey}.${j}`,
                      label: `${f.label} ${i + 1} - ${subKey} ${j + 1}`,
                      section,
                      enValue: nestedItem,
                      multiline: false,
                    });
                  } else if (typeof nestedItem === 'object' && nestedItem !== null) {
                    // Handle array of objects (e.g., richFeatures[])
                    for (const [nestedKey, nestedVal] of Object.entries(nestedItem)) {
                      if (!isTranslatableKey(nestedKey)) continue;
                      if (typeof nestedVal === 'string') {
                        if (!isTranslatableValue(nestedVal)) continue;
                        rows.push({
                          key: `${item[idKey]}.${f.key}.${i}.${subKey}.${j}.${nestedKey}`,
                          label: `${f.label} ${i + 1} - ${subKey} ${j + 1} - ${nestedKey}`,
                          section,
                          enValue: nestedVal,
                          multiline: nestedKey === 'description' || nestedKey === 'title',
                        });
                      }
                    }
                  }
                });
              }
            }
          }
        });
      } else if (typeof val === 'string') {
        if (!isTranslatableKey(f.key) || !isTranslatableValue(val)) continue;
        rows.push({
          key: `${item[idKey]}.${f.key}`,
          label: f.label,
          section,
          enValue: val,
          multiline: f.multiline ?? false,
        });
      }
    }
  }
  return rows;
}

const PROJECT_FIELDS = [
  { key: 'title',        label: 'Title'        },
  { key: 'description',  label: 'Description',  multiline: true },
  { key: 'category',     label: 'Category'     },
  { key: 'client',       label: 'Client'       },
  { key: 'year',         label: 'Year'         },
  { key: 'goal',         label: 'Goal',         multiline: true },
  { key: 'approach',     label: 'Approach',     multiline: true },
  { key: 'outcome',      label: 'Outcome',      multiline: true },
  { key: 'deliverables', label: 'Deliverable',  multiline: false },
];
const TOOL_FIELDS = [
  { key: 'name',              label: 'Name'               },
  { key: 'tagline',           label: 'Tagline',           multiline: true },
  { key: 'description',       label: 'Description',       multiline: true },
  { key: 'systemRequirements',label: 'System Requirements', multiline: true },
  { key: 'features',          label: 'Feature',           multiline: false },
  { key: 'useCases',          label: 'Use Case',          multiline: false },
  { key: 'specifications',    label: 'Specification',     multiline: false },
  { key: 'howItWorks',        label: 'How It Works',      multiline: false },
  { key: 'faqs',              label: 'FAQ',               multiline: false },
  { key: 'versions',          label: 'Version',           multiline: false },
];
const TEAM_FIELDS = [
  { key: 'role', label: 'Role' },
  { key: 'bio',  label: 'Bio', multiline: true },
];

// ─── Unflatten: flat translations → nested object to save in KV ─────────────
function unflattenHome(flat: Record<string, string>, src: Record<string, any>): Record<string, any> {
  const r: Record<string, any> = {};
  const sc = (k: string) => { if (flat[k]?.trim()) r[k] = flat[k]; };
  ['heroLine1','heroLine2','heroSubtitle','heroCta1Text','heroCta2Text',
   'testimonialQuote','testimonialAuthor','testimonialRole',
   'featuredHeading','featuredSubtitle','capabilitiesHeading',
   'processHeading','processSubtitle','deliverablesTitle','turnaroundNote',
   'ctaHeading','ctaHeadingGradient','ctaSubtitle'].forEach(sc);
  if (src.capabilities?.length) {
    r.capabilities = src.capabilities.map((_: any, i: number) => ({
      title: flat[`capabilities.${i}.title`] ?? '',
      description: flat[`capabilities.${i}.description`] ?? '',
    }));
  }
  if (src.processSteps?.length) {
    r.processSteps = src.processSteps.map((_: any, i: number) => ({
      title: flat[`processSteps.${i}.title`] ?? '',
      description: flat[`processSteps.${i}.description`] ?? '',
    }));
  }
  if (src.deliverables?.length) {
    r.deliverables = src.deliverables.map((_: any, i: number) => flat[`deliverables.${i}`] ?? '');
  }
  if (src.turnaroundRows?.length) {
    r.turnaroundRows = src.turnaroundRows.map((_: any, i: number) => ({
      label: flat[`turnaroundRows.${i}.label`] ?? '',
      time:  flat[`turnaroundRows.${i}.time`]  ?? '',
    }));
  }
  if (src.ctaBadges?.length) {
    r.ctaBadges = src.ctaBadges.map((_: any, i: number) => flat[`ctaBadges.${i}`] ?? '');
  }
  return r;
}

function unflattenItems(flat: Record<string, string>): Record<string, any> {
  const result: Record<string, any> = {};
  
  for (const [dotKey, val] of Object.entries(flat)) {
    const parts = dotKey.split('.');
    if (parts.length < 2) continue;
    
    const id = parts[0];
    const rest = parts.slice(1);
    
    if (!result[id]) result[id] = {};
    
    // Navigate/create the nested structure
    let current: any = result[id];
    for (let i = 0; i < rest.length - 1; i++) {
      const key = rest[i];
      const nextKey = rest[i + 1];
      
      // If next key is a number, current should be an array
      if (!isNaN(Number(nextKey))) {
        if (!current[key]) current[key] = [];
        const idx = Number(nextKey);
        // If there's more after the index, it's an array of objects
        if (i + 2 < rest.length) {
          if (!current[key][idx]) current[key][idx] = {};
          current = current[key][idx];
          i++; // Skip the index
        } else {
          // It's an array of strings
          current = current[key];
          i++; // Skip the index
        }
      } else {
        if (!current[key]) current[key] = {};
        current = current[key];
      }
    }
    
    // Set the final value
    const lastKey = rest[rest.length - 1];
    if (!isNaN(Number(lastKey))) {
      // Setting an array element
      const idx = Number(lastKey);
      current[idx] = val;
    } else {
      current[lastKey] = val;
    }
  }
  
  return result;
}

function unflattenCategories(flat: Record<string, string>): Record<string, any> {
  // Produce a structured object with three namespaced sub-maps
  const result: Record<string, Record<string, string>> = {
    projectCategories: {},
    toolCategories: {},
    toolStatuses: {},
  };
  for (const [key, val] of Object.entries(flat)) {
    if (!val?.trim()) continue;
    if (key.startsWith('projectCategories.')) {
      result.projectCategories[key.slice('projectCategories.'.length)] = val;
    } else if (key.startsWith('toolCategories.')) {
      result.toolCategories[key.slice('toolCategories.'.length)] = val;
    } else if (key.startsWith('toolStatuses.')) {
      result.toolStatuses[key.slice('toolStatuses.'.length)] = val;
    } else {
      // Backward compat: old flat format keys (no namespace prefix)
      result.projectCategories[key] = val;
    }
  }
  return result;
}

// ─── Flatten stored nested translations → flat for the editor ───────────────
function flattenStoredHome(stored: Record<string, any>): Record<string, string> {
  const r: Record<string, string> = {};
  const put = (k: string) => { if (typeof stored[k] === 'string') r[k] = stored[k]; };
  ['heroLine1','heroLine2','heroSubtitle','heroCta1Text','heroCta2Text',
   'testimonialQuote','testimonialAuthor','testimonialRole',
   'featuredHeading','featuredSubtitle','capabilitiesHeading',
   'processHeading','processSubtitle','deliverablesTitle','turnaroundNote',
   'ctaHeading','ctaHeadingGradient','ctaSubtitle'].forEach(put);
  (stored.capabilities ?? []).forEach((c: any, i: number) => {
    r[`capabilities.${i}.title`]       = c.title ?? '';
    r[`capabilities.${i}.description`] = c.description ?? '';
  });
  (stored.processSteps ?? []).forEach((s: any, i: number) => {
    r[`processSteps.${i}.title`]       = s.title ?? '';
    r[`processSteps.${i}.description`] = s.description ?? '';
  });
  (stored.deliverables ?? []).forEach((d: string, i: number) => { r[`deliverables.${i}`] = d; });
  (stored.turnaroundRows ?? []).forEach((row: any, i: number) => {
    r[`turnaroundRows.${i}.label`] = row.label ?? '';
    r[`turnaroundRows.${i}.time`]  = row.time  ?? '';
  });
  (stored.ctaBadges ?? []).forEach((b: string, i: number) => { r[`ctaBadges.${i}`] = b; });
  return r;
}

function flattenStoredItems(stored: Record<string, any>): Record<string, string> {
  const r: Record<string, string> = {};

  /**
   * Fully recursive: mirrors every path that flattenItems + unflattenItems can produce.
   * Handles:
   *   string          → r[prefix] = value
   *   string[]        → r[prefix.i] = item
   *   object[]        → recurse into each property (including nested arrays/objects)
   *   plain object    → recurse into each property
   */
  const flattenValue = (prefix: string, value: any) => {
    if (typeof value === 'string') {
      r[prefix] = value;
    } else if (Array.isArray(value)) {
      value.forEach((item, i) => {
        if (typeof item === 'string') {
          r[`${prefix}.${i}`] = item;
        } else if (typeof item === 'object' && item !== null) {
          // Recurse into every property — handles versions[0].features[], richFeatures[], etc.
          for (const [key, val] of Object.entries(item)) {
            flattenValue(`${prefix}.${i}.${key}`, val);
          }
        }
      });
    } else if (typeof value === 'object' && value !== null) {
      for (const [key, val] of Object.entries(value)) {
        flattenValue(`${prefix}.${key}`, val);
      }
    }
  };

  for (const [id, fields] of Object.entries(stored)) {
    if (typeof fields === 'object' && fields !== null) {
      for (const [field, val] of Object.entries(fields as Record<string, any>)) {
        flattenValue(`${id}.${field}`, val);
      }
    }
  }

  return r;
}

function flattenStoredCategories(stored: Record<string, any>): Record<string, string> {
  const r: Record<string, string> = {};
  // New structured format: { projectCategories: {...}, toolCategories: {...}, toolStatuses: {...} }
  if (stored.projectCategories || stored.toolCategories || stored.toolStatuses) {
    for (const [k, v] of Object.entries(stored.projectCategories || {})) {
      if (typeof v === 'string') r[`projectCategories.${k}`] = v;
    }
    for (const [k, v] of Object.entries(stored.toolCategories || {})) {
      if (typeof v === 'string') r[`toolCategories.${k}`] = v;
    }
    for (const [k, v] of Object.entries(stored.toolStatuses || {})) {
      if (typeof v === 'string') r[`toolStatuses.${k}`] = v;
    }
  } else {
    // Backward compat: old flat format — treat everything as projectCategories
    for (const [k, v] of Object.entries(stored)) {
      if (typeof v === 'string') r[`projectCategories.${k}`] = v;
    }
  }
  return r;
}

// ─── Main component ────────────────────────────────────────────────────────
export function TranslationTab() {
  const [lang,        setLang]        = useState<Lang>('fr');
  const [contentType, setContentType] = useState<ContentType>('home');
  const [sourceData,  setSourceData]  = useState<any>(null);
  const [flatTrans,   setFlatTrans]   = useState<Record<string, string>>({});
  const [loading,     setLoading]     = useState(false);
  const [isTranslating, setIsTranslating] = useState(false);
  const [isSaving,    setIsSaving]    = useState(false);
  const [status,      setStatus]      = useState<{ type: 'success' | 'error' | 'loading' | null; msg: string }>({ type: null, msg: '' });
  const [collapsed,   setCollapsed]   = useState<Record<string, boolean>>({});

  const token = localStorage.getItem('admin_token') || '';
  const authHeaders = {
    Authorization: `Bearer ${publicAnonKey}`,
    'X-Admin-Token': token,
    'Content-Type': 'application/json',
  };

  // ── Load source + existing translations ───────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setSourceData(null);   // ← reset stale data immediately so useMemo doesn't mix content types
    setStatus({ type: null, msg: '' });
    try {
      // 1. Fetch English source
      let srcRes: Response;
      if (contentType === 'home') {
        srcRes = await fetch(`${API_BASE}/home-content`, { headers: { Authorization: `Bearer ${publicAnonKey}` } });
      } else if (contentType === 'projects') {
        srcRes = await fetch(`${API_BASE}/projects`, { headers: { Authorization: `Bearer ${publicAnonKey}` } });
      } else if (contentType === 'tools') {
        srcRes = await fetch(`${API_BASE}/tools`, { headers: { Authorization: `Bearer ${publicAnonKey}` } });
      } else if (contentType === 'categories') {
        srcRes = await fetch(`${API_BASE}/settings`, { headers: { Authorization: `Bearer ${publicAnonKey}` } });
      } else {
        srcRes = await fetch(`${API_BASE}/team`, { headers: { Authorization: `Bearer ${publicAnonKey}` } });
      }
      const srcJson = await srcRes.json();
      // Ensure arrays are always arrays, not null/undefined/objects
      let src: any;
      if (contentType === 'home') {
        src = srcJson.success ? srcJson.data : {};
      } else if (contentType === 'categories') {
        // Extract categories from settings
        const settingsData = srcJson.success ? srcJson.data : {};
        src = {
          projectCategories: settingsData.projectCategories || [],
          toolCategories: settingsData.toolCategories || [],
          // toolStatuses is [{label, color}] — extract just the labels
          toolStatuses: (settingsData.toolStatuses || []).map((s: any) => (typeof s === 'string' ? s : s.label)).filter(Boolean),
        };
      } else {
        // For projects, tools, team - ensure it's always an array
        const rawData = srcJson.success ? srcJson.data : null;
        src = Array.isArray(rawData) ? rawData : [];
      }
      setSourceData(src);

      // 2. Fetch stored translations
      const transRes  = await fetch(`${API_BASE}/translations/${lang}/${contentType}`, { headers: { Authorization: `Bearer ${publicAnonKey}` } });
      const transJson = await transRes.json();
      const stored    = (transJson.success && transJson.data) ? transJson.data : {};

      // 3. Flatten stored into flat state
      const flat = contentType === 'home'
        ? flattenStoredHome(stored)
        : contentType === 'categories'
          ? flattenStoredCategories(stored)
          : flattenStoredItems(stored);
      setFlatTrans(flat);
    } catch (err) {
      console.error('[TranslationTab] loadData error:', err);
      setStatus({ type: 'error', msg: `Failed to load data: ${String(err)}` });
    }
    setLoading(false);
  }, [lang, contentType]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Flat field list (memoised) ────────────────────────────────────────���────
  const fields = useMemo<FlatField[]>(() => {
    if (!sourceData) return [];
    if (contentType === 'home')       return flattenHome(sourceData);
    if (contentType === 'categories') return flattenCategories(sourceData);
    // Ensure sourceData is an array before passing to flattenItems
    const itemsArray = Array.isArray(sourceData) ? sourceData : [];
    if (contentType === 'projects') return flattenItems(itemsArray, PROJECT_FIELDS, 'id', 'title');
    if (contentType === 'tools')    return flattenItems(itemsArray, TOOL_FIELDS,    'id', 'name');
    return flattenItems(itemsArray, TEAM_FIELDS, 'id', 'name');
  }, [sourceData, contentType]);

  // ── Coverage ───────────────────────────────────────────────────────────────
  const { translated, total } = useMemo(() => {
    const total      = fields.length;
    const translated = fields.filter(f => flatTrans[f.key]?.trim()).length;
    return { translated, total };
  }, [fields, flatTrans]);

  const coveragePct = total ? Math.round((translated / total) * 100) : 0;

  // ── Group fields by section ────────────────────────────────────────────────
  const grouped = useMemo(() => {
    const map: Record<string, FlatField[]> = {};
    for (const f of fields) {
      if (!map[f.section]) map[f.section] = [];
      map[f.section].push(f);
    }
    return map;
  }, [fields]);

  // ── Auto-translate ─────────────────────────────────────────────────────────
  const handleTranslate = async (missingOnly: boolean) => {
    const toTranslate: Record<string, string> = {};
    for (const f of fields) {
      if (!f.enValue.trim()) continue;
      if (missingOnly && flatTrans[f.key]?.trim()) continue;
      toTranslate[f.key] = f.enValue;
    }
    if (Object.keys(toTranslate).length === 0) {
      setStatus({ type: 'success', msg: 'Nothing to translate — all fields are already done.' });
      return;
    }
    
    setIsTranslating(true);
    setStatus({ type: null, msg: '' });
    
    try {
      // Split into batches to avoid JSON parsing errors with large payloads
      const entries = Object.entries(toTranslate);
      const BATCH_SIZE = 40; // Smaller batches to reduce API load
      const DELAY_MS = 5000; // 5 second delay between batches to respect rate limits (15 RPM = 1 per 4 seconds)
      const batches: Record<string, string>[] = [];
      
      for (let i = 0; i < entries.length; i += BATCH_SIZE) {
        const batch = Object.fromEntries(entries.slice(i, i + BATCH_SIZE));
        batches.push(batch);
      }
      
      console.log(`[Translation] Splitting ${entries.length} fields into ${batches.length} batches (${DELAY_MS/1000}s delay between batches)`);
      
      let allTranslated: Record<string, string> = {};
      let completedBatches = 0;
      
      // Process batches sequentially with delays to respect rate limits
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        
        // Add delay before each batch (except the first one)
        if (i > 0) {
          setStatus({ 
            type: null, 
            msg: `⏳ Waiting ${DELAY_MS/1000}s to respect API rate limits... (${completedBatches}/${batches.length} batches done)` 
          });
          await new Promise(resolve => setTimeout(resolve, DELAY_MS));
        }
        
        setStatus({ 
          type: null, 
          msg: `🔄 Translating batch ${i + 1}/${batches.length}... (${Object.keys(allTranslated).length}/${entries.length} fields done)` 
        });
        
        const res = await fetch(`${API_BASE}/admin/translate`, {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ lang, langName: LANG_CONFIG[lang].name, fields: batch }),
        });
        const json = await res.json();
        
        if (!json.success) {
          // Check for quota errors
          if (json.error?.includes('429') || json.error?.includes('quota') || json.error?.includes('rate limit')) {
            const errorMsg = `⚠️ API Quota Exceeded (batch ${i + 1}/${batches.length})\n\n` +
              `You've hit Gemini's free tier limit (15 requests/minute or 1,500/day).\n\n` +
              `✅ ${completedBatches} batches completed (${Object.keys(allTranslated).length} fields translated)\n` +
              `❌ ${batches.length - completedBatches} batches remaining\n\n` +
              `Solutions:\n` +
              `1. Wait a few minutes and click "Save Translations" to keep your progress, then try again\n` +
              `2. If daily limit: Wait until midnight Pacific Time\n` +
              `3. Upgrade to paid tier at https://aistudio.google.com/ (~$0.10/1M tokens)`;
            
            // Save what we have so far
            if (Object.keys(allTranslated).length > 0) {
              setFlatTrans(prev => ({ ...prev, ...allTranslated }));
            }
            
            throw new Error(errorMsg);
          }
          throw new Error(json.error || 'Translation failed');
        }
        
        allTranslated = { ...allTranslated, ...json.data };
        completedBatches++;
      }
      
      setFlatTrans(prev => ({ ...prev, ...allTranslated }));
      setStatus({ type: 'success', msg: `✓ ${Object.keys(allTranslated).length} fields translated by AI in ${batches.length} batch${batches.length > 1 ? 'es' : ''}.` });
    } catch (err) {
      console.error('[Translation] Error:', err);
      setStatus({ type: 'error', msg: `${String(err)}` });
    }
    
    setIsTranslating(false);
  };

  // ── Save ───────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setIsSaving(true);
    setStatus({ type: null, msg: '' });
    try {
      const nested = contentType === 'home'
        ? unflattenHome(flatTrans, sourceData)
        : contentType === 'categories'
          ? unflattenCategories(flatTrans)
          : unflattenItems(flatTrans);
      const res  = await fetch(`${API_BASE}/translations/${lang}/${contentType}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify(nested),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error || 'Save failed');
      bustTranslationCache(lang, contentType);
      setStatus({ type: 'success', msg: `✓ ${LANG_CONFIG[lang].name} ${contentType} translations saved.` });
    } catch (err) {
      setStatus({ type: 'error', msg: `Save error: ${String(err)}` });
    }
    setIsSaving(false);
  };

  const toggleSection = (s: string) =>
    setCollapsed(prev => ({ ...prev, [s]: !prev[s] }));

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">

      {/* Header */}
      <GlassCard className="p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
            <Languages className="w-5 h-5 text-purple-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Content Translations</h2>
            <p className="text-gray-400 text-sm">AI-powered. Admin UI stays English — only public-facing content is translated.</p>
          </div>
        </div>

        {/* Language selector */}
        <div className="flex flex-wrap gap-4 mb-5">
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm font-medium w-20">Language:</span>
            <div className="flex gap-2">
              {Object.entries(LANG_CONFIG).map(([code, cfg]) => (
                <button
                  key={code}
                  onClick={() => setLang(code as Lang)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-semibold border transition-all ${
                    lang === code
                      ? 'bg-purple-600 border-purple-500 text-white'
                      : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {cfg.flag} {cfg.label} — {cfg.name}
                </button>
              ))}
            </div>
          </div>

          {/* Content type */}
          <div className="flex items-center gap-2">
            <span className="text-gray-400 text-sm font-medium w-20">Content:</span>
            <div className="flex gap-1.5">
              {CONTENT_TYPES.map(ct => (
                <button
                  key={ct.key}
                  onClick={() => setContentType(ct.key)}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-all ${
                    contentType === ct.key
                      ? 'bg-blue-600/40 border-blue-500/60 text-blue-200'
                      : 'bg-white/5 border-white/10 text-white/50 hover:text-white hover:bg-white/10'
                  }`}
                >
                  {ct.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Coverage + actions row */}
        <div className="flex flex-wrap items-center gap-4">
          {/* Coverage bar */}
          <div className="flex-1 min-w-40">
            <div className="flex justify-between text-xs text-gray-400 mb-1">
              <span>Coverage</span>
              <span className={coveragePct === 100 ? 'text-green-400' : coveragePct >= 60 ? 'text-yellow-400' : 'text-red-400'}>
                {translated} / {total} fields ({coveragePct}%)
              </span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  coveragePct === 100 ? 'bg-green-500' : coveragePct >= 60 ? 'bg-yellow-500' : 'bg-purple-500'
                }`}
                style={{ width: `${coveragePct}%` }}
              />
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2 flex-wrap">
            <Button
              onClick={() => handleTranslate(true)}
              disabled={isTranslating || loading}
              className="bg-purple-600/20 border border-purple-500/40 hover:bg-purple-600/30 text-purple-200 text-sm"
              variant="outline"
            >
              {isTranslating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
              Translate Missing
            </Button>
            <Button
              onClick={() => handleTranslate(false)}
              disabled={isTranslating || loading}
              className="bg-violet-600/20 border border-violet-500/40 hover:bg-violet-600/30 text-violet-200 text-sm"
              variant="outline"
            >
              {isTranslating ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5 mr-1.5" />}
              Translate All
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving || loading}
              className="bg-green-600/20 border border-green-500/40 hover:bg-green-600/30 text-green-200 text-sm"
              variant="outline"
            >
              {isSaving ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
              Save Translations
            </Button>
          </div>
        </div>

        {/* Status message */}
        {status.msg && (
          <div className={`mt-4 flex items-start gap-2 px-4 py-2.5 rounded-lg text-sm ${
            status.type === 'success'
              ? 'bg-green-500/10 border border-green-500/20 text-green-300'
              : status.type === 'error'
              ? 'bg-red-500/10 border border-red-500/20 text-red-300'
              : 'bg-blue-500/10 border border-blue-500/20 text-blue-300'
          }`}>
            {status.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
            ) : status.type === 'error' ? (
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            ) : (
              <Loader2 className="w-4 h-4 flex-shrink-0 mt-0.5 animate-spin" />
            )}
            <div className="whitespace-pre-line">{status.msg}</div>
          </div>
        )}
      </GlassCard>

      {/* Translation table */}
      {loading ? (
        <GlassCard className="p-12 text-center text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-purple-400" />
          Loading content...
        </GlassCard>
      ) : fields.length === 0 ? (
        <GlassCard className="p-12 text-center text-gray-400">
          No translatable content found. Add some {contentType} first.
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {/* Column headers */}
          <div className="grid grid-cols-[1fr_1fr_1fr] gap-3 px-4 text-xs text-gray-500 font-medium uppercase tracking-wider">
            <span>Field</span>
            <span>🇬🇧 English (source)</span>
            <span>{LANG_CONFIG[lang].flag} {LANG_CONFIG[lang].name}</span>
          </div>

          {Object.entries(grouped).map(([section, sectionFields]) => {
            const sectionTranslated = sectionFields.filter(f => flatTrans[f.key]?.trim()).length;
            const isOpen = !collapsed[section];
            return (
              <GlassCard key={section} className="overflow-hidden">
                {/* Section header */}
                <button
                  onClick={() => toggleSection(section)}
                  className="w-full flex items-center justify-between px-5 py-3 border-b border-white/5 hover:bg-white/3 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {isOpen ? <ChevronDown className="w-4 h-4 text-white/40" /> : <ChevronRight className="w-4 h-4 text-white/40" />}
                    <span className="text-white font-semibold text-sm">{section}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      sectionTranslated === sectionFields.length
                        ? 'bg-green-500/20 text-green-400'
                        : sectionTranslated > 0
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'bg-white/10 text-white/30'
                    }`}>
                      {sectionTranslated}/{sectionFields.length}
                    </span>
                  </div>
                  <Globe className="w-3.5 h-3.5 text-white/20" />
                </button>

                {/* Rows */}
                {isOpen && sectionFields.map((field, idx) => {
                  const hasTranslation = !!flatTrans[field.key]?.trim();
                  return (
                    <div
                      key={field.key}
                      className={`grid grid-cols-[1fr_1fr_1fr] gap-0 ${idx < sectionFields.length - 1 ? 'border-b border-white/5' : ''}`}
                    >
                      {/* Field label */}
                      <div className="px-5 py-3 flex items-start gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full mt-2 flex-shrink-0 ${hasTranslation ? 'bg-green-400' : 'bg-white/15'}`} />
                        <span className="text-white/70 text-sm">{field.label}</span>
                      </div>

                      {/* English source */}
                      <div className="px-4 py-3 border-l border-white/5">
                        <p className="text-white/40 text-sm leading-relaxed line-clamp-3">
                          {field.enValue || <span className="italic text-white/20">empty</span>}
                        </p>
                      </div>

                      {/* Translation input */}
                      <div className="px-4 py-2 border-l border-white/5">
                        {field.multiline ? (
                          <textarea
                            value={flatTrans[field.key] ?? ''}
                            onChange={e => setFlatTrans(prev => ({ ...prev, [field.key]: e.target.value }))}
                            rows={3}
                            placeholder={`${LANG_CONFIG[lang].name} translation...`}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-none"
                          />
                        ) : (
                          <input
                            type="text"
                            value={flatTrans[field.key] ?? ''}
                            onChange={e => setFlatTrans(prev => ({ ...prev, [field.key]: e.target.value }))}
                            placeholder={`${LANG_CONFIG[lang].name} translation...`}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/20 focus:outline-none focus:ring-1 focus:ring-purple-500"
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}