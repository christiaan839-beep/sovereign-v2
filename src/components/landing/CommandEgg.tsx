"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { Search, CornerDownLeft } from "lucide-react";

/**
 * CommandEgg — keyboard-triggered command palette.
 *
 * Triggers:
 *   - `?` or Shift+?  → universal help convention
 *   - `/`             → when no input is focused
 *   - ⌘K / Ctrl+K     → the standard command-palette binding
 *   - Esc             → dismiss
 *
 * Navigation: arrow keys select, Enter opens the chosen command.
 * A one-time console shoutout fires on first open (no spam on
 * subsequent opens).
 */

interface Command {
  label: string;
  href?: string;
  action?: () => void;
  hint: string;
}

const COMMANDS: Command[] = [
  {
    label: "Run Lead Blitz (free tier)",
    href: "/dashboard/playbooks?auto=lead-blitz",
    hint: "Playbook",
  },
  { label: "See live safety metrics", href: "/trust/anthropic", hint: "Trust" },
  {
    label: "Browse the provider leaderboard",
    href: "/benchmarks",
    hint: "Trust",
  },
  {
    label: "Read the security case study",
    href: "/trust/defenders",
    hint: "Trust",
  },
  {
    label: "Installation: @sovereignmatrix/mcp",
    href: "https://www.npmjs.com/package/@sovereignmatrix/mcp",
    hint: "Developer",
  },
  { label: "View the public changelog", href: "/changelog", hint: "Product" },
  { label: "Read the customer cases", href: "/customers", hint: "Social" },
  {
    label: "Book a 15-minute demo",
    href: "https://cal.com/sovereign-matrix/15min",
    hint: "Contact",
  },
  {
    label: "Email sales@sovereignmatrix.agency",
    href: "mailto:hello@sovereignmatrix.agency",
    hint: "Contact",
  },
];

const CONSOLE_SHOUTOUT = [
  "",
  "  ┌──────────────────────────────────────────────┐",
  "  │                                              │",
  "  │  Nice. You found the command palette.        │",
  "  │                                              │",
  "  │  If you're the kind of person who presses    │",
  "  │  / on every website, you'll love /platform.  │",
  "  │                                              │",
  "  │  — Christiaan                                │",
  "  │    christiaan@sovereignmatrix.agency         │",
  "  │                                              │",
  "  └──────────────────────────────────────────────┘",
  "",
].join("\n");

export function CommandEgg() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [hasLoggedOnce, setHasLoggedOnce] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    function isInputFocused() {
      const el = document.activeElement;
      if (!el) return false;
      const tag = el.tagName.toLowerCase();
      return (
        tag === "input" ||
        tag === "textarea" ||
        tag === "select" ||
        (el as HTMLElement).isContentEditable
      );
    }

    function handleKey(e: KeyboardEvent) {
      // Esc always closes
      if (e.key === "Escape" && open) {
        e.preventDefault();
        setOpen(false);
        return;
      }

      // Don't trigger while typing in a form
      if (isInputFocused()) return;

      // Shift+? or ? alone (when shift produced it)
      if (e.key === "?") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }

      // / — like GitHub/Linear
      if (e.key === "/") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }

      // Cmd+K / Ctrl+K — Stripe/Linear convention
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
        return;
      }
    }

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  // Log the shoutout on first successful open only. Subsequent opens
  // don't repeat (we don't want to spam devtools).
  useEffect(() => {
    if (open && !hasLoggedOnce) {
      console.log(
        "%c" + CONSOLE_SHOUTOUT,
        "font-family: 'JetBrains Mono', monospace; color: #B5532C; line-height: 1.5;",
      );
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot "have we logged yet" flag
      setHasLoggedOnce(true);
    }
  }, [open, hasLoggedOnce]);

  // Filter commands by query
  const filtered = query
    ? COMMANDS.filter(
        (c) =>
          c.label.toLowerCase().includes(query.toLowerCase()) ||
          c.hint.toLowerCase().includes(query.toLowerCase()),
      )
    : COMMANDS;

  // Reset the highlighted row when the filter changes — selection is
  // derived from the list, so when the list shrinks we must clamp.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clamp derived selection on dependency change
    setSelectedIndex(0);
  }, [query]);

  function handleItemKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(filtered.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && filtered[selectedIndex]) {
      e.preventDefault();
      const cmd = filtered[selectedIndex];
      if (cmd.href) {
        setOpen(false);
        if (cmd.href.startsWith("http") || cmd.href.startsWith("mailto:")) {
          window.location.href = cmd.href;
        } else {
          window.location.pathname = cmd.href;
        }
      } else if (cmd.action) {
        cmd.action();
        setOpen(false);
      }
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[90] flex items-start justify-center pt-[15vh] px-4 bg-black/60 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-xl rounded-2xl bg-[#0A0807] border border-[#B5532C]/20 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Command palette"
          >
            {/* Search bar */}
            <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.04]">
              <Search className="h-4 w-4 text-neutral-500" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={handleItemKeyDown}
                placeholder="Search commands · /trust, /benchmarks, book a call..."
                className="flex-1 bg-transparent outline-none text-[15px] text-white placeholder:text-neutral-600"
                aria-label="Command input"
              />
              <kbd className="font-mono text-[10px] text-neutral-600 border border-white/[0.08] px-1.5 py-0.5 rounded">
                ESC
              </kbd>
            </div>

            {/* Commands */}
            <div className="max-h-[50vh] overflow-y-auto py-2">
              {filtered.length === 0 && (
                <p className="px-5 py-6 text-sm text-neutral-500">
                  No match. Try &ldquo;verifier&rdquo;, &ldquo;playbook&rdquo;,
                  or &ldquo;explorer&rdquo;.
                </p>
              )}
              {filtered.map((cmd, i) => {
                const isSelected = i === selectedIndex;
                const content = (
                  <>
                    <span className="flex-1 text-[14px] text-white">
                      {cmd.label}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-600">
                      {cmd.hint}
                    </span>
                    {isSelected && (
                      <CornerDownLeft className="h-3.5 w-3.5 text-[#B5532C] ml-2" />
                    )}
                  </>
                );

                const baseClass = `flex items-center gap-3 px-5 py-2.5 cursor-pointer transition-colors ${
                  isSelected
                    ? "bg-[#B5532C]/10 border-l-2 border-[#B5532C]"
                    : "border-l-2 border-transparent hover:bg-white/[0.03]"
                }`;

                if (cmd.href) {
                  const isExternal =
                    cmd.href.startsWith("http") ||
                    cmd.href.startsWith("mailto:");
                  if (isExternal) {
                    return (
                      <a
                        key={cmd.label}
                        href={cmd.href}
                        onMouseEnter={() => setSelectedIndex(i)}
                        onClick={() => setOpen(false)}
                        className={baseClass}
                      >
                        {content}
                      </a>
                    );
                  }
                  return (
                    <Link
                      key={cmd.label}
                      href={cmd.href}
                      onMouseEnter={() => setSelectedIndex(i)}
                      onClick={() => setOpen(false)}
                      className={baseClass}
                    >
                      {content}
                    </Link>
                  );
                }
                return (
                  <button
                    key={cmd.label}
                    type="button"
                    onMouseEnter={() => setSelectedIndex(i)}
                    onClick={() => {
                      cmd.action?.();
                      setOpen(false);
                    }}
                    className={`w-full text-left ${baseClass}`}
                  >
                    {content}
                  </button>
                );
              })}
            </div>

            {/* Footer — shortcut hints */}
            <div className="flex items-center gap-4 px-5 py-3 border-t border-white/[0.04] bg-[#060605] text-[10px] font-mono text-neutral-600">
              <HintKey label="navigate" keys={["↑↓"]} />
              <HintKey label="open" keys={["↵"]} />
              <HintKey
                label="Shortcut:"
                keys={["/", "⌘K"]}
                separator=" or "
                className="ml-auto"
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Labeled kbd chip (or chips) used in the palette footer. Keeps the
 * kbd styling in one place so future changes don't drift per-row.
 */
function HintKey({
  label,
  keys,
  separator = "",
  className = "",
}: {
  label: string;
  keys: string[];
  separator?: string;
  className?: string;
}) {
  const kbdClass = "border border-white/[0.08] px-1.5 py-0.5 rounded";

  // Label goes BEFORE the key for "Shortcut: / or ⌘K", and AFTER for
  // "↑↓ navigate". We detect based on whether the label ends with ":".
  const labelFirst = label.endsWith(":");

  return (
    <span className={`flex items-center gap-1.5 ${className}`}>
      {labelFirst && <>{label} </>}
      {keys.map((k, i) => (
        <span key={k} className="flex items-center gap-1.5">
          <kbd className={kbdClass}>{k}</kbd>
          {i < keys.length - 1 && <span>{separator}</span>}
        </span>
      ))}
      {!labelFirst && label}
    </span>
  );
}
