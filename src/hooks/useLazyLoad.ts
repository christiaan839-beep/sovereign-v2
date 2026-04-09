import { useState, useEffect, useRef } from "react";

/**
 * useLazyLoad — Only render a component when it enters the viewport.
 * Reduces initial bundle load by deferring below-fold heavy components.
 *
 * Usage:
 *   const { ref, shouldLoad } = useLazyLoad({ rootMargin: "200px" });
 *   return <div ref={ref}>{shouldLoad && <HeavyComponent />}</div>
 */
export function useLazyLoad(options?: { rootMargin?: string; threshold?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (!ref.current || shouldLoad) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: options?.rootMargin || "300px", threshold: options?.threshold || 0 }
    );

    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [shouldLoad, options?.rootMargin, options?.threshold]);

  return { ref, shouldLoad };
}
