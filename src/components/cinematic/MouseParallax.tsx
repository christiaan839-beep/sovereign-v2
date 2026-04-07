"use client";

import React, { useRef, useState, useEffect } from "react";
import { motion, useMotionValue, useSpring } from "framer-motion";

/**
 * MouseParallax — Wraps children with mouse-tracking parallax depth.
 *
 * Elements shift subtly based on mouse position relative to the section,
 * creating a 3D depth effect. Different `depth` values = different shift amounts.
 *
 * Antigravity pattern: everything feels alive and responsive to the user,
 * not just the hero but the ENTIRE page.
 *
 * Usage:
 *   <MouseParallax depth={0.02}>
 *     <Card />
 *   </MouseParallax>
 */

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768 || "ontouchstart" in window);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return mobile;
}

export function MouseParallax({
  children,
  depth = 0.02,
  className = "",
}: {
  children: React.ReactNode;
  depth?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, { stiffness: 100, damping: 30 });
  const springY = useSpring(y, { stiffness: 100, damping: 30 });
  const isMobile = useIsMobile();

  useEffect(() => {
    if (isMobile) return;

    const handleMouse = (e: MouseEvent) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      // Only react when mouse is near this section
      if (e.clientY < rect.top - 100 || e.clientY > rect.bottom + 100) return;

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      const offsetX = (e.clientX - centerX) * depth;
      const offsetY = (e.clientY - centerY) * depth;
      x.set(offsetX);
      y.set(offsetY);
    };

    window.addEventListener("mousemove", handleMouse);
    return () => window.removeEventListener("mousemove", handleMouse);
  }, [depth, x, y, isMobile]);

  if (isMobile) {
    return <div className={className}>{children}</div>;
  }

  return (
    <motion.div
      ref={ref}
      style={{ x: springX, y: springY }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/**
 * FloatingElement — A single element that drifts slowly + responds to mouse.
 *
 * Use to scatter decorative elements (icons, dots, shapes) across sections.
 * Each element has a unique drift speed and direction.
 */
export function FloatingElement({
  children,
  className = "",
  speed = 1,
  range = 20,
}: {
  children: React.ReactNode;
  className?: string;
  speed?: number;
  range?: number;
}) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const phaseRef = useRef(Math.random() * Math.PI * 2);

  useEffect(() => {
    let frame: number;
    const animate = () => {
      phaseRef.current += 0.005 * speed;
      setOffset({
        x: Math.sin(phaseRef.current) * range,
        y: Math.cos(phaseRef.current * 0.7) * range * 0.6,
      });
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [speed, range]);

  return (
    <div
      className={`${className}`}
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        willChange: "transform",
      }}
    >
      {children}
    </div>
  );
}
