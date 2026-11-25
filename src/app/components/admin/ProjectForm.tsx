// Project editor — split out of pages/Admin.tsx.
import { useState } from 'react';
import React from 'react';
import { useDirtyTracking } from '../../hooks/useDirtyTracking';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { AdminSelect } from './AdminSelect';
import { Save, X, Upload, Sparkles } from 'lucide-react';
import { AIImproveModal, type AIImproveContext } from './AIImproveModal';
import { publicAnonKey } from '/utils/supabase/info';
import { VimeoPicker } from './VimeoPicker';
import { BunnyUploader } from './BunnyUploader';
import { BunnyPicker } from './BunnyPicker';
import { detectVideoProvider, getBunnyAutoThumbnailUrl } from '../../utils/videoProvider';
import { VideoThumbnailCapture } from './VideoThumbnailCapture';
import { API_BASE, createSlug, type Project, type Tool, fetchWithRetry } from './adminShared';

/**
 * Fetches the thumbnail for a Vimeo URL via the public oEmbed endpoint (CORS-safe)
 * and renders it like any other image card in the gallery.
 */
export function VimeoThumb({ url, vimeoId }: { url: string; vimeoId: string }) {
  const [thumb, setThumb] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}&width=480`)
      .then(r => r.json())
      .then(d => { if (!cancelled && d?.thumbnail_url) setThumb(d.thumbnail_url); })
      .catch(() => { /* private or unavailable — keep logo fallback */ });
    return () => { cancelled = true; };
  }, [url]);

  if (thumb) {
    return (
      <img
        src={thumb}
        alt={`Vimeo ${vimeoId}`}
        className="w-full h-full object-cover"
        onError={() => setThumb(null)}
      />
    );
  }

  /* Fallback: Vimeo logo + ID while loading or if thumbnail unavailable */
  return (
    <div className="w-full h-full flex flex-col items-center justify-center gap-1 bg-[#1ab7ea]/5">
      <svg className="w-7 h-7 text-[#1ab7ea]" viewBox="0 0 24 24" fill="currentColor">
        <path d="M22.875 8.396c-.097 2.114-1.577 5.01-4.437 8.688C15.476 20.83 12.958 22.667 10.884 22.667c-1.253 0-2.31-1.156-3.173-3.467l-1.728-6.34C5.25 10.549 4.567 9.393 3.834 9.393c-.155 0-.7.327-1.63.977L1 9.016a354.35 354.35 0 0 0 2.609-2.329C5.15 5.3 6.296 4.59 7.076 4.514c1.988-.19 3.21 1.168 3.666 4.073.494 3.126.838 5.071 1.03 5.836.572 2.597 1.2 3.895 1.884 3.895.532 0 1.33-.842 2.394-2.525 1.063-1.683 1.63-2.963 1.7-3.84.152-1.452-.419-2.178-1.7-2.178a4.74 4.74 0 0 0-1.884.42c1.25-4.09 3.637-6.077 7.16-5.96 2.612.077 3.843 1.77 3.693 5.08l-.144.08z"/>
      </svg>
      <span className="text-[10px] text-[#1ab7ea]/70 font-mono">{vimeoId}</span>
    </div>
  );
}

export function ProjectForm({
  project,
  onSave,
  onCancel,
  categories,
  onDirtyChange,
}: {
  project: Project;
  onSave: (project: Project) => Promise<{ success: boolean; message: string }>;
  onCancel: () => void;
  categories: string[];
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [formData, setFormData] = useState({
    ...project,
    title: project.title || '',
    description: project.description || '',
    category: project.category || '',
    imageUrl: project.imageUrl || '',
    videoUrl: project.videoUrl || '',
    tags: project.tags || [],
    screenshots: project.screenshots || [],
    year: project.year || new Date().getFullYear(),
    featured: project.featured || false,
  });
  const markSaved = useDirtyTracking(formData, onDirtyChange);
  const [uploading, setUploading] = useState(false);
  const [imageInputMode, setImageInputMode] = useState<'url' | 'upload'>('url');
  const [screenshotsInputMode, setScreenshotsInputMode] = useState<'url' | 'upload' | 'bunny' | 'bunny-lib' | 'vimeo'>('url');
  const [uploadingScreenshots, setUploadingScreenshots] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [showThumbnailSelector, setShowThumbnailSelector] = useState(false);
  // AI state
  const [generating, setGenerating] = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');
  const [improveExisting, setImproveExisting] = useState(false);
  const [showAiOptions, setShowAiOptions] = useState(false);
  const [highlightedFields, setHighlightedFields] = useState<Set<string>>(new Set());
  const [thumbnailOptions, setThumbnailOptions] = useState<string[]>([]);
  const [loadingThumbnails, setLoadingThumbnails] = useState(false);
  const [showVideoCapture, setShowVideoCapture] = useState(false);
  const [showVimeoPicker, setShowVimeoPicker]   = useState(false);
  const [showScreenshotsVimeoPicker, setShowScreenshotsVimeoPicker] = useState(false);
  // New default upload path: Bunny Stream. Vimeo picker above stays for
  // legacy imports of surviving videos.
  const [showBunnyUploader, setShowBunnyUploader] = useState(false);
  const [showScreenshotsBunnyUploader, setShowScreenshotsBunnyUploader] = useState(false);
  // Browse existing Bunny library — parallel to the Vimeo picker
  const [showBunnyPicker, setShowBunnyPicker] = useState(false);
  const [showScreenshotsBunnyPicker, setShowScreenshotsBunnyPicker] = useState(false);
  const [capturedFrames, setCapturedFrames] = useState<string[]>([]);
  const [selectedThumbnailIndex, setSelectedThumbnailIndex] = useState<number | null>(null);
  // Per-field AI improve modal
  const [aiModal, setAiModal] = useState<null | {
    fieldLabel: string; fieldKey: string; currentValue: string;
    context: AIImproveContext; onApply: (v: string) => void;
  }>(null);

  const openProjectAiModal = (
    fieldKey: string, fieldLabel: string, currentValue: string,
    onApply: (v: string) => void
  ) => {
    setAiModal({
      fieldKey, fieldLabel, currentValue,
      context: { entityType: 'project', title: formData.title, category: formData.category },
      onApply,
    });
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

  const handleScreenshotsUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadingScreenshots(true);
    setErrors(prev => ({ ...prev, screenshotsUpload: '' }));
    
    try {
      const token = localStorage.getItem('admin_token');
      const uploadedUrls: string[] = [];
      
      // Upload each file — route videos to /upload-video, images to /upload-image
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isVideo = file.type.startsWith('video/');
        const endpoint = isVideo ? `${API_BASE}/upload-video` : `${API_BASE}/upload-image`;
        const uploadFormData = new FormData();
        uploadFormData.append('file', file);

        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${publicAnonKey}`,
            'X-Admin-Token': token || '',
          },
          body: uploadFormData,
        });

        const result = await response.json();
        if (result.success) {
          uploadedUrls.push(result.data.url);
        } else {
          throw new Error(`Failed to upload ${file.name}: ${result.error}`);
        }
      }
      
      // Add uploaded URLs to existing screenshots
      setFormData(prev => ({ 
        ...prev, 
        screenshots: [...(prev.screenshots || []), ...uploadedUrls] 
      }));
      setErrors(prev => ({ ...prev, screenshotsUpload: '' }));
    } catch (error) {
      console.error('Screenshots upload error:', error);
      setErrors(prev => ({ 
        ...prev, 
        screenshotsUpload: `Failed to upload screenshots: ${error}` 
      }));
    } finally {
      setUploadingScreenshots(false);
      // Reset file input
      e.target.value = '';
    }
  };

  const removeScreenshot = (index: number) => {
    setFormData(prev => ({
      ...prev,
      screenshots: (prev.screenshots || []).filter((_, i) => i !== index)
    }));
    setGallerySelected(new Set());
  };

  // ── Gallery management: reorder (drag / arrows), multi-select remove ──
  const [gallerySelectMode, setGallerySelectMode] = useState(false);
  const [gallerySelected, setGallerySelected] = useState<Set<number>>(new Set());
  const [galleryDragFrom, setGalleryDragFrom] = useState<number | null>(null);
  const [galleryDragOver, setGalleryDragOver] = useState<number | null>(null);

  const moveScreenshot = (from: number, to: number) => {
    setFormData(prev => {
      const list = [...(prev.screenshots || [])];
      if (from < 0 || from >= list.length || to < 0 || to >= list.length || from === to) return prev;
      const [item] = list.splice(from, 1);
      list.splice(to, 0, item);
      return { ...prev, screenshots: list };
    });
  };

  const toggleGallerySelected = (index: number) => {
    setGallerySelected(prev => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  };

  const removeSelectedScreenshots = () => {
    if (!gallerySelected.size) return;
    if (!confirm(`Remove ${gallerySelected.size} item${gallerySelected.size !== 1 ? 's' : ''} from the gallery?`)) return;
    setFormData(prev => ({
      ...prev,
      screenshots: (prev.screenshots || []).filter((_, i) => !gallerySelected.has(i)),
    }));
    setGallerySelected(new Set());
    setGallerySelectMode(false);
  };

  // AI helpers
  const applyHighlight = (fields: string[]) => {
    if (fields.length === 0) return;
    setHighlightedFields(new Set(fields));
    setTimeout(() => setHighlightedFields(new Set()), 3500);
  };
  const hlClass = (key: string) =>
    highlightedFields.has(key) ? 'ring-2 ring-purple-400/70 shadow-[0_0_14px_rgba(192,132,252,0.45)]' : '';

  const handleAutoFill = async () => {
    if (!formData.title?.trim()) {
      setFormMessage({ type: 'error', text: 'Enter a project title first so the AI knows what to generate.' });
      return;
    }
    setGenerating(true);
    setFormMessage(null);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetchWithRetry(`${API_BASE}/admin/generate-project-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}`, 'X-Admin-Token': token || '' },
        body: JSON.stringify({
          project: {
            title: formData.title, category: formData.category,
            description: formData.description, goal: formData.goal,
            approach: formData.approach, outcome: formData.outcome,
            deliverables: formData.deliverables, tags: formData.tags,
            client: formData.client,
          },
          instruction: aiInstruction, improveExisting,
        }),
      });
      const result = await response.json();
      if (!result.success) {
        setFormMessage({ type: 'error', text: result.error || 'Failed to generate content.' });
        return;
      }
      if (result.nothingToGenerate) {
        setFormMessage({ type: 'success', text: '✨ All fields are already filled — nothing to generate.' });
        return;
      }
      const data = result.data;
      const updates: Partial<typeof formData> = {};
      const changed: string[] = [];
      if (data.description && (improveExisting || !formData.description?.trim())) {
        updates.description = String(data.description).slice(0, 250); changed.push('description');
      }
      if (data.goal && (improveExisting || !formData.goal?.trim())) {
        updates.goal = data.goal; changed.push('goal');
      }
      if (data.approach && (improveExisting || !formData.approach?.trim())) {
        updates.approach = data.approach; changed.push('approach');
      }
      if (data.outcome && (improveExisting || !formData.outcome?.trim())) {
        updates.outcome = data.outcome; changed.push('outcome');
      }
      const tagsEmpty = !formData.tags?.length || formData.tags.every(t => !t.trim());
      if (data.tags && (improveExisting || tagsEmpty)) {
        updates.tags = data.tags; changed.push('tags');
      }
      const delivEmpty = !formData.deliverables?.length || formData.deliverables.every(d => !d.trim());
      if (data.deliverables && (improveExisting || delivEmpty)) {
        updates.deliverables = data.deliverables; changed.push('deliverables');
      }
      setFormData(prev => ({ ...prev, ...updates }));
      applyHighlight(changed);
      setFormMessage({ type: 'success', text: `✨ ${improveExisting ? 'Content rewritten' : 'Content generated'}! Review each field and adjust as needed.` });
    } catch (err) {
      console.warn('Auto-fill failed:', err);
      setFormMessage({ type: 'error', text: 'Could not reach the server. Please wait a moment and try again.' });
    } finally {
      setGenerating(false);
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.title?.trim()) {
      newErrors.title = 'Project title is required';
    }
    if (!formData.description?.trim()) {
      newErrors.description = 'Description is required';
    }
    if (!formData.category?.trim()) {
      newErrors.category = 'Category is required';
    }
    if (!formData.year || formData.year < 1900 || formData.year > 2100) {
      newErrors.year = 'Valid year is required';
    }
    if (!formData.imageUrl?.trim()) {
      newErrors.imageUrl = 'Image is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (validateForm()) {
      setSaving(true);
      setFormMessage(null);
      const result = await onSave(formData);
      if (result.success) markSaved();
      setSaving(false);
      setFormMessage({ type: result.success ? 'success' : 'error', text: result.message });
      if (result.success) {
        setTimeout(() => onCancel(), 1500);
      }
    } else {
      setFormMessage({ type: 'error', text: 'Please fix the validation errors before saving.' });
    }
  };

  return (
    <div className="mb-6 p-6 bg-white/10 rounded-lg border border-white/20">
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xl font-bold text-white">
            {project.title ? 'Edit Project' : 'New Project'}
          </h3>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowAiOptions(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm text-purple-300 bg-purple-500/10 border border-purple-400/20 hover:bg-purple-500/20 transition-all duration-150 select-none"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <circle cx="12" cy="12" r="3" />
              </svg>
              AI Options {showAiOptions ? '▲' : '▼'}
            </button>
            <button
              type="button"
              onClick={handleAutoFill}
              disabled={generating || !formData.title?.trim()}
              title={!formData.title?.trim() ? 'Enter a project title first' : improveExisting ? 'Rewrite all fields with Gemini AI' : 'Auto-fill empty fields using Gemini AI'}
              className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 select-none disabled:opacity-40 disabled:cursor-not-allowed ${generating ? 'bg-purple-500/20 border border-purple-400/40 text-purple-300 cursor-wait' : 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-fuchsia-500 border border-purple-400/30 text-white shadow-lg shadow-purple-900/40 active:scale-95'}`}
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
                placeholder='e.g. "Focus on the technical complexity · Use a cinematic tone · Emphasize brand impact"'
                className="w-full px-3 py-2 bg-black/40 border border-purple-400/20 rounded-lg text-white text-sm placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-purple-400/50"
              />
              <p className="text-xs text-white/30 mt-1">Gemini will use this to guide tone, focus, and style for all generated content.</p>
            </div>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => setImproveExisting(v => !v)}
                className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${improveExisting ? 'bg-purple-500' : 'bg-white/10'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${improveExisting ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
              <div>
                <span className="text-sm text-white font-medium">Rewrite existing content</span>
                <p className="text-xs text-white/40">When on, Gemini rewrites ALL fields — not just empty ones.</p>
              </div>
            </label>
          </div>
        )}
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Project Title *
          </label>
          <Input
            placeholder="Enter project title"
            value={formData.title || ''}
            onChange={(e) => {
              const newTitle = e.target.value;
              // Auto-update slug from title unless user has manually customised it
              const currentSlug = formData.slug || '';
              const prevAutoSlug = createSlug(formData.title || '');
              const slugWasAutoGenerated = !currentSlug || currentSlug === prevAutoSlug;
              setFormData({
                ...formData,
                title: newTitle,
                slug: slugWasAutoGenerated ? createSlug(newTitle) : currentSlug,
              });
              setErrors(prev => ({ ...prev, title: '' }));
            }}
            className={`bg-black/30 backdrop-blur-xl border-white/20 text-white ${errors.title ? 'border-red-500' : ''}`}
          />
          {errors.title && (
            <p className="text-red-400 text-sm mt-1">{errors.title}</p>
          )}
        </div>

        {/* Slug field — auto-filled from title, editable for custom overrides */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            URL Slug
            <span className="ml-2 text-xs text-white/40 font-normal">(auto-generated from title — edit to customise)</span>
          </label>
          <div className="flex items-center gap-2">
            <span className="text-white/40 text-sm shrink-0">/projects/</span>
            <Input
              placeholder="url-friendly-slug"
              value={formData.slug || createSlug(formData.title || '')}
              onChange={(e) => {
                const raw = e.target.value
                  .toLowerCase()
                  .replace(/[^\w\s-]/g, '')
                  .replace(/\s+/g, '-')
                  .replace(/--+/g, '-');
                setFormData({ ...formData, slug: raw });
              }}
              className="bg-black/30 backdrop-blur-xl border-white/20 text-white font-mono text-sm"
            />
          </div>
          <p className="text-xs text-purple-400/70 mt-1">
            Final URL: /projects/{formData.slug || createSlug(formData.title || '')}
          </p>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-300">Short Description *</label>
            <button type="button" onClick={() => openProjectAiModal('description', 'Description', formData.description || '', (v) => setFormData(prev => ({ ...prev, description: v })))} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-400/15 transition-all duration-150"><Sparkles className="w-3 h-3" />Improve</button>
          </div>
          <div className="relative">
            <Textarea
              placeholder="Brief description shown on project cards"
              value={formData.description || ''}
              onChange={(e) => {
                setFormData({ ...formData, description: e.target.value });
                setErrors(prev => ({ ...prev, description: '' }));
              }}
              className={`bg-black/50 border-white/20 text-white transition-all duration-700 ${errors.description ? 'border-red-500' : ''} ${hlClass('description')}`}
              rows={3}
            />
          </div>
          {errors.description && (
            <p className="text-red-400 text-sm mt-1">{errors.description}</p>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Category *
            </label>
            <AdminSelect
              value={formData.category || ''}
              onChange={(v) => {
                setFormData({ ...formData, category: v });
                setErrors(prev => ({ ...prev, category: '' }));
              }}
              options={categories.map((c) => ({ value: c, label: c }))}
              placeholder="Select category"
              className={errors.category ? 'ring-1 ring-red-500 rounded-lg' : ''}
            />
            {errors.category && (
              <p className="text-red-400 text-sm mt-1">{errors.category}</p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Year *
            </label>
            <Input
              type="number"
              placeholder="2024"
              value={formData.year}
              onChange={(e) => {
                setFormData({ ...formData, year: parseInt(e.target.value) });
                setErrors(prev => ({ ...prev, year: '' }));
              }}
              className={`bg-black/50 border-white/20 text-white ${errors.year ? 'border-red-500' : ''}`}
            />
            {errors.year && (
              <p className="text-red-400 text-sm mt-1">{errors.year}</p>
            )}
          </div>
        </div>
        
        {/* Image input with toggle */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Project Image *
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
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
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  onClick={() => document.getElementById('projectImageUpload')?.click()}
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
              </div>
              <input
                type="file"
                id="projectImageUpload"
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
              {errors.imageUrl && !errors.imageUpload && (
                <p className="text-red-400 text-sm mt-1">{errors.imageUrl}</p>
              )}
            </div>
          )}
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Video URL (Optional)
          </label>
          <div className="space-y-2">
            <div className="flex gap-2 flex-wrap">
              <Input
                placeholder="https://iframe.mediadelivery.net/..., youtube.com/..., or vimeo.com/..."
                value={formData.videoUrl || ''}
                onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                className="bg-black/50 border-white/20 text-white flex-1 min-w-[240px]"
              />
              {/* Upload to Bunny — new default upload path (Vimeo dropped 90% of
                  our videos when they moved to a 500 MB free tier). */}
              <Button
                type="button"
                onClick={() => setShowBunnyUploader(true)}
                className="cursor-pointer bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-semibold whitespace-nowrap"
              >
                <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                </svg>
                Upload to Bunny
              </Button>
              {/* Browse existing Bunny library — the picker equivalent, for
                  reusing videos already uploaded (no re-upload). */}
              <Button
                type="button"
                onClick={() => setShowBunnyPicker(true)}
                className="cursor-pointer bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/40 text-orange-300 whitespace-nowrap"
              >
                <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 6h16M4 12h16M4 18h10" />
                </svg>
                Browse Bunny
              </Button>
              {/* Browse Vimeo library — kept for importing surviving legacy videos. */}
              <Button
                type="button"
                onClick={() => setShowVimeoPicker(true)}
                className="cursor-pointer bg-[#1ab7ea]/20 hover:bg-[#1ab7ea]/30 border border-[#1ab7ea]/40 text-[#1ab7ea] whitespace-nowrap"
              >
                <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M22.875 8.396c-.097 2.114-1.577 5.01-4.437 8.688C15.476 20.83 12.958 22.667 10.884 22.667c-1.253 0-2.31-1.156-3.173-3.467l-1.728-6.34C5.25 10.549 4.567 9.393 3.834 9.393c-.155 0-.7.327-1.63.977L1 9.016a354.35 354.35 0 0 0 2.609-2.329C5.15 5.3 6.296 4.59 7.076 4.514c1.988-.19 3.21 1.168 3.666 4.073.494 3.126.838 5.071 1.03 5.836.572 2.597 1.2 3.895 1.884 3.895.532 0 1.33-.842 2.394-2.525 1.063-1.683 1.63-2.963 1.7-3.84.152-1.452-.419-2.178-1.7-2.178a4.74 4.74 0 0 0-1.884.42c1.25-4.09 3.637-6.077 7.16-5.96 2.612.077 3.843 1.77 3.693 5.08l-.144.08z"/>
                </svg>
                Browse Vimeo
              </Button>
              <Button
                type="button"
                onClick={() => {
                  if (!formData.videoUrl) {
                    setFormMessage({ type: 'error', text: 'Please enter a video URL before capturing thumbnails.' });
                    return;
                  }
                  setFormMessage(null);
                  setShowVideoCapture(true);
                }}
                className="cursor-pointer bg-gradient-to-r from-purple-600 to-blue-600 text-white whitespace-nowrap"
              >
                Capture Thumbnails
              </Button>
            </div>
            <p className="text-xs text-gray-400">
              <span className="text-orange-400 font-semibold">Upload to Bunny</span> for a new video, or
              <span className="text-orange-300"> Browse Bunny</span> / <span className="text-[#1ab7ea]">Browse Vimeo</span> to
              pick from an existing library, or paste any URL directly.
            </p>
          </div>
        </div>
        
        {/* Bunny Uploader — main video URL field, new default upload path */}
        {showBunnyUploader && (
          <BunnyUploader
            onSelect={(url, title) => {
              setFormData({ ...formData, videoUrl: url });
              setShowBunnyUploader(false);
              setFormMessage({ type: 'success', text: `✅ Uploaded to Bunny: "${title}"` });
            }}
            onClose={() => setShowBunnyUploader(false)}
          />
        )}

        {/* Bunny Picker — main video URL field, browse existing library */}
        {showBunnyPicker && (
          <BunnyPicker
            onSelect={(url, title) => {
              setFormData({ ...formData, videoUrl: url });
              setShowBunnyPicker(false);
              setFormMessage({ type: 'success', text: `✅ Video selected: "${title}"` });
            }}
            onClose={() => setShowBunnyPicker(false)}
          />
        )}

        {/* Vimeo Video Picker — main video URL field */}
        {showVimeoPicker && (
          <VimeoPicker
            onSelect={(url, title) => {
              setFormData({ ...formData, videoUrl: url });
              setShowVimeoPicker(false);
              setFormMessage({ type: 'success', text: `✅ Video selected: "${title}"` });
            }}
            onClose={() => setShowVimeoPicker(false)}
          />
        )}

        {/* Bunny Uploader — media gallery */}
        {showScreenshotsBunnyUploader && (
          <BunnyUploader
            onSelect={(url, _title) => {
              const nextScreenshots = [...(formData.screenshots || []), url];
              setFormData({ ...formData, screenshots: nextScreenshots });
              setShowScreenshotsBunnyUploader(false);
              setFormMessage({ type: 'success', text: '✅ Video added to gallery from Bunny' });
            }}
            onClose={() => setShowScreenshotsBunnyUploader(false)}
          />
        )}

        {/* Bunny Picker — media gallery (keeps picker open for multi-pick) */}
        {showScreenshotsBunnyPicker && (
          <BunnyPicker
            selectedUrls={formData.screenshots || []}
            onSelect={(url, title) => {
              const current = formData.screenshots || [];
              // Toggle: if already selected, remove; else add.
              const nextScreenshots = current.includes(url)
                ? current.filter((s: string) => s !== url)
                : [...current, url];
              setFormData({ ...formData, screenshots: nextScreenshots });
              setFormMessage({
                type: 'success',
                text: current.includes(url)
                  ? `Removed "${title}" from gallery`
                  : `✅ Added "${title}" to gallery`,
              });
              // Keep picker open so user can select multiple
            }}
            onSelectMany={(items) => {
              setFormData(prev => {
                const current = prev.screenshots || [];
                const fresh = items.map(i => i.url).filter(u => !current.includes(u));
                return { ...prev, screenshots: [...current, ...fresh] };
              });
              setShowScreenshotsBunnyPicker(false);
              setFormMessage({
                type: 'success',
                text: items.length
                  ? `✅ Added ${items.length} video${items.length !== 1 ? 's' : ''} from the collection — remove any you don't want below`
                  : 'All videos in that collection are already in the gallery',
              });
            }}
            onClose={() => setShowScreenshotsBunnyPicker(false)}
          />
        )}

        {/* Vimeo Video Picker — media gallery (keeps picker open for multi-pick) */}
        {showScreenshotsVimeoPicker && (
          <VimeoPicker
            selectedUrls={formData.screenshots || []}
            onSelect={(url, title) => {
              setFormData(prev => {
                const already = (prev.screenshots || []).includes(url);
                const next = already
                  ? (prev.screenshots || []).filter(u => u !== url)
                  : [...(prev.screenshots || []), url];
                setFormMessage({
                  type: 'success',
                  text: already ? `🗑 "${title}" removed from gallery` : `✅ "${title}" added to gallery`,
                });
                return { ...prev, screenshots: next };
              });
              // Keep picker open so user can add/remove multiple videos
            }}
            onClose={() => setShowScreenshotsVimeoPicker(false)}
          />
        )}

        {/* Video Thumbnail Capture Tool */}
        {showVideoCapture && (
          <VideoThumbnailCapture
            videoUrl={formData.videoUrl}
            initialFrames={capturedFrames}
            onApply={(frames, selectedIdx) => {
              setCapturedFrames(frames);
              setSelectedThumbnailIndex(selectedIdx);
              if (selectedIdx !== null && frames[selectedIdx]) {
                setFormData(prev => ({ ...prev, imageUrl: frames[selectedIdx] }));
                setErrors(prev => ({ ...prev, imageUrl: '' }));
                setFormMessage({ type: 'success', text: '✅ Thumbnail applied as project image.' });
              }
            }}
            onClose={() => setShowVideoCapture(false)}
          />
        )}
        
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="block text-sm font-medium text-gray-300">Tags</label>
            <button type="button" onClick={() => openProjectAiModal('tags', 'Tags', formData.tags.join(', '), (v) => setFormData(prev => ({ ...prev, tags: v.split(',').map(t => t.trim()).filter(Boolean) })))} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-400/15 transition-all duration-150"><Sparkles className="w-3 h-3" />Improve</button>
          </div>
          <Input
            placeholder="Motion Design, Brand, Product (comma-separated)"
            value={formData.tags.join(', ')}
            onChange={(e) =>
              setFormData({ ...formData, tags: e.target.value.split(',').map((t) => t.trim()) })
            }
            className={`bg-black/50 border-white/20 text-white transition-all duration-700 ${hlClass('tags')}`}
          />
        </div>
        
        {/* New Project Detail Fields */}
        <div className="border-t border-white/20 pt-4 mt-4">
          <h4 className="text-white font-semibold mb-4">Project Details (for detail page)</h4>
          
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">Client Name <span className="text-white/30 font-normal">(Optional)</span></label>
                <button type="button" onClick={() => openProjectAiModal('client', 'Client Name', formData.client || '', (v) => setFormData(prev => ({ ...prev, client: v })))} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-400/15 transition-all duration-150"><Sparkles className="w-3 h-3" />Improve</button>
              </div>
              <Input
                placeholder="e.g., TechCorp Financial"
                value={formData.client || ''}
                onChange={(e) => setFormData({ ...formData, client: e.target.value })}
                className="bg-black/50 border-white/20 text-white"
              />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">Goal <span className="text-white/30 font-normal">(Optional)</span></label>
                <button type="button" onClick={() => openProjectAiModal('goal', 'Goal', formData.goal || '', (v) => setFormData(prev => ({ ...prev, goal: v })))} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-400/15 transition-all duration-150"><Sparkles className="w-3 h-3" />Improve</button>
              </div>
              <Textarea
                placeholder="Describe the project goal and objectives"
                value={formData.goal || ''}
                onChange={(e) => setFormData({ ...formData, goal: e.target.value })}
                className={`bg-black/50 border-white/20 text-white transition-all duration-700 ${hlClass('goal')}`}
                rows={3}
              />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">Approach <span className="text-white/30 font-normal">(Optional)</span></label>
                <button type="button" onClick={() => openProjectAiModal('approach', 'Approach', formData.approach || '', (v) => setFormData(prev => ({ ...prev, approach: v })))} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-400/15 transition-all duration-150"><Sparkles className="w-3 h-3" />Improve</button>
              </div>
              <Textarea
                placeholder="Explain the creative approach and process"
                value={formData.approach || ''}
                onChange={(e) => setFormData({ ...formData, approach: e.target.value })}
                className={`bg-black/50 border-white/20 text-white transition-all duration-700 ${hlClass('approach')}`}
                rows={3}
              />
            </div>
          
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">Deliverables <span className="text-white/30 font-normal">(Optional)</span></label>
                <button type="button" onClick={() => openProjectAiModal('deliverables', 'Deliverables', (formData.deliverables || []).join('\n'), (v) => setFormData(prev => ({ ...prev, deliverables: v.split('\n').filter(d => d.trim()) })))} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-400/15 transition-all duration-150"><Sparkles className="w-3 h-3" />Improve</button>
              </div>
              <Textarea
                placeholder="Enter each deliverable on a new line&#10;e.g.:&#10;90-second explainer video&#10;Social media cutdowns&#10;Brand guidelines"
                value={(formData.deliverables || []).join('\n')}
                onChange={(e) => setFormData({ ...formData, deliverables: e.target.value.split('\n') })}
                className={`bg-black/50 border-white/20 text-white transition-all duration-700 ${hlClass('deliverables')}`}
                rows={4}
              />
            </div>
            
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-gray-300">Outcome <span className="text-white/30 font-normal">(Optional)</span></label>
                <button type="button" onClick={() => openProjectAiModal('outcome', 'Outcome', formData.outcome || '', (v) => setFormData(prev => ({ ...prev, outcome: v })))} className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-purple-300 hover:text-white bg-purple-500/10 hover:bg-purple-500/20 border border-purple-400/15 transition-all duration-150"><Sparkles className="w-3 h-3" />Improve</button>
              </div>
              <Textarea
                placeholder="Describe the results and impact"
                value={formData.outcome || ''}
                onChange={(e) => setFormData({ ...formData, outcome: e.target.value })}
                className={`bg-black/50 border-white/20 text-white transition-all duration-700 ${hlClass('outcome')}`}
                rows={3}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Media Gallery — Images, GIFs &amp; Videos (Optional)
              </label>

              {/* Tab bar */}
              <div className="flex flex-wrap gap-2 mb-3">
                {(['url', 'upload', 'bunny', 'bunny-lib', 'vimeo'] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setScreenshotsInputMode(mode)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                      screenshotsInputMode === mode
                        ? 'bg-purple-500 text-white'
                        : 'bg-white/10 text-gray-400 hover:bg-white/20'
                    }`}
                  >
                    {mode === 'url' && 'Paste URLs'}
                    {mode === 'upload' && 'Upload Files'}
                    {mode === 'bunny' && (
                      <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                        </svg>
                        Upload to Bunny
                      </span>
                    )}
                    {mode === 'bunny-lib' && (
                      <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M4 6h16M4 12h16M4 18h10" />
                        </svg>
                        Browse Bunny
                      </span>
                    )}
                    {mode === 'vimeo' && (
                      <span className="flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M22.875 8.396c-.097 2.114-1.577 5.01-4.437 8.688C15.476 20.83 12.958 22.667 10.884 22.667c-1.253 0-2.31-1.156-3.173-3.467l-1.728-6.34C5.25 10.549 4.567 9.393 3.834 9.393c-.155 0-.7.327-1.63.977L1 9.016a354.35 354.35 0 0 0 2.609-2.329C5.15 5.3 6.296 4.59 7.076 4.514c1.988-.19 3.21 1.168 3.666 4.073.494 3.126.838 5.071 1.03 5.836.572 2.597 1.2 3.895 1.884 3.895.532 0 1.33-.842 2.394-2.525 1.063-1.683 1.63-2.963 1.7-3.84.152-1.452-.419-2.178-1.7-2.178a4.74 4.74 0 0 0-1.884.42c1.25-4.09 3.637-6.077 7.16-5.96 2.612.077 3.843 1.77 3.693 5.08l-.144.08z"/>
                        </svg>
                        Browse Vimeo
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Paste URLs panel */}
              {screenshotsInputMode === 'url' && (
                <Textarea
                  placeholder="Enter image or video URLs (one per line)&#10;e.g.:&#10;https://images.unsplash.com/photo-xxx&#10;https://vimeo.com/123456789"
                  value={(formData.screenshots || []).join('\n')}
                  onChange={(e) => setFormData({ ...formData, screenshots: e.target.value.split('\n') })}
                  className="bg-black/50 border-white/20 text-white"
                  rows={4}
                />
              )}

              {/* Upload panel — images AND videos */}
              {screenshotsInputMode === 'upload' && (
                <div>
                  <Button
                    type="button"
                    onClick={() => document.getElementById('screenshotsUpload')?.click()}
                    disabled={uploadingScreenshots}
                    className="cursor-pointer bg-white/10 hover:bg-white/20 text-white"
                  >
                    {uploadingScreenshots ? (
                      <>Uploading…</>
                    ) : (
                      <>
                        <Upload className="w-4 h-4 mr-2" />
                        Select Images or Videos
                      </>
                    )}
                  </Button>
                  <input
                    type="file"
                    id="screenshotsUpload"
                    accept="image/*,video/mp4,video/webm,video/quicktime,video/x-msvideo"
                    multiple
                    onChange={handleScreenshotsUpload}
                    className="hidden"
                  />
                  <p className="text-xs text-gray-400 mt-2">
                    Supports PNG, JPEG, GIF, WebP and MP4, WebM, MOV, AVI · Multiple files at once
                  </p>
                  {errors.screenshotsUpload && (
                    <p className="text-red-400 text-sm mt-1">{errors.screenshotsUpload}</p>
                  )}
                </div>
              )}

              {/* Bunny uploader panel */}
              {screenshotsInputMode === 'bunny' && (
                <div className="flex flex-wrap items-center gap-3 py-2">
                  <Button
                    type="button"
                    onClick={() => setShowScreenshotsBunnyUploader(true)}
                    className="cursor-pointer bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-400 hover:to-amber-400 text-white font-semibold"
                  >
                    <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
                    </svg>
                    Upload a video to Bunny
                  </Button>
                  <p className="text-xs text-gray-400">
                    Video encodes on Bunny; a URL is added to the gallery when it's done.
                  </p>
                </div>
              )}

              {/* Bunny picker panel (browse existing library) */}
              {screenshotsInputMode === 'bunny-lib' && (
                <div className="flex flex-wrap items-center gap-3 py-2">
                  <Button
                    type="button"
                    onClick={() => setShowScreenshotsBunnyPicker(true)}
                    className="cursor-pointer bg-orange-500/15 hover:bg-orange-500/25 border border-orange-500/40 text-orange-300"
                  >
                    <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 6h16M4 12h16M4 18h10" />
                    </svg>
                    Browse Bunny library
                  </Button>
                  <p className="text-xs text-gray-400">
                    Pick a video already in your library — no re-upload.
                  </p>
                </div>
              )}

              {/* Vimeo picker panel */}
              {screenshotsInputMode === 'vimeo' && (
                <div className="flex flex-wrap items-center gap-3 py-2">
                  <Button
                    type="button"
                    onClick={() => setShowScreenshotsVimeoPicker(true)}
                    className="cursor-pointer bg-[#1ab7ea]/20 hover:bg-[#1ab7ea]/30 border border-[#1ab7ea]/40 text-[#1ab7ea]"
                  >
                    <svg className="w-4 h-4 mr-1.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M22.875 8.396c-.097 2.114-1.577 5.01-4.437 8.688C15.476 20.83 12.958 22.667 10.884 22.667c-1.253 0-2.31-1.156-3.173-3.467l-1.728-6.34C5.25 10.549 4.567 9.393 3.834 9.393c-.155 0-.7.327-1.63.977L1 9.016a354.35 354.35 0 0 0 2.609-2.329C5.15 5.3 6.296 4.59 7.076 4.514c1.988-.19 3.21 1.168 3.666 4.073.494 3.126.838 5.071 1.03 5.836.572 2.597 1.2 3.895 1.884 3.895.532 0 1.33-.842 2.394-2.525 1.063-1.683 1.63-2.963 1.7-3.84.152-1.452-.419-2.178-1.7-2.178a4.74 4.74 0 0 0-1.884.42c1.25-4.09 3.637-6.077 7.16-5.96 2.612.077 3.843 1.77 3.693 5.08l-.144.08z"/>
                    </svg>
                    Open Vimeo Library
                  </Button>
                  <p className="text-xs text-gray-400">
                    Pick one or more videos — each selection adds a Vimeo URL to the gallery
                  </p>
                </div>
              )}

              {/* ── Gallery: numbered, reorderable, multi-select ── */}
              {formData.screenshots && formData.screenshots.filter(u => u.trim()).length > 0 && (() => {
                const count = formData.screenshots.filter(u => u.trim()).length;
                const total = formData.screenshots.length;
                return (
                <div className="mt-4 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs text-gray-400 font-medium">
                      Gallery ({count} item{count !== 1 ? 's' : ''})
                      <span className="hidden lg:inline text-white/25"> · drag to reorder</span>
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {gallerySelectMode ? (
                        <>
                          <button
                            type="button"
                            onClick={() => setGallerySelected(gallerySelected.size === total ? new Set() : new Set(formData.screenshots.map((_, i) => i)))}
                            className="px-2.5 py-1 rounded-md text-xs bg-white/8 text-white/70 hover:bg-white/15"
                          >
                            {gallerySelected.size === total ? 'Select none' : 'Select all'}
                          </button>
                          <button
                            type="button"
                            onClick={removeSelectedScreenshots}
                            disabled={!gallerySelected.size}
                            className="px-2.5 py-1 rounded-md text-xs bg-red-500/80 text-white hover:bg-red-500 disabled:opacity-40"
                          >
                            Remove {gallerySelected.size || ''}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setGallerySelectMode(false); setGallerySelected(new Set()); }}
                            className="px-2.5 py-1 rounded-md text-xs text-white/60 hover:text-white"
                          >
                            Done
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setGallerySelectMode(true)}
                          className="px-2.5 py-1 rounded-md text-xs bg-white/8 text-white/70 hover:bg-white/15"
                        >
                          Select
                        </button>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 max-h-[28rem] overflow-y-auto pr-1">
                    {formData.screenshots.map((url, index) => {
                      if (!url.trim()) return null;
                      const isVimeo = url.includes('vimeo.com');
                      const isBunny = detectVideoProvider(url) === 'bunny';
                      const bunnyThumb = isBunny ? getBunnyAutoThumbnailUrl(url) : null;
                      const isDirectVideo = !isBunny && /\.(mp4|webm|mov|avi)(\?|$)/i.test(url);
                      const vimeoId = isVimeo ? url.split('vimeo.com/').pop()?.split('?')[0]?.split('/').pop() : null;
                      const selected = gallerySelected.has(index);
                      return (
                        <div
                          key={`${index}-${url}`}
                          draggable={!gallerySelectMode}
                          onDragStart={(e) => { setGalleryDragFrom(index); e.dataTransfer.effectAllowed = 'move'; }}
                          onDragOver={(e) => { if (galleryDragFrom === null) return; e.preventDefault(); setGalleryDragOver(index); }}
                          onDragLeave={() => setGalleryDragOver(o => (o === index ? null : o))}
                          onDrop={(e) => { e.preventDefault(); if (galleryDragFrom !== null) moveScreenshot(galleryDragFrom, index); setGalleryDragFrom(null); setGalleryDragOver(null); }}
                          onDragEnd={() => { setGalleryDragFrom(null); setGalleryDragOver(null); }}
                          onClick={gallerySelectMode ? () => toggleGallerySelected(index) : undefined}
                          className={`relative group rounded-lg overflow-hidden border bg-black/30 aspect-video transition-all ${
                            selected ? 'border-purple-400 ring-2 ring-purple-400/50' :
                            galleryDragOver === index && galleryDragFrom !== index ? 'border-purple-400 ring-2 ring-purple-400/40' :
                            'border-white/10'
                          } ${galleryDragFrom === index ? 'opacity-40' : ''} ${gallerySelectMode ? 'cursor-pointer' : 'lg:cursor-grab'}`}
                        >
                          {isVimeo ? (
                            /* Vimeo card — real thumbnail fetched via oEmbed */
                            <VimeoThumb url={url} vimeoId={vimeoId!} />
                          ) : isBunny ? (
                            /* Bunny card — CDN auto thumbnail */
                            bunnyThumb ? (
                              <img
                                src={bunnyThumb}
                                alt={`Media ${index + 1}`}
                                loading="lazy"
                                draggable={false}
                                className="w-full h-full object-cover pointer-events-none"
                                onError={(e) => { e.currentTarget.style.opacity = '0.2'; }}
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-orange-300 text-xs">Bunny video</div>
                            )
                          ) : isDirectVideo ? (
                            /* Direct video */
                            <video src={url} className="w-full h-full object-cover pointer-events-none" muted preload="metadata" />
                          ) : (
                            /* Image */
                            <img
                              src={url}
                              alt={`Media ${index + 1}`}
                              draggable={false}
                              className="w-full h-full object-cover pointer-events-none"
                              onError={(e) => { e.currentTarget.style.opacity = '0.2'; }}
                            />
                          )}

                          {/* Position */}
                          <span className="absolute top-1 left-1 min-w-5 h-5 px-1 rounded-full bg-black/75 text-white text-[10px] font-bold flex items-center justify-center z-10">
                            {index + 1}
                          </span>

                          {gallerySelectMode ? (
                            /* Selection tick */
                            <span className={`absolute top-1 right-1 w-6 h-6 rounded-full border-2 flex items-center justify-center z-10 ${selected ? 'bg-purple-500 border-purple-300' : 'bg-black/50 border-white/60'}`}>
                              {selected && <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path d="M5 13l4 4L19 7" /></svg>}
                            </span>
                          ) : (
                            <>
                              {/* Remove — always visible on touch, on hover with a mouse */}
                              <button
                                type="button"
                                onClick={() => removeScreenshot(index)}
                                aria-label={`Remove item ${index + 1}`}
                                className="absolute top-1 right-1 w-7 h-7 lg:w-6 lg:h-6 rounded-full bg-red-500 hover:bg-red-600 text-white flex items-center justify-center lg:opacity-0 lg:group-hover:opacity-100 transition-opacity shadow-lg z-10"
                              >
                                <X className="w-3 h-3" />
                              </button>
                              {/* Move left / right (touch-friendly reordering) */}
                              <div className="absolute bottom-1 right-1 flex gap-1 z-10 lg:opacity-0 lg:group-hover:opacity-100 transition-opacity">
                                <button
                                  type="button"
                                  onClick={() => moveScreenshot(index, index - 1)}
                                  disabled={index === 0}
                                  aria-label="Move earlier"
                                  className="w-7 h-7 lg:w-6 lg:h-6 rounded-full bg-black/75 text-white text-xs flex items-center justify-center hover:bg-purple-600 disabled:opacity-30"
                                >
                                  ◀
                                </button>
                                <button
                                  type="button"
                                  onClick={() => moveScreenshot(index, index + 1)}
                                  disabled={index === total - 1}
                                  aria-label="Move later"
                                  className="w-7 h-7 lg:w-6 lg:h-6 rounded-full bg-black/75 text-white text-xs flex items-center justify-center hover:bg-purple-600 disabled:opacity-30"
                                >
                                  ▶
                                </button>
                              </div>
                            </>
                          )}

                          {/* Type badge */}
                          <div className="absolute bottom-1 left-1 text-[9px] px-1.5 py-0.5 rounded bg-black/70 text-gray-300 font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                            {isVimeo ? 'Vimeo' : isBunny ? 'Bunny' : isDirectVideo ? 'Video' : 'Image'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                );
              })()}
            </div>
          </div>
        </div>
        
        <label className="flex items-center gap-2 text-white">
          <input
            type="checkbox"
            checked={formData.featured}
            onChange={(e) => setFormData({ ...formData, featured: e.target.checked })}
            className="w-4 h-4"
          />
          Featured Project
        </label>

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
            {saving ? 'Saving…' : 'Save'}
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
    </div>
  );
}
