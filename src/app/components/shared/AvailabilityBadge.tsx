import { motion } from "motion/react";

interface AvailabilityBadgeProps {
  text?: string;
}

export function AvailabilityBadge({ text = "Now booking: March–May 2026" }: AvailabilityBadgeProps) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <motion.div
      className="inline-flex items-center gap-2 px-4 py-2 rounded-full backdrop-blur-xl bg-white/5 border border-white/20"
      initial={false}
      animate={!reduceMotion ? {
        boxShadow: [
          '0 0 20px rgba(168, 85, 247, 0.2)',
          '0 0 30px rgba(168, 85, 247, 0.3)',
          '0 0 20px rgba(168, 85, 247, 0.2)',
        ]
      } : undefined}
      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
    >
      <span className="w-2 h-2 rounded-full bg-gradient-to-r from-green-400 to-emerald-500 animate-pulse" />
      <span className="text-sm text-white/90">{text}</span>
    </motion.div>
  );
}
