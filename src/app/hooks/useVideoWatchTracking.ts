// Shared watch tracking for an embedded video (Bunny / Vimeo / YouTube iframe
// or a plain <video>). Used by the home showreel and the project gallery.
//
// Reports:
//   onView()               once, the first time the video actually plays
//   onWatch(secs, engaged) chunks of watch time, only counted while the video
//                          is playing, at least half on screen and the tab is
//                          visible. `engaged` is true exactly once, the first
//                          time on-screen time reaches ENGAGED_SECONDS.
//
// Each tracker only listens to ITS OWN player (message source check), so
// several videos on one page never count each other's playback.
import { useEffect, useRef, type RefObject } from 'react';
import Player from '@vimeo/player';
import { detectVideoProvider, subscribeBunnyPlayerEvents } from '../utils/videoProvider';

export const ENGAGED_SECONDS = 5;
const HEARTBEAT_MS = 10_000;

export type TrackableKind = 'bunny' | 'vimeo' | 'youtube' | 'direct';

/** Which tracker to use for a URL, or null when it can't be tracked. */
export function trackableKind(url: string | null | undefined): TrackableKind | null {
  const p = detectVideoProvider(url);
  return p === 'unknown' ? null : p;
}

interface Options {
  elementRef: RefObject<HTMLIFrameElement | HTMLVideoElement | null>;
  kind: TrackableKind | null;
  /** True once the element is mounted. */
  enabled: boolean;
  /** Re-bind (and start a fresh view) when this changes, e.g. the src. */
  bindKey?: unknown;
  onView: () => void;
  onWatch: (seconds: number, engaged: boolean) => void;
}

export function useVideoWatchTracking(opts: Options) {
  // Latest callbacks without re-binding the player on every render.
  const cb = useRef(opts);
  cb.current = opts;

  useEffect(() => {
    const el = opts.elementRef.current;
    const kind = opts.kind;
    if (!opts.enabled || !el || !kind) return;

    let playing = false;
    let start: number | null = null;   // set only while time is being counted
    let visible = true;
    let viewSent = false;
    let onScreen = 0;
    let engagedSent = false;

    const flush = (keepRunning: boolean) => {
      if (start === null) return;
      const secs = Math.floor((Date.now() - start) / 1000);
      // Keep the sub-second remainder when the clock keeps running.
      start = keepRunning ? start + secs * 1000 : null;
      if (secs <= 0) return;
      onScreen += secs;
      const engaged = !engagedSent && onScreen >= ENGAGED_SECONDS;
      if (engaged) engagedSent = true;
      cb.current.onWatch(secs, engaged);
    };
    const startClock = () => {
      if (playing && visible && !document.hidden && start === null) start = Date.now();
    };
    const onPlay = () => {
      if (playing) return;
      playing = true;
      if (!viewSent) { viewSent = true; cb.current.onView(); }
      startClock();
    };
    const onStop = () => { playing = false; flush(false); };

    const cleanups: Array<() => void> = [];

    if (kind === 'direct') {
      const v = el as HTMLVideoElement;
      v.addEventListener('playing', onPlay);
      v.addEventListener('pause', onStop);
      v.addEventListener('ended', onStop);
      cleanups.push(() => {
        v.removeEventListener('playing', onPlay);
        v.removeEventListener('pause', onStop);
        v.removeEventListener('ended', onStop);
      });
    } else if (kind === 'vimeo') {
      try {
        const player = new Player(el as HTMLIFrameElement);
        player.on('play', onPlay);
        player.on('pause', onStop);
        player.on('ended', onStop);
        cleanups.push(() => { try { player.off('play'); player.off('pause'); player.off('ended'); } catch { /* ignore */ } });
      } catch { /* player API unavailable — no tracking */ }
    } else {
      const iframe = el as HTMLIFrameElement;
      const onMsg = (e: MessageEvent) => {
        if (e.source !== iframe.contentWindow) return; // only this player
        try {
          const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
          if (kind === 'youtube') {
            const state = data?.info?.playerState; // 1 playing, 2 paused, 0 ended
            if (state === 1) onPlay();
            else if (state === 2 || state === 0) onStop();
            return;
          }
          const evt = data?.event ?? data?.type;
          // Bunny autoplay starts before we subscribe, so 'play' is often
          // missed — the first timeupdate means it is playing.
          if (evt === 'play' || evt === 'playing' || evt === 'timeupdate') onPlay();
          else if (evt === 'pause' || evt === 'paused' || evt === 'ended') onStop();
        } catch { /* not a player message */ }
      };
      window.addEventListener('message', onMsg);
      cleanups.push(() => window.removeEventListener('message', onMsg));
      if (kind === 'bunny') {
        cleanups.push(subscribeBunnyPlayerEvents(iframe));
      } else {
        const ping = window.setTimeout(() => {
          iframe.contentWindow?.postMessage(JSON.stringify({ event: 'listening', id: 1 }), 'https://www.youtube.com');
        }, 800);
        cleanups.push(() => window.clearTimeout(ping));
      }
    }

    // On screen? Count only while at least half of the video is visible.
    if (typeof IntersectionObserver !== 'undefined') {
      const io = new IntersectionObserver(([entry]) => {
        visible = entry.intersectionRatio >= 0.5;
        if (!visible) flush(false); else startClock();
      }, { threshold: [0, 0.5, 1] });
      io.observe(el);
      cleanups.push(() => io.disconnect());
    }

    const onVis = () => { if (document.hidden) flush(false); else startClock(); };
    document.addEventListener('visibilitychange', onVis);
    cleanups.push(() => document.removeEventListener('visibilitychange', onVis));

    const hb = window.setInterval(() => flush(true), HEARTBEAT_MS);
    cleanups.push(() => window.clearInterval(hb));

    return () => {
      flush(false); // send what's left (fetches use keepalive)
      cleanups.forEach(fn => fn());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.enabled, opts.kind, opts.bindKey]);
}
