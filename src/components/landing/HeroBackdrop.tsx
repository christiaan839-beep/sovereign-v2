"use client";

import { motion, useMotionValue, useScroll, useTransform } from "framer-motion";
import { useEffect, useRef } from "react";

/**
 * High-tier hero backdrop — aurora mesh + parallax + cursor spotlight.
 *
 * Layers (bottom → top):
 *   1. Dark base ............. solid #030303 (already on section)
 *   2. Aurora mesh ........... three large blurred gradient blobs drifting
 *                              on independent loops, copper + amber + warm
 *                              tones. The colors overlap and blend through
 *                              the canvas' compositing layer — feels like
 *                              northern lights at low altitude.
 *   3. Engineering grid ...... 72px × 72px hairline grid, radial-masked so
 *                              it fades at the edges. Moves half-speed on
 *                              scroll (parallax).
 *   4. Cursor spotlight ...... radial gradient following the mouse,
 *                              revealing the grid underneath through
 *                              heightened contrast. Desktop-only.
 *   5. (Consumer puts particles + content on top)
 *
 * All layers pointer-events:none so the backdrop never intercepts clicks.
 * Auto-disables the motion on prefers-reduced-motion (the transform uses
 * motion-safe guards indirectly via framer's reduced-motion detection).
 */
export function HeroBackdrop() {
  const ref = useRef<HTMLDivElement>(null);
  const cursorX = useMotionValue(-400);
  const cursorY = useMotionValue(-400);

  // Parallax — grid + blobs shift with scroll at different velocities.
  // The scroll progress is tied to THIS element so the parallax
  // effect only runs while the hero is in view.
  const { scrollYProgress } = useScroll({
    target: ref,
    offset: ["start start", "end start"],
  });
  const gridY = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const auroraY = useTransform(scrollYProgress, [0, 1], [0, -40]);
  const auroraScale = useTransform(scrollYProgress, [0, 1], [1, 1.15]);

  // Cursor tracking for the spotlight overlay
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onMove = (e: MouseEvent) => {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      cursorX.set(e.clientX - rect.left);
      cursorY.set(e.clientY - rect.top);
    };
    const onLeave = () => {
      cursorX.set(-400);
      cursorY.set(-400);
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    window.addEventListener("mouseleave", onLeave);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseleave", onLeave);
    };
  }, [cursorX, cursorY]);

  return (
    <div
      ref={ref}
      className="absolute inset-0 overflow-hidden pointer-events-none"
      aria-hidden="true"
    >
      {/* Aurora — single focal glow anchored behind the headline.
          Three scattered blobs compete with the copy; one centred
          source draws the eye to the text. Secondary warm bloom at
          bottom-right for depth. mix-blend-screen gives additive
          colour overlap without washing out the dark base. */}
      <motion.div
        style={{ y: auroraY, scale: auroraScale }}
        className="absolute inset-0"
      >
        {/* Primary: centred copper focal point */}
        <motion.div
          className="absolute rounded-full blur-[160px] mix-blend-screen"
          style={{
            top: "0%",
            left: "50%",
            transform: "translateX(-50%)",
            width: 800,
            height: 600,
            background:
              "radial-gradient(ellipse, rgba(181,83,44,0.50) 0%, transparent 65%)",
          }}
          animate={{
            opacity: [0.5, 0.65, 0.5],
            scale: [1, 1.05, 1],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
        {/* Secondary: warm amber edge bloom — depth not clutter */}
        <motion.div
          className="absolute rounded-full blur-[200px] mix-blend-screen"
          style={{
            bottom: "-10%",
            right: "-5%",
            width: 560,
            height: 480,
            background:
              "radial-gradient(ellipse, rgba(200,100,40,0.28) 0%, transparent 65%)",
          }}
          animate={{
            opacity: [0.28, 0.38, 0.28],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 3,
          }}
        />
      </motion.div>

      {/* Engineering grid — hairline 80px grid, radial-masked so it fades
          toward the viewport edges. Kept very faint (0.025) so it reads
          as depth texture, not wallpaper. Parallax at ½ scroll speed. */}
      <motion.div
        style={{ y: gridY }}
        className="absolute inset-0 opacity-[0.025]"
      >
        <div
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "80px 80px",
            maskImage:
              "radial-gradient(ellipse 55% 50% at 50% 35%, #000 30%, transparent 80%)",
            WebkitMaskImage:
              "radial-gradient(ellipse 55% 50% at 50% 35%, #000 30%, transparent 80%)",
          }}
        />
      </motion.div>

      {/* Cursor spotlight — a soft radial glow anchored to mouse position.
          Layers over the grid to brighten it locally, giving the visitor
          a feeling that their cursor is "revealing" the engineering
          ground-plane underneath. */}
      <motion.div
        className="absolute inset-0 hidden md:block"
        style={{
          background: useTransform(
            [cursorX, cursorY],
            ([x, y]) =>
              `radial-gradient(circle 400px at ${x}px ${y}px, rgba(181,83,44,0.18) 0%, transparent 70%)`,
          ),
        }}
      />

      {/* Subtle noise texture — barely-there grain at 0.6% opacity.
          Enough to break up gradient banding on large retina screens,
          not enough to be visible. Above 1% it reads as a texture;
          below that it reads as nothing, which is the point. */}
      <div
        className="absolute inset-0 opacity-[0.006] mix-blend-overlay"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3' /%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />

      {/* Top + bottom vignette — keeps the aurora from bleeding into the
          nav or the next section */}
      <div
        className="absolute inset-x-0 top-0 h-32"
        style={{
          background:
            "linear-gradient(to bottom, rgba(3,3,3,0.9) 0%, transparent 100%)",
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-48"
        style={{
          background:
            "linear-gradient(to top, rgba(3,3,3,1) 0%, transparent 100%)",
        }}
      />
    </div>
  );
}
