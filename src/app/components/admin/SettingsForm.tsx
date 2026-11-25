// Settings editor — split out of pages/Admin.tsx.
import { useState, useEffect } from 'react';
import React from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Save, X, Upload } from 'lucide-react';
import { StudioProfileEditor } from './StudioProfileEditor';
import { publicAnonKey } from '/utils/supabase/info';
import { API_BASE, type Settings } from './adminShared';

export function SettingsForm({
  settings,
  onSave,
  onCancel,
}: {
  settings: Settings;
  onSave: (settings: Settings) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = useState({
    ...settings,
    heroVideoUrl: settings.heroVideoUrl || '',
    aboutText: settings.aboutText || '',
  });
  const [uploading, setUploading] = useState(false);
  const [uploadingFavicon, setUploadingFavicon] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [geminiTest, setGeminiTest] = useState<{ status: 'idle' | 'testing' | 'ok' | 'err'; message: string }>({ status: 'idle', message: '' });

  // Live list of Gemini models available to this API key, fetched from
  // Google's ListModels endpoint — so new models appear without code changes.
  const [geminiModels, setGeminiModels] = useState<{ id: string; label: string; description: string }[]>([]);
  const [geminiModelsState, setGeminiModelsState] = useState<{ status: 'idle' | 'loading' | 'ok' | 'err'; message: string }>({ status: 'idle', message: '' });

  const loadGeminiModels = async (keyOverride?: string) => {
    const key = (keyOverride ?? formData.geminiApiKey ?? '').trim();
    if (!key) {
      setGeminiModelsState({ status: 'err', message: 'Enter an API key to load the model list.' });
      return;
    }
    setGeminiModelsState({ status: 'loading', message: 'Loading models from Google…' });
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000&key=${encodeURIComponent(key)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
      const list = (data.models || [])
        // Only models that can generate text (what the admin AI features use)
        .filter((m: any) => (m.supportedGenerationMethods || []).includes('generateContent'))
        .map((m: any) => ({
          id: String(m.name || '').replace(/^models\//, ''),
          label: m.displayName || String(m.name || '').replace(/^models\//, ''),
          description: m.description || '',
        }))
        .filter((m: any) => m.id)
        // Newest versions first (gemini-3 before gemini-2.5 …)
        .sort((a: any, b: any) => b.id.localeCompare(a.id, undefined, { numeric: true }));
      setGeminiModels(list);
      setGeminiModelsState({ status: 'ok', message: `${list.length} models available for this key.` });
    } catch (err: any) {
      setGeminiModels([]);
      setGeminiModelsState({ status: 'err', message: err?.message || 'Could not load models.' });
    }
  };

  // Load the list automatically when the form opens with a saved key.
  useEffect(() => {
    if (formData.geminiApiKey?.trim()) loadGeminiModels(formData.geminiApiKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTestGemini = async () => {
    const key = formData.geminiApiKey?.trim();
    const model = formData.geminiModel || 'gemini-2.5-flash';
    if (!key) {
      setGeminiTest({ status: 'err', message: 'Enter an API key first.' });
      return;
    }
    setGeminiTest({ status: 'testing', message: 'Testing…' });
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: 'Reply with just the word OK.' }] }] }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = data?.error?.message || `HTTP ${res.status}`;
        setGeminiTest({ status: 'err', message: errMsg });
      } else {
        const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        setGeminiTest({ status: 'ok', message: `Working — model replied: "${reply.trim().slice(0, 60)}"` });
      }
    } catch (err: any) {
      setGeminiTest({ status: 'err', message: err.message || 'Network error' });
    }
  };

  const handleFaviconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingFavicon(true);
    setErrors(prev => ({ ...prev, faviconUpload: '' }));

    try {
      const token = localStorage.getItem('admin_token');
      const uploadFormData = new FormData();
      uploadFormData.append('file', file);

      const response = await fetch(`${API_BASE}/upload-favicon`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Admin-Token': token || '',
        },
        body: uploadFormData,
      });

      const result = await response.json();
      if (result.success) {
        setFormData(prev => ({ ...prev, faviconUrl: result.data.url }));
        setErrors(prev => ({ ...prev, faviconUpload: '' }));
      } else {
        setErrors(prev => ({ ...prev, faviconUpload: `Upload failed: ${result.error}` }));
      }
    } catch (error) {
      console.error('Favicon upload error:', error);
      setErrors(prev => ({ ...prev, faviconUpload: 'Failed to upload favicon. Please try again.' }));
    } finally {
      setUploadingFavicon(false);
    }
  };



  return (
    <div className="mb-6 p-6 bg-white/10 rounded-lg border border-white/20">
      <h3 className="text-xl font-bold text-white mb-4">
        Edit Settings
      </h3>
      <div className="space-y-4">

        {/* Favicon Upload */}
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Site Favicon
          </label>
          <div className="flex items-center gap-4">
            {formData.faviconUrl ? (
              <div className="flex items-center gap-3 p-2 bg-white/5 border border-white/10 rounded-lg">
                <img
                  src={formData.faviconUrl}
                  alt="Current favicon"
                  className="w-10 h-10 rounded object-contain bg-white/10 p-1"
                />
                <div>
                  <p className="text-xs text-gray-400">Current favicon</p>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, faviconUrl: '' }))}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors mt-0.5"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center w-16 h-16 rounded-lg bg-white/5 border border-dashed border-white/20">
                <span className="text-2xl">🌐</span>
              </div>
            )}
            <div className="flex-1">
              <label className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-md transition-colors">
                {uploadingFavicon ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    Uploading…
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4" />
                    {formData.faviconUrl ? 'Replace Favicon' : 'Upload Favicon'}
                  </>
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/x-icon,image/svg+xml"
                  className="hidden"
                  onChange={handleFaviconUpload}
                  disabled={uploadingFavicon}
                />
              </label>
              <p className="text-xs text-gray-500 mt-1.5">PNG, JPG, WEBP, ICO or SVG · max 1 MB</p>
              {errors.faviconUpload && (
                <p className="text-xs text-red-400 mt-1">{errors.faviconUpload}</p>
              )}
            </div>
          </div>
        </div>

        {/* SEO Global Settings */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <h4 className="text-lg font-semibold text-white mb-1">Global SEO Defaults</h4>
          <p className="text-sm text-gray-400 mb-4">Used across all pages in the SEO Manager as automatic fallbacks.</p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Site URL</label>
              <Input
                placeholder="https://fastoosh.com"
                value={formData.siteUrl || ''}
                onChange={(e) => setFormData({ ...formData, siteUrl: e.target.value })}
                className="bg-black/50 border-white/20 text-white"
              />
              <p className="text-xs text-gray-500 mt-1">Used to auto-generate canonical URLs (e.g. https://fastoosh.com/tools).</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Default OG Image URL</label>
              <Input
                placeholder="https://fastoosh.com/og-default.jpg"
                value={formData.defaultOgImage || ''}
                onChange={(e) => setFormData({ ...formData, defaultOgImage: e.target.value })}
                className="bg-black/50 border-white/20 text-white"
              />
              <p className="text-xs text-gray-500 mt-1">1200×630px recommended. Used as fallback when no page-specific OG image is set.</p>
              {formData.defaultOgImage && (
                <img
                  src={formData.defaultOgImage}
                  alt="OG preview"
                  className="mt-2 rounded-lg max-h-24 border border-white/10 object-cover"
                  onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Republish — Vercel deploy hook */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <h4 className="text-lg font-semibold text-white mb-1">Republish (Vercel deploy hook)</h4>
          <p className="text-sm text-gray-400 mb-3">
            Lets the <strong className="text-white/80">Republish</strong> button in the sidebar rebuild the public site, so new projects,
            tools, guides and SEO edits reach Google and AI assistants without a code change.
          </p>
          <ol className="text-xs text-gray-400 space-y-1 mb-3 list-decimal pl-4">
            <li>Vercel → your project → <span className="text-gray-300">Settings → Git → Deploy Hooks</span>.</li>
            <li>Name it <span className="text-gray-300">Admin republish</span>, branch <span className="text-gray-300">main</span>, click <span className="text-gray-300">Create Hook</span>.</li>
            <li>Copy the URL and paste it here, then click Save.</li>
          </ol>
          <Input
            type="password"
            autoComplete="off"
            placeholder="https://api.vercel.com/v1/integrations/deploy/…"
            value={formData.deployHookUrl || ''}
            onChange={(e) => setFormData({ ...formData, deployHookUrl: e.target.value.trim() })}
            className="bg-black/50 border-white/20 text-white"
          />
          <p className="text-xs text-gray-500 mt-1">Kept private: never shown on the public site.</p>
        </div>

        {/* Studio facts — for Google and AI assistants */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <h4 className="text-lg font-semibold text-white mb-1">Studio facts (Google &amp; AI assistants)</h4>
          <p className="text-sm text-gray-400 mb-4">
            Plain facts about the studio. They appear on the About page and in the data search engines and
            AI assistants (ChatGPT, Claude, Gemini, Perplexity) read. Only write what is true. Changes reach
            crawlers after the next site deploy.
          </p>
          <StudioProfileEditor
            value={formData.studioProfile}
            onChange={(studioProfile) => setFormData({ ...formData, studioProfile })}
          />
        </div>

        {/* Contact Email Section */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <h4 className="text-lg font-semibold text-white mb-1">Contact Email</h4>
          <p className="text-sm text-gray-400 mb-3">
            Displayed in the footer "Get in touch" section and used as the public contact address sitewide.
          </p>
          <Input
            placeholder="hello@fastoosh.com"
            value={formData.contactEmail || ''}
            onChange={(e) => setFormData({ ...formData, contactEmail: e.target.value })}
            className="bg-black/50 border-white/20 text-white"
          />
        </div>

        {/* Email after a free download */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <h4 className="text-lg font-semibold text-white mb-1">Email after a free download</h4>
          <p className="text-sm text-gray-400 mb-3">
            Sends one short email right after someone downloads a free tool: the download link again, the tool page,
            and a link to Work With Us. Replies go to your contact email. Sent once per person per tool.
          </p>
          <label className="inline-flex items-center gap-3 cursor-pointer">
            <input type="checkbox" className="w-4 h-4 accent-purple-600"
              checked={formData.downloadFollowUpEmail !== false}
              onChange={(e) => setFormData({ ...formData, downloadFollowUpEmail: e.target.checked })} />
            <span className="text-sm text-white/80">{formData.downloadFollowUpEmail !== false ? 'On' : 'Off'}</span>
          </label>
        </div>

        {/* Password Reset Reply-To Section */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <h4 className="text-lg font-semibold text-white mb-1">Password Reset Reply-To</h4>
          <p className="text-sm text-gray-400 mb-3">
            When a user receives the branded password-reset email and hits "Reply", their message
            will be directed to this address. Leave blank to omit a reply-to header.
          </p>
          <Input
            placeholder="support@fastoosh.com"
            type="email"
            value={formData.emailReplyTo || ''}
            onChange={(e) => setFormData({ ...formData, emailReplyTo: e.target.value })}
            className="bg-black/50 border-white/20 text-white"
          />
          <p className="text-xs text-gray-500 mt-1.5">
            Example: <span className="text-gray-400">support@fastoosh.com</span> or your personal inbox
          </p>
        </div>

        {/* Calendly URL Section */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <h4 className="text-lg font-semibold text-white mb-1">Calendly Booking URL</h4>
          <p className="text-sm text-gray-400 mb-3">
            The scheduling link shown on the "Work with us" page. Copy it from your Calendly dashboard.
          </p>
          <Input
            placeholder="https://calendly.com/your-name/discovery-call"
            value={formData.calendlyUrl || ''}
            onChange={(e) => setFormData({ ...formData, calendlyUrl: e.target.value })}
            className="bg-black/50 border-white/20 text-white"
          />
          <p className="text-xs text-gray-500 mt-1.5">
            Example: <span className="text-gray-400">https://calendly.com/fastoosh/discovery-call</span>
          </p>
        </div>

        {/* Social Media Links Section */}
        <div className="mt-6 pt-6 border-t border-white/10">
          <h4 className="text-lg font-semibold text-white mb-4">Social Media Links</h4>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                LinkedIn URL
              </label>
              <Input
                placeholder="https://www.linkedin.com/company/fastoosh"
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
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Instagram URL
              </label>
              <Input
                placeholder="https://www.instagram.com/fastoosh"
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
              <label className="block text-sm font-medium text-gray-300 mb-2">
                X (Twitter) URL
              </label>
              <Input
                placeholder="https://x.com/fastoosh"
                value={formData.socialLinks?.twitter || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    socialLinks: { ...formData.socialLinks, twitter: e.target.value },
                  })
                }
                className="bg-black/50 border-white/20 text-white"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Dribbble URL
              </label>
              <Input
                placeholder="https://dribbble.com/fastoosh"
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
            
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Behance URL
              </label>
              <Input
                placeholder="https://www.behance.net/fastoosh"
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
              <label className="block text-sm font-medium text-gray-300 mb-2">
                TikTok URL
              </label>
              <Input
                placeholder="https://www.tiktok.com/@fastoosh"
                value={formData.socialLinks?.tiktok || ''}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    socialLinks: { ...formData.socialLinks, tiktok: e.target.value },
                  })
                }
                className="bg-black/50 border-white/20 text-white"
              />
            </div>
          </div>
        </div>
        
        {/* Gemini AI Settings */}
        <div className="pt-4 border-t border-white/10">
          <h4 className="text-white font-semibold mb-3">Gemini AI</h4>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                API Key
              </label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  placeholder="AIza..."
                  value={formData.geminiApiKey || ''}
                  onChange={(e) => { setFormData({ ...formData, geminiApiKey: e.target.value }); setGeminiTest({ status: 'idle', message: '' }); }}
                  className="bg-black/50 border-white/20 text-white font-mono flex-1"
                />
                <Button
                  type="button"
                  onClick={handleTestGemini}
                  disabled={geminiTest.status === 'testing'}
                  className="cursor-pointer bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs px-3 shrink-0"
                >
                  {geminiTest.status === 'testing' ? '…' : 'Test'}
                </Button>
              </div>
              {geminiTest.status !== 'idle' && (
                <p className={`text-xs mt-1 ${geminiTest.status === 'ok' ? 'text-emerald-400' : geminiTest.status === 'err' ? 'text-red-400' : 'text-white/40'}`}>
                  {geminiTest.status === 'ok' ? '✓ ' : geminiTest.status === 'err' ? '✗ ' : ''}{geminiTest.message}
                </p>
              )}
              <p className="text-gray-500 text-xs mt-1">Overrides the GEMINI_API_KEY environment variable. Switch keys when you hit quota limits.</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Key plan</label>
              <div className="inline-flex rounded-lg border border-white/15 bg-black/40 p-1">
                {([[false, 'Free'], [true, 'Paid']] as const).map(([paid, label]) => (
                  <button key={label} type="button"
                    onClick={() => setFormData({ ...formData, geminiPaidTier: paid })}
                    className={`px-4 py-1.5 rounded-md text-sm transition-colors ${!!formData.geminiPaidTier === paid ? 'bg-purple-600 text-white' : 'text-white/50 hover:text-white'}`}>
                    {label}
                  </button>
                ))}
              </div>
              <p className="text-gray-500 text-xs mt-1">
                {formData.geminiPaidTier
                  ? 'Paid: bulk translations run several requests at once, with no waiting — much faster.'
                  : 'Free: bulk translations wait between requests to stay under Google’s 15 requests / minute limit.'}
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Model
              </label>
              <div className="flex gap-2">
                <select
                  value={geminiModels.some(m => m.id === formData.geminiModel) ? formData.geminiModel : ''}
                  onChange={(e) => {
                    if (!e.target.value) return;
                    setFormData({ ...formData, geminiModel: e.target.value });
                    setGeminiTest({ status: 'idle', message: '' });
                  }}
                  disabled={!geminiModels.length}
                  className="flex-1 min-w-0 bg-black/50 border border-white/20 rounded-md px-3 py-2 text-sm text-white disabled:opacity-50 [&>option]:bg-[#0a0a0f]"
                >
                  <option value="">
                    {geminiModels.length ? 'Choose a model…' : 'Load the list to choose a model'}
                  </option>
                  {geminiModels.map(m => (
                    <option key={m.id} value={m.id}>{m.label} — {m.id}</option>
                  ))}
                </select>
                <Button
                  type="button"
                  onClick={() => loadGeminiModels()}
                  disabled={geminiModelsState.status === 'loading'}
                  className="cursor-pointer bg-white/10 hover:bg-white/20 text-white border border-white/20 text-xs px-3 shrink-0"
                >
                  {geminiModelsState.status === 'loading' ? '…' : geminiModels.length ? 'Refresh list' : 'Load models'}
                </Button>
              </div>
              {geminiModelsState.status !== 'idle' && (
                <p className={`text-xs mt-1 ${geminiModelsState.status === 'err' ? 'text-red-400' : 'text-white/40'}`}>
                  {geminiModelsState.message}
                </p>
              )}
              {(() => {
                const picked = geminiModels.find(m => m.id === formData.geminiModel);
                return picked?.description ? <p className="text-white/35 text-xs mt-1 line-clamp-2">{picked.description}</p> : null;
              })()}
              {/* Manual entry — for a model ID not in the list (e.g. a brand-new preview) */}
              <Input
                type="text"
                placeholder="or type a model ID, e.g. gemini-2.5-flash"
                value={formData.geminiModel || ''}
                onChange={(e) => { setFormData({ ...formData, geminiModel: e.target.value }); setGeminiTest({ status: 'idle', message: '' }); }}
                className="bg-black/50 border-white/20 text-white font-mono mt-2"
              />
              <p className="text-gray-500 text-xs mt-1">The list comes live from Google, so new models appear automatically. Use Test above to check the chosen model works, then Save.</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 pt-4 border-t border-white/10">
          <Button onClick={() => onSave(formData)} className="cursor-pointer bg-violet-600 hover:bg-violet-500 text-white">
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
          <Button variant="outline" onClick={onCancel} className="bg-black text-white hover:bg-white hover:text-black dark:bg-white dark:text-black dark:hover:bg-black dark:hover:text-white border-transparent cursor-pointer">
            <X className="w-4 h-4 mr-2" />
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
