import { useState, useEffect, useRef } from 'react';
import { GlassCard } from '../shared/GlassCard';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { AdminSelect } from './AdminSelect';
import {
  Save, Sparkles, ChevronDown, ChevronRight, Globe, Share2,
  Twitter, Search, Link2, EyeOff, CheckCircle2, AlertCircle,
  RotateCcw, Loader2, X, Code2, Wand2, Zap, Upload, ImageIcon,
} from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { invalidateSeoCache, invalidateSiteSettingsCache } from '../shared/SeoHead';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

// ─── Types ────────────────────────────────────────────────────────────────────
interface SeoData {
  title: string;
  description: string;
  keywords: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterCard: string;
  twitterTitle: string;
  twitterDescription: string;
  canonicalUrl: string;
  noIndex: boolean;
  structuredData: string;
  updatedAt?: string;
}

interface PageEntry {
  key: string;
  label: string;
  path: string;
  type: 'static' | 'tool' | 'project';
  context?: string;
}

const STATIC_PAGES: PageEntry[] = [
  { key: 'home',         label: 'Home',         path: '/home',         type: 'static', context: 'Landing page showcasing Fastoosh premium motion design studio, services, and latest work.' },
  { key: 'projects',     label: 'Projects',     path: '/projects',     type: 'static', context: 'Portfolio page listing all motion design projects, films, branding, and VFX work.' },
  { key: 'tools',        label: 'Tools',        path: '/tools',        type: 'static', context: 'Marketplace listing all After Effects plugins, scripts, and automation tools.' },
  { key: 'about',        label: 'About',        path: '/about',        type: 'static', context: 'About page describing the Fastoosh team, story, values, and mission.' },
  { key: 'work-with-us', label: 'Work With Us', path: '/work-with-us', type: 'static', context: 'Contact/hire page for brands and studios looking to collaborate with Fastoosh.' },
];

const EMPTY_SEO: SeoData = {
  title: '', description: '', keywords: '',
  ogTitle: '', ogDescription: '', ogImage: '',
  twitterCard: 'summary_large_image', twitterTitle: '', twitterDescription: '',
  canonicalUrl: '', noIndex: false, structuredData: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
function charCount(val: string, limit: number) {
  const n = val.length;
  const over = n > limit;
  return (
    <span className={`text-xs ${over ? 'text-red-400' : n > limit * 0.9 ? 'text-yellow-400' : 'text-white/30'}`}>
      {n}/{limit}
    </span>
  );
}

function isValidJson(str: string): boolean {
  if (!str.trim()) return true; // empty = valid (not set)
  try { JSON.parse(str); return true; } catch { return false; }
}

// ─── Main Component ───────────────────────────────────────────────────────────
export function SeoTab() {
  const [tools, setTools]       = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [siteUrl, setSiteUrl]   = useState('');
  const [defaultOgImage, setDefaultOgImage] = useState('');
  const [selectedKey, setSelectedKey]       = useState<string | null>(null);
  const [seo, setSeo]           = useState<SeoData>(EMPTY_SEO);
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [generating, setGenerating]         = useState(false);
  const [generatingJsonLd, setGeneratingJsonLd] = useState(false);
  const [formMessage, setFormMessage]       = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [aiInstruction, setAiInstruction]   = useState('');
  const [improveExisting, setImproveExisting] = useState(false);
  const [showAiOptions, setShowAiOptions]   = useState(false);
  const [highlightedFields, setHighlightedFields] = useState<Set<string>>(new Set());
  const [openSection, setOpenSection]       = useState<'basic' | 'og' | 'twitter' | 'jsonld'>('basic');
  const [jsonLdError, setJsonLdError]       = useState('');
  const [globalSaving, setGlobalSaving]     = useState(false);
  const [globalMsg, setGlobalMsg]           = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [ogImageUploading, setOgImageUploading] = useState(false);
  const ogImageInputRef = useRef<HTMLInputElement>(null);

  // Load tools, projects, and site settings on mount
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    const headers = { Authorization: `Bearer ${publicAnonKey}`, 'X-Admin-Token': token || '' };
    Promise.all([
      fetch(`${API_BASE}/tools`,    { headers: { Authorization: `Bearer ${publicAnonKey}` } }).then(r => r.json()),
      fetch(`${API_BASE}/projects`, { headers: { Authorization: `Bearer ${publicAnonKey}` } }).then(r => r.json()),
      fetch(`${API_BASE}/settings`, { headers }).then(r => r.json()),
    ]).then(([td, pd, sd]) => {
      setTools(td.data || []);
      setProjects(pd.data || []);
      const s = sd.data || {};
      setSiteUrl(s.siteUrl || '');
      setDefaultOgImage(s.defaultOgImage || '');
    }).catch(console.error);
  }, []);

  // Load SEO data when a page is selected
  useEffect(() => {
    if (!selectedKey) return;
    setLoading(true);
    setFormMessage(null);
    setJsonLdError('');
    const token = localStorage.getItem('admin_token');
    fetch(`${API_BASE}/seo/${encodeURIComponent(selectedKey)}`, {
      headers: { Authorization: `Bearer ${publicAnonKey}`, 'X-Admin-Token': token || '' },
    })
      .then(r => r.json())
      .then(data => setSeo(data.data ? { ...EMPTY_SEO, ...data.data } : { ...EMPTY_SEO }))
      .catch(() => setSeo({ ...EMPTY_SEO }))
      .finally(() => setLoading(false));
  }, [selectedKey]);

  const allPages: PageEntry[] = [
    ...STATIC_PAGES,
    ...tools.map(t => ({
      key: `tool--${t.slug || t.id}`,
      label: t.name,
      path: `/tools/${t.slug || t.id}`,
      type: 'tool' as const,
      context: t.description ? `After Effects tool: "${t.name}". ${t.description}` : `After Effects tool: "${t.name}".`,
    })),
    ...projects.map(p => ({
      key: `project--${p.slug || p.id}`,
      label: p.title,
      path: `/projects/${p.slug || p.id}`,
      type: 'project' as const,
      context: p.description
        ? `Motion design project: "${p.title}". Category: ${p.category}. ${p.description}`
        : `Motion design project: "${p.title}". Category: ${p.category}.`,
    })),
  ];

  const selectedPage = allPages.find(p => p.key === selectedKey);

  // ── Auto-canonical from siteUrl ─────────────────────────────────────────
  const autoCanonical = selectedPage && siteUrl
    ? `${siteUrl.replace(/\/$/, '')}${selectedPage.path}`
    : '';

  // ── Highlights ──────────────────────────────────────────────────────────
  const applyHighlight = (fields: string[]) => {
    setHighlightedFields(new Set(fields));
    setTimeout(() => setHighlightedFields(new Set()), 3500);
  };
  const hlClass = (key: string) =>
    highlightedFields.has(key)
      ? 'ring-2 ring-purple-400/70 shadow-[0_0_14px_rgba(192,132,252,0.45)] transition-all duration-300'
      : '';

  // ── Save ────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (!selectedKey) return;
    if (seo.structuredData && !isValidJson(seo.structuredData)) {
      setFormMessage({ type: 'error', text: 'JSON-LD contains invalid JSON. Fix it before saving.' });
      return;
    }
    setSaving(true);
    setFormMessage(null);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/seo/${encodeURIComponent(selectedKey)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
          'X-Admin-Token': token || '',
        },
        body: JSON.stringify(seo),
      });
      const data = await res.json();
      if (data.success) {
        invalidateSeoCache(selectedKey);
        setFormMessage({ type: 'success', text: '✅ SEO saved successfully!' });
      } else {
        setFormMessage({ type: 'error', text: data.error || 'Failed to save.' });
      }
    } catch (e) {
      setFormMessage({ type: 'error', text: `Error: ${e}` });
    }
    setSaving(false);
  };

  // ── AI: Meta generation ─────────────────────────────────────────────────
  const handleGenerate = async () => {
    if (!selectedKey || !selectedPage) return;
    setGenerating(true);
    setFormMessage(null);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/admin/generate-seo-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}`, 'X-Admin-Token': token || '' },
        body: JSON.stringify({
          pageName:       selectedPage.label,
          pageType:       selectedPage.type,
          pageContext:    selectedPage.context || '',
          existingSeo:    seo,
          instruction:    aiInstruction,
          improveExisting,
        }),
      });
      const data = await res.json();
      if (!data.success) { setFormMessage({ type: 'error', text: data.error || 'Generation failed.' }); return; }
      if (data.nothingToGenerate) { setFormMessage({ type: 'success', text: '✨ All fields already filled.' }); return; }
      const changed: string[] = [];
      setSeo(prev => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(data.data)) {
          if (v !== undefined && v !== '') { (next as any)[k] = v; changed.push(k); }
        }
        return next;
      });
      applyHighlight(changed);
      setFormMessage({ type: 'success', text: `✨ Generated ${changed.length} field(s). Review and save.` });
      setShowAiOptions(false);
    } catch (e) {
      setFormMessage({ type: 'error', text: `Error: ${e}` });
    }
    setGenerating(false);
  };

  // ── AI: JSON-LD generation ──────────────────────────────────────────────
  const handleGenerateJsonLd = async () => {
    if (!selectedKey || !selectedPage) return;
    setGeneratingJsonLd(true);
    setFormMessage(null);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/admin/generate-seo-jsonld`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}`, 'X-Admin-Token': token || '' },
        body: JSON.stringify({
          pageName:       selectedPage.label,
          pageType:       selectedPage.type,
          pageContext:    selectedPage.context || '',
          siteUrl,
          existingJsonLd: seo.structuredData,
          instruction:    aiInstruction,
          improveExisting,
        }),
      });
      const data = await res.json();
      if (!data.success) { setFormMessage({ type: 'error', text: data.error || 'JSON-LD generation failed.' }); return; }
      if (data.nothingToGenerate) { setFormMessage({ type: 'success', text: '✨ JSON-LD already present.' }); return; }
      const newJsonLd = data.data?.structuredData || '';
      setSeo(prev => ({ ...prev, structuredData: newJsonLd }));
      setJsonLdError('');
      applyHighlight(['structuredData']);
      setFormMessage({ type: 'success', text: '✨ JSON-LD generated. Review and save.' });
      setOpenSection('jsonld');
    } catch (e) {
      setFormMessage({ type: 'error', text: `Error: ${e}` });
    }
    setGeneratingJsonLd(false);
  };

  // ── Reset ───────────────────────────────────────────────────────────────
  const handleReset = () => { setSeo({ ...EMPTY_SEO }); setFormMessage(null); setJsonLdError(''); };

  // ── Global settings: save siteUrl + defaultOgImage ──────────────────────
  const handleSaveGlobalSettings = async () => {
    setGlobalSaving(true);
    setGlobalMsg(null);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
          'X-Admin-Token': token || '',
        },
        body: JSON.stringify({ siteUrl, defaultOgImage }),
      });
      const data = await res.json();
      if (data.success) {
        invalidateSiteSettingsCache?.();
        setGlobalMsg({ type: 'success', text: 'Global settings saved.' });
      } else {
        setGlobalMsg({ type: 'error', text: data.error || 'Failed to save.' });
      }
    } catch (e) {
      setGlobalMsg({ type: 'error', text: `Error: ${e}` });
    }
    setGlobalSaving(false);
  };

  // ── Upload OG image to Supabase storage ──────────────────────────────────
  const handleUploadOgImage = async (file: File) => {
    setOgImageUploading(true);
    setGlobalMsg(null);
    try {
      const token = localStorage.getItem('admin_token');
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/upload-image`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'X-Admin-Token': token || '',
        },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setDefaultOgImage(data.data.url);
        setGlobalMsg({ type: 'success', text: 'Image uploaded — click Save to apply.' });
      } else {
        setGlobalMsg({ type: 'error', text: data.error || 'Upload failed.' });
      }
    } catch (e) {
      setGlobalMsg({ type: 'error', text: `Upload error: ${e}` });
    }
    setOgImageUploading(false);
  };

  // ── Section header ──────────────────────────────────────────────────────
  const SectionHeader = ({ id, label, icon: Icon, badge }: { id: typeof openSection; label: string; icon: any; badge?: string }) => (
    <button
      onClick={() => setOpenSection(openSection === id ? 'basic' : id)}
      className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors rounded-xl"
    >
      <div className="flex items-center gap-2">
        <Icon className="w-4 h-4 text-purple-400" />
        <span className="text-white font-semibold text-sm">{label}</span>
        {badge && (
          <span className="px-1.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 text-[10px] font-bold">{badge}</span>
        )}
      </div>
      {openSection === id
        ? <ChevronDown className="w-4 h-4 text-white/40" />
        : <ChevronRight className="w-4 h-4 text-white/40" />}
    </button>
  );

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex gap-6 min-h-0">

      {/* ── Left: Page list ──────────────────────────────────────────────── */}
      <div className="w-72 flex-shrink-0 space-y-3">
        {/* Site globals panel */}
        <div className="p-3 rounded-xl bg-purple-500/8 border border-purple-500/20 space-y-3">
          <p className="text-[11px] text-purple-400 font-semibold uppercase tracking-wider">Global Settings</p>

          {/* Site URL */}
          <div>
            <label className="text-white/40 text-[11px] font-medium block mb-1">Site URL</label>
            <Input
              value={siteUrl}
              onChange={e => setSiteUrl(e.target.value)}
              placeholder="https://fastoosh.com"
              className="bg-white/5 border-white/10 text-white placeholder-white/20 text-xs h-7 px-2"
            />
          </div>

          {/* Default OG Image */}
          <div>
            <label className="text-white/40 text-[11px] font-medium block mb-1">Default OG Image</label>

            {/* Preview */}
            {defaultOgImage ? (
              <div className="relative mb-2 group">
                <img
                  src={defaultOgImage}
                  alt="OG image"
                  className="w-full rounded-lg object-cover border border-white/10"
                  style={{ maxHeight: '80px' }}
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
                <button
                  onClick={() => setDefaultOgImage('')}
                  className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white/50 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center justify-center w-full h-14 rounded-lg border border-dashed border-white/15 mb-2">
                <ImageIcon className="w-5 h-5 text-white/20" />
              </div>
            )}

            {/* Upload button */}
            <input
              ref={ogImageInputRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleUploadOgImage(f); e.target.value = ''; }}
            />
            <button
              onClick={() => ogImageInputRef.current?.click()}
              disabled={ogImageUploading}
              className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/50 hover:text-white text-[11px] transition-all disabled:opacity-50"
            >
              {ogImageUploading
                ? <><Loader2 className="w-3 h-3 animate-spin" />Uploading…</>
                : <><Upload className="w-3 h-3" />{defaultOgImage ? 'Replace image' : 'Upload OG image'}</>
              }
            </button>
            <p className="text-white/20 text-[10px] mt-1">1200×630 px recommended</p>
          </div>

          {/* Global msg */}
          {globalMsg && (
            <div className={`flex items-center gap-1.5 p-2 rounded-lg text-[11px] ${
              globalMsg.type === 'success'
                ? 'bg-green-500/10 border border-green-500/20 text-green-300'
                : 'bg-red-500/10 border border-red-500/20 text-red-300'
            }`}>
              <span className="flex-1">{globalMsg.text}</span>
              <button onClick={() => setGlobalMsg(null)}><X className="w-3 h-3" /></button>
            </div>
          )}

          {/* Save global */}
          <button
            onClick={handleSaveGlobalSettings}
            disabled={globalSaving}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-purple-600/70 hover:bg-purple-600 text-white text-[11px] font-semibold transition-all disabled:opacity-50"
          >
            {globalSaving
              ? <><Loader2 className="w-3 h-3 animate-spin" />Saving…</>
              : <><Save className="w-3 h-3" />Save global settings</>
            }
          </button>
        </div>

        {/* Static pages */}
        <div>
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2 px-1">Static Pages</p>
          <div className="space-y-1">
            {STATIC_PAGES.map(p => (
              <PageListItem key={p.key} page={p} selected={selectedKey === p.key} onClick={() => setSelectedKey(p.key)} />
            ))}
          </div>
        </div>

        {/* Tool pages */}
        {tools.length > 0 && (
          <div>
            <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2 px-1">Tool Pages</p>
            <div className="space-y-1">
              {tools.map(t => {
                const key = `tool--${t.slug || t.id}`;
                return (
                  <PageListItem
                    key={key}
                    page={{ key, label: t.name, path: `/tools/${t.slug}`, type: 'tool' }}
                    selected={selectedKey === key}
                    onClick={() => setSelectedKey(key)}
                  />
                );
              })}
            </div>
          </div>
        )}

        {/* Project pages */}
        {projects.length > 0 && (
          <div>
            <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2 px-1">Project Pages</p>
            <div className="space-y-1">
              {projects.map(p => {
                const key = `project--${p.slug || p.id}`;
                return (
                  <PageListItem
                    key={key}
                    page={{ key, label: p.title, path: `/projects/${p.slug || p.id}`, type: 'project' }}
                    selected={selectedKey === key}
                    onClick={() => setSelectedKey(key)}
                  />
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Right: SEO Form ─────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0">
        {!selectedKey ? (
          <GlassCard className="p-10 flex flex-col items-center justify-center text-center h-64">
            <Search className="w-10 h-10 text-white/15 mb-4" />
            <p className="text-white/40 font-semibold">Select a page</p>
            <p className="text-white/20 text-sm mt-1">Choose a page from the left to manage its SEO metadata.</p>
          </GlassCard>
        ) : loading ? (
          <GlassCard className="p-10 flex flex-col items-center justify-center h-64">
            <Loader2 className="w-8 h-8 text-purple-400 animate-spin mb-3" />
            <p className="text-white/40 text-sm">Loading SEO data…</p>
          </GlassCard>
        ) : (
          <GlassCard className="p-6 space-y-4">
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-white/10">
              <div>
                <h3 className="text-white font-bold text-lg">{selectedPage?.label}</h3>
                <p className="text-white/35 text-xs mt-0.5">{selectedPage?.path}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleReset}
                  title="Clear all fields"
                  className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-all"
                >
                  <RotateCcw className="w-4 h-4" />
                </button>
                <Button
                  onClick={handleSave}
                  disabled={saving}
                  className="bg-purple-600 hover:bg-purple-500 text-white text-sm px-4 py-2 h-auto"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> : <Save className="w-3.5 h-3.5 mr-1.5" />}
                  {saving ? 'Saving…' : 'Save'}
                </Button>
              </div>
            </div>

            {/* AI Panel */}
            <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4 space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  <span className="text-white font-semibold text-sm">AI Generation</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setShowAiOptions(!showAiOptions)}
                    className="text-xs text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1"
                  >
                    Options {showAiOptions ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                  </button>
                  {/* Meta fields button */}
                  <Button
                    onClick={handleGenerate}
                    disabled={generating || generatingJsonLd}
                    size="sm"
                    className="bg-purple-600/80 hover:bg-purple-500 text-white text-xs h-8 px-3"
                  >
                    {generating
                      ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Generating…</>
                      : <><Wand2 className="w-3 h-3 mr-1" />Meta fields</>}
                  </Button>
                  {/* JSON-LD button */}
                  <Button
                    onClick={handleGenerateJsonLd}
                    disabled={generating || generatingJsonLd}
                    size="sm"
                    className="bg-blue-600/80 hover:bg-blue-500 text-white text-xs h-8 px-3"
                  >
                    {generatingJsonLd
                      ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Generating…</>
                      : <><Code2 className="w-3 h-3 mr-1" />JSON-LD</>}
                  </Button>
                </div>
              </div>

              {showAiOptions && (
                <div className="space-y-2 pt-1">
                  <Input
                    placeholder="Optional instruction… e.g. 'Focus on After Effects motion design keywords'"
                    value={aiInstruction}
                    onChange={e => setAiInstruction(e.target.value)}
                    className="bg-white/5 border-white/10 text-white placeholder-white/25 text-xs h-8"
                  />
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={improveExisting}
                      onChange={e => setImproveExisting(e.target.checked)}
                      className="accent-purple-500 rounded"
                    />
                    <span className="text-white/60 text-xs">Rewrite existing fields (improve mode)</span>
                  </label>
                </div>
              )}

              <p className="text-white/30 text-xs">
                <strong className="text-purple-400">Meta fields</strong> fills title, description, keywords, OG &amp; Twitter.
                {' '}<strong className="text-blue-400">JSON-LD</strong> generates structured data schema (
                {selectedPage?.type === 'tool' ? 'SoftwareApplication' : selectedPage?.type === 'project' ? 'CreativeWork' : 'WebPage/Organization'}
                ).
              </p>
            </div>

            {/* Message */}
            {formMessage && (
              <div className={`flex items-start gap-2 p-3 rounded-xl text-sm ${
                formMessage.type === 'success'
                  ? 'bg-green-500/10 border border-green-500/20 text-green-300'
                  : 'bg-red-500/10 border border-red-500/20 text-red-300'
              }`}>
                {formMessage.type === 'success'
                  ? <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  : <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />}
                <span className="flex-1">{formMessage.text}</span>
                <button onClick={() => setFormMessage(null)} className="opacity-60 hover:opacity-100"><X className="w-3.5 h-3.5" /></button>
              </div>
            )}

            {/* ── Basic SEO ── */}
            <div className="border border-white/10 rounded-xl overflow-hidden">
              <SectionHeader id="basic" label="Basic SEO" icon={Search} />
              {openSection === 'basic' && (
                <div className="px-4 pb-4 space-y-4 border-t border-white/10 pt-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-white/60 text-xs font-medium">Page Title</label>
                      {charCount(seo.title, 60)}
                    </div>
                    <Input
                      value={seo.title}
                      onChange={e => setSeo(p => ({ ...p, title: e.target.value }))}
                      placeholder="Fastoosh — Premium Motion Design Studio"
                      className={`bg-white/5 border-white/10 text-white placeholder-white/20 text-sm ${hlClass('title')}`}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-white/60 text-xs font-medium">Meta Description</label>
                      {charCount(seo.description, 160)}
                    </div>
                    <Textarea
                      value={seo.description}
                      onChange={e => setSeo(p => ({ ...p, description: e.target.value }))}
                      placeholder="Fastoosh crafts premium motion design and After Effects tools for studios and creators."
                      rows={3}
                      className={`bg-white/5 border-white/10 text-white placeholder-white/20 text-sm resize-none ${hlClass('description')}`}
                    />
                  </div>

                  <div>
                    <label className="text-white/60 text-xs font-medium block mb-1">Keywords</label>
                    <Input
                      value={seo.keywords}
                      onChange={e => setSeo(p => ({ ...p, keywords: e.target.value }))}
                      placeholder="After Effects plugins, motion design, VFX tools, animation scripts"
                      className={`bg-white/5 border-white/10 text-white placeholder-white/20 text-sm ${hlClass('keywords')}`}
                    />
                    <p className="text-white/25 text-xs mt-1">Comma-separated</p>
                  </div>

                  <div>
                    <label className="text-white/60 text-xs font-medium block mb-1">
                      <Link2 className="w-3 h-3 inline mr-1" />Canonical URL
                    </label>
                    <div className="flex gap-2">
                      <Input
                        value={seo.canonicalUrl}
                        onChange={e => setSeo(p => ({ ...p, canonicalUrl: e.target.value }))}
                        placeholder={autoCanonical || 'https://fastoosh.com/tools'}
                        className="bg-white/5 border-white/10 text-white placeholder-white/20 text-sm flex-1"
                      />
                      {autoCanonical && !seo.canonicalUrl && (
                        <button
                          onClick={() => setSeo(p => ({ ...p, canonicalUrl: autoCanonical }))}
                          title="Auto-fill from site URL"
                          className="px-3 py-2 rounded-lg bg-purple-500/15 border border-purple-500/25 text-purple-400 text-xs hover:bg-purple-500/25 transition-all flex items-center gap-1 whitespace-nowrap"
                        >
                          <Zap className="w-3 h-3" />Auto-fill
                        </button>
                      )}
                    </div>
                    {autoCanonical && (
                      <p className="text-white/20 text-xs mt-1">Auto from site URL: {autoCanonical}</p>
                    )}
                  </div>

                  <label className="flex items-center gap-3 cursor-pointer select-none p-3 rounded-xl border border-white/10 hover:bg-white/5 transition-colors">
                    <input
                      type="checkbox"
                      checked={seo.noIndex}
                      onChange={e => setSeo(p => ({ ...p, noIndex: e.target.checked }))}
                      className="accent-purple-500 w-4 h-4 rounded"
                    />
                    <div>
                      <p className="text-white text-sm font-medium flex items-center gap-1.5">
                        <EyeOff className="w-3.5 h-3.5 text-red-400" />No Index
                      </p>
                      <p className="text-white/30 text-xs">Prevents search engines from indexing this page.</p>
                    </div>
                  </label>
                </div>
              )}
            </div>

            {/* ── Open Graph ── */}
            <div className="border border-white/10 rounded-xl overflow-hidden">
              <SectionHeader id="og" label="Open Graph (Facebook / LinkedIn)" icon={Share2} />
              {openSection === 'og' && (
                <div className="px-4 pb-4 space-y-4 border-t border-white/10 pt-4">
                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-white/60 text-xs font-medium">OG Title</label>
                      {charCount(seo.ogTitle, 60)}
                    </div>
                    <Input
                      value={seo.ogTitle}
                      onChange={e => setSeo(p => ({ ...p, ogTitle: e.target.value }))}
                      placeholder="Leave blank to inherit page title"
                      className={`bg-white/5 border-white/10 text-white placeholder-white/20 text-sm ${hlClass('ogTitle')}`}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-white/60 text-xs font-medium">OG Description</label>
                      {charCount(seo.ogDescription, 200)}
                    </div>
                    <Textarea
                      value={seo.ogDescription}
                      onChange={e => setSeo(p => ({ ...p, ogDescription: e.target.value }))}
                      placeholder="Leave blank to inherit meta description"
                      rows={3}
                      className={`bg-white/5 border-white/10 text-white placeholder-white/20 text-sm resize-none ${hlClass('ogDescription')}`}
                    />
                  </div>

                  <div>
                    <label className="text-white/60 text-xs font-medium block mb-1">OG Image URL</label>
                    <Input
                      value={seo.ogImage}
                      onChange={e => setSeo(p => ({ ...p, ogImage: e.target.value }))}
                      placeholder={defaultOgImage ? `Fallback: ${defaultOgImage}` : 'https://… (1200×630 recommended)'}
                      className="bg-white/5 border-white/10 text-white placeholder-white/20 text-sm"
                    />
                    {(seo.ogImage || defaultOgImage) && (
                      <div className="mt-2">
                        <img
                          src={seo.ogImage || defaultOgImage}
                          alt="OG preview"
                          className="rounded-lg w-full max-h-32 object-cover border border-white/10"
                          onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                        {!seo.ogImage && defaultOgImage && (
                          <p className="text-white/25 text-xs mt-1">Showing global default OG image fallback</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* ── Twitter Card ── */}
            <div className="border border-white/10 rounded-xl overflow-hidden">
              <SectionHeader id="twitter" label="Twitter / X Card" icon={Twitter} />
              {openSection === 'twitter' && (
                <div className="px-4 pb-4 space-y-4 border-t border-white/10 pt-4">
                  <div>
                    <label className="text-white/60 text-xs font-medium block mb-1">Card Type</label>
                    <AdminSelect
                      value={seo.twitterCard}
                      onChange={v => setSeo(p => ({ ...p, twitterCard: v }))}
                      options={[
                        { value: 'summary_large_image', label: 'summary_large_image (recommended)' },
                        { value: 'summary', label: 'summary' },
                      ]}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-white/60 text-xs font-medium">Twitter Title</label>
                      {charCount(seo.twitterTitle, 70)}
                    </div>
                    <Input
                      value={seo.twitterTitle}
                      onChange={e => setSeo(p => ({ ...p, twitterTitle: e.target.value }))}
                      placeholder="Leave blank to inherit OG or page title"
                      className={`bg-white/5 border-white/10 text-white placeholder-white/20 text-sm ${hlClass('twitterTitle')}`}
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-1">
                      <label className="text-white/60 text-xs font-medium">Twitter Description</label>
                      {charCount(seo.twitterDescription, 200)}
                    </div>
                    <Textarea
                      value={seo.twitterDescription}
                      onChange={e => setSeo(p => ({ ...p, twitterDescription: e.target.value }))}
                      placeholder="Leave blank to inherit OG or meta description"
                      rows={3}
                      className={`bg-white/5 border-white/10 text-white placeholder-white/20 text-sm resize-none ${hlClass('twitterDescription')}`}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ── JSON-LD Structured Data ── */}
            <div className="border border-white/10 rounded-xl overflow-hidden">
              <SectionHeader
                id="jsonld"
                label="JSON-LD Structured Data"
                icon={Code2}
                badge={selectedPage?.type === 'tool' ? 'SoftwareApplication' : selectedPage?.type === 'project' ? 'CreativeWork' : 'WebPage'}
              />
              {openSection === 'jsonld' && (
                <div className="px-4 pb-4 space-y-3 border-t border-white/10 pt-4">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-white/40 text-xs leading-relaxed">
                      JSON-LD is injected as a <code className="text-purple-300 bg-purple-500/10 px-1 rounded">&lt;script type="application/ld+json"&gt;</code> tag.
                      Use the <strong className="text-blue-400">JSON-LD</strong> AI button above to generate the right schema automatically.
                    </p>
                  </div>

                  <div className={`relative ${hlClass('structuredData')}`}>
                    <Textarea
                      value={seo.structuredData}
                      onChange={e => {
                        setSeo(p => ({ ...p, structuredData: e.target.value }));
                        setJsonLdError(e.target.value && !isValidJson(e.target.value) ? 'Invalid JSON' : '');
                      }}
                      placeholder={'{\n  "@context": "https://schema.org",\n  "@type": "WebPage",\n  "name": "..."\n}'}
                      rows={12}
                      className="bg-black/30 border-white/10 text-white/80 placeholder-white/15 text-xs font-mono resize-y leading-relaxed"
                    />
                    {seo.structuredData && (
                      <button
                        onClick={() => {
                          try {
                            const pretty = JSON.stringify(JSON.parse(seo.structuredData), null, 2);
                            setSeo(p => ({ ...p, structuredData: pretty }));
                            setJsonLdError('');
                          } catch { setJsonLdError('Cannot format — invalid JSON'); }
                        }}
                        className="absolute top-2 right-2 px-2 py-1 rounded bg-white/5 border border-white/10 text-white/40 hover:text-white/70 text-[10px] transition-colors"
                      >
                        Format
                      </button>
                    )}
                  </div>

                  {jsonLdError && (
                    <p className="text-red-400 text-xs flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />{jsonLdError}
                    </p>
                  )}
                  {seo.structuredData && isValidJson(seo.structuredData) && (
                    <p className="text-green-400/70 text-xs flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />Valid JSON-LD
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Last saved */}
            {seo.updatedAt && (
              <p className="text-white/20 text-xs text-right">
                Last saved: {new Date(seo.updatedAt).toLocaleString()}
              </p>
            )}
          </GlassCard>
        )}
      </div>
    </div>
  );
}

// ─── Page list item ───────────────────────────────────────────────────────────
function PageListItem({ page, selected, onClick }: { page: PageEntry; selected: boolean; onClick: () => void }) {
  const typeIcon = page.type === 'tool' ? '🛠' : page.type === 'project' ? '🎬' : '📄';
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left transition-all text-sm ${
        selected
          ? 'bg-purple-500/15 border border-purple-500/30 text-white'
          : 'text-white/50 hover:text-white/80 hover:bg-white/5 border border-transparent'
      }`}
    >
      <span className="text-base leading-none">{typeIcon}</span>
      <span className="truncate">{page.label}</span>
      {selected && <ChevronRight className="w-3.5 h-3.5 ml-auto text-purple-400 flex-shrink-0" />}
    </button>
  );
}