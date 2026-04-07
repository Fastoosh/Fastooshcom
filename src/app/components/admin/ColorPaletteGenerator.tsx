import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X, Palette, RefreshCw, Check, Zap, ArrowRight, Sparkles, Type,
} from 'lucide-react';
import { Button } from '../ui/button';
import { SiteStyle } from '../../context/StyleContext';

/* ── Types ─────────────────────────────────────────────── */
interface GeneratedTheme extends Partial<SiteStyle> {
  themeName?: string;
  themeDescription?: string;
}

interface Props {
  activeMode: 'dark' | 'light';
  onApply: (style: GeneratedTheme, mode: 'current' | 'dark' | 'light' | 'both') => void;
  onClose: () => void;
}

/* ── Curated Premium Palettes ────────────────────────────── */
const CURATED_PALETTES = [
  {
    id: 'default',
    name: 'Fastoosh Original',
    emoji: '⚡',
    description: 'Electric purple & pink neon on deep black — signature Fastoosh energy',
    bgBase: '#000000',
    bgGrad1: '#0f0519',
    bgGrad2: '#1a0b2e',
    overlayColor1: '#8b5cf6',
    overlayColor2: '#3b82f6',
    gradSpeed: 'medium' as const,
    accentPrimary: '#7c3aed',
    accentSecondary: '#a855f7',
    accentGlow: '#ec4899',
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    headerBg: 'rgba(0,0,0,0.10)',
    footerBg: 'rgba(0,0,0,0.30)',
    cardBg: 'rgba(255,255,255,0.02)',
    cardDarkFill: 'rgba(0,0,0,0.95)',
    signinBg: 'rgba(255,255,255,0.05)',
    navText: 'rgba(255,255,255,0.70)',
    headingFont: 'Space Grotesk',
    bodyFont: 'Inter',
  },
  {
    id: 'cyberpunk',
    name: 'Cyberpunk Cyan',
    emoji: '🌆',
    description: 'Electric cyan & magenta on pure black — futuristic tech aesthetic',
    bgBase: '#000000',
    bgGrad1: '#001a1f',
    bgGrad2: '#0a1628',
    overlayColor1: '#06b6d4',
    overlayColor2: '#0891b2',
    gradSpeed: 'fast' as const,
    accentPrimary: '#00d9ff',
    accentSecondary: '#06b6d4',
    accentGlow: '#ff00aa',
    textPrimary: '#ffffff',
    textSecondary: '#94a3b8',
    headerBg: 'rgba(0,0,0,0.15)',
    footerBg: 'rgba(0,0,0,0.35)',
    cardBg: 'rgba(0,217,255,0.03)',
    cardDarkFill: 'rgba(0,0,0,0.95)',
    signinBg: 'rgba(0,217,255,0.08)',
    navText: 'rgba(255,255,255,0.70)',
    headingFont: 'Orbitron',
    bodyFont: 'Inter',
  },
  {
    id: 'emerald',
    name: 'Matrix Emerald',
    emoji: '💚',
    description: 'Vivid emerald & lime on midnight black — matrix hacker energy',
    bgBase: '#000000',
    bgGrad1: '#001a0f',
    bgGrad2: '#051a0f',
    overlayColor1: '#10b981',
    overlayColor2: '#059669',
    gradSpeed: 'medium' as const,
    accentPrimary: '#10b981',
    accentSecondary: '#34d399',
    accentGlow: '#84cc16',
    textPrimary: '#ffffff',
    textSecondary: '#a1a1aa',
    headerBg: 'rgba(0,0,0,0.12)',
    footerBg: 'rgba(0,0,0,0.32)',
    cardBg: 'rgba(16,185,129,0.03)',
    cardDarkFill: 'rgba(0,0,0,0.95)',
    signinBg: 'rgba(16,185,129,0.08)',
    navText: 'rgba(255,255,255,0.70)',
    headingFont: 'Outfit',
    bodyFont: 'Inter',
  },
  {
    id: 'luxury',
    name: 'Dark Luxury',
    emoji: '👑',
    description: 'Rich gold & amber on deep navy — sophisticated and elegant',
    bgBase: '#0a0a14',
    bgGrad1: '#0f1420',
    bgGrad2: '#1a1f35',
    overlayColor1: '#f59e0b',
    overlayColor2: '#d97706',
    gradSpeed: 'slow' as const,
    accentPrimary: '#f59e0b',
    accentSecondary: '#fbbf24',
    accentGlow: '#d97706',
    textPrimary: '#ffffff',
    textSecondary: '#94a3b8',
    headerBg: 'rgba(10,10,20,0.15)',
    footerBg: 'rgba(10,10,20,0.40)',
    cardBg: 'rgba(245,158,11,0.03)',
    cardDarkFill: 'rgba(10,10,20,0.95)',
    signinBg: 'rgba(245,158,11,0.08)',
    navText: 'rgba(255,255,255,0.70)',
    headingFont: 'Playfair Display',
    bodyFont: 'Inter',
  },
  {
    id: 'ocean',
    name: 'Deep Ocean',
    emoji: '🌊',
    description: 'Cerulean blue & electric teal on dark navy — bioluminescent vibes',
    bgBase: '#020617',
    bgGrad1: '#0c1629',
    bgGrad2: '#0f172a',
    overlayColor1: '#3b82f6',
    overlayColor2: '#14b8a6',
    gradSpeed: 'medium' as const,
    accentPrimary: '#3b82f6',
    accentSecondary: '#60a5fa',
    accentGlow: '#14b8a6',
    textPrimary: '#ffffff',
    textSecondary: '#cbd5e1',
    headerBg: 'rgba(2,6,23,0.15)',
    footerBg: 'rgba(2,6,23,0.40)',
    cardBg: 'rgba(59,130,246,0.03)',
    cardDarkFill: 'rgba(2,6,23,0.95)',
    signinBg: 'rgba(59,130,246,0.08)',
    navText: 'rgba(255,255,255,0.70)',
    headingFont: 'Montserrat',
    bodyFont: 'Inter',
  },
  {
    id: 'volcanic',
    name: 'Volcanic Fire',
    emoji: '🔥',
    description: 'Blazing orange & crimson on pure black — intense dramatic motion',
    bgBase: '#000000',
    bgGrad1: '#1a0500',
    bgGrad2: '#2d0a00',
    overlayColor1: '#f97316',
    overlayColor2: '#ef4444',
    gradSpeed: 'fast' as const,
    accentPrimary: '#f97316',
    accentSecondary: '#fb923c',
    accentGlow: '#ef4444',
    textPrimary: '#ffffff',
    textSecondary: '#d4d4d8',
    headerBg: 'rgba(0,0,0,0.15)',
    footerBg: 'rgba(0,0,0,0.40)',
    cardBg: 'rgba(249,115,22,0.03)',
    cardDarkFill: 'rgba(0,0,0,0.95)',
    signinBg: 'rgba(249,115,22,0.08)',
    navText: 'rgba(255,255,255,0.70)',
    headingFont: 'Rajdhani',
    bodyFont: 'Inter',
  },
  {
    id: 'aurora',
    name: 'Aurora Borealis',
    emoji: '🌌',
    description: 'Teal green & electric violet on arctic night — northern lights magic',
    bgBase: '#0a0a18',
    bgGrad1: '#0f1528',
    bgGrad2: '#1a1f3a',
    overlayColor1: '#14b8a6',
    overlayColor2: '#a855f7',
    gradSpeed: 'slow' as const,
    accentPrimary: '#14b8a6',
    accentSecondary: '#2dd4bf',
    accentGlow: '#a855f7',
    textPrimary: '#ffffff',
    textSecondary: '#cbd5e1',
    headerBg: 'rgba(10,10,24,0.15)',
    footerBg: 'rgba(10,10,24,0.40)',
    cardBg: 'rgba(20,184,166,0.03)',
    cardDarkFill: 'rgba(10,10,24,0.95)',
    signinBg: 'rgba(20,184,166,0.08)',
    navText: 'rgba(255,255,255,0.70)',
    headingFont: 'Poppins',
    bodyFont: 'Inter',
  },
  {
    id: 'sakura',
    name: 'Sakura Night',
    emoji: '🌸',
    description: 'Rose pink & soft magenta on dark charcoal — dreamy and romantic',
    bgBase: '#18181b',
    bgGrad1: '#1f1923',
    bgGrad2: '#27182e',
    overlayColor1: '#ec4899',
    overlayColor2: '#d946ef',
    gradSpeed: 'slow' as const,
    accentPrimary: '#ec4899',
    accentSecondary: '#f472b6',
    accentGlow: '#d946ef',
    textPrimary: '#ffffff',
    textSecondary: '#d4d4d8',
    headerBg: 'rgba(24,24,27,0.15)',
    footerBg: 'rgba(24,24,27,0.40)',
    cardBg: 'rgba(236,72,153,0.03)',
    cardDarkFill: 'rgba(24,24,27,0.95)',
    signinBg: 'rgba(236,72,153,0.08)',
    navText: 'rgba(255,255,255,0.70)',
    headingFont: 'Quicksand',
    bodyFont: 'Inter',
  },
  {
    id: 'arctic',
    name: 'Arctic Crystal',
    emoji: '❄️',
    description: 'Icy blue & pale silver on deep navy — crisp minimal cold',
    bgBase: '#0f172a',
    bgGrad1: '#1e293b',
    bgGrad2: '#334155',
    overlayColor1: '#38bdf8',
    overlayColor2: '#7dd3fc',
    gradSpeed: 'slow' as const,
    accentPrimary: '#38bdf8',
    accentSecondary: '#7dd3fc',
    accentGlow: '#94a3b8',
    textPrimary: '#ffffff',
    textSecondary: '#cbd5e1',
    headerBg: 'rgba(15,23,42,0.15)',
    footerBg: 'rgba(15,23,42,0.40)',
    cardBg: 'rgba(56,189,248,0.03)',
    cardDarkFill: 'rgba(15,23,42,0.95)',
    signinBg: 'rgba(56,189,248,0.08)',
    navText: 'rgba(255,255,255,0.70)',
    headingFont: 'Work Sans',
    bodyFont: 'Inter',
  },
  {
    id: 'crimson',
    name: 'Crimson Studio',
    emoji: '🩸',
    description: 'Vivid ruby red & deep rose on near-black — bold high-contrast drama',
    bgBase: '#0a0000',
    bgGrad1: '#1a0505',
    bgGrad2: '#2d0a0a',
    overlayColor1: '#dc2626',
    overlayColor2: '#ef4444',
    gradSpeed: 'medium' as const,
    accentPrimary: '#dc2626',
    accentSecondary: '#ef4444',
    accentGlow: '#f43f5e',
    textPrimary: '#ffffff',
    textSecondary: '#e5e5e5',
    headerBg: 'rgba(10,0,0,0.15)',
    footerBg: 'rgba(10,0,0,0.40)',
    cardBg: 'rgba(220,38,38,0.03)',
    cardDarkFill: 'rgba(10,0,0,0.95)',
    signinBg: 'rgba(220,38,38,0.08)',
    navText: 'rgba(255,255,255,0.70)',
    headingFont: 'Bebas Neue',
    bodyFont: 'Inter',
  },
];

/* ── Color theory generator ────────────────────────────── */
function generateRandomPalette(): GeneratedTheme {
  // Generate a base hue (0-360)
  const baseHue = Math.floor(Math.random() * 360);
  
  // Create analogous colors (close on color wheel)
  const hue1 = baseHue;
  const hue2 = (baseHue + 30) % 360;
  const hue3 = (baseHue + 150) % 360; // Split complementary
  
  // Premium backgrounds (very dark with slight color tint)
  const bgBase = `hsl(${baseHue}, 25%, 3%)`;
  const bgGrad1 = `hsl(${baseHue}, 35%, 6%)`;
  const bgGrad2 = `hsl(${baseHue}, 30%, 10%)`;
  
  // Overlay colors (for animated background)
  const overlayColor1 = `hsl(${hue1}, 75%, 65%)`;
  const overlayColor2 = `hsl(${hue2}, 70%, 60%)`;
  
  // Vibrant accents with high saturation
  const accentPrimary = `hsl(${hue1}, 85%, 58%)`;
  const accentSecondary = `hsl(${hue2}, 75%, 65%)`;
  const accentGlow = `hsl(${hue3}, 80%, 60%)`;
  
  // Text colors
  const textPrimary = '#ffffff';
  const textSecondary = '#a1a1aa';
  
  // Surface colors (rgba for glassmorphism)
  const headerBg = 'rgba(0,0,0,0.10)';
  const footerBg = 'rgba(0,0,0,0.30)';
  const cardBg = 'rgba(255,255,255,0.02)';
  const cardDarkFill = 'rgba(0,0,0,0.95)';
  const signinBg = 'rgba(255,255,255,0.05)';
  const navText = 'rgba(255,255,255,0.70)';
  
  // Gradient speed
  const speeds: Array<'slow' | 'medium' | 'fast'> = ['slow', 'medium', 'fast'];
  const gradSpeed = speeds[Math.floor(Math.random() * speeds.length)];
  
  // Font pairings - premium combinations
  const fontPairings = [
    // Modern Tech
    { heading: 'Space Grotesk', body: 'Inter' },
    { heading: 'Outfit', body: 'DM Sans' },
    { heading: 'Orbitron', body: 'Inter' },
    { heading: 'Rajdhani', body: 'Rubik' },
    { heading: 'Exo 2', body: 'Manrope' },
    { heading: 'Syne', body: 'Plus Jakarta Sans' },
    { heading: 'Audiowide', body: 'IBM Plex Sans' },
    // Classic Elegant
    { heading: 'Playfair Display', body: 'Lora' },
    { heading: 'Montserrat', body: 'Open Sans' },
    { heading: 'Cinzel', body: 'Crimson Text' },
    { heading: 'Cormorant Garamond', body: 'Merriweather' },
    // Bold Display
    { heading: 'Bebas Neue', body: 'Inter' },
    { heading: 'Russo One', body: 'Rubik' },
    { heading: 'Anton', body: 'Roboto' },
    // Geometric Clean
    { heading: 'Poppins', body: 'Nunito' },
    { heading: 'Quicksand', body: 'Inter' },
    { heading: 'Work Sans', body: 'Source Sans 3' },
    { heading: 'Raleway', body: 'Lato' },
  ];
  
  const fonts = fontPairings[Math.floor(Math.random() * fontPairings.length)];
  
  const colorNames = [
    'Midnight', 'Neon', 'Electric', 'Cyber', 'Cosmic', 'Quantum',
    'Prism', 'Voltage', 'Plasma', 'Aurora', 'Radiant', 'Spectrum'
  ];
  
  const themeName = `${colorNames[Math.floor(Math.random() * colorNames.length)]} ${
    ['Studio', 'Vision', 'Flow', 'Wave', 'Pulse'][Math.floor(Math.random() * 5)]
  }`;
  
  return {
    themeName,
    themeDescription: 'Harmoniously generated using split-complementary color theory',
    bgBase,
    bgGrad1,
    bgGrad2,
    overlayColor1,
    overlayColor2,
    gradSpeed,
    accentPrimary,
    accentSecondary,
    accentGlow,
    textPrimary,
    textSecondary,
    headerBg,
    footerBg,
    cardBg,
    cardDarkFill,
    signinBg,
    navText,
    headingFont: fonts.heading,
    bodyFont: fonts.body,
  };
}

/* ── Convert HSL to hex for display ─────────────────────── */
function hslToHex(hsl: string): string {
  const match = hsl.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
  if (!match) return hsl;
  
  const h = parseInt(match[1]);
  const s = parseInt(match[2]) / 100;
  const l = parseInt(match[3]) / 100;
  
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  
  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  
  const toHex = (n: number) => {
    const hex = Math.round((n + m) * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };
  
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

/* ── Colour swatch ──────────────────────────────────────── */
function Swatch({ color, label }: { color: string; label?: string }) {
  const displayColor = color.startsWith('hsl') ? hslToHex(color) : color;
  
  // Check if color is very dark (for background colors)
  const isDark = (() => {
    const hex = displayColor.replace('#', '');
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const brightness = (r * 299 + g * 587 + b * 114) / 1000;
    return brightness < 30; // Very dark threshold
  })();
  
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative">
        {/* Light backdrop for dark colors */}
        {isDark && (
          <div className="absolute inset-0 rounded-lg bg-white/20 -m-0.5" />
        )}
        <div
          className="relative w-10 h-10 rounded-lg border shadow-lg"
          style={{ 
            background: color, 
            boxShadow: `0 0 12px ${color}60`,
            borderColor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)'
          }}
        />
      </div>
      {label && (
        <>
          <span className="text-[9px] text-white/35 font-mono">{label}</span>
          <span className="text-[8px] text-white/20 font-mono">{displayColor}</span>
        </>
      )}
    </div>
  );
}

/* ── Palette preview card ───────────────────────────────── */
function ThemePreview({ theme }: { theme: GeneratedTheme }) {
  const bg    = theme.bgBase    ?? '#000000';
  const g1    = theme.bgGrad1   ?? '#0f0519';
  const g2    = theme.bgGrad2   ?? '#05050f';
  const o1    = theme.overlayColor1 ?? '#8b5cf6';
  const o2    = theme.overlayColor2 ?? '#3b82f6';
  const speed = theme.gradSpeed ?? 'medium';
  const p     = theme.accentPrimary   ?? '#7c3aed';
  const s     = theme.accentSecondary ?? '#a855f7';
  const g     = theme.accentGlow      ?? '#ec4899';
  const text  = theme.textPrimary     ?? '#ffffff';
  const hFont = theme.headingFont     ?? 'Inter';
  const bFont = theme.bodyFont        ?? 'Inter';

  // Animation duration based on speed
  const duration = speed === 'slow' ? '30s' : speed === 'medium' ? '20s' : '12s';

  return (
    <div className="rounded-2xl overflow-hidden border border-white/10 bg-white/3 relative">
      {/* Animated background gradient preview */}
      <div
        className="absolute inset-0 opacity-60"
        style={{
          background: `radial-gradient(ellipse 80% 50% at 50% -20%, ${g1}, ${bg})`,
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: `
              radial-gradient(ellipse 100% 100% at 120% 50%, ${o1}20 0%, transparent 50%),
              radial-gradient(ellipse 100% 100% at -20% 50%, ${o2}20 0%, transparent 50%)
            `,
            animation: `gradientMove ${duration} ease-in-out infinite`,
          }}
        />
      </div>

      {/* Simulated site header */}
      <div
        className="relative px-4 py-3 flex items-center justify-between border-b border-white/8"
        style={{
          background: `linear-gradient(135deg, ${g1}cc 0%, ${bg}dd 60%)`,
          backdropFilter: 'blur(12px)',
        }}
      >
        {/* Gradient accent line */}
        <div
          className="absolute bottom-0 left-0 right-0 h-px"
          style={{ background: `linear-gradient(to right, ${p}, ${s}, ${g})` }}
        />
        <span className="font-bold text-sm tracking-tight" style={{ color: text, fontFamily: `'${hFont}', sans-serif` }}>
          Fastoosh
        </span>
        <div className="flex items-center gap-3">
          {['Projects', 'Tools', 'About'].map(n => (
            <span key={n} className="text-[11px]" style={{ color: text, opacity: 0.6, fontFamily: `'${bFont}', sans-serif` }}>{n}</span>
          ))}
          <span
            className="text-[11px] font-semibold px-2.5 py-1 rounded-lg text-white"
            style={{ background: `linear-gradient(135deg, ${p}, ${g})` }}
          >
            Work with us
          </span>
        </div>
      </div>

      {/* Simulated hero section */}
      <div
        className="relative px-4 py-5"
        style={{
          background: `radial-gradient(ellipse at 30% 50%, ${g1}ee 0%, transparent 70%)`,
        }}
      >
        <div
          className="text-xs font-semibold mb-1 px-2 py-0.5 rounded-full border w-fit"
          style={{ color: p, borderColor: `${p}40`, background: `${p}15` }}
        >
          Premium Motion Design
        </div>
        <h2
          className="text-lg font-bold mt-2"
          style={{ color: text, fontFamily: `'${hFont}', sans-serif` }}
        >
          We craft stunning visuals
        </h2>
        <p
          className="text-[11px] mt-1 leading-relaxed"
          style={{ color: text, opacity: 0.5, fontFamily: `'${bFont}', sans-serif` }}
        >
          Award-winning motion design studio creating bold, high-impact animations.
        </p>
        <div className="flex items-center gap-2 mt-3">
          <button
            className="text-[11px] font-semibold px-3 py-1.5 rounded-lg text-white"
            style={{ background: `linear-gradient(135deg, ${p}, ${s})` }}
          >
            View Projects
          </button>
          <button
            className="text-[11px] font-medium px-3 py-1.5 rounded-lg"
            style={{ color: p, border: `1px solid ${p}40`, background: `${p}10` }}
          >
            Learn more →
          </button>
        </div>
      </div>

      {/* Accent color strip */}
      <div className="relative h-1" style={{ background: `linear-gradient(to right, ${p}, ${s}, ${g})` }} />

      {/* Stats row */}
      <div
        className="relative px-4 py-2.5 grid grid-cols-3 gap-2 border-t border-white/6"
        style={{ background: bg }}
      >
        {[{ label: 'Projects', val: '200+', color: p }, { label: 'Clients', val: '80+', color: s }, { label: 'Awards', val: '15', color: g }].map(item => (
          <div key={item.label} className="text-center">
            <div className="text-sm font-bold" style={{ color: item.color, fontFamily: `'${hFont}', sans-serif` }}>{item.val}</div>
            <div className="text-[9px]" style={{ color: text, opacity: 0.35, fontFamily: `'${bFont}', sans-serif` }}>{item.label}</div>
          </div>
        ))}
      </div>

      {/* Add keyframes for animation */}
      <style>{`
        @keyframes gradientMove {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(10%, 5%) scale(1.1); }
          66% { transform: translate(-10%, -5%) scale(0.95); }
        }
      `}</style>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────── */
export function ColorPaletteGenerator({ activeMode, onApply, onClose }: Props) {
  const [selectedPalette, setSelectedPalette] = useState<GeneratedTheme | null>(null);
  const [applyMode, setApplyMode] = useState<'current' | 'dark' | 'light' | 'both'>('current');
  const [applied, setApplied] = useState(false);

  const handleSelectCurated = (palette: typeof CURATED_PALETTES[0]) => {
    setSelectedPalette({ ...palette });
  };

  const handleGenerateRandom = () => {
    const randomPalette = generateRandomPalette();
    setSelectedPalette(randomPalette);
  };

  const handleApply = () => {
    if (!selectedPalette) return;
    onApply(selectedPalette, applyMode);
    setApplied(true);
    setTimeout(() => setApplied(false), 2000);
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] flex items-start justify-center overflow-y-auto py-6 px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
      >
        {/* Backdrop */}
        <motion.div
          className="fixed inset-0 bg-black/80 backdrop-blur-md"
          onClick={onClose}
        />

        {/* Panel */}
        <motion.div
          className="relative z-10 w-full max-w-4xl"
          initial={{ opacity: 0, y: 24, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 16, scale: 0.98 }}
          transition={{ type: 'spring', damping: 28, stiffness: 340 }}
        >
          {/* Card */}
          <div
            className="rounded-2xl border border-white/10 overflow-hidden"
            style={{
              background: 'linear-gradient(145deg, rgba(15,5,25,0.98) 0%, rgba(3,3,12,0.99) 100%)',
              boxShadow: '0 24px 80px rgba(0,0,0,0.8), 0 0 0 1px rgba(139,92,246,0.15)',
            }}
          >
            {/* Header */}
            <div className="px-6 pt-5 pb-4 border-b border-white/8 flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-600/30 to-purple-600/20 border border-violet-500/30 flex items-center justify-center flex-shrink-0">
                  <Palette className="w-4.5 h-4.5 text-violet-400" />
                </div>
                <div>
                  <h2 className="text-white font-bold text-base">Color Palette Generator</h2>
                  <p className="text-white/40 text-xs mt-0.5">
                    Choose from curated palettes or generate random harmonious combinations
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-white/50 hover:text-white transition-all flex-shrink-0 mt-0.5"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-6 space-y-5">

              {/* ── Curated Palettes ── */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="block text-white/60 text-xs font-semibold uppercase tracking-wider">
                    Curated Premium Palettes
                  </label>
                  <span className="text-white/25 text-[10px]">
                    {CURATED_PALETTES.length} professional palettes
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
                  {CURATED_PALETTES.map(palette => (
                    <button
                      key={palette.id}
                      onClick={() => handleSelectCurated(palette)}
                      className={`group relative flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${
                        selectedPalette?.id === palette.id || selectedPalette?.name === palette.name
                          ? 'bg-violet-500/20 border-violet-500/50 scale-[1.02]'
                          : 'bg-white/4 hover:bg-white/8 border-white/8 hover:border-white/16'
                      }`}
                    >
                      <span className="text-2xl leading-none">{palette.emoji}</span>
                      <span className="text-white/70 group-hover:text-white/90 text-[10px] font-medium text-center leading-tight">
                        {palette.name}
                      </span>
                      {/* Color dots preview */}
                      <div className="flex items-center gap-1">
                        {[palette.accentPrimary, palette.accentSecondary, palette.accentGlow].map((c, i) => (
                          <div
                            key={i}
                            className="w-2 h-2 rounded-full border border-white/10"
                            style={{ background: c }}
                          />
                        ))}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Random Generator ── */}
              <div className="rounded-xl border border-white/8 bg-white/3 p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-violet-400" />
                    <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">
                      Generate Random
                    </span>
                  </div>
                  <Button
                    onClick={handleGenerateRandom}
                    className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-fuchsia-500 text-white text-xs h-8 px-3 border-0 shadow-lg shadow-violet-900/40"
                  >
                    <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                    Generate New
                  </Button>
                </div>
                <p className="text-white/35 text-[10px] leading-relaxed">
                  Creates harmonious palettes using split-complementary color theory with high-contrast premium aesthetics
                </p>
              </div>

              {/* ── Selected Palette Preview ── */}
              <AnimatePresence>
                {selectedPalette && (
                  <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                    className="space-y-4"
                  >
                    {/* Theme name + description */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Palette className="w-4 h-4 text-violet-400" />
                          <h3 className="text-white font-bold text-sm">{selectedPalette.themeName ?? selectedPalette.name ?? 'Selected Palette'}</h3>
                        </div>
                        {(selectedPalette.themeDescription || selectedPalette.description) && (
                          <p className="text-white/45 text-xs mt-1 leading-relaxed">
                            {selectedPalette.themeDescription ?? selectedPalette.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Site preview */}
                    <ThemePreview theme={selectedPalette} />

                    {/* Color chips row */}
                    <div className="rounded-xl border border-white/8 bg-white/3 p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Palette className="w-3.5 h-3.5 text-violet-400" />
                        <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">Color Palette</span>
                      </div>
                      <div className="flex items-center gap-4 flex-wrap">
                        {[
                          { color: selectedPalette.accentPrimary,   label: 'Primary'   },
                          { color: selectedPalette.accentSecondary, label: 'Secondary' },
                          { color: selectedPalette.accentGlow,      label: 'Glow'      },
                          { color: selectedPalette.bgBase,          label: 'BG Base'   },
                          { color: selectedPalette.bgGrad1,         label: 'Grad 1'    },
                          { color: selectedPalette.bgGrad2,         label: 'Grad 2'    },
                        ].filter(c => c.color).map(item => (
                          <Swatch key={item.label} color={item.color!} label={item.label} />
                        ))}
                      </div>
                    </div>

                    {/* Typography row */}
                    {(selectedPalette.headingFont || selectedPalette.bodyFont) && (
                      <div className="rounded-xl border border-white/8 bg-white/3 p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Type className="w-3.5 h-3.5 text-violet-400" />
                          <span className="text-white/60 text-xs font-semibold uppercase tracking-wider">Typography Pairing</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-white/35 text-[10px] mb-1 uppercase tracking-wider">Heading</p>
                            <p
                              className="text-white font-bold text-xl leading-tight"
                              style={{ fontFamily: `'${selectedPalette.headingFont}', sans-serif` }}
                            >
                              {selectedPalette.headingFont}
                            </p>
                            <p
                              className="text-white/50 text-sm mt-0.5"
                              style={{ fontFamily: `'${selectedPalette.headingFont}', sans-serif` }}
                            >
                              ABCDEFG 0123
                            </p>
                          </div>
                          <div>
                            <p className="text-white/35 text-[10px] mb-1 uppercase tracking-wider">Body</p>
                            <p
                              className="text-white/80 font-semibold text-base"
                              style={{ fontFamily: `'${selectedPalette.bodyFont}', sans-serif` }}
                            >
                              {selectedPalette.bodyFont}
                            </p>
                            <p
                              className="text-white/40 text-sm mt-0.5 leading-relaxed"
                              style={{ fontFamily: `'${selectedPalette.bodyFont}', sans-serif` }}
                            >
                              The quick brown fox jumps
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Apply controls */}
                    <div className="rounded-xl border border-violet-500/20 bg-violet-500/5 p-4">
                      <p className="text-white/60 text-xs font-semibold mb-3">Apply to…</p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                        {([
                          { value: 'current', label: `Current (${activeMode})` },
                          { value: 'dark',    label: 'Dark mode only' },
                          { value: 'light',   label: 'Light mode only' },
                          { value: 'both',    label: 'Both modes' },
                        ] as const).map(opt => (
                          <button
                            key={opt.value}
                            onClick={() => setApplyMode(opt.value)}
                            className={`px-2.5 py-2 rounded-lg text-xs font-medium text-center transition-all border ${
                              applyMode === opt.value
                                ? 'bg-violet-600/30 border-violet-500/50 text-violet-200'
                                : 'bg-white/4 border-white/8 text-white/50 hover:text-white/80 hover:bg-white/8'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                      <Button
                        onClick={handleApply}
                        className={`w-full text-white font-semibold h-11 text-sm border-0 shadow-lg transition-all ${
                          applied
                            ? 'bg-emerald-600 shadow-emerald-900/40'
                            : 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-fuchsia-500 shadow-violet-900/40'
                        }`}
                      >
                        {applied ? (
                          <>
                            <Check className="w-4 h-4 mr-2" />
                            Applied! Don't forget to Save in Style tab
                          </>
                        ) : (
                          <>
                            <Zap className="w-4 h-4 mr-2" />
                            Apply "{selectedPalette.themeName ?? selectedPalette.name}" → {applyMode === 'current' ? activeMode : applyMode} mode
                            <ArrowRight className="w-3.5 h-3.5 ml-auto" />
                          </>
                        )}
                      </Button>
                      {!applied && (
                        <p className="text-white/25 text-[10px] mt-2 text-center">
                          Applies to the draft — click Save in the Style tab to persist
                        </p>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-white/6 flex items-center justify-between gap-2">
              <p className="text-white/20 text-[10px]">
                Curated palettes follow color theory principles for premium aesthetics
              </p>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                <Palette className="w-3 h-3 text-violet-400/60" />
                <span className="text-violet-400/60 text-[10px]">Premium Design</span>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}