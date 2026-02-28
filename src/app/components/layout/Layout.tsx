import { DEFAULT_STYLE, useSiteStyle } from '../../context/StyleContext';
import { useLogo } from '../../context/LogoContext';
import { Outlet, useLocation } from "react-router";
import { useEffect, useRef } from "react";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { ScrollToTop } from "../shared/ScrollToTop";
import { ScrollRestoration } from "../shared/ScrollRestoration";
import { ScrollingGradientBackground } from "../shared/ScrollingGradientBackground";
import { projectId, publicAnonKey } from "/utils/supabase/info";
import { useTracker } from "../../hooks/useTracker";

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;

/** Retries a fetch up to `retries` times with exponential back-off.
 *  Supabase edge functions can have cold starts of 2–5 s on the first request. */
async function retryFetch(url: string, options: RequestInit, retries = 3, delay = 1200): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(url, options);
    } catch (err) {
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, delay * (attempt + 1)));
      } else {
        throw err;
      }
    }
  }
  throw new Error('retryFetch: unreachable');
}

function useDynamicFavicon() {
  const { setSiteStyle }          = useSiteStyle();
  const { setSiteMode }           = useLogo();

  useEffect(() => {
    retryFetch(`${API_BASE}/settings`, {
      headers: { Authorization: `Bearer ${publicAnonKey}` },
    })
      .then(r => r.json())
      .then(({ data }) => {
        // Apply saved site style
        if (data?.siteStyle) {
          setSiteStyle({ ...DEFAULT_STYLE, ...data.siteStyle });
        }
        // Apply active mode so Header/Footer pick the right logo variant
        if (data?.activeStyleMode === 'light' || data?.activeStyleMode === 'dark') {
          setSiteMode(data.activeStyleMode);
        }
        // Apply favicon
        const url = data?.faviconUrl;
        if (!url) return;
        let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
        if (!link) {
          link = document.createElement('link');
          link.rel = 'icon';
          document.head.appendChild(link);
        }
        link.href = url;
      })
      .catch(err => console.warn('Could not load settings:', err));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

/**
 * Invisible component that auto-tracks:
 *  • page_view  — on every route change
 *  • page_exit  — with real time-on-page in seconds
 *  • scroll_depth — at 25 / 50 / 75 / 100 % milestones
 *  • click_map   — batched normalised click coords (x%,y%)
 */
function RouteTracker() {
  const location  = useLocation();
  const { track } = useTracker();
  const prevPath   = useRef('');
  const entryTime  = useRef(Date.now());
  const milestones = useRef(new Set<number>());

  // ── Page view / exit ────────────────────────────────────────────────────────
  useEffect(() => {
    if (prevPath.current) {
      track('page_exit', {
        path:     prevPath.current,
        duration: Math.round((Date.now() - entryTime.current) / 1000),
      });
    }
    track('page_view', {
      path:  location.pathname,
      title: document.title || location.pathname,
    });
    prevPath.current  = location.pathname;
    entryTime.current = Date.now();
    milestones.current = new Set();   // reset scroll milestones per page
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  // ── Scroll depth ────────────────────────────────────────────────────────────
  useEffect(() => {
    const LEVELS = [25, 50, 75, 100];
    let timer: ReturnType<typeof setTimeout>;

    const onScroll = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        const scrolled = window.scrollY + window.innerHeight;
        const total    = document.documentElement.scrollHeight;
        if (total <= 0) return;
        const pct = Math.round((scrolled / total) * 100);
        for (const lvl of LEVELS) {
          if (pct >= lvl && !milestones.current.has(lvl)) {
            milestones.current.add(lvl);
            track('scroll_depth', { path: location.pathname, percent: lvl });
          }
        }
      }, 250);
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => { window.removeEventListener('scroll', onScroll); clearTimeout(timer); };
  }, [location.pathname, track]);

  // ── Click heatmap ───────────────────────────────────────────────────────────
  useEffect(() => {
    let pending: Array<{ x: number; y: number }> = [];
    let batchTimer: ReturnType<typeof setTimeout>;

    const flush = () => {
      if (pending.length === 0) return;
      const clicks = [...pending]; pending = [];
      track('click_map', { path: location.pathname, clicks });
    };

    const onClick = (e: MouseEvent) => {
      // Sample 45 % of all clicks to keep event volume manageable
      if (Math.random() > 0.45) return;
      const docH = document.documentElement.scrollHeight || 1;
      const docW = document.documentElement.scrollWidth  || 1;
      // pageX/pageY already include scroll offset
      pending.push({
        x: Math.round((e.pageX / docW)  * 100),
        y: Math.round((e.pageY / docH)  * 100),
      });
      clearTimeout(batchTimer);
      if (pending.length >= 8) flush();
      else batchTimer = setTimeout(flush, 5_000);
    };

    document.addEventListener('click', onClick);
    return () => {
      document.removeEventListener('click', onClick);
      clearTimeout(batchTimer);
      flush();
    };
  }, [location.pathname, track]);

  return null;
}

export function Layout() {
  useDynamicFavicon();
  return (
    <>
      <ScrollingGradientBackground />
      <div id="fastoosh-site" className="min-h-screen text-white">
        <RouteTracker />
        <ScrollRestoration />
        <Header />
        <main>
          <Outlet />
        </main>
        <Footer />
        <ScrollToTop />
      </div>
    </>
  );
}