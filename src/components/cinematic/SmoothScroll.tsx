"use client";

import { useEffect, useRef } from "react";

/**
 * SmoothScroll — Lenis-powered buttery smooth scrolling.
 *
 * This is what makes Google Antigravity feel "floaty". Instead of
 * native browser scroll, Lenis interpolates scroll position with
 * easing, making the page feel like it's gliding through space.
 *
 * Just mount this component once (in the landing page) and the
 * entire page gets smooth scrolling. No wrapper div needed.
 *
 * Auto-disables on mobile (native scroll is better on touch).
 */
export function SmoothScroll() {
  const lenisRef = useRef<InstanceType<typeof import("lenis").default> | null>(null);

  useEffect(() => {
    // Skip on mobile — native scroll is better for touch
    if (window.innerWidth < 768 || "ontouchstart" in window) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let raf: number;

    const init = async () => {
      const Lenis = (await import("lenis")).default;

      const lenis = new Lenis({
        duration: 1.2,        // scroll duration (higher = smoother/slower)
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)), // exponential ease-out
        orientation: "vertical",
        gestureOrientation: "vertical",
        smoothWheel: true,
        touchMultiplier: 1.5,
      });

      lenisRef.current = lenis;

      function update(time: number) {
        lenis.raf(time);
        raf = requestAnimationFrame(update);
      }
      raf = requestAnimationFrame(update);
    };

    init();

    return () => {
      cancelAnimationFrame(raf);
      lenisRef.current?.destroy();
    };
  }, []);

  return null; // No DOM — Lenis hooks into document scroll
}
