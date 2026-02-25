import { useState, useEffect } from "react";
import { NeonButton } from "../components/shared/NeonButton";
import { GlassCard } from "../components/shared/GlassCard";
import { AvailabilityBadge } from "../components/shared/AvailabilityBadge";
import { SeoHead } from "../components/shared/SeoHead";
import { DEFAULT_HOME_CONTENT, ICON_MAP, type HomeContent } from "../components/admin/HomeTab";
import { ArrowRight, CheckCircle2, Clock } from "lucide-react";
import { motion } from "motion/react";
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

export function Home() {
  const [homeContent, setHomeContent] = useState<HomeContent>(DEFAULT_HOME_CONTENT);
  const [featuredProjects, setFeaturedProjects] = useState<any[]>([
    { id: "fintech-explainer",  title: "FinTech Product Launch",  outcome: "2.3M views, 340% increase in sign-ups",  thumbnail: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80" },
    { id: "saas-onboarding",    title: "SaaS Onboarding Flow",    outcome: "40% faster user activation",            thumbnail: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80" },
    { id: "brand-identity",     title: "Tech Brand Identity",     outcome: "Complete visual system in 3 weeks",     thumbnail: "https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=800&q=80" },
    { id: "product-demo",       title: "Product Demo Video",      outcome: "Featured at TechCrunch Disrupt",        thumbnail: "https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&q=80" },
    { id: "social-campaign",    title: "Social Media Campaign",   outcome: "5M impressions in 2 weeks",            thumbnail: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80" },
    { id: "ui-animations",      title: "App UI Animations",       outcome: "150+ micro-interactions",              thumbnail: "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=800&q=80" },
  ]);

  useEffect(() => {
    fetchHomeContent();
    fetchFeaturedProjects();
  }, []);

  const fetchHomeContent = async () => {
    try {
      const res = await fetch(`${API_BASE}/home-content`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      const result = await res.json();
      if (result.success && result.data) {
        setHomeContent({ ...DEFAULT_HOME_CONTENT, ...result.data });
      }
    } catch (error) {
      console.error('Error fetching home content:', error);
    }
  };

  const fetchFeaturedProjects = async () => {
    try {
      const res = await fetch(`${API_BASE}/projects`, {
        headers: { Authorization: `Bearer ${publicAnonKey}` },
      });
      const result = await res.json();
      if (result.success && result.data?.length > 0) {
        const featured = result.data
          .filter((p: any) => p.featured)
          .slice(0, 6)
          .map((p: any) => ({ id: p.id, title: p.title, outcome: p.description || p.outcome || 'Featured project', thumbnail: p.imageUrl }));
        if (featured.length > 0) setFeaturedProjects(featured);
      }
    } catch (error) {
      console.error('Error fetching featured projects:', error);
    }
  };

  const getEmbedUrl = (url: string) => {
    if (!url) return '';
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = url.includes('youtu.be')
        ? url.split('youtu.be/')[1]?.split('?')[0]
        : url.split('v=')[1]?.split('&')[0];
      return videoId ? `https://www.youtube.com/embed/${videoId}` : url;
    }
    if (url.includes('vimeo.com')) {
      const videoId = url.split('vimeo.com/')[1]?.split('?')[0]?.split('/').pop();
      if (videoId) return `https://player.vimeo.com/video/${videoId}`;
    }
    return url;
  };

  const c = homeContent;
  const embedUrl = getEmbedUrl(c.showreelUrl);

  return (
    <div className="relative">
      <SeoHead
        pageKey="home"
        fallback={{
          title: "Fastoosh — Premium Motion Design Studio",
          description: "Fastoosh crafts premium motion design, After Effects tools, and visual storytelling for brands that want to move audiences.",
        }}
      />

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative min-h-[90vh] flex items-center justify-center px-6 py-20">
        <div className="max-w-5xl mx-auto text-center space-y-8">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <h1 className="text-4xl sm:text-5xl md:text-7xl tracking-tight mb-6 leading-tight">
              {c.heroLine1}
              <br />
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">
                {c.heroLine2}
              </span>
            </h1>
            <p className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto">{c.heroSubtitle}</p>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.2 }} className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <NeonButton href="/work-with-us">{c.heroCta1Text} <ArrowRight className="w-5 h-5 ml-2 inline" /></NeonButton>
            <NeonButton href="/projects" variant="secondary">{c.heroCta2Text}</NeonButton>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.4 }} className="flex justify-center pt-4">
            <AvailabilityBadge />
          </motion.div>

          {/* Showreel */}
          <motion.div initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.5 }} className="pt-12">
            <GlassCard neonBorder className="aspect-video overflow-hidden">
              {c.showreelUrl ? (
                <iframe src={embedUrl} className="w-full h-full" allow="autoplay; fullscreen; picture-in-picture" allowFullScreen title="Fastoosh Showreel" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-purple-900/20 to-blue-900/20 flex items-center justify-center">
                  <div className="text-center space-y-4">
                    <div className="w-20 h-20 mx-auto rounded-full bg-white/10 flex items-center justify-center">
                      <div className="w-0 h-0 border-l-[16px] border-l-white border-t-[12px] border-t-transparent border-b-[12px] border-b-transparent ml-1" />
                    </div>
                    <p className="text-white/60">Showreel coming soon</p>
                  </div>
                </div>
              )}
            </GlassCard>
          </motion.div>
        </div>
      </section>

      {/* ── Testimonial ──────────────────────────────────────────────────── */}
      <section className="px-6 py-12 border-y border-white/5 bg-white/[0.02]">
        <div className="max-w-5xl mx-auto">
          <GlassCard className="p-8">
            <blockquote className="text-center">
              <p className="text-lg md:text-xl text-white/90 mb-4">"{c.testimonialQuote}"</p>
              <footer className="text-white/60">
                <strong className="text-white">{c.testimonialAuthor}</strong>
                {c.testimonialRole && `, ${c.testimonialRole}`}
              </footer>
            </blockquote>
          </GlassCard>
        </div>
      </section>

      {/* ── Featured Projects ─────────────────────────────────────────────── */}
      <section className="px-6 py-24">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl tracking-tight mb-4">{c.featuredHeading}</h2>
            <p className="text-xl text-white/60">{c.featuredSubtitle}</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuredProjects.map((project, index) => (
              <motion.a key={project.id} href={`/projects/${project.id}`} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: index * 0.1 }}>
                <GlassCard hover neonBorder className="overflow-hidden group">
                  <div className="aspect-video overflow-hidden">
                    <img src={project.thumbnail} alt={project.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl mb-2">{project.title}</h3>
                    <p className="text-white/60 text-sm">{project.outcome}</p>
                  </div>
                </GlassCard>
              </motion.a>
            ))}
          </div>
          <div className="text-center mt-12">
            <NeonButton href="/projects" variant="secondary">View all projects</NeonButton>
          </div>
        </div>
      </section>

      {/* ── Capabilities ─────────────────────────────────────────────────── */}
      <section className="px-6 py-24 bg-white/[0.01]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl tracking-tight mb-4">{c.capabilitiesHeading}</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {c.capabilities.map((cap, index) => {
              const IconComp = ICON_MAP[cap.icon] || ICON_MAP['sparkles'];
              return (
                <motion.div key={cap.title + index} initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: index * 0.1 }}>
                  <GlassCard className="p-8 text-center h-full">
                    <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 flex items-center justify-center">
                      <IconComp className="w-8 h-8 text-purple-400" />
                    </div>
                    <h3 className="text-2xl mb-4">{cap.title}</h3>
                    <p className="text-white/60">{cap.description}</p>
                  </GlassCard>
                </motion.div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Process ──────────────────────────────────────────────────────── */}
      <section className="px-6 py-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl tracking-tight mb-4">{c.processHeading}</h2>
            <p className="text-xl text-white/60">{c.processSubtitle}</p>
          </div>
          <div className="relative">
            <div className="absolute left-8 top-0 bottom-0 w-px bg-gradient-to-b from-purple-500/50 to-blue-500/50 hidden md:block" />
            <div className="space-y-8">
              {c.processSteps.map((step, index) => (
                <motion.div key={step.number + index} initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5, delay: index * 0.1 }} className="relative">
                  <GlassCard className="p-8 ml-0 md:ml-20">
                    <div className="absolute -left-8 top-8 w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-xl font-bold hidden md:flex">
                      {step.number}
                    </div>
                    <div className="flex items-start gap-4">
                      <div className="md:hidden w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0">{step.number}</div>
                      <div>
                        <h3 className="text-2xl mb-2">{step.title}</h3>
                        <p className="text-white/60">{step.description}</p>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Turnaround & Deliverables ─────────────────────────────────────── */}
      <section className="px-6 py-24 bg-white/[0.01]">
        <div className="max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-8">
          <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            <GlassCard className="p-8 h-full">
              <Clock className="w-12 h-12 text-purple-400 mb-6" />
              <h3 className="text-2xl mb-4">Typical turnaround</h3>
              <div className="space-y-4 text-white/70">
                {c.turnaroundRows.map((row, idx) => (
                  <div key={idx} className={`flex justify-between items-center pb-3 ${idx < c.turnaroundRows.length - 1 ? 'border-b border-white/10' : ''}`}>
                    <span>{row.label}</span>
                    <span className="text-white">{row.time}</span>
                  </div>
                ))}
              </div>
              {c.turnaroundNote && <p className="text-sm text-white/50 mt-6">{c.turnaroundNote}</p>}
            </GlassCard>
          </motion.div>

          <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.5 }}>
            <GlassCard className="p-8 h-full">
              <CheckCircle2 className="w-12 h-12 text-blue-400 mb-6" />
              <h3 className="text-2xl mb-4">{c.deliverablesTitle}</h3>
              <ul className="space-y-3">
                {c.deliverables.map((item, index) => (
                  <li key={index} className="flex items-start gap-3">
                    <CheckCircle2 className="w-5 h-5 text-green-400 mt-0.5 flex-shrink-0" />
                    <span className="text-white/70">{item}</span>
                  </li>
                ))}
              </ul>
            </GlassCard>
          </motion.div>
        </div>
      </section>

      {/* ── Final CTA ────────────────────────────────────────────────────── */}
      <section className="px-6 py-32">
        <div className="max-w-4xl mx-auto text-center">
          <GlassCard className="p-12 w-full">
            <h2 className="text-4xl md:text-5xl tracking-tight mb-6">
              {c.ctaHeading}
              <br />
              <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent">{c.ctaHeadingGradient}</span>
            </h2>
            <p className="text-xl text-white/70 mb-8 max-w-2xl mx-auto">{c.ctaSubtitle}</p>
            <NeonButton href="/work-with-us">{c.heroCta1Text} <ArrowRight className="w-5 h-5 ml-2 inline" /></NeonButton>
            <div className="flex flex-wrap justify-center gap-6 mt-8 text-sm text-white/50">
              {c.ctaBadges.map((badge, i) => <span key={i}>{badge}</span>)}
            </div>
          </GlassCard>
        </div>
      </section>
    </div>
  );
}