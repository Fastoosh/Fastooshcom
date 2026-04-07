import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

export interface SiteStyle {
  accentPrimary: string;   // maps to violet shades
  accentSecondary: string; // maps to purple shades
  accentGlow: string;      // maps to pink/fuchsia shades
  bgBase: string;          // page background base
  bgGrad1: string;         // inner gradient dark tint
  bgGrad2: string;         // outer gradient near-black
  overlayColor1: string;   // primary overlay colour (violet-ish)
  overlayColor2: string;   // secondary overlay colour (blue-ish)
  gradSpeed: 'slow' | 'medium' | 'fast';
  headingFont: string;     // Google Font name for headings
  bodyFont: string;        // Google Font name for body
  textPrimary: string;     // explicit body-text colour (e.g. #fff dark, #0d0620 light)
  // ── Surface / chrome colours (rgba strings) ──────────────
  headerBg: string;        // sticky nav background tint  e.g. 'rgba(0,0,0,0.10)'
  footerBg: string;        // footer background tint       e.g. 'rgba(0,0,0,0.30)'
  cardBg: string;          // regular GlassCard fill        e.g. 'rgba(255,255,255,0.02)'
  cardDarkFill: string;    // neonBorder inner fill         e.g. 'rgba(0,0,0,0.95)'
  signinBg: string;        // sign-in / avatar btn bg       e.g. 'rgba(255,255,255,0.05)'
  navText: string;         // nav link text (dim)           e.g. 'rgba(255,255,255,0.70)'
}

export const DEFAULT_STYLE: SiteStyle = {
  accentPrimary:   '#7c3aed',
  accentSecondary: '#a855f7',
  accentGlow:      '#ec4899',
  bgBase:          '#000000',
  bgGrad1:         '#0f0519',
  bgGrad2:         '#05050f',
  overlayColor1:   '#8b5cf6',
  overlayColor2:   '#3b82f6',
  gradSpeed:       'medium',
  headingFont:     'Inter',
  bodyFont:        'Inter',
  textPrimary:     '#ffffff',
  headerBg:        'rgba(0,0,0,0.10)',
  footerBg:        'rgba(0,0,0,0.30)',
  cardBg:          'rgba(255,255,255,0.02)',
  cardDarkFill:    'rgba(0,0,0,0.95)',
  signinBg:        'rgba(255,255,255,0.05)',
  navText:         'rgba(255,255,255,0.70)',
};

export const LIGHT_STYLE: SiteStyle = {
  accentPrimary:   '#7c3aed',
  accentSecondary: '#a855f7',
  accentGlow:      '#db2777',
  bgBase:          '#f9f7ff',
  bgGrad1:         '#ede9fe',
  bgGrad2:         '#fdf4ff',
  overlayColor1:   '#8b5cf6',
  overlayColor2:   '#6366f1',
  gradSpeed:       'medium',
  headingFont:     'Inter',
  bodyFont:        'Inter',
  textPrimary:     '#0d0620',
  headerBg:        'rgba(255,255,255,0.72)',
  footerBg:        'rgba(255,255,255,0.55)',
  cardBg:          'rgba(255,255,255,0.55)',
  cardDarkFill:    'rgba(237,233,254,0.92)',
  signinBg:        'rgba(124,58,237,0.08)',
  navText:         'rgba(13,6,32,0.65)',
};

/* ── colour utilities ─────────────────────────────────── */

export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const clean = hex.replace('#', '');
  if (clean.length !== 6) return null;
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

function clamp(v: number) { return Math.max(0, Math.min(255, Math.round(v))); }

function rgbToHex(r: number, g: number, b: number) {
  return '#' + [r, g, b].map(v => clamp(v).toString(16).padStart(2, '0')).join('');
}

/** percent > 0 = lighten toward white, percent < 0 = darken */
export function shadeHex(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  if (percent >= 0) {
    const t = percent / 100;
    return rgbToHex(
      rgb.r + (255 - rgb.r) * t,
      rgb.g + (255 - rgb.g) * t,
      rgb.b + (255 - rgb.b) * t,
    );
  } else {
    const t = 1 + percent / 100;
    return rgbToHex(rgb.r * t, rgb.g * t, rgb.b * t);
  }
}

/* ── WCAG contrast utilities ──────────────────────────── */

/**
 * Relative luminance as per WCAG 2.1 §1.4.3
 * Returns a value between 0 (black) and 1 (white).
 */
export function getRelativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const linearise = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linearise(rgb.r) + 0.7152 * linearise(rgb.g) + 0.0722 * linearise(rgb.b);
}

/**
 * WCAG contrast ratio between two hex colours.
 * 4.5 = AA normal text, 3.0 = AA large text, 7.0 = AAA.
 */
export function getContrastRatio(hex1: string, hex2: string): number {
  const l1 = getRelativeLuminance(hex1);
  const l2 = getRelativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker  = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** True when bgHex is bright enough to need dark text. */
export function isLightBackground(bgHex: string): boolean {
  return getRelativeLuminance(bgHex) > 0.35;
}

/**
 * Returns whichever of darkColor / lightColor has the higher WCAG contrast
 * ratio against bgHex.  Defaults to deep brand-violet-black vs pure white.
 */
export function getContrastColor(
  bgHex: string,
  darkColor  = '#0d0620',
  lightColor = '#ffffff',
): string {
  return getContrastRatio(bgHex, darkColor) >= getContrastRatio(bgHex, lightColor)
    ? darkColor
    : lightColor;
}

/* ── internal helper — extracts the opaque hex colour from an rgba() or hex string ── */
function extractHexFromRgba(s: string): string {
  const m = s.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/);
  if (m) {
    const r = parseInt(m[1]), g = parseInt(m[2]), b = parseInt(m[3]);
    return `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`;
  }
  if (/^#/.test(s)) return s.slice(0, 7); // strip potential alpha byte from 8-char hex
  return '#000000';
}

/* ── font loading ─────────────────────────────────────── */

const loadedFonts = new Set<string>();

function loadGoogleFont(fontName: string) {
  if (!fontName || fontName.toLowerCase() === 'inter' || loadedFonts.has(fontName)) return;
  loadedFonts.add(fontName);
  const id = `gfont-${fontName.replace(/\s+/g, '-').toLowerCase()}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@300;400;500;600;700;800&display=swap`;
  document.head.appendChild(link);
}

let fontStyleTag: HTMLStyleElement | null = null;

/* ── apply styles to DOM ──────────────────────────────── */

export function applyStyles(style: SiteStyle) {
  const root = document.documentElement;

  // 1 ── Override Tailwind v4 native color vars (violet family)
  const p = style.accentPrimary;
  root.style.setProperty('--color-violet-200', shadeHex(p, 75));
  root.style.setProperty('--color-violet-300', shadeHex(p, 55));
  root.style.setProperty('--color-violet-400', shadeHex(p, 32));
  root.style.setProperty('--color-violet-500', shadeHex(p, 14));
  root.style.setProperty('--color-violet-600', p);
  root.style.setProperty('--color-violet-700', shadeHex(p, -16));
  root.style.setProperty('--color-violet-800', shadeHex(p, -35));
  root.style.setProperty('--color-violet-900', shadeHex(p, -55));

  // purple family
  const s = style.accentSecondary;
  root.style.setProperty('--color-purple-200', shadeHex(s, 75));
  root.style.setProperty('--color-purple-300', shadeHex(s, 55));
  root.style.setProperty('--color-purple-400', shadeHex(s, 32));
  root.style.setProperty('--color-purple-500', shadeHex(s, 14));
  root.style.setProperty('--color-purple-600', s);
  root.style.setProperty('--color-purple-700', shadeHex(s, -16));
  root.style.setProperty('--color-purple-800', shadeHex(s, -35));
  root.style.setProperty('--color-purple-900', shadeHex(s, -55));

  // fuchsia + pink family (glow)
  const g = style.accentGlow;
  root.style.setProperty('--color-fuchsia-300', shadeHex(g, 55));
  root.style.setProperty('--color-fuchsia-400', shadeHex(g, 30));
  root.style.setProperty('--color-fuchsia-500', shadeHex(g, 12));
  root.style.setProperty('--color-fuchsia-600', g);
  root.style.setProperty('--color-pink-300',    shadeHex(g, 55));
  root.style.setProperty('--color-pink-400',    shadeHex(g, 30));
  root.style.setProperty('--color-pink-500',    shadeHex(g, 12));
  root.style.setProperty('--color-pink-600',    g);

  // 2 ── Custom vars for the scrolling background gradient
  root.style.setProperty('--fastoosh-bg-base',  style.bgBase);
  root.style.setProperty('--fastoosh-bg-grad1', style.bgGrad1);
  root.style.setProperty('--fastoosh-bg-grad2', style.bgGrad2);
  root.style.setProperty('--fastoosh-overlay1', style.overlayColor1);
  root.style.setProperty('--fastoosh-overlay2', style.overlayColor2);

  // ── Fix: theme.css applies `body { bg-background }` which defaults to solid black
  // and paints OVER the fixed ScrollingGradientBackground (z-index: -10).
  // Keep --background in sync so Shadcn components get the right tonal base,
  // then make <body> itself transparent so the gradient always shows through.
  root.style.setProperty('--background', style.bgBase);
  document.body.style.backgroundColor = 'transparent';

  // 3 ── Surface / chrome CSS variables (used by Header, Footer, GlassCard, sign-in btn)
  root.style.setProperty('--fastoosh-header-bg',   style.headerBg     ?? 'rgba(0,0,0,0.10)');
  root.style.setProperty('--fastoosh-footer-bg',   style.footerBg     ?? 'rgba(0,0,0,0.30)');
  root.style.setProperty('--fastoosh-card-bg',     style.cardBg       ?? 'rgba(255,255,255,0.02)');
  root.style.setProperty('--fastoosh-card-dark',   style.cardDarkFill ?? 'rgba(0,0,0,0.95)');
  root.style.setProperty('--fastoosh-signin-bg',   style.signinBg     ?? 'rgba(255,255,255,0.05)');

  // Nav link text — derive hover variant by boosting alpha to 1
  const navTextStr = style.navText ?? 'rgba(255,255,255,0.70)';
  const ntM = navTextStr.match(/rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)/);
  const ntR = ntM ? parseInt(ntM[1]) : 255;
  const ntG = ntM ? parseInt(ntM[2]) : 255;
  const ntB = ntM ? parseInt(ntM[3]) : 255;
  root.style.setProperty('--fastoosh-nav-text',       navTextStr);
  root.style.setProperty('--fastoosh-nav-text-hover', `rgb(${ntR},${ntG},${ntB})`);

  // 4 ── Fonts
  loadGoogleFont(style.headingFont);
  loadGoogleFont(style.bodyFont);

  if (!fontStyleTag) {
    fontStyleTag = document.createElement('style');
    fontStyleTag.id = 'fastoosh-fonts';
    document.head.appendChild(fontStyleTag);
  }
  const hf = style.headingFont || 'Inter';
  const bf = style.bodyFont    || 'Inter';

  // 5 ── WCAG-adaptive text colours (scoped to #fastoosh-site so admin is unaffected)
  const textColor = (style.textPrimary && style.textPrimary !== '') ? style.textPrimary : getContrastColor(style.bgBase);
  const textHex   = textColor.replace('#', '');
  const textRgb   = hexToRgb(textColor) ?? { r: 255, g: 255, b: 255 };
  const onR = textRgb.r, onG = textRgb.g, onB = textRgb.b;

  // For [data-fastoosh-dark] elements (neonBorder cards etc.) we can't assume they're
  // always dark — the user controls cardDarkFill.  Derive the right text colour from
  // cardDarkFill luminance so light-tinted cards still get dark text automatically.
  const cardDarkHex      = extractHexFromRgba(style.cardDarkFill ?? 'rgba(0,0,0,0.95)');
  const cardDarkTextColor = isLightBackground(cardDarkHex) ? textColor : '#ffffff';

  // Selectors that carry a coloured/gradient background — restore white text there.
  // [data-fastoosh-dark] gets its own rule below (adaptive, not always white).
  const keepWhiteSelectors = [
    `[class*="from-violet-"]`,
    `[class*="from-purple-"]`,
    `[class*="from-fuchsia-"]`,
    `[class*="from-pink-"]`,
    `[class*="bg-violet-"]`,
    `[class*="bg-purple-"]`,
    `[class*="bg-fuchsia-"]`,
    `[class*="bg-pink-"]`,
    `[class*="to-violet-"]`,
    `[class*="to-purple-"]`,
    `[class*="to-fuchsia-"]`,
    `[class*="bg-black"]`,
    `[class*="bg-slate-8"]`,
    `[class*="bg-slate-9"]`,
    `[class*="bg-emerald-"]`,
    `[class*="bg-red-"]`,
    `[class*="bg-amber-"]`,
  ].map(sel => `#fastoosh-site ${sel}`).join(',\n');

  const adaptiveCSS = `
/* ── Fastoosh adaptive text colours (WCAG-compliant, scoped to public site) ── */
#fastoosh-site {
  --color-white: #${textHex};
  --fastoosh-text-primary:   rgb(${onR},${onG},${onB});
  --fastoosh-text-secondary: rgba(${onR},${onG},${onB},0.65);
  --fastoosh-text-muted:     rgba(${onR},${onG},${onB},0.40);
  --fastoosh-surface:        rgba(${onR},${onG},${onB},0.06);
  --fastoosh-border:         rgba(${onR},${onG},${onB},0.12);
}
/* ── Nav link text colours ── */
#fastoosh-site .fastoosh-nav-link {
  color: var(--fastoosh-nav-text);
  transition: color 0.15s;
}
#fastoosh-site .fastoosh-nav-link:hover,
#fastoosh-site .fastoosh-nav-link[data-active="true"] {
  color: var(--fastoosh-nav-text-hover);
}
/* ── Dark/coloured surface cards — text adapts to their fill colour ── */
#fastoosh-site [data-fastoosh-dark] {
  --color-white: ${cardDarkTextColor};
}
/* ── Gradient/coloured-bg elements always keep white text ── */
${keepWhiteSelectors} {
  --color-white: #ffffff;
}`;

  fontStyleTag.textContent = [
    `h1,h2,h3,h4,h5,h6{font-family:'${hf}',sans-serif!important;}`,
    `body{font-family:'${bf}',sans-serif!important;}`,
    adaptiveCSS,
  ].join('\n');
}

/* ── context ──────────────────────────────────────────── */

interface StyleContextValue {
  siteStyle: SiteStyle;
  setSiteStyle: (style: SiteStyle) => void;
}

const StyleContext = createContext<StyleContextValue>({
  siteStyle: DEFAULT_STYLE,
  setSiteStyle: () => {},
});

export function StyleProvider({ children }: { children: ReactNode }) {
  const [siteStyle, setSiteStyleState] = useState<SiteStyle>(DEFAULT_STYLE);

  const setSiteStyle = (style: SiteStyle) => {
    setSiteStyleState(style);
    applyStyles(style);
  };

  // Apply defaults immediately (overridden once Layout fetches settings)
  useEffect(() => { applyStyles(DEFAULT_STYLE); }, []);

  return (
    <StyleContext.Provider value={{ siteStyle, setSiteStyle }}>
      {children}
    </StyleContext.Provider>
  );
}

export function useSiteStyle() {
  return useContext(StyleContext);
}