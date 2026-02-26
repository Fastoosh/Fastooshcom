import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { AdminSelect } from './AdminSelect';
import { Plus, Save, X, Upload, Copy, Trash2, Sparkles, ChevronLeft, ChevronRight, GripVertical, ImageIcon } from 'lucide-react';
import { projectId, publicAnonKey } from '/utils/supabase/info';

// ── Rich Feature type ─────────────────────────────────────────────────────────
export interface RichFeature {
  id: string;
  title: string;
  description: string;
  screenshots: string[];
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

interface ToolVersion {
  id: string;
  versionType: 'Free' | 'Pro' | 'Studio';
  pricingModel: 'subscription' | 'lifetime';
  monthlyPrice?: string;
  yearlyPrice?: string;
  lifetimePrice?: string;
  downloadUrl: string;
  lemonSqueezyVariantId?: string;
  lemonSqueezyProductId?: string;
  features?: string[];
  whatsIncluded?: string[];
  activationSteps?: string[];
  richFeatures?: RichFeature[];
  demoUrl?: string;
}

interface Tool {
  id: string;
  name: string;
  description: string;
  category: string;
  imageUrl: string;
  featured: boolean;
  slug?: string;
  tagline?: string;
  demoUrl?: string;
  systemRequirements?: string;
  howItWorks?: Array<{ title: string; description: string }>;
  faqs?: Array<{ question: string; answer: string }>;
  versions?: ToolVersion[];
}

export function ToolFormNew({
  tool,
  onSave,
  onCancel,
  statuses,
}: {
  tool: Tool;
  onSave: (tool: Tool) => Promise<{ success: boolean; message: string }>;
  onCancel: () => void;
  statuses: string[];
}) {
  const [formData, setFormData] = useState({
    ...tool,
    name: tool.name || '',
    description: tool.description || '',
    category: tool.category || '',
    imageUrl: tool.imageUrl || '',
    tagline: tool.tagline || '',
    demoUrl: tool.demoUrl || '',
    systemRequirements: tool.systemRequirements || '',
    slug: tool.slug || '',
    featured: tool.featured || false,
    howItWorks: tool.howItWorks || [],
    faqs: tool.faqs || [],
    versions: tool.versions || [],
  });
  const [activeVersionTab, setActiveVersionTab] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [imageInputMode, setImageInputMode] = useState<'url' | 'upload'>('url');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [faqText, setFaqText] = useState('');
  const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [generatingVersionId, setGeneratingVersionId] = useState<string | null>(null);
  const [duplicateModalOpen, setDuplicateModalOpen] = useState(false);
  const [sourceDuplicateVersionId, setSourceDuplicateVersionId] = useState<string>('');
  // AI options
  const [aiInstruction, setAiInstruction] = useState('');
  const [improveExisting, setImproveExisting] = useState(false);
  const [showAiOptions, setShowAiOptions] = useState(false);
  // Glow highlight for auto-filled fields
  const [highlightedFields, setHighlightedFields] = useState<Set<string>>(new Set());

  // Initialize FAQ text
  useEffect(() => {
    const initialText = (tool.faqs || []).length === 0 ? 'Q: ' : (tool.faqs || []).map(faq => {
      const question = faq.question.trim();
      const answer = faq.answer.trim();
      return `Q: ${question}\nA: ${answer}`;
    }).join('\n\n');
    setFaqText(initialText);
  }, [tool]);

  // Set first version as active if exists
  useEffect(() => {
    if (formData.versions && formData.versions.length > 0 && !activeVersionTab) {
      setActiveVersionTab(formData.versions[0].id);
    }
  }, [formData.versions]);

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
            features: v.features,
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

      // Version-level fields
      if (data.versions && Array.isArray(data.versions)) {
        const updatedVersions = (formData.versions || []).map(v => {
          const gv = data.versions.find((x: any) => x.id === v.id);
          if (!gv) return v;
          const vUpdates: Partial<ToolVersion> = {};
          if (gv.features && (improveExisting || !v.features || v.features.filter((f: string) => f.trim()).length === 0)) {
            vUpdates.features = gv.features;
            changedFields.push(`${v.id}:features`);
          }
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
            features: version.features,
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
        if (gv.features)        { vUpdates.features        = gv.features;        changedFields.push(`${versionId}:features`); }
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
      const cleanedData = {
        ...formData,
        faqs: (formData.faqs || []).filter(faq => faq.question || faq.answer),
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

  const addVersion = (versionType: 'Free' | 'Pro' | 'Studio') => {
    const newVersion: ToolVersion = {
      id: `version-${Date.now()}`,
      versionType,
      pricingModel: versionType === 'Free' ? 'lifetime' : 'subscription',
      downloadUrl: '',
      lemonSqueezyVariantId: '',
      lemonSqueezyProductId: '',
      features: [],
      whatsIncluded: [],
      activationSteps: [],
      richFeatures: [],
      demoUrl: '',
      monthlyPrice: versionType === 'Free' ? undefined : '',
      yearlyPrice: versionType === 'Free' ? undefined : '',
      lifetimePrice: versionType === 'Free' ? undefined : '',
    };

    const updatedVersions = [...(formData.versions || []), newVersion];
    setFormData({ ...formData, versions: updatedVersions });
    setActiveVersionTab(newVersion.id);
  };

  const duplicateVersion = (versionId: string, targetVersionType: 'Free' | 'Pro' | 'Studio') => {
    const sourceVersion = formData.versions?.find(v => v.id === versionId);
    if (!sourceVersion) return;

    const newVersion: ToolVersion = {
      ...sourceVersion,
      id: `version-${Date.now()}`,
      versionType: targetVersionType,
      // Reset pricing for Free versions
      pricingModel: targetVersionType === 'Free' ? 'lifetime' : sourceVersion.pricingModel,
      monthlyPrice: targetVersionType === 'Free' ? undefined : sourceVersion.monthlyPrice,
      yearlyPrice: targetVersionType === 'Free' ? undefined : sourceVersion.yearlyPrice,
      lifetimePrice: targetVersionType === 'Free' ? undefined : sourceVersion.lifetimePrice,
    };

    const updatedVersions = [...(formData.versions || []), newVersion];
    setFormData({ ...formData, versions: updatedVersions });
    setActiveVersionTab(newVersion.id);
    setDuplicateModalOpen(false);
    setSourceDuplicateVersionId('');
  };

  const openDuplicateModal = (versionId: string) => {
    setSourceDuplicateVersionId(versionId);
    setDuplicateModalOpen(true);
  };

  const deleteVersion = (versionId: string) => {
    if (!confirm('Are you sure you want to delete this version?')) return;

    const updatedVersions = (formData.versions || []).filter(v => v.id !== versionId);
    setFormData({ ...formData, versions: updatedVersions });

    // Set active tab to first version if current was deleted
    if (activeVersionTab === versionId && updatedVersions.length > 0) {
      setActiveVersionTab(updatedVersions[0].id);
    }
  };

  const updateVersion = (versionId: string, updates: Partial<ToolVersion>) => {
    const updatedVersions = (formData.versions || []).map(v =>
      v.id === versionId ? { ...v, ...updates } : v
    );
    setFormData({ ...formData, versions: updatedVersions });
  };

  const currentVersion = formData.versions?.find(v => v.id === activeVersionTab);
  const sourceVersion = formData.versions?.find(v => v.id === sourceDuplicateVersionId);
  
  // Get available version types (exclude the current version type)
  const allVersionTypes: ('Free' | 'Pro' | 'Studio')[] = ['Free', 'Pro', 'Studio'];
  const existingVersionTypes = (formData.versions || []).map(v => v.versionType);
  const availableVersionTypes = allVersionTypes.filter(type => !existingVersionTypes.includes(type));

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
              setFormData({ ...formData, name, slug });
              setErrors(prev => ({ ...prev, name: '' }));
            }}
            className={`bg-black/50 border-white/20 text-white ${errors.name ? 'border-red-500' : ''}`}
          />
          {errors.name && (
            <p className="text-red-400 text-sm mt-1">{errors.name}</p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Description *
          </label>
          <div className="relative">
            <Textarea
              placeholder="Describe what this tool does"
              value={formData.description}
              onChange={(e) => {
                if (e.target.value.length <= 250) {
                  setFormData({ ...formData, description: e.target.value });
                  setErrors(prev => ({ ...prev, description: '' }));
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

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Status
            </label>
            <AdminSelect
              value={formData.category}
              onChange={(v) => setFormData({ ...formData, category: v })}
              options={statuses.map((s) => ({ value: s, label: s }))}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              URL Slug (auto-generated)
            </label>
            <Input
              placeholder="tool-slug"
              value={formData.slug || ''}
              onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
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
                  setFormData({ ...formData, imageUrl: e.target.value });
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
          <label className="block text-sm font-medium text-gray-300 mb-2">
            FAQs (applies to all versions)
          </label>
          <Textarea
            placeholder="Q: Does it work with CC 2024?&#10;A: Yes, fully compatible with After Effects 2022-2024.&#10;&#10;Q: Can I use it for commercial projects?&#10;A: Absolutely. One license covers all your commercial work."
            value={faqText}
            onChange={(e) => setFaqText(e.target.value)}
            onBlur={() => {
              const faqs = parseFaqText(faqText);
              setFormData({ ...formData, faqs });
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
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Tagline (applies to all versions)
          </label>
          <Input
            placeholder="Perfect for freelancers and small studios"
            value={formData.tagline || ''}
            onChange={(e) => setFormData({ ...formData, tagline: e.target.value })}
            className={`bg-black/50 border-white/20 text-white transition-all duration-700 ${hlClass('tagline')}`}
          />
        </div>

        {/* System Requirements (tool-wide) */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            System Requirements (applies to all versions)
          </label>
          <Textarea
            placeholder="After Effects 2022 or later, macOS 11+ or Windows 10+"
            value={formData.systemRequirements || ''}
            onChange={(e) => setFormData({ ...formData, systemRequirements: e.target.value })}
            className={`bg-black/50 border-white/20 text-white transition-all duration-700 ${hlClass('systemRequirements')}`}
            rows={3}
          />
        </div>

        {/* How It Works (tool-wide) */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            How It Works (applies to all versions)
          </label>
          <Textarea
            placeholder="Step 1: Install | Run the installer and restart After Effects&#10;Step 2: Access panel | Find the toolkit in Window > Extensions&#10;Step 3: Automate | Select tasks and let it handle the rest"
            value={(formData.howItWorks || []).length === 0 ? 'Step 1:  | ' : (formData.howItWorks || []).map((step, idx) => {
              const title = step.title.trim();
              const hasStepPrefix = /^Step \d+:/.test(title);
              const displayTitle = hasStepPrefix ? title : (title ? `Step ${idx + 1}: ${title}` : `Step ${idx + 1}:`);
              return `${displayTitle} | ${step.description}`;
            }).join('\n')}
            onChange={(e) => {
              const lines = e.target.value.split('\n');
              const steps = lines.map((line) => {
                const [title, description] = line.split('|').map(s => s.trim());
                const cleanTitle = title.replace(/^Step \d+:\s*/, '');
                return { title: cleanTitle || '', description: description || '' };
              });
              setFormData({ ...formData, howItWorks: steps });
            }}
            className={`bg-black/50 border-white/20 text-white transition-all duration-700 ${hlClass('howItWorks')}`}
            rows={5}
          />
          <p className="text-xs text-white/40 mt-1">Format: Step X: Title | Description (one per line)</p>
        </div>

        <label className="flex items-center gap-2 text-white">
          <input
            type="checkbox"
            checked={formData.featured}
            onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
            className="w-4 h-4"
          />
          Featured Tool
        </label>
      </div>

      {/* VERSIONS SECTION */}
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h4 className="text-lg font-semibold text-white">Versions & Pricing</h4>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => addVersion('Free')}
              size="sm"
              className="cursor-pointer bg-green-600 hover:bg-green-700 text-white"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Free
            </Button>
            <Button
              type="button"
              onClick={() => addVersion('Pro')}
              size="sm"
              className="cursor-pointer bg-purple-600 hover:bg-purple-700 text-white"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Pro
            </Button>
            <Button
              type="button"
              onClick={() => addVersion('Studio')}
              size="sm"
              className="cursor-pointer bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Studio
            </Button>
          </div>
        </div>

        {formData.versions && formData.versions.length > 0 ? (
          <Tabs value={activeVersionTab} onValueChange={setActiveVersionTab}>
            <TabsList>
              {formData.versions.map((version) => (
                <TabsTrigger key={version.id} value={version.id}>
                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${
                    version.versionType === 'Free' ? 'bg-green-400' :
                    version.versionType === 'Pro' ? 'bg-purple-400' :
                    'bg-blue-400'
                  }`}></span>
                  {version.versionType}
                </TabsTrigger>
              ))}
            </TabsList>

            {formData.versions.map((version) => (
              <TabsContent key={version.id} value={version.id}>
                {currentVersion && currentVersion.id === version.id && (
                  <VersionEditor
                    version={currentVersion}
                    onUpdate={(updates) => updateVersion(version.id, updates)}
                    onDuplicate={() => openDuplicateModal(version.id)}
                    onDelete={() => deleteVersion(version.id)}
                    toolDemoUrl={formData.demoUrl || ''}
                    onUpdateDemoUrl={(url) => setFormData(prev => ({ ...prev, demoUrl: url }))}
                    toolName={formData.name}
                    onRegenerate={() => handleRegenerateVersion(version.id)}
                    isRegenerating={generatingVersionId === version.id}
                    highlightedFields={highlightedFields}
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

      {/* Duplicate Modal */}
      {duplicateModalOpen && sourceVersion && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setDuplicateModalOpen(false)}>
          <div className="bg-gray-900 border border-white/20 rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-xl font-bold text-white mb-4">Duplicate to which version?</h4>
            <p className="text-gray-400 mb-6">
              Duplicating {sourceVersion.versionType} version to:
            </p>
            <div className="space-y-3">
              {availableVersionTypes.map((versionType) => (
                <button
                  key={versionType}
                  onClick={() => duplicateVersion(sourceDuplicateVersionId, versionType)}
                  className={`w-full px-6 py-3 rounded-md font-medium transition-colors flex items-center justify-start gap-3 ${
                    versionType === 'Free'
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : versionType === 'Pro'
                      ? 'bg-purple-600 hover:bg-purple-700 text-white'
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  <span className={`inline-block w-3 h-3 rounded-full ${
                    versionType === 'Free' ? 'bg-green-200' :
                    versionType === 'Pro' ? 'bg-purple-200' :
                    'bg-blue-200'
                  }`}></span>
                  Duplicate to {versionType}
                </button>
              ))}
              {availableVersionTypes.length === 0 && (
                <p className="text-center text-gray-400 py-4">
                  All version types are already created. Delete a version first to duplicate to it.
                </p>
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <Button
                variant="outline"
                onClick={() => setDuplicateModalOpen(false)}
                className="cursor-pointer border-white/30 text-white hover:bg-white/10 hover:border-white/50"
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
            </div>
          </div>
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
  toolName,
  onRegenerate,
  isRegenerating = false,
  highlightedFields = new Set<string>(),
}: {
  version: ToolVersion;
  onUpdate: (updates: Partial<ToolVersion>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  toolDemoUrl: string;
  onUpdateDemoUrl: (url: string) => void;
  toolName: string;
  onRegenerate?: () => void;
  isRegenerating?: boolean;
  highlightedFields?: Set<string>;
}) {
  const vhl = (subKey: string) =>
    highlightedFields.has(`${version.id}:${subKey}`)
      ? 'ring-2 ring-purple-400/70 shadow-[0_0_14px_rgba(192,132,252,0.45)]'
      : '';

  return (
    <div className="space-y-6 p-6 bg-white/5 rounded-lg">
      <div className="flex justify-between items-center mb-4">
        <h5 className="text-white font-semibold flex items-center gap-2">
          <span className={`inline-block w-3 h-3 rounded-full ${
            version.versionType === 'Free' ? 'bg-green-400' :
            version.versionType === 'Pro' ? 'bg-purple-400' :
            'bg-blue-400'
          }`}></span>
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
              disabled={version.versionType === 'Free'}
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
              disabled={version.versionType === 'Free'}
            />
            Subscription (recurring)
          </label>
        </div>
      </div>

      {/* Pricing Fields */}
      {version.versionType !== 'Free' && (
        <div>
          {version.pricingModel === 'subscription' ? (
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
          {version.versionType === 'Free' ? 'Download URL' : 'Lemon Squeezy Checkout URL'}
        </label>
        <Input
          placeholder={
            version.versionType === 'Free'
              ? 'https://your-cdn.com/tool-free.zip'
              : 'https://yourstore.lemonsqueezy.com/buy/variant-id'
          }
          value={version.downloadUrl || ''}
          onChange={(e) => onUpdate({ downloadUrl: e.target.value })}
          className="bg-black/50 border-white/20 text-white"
        />
        {version.versionType !== 'Free' && (
          <p className="text-xs text-white/30 mt-1">
            Paste your Lemon Squeezy checkout link. User email will be pre-filled automatically.
          </p>
        )}
      </div>

      {/* Lemon Squeezy IDs (paid versions only) */}
      {version.versionType !== 'Free' && (
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

      {/* Rich Features Editor */}
      <FeaturesEditor
        versionId={version.id}
        versionType={version.versionType}
        toolName={toolName}
        richFeatures={version.richFeatures || []}
        onChange={(rf) => onUpdate({ richFeatures: rf })}
        highlightClass={vhl('richFeatures')}
      />

      {/* What's Included */}
      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          What's Included (Optional)
        </label>
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
        <label className="block text-sm font-medium text-gray-300 mb-1">
          🔑 How to Activate (Optional)
        </label>
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
  versionId,
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
          }));
          onChange(merged);
        } else {
          onChange(result.richFeatures.map((ai: any) => ({
            ...ai,
            screenshots: [''],
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
            Showcased on the tool page — each feature gets a title, description, and carousel of images/GIFs.
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
              <div className="flex items-center gap-2">
                <GripVertical className="w-3.5 h-3.5 text-white/20" />
                <span className="text-white/40 text-xs font-mono font-semibold tracking-wide">
                  Feature {fIdx + 1}
                </span>
                {feature.title && (
                  <span className="text-white/60 text-xs truncate max-w-[160px]">— {feature.title}</span>
                )}
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