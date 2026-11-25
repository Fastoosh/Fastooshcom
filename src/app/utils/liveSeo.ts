// Reads a page of the LIVE site the way a crawler does: the prerendered HTML
// (scripts/prerender.mjs), before any JavaScript runs. Used by the admin SEO
// health check and previews, so they show what Google, AI assistants and
// link previews actually receive.

export interface LivePage {
  path: string;
  ok: boolean;              // fetched successfully
  published: boolean;       // has its own prerendered HTML (else: generic shell)
  title: string;
  description: string;
  canonical: string;
  noindex: boolean;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  h1Count: number;
  words: number;
  jsonLdTypes: string[];
  jsonLdErrors: number;
  error?: string;
}

/** Same origin on the live admin; the public site when testing locally. */
export const LIVE_ORIGIN =
  typeof window !== 'undefined' && /(^|\.)fastoosh\.com$/i.test(window.location.hostname)
    ? '' : 'https://www.fastoosh.com';

export const SITE_ORIGIN = 'https://www.fastoosh.com';

export async function fetchLivePage(path: string): Promise<LivePage> {
  const base: LivePage = {
    path, ok: false, published: false, title: '', description: '', canonical: '', noindex: false,
    ogTitle: '', ogDescription: '', ogImage: '', h1Count: 0, words: 0, jsonLdTypes: [], jsonLdErrors: 0,
  };
  try {
    // Cache-buster so the check reflects the latest deploy.
    const res = await fetch(`${LIVE_ORIGIN}${path}${path.includes('?') ? '&' : '?'}seo-check=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return { ...base, error: `HTTP ${res.status}` };
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const meta = (sel: string) => doc.querySelector(sel)?.getAttribute('content')?.trim() || '';
    const body = doc.querySelector('[data-prerender-body] main') || doc.querySelector('[data-prerender-body]');
    const text = (body?.textContent || '').replace(/\s+/g, ' ').trim();
    const types: string[] = [];
    let ldErrors = 0;
    doc.querySelectorAll('script[type="application/ld+json"]').forEach(s => {
      try {
        const j = JSON.parse(s.textContent || '');
        for (const item of Array.isArray(j) ? j : [j]) if (item?.['@type']) types.push(String(item['@type']));
      } catch { ldErrors++; }
    });
    return {
      ...base,
      ok: true,
      published: !!doc.querySelector('title[data-prerender]'),
      title: doc.querySelector('title')?.textContent?.trim() || '',
      description: meta('meta[name="description"]'),
      canonical: doc.querySelector('link[rel="canonical"]')?.getAttribute('href') || '',
      noindex: /noindex/i.test(meta('meta[name="robots"]')),
      ogTitle: meta('meta[property="og:title"]'),
      ogDescription: meta('meta[property="og:description"]'),
      ogImage: meta('meta[property="og:image"]'),
      h1Count: body ? body.querySelectorAll('h1').length : doc.querySelectorAll('h1').length,
      words: text ? text.split(' ').length : 0,
      jsonLdTypes: types,
      jsonLdErrors: ldErrors,
    };
  } catch (err: any) {
    return { ...base, error: err?.message || String(err) };
  }
}

/** Loads an image the way a crawler would (no Referer). Resolves true if it loads. */
export function imageLoads(src: string, timeoutMs = 10000): Promise<boolean> {
  return new Promise(resolve => {
    if (!src) return resolve(false);
    const img = new Image();
    img.referrerPolicy = 'no-referrer';
    const t = window.setTimeout(() => { img.src = ''; resolve(false); }, timeoutMs);
    img.onload = () => { window.clearTimeout(t); resolve(img.naturalWidth > 0); };
    img.onerror = () => { window.clearTimeout(t); resolve(false); };
    img.src = src;
  });
}

export type Severity = 'error' | 'warn';
export interface Issue { severity: Severity; text: string }

/** Checks one page. `dupTitles` / `dupDescs` count how many pages share each value. */
export function checkPage(
  p: LivePage,
  opts: { imageOk?: boolean; dupTitles: Map<string, number>; dupDescs: Map<string, number>; expectedCanonical: string },
): Issue[] {
  const out: Issue[] = [];
  if (!p.ok) return [{ severity: 'error', text: `Could not load the page (${p.error || 'unknown error'}).` }];
  if (!p.published) {
    return [{ severity: 'error', text: 'Not in the published site yet — crawlers get a blank page. Click Republish.' }];
  }
  if (p.noindex) out.push({ severity: 'warn', text: 'Hidden from search (noindex). Intended?' });
  if (!p.title) out.push({ severity: 'error', text: 'No title.' });
  else if (p.title.length > 65) out.push({ severity: 'warn', text: `Title is ${p.title.length} characters — Google cuts it around 60.` });
  else if (p.title.length < 25 && !/^\/(terms|privacy|refunds|disclaimer)$/.test(p.path)) out.push({ severity: 'warn', text: `Title is short (${p.title.length} characters) — add what the page is about.` });
  if (!p.description) out.push({ severity: 'error', text: 'No meta description.' });
  else if (p.description.length > 165) out.push({ severity: 'warn', text: `Description is ${p.description.length} characters — Google shows about 155.` });
  else if (p.description.length < 70) out.push({ severity: 'warn', text: `Description is short (${p.description.length} characters).` });
  if (p.title && (opts.dupTitles.get(p.title) || 0) > 1) out.push({ severity: 'warn', text: 'Same title as another page.' });
  if (p.description && (opts.dupDescs.get(p.description) || 0) > 1) out.push({ severity: 'warn', text: 'Same description as another page.' });
  if (p.h1Count === 0) out.push({ severity: 'error', text: 'No H1 heading.' });
  else if (p.h1Count > 1) out.push({ severity: 'warn', text: `${p.h1Count} H1 headings — use one.` });
  if (!p.canonical) out.push({ severity: 'warn', text: 'No canonical URL.' });
  else if (p.canonical.replace(/\/$/, '') !== opts.expectedCanonical.replace(/\/$/, '')) {
    out.push({ severity: 'warn', text: `Canonical points elsewhere: ${p.canonical}` });
  }
  if (!p.ogImage) out.push({ severity: 'error', text: 'No preview image — shared links show no picture.' });
  else if (opts.imageOk === false) out.push({ severity: 'error', text: 'Preview image does not load for crawlers.' });
  if (p.words < 120) out.push({ severity: 'warn', text: `Thin content: about ${p.words} words of text. Add a paragraph or two.` });
  if (!p.jsonLdTypes.length) out.push({ severity: 'warn', text: 'No structured data.' });
  if (p.jsonLdErrors) out.push({ severity: 'error', text: 'Structured data is not valid JSON.' });
  return out;
}
