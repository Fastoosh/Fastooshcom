// Stats for the videos inside each project's media gallery (the main project
// video and the showreel are covered by the table above): plays, "stayed"
// (watched ≥5s on screen), on-screen watch time and average per play.
import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, Film, Loader2, Play } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { detectVideoProvider, getBunnyAutoThumbnailUrl } from '../../utils/videoProvider';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

interface GalleryVideo {
  url: string; position: number; plays: number; lastPlayed: string | null;
  title?: string | null; videoId?: string | null; provider?: string;
  engagedPlays?: number; totalWatchSeconds?: number; avgWatchSeconds?: number;
}
interface ProjectGallery {
  projectId: string; title: string; slug: string | null; imageUrl: string | null;
  totalPlays: number; totalEngaged?: number; totalWatchSeconds?: number; videos: GalleryVideo[];
}

function ago(iso: string | null) {
  if (!iso) return 'never';
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 3600) return `${Math.max(1, Math.floor(s / 60))}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function fmtDuration(total: number | undefined): string {
  const t = total ?? 0;
  if (t <= 0) return '—';
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function stayedLabel(engaged: number | undefined, plays: number) {
  if (plays <= 0) return '—';
  const e = engaged ?? 0;
  return `${e} · ${Math.round((e / plays) * 100)}%`;
}

function Thumb({ url }: { url: string }) {
  const provider = detectVideoProvider(url);
  const thumb = provider === 'bunny' ? getBunnyAutoThumbnailUrl(url) : null;
  return (
    <div className="w-16 h-10 rounded-md overflow-hidden bg-white/5 flex-shrink-0 flex items-center justify-center">
      {thumb
        ? <img src={thumb} alt="" loading="lazy" className="w-full h-full object-cover" />
        : <Film className="w-4 h-4 text-white/25" />}
    </div>
  );
}

// One small labelled number.
function Stat({ label, value, tone = 'text-white/80', title }: { label: string; value: string; tone?: string; title?: string }) {
  return (
    <div className="min-w-0" title={title}>
      <p className={`tabular-nums text-sm font-medium ${tone}`}>{value}</p>
      <p className="text-white/30 text-[10px] uppercase tracking-wider">{label}</p>
    </div>
  );
}

const STAYED_HINT = 'Plays watched at least 5 seconds with the video on screen';

export function GalleryStatsPanel() {
  const [data, setData] = useState<ProjectGallery[] | null>(null);
  const [error, setError] = useState('');
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/admin/gallery-stats`, {
          headers: { Authorization: `Bearer ${publicAnonKey}`, 'X-Admin-Token': localStorage.getItem('admin_token') || '' },
        });
        const json = await res.json();
        if (!json.success) throw new Error(json.error || 'Could not load gallery stats.');
        setData(json.data);
      } catch (err: any) {
        setError(err?.message || String(err));
      }
    })();
  }, []);

  return (
    <div className="rounded-2xl border border-white/8 bg-white/3 p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-1">
        <Play className="w-4 h-4 text-purple-400" />
        <h3 className="text-white font-semibold">Gallery videos</h3>
      </div>
      <p className="text-white/40 text-xs mb-4">
        Videos in each project's media gallery. A play counts once per video per visit. Watch time only counts while
        the video is playing and on screen; "stayed" means it was watched at least 5 seconds on screen.
      </p>

      {error && <p className="text-red-400 text-sm">{error}</p>}
      {!data && !error && (
        <p className="text-white/40 text-sm flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>
      )}
      {data && data.length === 0 && (
        <p className="text-white/35 text-sm">No project has videos in its gallery yet.</p>
      )}

      {data && data.length > 0 && (
        <div className="space-y-2">
          {data.map(p => {
            const isOpen = !!open[p.projectId];
            const top = Math.max(...p.videos.map(v => v.plays), 1);
            return (
              <div key={p.projectId} className="rounded-xl border border-white/8 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setOpen(o => ({ ...o, [p.projectId]: !o[p.projectId] }))}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/4 text-left"
                >
                  {isOpen ? <ChevronDown className="w-4 h-4 text-white/40 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-white/40 flex-shrink-0" />}
                  {p.imageUrl
                    ? <img src={p.imageUrl} alt="" className="w-10 h-7 rounded object-cover flex-shrink-0 opacity-80" />
                    : <div className="w-10 h-7 rounded bg-white/5 flex-shrink-0" />}
                  <span className="flex-1 min-w-0">
                    <span className="block text-white/85 text-sm font-medium truncate">{p.title}</span>
                    <span className="block text-white/35 text-[11px]">
                      {p.videos.length} video{p.videos.length !== 1 ? 's' : ''} in gallery
                      <span className="sm:hidden"> · {stayedLabel(p.totalEngaged, p.totalPlays)} stayed · {fmtDuration(p.totalWatchSeconds)}</span>
                    </span>
                  </span>
                  <span className="hidden sm:grid grid-cols-3 gap-4 text-right w-64 flex-shrink-0">
                    <Stat label="Plays" value={p.totalPlays.toLocaleString()} tone="text-white" />
                    <Stat label="Stayed" value={stayedLabel(p.totalEngaged, p.totalPlays)} tone="text-emerald-300/80" title={STAYED_HINT} />
                    <Stat label="Watch time" value={fmtDuration(p.totalWatchSeconds)} />
                  </span>
                  <span className="sm:hidden text-white font-semibold tabular-nums text-sm">{p.totalPlays.toLocaleString()}</span>
                </button>

                {isOpen && (
                  <div className="border-t border-white/6 divide-y divide-white/5">
                    {[...p.videos].sort((a, b) => b.plays - a.plays).map(v => (
                      <div key={v.url} className="flex flex-wrap sm:flex-nowrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                        <span className="text-white/25 text-[11px] font-mono w-6 text-right flex-shrink-0">#{v.position}</span>
                        <Thumb url={v.url} />
                        <div className="flex-1 min-w-[120px]">
                          <p className="text-white/85 text-sm truncate" title={v.title || undefined}>
                            {v.title || `Gallery video #${v.position}`}
                          </p>
                          {v.videoId && (
                            <button
                              type="button"
                              onClick={() => navigator.clipboard?.writeText(v.videoId!)}
                              className="text-white/30 hover:text-white/60 text-[10px] font-mono truncate max-w-full block mb-1"
                              title={`${v.provider === 'bunny' ? 'Bunny' : v.provider === 'vimeo' ? 'Vimeo' : v.provider === 'youtube' ? 'YouTube' : 'Video'} ID: ${v.videoId} (click to copy)`}
                            >
                              ID {v.videoId.length > 13 ? `${v.videoId.slice(0, 8)}…${v.videoId.slice(-4)}` : v.videoId}
                            </button>
                          )}
                          <div className="h-1.5 rounded-full bg-white/8 overflow-hidden">
                            <div className="h-full rounded-full bg-purple-500/70" style={{ width: `${Math.round((v.plays / top) * 100)}%` }} />
                          </div>
                          <p className="text-white/35 text-[11px] mt-1">Last played {ago(v.lastPlayed)}</p>
                        </div>
                        <div className="grid grid-cols-4 gap-3 sm:gap-4 w-full sm:w-80 text-left sm:text-right pl-9 sm:pl-0">
                          <Stat label="Plays" value={v.plays.toLocaleString()} tone="text-white" />
                          <Stat label="Stayed" value={stayedLabel(v.engagedPlays, v.plays)} tone="text-emerald-300/80" title={STAYED_HINT} />
                          <Stat label="Watch" value={fmtDuration(v.totalWatchSeconds)} />
                          <Stat label="Avg / play" value={fmtDuration(v.avgWatchSeconds)} />
                        </div>
                      </div>
                    ))}
                    {p.slug && (
                      <a
                        href={`/projects/${p.slug}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 px-3 py-2 text-xs text-purple-300/80 hover:text-purple-200"
                      >
                        <ExternalLink className="w-3 h-3" /> Open project page
                      </a>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
