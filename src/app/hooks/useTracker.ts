import { useContext } from 'react';
import { TrackingContext } from '../contexts/TrackingContext';

export function useTracker() {
  return useContext(TrackingContext);
}
