// How a page appears in Google, as a shared link (LinkedIn / Facebook /
// WhatsApp / X) and as a Pinterest pin. Uses the editor's values where they
// are filled in, otherwise what the live site currently serves.
import { useEffect, useState } from 'react';
import { Globe, Loader2 } from 'lucide-react';
import { fetchLivePage, SITE_ORIGIN, type LivePage } from '../../utils/liveSeo';

interface Draft { title?: string; description?: string; ogTitle?: string; ogDescription?: string; ogImage?: string }

const cut = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);

export function SeoPreviews({ path, draft }: { path: string; draft: Draft }) {
  const [live, setLive] = useState<LivePage | null>(null);
  const [tab, setTab] = useState<'google' | 'social' | 'pinterest'>('google');

  useEffect(() => {
    let cancelled = false;
    setLive(null);
    fetchLivePage(path).then(p => { if (!cancelled) setLive(p); });
    return () => { cancelled = true; };
  }, [path]);

  const title = draft.title?.trim() || live?.title || '';
  const description = draft.description?.trim() || live?.description || '';
  const ogTitle = draft.ogTitle?.trim() || draft.title?.trim() || live?.ogTitle || title;
  const ogDescription = draft.ogDescription?.trim() || draft.description?.trim() || live?.ogDescription || description;
  const image = draft.ogImage?.trim() || live?.ogImage || '';
  const crumbs = `www.fastoosh.com${path === '/' ? '' : ' › ' + path.replace(/^\//, '').split('/').join(' › ')}`;
  const edited = !!(draft.title || draft.description || draft.ogTitle || draft.ogDescription || draft.ogImage);

  return (
    <div className="rounded-xl border border-white/10 bg-white/3 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-white/40">Preview</p>
        <div className="flex gap-1">
          {([['google', 'Google'], ['social', 'Shared link'], ['pinterest', 'Pinterest']] as const).map(([v, l]) => (
            <button key={v} type="button" onClick={() => setTab(v)}
              className={`px-2.5 py-1 rounded-md text-xs ${tab === v ? 'bg-purple-500/25 text-white' : 'text-white/45 hover:text-white/80'}`}>{l}</button>
          ))}
        </div>
      </div>

      {!live ? (
        <p className="text-xs text-white/40 flex items-center gap-2 py-6 justify-center"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Reading the live page…</p>
      ) : tab === 'google' ? (
        <div className="rounded-lg bg-white p-4 max-w-[600px]">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center"><Globe className="w-4 h-4 text-gray-500" /></span>
            <span className="min-w-0">
              <span className="block text-[13px] text-[#202124] leading-tight">Fastoosh</span>
              <span className="block text-[12px] text-[#4d5156] leading-tight truncate">{crumbs}</span>
            </span>
          </div>
          <p className="text-[19px] leading-snug text-[#1a0dab] hover:underline cursor-pointer">{cut(title || 'Untitled page', 62)}</p>
          <p className="text-[13px] leading-relaxed text-[#4d5156] mt-0.5">{description ? cut(description, 158) : <em>No description — Google will pick text from the page.</em>}</p>
        </div>
      ) : tab === 'social' ? (
        <div className="max-w-[520px] rounded-lg overflow-hidden border border-white/15 bg-[#1d2226]">
          {image ? (
            <div className="aspect-[1.91/1] bg-black/40">
              <img src={image} alt="" referrerPolicy="no-referrer" className="w-full h-full object-cover" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            </div>
          ) : (
            <div className="aspect-[1.91/1] flex items-center justify-center text-xs text-red-300 bg-red-500/10">No preview image</div>
          )}
          <div className="p-3">
            <p className="text-[11px] uppercase text-white/45">fastoosh.com</p>
            <p className="text-white font-semibold text-sm leading-snug">{cut(ogTitle || 'Untitled', 90)}</p>
            <p className="text-white/55 text-xs mt-0.5">{cut(ogDescription, 120)}</p>
          </div>
        </div>
      ) : (
        <div className="w-[236px] rounded-2xl overflow-hidden bg-white">
          {image ? (
            <img src={image} alt="" referrerPolicy="no-referrer" className="w-full object-cover" style={{ aspectRatio: '2 / 3' }} onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <div className="flex items-center justify-center text-xs text-red-500 bg-red-50" style={{ aspectRatio: '2 / 3' }}>No image</div>
          )}
          <div className="p-3">
            <p className="text-[13px] font-semibold text-[#111] leading-snug">{cut(ogTitle || 'Untitled', 70)}</p>
            <p className="text-[11px] text-[#5f5f5f] mt-1">fastoosh.com</p>
          </div>
        </div>
      )}

      <p className="text-[11px] text-white/35 mt-3">
        {!live.ok ? `Could not read the live page (${live.error}).`
          : !live.published ? 'This page is not in the published site yet — crawlers currently see a blank page. Republish to fix.'
          : edited ? 'Shows your edits. Save, then Republish so crawlers see them.'
          : `What crawlers see now at ${SITE_ORIGIN}${path}.`}
        {tab === 'pinterest' && ' Pinterest crops to the pin shape — vertical images (2:3) work best.'}
      </p>
    </div>
  );
}
