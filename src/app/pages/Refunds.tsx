import { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { GlassCard } from '../components/shared/GlassCard';
import { SeoHead } from '../components/shared/SeoHead';
import { RefreshCw } from 'lucide-react';
import { api } from '../utils/api';
import { useTranslation } from 'react-i18next';
import { fetchTranslations } from '../utils/translations';

export function Refunds() {
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
      const englishHtml = res.success && res.data?.refundsContent
        ? res.data.refundsContent
        : getDefaultRefundsContent();

      if (lang !== 'en') {
        const translations = await fetchTranslations(lang, 'legal');
        if (translations?.refundsContent) {
          setContent(translations.refundsContent);
          return;
        }
      }
      setContent(englishHtml);
    } catch (error) {
      console.error('Error fetching refunds content:', error);
      setContent(getDefaultRefundsContent());
    } finally {
      setLoading(false);
    }
  };

  const getDefaultRefundsContent = () => {
    return `
      <h2>1. Refund Eligibility</h2>
      <p>We want you to be completely satisfied with your purchase. If you're not happy with your Fastoosh product, you may be eligible for a refund under the following conditions:</p>
      <ul>
        <li>Request made within 30 days of purchase</li>
        <li>Product has a technical issue that we cannot resolve</li>
        <li>Product does not work as described</li>
        <li>Duplicate purchase was made by mistake</li>
      </ul>
      
      <h2>2. Non-Refundable Items</h2>
      <p>The following items are not eligible for refunds:</p>
      <ul>
        <li>Free products and downloads</li>
        <li>Products purchased more than 30 days ago</li>
        <li>Custom work or commissioned projects</li>
        <li>Products that have been significantly used or modified</li>
      </ul>
      
      <h2>3. How to Request a Refund</h2>
      <p>To request a refund, please follow these steps:</p>
      <ol>
        <li>Contact our support team through the contact form or support email</li>
        <li>Provide your order number and purchase email</li>
        <li>Explain the reason for your refund request</li>
        <li>If applicable, describe any technical issues you experienced</li>
      </ol>
      
      <h2>4. Refund Processing Time</h2>
      <p>Once your refund request is approved:</p>
      <ul>
        <li>Refunds are processed within 5-7 business days</li>
        <li>The refund will be issued to your original payment method</li>
        <li>You will receive an email confirmation once the refund is processed</li>
        <li>It may take an additional 5-10 business days for the refund to appear in your account, depending on your bank or payment provider</li>
      </ul>
      
      <h2>5. Partial Refunds</h2>
      <p>In certain situations, partial refunds may be granted:</p>
      <ul>
        <li>If only part of your order is eligible for a refund</li>
        <li>If a product has been partially used or accessed</li>
        <li>At our discretion for special circumstances</li>
      </ul>
      
      <h2>6. Subscription Cancellations</h2>
      <p>For subscription-based products:</p>
      <ul>
        <li>You can cancel your subscription at any time</li>
        <li>Cancellation takes effect at the end of the current billing period</li>
        <li>No refunds are provided for partial subscription periods</li>
        <li>You will retain access to the product until the end of your paid period</li>
      </ul>
      
      <h2>7. Technical Support First</h2>
      <p>Before requesting a refund for technical issues, we encourage you to:</p>
      <ul>
        <li>Contact our support team for assistance</li>
        <li>Allow us to help troubleshoot the problem</li>
        <li>Check our documentation and FAQ section</li>
      </ul>
      <p>Many issues can be resolved quickly with proper support, and we're here to help!</p>
      
      <h2>8. Refund Policy Changes</h2>
      <p>We reserve the right to modify this refund policy at any time. Changes will be posted on this page with an updated revision date.</p>
      
      <h2>9. Contact Us</h2>
      <p>If you have any questions about our refund policy or need to request a refund, please contact us through our website support form.</p>
    `;
  };

  return (
    <div className="min-h-screen py-24 px-6">
      <SeoHead
        pageKey="refunds"
        fallback={{
          title: 'Refund Policy — Fastoosh',
          description: 'Learn about our refund policy and how to request a refund for Fastoosh products and services.',
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
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 mb-6">
            <RefreshCw className="w-8 h-8 text-blue-400" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            <span className="bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
              {{ en: 'Refund Policy', fr: 'Politique de remboursement', ar: 'سياسة الاسترداد' }[lang] ?? 'Refund Policy'}
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
                <div className="w-8 h-8 border-2 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
              </div>
            ) : (
              <div
                className="
                  [&_h2]:text-2xl [&_h2]:font-bold [&_h2]:mt-10 [&_h2]:mb-4 [&_h2]:bg-gradient-to-r [&_h2]:from-blue-400 [&_h2]:to-cyan-400 [&_h2]:bg-clip-text [&_h2]:text-transparent
                  [&_h3]:text-xl [&_h3]:font-semibold [&_h3]:text-white/90 [&_h3]:mt-6 [&_h3]:mb-2
                  [&_p]:text-white/70 [&_p]:leading-relaxed [&_p]:mb-4
                  [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:mb-4 [&_ul]:text-white/70
                  [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:mb-4 [&_ol]:text-white/70
                  [&_li]:mb-2 [&_li]:text-white/70
                  [&_strong]:text-white [&_strong]:font-semibold
                  [&_em]:text-white/80 [&_em]:italic
                  [&_a]:text-blue-400 [&_a]:underline [&_a:hover]:text-blue-300"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            )}
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}