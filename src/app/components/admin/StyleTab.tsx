import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Save, RotateCcw, Palette, Type, Layers, CheckCircle,
  Loader2, Monitor, Moon, Sun, Signal, Eye,
  Upload, Trash2, Image as ImageIcon, Check, AlertCircle,
} from 'lucide-react';
import { ColorPaletteGenerator } from './ColorPaletteGenerator';
import { FontSelector } from './FontSelector';
import { GlassCard } from '../shared/GlassCard';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import {
  SiteStyle,
  DEFAULT_STYLE,
  LIGHT_STYLE,
  applyStyles,
  shadeHex,
  hexToRgb,
  useSiteStyle,
  getContrastColor,
  getContrastRatio,
} from '../../context/StyleContext';
import { useLogo } from '../../context/LogoContext';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

type Mode = 'dark' | 'light';

/* ── popular Google Fonts ─────────────────────────────── */
const HEADING_FONTS = [
  // Modern & Tech
  'Inter', 'Space Grotesk', 'Syne', 'Outfit', 'Orbitron',
  'Exo 2', 'Rajdhani', 'Bebas Neue', 'Audiowide', 'Electrolize',
  'Chakra Petch', 'Saira', 'Barlow', 'Michroma',
  // Classic & Elegant
  'Playfair Display', 'Montserrat', 'Cinzel', 'Cormorant Garamond',
  'Marcellus', 'Bodoni Moda', 'Libre Baskerville',
  // Bold & Display
  'Anton', 'Righteous', 'Russo One', 'Teko', 'Permanent Marker',
  'Black Ops One', 'Racing Sans One', 'Alfa Slab One',
  // Geometric & Clean
  'Poppins', 'Raleway', 'Quicksand', 'Work Sans', 'Josefin Sans',
  'Overpass', 'Urbanist', 'Red Hat Display',
  // Unique & Artistic
  'Abril Fatface', 'Passion One', 'Yellowtail', 'Pacifico',
  'Bungee', 'Monoton', 'Lobster', 'Fredoka',
];
const BODY_FONTS = [
  // Clean & Modern
  'Inter', 'DM Sans', 'Outfit', 'Plus Jakarta Sans', 'Nunito',
  'Manrope', 'Rubik', 'Space Grotesk', 'IBM Plex Sans', 'Karla',
  // Professional
  'Open Sans', 'Lato', 'Source Sans 3', 'Roboto', 'Noto Sans',
  'Public Sans', 'Archivo', 'Red Hat Text', 'Barlow',
  // Friendly & Approachable
  'Poppins', 'Quicksand', 'Nunito Sans', 'Raleway', 'Cabin',
  'Mulish', 'Hind', 'Sora', 'Figtree',
  // Elegant
  'Lora', 'Merriweather', 'Crimson Text', 'EB Garamond',
  'Spectral', 'Vollkorn', 'Cormorant', 'Cardo',
];

/* ── font load indicator ──────────────────────────────── */
function FontLoadIndicator({ fontName }: { fontName: string }) {
  const [loadState, setLoadState] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [isCustom, setIsCustom] = useState(false);

  useEffect(() => {
    if (!fontName) {
      setLoadState('loaded');
      return;
    }

    // Check if it's a preset font
    const isPreset = [...HEADING_FONTS, ...BODY_FONTS].includes(fontName);
    setIsCustom(!isPreset);

    // Simple font load detection using document.fonts API
    setLoadState('loading');
    
    // Try to load the font
    const timeoutId = setTimeout(() => {
      // After 2 seconds, check if font loaded
      if (document.fonts && document.fonts.check) {
        try {
          const loaded = document.fonts.check(`16px "${fontName}"`);
          setLoadState(loaded ? 'loaded' : 'error');
        } catch {
          setLoadState('loaded'); // Assume it worked if check fails
        }
      } else {
        setLoadState('loaded'); // No API support, assume it worked
      }
    }, 2000);

    return () => clearTimeout(timeoutId);
  }, [fontName]);

  if (!isCustom && loadState === 'loaded') {
    return null; // Don't show indicator for preset fonts
  }

  return (
    <div className="flex items-center gap-1.5 mt-1">
      {loadState === 'loading' && (
        <>
          <Loader2 className="w-3 h-3 text-violet-400 animate-spin" />
          <span className="text-violet-400/80 text-[10px]">Loading font...</span>
        </>
      )}
      {loadState === 'loaded' && isCustom && (
        <>
          <Check className="w-3 h-3 text-emerald-400" />
          <span className="text-emerald-400/80 text-[10px]">Custom font loaded ✓</span>
        </>
      )}
      {loadState === 'error' && (
        <>
          <AlertCircle className="w-3 h-3 text-amber-400" />
          <span className="text-amber-400/80 text-[10px]">Font may not exist — check spelling</span>
        </>
      )}
    </div>
  );
}

/* ── colour picker control ────────────────────────────── */
function ColorField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const [text, setText] = useState(value);
  useEffect(() => { setText(value); }, [value]);

  const commit = (raw: string) => {
    const v = raw.startsWith('#') ? raw : '#' + raw;
    if (/^#[0-9a-fA-F]{6}$/.test(v)) onChange(v);
  };

  return (
    <div className="flex items-center gap-3">
      <label className="relative cursor-pointer flex-shrink-0">
        <input
          type="color"
          value={value}
          onChange={e => { setText(e.target.value); onChange(e.target.value); }}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
        />
        <div
          className="w-9 h-9 rounded-lg border-2 border-white/20 shadow-lg transition-transform hover:scale-110"
          style={{ background: value }}
        />
      </label>
      <div className="flex-1">
        <p className="text-white/80 text-sm font-medium leading-none mb-1">{label}</p>
        {hint && <p className="text-white/30 text-xs">{hint}</p>}
      </div>
      <input
        type="text"
        value={text}
        onChange={e => setText(e.target.value)}
        onBlur={e => commit(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter') commit((e.target as HTMLInputElement).value); }}
        maxLength={7}
        className="w-24 bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-white/80
          font-mono text-xs text-center focus:outline-none focus:border-purple-400/60
          focus:ring-1 focus:ring-purple-500/30 transition-colors"
      />
    </div>
  );
}

/* ── speed pill ───────────────────────────────────────── */
function SpeedPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
        active
          ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30'
          : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70'
      }`}
    >
      {label}
    </button>
  );
}



/* ── live preview strip ───────────────────────────────── */
function PreviewStrip({ style }: { style: SiteStyle }) {
  const rgb1 = hexToRgb(style.bgGrad1) ?? { r: 15, g: 5, b: 25 };
  const rgb2 = hexToRgb(style.bgGrad2) ?? { r: 5, g: 5, b: 15 };
  const ov1  = hexToRgb(style.overlayColor1) ?? { r: 139, g: 92, b: 246 };

  // WCAG-compliant text colour for the preview background
  const previewTextColor = getContrastColor(style.bgBase);

  return (
    <div className="rounded-xl overflow-hidden border border-white/10">
      <div
        className="h-14 w-full relative"
        style={{
          background: `radial-gradient(ellipse at 40% 50%,
            rgb(${rgb1.r},${rgb1.g},${rgb1.b}) 0%,
            rgb(${rgb2.r},${rgb2.g},${rgb2.b}) 45%,
            ${style.bgBase} 100%)`,
        }}
      >
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(135deg,
              rgba(${ov1.r},${ov1.g},${ov1.b},0.18) 0%,
              transparent 70%)`,
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center gap-3">
          {[style.accentPrimary, style.accentSecondary, style.accentGlow].map((c, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className="w-5 h-5 rounded-full shadow-lg"
                style={{ background: c, boxShadow: `0 0 12px ${c}80` }}
              />
            </div>
          ))}
          <div className="ml-4">
            <p
              className="text-sm font-bold leading-none"
              style={{
                fontFamily: `'${style.headingFont}', sans-serif`,
                color: previewTextColor,
              }}
            >
              Fastoosh
            </p>
            <p
              className="text-[10px] mt-0.5"
              style={{
                fontFamily: `'${style.bodyFont}', sans-serif`,
                color: previewTextColor,
                opacity: 0.55,
              }}
            >
              Motion Design Studio
            </p>
          </div>
        </div>
      </div>
      <div
        className="h-2 w-full"
        style={{
          background: `linear-gradient(to right, ${style.accentPrimary}, ${style.accentSecondary}, ${style.accentGlow})`,
        }}
      />
    </div>
  );
}

/* ── section header ───────────────────────────────────── */
function SectionHeader({ icon, title, subtitle }: { icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0 text-purple-400">
        {icon}
      </div>
      <div>
        <h3 className="text-white font-semibold text-sm">{title}</h3>
        <p className="text-white/40 text-xs mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

/* ── mode toggle ──────────────────────────────────────── */
function ModeToggle({
  activeMode,
  onChange,
}: {
  activeMode: Mode;
  onChange: (m: Mode) => void;
}) {
  return (
    <div className="flex items-center gap-1 p-1 rounded-xl bg-white/5 border border-white/8 w-fit">
      {(['dark', 'light'] as Mode[]).map(m => {
        const isDark = m === 'dark';
        const isActive = activeMode === m;
        return (
          <button
            key={m}
            onClick={() => onChange(m)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              isActive
                ? isDark
                  ? 'bg-[#1a0f2e] text-purple-200 border border-purple-500/30 shadow-lg shadow-purple-900/40'
                  : 'bg-white text-violet-700 border border-violet-200 shadow-lg shadow-violet-100/40'
                : 'text-white/40 hover:text-white/70'
            }`}
          >
            {isDark
              ? <Moon className={`w-3.5 h-3.5 ${isActive ? 'text-purple-300' : ''}`} />
              : <Sun  className={`w-3.5 h-3.5 ${isActive ? 'text-amber-400' : ''}`} />
            }
            {isDark ? 'Dark' : 'Light'}
          </button>
        );
      })}
    </div>
  );
}

/* ── text colour card ─────────────────────────────────── */
function WcagBadge({ ratio }: { ratio: number }) {
  const level =
    ratio >= 7   ? { label: 'AAA', color: 'text-emerald-300 bg-emerald-500/15 border-emerald-500/30' } :
    ratio >= 4.5 ? { label: 'AA',  color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/25' } :
    ratio >= 3   ? { label: 'AA·L',color: 'text-amber-300   bg-amber-500/15   border-amber-500/30'   } :
                   { label: 'Fail', color: 'text-red-400    bg-red-500/15     border-red-500/30'      };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${level.color}`}>
      {level.label} · {ratio.toFixed(1)}:1
    </span>
  );
}

/* ── rgba colour helpers ──────────────────────────────── */
function parseRgba(s: string): { hex: string; alpha: number } {
  // 'rgba(r,g,b,a)' or 'rgb(r,g,b)'
  const m = s.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\s*\)/);
  if (m) {
    const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
    const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('');
    return { hex, alpha: m[4] !== undefined ? parseFloat(m[4]) : 1 };
  }
  // plain 6-char hex
  if (/^#[0-9a-fA-F]{6}$/.test(s)) return { hex: s, alpha: 1 };
  return { hex: '#000000', alpha: 0.1 };
}

function toRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return `rgba(0,0,0,${alpha})`;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${parseFloat(alpha.toFixed(2))})`;
}

/* ── color + opacity picker ───────────────────────────── */
function ColorAlphaField({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (v: string) => void;
}) {
  const { hex, alpha } = parseRgba(value);
  const alphaPct = Math.round(alpha * 100);
  const { r, g, b } = (() => {
    const clean = hex.replace('#', '');
    return {
      r: parseInt(clean.slice(0, 2), 16) || 0,
      g: parseInt(clean.slice(2, 4), 16) || 0,
      b: parseInt(clean.slice(4, 6), 16) || 0,
    };
  })();

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {/* Colour swatch — opens native colour picker */}
        <label className="relative cursor-pointer flex-shrink-0">
          <input
            type="color"
            value={hex}
            onChange={e => onChange(toRgba(e.target.value, alpha))}
            className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
          />
          {/* checkerboard + solid overlay — shows translucency visually */}
          <div
            className="w-9 h-9 rounded-lg border-2 border-white/20 shadow-lg transition-transform hover:scale-110 overflow-hidden"
            style={{
              backgroundImage: `
                linear-gradient(45deg, #888 25%, transparent 25%),
                linear-gradient(-45deg, #888 25%, transparent 25%),
                linear-gradient(45deg, transparent 75%, #888 75%),
                linear-gradient(-45deg, transparent 75%, #888 75%)`,
              backgroundSize: '8px 8px',
              backgroundPosition: '0 0, 0 4px, 4px -4px, -4px 0px',
            }}
          >
            <div
              className="w-full h-full"
              style={{ backgroundColor: `rgba(${r},${g},${b},${alpha})` }}
            />
          </div>
        </label>

        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-white/80 text-sm font-medium truncate">{label}</span>
            <span className="text-white/40 text-xs font-mono ml-2 flex-shrink-0">{alphaPct}%</span>
          </div>
          {/* Opacity slider */}
          <div className="relative">
            {/* Track gradient */}
            <div
              className="absolute inset-y-0 inset-x-0 rounded-full h-1.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{
                backgroundImage: `
                  linear-gradient(45deg, #888 25%, transparent 25%),
                  linear-gradient(-45deg, #888 25%, transparent 25%),
                  linear-gradient(45deg, transparent 75%, #888 75%),
                  linear-gradient(-45deg, transparent 75%, #888 75%)`,
                backgroundSize: '6px 6px',
                backgroundPosition: '0 0, 0 3px, 3px -3px, -3px 0px',
              }}
            />
            <div
              className="absolute inset-0 rounded-full h-1.5 top-1/2 -translate-y-1/2 pointer-events-none"
              style={{ background: `linear-gradient(to right, rgba(${r},${g},${b},0), rgba(${r},${g},${b},1))` }}
            />
            <input
              type="range"
              min={0} max={100} step={1}
              value={alphaPct}
              onChange={e => onChange(toRgba(hex, parseInt(e.target.value) / 100))}
              className="relative w-full h-1.5 rounded-full appearance-none cursor-pointer bg-transparent"
              style={{
                WebkitAppearance: 'none',
              }}
            />
          </div>
        </div>
      </div>
      {hint && <p className="text-white/30 text-[10px] pl-12">{hint}</p>}
    </div>
  );
}

/* ── surfaces & chrome card ───────────────────────────── */
function SurfacesCard({
  draft,
  onChange,
}: {
  draft: SiteStyle;
  onChange: (patch: Partial<SiteStyle>) => void;
}) {
  // Live mini-preview: show how header / card / footer look in current draft
  const headerBg   = draft.headerBg   ?? 'rgba(0,0,0,0.10)';
  const footerBg   = draft.footerBg   ?? 'rgba(0,0,0,0.30)';
  const cardBg     = draft.cardBg     ?? 'rgba(255,255,255,0.02)';
  const cardDark   = draft.cardDarkFill ?? 'rgba(0,0,0,0.95)';
  const signinBg   = draft.signinBg   ?? 'rgba(255,255,255,0.05)';
  const accent     = draft.accentPrimary;
  const textColor  = draft.textPrimary ?? '#ffffff';

  return (
    <GlassCard className="p-5 lg:col-span-2">
      <SectionHeader
        icon={<Layers className="w-4 h-4" />}
        title="Surfaces &amp; Chrome"
        subtitle="Background tints for structural UI elements — use the opacity slider to control translucency"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* ── Pickers column ── */}
        <div className="space-y-5">
          <ColorAlphaField
            label="Header / Nav background"
            hint="Sticky navbar tint — keep opacity low for glass effect"
            value={headerBg}
            onChange={v => onChange({ headerBg: v })}
          />
          <ColorAlphaField
            label="Footer background"
            hint="Footer bar tint"
            value={footerBg}
            onChange={v => onChange({ footerBg: v })}
          />
          <ColorAlphaField
            label="Sign-in / User avatar button"
            hint="Background of the sign-in button and the logged-in user chip"
            value={signinBg}
            onChange={v => onChange({ signinBg: v })}
          />
          <ColorAlphaField
            label="Nav link text"
            hint="Colour of navigation links at rest — hover/active becomes fully opaque automatically"
            value={draft.navText ?? 'rgba(255,255,255,0.70)'}
            onChange={v => onChange({ navText: v })}
          />
          <ColorAlphaField
            label="Card surface (regular)"
            hint="Subtle glass tint on standard GlassCards (blog, features, stats…)"
            value={cardBg}
            onChange={v => onChange({ cardBg: v })}
          />
          <ColorAlphaField
            label="Glass card background"
            hint="Base fill color/opacity for all glass cards — project cards, pricing cards, video embeds"
            value={cardDark}
            onChange={v => onChange({ cardDarkFill: v })}
          />
        </div>

        {/* ── Live mini UI preview ── */}
        <div>
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">
            Live element preview
          </p>
          <div
            className="rounded-xl overflow-hidden border border-white/10 text-xs"
            style={{ background: draft.bgBase }}
          >
            {/* Simulated header */}
            <div
              className="px-3 py-2 flex items-center justify-between border-b border-white/8"
              style={{ backgroundColor: headerBg, backdropFilter: 'blur(12px)' }}
            >
              <span className="font-bold tracking-tight" style={{ color: textColor }}>Fastoosh</span>
              <div className="flex items-center gap-2">
                {['Home', 'Projects', 'Tools'].map(n => (
                  <span key={n} className="text-[10px]" style={{ color: draft.navText ?? 'rgba(255,255,255,0.70)' }}>{n}</span>
                ))}
                <span
                  className="text-[10px] px-2 py-0.5 rounded-md border border-white/10"
                  style={{ backgroundColor: signinBg, color: draft.navText ?? 'rgba(255,255,255,0.70)', opacity: 0.8 }}
                >
                  Sign in
                </span>
                <span
                  className="text-[10px] px-2 py-0.5 rounded-md font-semibold text-white"
                  style={{ background: `linear-gradient(to right, ${accent}, ${draft.accentSecondary})` }}
                >
                  Work with us
                </span>
              </div>
            </div>

            {/* Simulated card row */}
            <div className="p-3 grid grid-cols-2 gap-2">
              {/* Regular card */}
              <div
                className="rounded-lg p-2.5 border border-white/8"
                style={{ backgroundColor: cardBg }}
              >
                <div
                  className="w-full h-8 rounded mb-2"
                  style={{ background: `linear-gradient(135deg, ${draft.accentPrimary}40, ${draft.accentGlow}30)` }}
                />
                <p className="font-semibold text-[10px]" style={{ color: textColor }}>Regular card</p>
                <p className="text-[9px] mt-0.5" style={{ color: textColor, opacity: 0.55 }}>Standard GlassCard surface</p>
              </div>

              {/* Neon-border card */}
              <div
                className="rounded-lg p-2.5 border-2"
                style={{
                  backgroundColor: cardDark,
                  borderImage: `linear-gradient(135deg, ${accent}, ${draft.accentGlow}) 1`,
                  borderColor: accent,
                }}
              >
                <div
                  className="w-full h-8 rounded mb-2"
                  style={{ background: `linear-gradient(135deg, ${draft.accentPrimary}60, ${draft.accentGlow}40)` }}
                />
                <p className="font-semibold text-[10px]" style={{ color: textColor }}>Neon card</p>
                <p className="text-[9px] mt-0.5" style={{ color: textColor, opacity: 0.55 }}>NeonBorder fill</p>
              </div>
            </div>

            {/* Simulated footer */}
            <div
              className="px-3 py-2 border-t border-white/8 flex items-center justify-between"
              style={{ backgroundColor: footerBg }}
            >
              <span style={{ color: textColor, opacity: 0.4 }} className="text-[9px]">© 2026 Fastoosh</span>
              <span style={{ color: textColor, opacity: 0.4 }} className="text-[9px]">Remote worldwide</span>
            </div>
          </div>
          <p className="text-white/25 text-[10px] mt-2">
            All values use RGBA — the opacity slider controls translucency so the gradient background shows through.
          </p>
        </div>
      </div>
    </GlassCard>
  );
}

/* ── text colour card ─────────────────────────────────── */
function TextColorCard({
  draft,
  onChange,
}: {
  draft: SiteStyle;
  onChange: (patch: Partial<SiteStyle>) => void;
}) {
  const textColor  = draft.textPrimary || '#ffffff';
  const bgBase     = draft.bgBase      || '#000000';
  const ratio      = getContrastRatio(bgBase, textColor);
  const suggested  = getContrastColor(bgBase);

  // opacity-derived text samples
  const txtRgb = (() => {
    const m = textColor.replace('#','').match(/.{2}/g);
    if (!m) return null;
    return { r: parseInt(m[0],16), g: parseInt(m[1],16), b: parseInt(m[2],16) };
  })();

  return (
    <GlassCard className="p-5 lg:col-span-2">
      <SectionHeader
        icon={<Eye className="w-4 h-4" />}
        title="Text Colour"
        subtitle="Sets the default body-text colour for the whole site — opacity variants (60%, 40%…) are derived automatically"
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
        {/* ── Picker + WCAG meter ── */}
        <div className="space-y-4">
          <ColorField
            label="Primary Text"
            hint="maps to text-white / text-white/60 / text-white/40 across all pages"
            value={textColor}
            onChange={v => onChange({ textPrimary: v })}
          />

          {/* contrast ratio live badge */}
          <div className="flex items-center gap-3 pl-12">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-white/40 text-xs">vs. background</span>
                <WcagBadge ratio={ratio} />
              </div>
              {/* contrast bar */}
              <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    ratio >= 7   ? 'bg-emerald-400' :
                    ratio >= 4.5 ? 'bg-emerald-500' :
                    ratio >= 3   ? 'bg-amber-400'   : 'bg-red-500'
                  }`}
                  style={{ width: `${Math.min((ratio / 21) * 100, 100)}%` }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-white/20 text-[9px]">1:1</span>
                <span className="text-white/20 text-[9px]">AA 4.5</span>
                <span className="text-white/20 text-[9px]">AAA 7</span>
                <span className="text-white/20 text-[9px]">21:1</span>
              </div>
            </div>
          </div>

          {/* auto-suggest button */}
          {ratio < 4.5 && (
            <button
              onClick={() => onChange({ textPrimary: suggested })}
              className="ml-12 flex items-center gap-1.5 text-xs text-amber-300/80 hover:text-amber-300 transition-colors"
            >
              <span className="w-3 h-3 rounded-full inline-block border border-amber-400/60" style={{ background: suggested }} />
              Auto-fix to WCAG AA ({suggested})
            </button>
          )}
        </div>

        {/* ── Live opacity preview ── */}
        <div>
          <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">
            Opacity cascade preview
          </p>
          <div
            className="rounded-xl p-4 space-y-2 border border-white/10"
            style={{ background: bgBase }}
          >
            {[
              { alpha: 1.00, label: 'text-white',    role: 'headings, key labels' },
              { alpha: 0.70, label: 'text-white/70', role: 'body copy' },
              { alpha: 0.50, label: 'text-white/50', role: 'secondary' },
              { alpha: 0.30, label: 'text-white/30', role: 'hints, captions' },
            ].map(({ alpha, label, role }) => (
              <div key={label} className="flex items-baseline gap-3">
                <span
                  className="font-mono text-xs w-28 flex-shrink-0"
                  style={{
                    color: txtRgb
                      ? `rgba(${txtRgb.r},${txtRgb.g},${txtRgb.b},${alpha})`
                      : `rgba(255,255,255,${alpha})`,
                  }}
                >
                  {label}
                </span>
                <span
                  className="text-xs flex-1"
                  style={{
                    color: txtRgb
                      ? `rgba(${txtRgb.r},${txtRgb.g},${txtRgb.b},${alpha})`
                      : `rgba(255,255,255,${alpha})`,
                  }}
                >
                  {role}
                </span>
              </div>
            ))}
          </div>
          <p className="text-white/25 text-[10px] mt-2">
            Cards with dark backgrounds (project cards, video embeds) always keep white text — they are excluded from this override.
          </p>
        </div>
      </div>
    </GlassCard>
  );
}

/* ── single logo slot (dark or light) ────────────────── */
interface LogoSlotProps {
  variant:   'dark' | 'light';
  currentUrl: string | null;
  onUploaded: (url: string) => void;
  onDeleted:  () => void;
}
function LogoSlot({ variant, currentUrl, onUploaded, onDeleted }: LogoSlotProps) {
  const [uploading, setUploading] = useState(false);
  const [deleting,  setDeleting]  = useState(false);
  const [dragOver,  setDragOver]  = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isDark   = variant === 'dark';
  const bgClass  = isDark ? 'bg-neutral-900/80' : 'bg-white/90';
  const label    = isDark ? 'Dark mode logo' : 'Light mode logo';
  const hint     = isDark ? 'For dark backgrounds' : 'For light backgrounds';
  const accentBorder = isDark ? 'border-violet-500/50' : 'border-sky-400/50';

  const uploadFile = async (file: File) => {
    setUploading(true);
    try {
      const token = localStorage.getItem('admin_token');
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_BASE}/logo/${variant}`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'X-Admin-Token': token || '',
        },
        body: fd,
      });
      const result = await res.json();
      if (result.success) {
        onUploaded(result.logoUrl);
      } else {
        console.error(`${label} upload failed:`, result.error);
      }
    } catch (err) {
      console.error(`${label} upload error:`, err);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/logo/${variant}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${publicAnonKey}`,
          'X-Admin-Token': token || '',
        },
      });
      const result = await res.json();
      if (result.success) onDeleted();
      else console.error(`${label} delete failed:`, result.error);
    } catch (err) {
      console.error(`${label} delete error:`, err);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* label row */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-white/70 text-xs font-semibold uppercase tracking-wider">{label}</p>
          <p className="text-white/30 text-[10px] mt-0.5">{hint}</p>
        </div>
        {currentUrl && (
          <button
            onClick={handleDelete}
            disabled={deleting}
            title={`Remove ${label}`}
            className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px]
              bg-red-500/10 border border-red-500/20 text-red-400
              hover:bg-red-500/20 transition-colors disabled:opacity-50"
          >
            {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
            Remove
          </button>
        )}
      </div>

      {/* drop zone — background mimics the target mode */}
      <div
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) uploadFile(f); }}
        onClick={() => !uploading && fileInputRef.current?.click()}
        className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2
          border-dashed cursor-pointer transition-all min-h-28 px-3
          ${bgClass}
          ${dragOver
            ? accentBorder + ' ring-1 ring-violet-500/20'
            : currentUrl
              ? 'border-white/15 hover:border-white/30'
              : 'border-white/10 hover:border-white/20'}`}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-1.5">
            <Loader2 className="w-5 h-5 text-purple-400 animate-spin" />
            <p className={`text-xs ${isDark ? 'text-white/40' : 'text-black/40'}`}>Uploading…</p>
          </div>
        ) : currentUrl ? (
          <div className="flex flex-col items-center gap-1.5 w-full">
            <img src={currentUrl} alt={label} className="max-h-16 max-w-full object-contain" />
            <p className={`text-[9px] ${isDark ? 'text-white/25' : 'text-black/25'}`}>Drop or click to replace</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 text-center">
            <Upload className={`w-4 h-4 ${isDark ? 'text-white/25' : 'text-black/20'}`} />
            <p className={`text-[11px] ${isDark ? 'text-white/40' : 'text-black/40'}`}>
              Drop or click to upload
            </p>
          </div>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/svg+xml,image/webp,image/gif"
          className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) uploadFile(f); e.target.value = ''; }}
        />
      </div>

      <button
        onClick={() => fileInputRef.current?.click()}
        disabled={uploading}
        className="w-full flex items-center justify-center gap-2 py-1.5 rounded-lg text-xs
          bg-purple-600/15 border border-purple-500/25 text-purple-300
          hover:bg-purple-600/25 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {uploading
          ? <><Loader2 className="w-3 h-3 animate-spin" />Uploading…</>
          : <><Upload className="w-3 h-3" />{currentUrl ? 'Replace' : 'Upload'}</>}
      </button>
    </div>
  );
}

/* ── branding / logo card ─────────────────────────────── */
function BrandingCard() {
  const {
    logoDarkUrl: ctxDark, logoLightUrl: ctxLight,
    logoText: ctxLogoText, logoHeight: ctxLogoHeight,
    setLogo,
  } = useLogo();

  const [logoDarkUrl,  setLogoDarkUrl]  = useState<string | null>(ctxDark);
  const [logoLightUrl, setLogoLightUrl] = useState<string | null>(ctxLight);
  const [logoText,     setLogoText]     = useState(ctxLogoText);
  const [logoHeight,   setLogoHeight]   = useState(ctxLogoHeight);
  const [saving,       setSaving]       = useState(false);
  const [saved,        setSaved]        = useState(false);

  // Sync from context once settings arrive
  useEffect(() => {
    setLogoDarkUrl(ctxDark);
    setLogoLightUrl(ctxLight);
    setLogoText(ctxLogoText);
    setLogoHeight(ctxLogoHeight);
  }, [ctxDark, ctxLight, ctxLogoText, ctxLogoHeight]);

  const handleSaveText = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('admin_token');
      await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
          'X-Admin-Token': token || '',
        },
        body: JSON.stringify({ logoText, logoHeight }),
      });
      setLogo(logoDarkUrl, logoLightUrl, logoText, logoHeight);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Logo settings save error:', err);
    } finally {
      setSaving(false);
    }
  };

  const previewFontSize = Math.max(14, Math.round(logoHeight * 0.75));
  // Active logo for preview: whichever is set (dark preferred)
  const previewUrl = logoDarkUrl || logoLightUrl;

  return (
    <GlassCard className="p-5">
      <SectionHeader
        icon={<ImageIcon className="w-4 h-4" />}
        title="Branding & Logo"
        subtitle="Upload separate logos for dark and light modes — if one is missing, the other is used as fallback"
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* ── Dark + Light upload slots ── */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <LogoSlot
            variant="dark"
            currentUrl={logoDarkUrl}
            onUploaded={url => {
              setLogoDarkUrl(url);
              setLogo(url, logoLightUrl, logoText, logoHeight);
            }}
            onDeleted={() => {
              setLogoDarkUrl(null);
              setLogo(null, logoLightUrl, logoText, logoHeight);
            }}
          />
          <LogoSlot
            variant="light"
            currentUrl={logoLightUrl}
            onUploaded={url => {
              setLogoLightUrl(url);
              setLogo(logoDarkUrl, url, logoText, logoHeight);
            }}
            onDeleted={() => {
              setLogoLightUrl(null);
              setLogo(logoDarkUrl, null, logoText, logoHeight);
            }}
          />
        </div>

        {/* ── Text fallback, height & preview ── */}
        <div className="space-y-5">
          <div>
            <label className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-2 block">
              Text fallback
            </label>
            <Input
              value={logoText}
              onChange={e => setLogoText(e.target.value)}
              placeholder="Fastoosh"
              className="bg-white/5 border-white/10 text-white"
            />
            <p className="text-white/25 text-[10px] mt-1.5">
              Used in header &amp; footer when no logo image is set
            </p>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-white/60 text-xs font-semibold uppercase tracking-wider">
                Display height
              </label>
              <span className="text-white/50 font-mono text-xs bg-white/5 px-2 py-0.5 rounded">
                {logoHeight}px
              </span>
            </div>
            <input
              type="range"
              min={20} max={80} step={2}
              value={logoHeight}
              onChange={e => setLogoHeight(Number(e.target.value))}
              className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-white/10"
              style={{ accentColor: '#7c3aed' }}
            />
            <div className="flex justify-between mt-1">
              <span className="text-white/20 text-[9px]">20px</span>
              <span className="text-white/20 text-[9px]">80px</span>
            </div>
          </div>

          {/* Header preview strip */}
          <div>
            <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-2">
              Header preview
            </p>
            <div className="rounded-lg border border-white/10 bg-black/60
              backdrop-blur-sm px-3 py-2.5 flex items-center gap-3">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt={logoText}
                  style={{ height: `${logoHeight}px` }}
                  className="w-auto max-w-[120px] object-contain flex-shrink-0"
                />
              ) : (
                <span
                  className="font-bold bg-gradient-to-r from-violet-400 via-purple-300 to-pink-400
                    bg-clip-text text-transparent flex-shrink-0"
                  style={{ fontSize: `${previewFontSize}px` }}
                >
                  {logoText || 'Fastoosh'}
                </span>
              )}
              <div className="flex gap-2 text-white/30 text-[10px]">
                {['Home', 'Projects', 'Tools'].map(n => <span key={n}>{n}</span>)}
              </div>
            </div>
          </div>

          <Button
            size="sm"
            onClick={handleSaveText}
            disabled={saving}
            className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500
              hover:to-fuchsia-500 text-white border-0 shadow-lg shadow-purple-900/30"
          >
            {saving ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</>
            ) : saved ? (
              <><CheckCircle className="w-3.5 h-3.5 mr-1.5" />Saved!</>
            ) : (
              'Save text & height'
            )}
          </Button>
        </div>
      </div>
    </GlassCard>
  );
}

/* ── main component ───────────────────────────────────── */
export function StyleTab() {
  const { setSiteStyle }    = useSiteStyle();
  const { resetLogoHeight } = useLogo();

  const [activeMode, setActiveMode] = useState<Mode>('dark');
  const [liveMode,   setLiveMode]   = useState<Mode>('dark'); // last-saved mode (shown on site)
  const [darkDraft,  setDarkDraft]  = useState<SiteStyle>(DEFAULT_STYLE);
  const [lightDraft, setLightDraft] = useState<SiteStyle>(LIGHT_STYLE);

  const [loading,     setLoading]     = useState(true);
  const [saving,      setSaving]      = useState(false);
  const [saved,       setSaved]       = useState(false);
  const [livePreview, setLivePreview] = useState(false);
  const [showAiGen,   setShowAiGen]   = useState(false);

  /* derived — the draft currently being edited */
  const draft    = activeMode === 'dark' ? darkDraft : lightDraft;
  const setDraft = activeMode === 'dark' ? setDarkDraft : setLightDraft;

  /* fetch saved styles on mount */
  useEffect(() => {
    fetch(`${API_BASE}/settings`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` },
    })
      .then(r => r.json())
      .then(({ data }) => {
        if (data?.siteStyleDark)  setDarkDraft({ ...DEFAULT_STYLE, ...data.siteStyleDark });
        else if (data?.siteStyle) setDarkDraft({ ...DEFAULT_STYLE, ...data.siteStyle }); // backward compat
        if (data?.siteStyleLight) setLightDraft({ ...LIGHT_STYLE, ...data.siteStyleLight });
        if (data?.activeStyleMode) {
          setActiveMode(data.activeStyleMode);
          setLiveMode(data.activeStyleMode);
        }
      })
      .catch(err => console.error('StyleTab: failed to load settings:', err))
      .finally(() => setLoading(false));
  }, []);

  /* switch mode — optionally apply live preview */
  const handleModeChange = (m: Mode) => {
    setActiveMode(m);
    if (livePreview) applyStyles(m === 'dark' ? darkDraft : lightDraft);
  };

  /* handle field change */
  const handleChange = useCallback((patch: Partial<SiteStyle>) => {
    setDraft(prev => {
      const next = { ...prev, ...patch };
      if (livePreview) applyStyles(next);
      return next;
    });
  }, [livePreview, setDraft]);

  /* toggle live preview */
  const toggleLive = () => {
    setLivePreview(v => {
      if (!v) applyStyles(draft);
      return !v;
    });
  };

  /* save both presets */
  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('admin_token');
      const res = await fetch(`${API_BASE}/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${publicAnonKey}`,
          'X-Admin-Token': token || '',
        },
        body: JSON.stringify({
          siteStyleDark:   darkDraft,
          siteStyleLight:  lightDraft,
          siteStyle:       activeMode === 'dark' ? darkDraft : lightDraft, // active preset
          activeStyleMode: activeMode,
        }),
      });
      const result = await res.json();
      if (result.success) {
        const activeStyle = activeMode === 'dark' ? darkDraft : lightDraft;
        setSiteStyle(activeStyle);      // ← updates context + calls applyStyles immediately
        applyStyles(activeStyle);       // ← belt-and-suspenders: force CSS vars right now
        setLiveMode(activeMode);        // ← mark this mode as "live on site"
        setSaved(true);
        setTimeout(() => setSaved(false), 2500);
      } else {
        console.error('StyleTab save error:', result.error);
      }
    } catch (err) {
      console.error('StyleTab save error:', err);
    } finally {
      setSaving(false);
    }
  };

  /* apply AI-generated theme */
  const handleAiApply = useCallback((style: Partial<SiteStyle>, mode: 'current' | 'dark' | 'light' | 'both') => {
    const applyToDark  = mode === 'dark'  || mode === 'both' || (mode === 'current' && activeMode === 'dark');
    const applyToLight = mode === 'light' || mode === 'both' || (mode === 'current' && activeMode === 'light');
    if (applyToDark)  setDarkDraft(prev => { const n = { ...prev, ...style }; if (livePreview && activeMode === 'dark')  applyStyles(n); return n; });
    if (applyToLight) setLightDraft(prev => { const n = { ...prev, ...style }; if (livePreview && activeMode === 'light') applyStyles(n); return n; });
  }, [activeMode, livePreview]);

  /* reset current mode to its default */
  const handleReset = () => {
    const defaults = activeMode === 'dark' ? DEFAULT_STYLE : LIGHT_STYLE;
    setDraft(() => {
      if (livePreview) applyStyles(defaults);
      return defaults;
    });
    resetLogoHeight();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-purple-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── Header bar ──────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-white">Style</h2>
          <p className="text-white/40 text-sm mt-0.5">
            Customize colours, gradients and typography — changes apply site-wide instantly.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={toggleLive}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              livePreview
                ? 'bg-emerald-600/20 border-emerald-500/40 text-emerald-300'
                : 'bg-white/5 border-white/10 text-white/50 hover:text-white/80'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            {livePreview ? 'Live ON' : 'Live preview'}
          </button>
          <Button
            size="sm"
            onClick={() => setShowAiGen(true)}
            className="bg-gradient-to-r from-violet-600/80 to-purple-600/80 hover:from-violet-500 hover:to-fuchsia-500 text-white border border-violet-500/30 shadow-lg shadow-violet-900/30 gap-1.5"
          >
            <Palette className="w-3.5 h-3.5" />
            Color Palettes
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="text-white/60 hover:text-white border-white/25 hover:border-white/50 bg-transparent"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={saving}
            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-fuchsia-500 text-white border-0 shadow-lg shadow-purple-900/40 min-w-[100px]"
          >
            {saving ? (
              <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />Saving…</>
            ) : saved ? (
              <><CheckCircle className="w-3.5 h-3.5 mr-1.5" />Saved!</>
            ) : (
              <><Save className="w-3.5 h-3.5 mr-1.5" />Save</>
            )}
          </Button>
        </div>
      </div>

      {/* ── Branding & Logo ─────────────────────────────────── */}
      <BrandingCard />

      {/* ── Mode switcher card ──────────────────────────────── */}
      <GlassCard className="p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-purple-600/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0 text-purple-400">
              {activeMode === 'dark' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-white font-semibold text-sm">
                  {activeMode === 'dark' ? 'Dark Mode Preset' : 'Light Mode Preset'}
                </h3>
                {liveMode === activeMode && (
                  <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-500/15 text-emerald-300 border border-emerald-500/25">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                    Live on site
                  </span>
                )}
              </div>
              <p className="text-white/40 text-xs mt-0.5">
                {activeMode === 'dark'
                  ? 'Deep black + neon gradients — the current default look'
                  : 'Soft lavender whites + vivid accents — bright airy feel'}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-start sm:items-end gap-2">
            <ModeToggle activeMode={activeMode} onChange={handleModeChange} />
            <p className="text-white/25 text-[10px]">
              Each preset saves independently ·{' '}
              <span className="text-purple-300/60">Save</span> sets the{' '}
              <span className="text-emerald-400/60">Live</span> preset and applies it instantly
            </p>
          </div>
        </div>

        {/* mini preview comparing both */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          {([
            { mode: 'dark'  as Mode, style: darkDraft,  label: 'Dark'  },
            { mode: 'light' as Mode, style: lightDraft, label: 'Light' },
          ]).map(({ mode, style, label }) => (
            <button
              key={mode}
              onClick={() => handleModeChange(mode)}
              className={`rounded-xl overflow-hidden border-2 transition-all text-left ${
                activeMode === mode
                  ? 'border-purple-500/60 shadow-lg shadow-purple-500/15 ring-1 ring-purple-500/20'
                  : 'border-white/8 opacity-60 hover:opacity-80'
              }`}
            >
              <div
                className="h-10 w-full"
                style={{
                  background: `linear-gradient(135deg, ${style.bgGrad1}, ${style.bgBase} 60%, ${style.bgGrad2})`,
                }}
              >
                <div
                  className="h-full w-full flex items-center justify-center gap-1.5"
                  style={{
                    background: `linear-gradient(to right, ${style.accentPrimary}18, ${style.accentGlow}18)`,
                  }}
                >
                  {[style.accentPrimary, style.accentSecondary, style.accentGlow].map((c, i) => (
                    <div key={i} className="w-3 h-3 rounded-full" style={{ background: c, boxShadow: `0 0 6px ${c}` }} />
                  ))}
                </div>
              </div>
              <div className="px-2.5 py-1.5 flex items-center justify-between gap-1" style={{ background: style.bgBase }}>
                <span
                  className="text-[10px] font-semibold"
                  style={{ color: mode === 'dark' ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)' }}
                >
                  {label}
                </span>
                <div className="flex items-center gap-1">
                  {/* Live on site badge */}
                  {liveMode === mode && (
                    <span className="flex items-center gap-0.5 text-[9px] px-1.5 py-0.5 rounded-full font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      <Signal className="w-2 h-2" />
                      Live
                    </span>
                  )}
                  {/* Editing badge */}
                  {activeMode === mode && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{
                        background: `${style.accentPrimary}20`,
                        color: style.accentPrimary,
                        border: `1px solid ${style.accentPrimary}40`,
                      }}
                    >
                      editing
                    </span>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      </GlassCard>

      {/* ── Live preview strip ──────────────────────────────── */}
      <GlassCard className="p-4">
        <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">Preview</p>
        <AnimatePresence mode="wait">
          <motion.div
            key={activeMode}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
          >
            <PreviewStrip style={draft} />
          </motion.div>
        </AnimatePresence>
      </GlassCard>

      {/* ── Editors ─────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeMode}
          initial={{ opacity: 0, x: activeMode === 'dark' ? -12 : 12 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: activeMode === 'dark' ? 12 : -12 }}
          transition={{ duration: 0.22 }}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6"
        >
          {/* ── Accent Colours ─────────────────────────── */}
          <GlassCard className="p-5">
            <SectionHeader
              icon={<Palette className="w-4 h-4" />}
              title="Accent Colours"
              subtitle="Drive buttons, gradients, glows and text highlights across the site"
            />
            <div className="space-y-4">
              <ColorField
                label="Primary Accent"
                hint="violet — buttons, hero gradient from"
                value={draft.accentPrimary}
                onChange={v => handleChange({ accentPrimary: v })}
              />
              <ColorField
                label="Secondary Accent"
                hint="purple — gradient via, text highlights"
                value={draft.accentSecondary}
                onChange={v => handleChange({ accentSecondary: v })}
              />
              <ColorField
                label="Glow / Highlight"
                hint="pink/fuchsia — gradient to, glow effects"
                value={draft.accentGlow}
                onChange={v => handleChange({ accentGlow: v })}
              />
            </div>

            <div className="mt-5 space-y-2">
              {[
                { label: 'Primary shades',   base: draft.accentPrimary   },
                { label: 'Secondary shades', base: draft.accentSecondary },
              ].map(({ label, base }) => (
                <div key={label}>
                  <p className="text-white/30 text-[10px] mb-1.5">{label}</p>
                  <div className="flex gap-1">
                    {[75, 55, 32, 14, 0, -16, -35, -55].map((s, i) => (
                      <div
                        key={i}
                        title={`${s > 0 ? '+' : ''}${s}%`}
                        className="flex-1 h-4 rounded"
                        style={{ background: s === 0 ? base : shadeHex(base, s) }}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </GlassCard>

          {/* ── Background Gradient ─────────────────────── */}
          <GlassCard className="p-5">
            <SectionHeader
              icon={<Layers className="w-4 h-4" />}
              title="Background Gradient"
              subtitle="The animated full-page gradient that scrolls behind all content"
            />
            <div className="space-y-4">
              <ColorField
                label="Base Background"
                hint={activeMode === 'dark' ? 'pure black or near-black' : 'white or very light tint'}
                value={draft.bgBase}
                onChange={v => handleChange({ bgBase: v })}
              />
              <ColorField
                label="Inner Gradient Tint"
                hint="centre of radial gradient"
                value={draft.bgGrad1}
                onChange={v => handleChange({ bgGrad1: v })}
              />
              <ColorField
                label="Outer Gradient Tint"
                hint="mid ring of radial gradient"
                value={draft.bgGrad2}
                onChange={v => handleChange({ bgGrad2: v })}
              />
              <ColorField
                label="Overlay Colour 1"
                hint="primary tint overlay (usually violet)"
                value={draft.overlayColor1}
                onChange={v => handleChange({ overlayColor1: v })}
              />
              <ColorField
                label="Overlay Colour 2"
                hint="secondary tint overlay (usually blue)"
                value={draft.overlayColor2}
                onChange={v => handleChange({ overlayColor2: v })}
              />
            </div>

            <div className="mt-5">
              <p className="text-white/40 text-xs font-semibold uppercase tracking-wider mb-3">
                Scroll animation sensitivity
              </p>
              <div className="flex gap-2">
                {(['slow', 'medium', 'fast'] as const).map(sp => (
                  <SpeedPill
                    key={sp}
                    label={sp.charAt(0).toUpperCase() + sp.slice(1)}
                    active={draft.gradSpeed === sp}
                    onClick={() => handleChange({ gradSpeed: sp })}
                  />
                ))}
              </div>
              <p className="text-white/25 text-xs mt-2">
                Controls how quickly the gradient shifts as the user scrolls.
              </p>
            </div>
          </GlassCard>

          {/* ── Surfaces & Chrome ─────────────────────── */}
          <SurfacesCard draft={draft} onChange={handleChange} />

          {/* ── Text Colour ────────────────────────────── */}
          <TextColorCard draft={draft} onChange={handleChange} />

          {/* ── Typography ─────────────────────────────── */}
          <GlassCard className="p-5 lg:col-span-2">
            <SectionHeader
              icon={<Type className="w-4 h-4" />}
              title="Typography"
              subtitle="Type any Google Font name or pick from 70+ premium suggestions below"
            />
            
            {/* Info banner */}
            <div className="rounded-lg bg-violet-500/10 border border-violet-500/20 p-3 mb-5">
              <p className="text-violet-200/80 text-xs leading-relaxed">
                💡 <strong>Browse 70+ curated fonts</strong> or <strong>add custom fonts:</strong> Type any <a href="https://fonts.google.com/" target="_blank" rel="noopener noreferrer" className="text-violet-300 underline hover:text-violet-200">Google Font</a> name in the search box and press Enter or click "Add".
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-2 block">
                  Heading font
                </label>
                <FontSelector
                  value={draft.headingFont}
                  fonts={HEADING_FONTS}
                  onChange={(font) => handleChange({ headingFont: font })}
                  placeholder="Select heading font..."
                />
                <FontLoadIndicator fontName={draft.headingFont} />
                <p
                  className="text-white/70 text-lg font-bold mb-1 mt-3 transition-all"
                  style={{ fontFamily: `'${draft.headingFont}', sans-serif` }}
                >
                  The quick brown fox jumps over the lazy dog
                </p>
                <p className="text-white/30 text-xs">↑ live heading preview</p>
              </div>

              <div>
                <label className="text-white/60 text-xs font-semibold uppercase tracking-wider mb-2 block">
                  Body font
                </label>
                <FontSelector
                  value={draft.bodyFont}
                  fonts={BODY_FONTS}
                  onChange={(font) => handleChange({ bodyFont: font })}
                  placeholder="Select body font..."
                />
                <FontLoadIndicator fontName={draft.bodyFont} />
                <p
                  className="text-white/70 text-sm mb-1 mt-3 transition-all"
                  style={{ fontFamily: `'${draft.bodyFont}', sans-serif` }}
                >
                  Fastoosh creates motion design that moves people. Precision,
                  creativity and technical excellence in every frame.
                </p>
                <p className="text-white/30 text-xs">↑ live body preview</p>
              </div>
            </div>
          </GlassCard>

        </motion.div>
      </AnimatePresence>

      {/* ── Bottom save toast ───────────────────────────────── */}
      <AnimatePresence>
        {saved && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl
              bg-emerald-600/20 border border-emerald-500/40 backdrop-blur-xl shadow-xl text-emerald-300 text-sm font-medium"
          >
            <CheckCircle className="w-4 h-4" />
            {liveMode === 'dark' ? '🌑 Dark' : '☀️ Light'} is now live on the site!
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Color Palette Generator modal ─────────────────────────── */}
      {showAiGen && (
        <ColorPaletteGenerator
          activeMode={activeMode}
          onApply={(style, mode) => {
            handleAiApply(style, mode);
          }}
          onClose={() => setShowAiGen(false)}
        />
      )}
    </div>
  );
}