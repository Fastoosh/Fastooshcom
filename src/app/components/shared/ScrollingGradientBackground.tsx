import { motion } from "motion/react";
import { useState, useEffect } from "react";

export function ScrollingGradientBackground() {
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Calculate scroll progress (0 to 1 based on page height)
  const scrollProgress = Math.min(scrollY / 2000, 1);

  // Interpolate colors based on scroll
  const color1R = Math.floor(15 + scrollProgress * 10); // 15 -> 25
  const color1G = Math.floor(5 + scrollProgress * 10); // 5 -> 15
  const color1B = Math.floor(25 + scrollProgress * 15); // 25 -> 40

  const color2R = Math.floor(5 + scrollProgress * 15); // 5 -> 20
  const color2G = Math.floor(5 + scrollProgress * 15); // 5 -> 20
  const color2B = Math.floor(15 + scrollProgress * 20); // 15 -> 35

  // Calculate gradient colors based on scroll position
  const gradientStyle = {
    background: `radial-gradient(circle at ${50 + scrollY * 0.05}% ${50 + scrollY * 0.03}%, 
      rgb(${color1R}, ${color1G}, ${color1B}) 0%, 
      rgb(${color2R}, ${color2G}, ${color2B}) 30%, 
      rgb(0, 0, 0) 70%)`,
    transition: "background 0.5s ease-out",
  };

  // More dramatic color shifts in overlay
  const overlayOpacity = 0.15 + scrollProgress * 0.15; // 0.15 -> 0.3

  return (
    <>
      {/* Animated Gradient Background */}
      <div 
        className="fixed inset-0 -z-10"
        style={gradientStyle}
      />
      
      {/* Gradient overlays that shift with scroll - more dramatic */}
      <motion.div
        className="fixed inset-0 -z-10"
        style={{
          background: `linear-gradient(${135 + scrollY * 0.15}deg, 
            rgba(139, 92, 246, ${overlayOpacity}) 0%, 
            rgba(59, 130, 246, ${overlayOpacity * 0.8}) 50%, 
            transparent 100%)`,
          transition: "background 0.5s ease-out",
        }}
      />
      
      {/* Secondary overlay for more depth */}
      <motion.div
        className="fixed inset-0 -z-10"
        style={{
          background: `radial-gradient(ellipse at ${30 + scrollY * 0.08}% ${70 - scrollY * 0.05}%, 
            rgba(59, 130, 246, ${overlayOpacity * 0.5}) 0%, 
            transparent 60%)`,
          transition: "background 0.5s ease-out",
        }}
      />
    </>
  );
}