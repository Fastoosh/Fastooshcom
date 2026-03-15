import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { GlassCard } from "../components/shared/GlassCard";
import { NeonButton } from "../components/shared/NeonButton";
import { SeoHead } from "../components/shared/SeoHead";
import { CustomToolRequestModal } from "../components/shared/CustomToolRequestModal";
import { Zap, Star, Crown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { fetchTranslations, deepMergeTranslations } from "../utils/translations";
import { api } from "../utils/api";
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

// Fallback tools (used if API fails or returns no data)
const fallbackTools = [
  {
    id: "ae-automation-toolkit",
    slug: "ae-automation-toolkit",
    name: "AE Automation Toolkit",
    description: "Automate repetitive After Effects tasks. Batch rendering, project cleanup, and more.",
    price: "$49",
    category: "Popular",
    features: ["Batch rendering", "Auto-cleanup", "Export presets", "Layer utilities"]
  },
  {
    id: "motion-presets-pro",
    slug: "motion-presets-pro",
    name: "Motion Presets Pro",
    description: "200+ premium animation presets for After Effects. Drag, drop, done.",
    price: "$79",
    category: "New",
    features: ["200+ presets", "Regular updates", "Video tutorials", "Lifetime support"]
  },
  {
    id: "color-harmony-plugin",
    slug: "color-harmony-plugin",
    name: "Color Harmony Plugin",
    description: "AI-powered color grading assistant for Premiere Pro and After Effects.",
    price: "$99",
    category: "Pro",
    features: ["AI suggestions", "Custom LUTs", "Real-time preview", "CC integration"]
  },
  {
    id: "render-farm-manager",
    slug: "render-farm-manager",
    name: "Render Farm Manager",
    description: "Manage your render farm with ease. Monitor progress, queue management, notifications.",
    price: "$129",
    category: "Pro",
    features: ["Multi-machine", "Queue system", "Email alerts", "Usage analytics"]
  },
  {
    id: "script-library-bundle",
    slug: "script-library-bundle",
    name: "Script Library Bundle",
    description: "Complete collection of all our automation scripts. Best value.",
    price: "$199",
    category: "Popular",
    features: ["All scripts included", "Future updates free", "Priority support", "Commercial license"]
  },
  {
    id: "sound-sync-automation",
    slug: "sound-sync-automation",
    name: "Sound Sync Automation",
    description: "Automatically sync animations to audio beats and frequencies.",
    price: "$59",
    category: "New",
    features: ["Beat detection", "Freq analysis", "Auto-keyframing", "Music sync"]
  },
];

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

const getBadgeStyle = (category: string, statuses: { label: string; color: string }[]) => {
  const match = statuses.find(s => s.label === category);
  return STATUS_COLOR_MAP[match?.color || 'purple'] || 'from-purple-500 to-violet-500';
};

export function Tools() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [tools, setTools] = useState(fallbackTools);
  const [loading, setLoading] = useState(true);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [statuses, setStatuses] = useState<{ label: string; color: string }[]>(DEFAULT_STATUSES);
  const [ratings, setRatings] = useState<Record<string, { avg: number; count: number }>>({});
  const [cmsStatusTrans, setCmsStatusTrans] = useState<Record<string, string>>({});

  useEffect(() => { fetchRatings(); }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadTools(i18n.language); }, [i18n.language]);

  const fetchRatings = async () => {
    try {
      const res = await fetch(`${API_BASE}/tools-ratings`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      const data = await res.json();
      if (data.success) setRatings(data.data || {});
    } catch (err) {
      console.warn('Could not load ratings:', err);
    }
  };

  const loadTools = async (lang = i18n.language) => {
    try {
      const [toolsResponse, settingsResponse, trans, categoryTrans] = await Promise.all([
        api.getTools(),
        api.getSettings(),
        lang !== 'en' ? fetchTranslations(lang, 'tools')      : Promise.resolve({}),
        lang !== 'en' ? fetchTranslations(lang, 'categories') : Promise.resolve({}),
      ]);

      if (settingsResponse.success && settingsResponse.data?.toolStatuses?.length) {
        setStatuses(settingsResponse.data.toolStatuses);
      }

      if (lang !== 'en' && (categoryTrans as any)?.toolStatuses) {
        setCmsStatusTrans((categoryTrans as any).toolStatuses as Record<string, string>);
      } else {
        setCmsStatusTrans({});
      }

      if (toolsResponse.success && toolsResponse.data && toolsResponse.data.length > 0) {
        const transformedTools = toolsResponse.data.map(tool => {
          const firstVersion = tool.versions?.[0];

          let price = 'Free';
          let pricingSuffix = '';
          if (firstVersion) {
            if (firstVersion.versionType === 'Free') {
              price = 'Free';
            } else if (firstVersion.pricingModel === 'lifetime' && firstVersion.lifetimePrice) {
              price = firstVersion.lifetimePrice;
            } else if (firstVersion.pricingModel === 'subscription') {
              price = firstVersion.monthlyPrice || firstVersion.yearlyPrice || 'Contact';
              if (firstVersion.monthlyPrice) pricingSuffix = '/mo';
            }
          }

          const transformed = {
            ...tool,
            price,
            pricingSuffix,
            features: firstVersion?.features || [],
            category: tool.category || 'Tools',
          };

          const toolTrans = (trans as Record<string, any>)[tool.id];
          return toolTrans
            ? { ...transformed, ...deepMergeTranslations(transformed, toolTrans) }
            : transformed;
        });
        setTools(transformedTools);
      }
    } catch (error) {
      console.error('Error loading tools:', error);
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen py-24 px-6">
      <SeoHead
        pageKey="tools"
        fallback={{
          title: "Tools — After Effects Plugins & Scripts by Fastoosh",
          description: "Discover Fastoosh's professional After Effects plugins, automation scripts, and motion design tools trusted by leading studios and motion designers worldwide.",
        }}
      />
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center gap-2 rtl:flex-row-reverse px-4 py-2 rounded-full backdrop-blur-xl bg-white/5 border border-white/20 mb-6">
            <Zap className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-white/90">{t('tools.labBadge')}</span>
          </div>
          <h1 className="text-5xl md:text-6xl tracking-tight mb-6">
            {t('tools.titlePart1')}
            <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent"> {t('tools.titlePart2')}</span>
          </h1>
          <p className="text-xl text-white/60 max-w-2xl mx-auto">
            {t('tools.subtitle')}
          </p>
        </motion.div>

        {/* Tools Grid */}
        {loading ? (
          <div className="text-center text-white/60 py-12">{t('tools.loading')}</div>
        ) : (
          <div className="flex flex-wrap justify-center gap-8 mb-24">
            {tools.map((tool, index) => (
              <motion.div
                key={tool.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="w-full md:w-[calc(50%-1rem)] lg:w-[calc(33.333%-1.334rem)]"
              >
                <GlassCard
                  hover
                  neonBorder
                  className="p-0 h-full flex flex-col overflow-hidden cursor-pointer"
                  onClick={() => navigate(`/tools/${tool.slug || tool.id}`)}
                >
                  {/* Tool Image */}
                  <div className="relative w-full aspect-square flex-shrink-0 overflow-hidden">
                    {tool.imageUrl ? (
                      <img
                        src={tool.imageUrl}
                        alt={tool.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-gradient-to-br from-purple-900/40 to-blue-900/40" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    {/* Category badge */}
                    <div className="absolute top-3 left-3 rtl:left-auto rtl:right-3 flex items-center gap-1.5 rtl:flex-row-reverse">
                      <div className={`inline-flex items-center gap-1 rtl:flex-row-reverse px-3 py-1 rounded-full bg-gradient-to-r ${getBadgeStyle(tool.category, statuses)} text-white text-xs`}>
                        {tool.category === "Pro"     && <Crown className="w-3 h-3" />}
                        {tool.category === "Popular" && <Star  className="w-3 h-3" />}
                        {tool.category === "New"     && <Zap   className="w-3 h-3" />}
                        {cmsStatusTrans[tool.category] || t(`tools.statuses.${tool.category}`, { defaultValue: tool.category })}
                      </div>
                    </div>
                    {/* Price */}
                    <div className="absolute bottom-3 right-3 rtl:right-auto rtl:left-3 flex items-baseline gap-1.5">
                      {tool.oldPrice && (
                        <span className="text-xs text-white/40 line-through">{tool.oldPrice}</span>
                      )}
                      <span className={`text-lg font-bold ${tool.oldPrice ? 'text-purple-300' : 'text-white'}`}>
                        {tool.price === 'Free' ? 'Free' : (tool.price?.toString().startsWith('$') ? tool.price : `$${tool.price}`)}
                        {tool.pricingSuffix && (
                          <span className="text-sm font-normal text-white/50">{tool.pricingSuffix}</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6 flex flex-col flex-grow">
                    <div className="flex items-start justify-between gap-2 rtl:flex-row-reverse mb-2">
                      <h3 className="text-xl">{tool.name}</h3>
                      {ratings[tool.id] && (
                        <div className="flex items-center gap-1 rtl:flex-row-reverse flex-shrink-0 mt-1">
                          <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                          <span className="text-yellow-400 text-xs font-bold">{ratings[tool.id].avg}</span>
                          <span className="text-white/25 text-xs">({ratings[tool.id].count})</span>
                        </div>
                      )}
                    </div>
                    <p className="text-white/60 mb-6 flex-grow text-sm leading-relaxed">{tool.description}</p>
                    <NeonButton className="w-full justify-center">
                      {t('tools.getIt')}
                    </NeonButton>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        )}

        {/* Custom Tool CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <GlassCard className="p-12 w-full">
            <h3 className="text-2xl mb-4">{t('tools.customCtaHeading')}</h3>
            <p className="text-white/60 mb-6">
              {t('tools.customCtaSubtitle')}
            </p>
            <button
              onClick={() => setShowCustomModal(true)}
              className="inline-flex items-center gap-2 px-8 py-3.5 rounded-xl font-semibold text-sm text-white transition-all hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}
            >
              {t('tools.customCtaBtn')}
            </button>
          </GlassCard>
        </motion.div>

        <CustomToolRequestModal open={showCustomModal} onClose={() => setShowCustomModal(false)} />
      </div>
    </div>
  );
}