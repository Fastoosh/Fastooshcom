import { UserAuthModal } from '../components/shared/UserAuthModal';
import { FreeDownloadModal } from '../components/shared/FreeDownloadModal';
import { useUserAuth } from '../hooks/useUserAuth';
import { useParams, Link } from 'react-router';
import { GlassCard } from '../components/shared/GlassCard';
import { NeonButton } from '../components/shared/NeonButton';
import { ToolSupportModal } from '../components/shared/ToolSupportModal';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import {
  ArrowLeft, Check, Download, Play, ChevronDown, ChevronUp,
  Monitor, Zap, Star, ExternalLink, Sparkles, ShoppingCart,
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

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

interface ToolVersion {
  id: string;
  versionType: 'Free' | 'Pro' | 'Studio';
  pricingModel?: 'subscription' | 'lifetime';
  monthlyPrice?: string;
  yearlyPrice?: string;
  lifetimePrice?: string;
  downloadUrl: string;
  lemonSqueezyVariantId?: string;
  features?: string[];
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

function parsePricing(version: ToolVersion): { priceLabel: string; cleanFeatures: string[] } {
  const raw = version.features ?? [];
  let priceLabel = '';
  const cleanFeatures: string[] = [];
  for (const item of raw) {
    if (item.startsWith('💰 ') && !priceLabel) {
      const sentinel = item.replace('💰 ', '');
      if (sentinel === 'Free') {
        priceLabel = 'Free';
      } else if (sentinel.startsWith('subscription|') || sentinel.startsWith('lifetime|')) {
        const [model, p1, p2] = sentinel.split('|');
        if (model === 'subscription') {
          priceLabel = [p1, p2 ? p2 + '/yr' : ''].filter(Boolean).join(' / ');
        } else {
          priceLabel = p1 || '';
        }
      } else {
        // Legacy plain-text sentinel
        priceLabel = sentinel;
      }
    } else {
      cleanFeatures.push(item);
    }
  }
  if (!priceLabel) {
    if (version.versionType === 'Free') priceLabel = 'Free';
    else if (version.pricingModel === 'subscription')
      priceLabel = [version.monthlyPrice, version.yearlyPrice ? version.yearlyPrice + '/yr' : ''].filter(Boolean).join(' / ');
    else priceLabel = version.lifetimePrice ?? '';
  }
  return { priceLabel, cleanFeatures };
}

// ── DemoPlayer ────────────────────────────────────────────────────────────────

function DemoPlayer({ url }: { url: string }) {
  const [playing, setPlaying] = useState(false);
  const yt = parseYouTube(url);
  const thumbnailUrl = yt ? `https://img.youtube.com/vi/${yt.videoId}/maxresdefault.jpg` : null;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="mb-20"
    >
      <div className="flex items-center gap-3 mb-5">
        <div className="h-px flex-1 bg-white/10" />
        <span className="text-xs font-semibold tracking-widest text-white/30 uppercase">See it in action</span>
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
            onClick={() => setPlaying(true)}
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
                Click to play
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
}: {
  version: ToolVersion;
  index: number;
  user: ReturnType<typeof useUserAuth>['user'];
  userPurchasedProductNames: string[];
  onSignInRequired: (msg?: string) => void;
  onFreeDownload: (v: ToolVersion) => void;
}) {
  const { priceLabel, cleanFeatures } = parsePricing(version);
  const isPro = version.versionType === 'Pro';
  const isFree = version.versionType === 'Free';

  const config = {
    Free:   { accent: 'text-emerald-400', dot: 'bg-emerald-400', ring: '' },
    Pro:    { accent: 'text-purple-400',  dot: 'bg-purple-400',  ring: 'ring-1 ring-purple-500/30 border-purple-500/40' },
    Studio: { accent: 'text-sky-400',     dot: 'bg-sky-400',     ring: '' },
  }[version.versionType] ?? { accent: 'text-white', dot: 'bg-white', ring: '' };

  // Build the checkout URL with pre-filled user data
  const buildCheckoutUrl = () => {
    if (!version.downloadUrl) return '/work-with-us';
    try {
      const url = new URL(version.downloadUrl);
      if (user?.email) url.searchParams.set('checkout[email]', user.email);
      if (user?.id)    url.searchParams.set('checkout[custom][user_id]', user.id);
      // Pass version ID so the webhook can record tool_version_id
      url.searchParams.set('checkout[custom][tool_version_id]', version.id);
      return url.toString();
    } catch {
      // If URL is invalid/relative, return as-is
      return version.downloadUrl;
    }
  };

  const handlePaidCTA = () => {
    if (!user) {
      onSignInRequired('Sign in to purchase and access your license key.');
      return;
    }
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
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap">
            <span className="px-3 py-1 rounded-full text-[11px] font-bold tracking-wide
              bg-gradient-to-r from-purple-500 to-blue-500 text-white shadow-md shadow-purple-500/30">
              Most Popular
            </span>
          </div>
        )}

        {/* Version label */}
        <div className="flex items-center gap-2 mb-5">
          <span className={`w-2 h-2 rounded-full ${config.dot}`} />
          <span className={`text-sm font-bold tracking-wide uppercase ${config.accent}`}>
            {version.versionType}
          </span>
        </div>

        {/* Price */}
        <div className="mb-6">
          <div className={`text-4xl font-black ${isFree ? 'text-emerald-400' : 'text-white'}`}>
            {isFree ? 'Free' : priceLabel || '—'}
          </div>
          {!isFree && (
            <p className="text-white/30 text-xs mt-1">
              {version.pricingModel === 'subscription' ? 'per month' : 'one-time'}
            </p>
          )}
        </div>

        {/* Feature list */}
        {cleanFeatures.length > 0 && (
          <ul className="space-y-2.5 flex-grow mb-7">
            {cleanFeatures.map((item, i) => (
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
            <button
              onClick={() => onFreeDownload(version)}
              className="w-full inline-flex items-center justify-center gap-2
                px-5 py-3 rounded-xl text-sm font-semibold transition-all
                bg-white/8 hover:bg-emerald-500/15 border border-white/12
                hover:border-emerald-500/30 text-emerald-300 hover:text-emerald-200"
            >
              <Download className="w-3.5 h-3.5" />
              Download Free
            </button>
          ) : (
            /* ── Paid: smart checkout CTA ── */
            <button
              onClick={handlePaidCTA}
              className={`w-full inline-flex items-center justify-center gap-2
                px-5 py-3 rounded-xl text-sm font-semibold transition-all
                ${isPro
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white shadow-lg shadow-purple-500/25'
                  : 'bg-white/10 hover:bg-white/15 border border-white/15 text-white'
                }`}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              {user
                ? `Buy Now${priceLabel ? ` · ${priceLabel}` : ''}`
                : `Get ${version.versionType} — Sign in`}
            </button>
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
        className="w-full flex items-center justify-between py-5 text-left gap-4"
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

// ── Main ──────────────────────────────────────────────────────────────────────

export function ToolDetail() {
  const { slug } = useParams();
  const { user, session, signInWithEmail, signUpWithEmail, forgotPassword } = useUserAuth();
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

  useEffect(() => { loadTool(); }, [slug]);

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

  const loadTool = async () => {
    try {
      setLoading(true);
      setError(null);
      const [res, settingsRes] = await Promise.all([
        fetch(`${API_BASE}/tools`, { headers: { Authorization: `Bearer ${publicAnonKey}` } }),
        fetch(`${API_BASE}/settings`, { headers: { Authorization: `Bearer ${publicAnonKey}` } }),
      ]);

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        if (settingsData.data?.toolStatuses?.length) {
          setStatuses(settingsData.data.toolStatuses);
        }
      }
      if (!res.ok) throw new Error('Network error');
      const result = await res.json();
      if (result.success && result.data) {
        let found = result.data.find((t: Tool) => t.slug === slug)
          || result.data.find((t: Tool) => t.id === slug);
        if (found) {
          if (!found.versions && (found as any).toolVersions)
            found = { ...found, versions: (found as any).toolVersions };
          setTool(found);
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

  // Handle free download — auto-download if signed in, show modal if guest
  const handleFreeDownload = async (version: ToolVersion) => {
    if (!version.downloadUrl) return;
    if (user) {
      // Signed-in: record lead silently then open the file
      try {
        await fetch(`${API_BASE}/free-download`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
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
        <NeonButton href="/tools"><ArrowLeft className="w-4 h-4 mr-2" />Back to Tools</NeonButton>
      </div>
    );
  }

  // Cheapest paid version for the quick CTA
  const proVersion = tool.versions?.find(v => v.versionType === 'Pro');
  const freeVersion = tool.versions?.find(v => v.versionType === 'Free');
  const primaryVersion = proVersion ?? freeVersion ?? tool.versions?.[0];

  return (
    <div className="min-h-screen pt-8 pb-24">
      <div className="max-w-5xl mx-auto px-6">

        {/* ── Back nav ──────────────────────────────────────────────────────── */}
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}>
          <Link
            to="/tools"
            className="inline-flex items-center gap-1.5 text-sm text-white/40
              hover:text-white/80 transition-colors mb-10"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            All tools
          </Link>
        </motion.div>

        {/* ── Category + badges ─────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="flex flex-wrap items-center gap-2 mb-5"
        >
          {tool.category && (() => {
            const match = statuses.find(s => s.label === tool.category);
            const gradient = STATUS_COLOR_MAP[match?.color || 'purple'] || 'from-purple-500 to-violet-500';
            return (
              <span className={`px-2.5 py-1 text-[11px] font-bold tracking-widest uppercase rounded-full bg-gradient-to-r ${gradient} text-white`}>
                {tool.category}
              </span>
            );
          })()}
          {tool.featured && (
            <span className="px-2.5 py-1 text-[11px] font-bold tracking-widest uppercase rounded-full
              border border-purple-500/40 text-purple-300 bg-purple-500/10 flex items-center gap-1">
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
            <div className="flex flex-wrap gap-3">
              {freeVersion && (
                <button
                  onClick={() => handleFreeDownload(freeVersion)}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
                    bg-white/8 hover:bg-emerald-500/15 border border-white/12
                    hover:border-emerald-500/30 text-emerald-300 hover:text-emerald-200 transition-all"
                >
                  <Download className="w-3.5 h-3.5 mr-1" />
                  Try Free
                </button>
              )}
              {proVersion && (
                <NeonButton
                  href={proVersion.downloadUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  variant="primary"
                >
                  <Sparkles className="w-3.5 h-3.5 mr-2" />
                  Get Pro
                </NeonButton>
              )}
              {tool.demoUrl && (
                <button
                  onClick={() => {
                    document.getElementById('demo-section')?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl
                    text-sm text-white/50 hover:text-white/80
                    border border-white/10 hover:border-white/20
                    bg-white/5 hover:bg-white/8 transition-all"
                >
                  <Play className="w-3.5 h-3.5" />
                  Watch demo
                </button>
              )}
            </div>
          </div>

          {/* Right: contained image — NOT full bleed, properly rounded */}
          <div className="relative rounded-2xl overflow-hidden border border-white/10
            bg-white/5 aspect-[4/3] md:aspect-auto md:h-[280px]">
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
          {tool.demoUrl && <DemoPlayer url={tool.demoUrl} />}
        </div>

        {/* ── Pricing ───────────────────────────────────────────────────────── */}
        {tool.versions && tool.versions.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-20"
          >
            <SectionLabel>Choose your version</SectionLabel>
            <div className={`grid grid-cols-1 gap-5 ${
              tool.versions.length === 2 ? 'sm:grid-cols-2 max-w-2xl mx-auto' : 'sm:grid-cols-3'
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
                  Sign in
                </button>
                {' '}to track your licenses and access purchases.
              </motion.p>
            )}
          </motion.section>
        )}

        {/* ── How it works ──────────────────────────────────────────────────── */}
        {tool.howItWorks && tool.howItWorks.length > 0 && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="mb-20"
          >
            <SectionLabel>How it works</SectionLabel>
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
            <SectionLabel>System requirements</SectionLabel>
            <GlassCard className="p-6 flex gap-4 items-start">
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
            <SectionLabel>FAQ</SectionLabel>
            <GlassCard className="px-6 divide-y divide-white/8 max-w-3xl mx-auto">
              {tool.faqs.map((faq, i) => (
                <FaqItem key={i} faq={faq} defaultOpen={i === 0} />
              ))}
            </GlassCard>
          </motion.section>
        )}

        {/* ── Support CTA ───────────────────────────────────────────────────── */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
        >
          <GlassCard neonBorder className="p-10 flex flex-col sm:flex-row items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Zap className="w-4 h-4 text-purple-400" />
                <span className="text-sm font-bold text-white">Need help?</span>
              </div>
              <p className="text-white/40 text-sm">
                Email support included with every purchase — we reply within 24 h.
              </p>
            </div>
            <div className="flex gap-3 flex-shrink-0">
              <NeonButton variant="secondary" onClick={() => setSupportOpen(true)}>
                <ExternalLink className="w-3.5 h-3.5 mr-2" />
                Contact
              </NeonButton>
              <NeonButton href="/tools" variant="secondary">
                Browse tools
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