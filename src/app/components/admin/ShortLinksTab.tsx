// Admin → Short links. Builds a UTM link and gives it a short address:
// fastoosh.com/go/<code>. Saved as the site setting `shortLinks`; the redirect
// is the Vercel function api/go.js, which also counts clicks (server KV).
import { useEffect, useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, Link2, Loader2, Pencil, Plus, Trash2, X } from 'lucide-react';
import { GlassCard } from '../shared/GlassCard';
import { Input } from '../ui/input';
import { API_BASE } from './adminShared';
import { publicAnonKey } from '/utils/supabase/info';

export interface ShortLink {
  code: string;
  url: string;          // final destination, UTM tags included
  base: string;         // page or URL before the tags
  utm: { source?: string; medium?: string; campaign?: string; content?: string };
  note?: string;
  createdAt: string;
  updatedAt?: string;
}

const headers = () => ({
  Authorization: `Bearer ${publicAnonKey}`,
  'X-Admin-Token': localStorage.getItem('admin_token') || '',
  'Content-Type': 'application/json',
});
const field = 'bg-black/50 border-white/20 text-white';

const SOURCES = ['instagram', 'linkedin', 'facebook', 'youtube', 'tiktok', 'x', 'behance', 'whatsapp', 'newsletter', 'email', 'qr'];
const MEDIUMS = ['social', 'bio', 'story', 'post', 'dm', 'email', 'ad', 'print', 'video'];
const PAGES = ['/', '/tools', '/projects', '/work-with-us', '/about', '/use-cases'];

const slugify = (s: string) => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);
const randomCode = () => Math.random().toString(36).slice(2, 7);

async function loadSettings(): Promise<any> {
  const s = await fetch(`${API_BASE}/settings`, { headers: headers() }).then(r => r.json());
  return s?.data || {};
}

/** Saves the list after re-reading it, so two open tabs don't erase each other's links. */
async function saveLinks(update: (links: ShortLink[]) => ShortLink[]): Promise<ShortLink[]> {
  const latest = await loadSettings();
  const next = update(Array.isArray(latest.shortLinks) ? latest.shortLinks : []);
  const res = await fetch(`${API_BASE}/settings`, { method: 'POST', headers: headers(), body: JSON.stringify({ shortLinks: next }) });
  const json = await res.json();
  if (!json.success) throw new Error(json.error || 'Save failed');
  return next;
}

/** UTM values in one consistent form ("Spring Launch" → "spring-launch"), so
 *  the same campaign isn't split in reports by spelling. */
const tag = (v?: string) => (v || '').trim().toLowerCase().replace(/\s+/g, '-');

function buildUrl(site: string, base: string, utm: ShortLink['utm']): string {
  const raw = base.trim() || '/';
  let u: URL;
  try { u = new URL(/^https?:\/\//i.test(raw) ? raw : `${site}${raw.startsWith('/') ? '' : '/'}${raw}`); }
  catch { return ''; }
  for (const [k, v] of Object.entries(utm)) {
    if (tag(v)) u.searchParams.set(`utm_${k}`, tag(v));
    else u.searchParams.delete(`utm_${k}`);
  }
  return u.toString();
}

const EMPTY = { code: '', base: '/', source: '', medium: '', campaign: '', content: '', note: '' };

export function ShortLinksTab() {
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [site, setSite] = useState('https://www.fastoosh.com');
  const [hits, setHits] = useState<Record<string, { count: number; lastAt?: string }> | null>(null);
  const [pages, setPages] = useState<string[]>(PAGES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState<string | null>(null); // code being edited
  const [codeTouched, setCodeTouched] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const s = await loadSettings();
        setLinks(Array.isArray(s.shortLinks) ? s.shortLinks : []);
        if (s.siteUrl) setSite(String(s.siteUrl).replace(/\/$/, ''));
      } catch { setMessage({ ok: false, text: 'Could not load the links.' }); }
      setLoading(false);
      fetch(`${API_BASE}/admin/short-links/hits`, { headers: headers() })
        .then(r => r.json()).then(j => setHits(j?.success ? j.data || {} : null)).catch(() => setHits(null));
      // Tool and project pages as destination suggestions.
      Promise.all([
        fetch(`${API_BASE}/tools`, { headers: headers() }).then(r => r.json()).catch(() => null),
        fetch(`${API_BASE}/projects`, { headers: headers() }).then(r => r.json()).catch(() => null),
      ]).then(([t, p]) => {
        const extra = [
          ...((t?.data || []) as any[]).filter(x => x?.slug).map(x => `/tools/${x.slug}`),
          ...((p?.data || []) as any[]).filter(x => x?.slug).map(x => `/projects/${x.slug}`),
        ];
        setPages([...PAGES, ...extra]);
      });
    })();
  }, []);

  const set = (k: keyof typeof EMPTY, v: string) => setForm(f => {
    const next = { ...f, [k]: v };
    // Suggest a code from campaign + source until the code is typed by hand.
    if (!editing && !codeTouched && (k === 'campaign' || k === 'source')) {
      next.code = slugify([next.campaign, next.source].filter(Boolean).join('-'));
    }
    return next;
  });

  const utm = { source: form.source, medium: form.medium, campaign: form.campaign, content: form.content };
  const preview = useMemo(() => buildUrl(site, form.base, utm),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [site, form.base, form.source, form.medium, form.campaign, form.content]);
  const code = slugify(form.code);
  const codeTaken = !editing && links.some(l => l.code === code);
  const canSave = !!code && !!preview && !codeTaken;

  const reset = () => { setForm(EMPTY); setEditing(null); setCodeTouched(false); };

  const save = async () => {
    if (!canSave) return;
    setSaving(true); setMessage(null);
    try {
      const now = new Date().toISOString();
      const next = await saveLinks(list => {
        const existing = list.find(l => l.code === (editing || code));
        const item: ShortLink = {
          code: editing || code, url: preview, base: form.base.trim() || '/',
          utm: Object.fromEntries(Object.entries(utm).filter(([, v]) => tag(v)).map(([k, v]) => [k, tag(v)])),
          note: form.note.trim() || undefined,
          createdAt: existing?.createdAt || now, ...(existing ? { updatedAt: now } : {}),
        };
        if (!editing && list.some(l => l.code === item.code)) throw new Error(`/go/${item.code} already exists.`);
        return existing ? list.map(l => (l.code === item.code ? item : l)) : [item, ...list];
      });
      setLinks(next);
      setMessage({ ok: true, text: editing ? `Updated /go/${editing}. The short link stays the same.` : `Created ${site}/go/${code}. It works within about 30 seconds.` });
      reset();
    } catch (err: any) {
      setMessage({ ok: false, text: err?.message || String(err) });
    }
    setSaving(false);
  };

  const remove = async (l: ShortLink) => {
    if (!confirm(`Delete ${site}/go/${l.code}? Anyone using it will land on the home page instead.`)) return;
    try { setLinks(await saveLinks(list => list.filter(x => x.code !== l.code))); if (editing === l.code) reset(); }
    catch (err: any) { setMessage({ ok: false, text: err?.message || String(err) }); }
  };

  const edit = (l: ShortLink) => {
    setEditing(l.code); setCodeTouched(true);
    setForm({ code: l.code, base: l.base || '/', source: l.utm?.source || '', medium: l.utm?.medium || '',
      campaign: l.utm?.campaign || '', content: l.utm?.content || '', note: l.note || '' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); setCopied(text); setTimeout(() => setCopied(''), 1500); } catch { /* ignore */ }
  };

  return (
    <div className="space-y-4">
      <GlassCard className="p-4 sm:p-6 space-y-5">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Link2 className="w-6 h-6 text-purple-300" /> Short links</h2>
          <p className="text-white/50 text-sm mt-1">
            Pick a page, add the campaign tags, and get a short link like <span className="text-white/70">{site.replace(/^https?:\/\//, '')}/go/spring-instagram</span>.
            Visits show up with their campaign in Traffic and Leads.
          </p>
        </div>

        {editing && (
          <div className="flex items-center justify-between rounded-lg border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-sm text-amber-100">
            <span>Editing /go/{editing} — the short link stays the same, only where it goes changes.</span>
            <button type="button" onClick={reset} className="text-amber-200 hover:text-white flex items-center gap-1"><X className="w-4 h-4" /> Cancel</button>
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="block text-sm text-white/80 mb-1.5">Destination — a page on the site or any full URL</label>
            <Input className={field} list="shortlink-pages" value={form.base} placeholder="/tools/your-tool or https://…" onChange={e => set('base', e.target.value)} />
            <datalist id="shortlink-pages">{pages.map(p => <option key={p} value={p} />)}</datalist>
          </div>
          <div>
            <label className="block text-sm text-white/80 mb-1.5">Source <span className="text-white/35">(utm_source — where the link is posted)</span></label>
            <Input className={field} list="shortlink-sources" value={form.source} placeholder="instagram" onChange={e => set('source', e.target.value.toLowerCase())} />
            <datalist id="shortlink-sources">{SOURCES.map(s => <option key={s} value={s} />)}</datalist>
          </div>
          <div>
            <label className="block text-sm text-white/80 mb-1.5">Medium <span className="text-white/35">(utm_medium — what kind of placement)</span></label>
            <Input className={field} list="shortlink-mediums" value={form.medium} placeholder="bio" onChange={e => set('medium', e.target.value.toLowerCase())} />
            <datalist id="shortlink-mediums">{MEDIUMS.map(s => <option key={s} value={s} />)}</datalist>
          </div>
          <div>
            <label className="block text-sm text-white/80 mb-1.5">Campaign <span className="text-white/35">(utm_campaign)</span></label>
            <Input className={field} value={form.campaign} placeholder="spring-launch" onChange={e => set('campaign', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-white/80 mb-1.5">Content <span className="text-white/35">(optional — tell two links apart)</span></label>
            <Input className={field} value={form.content} placeholder="reel-1" onChange={e => set('content', e.target.value)} />
          </div>
          <div>
            <label className="block text-sm text-white/80 mb-1.5">Short code</label>
            <div className="flex items-center gap-2">
              <span className="text-white/40 text-sm whitespace-nowrap">/go/</span>
              <Input className={field} value={form.code} disabled={!!editing} placeholder="spring-instagram"
                onChange={e => { setCodeTouched(true); set('code', e.target.value.toLowerCase()); }} />
              {!editing && (
                <button type="button" title="Random code" onClick={() => { setCodeTouched(true); set('code', randomCode()); }}
                  className="text-xs text-purple-300 hover:text-purple-200 whitespace-nowrap">Random</button>
              )}
            </div>
            {codeTaken && <p className="text-xs text-red-300 mt-1">/go/{code} is already used — pick another, or edit that link below.</p>}
          </div>
          <div>
            <label className="block text-sm text-white/80 mb-1.5">Note <span className="text-white/35">(only you see it)</span></label>
            <Input className={field} value={form.note} placeholder="Instagram bio, spring launch" onChange={e => set('note', e.target.value)} />
          </div>
        </div>

        <div className="rounded-lg border border-white/10 bg-black/30 p-3 space-y-1.5 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-white/40 w-20">Short link</span>
            <span className="text-purple-200 font-medium break-all">{code ? `${site}/go/${code}` : '—'}</span>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <span className="text-white/40 w-20">Goes to</span>
            <span className="text-white/60 break-all flex-1">{preview || 'Enter a valid page or URL'}</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={save} disabled={!canSave || saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold disabled:opacity-40">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {editing ? 'Save changes' : 'Create short link'}
          </button>
          {message && <p className={`text-sm ${message.ok ? 'text-emerald-300' : 'text-red-300'}`}>{message.text}</p>}
        </div>
      </GlassCard>

      <GlassCard className="p-4 sm:p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-white">Your links ({links.length})</h3>
          {hits === null && !loading && (
            <span className="text-xs text-amber-200/80">Click counts appear after the server update is deployed.</span>
          )}
        </div>
        {loading ? (
          <div className="text-white/50 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</div>
        ) : links.length === 0 ? (
          <p className="text-white/40 text-sm">No short links yet.</p>
        ) : (
          <div className="divide-y divide-white/8">
            {links.map(l => {
              const short = `${site}/go/${l.code}`;
              const h = hits?.[l.code];
              return (
                <div key={l.code} className="py-3 flex flex-col md:flex-row md:items-center gap-2 md:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-white font-medium">/go/{l.code}</span>
                      {[l.utm?.source, l.utm?.medium, l.utm?.campaign, l.utm?.content].filter(Boolean).map(t => (
                        <span key={t} className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-[11px] text-white/55">{t}</span>
                      ))}
                    </div>
                    <p className="text-xs text-white/40 truncate mt-0.5" title={l.url}>→ {l.url}</p>
                    {l.note && <p className="text-xs text-white/50 mt-0.5">{l.note}</p>}
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-white/60 whitespace-nowrap" title={h?.lastAt ? `Last click ${new Date(h.lastAt).toLocaleString()}` : ''}>
                      {hits === null ? '—' : `${h?.count || 0} click${h?.count === 1 ? '' : 's'}`}
                    </span>
                    <button type="button" onClick={() => copy(short)} title="Copy short link"
                      className="flex items-center gap-1 text-purple-300 hover:text-purple-200 whitespace-nowrap">
                      {copied === short ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied === short ? 'Copied' : 'Copy'}
                    </button>
                    <a href={short} target="_blank" rel="noreferrer" title="Open" className="text-white/40 hover:text-white"><ExternalLink className="w-4 h-4" /></a>
                    <button type="button" onClick={() => edit(l)} title="Change destination" className="text-white/40 hover:text-white"><Pencil className="w-4 h-4" /></button>
                    <button type="button" onClick={() => remove(l)} title="Delete" className="text-white/40 hover:text-red-300"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
