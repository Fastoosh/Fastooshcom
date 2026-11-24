// Admin review moderation.
//
// Reviews can only be written by customers who hold a license for the tool
// (enforced by POST /reviews on the server). This tab lets the admin read and
// remove reviews (spam, abuse) but not create or rewrite them.
//
// Older admin-written reviews (isFake: true) are never shown on the public
// site — the server filters them out — and are flagged here so they can be
// deleted, one by one or all at once.
import { useState, useEffect } from 'react';
import { GlassCard } from '../shared/GlassCard';
import { Button } from '../ui/button';
import { AdminSelect } from './AdminSelect';
import { GrowReviewsPanel } from './GrowReviewsPanel';
import { Trash2, Star, MessageSquare, ShieldCheck, EyeOff, Loader2, Reply } from 'lucide-react';
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
  reply?: { text: string; createdAt: string; updatedAt: string };
}

// Public reply from the admin, shown under the review on the tool page.
function ReplyBox({ review, onSaved, headers }: {
  review: AdminReview;
  onSaved: (updated: AdminReview) => void;
  headers: Record<string, string>;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(review.reply?.text ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const save = async (value: string) => {
    setSaving(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/admin/reviews/reply`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ toolId: review.toolId, userId: review.userId, text: value }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Could not save the reply.');
      onSaved(data.data);
      setText(data.data.reply?.text ?? '');
      setEditing(false);
    } catch (err: any) {
      setError(err?.message || String(err));
    }
    setSaving(false);
  };

  if (!editing && review.reply) {
    return (
      <div className="mt-3 pl-3 border-l-2 border-purple-500/40">
        <p className="text-[11px] font-semibold text-purple-300 mb-0.5">Your public reply</p>
        <p className="text-white/60 text-sm leading-relaxed whitespace-pre-line">{review.reply.text}</p>
        <div className="flex gap-3 mt-1.5">
          <button type="button" onClick={() => setEditing(true)} className="text-xs text-purple-300/80 hover:text-purple-200">Edit</button>
          <button
            type="button"
            disabled={saving}
            onClick={() => { if (confirm('Remove your reply?')) save(''); }}
            className="text-xs text-red-400/70 hover:text-red-300 disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      </div>
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="mt-2 inline-flex items-center gap-1.5 text-xs text-purple-300/80 hover:text-purple-200"
      >
        <Reply className="w-3.5 h-3.5" /> Reply publicly
      </button>
    );
  }

  return (
    <div className="mt-3 space-y-2">
      <textarea
        value={text}
        onChange={e => setText(e.target.value)}
        rows={3}
        maxLength={2000}
        autoFocus
        placeholder={`Reply to ${review.userName}… (shown on the tool page)`}
        className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/25 focus:outline-none focus:ring-1 focus:ring-purple-500 resize-y"
      />
      {error && <p className="text-red-400 text-xs">{error}</p>}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          disabled={saving || !text.trim()}
          onClick={() => save(text)}
          className="cursor-pointer bg-purple-600 hover:bg-purple-500 text-white"
        >
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Reply className="w-3.5 h-3.5 mr-1.5" />}
          {review.reply ? 'Update reply' : 'Post reply'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => { setEditing(false); setText(review.reply?.text ?? ''); setError(''); }}
          className="cursor-pointer bg-white/5 border-white/15 text-white/70 hover:bg-white/10"
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}

interface Tool {
  id: string;
  name: string;
}

export function AdminReviewsTab() {
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [tools, setTools] = useState<Tool[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [purging, setPurging] = useState(false);
  const [filterToolId, setFilterToolId] = useState('');

  const adminHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${publicAnonKey}`,
    'X-Admin-Token': localStorage.getItem('admin_token') || '',
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchReviews(), fetchTools()]);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchReviews = async () => {
    try {
      const res = await fetch(`${API_BASE}/admin/reviews`, { headers: adminHeaders });
      const data = await res.json();
      if (data.success) {
        setReviews((data.data as AdminReview[]).sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
        ));
      } else {
        console.error('[AdminReviewsTab] fetchReviews error:', data.error);
      }
    } catch (err) {
      console.error('[AdminReviewsTab] fetchReviews network error:', err);
    }
  };

  const fetchTools = async () => {
    try {
      const res = await fetch(`${API_BASE}/tools`, { headers: { Authorization: `Bearer ${publicAnonKey}` } });
      const data = await res.json();
      if (data.success) setTools(data.data || []);
    } catch (err) {
      console.error('[AdminReviewsTab] fetchTools error:', err);
    }
  };

  const deleteOne = async (review: AdminReview) => {
    const res = await fetch(`${API_BASE}/admin/reviews`, {
      method: 'DELETE',
      headers: adminHeaders,
      body: JSON.stringify({ toolId: review.toolId, userId: review.userId }),
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.error || 'Delete failed');
  };

  const handleDelete = async (review: AdminReview) => {
    if (!confirm(`Delete the review by "${review.userName}"? This cannot be undone.`)) return;
    setDeletingId(review.id);
    try {
      await deleteOne(review);
      setReviews(prev => prev.filter(r => r.id !== review.id));
    } catch (err) {
      alert(String(err));
    }
    setDeletingId(null);
  };

  const adminWritten = reviews.filter(r => r.isFake);

  const handlePurgeAdminWritten = async () => {
    if (!adminWritten.length) return;
    if (!confirm(`Delete all ${adminWritten.length} admin-written review(s)? Customer reviews are kept. This cannot be undone.`)) return;
    setPurging(true);
    const failed: string[] = [];
    for (const r of adminWritten) {
      try { await deleteOne(r); } catch { failed.push(r.userName); }
    }
    await fetchReviews();
    setPurging(false);
    if (failed.length) alert(`Could not delete ${failed.length} review(s). Try again.`);
  };

  const toolName = (id: string) => tools.find(t => t.id === id)?.name;
  const visible = filterToolId ? reviews.filter(r => r.toolId === filterToolId) : reviews;
  const customerCount = reviews.length - adminWritten.length;

  return (
    <div className="space-y-6">
      <GlassCard className="p-4 sm:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <MessageSquare className="w-6 h-6 text-purple-400" />
              Reviews
            </h2>
            <p className="text-white/40 text-sm mt-1">
              {customerCount} customer review{customerCount !== 1 ? 's' : ''}
              {filterToolId && ` · ${visible.length} shown`}
            </p>
          </div>
          <AdminSelect
            value={filterToolId}
            onChange={setFilterToolId}
            options={[
              { value: '', label: 'All tools' },
              ...tools.map(t => ({ value: t.id, label: t.name })),
            ]}
            placeholder="All tools"
            className="min-w-[11rem]"
          />
        </div>

        <p className="flex items-start gap-2 text-xs text-white/45 bg-white/4 border border-white/8 rounded-lg px-3 py-2 mb-5">
          <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
          Reviews can only be left by customers who own a license for the tool. You can remove spam or abusive reviews here.
        </p>

        {/* Per-tool tools to grow real reviews (needs a tool picked) */}
        {filterToolId ? (
          <GrowReviewsPanel toolId={filterToolId} toolName={toolName(filterToolId) || 'this tool'} />
        ) : (
          <p className="text-white/40 text-xs mb-5">
            Pick a tool in the filter above to ask its license holders for reviews, add testimonials and see its usage numbers.
          </p>
        )}

        {/* Legacy admin-written reviews — hidden from the site, offer cleanup */}
        {adminWritten.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5 p-4 rounded-xl border border-amber-500/30 bg-amber-500/8">
            <div className="flex items-start gap-2">
              <EyeOff className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-amber-200/80 text-sm">
                <strong className="text-amber-200">{adminWritten.length} review{adminWritten.length !== 1 ? 's were' : ' was'} written from the admin</strong>, not by customers.
                {' '}They're hidden from the public site.
              </p>
            </div>
            <Button
              onClick={handlePurgeAdminWritten}
              disabled={purging}
              className="cursor-pointer bg-amber-600 hover:bg-amber-500 text-white whitespace-nowrap"
            >
              {purging ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Deleting…</> : <><Trash2 className="w-4 h-4 mr-2" />Delete all {adminWritten.length}</>}
            </Button>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-white/40">Loading reviews…</div>
        ) : visible.length === 0 ? (
          <div className="text-center py-12">
            <MessageSquare className="w-10 h-10 text-white/10 mx-auto mb-3" />
            <p className="text-white/30 text-sm">
              {filterToolId ? 'No reviews for this tool yet.' : 'No reviews yet.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {visible.map(review => {
              const name = toolName(review.toolId);
              const dateStr = new Date(review.createdAt).toLocaleDateString('en-US', {
                year: 'numeric', month: 'short', day: 'numeric',
              });
              return (
                <div
                  key={review.id}
                  className={`flex gap-3 sm:gap-4 items-start p-4 rounded-xl border transition-colors ${
                    review.isFake ? 'bg-amber-500/4 border-amber-500/20' : 'bg-white/4 border-white/8 hover:border-white/15'
                  }`}
                >
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500/40 to-blue-500/40 flex items-center justify-center flex-shrink-0 border border-white/10 text-white/70 text-sm font-bold uppercase">
                    {review.userName.charAt(0)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-1">
                      <span className="text-white font-semibold text-sm">{review.userName}</span>
                      <span className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map(n => (
                          <Star key={n} className={`w-3 h-3 ${n <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-white/15'}`} />
                        ))}
                      </span>
                      {review.isFake ? (
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/25">
                          Admin-written · hidden
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/12 text-emerald-300 border border-emerald-500/20">
                          Verified customer
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {name && (
                        <span className="text-xs text-purple-300/70 bg-purple-500/10 border border-purple-500/15 px-2 py-0.5 rounded-full">
                          {name}
                        </span>
                      )}
                      <span className="text-white/25 text-xs">{dateStr}</span>
                    </div>

                    <p className="text-white/55 text-sm leading-relaxed line-clamp-3">{review.comment}</p>

                    {/* Replies only on customer reviews (admin-written ones are hidden) */}
                    {!review.isFake && (
                      <ReplyBox
                        key={review.reply?.updatedAt ?? 'none'}
                        review={review}
                        headers={adminHeaders}
                        onSaved={updated => setReviews(prev => prev.map(r => (r.id === updated.id ? updated : r)))}
                      />
                    )}
                  </div>

                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => handleDelete(review)}
                    disabled={deletingId === review.id}
                    title="Delete review"
                    className="cursor-pointer hover:bg-red-600/20 h-9 w-9 p-0 text-white flex-shrink-0"
                  >
                    {deletingId === review.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
