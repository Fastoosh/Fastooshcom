// ─────────────────────────────────────────────────────────────────────────────
// Prerender — runs after `vite build` (see package.json "build").
//
// The site is a client-rendered React app, so every URL used to return the
// same empty index.html. Search engines that skip JavaScript, AI assistants
// (ChatGPT, Claude, Perplexity…) and link previews (Pinterest, LinkedIn,
// WhatsApp, X) saw no title, no description, no image and no text.
//
// This script fetches the live content from the API and writes one real HTML
// file per public page into dist/, each with:
//   • its own <title>, description, canonical URL, Open Graph + Twitter tags
//   • JSON-LD structured data (Organization, CreativeWork + VideoObject,
//     SoftwareApplication + Offers, FAQPage, BreadcrumbList)
//   • the page's text content inside #root (React replaces it on load)
// plus dist/sitemap.xml (with image + video entries) and dist/app.html, a
// neutral shell served for private routes (/admin, /account…).
//
// It never fails the build: if the API is unreachable it logs a warning and
// leaves the normal SPA build in place.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdirSync, copyFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DIST = join(ROOT, 'dist');

// Supabase project + public anon key (same values the browser uses).
const infoSrc = readFileSync(join(ROOT, 'utils/supabase/info.tsx'), 'utf8');
const PROJECT_ID = infoSrc.match(/projectId\s*=\s*"([^"]+)"/)?.[1];
const ANON_KEY   = infoSrc.match(/publicAnonKey\s*=\s*"([^"]+)"/)?.[1];
const API = `https://${PROJECT_ID}.supabase.co/functions/v1/make-server-e07959ec`;

const BUNNY_LIBRARY = '684708';
const BUNNY_CDN     = 'vz-869cc91d-3f3.b-cdn.net';
const BRAND         = 'Fastoosh';

// ── helpers ──────────────────────────────────────────────────────────────────
const esc = (s) => String(s ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
const plain = (s) => String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const clip = (s, n) => { const t = plain(s); return t.length <= n ? t : t.slice(0, n - 1).replace(/\s+\S*$/, '') + '…'; };
const isHttp = (u) => typeof u === 'string' && /^https?:\/\//i.test(u);

async function api(path) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20000);
  try {
    const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${ANON_KEY}` }, signal: ctrl.signal });
    const json = await res.json();
    return json?.data ?? null;
  } finally { clearTimeout(timer); }
}

function bunnyGuid(url) {
  if (!url) return null;
  return url.match(/mediadelivery\.net\/(?:embed|play)\/\d+\/([0-9a-f-]+)/i)?.[1]
      ?? url.match(/b-cdn\.net\/([0-9a-f-]{20,})/i)?.[1] ?? null;
}
const vimeoId = (url) => url?.match(/vimeo\.com\/(?:video\/)?(\d+)/i)?.[1] ?? null;
const youtubeId = (url) => url?.match(/(?:youtu\.be\/|[?&]v=|\/embed\/)([\w-]{6,})/i)?.[1] ?? null;

/** Embed + thumbnail info for a video URL, or null. */
function videoInfo(url) {
  const g = bunnyGuid(url);
  if (g) return { embed: `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY}/${g}`, thumb: `https://${BUNNY_CDN}/${g}/thumbnail.jpg` };
  const v = vimeoId(url);
  if (v) return { embed: `https://player.vimeo.com/video/${v}`, thumb: null };
  const y = youtubeId(url);
  if (y) return { embed: `https://www.youtube.com/embed/${y}`, thumb: `https://i.ytimg.com/vi/${y}/hqdefault.jpg` };
  return null;
}

// ── Preview images hosted on our own domain ──────────────────────────────────
// Bunny's CDN refuses requests without a fastoosh.com Referer (403), so
// LinkedIn, Facebook, Pinterest and Google Images could not load project
// thumbnails. Many project covers are also stored as base64 data: URIs, which
// can't be an og:image at all. Both are written to dist/og/ at build time and
// served from www.fastoosh.com/og/… instead.
let SITE_ORIGIN = 'https://www.fastoosh.com';
const ogCache = new Map(); // source → public URL (null when unusable)

async function localImage(name, src) {
  if (!src) return null;
  if (ogCache.has(src)) return ogCache.get(src);
  let out = null;
  try {
    const dataUri = src.match(/^data:image\/([a-z+]+);base64,(.+)$/i);
    if (dataUri) {
      const ext = dataUri[1].toLowerCase() === 'jpeg' ? 'jpg' : dataUri[1].toLowerCase().replace('svg+xml', 'svg');
      mkdirSync(join(DIST, 'og'), { recursive: true });
      writeFileSync(join(DIST, 'og', `${name}.${ext}`), Buffer.from(dataUri[2], 'base64'));
      out = `${SITE_ORIGIN}/og/${name}.${ext}`;
    } else if (/b-cdn\.net\//i.test(src)) {
      const res = await fetch(src, { headers: { Referer: `${SITE_ORIGIN}/` }, signal: AbortSignal.timeout(15000) });
      if (res.ok) {
        mkdirSync(join(DIST, 'og'), { recursive: true });
        writeFileSync(join(DIST, 'og', `${name}.jpg`), Buffer.from(await res.arrayBuffer()));
        out = `${SITE_ORIGIN}/og/${name}.jpg`;
      }
    } else if (isHttp(src)) {
      out = src; // other hosts (Supabase storage, Vimeo, YouTube) are public
    }
  } catch { out = null; }
  ogCache.set(src, out);
  return out;
}

/** First candidate that yields a publicly loadable image. */
async function bestImage(name, ...candidates) {
  for (const c of candidates) {
    const u = await localImage(name, c);
    if (u) return u;
  }
  return null;
}

function priceNumber(s) {
  const m = String(s ?? '').replace(',', '.').match(/(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : null;
}

// ── page rendering ───────────────────────────────────────────────────────────
let TEMPLATE = '';

function headTags(p) {
  const t = [];
  t.push(`<title data-prerender>${esc(p.title)}</title>`);
  t.push(`<meta data-prerender name="description" content="${esc(p.description)}" />`);
  if (p.keywords) t.push(`<meta data-prerender name="keywords" content="${esc(p.keywords)}" />`);
  if (p.noIndex) t.push(`<meta data-prerender name="robots" content="noindex, nofollow" />`);
  else t.push(`<meta data-prerender name="robots" content="index, follow, max-image-preview:large, max-video-preview:-1" />`);
  if (p.canonical) t.push(`<link data-prerender rel="canonical" href="${esc(p.canonical)}" />`);
  t.push(`<meta data-prerender property="og:type" content="${esc(p.ogType || 'website')}" />`);
  t.push(`<meta data-prerender property="og:site_name" content="${BRAND}" />`);
  t.push(`<meta data-prerender property="og:title" content="${esc(p.ogTitle || p.title)}" />`);
  t.push(`<meta data-prerender property="og:description" content="${esc(p.ogDescription || p.description)}" />`);
  if (p.canonical) t.push(`<meta data-prerender property="og:url" content="${esc(p.canonical)}" />`);
  if (p.image) {
    t.push(`<meta data-prerender property="og:image" content="${esc(p.image)}" />`);
    t.push(`<meta data-prerender property="og:image:alt" content="${esc(p.ogTitle || p.title)}" />`);
  }
  if (p.video) {
    t.push(`<meta data-prerender property="og:video" content="${esc(p.video)}" />`);
    t.push(`<meta data-prerender property="og:video:type" content="text/html" />`);
  }
  t.push(`<meta data-prerender name="twitter:card" content="${p.image ? 'summary_large_image' : 'summary'}" />`);
  t.push(`<meta data-prerender name="twitter:title" content="${esc(p.twitterTitle || p.ogTitle || p.title)}" />`);
  t.push(`<meta data-prerender name="twitter:description" content="${esc(p.twitterDescription || p.ogDescription || p.description)}" />`);
  if (p.image) t.push(`<meta data-prerender name="twitter:image" content="${esc(p.image)}" />`);
  for (const ld of p.jsonLd || []) {
    // </ inside JSON would close the script tag early.
    t.push(`<script type="application/ld+json" data-prerender-ld>${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>`);
  }
  return t.join('\n    ');
}

/** Strip the template's generic SEO tags so each page has exactly one set. */
function stripSeo(html) {
  return html
    .replace(/<title>[\s\S]*?<\/title>\s*/i, '')
    .replace(/<meta\s+(?:name|property)="(?:description|keywords|robots|og:[^"]+|twitter:[^"]+)"[^>]*>\s*/gi, '')
    .replace(/<link\s+rel="canonical"[^>]*>\s*/gi, '')
    .replace(/<!--\s*(Open Graph|Twitter Card|Canonical)\s*-->\s*/gi, '');
}

const NAV = [
  ['/', 'Home'], ['/projects', 'Projects'], ['/tools', 'Tools'],
  ['/about', 'About'], ['/work-with-us', 'Work with us'],
];

function bodyShell(inner) {
  // Visible, readable fallback that matches the dark site. React replaces
  // the whole #root on load, so visitors only see this for a split second
  // (and only if JavaScript is slow or off).
  const nav = NAV.map(([href, label]) => `<a href="${href}" style="color:#c4b5fd;margin-right:16px">${esc(label)}</a>`).join('');
  return `<div data-prerender-body style="background:#000;color:#d4d4d8;font-family:system-ui,-apple-system,Segoe UI,sans-serif;line-height:1.6;min-height:100vh">
      <div style="max-width:880px;margin:0 auto;padding:32px 20px 64px">
        <nav style="margin-bottom:32px"><a href="/" style="color:#fff;font-weight:800;margin-right:24px">${BRAND}</a>${nav}</nav>
        <main>${inner}</main>
        <footer style="margin-top:48px;font-size:13px;color:#71717a">
          <a href="/terms" style="color:#71717a;margin-right:12px">Terms</a>
          <a href="/privacy" style="color:#71717a;margin-right:12px">Privacy</a>
          <a href="/refunds" style="color:#71717a;margin-right:12px">Refunds</a>
          <a href="/disclaimer" style="color:#71717a">Disclaimer</a>
        </footer>
      </div>
    </div>`;
}

function renderPage(p) {
  let html = stripSeo(TEMPLATE);
  // After charset + viewport (charset must stay first in <head>).
  html = html.replace(/(<meta\s+name="viewport"[^>]*>)/i, `$1\n    ${headTags(p)}`);
  html = html.replace(/<div id="root"><\/div>/i, `<div id="root">${bodyShell(p.body || '')}</div>`);
  return html;
}

function writeRoute(route, html) {
  // "/" → index.html, "/projects" → projects.html, "/projects/x" → projects/x.html
  // (vercel.json cleanUrls serves /projects/x from projects/x.html).
  const file = route === '/' ? 'index.html' : `${route.replace(/^\//, '')}.html`;
  const full = join(DIST, file);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, html);
}

const list = (items) => items.length ? `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>` : '';
const h2 = (t) => `<h2 style="color:#fff;font-size:20px;margin:28px 0 8px">${esc(t)}</h2>`;
const para = (t) => t ? `<p>${esc(plain(t))}</p>` : '';

// ── main ─────────────────────────────────────────────────────────────────────
async function main() {
  TEMPLATE = readFileSync(join(DIST, 'index.html'), 'utf8');

  // Neutral shell for every route we don't prerender (admin, account, auth,
  // and projects/tools added since the last deploy): no canonical, no page
  // content. Not noindex — a brand-new project is served this shell until the
  // next build, and <SeoHead> still sets its tags once the app runs. Private
  // areas are kept out of search by robots.txt instead.
  const shell = stripSeo(TEMPLATE).replace(/(<meta\s+name="viewport"[^>]*>)/i,
    `$1\n    <title>${BRAND}</title>`);
  writeFileSync(join(DIST, 'app.html'), shell);

  const [settings, home, projectsRaw, toolsRaw, team, ratings] = await Promise.all([
    api('/settings'), api('/home-content'), api('/projects'), api('/tools'), api('/team'), api('/tools-ratings'),
  ]);
  if (!Array.isArray(projectsRaw) || !Array.isArray(toolsRaw)) throw new Error('API returned no projects/tools');

  // Canonical origin. The site serves www (fastoosh.com redirects there).
  let SITE = String(settings?.siteUrl || process.env.SITE_URL || 'https://www.fastoosh.com').replace(/\/$/, '');
  SITE = SITE.replace(/^https?:\/\/fastoosh\.com/i, 'https://www.fastoosh.com');
  const url = (path) => `${SITE}${path === '/' ? '/' : path}`;
  SITE_ORIGIN = SITE;

  const projects = projectsRaw.filter(p => p.slug);
  const tools = toolsRaw.filter(t => t.slug);

  // Admin-saved SEO overrides (Admin → SEO). Empty fields fall back to ours.
  const seoKeys = ['home', 'projects', 'tools', 'about', 'work-with-us', 'terms', 'privacy', 'refunds', 'disclaimer',
    ...projects.map(p => `project--${p.slug}`), ...tools.map(t => `tool--${t.slug}`)];
  const seo = {};
  for (let i = 0; i < seoKeys.length; i += 8) {
    await Promise.all(seoKeys.slice(i, i + 8).map(async k => {
      try { seo[k] = await api(`/seo/${encodeURIComponent(k)}`); } catch { seo[k] = null; }
    }));
  }
  const withSeo = (key, page) => {
    const s = seo[key] || {};
    const pick = (v, d) => (typeof v === 'string' && v.trim()) ? v.trim() : d;
    const extraLd = [];
    if (s.structuredData) { try { extraLd.push(JSON.parse(s.structuredData)); } catch { /* invalid — ignore */ } }
    return {
      ...page,
      title:              pick(s.title, page.title),
      description:        pick(s.description, page.description),
      keywords:           pick(s.keywords, page.keywords),
      ogTitle:            pick(s.ogTitle, page.ogTitle),
      ogDescription:      pick(s.ogDescription, page.ogDescription),
      twitterTitle:       pick(s.twitterTitle, undefined),
      twitterDescription: pick(s.twitterDescription, undefined),
      image:              pick(s.ogImage, page.image),
      canonical:          pick(s.canonicalUrl, page.canonical),
      noIndex:            !!s.noIndex,
      jsonLd:             [...(page.jsonLd || []), ...extraLd],
    };
  };

  const showreel = videoInfo(home?.showreelUrl || settings?.showreelUrl);
  const DEFAULT_IMAGE = await bestImage('default', settings?.defaultOgImage, showreel?.thumb);
  const SHOWREEL_THUMB = showreel ? await bestImage('showreel', showreel.thumb) : null;
  const LOGO = await bestImage('logo', settings?.logoDarkUrl, settings?.logoUrl);
  const sameAs = Object.values(settings?.socialLinks || {}).filter(isHttp);

  const ORG = {
    '@type': 'Organization', '@id': `${SITE}/#organization`,
    name: BRAND, url: `${SITE}/`,
    ...(LOGO ? { logo: LOGO } : {}),
    ...(sameAs.length ? { sameAs } : {}),
    ...(settings?.contactEmail ? { email: settings.contactEmail, contactPoint: { '@type': 'ContactPoint', contactType: 'sales', email: settings.contactEmail, url: `${SITE}/work-with-us` } } : {}),
    description: 'Fastoosh is a motion design studio creating high-impact videos, After Effects tools and creative workflows for brands.',
    knowsAbout: ['Motion design', 'Animation', 'After Effects', 'Video production', 'Brand video', 'Event videos', 'After Effects scripts and extensions'],
  };
  const crumbs = (items) => ({
    '@context': 'https://schema.org', '@type': 'BreadcrumbList',
    itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: url(path) })),
  });

  const pages = []; // { route, key, page, sitemap: {images, video, lastmod, priority} }

  // ── Home ──
  {
    const heading = [home?.heroLine1, home?.heroLine2].filter(Boolean).join(' ');
    const caps = (home?.capabilities || []).map(c => `<strong>${esc(c.title)}</strong> — ${esc(c.description)}`);
    const steps = (home?.processSteps || []).map(s => `<strong>${esc(s.title)}</strong> — ${esc(s.description)}`);
    const featured = projects.filter(p => p.featured).concat(projects).slice(0, 8);
    const body = `
      <h1 style="color:#fff;font-size:32px">${esc(heading || 'Fastoosh — Motion Design Studio')}</h1>
      ${para(home?.heroSubtitle)}
      ${caps.length ? h2(home?.capabilitiesHeading || 'What we do') + list(caps) : ''}
      ${h2(home?.featuredHeading || 'Featured work')}
      ${list(featured.filter((p, i, a) => a.indexOf(p) === i).map(p => `<a href="/projects/${esc(p.slug)}" style="color:#c4b5fd">${esc(p.title)}</a>${p.client ? ` — ${esc(p.client)}` : ''}`))}
      ${steps.length ? h2(home?.processHeading || 'Our process') + list(steps) : ''}
      ${(home?.deliverables || []).length ? h2(home?.deliverablesTitle || 'What you get') + list(home.deliverables.map(esc)) : ''}
      ${h2('Tools for motion designers')}
      ${list(tools.map(t => `<a href="/tools/${esc(t.slug)}" style="color:#c4b5fd">${esc(t.name)}</a>${t.tagline ? ` — ${esc(t.tagline)}` : ''}`))}
      ${para(home?.ctaSubtitle)}
      <p><a href="/work-with-us" style="color:#c4b5fd">Start a project with Fastoosh</a></p>`;
    pages.push({ route: '/', key: 'home', page: {
      title: 'Fastoosh — Motion Design Studio & After Effects Tools',
      description: clip(home?.heroSubtitle || ORG.description, 160),
      image: DEFAULT_IMAGE, canonical: url('/'), video: showreel?.embed,
      jsonLd: [
        { '@context': 'https://schema.org', ...ORG },
        { '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${SITE}/#website`, url: `${SITE}/`, name: BRAND, publisher: { '@id': `${SITE}/#organization` } },
        ...(showreel ? [{
          '@context': 'https://schema.org', '@type': 'VideoObject', name: 'Fastoosh showreel',
          description: clip(home?.heroSubtitle || ORG.description, 300),
          thumbnailUrl: SHOWREEL_THUMB || DEFAULT_IMAGE, uploadDate: new Date().toISOString().slice(0, 10),
          embedUrl: showreel.embed, publisher: { '@id': `${SITE}/#organization` },
        }] : []),
      ],
      body,
    }, sitemap: { priority: '1.0', images: [DEFAULT_IMAGE].filter(Boolean), video: showreel && { ...showreel, thumb: SHOWREEL_THUMB || DEFAULT_IMAGE, title: 'Fastoosh showreel', description: clip(home?.heroSubtitle || ORG.description, 300) } } });
  }

  // ── Projects list ──
  pages.push({ route: '/projects', key: 'projects', page: {
    title: 'Projects — Motion Design & Video Work | Fastoosh',
    description: clip(`Selected motion design, event and brand video projects by Fastoosh for ${projects.map(p => p.client).filter(Boolean).slice(0, 6).join(', ')} and more.`, 160),
    image: DEFAULT_IMAGE, canonical: url('/projects'),
    jsonLd: [{
      '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Fastoosh projects', url: url('/projects'),
      mainEntity: { '@type': 'ItemList', itemListElement: projects.map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: url(`/projects/${p.slug}`), name: p.title })) },
    }, crumbs([['Home', '/'], ['Projects', '/projects']])],
    body: `<h1 style="color:#fff;font-size:30px">Projects</h1>
      ${list(projects.map(p => `<a href="/projects/${esc(p.slug)}" style="color:#c4b5fd">${esc(p.title)}</a>${[p.client, p.category, p.year].filter(Boolean).length ? ` — ${esc([p.client, p.category, p.year].filter(Boolean).join(' · '))}` : ''}<br/>${esc(clip(p.description, 220))}`))}`,
  }, sitemap: { priority: '0.8' } });

  // ── Project pages ──
  for (const p of projects) {
    const v = videoInfo(p.videoUrl);
    const image = (await bestImage(`project-${p.slug}`, p.imageUrl, v?.thumb)) || DEFAULT_IMAGE;
    const videoThumb = v ? ((await bestImage(`video-${p.slug}`, v.thumb)) || image) : null;
    // Gallery stills on public hosts only (Bunny thumbnails would 403 for Google Images).
    const galleryImgs = (p.screenshots || []).filter(u => isHttp(u) && !videoInfo(u) && !/b-cdn\.net/i.test(u) && /\.(jpe?g|png|webp|gif)(\?|$)/i.test(u)).slice(0, 20);
    const desc = clip(p.description || p.goal || `${p.title} — a ${p.category || 'motion design'} project by Fastoosh.`, 160);
    const facts = [['Client', p.client], ['Category', p.category], ['Year', p.year]].filter(([, x]) => x);
    const ld = [
      {
        '@context': 'https://schema.org', '@type': 'CreativeWork', '@id': `${url(`/projects/${p.slug}`)}#work`,
        name: p.title, description: plain(p.description || desc), url: url(`/projects/${p.slug}`),
        ...(image ? { image } : {}), ...(p.year ? { dateCreated: String(p.year) } : {}),
        genre: p.category || 'Motion design', keywords: (p.tags || []).join(', ') || undefined,
        creator: { '@id': `${SITE}/#organization` },
        ...(p.client ? { sourceOrganization: { '@type': 'Organization', name: p.client } } : {}),
        ...(v ? { video: { '@id': `${url(`/projects/${p.slug}`)}#video` } } : {}),
      },
      ...(v ? [{
        '@context': 'https://schema.org', '@type': 'VideoObject', '@id': `${url(`/projects/${p.slug}`)}#video`,
        name: p.title, description: clip(p.description || desc, 500),
        thumbnailUrl: videoThumb, uploadDate: (p.createdAt || new Date().toISOString()).slice(0, 10),
        embedUrl: v.embed, publisher: { '@id': `${SITE}/#organization` },
      }] : []),
      crumbs([['Home', '/'], ['Projects', '/projects'], [p.title, `/projects/${p.slug}`]]),
    ];
    pages.push({ route: `/projects/${p.slug}`, key: `project--${p.slug}`, page: {
      title: `${p.title}${p.client && !p.title.toLowerCase().includes(String(p.client).toLowerCase()) ? ` for ${p.client}` : ''} | Fastoosh`,
      description: desc, keywords: (p.tags || []).join(', '), ogType: v ? 'video.other' : 'article',
      image, canonical: url(`/projects/${p.slug}`), video: v?.embed, jsonLd: ld,
      body: `<p><a href="/projects" style="color:#a1a1aa">← All projects</a></p>
        <h1 style="color:#fff;font-size:30px">${esc(p.title)}</h1>
        ${facts.length ? `<p style="color:#a1a1aa">${facts.map(([k, x]) => `${esc(k)}: ${esc(x)}`).join(' · ')}</p>` : ''}
        ${image ? `<img src="${esc(image)}" alt="${esc(p.title)}" style="max-width:100%;border-radius:12px" loading="lazy" />` : ''}
        ${para(p.description)}
        ${p.goal ? h2('The goal') + para(p.goal) : ''}
        ${p.approach ? h2('Our approach') + para(p.approach) : ''}
        ${(p.deliverables || []).filter(Boolean).length ? h2('Deliverables') + list(p.deliverables.filter(Boolean).map(esc)) : ''}
        ${p.outcome ? h2('Outcome') + para(p.outcome) : ''}
        ${(p.tags || []).length ? `<p style="color:#a1a1aa">Tags: ${esc(p.tags.join(', '))}</p>` : ''}
        <p><a href="/work-with-us" style="color:#c4b5fd">Work with Fastoosh on your next video</a></p>`,
    }, sitemap: {
      priority: '0.7', lastmod: p.updatedAt || p.createdAt,
      images: [image, ...galleryImgs].filter(Boolean),
      video: v && { ...v, thumb: videoThumb, title: p.title, description: clip(p.description || desc, 2000) },
    } });
  }

  // ── Tools list ──
  pages.push({ route: '/tools', key: 'tools', page: {
    title: 'After Effects Tools & Scripts for Motion Designers | Fastoosh',
    description: clip(`Tools by Fastoosh for motion designers: ${tools.map(t => `${t.name}${t.tagline ? ` (${t.tagline})` : ''}`).join(', ')}.`, 160),
    image: (await bestImage('tools', tools[0]?.imageUrl)) || DEFAULT_IMAGE, canonical: url('/tools'),
    jsonLd: [{
      '@context': 'https://schema.org', '@type': 'CollectionPage', name: 'Fastoosh tools', url: url('/tools'),
      mainEntity: { '@type': 'ItemList', itemListElement: tools.map((t, i) => ({ '@type': 'ListItem', position: i + 1, url: url(`/tools/${t.slug}`), name: t.name })) },
    }, crumbs([['Home', '/'], ['Tools', '/tools']])],
    body: `<h1 style="color:#fff;font-size:30px">Tools for motion designers</h1>
      ${list(tools.map(t => `<a href="/tools/${esc(t.slug)}" style="color:#c4b5fd">${esc(t.name)}</a>${t.tagline ? ` — ${esc(t.tagline)}` : ''}<br/>${esc(clip(t.description, 240))}`))}`,
  }, sitemap: { priority: '0.8' } });

  // ── Tool pages ──
  for (const t of tools) {
    const image = (await bestImage(`tool-${t.slug}`, t.imageUrl)) || DEFAULT_IMAGE;
    const desc = clip(t.description || t.tagline || `${t.name} by Fastoosh.`, 160);
    const versions = (t.versions || []).filter(v => v.versionType);
    const offers = versions.map(v => {
      const free = /free/i.test(v.versionType) || /free/i.test(v.pricingDisplay || '');
      const price = free ? 0 : priceNumber(v.lifetimePrice || v.monthlyPrice || v.yearlyPrice || v.pricingDisplay);
      if (price === null) return null;
      return { '@type': 'Offer', name: v.versionType, price: String(price), priceCurrency: 'USD', availability: 'https://schema.org/InStock', url: url(`/tools/${t.slug}`) };
    }).filter(Boolean);
    const rating = ratings?.[t.id];
    const faqs = (t.faqs || []).filter(f => f?.question && f?.answer);
    const steps = (t.howItWorks || []).filter(s => s?.title);
    const feats = (t.richFeatures || []).filter(f => f?.title);
    const ld = [
      {
        '@context': 'https://schema.org', '@type': 'SoftwareApplication', '@id': `${url(`/tools/${t.slug}`)}#app`,
        name: t.name, description: plain(t.description || desc), url: url(`/tools/${t.slug}`),
        applicationCategory: 'MultimediaApplication', applicationSubCategory: 'Adobe After Effects extension',
        operatingSystem: 'Windows, macOS', ...(image ? { image } : {}),
        ...(t.systemRequirements ? { softwareRequirements: plain(t.systemRequirements) } : {}),
        ...(feats.length ? { featureList: feats.map(f => f.title).join(', ') } : {}),
        publisher: { '@id': `${SITE}/#organization` },
        ...(offers.length ? { offers: offers.length === 1 ? offers[0] : offers } : {}),
        // Only real customer reviews — never shown when there are none.
        ...(rating?.count > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: rating.avg, ratingCount: rating.count, bestRating: 5, worstRating: 1 } } : {}),
      },
      ...(faqs.length ? [{
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: faqs.map(f => ({ '@type': 'Question', name: plain(f.question), acceptedAnswer: { '@type': 'Answer', text: plain(f.answer) } })),
      }] : []),
      crumbs([['Home', '/'], ['Tools', '/tools'], [t.name, `/tools/${t.slug}`]]),
    ];
    pages.push({ route: `/tools/${t.slug}`, key: `tool--${t.slug}`, page: {
      title: `${t.name}${t.tagline ? ` — ${t.tagline}` : ''} | Fastoosh`.slice(0, 90),
      description: desc, image, canonical: url(`/tools/${t.slug}`), ogType: 'product', jsonLd: ld,
      body: `<p><a href="/tools" style="color:#a1a1aa">← All tools</a></p>
        <h1 style="color:#fff;font-size:30px">${esc(t.name)}</h1>
        ${t.tagline ? `<p style="color:#c4b5fd">${esc(t.tagline)}</p>` : ''}
        ${image ? `<img src="${esc(image)}" alt="${esc(t.name)}" style="max-width:100%;border-radius:12px" loading="lazy" />` : ''}
        ${para(t.description)}
        ${steps.length ? h2('How it works') + `<ol>${steps.map(s => `<li><strong>${esc(s.title)}</strong>${s.description ? ` — ${esc(s.description)}` : ''}</li>`).join('')}</ol>` : ''}
        ${feats.length ? h2('Features') + list(feats.map(f => `<strong>${esc(f.title)}</strong>${f.description ? ` — ${esc(f.description)}` : ''}`)) : ''}
        ${versions.length ? h2('Pricing') + list(versions.map(v => `${esc(v.versionType)}${v.pricingDisplay ? ` — ${esc(v.pricingDisplay)}` : ''}`)) : ''}
        ${t.systemRequirements ? h2('System requirements') + para(t.systemRequirements) : ''}
        ${faqs.length ? h2('Frequently asked questions') + faqs.map(f => `<h3 style="color:#fff;font-size:16px;margin:16px 0 4px">${esc(plain(f.question))}</h3>${para(f.answer)}`).join('') : ''}`,
    }, sitemap: { priority: '0.8', lastmod: t.updatedAt || t.createdAt, images: [image].filter(Boolean) } });
  }

  // ── About ──
  pages.push({ route: '/about', key: 'about', page: {
    title: 'About Fastoosh — Motion Design Studio', description: clip(plain(settings?.aboutText) || ORG.description, 160),
    image: DEFAULT_IMAGE, canonical: url('/about'),
    jsonLd: [{ '@context': 'https://schema.org', '@type': 'AboutPage', url: url('/about'), mainEntity: { '@id': `${SITE}/#organization` } },
      ...(Array.isArray(team) ? team.filter(m => m?.name).map(m => ({ '@context': 'https://schema.org', '@type': 'Person', name: m.name, jobTitle: m.role || undefined, description: plain(m.bio) || undefined, worksFor: { '@id': `${SITE}/#organization` } })) : []),
      crumbs([['Home', '/'], ['About', '/about']])],
    body: `<h1 style="color:#fff;font-size:30px">About Fastoosh</h1>
      ${para(settings?.aboutText || ORG.description)}
      ${Array.isArray(team) && team.length ? h2('Team') + list(team.filter(m => m?.name).map(m => `<strong>${esc(m.name)}</strong>${m.role ? ` — ${esc(m.role)}` : ''}${m.bio ? `<br/>${esc(plain(m.bio))}` : ''}`)) : ''}`,
  }, sitemap: { priority: '0.6' } });

  // ── Work with us ──
  pages.push({ route: '/work-with-us', key: 'work-with-us', page: {
    title: 'Work With Fastoosh — Start a Motion Design Project',
    description: 'Tell us about your video or motion design project. Fastoosh replies within 24–48 hours with next steps, timeline and budget.',
    image: DEFAULT_IMAGE, canonical: url('/work-with-us'),
    jsonLd: [{ '@context': 'https://schema.org', '@type': 'ContactPage', url: url('/work-with-us'), about: { '@id': `${SITE}/#organization` } }, crumbs([['Home', '/'], ['Work with us', '/work-with-us']])],
    body: `<h1 style="color:#fff;font-size:30px">Work with Fastoosh</h1>
      <p>Tell us about your project: what you need, your timeline and budget. We reply within 24–48 hours.</p>
      ${(home?.deliverables || []).length ? h2(home?.deliverablesTitle || 'What you get') + list(home.deliverables.map(esc)) : ''}
      ${(home?.turnaroundRows || []).length ? h2('Typical turnaround') + list(home.turnaroundRows.map(r => `${esc(r.label)} — ${esc(r.time)}`)) : ''}`,
  }, sitemap: { priority: '0.7' } });

  // ── Legal ──
  for (const [route, key, label, field] of [
    ['/terms', 'terms', 'Terms of Service', 'termsContent'],
    ['/privacy', 'privacy', 'Privacy Policy', 'privacyContent'],
    ['/refunds', 'refunds', 'Refund Policy', 'refundsContent'],
    ['/disclaimer', 'disclaimer', 'Disclaimer', 'disclaimerContent'],
  ]) {
    const content = typeof settings?.[field] === 'string' ? settings[field] : '';
    pages.push({ route, key, page: {
      title: `${label} | Fastoosh`, description: clip(content || `${label} for Fastoosh.`, 160),
      canonical: url(route), image: DEFAULT_IMAGE, jsonLd: [crumbs([['Home', '/'], [label, route]])],
      // Admin-written HTML (headings, paragraphs, lists) — kept as-is.
      body: `<h1 style="color:#fff;font-size:30px">${esc(label)}</h1>${content.replace(/<script[\s\S]*?<\/script>/gi, '')}`,
    }, sitemap: { priority: '0.2' } });
  }

  // ── write pages ──
  for (const entry of pages) {
    entry.page = withSeo(entry.key, entry.page);
    writeRoute(entry.route, renderPage(entry.page));
  }

  // ── sitemap.xml (with image + video extensions) ──
  const xml = (s) => esc(s);
  const today = new Date().toISOString().slice(0, 10);
  const urls = pages.filter(e => !e.page.noIndex).map(({ route, page, sitemap }) => {
    const parts = [`<loc>${xml(page.canonical || url(route))}</loc>`];
    parts.push(`<lastmod>${(sitemap.lastmod || today).slice(0, 10)}</lastmod>`);
    parts.push(`<priority>${sitemap.priority || '0.5'}</priority>`);
    for (const img of [...new Set(sitemap.images || [])].slice(0, 50)) parts.push(`<image:image><image:loc>${xml(img)}</image:loc></image:image>`);
    if (sitemap.video?.thumb && sitemap.video?.embed) {
      parts.push(`<video:video><video:thumbnail_loc>${xml(sitemap.video.thumb)}</video:thumbnail_loc><video:title>${xml(clip(sitemap.video.title, 100))}</video:title><video:description>${xml(clip(sitemap.video.description || sitemap.video.title, 2000))}</video:description><video:player_loc>${xml(sitemap.video.embed)}</video:player_loc><video:family_friendly>yes</video:family_friendly></video:video>`);
    }
    return `  <url>${parts.join('')}</url>`;
  });
  writeFileSync(join(DIST, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n${urls.join('\n')}\n</urlset>\n`);

  // robots.txt pointing at the www sitemap.
  writeFileSync(join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /account\nDisallow: /auth/\nDisallow: /dl/\nDisallow: /setup\nDisallow: /init\n\nSitemap: ${SITE}/sitemap.xml\n`);

  console.log(`[prerender] ✓ ${pages.length} pages, sitemap with ${urls.length} URLs (origin ${SITE})`);
}

main().catch(err => {
  // Never break the deploy over SEO: fall back to the plain SPA.
  console.warn('[prerender] skipped —', err?.message || err);
  try { copyFileSync(join(DIST, 'index.html'), join(DIST, 'app.html')); } catch { /* dist missing */ }
});
