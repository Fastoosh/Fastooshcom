import { motion } from "motion/react";
import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  neonBorder?: boolean;
}

export function GlassCard({ children, className = "", hover = false, neonBorder = false }: GlassCardProps) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <motion.div
      className={`relative rounded-2xl backdrop-blur-xl bg-white/[0.02] border border-white/10 shadow-2xl ${className}`}
      style={{
        backgroundImage: neonBorder 
          ? 'linear-gradient(rgba(0, 0, 0, 0.95), rgba(0, 0, 0, 0.95)), linear-gradient(135deg, #a855f7, #3b82f6)'
          : undefined,
        backgroundOrigin: 'border-box',
        backgroundClip: neonBorder ? 'padding-box, border-box' : undefined,
        borderWidth: neonBorder ? '2px' : '1px',
      }}
      initial={false}
      whileHover={hover && !reduceMotion ? { 
        scale: 1.02,
        boxShadow: neonBorder 
          ? '0 0 40px rgba(168, 85, 247, 0.3), 0 0 80px rgba(59, 130, 246, 0.2)'
          : '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      } : undefined}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* Subtle noise texture overlay */}
      <div 
        className="inset-0 rounded-2xl opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='3.5' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
      />
      {children}
    </motion.div>
  );
}