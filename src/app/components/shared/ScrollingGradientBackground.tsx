import { useState, useEffect } from "react";
import { useSiteStyle, hexToRgb, DEFAULT_STYLE } from "../../context/StyleContext";

const SPEED_MAP = { slow: 3000, medium: 2000, fast: 1200 } as const;

export function ScrollingGradientBackground() {
  const { siteStyle } = useSiteStyle();
  const [scrollY, setScrollY] = useState(0);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const speedMax = SPEED_MAP[siteStyle.gradSpeed ?? 'medium'];
  const scrollProgress = Math.min(scrollY / speedMax, 1);

  // Parse base gradient colours from style context
  const g1 = hexToRgb(siteStyle.bgGrad1) ?? hexToRgb(DEFAULT_STYLE.bgGrad1)!;
  const g2 = hexToRgb(siteStyle.bgGrad2) ?? hexToRgb(DEFAULT_STYLE.bgGrad2)!;
  const ov1 = hexToRgb(siteStyle.overlayColor1) ?? hexToRgb(DEFAULT_STYLE.overlayColor1)!;
  const ov2 = hexToRgb(siteStyle.overlayColor2) ?? hexToRgb(DEFAULT_STYLE.overlayColor2)!;

  // Interpolate inner gradient colour with scroll (subtle shift toward lighter)
  const color1R = Math.floor(g1.r + scrollProgress * 10);
  const color1G = Math.floor(g1.g + scrollProgress * 10);
  const color1B = Math.floor(g1.b + scrollProgress * 15);

  const color2R = Math.floor(g2.r + scrollProgress * 15);
  const color2G = Math.floor(g2.g + scrollProgress * 15);
  const color2B = Math.floor(g2.b + scrollProgress * 20);

  const overlayOpacity = 0.15 + scrollProgress * 0.15;

  const base = siteStyle.bgBase ?? '#000000';

  const gradientStyle = {
    background: `radial-gradient(circle at ${50 + scrollY * 0.05}% ${50 + scrollY * 0.03}%,
      rgb(${color1R},${color1G},${color1B}) 0%,
      rgb(${color2R},${color2G},${color2B}) 30%,
      ${base} 70%)`,
    transition: "background 0.5s ease-out",
  };

  const overlay1Style = {
    background: `linear-gradient(${135 + scrollY * 0.15}deg,
      rgba(${ov1.r},${ov1.g},${ov1.b},${overlayOpacity}) 0%,
      rgba(${ov2.r},${ov2.g},${ov2.b},${overlayOpacity * 0.8}) 50%,
      transparent 100%)`,
    transition: "background 0.5s ease-out",
  };

  const overlay2Style = {
    background: `radial-gradient(ellipse at ${30 + scrollY * 0.08}% ${70 - scrollY * 0.05}%,
      rgba(${ov2.r},${ov2.g},${ov2.b},${overlayOpacity * 0.5}) 0%,
      transparent 60%)`,
    transition: "background 0.5s ease-out",
  };

  return (
    <>
      <div className="fixed inset-0 -z-10" style={gradientStyle} />
      <div className="fixed inset-0 -z-10" style={overlay1Style} />
      <div className="fixed inset-0 -z-10" style={overlay2Style} />
    </>
  );
}
