import { useParams } from "react-router";
import { useState, useEffect, useRef, useCallback } from "react";
import Player from '@vimeo/player';
import { motion } from "motion/react";
import { GlassCard } from "../components/shared/GlassCard";
import { NeonButton } from "../components/shared/NeonButton";
import { SeoHead } from "../components/shared/SeoHead";
import { ArrowLeft, Play, Volume2 } from "lucide-react";
import { api } from "../utils/api";
import { projectId as supabaseProjectId, publicAnonKey } from '/utils/supabase/info';
import { useTranslation } from 'react-i18next';
import { fetchTranslations, deepMergeTranslations } from '../utils/translations';
import { detectVideoProvider, getBunnyEmbedUrl, getBunnyAutoThumbnailUrl, subscribeBunnyPlayerEvents } from '../utils/videoProvider';

// Gallery tile for a Bunny video: shows the CDN thumbnail with a play button
// and only mounts the iframe player on click, so a gallery of many videos
// doesn't spin up dozens of players at once.
// Aspect ratio: Bunny renders the thumbnail at the video's own dimensions, so
// the image's natural size gives the real ratio (vertical, square, etc.).
// Falls back to 16:9 until it loads or if it fails.
function BunnyGalleryItem({ url, title, onPlay }: { url: string; title: string; onPlay?: () => void }) {
  const [playing, setPlaying] = useState(false);
  const [ratio, setRatio] = useState<number>(16 / 9);
  const thumb = getBunnyAutoThumbnailUrl(url);
  if (playing) {
    const src = `${getBunnyEmbedUrl(url)}?autoplay=true&preload=true&responsive=true`;
    return (
      <div className="relative w-full bg-black" style={{ aspectRatio: ratio }}>
        <iframe
          src={src}
          title={title}
          className="absolute inset-0 w-full h-full"
          style={{ border: 0 }}
          allow="accelerometer; gyroscope; autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
        />
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={() => { setPlaying(true); onPlay?.(); }}
      className="group relative block w-full bg-black/40 cursor-pointer"
      style={{ aspectRatio: ratio }}
      aria-label={`Play ${title}`}
    >
      {thumb && (
        <img
          src={thumb}
          alt={title}
          loading="lazy"
          className="absolute inset-0 w-full h-full object-cover"
          onLoad={(e) => {
            const { naturalWidth: w, naturalHeight: h } = e.currentTarget;
            if (w > 0 && h > 0) setRatio(w / h);
          }}
          onError={(e) => { e.currentTarget.style.display = 'none'; }}
        />
      )}
      <span className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
        <span className="w-14 h-14 rounded-full bg-white/15 backdrop-blur-md border border-white/30 flex items-center justify-center group-hover:scale-110 transition-transform">
          <Play className="w-6 h-6 text-white ml-0.5" fill="currentColor" />
        </span>
      </span>
    </button>
  );
}

const API_BASE = `https://${supabaseProjectId}.supabase.co/functions/v1/make-server-e07959ec`;

// ── Smart Vimeo embed: detects real aspect ratio via oEmbed ───────────────────
function SmartVimeoEmbed({ embedSrc, title, onPlay }: { embedSrc: string; title: string; onPlay?: () => void }) {
  const [ratio, setRatio] = useState<number | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const onPlayRef = useRef(onPlay);
  onPlayRef.current = onPlay;

  // Report the first play (used for gallery video stats).
  useEffect(() => {
    if (!onPlay || !iframeRef.current) return;
    let player: Player | null = null;
    try {
      player = new Player(iframeRef.current);
      player.on('play', () => onPlayRef.current?.());
    } catch { /* player API unavailable — skip tracking */ }
    return () => { try { player?.off('play'); } catch { /* ignore */ } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [embedSrc]);

  // Extract numeric video ID from a player.vimeo.com/video/NNNN URL
  const videoId = embedSrc.match(/\/video\/(\d+)/)?.[1];

  useEffect(() => {
    if (!videoId) return;
    let cancelled = false;
    fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${videoId}`)
      .then(r => r.json())
      .then(d => {
        if (!cancelled && d.width && d.height) {
          setRatio(d.width / d.height);
        }
      })
      .catch(() => { /* keep default 16/9 on network error */ });
    return () => { cancelled = true; };
  }, [videoId]);

  // While loading use 16/9 as placeholder; switches to real ratio once fetched
  const aspectRatio = ratio ?? 16 / 9;

  return (
    <div style={{ aspectRatio: String(aspectRatio) }} className="w-full">
      <iframe
        ref={iframeRef}
        src={embedSrc}
        className="w-full h-full"
        allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media"
        allowFullScreen
        title={title}
      />
    </div>
  );
}

// Fallback project data
const fallbackProject = {
  title: "FinTech Product Launch",
  category: "Product",
  client: "TechCorp Financial",
  year: "2025",
  thumbnail: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80",
  goal: "Launch a new digital banking product to millennials with clear value proposition and seamless onboarding flow explanation.",
  approach: "Created a fast-paced, modern explainer combining bold typography, smooth transitions, and real UI demonstrations. Focus on trust-building and simplicity.",
  deliverables: [
    "90-second explainer video",
    "Social media cutdowns (15s, 30s, 60s)",
    "Animated UI components library",
    "Brand motion guidelines"
  ],
  outcome: "2.3M views in first month. 340% increase in sign-ups. Featured on Product Hunt.",
  images: [
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=80",
    "https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200&q=80"
  ]
};

export function ProjectDetail() {
  const { slug } = useParams();
  const { i18n, t } = useTranslation();
  const [project, setProject] = useState<any>(fallbackProject);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState(true); // Changed to true for autoplay
  // Gallery uses 2 masonry columns from the md breakpoint (768px), 1 below.
  const [isWideGallery, setIsWideGallery] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches,
  );
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const onChange = () => setIsWideGallery(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
  // Bunny videos autoplay muted (browser policy); this chip lets the user
  // click once to unmute. Hidden after ~6s if ignored, or on click.
  const [unmutePromptVisible, setUnmutePromptVisible] = useState(false);
  const [audioUnmuted,        setAudioUnmuted]        = useState(false);

  // ── Video analytics tracking ───────────────────────────────────────────────
  const idRef           = useRef<string | undefined>(slug);
  const playStartRef    = useRef<number | null>(null);   // non-null only while actually playing
  const isPlayingRef    = useRef(false);                 // mirrors real player play/pause state
  const viewRecordedRef = useRef(false);
  const iframeRef       = useRef<HTMLIFrameElement>(null);
  // Is the main video at least half on screen? Watch time only counts then.
  const videoVisibleRef = useRef(true);
  // On-screen seconds watched this page view; ≥ ENGAGED_SECONDS = "stayed"
  const onScreenSecondsRef = useRef(0);
  const engagedSentRef     = useRef(false);
  const ENGAGED_SECONDS    = 5;

  useEffect(() => { idRef.current = slug; }, [slug]);

  // Gallery video plays — counted once per video per page view.
  const galleryPlayed = useRef<Set<string>>(new Set());
  const trackGalleryPlay = useCallback((url: string) => {
    const pid = idRef.current;
    if (!pid || galleryPlayed.current.has(url)) return;
    galleryPlayed.current.add(url);
    fetch(`${API_BASE}/projects/${pid}/gallery-play`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
      keepalive: true,
    }).catch(() => { /* stats are best-effort */ });
  }, []);

  // View is recorded on first play event, not on page load

  /** Fire-and-forget: POST seconds watched to the server. */
  const postWatchSeconds = useCallback((secs: number) => {
    const pid = idRef.current;
    if (secs <= 0 || !pid) return;
    onScreenSecondsRef.current += secs;
    // First time this visit passes the threshold → count one engaged view.
    const engaged = !engagedSentRef.current && onScreenSecondsRef.current >= ENGAGED_SECONDS;
    if (engaged) engagedSentRef.current = true;
    fetch(`${API_BASE}/projects/${pid}/video-view`, {
      method:    'POST',
      headers:   { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
      body:      JSON.stringify({ addView: false, watchSeconds: secs, engaged }),
      keepalive: true,
    }).catch(err => console.warn('[VideoTrack] watch-time send failed:', err));
  }, []);

  /** Compute elapsed since last checkpoint, send it, then reset or stop the clock. */
  const drainTimer = useCallback((keepRunning: boolean) => {
    if (playStartRef.current === null) return;
    const elapsed = Math.floor((Date.now() - playStartRef.current) / 1000);
    playStartRef.current = keepRunning ? Date.now() : null;
    postWatchSeconds(elapsed);
  }, [postWatchSeconds]);

  /** Called when the play button overlay is clicked — shows iframe, records one view. */
  const handleVideoPlay = useCallback(() => {
    setShowVideo(true);
    // Timer starts on the player's actual 'play' event, not here.
    if (!viewRecordedRef.current && idRef.current) {
      viewRecordedRef.current = true;
      fetch(`${API_BASE}/projects/${idRef.current}/video-view`, {
        method:  'POST',
        headers: { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ addView: true, watchSeconds: 0 }),
      }).catch(err => console.warn('[VideoTrack] view record failed:', err));
    }
  }, []);

  // ── Hook into the player APIs for real play / pause events ─────────────────
  useEffect(() => {
    if (!showVideo || !iframeRef.current) return;
    const url = project.videoUrl || '';

    // ── Vimeo ────────────────────────────────────────────────────────────────
    if (url.includes('vimeo.com') || iframeRef.current.src.includes('vimeo.com') || iframeRef.current.src.includes('player.vimeo')) {
      const vimeoPlayer = new Player(iframeRef.current);

      const onPlay  = () => {
        isPlayingRef.current = true;
        if (videoVisibleRef.current && !document.hidden) playStartRef.current = Date.now();
        if (!viewRecordedRef.current && idRef.current) {
          viewRecordedRef.current = true;
          fetch(`${API_BASE}/projects/${idRef.current}/video-view`, {
            method:  'POST',
            headers: { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
            body:    JSON.stringify({ addView: true, watchSeconds: 0 }),
          }).catch(err => console.warn('[VideoTrack] view record failed:', err));
        }
      };
      const onPause = () => { isPlayingRef.current = false; drainTimer(false); };
      const onEnded = () => { isPlayingRef.current = false; drainTimer(false); };

      vimeoPlayer.on('play',   onPlay);
      vimeoPlayer.on('pause',  onPause);
      vimeoPlayer.on('ended',  onEnded);

      return () => {
        vimeoPlayer.off('play',  onPlay);
        vimeoPlayer.off('pause', onPause);
        vimeoPlayer.off('ended', onEnded);
      };
    }

    // ── Bunny Stream ────────────────────────────────────────────────────────
    // Bunny's iframe player posts { event: 'playing' | 'paused' | 'ended', ... }
    // messages from iframe.mediadelivery.net. Same shape as YouTube's
    // postMessage bridge — different vocab.
    if (url.includes('mediadelivery.net') || url.includes('b-cdn.net')) {
      const onMessage = (e: MessageEvent) => {
        if (!e.origin.includes('mediadelivery.net')) return;
        try {
          const data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
          const evt  = data?.event ?? data?.type;
          if (evt === 'playing' || evt === 'play') {
            isPlayingRef.current = true;
            if (videoVisibleRef.current && !document.hidden) playStartRef.current = Date.now();
            // Bunny video started (muted). Surface the unmute prompt unless
            // the user has already unmuted this session.
            if (!audioUnmuted) setUnmutePromptVisible(true);
            if (!viewRecordedRef.current && idRef.current) {
              viewRecordedRef.current = true;
              fetch(`${API_BASE}/projects/${idRef.current}/video-view`, {
                method:  'POST',
                headers: { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
                body:    JSON.stringify({ addView: true, watchSeconds: 0 }),
              }).catch(err => console.warn('[VideoTrack] view record failed:', err));
            }
          } else if (evt === 'paused' || evt === 'pause' || evt === 'ended') {
            isPlayingRef.current = false;
            drainTimer(false);
          }
        } catch { /* ignore malformed messages */ }
      };
      window.addEventListener('message', onMessage);
      // Bunny only sends play/pause events after we subscribe (player.js).
      const unsubscribe = subscribeBunnyPlayerEvents(iframeRef.current);
      return () => { window.removeEventListener('message', onMessage); unsubscribe(); };
    }

    // ── YouTube ──────────────────────────────────────────────────────────────
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const onMessage = (e: MessageEvent) => {
        if (!e.origin.includes('youtube.com')) return;
        try {
          const data = JSON.parse(typeof e.data === 'string' ? e.data : JSON.stringify(e.data));
          // playerState: 1=playing, 2=paused, 0=ended, 3=buffering
          const state = data?.info?.playerState;
          if (state === 1) {
            isPlayingRef.current = true;
            if (videoVisibleRef.current && !document.hidden) playStartRef.current = Date.now();
            if (!viewRecordedRef.current && idRef.current) {
              viewRecordedRef.current = true;
              fetch(`${API_BASE}/projects/${idRef.current}/video-view`, {
                method:  'POST',
                headers: { 'Authorization': `Bearer ${publicAnonKey}`, 'Content-Type': 'application/json' },
                body:    JSON.stringify({ addView: true, watchSeconds: 0 }),
              }).catch(err => console.warn('[VideoTrack] view record failed:', err));
            }
          } else if (state === 2 || state === 0) {
            isPlayingRef.current = false;
            drainTimer(false);
          }
        } catch { /* ignore malformed messages */ }
      };
      window.addEventListener('message', onMessage);

      // Tell the YouTube iframe to start sending events
      const ping = setTimeout(() => {
        iframeRef.current?.contentWindow?.postMessage(
          JSON.stringify({ event: 'listening', id: 1 }),
          'https://www.youtube.com'
        );
      }, 800);

      return () => {
        window.removeEventListener('message', onMessage);
        clearTimeout(ping);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showVideo]); // re-bind only when the iframe mounts

  // ── Bunny unmute prompt auto-hide (6s) ──────────────────────────────────────
  useEffect(() => {
    if (!unmutePromptVisible) return;
    const t = setTimeout(() => setUnmutePromptVisible(false), 6000);
    return () => clearTimeout(t);
  }, [unmutePromptVisible]);

  // Click handler: reload the iframe with muted=false. The click counts as a
  // user gesture, so the browser allows audio-autoplay this time.
  const handleUnmute = useCallback(() => {
    if (!iframeRef.current) return;
    const src = iframeRef.current.src;
    // Replace muted=true → muted=false; leaves everything else intact.
    const next = src.includes('muted=true')
      ? src.replace('muted=true', 'muted=false')
      : `${src}${src.includes('?') ? '&' : '?'}muted=false`;
    iframeRef.current.src = next;
    setAudioUnmuted(true);
    setUnmutePromptVisible(false);
  }, []);

  // ── On-screen detection: pause the watch clock when the visitor scrolls
  //    the video out of view, resume when it comes back ────────────────────
  useEffect(() => {
    if (!showVideo || !iframeRef.current || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(([entry]) => {
      const visible = entry.intersectionRatio >= 0.5;
      videoVisibleRef.current = visible;
      if (!visible) {
        drainTimer(false); // scrolled away: stop counting
      } else if (isPlayingRef.current && !document.hidden && playStartRef.current === null) {
        playStartRef.current = Date.now(); // back on screen while playing
      }
    }, { threshold: [0, 0.5, 1] });
    io.observe(iframeRef.current);
    return () => io.disconnect();
  }, [showVideo, drainTimer]);

  // ── 10-second heartbeat: flush chunks while video is actually playing ───────
  useEffect(() => {
    if (!showVideo) return;
    const hb = setInterval(() => drainTimer(true), 10_000);
    return () => clearInterval(hb);
  }, [showVideo, drainTimer]);

  // ── Tab visibility: drain if playing, restart only when player fires play ───
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && isPlayingRef.current) {
        drainTimer(false);
        // Note: browser usually auto-pauses the iframe too; player will fire
        // a pause/play event when it actually changes state.
      } else if (!document.hidden && isPlayingRef.current && videoVisibleRef.current && playStartRef.current === null) {
        playStartRef.current = Date.now();
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [drainTimer]);

  // ── Final flush on component unmount ────────────────────────────────────────
  useEffect(() => {
    return () => drainTimer(false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // ──────────────────────────────────────────────────────────────────────────

  // Single effect — handles slug change AND language switch.
  // Fetches project + translations in one Promise.all so the page always
  // renders translated content on the very first paint — no English flash.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadProject(); }, [slug, i18n.language]);

  const loadProject = async () => {
    if (!slug) { setLoading(false); return; }
    const lang = i18n.language; // capture at call time

    setLoading(true);
    setError(null);

    try {
      // Fetch project + translations in parallel — merge before setState
      const [response, trans] = await Promise.all([
        api.getProject(slug),
        lang !== 'en' ? fetchTranslations(lang, 'projects') : Promise.resolve({}),
      ]);

      if (response.success && response.data) {
        let projectData = {
          ...response.data,
          thumbnail: response.data.imageUrl,
          images: response.data.screenshots || [],
        };

        // Merge translations before first setState so UI never shows English
        if (lang !== 'en' && Object.keys(trans).length > 0 && trans[projectData.id]) {
          projectData = deepMergeTranslations(projectData, trans[projectData.id]) as typeof projectData;
        }

        setProject(projectData);
      } else {
        setError('Project not found');
      }
    } catch (err) {
      console.error('Error loading project:', err);
      setError(`Failed to load project: ${err}`);
    } finally {
      setLoading(false);
    }
  };

  // Convert regular video URLs to embed URLs
  const getEmbedUrl = (url: string) => {
    if (!url) return null;
    
    // YouTube
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = url.includes('youtu.be') 
        ? url.split('youtu.be/')[1]?.split('?')[0]
        : url.split('v=')[1]?.split('&')[0];
      return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&enablejsapi=1&origin=${encodeURIComponent(window.location.origin)}` : null;
    }
    
    // Vimeo
    if (url.includes('vimeo.com')) {
      const videoId = url.split('vimeo.com/')[1]?.split('?')[0]?.split('/').pop();
      return videoId ? `https://player.vimeo.com/video/${videoId}?autoplay=1&title=0&byline=0&portrait=0` : null;
    }

    // Bunny Stream — iframe.mediadelivery.net/embed/{lib}/{guid}
    // Params: browsers block audio-autoplay without a prior user gesture,
    // so the video must start muted for autoplay to work reliably across
    // Chrome / Safari / mobile. Same tradeoff YouTube/Vimeo hit — Vimeo just
    // falls back to showing the poster when autoplay is blocked, which is
    // why some users don't see it play.
    if (url.includes('mediadelivery.net') || url.includes('b-cdn.net')) {
      if (url.includes('autoplay')) return url;
      const params = new URLSearchParams({
        autoplay: 'true',
        muted:    'true',    // required — see comment above
        loop:     'false',
        preload:  'true',
      });
      return `${url}${url.includes('?') ? '&' : '?'}${params.toString()}`;
    }

    // Already an embed URL - add autoplay if not present
    if (url.includes('embed') || url.includes('player')) {
      return url.includes('autoplay') ? url : `${url}${url.includes('?') ? '&' : '?'}autoplay=1`;
    }
    
    return null;
  };

  const embedUrl = getEmbedUrl(project.videoUrl);

  if (loading) {
    return (
      <div className="min-h-screen py-24 px-6 flex items-center justify-center">
        <div className="text-white/60">{t('projects.detail.loadingProject')}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-24 px-6">
      <SeoHead
        pageKey={`project--${slug}`}
        fallback={{
          title: project?.title ? `${project.title} — Fastoosh Projects` : 'Project — Fastoosh',
          description: project?.goal || project?.description || 'A premium motion design project by Fastoosh.',
          ogImage: project?.thumbnail || project?.imageUrl || undefined,
        }}
      />
      <div className="max-w-5xl mx-auto">
        {/* Error banner (shown but allows fallback content to display) */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg"
          >
            <p className="text-yellow-300 text-sm">
              ⚠️ {t('projects.detail.errorBanner')}
              <br />
              <span className="text-xs text-yellow-400/70">Error: {error}</span>
            </p>
          </motion.div>
        )}

        {/* Back button */}
        <motion.a
          href="/projects"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="inline-flex items-center gap-2 rtl:flex-row-reverse text-white/60 hover:text-white transition-colors mb-12"
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          {t('projects.detail.backToProjects')}
        </motion.a>

        {/* Hero Video */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <GlassCard neonBorder className="aspect-video overflow-hidden mb-12">
            {showVideo && embedUrl ? (
              <div className="relative w-full h-full">
                <iframe
                  ref={iframeRef}
                  src={embedUrl}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
                {/* Unmute prompt — only shown for Bunny (which starts muted). */}
                {unmutePromptVisible && (
                  <button
                    type="button"
                    onClick={handleUnmute}
                    className="absolute bottom-4 right-4 z-10 flex items-center gap-2 px-3.5 py-2 rounded-full
                      bg-black/70 backdrop-blur-sm border border-white/15 text-white text-sm font-semibold
                      shadow-lg shadow-black/40 hover:bg-black/85 hover:border-white/30 transition-all
                      animate-in fade-in slide-in-from-bottom-2 duration-300"
                    aria-label="Unmute video"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>Click to unmute</span>
                  </button>
                )}
              </div>
            ) : (
              <div 
                className="w-full h-full bg-cover bg-center relative group cursor-pointer"
                style={{ backgroundImage: `url(${project.thumbnail})` }}
                onClick={() => embedUrl && handleVideoPlay()}
              >
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  {embedUrl ? (
                    <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Play className="w-10 h-10 text-white ml-1" />
                    </div>
                  ) : (
                    <div className="text-white/60 text-center">
                      <p className="text-sm">{t('projects.detail.noVideo')}</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </GlassCard>
        </motion.div>

        {/* Project Meta */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-16"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
            <div>
              <div className="text-white/50 text-sm mb-1">{t('projects.detail.category')}</div>
              <div className="text-white">{project.category}</div>
            </div>
            <div>
              <div className="text-white/50 text-sm mb-1">{t('projects.detail.client')}</div>
              <div className="text-white">{project.client}</div>
            </div>
            <div>
              <div className="text-white/50 text-sm mb-1">{t('projects.detail.year')}</div>
              <div className="text-white">{project.year}</div>
            </div>
            <div>
              <div className="text-white/50 text-sm mb-1">{t('projects.detail.outcome')}</div>
              <div className="text-white">{t('projects.detail.featured')}</div>
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl tracking-tight mb-6">{project.title}</h1>
          {project.description && (
            <p className="text-white/60 text-lg leading-relaxed">{project.description}</p>
          )}
        </motion.div>

        {/* Content Sections */}
        <div className="space-y-16">
          {/* Goal */}
          {project.goal && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <GlassCard className="p-8">
                <h2 className="text-2xl mb-4">{t('projects.detail.goal')}</h2>
                <p className="text-white/70 text-lg leading-relaxed">{project.goal}</p>
              </GlassCard>
            </motion.div>
          )}

          {/* Approach */}
          {project.approach && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <GlassCard className="p-8">
                <h2 className="text-2xl mb-4">{t('projects.detail.approach')}</h2>
                <p className="text-white/70 text-lg leading-relaxed">{project.approach}</p>
              </GlassCard>
            </motion.div>
          )}

          {/* Deliverables */}
          {project.deliverables && project.deliverables.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <GlassCard className="p-8">
                <h2 className="text-2xl mb-4">{t('projects.detail.deliverables')}</h2>
                <ul className="space-y-2">
                  {project.deliverables.map((item: string, index: number) => (
                    <li key={index} className="text-white/70 flex items-start gap-3">
                      <span className="text-purple-400 mt-1 rtl:rotate-180 inline-block">→</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </GlassCard>
            </motion.div>
          )}

          {/* Media Gallery — images, direct videos, and Vimeo embeds */}
          {project.images && project.images.filter((u: string) => u?.trim()).length > 0 && (() => {
            const getVimeoEmbedId = (url: string) =>
              url.split('vimeo.com/').pop()?.split('?')[0]?.split('/').pop() ?? null;

            const isVimeo     = (url: string) => url.includes('vimeo.com');
            const isDirectVid = (url: string) => /\.(mp4|webm|mov|avi)(\?|$)/i.test(url);

            // Masonry: items are dealt into columns left, right, left, right…
            // so the reading order follows rows, and each tile stays in its
            // column (no reflow when thumbnails load and change height).
            const items = project.images.filter((u: string) => u?.trim());
            const columnCount = isWideGallery ? 2 : 1;
            const columns: { url: string; index: number }[][] =
              Array.from({ length: columnCount }, () => []);
            items.forEach((url: string, index: number) => columns[index % columnCount].push({ url, index }));

            return (
              <div className="flex gap-6 items-start">
                {columns.map((col, ci) => (
                <div key={ci} className="flex-1 min-w-0 flex flex-col gap-6">
                {col.map(({ url, index }) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    // Small stagger within a row only — a cumulative delay
                    // made later tiles wait seconds before appearing.
                    transition={{ delay: (index % columnCount) * 0.1 }}
                  >
                    <GlassCard className="overflow-hidden">
                      {isVimeo(url) ? (
                        /* ── Vimeo embed ── */
                        <SmartVimeoEmbed
                          embedSrc={`https://player.vimeo.com/video/${getVimeoEmbedId(url)}?badge=0&autopause=0&player_id=0&app_id=58479&title=0&byline=0&portrait=0`}
                          title={`${t('projects.detail.stills')} ${index + 1}`}
                          onPlay={() => trackGalleryPlay(url)}
                        />
                      ) : detectVideoProvider(url) === 'bunny' ? (
                        /* ── Bunny Stream video ── */
                        <BunnyGalleryItem
                          url={url}
                          title={`${t('projects.detail.stills')} ${index + 1}`}
                          onPlay={() => trackGalleryPlay(url)}
                        />
                      ) : isDirectVid(url) ? (
                        /* ── Direct video file ── */
                        <video
                          src={url}
                          controls
                          className="w-full"
                          preload="metadata"
                          onPlay={() => trackGalleryPlay(url)}
                        />
                      ) : (
                        /* ── Static image ── */
                        <img
                          src={url}
                          alt={`${t('projects.detail.stills')} ${index + 1}`}
                          className="w-full"
                        />
                      )}
                    </GlassCard>
                  </motion.div>
                ))}
                </div>
                ))}
              </div>
            );
          })()}

          {/* Outcome */}
          {project.outcome && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <GlassCard neonBorder className="p-8">
                <h2 className="text-2xl mb-4">{t('projects.detail.outcomeSection')}</h2>
                <p className="text-white/70 text-lg leading-relaxed">{project.outcome}</p>
              </GlassCard>
            </motion.div>
          )}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-24 text-center"
        >
          <GlassCard className="p-12 w-full">
            <h3 className="text-3xl mb-4">{t('projects.detail.ctaHeading')}</h3>
            <p className="text-white/60 mb-6">{t('projects.detail.ctaSubtitle')}</p>
            <NeonButton href="/work-with-us">{t('common.workWithUs')}</NeonButton>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}