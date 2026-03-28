"use client";

import { useState, useEffect, useCallback } from "react";

const WORDS = ["workforce.", "co-pilot.", "advantage.", "future."];
const CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%";
const SCRAMBLE_SPEED = 30;
const REVEAL_SPEED = 50;
const HOLD_TIME = 6000;

export function TextMorph() {
  const [display, setDisplay] = useState(WORDS[0]);
  const [wordIndex, setWordIndex] = useState(0);

  const scrambleToWord = useCallback((target: string) => {
    let iteration = 0;
    const maxLen = Math.max(display.length, target.length);

    const interval = setInterval(() => {
      setDisplay(
        target.split("").map((char, i) => {
          if (i < iteration) return char;
          return CHARS[Math.floor(Math.random() * CHARS.length)];
        }).join("").slice(0, Math.max(iteration + 3, target.length))
      );

      iteration += 1 / 2;

      if (iteration >= target.length) {
        clearInterval(interval);
        setDisplay(target);
      }
    }, SCRAMBLE_SPEED);

    return () => clearInterval(interval);
  }, [display.length]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const nextIndex = (wordIndex + 1) % WORDS.length;
      setWordIndex(nextIndex);
      scrambleToWord(WORDS[nextIndex]);
    }, HOLD_TIME);

    return () => clearTimeout(timeout);
  }, [wordIndex, scrambleToWord]);

  return (
    <span className="inline-block min-w-[200px] text-left">
      {display}
    </span>
  );
}
