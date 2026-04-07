import { useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import { motion } from "motion/react";
import { GlassCard } from "../components/shared/GlassCard";
import { NeonButton } from "../components/shared/NeonButton";
import { Mail, Globe, Construction as ConstructionIcon } from "lucide-react";
import fastooshLogo from "figma:asset/146d4e74197e43854d1765af396281d8ee56010c.png";
import { ScrollingGradientBackground } from "../components/shared/ScrollingGradientBackground";
import { useTracker } from "../hooks/useTracker";

export function Construction() {
  const navigate = useNavigate();
  const { track } = useTracker();
  const entryTime = useRef(Date.now());

  // ── Page tracking (this page is outside Layout/RouteTracker) ────────────────
  useEffect(() => {
    // Note: React fires CHILD effects before PARENT effects.
    // This effect (child) runs before TrackingProvider's init effect (parent),
    // so sidRef.current is still '' here — flush() would exit early.
    // TrackingProvider schedules setTimeout(flush, 0) in its init effect,
    // which runs in the next event-loop tick after ALL effects complete,
    // picking up this page_view event with the correct session ID.
    track('page_view', { path: '/', title: 'Fastoosh — Coming Soon' });

    return () => {
      track('page_exit', {
        path:     '/',
        duration: Math.round((Date.now() - entryTime.current) / 1000),
      });
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Safety net: if Supabase ignored our redirectTo (URL not yet whitelisted)
  // it falls back to the Site URL (fastoosh.com root = this page).
  // We catch any OAuth payload that lands here and forward it to /auth/callback.
  useEffect(() => {
    const hash   = window.location.hash;
    const search = window.location.search;
    const hasOAuthPayload =
      hash.includes('access_token') ||
      hash.includes('error') ||
      new URLSearchParams(search).has('code') ||
      new URLSearchParams(search).has('error');

    if (hasOAuthPayload) {
      navigate(`/auth/callback${search}${hash}`, { replace: true });
    }
  }, [navigate]);

  return (
    <>
      <ScrollingGradientBackground />
      
      <div className="relative min-h-screen flex items-center justify-center px-6">
        <div className="max-w-3xl mx-auto text-center space-y-8">
          {/* Fastoosh Logo with Glow */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="mb-8"
          >
            <div className="inline-block relative">
              {/* Glow effect layers */}
              <div className="absolute inset-0 blur-3xl opacity-60 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full scale-100" />
              <div className="absolute inset-0 blur-2xl opacity-15 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full scale-100 px-[0px] py-[0px]" />
              
              {/* Logo */}
              <img
                src={fastooshLogo}
                alt="Fastoosh"
                className="relative w-auto h-16 sm:h-20 md:h-24 object-contain drop-shadow-[0_0_1px_rgba(168,85,247,0.01)] mx-[0px] my-[0px]"
                style={{
                  filter: "drop-shadow(0 0 1px rgba(59, 130, 246, 0.02)) drop-shadow(0 0 1px rgba(168, 85, 247, 0.02))"
                }}
              />
            </div>
          </motion.div>

          {/* Main Content */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            
            {/* Construction Icon */}
            <div className="mb-6">
              <ConstructionIcon className="w-16 h-16 sm:w-20 sm:h-20 text-purple-400 mx-auto opacity-70" />
            </div>
            
            <p className="text-lg md:text-xl text-white/70 max-w-xl mx-auto">
              We're crafting something extraordinary. Our new website will showcase high-end custom work for ambitious teams worldwide.
            </p>
          </motion.div>

          {/* Info Cards */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-8"
          >
            <GlassCard className="p-6 text-center">
              <Globe className="w-8 h-8 text-blue-400 mx-auto mb-3" />
              <h3 className="text-lg mb-2 text-white">Remote Worldwide</h3>
              <p className="text-white/60 text-sm">
                Collaborating with teams across the globe
              </p>
            </GlassCard>

            <GlassCard className="p-6 text-center">
              <Mail className="w-8 h-8 text-purple-400 mx-auto mb-3" />
              <h3 className="text-lg mb-2 text-white">Get in Touch</h3>
              <p className="text-white/60 text-sm">
                Reach out for projects & inquiries
              </p>
            </GlassCard>
          </motion.div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
            className="pt-4"
          >
            <GlassCard neonBorder className="p-8">
              <p className="text-white/90 mb-6">
                Interested in working together? We're currently taking on select projects.
              </p>
              <NeonButton href="mailto:youssef@fastoosh.com">
                Contact us <Mail className="w-5 h-5 ml-2 inline" />
              </NeonButton>
            </GlassCard>
          </motion.div>

          {/* Status Badge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="pt-8"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10">
              <div className="relative">
                <div className="w-2 h-2 rounded-full bg-purple-400" />
                <div className="absolute inset-0 w-2 h-2 rounded-full bg-purple-400 animate-ping" />
              </div>
              <span className="text-sm text-white/70">
                Website launching soon
              </span>
            </div>
          </motion.div>

          {/* Admin Links (for development) */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 1 }}
            className="pt-8 text-xs text-white/30"
          >
            <p className="mb-2">Quick links:</p>
            <div className="flex gap-3 justify-center">
              <a href="/init" className="hover:text-purple-400 transition-colors">
                Initialize Data
              </a>
              <span>•</span>
              <a href="/admin" className="hover:text-purple-400 transition-colors">
                Admin Panel
              </a>
              <span>•</span>
              <a href="/projects" className="hover:text-purple-400 transition-colors">
                View Projects
              </a>
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
}