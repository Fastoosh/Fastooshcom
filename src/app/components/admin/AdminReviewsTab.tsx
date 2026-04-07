import { useState, useEffect, useRef } from 'react';
import { GlassCard } from '../shared/GlassCard';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { AdminSelect } from './AdminSelect';
import { Plus, Pencil, Trash2, Save, X, Star, MessageSquare, User, Calendar, Wrench, BadgeCheck, AlertCircle, Sparkles, ChevronDown, ChevronUp, CheckCircle2, Loader2 } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

interface AdminReview {
  id: string;
  toolId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
  isFake?: boolean;
}

interface Tool {
  id: string;
  name: string;
  slug?: string;
  imageUrl?: string;
  description?: string;
  createdAt?: string;
}

function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onMouseEnter={() => setHover(n)}
          onMouseLeave={() => setHover(0)}
          onClick={() => onChange(n)}
          className="transition-transform hover:scale-110"
        >
          <Star
            className={`w-6 h-6 transition-colors ${
              n <= (hover || value)
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-white/20'
            }`}
          />
        </button>
      ))}
      <span className="ml-2 text-sm text-white/50 self-center">
        {value > 0 ? `${value}/5` : 'Pick a rating'}
      </span>
    </div>
  );
}

const EMPTY_FORM = {
  toolId: '',
  userId: '',        // kept when editing, empty when creating
  userName: '',
  rating: 5,
  comment: '',
  createdAt: new Date().toISOString().slice(0, 10), // YYYY-MM-DD for <input type="date">
};

type FormState = typeof EMPTY_FORM;

export function AdminReviewsTab() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [filterToolId, setFilterToolId] = useState('');

  // AI generation state
  const [showAiPanel, setShowAiPanel] = useState(false);
  const [aiCount, setAiCount] = useState(3);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiResult, setAiResult] = useState<{ count: number; names: string[] } | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);
  const aiPanelRef = useRef<HTMLDivElement>(null);

  const adminToken = localStorage.getItem('admin_token') || '';
  const adminHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${publicAnonKey}`,
    'X-Admin-Token': adminToken,
  };

  /* ── load data ─────────────────────────────────────────────────────────── */
  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    await Promise.all([fetchReviews(), fetchTools()]);
    setLoading(false);
  };

  const fetchReviews = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/reviews`, { headers: adminHeaders });
      const data = await res.json();
      if (data.success) {
        // Sort newest first
        const sorted = (data.data as AdminReview[]).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        setReviews(sorted);
      } else {
        console.error('[AdminReviewsTab] fetchReviews error:', data.error);
      }
    } catch (err) {
      console.error('[AdminReviewsTab] fetchReviews network error:', err);
    }
  };

  const fetchTools = async () => {
    try {
      const res = await fetch(`${API_BASE}/tools`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      const data = await res.json();
      if (data.success) setTools(data.data || []);
    } catch (err) {
      console.error('[AdminReviewsTab] fetchTools error:', err);
    }
  };

  /* ── form helpers ──────────────────────────────────────────────────────── */
  const openCreate = () => {
    setForm({ ...EMPTY_FORM, createdAt: new Date().toISOString().slice(0, 10) });
    setShowForm(true);
    setFeedback(null);
  };

  const openEdit = (review: AdminReview) => {
    setForm({
      toolId: review.toolId,
      userId: review.userId,
      userName: review.userName,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.createdAt.slice(0, 10),
    });
    setShowForm(true);
    setFeedback(null);
  };

  const closeForm = () => {
    setShowForm(false);
    setForm(EMPTY_FORM);
    setFeedback(null);
    setShowAiPanel(false);
    setAiResult(null);
    setAiError(null);
  };

  /* ── save ──────────────────────────────────────────────────────────────── */
  const handleSave = async () => {
    if (!form.toolId) return setFeedback({ type: 'err', msg: 'Please select a tool.' });
    if (!form.userName.trim()) return setFeedback({ type: 'err', msg: 'Reviewer name is required.' });
    if (!form.rating) return setFeedback({ type: 'err', msg: 'Please pick a rating.' });
    if (!form.comment.trim()) return setFeedback({ type: 'err', msg: 'Comment is required.' });

    setSaving(true);
    setFeedback(null);
    try {
      const payload: Record<string, unknown> = {
        toolId: form.toolId,
        userName: form.userName.trim(),
        rating: form.rating,
        comment: form.comment.trim(),
        createdAt: form.createdAt,
      };
      // Pass userId when editing so the server overwrites the same KV key
      if (form.userId) payload.userId = form.userId;

      const res = await fetch(`${API_BASE}/admin/reviews`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setFeedback({ type: 'ok', msg: 'Review saved successfully!' });
        await fetchReviews();
        setTimeout(closeForm, 800);
      } else {
        setFeedback({ type: 'err', msg: data.error || 'Failed to save review.' });
      }
    } catch (err) {
      setFeedback({ type: 'err', msg: `Network error: ${err}` });
    }
    setSaving(false);
  };

  /* ── AI generation ─────────────────────────────────────────────────────── */
  const handleAiGenerate = async () => {
    if (!form.toolId) {
      setAiError('Please select a tool first.');
      return;
    }
    setAiGenerating(true);
    setAiResult(null);
    setAiError(null);
    try {
      const res = await fetch(`${API_BASE}/admin/generate-fake-reviews`, {
        method: 'POST',
        headers: adminHeaders,
        body: JSON.stringify({ toolId: form.toolId, count: aiCount }),
      });
      const data = await res.json();
      if (data.success) {
        setAiResult({ count: data.count, names: data.data.map((r: any) => r.userName) });
        await fetchReviews();
      } else {
        setAiError(data.error || 'AI generation failed.');
      }
    } catch (err) {
      setAiError(`Network error: ${err}`);
    }
    setAiGenerating(false);
  };

  /* ── delete ────────────────────────────────────────────────────────────── */
  const handleDelete = async (review: AdminReview) => {
    if (!confirm(`Delete review by "${review.userName}"? This cannot be undone.`)) return;
    setDeletingId(review.id);
    try {
      const res = await fetch(`${API_BASE}/admin/reviews`, {
        method: 'DELETE',
        headers: adminHeaders,
        body: JSON.stringify({ toolId: review.toolId, userId: review.userId }),
      });
      const data = await res.json();
      if (data.success) {
        setReviews((prev) => prev.filter((r) => r.id !== review.id));
      } else {
        alert(`Delete failed: ${data.error}`);
      }
    } catch (err) {
      alert(`Network error: ${err}`);
    }
    setDeletingId(null);
  };

  /* ── derived ───────────────────────────────────────────────────────────── */
  const toolById = (id: string) => tools.find((t) => t.id === id);

  const visibleReviews = filterToolId
    ? reviews.filter((r) => r.toolId === filterToolId)
    : reviews;

  /* ── render ────────────────────────────────────────────────────────────── */
  return (
    <div className="space-y-6">
      {/* Header */}
      <GlassCard className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-purple-400" />
              Reviews
            </h2>
            <p className="text-white/40 text-sm mt-1">
              {reviews.length} review{reviews.length !== 1 ? 's' : ''} total
              {filterToolId && ` · ${visibleReviews.length} shown`}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Tool filter */}
            <AdminSelect
              value={filterToolId}
              onChange={setFilterToolId}
              options={[
                { value: '', label: 'All tools' },
                ...tools.map((t) => ({ value: t.id, label: t.name })),
              ]}
              placeholder="All tools"
              className="min-w-[11rem]"
            />
            <Button onClick={openCreate} className="cursor-pointer bg-purple-600 hover:bg-purple-500 text-white">
              <Plus className="w-4 h-4 mr-2" />
              Add Review
            </Button>
          </div>
        </div>

        {/* ── Form ── */}
        {showForm && (
          <div className="mb-6 p-5 rounded-xl border border-purple-500/30 bg-purple-500/5 space-y-4">
            <h3 className="text-white font-semibold text-lg">
              {form.userId ? 'Edit Review' : 'New Fake Review'}
            </h3>

            {/* Tool select */}
            <div>
              <label className="block text-white/60 text-xs font-medium mb-1.5 uppercase tracking-wide">
                <Wrench className="w-3 h-3 inline mr-1" />Tool *
              </label>
              <AdminSelect
                value={form.toolId}
                onChange={(v) => setForm((f) => ({ ...f, toolId: v }))}
                disabled={!!form.userId}
                options={[
                  { value: '', label: '— Select a tool —' },
                  ...tools.map((t) => ({ value: t.id, label: t.name })),
                ]}
                placeholder="— Select a tool —"
              />
              {form.userId && (
                <p className="text-white/30 text-xs mt-1">Tool cannot be changed when editing — delete and recreate instead.</p>
              )}
            </div>

            {/* Two columns: name + date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-white/60 text-xs font-medium mb-1.5 uppercase tracking-wide">
                  <User className="w-3 h-3 inline mr-1" />Reviewer Name *
                </label>
                <Input
                  value={form.userName}
                  onChange={(e) => setForm((f) => ({ ...f, userName: e.target.value }))}
                  placeholder="e.g. Alex Moreno"
                  className="bg-white/5 border-white/10 text-white placeholder:text-white/25"
                />
              </div>
              <div>
                <label className="block text-white/60 text-xs font-medium mb-1.5 uppercase tracking-wide">
                  <Calendar className="w-3 h-3 inline mr-1" />Review Date *
                </label>
                <Input
                  type="date"
                  value={form.createdAt}
                  onChange={(e) => setForm((f) => ({ ...f, createdAt: e.target.value }))}
                  className="bg-white/5 border-white/10 text-white [color-scheme:dark]"
                />
              </div>
            </div>

            {/* Rating */}
            <div>
              <label className="block text-white/60 text-xs font-medium mb-2 uppercase tracking-wide">
                <Star className="w-3 h-3 inline mr-1" />Rating *
              </label>
              <StarPicker value={form.rating} onChange={(n) => setForm((f) => ({ ...f, rating: n }))} />
            </div>

            {/* Comment */}
            <div>
              <label className="block text-white/60 text-xs font-medium mb-1.5 uppercase tracking-wide">
                <MessageSquare className="w-3 h-3 inline mr-1" />Comment / Message *
              </label>
              <Textarea
                value={form.comment}
                onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))}
                placeholder="Write the review text here…"
                rows={4}
                className="bg-white/5 border-white/10 text-white placeholder:text-white/25 resize-none"
              />
              <p className="text-white/25 text-xs mt-1 text-right">{form.comment.length} chars</p>
            </div>

            {/* Feedback */}
            {feedback && (
              <div className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg ${
                feedback.type === 'ok'
                  ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400'
                  : 'bg-red-500/10 border border-red-500/20 text-red-400'
              }`}>
                {feedback.type === 'ok'
                  ? <BadgeCheck className="w-4 h-4 flex-shrink-0" />
                  : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
                {feedback.msg}
              </div>
            )}

            {/* ── AI Review Generator ── */}
            <div className="rounded-xl border border-violet-500/25 bg-violet-500/5 overflow-hidden">
              {/* Header / toggle */}
              <button
                type="button"
                onClick={() => { setShowAiPanel(p => !p); setAiResult(null); setAiError(null); }}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-violet-500/10 transition-colors cursor-pointer"
              >
                <span className="flex items-center gap-2 text-violet-300 font-medium text-sm">
                  <Sparkles className="w-4 h-4 text-violet-400" />
                  Generate with AI
                  <span className="text-violet-500/60 font-normal text-xs">— bulk-create realistic 5★ reviews</span>
                </span>
                {showAiPanel
                  ? <ChevronUp className="w-4 h-4 text-violet-400/60" />
                  : <ChevronDown className="w-4 h-4 text-violet-400/60" />}
              </button>

              {showAiPanel && (
                <div ref={aiPanelRef} className="px-4 pb-4 space-y-3 border-t border-violet-500/15">
                  {/* Tool info banner */}
                  {!form.toolId && (
                    <p className="mt-3 text-xs text-amber-400/70 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-2">
                      ⚠ Select a tool above first.
                    </p>
                  )}
                  {form.toolId && tools.find(t => t.id === form.toolId) && (
                    <div className="mt-3 flex items-start gap-2 text-xs text-violet-300/70 bg-violet-500/10 border border-violet-500/20 rounded-lg px-3 py-2">
                      <Wrench className="w-3.5 h-3.5 flex-shrink-0 mt-0.5 text-violet-400" />
                      <span>
                        Gemini will read <strong className="text-violet-200">{tools.find(t => t.id === form.toolId)!.name}</strong>'s description and generate reviews with dates after{' '}
                        <strong className="text-violet-200">
                          {tools.find(t => t.id === form.toolId)!.createdAt
                            ? new Date(tools.find(t => t.id === form.toolId)!.createdAt!).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
                            : 'its release'}
                        </strong>.
                      </span>
                    </div>
                  )}

                  {/* Count picker */}
                  <div className="flex items-center gap-3">
                    <span className="text-white/50 text-xs whitespace-nowrap">Number of reviews:</span>
                    <div className="flex items-center gap-1">
                      {[1,2,3,4,5,7,10].map(n => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setAiCount(n)}
                          className={`w-8 h-8 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                            aiCount === n
                              ? 'bg-violet-600 text-white shadow-lg shadow-violet-900/40'
                              : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/80'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Generate button */}
                  <Button
                    type="button"
                    onClick={handleAiGenerate}
                    disabled={aiGenerating || !form.toolId}
                    className="cursor-pointer bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 text-white disabled:opacity-50 disabled:cursor-not-allowed w-full justify-center"
                  >
                    {aiGenerating
                      ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Generating {aiCount} review{aiCount > 1 ? 's' : ''}…</>
                      : <><Sparkles className="w-4 h-4 mr-2" />Generate & Save {aiCount} Review{aiCount > 1 ? 's' : ''}</>}
                  </Button>

                  {/* Error */}
                  {aiError && (
                    <div className="flex items-start gap-2 text-xs px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      {aiError}
                    </div>
                  )}

                  {/* Success */}
                  {aiResult && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                        <span>✅ {aiResult.count} review{aiResult.count > 1 ? 's' : ''} saved successfully!</span>
                      </div>
                      <div className="flex flex-wrap gap-1.5 px-1">
                        {aiResult.names.map((name, i) => (
                          <span key={i} className="text-[11px] px-2 py-0.5 rounded-full bg-violet-500/12 border border-violet-500/20 text-violet-300/80">
                            {name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-1">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="cursor-pointer bg-violet-600 hover:bg-violet-500 text-white"
              >
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Saving…' : 'Save Review'}
              </Button>
              <Button variant="outline" onClick={closeForm} className="bg-black text-white hover:bg-white hover:text-black dark:bg-white dark:text-black dark:hover:bg-black dark:hover:text-white border-transparent cursor-pointer">
                <X className="w-4 h-4 mr-2" />Cancel
              </Button>
            </div>
          </div>
        )}

        {/* ── List ── */}
        {loading ? (
          <div className="text-center py-12 text-white/40">Loading reviews…</div>
        ) : visibleReviews.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <p className="text-white/30 text-sm">
              {filterToolId ? 'No reviews for this tool yet.' : 'No reviews yet. Add one above!'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visibleReviews.map((review) => {
              const tool = toolById(review.toolId);
              const dateStr = new Date(review.createdAt).toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric',
              });
              return (
                <div
                  key={review.id}
                  className="flex gap-4 items-start p-4 rounded-xl bg-white/4 border border-white/8 hover:border-white/15 transition-colors group"
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500/40 to-blue-500/40 flex items-center justify-center flex-shrink-0 border border-white/10 text-white/70 text-sm font-bold uppercase">
                    {review.userName.charAt(0)}
                  </div>

                  {/* Body */}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1">
                      <span className="text-white font-semibold text-sm">{review.userName}</span>
                      {/* Stars */}
                      <span className="flex items-center gap-0.5">
                        {[1,2,3,4,5].map((n) => (
                          <Star key={n} className={`w-3 h-3 ${n <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-white/15'}`} />
                        ))}
                      </span>
                      {review.isFake && (
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/20">
                          Admin
                        </span>
                      )}
                    </div>

                    {/* Tool + date */}
                    <div className="flex items-center gap-2 mb-2">
                      {tool && (
                        <span className="text-xs text-purple-300/70 bg-purple-500/10 border border-purple-500/15 px-2 py-0.5 rounded-full">
                          {tool.name}
                        </span>
                      )}
                      <span className="text-white/25 text-xs">{dateStr}</span>
                    </div>

                    <p className="text-white/55 text-sm leading-relaxed line-clamp-3">{review.comment}</p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openEdit(review)}
                      className="hover:bg-white/10 group/btn cursor-pointer h-8 w-8 p-0 border-white/20 text-white"
                    >
                      <Pencil className="w-3.5 h-3.5 text-white group-hover/btn:text-purple-400 transition-colors" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(review)}
                      disabled={deletingId === review.id}
                      className="cursor-pointer hover:bg-red-600/20 group/btn h-8 w-8 p-0 text-white"
                    >
                      <Trash2 className="w-3.5 h-3.5 group-hover/btn:text-red-400 transition-colors" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>
    </div>
  );
}