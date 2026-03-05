import { useState, useEffect } from 'react';
import { Plus, Trash2, X, Save, ChevronDown, ChevronUp, Tag, Calendar, AlertTriangle, Zap, Wrench, Sparkles } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

export type ChangeType = 'new' | 'fix' | 'improved' | 'breaking';
export type ReleaseType = 'major' | 'minor' | 'patch';

export interface ChangeEntry {
  type: ChangeType;
  description: string;
}

export interface ChangelogEntry {
  version: string;
  releaseDate: string;
  type: ReleaseType;
  title: string;
  changes: ChangeEntry[];
}

const CHANGE_TYPE_CONFIG: Record<ChangeType, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  new:      { label: 'New',      color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', icon: <Sparkles className="w-3 h-3" /> },
  fix:      { label: 'Fix',      color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/30',    icon: <Wrench className="w-3 h-3" /> },
  improved: { label: 'Improved', color: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/30',  icon: <Zap className="w-3 h-3" /> },
  breaking: { label: 'Breaking', color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/30',     icon: <AlertTriangle className="w-3 h-3" /> },
};

const RELEASE_TYPE_CONFIG: Record<ReleaseType, { label: string; color: string; bg: string; border: string }> = {
  major: { label: 'Major', color: 'text-red-300',    bg: 'bg-red-500/10',    border: 'border-red-500/30' },
  minor: { label: 'Minor', color: 'text-amber-300',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30' },
  patch: { label: 'Patch', color: 'text-blue-300',   bg: 'bg-blue-500/10',   border: 'border-blue-500/30' },
};

const EMPTY_ENTRY: ChangelogEntry = {
  version: '',
  releaseDate: new Date().toISOString().split('T')[0],
  type: 'minor',
  title: '',
  changes: [{ type: 'new', description: '' }],
};

interface Props {
  toolSlug: string;
  toolId: string;
}

export function ChangelogTab({ toolSlug, toolId }: Props) {
  const [changelog, setChangelog] = useState<ChangelogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingVersion, setEditingVersion] = useState<string | null>(null); // null = new
  const [form, setForm] = useState<ChangelogEntry>({ ...EMPTY_ENTRY });

  // Collapse state for entries
  const [collapsedVersions, setCollapsedVersions] = useState<Set<string>>(new Set());

  const token = localStorage.getItem('admin_token');
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${publicAnonKey}`,
    'X-Admin-Token': token || '',
  };

  useEffect(() => {
    if (toolSlug) fetchChangelog();
  }, [toolSlug]);

  const fetchChangelog = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/tools/${encodeURIComponent(toolSlug)}/changelog`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      const data = await res.json();
      if (data.success) {
        setChangelog(data.data || []);
        // Collapse all except the first by default
        if (data.data?.length > 1) {
          setCollapsedVersions(new Set(data.data.slice(1).map((e: ChangelogEntry) => e.version)));
        }
      }
    } catch (e) {
      console.error('[ChangelogTab] fetch error:', e);
    } finally {
      setLoading(false);
    }
  };

  const openNew = () => {
    setForm({ ...EMPTY_ENTRY, releaseDate: new Date().toISOString().split('T')[0] });
    setEditingVersion(null);
    setFormOpen(true);
    setMsg(null);
  };

  const openEdit = (entry: ChangelogEntry) => {
    setForm({ ...entry, changes: entry.changes.map(c => ({ ...c })) });
    setEditingVersion(entry.version);
    setFormOpen(true);
    setMsg(null);
  };

  const closeForm = () => {
    setFormOpen(false);
    setEditingVersion(null);
  };

  const addChange = () => setForm(f => ({ ...f, changes: [...f.changes, { type: 'new', description: '' }] }));
  const removeChange = (i: number) => setForm(f => ({ ...f, changes: f.changes.filter((_, idx) => idx !== i) }));
  const updateChange = (i: number, field: keyof ChangeEntry, value: string) =>
    setForm(f => ({ ...f, changes: f.changes.map((c, idx) => idx === i ? { ...c, [field]: value } : c) }));

  const saveEntry = async () => {
    if (!form.version.trim()) { setMsg({ type: 'err', text: 'Version is required (e.g. 1.2.0)' }); return; }
    if (!form.releaseDate)     { setMsg({ type: 'err', text: 'Release date is required' }); return; }
    // Validate semver-ish
    if (!/^\d+\.\d+\.\d+$/.test(form.version.trim())) {
      setMsg({ type: 'err', text: 'Version must follow semver format: MAJOR.MINOR.PATCH (e.g. 2.1.0)' });
      return;
    }
    const validChanges = form.changes.filter(c => c.description.trim());
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`${API_BASE}/tools/${encodeURIComponent(toolSlug)}/changelog`, {
        method: 'POST',
        headers: authHeaders,
        body: JSON.stringify({ ...form, changes: validChanges }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: 'ok', text: editingVersion ? 'Release updated!' : 'Release added!' });
        await fetchChangelog();
        setTimeout(() => closeForm(), 800);
      } else {
        setMsg({ type: 'err', text: data.error || 'Failed to save release' });
      }
    } catch (e) {
      setMsg({ type: 'err', text: `Error: ${e}` });
    } finally {
      setSaving(false);
    }
  };

  const deleteEntry = async (version: string) => {
    if (!confirm(`Delete release v${version}? This cannot be undone.`)) return;
    setDeleting(version);
    try {
      const encodedVersion = encodeURIComponent(version);
      const res = await fetch(`${API_BASE}/tools/${encodeURIComponent(toolSlug)}/changelog/${encodedVersion}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      const data = await res.json();
      if (data.success) await fetchChangelog();
    } catch (e) {
      console.error('[ChangelogTab] delete error:', e);
    } finally {
      setDeleting(null);
    }
  };

  const toggleCollapse = (version: string) => {
    setCollapsedVersions(prev => {
      const next = new Set(prev);
      if (next.has(version)) next.delete(version); else next.add(version);
      return next;
    });
  };

  if (!toolId) {
    return (
      <div className="text-xs text-amber-400/70 flex items-center gap-1.5 py-3">
        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
        Save the tool first to manage its changelog.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-white/40 mt-0.5">
            Track releases — visible on the tool detail page and queryable via{' '}
            <code className="text-purple-300/70 bg-purple-500/10 px-1 py-0.5 rounded text-[11px]">
              GET /tools/{toolSlug}/latest-version
            </code>
            {' '}for in-tool update checks.
          </p>
        </div>
        <Button
          type="button"
          onClick={openNew}
          size="sm"
          className="cursor-pointer bg-violet-600 hover:bg-violet-500 text-white shrink-0 ml-4"
        >
          <Plus className="w-3.5 h-3.5 mr-1" />
          Add Release
        </Button>
      </div>

      {/* Inline Form */}
      {formOpen && (
        <div className="rounded-2xl border border-purple-500/20 bg-[#12101e]/80 overflow-hidden">
          {/* Form header */}
          <div className="flex items-center justify-between px-5 py-3 border-b border-white/8 bg-purple-500/5">
            <span className="text-sm font-semibold text-white">
              {editingVersion ? `Editing v${editingVersion}` : 'New Release'}
            </span>
            <button type="button" onClick={closeForm} className="p-1 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/8 transition-all">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-5 space-y-4">
            {/* Row 1: version + date + type */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Version *</label>
                <Input
                  placeholder="e.g. 2.1.0"
                  value={form.version}
                  onChange={e => setForm(f => ({ ...f, version: e.target.value }))}
                  disabled={!!editingVersion} // can't rename an existing version
                  className="bg-black/40 border-white/15 text-white text-sm"
                />
                {editingVersion && <p className="text-[10px] text-white/25 mt-1">Delete and re-add to change the version number.</p>}
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="w-3 h-3" /> Release Date *
                </label>
                <Input
                  type="date"
                  value={form.releaseDate}
                  onChange={e => setForm(f => ({ ...f, releaseDate: e.target.value }))}
                  className="bg-black/40 border-white/15 text-white text-sm"
                />
              </div>
              <div>
                <label className="block text-xs text-white/40 mb-1.5 flex items-center gap-1.5">
                  <Tag className="w-3 h-3" /> Release Type *
                </label>
                <select
                  value={form.type}
                  onChange={e => setForm(f => ({ ...f, type: e.target.value as ReleaseType }))}
                  className="w-full px-3 py-2 bg-black/40 border border-white/15 rounded-lg text-white text-sm focus:outline-none focus:border-purple-400/40 transition-colors"
                >
                  <option value="major">Major — breaking changes</option>
                  <option value="minor">Minor — new features</option>
                  <option value="patch">Patch — bug fixes</option>
                </select>
              </div>
            </div>

            {/* Title (optional) */}
            <div>
              <label className="block text-xs text-white/40 mb-1.5">Title <span className="text-white/20">(optional)</span></label>
              <Input
                placeholder="e.g. Performance & stability update"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="bg-black/40 border-white/15 text-white text-sm"
              />
            </div>

            {/* Changes list */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs text-white/40">Changes</label>
                <button
                  type="button"
                  onClick={addChange}
                  className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add change
                </button>
              </div>
              <div className="space-y-2">
                {form.changes.map((change, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={change.type}
                      onChange={e => updateChange(i, 'type', e.target.value)}
                      className="w-28 shrink-0 px-2 py-1.5 bg-black/40 border border-white/12 rounded-lg text-xs text-white focus:outline-none focus:border-purple-400/40 transition-colors"
                    >
                      <option value="new">🆕 New</option>
                      <option value="fix">🔧 Fix</option>
                      <option value="improved">⚡ Improved</option>
                      <option value="breaking">⚠️ Breaking</option>
                    </select>
                    <input
                      type="text"
                      placeholder="Describe the change…"
                      value={change.description}
                      onChange={e => updateChange(i, 'description', e.target.value)}
                      className="flex-1 px-3 py-1.5 bg-black/40 border border-white/12 rounded-lg text-white text-xs
                        placeholder:text-white/20 focus:outline-none focus:border-purple-400/40 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={() => removeChange(i)}
                      className="w-7 h-7 flex items-center justify-center text-white/25 hover:text-red-400 transition-colors rounded-lg shrink-0"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Message + Save */}
            {msg && (
              <p className={`text-xs ${msg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>{msg.text}</p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <Button type="button" variant="outline" size="sm" onClick={closeForm}
                className="border-white/15 text-white/60 hover:bg-white/8">
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={saveEntry} disabled={saving}
                className="bg-violet-600 hover:bg-violet-500 text-white">
                {saving ? (
                  <><svg className="w-3.5 h-3.5 mr-1.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>Saving…</>
                ) : (
                  <><Save className="w-3.5 h-3.5 mr-1.5" />{editingVersion ? 'Update Release' : 'Add Release'}</>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Changelog list */}
      {loading ? (
        <div className="text-xs text-white/30 animate-pulse py-4">Loading changelog…</div>
      ) : changelog.length === 0 ? (
        <div className="text-center py-10 rounded-2xl border border-white/6 bg-white/2">
          <div className="w-10 h-10 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mx-auto mb-3">
            <Tag className="w-5 h-5 text-purple-400" />
          </div>
          <p className="text-white/40 text-sm">No releases yet</p>
          <p className="text-white/20 text-xs mt-1">Add your first release with the button above.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {changelog.map((entry, idx) => {
            const isCollapsed = collapsedVersions.has(entry.version);
            const relType = RELEASE_TYPE_CONFIG[entry.type] ?? RELEASE_TYPE_CONFIG.patch;
            const isFirst = idx === 0;
            return (
              <div
                key={entry.version}
                className={`rounded-xl border overflow-hidden transition-all
                  ${isFirst ? 'border-purple-500/25 bg-purple-500/5' : 'border-white/8 bg-white/2'}`}
              >
                {/* Entry header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Version badge */}
                  <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-bold font-mono shrink-0
                    ${isFirst ? 'bg-purple-500/15 border-purple-400/30 text-purple-300' : 'bg-white/5 border-white/12 text-white/60'}`}>
                    v{entry.version}
                    {isFirst && <span className="text-[9px] font-bold uppercase tracking-widest text-purple-400/70 ml-1">latest</span>}
                  </div>

                  {/* Release type */}
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border ${relType.bg} ${relType.border} ${relType.color}`}>
                    {relType.label}
                  </span>

                  {/* Title + date */}
                  <div className="flex-1 min-w-0">
                    {entry.title && <span className="text-white/70 text-xs font-medium truncate block">{entry.title}</span>}
                    <span className="text-white/30 text-[11px]">
                      {new Date(entry.releaseDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })}
                      {' · '}{entry.changes.length} change{entry.changes.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => openEdit(entry)}
                      className="px-2.5 py-1 rounded-lg text-xs text-white/40 hover:text-white/80 hover:bg-white/8 transition-all"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteEntry(entry.version)}
                      disabled={deleting === entry.version}
                      className="w-7 h-7 flex items-center justify-center text-white/20 hover:text-red-400 transition-colors rounded-lg"
                    >
                      {deleting === entry.version ? (
                        <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                        </svg>
                      ) : (
                        <Trash2 className="w-3.5 h-3.5" />
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleCollapse(entry.version)}
                      className="w-7 h-7 flex items-center justify-center text-white/25 hover:text-white/60 transition-colors rounded-lg"
                    >
                      {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Changes (collapsible) */}
                {!isCollapsed && entry.changes.length > 0 && (
                  <div className="px-4 pb-3 border-t border-white/6 pt-2.5 space-y-1.5">
                    {entry.changes.map((change, ci) => {
                      const cfg = CHANGE_TYPE_CONFIG[change.type] ?? CHANGE_TYPE_CONFIG.new;
                      return (
                        <div key={ci} className="flex items-start gap-2">
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 mt-px border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                            {cfg.icon}
                            {cfg.label}
                          </span>
                          <span className="text-white/55 text-xs leading-relaxed">{change.description}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
