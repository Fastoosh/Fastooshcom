import { motion } from "motion/react";
import { ReactNode } from "react";

interface GlassCardProps {
  children: ReactNode;
  className?: string;
  hover?: boolean;
  neonBorder?: boolean;
  amberBorder?: boolean;
  darkBg?: boolean;
  onClick?: () => void;
}

export function GlassCard({ children, className = "", hover = false, neonBorder = false, amberBorder = false, darkBg = false, onClick }: GlassCardProps) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasSyntheticBorder = neonBorder || amberBorder;

  return (
    <motion.div
      className={`relative rounded-2xl backdrop-blur-xl shadow-2xl ${hasSyntheticBorder ? '' : 'border border-white/10'} ${className}`}
      {...(neonBorder ? { 'data-fastoosh-dark': 'true' } : {})}
      onClick={onClick}
      style={{
        backgroundColor: (neonBorder || amberBorder || darkBg)
          ? 'var(--fastoosh-card-dark, rgba(0,0,0,0.95))'
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

      {/* Neon gradient border (purple) */}
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

      {/* Amber gradient border (lifetime) */}
      {amberBorder && (
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none"
          style={{
            zIndex: 10,
            padding: '2px',
            background: 'linear-gradient(135deg, #f59e0b, #fbbf24, #d97706)',
            WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
            WebkitMaskComposite: 'xor',
            maskComposite: 'exclude',
          }}
        />
      )}
    </motion.div>
  );
}