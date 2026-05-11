"use client";

/**
 * SpotlightCard — mouse-reactive radial-glow wrapper.
 *
 * The signature Antigravity / Linear / Vercel feature-card move:
 * a soft radial light tracks the cursor across the card surface.
 * Reads as "this surface is reactive" without being noisy.
 *
 * Implementation notes:
 *
 *   - Tracks pointer-relative position via plain DOM events; sets two
 *     CSS custom properties (--spotlight-x, --spotlight-y) on the
 *     wrapper element. The gradient pseudo-layer reads them with
 *     `var()`. This is the only pattern that scales — putting mouse
 *     state in React state re-renders the entire subtree on every
 *     mousemove and kills 60fps the moment you stack three cards on
 *     a viewport.
 *
 *   - The gradient layer is a separate absolutely-positioned div with
 *     `pointer-events: none` so it never blocks hovers/clicks inside
 *     the card content. Its opacity ramps on hover (0 → 1) so the
 *     effect is invisible until the cursor lands.
 *
 *   - `accent` prop picks between cyan (audit/infra surface) and
 *     copper (marketing surface) per docs/design-system/brand-colors.md.
 *
 *   - `prefers-reduced-motion` users get the static card (no spotlight)
 *     — the wrapper just renders children with a soft static border
 *     hover state.
 *
 *   - Works in `<Link>`, `<button>`, `<article>` etc. — `as` prop
 *     accepts any HTML element. Default `div`.
 *
 *   - SSR-safe — no useEffect-driven setup needed. The onMouseMove
 *     handler runs only after hydration.
 */

import { createElement } from "react";
import type { CSSProperties, ElementType, ReactNode } from "react";
import { useCallback, useState } from "react";

type Accent = "cyan" | "copper";

const ACCENT_RGB: Record<Accent, string> = {
  cyan: "0, 183, 255",
  copper: "181, 83, 44",
};

interface SpotlightCardProps {
  children: ReactNode;
  className?: string;
  accent?: Accent;
  /** Glow radius in pixels. Default 320. */
  radius?: number;
  /** Element to render. Default 'div'. */
  as?: ElementType;
  /** Forwarded to the rendered element. Lets the card double as <a href>. */
  [k: string]: unknown;
}

export function SpotlightCard({
  children,
  className = "",
  accent = "cyan",
  radius = 320,
  as: As = "div",
  ...rest
}: SpotlightCardProps) {
  // Use a callback ref instead of useRef so the React Compiler ESLint
  // plugin doesn't flag mid-render ref access. The state setter is
  // referentially stable, so this doesn't cause re-renders.
  const [container, setContainer] = useState<HTMLElement | null>(null);
  const setContainerRef = useCallback((el: HTMLElement | null) => {
    setContainer(el);
  }, []);

  // The whole point of writing CSS variables directly (vs putting
  // mouse state in React state) is to AVOID a re-render on every
  // mousemove — putting children in state would re-render the entire
  // subtree and kill 60fps the moment you stack three cards.
  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLElement>) => {
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      container.style.setProperty("--spotlight-x", `${x}px`);
      container.style.setProperty("--spotlight-y", `${y}px`);
      container.style.setProperty("--spotlight-opacity", "1");
    },
    [container],
  );

  const onMouseLeave = useCallback(() => {
    if (!container) return;
    container.style.setProperty("--spotlight-opacity", "0");
  }, [container]);

  const rgb = ACCENT_RGB[accent];

  // Inline-style the radial gradient on the overlay layer.
  // The gradient is the WHOLE point of the component, so it lives in
  // styles rather than a className for tunability per-instance.
  const overlayStyle: CSSProperties = {
    background: `radial-gradient(${radius}px circle at var(--spotlight-x, -100%) var(--spotlight-y, -100%), rgba(${rgb}, 0.18), transparent 70%)`,
    opacity: "var(--spotlight-opacity, 0)" as unknown as number,
    transition: "opacity 280ms ease-out",
  };

  // Use createElement so React 19's stricter children typing doesn't
  // fight the polymorphic `as` prop. Functionally identical to <As>
  // ...</As> but TS resolves the element-type signature cleanly.
  return createElement(
    As,
    {
      ref: setContainerRef,
      onMouseMove,
      onMouseLeave,
      className: `group relative overflow-hidden ${className}`,
      ...rest,
    },
    // Soft border-tone shift on hover — works for keyboard focus too
    // via :focus-within from the global focus-visible rule.
    <div
      key="border"
      className={`pointer-events-none absolute inset-0 rounded-[inherit] border ${
        accent === "cyan"
          ? "border-cyan-500/0 group-hover:border-cyan-500/30 motion-reduce:group-hover:border-cyan-500/20"
          : "border-[#B5532C]/0 group-hover:border-[#B5532C]/30 motion-reduce:group-hover:border-[#B5532C]/20"
      } transition-colors duration-300`}
      aria-hidden="true"
    />,
    // The spotlight glow. Pointer-events:none so it doesn't shadow
    // children. motion-reduce hides it entirely.
    <div
      key="spotlight"
      className="pointer-events-none absolute inset-0 rounded-[inherit] motion-reduce:hidden"
      style={overlayStyle}
      aria-hidden="true"
    />,
    <div key="content" className="relative">
      {children}
    </div>,
  );
}
