import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { GlassCard } from '../components/shared/GlassCard';
import { SeoHead } from '../components/shared/SeoHead';
import { FileText } from 'lucide-react';
import { api } from '../utils/api';

export function Terms() {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchContent();
  }, []);

  const fetchContent = async () => {
    try {
      const res = await api.getSettings();
      if (res.success && res.data?.termsContent) {
        setContent(res.data.termsContent);
      } else {
        // Default content if not set in admin
        setContent(getDefaultTermsContent());
      }
    } catch (error) {
      console.error('Error fetching terms content:', error);
      setContent(getDefaultTermsContent());
    } finally {
      setLoading(false);
    }
  };

  const getDefaultTermsContent = () => {
    return `
      <h2>1. Acceptance of Terms</h2>
      <p>By accessing and using this website, you accept and agree to be bound by the terms and provision of this agreement.</p>
      
      <h2>2. Use License</h2>
      <p>Permission is granted to temporarily download one copy of the materials on our website for personal, non-commercial transitory viewing only.</p>
      
      <h2>3. Disclaimer</h2>
      <p>The materials on our website are provided on an 'as is' basis. We make no warranties, expressed or implied, and hereby disclaim and negate all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.</p>
      
      <h2>4. Limitations</h2>
      <p>In no event shall Fastoosh or its suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on our website.</p>
      
      <h2>5. Accuracy of Materials</h2>
      <p>The materials appearing on our website could include technical, typographical, or photographic errors. We do not warrant that any of the materials on our website are accurate, complete, or current.</p>
      
      <h2>6. Links</h2>
      <p>We have not reviewed all of the sites linked to our website and are not responsible for the contents of any such linked site. The inclusion of any link does not imply endorsement by us of the site.</p>
      
      <h2>7. Modifications</h2>
      <p>We may revise these terms of service at any time without notice. By using this website you are agreeing to be bound by the then current version of these terms of service.</p>
      
      <h2>8. Contact Information</h2>
      <p>If you have any questions about these Terms, please contact us through our website.</p>
    `;
  };

  return (
    <div className="min-h-screen py-24 px-6">
      <SeoHead
        pageKey="terms"
        fallback={{
          title: 'Terms of Service — Fastoosh',
          description: 'Read our Terms of Service to understand the rules and regulations governing the use of Fastoosh services and products.',
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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-purple-500/30 mb-6">
            <FileText className="w-8 h-8 text-purple-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
              Terms of Service
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
                <div className="w-8 h-8 border-2 border-purple-500/30 border-t-purple-500 rounded-full animate-spin" />
              </div>
            ) : (
              <div
                className="
                  [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:bg-gradient-to-r [&_h2]:from-purple-400 [&_h2]:to-blue-400 [&_h2]:bg-clip-text [&_h2]:text-transparent
                  [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-white/90 [&_h3]:mt-6 [&_h3]:mb-2
                  [&_p]:text-white/70 [&_p]:leading-relaxed [&_p]:mb-4
                  [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ul]:text-white/70
                  [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4 [&_ol]:text-white/70
                  [&_li]:mb-2 [&_li]:text-white/70
                  [&_strong]:text-white [&_strong]:font-semibold
                  [&_em]:text-white/80 [&_em]:italic
                  [&_a]:text-purple-400 [&_a]:underline [&_a:hover]:text-purple-300"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            )}
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}