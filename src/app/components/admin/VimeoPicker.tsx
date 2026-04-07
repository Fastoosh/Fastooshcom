import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Search, X, ChevronLeft, ChevronRight, Play,
  Loader2, AlertCircle, Video, LayoutGrid, List,
  CalendarDays, ArrowUpDown, SlidersHorizontal, CheckCircle2,
} from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

// ─── Types ────────────────────────────────────────────────────────────────────

interface VimeoVideo {
  id: string;
  title: string;
  description: string;
  duration: number;
  link: string;
  thumbnail: string | null;
  modifiedTime: string | null;
}

interface VimeoPickerProps {
  onSelect: (url: string, title: string) => void;
  onClose: () => void;
  /** URLs already in the gallery — used to render selected state */
  selectedUrls?: string[];
}

type ViewMode = 'grid' | 'list';
type SortKey  = 'date_desc' | 'date_asc' | 'alpha' | 'duration';

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'date_desc', label: 'Newest first'  },
  { value: 'date_asc',  label: 'Oldest first'  },
  { value: 'alpha',     label: 'Alphabetical'  },
  { value: 'duration',  label: 'By duration'   },
];

// Vimeo API params for each sort key
const SORT_PARAMS: Record<SortKey, { sort: string; direction: string }> = {
  date_desc: { sort: 'date',         direction: 'desc' },
  date_asc:  { sort: 'date',         direction: 'asc'  },
  alpha:     { sort: 'alphabetical', direction: 'asc'  },
  duration:  { sort: 'duration',     direction: 'desc' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  });
}

function buildHeaders(): Record<string, string> {
  const token = localStorage.getItem('admin_token') || '';
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${publicAnonKey}`,
    'X-Admin-Token': token,
  };
}

async function extractError(res: Response): Promise<string> {
  const rawText = await res.text().catch(() => '');
  console.error(`[VimeoPicker] HTTP ${res.status}:`, rawText);
  try {
    const json = JSON.parse(rawText);
    const msg = json.error?.message || json.error || json.message || JSON.stringify(json);
    return `Server error (${res.status}): ${msg}`;
  } catch {
    return rawText
      ? `Server error (${res.status}): ${rawText.slice(0, 200)}`
      : `Server returned HTTP ${res.status}`;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VimeoPicker({ onSelect, onClose, selectedUrls = [] }: VimeoPickerProps) {
  // Fetch state
  const [videos, setVideos]                 = useState<VimeoVideo[]>([]);
  const [loading, setLoading]               = useState(false);
  const [error, setError]                   = useState<string | null>(null);
  const [page, setPage]                     = useState(1);
  const [totalPages, setTotalPages]         = useState(1);
  const [total, setTotal]                   = useState(0);

  // Toolbar state
  const [query, setQuery]                   = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [sortBy, setSortBy]                 = useState<SortKey>('date_desc');
  const [dateFrom, setDateFrom]             = useState('');   // YYYY-MM-DD
  const [dateTo, setDateTo]                 = useState('');   // YYYY-MM-DD
  const [showFilters, setShowFilters]       = useState(false);
  const [viewMode, setViewMode]             = useState<ViewMode>('grid');
  const [hoveredId, setHoveredId]           = useState<string | null>(null);

  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search → reset to page 1
  useEffect(() => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setDebouncedQuery(query);
      setPage(1);
    }, 400);
    return () => { if (searchTimerRef.current) clearTimeout(searchTimerRef.current); };
  }, [query]);

  // Reset to page 1 when sort changes
  useEffect(() => { setPage(1); }, [sortBy]);

  // ── Fetch ──────────────────────────────────────────────────────────────────
  const fetchVideos = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const sp = SORT_PARAMS[sortBy];
      const params = new URLSearchParams({
        page:      String(page),
        sort:      sp.sort,
        direction: sp.direction,
      });
      if (debouncedQuery.trim()) params.set('query', debouncedQuery.trim());

      const res = await fetch(`${API_BASE}/admin/vimeo/videos?${params.toString()}`, {
        headers: buildHeaders(),
      });

      if (!res.ok) { setError(await extractError(res)); return; }

      let data: any;
      try { data = await res.json(); }
      catch (e) {
        console.error('[VimeoPicker] JSON parse error:', e);
        setError('Could not parse server response as JSON');
        return;
      }

      if (!data.success) {
        const msg = data.error || data.message || 'Server returned success:false with no message';
        console.error('[VimeoPicker] success:false:', data);
        setError(msg);
        return;
      }

      setVideos(data.videos ?? []);
      setTotal(data.total ?? 0);
      setTotalPages(data.totalPages ?? 1);
    } catch (err: any) {
      console.error('[VimeoPicker] fetch error:', err);
      setError(err?.message || 'Network error — could not reach the server');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedQuery, sortBy]);

  useEffect(() => { fetchVideos(); }, [fetchVideos]);

  // Trap scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  // ── Client-side date filter ─────────────────────────────────────────────────
  const visibleVideos = videos.filter((v) => {
    if (!v.modifiedTime) return true;
    const d = new Date(v.modifiedTime);
    if (dateFrom && d < new Date(dateFrom))                  return false;
    if (dateTo   && d > new Date(dateTo + 'T23:59:59'))      return false;
    return true;
  });

  const hasDateFilter = Boolean(dateFrom || dateTo);

  function clearFilters() {
    setDateFrom('');
    setDateTo('');
  }

  // ── Shared card actions ─────────────────────────────────────────────────────
  const handleSelect = (v: VimeoVideo) => onSelect(v.link, v.title);

  // ─────────────────────────────────────────────────────────────────────────────
  const modal = (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div
        className="bg-[#0a0a0f] border border-white/10 rounded-2xl w-full max-w-5xl flex flex-col shadow-2xl"
        style={{ height: 'calc(100vh - 2rem)', maxHeight: '860px' }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-[#1ab7ea]/20 flex items-center justify-center shrink-0">
              <Video className="w-4 h-4 text-[#1ab7ea]" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-lg leading-tight">Browse Vimeo Library</h2>
              {!loading && total > 0 && (
                <p className="text-gray-500 text-xs">
                  {total.toLocaleString()} video{total !== 1 ? 's' : ''}
                  {hasDateFilter && visibleVideos.length !== videos.length && (
                    <span className="text-[#1ab7ea]"> · {visibleVideos.length} matching filter</span>
                  )}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/10">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Toolbar ── */}
        <div className="px-6 py-3 border-b border-white/5 shrink-0 space-y-2">
          {/* Row 1 — Search + sort + view toggle */}
          <div className="flex gap-2 items-center">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search your videos…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full bg-white/5 border border-white/10 rounded-lg pl-9 pr-8 py-2 text-white placeholder-gray-600 focus:outline-none focus:border-[#1ab7ea]/50 focus:ring-1 focus:ring-[#1ab7ea]/30 transition text-sm"
                autoFocus
              />
              {query && (
                <button onClick={() => setQuery('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Sort */}
            <div className="relative">
              <ArrowUpDown className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500 pointer-events-none" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortKey)}
                className="appearance-none bg-white/5 border border-white/10 rounded-lg pl-7 pr-3 py-2 text-gray-300 text-sm focus:outline-none focus:border-[#1ab7ea]/50 transition cursor-pointer"
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value} className="bg-[#0a0a0f]">{o.label}</option>
                ))}
              </select>
            </div>

            {/* Filter toggle */}
            <button
              onClick={() => setShowFilters((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm transition shrink-0 ${
                showFilters || hasDateFilter
                  ? 'bg-[#1ab7ea]/15 border-[#1ab7ea]/40 text-[#1ab7ea]'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:text-white hover:border-white/20'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Filters</span>
              {hasDateFilter && (
                <span className="w-1.5 h-1.5 rounded-full bg-[#1ab7ea] shrink-0" />
              )}
            </button>

            {/* View toggle */}
            <div className="flex rounded-lg border border-white/10 overflow-hidden shrink-0">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 transition ${viewMode === 'grid' ? 'bg-[#1ab7ea]/20 text-[#1ab7ea]' : 'bg-white/5 text-gray-500 hover:text-gray-300'}`}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 transition border-l border-white/10 ${viewMode === 'list' ? 'bg-[#1ab7ea]/20 text-[#1ab7ea]' : 'bg-white/5 text-gray-500 hover:text-gray-300'}`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Row 2 — Date filter (collapsible) */}
          {showFilters && (
            <div className="flex items-center gap-3 pt-1">
              <CalendarDays className="w-4 h-4 text-gray-500 shrink-0" />
              <span className="text-gray-500 text-xs shrink-0">Modified between</span>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-[#1ab7ea]/50 transition [color-scheme:dark]"
              />
              <span className="text-gray-600 text-xs shrink-0">and</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-white text-xs focus:outline-none focus:border-[#1ab7ea]/50 transition [color-scheme:dark]"
              />
              {hasDateFilter && (
                <button
                  onClick={clearFilters}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-white transition ml-1"
                >
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
          )}
        </div>

        {/* ── Content ── */}
        <div className="flex-1 overflow-y-auto min-h-0 px-6 py-4">
          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-500">
              <Loader2 className="w-8 h-8 animate-spin text-[#1ab7ea]" />
              <span className="text-sm">Loading your videos…</span>
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-red-400">
              <AlertCircle className="w-8 h-8" />
              <span className="text-sm font-medium">Failed to load videos</span>
              <span className="text-xs text-gray-500 max-w-lg text-center break-words">{error}</span>
              <button onClick={fetchVideos} className="mt-2 px-4 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-sm transition">
                Try again
              </button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && visibleVideos.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-500">
              <Video className="w-10 h-10 opacity-30" />
              <span className="text-sm text-center">
                {hasDateFilter && videos.length > 0
                  ? 'No videos match the selected date range on this page'
                  : debouncedQuery
                  ? `No videos found for "${debouncedQuery}"`
                  : 'No videos found in your library'}
              </span>
              {hasDateFilter && videos.length > 0 && (
                <button onClick={clearFilters} className="text-xs text-[#1ab7ea] hover:underline">Clear date filter</button>
              )}
            </div>
          )}

          {/* Grid view */}
          {!loading && !error && visibleVideos.length > 0 && viewMode === 'grid' && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {visibleVideos.map((video) => {
                const isSelected = selectedUrls.includes(video.link);
                return (
                <button
                  key={video.id}
                  onClick={() => handleSelect(video)}
                  onMouseEnter={() => setHoveredId(video.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`group relative rounded-xl overflow-hidden border-2 bg-white/5 text-left transition-all duration-200 hover:scale-[1.02] hover:shadow-lg focus:outline-none ${
                    isSelected
                      ? 'border-[#1ab7ea] shadow-[0_0_12px_rgba(26,183,234,0.35)]'
                      : 'border-white/10 hover:border-[#1ab7ea]/60 hover:shadow-[#1ab7ea]/10'
                  }`}
                >
                  {/* Thumbnail */}
                  <div className="aspect-video bg-black relative overflow-hidden">
                    {video.thumbnail ? (
                      <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="w-8 h-8 text-gray-700" />
                      </div>
                    )}
                    {/* Play overlay — hidden when selected and not hovered */}
                    {!isSelected && (
                      <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity duration-200 ${hoveredId === video.id ? 'opacity-100' : 'opacity-0'}`}>
                        <div className="w-10 h-10 rounded-full bg-[#1ab7ea] flex items-center justify-center shadow-lg">
                          <Play className="w-4 h-4 text-white fill-white ml-0.5" />
                        </div>
                      </div>
                    )}
                    {/* Selected checkmark overlay */}
                    {isSelected && (
                      <div className="absolute inset-0 bg-[#1ab7ea]/20 flex items-center justify-center">
                        <div className="w-10 h-10 rounded-full bg-[#1ab7ea] flex items-center justify-center shadow-lg shadow-[#1ab7ea]/40">
                          <CheckCircle2 className="w-6 h-6 text-white" />
                        </div>
                      </div>
                    )}
                    {/* Duration badge */}
                    {video.duration > 0 && (
                      <div className="absolute bottom-1.5 right-1.5 bg-black/80 text-white text-[10px] font-mono px-1.5 py-0.5 rounded">
                        {formatDuration(video.duration)}
                      </div>
                    )}
                    {/* Selected badge top-left */}
                    {isSelected && (
                      <div className="absolute top-1.5 left-1.5 bg-[#1ab7ea] text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow">
                        ✓ Added
                      </div>
                    )}
                  </div>
                  {/* Info */}
                  <div className="p-2.5">
                    <p className={`text-xs font-medium line-clamp-2 leading-snug transition-colors ${isSelected ? 'text-[#1ab7ea]' : 'text-white group-hover:text-[#1ab7ea]'}`}>
                      {video.title}
                    </p>
                    {video.modifiedTime && (
                      <p className="text-gray-600 text-[10px] mt-1">{formatDate(video.modifiedTime)}</p>
                    )}
                  </div>
                </button>
                );
              })}
            </div>
          )}

          {/* List view */}
          {!loading && !error && visibleVideos.length > 0 && viewMode === 'list' && (
            <div className="flex flex-col divide-y divide-white/5">
              {visibleVideos.map((video) => {
                const isSelected = selectedUrls.includes(video.link);
                return (
                <div
                  key={video.id}
                  className={`group flex items-center gap-4 py-3 rounded-lg px-2 -mx-2 transition cursor-pointer ${
                    isSelected ? 'bg-[#1ab7ea]/8 border border-[#1ab7ea]/25' : 'hover:bg-white/[0.03]'
                  }`}
                  onClick={() => handleSelect(video)}
                  onMouseEnter={() => setHoveredId(video.id)}
                  onMouseLeave={() => setHoveredId(null)}
                >
                  {/* Thumbnail */}
                  <div className={`w-24 h-[54px] rounded-md overflow-hidden bg-black shrink-0 relative border ${isSelected ? 'border-[#1ab7ea]/50' : 'border-transparent'}`}>
                    {video.thumbnail ? (
                      <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Video className="w-5 h-5 text-gray-700" />
                      </div>
                    )}
                    {isSelected ? (
                      <div className="absolute inset-0 bg-[#1ab7ea]/30 flex items-center justify-center">
                        <CheckCircle2 className="w-5 h-5 text-white drop-shadow" />
                      </div>
                    ) : (
                      <div className={`absolute inset-0 bg-black/50 flex items-center justify-center transition-opacity ${hoveredId === video.id ? 'opacity-100' : 'opacity-0'}`}>
                        <Play className="w-4 h-4 text-white fill-white" />
                      </div>
                    )}
                  </div>

                  {/* Meta */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate transition-colors ${isSelected ? 'text-[#1ab7ea]' : 'text-white group-hover:text-[#1ab7ea]'}`}>
                      {video.title}
                    </p>
                    {video.description && (
                      <p className="text-gray-600 text-xs mt-0.5 truncate">{video.description}</p>
                    )}
                  </div>

                  {/* Duration */}
                  <span className="text-gray-500 text-xs font-mono shrink-0 tabular-nums w-12 text-right">
                    {video.duration > 0 ? formatDuration(video.duration) : '—'}
                  </span>

                  {/* Date */}
                  <span className="text-gray-600 text-xs shrink-0 w-28 text-right">
                    {formatDate(video.modifiedTime)}
                  </span>

                  {/* Select / Added button */}
                  <button
                    onClick={(e) => { e.stopPropagation(); handleSelect(video); }}
                    className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border transition ${
                      isSelected
                        ? 'bg-[#1ab7ea]/20 border-[#1ab7ea]/50 text-[#1ab7ea] opacity-100'
                        : 'bg-[#1ab7ea]/10 hover:bg-[#1ab7ea]/25 text-[#1ab7ea] border-[#1ab7ea]/20 opacity-0 group-hover:opacity-100'
                    }`}
                  >
                    {isSelected ? (
                      <span className="flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Added</span>
                    ) : 'Select'}
                  </button>
                </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Pagination ── */}
        {!loading && !error && totalPages > 1 && (
          <div className="flex items-center justify-between px-6 py-3 border-t border-white/10 shrink-0">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-sm disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>

            <span className="text-gray-500 text-sm">Page {page} of {totalPages}</span>

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page >= totalPages}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 text-sm disabled:opacity-30 disabled:cursor-not-allowed transition"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}