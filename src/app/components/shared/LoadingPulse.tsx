import { motion } from "motion/react";

export function LoadingPulse() {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  return (
    <motion.div
      className="w-full h-full bg-gradient-to-br from-purple-900/10 to-blue-900/10 flex items-center justify-center"
      animate={!reduceMotion ? {
        opacity: [0.5, 1, 0.5],
      } : undefined}
      transition={{
        duration: 2,
        repeat: Infinity,
        ease: "easeInOut",
      }}
    >
      <div className="w-16 h-16 rounded-full border-4 border-purple-500/20 border-t-purple-500 animate-spin" />
    </motion.div>
  );
}
