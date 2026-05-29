import { FreeDownloadModal } from '../components/shared/FreeDownloadModal';
import { useUserAuth } from '../hooks/useUserAuth';
import { useParams, Link } from 'react-router';
import { GlassCard } from '../components/shared/GlassCard';
import { NeonButton } from '../components/shared/NeonButton';
import { ToolSupportModal } from '../components/shared/ToolSupportModal';
import { UserAuthModal } from '../components/shared/UserAuthModal';
import { SeoHead } from '../components/shared/SeoHead';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { buildGumroadCheckoutUrl, openGumroadCheckout } from '../utils/gumroad';
import {
  ArrowLeft, Check, Download, Play, ChevronDown, ChevronUp,
  Monitor, Zap, Star, ExternalLink, Sparkles, ShoppingCart, Quote,
  ChevronLeft, ChevronRight, BookOpen, ArrowRight, Gift, Package,
  Heart, Rocket, LucideIcon, Tag, Wrench, AlertTriangle,
} from 'lucide-react';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
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
  featured?: boolean;  // If true, show in showcase section with screenshots
}

interface ToolVersion {
  id: string;
  versionType: string;
  versionTypeOriginal?: string;
  color?: string;
  pricingModel?: 'subscription' | 'lifetime';
  monthlyPrice?: string;
  yearlyPrice?: string;
  lifetimePrice?: string;
  lifetimeBuyUrl?: string;
  pricingDisplay?: string;
  downloadUrl: string;
  lemonSqueezyVariantId?: string;
  includedFeatureIds?: string[];
  featureLabel?: string;
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
  richFeatures?: RichFeature[];  // Tool-level feature pool
  // CTA customization
  freeCtaText?: string;
  freeCtaIcon?: string;
  paidCtaText?: string;
  paidCtaIcon?: string;
  showcasePaidCtaText?: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Icon map for CTA customization
const ICON_MAP: Record<string, LucideIcon> = {
  Download,
  ShoppingCart,
  Zap,
  Star,
  Sparkles,
  ArrowRight,
  ExternalLink,
  Play,
  Gift,
  Package,
  Heart,
  Rocket,
};

function getIconComponent(iconName?: string, defaultIcon: LucideIcon = Download): LucideIcon {
  if (!iconName) return defaultIcon;
  return ICON_MAP[iconName] || defaultIcon;
}

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
  mainPrice: string;
  period: string;
  subLabel: string;
  ctaPrice: string;
  /** All tool features with included flag for this version */
  allFeatures: { title: string; included: boolean }[];
}

function parsePricing(version: ToolVersion, toolRichFeatures: RichFeature[] = [], billingCycle: 'monthly' | 'yearly' | 'lifetime' = 'monthly'): ParsedPricing {
  const includedIds = new Set(version.includedFeatureIds ?? []);
  const allFeatures = toolRichFeatures
    .filter(f => f.title?.trim())
    .map(f => ({ title: f.title.trim(), included: includedIds.has(f.id) }));

  // Add $ prefix if value is a bare number (admin may omit currency symbol)
  const fmt = (s: string): string => {
    if (!s || s === 'Free') return s;
    return /^\d/.test(s.trim()) ? `$${s.trim()}` : s.trim();
  };

  // Extract raw price fields from direct version fields
  let model   = version.pricingModel ?? 'lifetime';
  let monthly = version.monthlyPrice  ?? '';
  let yearly  = version.yearlyPrice   ?? '';
  let lifetime = version.lifetimePrice ?? '';

  // ── Pre-compute subscription helpers (used by multiple branches) ──
  const toNum = (s: string) => parseFloat(s.replace(/[^0-9.]/g, '')) || 0;
  const hasMo = monthly.trim() !== '';
  const hasYr = yearly.trim()  !== '';

  // ── Free (detect by empty prices, not name) ──
  const isFreeVersion = !hasMo && !hasYr && !lifetime.trim();
  if (isFreeVersion) {
    return { mainPrice: 'Free', period: '', subLabel: 'forever free', ctaPrice: 'Free', allFeatures };
  }

  // ── Lifetime billing tab selected ──
  if (billingCycle === 'lifetime') {
    if (lifetime.trim()) {
      const price = fmt(lifetime) || '—';
      return { mainPrice: price, period: '', subLabel: 'one-time payment', ctaPrice: price, allFeatures };
    }
    // No lifetime price on this version — show yearly billing info (same as yearly tab)
    if (hasMo && hasYr) {
      const yrNum = toNum(yearly);
      const fmtYr = fmt(yearly);
      const perMonth = yrNum / 12;
      const perMonthStr = perMonth % 1 === 0 ? `$${perMonth}` : `$${perMonth.toFixed(2)}`;
      return { mainPrice: perMonthStr, period: '/ mo', subLabel: `billed ${fmtYr} / yr`, ctaPrice: fmtYr, allFeatures };
    }
    if (hasYr) {
      const yrNum = toNum(yearly);
      const fmtYr = fmt(yearly);
      const perMonth = yrNum / 12;
      const perMonthStr = perMonth % 1 === 0 ? `$${perMonth}` : `$${perMonth.toFixed(2)}`;
      return { mainPrice: perMonthStr, period: '/ mo', subLabel: `billed ${fmtYr} / yr`, ctaPrice: fmtYr, allFeatures };
    }
    if (hasMo) return { mainPrice: fmt(monthly), period: '/ mo', subLabel: 'billed monthly', ctaPrice: fmt(monthly), allFeatures };
  }

  // ── Lifetime-only model ──
  if (model === 'lifetime') {
    const price = fmt(lifetime) || '—';
    return {
      mainPrice: price,
      period: '',
      subLabel: 'one-time payment',
      ctaPrice: price,
      allFeatures,
    };
  }

  // ── Subscription ──
  // Normalise: strip leading "$" for math, re-add for display

  if (hasMo && hasYr) {
    const moNum = toNum(monthly);
    const yrNum = toNum(yearly);
    const fmtMo = fmt(monthly);
    const fmtYr = fmt(yearly);

    if (billingCycle === 'yearly') {
      // Show yearly price in big, mention it's billed annually
      return {
        mainPrice: fmtYr,
        period: '/ yr',
        subLabel: 'billed annually',
        ctaPrice: fmtYr,
        allFeatures,
      };
    }

    // monthly toggle - show monthly price in big
    return {
      mainPrice: fmtMo,
      period: '/ mo',
      subLabel: 'billed monthly',
      ctaPrice: `${fmtMo} / mo`,
      allFeatures,
    };
  }
  if (hasMo) {
    const fmtMo = fmt(monthly);
    const moNum = toNum(monthly);
    // If viewing yearly tab but only monthly exists, calculate yearly price for big display
    if (billingCycle === 'yearly') {
      const calculatedYearly = moNum * 12;
      const fmtYr = calculatedYearly % 1 === 0 
        ? `$${calculatedYearly}` 
        : `$${calculatedYearly.toFixed(2)}`;
      return { 
        mainPrice: fmtYr,
        period: '/ yr', 
        subLabel: `${fmtMo} / mo • billed monthly`, 
        ctaPrice: fmtYr, 
        allFeatures 
      };
    }
    return { mainPrice: fmtMo, period: '/ mo', subLabel: 'billed monthly', ctaPrice: `${fmtMo} / mo`, allFeatures };
  }
  if (hasYr) {
    const fmtYr = fmt(yearly);
    const yrNum = toNum(yearly);
    // If viewing monthly tab but only yearly exists, calculate monthly price for big display
    if (billingCycle === 'monthly') {
      const perMonth = yrNum / 12;
      const perMonthStr = perMonth % 1 === 0
        ? `$${perMonth}`
        : `$${perMonth.toFixed(2)}`;
      return { 
        mainPrice: perMonthStr, 
        period: '/ mo', 
        subLabel: `${fmtYr} / yr • billed annually`, 
        ctaPrice: perMonthStr, 
        allFeatures 
      };
    }
    return { mainPrice: fmtYr, period: '/ yr', subLabel: 'billed annually', ctaPrice: `${fmtYr} / yr`, allFeatures };
  }

  // Legacy fallback: server set pricingDisplay from old plain-text sentinel
  // but didn't set pricingModel / individual price fields.
  if (version.pricingDisplay && version.pricingDisplay !== 'Free') {
    const display = fmt(version.pricingDisplay);
    return { mainPrice: display, period: '', subLabel: 'one-time payment', ctaPrice: display, allFeatures };
  }

  return { mainPrice: '—', period: '', subLabel: '', ctaPrice: '', allFeatures };
}

// ── DemoPlayer ────────────────────────────────────────────────────────────────

function DemoPlayer({ url, toolId, toolName, toolSlug }: { url: string; toolId: string; toolName: string; toolSlug: string }) {
  const [playing, setPlaying] = useState(false);
  const { track } = useTracker();
  const { t } = useTranslation();
  const yt = parseYouTube(url);

  // Fetch thumbnail via oEmbed for both YouTube and Vimeo.
  // Direct img.youtube.com/vi/.../maxresdefault.jpg is unreliable — YouTube returns
  // a 200 OK placeholder image (not a 404) when a quality tier is missing, so onError
  // never fires and users see the blurred YouTube logo instead of the real thumbnail.
  // The oEmbed API always returns the correct, available thumbnail URL.
  const [resolvedThumbnail, setResolvedThumbnail] = useState<string | null>(null);
  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const oembedUrl = yt
      ? `https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + yt.videoId)}&format=json`
      : `https://vimeo.com/api/oembed.json?url=${encodeURIComponent(url)}&width=1280`;
    fetch(oembedUrl)
      .then(r => r.json())
      .then(d => { if (!cancelled && d?.thumbnail_url) setResolvedThumbnail(d.thumbnail_url); })
      .catch(() => { /* private/unavailable — keep gradient fallback */ });
    return () => { cancelled = true; };
  }, [url]);

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
            {resolvedThumbnail ? (
              <img
                src={resolvedThumbnail}
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

// ── ComparisonModal ───────────────────────────────────────────────────────────
// Slide-up modal showing full feature matrix across all tiers. Respects the
// currently-selected billing cycle so prices/CTAs match what's on the page.

function ComparisonModal({
  open,
  onClose,
  tool,
  billingCycle,
  user,
  onFreeDownload,
  onBuyClick,
  onSignInRequired,
}: {
  open: boolean;
  onClose: () => void;
  tool: Tool;
  billingCycle: 'monthly' | 'yearly' | 'lifetime';
  user: ReturnType<typeof useUserAuth>['user'];
  onFreeDownload: (v: ToolVersion) => void;
  onBuyClick?: (v: ToolVersion) => void;
  onSignInRequired: (msg?: string) => void;
}) {
  const { t } = useTranslation();

  // ESC to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  const versions = tool.versions ?? [];
  const features = (tool.richFeatures ?? []).filter(f => f.title?.trim());

  // Each paid tier inherits only from the free tier (index 0), not from other
  // paid tiers — paid tiers can have different feature sets from each other.
  const freeIds = new Set<string>(
    versions[0] && !versions[0].monthlyPrice?.trim() && !versions[0].yearlyPrice?.trim() && !versions[0].lifetimePrice?.trim()
      ? (versions[0].includedFeatureIds ?? [])
      : []
  );
  const cumulativeIds: Set<string>[] = versions.map((v, i) => {
    const own = new Set<string>(v.includedFeatureIds ?? []);
    const isFreeV = !v.monthlyPrice?.trim() && !v.yearlyPrice?.trim() && !v.lifetimePrice?.trim();
    // Free tier: just its own. Paid tiers: own + free tier features.
    return i === 0 || isFreeV ? own : new Set([...freeIds, ...own]);
  });

  const isVersionFree = (v: ToolVersion) =>
    !v.monthlyPrice?.trim() && !v.yearlyPrice?.trim() && !v.lifetimePrice?.trim();

  const handleCta = (v: ToolVersion) => {
    onClose();
    if (isVersionFree(v)) {
      if (!user) { onSignInRequired('Sign in to download free tools.'); return; }
      onFreeDownload(v);
    } else {
      onBuyClick?.(v);
    }
  };

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="backdrop"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          key="sheet"
          initial={{ y: '100%', opacity: 0.5 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: '100%', opacity: 0 }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full sm:max-w-5xl bg-[#0d0d0f] border-t sm:border border-white/12 sm:rounded-2xl max-h-[90vh] flex flex-col shadow-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-white/8 shrink-0">
            <div>
              <h3 className="text-base font-bold text-white">Compare all plans</h3>
              <p className="text-xs text-white/40 mt-0.5">{tool.name}</p>
            </div>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-white/8 text-white/40 hover:text-white/70 transition-colors"
              aria-label="Close"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-[#0d0d0f] z-10">
                <tr className="border-b border-white/10">
                  <th className="text-left text-xs font-medium text-white/40 px-5 sm:px-6 py-3 min-w-[180px]">
                    Features
                  </th>
                  {versions.map(v => (
                    <th key={v.id} className="text-center px-4 py-3 min-w-[120px]">
                      <div className="flex items-center justify-center gap-1.5">
                        <span
                          className="inline-block w-1.5 h-1.5 rounded-full"
                          style={{ backgroundColor: v.color || '#a855f7' }}
                        />
                        <span className="text-xs font-semibold text-white uppercase tracking-wide">
                          {v.versionType}
                        </span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {features.map((feat, i) => (
                  <tr
                    key={feat.id}
                    className={`border-b border-white/5 hover:bg-white/3 transition-colors ${i % 2 === 1 ? 'bg-white/[0.015]' : ''}`}
                  >
                    <td className="text-left text-white/70 px-5 sm:px-6 py-3">{feat.title}</td>
                    {versions.map((v, vIdx) => {
                      const included = cumulativeIds[vIdx].has(feat.id);
                      const ownIncluded = (v.includedFeatureIds ?? []).includes(feat.id);
                      return (
                        <td key={v.id} className="text-center px-4 py-3">
                          {included ? (
                            <Check
                              className="w-4 h-4 mx-auto"
                              style={{ color: ownIncluded ? (v.color || '#a855f7') : 'rgba(255,255,255,0.25)' }}
                            />
                          ) : (
                            <svg className="w-3.5 h-3.5 mx-auto text-white/20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                            </svg>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* CTAs */}
          <div className="border-t border-white/8 p-4 sm:p-5 shrink-0">
            <div
              className="grid gap-2"
              style={{ gridTemplateColumns: `minmax(180px, 1fr) repeat(${versions.length}, minmax(120px, 1fr))` }}
            >
              <div className="hidden sm:block" />
              {versions.map(v => {
                const { mainPrice, period } = parsePricing(v, tool.richFeatures ?? [], billingCycle);
                const free = isVersionFree(v);
                const isLifetimeActive = !free && billingCycle === 'lifetime' && !!v.lifetimePrice?.trim();
                const FreeCtaIcon = getIconComponent(tool.freeCtaIcon, Download);
                const PaidCtaIcon = getIconComponent(tool.paidCtaIcon, ShoppingCart);
                const freeCtaText = tool.freeCtaText || t('tools.detail.downloadFree');
                const paidCtaText = tool.paidCtaText || t('tools.detail.buyNow');

                const buildUrl = () => buildGumroadCheckoutUrl({
                  baseUrl: (billingCycle === 'lifetime' && v.lifetimeBuyUrl?.trim()) ? v.lifetimeBuyUrl : v.downloadUrl,
                  email: user?.email,
                  userId: user?.id,
                  toolVersionId: v.id,
                });

                return (
                  <div key={v.id} className="flex flex-col items-center gap-2">
                    <div className="flex items-baseline gap-1">
                      <span className="text-lg font-bold text-white leading-tight">{mainPrice}</span>
                      {period && <span className="text-[10px] text-white/40">{period}</span>}
                    </div>
                    {free ? (
                      <button
                        type="button"
                        onClick={() => handleCta(v)}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all
                          bg-white/8 hover:bg-white/12 border border-emerald-500/30 hover:border-emerald-500/50 text-emerald-300"
                      >
                        <FreeCtaIcon className="w-3 h-3" />
                        {freeCtaText}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          if (!user) { onClose(); onSignInRequired('Sign in to purchase and access your license key.'); return; }
                          onBuyClick?.(v);
                          openGumroadCheckout(buildUrl());
                        }}
                        className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all active:scale-[0.98]
                          bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-fuchsia-500 text-white shadow-lg hover:shadow-purple-500/25"
                        style={isLifetimeActive ? { background: 'linear-gradient(to right, #d97706, #b45309)' } : undefined}
                      >
                        {isLifetimeActive
                          ? <Zap className="w-3 h-3 fill-current" />
                          : <PaidCtaIcon className="w-3 h-3" />}
                        {paidCtaText}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
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
  isBestValue,
  isMostPopular,
  tool,
  onCompare,
}: {
  version: ToolVersion;
  index: number;
  user: ReturnType<typeof useUserAuth>['user'];
  userPurchasedProductNames: string[];
  onSignInRequired: (msg?: string) => void;
  onFreeDownload: (v: ToolVersion) => void;
  onBuyClick?: (v: ToolVersion) => void;
  sessionId?: string;
  billingCycle?: 'monthly' | 'yearly' | 'lifetime';
  isBestValue?: boolean;
  isMostPopular?: boolean;
  tool?: Tool;
  onCompare?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const { mainPrice, period, subLabel, allFeatures } = parsePricing(version, tool?.richFeatures ?? [], billingCycle ?? 'monthly');

  const richFeatures = tool?.richFeatures ?? [];
  const thisIds = new Set<string>(version.includedFeatureIds ?? []);
  const displayFeatures = richFeatures
    .filter(rf => thisIds.has(rf.id) && rf.title?.trim())
    .map(rf => rf.title.trim());

  // Detect free version by prices, not name
  const { monthlyPrice, yearlyPrice, lifetimePrice } = version;
  const isFree = !monthlyPrice?.trim() && !yearlyPrice?.trim() && !lifetimePrice?.trim();

  // Get custom CTA values
  const freeCtaText = tool?.freeCtaText || t('tools.detail.downloadFree');
  const paidCtaText = tool?.paidCtaText || t('tools.detail.buyNow');
  const FreeCtaIcon = getIconComponent(tool?.freeCtaIcon, Download);
  const PaidCtaIcon = getIconComponent(tool?.paidCtaIcon, ShoppingCart);
  
  // Get the version's custom color (default to purple if not set)
  const versionColor = version.color || '#a855f7';

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
  } else if (subLabel === 'subscription only') {
    translatedSubLabel = t('tools.detail.subscriptionOnly', { defaultValue: 'subscription only' });
  } else if (subLabel.includes('billed annually')) {
    // Handle complex format like "$90 / yr • billed annually"
    translatedSubLabel = subLabel.replace('billed annually', t('tools.detail.billedAnnually'));
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
  
  // Use boolean checks instead of string matching to avoid translation issues
  // True when this card is actively showing its lifetime price (not a subscription fallback)
  const isLifetimeActive = !isFree && billingCycle === 'lifetime' && !!version.lifetimePrice?.trim();

  // Extract RGB values from hex color for dynamic Tailwind-like classes
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 168, g: 85, b: 247 }; // fallback to purple
  };
  const rgb = hexToRgb(versionColor);
  const rgbString = `${rgb.r}, ${rgb.g}, ${rgb.b}`;


  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ delay: index * 0.08 }}
      className={`h-full ${isFree ? 'cursor-pointer' : ''}`}
      onClick={() => {
        // Free card is fully clickable; paid purchases go through the overlay
        // buy button below (clicking the card body does nothing for paid).
        if (isFree) {
          if (!user) {
            onSignInRequired('Sign in to download free tools.');
            return;
          }
          onFreeDownload(version);
        }
      }}
      style={isLifetimeActive 
        ? { filter: 'drop-shadow(0 0 24px rgba(245,158,11,0.14))' } 
        : !isFree 
        ? { filter: `drop-shadow(0 0 16px rgba(${rgbString},0.12))` }
        : undefined
      }
    >
      <GlassCard
        className="relative p-7 h-full flex flex-col"
        style={!isFree && !isLifetimeActive ? {
          borderColor: `rgba(${rgbString}, 0.3)`,
          boxShadow: `0 0 0 1px rgba(${rgbString}, 0.2) inset`
        } : undefined}
        neonBorder={false}
        amberBorder={isLifetimeActive && !isFree}
        darkBg={isLifetimeActive && !isFree}
      >
        {/* Colored hairline accent along the top edge for paid versions */}
        {!isFree && (
          <div 
            className="absolute top-0 left-6 right-6 h-px"
            style={{
              background: isLifetimeActive
                ? 'linear-gradient(90deg, transparent, rgba(251,191,36,0.6), transparent)'
                : `linear-gradient(90deg, transparent, rgba(${rgbString},0.5), transparent)`
            }}
          />
        )}

        {/* Badge — changes per billing cycle × tier */}
        {!isFree && (() => {
          // ── Lifetime ────────────────────────────────────────────────
          if (isLifetimeActive) return (
            <div className="absolute top-3 right-3 rtl:right-auto rtl:left-3">
              <span className="px-3 py-1 rounded-full text-[11px] font-bold tracking-wide
                bg-gradient-to-r from-amber-500/20 to-yellow-500/10
                border border-amber-500/30 text-amber-300">
                ⚡ {t('tools.detail.lifetime')}
              </span>
            </div>
          );
          // ── One-time model shown on any non-lifetime tab ─────────────
          if (subLabel === 'one-time payment') return (
            <div className="absolute top-3 right-3 rtl:right-auto rtl:left-3">
              <span className="px-3 py-1 rounded-full text-[11px] font-bold tracking-wide
                bg-gradient-to-r from-amber-500/20 to-yellow-500/10
                border border-amber-500/30 text-amber-300">
                ⚡ {t('tools.detail.lifetime')}
              </span>
            </div>
          );
          // ── Most Popular (data-driven badge) ────────────────────────
          if (isMostPopular) {
            return (
              <div className="absolute top-3 right-3 rtl:right-auto rtl:left-3">
                <span 
                  className="px-3 py-1 rounded-full text-[11px] font-bold tracking-wide text-white shadow-md"
                  style={{
                    background: `linear-gradient(135deg, rgba(${rgbString}, 0.9), rgba(${rgbString}, 0.6))`,
                    boxShadow: `0 4px 12px rgba(${rgbString}, 0.25)`
                  }}
                >
                  ⭐ {t('tools.detail.mostPopular')}
                </span>
              </div>
            );
          }
          // No other badges
          return null;
        })()}

        {/* Version label */}
        <div className="flex items-center gap-2 mb-5">
          <span 
            className="w-2 h-2 rounded-full" 
            style={{ 
              backgroundColor: isFree ? '#10b981' : isLifetimeActive ? '#f59e0b' : versionColor 
            }}
          />
          <span 
            className="text-sm font-bold uppercase"
            style={{ 
              color: isFree ? '#34d399' : isLifetimeActive ? '#fbbf24' : versionColor 
            }}
          >
            {t(`tools.versionTypes.${version.versionTypeOriginal || version.versionType}`, { 
              defaultValue: version.versionType 
            })}
          </span>
        </div>

        {/* Price */}
        <div className="mb-6">
          {isFree ? (
            <>
              <div className="text-4xl font-black text-emerald-400">{t('tools.free')}</div>
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
                <p className={`text-xs mt-1 ${subLabel === 'subscription only' ? 'text-amber-500/60' : 'text-white/30'}`}>
                  {subLabel === 'subscription only' && <span className="mr-1">↩</span>}
                  {translatedSubLabel}
                </p>
              )}
            </>
          )}
        </div>

        {/* Optional feature label (e.g. "All free features, plus:") */}
        {version.featureLabel?.trim() && (
          <p className="text-xs text-white/40 mb-3 flex items-center gap-1.5">
            <span className="inline-block w-3 h-px bg-white/20" />
            <span>{version.featureLabel.trim()}</span>
          </p>
        )}

        {/* Feature list — exactly what admin checked in includedFeatureIds */}
        <div className="flex-grow mb-5">
          {displayFeatures.length > 0 && (
            <ul className="space-y-2">
              {displayFeatures.map((title, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <Check
                    className="w-3.5 h-3.5 mt-0.5 flex-shrink-0"
                    style={{ color: isFree ? '#34d399' : isLifetimeActive ? '#fbbf24' : versionColor }}
                  />
                  <span className="text-sm leading-snug text-white/70">{title}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Compare all plans link */}
        {onCompare && allFeatures.length > 0 && (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onCompare(); }}
            className="mb-4 flex items-center justify-center gap-1.5 text-xs text-white/40 hover:text-white/70 transition-colors mx-auto"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
            See full Comparison
          </button>
        )}

        {/* CTA */}
        <div className="mt-auto">
          {isFree ? (
            /* ── Free: email-gate for guests, direct for signed-in users ── */
            <div>
              <button
                onClick={(e) => {
                  e.stopPropagation(); // Prevent card click when clicking button
                  onFreeDownload(version);
                }}
                className="w-full inline-flex items-center justify-center gap-2 rtl:flex-row-reverse
                  px-5 py-3 rounded-xl text-sm font-semibold transition-all
                  bg-white/8 hover:bg-white/12 border border-emerald-500/30
                  hover:border-emerald-500/50 text-emerald-300"
              >
                <FreeCtaIcon className="w-3.5 h-3.5" />
                {freeCtaText}
              </button>
              {!user && (
                <p className="text-center text-white/35 text-xs mt-2 leading-snug">
                  {t('tools.detail.freeGuestHint')}
                </p>
              )}
            </div>
          ) : (
            /* ── Paid: Gumroad hosted checkout CTA ── */
            <div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (!user) { onSignInRequired('Sign in to purchase and access your license key.'); return; }
                  onBuyClick?.(version);
                  const baseUrl = (billingCycle === 'lifetime' && version.lifetimeBuyUrl?.trim()) ? version.lifetimeBuyUrl : version.downloadUrl;
                  openGumroadCheckout(buildGumroadCheckoutUrl({ baseUrl, email: user?.email, userId: user?.id, toolVersionId: version.id, sessionId }));
                }}
                className="w-full inline-flex items-center justify-center gap-2 rtl:flex-row-reverse
                  px-5 py-3 rounded-xl text-sm font-semibold transition-all active:scale-[0.98]
                  bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-fuchsia-500
                  text-white shadow-lg hover:shadow-purple-500/30"
              >
                {isLifetimeActive
                  ? <Zap className="w-3.5 h-3.5 fill-current" />
                  : <PaidCtaIcon className="w-3.5 h-3.5" />}
                {paidCtaText}
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
  tool,
  versions,
  user,
  sessionId,
  onFreeDownload,
  onSignInRequired,
  onBuyClick,
}: {
  tool: Tool;
  versions: ToolVersion[];
  user: ReturnType<typeof useUserAuth>['user'];
  sessionId?: string;
  onFreeDownload: (v: ToolVersion) => void;
  onSignInRequired: (msg?: string) => void;
  onBuyClick?: (v: ToolVersion) => void;
}) {
  const { t } = useTranslation();
  
  // Get custom CTA values from tool
  const freeCtaText = tool.freeCtaText || t('tools.detail.downloadFree');
  const showcasePaidCtaText = tool.showcasePaidCtaText || tool.paidCtaText || t('tools.detail.viewPricing');
  const FreeCtaIcon = getIconComponent(tool.freeCtaIcon, Download);
  const PaidCtaIcon = getIconComponent(tool.paidCtaIcon, ShoppingCart);
  
  // Featured features come from the tool-level pool, filtered to featured=true
  const displayRichFeatures = (tool.richFeatures ?? []).filter(f => f.featured && f.title?.trim());

  // Hide section if no featured rich features exist
  if (displayRichFeatures.length === 0) return null;

  const freeVersion = versions.find(v =>
    !v.monthlyPrice?.trim() && !v.yearlyPrice?.trim() && !v.lifetimePrice?.trim()
  );
  const paidVersion = versions.find(v =>
    v.monthlyPrice?.trim() || v.yearlyPrice?.trim() || v.lifetimePrice?.trim()
  );

  // For each feature, find the lowest-tier version that includes it.
  // If the free tier includes it → show free CTA. Otherwise → paid CTA.
  const featureToVersionMap = new Map<string, ToolVersion>();
  for (const f of displayRichFeatures) {
    const lowestVersion = versions.find(v => (v.includedFeatureIds ?? []).includes(f.id));
    featureToVersionMap.set(f.id, lowestVersion ?? paidVersion ?? freeVersion ?? versions[0]);
  }

  const primaryVersion = paidVersion ?? freeVersion ?? versions[0];

  const isFree = !primaryVersion?.monthlyPrice?.trim() &&
                 !primaryVersion?.yearlyPrice?.trim() &&
                 !primaryVersion?.lifetimePrice?.trim();

  // Helper to convert hex to RGB
  const hexToRgb = (hex: string) => {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : { r: 168, g: 85, b: 247 };
  };
  const versionColor = primaryVersion?.color || '#a855f7';
  const rgb = hexToRgb(versionColor);
  const rgbString = `${rgb.r}, ${rgb.g}, ${rgb.b}`;

  const buildCheckoutUrl = () => buildGumroadCheckoutUrl({
    baseUrl: primaryVersion?.downloadUrl ?? '',
    email: user?.email,
    userId: user?.id,
    toolVersionId: primaryVersion?.id,
    sessionId,
  });

  const handleCTA = () => {
    if (!primaryVersion) return;
    if (isFree) {
      onFreeDownload(primaryVersion);
    } else {
      if (!user) { onSignInRequired('Sign in to purchase and access your license key.'); return; }
      onBuyClick?.(primaryVersion);
      openGumroadCheckout(buildCheckoutUrl());
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
        {displayRichFeatures.map((feature, index) => {
          const isReversed = index % 2 === 1;
          const hasScreenshots = (feature.screenshots ?? []).filter(Boolean).length > 0;
          
          // Get the source version for this feature
          const sourceVersion = featureToVersionMap.get(feature.id ?? feature.title) ?? primaryVersion;
          const isFeatureFree = !sourceVersion?.monthlyPrice?.trim() && 
                                !sourceVersion?.yearlyPrice?.trim() && 
                                !sourceVersion?.lifetimePrice?.trim();
          
          // Determine CTA action per feature 
          const handleFeatureCTA = () => {
            if (isFeatureFree) {
              onFreeDownload(sourceVersion);
            } else {
              // Scroll to pricing section for paid features
              const pricingSection = document.getElementById('pricing-section');
              if (pricingSection) {
                pricingSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }
            }
          };

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

                {/* CTA button - dynamic per feature */}
                <div>
                  <button
                    onClick={handleFeatureCTA}
                    className="inline-flex items-center gap-2.5 rtl:flex-row-reverse px-6 py-3 rounded-xl
                      text-sm font-semibold transition-all duration-200 active:scale-[0.97]"
                    style={isFeatureFree ? {
                      background: 'rgba(16, 185, 129, 0.15)',
                      borderWidth: '1px',
                      borderColor: 'rgba(16, 185, 129, 0.3)',
                      color: '#6ee7b7'
                    } : {
                      background: `linear-gradient(135deg, rgba(${rgbString}, 0.85), rgba(${rgbString}, 0.65))`,
                      color: '#fff',
                      boxShadow: `0 10px 25px rgba(${rgbString}, 0.4)`
                    }}
                  >
                    {isFeatureFree
                      ? <FreeCtaIcon className="w-4 h-4" />
                      : <PaidCtaIcon className="w-4 h-4" />}
                    {isFeatureFree
                      ? freeCtaText
                      : showcasePaidCtaText}
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

// ── VersionHistory ────────────────────────────────────────────────────────────

const CHANGE_TYPE_CFG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  new:      { label: 'New',      color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', icon: <Sparkles className="w-2.5 h-2.5" /> },
  fix:      { label: 'Fix',      color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/25',    icon: <Wrench className="w-2.5 h-2.5" /> },
  improved: { label: 'Improved', color: 'text-purple-400',  bg: 'bg-purple-500/10',  border: 'border-purple-500/25',  icon: <Zap className="w-2.5 h-2.5" /> },
  breaking: { label: 'Breaking', color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/25',     icon: <AlertTriangle className="w-2.5 h-2.5" /> },
};

const RELEASE_TYPE_CFG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  major: { label: 'Major', color: 'text-red-300',   bg: 'bg-red-500/10',   border: 'border-red-500/25' },
  minor: { label: 'Minor', color: 'text-amber-300', bg: 'bg-amber-500/10', border: 'border-amber-500/25' },
  patch: { label: 'Patch', color: 'text-blue-300',  bg: 'bg-blue-500/10',  border: 'border-blue-500/25' },
};

function VersionHistory({ changelog }: { changelog: any[] }) {
  const INITIAL_SHOW = 3;
  const [showAll, setShowAll] = useState(false);
  const [expandedVersions, setExpandedVersions] = useState<Set<string>>(
    new Set(changelog.length > 0 ? [changelog[0]?.version] : [])
  );

  const visible = showAll ? changelog : changelog.slice(0, INITIAL_SHOW);

  const toggle = (v: string) => {
    setExpandedVersions(prev => {
      const next = new Set(prev);
      if (next.has(v)) next.delete(v); else next.add(v);
      return next;
    });
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="mb-20"
    >
      <SectionLabel>Version History</SectionLabel>

      <div className="space-y-2">
        {visible.map((entry: any, idx: number) => {
          const isLatest = idx === 0;
          const isExpanded = expandedVersions.has(entry.version);
          const relCfg = RELEASE_TYPE_CFG[entry.type] ?? RELEASE_TYPE_CFG.patch;

          return (
            <motion.div
              key={entry.version}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: idx * 0.05 }}
              className={`rounded-2xl border overflow-hidden transition-all
                ${isLatest ? 'border-purple-500/25 bg-purple-500/4' : 'border-white/8 bg-white/2'}`}
            >
              {/* Header row */}
              <button
                onClick={() => toggle(entry.version)}
                className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/2 transition-colors"
              >
                {/* Version pill */}
                <span className={`font-mono text-xs font-bold px-2.5 py-1 rounded-full border shrink-0
                  ${isLatest ? 'bg-purple-500/15 border-purple-400/30 text-purple-300' : 'bg-white/5 border-white/12 text-white/55'}`}>
                  v{entry.version}
                  {isLatest && (
                    <span className="ml-1.5 text-[9px] tracking-widest uppercase text-purple-400/70">latest</span>
                  )}
                </span>

                {/* Release type badge */}
                <span className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest border shrink-0
                  ${relCfg.bg} ${relCfg.border} ${relCfg.color}`}>
                  {relCfg.label}
                </span>

                {/* Title + date */}
                <div className="flex-1 min-w-0 text-left">
                  {entry.title && (
                    <span className="block text-white/75 text-sm font-medium truncate">{entry.title}</span>
                  )}
                  <span className="text-white/30 text-xs">
                    {new Date(entry.releaseDate).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    {entry.changes?.length > 0 && ` · ${entry.changes.length} change${entry.changes.length !== 1 ? 's' : ''}`}
                  </span>
                </div>

                {/* Expand chevron */}
                <span className="shrink-0 text-white/25">
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </span>
              </button>

              {/* Changes */}
              <AnimatePresence initial={false}>
                {isExpanded && entry.changes?.length > 0 && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 pt-1 border-t border-white/6 space-y-2">
                      {entry.changes.map((change: any, ci: number) => {
                        const cfg = CHANGE_TYPE_CFG[change.type] ?? CHANGE_TYPE_CFG.new;
                        return (
                          <div key={ci} className="flex items-start gap-2.5">
                            <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 mt-0.5 border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
                              {cfg.icon}
                              {cfg.label}
                            </span>
                            <span className="text-white/55 text-sm leading-relaxed">{change.description}</span>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      {/* Show more / less */}
      {changelog.length > INITIAL_SHOW && (
        <div className="text-center mt-4">
          <button
            onClick={() => setShowAll(v => !v)}
            className="inline-flex items-center gap-1.5 text-sm text-white/35 hover:text-white/65 transition-colors"
          >
            {showAll ? (
              <><ChevronUp className="w-4 h-4" /> Show fewer releases</>
            ) : (
              <><ChevronDown className="w-4 h-4" /> Show {changelog.length - INITIAL_SHOW} older release{changelog.length - INITIAL_SHOW !== 1 ? 's' : ''}</>
            )}
          </button>
        </div>
      )}
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
  // Billing cycle toggle — monthly/yearly for subscriptions; lifetime when any version has lifetimePrice
  const [billingCycle, setBillingCycle] = useState<'monthly' | 'yearly' | 'lifetime'>('yearly');
  const [compareOpen, setCompareOpen] = useState(false);
  // CMS category translations for tool status badges { "New": "Nouveau", ... }
  const [cmsStatusTrans, setCmsStatusTrans] = useState<Record<string, string>>({});
  // Whether this tool has an uploaded user guide
  const [guideExists, setGuideExists] = useState(false);
  // Purchase counts per version (for "Most Popular" badge)
  const [versionPurchaseCounts, setVersionPurchaseCounts] = useState<Record<string, number>>({});
  // Version changelog
  const [changelog, setChangelog] = useState<any[]>([]);
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

          // Check if this tool has an uploaded user guide (fire-and-forget, non-blocking)
          const guideSlug = found.slug ?? slug;
          if (guideSlug) {
            fetch(`${API_BASE}/tools/${encodeURIComponent(guideSlug)}/guide-exists`, {
              headers: { Authorization: `Bearer ${publicAnonKey}` },
            })
              .then(r => r.json())
              .then(d => setGuideExists(!!d.exists))
              .catch(() => setGuideExists(false));

            // Fetch changelog (fire-and-forget)
            fetch(`${API_BASE}/tools/${encodeURIComponent(guideSlug)}/changelog`, {
              headers: { Authorization: `Bearer ${publicAnonKey}` },
            })
              .then(r => r.json())
              .then(d => { if (d.success) setChangelog(d.data || []); })
              .catch(() => setChangelog([]));
          }

          // Fetch version purchase counts for "Most Popular" badge (fire-and-forget)
          fetch(`${API_BASE}/tools/${encodeURIComponent(found.id)}/version-stats`, {
            headers: { Authorization: `Bearer ${publicAnonKey}` },
          })
            .then(r => r.json())
            .then(d => {
              if (d.success && d.data) {
                setVersionPurchaseCounts(d.data);
              }
            })
            .catch(() => setVersionPurchaseCounts({}));
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
  const paidVersion = tool.versions?.find(v => 
    v.monthlyPrice?.trim() || v.yearlyPrice?.trim() || v.lifetimePrice?.trim()
  );
  const freeVersion = tool.versions?.find(v => 
    !v.monthlyPrice?.trim() && !v.yearlyPrice?.trim() && !v.lifetimePrice?.trim()
  );
  const primaryVersion = paidVersion ?? freeVersion ?? tool.versions?.[0];
  
  // Get custom CTA values for hero section
  const heroFreeCtaText = tool.freeCtaText || t('tools.detail.tryFree');
  const heroPaidCtaText = tool.paidCtaText || t('tools.detail.buyNow');
  const HeroFreeCtaIcon = getIconComponent(tool.freeCtaIcon, Download);
  const HeroPaidCtaIcon = getIconComponent(tool.paidCtaIcon, Sparkles);

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
                  <HeroFreeCtaIcon className="w-3.5 h-3.5" />
                  {heroFreeCtaText}
                </button>
              )}
              {paidVersion && (
                <NeonButton
                  onClick={() => document.getElementById('pricing-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                  variant="primary"
                >
                  <HeroPaidCtaIcon className="w-3.5 h-3.5 mr-2 rtl:mr-0 rtl:ml-2" />
                  {heroPaidCtaText}
                </NeonButton>
              )}
              {tool.demoUrl && (
                <button
                  onClick={() => {
                    const demoSection = document.getElementById('demo-section');
                    demoSection?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    demoSection?.querySelector<HTMLButtonElement>('button[aria-label="Play demo"]')?.click();
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
              {guideExists && tool.slug && (
                <Link
                  to={`/tools/${tool.slug}/guide`}
                  className="inline-flex items-center gap-2 rtl:flex-row-reverse px-4 py-2 rounded-xl
                    text-sm font-medium
                    text-purple-300/80 hover:text-purple-200
                    border border-purple-500/20 hover:border-purple-400/40
                    bg-purple-500/8 hover:bg-purple-500/14 transition-all"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  User Guide
                </Link>
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
            id="pricing-section"
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-20"
          >
            <SectionLabel>{t('tools.detail.chooseYourVersion')}</SectionLabel>

            {/* ── Billing cycle toggle ── */}
            {(() => {
              // Show toggle if ANY version has monthly OR yearly price (not necessarily both on same version)
              const hasMonthlyOption = tool.versions?.some(v => v.monthlyPrice?.trim());
              const hasYearlyOption = tool.versions?.some(v => v.yearlyPrice?.trim());
              const hasSubscriptionOptions = hasMonthlyOption || hasYearlyOption;
              const hasLifetimeOption = tool.versions?.some(v => v.lifetimePrice?.trim());
              if (!hasSubscriptionOptions) return null;

              // ── Slider position helper ──
              // LTR order: monthly(0) yearly(1) [lifetime(2)]
              // RTL order: [lifetime(0)] yearly(0/1) monthly(1/2)
              const btnCount = hasLifetimeOption ? 3 : 2;
              const ltrIdx = hasLifetimeOption
                ? ({ monthly: 0, yearly: 1, lifetime: 2 } as Record<string, number>)[billingCycle] ?? 1
                : ({ monthly: 0, yearly: 1, lifetime: 1 } as Record<string, number>)[billingCycle] ?? 1;
              const idx = isRTL ? (btnCount - 1 - ltrIdx) : ltrIdx;
              const pct = 100 / btnCount;
              const sliderLeft  = idx === 0 ? 4 : `calc(${pct * idx}% + 2px)`;
              const sliderRight = idx === btnCount - 1 ? 4 : `calc(${pct * (btnCount - 1 - idx)}% + 2px)`;
              const sliderBg = billingCycle === 'yearly'
                ? 'linear-gradient(135deg,rgba(16,185,129,.18),rgba(20,184,166,.10))'
                : billingCycle === 'lifetime'
                ? 'linear-gradient(135deg,rgba(245,158,11,.15),rgba(251,191,36,.08))'
                : 'rgba(255,255,255,.09)';
              const sliderBorder = billingCycle === 'yearly'
                ? 'rgba(16,185,129,.28)'
                : billingCycle === 'lifetime'
                ? 'rgba(245,158,11,.30)'
                : 'rgba(255,255,255,.13)';

              return (
                <div className="flex justify-center mb-10">
                  <div className="flex flex-col items-center gap-3">
                    {/* Toggle pill */}
                    <div className="relative flex p-1 rounded-xl bg-white/5 border border-white/10">
                      {/* Sliding indicator */}
                      <div
                        style={{
                          position: 'absolute',
                          top: 4,
                          bottom: 4,
                          left: sliderLeft,
                          right: sliderRight,
                          borderRadius: 10,
                          border: '1px solid',
                          background: sliderBg,
                          borderColor: sliderBorder,
                          transition: [
                            'left 0.38s cubic-bezier(0.34,1.56,0.64,1)',
                            'right 0.38s cubic-bezier(0.34,1.56,0.64,1)',
                            'background 0.25s ease',
                            'border-color 0.25s ease',
                          ].join(', '),
                        }}
                      />

                      {/* Buttons — RTL flex direction naturally flips visual order; no DOM reversal needed */}
                      <>
                        <button
                          onClick={() => setBillingCycle('monthly')}
                          className={`relative z-10 w-24 py-2.5 text-sm font-semibold rounded-[10px] transition-colors duration-200 ${
                            billingCycle === 'monthly' ? 'text-white' : 'text-white/35 hover:text-white/65'
                          }`}
                        >
                          {t('tools.detail.monthly')}
                        </button>
                        <button
                          onClick={() => setBillingCycle('yearly')}
                          className={`relative z-10 w-24 py-2.5 text-sm font-semibold rounded-[10px] transition-colors duration-200 ${
                            billingCycle === 'yearly' ? 'text-emerald-300' : 'text-white/35 hover:text-white/65'
                          }`}
                        >
                          {t('tools.detail.yearly')}
                        </button>
                        {hasLifetimeOption && (
                          <button
                            onClick={() => setBillingCycle('lifetime')}
                            className={`relative z-10 w-24 py-2.5 text-sm font-semibold rounded-[10px] transition-colors duration-200 flex items-center justify-center gap-1 ${
                              billingCycle === 'lifetime' ? 'text-amber-300' : 'text-white/35 hover:text-white/65'
                            }`}
                          >
                            ⚡ {t('tools.detail.lifetime')}
                          </button>
                        )}
                      </>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className={`grid gap-5 ${
              tool.versions.length === 1 
                ? 'grid-cols-1 max-w-sm mx-auto' 
                : tool.versions.length === 2 
                  ? 'grid-cols-1 sm:grid-cols-2 max-w-3xl mx-auto' 
                  : tool.versions.length === 4
                    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'
                    : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
            }`}>
              {(() => {
                // Calculate which version has the best yearly value
                let bestValueVersionId: string | null = null;
                if (billingCycle === 'yearly' && tool.versions) {
                  const toNum = (s: string) => parseFloat(s.replace(/[^0-9.]/g, '')) || 0;
                  const yearlyPrices = tool.versions
                    .filter(v => {
                      const isFree = !v.monthlyPrice?.trim() && !v.yearlyPrice?.trim() && !v.lifetimePrice?.trim();
                      return !isFree; // Exclude free versions
                    })
                    .map(v => {
                      let yearlyPrice = 0;
                      if (v.yearlyPrice?.trim()) {
                        yearlyPrice = toNum(v.yearlyPrice);
                      } else if (v.monthlyPrice?.trim()) {
                        yearlyPrice = toNum(v.monthlyPrice) * 12;
                      }
                      return { id: v.id, yearlyPrice };
                    })
                    .filter(item => item.yearlyPrice > 0);
                  
                  if (yearlyPrices.length > 0) {
                    const best = yearlyPrices.reduce((min, curr) => 
                      curr.yearlyPrice < min.yearlyPrice ? curr : min
                    );
                    bestValueVersionId = best.id;
                  }
                }

                // Calculate most popular version based on purchase counts
                let mostPopularVersionId: string | null = null;
                if (tool.versions && Object.keys(versionPurchaseCounts).length > 0) {
                  const paidVersions = tool.versions.filter(v => {
                    const isFree = !v.monthlyPrice?.trim() && !v.yearlyPrice?.trim() && !v.lifetimePrice?.trim();
                    return !isFree && versionPurchaseCounts[v.id] > 0;
                  });
                  
                  if (paidVersions.length > 0) {
                    const mostPopular = paidVersions.reduce((max, curr) => {
                      const maxCount = versionPurchaseCounts[max.id] || 0;
                      const currCount = versionPurchaseCounts[curr.id] || 0;
                      return currCount > maxCount ? curr : max;
                    });
                    mostPopularVersionId = mostPopular.id;
                  }
                }

                return tool.versions.map((v, i) => (
                  <PricingCard
                    key={v.id}
                    version={v}
                    index={i}
                    tool={tool}
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
                    isBestValue={v.id === bestValueVersionId}
                    isMostPopular={v.id === mostPopularVersionId}
                    onCompare={() => setCompareOpen(true)}
                  />
                ));
              })()}
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
            tool={tool}
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

        {/* ── FAQ ────────��──────────────────────────────────────────────────── */}
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

        {/* ── Version History ───────────────────────────────────────────────── */}
        {changelog.length > 0 && (
          <VersionHistory changelog={changelog} />
        )}

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

      {/* ── Compare all plans modal ─────────────────────────────────────────── */}
      {tool && (
        <ComparisonModal
          open={compareOpen}
          onClose={() => setCompareOpen(false)}
          tool={tool}
          billingCycle={billingCycle}
          user={user}
          onFreeDownload={handleFreeDownload}
          onSignInRequired={openAuthModal}
          onBuyClick={(ver) => track('buy_click', {
            toolId: tool.id, toolName: tool.name, toolSlug: tool.slug ?? '',
            versionType: ver.versionType, price: parsePricing(ver).ctaPrice,
          })}
        />
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