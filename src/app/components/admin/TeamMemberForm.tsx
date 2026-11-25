// Team member editor — split out of pages/Admin.tsx.
import { useState } from 'react';
import React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Save, X, Upload, Sparkles } from 'lucide-react';
import { AIImproveModal } from './AIImproveModal';
import { publicAnonKey } from '/utils/supabase/info';
import { API_BASE, type TeamMember, fetchWithRetry } from './adminShared';

export function TeamMemberForm({
  member,
  onSave,
  onCancel,
}: {
  member: TeamMember;
  onSave: (member: TeamMember) => Promise<{ success: boolean; message: string }>;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    ...member,
    name: member.name || '',
    role: member.role || '',
    bio: member.bio || '',
    imageUrl: member.imageUrl || '',
  });
  const [uploading, setUploading] = useState(false);
  const [imageInputMode, setImageInputMode] = useState<'url' | 'upload'>('url');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  // AI state
  const [generating, setGenerating] = useState(false);
  const [aiInstruction, setAiInstruction] = useState('');
  const [improveExisting, setImproveExisting] = useState(false);
  const [showAiOptions, setShowAiOptions] = useState(false);
  const [highlightedFields, setHighlightedFields] = useState<Set<string>>(new Set());
  const [activeImprove, setActiveImprove] = useState<{ fieldKey: string; fieldLabel: string; currentValue: string; onApply: (v: string) => void } | null>(null);
  const openImprove = (fieldKey: string, fieldLabel: string, currentValue: string, onApply: (v: string) => void) =>
    setActiveImprove({ fieldKey, fieldLabel, currentValue, onApply });

  const applyHighlight = (fields: string[]) => {
    if (fields.length === 0) return;
    setHighlightedFields(new Set(fields));
    setTimeout(() => setHighlightedFields(new Set()), 3500);
  };
  const hlClass = (key: string) =>
    highlightedFields.has(key) ? 'ring-2 ring-purple-400/70 shadow-[0_0_14px_rgba(192,132,252,0.45)]' : '';

  const handleAutoFill = async () => {
    if (!formData.name?.trim() || !formData.role?.trim()) {
      setFormMessage({ type: 'error', text: 'Enter a name and role first so the AI can write the bio.' });
      return;
    }
    setGenerating(true);
    setFormMessage(null);
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetchWithRetry(`${API_BASE}/admin/generate-team-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${publicAnonKey}`, 'X-Admin-Token': token || '' },
        body: JSON.stringify({
          member: { name: formData.name, role: formData.role, bio: formData.bio },
          instruction: aiInstruction, improveExisting,
        }),
      });
      const result = await response.json();
      if (!result.success) {
        setFormMessage({ type: 'error', text: result.error || 'Failed to generate bio.' });
        return;
      }
      if (result.nothingToGenerate) {
        setFormMessage({ type: 'success', text: '✨ Bio is already filled — enable "Rewrite existing content" to regenerate it.' });
        return;
      }
      if (result.data?.bio) {
        setFormData(prev => ({ ...prev, bio: result.data.bio }));
        setErrors(prev => ({ ...prev, bio: '' }));
        applyHighlight(['bio']);
        setFormMessage({ type: 'success', text: `✨ Bio ${improveExisting ? 'rewritten' : 'generated'}! Review and adjust as needed.` });
      }
    } catch (err) {
      console.warn('Team bio generation failed:', err);
      setFormMessage({ type: 'error', text: 'Could not reach the server. Please wait a moment and try again.' });
    } finally {
      setGenerating(false);
    }
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
    
    if (!formData.name?.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!formData.role?.trim()) {
      newErrors.role = 'Role is required';
    }
    if (!formData.bio?.trim()) {
      newErrors.bio = 'Bio is required';
    }
    if (!formData.imageUrl?.trim()) {
      newErrors.imageUrl = 'Photo is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (validateForm()) {
      setSaving(true);
      setFormMessage(null);
      const result = await onSave(formData);
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
            {member.name ? 'Edit Team Member' : 'New Team Member'}
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
              disabled={generating || !formData.name?.trim() || !formData.role?.trim()}
              title={!formData.name?.trim() || !formData.role?.trim() ? 'Enter name and role first' : improveExisting ? 'Rewrite bio with Gemini AI' : 'Generate bio with Gemini AI'}
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
                  <span>{improveExisting ? 'Rewrite Bio' : 'Generate Bio'}</span>
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
                placeholder='e.g. "Make it more personal · Emphasize technical skills · Keep it under 2 sentences"'
                className="w-full px-3 py-2 bg-black/40 border border-purple-400/20 rounded-lg text-white text-sm placeholder:text-white/25 focus:outline-none focus:ring-1 focus:ring-purple-400/50"
              />
            </div>
            <label className="flex items-center gap-3 cursor-pointer select-none">
              <div
                onClick={() => setImproveExisting(v => !v)}
                className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${improveExisting ? 'bg-purple-500' : 'bg-white/10'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${improveExisting ? 'translate-x-5' : 'translate-x-0'}`} />
              </div>
              <div>
                <span className="text-sm text-white font-medium">Rewrite existing bio</span>
                <p className="text-xs text-white/40">When on, Gemini rewrites the existing bio instead of skipping it.</p>
              </div>
            </label>
          </div>
        )}
      </div>
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Name *
          </label>
          <Input
            placeholder="e.g., Alex Rivera"
            value={formData.name || ''}
            onChange={(e) => {
              setFormData({ ...formData, name: e.target.value });
              setErrors(prev => ({ ...prev, name: '' }));
            }}
            className={`bg-black/50 border-white/20 text-white ${errors.name ? 'border-red-500' : ''}`}
          />
          {errors.name && (
            <p className="text-red-400 text-sm mt-1">{errors.name}</p>
          )}
        </div>
        
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <label className="text-sm font-medium text-gray-300">Role *</label>
            <button type="button" onClick={() => openImprove('teamRole', 'Team Member Role', formData.role || '', v => { setFormData(p => ({ ...p, role: v })); setErrors(prev => ({ ...prev, role: '' })); })} title="AI Improve" className="inline-flex items-center justify-center w-5 h-5 rounded text-purple-400/50 hover:text-purple-300 hover:bg-purple-500/15 transition-all">
              <Sparkles className="w-3 h-3" />
            </button>
          </div>
          <Input
            placeholder="e.g., Motion Design Director"
            value={formData.role || ''}
            onChange={(e) => {
              setFormData({ ...formData, role: e.target.value });
              setErrors(prev => ({ ...prev, role: '' }));
            }}
            className={`bg-black/50 border-white/20 text-white ${errors.role ? 'border-red-500' : ''}`}
          />
          {errors.role && (
            <p className="text-red-400 text-sm mt-1">{errors.role}</p>
          )}
        </div>
        
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <label className="text-sm font-medium text-gray-300">Bio *</label>
            <button type="button" onClick={() => openImprove('teamBio', 'Team Member Bio', formData.bio || '', v => { setFormData(p => ({ ...p, bio: v })); setErrors(prev => ({ ...prev, bio: '' })); applyHighlight(['bio']); })} title="AI Improve" className="inline-flex items-center justify-center w-5 h-5 rounded text-purple-400/50 hover:text-purple-300 hover:bg-purple-500/15 transition-all">
              <Sparkles className="w-3 h-3" />
            </button>
          </div>
          <Textarea
            placeholder="Brief bio about the team member"
            value={formData.bio || ''}
            onChange={(e) => {
              setFormData({ ...formData, bio: e.target.value });
              setErrors(prev => ({ ...prev, bio: '' }));
            }}
            className={`bg-black/50 border-white/20 text-white transition-all duration-700 ${errors.bio ? 'border-red-500' : ''} ${hlClass('bio')}`}
            rows={3}
          />
          {errors.bio && (
            <p className="text-red-400 text-sm mt-1">{errors.bio}</p>
          )}
        </div>
        
        {/* Image input with toggle */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Team Member Photo *
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
                  onClick={() => document.getElementById('teamImageUpload')?.click()}
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
                id="teamImageUpload"
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
        
        {/* Social Media Links */}
        <div className="space-y-4 pt-4 border-t border-white/10">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Social Media Links (optional)
          </label>
          
          <div>
            <Input
              placeholder="LinkedIn URL"
              value={formData.socialLinks?.linkedin || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  socialLinks: { ...formData.socialLinks, linkedin: e.target.value },
                })
              }
              className="bg-black/50 border-white/20 text-white"
            />
          </div>
          
          <div>
            <Input
              placeholder="Instagram URL"
              value={formData.socialLinks?.instagram || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  socialLinks: { ...formData.socialLinks, instagram: e.target.value },
                })
              }
              className="bg-black/50 border-white/20 text-white"
            />
          </div>
          
          <div>
            <Input
              placeholder="Behance URL"
              value={formData.socialLinks?.behance || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  socialLinks: { ...formData.socialLinks, behance: e.target.value },
                })
              }
              className="bg-black/50 border-white/20 text-white"
            />
          </div>
          
          <div>
            <Input
              placeholder="Dribbble URL"
              value={formData.socialLinks?.dribbble || ''}
              onChange={(e) =>
                setFormData({
                  ...formData,
                  socialLinks: { ...formData.socialLinks, dribbble: e.target.value },
                })
              }
              className="bg-black/50 border-white/20 text-white"
            />
          </div>
        </div>
        
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
      {activeImprove && (
        <AIImproveModal
          fieldLabel={activeImprove.fieldLabel}
          fieldKey={activeImprove.fieldKey}
          currentValue={activeImprove.currentValue}
          context={{ entityType: 'team', name: formData.name || 'Team Member', role: formData.role || '' }}
          onApply={activeImprove.onApply}
          onClose={() => setActiveImprove(null)}
        />
      )}
    </div>
  );
}
