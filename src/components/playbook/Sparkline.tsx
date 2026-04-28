/**
 * <Sparkline> — minimal SVG line chart with status-colored dots.
 *
 * No D3, no chart library. The whole component is ~80 lines because
 * the chart is intentionally tiny:
 *   - 1 line connecting durations across runs
 *   - 1 dot per run, colored by run status (✓ emerald / ✗ rose / ⟳ amber)
 *   - Optional reference line at the median for visual baseline
 *
 * Renders nothing when fewer than 2 points (no trend to show).
 *
 * Why server-friendly: this is a pure render component (no hooks, no
 * effects), so it works in either client or server pages. The data
 * flows in as a props array.
 */

import type { ReactNode } from "react";

export interface SparklinePoint {
  /** Numeric value for the y-axis (e.g. duration in ms). */
  value: number;
  /** Status bucket — drives the dot color. */
  status: "running" | "completed" | "failed";
  /** Optional tooltip-style label. */
  label?: string;
}

interface SparklineProps {
  points: SparklinePoint[];
  /** Render width in pixels. Height is always 32px for tight layouts. */
  width?: number;
  /** Aria label for screen readers. */
  ariaLabel?: string;
}

const STATUS_COLOR: Record<SparklinePoint["status"], string> = {
  completed: "#34d399", // emerald-400
  failed: "#fb7185",    // rose-400
  running: "#fbbf24",   // amber-400
};

/**
 * Linearly map a value into the [topPad, height-bottomPad] range.
 * `min` and `max` come from the data window so the line uses the
 * full vertical space (auto-scaling sparkline behavior).
 */
function yScale(
  value: number,
  min: number,
  max: number,
  height: number,
  pad: number,
): number {
  if (max === min) return height / 2;
  const t = (value - min) / (max - min);
  // Invert: SVG y grows downward; we want larger values to be HIGHER.
  return pad + (1 - t) * (height - 2 * pad);
}

export function Sparkline({
  points,
  width = 240,
  ariaLabel,
}: SparklineProps): ReactNode {
  if (points.length < 2) {
    // Not enough data for a line. Render an empty placeholder so the
    // surrounding layout doesn't shift when more data arrives.
    return (
      <div
        className="text-[10px] text-neutral-600 italic"
        aria-label={ariaLabel}
      >
        needs ≥2 runs for a trend
      </div>
    );
  }

  const height = 32;
  const pad = 4;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);

  const xStep = points.length > 1 ? (width - 2 * pad) / (points.length - 1) : 0;
  const coords = points.map((p, i) => {
    const x = pad + i * xStep;
    const y = yScale(p.value, min, max, height, pad);
    return { x, y, status: p.status, label: p.label, value: p.value };
  });

  // SVG polyline path — each point joined by a straight segment.
  const path = coords.map((c) => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(" ");

  // Median reference line — visual anchor showing baseline.
  const sortedValues = [...values].sort((a, b) => a - b);
  const median = sortedValues[Math.floor(sortedValues.length / 2)];
  const medianY = yScale(median, min, max, height, pad);

  return (
    <svg
      width={width}
      height={height}
      role="img"
      aria-label={ariaLabel ?? "trend chart"}
      className="overflow-visible"
    >
      {/* Median reference line — dashed, faint */}
      <line
        x1={pad}
        y1={medianY}
        x2={width - pad}
        y2={medianY}
        stroke="rgba(255,255,255,0.08)"
        strokeWidth={1}
        strokeDasharray="2 3"
      />

      {/* Connecting polyline — neutral color so the dots stand out */}
      <polyline
        points={path}
        fill="none"
        stroke="rgba(255,255,255,0.25)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Status-colored dots — semantic info lives here */}
      {coords.map((c, i) => (
        <circle
          key={i}
          cx={c.x}
          cy={c.y}
          r={2.5}
          fill={STATUS_COLOR[c.status]}
        >
          {c.label && <title>{c.label}</title>}
        </circle>
      ))}
    </svg>
  );
}
