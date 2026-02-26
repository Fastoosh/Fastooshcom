import { createContext, useContext, useState, ReactNode } from 'react';

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
  const [logoDarkUrl,  setLogoDarkUrl]  = useState<string | null>(null);
  const [logoLightUrl, setLogoLightUrl] = useState<string | null>(null);
  const [logoText,     setLogoText]     = useState('Fastoosh');
  const [logoHeight,   setLogoHeight]   = useState(32);
  const [siteMode,     setSiteModeState] = useState<SiteMode>('dark');

  const setLogo = (dark: string | null, light: string | null, text: string, height: number) => {
    setLogoDarkUrl(dark  ?? null);
    setLogoLightUrl(light ?? null);
    setLogoText(text || 'Fastoosh');
    setLogoHeight(height || 32);
  };

  const setSiteMode = (mode: SiteMode) => setSiteModeState(mode);

  const resetLogoHeight = () => setLogoHeight(32);

  // Pick the variant that matches the current mode; fall back to whichever exists
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