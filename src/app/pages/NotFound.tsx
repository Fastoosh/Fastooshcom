import { motion } from "motion/react";
import { GlassCard } from "../components/shared/GlassCard";
import { NeonButton } from "../components/shared/NeonButton";
import { Home } from "lucide-react";

export function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-2xl w-full"
      >
        <GlassCard neonBorder className="p-12 text-center">
          <div className="text-8xl font-bold bg-gradient-to-r from-purple-400 to-blue-400 bg-clip-text text-transparent mb-6">
            404
          </div>
          <h1 className="text-3xl md:text-4xl mb-4">Page not found</h1>
          <p className="text-white/60 mb-8">
            The page you're looking for doesn't exist or has been moved.
          </p>
          <NeonButton href="/">
            <Home className="w-5 h-5 mr-2 rtl:mr-0 rtl:ml-2 inline" />
            Back to home
          </NeonButton>
        </GlassCard>
      </motion.div>
    </div>
  );
}