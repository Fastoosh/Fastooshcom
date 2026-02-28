import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { api } from '../utils/api';

type SiteMode = 'dark' | 'light';

interface LogoContextValue {
  logoDarkUrl:  string | null;
  logoLightUrl: string | null;
  logoText:     string;
  logoHeight:   number;
  siteMode:     SiteMode;
  /** Computed: the URL appropriate for the current siteMode, with fallback to the other variant */
  activeLogoUrl: string | null;
  setLogo:          (dark: string | null, light: string | null, text: string, height: number) => void;
  setSiteMode:      (mode: SiteMode) => void;
  resetLogoHeight:  () => void;
}

// ─── localStorage persistence ─────────────────────────────────────────────────
// Reading synchronously from localStorage lets us seed the initial React state
// before the first render — logo appears immediately on every visit after the first.

const LOGO_CACHE_KEY = 'fastoosh:logo';

interface LogoCache {
  dark:   string | null;
  light:  string | null;
  text:   string;
  height: number;
}

function readLogoCache(): LogoCache | null {
  try {
    const raw = localStorage.getItem(LOGO_CACHE_KEY);
    if (raw) return JSON.parse(raw) as LogoCache;
  } catch { /* ignore – private browsing */ }
  return null;
}

function writeLogoCache(dark: string | null, light: string | null, text: string, height: number): void {
  try {
    localStorage.setItem(LOGO_CACHE_KEY, JSON.stringify({ dark, light, text, height }));
  } catch { /* ignore */ }
}

// ─────────────────────────────────────────────────────────────────────────────

const LogoContext = createContext<LogoContextValue>({
  logoDarkUrl:     null,
  logoLightUrl:    null,
  logoText:        'Fastoosh',
  logoHeight:      32,
  siteMode:        'dark',
  activeLogoUrl:   null,
  setLogo:         () => {},
  setSiteMode:     () => {},
  resetLogoHeight: () => {},
});

export function LogoProvider({ children }: { children: ReactNode }) {
  // Seed from localStorage — synchronous, available before first render.
  const cached = readLogoCache();

  const [logoDarkUrl,  setLogoDarkUrl]  = useState<string | null>(cached?.dark   ?? null);
  const [logoLightUrl, setLogoLightUrl] = useState<string | null>(cached?.light  ?? null);
  const [logoText,     setLogoText]     = useState<string>(cached?.text           || 'Fastoosh');
  const [logoHeight,   setLogoHeight]   = useState<number>(cached?.height         || 32);
  const [siteMode,     setSiteModeState] = useState<SiteMode>('dark');

  // Background fetch: keeps the logo up-to-date with what is stored on the server.
  // Uses api.getSettings() which has built-in retry + 5-min in-memory cache,
  // so navigating between pages never fires a second network request.
  useEffect(() => {
    api.getSettings().then(res => {
      if (!res.success || !res.data) return;
      const d = res.data;

      const dark   = (d.logoDarkUrl  || d.logoUrl  || null) as string | null;
      const light  = (d.logoLightUrl || null)               as string | null;
      const text   =  d.logoText    || 'Fastoosh';
      const height = Number(d.logoHeight) || 32;

      setLogoDarkUrl(dark);
      setLogoLightUrl(light);
      setLogoText(text);
      setLogoHeight(height);

      // Persist so the next page load can skip the network round-trip entirely.
      writeLogoCache(dark, light, text, height);
    }).catch(() => { /* network unavailable — keep cached values */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Called by the admin panel after a logo change so the header updates live. */
  const setLogo = (dark: string | null, light: string | null, text: string, height: number) => {
    setLogoDarkUrl(dark  ?? null);
    setLogoLightUrl(light ?? null);
    setLogoText(text || 'Fastoosh');
    setLogoHeight(height || 32);
    writeLogoCache(dark, light, text, height);
  };

  const setSiteMode     = (mode: SiteMode) => setSiteModeState(mode);
  const resetLogoHeight = () => setLogoHeight(32);

  // Pick the variant that matches the current mode; fall back to whichever exists.
  const activeLogoUrl =
    siteMode === 'dark'
      ? (logoDarkUrl  || logoLightUrl)
      : (logoLightUrl || logoDarkUrl);

  return (
    <LogoContext.Provider
      value={{ logoDarkUrl, logoLightUrl, logoText, logoHeight, siteMode, activeLogoUrl, setLogo, setSiteMode, resetLogoHeight }}
    >
      {children}
    </LogoContext.Provider>
  );
}

export function useLogo() {
  return useContext(LogoContext);
}
