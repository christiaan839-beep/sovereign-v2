"use client";

/**
 * SOVEREIGN MATRIX — Immersive Error Boundary (Wave 124).
 *
 * Wraps the Three.js canvas + cinematic stack so a WebGL context loss
 * (old GPU, driver crash, browser disabling hardware acceleration)
 * doesn't white-screen the entire /immersive route. Falls back to a
 * static SVG orb + the underlying section copy stays readable.
 *
 * React 19's error-boundary contract still requires a CLASS component;
 * functional components don't expose componentDidCatch. Keeping the
 * impl tight + isolated so it's the only class-component in the
 * landing tree.
 */

import { Component, type ReactNode } from "react";

interface Props {
  /** What to render if the boundary catches. Receives the error for telemetry. */
  fallback: (error: Error) => ReactNode;
  /** Children to render when no error. */
  children: ReactNode;
  /** Telemetry hook — fires once per caught error. */
  onError?: (error: Error, info: { componentStack: string }) => void;
}

interface State {
  error: Error | null;
}

export class ImmersiveErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: { componentStack: string }): void {
    // Telemetry — operator can wire Sentry / Vercel logs here.
    // Console.warn is the floor; never throws, never crashes a render.
    if (typeof console !== "undefined") {
      console.warn("[ImmersiveErrorBoundary] caught:", error.message);
    }
    this.props.onError?.(error, info);
  }

  // Wave 124 polish — listen for WebGL context-restored events on the
  // window. Modern browsers can restore a lost WebGL context (driver
  // reset, tab background-then-restore, GPU process crash recovery).
  // If we caught from a WebGL-related error and the browser signals
  // restoration, clear the fallback so the orb tries to mount again.
  // Wrapped in lifecycle methods (legacy class API) because functional
  // components don't expose componentDidMount + componentWillUnmount.
  private webglRestoreHandler = (e: Event) => {
    // Custom event some browsers fire on context restore. We also
    // accept a manual trigger via dispatching this event from code.
    if (e.type === "webglcontextrestored") {
      this.setState({ error: null });
    }
  };

  componentDidMount(): void {
    if (typeof window !== "undefined") {
      window.addEventListener(
        "webglcontextrestored",
        this.webglRestoreHandler,
        true,
      );
    }
  }

  componentWillUnmount(): void {
    if (typeof window !== "undefined") {
      window.removeEventListener(
        "webglcontextrestored",
        this.webglRestoreHandler,
        true,
      );
    }
  }

  render(): ReactNode {
    if (this.state.error) return this.props.fallback(this.state.error);
    return this.props.children;
  }
}

/**
 * StaticOrbFallback — pure-SVG "orb" that mirrors the ReceiptOrb's
 * silhouette so the layout doesn't jolt when the canvas dies. Two
 * concentric ellipses + a center dot + the same radial glow.
 *
 * No motion, no JS, no GPU. Renders correctly on every browser back to
 * IE-era SVG support — but we only need it on modern browsers that
 * happen to have lost WebGL.
 */
export function StaticOrbFallback({
  accent = "cyan",
}: {
  accent?: "cyan" | "copper";
}) {
  const color = accent === "cyan" ? "#22d3ee" : "#f59e0b";
  return (
    <div className="relative h-full w-full overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            accent === "cyan"
              ? "radial-gradient(circle at center, rgba(34,211,238,0.10) 0%, transparent 65%)"
              : "radial-gradient(circle at center, rgba(245,158,11,0.10) 0%, transparent 65%)",
        }}
      />
      <svg
        viewBox="-3 -3 6 6"
        className="absolute inset-0 h-full w-full"
        preserveAspectRatio="xMidYMid meet"
        aria-hidden="true"
      >
        {/* Outer halo */}
        <circle cx="0" cy="0" r="1.8" fill={`${color}10`} />
        {/* Wireframe orb — three rotated ellipses approximate the
            distort-sphere silhouette. */}
        {[0, 60, 120].map((rot) => (
          <ellipse
            key={rot}
            cx="0"
            cy="0"
            rx="1.5"
            ry="0.6"
            fill="none"
            stroke={color}
            strokeWidth="0.015"
            opacity="0.55"
            transform={`rotate(${rot})`}
          />
        ))}
        {/* Equator */}
        <circle
          cx="0"
          cy="0"
          r="1.5"
          fill="none"
          stroke={color}
          strokeWidth="0.018"
          opacity="0.7"
        />
        {/* Center dot */}
        <circle cx="0" cy="0" r="0.06" fill={color} />
      </svg>
    </div>
  );
}
