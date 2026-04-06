"use client";

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

/**
 * CURSOR GLOW — Follows the mouse with a soft emerald glow.
 * Creates a "the page is alive and watching" effect.
 * Only renders on desktop (no touch devices).
 */

export function CursorGlow() {
  const [visible, setVisible] = useState(false);
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const springX = useSpring(mouseX, { damping: 25, stiffness: 200 });
  const springY = useSpring(mouseY, { damping: 25, stiffness: 200 });

  useEffect(() => {
    // Only on desktop
    if ("ontouchstart" in window) return;

    const handleMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
      if (!visible) setVisible(true);
    };

    const handleLeave = () => setVisible(false);
    const handleEnter = () => setVisible(true);

    window.addEventListener("mousemove", handleMove);
    document.addEventListener("mouseleave", handleLeave);
    document.addEventListener("mouseenter", handleEnter);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseleave", handleLeave);
      document.removeEventListener("mouseenter", handleEnter);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!visible) return null;

  return (
    <motion.div
      className="pointer-events-none fixed z-[9998] mix-blend-screen"
      style={{
        left: springX,
        top: springY,
        x: "-50%",
        y: "-50%",
      }}
    >
      {/* Outer glow */}
      <div className="w-[400px] h-[400px] rounded-full bg-emerald-500/[0.03] blur-[80px]" />
      {/* Inner glow */}
      <div className="absolute inset-[140px] rounded-full bg-emerald-400/[0.06] blur-[40px]" />
    </motion.div>
  );
}
