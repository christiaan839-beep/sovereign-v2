"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Returns true when the viewport is mobile-sized OR has touch input.
 *
 * Uses useSyncExternalStore (React 18+) — the textbook external-store
 * pattern. Setting state via the subscribe-callback (rather than
 * useState + useEffect + setState) eliminates the
 * react-hooks/set-state-in-effect lint warning AND gives a correct
 * SSR snapshot for free (no hydration flicker between desktop default
 * and the user's actual viewport).
 *
 * SSR snapshot defaults to `false` (desktop-first). Hydration corrects
 * on the client without flicker.
 */
export function useIsMobile(): boolean {
  const subscribe = useCallback((onChange: () => void) => {
    if (typeof window === "undefined") return () => {};
    window.addEventListener("resize", onChange);
    return () => window.removeEventListener("resize", onChange);
  }, []);

  const getSnapshot = useCallback((): boolean => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < 768 || "ontouchstart" in window;
  }, []);

  const getServerSnapshot = useCallback((): boolean => false, []);

  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
