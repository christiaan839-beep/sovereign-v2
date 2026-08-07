"use client";

import { useState } from "react";
import { Send, Sparkles, StickyNote } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { VoiceCanvas } from "./VoiceCanvas";

const VIBE_PRESETS = [
  { id: "minimalist", label: "Minimalist", desc: "Clean, whitespace-heavy" },
  { id: "premium", label: "Premium", desc: "Luxury, dark, sophisticated" },
  { id: "playful", label: "Playful", desc: "Colorful, rounded, fun" },
  { id: "corporate", label: "Corporate", desc: "Professional, structured" },
  { id: "brutalist", label: "Brutalist", desc: "Raw, bold, stark" },
  { id: "gen-z", label: "Gen Z", desc: "Trendy, gradient-heavy, modern" },
];

interface VibeBarProps {
  onGenerate: (prompt: string, vibe: string) => void;
  onAddNote: () => void;
  generating: boolean;
}

export function VibeBar({ onGenerate, onAddNote, generating }: VibeBarProps) {
  const [prompt, setPrompt] = useState("");
  const [selectedVibe, setSelectedVibe] = useState("premium");
  const [showVibes, setShowVibes] = useState(false);

  const handleSubmit = () => {
    if (!prompt.trim() || generating) return;
    onGenerate(prompt.trim(), selectedVibe);
    setPrompt("");
  };

  const handleVoiceResult = (text: string) => {
    setPrompt(text);
    // Auto-submit after short delay to let user see the transcript
    setTimeout(() => {
      if (text.trim()) {
        onGenerate(text.trim(), selectedVibe);
        setPrompt("");
      }
    }, 800);
  };

  const activeVibe = VIBE_PRESETS.find((v) => v.id === selectedVibe);

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4">
      {/* Vibe selector */}
      <AnimatePresence>
        {showVibes && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="mb-3 flex flex-wrap gap-2 justify-center"
          >
            {VIBE_PRESETS.map((vibe) => (
              <button
                key={vibe.id}
                onClick={() => {
                  setSelectedVibe(vibe.id);
                  setShowVibes(false);
                }}
                className={`px-3 py-1.5 rounded-full text-[10px] font-semibold transition-gpu ${
                  selectedVibe === vibe.id
                    ? "bg-[#00B7FF]/15 text-[#00B7FF] border border-[#00B7FF]/30"
                    : "bg-white/[0.04] text-neutral-400 border border-white/[0.06] hover:border-white/[0.12] hover:text-white"
                }`}
                title={vibe.desc}
              >
                {vibe.label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main input bar */}
      <div className="flex items-center gap-2 p-2 rounded-2xl bg-[#0A0A0A]/90 backdrop-blur-2xl border border-white/[0.08] shadow-2xl shadow-black/40">
        {/* Note button */}
        <button
          onClick={onAddNote}
          className="p-2.5 rounded-xl hover:bg-white/[0.05] text-neutral-500 hover:text-amber-400 transition-colors shrink-0"
          title="Add note"
        >
          <StickyNote className="w-4 h-4" />
        </button>

        {/* Vibe button */}
        <button
          onClick={() => setShowVibes(!showVibes)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-semibold shrink-0 transition-gpu ${
            showVibes
              ? "bg-[#00B7FF]/10 text-[#00B7FF] border border-[#00B7FF]/20"
              : "bg-white/[0.04] text-neutral-400 border border-white/[0.06] hover:text-white"
          }`}
        >
          <Sparkles className="w-3 h-3" />
          {activeVibe?.label || "Vibe"}
        </button>

        {/* Text input */}
        <input
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Describe what you want to build..."
          disabled={generating}
          className="flex-1 bg-transparent text-sm text-white placeholder-neutral-600 outline-none px-2 disabled:opacity-50"
        />

        {/* Voice button */}
        <VoiceCanvas onResult={handleVoiceResult} disabled={generating} />

        {/* Send */}
        <button
          onClick={handleSubmit}
          disabled={!prompt.trim() || generating}
          className="p-2.5 rounded-xl bg-[#00B7FF] text-white hover:bg-[#33C5FF] disabled:opacity-30 transition-gpu shrink-0"
        >
          {generating ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <Send className="w-4 h-4" />
          )}
        </button>
      </div>
    </div>
  );
}
