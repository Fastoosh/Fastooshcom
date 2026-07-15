import { useState, useRef, useEffect, useCallback } from "react";
import Cropper from "react-easy-crop";
import Player from "@vimeo/player";
import {
  X, Play, Pause, SkipBack, SkipForward, Camera,
  ChevronLeft, ChevronRight, Loader2, RefreshCw, Crop,
  ZoomIn, ZoomOut, Check, Scissors,
} from "lucide-react";
import { Button } from "../ui/button";
import { projectId, publicAnonKey } from "/utils/supabase/info";

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

// ─── Types ────────────────────────────────────────────────────────────────────
interface Props {
  videoUrl: string;
  initialFrames?: string[];
  onApply: (frames: string[], selectedIndex: number | null) => void;
  onClose: () => void;
}

type Area = { x: number; y: number; width: number; height: number };

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtTime(secs: number): string {
  if (!isFinite(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function detectType(url: string): "direct" | "youtube" | "vimeo" | "bunny" | "unknown" {
  if (/\.(mp4|webm|mov|avi)(\?|$)/i.test(url)) return "direct";
  if (url.includes("iframe.mediadelivery.net") || url.includes("b-cdn.net")) return "bunny";
  if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
  if (url.includes("vimeo.com")) return "vimeo";
  return "unknown";
}

function getYouTubeId(url: string): string | null {
  if (url.includes("youtu.be/")) return url.split("youtu.be/")[1]?.split("?")[0] ?? null;
  return url.split("v=")[1]?.split("&")[0] ?? null;
}

function getVimeoId(url: string): string | null {
  return url.split("vimeo.com/")[1]?.split("?")[0]?.split("/").pop() ?? null;
}

// Bunny embed URLs: iframe.mediadelivery.net/embed/{lib}/{guid}
// Or raw CDN URLs: {cdn}.b-cdn.net/{guid}/...
function getBunnyGuid(url: string): string | null {
  const embed = url.match(/mediadelivery\.net\/(?:embed|play)\/\d+\/([0-9a-f-]+)/i);
  if (embed) return embed[1];
  const cdn = url.match(/b-cdn\.net\/([0-9a-f-]+)/i);
  if (cdn) return cdn[1];
  return null;
}

const BUNNY_CDN_FALLBACK = "vz-869cc91d-3f3.b-cdn.net";
function getBunnyCdnHost(url: string): string {
  const m = url.match(/(vz-[a-f0-9-]+\.b-cdn\.net)/i);
  return m ? m[1] : BUNNY_CDN_FALLBACK;
}

// The 720p MP4 that always ships once encoding is done — good for a
// scrubbable <video> element (same code path as direct MP4 uploads).
function getBunnyDirectMp4(url: string): string | null {
  const guid = getBunnyGuid(url);
  if (!guid) return null;
  return `https://${getBunnyCdnHost(url)}/${guid}/play_720p.mp4`;
}

/** Draws the cropped region onto a canvas and returns a JPEG data URL (800×800). */
async function getCroppedImg(imageSrc: string, pixelCrop: Area): Promise<string> {
  // For external http/https URLs, fetch through the server proxy so canvas
  // can read pixels without CORS restrictions.
  const adminToken = localStorage.getItem("admin_token") ?? "";
  const { publicAnonKey: anonKey } = await import("/utils/supabase/info");
  const { projectId: pid }         = await import("/utils/supabase/info");

  let srcToLoad = imageSrc;
  if (imageSrc.startsWith("http://") || imageSrc.startsWith("https://")) {
    const base = `https://${pid}.supabase.co/functions/v1/make-server-e07959ec`;
    srcToLoad = `${base}/admin/proxy-image?url=${encodeURIComponent(imageSrc)}`;
  }

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const OUT = 800;
      const canvas = document.createElement("canvas");
      canvas.width = OUT;
      canvas.height = OUT;
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject("No canvas context"); return; }
      ctx.drawImage(
        img,
        pixelCrop.x, pixelCrop.y,
        pixelCrop.width, pixelCrop.height,
        0, 0, OUT, OUT,
      );
      try { resolve(canvas.toDataURL("image/jpeg", 0.95)); }
      catch (e) { reject(e); }
    };
    img.onerror = () => reject("Image failed to load — check proxy or network.");

    // For the proxied URL we need auth headers, but <img> can't send them.
    // So fetch as blob first, then use object URL.
    if (srcToLoad !== imageSrc) {
      fetch(srcToLoad, {
        headers: {
          Authorization: `Bearer ${anonKey}`,
          "X-Admin-Token": adminToken,
        },
      })
        .then(r => r.blob())
        .then(blob => { img.src = URL.createObjectURL(blob); })
        .catch(reject);
    } else {
      img.src = srcToLoad;
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
export function VideoThumbnailCapture({ videoUrl, initialFrames = [], onApply, onClose }: Props) {
  const type = detectType(videoUrl);
  const vmId = type === "vimeo"   ? getVimeoId(videoUrl)   : null;
  const ytId = type === "youtube" ? getYouTubeId(videoUrl) : null;
  // Bunny: route through the existing "direct" video element by feeding it
  // the auto-published 720p MP4 URL. Same scrub-and-capture code path.
  const bunnyGuid    = type === "bunny" ? getBunnyGuid(videoUrl) : null;
  const bunnyMp4Url  = type === "bunny" ? getBunnyDirectMp4(videoUrl) : null;
  const bunnyCdnHost = type === "bunny" ? getBunnyCdnHost(videoUrl) : "";
  // Whether the direct-video code path should be active (native direct URL,
  // or Bunny which we route through the same path via the 720p MP4).
  const isDirectPath = type === "direct" || type === "bunny";
  const directSrc    = type === "bunny" ? bunnyMp4Url ?? "" : videoUrl;

  // ── Direct video ──────────────────────────────────────────────────────
  const videoRef       = useRef<HTMLVideoElement>(null);
  const [isPlaying,    setIsPlaying]    = useState(false);
  const [currentTime,  setCurrentTime]  = useState(0);
  const [duration,     setDuration]     = useState(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [videoLoaded,  setVideoLoaded]  = useState(false);
  const [captureFlash, setCaptureFlash] = useState(false);

  // ── Vimeo SDK ─────────────────────────────────────────────────────────
  const vimeoContainerRef = useRef<HTMLDivElement>(null);
  const vimeoPlayerRef    = useRef<Player | null>(null);

  // ── Shared frame list ─────────────────────────────────────────────────
  const [frames,        setFrames]        = useState<string[]>(initialFrames);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(initialFrames.length > 0 ? 0 : null);
  const [loading,       setLoading]       = useState(false);
  const [statusMsg,     setStatusMsg]     = useState("");
  // Track which frames were produced by the cropper (so only they get aspect-square)
  const [squareFrames,  setSquareFrames]  = useState<Set<string>>(new Set());

  // ── Crop state ────────────────────────────────────────────────────────
  const [cropMode,        setCropMode]        = useState(false);
  const [cropImage,       setCropImage]       = useState("");
  const [cropTargetIndex, setCropTargetIndex] = useState<number | null>(null);
  const [crop,            setCrop]            = useState({ x: 0, y: 0 });
  const [zoom,            setZoom]            = useState(1);
  const [croppedAreaPx,   setCroppedAreaPx]   = useState<Area | null>(null);
  const [cropLoading,     setCropLoading]     = useState(false);
  const [cropError,       setCropError]       = useState("");

  // ─── Vimeo SDK init ──────────────────────────────────────────────────
  useEffect(() => {
    if (type !== "vimeo" || !vmId || !vimeoContainerRef.current) return;
    const player = new Player(vimeoContainerRef.current, {
      id: Number(vmId), responsive: true, controls: true,
    });
    vimeoPlayerRef.current = player;
    return () => { player.destroy().catch(() => {}); vimeoPlayerRef.current = null; };
  }, [type, vmId]);

  // ─── Auto-load thumbnails on open ───────────────────────────────────
  useEffect(() => {
    if (type === "vimeo"   && vmId && initialFrames.length === 0) loadVimeoThumbnails();
    if (type === "youtube" && ytId && initialFrames.length === 0) loadYouTubeThumbnails();
    if (type === "bunny"   && bunnyGuid && initialFrames.length === 0) loadBunnyThumbnails();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Direct video event listeners ───────────────────────────────────
  useEffect(() => {
    const v = videoRef.current;
    if (!v || !isDirectPath) return;
    const onTime = () => setCurrentTime(v.currentTime);
    const onDur  = () => setDuration(v.duration);
    const onLoad = () => { setVideoLoaded(true); setDuration(v.duration); };
    const onEnd  = () => setIsPlaying(false);
    v.addEventListener("timeupdate",     onTime);
    v.addEventListener("loadedmetadata", onDur);
    v.addEventListener("canplay",        onLoad);
    v.addEventListener("ended",          onEnd);
    return () => {
      v.removeEventListener("timeupdate",     onTime);
      v.removeEventListener("loadedmetadata", onDur);
      v.removeEventListener("canplay",        onLoad);
      v.removeEventListener("ended",          onEnd);
    };
  }, [type]);

  // ─── Keyboard shortcuts (direct) ────────────────────────────────────
  useEffect(() => {
    if (!isDirectPath || cropMode) return;
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.code === "Space")     { e.preventDefault(); togglePlay(); }
      if (e.code === "ArrowLeft") { e.preventDefault(); stepFrame(-1); }
      if (e.code === "ArrowRight"){ e.preventDefault(); stepFrame(1);  }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, duration, cropMode]);

  // ─── Direct video controls ───────────────────────────────────────────
  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) { v.play(); setIsPlaying(true); }
    else          { v.pause(); setIsPlaying(false); }
  };
  const seek = (t: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(duration, t));
  };
  const stepFrame = (dir: 1 | -1) => {
    const v = videoRef.current;
    if (!v) return;
    v.pause(); setIsPlaying(false);
    v.currentTime = Math.max(0, Math.min(duration, v.currentTime + dir * (1 / 30)));
  };
  const setRate = (r: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.playbackRate = r; setPlaybackRate(r);
  };

  // ─── Canvas capture (direct only) ───────────────────────────────────
  const captureDirectFrame = useCallback(() => {
    const v = videoRef.current;
    if (!v || !videoLoaded) return;
    const w = v.videoWidth || 1920, h = v.videoHeight || 1080;
    const canvas = document.createElement("canvas");
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(v, 0, 0, w, h);
    let dataUrl: string;
    try { dataUrl = canvas.toDataURL("image/jpeg", 0.95); }
    catch { setStatusMsg("⚠️ Canvas security error — CORS restriction on this video."); return; }
    setFrames(prev => { const n = [...prev, dataUrl]; setSelectedIndex(n.length - 1); return n; });
    setCaptureFlash(true);
    setTimeout(() => setCaptureFlash(false), 150);
    setStatusMsg(`✅ Captured at ${fmtTime(v.currentTime)} · ${w}×${h}`);
    setTimeout(() => setStatusMsg(""), 3000);
  }, [videoLoaded]);

  // ─── Load Vimeo thumbnails ───────────────────────────────────────────
  const loadVimeoThumbnails = async () => {
    if (!vmId) return;
    setLoading(true);
    setStatusMsg("Loading Vimeo thumbnails…");
    try {
      const adminToken = localStorage.getItem("admin_token") ?? "";
      const res  = await fetch(`${API_BASE}/admin/vimeo-thumbnails/${vmId}`, {
        headers: { Authorization: `Bearer ${publicAnonKey}`, "X-Admin-Token": adminToken },
      });
      const data = await res.json();
      if (data.success && data.thumbnails?.length > 0) {
        setFrames(data.thumbnails); setSelectedIndex(0);
        setStatusMsg(`✅ ${data.thumbnails.length} thumbnail(s) loaded`);
      } else {
        // oEmbed fallback
        const oe = await fetch(`https://vimeo.com/api/oembed.json?url=https://vimeo.com/${vmId}&width=1920`);
        if (oe.ok) {
          const oeData = await oe.json();
          if (oeData.thumbnail_url) {
            const base = oeData.thumbnail_url.replace(/_\d+x\d+$/, "");
            const thumbs = [`${base}_1920x1080`, `${base}_1280x720`, `${base}_640x360`];
            setFrames(thumbs); setSelectedIndex(0);
            setStatusMsg("✅ Thumbnail loaded via oEmbed");
          } else { setStatusMsg("⚠️ No thumbnails found."); }
        } else { setStatusMsg(`⚠️ ${data.error ?? "No thumbnails found."}`); }
      }
    } catch (err) { setStatusMsg(`⚠️ Error: ${String(err)}`); }
    finally { setLoading(false); setTimeout(() => setStatusMsg(""), 4000); }
  };

  // ─── Load Bunny auto thumbnail ───────────────────────────────────────
  // Bunny publishes one auto-generated thumbnail per video at a stable URL.
  // We seed the frame list with it so the admin has something immediately;
  // beyond that they can scrub through the 720p MP4 (direct branch) to
  // capture custom frames — best of both worlds.
  const loadBunnyThumbnails = () => {
    if (!bunnyGuid) return;
    const auto = `https://${bunnyCdnHost}/${bunnyGuid}/thumbnail.jpg`;
    setFrames([auto]);
    setSelectedIndex(0);
    setStatusMsg("✅ Bunny auto thumbnail loaded — scrub the video below to capture more");
    setTimeout(() => setStatusMsg(""), 3500);
  };

  // ─── Load YouTube thumbnails ─────────────────────────────────────────
  const loadYouTubeThumbnails = () => {
    if (!ytId) return;
    const thumbs = [
      `https://img.youtube.com/vi/${ytId}/maxresdefault.jpg`,
      `https://img.youtube.com/vi/${ytId}/sddefault.jpg`,
      `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
      `https://img.youtube.com/vi/${ytId}/mqdefault.jpg`,
      `https://img.youtube.com/vi/${ytId}/1.jpg`,
      `https://img.youtube.com/vi/${ytId}/2.jpg`,
      `https://img.youtube.com/vi/${ytId}/3.jpg`,
    ];
    setFrames(thumbs); setSelectedIndex(0);
    setStatusMsg("✅ YouTube thumbnails loaded");
    setTimeout(() => setStatusMsg(""), 3000);
  };

  // ─── Enter crop mode ──────────────────────────────────────────────────
  const enterCropMode = (index: number) => {
    setCropImage(frames[index]);
    setCropTargetIndex(index);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPx(null);
    setCropError("");
    setCropMode(true);
  };

  // ─── Apply crop ───────────────────────────────────────────────────────
  const applyCrop = async () => {
    if (!croppedAreaPx || cropTargetIndex === null) return;
    setCropLoading(true);
    setCropError("");
    try {
      const croppedDataUrl = await getCroppedImg(cropImage, croppedAreaPx);
      // Register this URL as a square-cropped frame
      setSquareFrames(prev => new Set(prev).add(croppedDataUrl.slice(0, 100)));
      // Append the cropped image as a NEW entry right after the original,
      // select it, then exit crop mode so it's visible in the grid.
      setFrames(prev => {
        const next = [...prev];
        next.splice(cropTargetIndex + 1, 0, croppedDataUrl);
        return next;
      });
      setSelectedIndex(cropTargetIndex + 1);
      setCropMode(false);
      setStatusMsg("✅ Cropped square added — selected and ready to apply");
      setTimeout(() => setStatusMsg(""), 4000);
    } catch (err) {
      setCropError(`Could not crop: ${String(err)}`);
    } finally {
      setCropLoading(false);
    }
  };

  // ─── Remove frame ─────────────────────────────────────────────────────
  const removeFrame = (i: number) => {
    setSquareFrames(prev => {
      const next = new Set(prev);
      next.delete(frames[i].slice(0, 100));
      return next;
    });
    setFrames(prev => prev.filter((_, idx) => idx !== i));
    setSelectedIndex(prev => {
      if (prev === null || prev === i) return frames.length > 1 ? 0 : null;
      return prev > i ? prev - 1 : prev;
    });
  };

  const handleApply = () => { onApply(frames, selectedIndex); onClose(); };

  // ─────────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-50 flex items-center justify-center p-3">
      <div className="bg-[#0a0a0a] border border-white/15 rounded-2xl w-full max-w-6xl max-h-[95vh] flex flex-col overflow-hidden shadow-2xl">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
          <div>
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              {cropMode && (
                <button onClick={() => setCropMode(false)} className="text-white/50 hover:text-white">
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              {cropMode ? "Crop to Square" : "Select Video Thumbnail"}
            </h3>
            <p className="text-xs text-white/40 mt-0.5">
              {cropMode
                ? "Drag to reposition · Scroll or use the slider to zoom · Locked to 1:1 square"
                : type === "bunny"
                ? "Bunny auto thumbnail loaded · scrub the 720p stream to capture more · crop any"
                : isDirectPath
                ? "Play · Pause · Step frame-by-frame · Capture HD frame · Crop any thumbnail"
                : type === "vimeo"
                ? "Thumbnails from Vimeo Pictures API — select one, then crop to square"
                : "Select from YouTube quality variants — then crop to square for the project card"}
            </p>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white transition-colors p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* ── Body ── */}
        <div className="flex flex-1 overflow-hidden min-h-0">

          {/* LEFT — Player */}
          <div className="flex flex-col w-[55%] shrink-0 border-r border-white/10 bg-black">
            <div className="relative flex-1 bg-black flex items-center justify-center overflow-hidden min-h-0">

              {/* Direct MP4 (also used for Bunny — the 720p ladder step is
                  published at a predictable CDN URL, same code path). */}
              {isDirectPath && (
                <>
                  <video
                    ref={videoRef}
                    src={directSrc}
                    crossOrigin="anonymous"
                    className="max-w-full max-h-full object-contain"
                    preload="metadata"
                    playsInline
                    style={{ outline: captureFlash ? "3px solid #a855f7" : "none", transition: "outline 0.05s" }}
                  />
                  {!videoLoaded && (
                    <div className="absolute inset-0 flex items-center justify-center text-white/40 text-sm">
                      Loading video…
                    </div>
                  )}
                </>
              )}

              {/* Vimeo embed */}
              {type === "vimeo" && vmId && (
                <div ref={vimeoContainerRef} className="w-full h-full" />
              )}

              {/* YouTube embed */}
              {type === "youtube" && ytId && (
                <iframe
                  src={`https://www.youtube.com/embed/${ytId}?enablejsapi=1`}
                  className="w-full h-full"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              )}

              {type === "unknown" && (
                <div className="text-white/40 text-sm text-center p-8">Unsupported URL format.</div>
              )}
            </div>

            {/* ── Direct MP4 / Bunny controls ── */}
            {isDirectPath && (
              <div className="shrink-0 px-4 py-3 bg-black/80 border-t border-white/10 space-y-3">
                <div className="flex items-center gap-3">
                  <span className="text-xs tabular-nums text-white/50 w-10 text-right shrink-0">{fmtTime(currentTime)}</span>
                  <input
                    type="range" min={0} max={duration || 1} step={0.016} value={currentTime}
                    onChange={e => seek(parseFloat(e.target.value))}
                    className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                    style={{ background: `linear-gradient(to right, #a855f7 ${(currentTime / (duration || 1)) * 100}%, rgba(255,255,255,0.15) 0)` }}
                  />
                  <span className="text-xs tabular-nums text-white/50 w-10 shrink-0">{fmtTime(duration)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => stepFrame(-1)} className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/8 hover:bg-white/15 text-white/70 hover:text-white text-xs">
                    <ChevronLeft className="w-3.5 h-3.5" /><span>−1f</span>
                  </button>
                  <button onClick={() => seek(currentTime - 5)} className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/8 hover:bg-white/15 text-white/70 hover:text-white text-xs">
                    <SkipBack className="w-3.5 h-3.5" /><span>5s</span>
                  </button>
                  <button onClick={togglePlay} className="flex items-center justify-center w-9 h-9 rounded-full bg-white/15 hover:bg-white/25 text-white">
                    {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                  </button>
                  <button onClick={() => seek(currentTime + 5)} className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/8 hover:bg-white/15 text-white/70 hover:text-white text-xs">
                    <SkipForward className="w-3.5 h-3.5" /><span>5s</span>
                  </button>
                  <button onClick={() => stepFrame(1)} className="flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/8 hover:bg-white/15 text-white/70 hover:text-white text-xs">
                    <span>+1f</span><ChevronRight className="w-3.5 h-3.5" />
                  </button>
                  <div className="flex-1" />
                  {[0.25, 0.5, 1].map(r => (
                    <button key={r} onClick={() => setRate(r)}
                      className={`px-2 py-1 rounded text-xs transition-colors ${playbackRate === r ? "bg-purple-600 text-white" : "bg-white/8 text-white/50 hover:bg-white/15 hover:text-white"}`}>
                      {r === 1 ? "1×" : `${r}×`}
                    </button>
                  ))}
                </div>
                <button
                  onClick={captureDirectFrame}
                  disabled={!videoLoaded || frames.length >= 12}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold text-sm transition-all disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
                >
                  <Camera className="w-4 h-4" />
                  Capture Frame
                  {frames.length > 0 && <span className="text-white/60 font-normal">({frames.length}/12)</span>}
                </button>
                <p className="text-center text-xs text-white/30">Space = play/pause · ← → = step one frame</p>
              </div>
            )}

            {/* ── Vimeo controls ── */}
            {type === "vimeo" && (
              <div className="shrink-0 px-4 py-3 bg-black/80 border-t border-white/10">
                <button
                  onClick={loadVimeoThumbnails}
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-white/20 bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm font-medium transition-all disabled:opacity-40"
                >
                  {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Loading…</> : <><RefreshCw className="w-4 h-4" /> Reload Thumbnails</>}
                </button>
                <p className="text-center text-xs text-white/30 mt-2">
                  Fetched from the Vimeo Pictures API · select one → crop to square
                </p>
              </div>
            )}

            {/* ── YouTube controls ── */}
            {type === "youtube" && (
              <div className="shrink-0 px-4 py-3 bg-black/80 border-t border-white/10">
                <button
                  onClick={loadYouTubeThumbnails}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-red-700 to-red-600 hover:from-red-600 hover:to-red-500 text-white font-semibold text-sm transition-all"
                >
                  <RefreshCw className="w-4 h-4" /> Reload Thumbnails
                </button>
              </div>
            )}
          </div>

          {/* RIGHT — Frames grid OR Cropper */}
          <div className="flex flex-col flex-1 overflow-hidden min-h-0">

            {cropMode ? (
              /* ════ CROP VIEW ════ */
              <>
                {/* Cropper canvas area */}
                <div className="relative flex-1 bg-[#111] overflow-hidden" style={{ minHeight: 0 }}>
                  <Cropper
                    image={cropImage}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={(_: Area, pxArea: Area) => setCroppedAreaPx(pxArea)}
                    cropShape="rect"
                    showGrid
                    style={{
                      containerStyle: { background: "#111" },
                      cropAreaStyle: { border: "2px solid #a855f7", boxShadow: "0 0 0 9999px rgba(0,0,0,0.6)" },
                    }}
                  />

                  {/* Square badge */}
                  <div className="absolute top-3 left-3 bg-purple-600/90 text-white text-[11px] font-bold px-2.5 py-1 rounded-full flex items-center gap-1.5 z-10">
                    <Scissors className="w-3 h-3" />
                    1:1 Square · 800×800 px output
                  </div>
                </div>

                {/* Zoom controls */}
                <div className="shrink-0 px-4 py-3 border-t border-white/10 bg-[#0d0d0d] space-y-3">
                  <div className="flex items-center gap-3">
                    <button onClick={() => setZoom(z => Math.max(1, z - 0.1))} className="text-white/50 hover:text-white transition-colors">
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <input
                      type="range" min={1} max={4} step={0.01} value={zoom}
                      onChange={e => setZoom(parseFloat(e.target.value))}
                      className="flex-1 h-1.5 rounded-full appearance-none cursor-pointer"
                      style={{ background: `linear-gradient(to right, #a855f7 ${((zoom - 1) / 3) * 100}%, rgba(255,255,255,0.15) 0)` }}
                    />
                    <button onClick={() => setZoom(z => Math.min(4, z + 0.1))} className="text-white/50 hover:text-white transition-colors">
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <span className="text-xs tabular-nums text-white/40 w-10 text-right shrink-0">{zoom.toFixed(2)}×</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-white/30 justify-center">
                    <Crop className="w-3.5 h-3.5" />
                    Drag to reposition the image inside the square crop area
                  </div>
                  {cropError && (
                    <p className="text-xs text-red-400 bg-red-500/10 px-3 py-2 rounded-lg border border-red-500/20">{cropError}</p>
                  )}
                </div>

                {/* Crop footer */}
                <div className="shrink-0 border-t border-white/10 px-4 py-3 flex gap-3">
                  <Button
                    type="button"
                    onClick={() => setCropMode(false)}
                    variant="outline"
                    className="flex-1 bg-transparent border-white/20 text-white/60 hover:text-white hover:bg-white/10"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={applyCrop}
                    disabled={!croppedAreaPx || cropLoading}
                    className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold disabled:opacity-40"
                  >
                    {cropLoading
                      ? <><Loader2 className="w-4 h-4 animate-spin" /> Cropping…</>
                      : <><Check className="w-4 h-4" /> Apply Crop</>}
                  </Button>
                </div>
              </>
            ) : (
              /* ════ GRID VIEW ════ */
              <>
                <div className="px-4 py-3 border-b border-white/10 shrink-0 flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-white">
                    {isDirectPath ? "Captured Frames" : "Available Thumbnails"}
                    {frames.length > 0 && <span className="text-white/40 font-normal ml-1">({frames.length})</span>}
                  </h4>
                  {frames.length > 0 && isDirectPath && (
                    <button onClick={() => { setFrames([]); setSelectedIndex(null); }}
                      className="text-xs text-red-400/70 hover:text-red-400 transition-colors">
                      Clear all
                    </button>
                  )}
                </div>

                {statusMsg && (
                  <div className="mx-3 mt-2 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-400/20 text-xs text-purple-300 shrink-0">
                    {statusMsg}
                  </div>
                )}

                <div className="flex-1 overflow-y-auto p-3">
                  {loading && frames.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-white/30">
                      <Loader2 className="w-8 h-8 animate-spin" />
                      <span className="text-sm">Loading thumbnails…</span>
                    </div>
                  ) : frames.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-center text-white/25 text-sm px-6 leading-relaxed">
                      {isDirectPath
                        ? "Play the video, step to the exact frame, then click \"Capture Frame\""
                        : type === "vimeo"
                        ? "Loading Vimeo thumbnails…"
                        : "Click \"Reload Thumbnails\" to fetch available options"}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2">
                      {frames.map((frame, i) => {
                        const isSelected = selectedIndex === i;
                        return (
                          <div
                            key={i}
                            className={`relative group rounded-lg overflow-hidden cursor-pointer border-2 transition-all ${
                              isSelected
                                ? "border-purple-500 shadow-lg shadow-purple-500/30"
                                : "border-white/10 hover:border-purple-400/50"
                            }`}
                            onClick={() => setSelectedIndex(i)}
                          >
                            <img
                              src={frame}
                              alt={`Thumbnail ${i + 1}`}
                              className={`w-full object-cover bg-white/5 ${squareFrames.has(frame.slice(0, 100)) ? "aspect-square" : "aspect-video"}`}
                              loading="lazy"
                              onError={e => {
                                const el = e.target as HTMLImageElement;
                                el.style.opacity = "0.2";
                                el.style.filter = "grayscale(1)";
                              }}
                            />

                            {/* Selected badge */}
                            {isSelected && (
                              <div className="absolute top-1.5 left-1.5 bg-purple-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full z-10">
                                ✓ Selected
                              </div>
                            )}

                            {/* Hover overlay */}
                            {!isSelected && (
                              <div className="absolute inset-0 bg-purple-900/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                                <span className="text-white text-xs font-semibold bg-black/60 px-2 py-1 rounded-full">Select</span>
                              </div>
                            )}

                            {/* Action buttons (top-right) */}
                            <div className="absolute top-1.5 right-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
                              {/* Crop button */}
                              <button
                                type="button"
                                onClick={e => { e.stopPropagation(); setSelectedIndex(i); enterCropMode(i); }}
                                title="Crop to square"
                                className="bg-purple-600/90 hover:bg-purple-500 text-white rounded-full p-1.5 transition-all shadow"
                              >
                                <Scissors className="w-3 h-3" />
                              </button>
                              {/* Delete button — always visible for all types */}
                              <button
                                type="button"
                                onClick={e => { e.stopPropagation(); removeFrame(i); }}
                                title="Remove"
                                className="bg-black/70 hover:bg-red-500 text-white/70 hover:text-white rounded-full p-1.5 transition-all shadow"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Grid footer */}
                <div className="shrink-0 border-t border-white/10 px-4 py-3 flex items-center gap-3">
                  <div className="flex-1 text-xs text-white/40">
                    {selectedIndex !== null
                      ? <>
                          Thumbnail {selectedIndex + 1} selected —{" "}
                          <button
                            onClick={() => enterCropMode(selectedIndex)}
                            className="text-purple-400 hover:text-purple-300 underline underline-offset-2 transition-colors"
                          >
                            crop to square
                          </button>
                          {" "}or apply as-is
                        </>
                      : "Click a thumbnail to select it, then crop or apply directly"}
                  </div>
                  <Button
                    type="button"
                    onClick={onClose}
                    variant="outline"
                    className="bg-transparent border-white/20 text-white/60 hover:text-white hover:bg-white/10"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleApply}
                    disabled={selectedIndex === null}
                    className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Apply as Project Image
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}