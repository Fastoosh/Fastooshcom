// Browse-and-select modal for the Bunny Stream library. Mirrors VimeoPicker's
// onSelect/onClose interface, so parents can drop it in next to VimeoPicker
// without changing anything else.
//
// Simpler than VimeoPicker on purpose: search + grid + pagination only. If
// admins ask later, sort/date-filter/list-view can be added — but the common
// case is "find the video I just uploaded" which just needs search + recent-
// first ordering.
import { useEffect, useRef, useState } from "react";
import { X, Search, Loader2, Video, Check, ChevronLeft, ChevronRight, Play, Folder, ListPlus } from "lucide-react";
import { projectId, publicAnonKey } from "/utils/supabase/info";

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

interface BunnyVideo {
  guid: string;
  title: string;
  description: string;
  length: number;        // seconds
  width: number;
  height: number;
  views: number;
  status: number;        // 4 = playable
  dateUploaded: string | null;
  thumbnail: string;
  embedUrl: string;
}

interface BunnyPickerProps {
  onSelect: (embedUrl: string, title: string) => void;
  onClose: () => void;
  // Optional — if provided, videos whose embedUrl is already in the set get a
  // subtle "selected" indicator. Same shape VimeoPicker uses for gallery mode.
  selectedUrls?: string[];
  // Optional — when provided, picking a collection shows an "Add all" button
  // that loads every playable video in it and hands them over in one call.
  // Used by the project media gallery; the parent then lets the admin prune.
  onSelectMany?: (items: { url: string; title: string }[]) => void;
}

interface BunnyCollection {
  guid: string;
  name: string;
  videoCount: number;
}

function fmtDuration(seconds: number): string {
  if (!seconds || seconds < 0) return '—';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  } catch { return ''; }
}

export function BunnyPicker({ onSelect, onClose, selectedUrls = [], onSelectMany }: BunnyPickerProps) {
  const [collections, setCollections] = useState<BunnyCollection[]>([]);
  const [collectionId, setCollectionId] = useState('');
  const [addingAll, setAddingAll] = useState(false);
  const [addAllError, setAddAllError] = useState('');
  const [videos,   setVideos]   = useState<BunnyVideo[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [error,    setError]    = useState('');
  const [page,     setPage]     = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total,    setTotal]    = useState(0);
  const [query,    setQuery]    = useState('');
  const debounceRef = useRef<number | null>(null);

  const authHeaders = () => {
    const adminToken = localStorage.getItem('admin_token') ?? '';
    return {
      Authorization:   `Bearer ${publicAnonKey}`,
      'X-Admin-Token': adminToken,
    };
  };

  const load = async (nextPage = page, nextQuery = query, nextCollection = collectionId) => {
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams({
        page:         String(nextPage),
        itemsPerPage: '24',
        orderBy:      '-date',   // newest first
      });
      if (nextQuery.trim()) qs.set('search', nextQuery.trim());
      if (nextCollection) qs.set('collection', nextCollection);
      const res = await fetch(`${API_BASE}/admin/bunny/videos?${qs}`, { headers: authHeaders() });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || 'Server refused the list.');
      setVideos(data.videos ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch (err: any) {
      console.error('[BunnyPicker] load error:', err);
      setError(err?.message || 'Could not load your Bunny library.');
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => { load(1, ''); /* eslint-disable-next-line */ }, []);

  // Collections list (for the filter dropdown). Failure is non-fatal — the
  // dropdown simply stays empty and the picker works as before.
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/bunny/collections?itemsPerPage=100`, { headers: authHeaders() });
        const data = await res.json();
        if (data?.success) setCollections(data.collections ?? []);
      } catch (err) {
        console.warn('[BunnyPicker] collections load failed:', err);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const changeCollection = (id: string) => {
    setCollectionId(id);
    setAddAllError('');
    setPage(1);
    load(1, query, id);
  };

  // Fetch every playable video in the selected collection (all pages) and
  // hand the ones not already in the gallery to the parent in one batch.
  const addAllFromCollection = async () => {
    if (!collectionId || !onSelectMany) return;
    setAddingAll(true);
    setAddAllError('');
    try {
      const all: BunnyVideo[] = [];
      let p = 1;
      let pages = 1;
      do {
        const qs = new URLSearchParams({
          page: String(p), itemsPerPage: '100', orderBy: '-date', collection: collectionId,
        });
        const res = await fetch(`${API_BASE}/admin/bunny/videos?${qs}`, { headers: authHeaders() });
        const data = await res.json();
        if (!data?.success) throw new Error(data?.error || 'Server refused the list.');
        all.push(...(data.videos ?? []));
        pages = data.totalPages ?? 1;
        p++;
      } while (p <= pages && p <= 50);

      const items = all
        .filter(v => v.status >= 4 && !selectedUrls.includes(v.embedUrl))
        .map(v => ({ url: v.embedUrl, title: v.title }));
      onSelectMany(items);
    } catch (err: any) {
      console.error('[BunnyPicker] add-all error:', err);
      setAddAllError(err?.message || 'Could not load the collection.');
    } finally {
      setAddingAll(false);
    }
  };

  const activeCollection = collections.find(c => c.guid === collectionId);

  // Debounced search — kick off a new load 400ms after typing stops
  useEffect(() => {
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      setPage(1);
      load(1, query);
    }, 400);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const goToPage = (p: number) => {
    const clamped = Math.max(1, Math.min(totalPages, p));
    setPage(clamped);
    load(clamped, query);
  };

  const handleSelect = (v: BunnyVideo) => onSelect(v.embedUrl, v.title);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div
        className="bg-[#0a0a0f] border border-white/10 rounded-2xl w-full max-w-5xl flex flex-col shadow-2xl"
        style={{ height: 'calc(100vh - 2rem)', maxHeight: '860px' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-orange-500/20 flex items-center justify-center shrink-0">
              <Video className="w-4 h-4 text-orange-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-lg leading-tight">Browse Bunny Library</h2>
              {!loading && total > 0 && (
                <p className="text-gray-500 text-xs">
                  {total.toLocaleString()} video{total !== 1 ? 's' : ''}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search + collection filter */}
        <div className="px-6 py-3 border-b border-white/5 shrink-0 space-y-3">
          <div className="flex flex-col sm:flex-row gap-2">
          {collections.length > 0 && (
            <div className="relative sm:w-64 shrink-0">
              <Folder className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <select
                value={collectionId}
                onChange={e => changeCollection(e.target.value)}
                className="w-full appearance-none bg-white/5 border border-white/10 rounded-lg pl-9 pr-3 py-2 text-white focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30 transition text-sm [&>option]:bg-[#0a0a0f]"
                aria-label="Filter by collection"
              >
                <option value="">All videos</option>
                {collections.map(col => (
                  <option key={col.guid} value={col.guid}>
                    {col.name} ({col.videoCount})
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search your Bunny videos…"
              value={query}
              onChange={e => setQuery(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-8 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-orange-500/50 focus:ring-1 focus:ring-orange-500/30 transition text-sm"
              autoFocus
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                aria-label="Clear search"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          </div>

          {/* Add-all bar — only in gallery mode with a collection chosen */}
          {onSelectMany && activeCollection && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 px-3 py-2">
              <p className="text-orange-200 text-xs">
                Load every video from <span className="font-semibold">{activeCollection.name}</span> into the gallery,
                then remove the ones you don't want from the gallery list.
                {addAllError && <span className="block text-red-300 mt-1">{addAllError}</span>}
              </p>
              <button
                type="button"
                onClick={addAllFromCollection}
                disabled={addingAll}
                className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-500 hover:bg-orange-400 text-white text-xs font-semibold whitespace-nowrap disabled:opacity-60 disabled:cursor-wait transition"
              >
                {addingAll
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</>
                  : <><ListPlus className="w-3.5 h-3.5" /> Add all ({activeCollection.videoCount})</>}
              </button>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin text-orange-400" />
              <span className="text-sm">Loading your Bunny library…</span>
            </div>
          )}

          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-16 gap-3">
              <div className="w-12 h-12 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center">
                <X className="w-6 h-6 text-red-400" />
              </div>
              <p className="text-red-300 text-sm text-center max-w-md">{error}</p>
              <button
                onClick={() => load(page, query)}
                className="text-orange-400 hover:text-orange-300 text-sm underline"
              >
                Try again
              </button>
            </div>
          )}

          {!loading && !error && videos.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                <Video className="w-6 h-6 text-white/25" />
              </div>
              <p className="text-white/60 font-semibold">No videos found</p>
              <p className="text-white/30 text-sm text-center max-w-xs">
                {query
                  ? `Nothing matches "${query}". Try a different search.`
                  : activeCollection
                    ? `The "${activeCollection.name}" collection has no videos.`
                    : 'Your Bunny library is empty. Upload one from the project form.'}
              </p>
            </div>
          )}

          {!loading && !error && videos.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {videos.map(v => {
                const isAlreadySelected = selectedUrls.includes(v.embedUrl);
                const isPlayable = v.status >= 4;
                return (
                  <button
                    key={v.guid}
                    type="button"
                    disabled={!isPlayable}
                    onClick={() => isPlayable && handleSelect(v)}
                    className={`group text-left rounded-xl overflow-hidden border transition-all
                      ${isAlreadySelected
                        ? 'border-orange-400/60 ring-2 ring-orange-400/30'
                        : 'border-white/10 hover:border-orange-500/40'}
                      ${!isPlayable ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer hover:-translate-y-0.5'}
                      bg-white/3 hover:bg-white/5`}
                  >
                    {/* Thumbnail */}
                    <div className="relative aspect-video overflow-hidden bg-black/40">
                      {v.thumbnail ? (
                        <img
                          src={v.thumbnail}
                          alt={v.title}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Video className="w-8 h-8 text-white/20" />
                        </div>
                      )}
                      {/* Play overlay */}
                      {isPlayable && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40">
                          <div className="w-12 h-12 rounded-full bg-orange-500/90 flex items-center justify-center">
                            <Play className="w-5 h-5 text-white ml-0.5" />
                          </div>
                        </div>
                      )}
                      {/* Duration badge */}
                      {v.length > 0 && (
                        <span className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/70 text-white text-[11px] font-medium">
                          {fmtDuration(v.length)}
                        </span>
                      )}
                      {/* Selected badge */}
                      {isAlreadySelected && (
                        <span className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500 text-white text-[10px] font-bold">
                          <Check className="w-3 h-3" /> In gallery
                        </span>
                      )}
                      {/* Not-yet-encoded badge */}
                      {!isPlayable && (
                        <span className="absolute top-2 left-2 px-2 py-0.5 rounded-full bg-amber-500/90 text-white text-[10px] font-bold">
                          Encoding…
                        </span>
                      )}
                    </div>
                    {/* Meta */}
                    <div className="p-3">
                      <p className="text-white text-sm font-semibold truncate">{v.title}</p>
                      <p className="text-white/40 text-xs mt-0.5">
                        {v.views > 0 && <>{v.views.toLocaleString()} view{v.views !== 1 ? 's' : ''} · </>}
                        {fmtDate(v.dateUploaded)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        {!loading && !error && totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-white/10 shrink-0">
            <button
              onClick={() => goToPage(page - 1)}
              disabled={page <= 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-sm disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="w-4 h-4" /> Previous
            </button>
            <span className="text-white/40 text-xs">Page {page} of {totalPages}</span>
            <button
              onClick={() => goToPage(page + 1)}
              disabled={page >= totalPages}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 text-sm disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              Next <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
