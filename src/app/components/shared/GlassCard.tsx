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
      {children}

      {/* Neon gradient border — MUST come after {children} and carry a high z-index
          so it always paints on top of images or any child that forms its own
          stacking context (e.g. <img>, transformed elements, overflow:hidden wrappers). */}
      {neonBorder && (
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            zIndex: 10,
            padding: '2px',
            background: 'linear-gradient(135deg, var(--color-purple-500, #a855f7), var(--color-violet-500, #3b82f6))',
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
          }}
        />
      )}
    </motion.div>
  );
}
