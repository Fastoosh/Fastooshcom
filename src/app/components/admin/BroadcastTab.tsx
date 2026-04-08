import { useState, useEffect, useRef } from 'react';
import { GlassCard } from '../shared/GlassCard';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import {
  Mail, Send, Users, X, Eye, EyeOff,
  Loader2, CheckCircle2, AlertCircle, RefreshCw,
  Link2, Save, Trash2, ChevronDown, ChevronRight, BookMarked,
} from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;
const LISTS_KEY = 'broadcast_email_lists';

interface Lead { email: string; displayName?: string; }
interface SavedList { id: string; name: string; emails: string; savedAt: string; }

// ── Helpers ────────────────────────────────────────────────────────────────
function loadSavedLists(): SavedList[] {
  try { return JSON.parse(localStorage.getItem(LISTS_KEY) || '[]'); } catch { return []; }
}
function persistLists(lists: SavedList[]) {
  localStorage.setItem(LISTS_KEY, JSON.stringify(lists));
}

export function BroadcastTab() {
  // ── Recipients ─────────────────────────────────────────────────────────────
  const [dbLeads, setDbLeads]         = useState<Lead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [includeDb, setIncludeDb]     = useState(true);
  const [extraRaw, setExtraRaw]       = useState('');
  const [extraParsed, setExtraParsed] = useState<string[]>([]);

  // ── Saved lists ────────────────────────────────────────────────────────────
  const [savedLists, setSavedLists]   = useState<SavedList[]>(loadSavedLists);
  const [newListName, setNewListName] = useState('');
  const [listsOpen, setListsOpen]     = useState(true);

  // ── Email content ──────────────────────────────────────────────────────────
  const [subject, setSubject] = useState("Your Download Is Fixed — Here's Your Link");
  const [body, setBody] = useState(
`Hi {{name}},

We recently discovered a bug that prevented some downloads from working correctly on our site. If you tried to download [Fastoosh Data Automator](https://fastoosh.com/tools/fastoosh-data-automator?utm_source=email&utm_medium=newsletter) and hit an error, that's on us — and we're sorry for the frustration.

The issue has been fully resolved.

You can now access your download here:
[Get Fastoosh Data Automator](https://fastoosh.com/tools/fastoosh-data-automator?utm_source=email&utm_medium=newsletter)

If you run into any issues or have questions, just reply to this email — we'll make it right.

Thank you for your patience.

— The Fastoosh Team`
  );

  // ── Sender settings ───────────────────────────────────────────────────────
  const [senderName, setSenderName] = useState('Fastoosh');
  const [replyTo, setReplyTo]       = useState('youssef@fastoosh.com');

  // ── Link inserter ──────────────────────────────────────────────────────────
  const [showLinkBar, setShowLinkBar] = useState(false);
  const [linkText, setLinkText]       = useState('');
  const [linkUrl, setLinkUrl]         = useState('');
  const bodyRef = useRef<HTMLTextAreaElement>(null);

  // ── UI state ───────────────────────────────────────────────────────────────
  const [preview, setPreview]   = useState(false);
  const [sending, setSending]   = useState(false);
  const [result, setResult]     = useState<{ sent: number; failed: number; errors: string[] } | null>(null);
  const [error, setError]       = useState('');
  const [confirmed, setConfirmed] = useState(false);

  // ── Load DB leads ──────────────────────────────────────────────────────────
  const loadLeads = async () => {
    setLoadingLeads(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/leads`, {
        headers: { Authorization: `Bearer ${publicAnonKey}`, 'X-Admin-Token': token || '' },
      });
      const data = await res.json();
      const leads: Lead[] = (data.data || []).map((l: any) => ({ email: l.email, displayName: l.displayName || '' }));
      const seen = new Set<string>();
      setDbLeads(leads.filter(l => { if (seen.has(l.email)) return false; seen.add(l.email); return true; }));
    } catch (e) { setError(`Failed to load leads: ${e}`); }
    setLoadingLeads(false);
  };

  useEffect(() => { loadLeads(); }, []);

  // ── Parse extra emails ─────────────────────────────────────────────────────
  useEffect(() => {
    const emails = extraRaw.split(/[\n,;]+/).map(e => e.trim().toLowerCase()).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    setExtraParsed([...new Set(emails)]);
  }, [extraRaw]);

  // ── Combined recipients ────────────────────────────────────────────────────
  const allRecipients: Lead[] = (() => {
    const map = new Map<string, Lead>();
    if (includeDb) dbLeads.forEach(l => map.set(l.email, l));
    extraParsed.forEach(e => { if (!map.has(e)) map.set(e, { email: e }); });
    return [...map.values()];
  })();

  // ── Saved list actions ─────────────────────────────────────────────────────
  const saveCurrentList = () => {
    if (!newListName.trim() || !extraRaw.trim()) return;
    const updated = [...savedLists, {
      id: Date.now().toString(),
      name: newListName.trim(),
      emails: extraRaw.trim(),
      savedAt: new Date().toISOString(),
    }];
    setSavedLists(updated);
    persistLists(updated);
    setNewListName('');
  };

  const loadList = (list: SavedList) => {
    const merged = extraRaw.trim()
      ? extraRaw.trim() + '\n' + list.emails
      : list.emails;
    setExtraRaw(merged);
  };

  const deleteList = (id: string) => {
    const updated = savedLists.filter(l => l.id !== id);
    setSavedLists(updated);
    persistLists(updated);
  };

  // ── Link inserter ──────────────────────────────────────────────────────────
  const insertLink = () => {
    if (!linkText.trim() || !linkUrl.trim()) return;
    const md = `[${linkText.trim()}](${linkUrl.trim()})`;
    const ta = bodyRef.current;
    if (ta) {
      const start = ta.selectionStart;
      const end   = ta.selectionEnd;
      const next  = body.slice(0, start) + md + body.slice(end);
      setBody(next);
      // restore cursor after insertion
      setTimeout(() => { ta.focus(); ta.setSelectionRange(start + md.length, start + md.length); }, 0);
    } else {
      setBody(b => b + '\n' + md);
    }
    setLinkText('');
    setLinkUrl('');
    setShowLinkBar(false);
  };

  // Pre-fill linkText from selection
  const handleOpenLinkBar = () => {
    const ta = bodyRef.current;
    if (ta) {
      const sel = body.slice(ta.selectionStart, ta.selectionEnd);
      if (sel) setLinkText(sel);
    }
    setShowLinkBar(s => !s);
  };

  // ── Preview: render markdown links as <a> ──────────────────────────────────
  const renderPreview = (text: string) => {
    const withName = text.replace(/\{\{name\}\}/g, 'John');
    // Replace [text](url) with clickable links
    const parts = withName.split(/(\[[^\]]+\]\([^)]+\))/g);
    return parts.map((part, i) => {
      const m = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (m) return <a key={i} href={m[2]} target="_blank" rel="noreferrer" className="text-purple-400 underline">{m[1]}</a>;
      return <span key={i} style={{ whiteSpace: 'pre-wrap' }}>{part}</span>;
    });
  };

  // ── Send ───────────────────────────────────────────────────────────────────
  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) { setError('Subject and body are required.'); return; }
    if (allRecipients.length === 0) { setError('No recipients.'); return; }
    setSending(true); setError(''); setResult(null);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/admin/broadcast`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}`, 'X-Admin-Token': token || '' },
        body: JSON.stringify({ subject, body, recipients: allRecipients, senderName, replyTo }),
      });
      const data = await res.json();
      if (data.success) { setResult(data.result); setConfirmed(false); }
      else setError(data.error || 'Send failed.');
    } catch (e) { setError(`Error: ${e}`); }
    setSending(false);
  };

  // ───────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h2 className="text-2xl font-bold text-white">Broadcast Email</h2>
        <p className="text-white/40 text-sm mt-1">Send a one-time email to your leads and any extra addresses.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Left: Recipients ── */}
        <div className="space-y-4">

          {/* DB leads */}
          <GlassCard className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                Recipients
              </h3>
              <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300">
                {allRecipients.length}
              </span>
            </div>

            <label className="flex items-center justify-between gap-3 p-3 rounded-xl border border-white/10 cursor-pointer hover:bg-white/5 transition-colors">
              <div>
                <p className="text-white text-sm font-medium">Database leads</p>
                <p className="text-white/35 text-xs mt-0.5">{loadingLeads ? 'Loading…' : `${dbLeads.length} unique emails`}</p>
              </div>
              <div className="flex items-center gap-2">
                {loadingLeads
                  ? <Loader2 className="w-3.5 h-3.5 animate-spin text-white/30" />
                  : <button onClick={loadLeads} className="text-white/30 hover:text-purple-400 transition-colors"><RefreshCw className="w-3.5 h-3.5" /></button>}
                <input type="checkbox" checked={includeDb} onChange={e => setIncludeDb(e.target.checked)} className="accent-purple-500 w-4 h-4 rounded" />
              </div>
            </label>

            {/* Extra emails textarea */}
            <div>
              <label className="text-white/40 text-xs font-medium block mb-1.5">
                Extra emails <span className="text-white/20">(paste from Gumroad, etc.)</span>
              </label>
              <Textarea
                value={extraRaw}
                onChange={e => setExtraRaw(e.target.value)}
                placeholder={'email1@example.com\nemail2@example.com\nor comma-separated'}
                rows={5}
                className="bg-white/5 border-white/10 text-white placeholder-white/20 text-xs resize-none font-mono"
              />
              {extraParsed.length > 0 && (
                <p className="text-purple-400 text-xs mt-1">{extraParsed.length} valid email{extraParsed.length !== 1 ? 's' : ''} parsed</p>
              )}
            </div>

            {/* Save current list */}
            <div className="flex gap-2">
              <Input
                value={newListName}
                onChange={e => setNewListName(e.target.value)}
                placeholder="List name (e.g. Gumroad Apr 2025)"
                className="bg-white/5 border-white/10 text-white placeholder-white/20 text-xs h-8 flex-1"
                onKeyDown={e => { if (e.key === 'Enter') saveCurrentList(); }}
              />
              <button
                onClick={saveCurrentList}
                disabled={!newListName.trim() || !extraRaw.trim()}
                title="Save this list"
                className="px-2.5 py-1.5 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/25 disabled:opacity-30 transition-all"
              >
                <Save className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Recipient preview */}
            {allRecipients.length > 0 && (
              <div className="max-h-32 overflow-y-auto space-y-1">
                {allRecipients.slice(0, 50).map(r => (
                  <div key={r.email} className="flex items-center gap-2 px-2 py-1 rounded-lg bg-white/3">
                    <Mail className="w-3 h-3 text-white/20 flex-shrink-0" />
                    <span className="text-white/50 text-xs truncate">{r.email}</span>
                  </div>
                ))}
                {allRecipients.length > 50 && <p className="text-white/25 text-xs text-center py-1">+{allRecipients.length - 50} more</p>}
              </div>
            )}
          </GlassCard>

          {/* Saved lists */}
          <GlassCard className="p-4 space-y-2">
            <button
              onClick={() => setListsOpen(o => !o)}
              className="w-full flex items-center justify-between text-white/60 hover:text-white transition-colors"
            >
              <span className="text-sm font-semibold flex items-center gap-2">
                <BookMarked className="w-4 h-4 text-purple-400" />
                Saved Lists
                {savedLists.length > 0 && (
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300">{savedLists.length}</span>
                )}
              </span>
              {listsOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </button>

            {listsOpen && (
              <div className="space-y-1.5 pt-1">
                {savedLists.length === 0 && (
                  <p className="text-white/25 text-xs text-center py-3">No saved lists yet.<br />Paste emails above and save.</p>
                )}
                {savedLists.map(list => {
                  const count = list.emails.split(/[\n,;]+/).filter(e => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.trim())).length;
                  return (
                    <div key={list.id} className="flex items-center gap-2 p-2.5 rounded-xl border border-white/8 hover:bg-white/5 transition-colors group">
                      <div className="flex-1 min-w-0">
                        <p className="text-white/80 text-xs font-medium truncate">{list.name}</p>
                        <p className="text-white/30 text-[10px]">{count} emails · {new Date(list.savedAt).toLocaleDateString()}</p>
                      </div>
                      <button
                        onClick={() => loadList(list)}
                        title="Load into textarea"
                        className="text-purple-400/60 hover:text-purple-300 transition-colors text-[10px] font-semibold px-2 py-1 rounded-lg hover:bg-purple-500/15"
                      >
                        Load
                      </button>
                      <button
                        onClick={() => deleteList(list.id)}
                        title="Delete list"
                        className="text-white/20 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </GlassCard>
        </div>

        {/* ── Right: Compose ── */}
        <div className="lg:col-span-2 space-y-4">
          <GlassCard className="p-4 space-y-4">

            {/* Header */}
            <div className="flex items-center justify-between">
              <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                <Mail className="w-4 h-4 text-purple-400" />
                Compose
              </h3>
              <div className="flex items-center gap-2">
                {!preview && (
                  <button
                    onClick={handleOpenLinkBar}
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border transition-all ${
                      showLinkBar
                        ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                        : 'border-white/10 text-white/40 hover:text-white/70 hover:border-white/20'
                    }`}
                  >
                    <Link2 className="w-3.5 h-3.5" />
                    Insert link
                  </button>
                )}
                <button
                  onClick={() => setPreview(!preview)}
                  className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors"
                >
                  {preview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  {preview ? 'Edit' : 'Preview'}
                </button>
              </div>
            </div>

            {/* Link inserter bar */}
            {showLinkBar && !preview && (
              <div className="flex gap-2 p-3 rounded-xl bg-purple-500/8 border border-purple-500/20">
                <Input
                  value={linkText}
                  onChange={e => setLinkText(e.target.value)}
                  placeholder="Link text (e.g. Get Fastoosh Data Automator)"
                  className="bg-white/5 border-white/10 text-white placeholder-white/20 text-xs h-8 flex-1"
                />
                <Input
                  value={linkUrl}
                  onChange={e => setLinkUrl(e.target.value)}
                  placeholder="https://fastoosh.com/tools/..."
                  className="bg-white/5 border-white/10 text-white placeholder-white/20 text-xs h-8 flex-1"
                  onKeyDown={e => { if (e.key === 'Enter') insertLink(); }}
                />
                <button
                  onClick={insertLink}
                  disabled={!linkText.trim() || !linkUrl.trim()}
                  className="px-3 py-1.5 rounded-lg bg-purple-600/80 hover:bg-purple-600 text-white text-xs font-semibold disabled:opacity-30 transition-all whitespace-nowrap"
                >
                  Insert
                </button>
                <button onClick={() => setShowLinkBar(false)} className="text-white/30 hover:text-white/60">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Sender settings */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-white/40 text-xs font-medium block mb-1">Sender name</label>
                <Input
                  value={senderName}
                  onChange={e => setSenderName(e.target.value)}
                  placeholder="Fastoosh"
                  className="bg-white/5 border-white/10 text-white placeholder-white/20 text-sm"
                />
              </div>
              <div>
                <label className="text-white/40 text-xs font-medium block mb-1">
                  Reply-To <span className="text-white/20">(recipients reply to this)</span>
                </label>
                <Input
                  value={replyTo}
                  onChange={e => setReplyTo(e.target.value)}
                  placeholder="youssef@fastoosh.com"
                  className="bg-white/5 border-white/10 text-white placeholder-white/20 text-sm"
                />
              </div>
            </div>
            <p className="text-white/20 text-xs -mt-2">
              Sent from <code className="text-white/35">youssef@fastoosh.com</code> — requires fastoosh.com verified in Resend.
            </p>

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
                <span className="text-white/20 text-xs">
                  Use <code className="text-purple-400">{'{{name}}'}</code> · links: <code className="text-purple-400">[text](url)</code>
                </span>
              </div>
              {preview ? (
                <div className="bg-white/5 border border-white/10 rounded-lg p-4 text-white/70 text-sm leading-relaxed min-h-64 font-sans">
                  {renderPreview(body)}
                </div>
              ) : (
                <Textarea
                  ref={bodyRef}
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
                <p className="text-green-300/70 text-xs">✓ {result.sent} delivered · {result.failed} failed</p>
                {result.errors.length > 0 && (
                  <details className="mt-1">
                    <summary className="text-red-400/70 text-xs cursor-pointer">Show failures</summary>
                    <div className="mt-1 space-y-0.5">
                      {result.errors.map((e, i) => <p key={i} className="text-red-400/60 text-xs font-mono">{e}</p>)}
                    </div>
                  </details>
                )}
              </div>
            )}

            {/* Confirm + Send */}
            {!result && (
              <div className="flex items-center gap-3 pt-1">
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
              </div>
            )}
          </GlassCard>
        </div>
      </div>
    </div>
  );
}
