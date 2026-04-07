import { useRef, useEffect, useState, useCallback, ReactNode } from 'react';
import { TrackingContext } from '../contexts/TrackingContext';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE        = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;
const SESSION_KEY     = 'fastoosh_sid';
const UTM_STORAGE_KEY = 'fastoosh_utm';

// Periodic flush: 3 s catches mobile bounces before the 15 s back-off window
const FLUSH_EVERY = 3_000;

// Back-off: doubles on consecutive failures, capped at 5 min
const BACKOFF_BASE = 15_000;
const BACKOFF_MAX  = 300_000;

// ── Device helpers ─────────────────────────────────────────────────────────────
function getDevice(): 'mobile' | 'tablet' | 'desktop' {
  const w = window.innerWidth;
  if (w < 768)  return 'mobile';
  if (w < 1024) return 'tablet';
  return 'desktop';
}
function getBrowser(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Edg'))     return 'Edge';
  if (ua.includes('Chrome'))  return 'Chrome';
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Safari'))  return 'Safari';
  return 'Other';
}
function getOS(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Windows'))                       return 'Windows';
  if (ua.includes('Mac OS X'))                      return 'macOS';
  if (ua.includes('iPhone') || ua.includes('iPad')) return 'iOS';
  if (ua.includes('Android'))                       return 'Android';
  if (ua.includes('Linux'))                         return 'Linux';
  return 'Other';
}
function genId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9);
}

// ── Provider ───────────────────────────────────────────────────────────────────
export function TrackingProvider({ children }: { children: ReactNode }) {
  const [sessionId, setSessionId] = useState('');
  const sidRef       = useRef('');
  const queueRef     = useRef<any[]>([]);
  const userRef      = useRef<{ userId?: string; email?: string }>({});
  const failCountRef = useRef(0);
  const nextFlushRef = useRef<number>(0);
  const utmRef       = useRef<{ utmSource?: string; utmMedium?: string; utmCampaign?: string }>({});

  // ── flushRef ──────────────────────────────────────────────────────────────────
  // A stable ref that always points to the latest `flush` function.
  // Used by the init effect (defined before flush in source) to avoid the
  // TypeScript temporal-dead-zone error while still calling flush correctly.
  const flushRef = useRef<() => Promise<void>>(async () => {});

  // ── Init: session ID + UTM capture ───────────────────────────────────────────
  // IMPORTANT: React fires child effects BEFORE parent effects.
  // Construction.tsx (child) calls track() + flush() before this effect runs,
  // meaning sidRef.current is still '' and flush() exits early.
  // Fix: schedule an early flush in the next event-loop tick via flushRef.
  // By then sidRef is set and all child page_view events are in the queue.
  useEffect(() => {
    let sid = localStorage.getItem(SESSION_KEY);
    if (!sid) { sid = genId(); localStorage.setItem(SESSION_KEY, sid); }
    sidRef.current = sid;
    setSessionId(sid);

    // Capture UTM params before SPA routing can strip them
    const sp  = new URLSearchParams(window.location.search);
    const src = sp.get('utm_source')   || undefined;
    const med = sp.get('utm_medium')   || undefined;
    const cmp = sp.get('utm_campaign') || undefined;

    if (src || med || cmp) {
      utmRef.current = { utmSource: src, utmMedium: med, utmCampaign: cmp };
      try { sessionStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(utmRef.current)); } catch {}
    } else {
      try {
        const stored = sessionStorage.getItem(UTM_STORAGE_KEY);
        if (stored) utmRef.current = JSON.parse(stored);
      } catch {}
    }

    // ── Early flush ───────────────────────────────────────────────────────────
    // setTimeout(fn, 0) runs in the next macrotask — after ALL effects (child
    // and parent) have fired. By then: sidRef is set, UTM is captured, and the
    // queue has every event tracked synchronously in child effects.
    const earlyFlush = setTimeout(() => flushRef.current(), 0);
    return () => clearTimeout(earlyFlush);
  }, []);

  // ── Flush (fetch + keepalive) ─────────────────────────────────────────────────
  // keepalive: true lets the browser keep the request alive after page unload.
  // This is the correct replacement for sendBeacon when custom headers are needed.
  // NOTE: sendBeacon cannot send headers — Supabase gateway requires
  //       Authorization: Bearer <anonKey> or it returns 401 before reaching Hono.
  //       Using fetch + keepalive everywhere avoids that silent failure.
  const flush = useCallback(async () => {
    if (!sidRef.current || queueRef.current.length === 0) return;
    if (Date.now() < nextFlushRef.current) return;

    const events = [...queueRef.current];
    queueRef.current = [];

    try {
      const res = await fetch(`${API_BASE}/track/event`, {
        method:    'POST',
        keepalive: true,
        headers:   { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
        body: JSON.stringify({
          sessionId: sidRef.current,
          events,
          meta: {
            userId:      userRef.current.userId,
            userEmail:   userRef.current.email,
            device:      getDevice(),
            browser:     getBrowser(),
            os:          getOS(),
            referrer:    document.referrer || '',
            screenWidth: window.innerWidth,
            language:    navigator.language,
            utmSource:   utmRef.current.utmSource,
            utmMedium:   utmRef.current.utmMedium,
            utmCampaign: utmRef.current.utmCampaign,
          },
        }),
      });

      if (!res.ok) {
        queueRef.current = [...events, ...queueRef.current];
        failCountRef.current += 1;
        const backoff = Math.min(BACKOFF_BASE * 2 ** (failCountRef.current - 1), BACKOFF_MAX);
        nextFlushRef.current = Date.now() + backoff;
        console.debug(`[Tracker] server error ${res.status}, backing off ${backoff / 1000}s`);
        return;
      }

      failCountRef.current = 0;
      nextFlushRef.current = 0;
    } catch {
      queueRef.current = [...events, ...queueRef.current];
      failCountRef.current += 1;
      const backoff = Math.min(BACKOFF_BASE * 2 ** (failCountRef.current - 1), BACKOFF_MAX);
      nextFlushRef.current = Date.now() + backoff;
      console.debug(`[Tracker] network unavailable, retrying in ${backoff / 1000}s`);
    }
  }, []);

  // Keep flushRef pointing at the latest flush (needed by the init effect above)
  useEffect(() => { flushRef.current = flush; }, [flush]);

  // ── Track ─────────────────────────────────────────────────────────────────────
  const track = useCallback((type: string, data: Record<string, any> = {}) => {
    queueRef.current.push({ type, timestamp: new Date().toISOString(), data });
    if (['buy_click', 'purchase_complete', 'video_play', 'free_download'].includes(type)) {
      flush();
    }
  }, [flush]);

  const setUser = useCallback((userId: string, email: string) => {
    userRef.current = { userId, email };
  }, []);

  // ── Periodic flush (3 s) ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId) return;
    const id = setInterval(flush, FLUSH_EVERY);
    return () => clearInterval(id);
  }, [sessionId, flush]);

  // ── Force-flush: bypass back-off ──────────────────────────────────────────────
  // Used on page-exit events where we MUST flush regardless of back-off state.
  // Back-off only matters between retries — on page exit, send now or lose data.
  const forceFlush = useCallback(() => {
    nextFlushRef.current = 0; // override any active back-off period
    flush();
  }, [flush]);

  // ── Page lifecycle listeners ──────────────────────────────────────────────────
  // beforeunload   — desktop browsers (Chrome/Firefox/Edge)
  // pagehide       — iOS Safari & Android Chrome (fires on back/close, not unload)
  // visibilitychange → hidden — app backgrounded on any mobile OS
  // All three call forceFlush so no exit path is missed.
  // We use fetch+keepalive (NOT sendBeacon) because Supabase gateway requires
  // the Authorization header, which sendBeacon cannot send.
  useEffect(() => {
    const onExit = () => forceFlush();
    const onVis  = () => { if (document.visibilityState === 'hidden') forceFlush(); };

    window.addEventListener('beforeunload',       onExit);
    window.addEventListener('pagehide',           onExit);
    document.addEventListener('visibilitychange', onVis);

    return () => {
      window.removeEventListener('beforeunload',       onExit);
      window.removeEventListener('pagehide',           onExit);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [forceFlush]);

  return (
    <TrackingContext.Provider value={{ sessionId, track, setUser, flush }}>
      {children}
    </TrackingContext.Provider>
  );
}
