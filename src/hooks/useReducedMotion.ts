"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Subscribe to the user's `prefers-reduced-motion` setting.
 *
 * Why useSyncExternalStore (not useState + useEffect):
 *   The textbook external-store pattern. The pre-React-18 idiom
 *   (`const [r, setR] = useState(false); useEffect(() => setR(mq.matches), [])`)
 *   triggers React 19's `react-hooks/set-state-in-effect` warning AND
 *   it shows the wrong value for one frame on hydration (server snap
 *   defaults to false, client mount flips to whatever the user
 *   actually has).
 *
 *   `useSyncExternalStore` solves both: setState moves into a
 *   subscribe-callback that React understands as an external sync
 *   point, and the snapshot is read during render so hydration
 *   shows the correct value immediately.
 *
 * Why this lives in src/hooks/ (not inline in each component):
 *   10 components in this codebase implement their own variant of
 *   this hook (grep `prefers-reduced-motion`). Centralizing means a
 *   single fix for the lint rule and a single source of truth for
 *   "should we animate?" — components should import this rather
 *   than write their own.
 *
 * SSR snapshot defaults to `false` (motion enabled) — desktop-first.
 * Hydration corrects to the user's actual setting on first paint
 * without flicker.
 */
export function useReducedMotion(): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    if (typeof window === "undefined" || !window.matchMedia) {
      return () => {};
    }
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const getSnapshot = useCallback((): boolean => {
    if (typeof window === "undefined" || !window.matchMedia) return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  const getServerSnapshot = useCallback((): boolean => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
