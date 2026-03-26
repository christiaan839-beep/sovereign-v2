"use client";

import { useEffect, useState, useCallback } from "react";

const CHARS = "アイウエオカキクケコ01234567890ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

interface MatrixTextProps {
  words: string[];
  interval?: number;
  className?: string;
  decodeSpeed?: number;
}

export function MatrixText({
  words,
  interval = 8000,
  className = "",
  decodeSpeed = 40,
}: MatrixTextProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [displayText, setDisplayText] = useState(words[0]);
  const [isDecoding, setIsDecoding] = useState(false);

  const decode = useCallback(
    (targetWord: string) => {
      setIsDecoding(true);
      const length = Math.max(displayText.length, targetWord.length);
      const resolved = new Array(length).fill(false);
      let frame = 0;

      const tick = () => {
        frame++;
        const chars = [];

        for (let i = 0; i < length; i++) {
          if (resolved[i]) {
            chars.push(targetWord[i] || "");
          } else if (frame > i * 2 + 8) {
            resolved[i] = true;
            chars.push(targetWord[i] || "");
          } else {
            chars.push(CHARS[Math.floor(Math.random() * CHARS.length)]);
          }
        }

        setDisplayText(chars.join(""));

        if (resolved.every(Boolean)) {
          setIsDecoding(false);
          return;
        }

        setTimeout(tick, decodeSpeed);
      };

      tick();
    },
    [displayText.length, decodeSpeed]
  );

  useEffect(() => {
    // Initial decode
    const initialTimer = setTimeout(() => decode(words[0]), 500);
    return () => clearTimeout(initialTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (words.length <= 1) return;

    const timer = setInterval(() => {
      if (!isDecoding) {
        const nextIndex = (currentIndex + 1) % words.length;
        setCurrentIndex(nextIndex);
        decode(words[nextIndex]);
      }
    }, interval);

    return () => clearInterval(timer);
  }, [currentIndex, words, interval, isDecoding, decode]);

  return <span className={className}>{displayText}</span>;
}
