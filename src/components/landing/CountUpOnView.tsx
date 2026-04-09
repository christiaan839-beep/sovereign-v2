"use client";

import { useRef, useState, useEffect } from "react";
import { useInView } from "framer-motion";

// ─── Count Up On View ───
export function CountUpOnView({ target, suffix = "", prefix = "", duration = 1.5 }: { target: number; suffix?: string; prefix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  // Start at target (not 0) to prevent flash-of-zero before hydration/viewport
  const [value, setValue] = useState(target);

  useEffect(() => {
    if (!isInView) return;
    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [isInView, target, duration]);

  return <span ref={ref}>{prefix}{value.toLocaleString()}{suffix}</span>;
}

// ─── Time Count Up (mm:ss format) ───
export function TimeCountUpOnView({ minutes, seconds, duration = 1.5 }: { minutes: number; seconds: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const totalTarget = minutes * 60 + seconds;
  const [totalSec, setTotalSec] = useState(0);

  useEffect(() => {
    if (!isInView) return;
    const start = performance.now();
    const animate = (now: number) => {
      const progress = Math.min((now - start) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setTotalSec(Math.round(eased * totalTarget));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [isInView, totalTarget, duration]);

  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return <span ref={ref}>{m}m {s.toString().padStart(2, "0")}s</span>;
}
