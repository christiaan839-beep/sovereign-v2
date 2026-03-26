"use client";

import { useEffect, useState } from "react";
import { motion, useSpring } from "framer-motion";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";

export function CustomCursor() {
  const isMobile = useIsMobile();
  const [isHovering, setIsHovering] = useState(false);
  const [isClicking, setIsClicking] = useState(false);

  const springConfig = { damping: 30, stiffness: 400 };
  const ringSpring = { damping: 20, stiffness: 200 };

  const dotX = useSpring(0, springConfig);
  const dotY = useSpring(0, springConfig);
  const ringX = useSpring(0, ringSpring);
  const ringY = useSpring(0, ringSpring);

  useEffect(() => {
    if (isMobile) return;

    const move = (e: MouseEvent) => {
      dotX.set(e.clientX);
      dotY.set(e.clientY);
      ringX.set(e.clientX);
      ringY.set(e.clientY);
    };

    const handleOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest("a, button, [role='button'], input, textarea, [data-cursor='pointer']")) {
        setIsHovering(true);
      }
    };

    const handleOut = () => setIsHovering(false);
    const handleDown = () => setIsClicking(true);
    const handleUp = () => setIsClicking(false);

    window.addEventListener("mousemove", move);
    document.addEventListener("mouseover", handleOver);
    document.addEventListener("mouseout", handleOut);
    document.addEventListener("mousedown", handleDown);
    document.addEventListener("mouseup", handleUp);

    // Hide default cursor
    const style = document.createElement("style");
    style.textContent = "* { cursor: none !important; }";
    document.head.appendChild(style);

    return () => {
      window.removeEventListener("mousemove", move);
      document.removeEventListener("mouseover", handleOver);
      document.removeEventListener("mouseout", handleOut);
      document.removeEventListener("mousedown", handleDown);
      document.removeEventListener("mouseup", handleUp);
      style.remove();
    };
  }, [isMobile, dotX, dotY, ringX, ringY]);

  if (isMobile) return null;

  return (
    <>
      {/* Dot */}
      <motion.div
        className="fixed top-0 left-0 pointer-events-none z-[9999] mix-blend-difference"
        style={{
          x: dotX,
          y: dotY,
          translateX: "-50%",
          translateY: "-50%",
        }}
      >
        <motion.div
          className="rounded-full bg-emerald-400"
          animate={{
            width: isHovering ? 4 : isClicking ? 10 : 6,
            height: isHovering ? 4 : isClicking ? 10 : 6,
          }}
          transition={{ type: "spring", damping: 20, stiffness: 300 }}
        />
      </motion.div>

      {/* Ring */}
      <motion.div
        className="fixed top-0 left-0 pointer-events-none z-[9998]"
        style={{
          x: ringX,
          y: ringY,
          translateX: "-50%",
          translateY: "-50%",
        }}
      >
        <motion.div
          className="rounded-full border border-emerald-400/50"
          animate={{
            width: isHovering ? 48 : isClicking ? 32 : 40,
            height: isHovering ? 48 : isClicking ? 32 : 40,
            borderColor: isHovering ? "rgba(16,185,129,0.6)" : "rgba(16,185,129,0.3)",
            boxShadow: isHovering ? "0 0 20px rgba(16,185,129,0.2)" : "none",
          }}
          transition={{ type: "spring", damping: 20, stiffness: 200 }}
        />
      </motion.div>
    </>
  );
}
