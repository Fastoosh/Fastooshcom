import { motion } from "motion/react";
import { ReactNode } from "react";
import { Link } from "react-router";

interface NeonButtonProps {
  children: ReactNode;
  href?: string;
  onClick?: () => void;
  variant?: "primary" | "secondary";
  className?: string;
  type?: "button" | "submit";
  disabled?: boolean;
}

export function NeonButton({ 
  children, 
  href, 
  onClick, 
  variant = "primary", 
  className = "",
  type = "button",
  disabled = false
}: NeonButtonProps) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  
  const baseClasses = "relative px-8 py-4 rounded-xl overflow-hidden transition-all duration-300 inline-flex items-center";
  
  const variantClasses = {
    primary: "bg-gradient-to-r from-violet-600 to-purple-600 text-white hover:from-violet-500 hover:to-fuchsia-500",
    secondary: "backdrop-blur-xl bg-white/5 border border-white/20 text-white hover:bg-white/10"
  };

  const disabledClasses = disabled ? "opacity-50 cursor-not-allowed" : "";

  const Component = href ? Link : motion.button;
  const props = href 
    ? { to: href }
    : { onClick, type, disabled, whileTap: !reduceMotion && !disabled ? { scale: 0.97 } : undefined };

  return (
    <Component
      {...props}
      className={`${baseClasses} ${variantClasses[variant]} ${className} ${disabledClasses}`}
    >
      <motion.span 
        className="relative z-10 inline-flex items-center gap-2"
        whileHover={!reduceMotion ? { y: -1 } : undefined}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.span>
      
      {variant === "primary" && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-violet-400 to-purple-400 opacity-0"
          whileHover={!reduceMotion ? { opacity: 0.3 } : undefined}
          transition={{ duration: 0.3 }}
        />
      )}
    </Component>
  );
}