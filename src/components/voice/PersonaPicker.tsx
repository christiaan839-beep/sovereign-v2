"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect } from "react";
import { PERSONAS, PERSONA_ORDER, type PersonaId } from "@/lib/voice-personas";

/**
 * PersonaPicker — dropdown for choosing one of the 6 voice personas.
 *
 * Compact button that expands to a list on click. Shows name + a
 * one-line description per option so users don't have to memorize
 * internal IDs.
 */

interface Props {
  value: PersonaId;
  onChange: (id: PersonaId) => void;
  disabled?: boolean;
}

export function PersonaPicker({ value, onChange, disabled = false }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onClick);
    return () => window.removeEventListener("mousedown", onClick);
  }, [open]);

  const current = PERSONAS[value] ?? PERSONAS.default;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => !disabled && setOpen((v) => !v)}
        disabled={disabled}
        className="group inline-flex items-center gap-2 px-3 py-1.5 rounded-[4px] border border-white/[0.08] bg-white/[0.02] hover:border-[#B5532C]/40 transition-colors disabled:opacity-50"
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="font-mono text-[10px] tracking-[0.18em] uppercase text-neutral-500">
          Persona
        </span>
        <span className="text-[13px] text-white tracking-tight">{current.name}</span>
        <svg
          width="9"
          height="9"
          viewBox="0 0 9 9"
          className={`text-neutral-500 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        >
          <path
            d="M1.5 3l3 3 3-3"
            stroke="currentColor"
            strokeWidth="1.2"
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            role="listbox"
            className="absolute z-30 mt-1.5 left-0 w-[280px] rounded-[6px] border border-white/[0.08] bg-[#0A0807]/95 backdrop-blur-xl shadow-[0_24px_64px_-12px_rgba(0,0,0,0.85)] overflow-hidden"
          >
            {PERSONA_ORDER.map((id) => {
              const p = PERSONAS[id];
              const selected = id === value;
              return (
                <li key={id} role="option" aria-selected={selected}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(id);
                      setOpen(false);
                    }}
                    className={`w-full px-4 py-2.5 text-left transition-colors border-l-2 ${
                      selected
                        ? "border-[#B5532C] bg-[#B5532C]/[0.06]"
                        : "border-transparent hover:bg-white/[0.03]"
                    }`}
                  >
                    <p
                      className={`text-[13px] tracking-tight ${
                        selected ? "text-[#B5532C]" : "text-white"
                      }`}
                    >
                      {p.name}
                    </p>
                    <p className="mt-0.5 text-[11px] text-neutral-500 leading-snug">
                      {p.description}
                    </p>
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
