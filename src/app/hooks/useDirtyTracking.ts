import { useCallback, useEffect, useRef } from 'react';

// Reports whether `value` differs from what the form loaded with.
// The baseline is taken shortly after mount so normalisation effects that run
// on load don't count as edits. Returns markSaved(), to call after a
// successful save so the current state becomes the new baseline.
export function useDirtyTracking(value: unknown, onDirtyChange?: (dirty: boolean) => void) {
  const baseline = useRef<string | null>(null);
  const latest = useRef(value);
  latest.current = value;

  useEffect(() => {
    const t = window.setTimeout(() => { baseline.current = JSON.stringify(latest.current); }, 400);
    return () => { window.clearTimeout(t); onDirtyChange?.(false); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (baseline.current === null) return;
    onDirtyChange?.(JSON.stringify(value) !== baseline.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return useCallback(() => {
    baseline.current = JSON.stringify(latest.current);
    onDirtyChange?.(false);
  }, [onDirtyChange]);
}
