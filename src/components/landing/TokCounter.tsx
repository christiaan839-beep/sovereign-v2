"use client";

import { useState, useEffect } from "react";

// ─── Tok/s counter — must be defined in same file to avoid Turbopack HMR stale module ───
export function TokCounter() {
  const [tok, setTok] = useState(2247);
  useEffect(() => {
    const iv = setInterval(() => setTok(2180 + Math.floor(Math.random() * 120)), 400);
    return () => clearInterval(iv);
  }, []);
  return (
    <span className="hidden md:flex items-center gap-1.5 font-mono tabular-nums text-xs text-neutral-500">
      <span className="relative flex h-1.5 w-1.5">
        <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-70" />
        <span className="relative rounded-full h-1.5 w-1.5 bg-emerald-400" />
      </span>
      <span className="text-emerald-400/80">{tok.toLocaleString()} tok/s</span>
    </span>
  );
}
