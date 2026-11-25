// "Republish" — rebuilds the public site on Vercel so content edited in the
// admin (projects, tools, guides, studio facts, SEO) reaches Google and AI
// assistants. Shows when there are changes not yet published.
import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Loader2, RefreshCw, Settings2 } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;
const headers = () => ({ Authorization: `Bearer ${publicAnonKey}`, 'X-Admin-Token': localStorage.getItem('admin_token') || '' });

interface Status { configured: boolean; lastRepublishAt: string | null; lastChangeAt: string | null; pendingChanges: boolean }

const ago = (iso: string | null) => {
  if (!iso) return 'never';
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return `${Math.floor(s / 86400)} d ago`;
};

export function RepublishButton({ onSetup, compact = false }: { onSetup: () => void; compact?: boolean }) {
  const [status, setStatus] = useState<Status | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/republish`, { headers: headers() });
      const json = await res.json();
      if (json.success) { setStatus(json.data); setUnavailable(false); }
      else setUnavailable(true); // server not updated yet
    } catch { setUnavailable(true); }
  }, []);

  useEffect(() => {
    load();
    const t = window.setInterval(load, 60_000);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    return () => { window.clearInterval(t); window.removeEventListener('focus', onFocus); };
  }, [load]);

  const republish = async () => {
    setBusy(true); setNote(null);
    try {
      const res = await fetch(`${API_BASE}/admin/republish`, { method: 'POST', headers: headers() });
      const json = await res.json();
      if (!json.success) {
        if (json.needsSetup) { onSetup(); }
        throw new Error(json.error || 'Republish failed');
      }
      setNote({ ok: true, text: 'Rebuilding — live in about 1–2 minutes.' });
      await load();
    } catch (err: any) {
      setNote({ ok: false, text: err?.message || String(err) });
    }
    setBusy(false);
  };

  if (unavailable) return null; // endpoint not deployed yet — hide quietly

  if (status && !status.configured) {
    return (
      <button type="button" onClick={onSetup}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-white/15 text-white/45 hover:text-white/75 text-xs ${compact ? '' : 'mb-2'}`}>
        <Settings2 className="w-3.5 h-3.5" /> Set up Republish
      </button>
    );
  }

  return (
    <div className={compact ? '' : 'mb-2'}>
      <button type="button" onClick={republish} disabled={busy || !status}
        title={status ? `Last published ${ago(status.lastRepublishAt)}` : ''}
        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors disabled:opacity-60 ${
          status?.pendingChanges
            ? 'bg-amber-500/15 border-amber-400/40 text-amber-100 hover:bg-amber-500/25'
            : 'bg-white/5 border-white/10 text-white/60 hover:text-white hover:bg-white/10'
        }`}>
        {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
          : status?.pendingChanges ? <RefreshCw className="w-3.5 h-3.5" />
          : <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />}
        <span className="flex-1 text-left">{busy ? 'Starting…' : 'Republish'}</span>
        {status?.pendingChanges && !busy && <span className="w-2 h-2 rounded-full bg-amber-400" aria-label="Unpublished changes" />}
      </button>
      <p className={`text-[10px] mt-1 px-1 ${note ? (note.ok ? 'text-emerald-300/80' : 'text-red-300') : 'text-white/30'}`}>
        {note ? note.text
          : status?.pendingChanges ? 'Changes not yet visible to Google & AI'
          : `Published ${ago(status?.lastRepublishAt ?? null)}`}
      </p>
    </div>
  );
}
