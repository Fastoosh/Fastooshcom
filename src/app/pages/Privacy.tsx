import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { GlassCard } from '../components/shared/GlassCard';
import { SeoHead } from '../components/shared/SeoHead';
import { Shield } from 'lucide-react';
import { api } from '../utils/api';
import { useTranslation } from 'react-i18next';
import { fetchTranslations } from '../utils/translations';

export function Privacy() {
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const { i18n } = useTranslation();
  const lang = i18n.language;

  useEffect(() => {
    fetchContent();
  }, [lang]);

  const fetchContent = async () => {
    setLoading(true);
    try {
      const res = await api.getSettings();
      const englishHtml = res.success && res.data?.privacyContent
        ? res.data.privacyContent
        : getDefaultPrivacyContent();

      if (lang !== 'en') {
        const translations = await fetchTranslations(lang, 'legal');
        if (translations?.privacyContent) {
          setContent(translations.privacyContent);
          return;
        }
      }
      setContent(englishHtml);
    } catch (error) {
      console.error('Error fetching privacy content:', error);
      setContent(getDefaultPrivacyContent());
    } finally {
      setLoading(false);
    }
  };

  const getDefaultPrivacyContent = () => {
    return `
      <h2>1. Information We Collect</h2>
      <p>We collect information that you provide directly to us, including when you create an account, make a purchase, subscribe to our newsletter, or contact us for support.</p>
      
      <h3>Personal Information</h3>
      <ul>
        <li>Name and email address</li>
        <li>Billing information (processed securely through payment providers)</li>
        <li>Communication preferences</li>
        <li>Support inquiries and correspondence</li>
      </ul>
      
      <h3>Usage Information</h3>
      <ul>
        <li>Pages visited and features used</li>
        <li>Time and date of visits</li>
        <li>Referring URLs and browser information</li>
        <li>Device and operating system information</li>
      </ul>
      
      <h2>2. How We Use Your Information</h2>
      <p>We use the information we collect to:</p>
      <ul>
        <li>Provide, maintain, and improve our services</li>
        <li>Process transactions and send related information</li>
        <li>Send you technical notices and support messages</li>
        <li>Respond to your comments and questions</li>
        <li>Analyze usage patterns and improve user experience</li>
      </ul>
      
      <h2>3. Information Sharing and Disclosure</h2>
      <p>We do not sell, trade, or rent your personal information to third parties. We may share your information only in the following circumstances:</p>
      <ul>
        <li>With your consent</li>
        <li>With service providers who assist in our operations (e.g., payment processing)</li>
        <li>To comply with legal obligations</li>
        <li>To protect our rights and prevent fraud or security issues</li>
      </ul>
      
      <h2>4. Data Security</h2>
      <p>We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction.</p>
      
      <h2>5. Your Rights</h2>
      <p>You have the right to:</p>
      <ul>
        <li>Access your personal information</li>
        <li>Request correction of inaccurate data</li>
        <li>Request deletion of your data</li>
        <li>Opt-out of marketing communications</li>
        <li>Export your data in a portable format</li>
      </ul>
      
      <h2>6. Cookies and Tracking</h2>
      <p>We use cookies and similar tracking technologies to enhance your experience, analyze trends, and administer our website. You can control cookie settings through your browser preferences.</p>
      
      <h2>7. Third-Party Services</h2>
      <p>Our website may contain links to third-party services. We are not responsible for the privacy practices of these external sites.</p>
      
      <h2>8. Children's Privacy</h2>
      <p>Our services are not directed to children under 13. We do not knowingly collect personal information from children under 13.</p>
      
      <h2>9. Changes to This Policy</h2>
      <p>We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new policy on this page and updating the "Last updated" date.</p>
      
      <h2>10. Contact Us</h2>
      <p>If you have any questions about this Privacy Policy, please contact us through our website.</p>
    `;
  };

  return (
    <div className="min-h-screen py-24 px-6">
      <SeoHead
        pageKey="privacy"
        fallback={{
          title: 'Privacy Policy — Fastoosh',
          description: 'Learn how Fastoosh collects, uses, and protects your personal information. Your privacy is important to us.',
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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-green-500/20 to-emerald-500/20 border border-green-500/30 mb-6">
            <Shield className="w-8 h-8 text-green-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            <span className="bg-gradient-to-r from-green-400 to-emerald-400 bg-clip-text text-transparent">
              {{ en: 'Privacy Policy', fr: 'Politique de confidentialité', ar: 'سياسة الخصوصية' }[lang] ?? 'Privacy Policy'}
            </span>
          </h1>
          <p className="text-lg text-white/60">
            {{ en: 'Last updated', fr: 'Dernière mise à jour', ar: 'آخر تحديث' }[lang] ?? 'Last updated'}:{' '}
            {new Date().toLocaleDateString(
              lang === 'fr' ? 'fr-FR' : lang === 'ar' ? 'ar-SA' : 'en-US',
              { month: 'long', day: 'numeric', year: 'numeric' }
            )}
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
                <div className="w-8 h-8 border-2 border-green-500/30 border-t-green-500 rounded-full animate-spin" />
              </div>
            ) : (
              <div
                className="
                  [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:bg-gradient-to-r [&_h2]:from-green-400 [&_h2]:to-emerald-400 [&_h2]:bg-clip-text [&_h2]:text-transparent
                  [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-white/90 [&_h3]:mt-6 [&_h3]:mb-2
                  [&_p]:text-white/70 [&_p]:leading-relaxed [&_p]:mb-4
                  [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ul]:text-white/70
                  [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4 [&_ol]:text-white/70
                  [&_li]:mb-2 [&_li]:text-white/70
                  [&_strong]:text-white [&_strong]:font-semibold
                  [&_em]:text-white/80 [&_em]:italic
                  [&_a]:text-green-400 [&_a]:underline [&_a:hover]:text-green-300"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            )}
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}