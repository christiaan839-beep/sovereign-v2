"use client";

import { useEffect, useRef, useState } from "react";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#$%&*+=<>{}[]|/\\~^";

/**
 * TextDecrypt — Text scrambles through random glyphs before resolving.
 * Like a terminal decrypting a classified message.
 * Triggers on viewport entry (IntersectionObserver).
 */
export function TextDecrypt({
  text,
  className = "",
  as: Tag = "span",
  speed = 30,
  delay = 0,
}: {
  text: string;
  className?: string;
  as?: "h1" | "h2" | "h3" | "p" | "span" | "div";
  speed?: number;
  delay?: number;
}) {
  const [display, setDisplay] = useState(text.replace(/\S/g, " "));
  const [started, setStarted] = useState(false);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!ref.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started) {
          setStarted(true);
        }
      },
      { threshold: 0.3 }
    );
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [started]);

  useEffect(() => {
    if (!started) return;

    const chars = text.split("");
    let iteration = 0;
    const maxIterations = chars.length + 15; // extra scramble cycles

    const timeout = setTimeout(() => {
      const interval = setInterval(() => {
        const result = chars.map((char, i) => {
          // Spaces stay as spaces
          if (char === " ") return " ";
          // Already resolved
          if (i < iteration - 8) return char;
          // Scrambling
          return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
        });

        setDisplay(result.join(""));
        iteration += 1;

        if (iteration > maxIterations) {
          clearInterval(interval);
          setDisplay(text); // ensure final state is exact
        }
      }, speed);

      return () => clearInterval(interval);
    }, delay);

    return () => clearTimeout(timeout);
  }, [started, text, speed, delay]);

  return (
    <Tag
      ref={ref as React.Ref<never>}
      className={`${className} font-mono`}
      style={{ fontVariantNumeric: "tabular-nums" }}
    >
      {display}
    </Tag>
  );
}
