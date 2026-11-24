// Honest ways to build social proof for one tool:
//   1. Ask license holders for a review (email, 60-day cooldown per person)
//   2. Testimonials — real quotes shared with permission, shown separately
//   3. Usage numbers — real counts, only shown publicly above a minimum
import { useEffect, useState } from 'react';
import { Button } from '../ui/button';
import { Mail, Quote, BarChart3, Loader2, Plus, Trash2, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

interface Testimonial {
  id?: string;
  name: string;
  role: string;
  quote: string;
  source: string;
  permission: boolean;
  createdAt?: string;
}

const cardCls = 'rounded-xl border border-white/10 bg-white/3 p-4 flex flex-col gap-3';
const inputCls = 'w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-purple-500';

function Status({ kind, msg }: { kind: 'ok' | 'err'; msg: string }) {
  return (
    <p className={`flex items-start gap-1.5 text-xs ${kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
      {kind === 'ok' ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0 mt-px" /> : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-px" />}
      {msg}
    </p>
  );
}

export function GrowReviewsPanel({ toolId, toolName }: { toolId: string; toolName: string }) {
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${publicAnonKey}`,
    'X-Admin-Token': localStorage.getItem('admin_token') || '',
  };

  /* ── 1. Ask for reviews ─────────────────────────────────────────────────── */
  const [preview, setPreview] = useState<{ licenseHolders: number; alreadyReviewed: number; recentlyAsked: number; eligible: number } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [askStatus, setAskStatus] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const loadPreview = async () => {
    setPreviewLoading(true);
    try {
      const res = await fetch(`${API_BASE}/admin/reviews/request-preview?toolId=${encodeURIComponent(toolId)}`, { headers });
      const data = await res.json();
      if (data.success) setPreview(data.data);
      else setAskStatus({ kind: 'err', msg: data.error || 'Could not load license holders.' });
    } catch (err) {
      setAskStatus({ kind: 'err', msg: String(err) });
    }
    setPreviewLoading(false);
  };

  const sendRequests = async () => {
    if (!preview?.eligible) return;
    if (!confirm(`Email ${preview.eligible} license holder${preview.eligible !== 1 ? 's' : ''} of ${toolName} asking for an honest review?`)) return;
    setSending(true);
    setAskStatus(null);
    try {
      const res = await fetch(`${API_BASE}/admin/reviews/request`, { method: 'POST', headers, body: JSON.stringify({ toolId }) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Sending failed.');
      const { sent, failed } = data.data;
      setAskStatus({ kind: failed ? 'err' : 'ok', msg: `Sent ${sent} email${sent !== 1 ? 's' : ''}${failed ? `, ${failed} failed` : ''}.` });
      loadPreview();
    } catch (err: any) {
      setAskStatus({ kind: 'err', msg: err?.message || String(err) });
    }
    setSending(false);
  };

  /* ── 2. Testimonials ────────────────────────────────────────────────────── */
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [draft, setDraft] = useState<Testimonial>({ name: '', role: '', quote: '', source: '', permission: false });
  const [tmSaving, setTmSaving] = useState(false);
  const [tmStatus, setTmStatus] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const loadTestimonials = async () => {
    try {
      const res = await fetch(`${API_BASE}/tools/${encodeURIComponent(toolId)}/testimonials`, { headers: { Authorization: `Bearer ${publicAnonKey}` } });
      const data = await res.json();
      if (data.success) setTestimonials(data.data || []);
    } catch { /* ignore */ }
  };

  const saveTestimonials = async (next: Testimonial[], okMsg: string) => {
    setTmSaving(true);
    setTmStatus(null);
    try {
      const res = await fetch(`${API_BASE}/admin/tools/${encodeURIComponent(toolId)}/testimonials`, {
        method: 'PUT', headers, body: JSON.stringify({ testimonials: next }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not save.');
      setTestimonials(data.data);
      setTmStatus({ kind: 'ok', msg: okMsg });
      return true;
    } catch (err: any) {
      setTmStatus({ kind: 'err', msg: err?.message || String(err) });
      return false;
    } finally {
      setTmSaving(false);
    }
  };

  const addTestimonial = async () => {
    if (!draft.name.trim() || !draft.quote.trim()) {
      setTmStatus({ kind: 'err', msg: 'Add a name and the quote.' });
      return;
    }
    if (!draft.permission) {
      setTmStatus({ kind: 'err', msg: 'Tick the permission box first.' });
      return;
    }
    const ok = await saveTestimonials([...testimonials, draft], 'Testimonial added — it now shows on the tool page.');
    if (ok) setDraft({ name: '', role: '', quote: '', source: '', permission: false });
  };

  const removeTestimonial = (id?: string) => {
    if (!confirm('Remove this testimonial from the tool page?')) return;
    saveTestimonials(testimonials.filter(t => t.id !== id), 'Testimonial removed.');
  };

  /* ── 3. Usage numbers ───────────────────────────────────────────────────── */
  const [proof, setProof] = useState<{ downloads: number; activeLicenses: number; minimum: number } | null>(null);
  const [minimumInput, setMinimumInput] = useState('');
  const [minSaving, setMinSaving] = useState(false);
  const [proofStatus, setProofStatus] = useState<{ kind: 'ok' | 'err'; msg: string } | null>(null);

  const loadProof = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/tools/${encodeURIComponent(toolId)}/social-proof`, { headers });
      const data = await res.json();
      if (data.success) {
        setProof(data.data);
        setMinimumInput(String(data.data.minimum));
      }
    } catch { /* ignore */ }
  };

  const saveMinimum = async () => {
    const n = Math.floor(Number(minimumInput));
    if (!Number.isFinite(n) || n < 1) {
      setProofStatus({ kind: 'err', msg: 'Enter a whole number of 1 or more.' });
      return;
    }
    setMinSaving(true);
    setProofStatus(null);
    try {
      const res = await fetch(`${API_BASE}/settings`, { method: 'POST', headers, body: JSON.stringify({ socialProofMinimum: n }) });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not save.');
      setProofStatus({ kind: 'ok', msg: 'Minimum saved (applies to every tool).' });
      loadProof();
    } catch (err: any) {
      setProofStatus({ kind: 'err', msg: err?.message || String(err) });
    }
    setMinSaving(false);
  };

  useEffect(() => {
    setPreview(null); setAskStatus(null); setTmStatus(null); setProofStatus(null); setProof(null);
    loadPreview();
    loadTestimonials();
    loadProof();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toolId]);

  return (
    <div className="mb-6">
      <p className="text-white/50 text-xs font-semibold uppercase tracking-wider mb-3">Grow reviews · {toolName}</p>
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">

        {/* 1. Ask for reviews */}
        <div className={cardCls}>
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <Mail className="w-4 h-4 text-purple-400" /> Ask license holders
          </div>
          <p className="text-white/45 text-xs leading-relaxed">
            Emails each active license holder a short "How's it working for you?" note with a link that opens the review form on the tool page.
          </p>
          {previewLoading ? (
            <p className="text-white/40 text-xs flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Counting license holders…</p>
          ) : preview && (
            <ul className="text-xs text-white/55 space-y-0.5">
              <li>{preview.licenseHolders} active license holder{preview.licenseHolders !== 1 ? 's' : ''}</li>
              <li>{preview.alreadyReviewed} already reviewed · {preview.recentlyAsked} asked in the last 60 days</li>
              <li className="text-white/80 font-semibold">{preview.eligible} will receive the email</li>
            </ul>
          )}
          <Button
            onClick={sendRequests}
            disabled={sending || previewLoading || !preview?.eligible}
            className="cursor-pointer bg-purple-600 hover:bg-purple-500 text-white mt-auto"
          >
            {sending ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Sending…</> : <><Mail className="w-4 h-4 mr-2" />Send {preview?.eligible ?? 0} email{preview?.eligible === 1 ? '' : 's'}</>}
          </Button>
          {askStatus && <Status {...askStatus} />}
        </div>

        {/* 2. Testimonials */}
        <div className={cardCls}>
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <Quote className="w-4 h-4 text-purple-400" /> Testimonials
          </div>
          <p className="text-white/45 text-xs leading-relaxed">
            Real words from clients or beta testers (email, DM…), shown in their own section. They never count toward the star rating.
          </p>

          {testimonials.length > 0 && (
            <ul className="space-y-2">
              {testimonials.map(t => (
                <li key={t.id} className="flex items-start gap-2 rounded-lg bg-white/4 border border-white/8 p-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-white/70 text-xs line-clamp-2">"{t.quote}"</p>
                    <p className="text-white/40 text-[11px] mt-1">— {t.name}{t.role ? `, ${t.role}` : ''}{t.source ? ` · via ${t.source}` : ''}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeTestimonial(t.id)}
                    disabled={tmSaving}
                    className="p-1.5 rounded-md text-white/35 hover:text-red-400 hover:bg-red-500/10"
                    title="Remove"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input className={inputCls} placeholder="Name *" value={draft.name} onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
              <input className={inputCls} placeholder="Role / company" value={draft.role} onChange={e => setDraft(d => ({ ...d, role: e.target.value }))} />
            </div>
            <textarea className={`${inputCls} resize-y`} rows={3} placeholder="Their words, exactly as they wrote them *" value={draft.quote} onChange={e => setDraft(d => ({ ...d, quote: e.target.value }))} />
            <input className={inputCls} placeholder="Where they said it (e.g. email, Discord) — admin only" value={draft.source} onChange={e => setDraft(d => ({ ...d, source: e.target.value }))} />
            <label className="flex items-start gap-2 text-xs text-white/60 cursor-pointer select-none">
              <input type="checkbox" className="mt-0.5" checked={draft.permission} onChange={e => setDraft(d => ({ ...d, permission: e.target.checked }))} />
              This person agreed to have their words and name published.
            </label>
            <Button onClick={addTestimonial} disabled={tmSaving} variant="outline" className="cursor-pointer bg-white/5 border-white/15 text-white hover:bg-white/10 w-full">
              {tmSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Plus className="w-4 h-4 mr-2" />}Add testimonial
            </Button>
          </div>
          {tmStatus && <Status {...tmStatus} />}
        </div>

        {/* 3. Usage numbers */}
        <div className={cardCls}>
          <div className="flex items-center gap-2 text-white font-semibold text-sm">
            <BarChart3 className="w-4 h-4 text-purple-400" /> Usage numbers
          </div>
          <p className="text-white/45 text-xs leading-relaxed">
            Real counts shown as badges at the top of the tool page — each one only once it reaches the minimum, so small numbers stay private.
          </p>
          {proof ? (
            <ul className="text-xs space-y-1.5">
              {[
                { label: 'Free downloads (unique people)', value: proof.downloads },
                { label: 'Active licenses', value: proof.activeLicenses },
              ].map(row => (
                <li key={row.label} className="flex items-center justify-between gap-2">
                  <span className="text-white/55">{row.label}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-white font-semibold tabular-nums">{row.value.toLocaleString()}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${row.value >= proof.minimum ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-300' : 'bg-white/5 border-white/10 text-white/35'}`}>
                      {row.value >= proof.minimum ? 'shown' : 'hidden'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-white/40 text-xs flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…</p>
          )}
          <div className="mt-auto">
            <label className="block text-white/45 text-[11px] mb-1">Show a number once it reaches</label>
            <div className="flex gap-2">
              <input type="number" min={1} className={inputCls} value={minimumInput} onChange={e => setMinimumInput(e.target.value)} />
              <Button onClick={saveMinimum} disabled={minSaving} className="cursor-pointer bg-purple-600 hover:bg-purple-500 text-white">
                {minSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          {proofStatus && <Status {...proofStatus} />}
        </div>
      </div>
    </div>
  );
}
