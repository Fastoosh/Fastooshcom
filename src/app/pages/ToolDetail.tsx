import { FreeDownloadModal } from '../components/shared/FreeDownloadModal';
import { useUserAuth } from '../hooks/useUserAuth';
import { useParams, Link } from 'react-router';
import { GlassCard } from '../components/shared/GlassCard';
import { NeonButton } from '../components/shared/NeonButton';
import { ToolSupportModal } from '../components/shared/ToolSupportModal';
import { UserAuthModal } from '../components/shared/UserAuthModal';
import { SeoHead } from '../components/shared/SeoHead';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import {
  ArrowLeft, Check, Download, Play, ChevronDown, ChevronUp,
  Monitor, Zap, Star, ExternalLink, Sparkles, ShoppingCart, Quote,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import useEmblaCarousel from 'embla-carousel-react';
import { useTracker } from '../hooks/useTracker';
import { useTranslation } from 'react-i18next';
import { fetchTranslations, deepMergeTranslations } from '../utils/translations';
import { api } from '../utils/api';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

const STATUS_COLOR_MAP: Record<string, string> = {
  purple: 'from-purple-500 to-violet-500',
  green:  'from-green-500 to-emerald-500',
  amber:  'from-yellow-500 to-orange-500',
  cyan:   'from-cyan-500 to-blue-400',
  pink:   'from-pink-500 to-fuchsia-500',
  red:    'from-red-500 to-rose-400',
};

const DEFAULT_STATUSES = [
  { label: 'New',     color: 'green'  },
  { label: 'Popular', color: 'purple' },
  { label: 'Pro',     color: 'amber'  },
  { label: 'Free',    color: 'cyan'   },
];

// ── Types ─────────────────────────────────────────────────────────────────────

interface RichFeature {
  id: string;
  title: string;
  description: string;
  screenshots: string[];
}

interface ToolVersion {
  id: string;
  versionType: 'Free' | 'Pro' | 'Studio';
  versionTypeOriginal?: 'Free' | 'Pro' | 'Studio'; // Store original before translation
  pricingModel?: 'subscription' | 'lifetime';
  monthlyPrice?: string;
  yearlyPrice?: string;
  lifetimePrice?: string;
  pricingDisplay?: string; // Server-computed display string (legacy / fallback)
  downloadUrl: string;
  lemonSqueezyVariantId?: string;
  features?: string[];
  richFeatures?: RichFeature[];
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseYouTube(url: string): { embedUrl: string; videoId: string } | null {
  if (!url) return null;
  let videoId = '';
  const embedMatch = url.match(/youtube\.com\/embed\/([^?&]+)/);
  if (embedMatch) videoId = embedMatch[1];
  const watchMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^?&]+)/);
  if (watchMatch) videoId = watchMatch[1];
  if (!videoId) return null;
  return {
    videoId,
    embedUrl: `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`,
  };
}

interface ParsedPricing {
  /** Big number shown in the card, e.g. "$9", "$49", "Free" */
  mainPrice: string;
  /** Period shown inline next to mainPrice, e.g. "/ mo", "/ yr", "" */
  period: string;
  /** Small muted line below the price */
  subLabel: string;
  /** Compact string for the CTA button, e.g. "$9 / mo" */
  ctaPrice: string;
  cleanFeatures: string[];
}

function parsePricing(version: ToolVersion, billingCycle: 'monthly' | 'yearly' = 'monthly'): ParsedPricing {
  const raw = version.features ?? [];
  const cleanFeatures: string[] = [];

  // Add $ prefix if value is a bare number (admin may omit currency symbol)
  const fmt = (s: string): string => {
    if (!s || s === 'Free') return s;
    return /^\d/.test(s.trim()) ? `$${s.trim()}` : s.trim();
  };

  // Extract raw price fields from sentinel or direct version fields
  let model   = version.pricingModel ?? 'lifetime';
  let monthly = version.monthlyPrice  ?? '';
  let yearly  = version.yearlyPrice   ?? '';
  let lifetime = version.lifetimePrice ?? '';
  let sentinelFound = false;

  for (const item of raw) {
    if (item.startsWith('💰 ') && !sentinelFound) {
      sentinelFound = true;
      const sentinel = item.replace('💰 ', '');
      if (sentinel === 'Free') {
        // handled below
      } else if (sentinel.startsWith('subscription|')) {
        const [, p1, p2] = sentinel.split('|');
        model   = 'subscription';
        monthly = p1 ?? '';
        yearly  = p2 ?? '';
      } else if (sentinel.startsWith('lifetime|')) {
        const [, p1] = sentinel.split('|');
        model    = 'lifetime';
        lifetime = p1 ?? '';
      } else {
        // Legacy plain-text sentinel — treat as lifetime label
        lifetime = sentinel;
      }
    } else {
      cleanFeatures.push(item);
    }
  }

  // ── Free ──
  const originalType = version.versionTypeOriginal || version.versionType;
  if (originalType === 'Free') {
    return { mainPrice: 'Free', period: '', subLabel: 'forever free', ctaPrice: 'Free', cleanFeatures };
  }

  // ── Lifetime ──
  if (model === 'lifetime') {
    const price = fmt(lifetime) || '—';
    return {
      mainPrice: price,
      period: '',
      subLabel: 'one-time payment',
      ctaPrice: price,
      cleanFeatures,
    };
  }

  // ── Subscription ──
  // Normalise: strip leading "$" for math, re-add for display
  const toNum = (s: string) => parseFloat(s.replace(/[^0-9.]/g, '')) || 0;
  const hasMo = monthly.trim() !== '';
  const hasYr = yearly.trim()  !== '';

  if (hasMo && hasYr) {
    const yrNum = toNum(yearly);
    const fmtMo = fmt(monthly);
    const fmtYr = fmt(yearly);

    if (billingCycle === 'yearly') {
      const perMonth = yrNum / 12;
      const perMonthStr = perMonth % 1 === 0
        ? `$${perMonth}`
        : `$${perMonth.toFixed(2)}`;
      return {
        mainPrice: perMonthStr,
        period: '/ mo',
        subLabel: `billed ${fmtYr} / yr`,
        ctaPrice: fmtYr,
        cleanFeatures,
      };
    }

    // monthly
    return {
      mainPrice: fmtMo,
      period: '/ mo',
      subLabel: 'billed monthly',
      ctaPrice: `${fmtMo} / mo`,
      cleanFeatures,
    };
  }
  if (hasMo) {
    const fmtMo = fmt(monthly);
    return { mainPrice: fmtMo, period: '/ mo', subLabel: 'billed monthly', ctaPrice: `${fmtMo} / mo`, cleanFeatures };
  }
  if (hasYr) {
    const fmtYr = fmt(yearly);
    return { mainPrice: fmtYr, period: '/ yr', subLabel: 'billed annually', ctaPrice: `${fmtYr} / yr`, cleanFeatures };
  }

  // Legacy fallback: server set pricingDisplay from old plain-text sentinel
  // but didn't set pricingModel / individual price fields.
  if (version.pricingDisplay && version.pricingDisplay !== 'Free') {
    const display = fmt(version.pricingDisplay);
    return { mainPrice: display, period: '', subLabel: 'one-time payment', ctaPrice: display, cleanFeatures };
  }

  return { mainPrice: '—', period: '', subLabel: '', ctaPrice: '', cleanFeatures };
}

// ── DemoPlayer ────────────────────────────────────────────────────────────────

function DemoPlayer({ url, toolId, toolName, toolSlug }: { url: string; toolId: string; toolName: string; toolSlug: string }) {
  const [playing, setPlaying] = useState(false);
  const { track } = useTracker();
  const { t } = useTranslation();
  const yt = parseYouTube(url);
  const thumbnailUrl = yt ? `https://img.youtube.com/vi/${yt.videoId}/maxresdefault.jpg` : null;

  const handlePlay = () => {
    setPlaying(true);
    track('video_play', { toolId, toolName, toolSlug, videoId: yt?.videoId || url });
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="mb-20"
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs font-semibold tracking-widest text-white/30 uppercase">{t('tools.detail.seeInAction')}</span>
        <div className="h-px flex-1 bg-white/10" />
      </div>

      {/* Video container — contained rounded card, NOT full bleed */}
      <div
        className="relative w-full rounded-2xl overflow-hidden border border-white/10 bg-black/40"
        style={{ aspectRatio: '16/9' }}
      >
        {playing ? (
          <iframe
            src={yt ? yt.embedUrl : url}
            className="absolute inset-0 w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            title="Tool demo video"
          />
        ) : (
          <button
            onClick={handlePlay}
            className="absolute inset-0 w-full h-full group focus:outline-none"
            aria-label="Play demo"
          >
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt="Demo preview"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.02]"
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-purple-950 to-blue-950" />
            )}

            {/* Dim overlay */}
            <div className="absolute inset-0 bg-black/50 group-hover:bg-black/40 transition-colors" />

            {/* Subtle vignette */}
            <div className="absolute inset-0 bg-radial-gradient pointer-events-none"
              style={{ background: 'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.6) 100%)' }}
            />

            {/* Play button */}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
              <div className="relative">
                {/* Glow ring */}
                <div className="absolute inset-0 rounded-full bg-purple-500/20 blur-xl scale-150" />
                <div className="relative w-16 h-16 rounded-full border border-white/20 bg-white/10 backdrop-blur-xl
                  flex items-center justify-center
                  group-hover:scale-110 group-hover:border-purple-400/50 transition-all duration-300">
                  <Play className="w-6 h-6 text-white fill-white ml-0.5" />
                </div>
              </div>
              <span className="text-sm text-white/60 font-medium group-hover:text-white/80 transition-colors">
                {t('tools.detail.clickToPlay')}
              </span>
            </div>
          </button>
        )}
      </div>
    </motion.section>
  );
}

// ── PricingCard ───────────────────────────────────────────────────────────────

function PricingCard({
  version,
  index,
  user,
  userPurchasedProductNames,
  onSignInRequired,
  onFreeDownload,
  onBuyClick,
  sessionId,
  billingCycle,
}: {
  version: ToolVersion;
  index: number;
  user: ReturnType<typeof useUserAuth>['user'];
  userPurchasedProductNames: string[];
  onSignInRequired: (msg?: string) => void;
  onFreeDownload: (v: ToolVersion) => void;
  onBuyClick?: (v: ToolVersion) => void;
  sessionId?: string;
  billingCycle?: 'monthly' | 'yearly';
}) {
  const { t, i18n } = useTranslation();
  const { mainPrice, period, subLabel, ctaPrice, cleanFeatures } = parsePricing(version, billingCycle ?? 'monthly');
  // Use original versionType for logic checks (not translated)
  const originalType = version.versionTypeOriginal || version.versionType;
  const isPro = originalType === 'Pro';
  const isFree = originalType === 'Free';

  // Translate period for AR only — EN and FR keep the raw string untouched
  const translatedPeriod = i18n.language === 'ar'
    ? period === '/ mo' ? '/ شهر'
    : period === '/ yr' ? '/ سنة'
    : period
    : period;
  
  // Translate the subLabel if it's a known key
  let translatedSubLabel = subLabel;
  if (subLabel === 'billed monthly') {
    translatedSubLabel = t('tools.detail.billedMonthly');
  } else if (subLabel === 'billed annually') {
    translatedSubLabel = t('tools.detail.billedAnnually');
  } else if (subLabel === 'one-time payment') {
    translatedSubLabel = t('tools.detail.oneTimePayment');
  } else if (subLabel === 'forever free') {
    translatedSubLabel = t('tools.detail.foreverFree');
  } else if (subLabel.startsWith('billed ')) {
    // Handle "billed $90 / yr" format
    const match = subLabel.match(/^billed (.+)$/);
    if (match) {
      translatedSubLabel = `${t('tools.detail.billedAnnually').replace('fée', '')} ${match[1]}`.trim();
    }
  }

  // AR only: replace any remaining English period suffixes in the sub-label
  if (i18n.language === 'ar') {
    translatedSubLabel = translatedSubLabel.replace('/ yr', '/ سنة').replace('/ mo', '/ شهر');
  }
  
  // Prefer rich feature titles if available, otherwise fall back to plain features
  const displayFeatures = (version.richFeatures ?? []).length > 0
    ? (version.richFeatures ?? []).map(f => f.title).filter(Boolean)
    : cleanFeatures;

  // Use boolean checks instead of string matching to avoid translation issues
  const config = isFree
    ? { accent: 'text-emerald-400', dot: 'bg-emerald-400', ring: '', border: 'border-emerald-500/30', text: 'text-emerald-300' }
    : isPro
    ? { accent: 'text-purple-400',  dot: 'bg-purple-400',  ring: 'ring-1 ring-purple-500/30 border-purple-500/40', border: 'border-purple-500/30', text: 'text-purple-300' }
    : { accent: 'text-sky-400', dot: 'bg-sky-400', ring: '', border: 'border-sky-500/30', text: 'text-sky-300' };

  // Build the checkout URL with pre-filled user data
  const buildCheckoutUrl = () => {
    if (!version.downloadUrl) return '/work-with-us';
    try {
      const url = new URL(version.downloadUrl);
      if (user?.email) url.searchParams.set('checkout[email]', user.email);
      if (user?.id)    url.searchParams.set('checkout[custom][user_id]', user.id);
      // Pass version ID so the webhook can record tool_version_id
      url.searchParams.set('checkout[custom][tool_version_id]', version.id);
      // Pass session ID so the webhook can mark the session as converted
      if (sessionId) url.searchParams.set('checkout[custom][session_id]', sessionId);
      return url.toString();
    } catch {
      return version.downloadUrl;
    }
  };

  const handlePaidCTA = () => {
    if (!user) {
      onSignInRequired('Sign in to purchase and access your license key.');
      return;
    }
    onBuyClick?.(version);
    const url = buildCheckoutUrl();
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.08 }}
      className="h-full"
    >
      <GlassCard className={`relative p-7 h-full flex flex-col ${config.ring}`} neonBorder={isPro}>
        {isPro && (
          <div className="absolute top-3 right-3 rtl:right-auto rtl:left-3">
            <span className="px-3 py-1 rounded-full text-[11px] font-bold tracking-wide
              bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md shadow-purple-500/30">
              {t('tools.detail.mostPopular')}
            </span>
          </div>
        )}

        {/* Version label */}
        <div className="flex items-center gap-2 mb-5">
          <span className={`w-2 h-2 rounded-full ${config.dot}`} />
          <span className={`text-sm font-bold uppercase ${config.accent}`}>
            {t(`tools.versionTypes.${version.versionTypeOriginal}`, { defaultValue: version.versionTypeOriginal })}
          </span>
        </div>

        {/* Price */}
        <div className="mb-6">
          {isFree ? (
            <>
              <div className={`text-4xl font-black ${config.accent}`}>{t('tools.free')}</div>
              <p className="text-white/30 text-xs mt-1">{t('tools.detail.foreverFree')}</p>
            </>
          ) : (
            <>
              {/* Main price + period on one line */}
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-white">{mainPrice || '—'}</span>
                {translatedPeriod && (
                  <span className="text-base font-medium text-white/40">{translatedPeriod}</span>
                )}
              </div>
              {/* Sub-label: e.g. "$90 / yr · save 17%" or "one-time payment" */}
              {translatedSubLabel && (
                <p className="text-white/30 text-xs mt-1">{translatedSubLabel}</p>
              )}
            </>
          )}
        </div>

        {/* Feature list */}
        {displayFeatures.length > 0 && (
          <ul className="space-y-2.5 flex-grow mb-7">
            {displayFeatures.map((item, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <Check className={`w-3.5 h-3.5 mt-0.5 flex-shrink-0 ${config.accent}`} />
                <span className="text-white/60 text-sm leading-snug">{item}</span>
              </li>
            ))}
          </ul>
        )}

        {/* CTA */}
        <div className="mt-auto">
          {isFree ? (
            /* ── Free: email-gate for guests, direct for signed-in users ── */
            <div>
              <button
                onClick={() => onFreeDownload(version)}
                className={`w-full inline-flex items-center justify-center gap-2 rtl:flex-row-reverse
                  px-5 py-3 rounded-xl text-sm font-semibold transition-all
                  bg-white/8 hover:bg-white/12 border ${config.border}
                  hover:border-opacity-50 ${config.text}`}
              >
                <Download className="w-3.5 h-3.5" />
                {t('tools.detail.downloadFree')}
              </button>
              {!user && (
                <p className="text-center text-white/35 text-xs mt-2 leading-snug">
                  {t('tools.detail.freeGuestHint')}
                </p>
              )}
            </div>
          ) : (
            /* ── Paid: smart checkout CTA ── */
            <div>
              <button
                onClick={handlePaidCTA}
                className={`w-full inline-flex items-center justify-center gap-2 rtl:flex-row-reverse
                  px-5 py-3 rounded-xl text-sm font-semibold transition-all
                  ${isPro
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg shadow-purple-500/25'
                    : 'bg-white/10 hover:bg-white/15 border border-white/15 text-white'
                  }`}
              >
                <ShoppingCart className="w-3.5 h-3.5" />
                {user
                  ? `${t('tools.detail.buyNow')}${ctaPrice ? ` · ${ctaPrice}` : ''}`
                  : isPro ? t('tools.detail.getPro') : t('tools.detail.getStudio')}
              </button>
              {!user && (
                <p className="text-center text-white/35 text-xs mt-2 leading-snug">
                  {t('tools.detail.paidGuestHint')}
                </p>
              )}
            </div>
          )}
        </div>
      </GlassCard>
    </motion.div>
  );
}

// ── FaqItem ───────────────────────────────────────────────────────────────────

function FaqItem({ faq, defaultOpen = false }: { faq: { question: string; answer: string }; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-white/8 last:border-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between rtl:flex-row-reverse py-5 text-left rtl:text-right gap-4"
      >
        <span className="text-white/80 font-medium text-sm">{faq.question}</span>
        <span className="flex-shrink-0">
          {open
            ? <ChevronUp className="w-4 h-4 text-purple-400" />
            : <ChevronDown className="w-4 h-4 text-white/30" />}
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <p className="pb-5 text-white/50 text-sm leading-relaxed">{faq.answer}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── SectionLabel ──────────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 mb-8">
      <div className="h-px flex-1 bg-white/8" />
      <span className="text-xs font-bold tracking-widest text-white/30 uppercase">{children}</span>
      <div className="h-px flex-1 bg-white/8" />
    </div>
  );
}

// ── ScreenshotCarousel ────────────────────────────────────────────────────────

function ScreenshotCarousel({ screenshots }: { screenshots: string[] }) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true, dragFree: false });
  const [current, setCurrent] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setCurrent(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on('select', onSelect);
    return () => { emblaApi.off('select', onSelect); };
  }, [emblaApi, onSelect]);

  const validShots = screenshots.filter(Boolean);
  if (validShots.length === 0) return null;

  if (validShots.length === 1) {
    return (
      <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/30 shadow-2xl">
        <img
          src={validShots[0]}
          alt="Feature screenshot"
          className="w-full h-auto object-contain max-h-[420px]"
          onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
        />
      </div>
    );
  }

  return (
    <div className="relative rounded-2xl overflow-hidden border border-white/10 bg-black/30 shadow-2xl group">
      {/* Slides */}
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex touch-pan-y">
          {validShots.map((src, i) => (
            <div key={i} className="flex-[0_0_100%] min-w-0">
              <img
                src={src}
                alt={`Screenshot ${i + 1}`}
                className="w-full h-auto object-contain max-h-[420px]"
                onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0'; }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Prev / Next arrows */}
      <button
        onClick={() => emblaApi?.scrollPrev()}
        className="absolute left-3 top-1/2 -translate-y-1/2 z-10
          w-9 h-9 rounded-full bg-black/60 border border-white/10 backdrop-blur-md
          flex items-center justify-center text-white/60
          hover:bg-black/80 hover:text-white opacity-0 group-hover:opacity-100
          transition-all duration-200"
        aria-label="Previous screenshot"
      >
        <ChevronLeft className="w-4 h-4" />
      </button>
      <button
        onClick={() => emblaApi?.scrollNext()}
        className="absolute right-3 top-1/2 -translate-y-1/2 z-10
          w-9 h-9 rounded-full bg-black/60 border border-white/10 backdrop-blur-md
          flex items-center justify-center text-white/60
          hover:bg-black/80 hover:text-white opacity-0 group-hover:opacity-100
          transition-all duration-200"
        aria-label="Next screenshot"
      >
        <ChevronRight className="w-4 h-4" />
      </button>

      {/* Dots */}
      <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 pointer-events-none">
        {validShots.map((_, i) => (
          <button
            key={i}
            onClick={() => emblaApi?.scrollTo(i)}
            className={`pointer-events-auto rounded-full transition-all duration-300 ${
              i === current
                ? 'w-5 h-1.5 bg-white'
                : 'w-1.5 h-1.5 bg-white/30 hover:bg-white/60'
            }`}
            aria-label={`Go to slide ${i + 1}`}
          />
        ))}
      </div>

      {/* Slide counter badge */}
      <div className="absolute top-3 right-3 px-2 py-0.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 text-white/50 text-[10px] font-mono">
        {current + 1} / {validShots.length}
      </div>
    </div>
  );
}

// ── FeaturesShowcase ────────��─────────────────────────────────────────────────

function FeaturesShowcase({
  versions,
  user,
  sessionId,
  onFreeDownload,
  onSignInRequired,
  onBuyClick,
}: {
  versions: ToolVersion[];
  user: ReturnType<typeof useUserAuth>['user'];
  sessionId?: string;
  onFreeDownload: (v: ToolVersion) => void;
  onSignInRequired: (msg?: string) => void;
  onBuyClick?: (v: ToolVersion) => void;
}) {
  const { t } = useTranslation();
  // Use Pro version features first, then Free, then first version
  const proVersion = versions.find(v => (v.versionTypeOriginal || v.versionType) === 'Pro');
  const freeVersion = versions.find(v => (v.versionTypeOriginal || v.versionType) === 'Free');
  const primaryVersion = proVersion ?? freeVersion ?? versions[0];

  const richFeatures = (primaryVersion?.richFeatures ?? []).filter(f => f.title?.trim());
  if (richFeatures.length === 0) return null;

  const isFree = (primaryVersion?.versionTypeOriginal || primaryVersion?.versionType) === 'Free';

  const buildCheckoutUrl = () => {
    if (!primaryVersion?.downloadUrl) return '/work-with-us';
    try {
      const url = new URL(primaryVersion.downloadUrl);
      if (user?.email) url.searchParams.set('checkout[email]', user.email);
      if (user?.id)    url.searchParams.set('checkout[custom][user_id]', user.id);
      url.searchParams.set('checkout[custom][tool_version_id]', primaryVersion.id);
      if (sessionId) url.searchParams.set('checkout[custom][session_id]', sessionId);
      return url.toString();
    } catch { return primaryVersion?.downloadUrl ?? '#'; }
  };

  const handleCTA = () => {
    if (!primaryVersion) return;
    if (isFree) {
      onFreeDownload(primaryVersion);
    } else {
      if (!user) { onSignInRequired('Sign in to purchase and access your license key.'); return; }
      onBuyClick?.(primaryVersion);
      window.open(buildCheckoutUrl(), '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="mb-24"
    >
      <SectionLabel>{t('tools.detail.whatYouCanDo')}</SectionLabel>

      <div className="space-y-20 md:space-y-28">
        {richFeatures.map((feature, index) => {
          const isReversed = index % 2 === 1;
          const hasScreenshots = (feature.screenshots ?? []).filter(Boolean).length > 0;

          return (
            <motion.div
              key={feature.id ?? index}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-60px' }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center"
            >
              {/* ── Text side ── */}
              <div className={`flex flex-col justify-center ${isReversed ? 'md:order-2' : 'md:order-1'}`}>
                {/* Feature number */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-[11px] font-bold tracking-[0.2em] uppercase text-purple-400/60">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="h-px flex-1 bg-gradient-to-r from-purple-500/30 to-transparent rtl:bg-gradient-to-l max-w-[60px]" />
                </div>

                {/* Title */}
                <h3 className="text-2xl sm:text-3xl font-bold text-white mb-4 leading-tight">
                  {feature.title}
                </h3>

                {/* Description */}
                {feature.description?.trim() && (
                  <p className="text-white/50 text-base leading-relaxed mb-8">
                    {feature.description}
                  </p>
                )}

                {/* CTA button */}
                <div>
                  <button
                    onClick={handleCTA}
                    className={`inline-flex items-center gap-2.5 rtl:flex-row-reverse px-6 py-3 rounded-xl
                      text-sm font-semibold transition-all duration-200 active:scale-[0.97]
                      ${isFree
                        ? 'bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/30 text-emerald-300 hover:text-emerald-200'
                        : 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg shadow-purple-900/40 hover:shadow-purple-500/30'
                      }`}
                  >
                    {isFree
                      ? <Download className="w-4 h-4" />
                      : <ShoppingCart className="w-4 h-4" />}
                    {isFree
                      ? t('tools.detail.downloadFree')
                      : t('tools.detail.getPro')}
                  </button>
                </div>
              </div>

              {/* ── Media side ── */}
              <div className={`${isReversed ? 'md:order-1' : 'md:order-2'}`}>
                {hasScreenshots ? (
                  <ScreenshotCarousel screenshots={feature.screenshots ?? []} />
                ) : (
                  /* Placeholder card when no screenshots yet */
                  <div className="relative rounded-2xl overflow-hidden border border-white/8 bg-gradient-to-br from-purple-950/60 to-slate-950/60 aspect-video flex flex-col items-center justify-center gap-3 p-8 text-center">
                    {/* Decorative glow */}
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-500/5 to-blue-500/5" />
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-purple-600/10 blur-3xl" />
                    <div className="relative text-5xl font-black text-white/5 select-none leading-none">
                      {String(index + 1).padStart(2, '0')}
                    </div>
                    <p className="relative text-white/20 text-sm font-medium">{feature.title}</p>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.section>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function ToolDetail() {
  const { slug } = useParams();
  const { t, i18n } = useTranslation();
  const { user, session, signInWithEmail, signUpWithEmail, forgotPassword, signInWithOAuth } = useUserAuth();
  const { track, setUser, sessionId } = useTracker();
  const [tool, setTool] = useState<Tool | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [supportOpen, setSupportOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMessage, setAuthModalMessage] = useState<string | undefined>(undefined);
  const [statuses, setStatuses] = useState<{ label: string; color: string }[]>(DEFAULT_STATUSES);
  // Free download modal state
  const [freeDownloadVersion, setFreeDownloadVersion] = useState<ToolVersion | null>(null);
  const [userPurchasedProductNames, setUserPurchasedProductNames] = useState<string[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  // Billing cycle toggle — only relevant when a subscription version has both prices
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly'>('yearly');
  // CMS category translations for tool status badges { "New": "Nouveau", ... }
  const [cmsStatusTrans, setCmsStatusTrans] = useState<Record<string, string>>({});
  const isRTL = i18n.language === 'ar';

  // Single effect — handles slug change AND language switch.
  // loadTool now fetches tool + translations in one Promise.all so the
  // component always renders translated content on the very first paint.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadTool(); }, [slug, i18n.language]);

  // Sync user identity into tracker when user changes
  useEffect(() => {
    if (user?.id && user?.email) setUser(user.id, user.email);
  }, [user?.id]);

  // Load user purchases to check ownership
  useEffect(() => {
    if (!session?.access_token) return;
    fetch(`${API_BASE}/user/purchases`, {
      headers: {
        Authorization: `Bearer ${publicAnonKey}`,
        'X-User-Token': session.access_token,
      },
    })
      .then(r => r.json())
      .then(data => {
        if (data.success && data.data) {
          const names = data.data.map((p: any) =>
            (p.product_name || p.productName || '').toLowerCase()
          );
          setUserPurchasedProductNames(names);
        }
      })
      .catch(err => console.warn('Could not load purchases:', err));
  }, [session]);

  const openAuthModal = (msg?: string) => {
    setAuthModalMessage(msg);
    setAuthModalOpen(true);
  };

  // Track the last slug we fired tool_view for, so re-running on language
  // change doesn't double-count page views or re-fetch reviews unnecessarily.
  const lastTrackedSlug = useRef<string | null>(null);

  const loadTool = async () => {
    const lang = i18n.language; // capture at call time — effect re-runs on change
    try {
      setLoading(true);
      setError(null);

      // All four requests run in parallel; api.getTools / api.getSettings are
      // read-through cached so repeat visits are instant (< 1 ms cache hit).
      const [result, settingsData, trans, categoryTrans] = await Promise.all([
        api.getTools(),
        api.getSettings(),
        lang !== 'en' ? fetchTranslations(lang, 'tools')      : Promise.resolve({}),
        lang !== 'en' ? fetchTranslations(lang, 'categories') : Promise.resolve({}),
      ]);

      if (settingsData?.data?.toolStatuses?.length) {
        setStatuses(settingsData.data.toolStatuses);
      }
      if (!result.success) throw new Error('Network error — could not reach server');
      if (result.success && result.data) {
        let found = result.data.find((t: Tool) => t.slug === slug)
          || result.data.find((t: Tool) => t.id === slug);
        if (found) {
          if (!found.versions && (found as any).toolVersions)
            found = { ...found, versions: (found as any).toolVersions };
          // Preserve original versionType before any translation overrides
          if (found.versions) {
            found.versions = found.versions.map((v: ToolVersion) => ({
              ...v,
              versionTypeOriginal: v.versionTypeOriginal || v.versionType,
            }));
          }

          // ── Merge translations before first setState so UI never shows English ──
          if (lang !== 'en' && trans && Object.keys(trans).length > 0 && trans[found.id]) {
            const merged = deepMergeTranslations(found, trans[found.id]) as Tool;
            // Restore non-translatable version fields (prices, URLs, IDs)
            if (merged.versions && found.versions) {
              merged.versions = merged.versions.map((mv: ToolVersion, i: number) => {
                const orig = found.versions![i];
                if (!orig) return mv;
                return {
                  ...mv,
                  pricingModel:          orig.pricingModel,
                  monthlyPrice:          orig.monthlyPrice,
                  yearlyPrice:           orig.yearlyPrice,
                  lifetimePrice:         orig.lifetimePrice,
                  downloadUrl:           orig.downloadUrl,
                  lemonSqueezyVariantId: orig.lemonSqueezyVariantId,
                  versionTypeOriginal:   orig.versionTypeOriginal ?? orig.versionType,
                };
              });
            }
            setTool(merged);
          } else {
            setTool(found);
          }

          // CMS status-badge translations
          if (lang !== 'en' && categoryTrans && (categoryTrans as any).toolStatuses) {
            setCmsStatusTrans((categoryTrans as any).toolStatuses as Record<string, string>);
          } else {
            setCmsStatusTrans({});
          }

          // Track view + fetch reviews only when the slug genuinely changes
          if (lastTrackedSlug.current !== (found.slug ?? slug)) {
            lastTrackedSlug.current = found.slug ?? slug ?? null;
            track('tool_view', { toolId: found.id, toolName: found.name, toolSlug: found.slug ?? slug });
            fetchReviews(found.id);
          }
        } else {
          setError('Tool not found');
        }
      } else {
        setError('Failed to load tool');
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load tool');
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async (toolId: string) => {
    const url = `${API_BASE}/reviews?toolId=${encodeURIComponent(toolId)}`;
    const opts = { headers: { Authorization: `Bearer ${publicAnonKey}` } };
    try {
      let res: Response;
      try {
        res = await fetch(url, opts);
      } catch {
        // Cold-start retry after 1 s
        await new Promise(r => setTimeout(r, 1000));
        res = await fetch(url, opts);
      }
      const data = await res.json();
      if (data.success) setReviews(data.data || []);
    } catch (err) {
      console.warn('[ToolDetail] Could not load reviews:', err);
    }
  };

  // Handle free download — auto-download if signed in, show modal if guest
  const handleFreeDownload = async (version: ToolVersion) => {
    if (!version.downloadUrl) return;
    // Track free download intent
    track('free_download', { toolId: tool?.id, toolName: tool?.name, toolSlug: tool?.slug ?? '' });
    if (user) {
      // Signed-in: record lead silently then open the file
      try {
        await fetch(`${API_BASE}/free-download`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${publicAnonKey}`,
            ...(session?.access_token ? { 'X-User-Token': session.access_token } : {}),
          },
          body: JSON.stringify({
            email:         user.email,
            toolVersionId: version.id,
            toolName:      tool?.name ?? '',
            toolSlug:      tool?.slug ?? '',
          }),
        });
      } catch (err) {
        console.warn('[handleFreeDownload] Could not record lead:', err);
      }
      window.open(version.downloadUrl, '_blank', 'noopener,noreferrer');
    } else {
      // Guest: show email-capture modal
      setFreeDownloadVersion(version);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-white/30 text-sm animate-pulse">Loading…</div>
      </div>
    );
  }

  if (error || !tool) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 px-6">
        <p className="text-white/50">{error || 'Tool not found'}</p>
        <NeonButton href="/tools"><ArrowLeft className="w-4 h-4 mr-2 rtl:mr-0 rtl:ml-2 rtl:rotate-180" />Back to Tools</NeonButton>
      </div>
    );
  }

  // Cheapest paid version for the quick CTA
  const proVersion = tool.versions?.find(v => (v.versionTypeOriginal || v.versionType) === 'Pro');
  const freeVersion = tool.versions?.find(v => (v.versionTypeOriginal || v.versionType) === 'Free');
  const primaryVersion = proVersion ?? freeVersion ?? tool.versions?.[0];

  return (
    <div className="min-h-screen pt-8 pb-24">
      <SeoHead
        pageKey={`tool--${slug}`}
        fallback={{
          title: tool ? `${tool.name} — Fastoosh Tools` : 'Tool — Fastoosh',
          description: tool?.description || 'Professional After Effects tool by Fastoosh.',
          ogImage: tool?.imageUrl || undefined,
        }}
      />
      <div className="max-w-5xl mx-auto px-6">

        {/* ── Back nav ──────────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}>
          <Link
            to="/tools"
            className="inline-flex items-center gap-1.5 rtl:flex-row-reverse text-sm text-white/40
              hover:text-white/80 transition-colors mb-10"
          >
            <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
            {t('tools.detail.allTools')}
          </Link>
        </motion.div>

        {/* ── Category + badges ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex flex-wrap items-center gap-2 rtl:flex-row-reverse rtl:justify-end mb-5"
        >
          {tool.category && (() => {
            const match = statuses.find(s => s.label === tool.category);
            const gradient = STATUS_COLOR_MAP[match?.color || 'purple'] || 'from-purple-500 to-violet-500';
            return (
              <span className={`px-2.5 py-1 text-[11px] font-bold tracking-widest uppercase rounded-full bg-gradient-to-r ${gradient} text-white`}>
                {cmsStatusTrans[tool.category] || t(`tools.statuses.${tool.category}`, { defaultValue: tool.category })}
              </span>
            );
          })()}
          {tool.toolCategory && (
            <span className="px-2.5 py-1 text-[11px] font-bold tracking-widest uppercase rounded-full
              border border-white/20 text-white/70 bg-white/5 backdrop-blur-sm">
              {t(`tools.categories.${tool.toolCategory}`, { defaultValue: tool.toolCategory })}
            </span>
          )}
          {tool.featured && (
            <span className="px-2.5 py-1 text-[11px] font-bold tracking-widest uppercase rounded-full
              border border-purple-500/40 text-purple-300 bg-purple-500/10 flex items-center gap-1 rtl:flex-row-reverse">
              <Star className="w-2.5 h-2.5 fill-current" />Featured
            </span>
          )}
        </motion.div>

        {/* ── BIG TITLE — this is the visual hero ──────────────────────────── */}
        <motion.h1
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-black tracking-tight
            text-white leading-[0.95] mb-10"
        >
          {tool.name}
        </motion.h1>

        {/* ── Two-column: description left / image right ───────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-1 md:grid-cols-[1fr_380px] gap-8 items-start mb-16"
        >
          {/* Left: tagline + description + quick CTAs */}
          <div>
            {tool.tagline && (
              <p className="text-purple-300/80 font-semibold text-base mb-3 leading-snug">
                {tool.tagline}
              </p>
            )}
            <p className="text-white/55 text-base leading-relaxed mb-8">
              {tool.description}
            </p>
            {/* Quick-access CTAs */}
            <div className="flex flex-wrap gap-3 rtl:flex-row-reverse">
              {freeVersion && (
                <button
                  onClick={() => handleFreeDownload(freeVersion)}
                  className="inline-flex items-center gap-2 rtl:flex-row-reverse px-4 py-2.5 rounded-xl text-sm font-semibold
                    bg-white/8 hover:bg-emerald-500/15 border border-white/12
                    hover:border-emerald-500/30 text-emerald-300 hover:text-emerald-200 transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  {t('tools.detail.tryFree')}
                </button>
              )}
              {proVersion && (
                <NeonButton
                  href={proVersion.downloadUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="primary"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-2 rtl:mr-0 rtl:ml-2" />
                  {t('tools.detail.getPro')}
                </NeonButton>
              )}
              {tool.demoUrl && (
                <button
                  onClick={() => {
                    document.getElementById('demo-section')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="inline-flex items-center gap-2 rtl:flex-row-reverse px-4 py-2 rounded-xl
                    text-sm text-white/50 hover:text-white/80
                    border border-white/10 hover:border-white/20
                    bg-white/5 hover:bg-white/8 transition-all"
                >
                  <Play className="w-3.5 h-3.5" />
                  {t('tools.detail.watchDemo')}
                </button>
              )}
            </div>
          </div>

          {/* Right: contained image — NOT full bleed, properly rounded */}
          <div className="relative rounded-2xl overflow-hidden border border-white/10
            bg-white/5 aspect-square">
            {tool.imageUrl ? (
              <>
                <img
                  src={tool.imageUrl}
                  alt={tool.name}
                  className="w-full h-full object-cover"
                />
                {/* Very subtle inner shadow/vignette */}
                <div className="absolute inset-0 shadow-[inset_0_0_40px_rgba(0,0,0,0.4)]" />
              </>
            ) : (
              <div className="w-full h-full flex items-center justify-center
                bg-gradient-to-br from-purple-900/30 to-blue-900/30">
                <Sparkles className="w-12 h-12 text-white/20" />
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Demo video ────────────────────────────────────────────────────── */}
        <div id="demo-section">
          {tool.demoUrl && <DemoPlayer url={tool.demoUrl} toolId={tool.id} toolName={tool.name} toolSlug={tool.slug ?? ''} />}
        </div>

        {/* ── Pricing ───────────────────────────────────────────────────────── */}
        {tool.versions && tool.versions.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-20"
          >
            <SectionLabel>{t('tools.detail.chooseYourVersion')}</SectionLabel>

            {/* ── Billing cycle toggle — shown only for tools with subscription + both prices ── */}
            {tool.versions?.some(v =>
              v.pricingModel === 'subscription' && v.monthlyPrice?.trim() && v.yearlyPrice?.trim()
            ) && (
              <div className="flex justify-center mb-10">
                <div className="flex flex-col items-center gap-3">
                  {/* "Best value" badge floats above, dims when Monthly is active */}
                  <motion.div
                    animate={{ opacity: billingCycle === 'yearly' ? 1 : 0.3 }}
                    transition={{ duration: 0.2 }}
                    className="flex items-center gap-1.5 rtl:flex-row-reverse px-3 py-1 rounded-full
                      bg-gradient-to-r from-emerald-500/15 to-teal-500/10
                      border border-emerald-500/25 text-emerald-400 text-[11px] font-bold tracking-wide"
                  >
                    <span>✦</span>
                    {t('tools.detail.bestValue')}
                  </motion.div>

                  {/* Toggle pill — fixed-width buttons so the sliding bg is always accurate */}
                  <div className="relative flex p-1 rounded-xl bg-white/5 border border-white/10">
                    <div
                      style={{
                        position: 'absolute',
                        top: 4,
                        bottom: 4,
                        left: billingCycle === 'monthly' ? 4 : 'calc(50% + 2px)',
                        right: billingCycle === 'yearly' ? 4 : 'calc(50% + 2px)',
                        borderRadius: 10,
                        border: '1px solid',
                        background: billingCycle === 'yearly'
                          ? 'linear-gradient(135deg,rgba(16,185,129,.18),rgba(20,184,166,.10))'
                          : 'rgba(255,255,255,.09)',
                        borderColor: billingCycle === 'yearly'
                          ? 'rgba(16,185,129,.28)'
                          : 'rgba(255,255,255,.13)',
                        transition: [
                          'left 0.38s cubic-bezier(0.34,1.56,0.64,1)',
                          'right 0.38s cubic-bezier(0.34,1.56,0.64,1)',
                          'background 0.25s ease',
                          'border-color 0.25s ease',
                        ].join(', '),
                      }}
                    />
                    {isRTL ? (
                      <>
                        <button
                          onClick={() => setBillingCycle('yearly')}
                          className={`relative z-10 w-28 py-2.5 text-sm font-semibold rounded-[10px] transition-colors duration-200 ${
                            billingCycle === 'yearly' ? 'text-emerald-300' : 'text-white/35 hover:text-white/65'
                          }`}
                        >
                          {t('tools.detail.yearly')}
                        </button>
                        <button
                          onClick={() => setBillingCycle('monthly')}
                          className={`relative z-10 w-28 py-2.5 text-sm font-semibold rounded-[10px] transition-colors duration-200 ${
                            billingCycle === 'monthly' ? 'text-white' : 'text-white/35 hover:text-white/65'
                          }`}
                        >
                          {t('tools.detail.monthly')}
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setBillingCycle('monthly')}
                          className={`relative z-10 w-28 py-2.5 text-sm font-semibold rounded-[10px] transition-colors duration-200 ${
                            billingCycle === 'monthly' ? 'text-white' : 'text-white/35 hover:text-white/65'
                          }`}
                        >
                          {t('tools.detail.monthly')}
                        </button>
                        <button
                          onClick={() => setBillingCycle('yearly')}
                          className={`relative z-10 w-28 py-2.5 text-sm font-semibold rounded-[10px] transition-colors duration-200 ${
                            billingCycle === 'yearly' ? 'text-emerald-300' : 'text-white/35 hover:text-white/65'
                          }`}
                        >
                          {t('tools.detail.yearly')}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div className={`grid gap-5 ${
              tool.versions.length === 1 
                ? 'grid-cols-1 max-w-sm mx-auto' 
                : tool.versions.length === 2 
                  ? 'grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto' 
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            }`}>
              {tool.versions.map((v, i) => (
                <PricingCard
                  key={v.id}
                  version={v}
                  index={i}
                  user={user}
                  userPurchasedProductNames={userPurchasedProductNames}
                  onSignInRequired={openAuthModal}
                  onFreeDownload={handleFreeDownload}
                  sessionId={sessionId}
                  onBuyClick={(ver) => track('buy_click', {
                    toolId: tool.id, toolName: tool.name, toolSlug: tool.slug ?? '',
                    versionType: ver.versionType, price: parsePricing(ver).ctaPrice,
                  })}
                  billingCycle={billingCycle}
                />
              ))}
            </div>

            {/* Sign-in nudge for unauthenticated users */}
            {!user && (
              <motion.p
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                className="text-center text-white/30 text-sm mt-6"
              >
                <button
                  onClick={() => openAuthModal()}
                  className="text-purple-400 hover:text-purple-300 underline"
                >
                  {t('tools.detail.signIn')}
                </button>
                {' '}{t('tools.detail.signInToTrack')}
              </motion.p>
            )}
          </motion.section>
        )}

        {/* ── Features showcase ─────────────────────────────────────────────── */}
        {tool.versions && tool.versions.length > 0 && (
          <FeaturesShowcase
            versions={tool.versions}
            user={user}
            sessionId={sessionId}
            onFreeDownload={handleFreeDownload}
            onSignInRequired={openAuthModal}
            onBuyClick={(ver) => track('buy_click', {
              toolId: tool.id, toolName: tool.name, toolSlug: tool.slug ?? '',
              versionType: ver.versionType, price: parsePricing(ver).ctaPrice,
            })}
          />
        )}

        {/* ── How it works ──────────────────────────────────────────────────── */}
        {tool.howItWorks && tool.howItWorks.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-20"
          >
            <SectionLabel>{t('tools.detail.howItWorks')}</SectionLabel>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {tool.howItWorks.map((step, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 12 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.08 }}
                >
                  <GlassCard className="p-6 h-full">
                    <div className="text-3xl font-black text-white/8 mb-3 leading-none select-none">
                      {String(i + 1).padStart(2, '0')}
                    </div>
                    <h3 className="text-sm font-bold text-white mb-2">{step.title}</h3>
                    <p className="text-white/45 text-sm leading-relaxed">{step.description}</p>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* ── System requirements ───────────────────────────────────────────── */}
        {tool.systemRequirements && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-20"
          >
            <SectionLabel>{t('tools.detail.systemRequirements')}</SectionLabel>
            <GlassCard className="p-6 flex gap-4 items-start rtl:flex-row-reverse">
              <div className="w-8 h-8 rounded-lg bg-blue-500/15 border border-blue-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Monitor className="w-4 h-4 text-blue-400" />
              </div>
              <p className="text-white/50 text-sm whitespace-pre-line leading-relaxed">
                {tool.systemRequirements}
              </p>
            </GlassCard>
          </motion.section>
        )}

        {/* ── FAQ ───────────────────────────────────────────────────────────── */}
        {tool.faqs && tool.faqs.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-20"
          >
            <SectionLabel>{t('tools.detail.faqs')}</SectionLabel>
            <GlassCard className="px-6 divide-y divide-white/8 max-w-3xl mx-auto">
              {tool.faqs.map((faq, i) => (
                <FaqItem key={i} faq={faq} defaultOpen={i === 0} />
              ))}
            </GlassCard>
          </motion.section>
        )}

        {/* ── Reviews ───────────────────────────────────────────────────────── */}
        {reviews.length > 0 && (() => {
          const avg = Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10;
          const dist = [5, 4, 3, 2, 1].map(n => ({
            n,
            count: reviews.filter(r => r.rating === n).length,
          }));
          return (
            <motion.section
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="mb-20"
            >
              <SectionLabel>{t('tools.detail.userReviews')}</SectionLabel>

              {/* Summary bar */}
              <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center mb-8 p-6 rounded-2xl border border-white/8 bg-white/3">
                {/* Big score */}
                <div className="text-center flex-shrink-0">
                  <div className="text-5xl font-black text-white leading-none">{avg}</div>
                  <div className="flex gap-0.5 justify-center mt-2">
                    {[1, 2, 3, 4, 5].map(n => (
                      <Star key={n} className={`w-4 h-4 ${n <= Math.round(avg) ? 'text-yellow-400 fill-yellow-400' : 'text-white/15'}`} />
                    ))}
                  </div>
                  <p className="text-white/35 text-xs mt-1">{reviews.length} review{reviews.length !== 1 ? 's' : ''}</p>
                </div>

                {/* Distribution bars */}
                <div className="flex-1 space-y-1.5 w-full">
                  {dist.map(({ n, count }) => (
                    <div key={n} className="flex items-center gap-2 rtl:flex-row-reverse">
                      <span className="text-white/35 text-xs w-2 text-right flex-shrink-0">{n}</span>
                      <Star className="w-3 h-3 text-yellow-400/50 fill-yellow-400/50 flex-shrink-0" />
                      <div className="flex-1 h-1.5 rounded-full bg-white/8 overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          whileInView={{ width: reviews.length ? `${(count / reviews.length) * 100}%` : '0%' }}
                          viewport={{ once: true }}
                          transition={{ duration: 0.6, delay: (5 - n) * 0.06 }}
                          className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-yellow-400"
                        />
                      </div>
                      <span className="text-white/25 text-xs w-3 flex-shrink-0">{count}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Review cards grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {reviews.map((review, i) => (
                  <motion.div
                    key={review.id}
                    initial={{ opacity: 0, y: 12 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: i * 0.06 }}
                  >
                    <GlassCard className="p-5 h-full flex flex-col">
                      {/* Quote icon + stars */}
                      <div className="flex items-start justify-between gap-2 mb-3 rtl:flex-row-reverse">
                        <Quote className="w-5 h-5 text-purple-400/40 flex-shrink-0 -scale-x-100" />
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map(n => (
                            <Star key={n} className={`w-3.5 h-3.5 ${n <= review.rating ? 'text-yellow-400 fill-yellow-400' : 'text-white/12'}`} />
                          ))}
                        </div>
                      </div>

                      {/* Comment */}
                      {review.comment ? (
                        <p className="text-white/60 text-sm leading-relaxed flex-1 italic">
                          "{review.comment}"
                        </p>
                      ) : (
                        <p className="text-white/25 text-sm italic flex-1">No written review.</p>
                      )}

                      {/* Author */}
                      <div className="flex items-center gap-2 mt-4 pt-3 border-t border-white/6 rtl:flex-row-reverse">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-purple-500/30 to-blue-500/30 border border-white/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-white/60 text-[10px] font-bold">
                            {(review.userName || '?')[0].toUpperCase()}
                          </span>
                        </div>
                        <div className="min-w-0">
                          <p className="text-white/60 text-xs font-semibold truncate">{review.userName || 'Anonymous'}</p>
                          <p className="text-white/25 text-[10px]">
                            {review.updatedAt
                              ? new Date(review.updatedAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
                              : ''}
                          </p>
                        </div>
                        {/* Verified badge */}
                        <span className="ml-auto rtl:ml-0 rtl:mr-auto flex-shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                          ✓ Verified
                        </span>
                      </div>
                    </GlassCard>
                  </motion.div>
                ))}
              </div>

              {/* CTA for non-buyers */}
              {!user && (
                <p className="text-center text-white/30 text-sm mt-6">
                  <button onClick={() => openAuthModal()} className="text-purple-400 hover:text-purple-300 underline">
                    {t('tools.detail.signIn')}
                  </button>{' '}
                  {t('tools.detail.signInToReview')}
                </p>
              )}
            </motion.section>
          );
        })()}

        {/* ── Support CTA ───────────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <GlassCard neonBorder className="p-10 flex flex-col sm:flex-row items-center justify-between gap-6 rtl:sm:flex-row-reverse">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-bold text-white">{t('tools.detail.needHelp')}</span>
              </div>
              <p className="text-white/40 text-sm">
                {t('tools.detail.emailSupport')}
              </p>
            </div>
            <div className="flex gap-3 flex-shrink-0 rtl:flex-row-reverse">
              <NeonButton variant="secondary" onClick={() => setSupportOpen(true)}>
                <ExternalLink className="w-3.5 h-3.5 mr-2 rtl:mr-0 rtl:ml-2" />
                {t('tools.detail.contactSupport')}
              </NeonButton>
              <NeonButton href="/tools" variant="secondary">
                {t('tools.detail.browseTools')}
              </NeonButton>
            </div>
          </GlassCard>
        </motion.section>

      </div>

      {/* ── Tool support modal ──────────────────────────────────────────────── */}
      {supportOpen && tool && (
        <ToolSupportModal toolName={tool.name} onClose={() => setSupportOpen(false)} />
      )}

      {/* ── Auth modal ──────────────────────────────────────────────────────── */}
      {authModalOpen && (
        <UserAuthModal
          onClose={() => setAuthModalOpen(false)}
          onSignInEmail={signInWithEmail}
          onSignUpEmail={signUpWithEmail}
          onForgotPassword={forgotPassword}
          onSignInOAuth={signInWithOAuth}
          message={authModalMessage}
        />
      )}

      {/* ── Free download modal ──────────────────────────────────────────────── */}
      {freeDownloadVersion && tool && (
        <FreeDownloadModal
          onClose={() => setFreeDownloadVersion(null)}
          toolName={tool.name}
          toolSlug={tool.slug ?? ''}
          toolVersionId={freeDownloadVersion.id}
          downloadUrl={freeDownloadVersion.downloadUrl}
        />
      )}

    </div>
  );
}