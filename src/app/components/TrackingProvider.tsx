import { useRef, useEffect, useState, useCallback, ReactNode } from 'react';
import { TrackingContext } from '../contexts/TrackingContext';
import { projectId, publicAnonKey } from '/utils/supabase/info';

const API_BASE    = `https://${projectId}.supabase.co/functions/v1/make-server-e07959ec`;
const SESSION_KEY = 'fastoosh_sid';
const FLUSH_EVERY = 10_000; // ms — periodic flush interval

// Back-off: how many ms to wait before retrying after a network failure
// Doubles on every consecutive failure, capped at 5 minutes
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
  const sidRef          = useRef('');
  const queueRef        = useRef<any[]>([]);
  const userRef         = useRef<{ userId?: string; email?: string }>({});
  const failCountRef    = useRef(0);          // consecutive network failures
  const nextFlushRef    = useRef<number>(0);  // epoch ms — earliest next flush

  // Init session ID
  useEffect(() => {
    let sid = localStorage.getItem(SESSION_KEY);
    if (!sid) { sid = genId(); localStorage.setItem(SESSION_KEY, sid); }
    sidRef.current = sid;
    setSessionId(sid);
  }, []);

  // ── Flush ────────────────────────────────────────────────────────────────────
  const flush = useCallback(async () => {
    if (!sidRef.current || queueRef.current.length === 0) return;

    // Respect exponential back-off after consecutive failures
    if (Date.now() < nextFlushRef.current) return;

    // Snapshot + clear the queue optimistically
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
            utmSource:   new URLSearchParams(window.location.search).get('utm_source')   || undefined,
            utmMedium:   new URLSearchParams(window.location.search).get('utm_medium')   || undefined,
            utmCampaign: new URLSearchParams(window.location.search).get('utm_campaign') || undefined,
          },
        }),
      });

      if (!res.ok) {
        // HTTP error — restore events so they aren't lost, then back off
        queueRef.current = [...events, ...queueRef.current];
        failCountRef.current += 1;
        const backoff = Math.min(BACKOFF_BASE * 2 ** (failCountRef.current - 1), BACKOFF_MAX);
        nextFlushRef.current = Date.now() + backoff;
        console.debug(`[Tracker] server error ${res.status}, backing off ${backoff / 1000}s`);
        return;
      }

      // Success — reset failure counter
      failCountRef.current = 0;
      nextFlushRef.current = 0;
    } catch {
      // Network-level failure (cold start, offline, CORS preflight, etc.)
      // Restore events so they are retried after back-off
      queueRef.current = [...events, ...queueRef.current];
      failCountRef.current += 1;
      const backoff = Math.min(BACKOFF_BASE * 2 ** (failCountRef.current - 1), BACKOFF_MAX);
      nextFlushRef.current = Date.now() + backoff;
      // Use debug level — this is a non-critical background operation
      console.debug(`[Tracker] network unavailable, retrying in ${backoff / 1000}s`);
    }
  }, []);

  // ── Track ────────────────────────────────────────────────────────────────────
  const track = useCallback((type: string, data: Record<string, any> = {}) => {
    queueRef.current.push({ type, timestamp: new Date().toISOString(), data });
    // Flush immediately for high-priority events
    if (['buy_click', 'purchase_complete', 'video_play', 'free_download'].includes(type)) {
      flush();
    }
  }, [flush]);

  const setUser = useCallback((userId: string, email: string) => {
    userRef.current = { userId, email };
  }, []);

  // Periodic flush
  useEffect(() => {
    if (!sessionId) return;
    const id = setInterval(flush, FLUSH_EVERY);
    return () => clearInterval(id);
  }, [sessionId, flush]);

  // Flush on tab close via sendBeacon (best-effort, no error handling needed)
  useEffect(() => {
    const onUnload = () => {
      if (!sidRef.current || queueRef.current.length === 0) return;
      const payload = JSON.stringify({
        sessionId: sidRef.current,
        events:    queueRef.current,
        meta:      { device: getDevice(), browser: getBrowser(), os: getOS() },
      });
      navigator.sendBeacon(
        `${API_BASE}/track/event`,
        new Blob([payload], { type: 'application/json' }),
      );
    };
    window.addEventListener('beforeunload', onUnload);
    return () => window.removeEventListener('beforeunload', onUnload);
  }, []);

  return (
    <TrackingContext.Provider value={{ sessionId, track, setUser, flush }}>
      {children}
    </TrackingContext.Provider>
  );
}
