"use client";

/**
 * CommandPalette — the ⌘K overlay for the Staff Directory.
 *
 * Opens when the user hits ⌘K (or Ctrl+K) anywhere on /agents.
 *
 * Behaviour:
 *   - Fuzzy-ranked search across slug / displayName / tagline / tags.
 *   - Arrow-key navigation over results, Enter to open the agent page.
 *   - Esc to close.
 *   - Autofocuses on open; restores focus on close.
 *   - Rendered as a portal-style fixed overlay at the top of the viewport
 *     (macOS Spotlight–like) — NOT centered; that feels more like an
 *     operator tool and less like a modal dialog.
 *   - Backdrop click closes.
 *
 * Ranking: simple weighted substring match (exact slug > prefix match
 * on displayName > includes on slug/name > tagline > tag > description).
 * Good enough for 200-row datasets; no fuzzysort dependency needed.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicAgent } from "@/lib/agent-catalog";

interface Props {
  open: boolean;
  agents: PublicAgent[];
  onClose: () => void;
}

type Scored = { agent: PublicAgent; score: number };

function scoreAgent(agent: PublicAgent, q: string): number {
  if (!q) return 0;
  const needle = q.toLowerCase();
  const slug = agent.slug.toLowerCase();
  const name = agent.displayName.toLowerCase();
  const tagline = (agent.tagline ?? "").toLowerCase();
  const description = (agent.description ?? "").toLowerCase();

  let score = 0;
  if (slug === needle) score += 100;
  else if (slug.startsWith(needle)) score += 80;
  else if (name.startsWith(needle)) score += 70;
  else if (slug.includes(needle)) score += 55;
  else if (name.includes(needle)) score += 45;

  if (tagline.includes(needle)) score += 20;
  if (description.includes(needle)) score += 10;
  if (agent.tags.some((t) => t.toLowerCase().includes(needle))) score += 15;

  // Feature boost so featured agents bubble up on equal matches.
  if (score > 0 && agent.featured) score += 5;

  return score;
}

const MAX_RESULTS = 8;

export function CommandPalette({ open, agents, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const router = useRouter();

  // Ranked results — top MAX_RESULTS only.
  const results = useMemo<Scored[]>(() => {
    if (!query.trim()) {
      // Empty state: show featured agents as suggestions.
      return agents
        .filter((a) => a.featured)
        .slice(0, MAX_RESULTS)
        .map((agent) => ({ agent, score: 0 }));
    }
    const scored: Scored[] = [];
    for (const agent of agents) {
      const s = scoreAgent(agent, query);
      if (s > 0) scored.push({ agent, score: s });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, MAX_RESULTS);
  }, [agents, query]);

  // Focus the input on open, restore focus on close.
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement | null;
      // Next tick to ensure DOM exists.
      requestAnimationFrame(() => inputRef.current?.focus());
      setQuery("");
      setCursor(0);
      // Lock body scroll while palette is open.
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
      previousFocusRef.current?.focus();
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  // Reset cursor when results change.
  useEffect(() => {
    setCursor(0);
  }, [query]);

  // Keyboard navigation.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, results.length - 1));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        e.preventDefault();
        const chosen = results[cursor]?.agent;
        if (chosen) {
          router.push(`/agents/${chosen.slug}`);
          onClose();
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, cursor, results, router, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[12vh] px-4"
      style={{ background: "rgba(0, 0, 0, 0.65)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div
        className="w-full max-w-[640px] ed-enter"
        style={{
          background: "var(--ed-bg-raised, #131109)",
          border: "1px solid var(--ed-rule, #3a342b)",
          borderRadius: "3px",
          boxShadow: "0 32px 96px -8px rgba(0, 0, 0, 0.7)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Input row */}
        <div className="flex items-center gap-3 px-5 py-4 border-b"
             style={{ borderColor: "var(--ed-rule, #3a342b)" }}>
          <span className="ed-label" style={{ color: "var(--ed-copper, #b5532c)" }}>
            SEARCH
          </span>
          <input
            ref={inputRef}
            type="text"
            placeholder="Find an agent by name, slug, or capability…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="ed-mono flex-1 bg-transparent border-0 outline-none text-[15px] placeholder:opacity-40"
            style={{ color: "var(--ed-ink, #ede5d6)" }}
          />
          <kbd
            className="ed-label px-1.5 py-0.5 border"
            style={{
              borderColor: "var(--ed-rule, #3a342b)",
              color: "var(--ed-ink-dim, #6b6557)",
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results list */}
        <ul className="max-h-[56vh] overflow-y-auto py-2" role="listbox">
          {results.length === 0 ? (
            <li className="px-5 py-6 ed-caption text-center">
              Nothing matches <span className="ed-mono">&ldquo;{query}&rdquo;</span>.
              <br />
              Try a broader term or a category name.
            </li>
          ) : (
            results.map((r, i) => (
              <CommandPaletteRow
                key={r.agent.slug}
                agent={r.agent}
                active={i === cursor}
                onHover={() => setCursor(i)}
                onSelect={() => {
                  router.push(`/agents/${r.agent.slug}`);
                  onClose();
                }}
              />
            ))
          )}
        </ul>

        {/* Footer hints */}
        <div className="flex items-center justify-between px-5 py-3 border-t ed-caption"
             style={{ borderColor: "var(--ed-rule, #3a342b)" }}>
          <div className="flex items-center gap-4">
            <span>
              <kbd className="ed-label border px-1 py-0.5 mr-1" style={{ borderColor: "var(--ed-rule, #3a342b)" }}>↑</kbd>
              <kbd className="ed-label border px-1 py-0.5" style={{ borderColor: "var(--ed-rule, #3a342b)" }}>↓</kbd>
              {" "}navigate
            </span>
            <span>
              <kbd className="ed-label border px-1 py-0.5" style={{ borderColor: "var(--ed-rule, #3a342b)" }}>↵</kbd>
              {" "}open
            </span>
          </div>
          <span>
            {query ? `${results.length} result${results.length === 1 ? "" : "s"}` : "suggested"}
          </span>
        </div>
      </div>
    </div>
  );
}

/* ─── Single row — its own component for hover + focus ring ─────── */

function CommandPaletteRow({
  agent,
  active,
  onHover,
  onSelect,
}: {
  agent: PublicAgent;
  active: boolean;
  onHover: () => void;
  onSelect: () => void;
}) {
  return (
    <li role="option" aria-selected={active}>
      <button
        type="button"
        onClick={onSelect}
        onMouseEnter={onHover}
        className="w-full px-5 py-3 flex items-center justify-between gap-4 transition-colors text-left"
        style={{
          background: active ? "var(--ed-copper-wash, rgba(181,83,44,0.06))" : "transparent",
          borderLeft: `2px solid ${active ? "var(--ed-copper, #b5532c)" : "transparent"}`,
        }}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <span
              className="ed-display text-lg truncate"
              style={{ color: "var(--ed-ink, #ede5d6)" }}
            >
              {agent.displayName}
            </span>
            {agent.featured && (
              <span style={{ color: "var(--ed-copper, #b5532c)" }} aria-label="Featured">
                ★
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 ed-caption truncate">
            <span
              className="ed-mono"
              style={{ color: active ? "var(--ed-copper, #b5532c)" : "var(--ed-ink-dim, #6b6557)" }}
            >
              {agent.slug}
            </span>
            <span style={{ color: "var(--ed-rule, #3a342b)" }}>·</span>
            <span className="truncate">{agent.category}</span>
          </div>
        </div>
      </button>
    </li>
  );
}
