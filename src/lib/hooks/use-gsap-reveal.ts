"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

/**
 * GSAP ScrollTrigger reveal — cinematic scale-up + fade-in
 * when an element scrolls into view. More dramatic than
 * framer-motion's whileInView for hero sections.
 */
export function useGsapReveal<T extends HTMLElement = HTMLDivElement>(
  options?: { scale?: number; duration?: number; delay?: number }
) {
  const ref = useRef<T>(null);
  const { scale = 0.92, duration = 1.0, delay = 0 } = options || {};

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    gsap.fromTo(
      el,
      { opacity: 0, scale, y: 40 },
      {
        opacity: 1,
        scale: 1,
        y: 0,
        duration,
        delay,
        ease: "power3.out",
        scrollTrigger: {
          trigger: el,
          start: "top 85%",
          toggleActions: "play none none none",
        },
      }
    );

    return () => {
      ScrollTrigger.getAll().forEach((t) => {
        if (t.trigger === el) t.kill();
      });
    };
  }, [scale, duration, delay]);

  return ref;
}
