import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'motion/react';
import { GlassCard } from "../components/shared/GlassCard";
import { NeonButton } from "../components/shared/NeonButton";
import { SeoHead } from "../components/shared/SeoHead";
import { Zap, Star, Crown } from "lucide-react";
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
  const [tools, setTools] = useState(fallbackTools);
  const [loading, setLoading] = useState(true);
  const [statuses, setStatuses] = useState<{ label: string; color: string }[]>(DEFAULT_STATUSES);
  const [ratings, setRatings] = useState<Record<string, { avg: number; count: number }>>({});

  useEffect(() => {
    loadTools();
    fetchRatings();
  }, []);

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

  const loadTools = async () => {
    try {
      const [toolsResponse, settingsResponse] = await Promise.all([
        api.getTools(),
        api.getSettings(),
      ]);

      if (settingsResponse.success && settingsResponse.data?.toolStatuses?.length) {
        setStatuses(settingsResponse.data.toolStatuses);
      }

      const response = toolsResponse;
      if (response.success && response.data && response.data.length > 0) {
        // Transform tools to match the expected format for display
        const transformedTools = response.data.map(tool => {
          // Get the first available version for pricing and features
          const firstVersion = tool.versions?.[0];
          
          // Determine price display
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
          
          return {
            ...tool,
            price,
            pricingSuffix,
            features: firstVersion?.features || [],
            category: tool.featured ? 'Popular' : (tool.category || 'Tools')
          };
        });
        setTools(transformedTools);
      }
    } catch (error) {
      console.error('Error loading tools:', error);
      // Keep fallback tools
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
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-xl bg-white/5 border border-white/20 mb-6">
            <Zap className="w-4 h-4 text-purple-400" />
            <span className="text-sm text-white/90">Production Tools Lab</span>
          </div>
          <h1 className="text-5xl md:text-6xl tracking-tight mb-6">
            Tools built
            <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent"> in-house</span>
          </h1>
          <p className="text-xl text-white/60 max-w-2xl mx-auto">
            Speed up your production workflow with our battle-tested automation scripts and plugins
          </p>
        </motion.div>

        {/* Tools Grid */}
        {loading ? (
          <div className="text-center text-white/60 py-12">Loading tools...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-24">
            {tools.map((tool, index) => (
              <motion.div
                key={tool.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
              >
                <GlassCard hover neonBorder className="p-0 h-full flex flex-col overflow-hidden">
                  {/* Tool Image */}
                  <div className="relative w-full h-44 flex-shrink-0 overflow-hidden">
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
                    {/* Category badge overlaid on image */}
                    <div className="absolute top-3 left-3">
                      <div className={`inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r ${getBadgeStyle(tool.category, statuses)} text-white text-xs`}>
                        {tool.category === "Pro" && <Crown className="w-3 h-3" />}
                        {tool.category === "Popular" && <Star className="w-3 h-3" />}
                        {tool.category === "New" && <Zap className="w-3 h-3" />}
                        {tool.category}
                      </div>
                    </div>
                    {/* Price overlaid bottom-right */}
                    <div className="absolute bottom-3 right-3 flex items-baseline gap-1.5">
                      {tool.oldPrice && (
                        <span className="text-xs text-white/40 line-through">{tool.oldPrice}</span>
                      )}
                      <span className={`text-lg font-bold ${tool.oldPrice ? 'text-purple-300' : 'text-white'}`}>
                        {tool.price === 'Free' ? 'Free' : `$${tool.price}`}
                        {tool.pricingSuffix && (
                          <span className="text-sm font-normal text-white/50">{tool.pricingSuffix}</span>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6 flex flex-col flex-grow">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-xl">{tool.name}</h3>
                      {ratings[tool.id] && (
                        <div className="flex items-center gap-1 flex-shrink-0 mt-1">
                          <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                          <span className="text-yellow-400 text-xs font-bold">{ratings[tool.id].avg}</span>
                          <span className="text-white/25 text-xs">({ratings[tool.id].count})</span>
                        </div>
                      )}
                    </div>
                    <p className="text-white/60 mb-6 flex-grow text-sm leading-relaxed">{tool.description}</p>

                    {/* CTA */}
                    <NeonButton 
                      href={`/tools/${tool.slug || tool.id}`} 
                      className="w-full justify-center"
                    >
                      Get it
                    </NeonButton>
                  </div>
                </GlassCard>
              </motion.div>
            ))}
          </div>
        )}

        {/* Support CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <GlassCard className="p-12 w-full">
            <h3 className="text-2xl mb-4">Need help or custom development?</h3>
            <p className="text-white/60 mb-6">
              All tools include documentation and email support. Custom scripts available on request.
            </p>
            <NeonButton href="/work-with-us">Work with us</NeonButton>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}