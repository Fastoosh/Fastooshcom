import { useEffect, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

export interface SeoData {
  title?: string;
  description?: string;
  keywords?: string;
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
  twitterCard?: string;
  twitterTitle?: string;
  twitterDescription?: string;
  canonicalUrl?: string;
  noIndex?: boolean;
  structuredData?: string; // JSON-LD string
}

// ── Per-page SEO cache ────────────────────────────────────────────────────────
const seoCache: Record<string, SeoData | null> = {};

// ── Global site-settings cache (siteUrl + defaultOgImage) ────────────────────
interface SiteSettings { siteUrl?: string; defaultOgImage?: string }
let siteSettingsCache: SiteSettings | null = null;
let siteSettingsFetchPromise: Promise<SiteSettings> | null = null;

async function getSiteSettings(): Promise<SiteSettings> {
  if (siteSettingsCache !== null) return siteSettingsCache;
  if (siteSettingsFetchPromise) return siteSettingsFetchPromise;
  siteSettingsFetchPromise = fetch(`${API_BASE}/settings`, {
    headers: { Authorization: `Bearer ${publicAnonKey}` },
  })
    .then(r => r.json())
    .then(data => {
      const d = data.data || {};
      const result: SiteSettings = {
        siteUrl:        d.siteUrl        || '',
        defaultOgImage: d.defaultOgImage || '',
      };
      siteSettingsCache = result;
      return result;
    })
    .catch(() => {
      siteSettingsCache = {};
      return {} as SiteSettings;
    });
  return siteSettingsFetchPromise;
}

// ── Page key → path helper ────────────────────────────────────────────────────
function pageKeyToPath(pageKey: string): string {
  if (pageKey === 'home')         return '/home';
  if (pageKey === 'projects')     return '/projects';
  if (pageKey === 'tools')        return '/tools';
  if (pageKey === 'about')        return '/about';
  if (pageKey === 'work-with-us') return '/work-with-us';
  if (pageKey.startsWith('tool--'))    return `/tools/${pageKey.replace('tool--', '')}`;
  if (pageKey.startsWith('project--')) return `/projects/${pageKey.replace('project--', '')}`;
  return `/${pageKey}`;
}

// ── Component ─────────────────────────────────────────────────────────────────
interface SeoHeadProps {
  /** e.g. "home", "projects", "tool--my-slug", "project--my-slug" */
  pageKey: string;
  /** Defaults shown while loading or if no SEO data is saved */
  fallback?: SeoData;
}

export function SeoHead({ pageKey, fallback }: SeoHeadProps) {
  const [seo, setSeo]         = useState<SeoData | null>(seoCache[pageKey] ?? null);
  const [global, setGlobal]   = useState<SiteSettings>(siteSettingsCache ?? {});

  // Fetch page-level SEO
  useEffect(() => {
    if (seoCache[pageKey] !== undefined) {
      setSeo(seoCache[pageKey]);
    } else {
      let cancelled = false;
      fetch(`${API_BASE}/seo/${encodeURIComponent(pageKey)}`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      })
        .then(r => r.json())
        .then(data => {
          const result = data.data || null;
          seoCache[pageKey] = result;
          if (!cancelled) setSeo(result);
        })
        .catch(() => { seoCache[pageKey] = null; });
      return () => { cancelled = true; };
    }
  }, [pageKey]);

  // Fetch global settings once
  useEffect(() => {
    if (siteSettingsCache !== null) {
      setGlobal(siteSettingsCache);
    } else {
      let cancelled = false;
      getSiteSettings().then(s => { if (!cancelled) setGlobal(s); });
      return () => { cancelled = true; };
    }
  }, []);

  // Merge: page > fallback > global defaults
  const merged: SeoData = {
    ...fallback,
    ...filterEmpty(seo),
  };

  const siteName   = 'Fastoosh';
  const ogType     = 'website';

  // Resolve ogImage: page → fallback → global default
  const ogImage = merged.ogImage || fallback?.ogImage || global.defaultOgImage || '';

  // Resolve canonical: page → auto from siteUrl
  const autoCanonical = global.siteUrl
    ? `${global.siteUrl.replace(/\/$/, '')}${pageKeyToPath(pageKey)}`
    : '';
  const canonicalUrl = merged.canonicalUrl || autoCanonical;

  return (
    <Helmet>
      {merged.title        && <title>{merged.title}</title>}
      {merged.description  && <meta name="description" content={merged.description} />}
      {merged.keywords     && <meta name="keywords" content={merged.keywords} />}
      {merged.noIndex      && <meta name="robots" content="noindex, nofollow" />}
      {canonicalUrl        && <link rel="canonical" href={canonicalUrl} />}

      {/* Open Graph */}
      <meta property="og:type"      content={ogType} />
      <meta property="og:site_name" content={siteName} />
      {(merged.ogTitle || merged.title) && (
        <meta property="og:title" content={merged.ogTitle || merged.title!} />
      )}
      {(merged.ogDescription || merged.description) && (
        <meta property="og:description" content={merged.ogDescription || merged.description!} />
      )}
      {ogImage      && <meta property="og:image" content={ogImage} />}
      {canonicalUrl && <meta property="og:url"   content={canonicalUrl} />}

      {/* Twitter Card */}
      <meta name="twitter:card" content={merged.twitterCard || 'summary_large_image'} />
      {(merged.twitterTitle || merged.ogTitle || merged.title) && (
        <meta name="twitter:title" content={merged.twitterTitle || merged.ogTitle || merged.title!} />
      )}
      {(merged.twitterDescription || merged.ogDescription || merged.description) && (
        <meta name="twitter:description" content={merged.twitterDescription || merged.ogDescription || merged.description!} />
      )}
      {ogImage && <meta name="twitter:image" content={ogImage} />}

      {/* JSON-LD Structured Data */}
      {merged.structuredData && isValidJson(merged.structuredData) && (
        <script type="application/ld+json">{merged.structuredData}</script>
      )}
    </Helmet>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function filterEmpty(obj: SeoData | null): Partial<SeoData> {
  if (!obj) return {};
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined && v !== '' && v !== false)
  ) as Partial<SeoData>;
}

function isValidJson(str: string): boolean {
  try { JSON.parse(str); return true; } catch { return false; }
}

/** Invalidate cached SEO for a page key (e.g. after saving in admin) */
export function invalidateSeoCache(pageKey: string) {
  delete seoCache[pageKey];
}

/** Invalidate global settings cache (e.g. after updating siteUrl / defaultOgImage) */
export function invalidateSiteSettingsCache() {
  siteSettingsCache = null;
  siteSettingsFetchPromise = null;
}
