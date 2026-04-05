"use client";

import { useEffect, useRef } from "react";

/**
 * useFocusTrap — Confines Tab navigation inside a container while active.
 *
 * WCAG 2.4.3 (Focus Order) + WCAG 2.4.7 (Focus Visible) compliance for modals.
 * While `active`, Tab / Shift+Tab cycle within the container's focusable
 * children. On deactivation, focus is restored to whatever element was
 * focused before the trap engaged.
 *
 * @param active - whether the trap is engaged (typically the modal's open state)
 * @returns a ref to attach to the container element (usually the modal wrapper)
 *
 * @example
 * const trapRef = useFocusTrap<HTMLDivElement>(isOpen);
 * return <div ref={trapRef} role="dialog" aria-modal="true">...</div>;
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(active: boolean) {
  const containerRef = useRef<T>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    // Snapshot the pre-modal focus so we can restore it on close.
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    const container = containerRef.current;
    if (!container) return;

    const getFocusable = (): HTMLElement[] => {
      const nodes = container.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      );
      // offsetParent === null catches display:none and detached subtrees.
      return Array.from(nodes).filter((el) => el.offsetParent !== null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const focusables = getFocusable();
      if (focusables.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const current = document.activeElement as HTMLElement | null;

      // Shift+Tab at the first element → loop to last.
      // Tab at the last element → loop to first.
      // Any Tab when focus has escaped the container → pull it back to first.
      if (e.shiftKey) {
        if (current === first || !container.contains(current)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (current === last || !container.contains(current)) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      // Restore focus if the element still exists in the DOM.
      const prev = previouslyFocused.current;
      if (prev && document.contains(prev) && typeof prev.focus === "function") {
        prev.focus();
      }
    };
  }, [active]);

  return containerRef;
}
