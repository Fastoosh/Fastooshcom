import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { AdminSelect } from './AdminSelect';
import { IconPicker } from './IconPicker';
import { Plus, Save, X, Upload, Copy, Trash2, Sparkles, ChevronLeft, ChevronRight, GripVertical, ImageIcon, BookOpen, FileCode, CheckCircle2, AlertCircle, Pencil, Maximize2, Minimize2, Eye, Code2, PackageOpen, MousePointer2, Tag } from 'lucide-react';
import { LsImportModal, type LsImportPayload } from './LsImportModal';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { AIImproveModal, type AIImproveContext } from './AIImproveModal';
import { ChangelogTab } from './ChangelogTab';
import CodeMirror from '@uiw/react-codemirror';
import { html as htmlLang } from '@codemirror/lang-html';
import { oneDark } from '@codemirror/theme-one-dark';


// ── Rich Feature type ─────────────────────────────────────────────────────────
export interface RichFeature {
  id: string;
  title: string;
  description: string;
  screenshots: string[];
  featured?: boolean;  // If true, show in showcase section with screenshots
}

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

// Helper function to create URL-friendly slug
const createSlug = (text: string): string => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/--+/g, '-') // Replace multiple hyphens with single
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing hyphens
};

// Neon palette for version accent colors
export const VERSION_COLORS = [
  '#a855f7', // purple
  '#06b6d4', // cyan
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ec4899', // pink
  '#3b82f6', // blue
  '#f43f5e', // rose
  '#84cc16', // lime
];

// Detect if a version is free: all prices empty
export const isVersionFree = (v: { lifetimePrice?: string; monthlyPrice?: string; yearlyPrice?: string }) =>
  !v.lifetimePrice?.trim() && !v.monthlyPrice?.trim() && !v.yearlyPrice?.trim();

// Common CTA icons available from lucide-react
export const CTA_ICON_OPTIONS = [
  'Download',
  'ShoppingCart',
  'Zap',
  'Star',
  'Sparkles',
  'ArrowRight',
  'ExternalLink',
  'Play',
  'Gift',
  'Package',
  'Heart',
  'Rocket',
];


interface ToolVersion {
  id: string;
  versionType: string;        // free-text name, e.g. "Starter", "Pro", "Agency"
  versionType_ar?: string;    // Arabic translation of version name
  versionType_fr?: string;    // French translation of version name
  color?: string;             // hex accent, e.g. '#a855f7'
  pricingModel: 'subscription' | 'lifetime';
  monthlyPrice?: string;
  yearlyPrice?: string;
  lifetimePrice?: string;
  lifetimeBuyUrl?: string;
  downloadUrl: string;
  lemonSqueezyVariantId?: string;
  lemonSqueezyProductId?: string;
  whatsIncluded?: string[];
  activationSteps?: string[];
  includedFeatureIds?: string[];  // IDs from tool.richFeatures that are included in this version
  demoUrl?: string;
  inheritanceLabelEnabled?: boolean;  // Show "Everything in X, plus:" label above features
  inheritanceLabel?: string;  // Template supports {{previousTier}}
  emptyDeltaMode?: 'message' | 'hide' | 'showAll' | 'deltaOnly';  // What to show when delta is empty
  emptyDeltaMessage?: string;  // Custom message when mode is 'message'
}

interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  toolCategory?: string;
  imageUrl: string;
  featured: boolean;
  slug?: string;
  tagline?: string;
  demoUrl?: string;
  systemRequirements?: string;
  howItWorks?: Array<{ title: string; description: string }>;
  faqs?: Array<{ question: string; answer: string }>;
  versions?: ToolVersion[];
  richFeatures?: RichFeature[];  // Tool-level feature pool
  // CTA customization
  freeCtaText?: string;       // Default: "Download Free"
  freeCtaIcon?: string;       // Default: "Download" - lucide icon name
  paidCtaText?: string;       // Default: "Buy Now" (pricing cards) / "View Pricing" (showcase)
  paidCtaIcon?: string;       // Default: "ShoppingCart"
  showcasePaidCtaText?: string; // Specific text for showcase section, default: "View Pricing"
}

// If a tool has no tool-level richFeatures yet but versions have old-style richFeatures,
// collect all unique features from versions into the tool-level pool (migration).
function migrateToolFeatures(tool: Tool): RichFeature[] {
  if ((tool.richFeatures ?? []).length > 0) return tool.richFeatures!;
  const seen = new Set<string>();
  const pool: RichFeature[] = [];
  for (const v of tool.versions ?? []) {
    for (const f of (v as any).richFeatures ?? []) {
      if (f.id && !seen.has(f.id)) { seen.add(f.id); pool.push(f); }
    }
  }
  return pool;
}

// For a version, derive includedFeatureIds from its old richFeatures if not already set.
function migrateVersion(v: ToolVersion, toolFeatures: RichFeature[]): ToolVersion {
  if ((v.includedFeatureIds ?? []).length > 0) return v;
  const oldRich: RichFeature[] = (v as any).richFeatures ?? [];
  if (oldRich.length === 0) {
    // No old data — default to all tool-level features included
    return { ...v, includedFeatureIds: toolFeatures.map(f => f.id) };
  }
  const oldIds = new Set(oldRich.map(f => f.id));
  return { ...v, includedFeatureIds: toolFeatures.filter(f => oldIds.has(f.id)).map(f => f.id) };
}

export function ToolFormNew({
  tool,
  onSave,
  onCancel,
  statuses,
  toolCategories = [],
}: {
  tool: Tool;
  onSave: (tool: Tool) => Promise<{ success: boolean; message: string }>;
  onCancel: () => void;
  statuses: string[];
  toolCategories?: string[];
}) {
  const [formData, setFormData] = useState({
    ...tool,
    name: tool.name || '',
    description: tool.description || '',
    category: tool.category || '',
    toolCategory: tool.toolCategory || '',
    imageUrl: tool.imageUrl || '',
    tagline: tool.tagline || '',
    demoUrl: tool.demoUrl || '',
    systemRequirements: tool.systemRequirements || '',
    slug: tool.slug || '',
    featured: tool.featured || false,
    howItWorks: tool.howItWorks || [],
    faqs: tool.faqs || [],
    versions: (tool.versions || []).map(v => migrateVersion(v, tool.richFeatures || [])),
    richFeatures: migrateToolFeatures(tool),
    freeCtaText: tool.freeCtaText || '',
    freeCtaIcon: tool.freeCtaIcon || '',
    paidCtaText: tool.paidCtaText || '',
    paidCtaIcon: tool.paidCtaIcon || '',
    showcasePaidCtaText: tool.showcasePaidCtaText || '',
  });
  const formDataRef = useRef(formData);
  formDataRef.current = formData;
  const [activeVersionTab, setActiveVersionTab] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [imageInputMode, setImageInputMode] = useState<'url' | 'upload'>('url');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [faqText, setFaqText] = useState('');
  const [howItWorksText, setHowItWorksText] = useState('');
  const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingVersionId, setGeneratingVersionId] = useState<string | null>(null);
  const [lsModalOpen, setLsModalOpen] = useState(false);
  const [versionTypeModalOpen, setVersionTypeModalOpen] = useState(false);
  // AI options (bulk)
  const [aiInstruction, setAiInstruction] = useState('');
  const [improveExisting, setImproveExisting] = useState(false);
  const [showAiOptions, setShowAiOptions] = useState(false);
  // Glow highlight for auto-filled fields
  const [highlightedFields, setHighlightedFields] = useState<Set<string>>(new Set());
  // User guide upload state
  const [guideExists, setGuideExists]     = useState(false);
  const [guideUploading, setGuideUploading] = useState(false);
  const [guideDeleting, setGuideDeleting]   = useState(false);
  const [guideMsg, setGuideMsg]             = useState<{ type: 'ok' | 'err'; text: string } | null>(null);
  // Generate guide from template
  const [guideGenerating, setGuideGenerating] = useState(false);
  const [guideGenSourceHtml, setGuideGenSourceHtml] = useState<string | null>(null);
  const [guideGenFileName, setGuideGenFileName] = useState<string | null>(null);

  // Inline guide editor
  const [guideEditorOpen, setGuideEditorOpen]     = useState(false);
  const [guideEditorHtml, setGuideEditorHtml]     = useState('');
  const [guideEditorLoading, setGuideEditorLoading] = useState(false);
  const [guideEditorSaving, setGuideEditorSaving]   = useState(false);
  const [guideEditorExpanded, setGuideEditorExpanded] = useState(false);
  const [guideEditorTab, setGuideEditorTab] = useState<'edit' | 'preview'>('edit');
  // Per-field AI improve modal
  const [aiModal, setAiModal] = useState<null | {
    fieldLabel: string; fieldKey: string; currentValue: string;
    context: AIImproveContext; onApply: (v: string) => void;
  }>(null);

  const openToolAiModal = (
    fieldKey: string, fieldLabel: string, currentValue: string,
    onApply: (v: string) => void,
    versionType?: string,
    pricingModel?: string,
  ) => {
    setAiModal({
      fieldKey, fieldLabel, currentValue,
      context: {
        entityType: 'tool',
        name: formData.name,
        category: formData.toolCategory || formData.category,
        description: formData.description,
        ...(versionType ? { versionType } : {}),
        ...(pricingModel ? { pricingModel } : {}),
      },
      onApply,
    });
  };

  // Initialize FAQ text
  useEffect(() => {
    const initialText = (tool.faqs || []).length === 0 ? 'Q: ' : (tool.faqs || []).map(faq => {
      const question = faq.question.trim();
      const answer = faq.answer.trim();
      return `Q: ${question}\nA: ${answer}`;
    }).join('\n\n');
    setFaqText(initialText);
  }, [tool]);

  // Initialize How It Works text — separate state avoids cursor-jump from inline value recomputation
  const howItWorksToText = (steps: Array<{ title: string; description: string }>) =>
    steps.map((step, idx) => {
      const title = step.title.trim();
      const hasStepPrefix = /^Step \d+:/.test(title);
      const displayTitle = hasStepPrefix ? title : (title ? `Step ${idx + 1}: ${title}` : `Step ${idx + 1}:`);
      return `${displayTitle} | ${step.description}`;
    }).join('\n');

  useEffect(() => {
    const steps = tool.howItWorks || [];
    setHowItWorksText(steps.length === 0 ? '' : howItWorksToText(steps));
  }, [tool]);

  // Set first version as active if exists
  useEffect(() => {
    if (formData.versions && formData.versions.length > 0 && !activeVersionTab) {
      setActiveVersionTab(formData.versions[0].id);
    }
  }, [formData.versions]);

  // Check whether a guide is already uploaded for this tool
  useEffect(() => {
    const slug = tool.slug;
    setGuideMsg(null); // clear any stale message from a previous session
    if (!slug) return;
    fetch(`${API_BASE}/tools/${encodeURIComponent(slug)}/guide-exists`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` },
    })
      .then(r => r.json())
      .then(d => setGuideExists(!!d.exists))
      .catch(() => setGuideExists(false));
  }, [tool.slug]);

  // ── Guide handlers ──────────────────────────────────────────────────────────

  const handleGenerateGuide = async () => {
    const slug = formData.slug || tool.slug;
    const id   = tool.id;
    if (!slug || !id) {
      setGuideMsg({ type: 'err', text: 'Save the tool first before generating a guide.' });
      return;
    }
    setGuideGenerating(true);
    setGuideMsg(null);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/tools/${id}/generate-guide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Admin-Token': token || '',
        },
        body: JSON.stringify({ slug, sourceHtml: guideGenSourceHtml || undefined }),
      });
      const data = await res.json();
      if (data.success) {
        setGuideExists(true);
        setGuideGenSourceHtml(null);
        setGuideGenFileName(null);
        setGuideMsg({ type: 'ok', text: 'Guide generated and saved successfully.' });
      } else {
        setGuideMsg({ type: 'err', text: data.error || 'Generation failed.' });
      }
    } catch (err: any) {
      setGuideMsg({ type: 'err', text: err.message || 'Network error.' });
    } finally {
      setGuideGenerating(false);
    }
  };

  const handleGuideUpload = async (file: File) => {
    const slug = formData.slug || tool.slug;
    const id   = tool.id;
    if (!slug || !id) {
      setGuideMsg({ type: 'err', text: 'Save the tool first to upload a guide.' });
      return;
    }
    setGuideUploading(true);
    setGuideMsg(null);
    try {
      const html = await file.text();
      const adminToken = localStorage.getItem('admin_token') ?? '';
      const res = await fetch(`${API_BASE}/tools/${id}/guide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
          'X-Admin-Token': adminToken,
        },
        body: JSON.stringify({ html, slug }),
      });
      const data = await res.json();
      if (data.success) {
        setGuideExists(true);
        setGuideMsg({ type: 'ok', text: 'Guide uploaded.' });
      } else {
        setGuideMsg({ type: 'err', text: data.error ?? 'Upload failed.' });
      }
    } catch (err) {
      setGuideMsg({ type: 'err', text: `Upload error: ${String(err)}` });
    } finally {
      setGuideUploading(false);
    }
  };

  const handleGuideDelete = async () => {
    const slug = formData.slug || tool.slug;
    const id   = tool.id;
    if (!slug || !id) return;
    if (!window.confirm('Delete the uploaded guide for this tool?')) return;
    setGuideDeleting(true);
    setGuideMsg(null);
    try {
      const adminToken = localStorage.getItem('admin_token') ?? '';
      const res = await fetch(`${API_BASE}/tools/${id}/guide?slug=${encodeURIComponent(slug)}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'X-Admin-Token': adminToken,
        },
      });
      const data = await res.json();
      if (data.success) {
        setGuideExists(false);
        setGuideMsg({ type: 'ok', text: 'Guide deleted.' });
      } else {
        setGuideMsg({ type: 'err', text: data.error ?? 'Delete failed.' });
      }
    } catch (err) {
      setGuideMsg({ type: 'err', text: `Delete error: ${String(err)}` });
    } finally {
      setGuideDeleting(false);
    }
  };

  // Open the inline HTML editor — fetch current content from server
  const handleOpenGuideEditor = async () => {
    const slug = formData.slug || tool.slug;
    if (!slug) return;
    setGuideEditorOpen(true);
    setGuideEditorLoading(true);
    setGuideMsg(null);
    try {
      const res = await fetch(`${API_BASE}/tools/${encodeURIComponent(slug)}/guide-html`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      const data = await res.json();
      if (data.success) {
        setGuideEditorHtml(data.html ?? '');
      } else {
        setGuideEditorHtml('');
        setGuideMsg({ type: 'err', text: data.error ?? 'Could not load guide.' });
      }
    } catch (err) {
      setGuideMsg({ type: 'err', text: `Load error: ${String(err)}` });
    } finally {
      setGuideEditorLoading(false);
    }
  };

  // Save edited HTML back via the existing POST route
  const handleSaveGuideEditor = async () => {
    const slug = formData.slug || tool.slug;
    const id   = tool.id;
    if (!slug || !id) return;
    setGuideEditorSaving(true);
    setGuideMsg(null);
    try {
      const adminToken = localStorage.getItem('admin_token') ?? '';
      const res = await fetch(`${API_BASE}/tools/${id}/guide`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
          'X-Admin-Token': adminToken,
        },
        body: JSON.stringify({ html: guideEditorHtml, slug }),
      });
      const data = await res.json();
      if (data.success) {
        setGuideExists(true);
        setGuideMsg({ type: 'ok', text: 'Guide saved successfully.' });
      } else {
        setGuideMsg({ type: 'err', text: data.error ?? 'Save failed.' });
      }
    } catch (err) {
      setGuideMsg({ type: 'err', text: `Save error: ${String(err)}` });
    } finally {
      setGuideEditorSaving(false);
    }
  };

  const parseFaqText = (text: string) => {
    const lines = text.split('\n');
    const faqs: Array<{ question: string; answer: string }> = [];
    let currentQuestion = '';
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (trimmedLine.startsWith('Q:')) {
        if (currentQuestion) {
          faqs.push({ question: currentQuestion, answer: '' });
        }
        currentQuestion = trimmedLine.replace(/^Q:\s*/, '');
      } else if (trimmedLine.startsWith('A:')) {
        const answer = trimmedLine.replace(/^A:\s*/, '');
        if (currentQuestion) {
          faqs.push({ question: currentQuestion, answer });
          currentQuestion = '';
        }
      } else if (trimmedLine === '') {
        if (currentQuestion) {
          faqs.push({ question: currentQuestion, answer: '' });
          currentQuestion = '';
        }
      } else {
        if (faqs.length > 0 && !currentQuestion) {
          faqs[faqs.length - 1].answer += ' ' + trimmedLine;
        } else {
          currentQuestion += ' ' + trimmedLine;
        }
      }
    }
    
    if (currentQuestion) {
      faqs.push({ question: currentQuestion, answer: '' });
    }
    
    return faqs;
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadSuccess(false);
    setErrors(prev => ({ ...prev, imageUpload: '' }));
    
    try {
      const token = localStorage.getItem('admin_token');
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const response = await fetch(`${API_BASE}/upload-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Admin-Token': token || '',
        },
        body: uploadFormData,
      });

      const result = await response.json();
      if (result.success) {
        setFormData(prev => ({ ...prev, imageUrl: result.data.url }));
        setErrors(prev => ({ ...prev, imageUpload: '', imageUrl: '' }));
        setUploadSuccess(true);
      } else {
        setErrors(prev => ({ ...prev, imageUpload: `Upload failed: ${result.error}` }));
      }
    } catch (error) {
      console.error('Upload error:', error);
      setErrors(prev => ({ ...prev, imageUpload: 'Failed to upload image. Please try again.' }));
    } finally {
      setUploading(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.name.trim()) {
      newErrors.name = 'Tool name is required';
    }
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    }
    if (!formData.imageUrl.trim()) {
      newErrors.imageUrl = 'Image is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Highlight fields that were just auto-filled, then fade after 3.5 s
  const applyHighlight = (fields: string[]) => {
    if (fields.length === 0) return;
    setHighlightedFields(new Set(fields));
    setTimeout(() => setHighlightedFields(new Set()), 3500);
  };

  const hlClass = (key: string) =>
    highlightedFields.has(key)
      ? 'ring-2 ring-purple-400/70 shadow-[0_0_14px_rgba(192,132,252,0.45)]'
      : '';

  const fetchWithRetry = async (url: string, options: RequestInit, retries = 1): Promise<Response> => {
    try {
      return await fetch(url, options);
    } catch (err) {
      if (retries > 0) {
        console.warn('Fetch failed, retrying in 2 s…', err);
        await new Promise(resolve => setTimeout(resolve, 2000));
        return fetchWithRetry(url, options, retries - 1);
      }
      throw err;
    }
  };

  const handleAutoFill = async () => {
    if (!formData.name.trim()) {
      setFormMessage({ type: 'error', text: 'Enter a tool name first so the AI knows what to generate.' });
      return;
    }
    setGenerating(true);
    setFormMessage(null);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetchWithRetry(`${API_BASE}/admin/generate-tool-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Admin-Token': token || '',
        },
        body: JSON.stringify({
          tool: {
            name: formData.name,
            category: formData.category,
            description: formData.description,
            tagline: formData.tagline,
            systemRequirements: formData.systemRequirements,
            howItWorks: formData.howItWorks,
            faqs: formData.faqs,
          },
          versions: (formData.versions || []).map(v => ({
            id: v.id,
            versionType: v.versionType,
            whatsIncluded: v.whatsIncluded,
            activationSteps: v.activationSteps,
          })),
          instruction: aiInstruction,
          improveExisting,
        }),
      });

      const result = await response.json();

      if (!result.success) {
        console.error('Auto-fill error:', result.error);
        setFormMessage({ type: 'error', text: result.error || 'Failed to generate content.' });
        return;
      }

      if (result.nothingToGenerate) {
        setFormMessage({ type: 'success', text: '✨ All fields are already filled — nothing to generate.' });
        return;
      }

      const data = result.data;
      const updates: Partial<typeof formData> = {};
      const changedFields: string[] = [];

      // Tool-level fields — fill empty ones, or rewrite all if improveExisting
      if (data.description && (improveExisting || !formData.description.trim())) {
        updates.description = String(data.description).slice(0, 250);
        changedFields.push('description');
      }
      if (data.tagline && (improveExisting || !formData.tagline?.trim())) {
        updates.tagline = data.tagline;
        changedFields.push('tagline');
      }
      if (data.systemRequirements && (improveExisting || !formData.systemRequirements?.trim())) {
        updates.systemRequirements = data.systemRequirements;
        changedFields.push('systemRequirements');
      }

      const hiwEmpty = !formData.howItWorks || formData.howItWorks.length === 0 ||
        formData.howItWorks.every(s => !s.title?.trim() && !s.description?.trim());
      if (data.howItWorks && (improveExisting || hiwEmpty)) {
        updates.howItWorks = data.howItWorks;
        changedFields.push('howItWorks');
      }

      const faqsEmpty = !formData.faqs || formData.faqs.length === 0 ||
        formData.faqs.every(f => !f.question?.trim());
      if (data.faqs && (improveExisting || faqsEmpty)) {
        updates.faqs = data.faqs;
        changedFields.push('faqs');
        const newFaqText = data.faqs
          .map((faq: { question: string; answer: string }) => `Q: ${faq.question}\nA: ${faq.answer}`)
          .join('\n\n');
        setFaqText(newFaqText);
      }

      if (data.howItWorks && (improveExisting || hiwEmpty)) {
        // Sync the howItWorksText state so the textarea displays the new content
        setHowItWorksText(howItWorksToText(data.howItWorks));
      }

      // Version-level fields
      if (data.versions && Array.isArray(data.versions)) {
        const updatedVersions = (formData.versions || []).map(v => {
          const gv = data.versions.find((x: any) => x.id === v.id);
          if (!gv) return v;
          const vUpdates: Partial<ToolVersion> = {};
          if (gv.whatsIncluded && (improveExisting || !v.whatsIncluded || v.whatsIncluded.filter((f: string) => f.trim()).length === 0)) {
            vUpdates.whatsIncluded = gv.whatsIncluded;
            changedFields.push(`${v.id}:whatsIncluded`);
          }
          if (gv.activationSteps && (improveExisting || !v.activationSteps || v.activationSteps.filter((s: string) => s.trim()).length === 0)) {
            vUpdates.activationSteps = gv.activationSteps;
            changedFields.push(`${v.id}:activationSteps`);
          }
          return { ...v, ...vUpdates };
        });
        updates.versions = updatedVersions;
      }

      setFormData(prev => ({ ...prev, ...updates }));
      applyHighlight(changedFields);
      const modeLabel = improveExisting ? 'Content rewritten' : 'Content generated';
      setFormMessage({ type: 'success', text: `✨ ${modeLabel}! Review each field and adjust as needed.` });
    } catch (err) {
      console.warn('Auto-fill failed after retry:', err);
      setFormMessage({ type: 'error', text: 'Could not reach the server. The service may be starting up — please wait a moment and try again.' });
    } finally {
      setGenerating(false);
    }
  };

  // Regenerate only one version's AI content independently
  const handleRegenerateVersion = async (versionId: string) => {
    const version = formData.versions?.find(v => v.id === versionId);
    if (!version) return;
    setGeneratingVersionId(versionId);
    setFormMessage(null);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetchWithRetry(`${API_BASE}/admin/generate-tool-content`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Admin-Token': token || '',
        },
        body: JSON.stringify({
          tool: {
            name: formData.name,
            category: formData.category,
            description: formData.description,
            tagline: formData.tagline,
          },
          versions: [{
            id: version.id,
            versionType: version.versionType,
            whatsIncluded: version.whatsIncluded,
            activationSteps: version.activationSteps,
          }],
          instruction: aiInstruction,
          improveExisting: true, // per-version regen always rewrites
        }),
      });

      const result = await response.json();
      if (!result.success) {
        setFormMessage({ type: 'error', text: result.error || 'Version regeneration failed.' });
        return;
      }

      const gv = result.data?.versions?.find((x: any) => x.id === versionId);
      if (gv) {
        const vUpdates: Partial<ToolVersion> = {};
        const changedFields: string[] = [];
        if (gv.whatsIncluded)   { vUpdates.whatsIncluded   = gv.whatsIncluded;   changedFields.push(`${versionId}:whatsIncluded`); }
        if (gv.activationSteps) { vUpdates.activationSteps = gv.activationSteps; changedFields.push(`${versionId}:activationSteps`); }
        updateVersion(versionId, vUpdates);
        applyHighlight(changedFields);
        setFormMessage({ type: 'success', text: `✨ ${version.versionType} version regenerated!` });
      }
    } catch (err) {
      console.warn('Version regeneration failed:', err);
      setFormMessage({ type: 'error', text: 'Could not reach the server. Please try again.' });
    } finally {
      setGeneratingVersionId(null);
    }
  };

  const handleSave = async () => {
    if (validateForm()) {
      setSaving(true);
      setFormMessage(null);
      const latest = formDataRef.current;
      const cleanedData = {
        ...latest,
        faqs: (latest.faqs || []).filter(faq => faq.question || faq.answer),
        richFeatures: (latest.richFeatures || []).map((f: RichFeature) => ({
          ...f,
          screenshots: (f.screenshots || []).filter(Boolean),
        })),
      };
      const result = await onSave(cleanedData);
      setSaving(false);
      setFormMessage({ type: result.success ? 'success' : 'error', text: result.message });
      if (result.success) {
        setTimeout(() => onCancel(), 1500);
      }
    } else {
      setFormMessage({ type: 'error', text: 'Please fix the validation errors before saving.' });
    }
  };

  const addVersion = (overrides: Partial<ToolVersion> = {}) => {
    const existingCount = formData.versions?.length ?? 0;
    const newVersion: ToolVersion = {
      id: `version-${Date.now()}`,
      versionType: `Version ${existingCount + 1}`,
      color: VERSION_COLORS[existingCount % VERSION_COLORS.length],
      pricingModel: 'lifetime',
      downloadUrl: '',
      lemonSqueezyVariantId: '',
      lemonSqueezyProductId: '',
      whatsIncluded: [],
      activationSteps: [],
      includedFeatureIds: [],
      demoUrl: '',
      monthlyPrice: '',
      yearlyPrice: '',
      lifetimePrice: '',
      lifetimeBuyUrl: '',
      ...overrides,
    };

    const updatedVersions = [...(formData.versions || []), newVersion];
    setFormData(prev => ({ ...prev, versions: updatedVersions }));
    setActiveVersionTab(newVersion.id);
  };

  const addVersionByType = (type: 'subscription' | 'lifetime' | 'free') => {
    const existingCount = formData.versions?.length ?? 0;
    
    if (type === 'free') {
      addVersion({
        versionType: 'Free',
        pricingModel: 'lifetime',
        monthlyPrice: '',
        yearlyPrice: '',
        lifetimePrice: '',
      });
    } else if (type === 'subscription') {
      addVersion({
        versionType: `Pro ${existingCount + 1}`,
        pricingModel: 'subscription',
        monthlyPrice: '9.99',
        yearlyPrice: '99.99',
        lifetimePrice: '',
      });
    } else {
      addVersion({
        versionType: `Version ${existingCount + 1}`,
        pricingModel: 'lifetime',
        monthlyPrice: '',
        yearlyPrice: '',
        lifetimePrice: '49.99',
      });
    }
    
    setVersionTypeModalOpen(false);
  };

  const duplicateVersion = (versionId: string) => {
    const sourceVersion = formData.versions?.find(v => v.id === versionId);
    if (!sourceVersion) return;
    const existingCount = formData.versions?.length ?? 0;
    const newVersion: ToolVersion = {
      ...sourceVersion,
      id: `version-${Date.now()}`,
      versionType: `${sourceVersion.versionType} (copy)`,
      color: VERSION_COLORS[existingCount % VERSION_COLORS.length],
    };
    const updatedVersions = [...(formData.versions || []), newVersion];
    setFormData(prev => ({ ...prev, versions: updatedVersions }));
    setActiveVersionTab(newVersion.id);
  };

  const handleLsImport = (payload: LsImportPayload) => {
    addVersion({
      versionType:           payload.versionName,
      pricingModel:          payload.pricingModel,
      monthlyPrice:          payload.monthlyPrice ?? '',
      yearlyPrice:           payload.yearlyPrice  ?? '',
      lifetimePrice:         payload.lifetimePrice ?? '',
      lifetimeBuyUrl:        payload.buyNowUrl,
      downloadUrl:           payload.buyNowUrl,
      lemonSqueezyVariantId: payload.variantId,
      lemonSqueezyProductId: payload.productId,
    });
  };

  const handleLsImportAll = (payloads: LsImportPayload[]) => {
    const base = formData.versions || [];
    const newVersions: ToolVersion[] = payloads.map((p, i) => ({
      id: `version-${Date.now()}-${i}`,
      versionType:           p.versionName,
      pricingModel:          p.pricingModel,
      color:                 VERSION_COLORS[(base.length + i) % VERSION_COLORS.length],
      monthlyPrice:          p.monthlyPrice  ?? '',
      yearlyPrice:           p.yearlyPrice   ?? '',
      lifetimePrice:         p.lifetimePrice ?? '',
      lifetimeBuyUrl:        p.buyNowUrl,
      downloadUrl:           p.buyNowUrl,
      lemonSqueezyVariantId: p.variantId,
      lemonSqueezyProductId: p.productId,
      whatsIncluded:         [],
      activationSteps:       [],
      includedFeatureIds:    [],
      demoUrl:               '',
    }));
    const updated = [...base, ...newVersions];
    setFormData(prev => ({ ...prev, versions: updated }));
    if (newVersions.length > 0) setActiveVersionTab(newVersions[newVersions.length - 1].id);
  };

  const deleteVersion = (versionId: string) => {
    if (!confirm('Are you sure you want to delete this version?')) return;

    const updatedVersions = (formData.versions || []).filter(v => v.id !== versionId);
    setFormData(prev => ({ ...prev, versions: updatedVersions }));

    // Set active tab to first version if current was deleted
    if (activeVersionTab === versionId && updatedVersions.length > 0) {
      setActiveVersionTab(updatedVersions[0].id);
    }
  };

  const updateVersion = (versionId: string, updates: Partial<ToolVersion>) => {
    setFormData(prev => ({
      ...prev,
      versions: (prev.versions || []).map(v =>
        v.id === versionId ? { ...v, ...updates } : v
      ),
    }));
  };

  const reorderVersion = (versionId: string, direction: 'left' | 'right') => {
    // Use the functional-updater form so we always read the latest state and
    // never overwrite concurrent updates (e.g. a field edit in VersionEditor).
    setFormData(prev => {
      const versions = [...(prev.versions || [])];
      const idx = versions.findIndex(v => v.id === versionId);
      if (idx === -1) return prev;
      const target = direction === 'left' ? idx - 1 : idx + 1;
      if (target < 0 || target >= versions.length) return prev;
      [versions[idx], versions[target]] = [versions[target], versions[idx]];
      return { ...prev, versions };
    });
  };

  const currentVersion = formData.versions?.find(v => v.id === activeVersionTab);

  return (
    <div className="mb-6 p-6 bg-white/10 rounded-lg border border-white/20">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-bold text-white">
            {tool.name ? 'Edit Tool' : 'New Tool'}
          </h3>
          <div className="flex items-center gap-2">
            {/* AI Options toggle */}
            <button
              type="button"
              onClick={() => setShowAiOptions(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-purple-300 bg-purple-500/10 border border-purple-400/20 hover:bg-purple-500/20 transition-all duration-150 select-none"
              title="Configure AI options"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              AI Options {showAiOptions ? '▲' : '▼'}
            </button>
            {/* Main auto-fill button */}
            <button
              type="button"
              onClick={handleAutoFill}
              disabled={generating || !formData.name.trim()}
              title={!formData.name.trim() ? 'Enter a tool name first' : improveExisting ? 'Rewrite all fields with Gemini AI' : 'Auto-fill empty fields using Gemini AI'}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 select-none
                disabled:opacity-40 disabled:cursor-not-allowed
                ${generating
                  ? 'bg-purple-500/20 border border-purple-400/40 text-purple-300 cursor-wait'
                  : 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-fuchsia-500 border border-purple-400/30 text-white shadow-lg shadow-purple-900/40 hover:shadow-purple-500/30 active:scale-95'
                }`}
            >
              {generating ? (
                <>
                  <svg className="w-4 h-4 animate-spin text-purple-300" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>{improveExisting ? 'Rewriting…' : 'Generating…'}</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>{improveExisting ? 'Rewrite with AI' : 'Auto-fill with AI'}</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* AI Options panel */}
        {showAiOptions && (
          <div className="p-4 bg-purple-950/40 border border-purple-500/20 rounded-xl space-y-3">
            <div>
              <label className="block text-xs font-semibold text-purple-300 mb-1.5 uppercase tracking-wide">
                Instructions for AI <span className="text-purple-400/50 normal-case font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={aiInstruction}
                onChange={e => setAiInstruction(e.target.value)}
                placeholder='e.g. "Make it sound more premium · Focus on After Effects power users · Shorter description"'
                className="w-full px-3 py-2 bg-black/40 border border-purple-400/20 rounded-lg text-white text-sm placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-purple-400/50"
              />
              <p className="text-xs text-white/30 mt-1">Gemini will use this to guide tone, focus, and style for all generated content.</p>
            </div>
            <label className="flex items-center gap-3 cursor-pointer select-none group">
              <div
                onClick={() => setImproveExisting(v => !v)}
                className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${improveExisting ? 'bg-purple-500' : 'bg-white/10'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${improveExisting ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
              <div>
                <span className="text-sm text-white font-medium">Rewrite existing content</span>
                <p className="text-xs text-white/40">When on, Gemini rewrites ALL fields — not just empty ones. Great for tone changes.</p>
              </div>
            </label>
          </div>
        )}
      </div>

      {/* TOOL-WIDE FIELDS */}
      <div className="space-y-6 mb-8 pb-8 border-b border-white/20">
        <h4 className="text-lg font-semibold text-white">General Information</h4>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Tool Name *
          </label>
          <Input
            placeholder="Enter tool name"
            value={formData.name}
            onChange={(e) => {
              const name = e.target.value;
              const slug = createSlug(name);
              setFormData(prev => ({ ...prev, name, slug }));
              setErrors(prev => ({ ...prev, name: '' }));
            }}
            className={`bg-black/50 border-white/20 text-white ${errors.name ? 'border-red-500' : ''}`}
          />
          {errors.name && (
            <p className="text-red-400 text-sm mt-1">{errors.name}</p>
          )}
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-300">Description *</label>
            <button type="button" onClick={() => openToolAiModal('description', 'Description', formData.description || '', (v) => { setFormData(prev => ({ ...prev, description: v.slice(0, 250) })); setErrors(prev => ({ ...prev, description: '' })); }))} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-400/15 transition-all duration-150"><Sparkles className="w-3 h-3" />Improve</button>
          </div>
          <div className="relative">
            <Textarea
              placeholder="Describe what this tool does"
              value={formData.description}
              onChange={(e) => {
                if (e.target.value.length <= 250) {
                  setFormData(prev => ({ ...prev, description: e.target.value }));
                  setErrors(prev => ({ ...prev, description: '' }));
                }
              }}
              onPaste={(e) => {
                const pastedText = e.clipboardData.getData('text');
                const currentText = formData.description || '';
                const textarea = e.currentTarget;
                const start = textarea.selectionStart || 0;
                const end = textarea.selectionEnd || 0;
                
                // Calculate the new text after paste
                const beforeCursor = currentText.substring(0, start);
                const afterCursor = currentText.substring(end);
                let newText = beforeCursor + pastedText + afterCursor;
                
                // Truncate if needed
                if (newText.length > 250) {
                  newText = newText.substring(0, 250);
                  e.preventDefault();
                  setFormData(prev => ({ ...prev, description: newText }));
                  setErrors(prev => ({ ...prev, description: '' }));
                  
                  // Set cursor position
                  setTimeout(() => {
                    const newCursorPos = Math.min(start + pastedText.length, 250);
                    textarea.setSelectionRange(newCursorPos, newCursorPos);
                  }, 0);
                }
              }}
              className={`bg-black/50 border-white/20 text-white transition-all duration-700 ${errors.description ? 'border-red-500' : ''} ${hlClass('description')}`}
              rows={3}
            />
            <span className={`absolute bottom-2 right-3 text-xs tabular-nums pointer-events-none transition-colors ${
              (formData.description?.length ?? 0) >= 230
                ? 'text-amber-400'
                : 'text-white/25'
            }`}>
              {formData.description?.length ?? 0}/250
            </span>
          </div>
          {errors.description && (
            <p className="text-red-400 text-sm mt-1">{errors.description}</p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Status
            </label>
            <AdminSelect
              value={formData.category}
              onChange={(v) => setFormData(prev => ({ ...prev, category: v }))}
              options={statuses.map((s) => ({ value: s, label: s }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Tool Category
            </label>
            <AdminSelect
              value={formData.toolCategory}
              onChange={(v) => setFormData(prev => ({ ...prev, toolCategory: v }))}
              options={[
                { value: '', label: '— None —' },
                ...toolCategories.map((c) => ({ value: c, label: c })),
              ]}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              URL Slug (auto-generated)
            </label>
            <Input
              placeholder="tool-slug"
              value={formData.slug || ''}
              onChange={(e) => setFormData(prev => ({ ...prev, slug: e.target.value }))}
              className="bg-black/50 border-white/20 text-white"
            />
            <p className="text-xs text-white/40 mt-1">Used in URL: /tools/{formData.slug || 'tool-name'}</p>
          </div>
        </div>

        {/* Tool Image */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Tool Image *
          </label>
          <div className="flex gap-2 mb-2">
            <button
              type="button"
              onClick={() => setImageInputMode('url')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                imageInputMode === 'url'
                  ? 'bg-purple-500 text-white'
                  : 'bg-white/10 text-gray-400 hover:bg-white/20'
              }`}
            >
              Paste URL
            </button>
            <button
              type="button"
              onClick={() => setImageInputMode('upload')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                imageInputMode === 'upload'
                  ? 'bg-purple-500 text-white'
                  : 'bg-white/10 text-gray-400 hover:bg-white/20'
              }`}
            >
              Upload File
            </button>
          </div>
          
          {imageInputMode === 'url' ? (
            <div>
              <Input
                placeholder="Image URL"
                value={formData.imageUrl}
                onChange={(e) => {
                  setFormData(prev => ({ ...prev, imageUrl: e.target.value }));
                  setErrors(prev => ({ ...prev, imageUrl: '' }));
                }}
                className={`bg-black/50 border-white/20 text-white ${errors.imageUrl ? 'border-red-500' : ''}`}
              />
              {errors.imageUrl && (
                <p className="text-red-400 text-sm mt-1">{errors.imageUrl}</p>
              )}
            </div>
          ) : (
            <div>
              <Button
                type="button"
                onClick={() => document.getElementById('toolImageUpload')?.click()}
                disabled={uploading}
                className="cursor-pointer bg-white/10 hover:bg-white/20 text-white"
              >
                {uploading ? (
                  <>Uploading...</>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Choose Image to Upload
                  </>
                )}
              </Button>
              <input
                type="file"
                id="toolImageUpload"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              {uploadSuccess && !errors.imageUpload && (
                <p className="text-xs text-green-400 mt-2">✓ Image uploaded successfully</p>
              )}
              {errors.imageUpload && (
                <p className="text-red-400 text-sm mt-1">{errors.imageUpload}</p>
              )}
            </div>
          )}
        </div>

        {/* FAQs (tool-wide) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-300">FAQs <span className="text-white/30 font-normal">(applies to all versions)</span></label>
            <button type="button" onClick={() => openToolAiModal('faqs', 'FAQs', faqText, (v) => { setFaqText(v); setFormData(prev => ({ ...prev, faqs: parseFaqText(v) })); }))} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-400/15 transition-all duration-150"><Sparkles className="w-3 h-3" />Improve</button>
          </div>
          <Textarea
            placeholder="Q: Does it work with CC 2024?&#10;A: Yes, fully compatible with After Effects 2022-2024.&#10;&#10;Q: Can I use it for commercial projects?&#10;A: Absolutely. One license covers all your commercial work."
            value={faqText}
            onChange={(e) => setFaqText(e.target.value)}
            onBlur={() => {
              const faqs = parseFaqText(faqText);
              setFormData(prev => ({ ...prev, faqs }));
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const textarea = e.currentTarget;
                const cursorPos = textarea.selectionStart;
                const currentValue = textarea.value;
                const beforeCursor = currentValue.substring(0, cursorPos);
                const afterCursor = currentValue.substring(cursorPos);
                const lines = beforeCursor.split('\n');
                const currentLine = lines[lines.length - 1];
                const trimmedLine = currentLine.trim();
                
                if (trimmedLine.startsWith('Q:') && trimmedLine.length > 2) {
                  e.preventDefault();
                  const newValue = beforeCursor + '\nA: ' + afterCursor;
                  setFaqText(newValue);
                  setTimeout(() => {
                    textarea.selectionStart = textarea.selectionEnd = cursorPos + 4;
                  }, 0);
                } else if (trimmedLine.startsWith('A:')) {
                  e.preventDefault();
                  const newValue = beforeCursor + '\n\nQ: ' + afterCursor;
                  setFaqText(newValue);
                  setTimeout(() => {
                    textarea.selectionStart = textarea.selectionEnd = cursorPos + 5;
                  }, 0);
                }
              }
            }}
            className={`bg-black/50 border-white/20 text-white transition-all duration-700 ${hlClass('faqs')}`}
            rows={6}
          />
          <p className="text-xs text-white/40 mt-1">Type question after "Q:", press Enter → goes to "A:", type answer, press Enter → new "Q:"</p>
        </div>

        {/* Tagline (tool-wide) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-300">Tagline <span className="text-white/30 font-normal">(applies to all versions)</span></label>
            <button type="button" onClick={() => openToolAiModal('tagline', 'Tagline', formData.tagline || '', (v) => setFormData(prev => ({ ...prev, tagline: v })))} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-400/15 transition-all duration-150"><Sparkles className="w-3 h-3" />Improve</button>
          </div>
          <Input
            placeholder="Perfect for freelancers and small studios"
            value={formData.tagline || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, tagline: e.target.value }))}
            className={`bg-black/50 border-white/20 text-white transition-all duration-700 ${hlClass('tagline')}`}
          />
        </div>

        {/* System Requirements (tool-wide) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-300">System Requirements <span className="text-white/30 font-normal">(applies to all versions)</span></label>
            <button type="button" onClick={() => openToolAiModal('systemRequirements', 'System Requirements', formData.systemRequirements || '', (v) => setFormData(prev => ({ ...prev, systemRequirements: v })))} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-400/15 transition-all duration-150"><Sparkles className="w-3 h-3" />Improve</button>
          </div>
          <Textarea
            placeholder="After Effects 2022 or later, macOS 11+ or Windows 10+"
            value={formData.systemRequirements || ''}
            onChange={(e) => setFormData(prev => ({ ...prev, systemRequirements: e.target.value }))}
            className={`bg-black/50 border-white/20 text-white transition-all duration-700 ${hlClass('systemRequirements')}`}
            rows={3}
          />
        </div>

        {/* CTA Customization */}
        <div className="space-y-4 p-4 rounded-xl bg-purple-500/5 border border-purple-500/20">
          <div className="flex items-center gap-2.5 mb-1">
            <MousePointer2 className="w-4 h-4 text-purple-400" />
            <h4 className="text-sm font-semibold text-white">CTA Button Customization</h4>
            <span className="text-[10px] text-white/40">(applies to all detail page CTAs)</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Free Version CTA */}
            <div className="space-y-3 p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/15">
              <div className="text-xs font-semibold text-emerald-300 uppercase tracking-wider">Free Version</div>
              
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Button Text</label>
                <Input
                  placeholder="Download Free"
                  value={formData.freeCtaText || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, freeCtaText: e.target.value }))}
                  className="bg-black/30 border-emerald-500/20 text-white text-sm"
                />
                <p className="text-[10px] text-white/30 mt-1">Leave empty to use default</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Icon</label>
                <IconPicker
                  value={formData.freeCtaIcon || ''}
                  onChange={(v) => setFormData(prev => ({ ...prev, freeCtaIcon: v }))}
                  iconOptions={CTA_ICON_OPTIONS}
                  placeholder="Download (default)"
                  defaultIcon="Download"
                  className="bg-black/30 border-emerald-500/20"
                />
                <p className="text-[10px] text-white/30 mt-1">Click to see icon grid</p>
              </div>
            </div>

            {/* Paid Version CTA */}
            <div className="space-y-3 p-3 rounded-lg bg-purple-500/5 border border-purple-500/15">
              <div className="text-xs font-semibold text-purple-300 uppercase tracking-wider">Paid Version</div>
              
              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Pricing Card Button Text</label>
                <Input
                  placeholder="Buy Now"
                  value={formData.paidCtaText || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, paidCtaText: e.target.value }))}
                  className="bg-black/30 border-purple-500/20 text-white text-sm"
                />
                <p className="text-[10px] text-white/30 mt-1">For pricing cards</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Showcase Button Text</label>
                <Input
                  placeholder="View Pricing"
                  value={formData.showcasePaidCtaText || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, showcasePaidCtaText: e.target.value }))}
                  className="bg-black/30 border-purple-500/20 text-white text-sm"
                />
                <p className="text-[10px] text-white/30 mt-1">For feature showcase section</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-300 mb-1.5">Icon</label>
                <IconPicker
                  value={formData.paidCtaIcon || ''}
                  onChange={(v) => setFormData(prev => ({ ...prev, paidCtaIcon: v }))}
                  iconOptions={CTA_ICON_OPTIONS}
                  placeholder="ShoppingCart (default)"
                  defaultIcon="ShoppingCart"
                  className="bg-black/30 border-purple-500/20"
                />
                <p className="text-[10px] text-white/30 mt-1">Click to see icon grid</p>
              </div>
            </div>
          </div>
        </div>

        {/* How It Works (tool-wide) */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-300">How It Works <span className="text-white/30 font-normal">(applies to all versions)</span></label>
            <button type="button" onClick={() => openToolAiModal('howItWorks', 'How It Works', howItWorksText, (v) => {
              setHowItWorksText(v);
              const lines = v.split('\n').filter(l => l.trim());
              const steps = lines.map((line) => {
                const [title, description] = line.split('|').map(s => s.trim());
                const cleanTitle = (title || '').replace(/^Step \d+:\s*/, '');
                return { title: cleanTitle || '', description: description || '' };
              });
              setFormData(prev => ({ ...prev, howItWorks: steps }));
            })} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-400/15 transition-all duration-150"><Sparkles className="w-3 h-3" />Improve</button>
          </div>
          <Textarea
            placeholder={"Step 1: Install | Run the installer and restart After Effects\nStep 2: Access panel | Find the toolkit in Window > Extensions\nStep 3: Automate | Select tasks and let it handle the rest"}
            value={howItWorksText}
            onChange={(e) => setHowItWorksText(e.target.value)}
            onBlur={() => {
              const lines = howItWorksText.split('\n').filter(l => l.trim());
              const steps = lines.map((line) => {
                const [title, description] = line.split('|').map(s => s.trim());
                const cleanTitle = (title || '').replace(/^Step \d+:\s*/, '');
                return { title: cleanTitle || '', description: description || '' };
              });
              setFormData(prev => ({ ...prev, howItWorks: steps }));
            }}
            className={`bg-black/50 border-white/20 text-white transition-all duration-700 ${hlClass('howItWorks')}`}
            rows={5}
          />
          <p className="text-xs text-white/40 mt-1">Format: Step X: Title | Description (one per line) — parsed on blur</p>
        </div>

        <label className="flex items-center gap-2 text-white">
          <input
            type="checkbox"
            checked={formData.featured}
            onChange={(e) => setFormData(prev => ({ ...prev, featured: e.target.checked }))}
            className="w-4 h-4"
          />
          Featured Tool
        </label>
      </div>

      {/* ── User Guide section ───────────────────────────────────────────────── */}
      <div className="mb-8 pb-8 border-b border-white/10">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <BookOpen className="w-4 h-4 text-purple-400" />
            <h4 className="text-base font-semibold text-white">User Guide</h4>
            {guideExists ? (
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full
                bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">Live</span>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full
                bg-white/5 text-white/30 border border-white/10">No guide</span>
            )}
          </div>
          {guideExists && (formData.slug || tool.slug) && (
            <a
              href={`/tools/${formData.slug || tool.slug}/guide`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-[11px] text-purple-400/70 hover:text-purple-300 transition-colors"
            >
              View guide ↗
            </a>
          )}
        </div>

        {!tool.id ? (
          <p className="text-xs text-amber-400/60 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            Save the tool first to enable guide generation.
          </p>
        ) : (
          <div className="rounded-2xl border border-white/8 bg-white/2 overflow-hidden">

            {/* ── Generate zone ── */}
            <div className="p-5 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    <span className="text-sm font-semibold text-white/85">AI Generate</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-400 border border-purple-500/20 font-medium">Recommended</span>
                  </div>
                  <p className="text-xs text-white/35 leading-relaxed">
                    Produces a consistently styled guide every time.{' '}
                    {guideGenFileName
                      ? <span className="text-white/50">Will extract content from <strong className="text-white/70">{guideGenFileName}</strong>.</span>
                      : 'Attach a source file to reformat existing content, or leave empty to generate from tool data.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {/* Attach source file */}
                <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                  border transition-all cursor-pointer select-none
                  ${guideGenSourceHtml
                    ? 'bg-purple-500/15 border-purple-500/30 text-purple-300'
                    : 'bg-white/5 border-white/10 text-white/45 hover:bg-white/8 hover:border-white/18 hover:text-white/70'
                  }`}>
                  <FileCode className="w-3 h-3" />
                  {guideGenFileName ? guideGenFileName : 'Attach source file'}
                  <input type="file" accept=".html,text/html" className="hidden"
                    onChange={async e => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setGuideGenSourceHtml(await file.text());
                      setGuideGenFileName(file.name);
                      e.target.value = '';
                    }}
                  />
                </label>
                {guideGenSourceHtml && (
                  <button type="button"
                    onClick={() => { setGuideGenSourceHtml(null); setGuideGenFileName(null); }}
                    className="text-[11px] text-white/25 hover:text-red-400 transition-colors px-1">
                    ✕ Remove
                  </button>
                )}

                {/* Generate button */}
                <button type="button" onClick={handleGenerateGuide} disabled={guideGenerating}
                  className="ml-auto inline-flex items-center gap-2 px-4 py-1.5 rounded-lg text-sm font-semibold
                    bg-purple-600 hover:bg-purple-500 text-white transition-all
                    disabled:opacity-50 disabled:cursor-wait shadow-sm shadow-purple-900/40">
                  {guideGenerating ? (
                    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
                    </svg>
                  ) : <Sparkles className="w-3.5 h-3.5" />}
                  {guideGenerating
                    ? (guideGenSourceHtml ? 'Reformatting…' : 'Generating…')
                    : (guideExists ? 'Regenerate' : 'Generate Guide')}
                </button>
              </div>
            </div>

            {/* ── Divider + secondary actions ── */}
            <div className="border-t border-white/6 px-5 py-3 flex items-center gap-1 bg-white/[0.015]">
              <span className="text-[11px] text-white/25 mr-2 font-medium">Manual</span>

              {/* Upload HTML */}
              <label className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium
                border transition-all cursor-pointer select-none
                ${guideUploading
                  ? 'bg-white/3 border-white/8 text-white/20 cursor-wait'
                  : 'bg-white/4 border-white/8 text-white/40 hover:bg-white/8 hover:border-white/15 hover:text-white/65'
                }`}>
                {guideUploading
                  ? <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                  : <FileCode className="w-3 h-3" />}
                {guideUploading ? 'Uploading…' : (guideExists ? 'Replace HTML' : 'Upload HTML')}
                <input type="file" accept=".html,text/html" className="hidden" disabled={guideUploading}
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleGuideUpload(f); e.target.value = ''; }}
                />
              </label>

              {guideExists && (<>
                <button type="button"
                  onClick={() => guideEditorOpen ? setGuideEditorOpen(false) : handleOpenGuideEditor()}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all
                    ${guideEditorOpen
                      ? 'bg-indigo-500/20 border-indigo-400/30 text-indigo-300'
                      : 'bg-white/4 border-white/8 text-white/40 hover:bg-white/8 hover:border-white/15 hover:text-white/65'
                    }`}>
                  <Pencil className="w-3 h-3" />
                  {guideEditorOpen ? 'Close' : 'Edit HTML'}
                </button>

                <button type="button" onClick={handleGuideDelete} disabled={guideDeleting}
                  className="ml-auto inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium
                    border border-red-500/10 text-red-400/40 hover:bg-red-500/10 hover:border-red-400/20
                    hover:text-red-300 transition-all disabled:opacity-30 disabled:cursor-wait">
                  {guideDeleting
                    ? <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>
                    : <Trash2 className="w-3 h-3" />}
                  {guideDeleting ? 'Deleting…' : 'Delete'}
                </button>
              </>)}
            </div>
          </div>
        )}

        {/* Feedback message */}
        {guideMsg && (
          <p className={`flex items-center gap-1.5 text-xs mt-3 ${guideMsg.type === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}>
            {guideMsg.type === 'ok'
              ? <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
              : <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />}
            {guideMsg.text}
          </p>
        )}

        {/* ── Inline HTML editor ───────────────────────────────────────────── */}
        {guideEditorOpen && (
          <div className="mt-2 rounded-2xl border border-indigo-500/20 bg-[#1a1a2e]/60 overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/8 bg-white/3">
              {/* Left: filename + loading indicator */}
              <div className="flex items-center gap-2">
                <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                <span className="text-xs font-medium text-white/60">guide.html</span>
                {guideEditorLoading && (
                  <span className="flex items-center gap-1 text-[11px] text-white/35">
                    <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                    Loading…
                  </span>
                )}
              </div>

              {/* Centre: Edit / Preview tab pill */}
              <div className="flex items-center bg-white/5 rounded-lg p-0.5 border border-white/8">
                <button
                  type="button"
                  onClick={() => setGuideEditorTab('edit')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all
                    ${guideEditorTab === 'edit'
                      ? 'bg-indigo-500/25 text-indigo-300 border border-indigo-500/30'
                      : 'text-white/40 hover:text-white/60 border border-transparent'}`}
                >
                  <Code2 className="w-3 h-3" />
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => setGuideEditorTab('preview')}
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-all
                    ${guideEditorTab === 'preview'
                      ? 'bg-indigo-500/25 text-indigo-300 border border-indigo-500/30'
                      : 'text-white/40 hover:text-white/60 border border-transparent'}`}
                >
                  <Eye className="w-3 h-3" />
                  Preview
                </button>
              </div>

              {/* Right: expand, save, close */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setGuideEditorExpanded(v => !v)}
                  className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/8 transition-all"
                  title={guideEditorExpanded ? 'Collapse' : 'Expand'}
                >
                  {guideEditorExpanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                </button>
                {guideEditorTab === 'edit' && (
                  <button
                    type="button"
                    onClick={handleSaveGuideEditor}
                    disabled={guideEditorSaving || guideEditorLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
                      bg-indigo-500/20 border border-indigo-500/30 text-indigo-300
                      hover:bg-indigo-500/30 hover:border-indigo-400/40 transition-all
                      disabled:opacity-40 disabled:cursor-wait"
                  >
                    {guideEditorSaving ? (
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                    ) : (
                      <Save className="w-3 h-3" />
                    )}
                    {guideEditorSaving ? 'Saving…' : 'Save'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setGuideEditorOpen(false)}
                  className="p-1.5 rounded-lg text-white/30 hover:text-white/60 hover:bg-white/8 transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Content area */}
            <div style={{ height: guideEditorExpanded ? '70vh' : '460px' }} className="overflow-hidden">
              {guideEditorLoading ? (
                <div className="flex items-center justify-center h-full text-white/25 text-sm gap-2">
                  <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  Loading guide…
                </div>
              ) : guideEditorTab === 'edit' ? (
                <div className="h-full overflow-auto">
                  <CodeMirror
                    value={guideEditorHtml}
                    height={guideEditorExpanded ? '70vh' : '460px'}
                    extensions={[htmlLang()]}
                    theme={oneDark}
                    onChange={val => setGuideEditorHtml(val)}
                    basicSetup={{
                      lineNumbers: true,
                      highlightActiveLineGutter: true,
                      foldGutter: true,
                      autocompletion: true,
                      bracketMatching: true,
                      closeBrackets: true,
                      indentOnInput: true,
                    }}
                    style={{ fontSize: '13px' }}
                  />
                </div>
              ) : (
                /* Live preview — same HTML that ToolGuide.tsx renders in production */
                <iframe
                  srcDoc={guideEditorHtml}
                  title="Guide Preview"
                  sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
                  className="w-full h-full border-0"
                  style={{ colorScheme: 'dark' }}
                />
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Changelog section ─────────────────────────────────────────────── */}
      <div className="space-y-4 mb-8 pb-8 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <Tag className="w-4 h-4 text-purple-400" />
          <h4 className="text-base font-semibold text-white">Version Changelog</h4>
        </div>
        <ChangelogTab toolSlug={formData.slug || tool.slug || ''} toolId={tool.id || ''} />
      </div>

      {/* FEATURES SECTION — tool-level pool */}
      <div className="space-y-4 mb-8 pb-8 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <h4 className="text-base font-semibold text-white">Features</h4>
          <span className="text-white/30 text-xs">Define all features here — then select which appear per version below</span>
        </div>
        <FeaturesEditor
          versionId=""
          versionType=""
          toolName={formData.name}
          richFeatures={formData.richFeatures || []}
          onChange={(rf) => setFormData(prev => ({ ...prev, richFeatures: rf }))}
          highlightClass=""
        />
      </div>

      {/* VERSIONS SECTION */}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h4 className="text-lg font-semibold text-white">Versions & Pricing</h4>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => setVersionTypeModalOpen(true)}
              size="sm"
              className="cursor-pointer bg-violet-600 hover:bg-violet-500 text-white"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Version
            </Button>
            <Button
              type="button"
              onClick={() => setLsModalOpen(true)}
              size="sm"
              variant="outline"
              className="cursor-pointer border-amber-500/30 text-amber-300 hover:bg-amber-500/10 hover:border-amber-500/50"
            >
              <PackageOpen className="w-4 h-4 mr-1" />
              Import from LS
            </Button>
          </div>
        </div>

        {formData.versions && formData.versions.length > 0 ? (
          <Tabs value={activeVersionTab} onValueChange={setActiveVersionTab}>
            <div className="flex items-center gap-2">
              <TabsList className="flex-1">
                {formData.versions.map((version) => (
                  <TabsTrigger key={version.id} value={version.id}>
                    <span
                      className="inline-block w-2 h-2 rounded-full mr-2"
                      style={{ backgroundColor: version.color || '#a855f7' }}
                    ></span>
                    {version.versionType}
                  </TabsTrigger>
                ))}
              </TabsList>
              {/* Reorder arrows — move the active card left / right in the displayed order */}
              {formData.versions.length > 1 && (
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-xs text-white/40 mr-1 select-none">Card order:</span>
                  <button
                    type="button"
                    title="Move card left"
                    disabled={!activeVersionTab || formData.versions.findIndex(v => v.id === activeVersionTab) === 0}
                    onClick={() => activeVersionTab && reorderVersion(activeVersionTab, 'left')}
                    className="p-1.5 rounded bg-white/5 hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-white"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    title="Move card right"
                    disabled={!activeVersionTab || formData.versions.findIndex(v => v.id === activeVersionTab) === formData.versions.length - 1}
                    onClick={() => activeVersionTab && reorderVersion(activeVersionTab, 'right')}
                    className="p-1.5 rounded bg-white/5 hover:bg-white/15 disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-white"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {formData.versions.map((version) => (
              <TabsContent key={version.id} value={version.id}>
                {currentVersion && currentVersion.id === version.id && (
                  <VersionEditor
                    version={currentVersion}
                    onUpdate={(updates) => updateVersion(version.id, updates)}
                    onDuplicate={() => duplicateVersion(version.id)}
                    onDelete={() => deleteVersion(version.id)}
                    toolDemoUrl={formData.demoUrl || ''}
                    onUpdateDemoUrl={(url) => setFormData(prev => ({ ...prev, demoUrl: url }))}
                    toolName={formData.name}
                    toolRichFeatures={formData.richFeatures || []}
                    allVersions={formData.versions}
                    onRegenerate={() => handleRegenerateVersion(version.id)}
                    isRegenerating={generatingVersionId === version.id}
                    highlightedFields={highlightedFields}
                    onOpenAiModal={(fk, fl, cv, apply) => openToolAiModal(fk, fl, cv, apply, version.versionType, version.pricingModel)}
                  />
                )}
              </TabsContent>
            ))}
          </Tabs>
        ) : (
          <div className="text-center py-12 border border-white/10 rounded-lg border-dashed">
            <p className="text-white/60 mb-4">No versions yet. Add your first version above.</p>
          </div>
        )}
      </div>

      {/* Save/Cancel Buttons */}
      <div className="mt-8 pt-6 border-t border-white/20 space-y-3">
        {/* Inline form message */}
        {formMessage && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
            formMessage.type === 'success'
              ? 'bg-green-500/15 border border-green-500/30 text-green-400'
              : 'bg-red-500/15 border border-red-500/30 text-red-400'
          }`}>
            <span>{formMessage.type === 'success' ? '✓' : '✗'}</span>
            <span>{formMessage.text}</span>
          </div>
        )}
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving} className="cursor-pointer bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50">
            <Save className="w-4 h-4 mr-2" />
            {saving ? 'Saving…' : 'Save Tool'}
          </Button>
          <Button variant="outline" onClick={onCancel} className="bg-black text-white hover:bg-white hover:text-black dark:bg-white dark:text-black dark:hover:bg-black dark:hover:text-white border-transparent cursor-pointer">
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </div>
      </div>

      {/* Per-field AI Improve Modal */}
      {aiModal && (
        <AIImproveModal
          fieldLabel={aiModal.fieldLabel}
          fieldKey={aiModal.fieldKey}
          currentValue={aiModal.currentValue}
          context={aiModal.context}
          onApply={aiModal.onApply}
          onClose={() => setAiModal(null)}
        />
      )}

      {/* LemonSqueezy Import Modal */}
      <LsImportModal
        open={lsModalOpen}
        onClose={() => setLsModalOpen(false)}
        onImport={handleLsImport}
        onImportAll={handleLsImportAll}
      />

      {/* Version Type Selection Modal */}
      {versionTypeModalOpen ? createPortal(
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-white">Choose Version Type</h3>
              <button
                onClick={() => setVersionTypeModalOpen(false)}
                className="text-white/60 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <p className="text-white/60 text-sm mb-6">
              Select the pricing model for this version. You can configure the details after creation.
            </p>
            
            <div className="space-y-3">
              {/* Subscription Option */}
              <button
                onClick={() => addVersionByType('subscription')}
                className="w-full p-4 rounded-lg border border-violet-500/30 bg-violet-500/5 hover:bg-violet-500/10 hover:border-violet-500/50 transition-all group text-left"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-500/20 flex items-center justify-center shrink-0 group-hover:bg-violet-500/30 transition-colors">
                    <svg className="w-5 h-5 text-violet-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white font-medium mb-1">Subscription</h4>
                    <p className="text-white/50 text-sm">Recurring monthly or yearly payments</p>
                  </div>
                </div>
              </button>
              
              {/* Lifetime Option */}
              <button
                onClick={() => addVersionByType('lifetime')}
                className="w-full p-4 rounded-lg border border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/50 transition-all group text-left"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0 group-hover:bg-amber-500/30 transition-colors">
                    <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v13m0-13V6a2 2 0 112 2h-2zm0 0V5.5A2.5 2.5 0 109.5 8H12zm-7 4h14M5 12a2 2 0 110-4h14a2 2 0 110 4M5 12v7a2 2 0 002 2h10a2 2 0 002-2v-7" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white font-medium mb-1">Lifetime</h4>
                    <p className="text-white/50 text-sm">One-time payment for permanent access</p>
                  </div>
                </div>
              </button>
              
              {/* Free Option */}
              <button
                onClick={() => addVersionByType('free')}
                className="w-full p-4 rounded-lg border border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/50 transition-all group text-left"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-500/20 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/30 transition-colors">
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-white font-medium mb-1">Free</h4>
                    <p className="text-white/50 text-sm">No payment required, free forever</p>
                  </div>
                </div>
              </button>
            </div>
            
            <div className="mt-6 pt-4 border-t border-white/5">
              <p className="text-white/40 text-xs text-center">
                You can also import versions from LemonSqueezy using the "Import from LS" button
              </p>
            </div>
          </div>
        </div>
      , document.body) : null}
    </div>
  );
}

// ── FeatureTransfer ───────────────────────────────────────────────────────────
// Two-column picker: left = available (grouped by which versions use them),
// right = included. Click to select, arrow buttons to move, drag to reorder right column.

function FeatureTransfer({
  allFeatures,
  includedIds,
  onChange,
  allVersions = [],
  currentVersionId,
}: {
  allFeatures: RichFeature[];
  includedIds: string[];
  onChange: (ids: string[]) => void;
  allVersions?: ToolVersion[];
  currentVersionId?: string;
}) {
  const [leftSel,  setLeftSel]  = useState<Set<string>>(new Set());
  const [rightSel, setRightSel] = useState<Set<string>>(new Set());
  // Last clicked id per side — used for range selection (Shift+click)
  const [leftAnchor,  setLeftAnchor]  = useState<string | null>(null);
  const [rightAnchor, setRightAnchor] = useState<string | null>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<string | null>(null);

  const includedSet = new Set(includedIds);
  const available  = allFeatures.filter(f => !includedSet.has(f.id));
  const included   = includedIds.map(id => allFeatures.find(f => f.id === id)).filter(Boolean) as RichFeature[];

  // Build groups for the left column: group available features by which other versions use them.
  const otherVersions = allVersions.filter(v => v.id !== currentVersionId);
  type Group = { label: string; color?: string; ids: string[] };
  const groups: Group[] = [];
  const assignedToGroup = new Set<string>();
  for (const v of otherVersions) {
    const vIds = (v.includedFeatureIds ?? []).filter(id => {
      const f = allFeatures.find(f => f.id === id);
      return f && !includedSet.has(id) && !assignedToGroup.has(id);
    });
    if (vIds.length > 0) {
      groups.push({ label: v.versionType || 'Version', color: v.color, ids: vIds });
      vIds.forEach(id => assignedToGroup.add(id));
    }
  }
  const unusedIds = available.filter(f => !assignedToGroup.has(f.id)).map(f => f.id);
  const hasGroups = groups.length > 0;

  // Flat ordered id arrays for range selection — order matches visual render
  const leftOrder  = available.map(f => f.id);
  const rightOrder = included.map(f => f.id);

  const toggle = (id: string, side: 'left' | 'right', e: React.MouseEvent) => {
    const list   = side === 'left' ? leftOrder  : rightOrder;
    const setSel = side === 'left' ? setLeftSel : setRightSel;
    const anchor = side === 'left' ? leftAnchor : rightAnchor;
    const setAnchor = side === 'left' ? setLeftAnchor : setRightAnchor;

    if (e.shiftKey && anchor) {
      // Range selection: select everything between anchor and this item
      const a = list.indexOf(anchor);
      const b = list.indexOf(id);
      if (a !== -1 && b !== -1) {
        const [lo, hi] = a < b ? [a, b] : [b, a];
        const rangeIds = list.slice(lo, hi + 1);
        setSel(prev => {
          const next = new Set(prev);
          rangeIds.forEach(rid => next.add(rid));
          return next;
        });
        // Don't update anchor on range extension
        if (side === 'left') setRightSel(new Set());
        else setLeftSel(new Set());
        return;
      }
    }

    // Normal click
    setSel(prev => {
      const next = new Set(prev);
      if (next.size === 1 && next.has(id)) { next.clear(); }
      else { next.clear(); next.add(id); }
      return next;
    });
    setAnchor(id);
    if (side === 'left') { setRightSel(new Set()); setRightAnchor(null); }
    else                 { setLeftSel(new Set());  setLeftAnchor(null);  }
  };

  const allLeftSelected  = available.length > 0 && available.every(f => leftSel.has(f.id));
  const allRightSelected = included.length  > 0 && included.every(f => rightSel.has(f.id));

  const selectAllLeft  = () => { setLeftSel(new Set(available.map(f => f.id))); setRightSel(new Set()); };
  const selectAllRight = () => { setRightSel(new Set(included.map(f => f.id))); setLeftSel(new Set()); };
  const clearLeft      = () => { setLeftSel(new Set()); setLeftAnchor(null); };
  const clearRight     = () => { setRightSel(new Set()); setRightAnchor(null); };

  const selectGroup = (ids: string[]) => {
    setLeftSel(prev => { const n = new Set(prev); ids.forEach(id => n.add(id)); return n; });
    setRightSel(new Set());
  };
  const deselectGroup = (ids: string[]) => {
    setLeftSel(prev => { const n = new Set(prev); ids.forEach(id => n.delete(id)); return n; });
  };

  // Ctrl+A — select all in the column that was last interacted with
  const [focusedCol, setFocusedCol] = useState<'left' | 'right' | null>(null);
  React.useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'a' && focusedCol) {
        e.preventDefault();
        if (focusedCol === 'left')  allLeftSelected  ? clearLeft()  : selectAllLeft();
        if (focusedCol === 'right') allRightSelected ? clearRight() : selectAllRight();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusedCol, allLeftSelected, allRightSelected, available, included]);

  const moveRight = () => {
    if (leftSel.size === 0) return;
    onChange([...includedIds, ...Array.from(leftSel).filter(id => !includedSet.has(id))]);
    setLeftSel(new Set()); setLeftAnchor(null);
  };
  const moveLeft = () => {
    if (rightSel.size === 0) return;
    onChange(includedIds.filter(id => !rightSel.has(id)));
    setRightSel(new Set()); setRightAnchor(null);
  };
  const moveAllRight = () => {
    onChange([...includedIds, ...available.map(f => f.id)]);
    setLeftSel(new Set()); setLeftAnchor(null);
  };
  const moveAllLeft = () => {
    onChange([]);
    setRightSel(new Set()); setRightAnchor(null);
  };

  // Drag-to-reorder within the right column
  const handleDragStart = (id: string) => setDragging(id);
  const handleDragEnter = (id: string) => setDragOver(id);
  const handleDrop = (targetId: string) => {
    if (!dragging || dragging === targetId) { setDragging(null); setDragOver(null); return; }
    const next = [...includedIds];
    const from = next.indexOf(dragging);
    const to   = next.indexOf(targetId);
    if (from === -1 || to === -1) { setDragging(null); setDragOver(null); return; }
    next.splice(from, 1);
    next.splice(to, 0, dragging);
    onChange(next);
    setDragging(null);
    setDragOver(null);
  };

  if (allFeatures.length === 0) {
    return (
      <div>
        <p className="text-xs font-semibold text-gray-300 mb-2">
          Features in this version <span className="text-white/30 font-normal">(shown in pricing table)</span>
        </p>
        <p className="text-white/30 text-sm italic py-3 px-4 bg-white/5 rounded-lg border border-white/10">
          No features defined yet — add them in the Features section above.
        </p>
      </div>
    );
  }

  const colClass = "flex-1 min-w-0 rounded-xl border border-white/10 bg-white/[0.02] overflow-hidden flex flex-col";
  const headerClass = "px-3 py-2 bg-white/5 border-b border-white/10 text-xs font-semibold text-white/50 uppercase tracking-wider flex items-center gap-2";
  const itemBase = "px-3 py-2 text-sm cursor-pointer select-none transition-colors duration-100 rounded-md mx-1 my-0.5";
  const btnClass = "w-7 h-7 flex items-center justify-center rounded-lg border border-white/15 transition-all disabled:opacity-20 disabled:cursor-not-allowed";

  const renderLeftItem = (f: RichFeature) => {
    const sel = leftSel.has(f.id);
    return (
      <div
        key={f.id}
        onClick={e => { setFocusedCol('left'); toggle(f.id, 'left', e); }}
        className={`${itemBase} flex items-center gap-2 ${
          sel ? 'bg-purple-500/20 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white/80'
        }`}
      >
        <span className="truncate">{f.title || <em className="text-white/20">Untitled</em>}</span>
      </div>
    );
  };

  return (
    <div>
      <p className="text-xs font-semibold text-gray-300 mb-3">
        Features in this version <span className="text-white/30 font-normal">(shown in pricing table)</span>
      </p>
      <div className="flex gap-2 items-stretch">

        {/* Left — available, grouped by version usage */}
        <div className={colClass} onMouseEnter={() => setFocusedCol('left')}>
          <div className={headerClass}>
            <span className="flex-1">Available</span>
            <span className="text-white/30 font-normal normal-case tracking-normal">{available.length}</span>
            <button
              type="button"
              onClick={() => allLeftSelected ? clearLeft() : selectAllLeft()}
              disabled={available.length === 0}
              className="text-[10px] text-white/25 hover:text-purple-400 transition-colors font-normal normal-case tracking-normal disabled:opacity-30"
              title="Select all (Ctrl+A)"
            >
              {allLeftSelected ? 'deselect all' : 'select all'}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-1" style={{ minHeight: '120px', maxHeight: '260px' }}>
            {available.length === 0 ? (
              <p className="text-white/20 text-xs text-center py-6 italic">All features included</p>
            ) : hasGroups ? (
              <>
                {groups.map(group => {
                  const groupFeatures = group.ids.map(id => allFeatures.find(f => f.id === id)).filter(Boolean) as RichFeature[];
                  const allGroupSel = groupFeatures.every(f => leftSel.has(f.id));
                  return (
                    <div key={group.label} className="mb-1">
                      <div className="flex items-center gap-1.5 px-2 pt-2 pb-1">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: group.color || '#a855f7' }} />
                        <span className="text-xs font-semibold text-white/35 uppercase tracking-wider truncate flex-1">{group.label}</span>
                        <button
                          type="button"
                          onClick={() => allGroupSel ? deselectGroup(groupFeatures.map(f => f.id)) : selectGroup(groupFeatures.map(f => f.id))}
                          className="text-[10px] text-white/25 hover:text-purple-400 transition-colors flex-shrink-0"
                        >
                          {allGroupSel ? 'deselect' : 'select all'}
                        </button>
                      </div>
                      {groupFeatures.map(f => renderLeftItem(f))}
                    </div>
                  );
                })}
                {unusedIds.length > 0 && (
                  <div className="mb-1">
                    <div className="flex items-center gap-1.5 px-2 pt-2 pb-1">
                      <span className="w-2 h-2 rounded-full flex-shrink-0 bg-white/15" />
                      <span className="text-xs font-semibold text-white/25 uppercase tracking-wider flex-1">Unused</span>
                    </div>
                    {unusedIds.map(id => { const f = allFeatures.find(f => f.id === id); return f ? renderLeftItem(f) : null; })}
                  </div>
                )}
              </>
            ) : available.map(f => renderLeftItem(f))}
          </div>
        </div>

        {/* Arrow buttons */}
        <div className="flex flex-col items-center justify-center gap-1.5 flex-shrink-0">
          {/* Move all right */}
          <button type="button" onClick={moveAllRight} disabled={available.length === 0}
            title="Move all to included"
            className={`${btnClass} text-white/30 hover:text-white hover:bg-purple-500/20 hover:border-purple-400/40`}>
            <ChevronRight className="w-3 h-3 -mr-1" /><ChevronRight className="w-3 h-3" />
          </button>
          {/* Move selected right */}
          <button type="button" onClick={moveRight} disabled={leftSel.size === 0}
            title="Move selected to included"
            className={`${btnClass} text-white/40 hover:text-white hover:bg-purple-500/20 hover:border-purple-400/40`}>
            <ChevronRight className="w-4 h-4" />
          </button>
          {/* Move selected left */}
          <button type="button" onClick={moveLeft} disabled={rightSel.size === 0}
            title="Remove selected from included"
            className={`${btnClass} text-white/40 hover:text-white hover:bg-red-500/20 hover:border-red-400/40`}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          {/* Move all left */}
          <button type="button" onClick={moveAllLeft} disabled={included.length === 0}
            title="Remove all from included"
            className={`${btnClass} text-white/30 hover:text-white hover:bg-red-500/20 hover:border-red-400/40`}>
            <ChevronLeft className="w-3 h-3" /><ChevronLeft className="w-3 h-3 -ml-1" />
          </button>
        </div>

        {/* Right — included */}
        <div className={colClass} onMouseEnter={() => setFocusedCol('right')}>
          <div className={headerClass}>
            <span className="flex-1">Included</span>
            <span className="text-white/30 font-normal normal-case tracking-normal">{included.length}</span>
            <button
              type="button"
              onClick={() => allRightSelected ? clearRight() : selectAllRight()}
              disabled={included.length === 0}
              className="text-[10px] text-white/25 hover:text-purple-400 transition-colors font-normal normal-case tracking-normal disabled:opacity-30"
              title="Select all (Ctrl+A)"
            >
              {allRightSelected ? 'deselect all' : 'select all'}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto py-1" style={{ minHeight: '120px', maxHeight: '260px' }}>
            {included.length === 0 ? (
              <p className="text-white/20 text-xs text-center py-6 italic">None yet</p>
            ) : included.map(f => {
              const sel = rightSel.has(f.id);
              const isOver = dragOver === f.id && dragging !== f.id;
              return (
                <div
                  key={f.id}
                  draggable
                  onDragStart={() => handleDragStart(f.id)}
                  onDragEnter={() => handleDragEnter(f.id)}
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => handleDrop(f.id)}
                  onDragEnd={() => { setDragging(null); setDragOver(null); }}
                  onClick={e => { setFocusedCol('right'); toggle(f.id, 'right', e); }}
                  className={`${itemBase} flex items-center gap-2 ${
                    isOver ? 'border-t-2 border-purple-400/60' : ''
                  } ${dragging === f.id ? 'opacity-40' : ''} ${
                    sel ? 'bg-purple-500/20 text-white' : 'text-white/70 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <GripVertical className="w-3 h-3 text-white/20 flex-shrink-0 cursor-grab" />
                  <span className="truncate">{f.title || <em className="text-white/20">Untitled</em>}</span>
                </div>
              );
            })}
          </div>
        </div>

      </div>
      <p className="text-white/20 text-xs mt-1.5">
        {leftSel.size > 0 && `${leftSel.size} selected · `}
        {rightSel.size > 0 && `${rightSel.size} selected · `}
        Click to select · Shift+click to range select · Ctrl+A to select all
      </p>
    </div>
  );
}

// ── Inheritance Label Editor ────────────────────────────────────────────────
// Per-version settings for:
//  (1) Inheritance label: "Everything in Free, plus:" shown above features
//      Supports {{previousTier}} template (auto-renders previous version's name)
//  (2) Empty delta mode: what to render when this tier has no NEW features
//      vs. the previous tier — fallback message / hide list / show all features
function InheritanceLabelEditor({
  version,
  allVersions,
  onUpdate,
}: {
  version: ToolVersion;
  allVersions: ToolVersion[];
  onUpdate: (updates: Partial<ToolVersion>) => void;
}) {
  const idx = allVersions.findIndex(v => v.id === version.id);
  const prevVersion = idx > 0 ? allVersions[idx - 1] : null;
  const prevTierName = prevVersion?.versionType || '';

  // Default: enabled for non-first versions
  const enabled = version.inheritanceLabelEnabled ?? idx > 0;
  const labelValue = version.inheritanceLabel ?? (idx > 0 ? `Everything in {{previousTier}}, plus:` : '');

  // Empty-delta behavior defaults
  const emptyMode = version.emptyDeltaMode ?? 'message';
  const emptyMessage = version.emptyDeltaMessage ?? 'Same features as previous tier';

  // Live preview (resolve template)
  const preview = labelValue.replace(/\{\{previousTier\}\}/g, prevTierName || '—');

  return (
    <div className="p-4 rounded-lg bg-white/3 border border-white/8 space-y-4">
      {/* Inheritance label section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Tag className="w-3.5 h-3.5 text-white/40" />
              Inheritance label
            </label>
            <p className="text-xs text-white/35 mt-0.5">Shown above this version's features</p>
          </div>
          <button
            type="button"
            onClick={() => onUpdate({ inheritanceLabelEnabled: !enabled })}
            className={`relative w-10 h-5 rounded-full transition-colors ${enabled ? 'bg-purple-500' : 'bg-white/10'}`}
            aria-label={enabled ? 'Disable label' : 'Enable label'}
          >
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>

        {enabled && (
          <>
            <Input
              value={labelValue}
              onChange={(e) => onUpdate({ inheritanceLabel: e.target.value })}
              placeholder="Everything in {{previousTier}}, plus:"
              className="bg-black/50 border-white/20 text-white text-sm"
            />
            <div className="flex items-start gap-2 text-xs">
              <span className="text-white/30 shrink-0 mt-0.5">Preview:</span>
              <span className="text-white/60 italic">— {preview || '(empty)'}</span>
            </div>
            <p className="text-xs text-white/25 leading-relaxed">
              Use <code className="text-purple-300 bg-purple-500/10 px-1 py-0.5 rounded text-[10px]">{'{{previousTier}}'}</code> to auto-insert the previous version's name. Updates automatically when versions are reordered.
            </p>
          </>
        )}
      </div>

      {/* Empty-delta behavior (only relevant for tiers > 0) */}
      {idx > 0 && (
        <div className="pt-3 border-t border-white/5 space-y-2">
          <label className="text-xs font-medium text-gray-300 block">
            When this version has no new features vs. {prevTierName || 'previous tier'}
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {([
              { value: 'message', label: 'Show message' },
              { value: 'hide', label: 'Hide list' },
              { value: 'showAll', label: 'Show all included' },
              { value: 'deltaOnly', label: 'Delta only (silent)' },
            ] as const).map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onUpdate({ emptyDeltaMode: opt.value })}
                className={`px-2 py-2 rounded-md text-[11px] font-medium transition-all border ${
                  emptyMode === opt.value
                    ? 'bg-purple-500/20 border-purple-400/40 text-purple-200'
                    : 'bg-white/3 border-white/8 text-white/50 hover:text-white/80 hover:bg-white/6'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {emptyMode === 'message' && (
            <Input
              value={emptyMessage}
              onChange={(e) => onUpdate({ emptyDeltaMessage: e.target.value })}
              placeholder="Same features as previous tier"
              className="bg-black/50 border-white/20 text-white text-sm"
            />
          )}
          <p className="text-xs text-white/25 leading-relaxed">
            {emptyMode === 'message' && 'Shown as italic text where features would be listed.'}
            {emptyMode === 'hide' && 'Feature list section is completely hidden (label + CTA only).'}
            {emptyMode === 'showAll' && "Shows all features included in this tier (free + new). No message."}
            {emptyMode === 'deltaOnly' && 'Shows only new features vs. previous tier. If none, list is empty — use the inheritance label above (e.g. "All free features, plus:") to provide context.'}
          </p>
        </div>
      )}
    </div>
  );
}

// Version Editor Component
function VersionEditor({
  version,
  onUpdate,
  onDuplicate,
  onDelete,
  toolDemoUrl,
  onUpdateDemoUrl,
  toolName: _toolName,
  toolRichFeatures = [],
  allVersions = [],
  onRegenerate,
  isRegenerating = false,
  highlightedFields = new Set<string>(),
  onOpenAiModal,
}: {
  version: ToolVersion;
  onUpdate: (updates: Partial<ToolVersion>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  toolDemoUrl: string;
  onUpdateDemoUrl: (url: string) => void;
  toolName: string;
  toolRichFeatures?: RichFeature[];
  allVersions?: ToolVersion[];
  onRegenerate?: () => void;
  isRegenerating?: boolean;
  highlightedFields?: Set<string>;
  onOpenAiModal?: (fieldKey: string, fieldLabel: string, currentValue: string, onApply: (v: string) => void) => void;
}) {
  const vhl = (subKey: string) =>
    highlightedFields.has(`${version.id}:${subKey}`)
      ? 'ring-2 ring-purple-400/70 shadow-[0_0_14px_rgba(192,132,252,0.45)]'
      : '';

  return (
    <div className="space-y-6 p-6 bg-white/5 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h5 className="text-white font-semibold flex items-center gap-2">
          <span
            className="inline-block w-3 h-3 rounded-full"
            style={{ backgroundColor: version.color || '#a855f7' }}
          ></span>
          {version.versionType} Version
        </h5>
        <div className="flex gap-2">
          {/* Per-version AI regenerate button */}
          {onRegenerate && (
            <button
              type="button"
              onClick={onRegenerate}
              disabled={isRegenerating}
              title={`Regenerate ${version.versionType} version content with AI`}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 select-none
                disabled:opacity-40 disabled:cursor-not-allowed
                ${isRegenerating
                  ? 'bg-purple-500/20 border border-purple-400/30 text-purple-300 cursor-wait'
                  : 'bg-purple-500/15 border border-purple-400/25 text-purple-300 hover:bg-purple-500/30 hover:text-white active:scale-95'
                }`}
            >
              {isRegenerating ? (
                <>
                  <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                  <span>Generating…</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-3 h-3" />
                  <span>✨ Regen</span>
                </>
              )}
            </button>
          )}
          <Button
            type="button"
            onClick={onDuplicate}
            size="sm"
            variant="outline"
            className="cursor-pointer hover:bg-white/10 group text-white hover:text-purple-400 border-white/20"
          >
            <Copy className="w-4 h-4 mr-1 text-white group-hover:text-purple-400 transition-colors" />
            Duplicate
          </Button>
          <Button
            type="button"
            onClick={onDelete}
            size="sm"
            variant="outline"
            className="cursor-pointer hover:bg-white/10 group text-white hover:text-red-400 border-white/20"
          >
            <Trash2 className="w-4 h-4 text-white group-hover:text-red-400 transition-colors" />
          </Button>
        </div>
      </div>

      {/* Version Name & Color */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Version Name (English) *
          </label>
          <Input
            placeholder="e.g., Starter, Pro, Agency"
            value={version.versionType}
            onChange={(e) => onUpdate({ versionType: e.target.value })}
            className="bg-black/50 border-white/20 text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Accent Color
          </label>
          <div className="flex gap-2">
            <input
              type="color"
              value={version.color || '#a855f7'}
              onChange={(e) => onUpdate({ color: e.target.value })}
              className="h-10 w-14 rounded border border-white/20 bg-black/50 cursor-pointer"
            />
            <Input
              placeholder="#a855f7"
              value={version.color || ''}
              onChange={(e) => onUpdate({ color: e.target.value })}
              className="bg-black/50 border-white/20 text-white flex-1"
            />
          </div>
          <p className="text-xs text-white/30 mt-1">Used for badges and pricing card accents</p>
        </div>
      </div>

      {/* Pricing Model */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Pricing Model
        </label>
        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-white cursor-pointer">
            <input
              type="radio"
              name={`pricing-${version.id}`}
              checked={version.pricingModel === 'lifetime'}
              onChange={() => onUpdate({ pricingModel: 'lifetime' })}
              className="w-4 h-4"
              disabled={isVersionFree(version)}
            />
            Lifetime (one-time payment)
          </label>
          <label className="flex items-center gap-2 text-white cursor-pointer">
            <input
              type="radio"
              name={`pricing-${version.id}`}
              checked={version.pricingModel === 'subscription'}
              onChange={() => onUpdate({ pricingModel: 'subscription' })}
              className="w-4 h-4"
              disabled={isVersionFree(version)}
            />
            Subscription (recurring)
          </label>
        </div>
      </div>

      {/* Pricing Fields */}
      {!isVersionFree(version) && (
        <div className="space-y-4">
          {version.pricingModel === 'subscription' ? (
            <>
              {/* Subscription prices */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Monthly Price (e.g., $9)
                  </label>
                  <Input
                    placeholder="$9/month"
                    value={version.monthlyPrice || ''}
                    onChange={(e) => onUpdate({ monthlyPrice: e.target.value })}
                    className="bg-black/50 border-white/20 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Yearly Price (e.g., $90)
                  </label>
                  <Input
                    placeholder="$90/year"
                    value={version.yearlyPrice || ''}
                    onChange={(e) => onUpdate({ yearlyPrice: e.target.value })}
                    className="bg-black/50 border-white/20 text-white"
                  />
                </div>
              </div>

            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Lifetime Price (e.g., $49)
              </label>
              <Input
                placeholder="$49 one-time"
                value={version.lifetimePrice || ''}
                onChange={(e) => onUpdate({ lifetimePrice: e.target.value })}
                className="bg-black/50 border-white/20 text-white"
              />
            </div>
          )}
        </div>
      )}

      {/* Download URL */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          {isVersionFree(version) ? 'Download URL' : 'Lemon Squeezy Checkout URL'}
        </label>
        <Input
          placeholder={
            isVersionFree(version)
              ? 'https://your-cdn.com/tool-free.zip or LS checkout URL'
              : 'https://yourstore.lemonsqueezy.com/checkout/buy/...'
          }
          value={version.downloadUrl || ''}
          onChange={(e) => onUpdate({ downloadUrl: e.target.value })}
          className="bg-black/50 border-white/20 text-white"
        />
        <p className="text-xs text-white/30 mt-1">
          {isVersionFree(version)
            ? 'Direct file URL (e.g. .zip) for instant download, or an LS checkout link to go through the LS flow.'
            : 'Lemon Squeezy checkout link. User email will be pre-filled automatically.'}
        </p>
      </div>

      {/* Lemon Squeezy IDs (paid versions only) */}
      {!isVersionFree(version) && (
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              LS Product ID <span className="text-white/30 font-normal">(optional)</span>
            </label>
            <Input
              placeholder="123456"
              value={version.lemonSqueezyProductId || ''}
              onChange={(e) => onUpdate({ lemonSqueezyProductId: e.target.value })}
              className="bg-black/50 border-white/20 text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              LS Variant ID <span className="text-white/30 font-normal">(optional)</span>
            </label>
            <Input
              placeholder="789012"
              value={version.lemonSqueezyVariantId || ''}
              onChange={(e) => onUpdate({ lemonSqueezyVariantId: e.target.value })}
              className="bg-black/50 border-white/20 text-white"
            />
            <p className="text-xs text-white/30 mt-1">Used for webhook purchase tracking</p>
          </div>
        </div>
      )}

      {/* Demo URL — stored at tool level (shared across all versions) */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Demo URL <span className="text-white/40 font-normal">(optional · applies to all versions)</span>
        </label>
        <Input
          placeholder="https://demo.example.com"
          value={toolDemoUrl}
          onChange={(e) => onUpdateDemoUrl(e.target.value)}
          className="bg-black/50 border-white/20 text-white"
        />
      </div>

      {/* Features transfer — two-column picker */}
      <FeatureTransfer
        allFeatures={toolRichFeatures}
        includedIds={version.includedFeatureIds ?? []}
        onChange={ids => onUpdate({ includedFeatureIds: ids })}
        allVersions={allVersions}
        currentVersionId={version.id}
      />

      {/* Inheritance label */}
      <InheritanceLabelEditor
        version={version}
        allVersions={allVersions}
        onUpdate={onUpdate}
      />

      {/* What's Included */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="block text-sm font-medium text-gray-300">What's Included <span className="text-white/30 font-normal">(Optional)</span></label>
          {onOpenAiModal && (
            <button type="button" onClick={() => onOpenAiModal('whatsIncluded', "What's Included", (version.whatsIncluded || []).join('\n'), (v) => onUpdate({ whatsIncluded: v.split('\n').filter(Boolean) }))} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-400/15 transition-all duration-150"><Sparkles className="w-3 h-3" />Improve</button>
          )}
        </div>
        <Textarea
          placeholder="Enter items (one per line)"
          value={(version.whatsIncluded || []).join('\n')}
          onChange={(e) =>
            onUpdate({ whatsIncluded: e.target.value.split('\n') })
          }
          className={`bg-black/50 border-white/20 text-white transition-all duration-700 ${vhl('whatsIncluded')}`}
          rows={4}
        />
        <p className="text-xs text-white/40 mt-1">One item per line</p>
      </div>

      {/* Activation Steps */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="block text-sm font-medium text-gray-300">🔑 How to Activate <span className="text-white/30 font-normal">(Optional)</span></label>
          {onOpenAiModal && (
            <button type="button" onClick={() => onOpenAiModal('activationSteps', 'Activation Steps', (version.activationSteps || []).join('\n'), (v) => onUpdate({ activationSteps: v.split('\n').filter(Boolean) }))} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-400/15 transition-all duration-150"><Sparkles className="w-3 h-3" />Improve</button>
          )}
        </div>
        <p className="text-xs text-white/40 mb-2">
          Step-by-step instructions shown to the user in their Account page after purchase. One step per line. Leave empty to use the site default.
        </p>
        <Textarea
          placeholder={`Install the .jsx file via File → Scripts → Install Script File.\nOpen the panel in Window → Extensions → ${version.versionType ?? 'Plugin'} Name.\nPaste your license key and click Activate.\nRestart After Effects if prompted.`}
          value={(version.activationSteps || []).join('\n')}
          onChange={(e) =>
            onUpdate({ activationSteps: e.target.value.split('\n') })
          }
          className={`bg-black/50 border-white/20 text-white transition-all duration-700 ${vhl('activationSteps')}`}
          rows={5}
        />
        <p className="text-xs text-white/40 mt-1">One step per line — numbered automatically</p>
      </div>
    </div>
  );
}

// ── FeaturesEditor ────────────────────────────────────────────────────────────

function FeaturesEditor({
  versionId: _versionId,
  versionType,
  toolName,
  richFeatures,
  onChange,
  highlightClass,
}: {
  versionId: string;
  versionType: string;
  toolName: string;
  richFeatures: RichFeature[];
  onChange: (features: RichFeature[]) => void;
  highlightClass: string;
}) {
  const [generatingAI, setGeneratingAI] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

  const addFeature = () => {
    onChange([...richFeatures, {
      id: `feat-${Date.now()}`,
      title: '',
      description: '',
      screenshots: [''],
      featured: true,  // Default to featured when manually adding
    }]);
  };

  const updateFeature = (id: string, updates: Partial<RichFeature>) => {
    onChange(richFeatures.map(f => f.id === id ? { ...f, ...updates } : f));
  };

  const removeFeature = (id: string) => {
    onChange(richFeatures.filter(f => f.id !== id));
  };

  const addScreenshot = (featureId: string) => {
    const feat = richFeatures.find(f => f.id === featureId);
    if (!feat) return;
    updateFeature(featureId, { screenshots: [...feat.screenshots, ''] });
  };

  const updateScreenshot = (featureId: string, idx: number, url: string) => {
    const feat = richFeatures.find(f => f.id === featureId);
    if (!feat) return;
    const updated = [...feat.screenshots];
    updated[idx] = url;
    updateFeature(featureId, { screenshots: updated });
  };

  const removeScreenshot = (featureId: string, idx: number) => {
    const feat = richFeatures.find(f => f.id === featureId);
    if (!feat) return;
    updateFeature(featureId, { screenshots: feat.screenshots.filter((_, i) => i !== idx) });
  };

  const uploadScreenshot = async (featureId: string, idx: number, file: File) => {
    const key = `${featureId}-${idx}`;
    setUploadingKey(key);
    try {
      const token = localStorage.getItem('admin_token');
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_BASE}/upload-image`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${publicAnonKey}`, 'X-Admin-Token': token || '' },
        body: fd,
      });
      const result = await res.json();
      if (result.success) {
        updateScreenshot(featureId, idx, result.data.url);
      } else {
        console.error('Upload failed:', result.error);
      }
    } catch (err) {
      console.error('Upload error:', err);
    } finally {
      setUploadingKey(null);
    }
  };

  const generateWithAI = async () => {
    if (!toolName.trim()) { setAiError('Enter a tool name first.'); return; }
    setGeneratingAI(true);
    setAiError(null);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/admin/generate-rich-features`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Admin-Token': token || '',
        },
        body: JSON.stringify({ toolName, versionType, count: 5 }),
      });
      const result = await res.json();
      if (result.success && result.richFeatures) {
        // Merge: keep existing screenshots, replace title+description from AI
        if (richFeatures.length > 0) {
          const merged = result.richFeatures.map((ai: any, i: number) => ({
            id: richFeatures[i]?.id ?? `feat-${Date.now()}-${i}`,
            title: ai.title,
            description: ai.description,
            screenshots: richFeatures[i]?.screenshots ?? [],
            featured: richFeatures[i]?.featured ?? true,  // Keep existing featured state, default to true
          }));
          onChange(merged);
        } else {
          onChange(result.richFeatures.map((ai: any) => ({
            ...ai,
            screenshots: [''],
            featured: true,  // Default AI-generated features to featured
          })));
        }
      } else {
        setAiError(result.error || 'AI generation failed.');
      }
    } catch (err) {
      setAiError('Could not reach the server. Try again.');
    } finally {
      setGeneratingAI(false);
    }
  };

  return (
    <div className={`transition-all duration-700 ${highlightClass}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div>
          <label className="block text-sm font-medium text-gray-300">
            ✨ Features with Screenshots
          </label>
          <p className="text-xs text-white/30 mt-0.5">
            Showcased on the tool page — each feature gets a title, description, and carousel of images/GIFs. Use "Show in Showcase" to control visibility (remember to save).
          </p>
        </div>
        <div className="flex gap-2 flex-shrink-0 ml-4">
          <button
            type="button"
            onClick={generateWithAI}
            disabled={generatingAI || !toolName.trim()}
            title={!toolName.trim() ? 'Enter a tool name first' : `Generate ${versionType} features with AI`}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
              bg-purple-500/15 border border-purple-400/25 text-purple-300
              hover:bg-purple-500/30 hover:text-white active:scale-95
              disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-150"
          >
            {generatingAI ? (
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            ) : <Sparkles className="w-3 h-3" />}
            {generatingAI ? 'Generating…' : '✨ AI Generate'}
          </button>
          <button
            type="button"
            onClick={addFeature}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold
              bg-white/8 border border-white/15 text-white/70
              hover:bg-white/15 hover:text-white active:scale-95 transition-all duration-150"
          >
            <Plus className="w-3.5 h-3.5" />
            Add Feature
          </button>
        </div>
      </div>

      {/* AI error */}
      {aiError && (
        <div className="mb-3 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
          {aiError}
        </div>
      )}

      {/* Empty state */}
      {richFeatures.length === 0 && (
        <div className="py-10 border border-white/8 border-dashed rounded-xl flex flex-col items-center justify-center gap-2 text-center">
          <ImageIcon className="w-8 h-8 text-white/15" />
          <p className="text-white/30 text-sm font-medium">No features yet</p>
          <p className="text-white/20 text-xs max-w-xs">
            Add features with screenshots to create a visual showcase on the tool page.
          </p>
          <button
            type="button"
            onClick={addFeature}
            className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold
              bg-purple-500/15 border border-purple-400/25 text-purple-300
              hover:bg-purple-500/30 transition-all"
          >
            <Plus className="w-3.5 h-3.5" />
            Add First Feature
          </button>
        </div>
      )}

      {/* Feature cards */}
      <div className="space-y-4">
        {richFeatures.map((feature, fIdx) => (
          <div
            key={feature.id}
            className="rounded-xl border border-white/10 bg-white/3 overflow-hidden"
          >
            {/* Card header */}
            <div className="flex items-center justify-between px-4 py-2.5 bg-white/5 border-b border-white/8">
              <div className="flex items-center gap-3">
                <GripVertical className="w-3.5 h-3.5 text-white/20" />
                <span className="text-white/40 text-xs font-mono font-semibold tracking-wide">
                  Feature {fIdx + 1}
                </span>
                {feature.title && (
                  <span className="text-white/60 text-xs truncate max-w-[160px]">— {feature.title}</span>
                )}
                
                {/* Featured toggle */}
                <label className="flex items-center gap-1.5 ml-2 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={feature.featured || false}
                    onChange={(e) => updateFeature(feature.id, { featured: e.target.checked })}
                    className="w-3.5 h-3.5 rounded bg-black/40 border border-white/20 
                      checked:bg-purple-500 checked:border-purple-400 
                      focus:ring-2 focus:ring-purple-500/50 transition-all cursor-pointer"
                  />
                  <span className="text-[10px] text-white/40 group-hover:text-white/60 transition-colors uppercase tracking-wide font-semibold cursor-pointer">
                    Show in Showcase
                  </span>
                </label>
              </div>
              <button
                type="button"
                onClick={() => removeFeature(feature.id)}
                className="text-white/25 hover:text-red-400 transition-colors p-1 rounded"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              {/* Title */}
              <div>
                <label className="block text-xs text-white/40 mb-1.5">Title</label>
                <Input
                  placeholder="e.g. Batch Process 500+ Layers at Once"
                  value={feature.title}
                  onChange={e => updateFeature(feature.id, { title: e.target.value })}
                  className="bg-black/40 border-white/15 text-white text-sm h-9"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-xs text-white/40 mb-1.5">
                  Description <span className="text-white/20">(max 100 chars)</span>
                </label>
                <div className="relative">
                  <Textarea
                    placeholder="Describe this feature's benefit in one short sentence."
                    value={feature.description}
                    onChange={e => {
                      if (e.target.value.length <= 100)
                        updateFeature(feature.id, { description: e.target.value });
                    }}
                    className="bg-black/40 border-white/15 text-white text-sm resize-none pr-12"
                    rows={2}
                  />
                  <span className={`absolute bottom-2 right-2.5 text-[10px] tabular-nums pointer-events-none transition-colors ${
                    feature.description.length >= 90 ? 'text-amber-400' : 'text-white/20'
                  }`}>
                    {feature.description.length}/100
                  </span>
                </div>
              </div>

              {/* Screenshots */}
              <div>
                <label className="block text-xs text-white/40 mb-2">
                  Screenshots / GIFs
                  <span className="text-white/20 ml-1">(multiple = carousel on tool page)</span>
                </label>
                <div className="space-y-2">
                  {feature.screenshots.map((url, sIdx) => {
                    const uploadKey = `${feature.id}-${sIdx}`;
                    return (
                      <div key={sIdx} className="flex items-center gap-2">
                        {/* Thumbnail preview */}
                        {url ? (
                          <button
                            type="button"
                            onClick={() => setPreviewUrl(url)}
                            className="w-8 h-8 rounded-md overflow-hidden border border-white/10 flex-shrink-0 hover:border-purple-400/40 transition-colors"
                          >
                            <img src={url} alt="" className="w-full h-full object-cover" />
                          </button>
                        ) : (
                          <div className="w-8 h-8 rounded-md border border-white/10 bg-white/5 flex items-center justify-center flex-shrink-0">
                            <ImageIcon className="w-3.5 h-3.5 text-white/20" />
                          </div>
                        )}
                        <input
                          type="text"
                          placeholder="Paste image or GIF URL…"
                          value={url}
                          onChange={e => updateScreenshot(feature.id, sIdx, e.target.value)}
                          className="flex-1 px-3 py-1.5 bg-black/40 border border-white/12 rounded-lg
                            text-white text-xs placeholder:text-white/20
                            focus:outline-none focus:border-purple-400/40 transition-colors"
                        />
                        {/* Upload button */}
                        <label
                          className="flex items-center justify-center w-8 h-8 rounded-lg
                            bg-white/5 border border-white/12 text-white/40
                            hover:bg-white/12 hover:text-white/70 cursor-pointer transition-all"
                          title="Upload file"
                        >
                          {uploadingKey === uploadKey ? (
                            <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                            </svg>
                          ) : <Upload className="w-3.5 h-3.5" />}
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={e => {
                              const file = e.target.files?.[0];
                              if (file) uploadScreenshot(feature.id, sIdx, file);
                              e.target.value = '';
                            }}
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => removeScreenshot(feature.id, sIdx)}
                          className="w-8 h-8 flex items-center justify-center text-white/25
                            hover:text-red-400 transition-colors rounded-lg"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => addScreenshot(feature.id)}
                    className="flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors mt-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add screenshot
                  </button>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Bottom add-feature button — only when there's already at least one feature */}
      {richFeatures.length > 0 && (
        <button
          type="button"
          onClick={addFeature}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl
            border border-dashed border-white/15 text-white/40
            hover:border-purple-400/40 hover:text-purple-300 hover:bg-purple-500/5
            active:scale-[0.99] transition-all duration-150 text-xs font-semibold"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Feature
        </button>
      )}

      {/* Preview lightbox */}
      {previewUrl && (
        <div
          className="fixed inset-0 z-[200] bg-black/90 flex items-center justify-center p-6"
          onClick={() => setPreviewUrl(null)}
        >
          <div className="relative max-w-3xl w-full" onClick={e => e.stopPropagation()}>
            <button
              onClick={() => setPreviewUrl(null)}
              className="absolute -top-10 right-0 text-white/60 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            <img
              src={previewUrl}
              alt="Preview"
              className="w-full h-auto rounded-xl border border-white/10"
              style={{ maxHeight: '80vh', objectFit: 'contain' }}
            />
          </div>
        </div>
      )}
    </div>
  );
}