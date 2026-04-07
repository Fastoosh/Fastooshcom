import { createContext } from 'react';

export interface TrackFn {
  (type: string, data?: Record<string, any>): void;
}

export interface TrackingCtx {
  sessionId: string;
  track: TrackFn;
  /** Call when user identity is known (after sign-in / auth check) */
  setUser: (userId: string, email: string) => void;
  /** Force-flush the event queue now */
  flush: () => void;
}

export const TrackingContext = createContext<TrackingCtx>({
  sessionId: '',
  track:   () => {},
  setUser: () => {},
  flush:   () => {},
});
