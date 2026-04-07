import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// ─── In-memory API cache with TTL ─────────────────────────────────────────────
// Lives for the lifetime of the browser tab (same approach as translations.ts).
// Navigation back to a previously loaded page is an instant cache-hit instead
// of a 500 ms–2 s Edge Function round-trip.

const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry<T> {
  data: T;
  fetchedAt: number;
}

const apiMemCache: Record<string, CacheEntry<any>> = {};

function getCached<T>(key: string): T | null {
  const entry = apiMemCache[key];
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    delete apiMemCache[key]; // expired — evict
    return null;
  }
  return entry.data as T;
}

function setCached<T>(key: string, data: T): void {
  apiMemCache[key] = { data, fetchedAt: Date.now() };
}

/**
 * Invalidates one or all cached API entries.
 * Call this from the admin panel after any mutation (PUT / POST / DELETE).
 *
 * Examples:
 *   bustApiCache('tools')          // invalidate tools list
 *   bustApiCache('project:abc123') // invalidate a single project
 *   bustApiCache()                 // wipe everything
 */
export function bustApiCache(key?: string): void {
  if (key) {
    delete apiMemCache[key];
  } else {
    Object.keys(apiMemCache).forEach(k => delete apiMemCache[k]);
  }
}

// ─── Fetch helpers ─────────────────────────────────────────────────────────────

/** Wraps fetch so a network-level failure returns { success: false } instead of throwing.
 *  Retries once after 1 s on network-level errors (handles Supabase cold-start timeouts). */
async function safeFetch<T>(url: string, init?: RequestInit, retries = 1): Promise<ApiResponse<T>> {
  try {
    const response = await fetch(url, init);
    if (!response.ok) {
      const text = await response.text().catch(() => response.statusText);
      console.error(`[api] HTTP ${response.status} from ${url}:`, text);
      return { success: false, error: `HTTP ${response.status}: ${text}` };
    }
    return response.json() as Promise<ApiResponse<T>>;
  } catch (err) {
    if (retries > 0) {
      console.warn(`[api] Fetch failed, retrying in 1 s… (${url})`);
      await new Promise(r => setTimeout(r, 1000));
      return safeFetch<T>(url, init, retries - 1);
    }
    console.error(`[api] Failed to fetch ${url}:`, err);
    return { success: false, error: String(err) };
  }
}

/** safeFetch with automatic read-through cache. */
async function cachedFetch<T>(
  cacheKey: string,
  url: string,
  init?: RequestInit,
): Promise<ApiResponse<T>> {
  const cached = getCached<T>(cacheKey);
  if (cached !== null) {
    return { success: true, data: cached };
  }
  const res = await safeFetch<T>(url, init);
  if (res.success && res.data !== undefined) {
    setCached(cacheKey, res.data);
  }
  return res;
}

const authHeaders = (extra?: Record<string, string>) => ({
  Authorization: `Bearer ${publicAnonKey}`,
  ...extra,
});

export const api = {
  // Projects
  async getProjects() {
    return cachedFetch<any[]>('projects', `${API_BASE}/projects`, { headers: authHeaders() });
  },

  async getProject(id: string) {
    return cachedFetch<any>(`project:${id}`, `${API_BASE}/projects/${encodeURIComponent(id)}`, { headers: authHeaders() });
  },

  // Tools
  async getTools() {
    return cachedFetch<any[]>('tools', `${API_BASE}/tools`, { headers: authHeaders() });
  },

  async getTool(id: string) {
    return cachedFetch<any>(`tool:${id}`, `${API_BASE}/tools/${encodeURIComponent(id)}`, { headers: authHeaders() });
  },

  // Team
  async getTeam() {
    return cachedFetch<any[]>('team', `${API_BASE}/team`, { headers: authHeaders() });
  },

  // Settings
  async getSettings() {
    return cachedFetch<any>('settings', `${API_BASE}/settings`, { headers: authHeaders() });
  },
};