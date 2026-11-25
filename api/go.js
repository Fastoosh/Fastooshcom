// Short links: fastoosh.com/go/<code> → the destination saved in
// Admin → Short links (site setting `shortLinks`). Runs on Vercel, so the
// redirect happens before any page loads and link previews (WhatsApp,
// LinkedIn…) show the destination page.
const PROJECT_ID = 'ksndambbafpzxquxsgdw'; // same as utils/supabase/info.tsx
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtzbmRhbWJiYWZwenhxdXhzZ2R3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE3NDYzNjMsImV4cCI6MjA4NzMyMjM2M30.bZ2m03ZHXN4eSNiBN1ygE-OU73md-RudERUhKzNEPgg';
const API = `https://${PROJECT_ID}.supabase.co/functions/v1/make-server-e07959ec`;
const HEADERS = { Authorization: `Bearer ${ANON_KEY}`, 'Content-Type': 'application/json' };

// Link previews and crawlers follow the link but are not counted as clicks.
const BOT = /bot|crawl|spider|preview|facebookexternalhit|whatsapp|slack|telegram|discord|twitter|linkedin|embedly|skype|vkshare|pinterest|google-|headless/i;

// Settings are cached for 30 s per function instance.
let cache = { at: 0, links: [], site: '' };
async function loadLinks() {
  if (Date.now() - cache.at < 30_000) return cache;
  const res = await fetch(`${API}/settings`, { headers: HEADERS });
  const json = await res.json();
  const data = json?.data || {};
  cache = {
    at: Date.now(),
    links: Array.isArray(data.shortLinks) ? data.shortLinks : [],
    site: String(data.siteUrl || 'https://www.fastoosh.com').replace(/\/$/, ''),
  };
  return cache;
}

const withTimeout = (p, ms) => Promise.race([p, new Promise(r => setTimeout(r, ms))]);

export default async function handler(req, res) {
  const code = String(req.query?.code || '').toLowerCase().trim();
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  let target = 'https://www.fastoosh.com/';
  try {
    const { links, site } = await loadLinks();
    target = `${site}/`;
    const link = links.find(l => String(l?.code || '').toLowerCase() === code);
    if (link?.url && /^https?:\/\//i.test(link.url)) {
      target = link.url;
      if (!BOT.test(req.headers['user-agent'] || '')) {
        await withTimeout(fetch(`${API}/short-links/hit`, { method: 'POST', headers: HEADERS, body: JSON.stringify({ code }) }).catch(() => {}), 800);
      }
    }
  } catch { /* fall back to the home page */ }
  res.statusCode = 302;
  res.setHeader('Location', target);
  res.end();
}
