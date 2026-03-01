import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { Sparkles, X, RefreshCw, CheckCircle } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

export interface AIImproveContext {
  entityType: 'tool' | 'project';
  name?: string;        // tool name
  title?: string;       // project title
  category?: string;
  versionType?: string;
}

export interface AIImproveModalProps {
  fieldLabel: string;
  fieldKey: string;
  currentValue: string;
  context: AIImproveContext;
  onApply: (value: string) => void;
  onClose: () => void;
}

export function AIImproveModal({
  fieldLabel,
  fieldKey,
  currentValue,
  context,
  onApply,
  onClose,
}: AIImproveModalProps) {
  const [instruction, setInstruction] = useState('');
  const [suggestion, setSuggestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const callImprove = async (isAlternative: boolean) => {
    setLoading(true);
    setError('');
    setSuggestion('');
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/admin/improve-field`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Admin-Token': token || '',
        },
        body: JSON.stringify({
          fieldKey,
          currentValue,
          context,
          instruction: instruction.trim(),
          isAlternative,
        }),
      });
      const result = await res.json();
      if (!result.success) {
        setError(result.error || 'Generation failed. Please try again.');
      } else {
        setSuggestion(result.data.result);
      }
    } catch (err) {
      console.error('improve-field error:', err);
      setError('Could not reach the server. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const modal = (
    <div
      className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-950 border border-white/15 rounded-2xl w-full max-w-lg shadow-2xl shadow-purple-900/20"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-white font-semibold text-sm">Improve — {fieldLabel}</span>
          </div>
          <button
            onClick={onClose}
            className="text-white/40 hover:text-white transition-colors rounded-lg p-1 hover:bg-white/10"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Current value */}
          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-1.5">Current</p>
            <div className="px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white/60 whitespace-pre-wrap max-h-28 overflow-y-auto leading-relaxed">
              {currentValue?.trim()
                ? currentValue.trim()
                : <span className="italic text-white/25">Empty — AI will generate from scratch</span>
              }
            </div>
          </div>

          {/* Instruction */}
          <div>
            <p className="text-xs font-semibold text-white/40 uppercase tracking-wide mb-1.5">
              Instructions&nbsp;
              <span className="normal-case font-normal text-white/25">(optional)</span>
            </p>
            <input
              type="text"
              value={instruction}
              onChange={(e) => setInstruction(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !loading) callImprove(false); }}
              placeholder='e.g. "make it shorter" · "more technical" · "punchier tone"'
              className="w-full px-3 py-2 bg-black/50 border border-white/15 rounded-lg text-sm text-white placeholder:text-white/20 focus:outline-none focus:ring-1 focus:ring-purple-400/50 transition-all"
              disabled={loading}
              autoFocus
            />
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <button
              onClick={() => callImprove(false)}
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-fuchsia-500 text-white transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {loading ? 'Generating…' : '✨ Improve'}
            </button>
            <button
              onClick={() => callImprove(true)}
              disabled={loading}
              title="Generate a completely different version"
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/15 text-white/60 hover:text-white transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Alternative
            </button>
          </div>

          {/* Error */}
          {error && (
            <div className="px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Result */}
          {suggestion && !loading && (
            <>
              <div className="border-t border-white/10 pt-4">
                <p className="text-xs font-semibold text-purple-300/70 uppercase tracking-wide mb-1.5">Suggestion</p>
                <div className="px-3 py-2.5 bg-purple-950/40 border border-purple-500/20 rounded-lg text-sm text-white whitespace-pre-wrap max-h-52 overflow-y-auto leading-relaxed">
                  {suggestion}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => { onApply(suggestion); onClose(); }}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-400 hover:text-green-300 transition-all duration-200 active:scale-95"
                >
                  <CheckCircle className="w-4 h-4" />
                  Use this
                </button>
                <button
                  onClick={() => setSuggestion('')}
                  className="px-4 py-2.5 rounded-lg text-sm font-medium bg-white/5 hover:bg-white/10 border border-white/10 text-white/40 hover:text-white transition-all duration-200"
                >
                  Discard
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
}
