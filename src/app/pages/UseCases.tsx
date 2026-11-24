// /use-cases — every published "how to automate X" guide, grouped by tool.
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { ArrowRight, Sparkles } from 'lucide-react';
import { GlassCard } from '../components/shared/GlassCard';
import { NeonButton } from '../components/shared/NeonButton';
import { SeoHead } from '../components/shared/SeoHead';
import { api } from '../utils/api';
import { publishedUseCases, type UseCase } from '../utils/useCases';

export function UseCases() {
  const [items, setItems] = useState<UseCase[] | null>(null);
  const [toolNames, setToolNames] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([api.getSettings(), api.getTools()]).then(([s, t]: any[]) => {
      setItems(publishedUseCases(s?.data?.useCases));
      const names: Record<string, string> = {};
      for (const tool of t?.data || []) if (tool.slug) names[tool.slug] = tool.name;
      setToolNames(names);
    }).catch(() => setItems([]));
  }, []);

  return (
    <div className="min-h-screen py-24 px-6">
      <SeoHead
        pageKey="use-cases"
        fallback={{
          title: 'After Effects Automation Use Cases | Fastoosh',
          description: 'Step-by-step guides to automating repetitive After Effects work: lower thirds from Excel, localized versions, ad variants, event graphics and more.',
          // Keep the empty page out of search until a guide is published.
          noIndex: items !== null && items.length === 0,
        }}
      />
      <div className="max-w-5xl mx-auto">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
          <p className="inline-flex items-center gap-2 text-xs uppercase tracking-widest text-purple-300/80 mb-4">
            <Sparkles className="w-3.5 h-3.5" /> Automation guides
          </p>
          <h1 className="text-4xl md:text-6xl tracking-tight mb-5">
            Automate the repetitive
            <br />
            <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">parts of your work</span>
          </h1>
          <p className="text-lg text-white/60 max-w-2xl mx-auto">
            Fastoosh builds tools for designers, studios, motion designers and videographers. These guides show how to
            turn hours of manual After Effects work into a spreadsheet and one click.
          </p>
        </motion.div>

        {items === null ? (
          <p className="text-center text-white/40">Loading…</p>
        ) : items.length === 0 ? (
          <p className="text-center text-white/40">Guides are coming soon.</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2">
            {items.map((u, i) => (
              <motion.div key={u.slug} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                <Link to={`/use-cases/${u.slug}`} className="block h-full group">
                  <GlassCard hover className="p-6 h-full flex flex-col">
                    {toolNames[u.toolSlug] && (
                      <span className="text-[11px] uppercase tracking-wider text-purple-300/70 mb-2">{toolNames[u.toolSlug]}</span>
                    )}
                    <h2 className="text-xl text-white mb-3 leading-snug">{u.title}</h2>
                    <p className="text-white/55 text-sm leading-relaxed flex-1">{u.summary}</p>
                    <span className="mt-5 inline-flex items-center gap-1.5 text-sm text-purple-300 group-hover:text-purple-200">
                      Read the guide <ArrowRight className="w-4 h-4 rtl:rotate-180" />
                    </span>
                  </GlassCard>
                </Link>
              </motion.div>
            ))}
          </div>
        )}

        <GlassCard className="p-10 mt-16 text-center">
          <h2 className="text-2xl mb-3">Have a repetitive task we don't cover?</h2>
          <p className="text-white/60 mb-6 max-w-xl mx-auto">Tell us about your workflow. We build custom tools and scripts for creative teams.</p>
          <NeonButton href="/tools">See all tools</NeonButton>
        </GlassCard>
      </div>
    </div>
  );
}
