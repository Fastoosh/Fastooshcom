import { useParams } from "react-router";
import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { GlassCard } from "../components/shared/GlassCard";
import { NeonButton } from "../components/shared/NeonButton";
import { SeoHead } from "../components/shared/SeoHead";
import { ArrowLeft, Play } from "lucide-react";
import { api } from "../utils/api";

// Fallback project data
const fallbackProject = {
  title: "FinTech Product Launch",
  category: "Product",
  client: "TechCorp Financial",
  year: "2025",
  thumbnail: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80",
  goal: "Launch a new digital banking product to millennials with clear value proposition and seamless onboarding flow explanation.",
  approach: "Created a fast-paced, modern explainer combining bold typography, smooth transitions, and real UI demonstrations. Focus on trust-building and simplicity.",
  deliverables: [
    "90-second explainer video",
    "Social media cutdowns (15s, 30s, 60s)",
    "Animated UI components library",
    "Brand motion guidelines"
  ],
  outcome: "2.3M views in first month. 340% increase in sign-ups. Featured on Product Hunt.",
  images: [
    "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1200&q=80",
    "https://images.unsplash.com/photo-1551434678-e076c223a692?w=1200&q=80"
  ]
};

export function ProjectDetail() {
  const { id } = useParams();
  const [project, setProject] = useState<any>(fallbackProject);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showVideo, setShowVideo] = useState(false);

  useEffect(() => {
    const loadProject = async () => {
      if (!id) {
        setLoading(false);
        return;
      }

      console.log('Loading project with ID:', id);
      setLoading(true);
      setError(null);

      try {
        const response = await api.getProject(id);
        console.log('Project API response:', response);
        
        if (response.success && response.data) {
          setProject({
            ...response.data,
            thumbnail: response.data.imageUrl,
            images: response.data.screenshots || [],
          });
        } else {
          console.warn('Project not found, using fallback');
          setError('Project not found');
          // Keep fallback project
        }
      } catch (error) {
        console.error('Error loading project:', error);
        setError(`Failed to load project: ${error}`);
        // Keep fallback project
      } finally {
        setLoading(false);
      }
    };

    loadProject();
  }, [id]);

  // Convert regular video URLs to embed URLs
  const getEmbedUrl = (url: string) => {
    if (!url) return null;
    
    // YouTube
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      const videoId = url.includes('youtu.be') 
        ? url.split('youtu.be/')[1]?.split('?')[0]
        : url.split('v=')[1]?.split('&')[0];
      return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1` : null;
    }
    
    // Vimeo
    if (url.includes('vimeo.com')) {
      const videoId = url.split('vimeo.com/')[1]?.split('?')[0]?.split('/').pop();
      return videoId ? `https://player.vimeo.com/video/${videoId}?autoplay=1` : null;
    }
    
    // Already an embed URL - add autoplay if not present
    if (url.includes('embed') || url.includes('player')) {
      return url.includes('autoplay') ? url : `${url}${url.includes('?') ? '&' : '?'}autoplay=1`;
    }
    
    return null;
  };

  const embedUrl = getEmbedUrl(project.videoUrl);

  if (loading) {
    return (
      <div className="min-h-screen py-24 px-6 flex items-center justify-center">
        <div className="text-white/60">Loading project...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen py-24 px-6">
      <SeoHead
        pageKey={`project--${id}`}
        fallback={{
          title: project?.title ? `${project.title} — Fastoosh Projects` : 'Project — Fastoosh',
          description: project?.goal || project?.description || 'A premium motion design project by Fastoosh.',
          ogImage: project?.thumbnail || project?.imageUrl || undefined,
        }}
      />
      <div className="max-w-5xl mx-auto">
        {/* Error banner (shown but allows fallback content to display) */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg"
          >
            <p className="text-yellow-300 text-sm">
              ⚠️ Could not load project from database. Showing demo content. 
              <br />
              <span className="text-xs text-yellow-400/70">Error: {error}</span>
            </p>
          </motion.div>
        )}

        {/* Back button */}
        <motion.a
          href="/projects"
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors mb-12"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to projects
        </motion.a>

        {/* Hero Video */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <GlassCard neonBorder className="aspect-video overflow-hidden mb-12">
            {showVideo && embedUrl ? (
              <iframe
                src={embedUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div 
                className="w-full h-full bg-cover bg-center relative group cursor-pointer"
                style={{ backgroundImage: `url(${project.thumbnail})` }}
                onClick={() => embedUrl && setShowVideo(true)}
              >
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  {embedUrl ? (
                    <div className="w-20 h-20 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:scale-110 transition-transform">
                      <Play className="w-10 h-10 text-white ml-1" />
                    </div>
                  ) : (
                    <div className="text-white/60 text-center">
                      <p className="text-sm">No video available</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </GlassCard>
        </motion.div>

        {/* Project Meta */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-16"
        >
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
            <div>
              <div className="text-white/50 text-sm mb-1">Category</div>
              <div className="text-white">{project.category}</div>
            </div>
            <div>
              <div className="text-white/50 text-sm mb-1">Client</div>
              <div className="text-white">{project.client}</div>
            </div>
            <div>
              <div className="text-white/50 text-sm mb-1">Year</div>
              <div className="text-white">{project.year}</div>
            </div>
            <div>
              <div className="text-white/50 text-sm mb-1">Outcome</div>
              <div className="text-white">Featured</div>
            </div>
          </div>

          <h1 className="text-4xl md:text-5xl tracking-tight mb-6">{project.title}</h1>
        </motion.div>

        {/* Content Sections */}
        <div className="space-y-16">
          {/* Goal */}
          {project.goal && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <GlassCard className="p-8">
                <h2 className="text-2xl mb-4">Goal</h2>
                <p className="text-white/70 text-lg leading-relaxed">{project.goal}</p>
              </GlassCard>
            </motion.div>
          )}

          {/* Approach */}
          {project.approach && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <GlassCard className="p-8">
                <h2 className="text-2xl mb-4">Approach</h2>
                <p className="text-white/70 text-lg leading-relaxed">{project.approach}</p>
              </GlassCard>
            </motion.div>
          )}

          {/* Deliverables */}
          {project.deliverables && project.deliverables.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <GlassCard className="p-8">
                <h2 className="text-2xl mb-4">Deliverables</h2>
                <ul className="space-y-2">
                  {project.deliverables.map((item: string, index: number) => (
                    <li key={index} className="text-white/70 flex items-start gap-3">
                      <span className="text-purple-400 mt-1">→</span>
                      {item}
                    </li>
                  ))}
                </ul>
              </GlassCard>
            </motion.div>
          )}

          {/* Stills */}
          {project.images && project.images.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {project.images.map((image: string, index: number) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: index * 0.1 }}
                >
                  <GlassCard className="overflow-hidden">
                    <img src={image} alt={`Still ${index + 1}`} className="w-full" />
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          )}

          {/* Outcome */}
          {project.outcome && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
            >
              <GlassCard neonBorder className="p-8">
                <h2 className="text-2xl mb-4">Outcome</h2>
                <p className="text-white/70 text-lg leading-relaxed">{project.outcome}</p>
              </GlassCard>
            </motion.div>
          )}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-24 text-center"
        >
          <GlassCard className="p-12 w-full">
            <h3 className="text-3xl mb-4">Ready to start your project?</h3>
            <p className="text-white/60 mb-6">Let's create something extraordinary together</p>
            <NeonButton href="/work-with-us">Work with us</NeonButton>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}