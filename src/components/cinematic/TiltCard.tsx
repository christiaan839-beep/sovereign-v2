"use client";

import { useRef, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useIsMobile } from "@/lib/hooks/use-is-mobile";

interface TiltCardProps {
  children: ReactNode;
  className?: string;
  maxTilt?: number;
}

export function TiltCard({ children, className = "", maxTilt = 8 }: TiltCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [spotlight, setSpotlight] = useState({ x: 50, y: 50 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMove = (e: React.MouseEvent) => {
    if (isMobile || !ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const x = ((e.clientY - centerY) / (rect.height / 2)) * -maxTilt;
    const y = ((e.clientX - centerX) / (rect.width / 2)) * maxTilt;
    setTilt({ x, y });
    setSpotlight({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  const handleLeave = () => {
    setTilt({ x: 0, y: 0 });
    setIsHovered(false);
  };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={handleLeave}
      className={`relative ${className}`}
      style={{
        perspective: "1000px",
      }}
      animate={{
        rotateX: tilt.x,
        rotateY: tilt.y,
      }}
      transition={{ type: "spring", damping: 20, stiffness: 200 }}
    >
      {/* Cursor spotlight */}
      {isHovered && (
        <div
          className="absolute inset-0 rounded-2xl pointer-events-none z-10 transition-opacity duration-300"
          style={{
            background: `radial-gradient(400px circle at ${spotlight.x}% ${spotlight.y}%, rgba(16,185,129,0.06), transparent 60%)`,
          }}
        />
      )}
      {children}
    </motion.div>
  );
}
