import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Star, X, Trash2, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

export interface ReviewData {
  id: string;
  toolId: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
}

interface ReviewModalProps {
  toolId: string;
  toolName: string;
  toolImageUrl?: string;
  accessToken: string;
  existingReview: ReviewData | null;
  onClose: () => void;
  onSaved: (review: ReviewData) => void;
  onDeleted: () => void;
}

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (v: number) => void;
}) {
  const [hover, setHover] = useState(0);
  const labels = ['', 'Terrible', 'Poor', 'Okay', 'Good', 'Excellent'];
  const active = hover || value;

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            className="p-1 transition-transform hover:scale-110 focus:outline-none"
          >
            <Star
              className={`w-8 h-8 transition-colors ${
                n <= active
                  ? 'text-yellow-400 fill-yellow-400'
                  : 'text-white/20'
              }`}
            />
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        {active > 0 && (
          <motion.span
            key={active}
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-xs font-semibold text-yellow-400/80"
          >
            {labels[active]}
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

export function ReviewModal({
  toolId,
  toolName,
  toolImageUrl,
  accessToken,
  existingReview,
  onClose,
  onSaved,
  onDeleted,
}: ReviewModalProps) {
  const [rating, setRating] = useState(existingReview?.rating ?? 0);
  const [comment, setComment] = useState(existingReview?.comment ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rating) { setError('Please select a star rating.'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/reviews`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
          'X-User-Token': accessToken,
        },
        body: JSON.stringify({ toolId, rating, comment }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to save review');
      setSuccess(true);
      setTimeout(() => { onSaved(data.data); onClose(); }, 1100);
    } catch (err: any) {
      console.error('[ReviewModal] submit error:', err);
      setError(err.message || 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/reviews/${toolId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'X-User-Token': accessToken,
        },
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to delete review');
      onDeleted();
      onClose();
    } catch (err: any) {
      console.error('[ReviewModal] delete error:', err);
      setError(err.message || 'Could not delete review.');
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 16 }}
          transition={{ duration: 0.2 }}
          className="w-full max-w-md"
        >
          <GlassCard className="overflow-hidden">
            {/* Top gradient bar */}
            <div className="h-0.5 w-full bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-500" />

            <div className="p-6">
              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-6">
                <div className="flex items-center gap-3">
                  {toolImageUrl && (
                    <div className="w-11 h-11 rounded-xl overflow-hidden flex-shrink-0 border border-white/10 bg-white/5">
                      <img src={toolImageUrl} alt={toolName} className="w-full h-full object-cover" />
                    </div>
                  )}
                  <div>
                    <h2 className="text-white font-bold text-base leading-tight">
                      {existingReview ? 'Edit your review' : 'Write a review'}
                    </h2>
                    <p className="text-white/40 text-xs mt-0.5">{toolName}</p>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="text-white/30 hover:text-white/70 transition-colors flex-shrink-0 -mt-1"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Success state */}
              {success ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-3 py-6 text-center"
                >
                  <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
                    <CheckCircle className="w-7 h-7 text-emerald-400" />
                  </div>
                  <p className="text-white font-semibold">Review saved!</p>
                  <p className="text-white/40 text-sm">Thank you for your feedback.</p>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-5">
                  {/* Star picker */}
                  <div>
                    <p className="text-white/50 text-xs font-semibold mb-3 uppercase tracking-widest">Your rating</p>
                    <StarPicker value={rating} onChange={setRating} />
                  </div>

                  {/* Comment */}
                  <div>
                    <p className="text-white/50 text-xs font-semibold mb-2 uppercase tracking-widest">
                      Your review <span className="text-white/25 normal-case font-normal">(optional)</span>
                    </p>
                    <textarea
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      placeholder="Share your experience with this tool…"
                      rows={4}
                      maxLength={600}
                      className="w-full rounded-xl border border-white/10 bg-white/5 focus-within:border-purple-500/50
                        text-white text-sm placeholder:text-white/25 px-4 py-3 resize-none focus:outline-none
                        focus:border-purple-500/50 transition-colors"
                    />
                    <p className="text-white/20 text-xs text-right mt-1">{comment.length}/600</p>
                  </div>

                  {/* Error */}
                  {error && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-red-500/10 border border-red-500/20">
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                      <p className="text-red-400 text-xs">{error}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3 pt-1">
                    {/* Delete (only if existing review) */}
                    {existingReview && !confirmDelete && (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(true)}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold
                          bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Delete
                      </button>
                    )}

                    {/* Confirm delete */}
                    {confirmDelete && (
                      <button
                        type="button"
                        onClick={handleDelete}
                        disabled={deleting}
                        className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold
                          bg-red-500/25 hover:bg-red-500/35 text-red-300 border border-red-500/40 transition-all disabled:opacity-60"
                      >
                        {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        {deleting ? 'Deleting…' : 'Confirm delete'}
                      </button>
                    )}

                    {confirmDelete && (
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(false)}
                        className="px-4 py-2.5 rounded-xl text-sm font-semibold bg-white/5 hover:bg-white/10
                          text-white/50 border border-white/10 transition-all"
                      >
                        Cancel
                      </button>
                    )}

                    {/* Submit */}
                    {!confirmDelete && (
                      <button
                        type="submit"
                        disabled={loading || !rating}
                        className="ml-auto inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
                          bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500
                          text-white shadow-lg shadow-purple-500/20 transition-all disabled:opacity-50"
                      >
                        {loading
                          ? <><Loader2 className="w-4 h-4 animate-spin" />Saving…</>
                          : existingReview ? 'Update review' : 'Submit review'
                        }
                      </button>
                    )}
                  </div>
                </form>
              )}
            </div>
          </GlassCard>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
