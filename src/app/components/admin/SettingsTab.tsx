// SettingsTab — split out of pages/Admin.tsx.
import { useState, useRef } from 'react';
import React from 'react';
import { GlassCard } from '../shared/GlassCard';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Plus, X, Upload } from 'lucide-react';
import { publicAnonKey } from '/utils/supabase/info';
import { API_BASE, type Settings } from './adminShared';
import { SettingsForm } from './SettingsForm';

export interface SettingsTabProps {
  settings: Settings;
  setSettings: React.Dispatch<React.SetStateAction<Settings>>;
  editingSettings: boolean;
  setEditingSettings: (v: boolean) => void;
  saveSettings: (settings: Settings) => Promise<void> | void;
}

export function SettingsTab({ settings, setSettings, editingSettings, setEditingSettings, saveSettings }: SettingsTabProps) {
  const [newLogoName,    setNewLogoName]    = useState('');
  const [newLogoUrl,     setNewLogoUrl]     = useState('');
  const [logoSaving,     setLogoSaving]     = useState(false);
  const [logoUploading,  setLogoUploading]  = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement>(null);

  const handleLogoFileUpload = async (file: File) => {
    setLogoUploading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${API_BASE}/upload-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Admin-Token': token || '',
        },
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setNewLogoUrl(data.data.url);
      } else {
        console.error('Logo upload failed:', data.error);
      }
    } catch (e) {
      console.error('Logo upload error:', e);
    } finally {
      setLogoUploading(false);
    }
  };

  return (
    <>
    <GlassCard className="p-6 mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold text-white">Settings</h2>
        <Button
          onClick={() => setEditingSettings(true)}
          className="cursor-pointer bg-violet-600 hover:bg-violet-500 text-white"
        >
          <Plus className="w-4 h-4 mr-2" />
          Edit Settings
        </Button>
      </div>
    
      {editingSettings && (
        <SettingsForm
          settings={settings}
          onSave={saveSettings}
          onCancel={() => setEditingSettings(false)}
        />
      )}
    
      <div className="space-y-4">
        <div className="p-4 bg-white/5 rounded-lg border border-white/10">
          <h3 className="text-white font-semibold mb-1">Site URL</h3>
          <p className="text-gray-400 text-sm">{settings.siteUrl || 'Not set'}</p>
          <p className="text-gray-600 text-xs mt-0.5">Used to auto-generate canonical URLs in the SEO Manager.</p>
        </div>
    
        <div className="p-4 bg-white/5 rounded-lg border border-white/10">
          <h3 className="text-white font-semibold mb-2">Default OG Image</h3>
          {settings.defaultOgImage ? (
            <div className="flex items-center gap-3">
              <img
                src={settings.defaultOgImage}
                alt="Default OG"
                className="w-24 h-14 rounded object-cover border border-white/10"
              />
              <p className="text-gray-400 text-xs truncate max-w-xs">{settings.defaultOgImage}</p>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">Not set — used as fallback OG image for pages without a custom image.</p>
          )}
        </div>
    
        <div className="p-4 bg-white/5 rounded-lg border border-white/10">
          <h3 className="text-white font-semibold mb-2">Favicon</h3>
          {settings.faviconUrl ? (
            <div className="flex items-center gap-3">
              <img
                src={settings.faviconUrl}
                alt="Site favicon"
                className="w-10 h-10 rounded object-contain bg-white/10 p-1 border border-white/20"
              />
              <p className="text-gray-400 text-xs truncate max-w-xs">{settings.faviconUrl}</p>
            </div>
          ) : (
            <p className="text-gray-500 text-sm">No favicon uploaded yet. Click "Edit Settings" to upload one.</p>
          )}
        </div>
    
        <div
          className="p-4 bg-white/5 rounded-lg border border-white/10"
        >
          <h3 className="text-white font-semibold mb-2">Social Media Links</h3>
          <div className="space-y-1 text-sm">
            <p className="text-gray-400">
              <span className="text-gray-500">LinkedIn:</span> {settings.socialLinks?.linkedin || 'Not set'}
            </p>
            <p className="text-gray-400">
              <span className="text-gray-500">Instagram:</span> {settings.socialLinks?.instagram || 'Not set'}
            </p>
            <p className="text-gray-400">
              <span className="text-gray-500">X (Twitter):</span> {settings.socialLinks?.twitter || 'Not set'}
            </p>
            <p className="text-gray-400">
              <span className="text-gray-500">Dribbble:</span> {settings.socialLinks?.dribbble || 'Not set'}
            </p>
            <p className="text-gray-400">
              <span className="text-gray-500">Behance:</span> {settings.socialLinks?.behance || 'Not set'}
            </p>
            <p className="text-gray-400">
              <span className="text-gray-500">TikTok:</span> {settings.socialLinks?.tiktok || 'Not set'}
            </p>
          </div>
        </div>
    
        <div className="p-4 bg-white/5 rounded-lg border border-white/10">
          <h3 className="text-white font-semibold mb-1">Contact Email</h3>
          <p className="text-gray-400 text-sm">{settings.contactEmail || 'Not set'}</p>
          <p className="text-gray-600 text-xs mt-0.5">Displayed in the footer and used as the public contact address.</p>
        </div>
    
        <div className="p-4 bg-white/5 rounded-lg border border-white/10">
          <h3 className="text-white font-semibold mb-1">Password Reset Reply-To</h3>
          <p className="text-gray-400 text-sm">{settings.emailReplyTo || 'Not set'}</p>
          <p className="text-gray-600 text-xs mt-0.5">Replies to the branded password-reset email will be forwarded to this address.</p>
        </div>
    
        <div className="p-4 bg-white/5 rounded-lg border border-white/10">
          <h3 className="text-white font-semibold mb-1">Calendly Booking URL</h3>
          <p className="text-gray-400 text-sm">{settings.calendlyUrl || 'Not set'}</p>
          <p className="text-gray-600 text-xs mt-0.5">Used on the "Work with us" page for the discovery call booking widget.</p>
        </div>
    
        <div className="p-4 bg-white/5 rounded-lg border border-white/10">
          <h3 className="text-white font-semibold mb-1">Gemini API Key</h3>
          <p className="text-gray-400 text-sm font-mono">
            {settings.geminiApiKey ? `${settings.geminiApiKey.slice(0, 8)}${'•'.repeat(20)}` : 'Not set'}
          </p>
          <p className="text-gray-600 text-xs mt-0.5">Used for all AI content generation features. Click "Edit Settings" to update.</p>
          <p className="text-gray-500 text-xs mt-1">Plan: <span className={settings.geminiPaidTier ? 'text-purple-300' : 'text-gray-400'}>{settings.geminiPaidTier ? 'Paid (fast bulk translation)' : 'Free'}</span></p>
        </div>
    
        <div className="p-4 bg-white/5 rounded-lg border border-white/10">
          <h3 className="text-white font-semibold mb-1">Gemini Model</h3>
          <p className="text-gray-400 text-sm">{settings.geminiModel || 'gemini-2.5-flash (default)'}</p>
          <p className="text-gray-600 text-xs mt-0.5">Switch models when you hit quota limits. Click "Edit Settings" to change.</p>
        </div>
    
      </div>
    </GlassCard>
    
    {/* CLIENT LOGOS */}
    <GlassCard className="p-6 mt-6">
      <h2 className="text-xl font-bold text-white mb-1">Client Logos</h2>
      <p className="text-gray-400 text-sm mb-5">
        These scroll across the "Trusted by" banner on the About page. Add a name (required) and optionally paste an image URL for the logo. Hover over a logo in the ticker to pause the animation.
      </p>
    
      {/* Scroll speed */}
      <div className="flex items-center gap-3 mb-5 p-3 bg-white/5 border border-white/10 rounded-xl">
        <div className="flex-1">
          <p className="text-white text-sm font-semibold mb-0.5">Scroll speed</p>
          <p className="text-white/40 text-xs">Seconds for one full loop. Lower = faster, higher = slower. Default: 28s.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <input
            type="number"
            min={5}
            max={120}
            step={1}
            value={settings.marqueeSpeed ?? 28}
            onChange={e => {
              const v = Math.max(5, Math.min(120, Number(e.target.value)));
              setSettings(s => ({ ...s, marqueeSpeed: v }));
            }}
            onBlur={async () => {
              try { await saveSettings({ ...settings }); } catch {}
            }}
            className="w-20 bg-black/50 border border-white/20 rounded-lg px-3 py-1.5 text-white text-sm text-center focus:outline-none focus:border-purple-500"
          />
          <span className="text-white/40 text-sm">s</span>
        </div>
      </div>
    
      {/* Current logos */}
      <div className="space-y-2 mb-4">
        {(settings.clientLogos || []).length === 0 && (
          <p className="text-gray-500 text-sm italic">No logos yet — add one below. The About page will show the built-in placeholder names until you save at least one entry.</p>
        )}
        {(settings.clientLogos || []).map((logo, index) => (
          <div key={index} className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-xl">
            {logo.imageUrl ? (
              <img
                src={logo.imageUrl}
                alt={logo.name}
                className="h-8 w-16 object-contain rounded bg-white/5 border border-white/10 p-1 flex-shrink-0"
              />
            ) : (
              <div className="h-8 w-16 flex items-center justify-center rounded bg-white/5 border border-white/10 flex-shrink-0">
                <span className="text-white/30 text-xs">No img</span>
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-white text-sm font-semibold truncate">{logo.name}</p>
              {logo.imageUrl && (
                <p className="text-white/30 text-xs truncate">{logo.imageUrl}</p>
              )}
            </div>
            <button
              type="button"
              disabled={logoSaving}
              onClick={async () => {
                const updated = (settings.clientLogos || []).filter((_, i) => i !== index);
                setLogoSaving(true);
                try { await saveSettings({ ...settings, clientLogos: updated }); } catch {}
                setLogoSaving(false);
              }}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-white/40 hover:text-red-400 hover:bg-white/10 transition-colors disabled:opacity-40 flex-shrink-0"
              title={`Remove "${logo.name}"`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    
      {/* Add new logo */}
      <div className="border border-white/10 rounded-xl p-4 bg-white/[0.02] space-y-3">
        <p className="text-white/50 text-xs font-semibold uppercase tracking-wider">Add a logo</p>
    
        {/* Hidden file input */}
        <input
          ref={logoFileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/gif"
          className="hidden"
          onChange={e => {
            const file = e.target.files?.[0];
            if (file) handleLogoFileUpload(file);
            e.target.value = ''; // reset so same file can be re-selected
          }}
        />
    
        {/* Row 1: name + image input area */}
        <div className="flex gap-2 flex-wrap">
          <Input
            placeholder="Company name (e.g. Apple)"
            value={newLogoName}
            onChange={e => setNewLogoName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); document.getElementById('logo-url-input')?.focus(); } }}
            className="bg-black/50 border-white/20 text-white flex-1 min-w-[160px]"
            disabled={logoSaving || logoUploading}
          />
    
          {/* URL input + clear button */}
          <div className="relative flex-1 min-w-[180px]">
            <Input
              id="logo-url-input"
              placeholder="Paste image URL…"
              value={newLogoUrl}
              onChange={e => setNewLogoUrl(e.target.value)}
              className="bg-black/50 border-white/20 text-white pr-8 w-full"
              disabled={logoSaving || logoUploading}
            />
            {newLogoUrl && (
              <button
                type="button"
                onClick={() => setNewLogoUrl('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/70 transition-colors"
                title="Clear URL"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
    
          {/* Upload button */}
          <Button
            type="button"
            variant="outline"
            disabled={logoSaving || logoUploading}
            onClick={() => logoFileInputRef.current?.click()}
            className="cursor-pointer whitespace-nowrap border-white/20 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-40"
            title="Upload a logo image from your computer"
          >
            {logoUploading ? (
              <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />Uploading…</>
            ) : (
              <><Upload className="w-4 h-4 mr-2" />Upload</>
            )}
          </Button>
    
          {/* Add logo button */}
          <Button
            type="button"
            disabled={logoSaving || logoUploading || !newLogoName.trim()}
            onClick={async () => {
              if (!newLogoName.trim()) return;
              const updated = [...(settings.clientLogos || []), { name: newLogoName.trim(), imageUrl: newLogoUrl.trim() || undefined }];
              setLogoSaving(true);
              try { await saveSettings({ ...settings, clientLogos: updated }); setNewLogoName(''); setNewLogoUrl(''); } catch {}
              setLogoSaving(false);
            }}
            className="cursor-pointer whitespace-nowrap bg-purple-600 hover:bg-purple-700 text-white disabled:opacity-50"
          >
            {logoSaving ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <><Plus className="w-4 h-4 mr-1" />Add Logo</>
            )}
          </Button>
        </div>
    
        {/* Live image preview */}
        {newLogoUrl.trim() && (
          <div className="flex items-center gap-3 pt-1">
            <span className="text-white/30 text-xs">Preview:</span>
            <div className="h-10 px-3 flex items-center rounded-lg bg-white/5 border border-white/10">
              <img
                src={newLogoUrl.trim()}
                alt="preview"
                className="h-7 w-auto max-w-[120px] object-contain"
                onError={e => { (e.target as HTMLImageElement).parentElement!.style.display = 'none'; }}
              />
            </div>
            <span className="text-white/20 text-xs truncate max-w-[200px]">{newLogoUrl.trim()}</span>
          </div>
        )}
      </div>
    </GlassCard>
    </>
  );
}
