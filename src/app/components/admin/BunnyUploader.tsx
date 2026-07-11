// Admin uploader for Bunny Stream. Mirrors VimeoPicker's onSelect/onClose
// interface so the parent form can swap between them without further changes.
//
// Flow:
//   1. Admin picks a file → drop-zone or <input>
//   2. POST /admin/bunny/create-video → gets {videoGuid, tus signature}
//   3. Direct TUS upload from browser to https://video.bunnycdn.com/tusupload
//      (bytes bypass our Edge Function entirely — that matters at multi-GB)
//   4. Poll /admin/bunny/video/:guid until status >= 4 ("encoded")
//   5. onSelect(embedUrl, filename) — parent stores the URL on the project
//
// The uploader intentionally does NOT ask the admin to pick a thumbnail
// here. Bunny auto-generates one at upload time, and the existing
// VideoThumbnailCapture flow (with the Bunny direct-MP4 URL) handles custom
// thumbnails through the same UI the admin already knows.
import { useEffect, useRef, useState } from "react";
import * as tus from "tus-js-client";
import { X, UploadCloud, Loader2, CheckCircle2, AlertCircle, Film } from "lucide-react";
import { Button } from "../ui/button";
import { projectId, publicAnonKey } from "/utils/supabase/info";

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

interface BunnyUploaderProps {
  onSelect: (url: string, title: string) => void;
  onClose:  () => void;
}

type Stage = "idle" | "creating" | "uploading" | "encoding" | "done" | "error";

function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(2)} GB`;
}

export function BunnyUploader({ onSelect, onClose }: BunnyUploaderProps) {
  const [stage,       setStage]       = useState<Stage>("idle");
  const [file,        setFile]        = useState<File | null>(null);
  const [title,       setTitle]       = useState("");
  const [uploadPct,   setUploadPct]   = useState(0);
  const [encodePct,   setEncodePct]   = useState(0);
  const [error,       setError]       = useState("");
  const [videoGuid,   setVideoGuid]   = useState<string | null>(null);
  const [embedUrl,    setEmbedUrl]    = useState<string | null>(null);
  const uploadRef = useRef<tus.Upload | null>(null);
  const pollRef   = useRef<number | null>(null);

  // Abort in-flight work if the modal closes
  useEffect(() => {
    return () => {
      uploadRef.current?.abort().catch(() => {});
      if (pollRef.current) window.clearTimeout(pollRef.current);
    };
  }, []);

  const authHeaders = () => {
    const adminToken = localStorage.getItem("admin_token") ?? "";
    return {
      Authorization: `Bearer ${publicAnonKey}`,
      "X-Admin-Token": adminToken,
    };
  };

  const startUpload = async () => {
    if (!file) return;
    setError("");
    setStage("creating");
    setUploadPct(0);
    setEncodePct(0);

    try {
      const res = await fetch(`${API_BASE}/admin/bunny/create-video`, {
        method:  "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body:    JSON.stringify({ title: title.trim() || file.name }),
      });
      const data = await res.json();
      if (!data?.success) throw new Error(data?.error || "Server refused to create the video record.");

      setVideoGuid(data.videoGuid);
      setEmbedUrl(data.embedUrl);
      setStage("uploading");

      const upload = new tus.Upload(file, {
        endpoint:       data.tus.endpoint,
        retryDelays:    [0, 3000, 5000, 10000, 20000],
        chunkSize:      50 * 1024 * 1024, // 50 MB — Bunny recommends this range
        headers: {
          AuthorizationSignature: data.tus.authorizationSignature,
          AuthorizationExpire:    String(data.tus.authorizationExpire),
          VideoId:                data.videoGuid,
          LibraryId:              String(data.libraryId),
        },
        metadata: {
          filetype: file.type,
          title:    title.trim() || file.name,
        },
        onError: (err) => {
          console.error("[BunnyUploader] tus error:", err);
          setError(err?.message || String(err));
          setStage("error");
        },
        onProgress: (sent, total) => {
          setUploadPct(total ? Math.round((sent / total) * 100) : 0);
        },
        onSuccess: () => {
          setUploadPct(100);
          setStage("encoding");
          pollEncoding(data.videoGuid, data.embedUrl);
        },
      });

      uploadRef.current = upload;
      upload.start();
    } catch (err: any) {
      setError(err?.message || String(err));
      setStage("error");
    }
  };

  const pollEncoding = (guid: string, embed: string) => {
    let attempts = 0;
    const tick = async () => {
      attempts++;
      try {
        const res  = await fetch(`${API_BASE}/admin/bunny/video/${guid}`, { headers: authHeaders() });
        const data = await res.json();
        if (!data?.success) throw new Error(data?.error || "Status poll failed.");
        setEncodePct(data.encodeProgress ?? 0);

        // Bunny statuses: 3 = Finished, 4 = Resolution finished (playable)
        if (data.status >= 4) {
          setStage("done");
          return;
        }
        if (data.status === 5) {
          throw new Error("Bunny reported encoding failed.");
        }
        // Ceiling: give up after ~20 minutes of polling.
        if (attempts > 240) {
          throw new Error("Encoding is taking longer than expected. Check Bunny dashboard.");
        }
        pollRef.current = window.setTimeout(tick, 5000);
      } catch (err: any) {
        setError(err?.message || String(err));
        setStage("error");
      }
    };
    tick();
  };

  const confirmAndClose = () => {
    if (!embedUrl) return;
    onSelect(embedUrl, title.trim() || file?.name || "Uploaded video");
  };

  const canCancel = stage === "uploading" || stage === "encoding";
  const abortAll = () => {
    uploadRef.current?.abort().catch(() => {});
    if (pollRef.current) window.clearTimeout(pollRef.current);
    setStage("idle");
    setUploadPct(0);
    setEncodePct(0);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-white/10 rounded-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-orange-500/15 border border-orange-500/25 flex items-center justify-center">
              <UploadCloud className="w-4.5 h-4.5 text-orange-400" />
            </div>
            <div>
              <h2 className="text-white font-semibold text-base leading-tight">Upload to Bunny Stream</h2>
              <p className="text-white/40 text-xs">New videos go here — Vimeo picker still available for legacy imports.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={stage === "uploading" || stage === "creating"}
            className="text-white/40 hover:text-white/80 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            title={stage === "uploading" ? "Cancel the upload first" : "Close"}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          {stage === "idle" && (
            <>
              <label
                htmlFor="bunny-file"
                className="flex flex-col items-center justify-center gap-3 py-10 rounded-xl border-2 border-dashed border-white/15 hover:border-orange-500/40 bg-white/3 hover:bg-orange-500/5 transition-colors cursor-pointer"
              >
                <Film className="w-8 h-8 text-white/30" />
                <p className="text-sm text-white/70">
                  {file ? file.name : "Click to pick a video file"}
                </p>
                {file && (
                  <p className="text-xs text-white/40">{humanBytes(file.size)}</p>
                )}
                <input
                  id="bunny-file"
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={e => setFile(e.target.files?.[0] ?? null)}
                />
              </label>

              <div>
                <label className="block text-xs uppercase tracking-wider text-white/40 mb-1.5">
                  Title (optional)
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder={file?.name ?? "e.g. Client project — Fintech launch"}
                  className="w-full bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/25 focus:outline-none focus:border-orange-500/50"
                />
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  type="button"
                  onClick={onClose}
                  className="flex-1 bg-white/5 hover:bg-white/10 text-white/70 border border-white/10"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  onClick={startUpload}
                  disabled={!file}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-semibold disabled:opacity-40"
                >
                  Upload
                </Button>
              </div>
            </>
          )}

          {(stage === "creating" || stage === "uploading" || stage === "encoding") && (
            <div className="py-6 space-y-4">
              <div className="flex items-center gap-3">
                <Loader2 className="w-5 h-5 animate-spin text-orange-400" />
                <div className="flex-1">
                  <p className="text-white/80 text-sm font-medium">
                    {stage === "creating"  && "Reserving video slot on Bunny…"}
                    {stage === "uploading" && `Uploading — ${uploadPct}%`}
                    {stage === "encoding"  && `Encoding — ${encodePct}%`}
                  </p>
                  <p className="text-white/40 text-xs">
                    {stage === "uploading" && file && `${humanBytes(file.size)} · resumable — a network drop is OK`}
                    {stage === "encoding"  && "Bunny is building the streaming ladder. Usually 30s–5min."}
                  </p>
                </div>
              </div>
              <div className="w-full h-2 rounded-full bg-white/5 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-orange-500 to-amber-400 transition-all"
                  style={{ width: `${stage === "encoding" ? encodePct : uploadPct}%` }}
                />
              </div>
              {canCancel && (
                <Button
                  type="button"
                  onClick={abortAll}
                  className="w-full bg-white/5 hover:bg-white/10 text-white/60 border border-white/10 text-sm"
                >
                  Abort
                </Button>
              )}
            </div>
          )}

          {stage === "done" && (
            <div className="py-6 space-y-4 text-center">
              <div className="w-14 h-14 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <div>
                <p className="text-white font-semibold">Video is live on Bunny</p>
                <p className="text-white/40 text-xs mt-1 font-mono truncate" title={embedUrl ?? ""}>
                  {embedUrl}
                </p>
              </div>
              <Button
                type="button"
                onClick={confirmAndClose}
                className="w-full bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-semibold"
              >
                Use this video
              </Button>
            </div>
          )}

          {stage === "error" && (
            <div className="py-4 space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/25">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <p className="text-red-300 font-semibold text-sm">Upload failed</p>
                  <p className="text-red-300/70 text-xs mt-0.5 break-words">{error || "Unknown error"}</p>
                </div>
              </div>
              <Button
                type="button"
                onClick={() => { setStage("idle"); setError(""); }}
                className="w-full bg-white/5 hover:bg-white/10 text-white/70 border border-white/10"
              >
                Try again
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
