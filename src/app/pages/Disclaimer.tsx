import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { GlassCard } from '../components/shared/GlassCard';
import { SeoHead } from '../components/shared/SeoHead';
import { AlertTriangle } from 'lucide-react';
import { api } from '../utils/api';

export function Disclaimer() {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    try {
      const res = await api.getSettings();
      if (res.success && res.data?.disclaimerContent) {
        setContent(res.data.disclaimerContent);
      } else {
        setContent(getDefaultDisclaimerContent());
      }
    } catch (error) {
      console.error('Error fetching disclaimer content:', error);
      setContent(getDefaultDisclaimerContent());
    } finally {
      setLoading(false);
    }
  };

  const getDefaultDisclaimerContent = () => {
    return `
      <h2>1. General Disclaimer</h2>
      <p>The information provided by Fastoosh ("we," "us," or "our") on this website is for general informational and commercial purposes only. All information is provided in good faith; however, we make no representation or warranty of any kind, express or implied, regarding the accuracy, adequacy, validity, reliability, availability, or completeness of any information on the site.</p>

      <h2>2. No Professional Advice</h2>
      <p>The content on this website does not constitute professional advice of any kind. All tools, scripts, and plugins offered by Fastoosh are designed for use in creative production workflows. Before using any product in a commercial or mission-critical environment, you should evaluate its suitability independently or seek appropriate professional guidance.</p>

      <h2>3. Software & Tools Disclaimer</h2>
      <p>All software, scripts, and plugins provided by Fastoosh are delivered "as is" and "as available" without any warranty of any kind, either express or implied. This includes, without limitation:</p>
      <ul>
        <li>No warranty that the software will be error-free or uninterrupted</li>
        <li>No warranty that defects will be corrected</li>
        <li>No warranty of fitness for a particular purpose or non-infringement</li>
        <li>No guarantee of compatibility with all versions of third-party software (e.g., Adobe After Effects)</li>
      </ul>
      <p>You assume full responsibility for the use of any product downloaded or purchased from this website.</p>

      <h2>4. Limitation of Liability</h2>
      <p>Under no circumstances shall Fastoosh, its owners, employees, or affiliates be liable for any direct, indirect, incidental, consequential, special, or exemplary damages arising from:</p>
      <ul>
        <li>Your use of or inability to use any product or content on this site</li>
        <li>Any errors, omissions, or inaccuracies in the content</li>
        <li>Unauthorized access to or use of our servers or any personal information stored therein</li>
        <li>Any bugs, viruses, or other harmful code transmitted through the site by a third party</li>
        <li>Loss of data or profits arising from your use of our products</li>
      </ul>

      <h2>5. Third-Party Links & Services</h2>
      <p>This website may contain links to third-party websites or services (including payment processors, social media platforms, and software vendors). These links are provided for your convenience only. Fastoosh has no control over, and assumes no responsibility for, the content, privacy policies, or practices of any third-party websites or services.</p>

      <h2>6. Results Disclaimer</h2>
      <p>Any case studies, testimonials, or examples of results achieved using Fastoosh tools or services are not guarantees of future results. Individual outcomes will vary depending on many factors including skill level, software environment, and workflow setup.</p>

      <h2>7. Changes to This Disclaimer</h2>
      <p>We reserve the right to update or modify this disclaimer at any time without prior notice. Your continued use of the website following any changes constitutes your acceptance of the revised disclaimer.</p>

      <h2>8. Contact Us</h2>
      <p>If you have any questions about this disclaimer, please contact us through our website.</p>
    `;
  };

  return (
    <div className="min-h-screen py-24 px-6">
      <SeoHead
        pageKey="disclaimer"
        fallback={{
          title: 'Disclaimer — Fastoosh',
          description: 'Read our disclaimer to understand the limitations of liability and the terms under which Fastoosh provides its products and services.',
        }}
      />
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 mb-6">
            <AlertTriangle className="w-8 h-8 text-amber-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            <span className="bg-gradient-to-r from-amber-400 to-orange-400 bg-clip-text text-transparent">
              Disclaimer
            </span>
          </h1>
          <p className="text-lg text-white/60">
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </motion.div>

        {/* Content */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <GlassCard className="p-8 md:p-12">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-8 h-8 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
              </div>
            ) : (
              <div
                className="
                  [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:bg-gradient-to-r [&_h2]:from-amber-400 [&_h2]:to-orange-400 [&_h2]:bg-clip-text [&_h2]:text-transparent
                  [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-white/90 [&_h3]:mt-6 [&_h3]:mb-2
                  [&_p]:text-white/70 [&_p]:leading-relaxed [&_p]:mb-4
                  [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ul]:text-white/70
                  [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4 [&_ol]:text-white/70
                  [&_li]:mb-2 [&_li]:text-white/70
                  [&_strong]:text-white [&_strong]:font-semibold
                  [&_em]:text-white/80 [&_em]:italic
                  [&_a]:text-amber-400 [&_a]:underline [&_a:hover]:text-amber-300"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            )}
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}