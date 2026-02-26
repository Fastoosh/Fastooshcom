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
      className={`relative rounded-2xl backdrop-blur-xl shadow-2xl ${neonBorder ? '' : 'border border-white/10'} ${className}`}
      {...(neonBorder ? { 'data-fastoosh-dark': 'true' } : {})}
      style={{
        backgroundColor: neonBorder 
          ? 'var(--fastoosh-card-dark, rgba(255,255,255,0.02))'
          : 'var(--fastoosh-card-bg, rgba(255,255,255,0.02))',
      }}
      initial={false}
      whileHover={hover && !reduceMotion ? { 
        scale: 1.02,
        boxShadow: neonBorder 
          ? '0 0 40px color-mix(in srgb, var(--color-purple-500, #a855f7) 30%, transparent), 0 0 80px color-mix(in srgb, var(--color-violet-600, #3b82f6) 20%, transparent)'
          : '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      } : undefined}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      {/* Neon gradient border */}
      {neonBorder && (
        <div 
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            padding: '2px',
            background: 'linear-gradient(135deg, var(--color-purple-500, #a855f7), var(--color-violet-500, #3b82f6))',
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
          }}
        />
      )}
      
      {/* Subtle noise texture overlay */}
      <div 
        className="inset-0 rounded-2xl opacity-[0.015] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='3.5' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")`,
        }}
      />
      {children}
    </motion.div>
  );
}