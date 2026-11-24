// Tool page: "Who it's for", "What it automates" and links to this tool's
// automation guides. Content comes from Admin → Use cases.
import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { motion } from 'motion/react';
import { ArrowRight, Check, Users } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { api } from '../../utils/api';
import { publishedUseCases, type ToolExtras, type UseCase } from '../../utils/useCases';

export function ToolAudience({ toolSlug, toolName }: { toolSlug: string; toolName: string }) {
  const [extras, setExtras] = useState<ToolExtras | null>(null);
  const [guides, setGuides] = useState<UseCase[]>([]);

  useEffect(() => {
    let cancelled = false;
    api.getSettings().then((s: any) => {
      if (cancelled) return;
      setExtras(s?.data?.toolExtras?.[toolSlug] || null);
      setGuides(publishedUseCases(s?.data?.useCases).filter(u => u.toolSlug === toolSlug));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [toolSlug]);

  const audience = (extras?.audience || []).filter(Boolean);
  const automates = (extras?.automates || []).filter(Boolean);
  if (!audience.length && !automates.length && !guides.length) return null;

  return (
    <motion.section initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} className="mb-20 space-y-5">
      {(audience.length > 0 || automates.length > 0) && (
        <div className="grid gap-5 md:grid-cols-2">
          {audience.length > 0 && (
            <GlassCard className="p-6">
              <h2 className="flex items-center gap-2 text-lg text-white mb-4"><Users className="w-5 h-5 text-purple-300" /> Who {toolName} is for</h2>
              <div className="flex flex-wrap gap-2">
                {audience.map(a => <span key={a} className="text-sm px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/70">{a}</span>)}
              </div>
            </GlassCard>
          )}
          {automates.length > 0 && (
            <GlassCard className="p-6">
              <h2 className="text-lg text-white mb-4">What it automates</h2>
              <ul className="space-y-2">
                {automates.map(a => (
                  <li key={a} className="flex gap-2 text-white/65 text-sm"><Check className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />{a}</li>
                ))}
              </ul>
            </GlassCard>
          )}
        </div>
      )}
      {guides.length > 0 && (
        <GlassCard className="p-6">
          <h2 className="text-lg text-white mb-4">Use cases &amp; guides</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {guides.map(g => (
              <Link key={g.slug} to={`/use-cases/${g.slug}`} className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/3 px-4 py-3 hover:bg-white/6">
                <span className="text-sm text-white/80">{g.title}</span>
                <ArrowRight className="w-4 h-4 text-white/40 flex-shrink-0 rtl:rotate-180" />
              </Link>
            ))}
          </div>
        </GlassCard>
      )}
    </motion.section>
  );
}
