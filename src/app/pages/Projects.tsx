import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { GlassCard } from "../components/shared/GlassCard";
import { NeonButton } from "../components/shared/NeonButton";
import { SeoHead } from "../components/shared/SeoHead";
import { api } from "../utils/api";

// Fallback projects (used if API fails or returns no data)
const fallbackProjects = [
  {
    id: "fintech-explainer",
    title: "FinTech Product Launch",
    category: "Product",
    description: "2.3M views, 340% increase in sign-ups",
    imageUrl: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&q=80"
  },
  {
    id: "saas-onboarding",
    title: "SaaS Onboarding Flow",
    category: "Product",
    description: "40% faster user activation",
    imageUrl: "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=800&q=80"
  },
  {
    id: "brand-identity",
    title: "Tech Brand Identity",
    category: "Brand",
    description: "Complete visual system in 3 weeks",
    imageUrl: "https://images.unsplash.com/photo-1558655146-9f40138edfeb?w=800&q=80"
  },
  {
    id: "product-demo",
    title: "Product Demo Video",
    category: "Product",
    description: "Featured at TechCrunch Disrupt",
    imageUrl: "https://images.unsplash.com/photo-1551434678-e076c223a692?w=800&q=80"
  },
  {
    id: "social-campaign",
    title: "Social Media Campaign",
    category: "Social",
    description: "5M impressions in 2 weeks",
    imageUrl: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800&q=80"
  },
  {
    id: "ui-animations",
    title: "App UI Animations",
    category: "Product",
    description: "150+ micro-interactions",
    imageUrl: "https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=800&q=80"
  },
  {
    id: "crypto-brand",
    title: "Crypto Platform Rebrand",
    category: "Brand",
    description: "Brand recognition up 200%",
    imageUrl: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800&q=80"
  },
  {
    id: "ecommerce-ads",
    title: "E-commerce Ad Series",
    category: "Campaign",
    description: "ROAS 8.5x",
    imageUrl: "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800&q=80"
  },
];

export function Projects() {
  const [activeCategory, setActiveCategory] = useState("All");
  const [projects, setProjects] = useState(fallbackProjects);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      const response = await api.getProjects();
      if (response.success && response.data && response.data.length > 0) {
        setProjects(response.data);
      }
    } catch (error) {
      console.error('Error loading projects:', error);
      // Keep fallback projects
    }
    setLoading(false);
  };

  const filteredProjects = activeCategory === "All" 
    ? projects 
    : projects.filter(p => p.category === activeCategory);

  return (
    <div className="min-h-screen py-24 px-6">
      <SeoHead
        pageKey="projects"
        fallback={{
          title: "Projects — Fastoosh Motion Design Portfolio",
          description: "Explore Fastoosh's portfolio of premium motion design projects — brand films, product explainers, VFX, and UI animation for global clients.",
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
          <h1 className="text-5xl md:text-6xl tracking-tight mb-6">
            Selected
            <span className="bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent"> Projects</span>
          </h1>
          <p className="text-xl text-white/60 max-w-2xl mx-auto">
            Curated work for ambitious brands and fast-growing startups
          </p>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="flex flex-wrap justify-center gap-3 mb-16"
        >
          {["All", ...Array.from(new Set(projects.map((p) => p.category).filter(Boolean)))].map((category) => {
            const isActive = category === activeCategory;
            return (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`px-6 py-2 rounded-full backdrop-blur-xl transition-all duration-300 ${
                  isActive
                    ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white border border-transparent'
                    : 'bg-white/5 text-white/70 border border-white/20 hover:bg-white/10 hover:text-white'
                }`}
              >
                {category}
              </button>
            );
          })}
        </motion.div>

        {/* Projects Grid */}
        {loading ? (
          <div className="text-center text-white/60 py-12">Loading projects...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {filteredProjects.map((project, index) => (
              <motion.a
                key={project.id}
                href={`/projects/${project.slug || project.id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                layout
              >
                <GlassCard hover neonBorder className="overflow-hidden group h-full">
                  <div className="aspect-video overflow-hidden">
                    <img 
                      src={project.imageUrl} 
                      alt={project.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  </div>
                  <div className="p-6">
                    <div className="text-xs text-purple-400 mb-2">{project.category}</div>
                    <h3 className="text-xl mb-2">{project.title}</h3>
                    <p className="text-white/60 text-sm">{project.description}</p>
                  </div>
                </GlassCard>
              </motion.a>
            ))}
          </div>
        )}

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mt-24"
        >
          <GlassCard className="p-12 w-full">
            <h3 className="text-2xl mb-4">Have a project in mind?</h3>
            <p className="text-white/60 mb-6">Let's create something extraordinary together</p>
            <NeonButton href="/work-with-us">Work with us</NeonButton>
          </GlassCard>
        </motion.div>
      </div>
    </div>
  );
}