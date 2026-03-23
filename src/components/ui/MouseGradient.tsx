"use client";

import { useEffect, useRef, useState } from "react";

export function MouseGradient() {
  const [pos, setPos] = useState({ x: 50, y: 50 });
  const raf = useRef<number>(0);
  const target = useRef({ x: 50, y: 50 });
  const current = useRef({ x: 50, y: 50 });

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      target.current = {
        x: (e.clientX / window.innerWidth) * 100,
        y: (e.clientY / window.innerHeight) * 100,
      };
    };

    const animate = () => {
      // Smooth lerp towards target
      current.current.x += (target.current.x - current.current.x) * 0.04;
      current.current.y += (target.current.y - current.current.y) * 0.04;
      setPos({ x: current.current.x, y: current.current.y });
      raf.current = requestAnimationFrame(animate);
    };

    window.addEventListener("mousemove", handleMove);
    raf.current = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener("mousemove", handleMove);
      cancelAnimationFrame(raf.current);
    };
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
      {/* Primary emerald glow — follows mouse */}
      <div
        className="absolute w-[800px] h-[800px] rounded-full blur-[200px] opacity-[0.07]"
        style={{
          background: "radial-gradient(circle, rgba(16,185,129,1) 0%, rgba(16,185,129,0) 70%)",
          left: `${pos.x}%`,
          top: `${pos.y}%`,
          transform: "translate(-50%, -50%)",
          willChange: "left, top",
        }}
      />
      {/* Secondary cyan accent — offset */}
      <div
        className="absolute w-[600px] h-[600px] rounded-full blur-[180px] opacity-[0.04]"
        style={{
          background: "radial-gradient(circle, rgba(34,211,238,1) 0%, rgba(34,211,238,0) 70%)",
          left: `${pos.x + 15}%`,
          top: `${pos.y - 10}%`,
          transform: "translate(-50%, -50%)",
          willChange: "left, top",
        }}
      />
    </div>
  );
}
