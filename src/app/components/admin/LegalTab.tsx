import { useState, useEffect } from 'react';
import { GlassCard } from '../shared/GlassCard';
import { Button } from '../ui/button';
import { Textarea } from '../ui/textarea';
import { FileText, Shield, RefreshCw, Save, AlertCircle, AlertTriangle, Sparkles, Eye, EyeOff } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { bustApiCache } from '../../utils/api';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

interface LegalContent {
  termsContent?: string;
  privacyContent?: string;
  refundsContent?: string;
  disclaimerContent?: string;
}

type ContentKey = keyof LegalContent;

// ─── Reusable editor panel for each legal page ────────────────────────────────
interface LegalEditorProps {
  label: string;
  value: string;
  saveColor: string;
  onChange: (v: string) => void;
  onSave: () => void;
  onAIFormat: () => void;
  saving: boolean;
  aiFormatting: boolean;
  aiError: string;
  saveMessage: string;
}

function LegalEditor({
  label,
  value,
  saveColor,
  onChange,
  onSave,
  onAIFormat,
  saving,
  aiFormatting,
  aiError,
  saveMessage,
}: LegalEditorProps) {
  const [preview, setPreview] = useState(false);

  // When AI formats, auto-switch to preview
  const hasHtmlTags = /<[a-z][\s\S]*>/i.test(value);

  return (
    <div className="space-y-4">
      {/* Label + AI tip */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <label className="block text-white font-medium mb-1">{label}</label>
          <p className="text-white/40 text-sm">
            Paste raw text and click <span className="text-purple-300 font-medium">Format with AI</span> — it will structure it into proper HTML automatically.
          </p>
        </div>
        {/* Preview toggle */}
        <button
          type="button"
          onClick={() => setPreview(p => !p)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white text-xs transition-colors flex-shrink-0"
        >
          {preview ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          {preview ? 'Edit HTML' : 'Preview'}
        </button>
      </div>

      {/* Editor or Preview */}
      {preview ? (
        <div
          className="min-h-[500px] p-6 rounded-lg bg-black/30 border border-white/10 overflow-auto text-white/80
            [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-white [&_h2]:mt-8 [&_h2]:mb-3 first:[&_h2]:mt-0
            [&_h3]:text-lg [&_h3]:font-semibold [&_h3]:text-white/90 [&_h3]:mt-6 [&_h3]:mb-2
            [&_p]:text-white/70 [&_p]:leading-relaxed [&_p]:mb-3
            [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ul]:text-white/70
            [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_ol]:text-white/70
            [&_li]:mb-1 [&_li]:text-white/70
            [&_strong]:text-white [&_strong]:font-semibold
            [&_em]:text-white/80 [&_em]:italic
            [&_a]:text-purple-400 [&_a]:underline [&_a:hover]:text-purple-300"
          dangerouslySetInnerHTML={{ __html: value || '<p style="color:rgba(255,255,255,0.25);font-style:italic;">Nothing to preview yet.</p>' }}
        />
      ) : (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="min-h-[500px] font-mono text-sm bg-black/50 border-white/20 text-white"
          placeholder={`Paste raw plain text here, then click "Format with AI" to convert it to styled HTML automatically.\n\nOr write HTML directly:\n<h2>1. Section Title</h2>\n<p>Your content here...</p>`}
        />
      )}

      {/* Action row */}
      <div className="flex flex-wrap items-center gap-3 pt-1">
        {/* AI Format */}
        <Button
          onClick={() => { onAIFormat(); setPreview(true); }}
          disabled={aiFormatting || !value.trim()}
          className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-fuchsia-500 text-white cursor-pointer disabled:opacity-50"
        >
          {aiFormatting ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
              Formatting…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4 mr-2" />
              Format with AI
            </>
          )}
        </Button>

        {/* Save */}
        <Button
          onClick={onSave}
          disabled={saving}
          className={`${saveColor} text-white cursor-pointer`}
        >
          {saving ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
              Saving…
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Save
            </>
          )}
        </Button>

        {/* Messages */}
        {aiError && <span className="text-sm text-red-400">{aiError}</span>}
        {saveMessage && (
          <span className={`text-sm ${saveMessage.startsWith('✓') ? 'text-green-400' : 'text-red-400'}`}>
            {saveMessage}
          </span>
        )}
      </div>

      {/* AI hint banner — shown when content has no HTML yet */}
      {value.trim() && !hasHtmlTags && (
        <div className="flex items-start gap-3 p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
          <Sparkles className="w-4 h-4 text-purple-400 flex-shrink-0 mt-0.5" />
          <p className="text-purple-300/80 text-xs leading-relaxed">
            Looks like plain text. Click <strong className="text-purple-300">Format with AI</strong> to automatically convert it to structured HTML with headings, paragraphs, and lists.
          </p>
        </div>
      )}
    </div>
  );
}

// ─── Main LegalTab component ─────────────────────────────────────────────────
export function LegalTab() {
  const [content, setContent] = useState<LegalContent>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState('');
  const [activeTab, setActiveTab] = useState('terms');
  const [aiFormatting, setAiFormatting] = useState<Partial<Record<ContentKey, boolean>>>({});
  const [aiError, setAiError] = useState<Partial<Record<ContentKey, string>>>({});

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    try {
      const response = await fetch(`${API_BASE}/settings`, {
        headers: { 'Authorization': `Bearer ${publicAnonKey}` },
      });
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.data) {
          setContent({
            termsContent:      result.data.termsContent      || getDefaultTermsContent(),
            privacyContent:    result.data.privacyContent    || getDefaultPrivacyContent(),
            refundsContent:    result.data.refundsContent    || getDefaultRefundsContent(),
            disclaimerContent: result.data.disclaimerContent || getDefaultDisclaimerContent(),
          });
        }
      }
    } catch (error) {
      console.error('Error fetching legal content:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveContent = async () => {
    setSaving(true);
    setSaveMessage('');
    try {
      const token = localStorage.getItem('admin_token');
      const response = await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Admin-Token': token || '',
        },
        body: JSON.stringify(content),
      });
      const result = await response.json();
      if (result.success) {
        bustApiCache('settings'); // ensure public pages see fresh content immediately
        setSaveMessage('✓ Legal pages saved successfully!');
        setTimeout(() => setSaveMessage(''), 3000);
      } else {
        setSaveMessage(`✗ Error: ${result.error || 'Failed to save'}`);
      }
    } catch (error) {
      console.error('Error saving legal content:', error);
      setSaveMessage('✗ Error saving legal pages');
    } finally {
      setSaving(false);
    }
  };

  const formatWithAI = async (key: ContentKey) => {
    const rawText = content[key] || '';
    if (!rawText.trim()) return;
    setAiFormatting(prev => ({ ...prev, [key]: true }));
    setAiError(prev => ({ ...prev, [key]: '' }));
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/admin/format-legal-html`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${publicAnonKey}`,
          'X-Admin-Token': token || '',
        },
        body: JSON.stringify({ rawText, pageType: key }),
      });
      const result = await res.json();
      if (result.success && result.data?.html) {
        setContent(prev => ({ ...prev, [key]: result.data.html }));
      } else {
        setAiError(prev => ({ ...prev, [key]: result.error || 'AI formatting failed. Please try again.' }));
      }
    } catch (err) {
      console.error('AI format error:', err);
      setAiError(prev => ({ ...prev, [key]: 'Could not reach the server. Please try again.' }));
    } finally {
      setAiFormatting(prev => ({ ...prev, [key]: false }));
    }
  };

  // ── Default content generators ──────────────────────────────────────────────
  const getDefaultTermsContent = () =>
    `<h2>1. Acceptance of Terms</h2>
<p>By accessing and using this website, you accept and agree to be bound by the terms and provision of this agreement.</p>

<h2>2. Use License</h2>
<p>Permission is granted to temporarily download one copy of the materials on our website for personal, non-commercial transitory viewing only.</p>

<h2>3. Disclaimer</h2>
<p>The materials on our website are provided on an 'as is' basis. We make no warranties, expressed or implied, and hereby disclaim and negate all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.</p>

<h2>4. Limitations</h2>
<p>In no event shall Fastoosh or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on our website.</p>

<h2>5. Contact Information</h2>
<p>If you have any questions about these Terms, please contact us through our website.</p>`;

  const getDefaultPrivacyContent = () =>
    `<h2>1. Information We Collect</h2>
<p>We collect information that you provide directly to us, including when you create an account, make a purchase, subscribe to our newsletter, or contact us for support.</p>

<h2>2. How We Use Your Information</h2>
<p>We use the information we collect to provide, maintain, and improve our services, process transactions, and communicate with you.</p>

<h2>3. Data Security</h2>
<p>We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.</p>

<h2>4. Your Rights</h2>
<p>You have the right to access, correct, or delete your personal information. Contact us for assistance.</p>

<h2>5. Contact Us</h2>
<p>If you have any questions about this Privacy Policy, please contact us through our website.</p>`;

  const getDefaultRefundsContent = () =>
    `<h2>1. Refund Eligibility</h2>
<p>We want you to be completely satisfied with your purchase. If you're not happy with your Fastoosh product, you may be eligible for a refund under certain conditions.</p>

<h2>2. How to Request a Refund</h2>
<p>To request a refund, please contact our support team with your order number and reason for the refund request.</p>

<h2>3. Refund Processing Time</h2>
<p>Once your refund request is approved, refunds are processed within 5-7 business days to your original payment method.</p>

<h2>4. Contact Us</h2>
<p>If you have any questions about our refund policy, please contact us through our website support form.</p>`;

  const getDefaultDisclaimerContent = () =>
    `<h2>1. General Disclaimer</h2>
<p>The information provided by Fastoosh on this website is for general informational and commercial purposes only. All information is provided in good faith; however, we make no representation or warranty of any kind regarding the accuracy, adequacy, validity, reliability, availability, or completeness of any information on the site.</p>

<h2>2. No Professional Advice</h2>
<p>The content on this website does not constitute professional advice of any kind. All tools, scripts, and plugins offered by Fastoosh are designed for use in creative production workflows.</p>

<h2>3. Software & Tools Disclaimer</h2>
<p>All software, scripts, and plugins provided by Fastoosh are delivered "as is" and "as available" without any warranty of any kind. You assume full responsibility for the use of any product downloaded or purchased from this website.</p>

<h2>4. Limitation of Liability</h2>
<p>Under no circumstances shall Fastoosh be liable for any direct, indirect, incidental, or consequential damages arising from your use of or inability to use any product or content on this site.</p>

<h2>5. Third-Party Links</h2>
<p>This website may contain links to third-party websites. Fastoosh has no control over, and assumes no responsibility for, the content or practices of any third-party websites.</p>

<h2>6. Changes to This Disclaimer</h2>
<p>We reserve the right to update or modify this disclaimer at any time without prior notice.</p>

<h2>7. Contact Us</h2>
<p>If you have any questions about this disclaimer, please contact us through our website.</p>`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <GlassCard className="p-6">
        <div className="flex items-start gap-4">
          <div className="w-11 h-11 rounded-xl bg-blue-500/15 border border-blue-500/25 flex items-center justify-center flex-shrink-0">
            <FileText className="w-5 h-5 text-blue-400" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-white mb-1">Legal Pages</h2>
            <p className="text-white/50 text-sm leading-relaxed">
              Paste any raw text (from a Word doc, Google Docs, or plain notes) and click{' '}
              <span className="text-purple-300 font-medium">Format with AI</span> to instantly generate clean, structured HTML.
            </p>
          </div>
        </div>

        {/* AI tip banner */}
        <div className="mt-4 flex items-start gap-3 p-4 rounded-lg bg-purple-500/10 border border-purple-500/20">
          <Sparkles className="w-5 h-5 text-purple-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-purple-300/90 space-y-1">
            <p className="font-semibold">AI-powered formatting</p>
            <p className="text-purple-300/70">
              Paste raw plain text → click <strong className="text-purple-300">Format with AI</strong> → the AI converts it to proper HTML with headings, paragraphs, and lists, preserving all your content exactly as written.
            </p>
          </div>
        </div>

        {/* Legal warning */}
        <div className="mt-3 flex items-start gap-3 p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-300/80 space-y-1">
            <p>These pages are legally binding — consult a legal professional before publishing. Links are automatically added to your site footer.</p>
          </div>
        </div>
      </GlassCard>

      {/* Content Editor */}
      <GlassCard className="p-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="terms" className="gap-2">
              <FileText className="w-4 h-4" />
              Terms of Service
            </TabsTrigger>
            <TabsTrigger value="privacy" className="gap-2">
              <Shield className="w-4 h-4" />
              Privacy Policy
            </TabsTrigger>
            <TabsTrigger value="refunds" className="gap-2">
              <RefreshCw className="w-4 h-4" />
              Refund Policy
            </TabsTrigger>
            <TabsTrigger value="disclaimer" className="gap-2">
              <AlertTriangle className="w-4 h-4" />
              Disclaimer
            </TabsTrigger>
          </TabsList>

          <TabsContent value="terms">
            <LegalEditor
              label="Terms of Service Content"
              value={content.termsContent || ''}
              saveColor="bg-blue-600 hover:bg-blue-500"
              onChange={(v) => setContent(prev => ({ ...prev, termsContent: v }))}
              onSave={saveContent}
              onAIFormat={() => formatWithAI('termsContent')}
              saving={saving}
              aiFormatting={!!aiFormatting.termsContent}
              aiError={aiError.termsContent || ''}
              saveMessage={saveMessage}
            />
          </TabsContent>

          <TabsContent value="privacy">
            <LegalEditor
              label="Privacy Policy Content"
              value={content.privacyContent || ''}
              saveColor="bg-green-600 hover:bg-green-500"
              onChange={(v) => setContent(prev => ({ ...prev, privacyContent: v }))}
              onSave={saveContent}
              onAIFormat={() => formatWithAI('privacyContent')}
              saving={saving}
              aiFormatting={!!aiFormatting.privacyContent}
              aiError={aiError.privacyContent || ''}
              saveMessage={saveMessage}
            />
          </TabsContent>

          <TabsContent value="refunds">
            <LegalEditor
              label="Refund Policy Content"
              value={content.refundsContent || ''}
              saveColor="bg-cyan-600 hover:bg-cyan-500"
              onChange={(v) => setContent(prev => ({ ...prev, refundsContent: v }))}
              onSave={saveContent}
              onAIFormat={() => formatWithAI('refundsContent')}
              saving={saving}
              aiFormatting={!!aiFormatting.refundsContent}
              aiError={aiError.refundsContent || ''}
              saveMessage={saveMessage}
            />
          </TabsContent>

          <TabsContent value="disclaimer">
            <LegalEditor
              label="Disclaimer Content"
              value={content.disclaimerContent || ''}
              saveColor="bg-amber-600 hover:bg-amber-500"
              onChange={(v) => setContent(prev => ({ ...prev, disclaimerContent: v }))}
              onSave={saveContent}
              onAIFormat={() => formatWithAI('disclaimerContent')}
              saving={saving}
              aiFormatting={!!aiFormatting.disclaimerContent}
              aiError={aiError.disclaimerContent || ''}
              saveMessage={saveMessage}
            />
          </TabsContent>
        </Tabs>

        {/* Quick Preview Links */}
        <div className="mt-8 pt-6 border-t border-white/10">
          <p className="text-white/40 text-sm mb-3">Open live pages in a new tab:</p>
          <div className="flex gap-3 flex-wrap">
            {[
              { href: '/terms',      icon: <FileText className="w-4 h-4" />,      label: 'Terms'      },
              { href: '/privacy',    icon: <Shield className="w-4 h-4" />,        label: 'Privacy'    },
              { href: '/refunds',    icon: <RefreshCw className="w-4 h-4" />,     label: 'Refunds'    },
              { href: '/disclaimer', icon: <AlertTriangle className="w-4 h-4" />, label: 'Disclaimer' },
            ].map(({ href, icon, label }) => (
              <a
                key={href}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 hover:text-white text-sm transition-colors"
              >
                {icon}
                View {label} Page
              </a>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* HTML Formatting Guide */}
      <GlassCard className="p-6">
        <h3 className="text-white font-semibold mb-3">HTML Formatting Reference</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-white/60">
          {[
            ['<h2>Section Title</h2>', 'Main section heading'],
            ['<h3>Subsection</h3>', 'Subsection heading'],
            ['<p>Paragraph text</p>', 'Regular paragraph'],
            ['<ul><li>Item</li></ul>', 'Bullet list'],
            ['<ol><li>Item</li></ol>', 'Numbered list'],
            ['<strong>Bold text</strong>', 'Bold emphasis'],
            ['<em>Italic text</em>', 'Italic emphasis'],
            ['<a href="url">Link</a>', 'Hyperlink'],
          ].map(([code, desc]) => (
            <p key={code}>
              <code className="px-2 py-0.5 bg-white/5 rounded text-purple-400 text-xs">{code}</code>
              <span className="ml-2 text-white/40">— {desc}</span>
            </p>
          ))}
        </div>
      </GlassCard>
    </div>
  );
}