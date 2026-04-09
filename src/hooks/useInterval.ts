import { useEffect, useRef } from "react";

/**
 * useInterval — Safe interval hook with automatic cleanup.
 * Prevents memory leaks from orphaned intervals.
 * Pass null as delay to pause the interval.
 */
export function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (delay === null) return;
    const id = setInterval(() => savedCallback.current(), delay);
    return () => clearInterval(id);
  }, [delay]);
}
