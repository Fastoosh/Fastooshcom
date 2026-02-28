import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

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

const authHeaders = (extra?: Record<string, string>) => ({
  Authorization: `Bearer ${publicAnonKey}`,
  ...extra,
});

export const api = {
  // Projects
  async getProjects() {
    return safeFetch<any[]>(`${API_BASE}/projects`, { headers: authHeaders() });
  },

  async getProject(id: string) {
    return safeFetch<any>(`${API_BASE}/projects/${id}`, { headers: authHeaders() });
  },

  // Tools
  async getTools() {
    return safeFetch<any[]>(`${API_BASE}/tools`, { headers: authHeaders() });
  },

  async getTool(id: string) {
    return safeFetch<any>(`${API_BASE}/tools/${id}`, { headers: authHeaders() });
  },

  // Team
  async getTeam() {
    return safeFetch<any[]>(`${API_BASE}/team`, { headers: authHeaders() });
  },

  // Settings
  async getSettings() {
    return safeFetch<any>(`${API_BASE}/settings`, { headers: authHeaders() });
  },
};