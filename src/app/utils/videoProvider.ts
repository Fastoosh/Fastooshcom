// Single source of truth for video URL detection + Bunny/Vimeo/YouTube URL
// derivations. Historically every embed site (ProjectDetail, Home, HomeTab,
// GuideTab, ToolDetail, Setup, VideoThumbnailCapture, VimeoPicker) rolled its
// own url.includes(...) checks — this module consolidates that so adding a
// fourth provider later is one edit, not nine.

export type VideoProvider = 'vimeo' | 'youtube' | 'bunny' | 'direct' | 'unknown';

// Fallbacks used when env-driven config is missing. Safe to hardcode: the
// library ID and CDN hostname appear in every public embed URL anyway.
const BUNNY_LIBRARY_ID_FALLBACK  = '684708';
const BUNNY_CDN_HOSTNAME_FALLBACK = 'vz-869cc91d-3f3.b-cdn.net';

// Client-side reads Bunny config from Vite env if present, else uses the
// fallback. The API key stays server-side; never referenced here.
export const BUNNY_LIBRARY_ID =
  (import.meta.env?.VITE_BUNNY_STREAM_LIBRARY_ID as string | undefined) || BUNNY_LIBRARY_ID_FALLBACK;
export const BUNNY_CDN_HOSTNAME =
  (import.meta.env?.VITE_BUNNY_STREAM_CDN_HOSTNAME as string | undefined) || BUNNY_CDN_HOSTNAME_FALLBACK;

export function detectVideoProvider(url: string | null | undefined): VideoProvider {
  if (!url) return 'unknown';
  const u = url.toLowerCase();
  if (u.includes('iframe.mediadelivery.net') || u.includes('b-cdn.net')) return 'bunny';
  if (u.includes('vimeo.com') || u.includes('player.vimeo')) return 'vimeo';
  if (u.includes('youtube.com') || u.includes('youtu.be')) return 'youtube';
  if (/\.(mp4|webm|mov|avi|m3u8)(\?|$)/i.test(url)) return 'direct';
  return 'unknown';
}

// Bunny embed URLs come in three shapes we might see in stored data:
//   1. https://iframe.mediadelivery.net/embed/{lib}/{guid}
//   2. https://iframe.mediadelivery.net/play/{lib}/{guid}
//   3. https://{cdn}.b-cdn.net/{guid}/playlist.m3u8   (raw HLS URL)
// This helper pulls the {guid} out of any of them; null if the URL isn't Bunny.
export function getBunnyVideoGuid(url: string | null | undefined): string | null {
  if (!url) return null;
  const embedMatch = url.match(/mediadelivery\.net\/(?:embed|play)\/\d+\/([0-9a-f-]+)/i);
  if (embedMatch) return embedMatch[1];
  const cdnMatch = url.match(/b-cdn\.net\/([0-9a-f-]+)/i);
  if (cdnMatch) return cdnMatch[1];
  return null;
}

// The canonical iframe URL, used by every embed site.
export function getBunnyEmbedUrl(url: string): string {
  const guid = getBunnyVideoGuid(url);
  if (!guid) return url;
  return `https://iframe.mediadelivery.net/embed/${BUNNY_LIBRARY_ID}/${guid}`;
}

// The direct MP4 URL. Used by VideoThumbnailCapture to feed a plain <video>
// element for frame extraction. Bunny's ABR ladder always publishes 720p as
// a stable filename, so we lean on that.
export function getBunnyDirectMp4Url(url: string): string | null {
  const guid = getBunnyVideoGuid(url);
  if (!guid) return null;
  return `https://${BUNNY_CDN_HOSTNAME}/${guid}/play_720p.mp4`;
}

export function getBunnyAutoThumbnailUrl(url: string): string | null {
  const guid = getBunnyVideoGuid(url);
  if (!guid) return null;
  return `https://${BUNNY_CDN_HOSTNAME}/${guid}/thumbnail.jpg`;
}

// Extract Vimeo/YouTube IDs from any of the common URL shapes. Kept here so
// old inline duplicates in components can migrate over time.
export function getVimeoId(url: string | null | undefined): string | null {
  if (!url) return null;
  return url.split('vimeo.com/')[1]?.split('?')[0]?.split('/').pop() ?? null;
}

export function getYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.includes('youtu.be/')) return url.split('youtu.be/')[1]?.split('?')[0] ?? null;
  return url.split('v=')[1]?.split('&')[0] ?? null;
}
