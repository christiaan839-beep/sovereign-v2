"use client";

import { useEffect, useCallback } from "react";

export interface Shortcut {
  /** Key to match (lowercase), e.g. "k", "n", "enter", "escape", "1"-"9", "/" */
  key: string;
  /** Require the platform modifier (Cmd on Mac, Ctrl on Windows/Linux) */
  meta?: boolean;
  /** Require Shift */
  shift?: boolean;
  /** Handler to invoke when the shortcut fires */
  handler: () => void;
  /** Human-readable label for display, e.g. "Open Command Palette" */
  label?: string;
}

/**
 * Returns true when running on macOS / iOS.
 * Safe for SSR — defaults to false on the server.
 */
function isMacPlatform(): boolean {
  if (typeof navigator === "undefined") return false;
  // navigator.userAgentData is available in modern Chromium browsers
  const ua = navigator.userAgent ?? "";
  return /mac|iphone|ipad|ipod/i.test(ua);
}

/**
 * Format a shortcut for display.
 * Returns e.g. "⌘K" on Mac, "Ctrl+K" on Windows.
 */
export function formatShortcut(shortcut: Pick<Shortcut, "key" | "meta" | "shift">): string {
  const isMac = isMacPlatform();
  const parts: string[] = [];

  if (shortcut.meta) parts.push(isMac ? "\u2318" : "Ctrl+");
  if (shortcut.shift) parts.push(isMac ? "\u21E7" : "Shift+");

  const keyLabel = shortcut.key.length === 1
    ? shortcut.key.toUpperCase()
    : shortcut.key === "enter"
      ? "\u23CE"
      : shortcut.key === "escape"
        ? "Esc"
        : shortcut.key === "/"
          ? "/"
          : shortcut.key;

  parts.push(keyLabel);
  return parts.join("");
}

/**
 * Register global keyboard shortcuts.
 *
 * Usage:
 * ```ts
 * useKeyboardShortcuts([
 *   { key: "k", meta: true, handler: () => openCommandPalette() },
 *   { key: "escape", handler: () => closePanel() },
 * ]);
 * ```
 */
export function useKeyboardShortcuts(shortcuts: Shortcut[]): void {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      // Ignore events inside editable elements unless the shortcut uses meta
      const target = e.target as HTMLElement | null;
      const isEditable =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      for (const sc of shortcuts) {
        const metaMatch = sc.meta
          ? e.metaKey || e.ctrlKey
          : !e.metaKey && !e.ctrlKey;

        const shiftMatch = sc.shift ? e.shiftKey : true;
        const keyMatch = e.key.toLowerCase() === sc.key.toLowerCase();

        if (keyMatch && metaMatch && shiftMatch) {
          // Allow escape to work everywhere; require meta for editable fields
          if (isEditable && !sc.meta && sc.key !== "escape") continue;

          e.preventDefault();
          e.stopPropagation();
          sc.handler();
          return;
        }
      }
    },
    [shortcuts]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown, true);
    return () => document.removeEventListener("keydown", handleKeyDown, true);
  }, [handleKeyDown]);
}
