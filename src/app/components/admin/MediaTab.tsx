// Admin → Media: every uploaded image with its size and where it is used.
// Upload (compressed), copy link, compress or replace in place (same link, so
// pages keep working), and delete — unused images first.
// Server: GET/DELETE /admin/media, POST /admin/media/replace.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Images, Upload, Trash2, Copy, CheckCheck, RefreshCw, Loader2, Minimize2, Replace,
  Search, AlertTriangle, ExternalLink,
} from 'lucide-react';
import { GlassCard } from '../shared/GlassCard';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { compressImage, formatBytes } from '../../utils/compressImage';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;
const headers = () => ({ Authorization: `Bearer ${publicAnonKey}`, 'X-Admin-Token': localStorage.getItem('admin_token') || '' });

interface MediaFile {
  name: string;
  url: string;
  size: number;
  type: string;
  createdAt: string | null;
  usedIn: string[];
}
interface BucketInfo { id: string; label: string; count: number; bytes: number }

const LARGE = 300 * 1024;               // worth compressing above this
const FREE_PLAN_BYTES = 1024 ** 3;      // Supabase free plan storage

/** Settings for re-compressing a stored image, based on where it is used. */
function compressOptionsFor(f: MediaFile) {
  // Link previews (SEO share images): JPEG, because some social sites skip WebP.
  if (f.usedIn.some(u => /^seo:|defaultOgImage/i.test(u))) return { maxSize: 1200, format: 'jpeg' as const };
  // Only used as a team photo: small.
  if (f.usedIn.length > 0 && f.usedIn.every(u => u.startsWith('Team:'))) return { maxSize: 800 };
  return {};
}
const canCompress = (f: MediaFile) => !/gif|svg/i.test(f.type) && f.size > LARGE;

const niceDate = (iso: string | null) => iso ? new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

export function MediaTab() {
  const [files, setFiles]       = useState<MediaFile[]>([]);
  const [buckets, setBuckets]   = useState<BucketInfo[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [filter, setFilter]     = useState<'all' | 'unused' | 'large'>('all');
  const [sort, setSort]         = useState<'newest' | 'biggest'>('newest');
  const [query, setQuery]       = useState('');
  const [busy, setBusy]         = useState<Record<string, string>>({});   // name → what is happening
  const [notice, setNotice]     = useState('');
  const [copied, setCopied]     = useState<string | null>(null);
  const [bulk, setBulk]         = useState<{ label: string; done: number; total: number } | null>(null);
  const [version, setVersion]   = useState<Record<string, number>>({});   // cache-buster after a replace
  const uploadRef  = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<MediaFile | null>(null);

  async function load() {
    setLoading(true); setError('');
    try {
      const j = await fetch(`${API_BASE}/admin/media`, { headers: headers() }).then(r => r.json());
      if (!j.success) throw new Error(j.error || 'Could not load images');
      setFiles(j.data.files); setBuckets(j.data.buckets);
    } catch (e: any) {
      setError(/404|Failed to fetch|Not Found/i.test(String(e?.message)) || !e?.message
        ? 'The media list needs the server update (paste supabase/functions/server/index.tsx into make-server-e07959ec).'
        : e.message);
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const setFileBusy = (name: string, what: string | null) =>
    setBusy(b => { const n = { ...b }; if (what) n[name] = what; else delete n[name]; return n; });
  const flash = (msg: string) => { setNotice(msg); setTimeout(() => setNotice(n => n === msg ? '' : n), 5000); };
  const shown = (f: MediaFile) => version[f.name] ? `${f.url}?v=${version[f.name]}` : f.url;

  // ── Upload new images (compressed) ─────────────────────────────────────────
  async function uploadFiles(list: FileList) {
    let saved = 0, count = 0;
    setBulk({ label: 'Uploading', done: 0, total: list.length });
    for (const raw of Array.from(list)) {
      try {
        const packed = await compressImage(raw);
        const fd = new FormData(); fd.append('file', packed.file);
        const j = await fetch(`${API_BASE}/upload-image`, { method: 'POST', headers: headers(), body: fd }).then(r => r.json());
        if (!j.success) throw new Error(j.error);
        saved += packed.before - packed.after; count++;
      } catch (e: any) { flash(`${raw.name}: ${e?.message || e}`); }
      setBulk(b => b && { ...b, done: b.done + 1 });
    }
    setBulk(null);
    if (count) flash(`Uploaded ${count} image${count === 1 ? '' : 's'}${saved > 0 ? `, ${formatBytes(saved)} saved by compression` : ''}. Copy a link to use it.`);
    load();
  }

  // ── Replace a stored file in place (same link everywhere) ──────────────────
  async function replaceWith(f: MediaFile, file: File): Promise<number> {
    const fd = new FormData(); fd.append('name', f.name); fd.append('file', file);
    const j = await fetch(`${API_BASE}/admin/media/replace`, { method: 'POST', headers: headers(), body: fd }).then(r => r.json());
    if (!j.success) throw new Error(j.error || 'Replace failed');
    setFiles(prev => prev.map(x => x.name === f.name ? { ...x, size: file.size, type: file.type } : x));
    setVersion(v => ({ ...v, [f.name]: Date.now() }));
    return file.size;
  }

  /** Download, shrink and put back. Returns bytes saved (0 if it wouldn't get smaller). */
  async function compressOne(f: MediaFile): Promise<number> {
    const blob = await fetch(f.url, { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.blob(); });
    const packed = await compressImage(new File([blob], f.name, { type: blob.type || f.type }), compressOptionsFor(f));
    if (!packed.compressed || packed.after > packed.before * 0.9) return 0; // not worth it
    await replaceWith(f, packed.file);
    return packed.before - packed.after;
  }

  async function handleCompress(f: MediaFile) {
    setFileBusy(f.name, 'Compressing…');
    try {
      const saved = await compressOne(f);
      flash(saved ? `${f.name}: ${formatBytes(saved)} saved` : `${f.name} is already about as small as it gets`);
    } catch (e: any) { flash(`${f.name}: ${e?.message || e}`); }
    finally { setFileBusy(f.name, null); }
  }

  async function handleCompressAll() {
    const todo = files.filter(canCompress);
    if (!todo.length || !confirm(`Compress ${todo.length} large image${todo.length === 1 ? '' : 's'}? Links stay the same; each image is replaced by a smaller copy.`)) return;
    let saved = 0;
    setBulk({ label: 'Compressing', done: 0, total: todo.length });
    for (const f of todo) {
      setFileBusy(f.name, 'Compressing…');
      try { saved += await compressOne(f); } catch { /* keep going */ }
      setFileBusy(f.name, null);
      setBulk(b => b && { ...b, done: b.done + 1 });
    }
    setBulk(null);
    flash(`Done: ${formatBytes(saved)} saved.`);
  }

  function pickReplacement(f: MediaFile) {
    replaceTarget.current = f;
    replaceRef.current?.click();
  }
  async function onReplacementPicked(file: File | undefined) {
    const f = replaceTarget.current;
    if (!file || !f) return;
    setFileBusy(f.name, 'Replacing…');
    try {
      const packed = await compressImage(file, compressOptionsFor(f));
      await replaceWith(f, packed.file);
      flash(`${f.name} replaced${f.usedIn.length ? ` — updated on ${f.usedIn.length} place${f.usedIn.length === 1 ? '' : 's'}` : ''}. Visitors may see the old one for up to an hour.`);
    } catch (e: any) { flash(`${f.name}: ${e?.message || e}`); }
    finally { setFileBusy(f.name, null); }
  }

  // ── Delete ─────────────────────────────────────────────────────────────────
  async function deleteOne(f: MediaFile, force: boolean) {
    const r = await fetch(`${API_BASE}/admin/media?name=${encodeURIComponent(f.name)}${force ? '&force=1' : ''}`, { method: 'DELETE', headers: headers() });
    const j = await r.json();
    if (r.status === 409) return j.usedIn as string[];
    if (!j.success) throw new Error(j.error || 'Delete failed');
    setFiles(prev => prev.filter(x => x.name !== f.name));
    return null;
  }

  async function handleDelete(f: MediaFile) {
    const msg = f.usedIn.length
      ? `This image is used in:\n• ${f.usedIn.join('\n• ')}\n\nDeleting it will leave a broken image there. Delete anyway?`
      : `Delete ${f.name}? This can't be undone.`;
    if (!confirm(msg)) return;
    setFileBusy(f.name, 'Deleting…');
    try {
      const stillUsed = await deleteOne(f, f.usedIn.length > 0);
      if (stillUsed && confirm(`It was just added to:\n• ${stillUsed.join('\n• ')}\n\nDelete anyway?`)) await deleteOne(f, true);
    } catch (e: any) { flash(`${f.name}: ${e?.message || e}`); }
    finally { setFileBusy(f.name, null); }
  }

  async function handleDeleteUnused() {
    const unused = files.filter(f => f.usedIn.length === 0);
    const bytes = unused.reduce((a, f) => a + f.size, 0);
    if (!unused.length || !confirm(`Delete ${unused.length} unused image${unused.length === 1 ? '' : 's'} (${formatBytes(bytes)})? Nothing on the site uses them. This can't be undone.`)) return;
    setBulk({ label: 'Deleting', done: 0, total: unused.length });
    let skipped = 0;
    for (const f of unused) {
      // Not forced: the server re-checks, so anything used since the list loaded is kept.
      try { if (await deleteOne(f, false)) skipped++; } catch { skipped++; }
      setBulk(b => b && { ...b, done: b.done + 1 });
    }
    setBulk(null);
    flash(`Deleted ${unused.length - skipped} image${unused.length - skipped === 1 ? '' : 's'}${skipped ? `, kept ${skipped} that turned out to be in use` : ''}.`);
    load();
  }

  function copyLink(f: MediaFile) {
    navigator.clipboard?.writeText(f.url).catch(() => {});
    setCopied(f.name); setTimeout(() => setCopied(null), 2000);
  }

  // ── View ───────────────────────────────────────────────────────────────────
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return files
      .filter(f => filter === 'all' || (filter === 'unused' ? f.usedIn.length === 0 : canCompress(f)))
      .filter(f => !q || f.name.toLowerCase().includes(q) || f.usedIn.some(u => u.toLowerCase().includes(q)))
      .sort((a, b) => sort === 'biggest' ? b.size - a.size : String(b.createdAt).localeCompare(String(a.createdAt)));
  }, [files, filter, sort, query]);

  const unusedCount = files.filter(f => f.usedIn.length === 0).length;
  const unusedBytes = files.filter(f => f.usedIn.length === 0).reduce((a, f) => a + f.size, 0);
  const largeCount  = files.filter(canCompress).length;
  const totalBytes  = buckets.reduce((a, b) => a + b.bytes, 0);
  const pct         = Math.min(100, (totalBytes / FREE_PLAN_BYTES) * 100);

  return (
    <div className="space-y-5">
      <input ref={uploadRef} type="file" accept="image/*" multiple className="hidden"
        onChange={e => { if (e.target.files?.length) uploadFiles(e.target.files); e.target.value = ''; }} />
      <input ref={replaceRef} type="file" accept="image/*" className="hidden"
        onChange={e => { onReplacementPicked(e.target.files?.[0]); e.target.value = ''; }} />

      {/* Header + storage */}
      <GlassCard className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
              <Images className="w-4 h-4 text-purple-300" />
            </div>
            <div>
              <h2 className="text-white font-semibold">Media</h2>
              <p className="text-white/40 text-xs">Every uploaded image, how big it is and where it's used. New uploads are compressed automatically.</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={load} disabled={loading} title="Refresh"
              className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-sm">
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={() => uploadRef.current?.click()} disabled={!!bulk}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold disabled:opacity-50">
              <Upload className="w-4 h-4" /> Upload images
            </button>
          </div>
        </div>

        {buckets.length > 0 && (
          <div className="mt-5">
            <div className="flex items-baseline justify-between text-xs mb-1.5">
              <span className="text-white/70 font-medium">{formatBytes(totalBytes)} of storage used</span>
              <span className="text-white/30">Supabase free plan: 1 GB</span>
            </div>
            <div className="h-2 rounded-full bg-white/8 overflow-hidden">
              <div className={`h-full rounded-full ${pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-amber-500' : 'bg-purple-500'}`} style={{ width: `${Math.max(pct, 0.5)}%` }} />
            </div>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-2 text-[11px] text-white/40">
              {buckets.map(b => <span key={b.id}>{b.label}: <span className="text-white/65">{formatBytes(b.bytes)}</span> · {b.count} file{b.count === 1 ? '' : 's'}</span>)}
            </div>
          </div>
        )}
      </GlassCard>

      {error && (
        <GlassCard className="p-4 border-amber-500/30 bg-amber-500/5 flex items-center gap-2 text-amber-200 text-sm">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
        </GlassCard>
      )}

      {/* Clean-up actions */}
      {(unusedCount > 0 || largeCount > 0) && (
        <div className="grid sm:grid-cols-2 gap-3">
          {unusedCount > 0 && (
            <GlassCard className="p-4 flex items-center justify-between gap-3">
              <div className="text-sm">
                <p className="text-white/80 font-medium">{unusedCount} unused image{unusedCount === 1 ? '' : 's'}</p>
                <p className="text-white/40 text-xs">{formatBytes(unusedBytes)} that nothing on the site shows</p>
              </div>
              <button onClick={handleDeleteUnused} disabled={!!bulk}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-500/15 border border-red-500/30 text-red-300 hover:bg-red-500/25 text-xs font-semibold whitespace-nowrap disabled:opacity-50">
                <Trash2 className="w-3.5 h-3.5" /> Delete unused
              </button>
            </GlassCard>
          )}
          {largeCount > 0 && (
            <GlassCard className="p-4 flex items-center justify-between gap-3">
              <div className="text-sm">
                <p className="text-white/80 font-medium">{largeCount} large image{largeCount === 1 ? '' : 's'}</p>
                <p className="text-white/40 text-xs">Over {formatBytes(LARGE)} — shrink them without changing their links</p>
              </div>
              <button onClick={handleCompressAll} disabled={!!bulk}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-500/15 border border-purple-500/30 text-purple-200 hover:bg-purple-500/25 text-xs font-semibold whitespace-nowrap disabled:opacity-50">
                <Minimize2 className="w-3.5 h-3.5" /> Compress all
              </button>
            </GlassCard>
          )}
        </div>
      )}

      {bulk && (
        <GlassCard className="p-3 flex items-center gap-3 text-sm text-white/70">
          <Loader2 className="w-4 h-4 animate-spin text-purple-300" />
          {bulk.label} {bulk.done}/{bulk.total}…
          <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
            <div className="h-full bg-purple-500 transition-all" style={{ width: `${(bulk.done / Math.max(1, bulk.total)) * 100}%` }} />
          </div>
        </GlassCard>
      )}
      {notice && <p className="text-emerald-300 text-sm">{notice}</p>}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        {([['all', `All (${files.length})`], ['unused', `Unused (${unusedCount})`], ['large', `Large (${largeCount})`]] as const).map(([v, label]) => (
          <button key={v} onClick={() => setFilter(v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium border ${filter === v ? 'bg-purple-600 border-purple-500 text-white' : 'bg-white/4 border-white/10 text-white/50 hover:text-white/80'}`}>
            {label}
          </button>
        ))}
        <select value={sort} onChange={e => setSort(e.target.value as any)}
          className="px-2 py-1.5 rounded-lg text-xs bg-white/5 border border-white/10 text-white/70">
          <option value="newest">Newest first</option>
          <option value="biggest">Biggest first</option>
        </select>
        <div className="relative flex-1 min-w-[160px]">
          <Search className="w-3.5 h-3.5 text-white/30 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search by name or where it's used…"
            className="w-full pl-8 pr-3 py-1.5 rounded-lg text-xs bg-white/5 border border-white/10 text-white placeholder:text-white/25 focus:outline-none focus:border-purple-500/50" />
        </div>
      </div>

      {/* Grid */}
      {loading && files.length === 0 ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-white/30" /></div>
      ) : visible.length === 0 ? (
        <p className="text-white/30 text-sm text-center py-12">{files.length ? 'No images match.' : 'No images uploaded yet.'}</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {visible.map(f => {
            const doing = busy[f.name];
            return (
              <GlassCard key={f.name} className="overflow-hidden flex flex-col">
                <a href={shown(f)} target="_blank" rel="noopener noreferrer" className="relative block aspect-video bg-black/40 group">
                  <img src={shown(f)} alt="" loading="lazy" decoding="async" className="w-full h-full object-contain" />
                  <span className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/60 rounded p-1">
                    <ExternalLink className="w-3 h-3 text-white" />
                  </span>
                  {doing && (
                    <div className="absolute inset-0 bg-black/60 flex items-center justify-center gap-2 text-white text-xs">
                      <Loader2 className="w-4 h-4 animate-spin" /> {doing}
                    </div>
                  )}
                </a>
                <div className="p-3 flex-1 flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className={`font-semibold ${f.size > LARGE ? 'text-amber-300' : 'text-white/70'}`}>{formatBytes(f.size)}</span>
                    <span className="text-white/30">{(f.type.split('/')[1] || '').toUpperCase()} · {niceDate(f.createdAt)}</span>
                  </div>
                  <p className="text-white/35 text-[10px] font-mono truncate" title={f.name}>{f.name}</p>
                  <div className="flex flex-wrap gap-1">
                    {f.usedIn.length === 0
                      ? <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-white/40">Unused</span>
                      : f.usedIn.slice(0, 3).map(u => (
                          <span key={u} className="text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-emerald-300 truncate max-w-full" title={u}>{u}</span>
                        ))}
                    {f.usedIn.length > 3 && <span className="text-[10px] text-white/35" title={f.usedIn.slice(3).join('\n')}>+{f.usedIn.length - 3}</span>}
                  </div>
                  <div className="flex items-center gap-1 mt-auto pt-1">
                    <button onClick={() => copyLink(f)} title="Copy link"
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white text-[11px]">
                      {copied === f.name ? <><CheckCheck className="w-3 h-3 text-emerald-400" /> Copied</> : <><Copy className="w-3 h-3" /> Link</>}
                    </button>
                    {canCompress(f) && (
                      <button onClick={() => handleCompress(f)} disabled={!!doing} title="Shrink this image (same link)"
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-200 text-[11px] disabled:opacity-50">
                        <Minimize2 className="w-3 h-3" /> Compress
                      </button>
                    )}
                    <button onClick={() => pickReplacement(f)} disabled={!!doing} title="Replace with another image (same link, updates everywhere it's used)"
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-white/60 hover:text-white disabled:opacity-50">
                      <Replace className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(f)} disabled={!!doing} title="Delete"
                      className="p-1.5 rounded-lg bg-white/5 hover:bg-red-500/20 text-white/60 hover:text-red-300 disabled:opacity-50">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}
    </div>
  );
}
