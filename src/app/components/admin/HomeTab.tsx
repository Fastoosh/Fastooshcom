import { useState, useEffect } from 'react';
import { GlassCard } from '../shared/GlassCard';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { AdminSelect } from './AdminSelect';
import {
  Save, Sparkles, ChevronDown, ChevronRight, Loader2, Plus, Trash2,
  X, CheckCircle2, AlertCircle, Wand2, RotateCcw,
  Home, Quote, Star, Zap, Target, Shield, TrendingUp, Award,
  Heart, Layers, Globe, Clock, CheckCircle, MessageSquare,
  Play, Users, ArrowRight, Lightbulb, Video,
} from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

// ── Icon options for capabilities ────────────────────────────────────────────
const ICON_OPTIONS = [
  { value: 'sparkles', label: 'Sparkles ✨', Icon: Sparkles },
  { value: 'zap', label: 'Zap ⚡', Icon: Zap },
  { value: 'target', label: 'Target 🎯', Icon: Target },
  { value: 'star', label: 'Star ⭐', Icon: Star },
  { value: 'shield', label: 'Shield 🛡️', Icon: Shield },
  { value: 'trending-up', label: 'Trending Up 📈', Icon: TrendingUp },
  { value: 'award', label: 'Award 🏆', Icon: Award },
  { value: 'heart', label: 'Heart ❤️', Icon: Heart },
  { value: 'layers', label: 'Layers 🗂️', Icon: Layers },
  { value: 'globe', label: 'Globe 🌍', Icon: Globe },
  { value: 'clock', label: 'Clock ⏰', Icon: Clock },
  { value: 'users', label: 'Users 👥', Icon: Users },
  { value: 'lightbulb', label: 'Lightbulb 💡', Icon: Lightbulb },
  { value: 'message', label: 'Message 💬', Icon: MessageSquare },
  { value: 'play', label: 'Play ▶️', Icon: Play },
  { value: 'video', label: 'Video 🎥', Icon: Video },
];

export const ICON_MAP: Record<string, any> = Object.fromEntries(
  ICON_OPTIONS.map(o => [o.value, o.Icon])
);

// ── Default content ───────────────────────────────────────────────────────────
export const DEFAULT_HOME_CONTENT: HomeContent = {
  heroLine1: 'Premium motion design',
  heroLine2: 'for ambitious teams',
  heroSubtitle: 'High-end custom work that drives results. Remote collaboration with studios worldwide.',
  heroCta1Text: 'Work with us',
  heroCta2Text: 'View projects',
  showreelUrl: '',
  testimonialQuote: 'Fastoosh delivered exceptional work in record time. Their attention to detail and understanding of our brand was remarkable.',
  testimonialAuthor: 'Sarah Chen',
  testimonialRole: 'Head of Marketing at TechCorp',
  featuredHeading: 'Featured work',
  featuredSubtitle: 'Selected projects for ambitious brands',
  capabilitiesHeading: 'Why work with us',
  capabilities: [
    { icon: 'sparkles', title: 'Premium Craft', description: 'Every frame matters. Pixel-perfect attention to detail that elevates your brand.' },
    { icon: 'zap', title: 'Fast Turnaround', description: 'Structured process. Clear milestones. On-time delivery without compromising quality.' },
    { icon: 'target', title: 'Business Impact', description: 'Motion design that drives results. Conversion-focused, data-informed creative.' },
  ],
  processHeading: 'Our process',
  processSubtitle: 'Clear, structured, and collaborative',
  processSteps: [
    { number: '01', title: 'Discovery', description: 'Deep dive into your goals, brand, and audience' },
    { number: '02', title: 'Concept', description: 'Creative direction, styleframes, and motion tests' },
    { number: '03', title: 'Production', description: 'Animation, sound design, and refinement' },
    { number: '04', title: 'Delivery', description: 'Final assets + source files + documentation' },
  ],
  turnaroundRows: [
    { label: 'Short-form video', time: '1-2 weeks' },
    { label: 'Product explainer', time: '2-3 weeks' },
    { label: 'Brand identity', time: '3-4 weeks' },
    { label: 'Full campaign', time: '4-6 weeks' },
  ],
  turnaroundNote: 'Rush options available',
  deliverablesTitle: 'What you get',
  deliverables: [
    'Final rendered videos (all formats)',
    'Editable source files',
    'Brand guidelines (if needed)',
    'Sound design & music',
    'Unlimited revisions in scope',
    'Post-delivery support (30 days)',
  ],
  ctaHeading: 'Ready to create something',
  ctaHeadingGradient: 'extraordinary?',
  ctaSubtitle: "Let's discuss your project. We typically reply within 24-48 hours.",
  ctaBadges: ['✓ Reply in 24-48h', '✓ NDA-friendly', '✓ Remote worldwide'],
};

export interface HomeContent {
  heroLine1: string;
  heroLine2: string;
  heroSubtitle: string;
  heroCta1Text: string;
  heroCta2Text: string;
  showreelUrl: string;
  testimonialQuote: string;
  testimonialAuthor: string;
  testimonialRole: string;
  featuredHeading: string;
  featuredSubtitle: string;
  capabilitiesHeading: string;
  capabilities: Array<{ icon: string; title: string; description: string }>;
  processHeading: string;
  processSubtitle: string;
  processSteps: Array<{ number: string; title: string; description: string }>;
  turnaroundRows: Array<{ label: string; time: string }>;
  turnaroundNote: string;
  deliverablesTitle: string;
  deliverables: string[];
  ctaHeading: string;
  ctaHeadingGradient: string;
  ctaSubtitle: string;
  ctaBadges: string[];
}

type Section = 'hero' | 'testimonial' | 'featured' | 'capabilities' | 'process' | 'turnaround' | 'deliverables' | 'cta';

const SECTIONS: Array<{ id: Section; label: string; icon: any; description: string }> = [
  { id: 'hero',         label: 'Hero',              icon: Home,        description: 'Headline, subtitle, showreel & CTA buttons' },
  { id: 'testimonial',  label: 'Testimonial',       icon: Quote,       description: 'Social proof quote block' },
  { id: 'featured',     label: 'Featured Work',     icon: Star,        description: 'Section heading & subtitle' },
  { id: 'capabilities', label: 'Capabilities',      icon: Sparkles,    description: '"Why work with us" cards' },
  { id: 'process',      label: 'Process Steps',     icon: ArrowRight,  description: 'Step-by-step workflow' },
  { id: 'turnaround',   label: 'Turnaround Times',  icon: Clock,       description: 'Delivery timeline & note' },
  { id: 'deliverables', label: 'Deliverables',      icon: CheckCircle, description: '"What you get" list' },
  { id: 'cta',          label: 'Final CTA',         icon: Target,      description: 'Bottom call-to-action section' },
];

// ── Main component ─────────────────────────────────────────────────────────────
export function HomeTab() {
  const [content, setContent] = useState<HomeContent>({ ...DEFAULT_HOME_CONTENT });
  const [loading, setLoading]  = useState(true);
  const [saving, setSaving]    = useState(false);
  const [openSection, setOpenSection]     = useState<Section | null>('hero');
  const [generating, setGenerating]       = useState<Section | 'all' | null>(null);
  const [aiInstruction, setAiInstruction] = useState('');
  const [improveMode, setImproveMode]     = useState(false);
  const [showAiOptions, setShowAiOptions] = useState(false);
  const [formMessage, setFormMessage]     = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [highlightedSections, setHighlightedSections] = useState<Set<Section>>(new Set());

  // Load on mount
  useEffect(() => {
    const token = localStorage.getItem('admin_token');
    fetch(`${API_BASE}/home-content`, {
      headers: { Authorization: `Bearer ${publicAnonKey}`, 'X-Admin-Token': token || '' },
    })
      .then(r => r.json())
      .then(data => {
        if (data.data) setContent({ ...DEFAULT_HOME_CONTENT, ...data.data });
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true);
    setFormMessage(null);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/home-content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}`, 'X-Admin-Token': token || '' },
        body: JSON.stringify(content),
      });
      const data = await res.json();
      if (data.success) {
        setFormMessage({ type: 'success', text: '✅ Home page content saved successfully!' });
      } else {
        setFormMessage({ type: 'error', text: data.error || 'Failed to save.' });
      }
    } catch (e) {
      setFormMessage({ type: 'error', text: `Error: ${e}` });
    }
    setSaving(false);
  };

  // ── AI Generate ──────────────────────────────────────────────────────────
  const handleGenerate = async (section: Section | 'all') => {
    setGenerating(section);
    setFormMessage(null);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/admin/generate-home-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}`, 'X-Admin-Token': token || '' },
        body: JSON.stringify({ section, existingContent: content, instruction: aiInstruction, improveExisting: improveMode }),
      });
      const data = await res.json();
      if (!data.success) { setFormMessage({ type: 'error', text: data.error || 'Generation failed.' }); return; }

      setContent(prev => deepMerge(prev, data.data));

      const updated = section === 'all' ? SECTIONS.map(s => s.id) : [section as Section];
      setHighlightedSections(new Set(updated));
      setTimeout(() => setHighlightedSections(new Set()), 3500);

      setFormMessage({ type: 'success', text: `✨ ${section === 'all' ? 'All sections' : SECTIONS.find(s => s.id === section)?.label} generated! Review and save.` });
      if (section !== 'all') setOpenSection(section as Section);
    } catch (e) {
      setFormMessage({ type: 'error', text: `Error: ${e}` });
    }
    setGenerating(null);
  };

  const hlCard = (id: Section) =>
    highlightedSections.has(id)
      ? 'ring-2 ring-purple-400/60 shadow-[0_0_20px_rgba(192,132,252,0.3)]'
      : '';

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-purple-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-white">Home Page Content</h2>
          <p className="text-white/40 text-sm mt-0.5">Edit every section of the home page. Changes are reflected live after saving.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setContent({ ...DEFAULT_HOME_CONTENT })}
            title="Reset to defaults"
            className="p-2 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/5 transition-all"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="bg-purple-600 hover:bg-purple-500 text-white"
          >
            {saving ? <><Loader2 className="w-4 h-4 animate-spin mr-2" />Saving…</> : <><Save className="w-4 h-4 mr-2" />Save all changes</>}
          </Button>
        </div>
      </div>

      {/* AI panel */}
      <GlassCard className="p-4 border-purple-500/20">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span className="text-white font-semibold text-sm">AI Content Generation</span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setShowAiOptions(!showAiOptions)}
              className="text-xs text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1"
            >
              Options {showAiOptions ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
            </button>
            <Button
              onClick={() => handleGenerate('all')}
              disabled={generating !== null}
              className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white text-sm h-9 px-4"
            >
              {generating === 'all'
                ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Generating all…</>
                : <><Wand2 className="w-3.5 h-3.5 mr-1.5" />Generate entire page</>}
            </Button>
          </div>
        </div>
        {showAiOptions && (
          <div className="mt-3 space-y-2 pt-3 border-t border-white/10">
            <Input
              placeholder="Optional instruction… e.g. 'Make it more playful and youthful'"
              value={aiInstruction}
              onChange={e => setAiInstruction(e.target.value)}
              className="bg-white/5 border-white/10 text-white placeholder-white/25 text-xs h-8"
            />
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={improveMode}
                onChange={e => setImproveMode(e.target.checked)}
                className="accent-purple-500 rounded"
              />
              <span className="text-white/60 text-xs">Improve existing content (rewrite mode)</span>
            </label>
          </div>
        )}
        <p className="text-white/25 text-xs mt-2">
          Generate a single section via the ✨ button inside each card, or click "Generate entire page" to fill all sections at once.
        </p>
      </GlassCard>

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
          <button onClick={() => setFormMessage(null)}><X className="w-3.5 h-3.5 opacity-60 hover:opacity-100" /></button>
        </div>
      )}

      {/* Sections */}
      {SECTIONS.map(({ id, label, icon: Icon, description }) => (
        <div key={id} className={`border border-white/10 rounded-2xl overflow-hidden transition-all duration-300 ${hlCard(id)}`}>
          {/* Section header — div instead of button to avoid nested-button error */}
          <div
            role="button"
            tabIndex={0}
            onClick={() => setOpenSection(openSection === id ? null : id)}
            onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && setOpenSection(openSection === id ? null : id)}
            className="w-full flex items-center justify-between p-4 text-left hover:bg-white/5 transition-colors cursor-pointer group select-none"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-purple-500/15 flex items-center justify-center flex-shrink-0">
                <Icon className="w-4 h-4 text-purple-400" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">{label}</p>
                <p className="text-white/35 text-xs">{description}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={e => { e.stopPropagation(); handleGenerate(id); }}
                disabled={generating !== null}
                title={`AI generate "${label}"`}
                className="opacity-0 group-hover:opacity-100 flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-500/15 border border-purple-500/20 text-purple-400 text-xs hover:bg-purple-500/25 transition-all"
              >
                {generating === id
                  ? <Loader2 className="w-3 h-3 animate-spin" />
                  : <Sparkles className="w-3 h-3" />}
                AI
              </button>
              {openSection === id
                ? <ChevronDown className="w-4 h-4 text-white/40" />
                : <ChevronRight className="w-4 h-4 text-white/40" />}
            </div>
          </div>

          {/* Section content */}
          {openSection === id && (
            <div className="px-4 pb-5 border-t border-white/10 pt-4">
              {id === 'hero'         && <HeroSection content={content} setContent={setContent} />}
              {id === 'testimonial'  && <TestimonialSection content={content} setContent={setContent} />}
              {id === 'featured'     && <FeaturedSection content={content} setContent={setContent} />}
              {id === 'capabilities' && <CapabilitiesSection content={content} setContent={setContent} />}
              {id === 'process'      && <ProcessSection content={content} setContent={setContent} />}
              {id === 'turnaround'   && <TurnaroundSection content={content} setContent={setContent} />}
              {id === 'deliverables' && <DeliverablesSection content={content} setContent={setContent} />}
              {id === 'cta'          && <CtaSection content={content} setContent={setContent} />}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Shared label ──────────────────────────────────────────────────────────────
function FieldLabel({ label, hint }: { label: string; hint?: string }) {
  return (
    <div className="mb-1">
      <label className="text-white/60 text-xs font-medium">{label}</label>
      {hint && <span className="text-white/25 text-xs ml-2">{hint}</span>}
    </div>
  );
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function HeroSection({ content, setContent }: { content: HomeContent; setContent: any }) {
  const set = (key: keyof HomeContent, val: string) => setContent((p: HomeContent) => ({ ...p, [key]: val }));
  const [uploading, setUploading] = useState(false);
  const [videoInputMode, setVideoInputMode] = useState<'url' | 'upload'>('url');

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_BASE}/upload-video`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${publicAnonKey}`, 'X-Admin-Token': token || '' },
        body: fd,
      });
      const data = await res.json();
      if (data.success) set('showreelUrl', data.data.url);
      else console.error('Video upload error:', data.error);
    } catch (err) {
      console.error('Video upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <FieldLabel label="Heading Line 1" hint="(plain text)" />
          <Input value={content.heroLine1} onChange={e => set('heroLine1', e.target.value)} placeholder="Premium motion design" className="bg-white/5 border-white/10 text-white" />
        </div>
        <div>
          <FieldLabel label="Heading Line 2" hint="(shown in gradient)" />
          <Input value={content.heroLine2} onChange={e => set('heroLine2', e.target.value)} placeholder="for ambitious teams" className="bg-white/5 border-white/10 text-white" />
        </div>
      </div>
      <div>
        <FieldLabel label="Subtitle" />
        <Textarea value={content.heroSubtitle} onChange={e => set('heroSubtitle', e.target.value)} rows={2} className="bg-white/5 border-white/10 text-white resize-none" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <FieldLabel label="Primary CTA Button" hint="(links to /work-with-us)" />
          <Input value={content.heroCta1Text} onChange={e => set('heroCta1Text', e.target.value)} placeholder="Work with us" className="bg-white/5 border-white/10 text-white" />
        </div>
        <div>
          <FieldLabel label="Secondary CTA Button" hint="(links to /projects)" />
          <Input value={content.heroCta2Text} onChange={e => set('heroCta2Text', e.target.value)} placeholder="View projects" className="bg-white/5 border-white/10 text-white" />
        </div>
      </div>

      {/* Showreel */}
      <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-3">
        <div className="flex items-center gap-2">
          <Video className="w-4 h-4 text-purple-400" />
          <span className="text-white/70 text-sm font-medium">Showreel Video</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setVideoInputMode('url')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${videoInputMode === 'url' ? 'bg-purple-500 text-white' : 'bg-white/10 text-white/50 hover:bg-white/15'}`}
          >
            Paste URL
          </button>
          <button
            type="button"
            onClick={() => setVideoInputMode('upload')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${videoInputMode === 'upload' ? 'bg-purple-500 text-white' : 'bg-white/10 text-white/50 hover:bg-white/15'}`}
          >
            Upload File
          </button>
        </div>
        {videoInputMode === 'url' ? (
          <div>
            <Input
              value={content.showreelUrl || ''}
              onChange={e => set('showreelUrl', e.target.value)}
              placeholder="https://player.vimeo.com/video/123456789 or YouTube URL"
              className="bg-black/40 border-white/10 text-white text-sm"
            />
            <p className="text-white/30 text-xs mt-1">Accepts Vimeo, YouTube, or any direct embed URL.</p>
          </div>
        ) : (
          <div>
            <Button
              type="button"
              variant="outline"
              onClick={() => document.getElementById('homeShowreelUpload')?.click()}
              disabled={uploading}
              className="w-full text-sm border-white/25 text-white hover:bg-white/10 hover:border-white/40 bg-transparent"
            >
              {uploading ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />Uploading…</> : 'Choose video file to upload'}
            </Button>
            <input type="file" id="homeShowreelUpload" accept="video/*" onChange={handleVideoUpload} className="hidden" />
            <p className="text-white/30 text-xs mt-1">Supported: MP4, MOV, AVI, WebM (max 100MB)</p>
          </div>
        )}
        {content.showreelUrl && (
          <p className="text-green-400 text-xs flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> Showreel URL set
          </p>
        )}
      </div>

      {/* Preview */}
      <div className="p-3 bg-white/5 rounded-xl border border-white/10">
        <p className="text-white/30 text-xs mb-2 font-medium">Heading preview</p>
        <div className="text-center py-4">
          <h1 className="text-2xl font-bold text-white leading-tight">
            {content.heroLine1 || 'Heading Line 1'}
            <br />
            <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              {content.heroLine2 || 'Heading Line 2'}
            </span>
          </h1>
          <p className="text-sm text-white/60 mt-2">{content.heroSubtitle}</p>
          <div className="flex gap-2 justify-center mt-3">
            <span className="px-3 py-1.5 bg-purple-500 text-white text-xs rounded-lg">{content.heroCta1Text}</span>
            <span className="px-3 py-1.5 bg-white/10 text-white text-xs rounded-lg">{content.heroCta2Text}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Testimonial ───────────────────────────────────────────────────────────────
function TestimonialSection({ content, setContent }: { content: HomeContent; setContent: any }) {
  const set = (key: keyof HomeContent, val: string) => setContent((p: HomeContent) => ({ ...p, [key]: val }));
  return (
    <div className="space-y-4">
      <div>
        <FieldLabel label="Quote" />
        <Textarea value={content.testimonialQuote} onChange={e => set('testimonialQuote', e.target.value)} rows={3} className="bg-white/5 border-white/10 text-white resize-none" placeholder="The most impressive motion design work..." />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <FieldLabel label="Author Name" />
          <Input value={content.testimonialAuthor} onChange={e => set('testimonialAuthor', e.target.value)} placeholder="Sarah Chen" className="bg-white/5 border-white/10 text-white" />
        </div>
        <div>
          <FieldLabel label="Author Role / Company" />
          <Input value={content.testimonialRole} onChange={e => set('testimonialRole', e.target.value)} placeholder="Head of Marketing at TechCorp" className="bg-white/5 border-white/10 text-white" />
        </div>
      </div>
      <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-center italic text-white/80 text-sm">
        "{content.testimonialQuote}"
        <footer className="mt-2 not-italic text-white/50 text-xs">
          <strong className="text-white">{content.testimonialAuthor}</strong>
          {content.testimonialRole && `, ${content.testimonialRole}`}
        </footer>
      </div>
    </div>
  );
}

// ── Featured ──────────────────────────────────────────────────────────────────
function FeaturedSection({ content, setContent }: { content: HomeContent; setContent: any }) {
  const set = (key: keyof HomeContent, val: string) => setContent((p: HomeContent) => ({ ...p, [key]: val }));
  return (
    <div className="space-y-4">
      <div>
        <FieldLabel label="Section Heading" />
        <Input value={content.featuredHeading} onChange={e => set('featuredHeading', e.target.value)} placeholder="Featured work" className="bg-white/5 border-white/10 text-white" />
      </div>
      <div>
        <FieldLabel label="Section Subtitle" />
        <Input value={content.featuredSubtitle} onChange={e => set('featuredSubtitle', e.target.value)} placeholder="Selected projects for ambitious brands" className="bg-white/5 border-white/10 text-white" />
      </div>
      <p className="text-white/30 text-xs">
        The featured projects grid is automatically populated from projects marked as "Featured" in the Projects tab.
      </p>
    </div>
  );
}

// ── Capabilities ──────────────────────────────────────────────────────────────
function CapabilitiesSection({ content, setContent }: { content: HomeContent; setContent: any }) {
  const setHeading = (val: string) => setContent((p: HomeContent) => ({ ...p, capabilitiesHeading: val }));
  const updateCap = (idx: number, key: string, val: string) =>
    setContent((p: HomeContent) => ({ ...p, capabilities: p.capabilities.map((c, i) => i === idx ? { ...c, [key]: val } : c) }));
  const addCap = () =>
    setContent((p: HomeContent) => ({ ...p, capabilities: [...p.capabilities, { icon: 'sparkles', title: '', description: '' }] }));
  const removeCap = (idx: number) =>
    setContent((p: HomeContent) => ({ ...p, capabilities: p.capabilities.filter((_, i) => i !== idx) }));

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel label="Section Heading" />
        <Input value={content.capabilitiesHeading} onChange={e => setHeading(e.target.value)} placeholder="Why work with us" className="bg-white/5 border-white/10 text-white" />
      </div>
      <div className="space-y-3">
        <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">Capability Cards</p>
        {content.capabilities.map((cap, idx) => {
          const IconComp = ICON_MAP[cap.icon] || Sparkles;
          return (
            <div key={idx} className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg bg-purple-500/20 flex items-center justify-center">
                    <IconComp className="w-3.5 h-3.5 text-purple-400" />
                  </div>
                  <span className="text-white/60 text-xs font-medium">Card {idx + 1}</span>
                </div>
                {content.capabilities.length > 1 && (
                  <button onClick={() => removeCap(idx)} className="text-red-400/60 hover:text-red-400 transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <FieldLabel label="Icon" />
                  <AdminSelect
                    value={cap.icon}
                    onChange={v => updateCap(idx, 'icon', v)}
                    options={ICON_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
                  />
                </div>
                <div>
                  <FieldLabel label="Title" />
                  <Input value={cap.title} onChange={e => updateCap(idx, 'title', e.target.value)} placeholder="Premium Craft" className="bg-black/40 border-white/10 text-white text-sm" />
                </div>
                <div>
                  <FieldLabel label="Description" />
                  <Input value={cap.description} onChange={e => updateCap(idx, 'description', e.target.value)} placeholder="Every frame matters…" className="bg-black/40 border-white/10 text-white text-sm" />
                </div>
              </div>
            </div>
          );
        })}
      </div>
      {content.capabilities.length < 6 && (
        <Button type="button" variant="outline" onClick={addCap} className="w-full border-dashed border-white/20 text-white/40 hover:text-white hover:border-purple-500/40">
          <Plus className="w-3.5 h-3.5 mr-1.5" />Add capability card
        </Button>
      )}
    </div>
  );
}

// ── Process ───────────────────────────────────────────────────────────────────
function ProcessSection({ content, setContent }: { content: HomeContent; setContent: any }) {
  const set = (key: keyof HomeContent, val: string) => setContent((p: HomeContent) => ({ ...p, [key]: val }));
  const updateStep = (idx: number, key: string, val: string) =>
    setContent((p: HomeContent) => ({ ...p, processSteps: p.processSteps.map((s, i) => i === idx ? { ...s, [key]: val } : s) }));
  const addStep = () =>
    setContent((p: HomeContent) => ({ ...p, processSteps: [...p.processSteps, { number: String(p.processSteps.length + 1).padStart(2, '0'), title: '', description: '' }] }));
  const removeStep = (idx: number) =>
    setContent((p: HomeContent) => ({ ...p, processSteps: p.processSteps.filter((_, i) => i !== idx) }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <FieldLabel label="Section Heading" />
          <Input value={content.processHeading} onChange={e => set('processHeading', e.target.value)} placeholder="Our process" className="bg-white/5 border-white/10 text-white" />
        </div>
        <div>
          <FieldLabel label="Subtitle" />
          <Input value={content.processSubtitle} onChange={e => set('processSubtitle', e.target.value)} placeholder="Clear, structured, and collaborative" className="bg-white/5 border-white/10 text-white" />
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">Steps</p>
        {content.processSteps.map((step, idx) => (
          <div key={idx} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl border border-white/10">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
              {step.number}
            </div>
            <Input value={step.number} onChange={e => updateStep(idx, 'number', e.target.value)} placeholder="01" className="bg-black/40 border-white/10 text-white w-14 text-sm" />
            <Input value={step.title} onChange={e => updateStep(idx, 'title', e.target.value)} placeholder="Discovery" className="bg-black/40 border-white/10 text-white text-sm flex-1" />
            <Input value={step.description} onChange={e => updateStep(idx, 'description', e.target.value)} placeholder="Deep dive into your goals…" className="bg-black/40 border-white/10 text-white text-sm flex-[2]" />
            {content.processSteps.length > 1 && (
              <button onClick={() => removeStep(idx)} className="text-red-400/60 hover:text-red-400 transition-colors flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
      {content.processSteps.length < 8 && (
        <Button type="button" variant="outline" onClick={addStep} className="w-full border-dashed border-white/20 text-white/40 hover:text-white hover:border-purple-500/40">
          <Plus className="w-3.5 h-3.5 mr-1.5" />Add step
        </Button>
      )}
    </div>
  );
}

// ── Turnaround ────────────────────────────────────────────────────────────────
function TurnaroundSection({ content, setContent }: { content: HomeContent; setContent: any }) {
  const set = (key: keyof HomeContent, val: string) => setContent((p: HomeContent) => ({ ...p, [key]: val }));
  const updateRow = (idx: number, key: string, val: string) =>
    setContent((p: HomeContent) => ({ ...p, turnaroundRows: p.turnaroundRows.map((r, i) => i === idx ? { ...r, [key]: val } : r) }));
  const addRow = () =>
    setContent((p: HomeContent) => ({ ...p, turnaroundRows: [...p.turnaroundRows, { label: '', time: '' }] }));
  const removeRow = (idx: number) =>
    setContent((p: HomeContent) => ({ ...p, turnaroundRows: p.turnaroundRows.filter((_, i) => i !== idx) }));

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">Timeline Rows</p>
        {content.turnaroundRows.map((row, idx) => (
          <div key={idx} className="flex items-center gap-3">
            <Input value={row.label} onChange={e => updateRow(idx, 'label', e.target.value)} placeholder="Short-form video" className="bg-white/5 border-white/10 text-white text-sm flex-1" />
            <Input value={row.time} onChange={e => updateRow(idx, 'time', e.target.value)} placeholder="1-2 weeks" className="bg-white/5 border-white/10 text-white text-sm w-32" />
            {content.turnaroundRows.length > 1 && (
              <button onClick={() => removeRow(idx)} className="text-red-400/60 hover:text-red-400 transition-colors flex-shrink-0">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
      {content.turnaroundRows.length < 8 && (
        <Button type="button" variant="outline" onClick={addRow} className="w-full border-dashed border-white/20 text-white/40 hover:text-white hover:border-purple-500/40">
          <Plus className="w-3.5 h-3.5 mr-1.5" />Add row
        </Button>
      )}
      <div>
        <FieldLabel label="Note below table" />
        <Input value={content.turnaroundNote} onChange={e => set('turnaroundNote', e.target.value)} placeholder="Rush options available" className="bg-white/5 border-white/10 text-white" />
      </div>
    </div>
  );
}

// ── Deliverables ──────────────────────────────────────────────────────────────
function DeliverablesSection({ content, setContent }: { content: HomeContent; setContent: any }) {
  const set = (key: keyof HomeContent, val: string) => setContent((p: HomeContent) => ({ ...p, [key]: val }));
  const updateItem = (idx: number, val: string) =>
    setContent((p: HomeContent) => ({ ...p, deliverables: p.deliverables.map((d, i) => i === idx ? val : d) }));
  const addItem = () => setContent((p: HomeContent) => ({ ...p, deliverables: [...p.deliverables, ''] }));
  const removeItem = (idx: number) =>
    setContent((p: HomeContent) => ({ ...p, deliverables: p.deliverables.filter((_, i) => i !== idx) }));

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel label="Section Title" />
        <Input value={content.deliverablesTitle} onChange={e => set('deliverablesTitle', e.target.value)} placeholder="What you get" className="bg-white/5 border-white/10 text-white" />
      </div>
      <div className="space-y-2">
        <p className="text-white/40 text-xs font-semibold uppercase tracking-wider">Items</p>
        {content.deliverables.map((item, idx) => (
          <div key={idx} className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
            <Input value={item} onChange={e => updateItem(idx, e.target.value)} placeholder="Final rendered videos (all formats)" className="bg-white/5 border-white/10 text-white text-sm flex-1" />
            {content.deliverables.length > 1 && (
              <button onClick={() => removeItem(idx)} className="text-red-400/60 hover:text-red-400 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
      <Button type="button" variant="outline" onClick={addItem} className="w-full border-dashed border-white/20 text-white/40 hover:text-white hover:border-purple-500/40">
        <Plus className="w-3.5 h-3.5 mr-1.5" />Add deliverable
      </Button>
    </div>
  );
}

// ── CTA ───────────────────────────────────────────────────────────────────────
function CtaSection({ content, setContent }: { content: HomeContent; setContent: any }) {
  const set = (key: keyof HomeContent, val: string) => setContent((p: HomeContent) => ({ ...p, [key]: val }));
  const updateBadge = (idx: number, val: string) =>
    setContent((p: HomeContent) => ({ ...p, ctaBadges: p.ctaBadges.map((b, i) => i === idx ? val : b) }));
  const addBadge = () => setContent((p: HomeContent) => ({ ...p, ctaBadges: [...p.ctaBadges, ''] }));
  const removeBadge = (idx: number) =>
    setContent((p: HomeContent) => ({ ...p, ctaBadges: p.ctaBadges.filter((_, i) => i !== idx) }));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <FieldLabel label="Heading (first line)" />
          <Input value={content.ctaHeading} onChange={e => set('ctaHeading', e.target.value)} placeholder="Ready to create something" className="bg-white/5 border-white/10 text-white" />
        </div>
        <div>
          <FieldLabel label="Gradient word / phrase" hint="(second line, purple→blue)" />
          <Input value={content.ctaHeadingGradient} onChange={e => set('ctaHeadingGradient', e.target.value)} placeholder="extraordinary?" className="bg-white/5 border-white/10 text-white" />
        </div>
      </div>
      <div>
        <FieldLabel label="Subtitle" />
        <Textarea value={content.ctaSubtitle} onChange={e => set('ctaSubtitle', e.target.value)} rows={2} className="bg-white/5 border-white/10 text-white resize-none" />
      </div>
      <div>
        <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">Trust Badges</p>
        <div className="space-y-2">
          {content.ctaBadges.map((badge, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <Input value={badge} onChange={e => updateBadge(idx, e.target.value)} placeholder="✓ Reply in 24-48h" className="bg-white/5 border-white/10 text-white text-sm flex-1" />
              {content.ctaBadges.length > 1 && (
                <button onClick={() => removeBadge(idx)} className="text-red-400/60 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
        {content.ctaBadges.length < 6 && (
          <Button type="button" variant="outline" onClick={addBadge} className="mt-2 w-full border-dashed border-white/20 text-white/40 hover:text-white hover:border-purple-500/40">
            <Plus className="w-3.5 h-3.5 mr-1.5" />Add badge
          </Button>
        )}
      </div>
      {/* Preview */}
      <div className="p-4 bg-white/5 rounded-xl border border-white/10 text-center space-y-2">
        <p className="text-white/30 text-xs mb-2 font-medium text-left">Preview</p>
        <h2 className="text-2xl font-bold text-white">
          {content.ctaHeading}
          <br />
          <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
            {content.ctaHeadingGradient}
          </span>
        </h2>
        <p className="text-white/60 text-sm">{content.ctaSubtitle}</p>
        <div className="flex flex-wrap gap-3 justify-center mt-2">
          {content.ctaBadges.map((b, i) => <span key={i} className="text-white/40 text-xs">{b}</span>)}
        </div>
      </div>
    </div>
  );
}

// ── Deep merge helper ─────────────────────────────────────────────────────────
function deepMerge(base: HomeContent, overrides: Partial<HomeContent>): HomeContent {
  const result = { ...base };
  for (const [key, val] of Object.entries(overrides)) {
    if (val !== undefined && val !== null && val !== '') {
      (result as any)[key] = val;
    }
  }
  return result;
}