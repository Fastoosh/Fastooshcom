// Where a visitor came from, sent along with lead forms (Work With Us, free
// downloads) so the admin can see which page / site / campaign produced
// each lead.
//   • first touch (kept 90 days): the site that sent them, the first page they
//     landed on and any utm_ tags.
//   • this visit: the pages they viewed, in order (last 15).

export interface Attribution {
  referrer?: string;      // external site that sent them, '' = direct
  landingPage?: string;   // first page on fastoosh.com
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  firstSeen?: string;     // ISO date of the first visit
  pages?: string[];       // pages viewed this visit, oldest first
  submittedFrom?: string; // page the form was sent from
}

const FIRST_KEY = 'fastoosh_first_touch';
const PAGES_KEY = 'fastoosh_visit_pages';
const FIRST_TTL = 90 * 24 * 3600 * 1000;

const externalReferrer = () => {
  try {
    if (!document.referrer) return '';
    const u = new URL(document.referrer);
    return u.host === location.host ? '' : `${u.host}${u.pathname === '/' ? '' : u.pathname}`;
  } catch { return ''; }
};

/** Call on every page view. */
export function recordVisit(path: string) {
  try {
    const sp = new URLSearchParams(location.search);
    const utm = {
      utmSource: sp.get('utm_source') || undefined,
      utmMedium: sp.get('utm_medium') || undefined,
      utmCampaign: sp.get('utm_campaign') || undefined,
    };
    const raw = localStorage.getItem(FIRST_KEY);
    const first = raw ? JSON.parse(raw) : null;
    const expired = first?.firstSeen && Date.now() - new Date(first.firstSeen).getTime() > FIRST_TTL;
    // New first touch: nothing saved yet, it expired, or they came back from a tagged campaign.
    if (!first || expired || utm.utmSource) {
      localStorage.setItem(FIRST_KEY, JSON.stringify({
        referrer: externalReferrer(), landingPage: path, ...utm, firstSeen: new Date().toISOString(),
      }));
    }
    const pages: string[] = JSON.parse(sessionStorage.getItem(PAGES_KEY) || '[]');
    if (pages[pages.length - 1] !== path) pages.push(path);
    sessionStorage.setItem(PAGES_KEY, JSON.stringify(pages.slice(-15)));
  } catch { /* storage blocked — attribution is optional */ }
}

/** Attach to lead form submissions. */
export function getAttribution(): Attribution {
  try {
    const first = JSON.parse(localStorage.getItem(FIRST_KEY) || '{}') || {};
    const pages = JSON.parse(sessionStorage.getItem(PAGES_KEY) || '[]');
    return { ...first, pages: Array.isArray(pages) ? pages : [], submittedFrom: location.pathname };
  } catch {
    return { submittedFrom: typeof location !== 'undefined' ? location.pathname : '' };
  }
}

/** Short human label: "Google", "LinkedIn", "Campaign: spring (newsletter)", "Direct". */
export function sourceLabel(a?: Attribution | null): string {
  if (!a) return '';
  if (a.utmSource) return `${a.utmSource}${a.utmCampaign ? ` · ${a.utmCampaign}` : ''}${a.utmMedium ? ` (${a.utmMedium})` : ''}`;
  const r = (a.referrer || '').toLowerCase();
  if (!r) return a.landingPage ? 'Direct' : '';
  const known: [RegExp, string][] = [
    [/(^|\.)google\./, 'Google'], [/bing\.com/, 'Bing'], [/duckduckgo/, 'DuckDuckGo'], [/yahoo\./, 'Yahoo'],
    [/chatgpt\.com|openai\.com/, 'ChatGPT'], [/perplexity/, 'Perplexity'], [/claude\.ai/, 'Claude'], [/gemini\.google|bard\.google/, 'Gemini'],
    [/linkedin|lnkd\.in/, 'LinkedIn'], [/instagram/, 'Instagram'], [/facebook|fb\.com/, 'Facebook'],
    [/(^|\.)x\.com|twitter|t\.co$/, 'X / Twitter'], [/youtube|youtu\.be/, 'YouTube'], [/behance/, 'Behance'],
    [/dribbble/, 'Dribbble'], [/reddit/, 'Reddit'], [/tiktok/, 'TikTok'], [/gumroad/, 'Gumroad'],
    [/aescripts/, 'aescripts'], [/github/, 'GitHub'],
  ];
  for (const [re, name] of known) if (re.test(r.split('/')[0])) return name;
  return r.split('/')[0].replace(/^www\./, '');
}
