import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

// ─── Session cache to avoid re-fetching ─────────────────────────────────────
const memCache: Record<string, any> = {};

export async function fetchTranslations(lang: string, type: string): Promise<Record<string, any>> {
  if (lang === 'en') return {};
  const cacheKey = `trans:${lang}:${type}`;
  if (memCache[cacheKey]) return memCache[cacheKey];

  try {
    // Also check sessionStorage
    const sc = sessionStorage.getItem(cacheKey);
    if (sc) {
      const parsed = JSON.parse(sc);
      memCache[cacheKey] = parsed;
      return parsed;
    }
  } catch { /* ignore */ }

  try {
    const res  = await fetch(`${API_BASE}/translations/${lang}/${type}`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` },
    });
    const data = await res.json();
    if (data.success && data.data) {
      memCache[cacheKey] = data.data;
      try { sessionStorage.setItem(cacheKey, JSON.stringify(data.data)); } catch { /* ignore */ }
      return data.data;
    }
  } catch (err) {
    console.warn(`[translations] Failed to load ${lang}:${type}`, err);
  }
  return {};
}

/** Bust the session + memory cache for a specific key. */
export function bustTranslationCache(lang: string, type: string) {
  const k = `trans:${lang}:${type}`;
  delete memCache[k];
  try { sessionStorage.removeItem(k); } catch { /* ignore */ }
}

// ─── Deep merge — applies translations on top of English source ──────────────
// Rules:
//   • Non-empty translated string   → use translation
//   • Empty / missing translation   → keep English source
//   • Arrays                        → merge element by element
//   • Objects                       → recurse
export function deepMergeTranslations<T = any>(original: T, translations: any): T {
  if (!translations || typeof translations !== 'object' || typeof original !== 'object') {
    return (translations && typeof translations === 'string' && translations.trim())
      ? (translations as unknown as T)
      : original;
  }

  if (Array.isArray(original)) {
    return (original as any[]).map((item, i) => {
      const t = (translations as any[])[i];
      if (t === undefined || t === null) return item;
      if (typeof item === 'string') return (typeof t === 'string' && t.trim()) ? t : item;
      return deepMergeTranslations(item, t);
    }) as unknown as T;
  }

  const result = { ...(original as object) } as Record<string, any>;
  for (const key of Object.keys(translations)) {
    const tv = translations[key];
    if (tv === undefined || tv === null) continue;
    if (typeof tv === 'string') {
      if (tv.trim()) result[key] = tv;
    } else if (Array.isArray(tv)) {
      result[key] = deepMergeTranslations(result[key], tv);
    } else if (typeof tv === 'object') {
      result[key] = deepMergeTranslations(result[key] ?? {}, tv);
    }
  }
  return result as T;
}
