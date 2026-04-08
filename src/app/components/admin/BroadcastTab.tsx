import { useState, useEffect } from 'react';
import { GlassCard } from '../shared/GlassCard';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import {
  Mail, Send, Users, Plus, X, Eye, EyeOff,
  Loader2, CheckCircle2, AlertCircle, Upload, RefreshCw,
} from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

interface Lead { email: string; displayName?: string; }

export function BroadcastTab() {
  // ── Recipients ────────────────────────────────────────────────────────────
  const [dbLeads, setDbLeads]           = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [includeDb, setIncludeDb]       = useState(true);
  const [extraRaw, setExtraRaw]         = useState(''); // textarea: one email per line or comma-sep
  const [extraParsed, setExtraParsed]   = useState<string[]>([]);

  // ── Email content ─────────────────────────────────────────────────────────
  const [subject, setSubject]   = useState('Your Download Is Fixed — Here\'s Your Link');
  const [body, setBody]         = useState(
`Hi {{name}},

We recently discovered a bug that prevented some downloads from working correctly on our site. If you tried to download Fastoosh Data Automator and hit an error, that's on us — and we're sorry for the frustration.

The issue has been fully resolved.

You can now access your download here:
https://fastoosh.com/tools/fastoosh-data-automator?utm_source=email&utm_medium=newsletter

If you run into any issues or have questions, just reply to this email — we'll make it right.

Thank you for your patience.

— The Fastoosh Team`
  );

  // ── UI state ──────────────────────────────────────────────────────────────
  const [preview, setPreview]           = useState(false);
  const [sending, setSending]           = useState(false);
  const [result, setResult]             = useState<{ sent: number; failed: number; errors: string[] } | null>(null);
  const [error, setError]               = useState('');
  const [confirmed, setConfirmed]       = useState(false);

  // ── Load DB leads ─────────────────────────────────────────────────────────
  const loadLeads = async () => {
    setLoadingLeads(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/leads`, {
        headers: { Authorization: `Bearer ${publicAnonKey}`, 'X-Admin-Token': token || '' },
      });
      const data = await res.json();
      const leads: Lead[] = (data.data || []).map((l: any) => ({
        email: l.email,
        displayName: l.displayName || '',
      }));
      // Deduplicate by email
      const seen = new Set<string>();
      const unique = leads.filter(l => {
        if (seen.has(l.email)) return false;
        seen.add(l.email);
        return true;
      });
      setDbLeads(unique);
    } catch (e) {
      setError(`Failed to load leads: ${e}`);
    }
    setLoadingLeads(false);
  };

  useEffect(() => { loadLeads(); }, []);

  // ── Parse extra emails ────────────────────────────────────────────────────
  useEffect(() => {
    const emails = extraRaw
      .split(/[\n,;]+/)
      .map(e => e.trim().toLowerCase())
      .filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    setExtraParsed([...new Set(emails)]);
  }, [extraRaw]);

  // ── Combined recipient list ───────────────────────────────────────────────
  const allRecipients: Lead[] = (() => {
    const map = new Map<string, Lead>();
    if (includeDb) dbLeads.forEach(l => map.set(l.email, l));
    extraParsed.forEach(e => { if (!map.has(e)) map.set(e, { email: e }); });
    return [...map.values()];
  })();

  // ── Send ──────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) { setError('Subject and body are required.'); return; }
    if (allRecipients.length === 0) { setError('No recipients.'); return; }
    setSending(true);
    setError('');
    setResult(null);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/admin/broadcast`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
          'X-Admin-Token': token || '',
        },
        body: JSON.stringify({
          subject,
          body,
          recipients: allRecipients,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data.result);
        setConfirmed(false);
      } else {
        setError(data.error || 'Send failed.');
      }
    } catch (e) {
      setError(`Error: ${e}`);
    }
    setSending(false);
  };

  // ── Preview text with placeholder replaced ────────────────────────────────
  const previewBody = body.replace(/\{\{name\}\}/g, 'John');

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-white">Broadcast Email</h2>
        <p className="text-white/40 text-sm mt-1">Send a one-time email to your leads and any extra addresses.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left: Recipients ── */}
        <div className="space-y-4">
          <GlassCard className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                Recipients
              </h3>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                {allRecipients.length}
              </span>
            </div>

            {/* DB leads toggle */}
            <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/10 cursor-pointer hover:bg-white/5 transition-colors">
              <div>
                <p className="text-white text-sm font-medium">Database leads</p>
                <p className="text-white/35 text-xs mt-0.5">
                  {loadingLeads ? 'Loading…' : `${dbLeads.length} unique emails`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {loadingLeads
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white/30" />
                  : <button onClick={loadLeads} className="text-white/30 hover:text-purple-400 transition-colors">
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                }
                <input
                  type="checkbox"
                  checked={includeDb}
                  onChange={e => setIncludeDb(e.target.checked)}
                  className="accent-purple-500 w-4 h-4 rounded"
                />
              </div>
            </label>

            {/* Extra emails */}
            <div>
              <label className="text-white/40 text-xs font-medium block mb-1.5">
                Extra emails <span className="text-white/20">(paste from Gumroad, etc.)</span>
              </label>
              <Textarea
                value={extraRaw}
                onChange={e => setExtraRaw(e.target.value)}
                placeholder={'email1@example.com\nemail2@example.com\nor comma-separated'}
                rows={6}
                className="bg-white/5 border-white/10 text-white placeholder-white/20 text-xs resize-none font-mono"
              />
              {extraParsed.length > 0 && (
                <p className="text-purple-400 text-xs mt-1">{extraParsed.length} valid email{extraParsed.length !== 1 ? 's' : ''} parsed</p>
              )}
            </div>

            {/* Recipient preview list */}
            {allRecipients.length > 0 && (
              <div className="max-h-40 overflow-y-auto space-y-1">
                {allRecipients.slice(0, 50).map(r => (
                  <div key={r.email} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white/3">
                    <Mail className="w-3 h-3 text-white/20 flex-shrink-0" />
                    <span className="text-white/50 text-xs truncate">{r.email}</span>
                  </div>
                ))}
                {allRecipients.length > 50 && (
                  <p className="text-white/25 text-xs text-center py-1">+{allRecipients.length - 50} more</p>
                )}
              </div>
            )}
          </GlassCard>
        </div>

        {/* ── Right: Compose ── */}
        <div className="lg:col-span-2 space-y-4">
          <GlassCard className="p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                <Mail className="w-4 h-4 text-purple-400" />
                Compose
              </h3>
              <button
                onClick={() => setPreview(!preview)}
                className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
              >
                {preview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                {preview ? 'Edit' : 'Preview'}
              </button>
            </div>

            {/* Subject */}
            <div>
              <label className="text-white/40 text-xs font-medium block mb-1">Subject</label>
              <Input
                value={subject}
                onChange={e => setSubject(e.target.value)}
                placeholder="Your email subject"
                className="bg-white/5 border-white/10 text-white placeholder-white/20 text-sm"
              />
            </div>

            {/* Body */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-white/40 text-xs font-medium">Body</label>
                <span className="text-white/20 text-xs">Use <code className="text-purple-400">{'{{name}}'}</code> for first name</span>
              </div>
              {preview ? (
                <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-white/70 text-sm whitespace-pre-wrap leading-relaxed min-h-64 font-mono text-xs">
                  {previewBody}
                </div>
              ) : (
                <Textarea
                  value={body}
                  onChange={e => setBody(e.target.value)}
                  rows={16}
                  className="bg-white/5 border-white/10 text-white placeholder-white/20 text-sm resize-none font-mono"
                />
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <span>{error}</span>
                <button onClick={() => setError('')} className="ml-auto opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}

            {/* Result */}
            {result && (
              <div className="p-3 rounded-xl bg-green-500/10 border border-green-500/20 space-y-1">
                <p className="text-green-300 font-semibold text-sm flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  Broadcast sent
                </p>
                <p className="text-green-300/70 text-xs">
                  ✓ {result.sent} delivered · {result.failed} failed
                </p>
                {result.errors.length > 0 && (
                  <details className="mt-1">
                    <summary className="text-red-400/70 text-xs cursor-pointer">Show failures</summary>
                    <div className="mt-1 space-y-0.5">
                      {result.errors.map((e, i) => (
                        <p key={i} className="text-red-400/60 text-xs font-mono">{e}</p>
                      ))}
                    </div>
                  </details>
                )}
              </div>
            )}

            {/* Confirm + Send */}
            {!result && (
              <div className="flex items-center gap-3 pt-1">
                {allRecipients.length > 0 && !confirmed && (
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={e => setConfirmed(e.target.checked)}
                      className="accent-purple-500 w-4 h-4 rounded"
                    />
                    <span className="text-white/50 text-xs">
                      I confirm sending to <strong className="text-white/70">{allRecipients.length} recipients</strong>
                    </span>
                  </label>
                )}
                {confirmed && (
                  <Button
                    onClick={handleSend}
                    disabled={sending || !subject.trim() || !body.trim() || allRecipients.length === 0}
                    className="bg-purple-600 hover:bg-purple-500 text-white px-5"
                  >
                    {sending
                      ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Sending…</>
                      : <><Send className="w-4 h-4 mr-2" />Send to {allRecipients.length} recipients</>
                    }
                  </Button>
                )}
                {!confirmed && (
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={e => setConfirmed(e.target.checked)}
                      className="accent-purple-500 w-4 h-4 rounded"
                    />
                    <span className="text-white/50 text-xs">
                      I confirm sending to <strong className="text-white/70">{allRecipients.length} recipients</strong>
                    </span>
                  </label>
                )}
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
