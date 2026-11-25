// Short links: fastoosh.com/go/<code>. Saved as the site setting `shortLinks`;
// the redirect is the Vercel function api/go.js, which also counts clicks
// (server: POST /short-links/hit, GET /admin/short-links/hits).
// Created from Admin → Traffic → UTM builder; `utmId` ties a short link to
// the saved UTM link it was made from.
import { projectId, publicAnonKey } from '/utils/supabase/info';

export interface ShortLink {
  code: string;
  url: string;      // full destination, UTM tags included
  utmId?: string;   // saved UTM link it belongs to
  label?: string;
  createdAt: string;
  updatedAt?: string;
}
export type ShortHits = Record<string, { count: number; lastAt?: string }>;

const API = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;
const headers = () => ({
  Authorization: `Bearer ${publicAnonKey}`,
  'X-Admin-Token': localStorage.getItem('admin_token') || '',
  'Content-Type': 'application/json',
});

export const slugifyCode = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
export const isValidCode = (c: string) => /^[a-z0-9][a-z0-9-]{0,59}$/.test(c);

/** A free code built from the parts given, e.g. ("spring_launch", "instagram") → "spring-launch-instagram". */
export function suggestCode(parts: string[], taken: ShortLink[]): string {
  const base = slugifyCode(parts.filter(Boolean).join('-')) || Math.random().toString(36).slice(2, 7);
  const used = new Set(taken.map(l => l.code));
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) if (!used.has(`${base}-${i}`)) return `${base}-${i}`;
}

export async function loadShortLinks(): Promise<{ links: ShortLink[]; site: string }> {
  const s = await fetch(`${API}/settings`, { headers: headers() }).then(r => r.json());
  const d = s?.data || {};
  return {
    links: Array.isArray(d.shortLinks) ? d.shortLinks : [],
    site: String(d.siteUrl || 'https://www.fastoosh.com').replace(/\/$/, ''),
  };
}

/** Re-reads the list before writing, so two open admin tabs don't erase each other's links. */
export async function saveShortLinks(update: (links: ShortLink[]) => ShortLink[]): Promise<ShortLink[]> {
  const { links } = await loadShortLinks();
  const next = update(links);
  const res = await fetch(`${API}/settings`, { method: 'POST', headers: headers(), body: JSON.stringify({ shortLinks: next }) });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Save failed');
  return next;
}

/** Click counts per code, or null when the server doesn't have the endpoint yet. */
export async function loadShortHits(): Promise<ShortHits | null> {
  try {
    const j = await fetch(`${API}/admin/short-links/hits`, { headers: headers() }).then(r => r.json());
    return j?.success ? (j.data || {}) : null;
  } catch { return null; }
}

/** Same page + same query, ignoring www / trailing slash / parameter order. */
export function sameUrl(a: string, b: string): boolean {
  try {
    const norm = (s: string) => {
      const u = new URL(s);
      const q = [...u.searchParams.entries()].sort().map(([k, v]) => `${k}=${v}`).join('&');
      return `${u.host.replace(/^www\./, '')}${u.pathname.replace(/\/$/, '') || '/'}?${q}`;
    };
    return norm(a) === norm(b);
  } catch { return a === b; }
}
