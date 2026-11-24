// /use-cases/:slug — one "how to automate X" guide: short answer first, who
// it's for, the problem, numbered steps, an example, the tool, and an FAQ.
// The same content is prerendered for crawlers with HowTo + FAQPage data.
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Check, Users } from 'lucide-react';
import { GlassCard } from '../components/shared/GlassCard';
import { NeonButton } from '../components/shared/NeonButton';
import { SeoHead } from '../components/shared/SeoHead';
import { api } from '../utils/api';
import { publishedUseCases, type UseCase as UseCaseT } from '../utils/useCases';

export function UseCase() {
  const { slug } = useParams();
  const [all, setAll] = useState<UseCaseT[] | null>(null);
  const [tool, setTool] = useState<any>(null);

  useEffect(() => {
    let cancelled = false;
    api.getSettings().then((s: any) => {
      if (cancelled) return;
      const list = publishedUseCases(s?.data?.useCases);
      setAll(list);
      const uc = list.find(u => u.slug === slug);
      if (uc?.toolSlug) {
        api.getTools().then((t: any) => {
          if (!cancelled) setTool((t?.data || []).find((x: any) => x.slug === uc.toolSlug) || null);
        }).catch(() => {});
      }
    }).catch(() => setAll([]));
    window.scrollTo({ top: 0 });
    return () => { cancelled = true; };
  }, [slug]);

  const uc = all?.find(u => u.slug === slug);

  if (all === null) return <div className="min-h-screen py-32 text-center text-white/40">Loading…</div>;
  if (!uc) {
    return (
      <div className="min-h-screen py-32 px-6 text-center">
        <h1 className="text-3xl mb-4">Guide not found</h1>
        <Link to="/use-cases" className="text-purple-300 hover:text-purple-200">See all automation guides</Link>
      </div>
    );
  }

  const related = all.filter(u => u.slug !== uc.slug && u.toolSlug === uc.toolSlug).slice(0, 3);
  const faq = (uc.faq || []).filter(f => f.q?.trim() && f.a?.trim());

  return (
    <div className="min-h-screen py-24 px-6">
      <SeoHead pageKey={`use-case--${uc.slug}`} fallback={{ title: `${uc.title} | Fastoosh`, description: uc.summary.slice(0, 160) }} />
      <article className="max-w-3xl mx-auto">
        <Link to="/use-cases" className="inline-flex items-center gap-1.5 text-sm text-white/40 hover:text-white/70 mb-8">
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" /> All automation guides
        </Link>

        <motion.header initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
          {tool && <p className="text-xs uppercase tracking-widest text-purple-300/80 mb-3">With {tool.name}</p>}
          <h1 className="text-3xl md:text-5xl tracking-tight leading-tight mb-5">{uc.title}</h1>
          <p className="text-lg text-white/70 leading-relaxed">{uc.summary}</p>
        </motion.header>

        {(uc.audience || []).length > 0 && (
          <GlassCard className="p-6 mb-8">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white/80 mb-3"><Users className="w-4 h-4 text-purple-300" /> Who this is for</h2>
            <div className="flex flex-wrap gap-2">
              {uc.audience.map(a => <span key={a} className="text-sm px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/70">{a}</span>)}
            </div>
          </GlassCard>
        )}

        {uc.problem && (
          <section className="mb-10">
            <h2 className="text-2xl mb-3">The problem</h2>
            <p className="text-white/65 leading-relaxed">{uc.problem}</p>
          </section>
        )}

        {(uc.steps || []).length > 0 && (
          <section className="mb-10">
            <h2 className="text-2xl mb-5">How to do it{tool ? ` with ${tool.name}` : ''}</h2>
            <ol className="space-y-4">
              {uc.steps.map((s, i) => (
                <li key={i} className="flex gap-4">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-200 text-sm font-bold flex items-center justify-center">{i + 1}</span>
                  <div>
                    <h3 className="text-white font-semibold">{s.title}</h3>
                    <p className="text-white/60 leading-relaxed">{s.text}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        )}

        {uc.example && (
          <GlassCard className="p-6 mb-10 border-purple-500/20">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-purple-300/80 mb-2">Example</h2>
            <p className="text-white/75 leading-relaxed">{uc.example}</p>
          </GlassCard>
        )}

        {tool && (
          <GlassCard className="p-6 mb-10 flex flex-col sm:flex-row gap-5 items-start sm:items-center">
            {tool.imageUrl && <img src={tool.imageUrl} alt={tool.name} className="w-20 h-20 rounded-xl object-cover flex-shrink-0" />}
            <div className="flex-1">
              <h2 className="text-xl text-white">{tool.name}</h2>
              {tool.tagline && <p className="text-white/55 text-sm mt-1">{tool.tagline}</p>}
              {(tool.versions || []).some((v: any) => /free/i.test(v.versionType || '')) && (
                <p className="text-white/40 text-xs mt-2 flex items-center gap-1.5"><Check className="w-3.5 h-3.5 text-emerald-400" /> Free version available</p>
              )}
            </div>
            <NeonButton href={`/tools/${tool.slug}`}>See the tool</NeonButton>
          </GlassCard>
        )}

        {faq.length > 0 && (
          <section className="mb-10">
            <h2 className="text-2xl mb-4">Questions</h2>
            <div className="divide-y divide-white/10 rounded-2xl border border-white/10 bg-white/3">
              {faq.map(f => (
                <div key={f.q} className="p-5">
                  <h3 className="text-white font-medium mb-1">{f.q}</h3>
                  <p className="text-white/60 leading-relaxed">{f.a}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {related.length > 0 && (
          <section>
            <h2 className="text-xl mb-4">More guides</h2>
            <div className="grid gap-3">
              {related.map(r => (
                <Link key={r.slug} to={`/use-cases/${r.slug}`} className="flex items-center justify-between gap-4 rounded-xl border border-white/10 bg-white/3 px-5 py-4 hover:bg-white/6">
                  <span className="text-white/80">{r.title}</span>
                  <ArrowRight className="w-4 h-4 text-white/40 flex-shrink-0 rtl:rotate-180" />
                </Link>
              ))}
            </div>
          </section>
        )}
      </article>
    </div>
  );
}
