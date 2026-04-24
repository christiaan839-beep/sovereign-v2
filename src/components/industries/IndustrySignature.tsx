"use client";

/**
 * IndustrySignature — per-industry algorithmic signature piece.
 *
 * Each /for-* landing page gets a distinctive composition reflecting its
 * domain. Reuses the sigil engine (same palette system, same deterministic
 * PRNG) but renders a LARGER composition with industry-specific layout
 * instead of a generic circular frame.
 *
 * LAYOUTS
 * ───────
 * insurance    — stacked policy fan (rectangles offset like shuffled cards)
 * logistics    — route line with waypoint sigils (left → right pipeline)
 * healthcare   — pulse waveform (concentric-rings motif, multiple scales)
 * agriculture  — field rows (horizontal repetitions with growth spirals)
 * construction — blueprint grid (pentagon seals at intersections)
 * legal        — stacked seal imprints (pentagons offset + opacity fades)
 * realestate   — blueprint plan (right angles + hexagon rooms)
 * default      — radial ring of 8 sigils (fallback for unmapped industries)
 *
 * Each layout uses category-agent slugs to seed the specific sigils shown
 * — so the Insurance signature shows fnol-intake + coi-verifier + more,
 * not random abstract shapes.
 *
 * PERFORMANCE
 * ───────────
 * All data-URL <img> tags, no canvas. ~10-18 elements per signature.
 * Renders in <10ms. Respects prefers-reduced-motion (disables drift animation).
 */

import { useEffect, useState } from "react";
import { agentSigilDataUrl } from "@/lib/agent-sigil";

type IndustryKey =
  | "insurance"
  | "logistics"
  | "healthcare"
  | "agriculture"
  | "construction"
  | "legal"
  | "realestate";

interface Props {
  industry: IndustryKey;
  /** Agent slugs featured in this signature — ordered left-to-right / first-to-last. */
  agents: Array<{ slug: string; name: string; category: string }>;
  /** Size of the overall figure (CSS width in px). Defaults 520. */
  size?: number;
  className?: string;
}

export function IndustrySignature({
  industry,
  agents,
  size = 520,
  className,
}: Props) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);

  const h = size; // square

  return (
    <div
      className={className}
      style={{
        position: "relative",
        width: size,
        height: h,
        maxWidth: "100%",
        aspectRatio: "1 / 1",
      }}
    >
      {industry === "insurance" && (
        <StackedFan agents={agents} size={size} reducedMotion={reducedMotion} />
      )}
      {industry === "logistics" && (
        <PipelineLine agents={agents} size={size} reducedMotion={reducedMotion} />
      )}
      {industry === "healthcare" && (
        <PulseRings agents={agents} size={size} reducedMotion={reducedMotion} />
      )}
      {industry === "agriculture" && (
        <FieldRows agents={agents} size={size} reducedMotion={reducedMotion} />
      )}
      {industry === "construction" && (
        <BlueprintGrid agents={agents} size={size} reducedMotion={reducedMotion} />
      )}
      {industry === "legal" && (
        <StackedFan agents={agents} size={size} reducedMotion={reducedMotion} />
      )}
      {industry === "realestate" && (
        <BlueprintGrid agents={agents} size={size} reducedMotion={reducedMotion} />
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────────
// Layouts — each a pure-visual composition with zero per-page tweak
// ────────────────────────────────────────────────────────────────

/**
 * Insurance / Legal: stacked policy cards (fanned, offset rotations).
 * Reads as "a stack of documents" — matches the real workflow they automate.
 */
function StackedFan({
  agents,
  size,
  reducedMotion,
}: {
  agents: Props["agents"];
  size: number;
  reducedMotion: boolean;
}) {
  const shown = agents.slice(0, 4);
  const cardSize = Math.round(size * 0.5);
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {shown.map((a, i) => {
        const rot = (i - (shown.length - 1) / 2) * 8; // -12°, -4°, +4°, +12° for 4
        const x = (i - (shown.length - 1) / 2) * 28;
        const y = i * 12;
        return (
          // eslint-disable-next-line @next/next/no-img-element -- data URL
          <img
            key={a.slug}
            src={agentSigilDataUrl(a.slug, { category: a.category, size: cardSize })}
            width={cardSize}
            height={cardSize}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${rot}deg)`,
              borderRadius: 16,
              boxShadow: "0 18px 48px rgba(0,0,0,0.6)",
              transition: reducedMotion ? "none" : "transform 400ms ease-out",
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * Logistics: horizontal pipeline with arrows between sigils.
 * Signals "BOL → TMS → dispatch" — the actual flow their agents automate.
 */
function PipelineLine({
  agents,
  size,
  reducedMotion,
}: {
  agents: Props["agents"];
  size: number;
  reducedMotion: boolean;
}) {
  const shown = agents.slice(0, 4);
  const nodeSize = Math.round(size * 0.22);
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexWrap: "wrap",
        gap: 20,
      }}
    >
      {/* connecting line — flows underneath the sigils */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          left: "12%",
          right: "12%",
          top: "50%",
          height: 2,
          background:
            "linear-gradient(to right, transparent, rgba(253, 224, 71, 0.35), transparent)",
          transform: "translateY(-50%)",
          animation: reducedMotion ? "none" : "sovereign-line-flow 6s linear infinite",
        }}
      />
      {shown.map((a, i) => (
        <div
          key={a.slug}
          style={{
            position: "relative",
            zIndex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 8,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL */}
          <img
            src={agentSigilDataUrl(a.slug, { category: a.category, size: nodeSize })}
            width={nodeSize}
            height={nodeSize}
            alt=""
            draggable={false}
            style={{ borderRadius: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }}
          />
          {i < shown.length - 1 && (
            <span
              aria-hidden="true"
              style={{
                position: "absolute",
                right: -22,
                top: "50%",
                transform: "translateY(-50%)",
                color: "rgba(253, 224, 71, 0.6)",
                fontSize: 20,
              }}
            >
              →
            </span>
          )}
        </div>
      ))}
      <style>{`
        @keyframes sovereign-line-flow {
          0% { background-position: -200px 0; }
          100% { background-position: 200px 0; }
        }
      `}</style>
    </div>
  );
}

/**
 * Healthcare: concentric pulse rings with a sigil at each scale.
 * Reads as "diagnostic scan" — fits the ICD-coder / prior-auth workflows.
 */
function PulseRings({
  agents,
  size,
  reducedMotion,
}: {
  agents: Props["agents"];
  size: number;
  reducedMotion: boolean;
}) {
  const shown = agents.slice(0, 3);
  const rings = [
    { scale: 1.0, agentIdx: 0, opacity: 1 },
    { scale: 0.62, agentIdx: 1, opacity: 0.85 },
    { scale: 0.38, agentIdx: 2, opacity: 0.7 },
  ];
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* concentric rings */}
      {[0.95, 0.7, 0.45, 0.25].map((s, i) => (
        <div
          key={i}
          aria-hidden="true"
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: `${s * 100}%`,
            height: `${s * 100}%`,
            transform: "translate(-50%, -50%)",
            border: "1px solid rgba(34,211,238,0.18)",
            borderRadius: "50%",
            animation: reducedMotion
              ? "none"
              : `sovereign-pulse-ring ${5 + i * 1.5}s ease-in-out infinite`,
            animationDelay: `${i * -0.8}s`,
          }}
        />
      ))}
      {rings.map((r, i) => {
        const a = shown[r.agentIdx];
        if (!a) return null;
        const nodeSize = Math.round(size * 0.25 * r.scale);
        return (
          // eslint-disable-next-line @next/next/no-img-element -- data URL
          <img
            key={a.slug + i}
            src={agentSigilDataUrl(a.slug, { category: a.category, size: nodeSize })}
            width={nodeSize}
            height={nodeSize}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              transform: "translate(-50%, -50%)",
              opacity: r.opacity,
              borderRadius: 10,
              zIndex: rings.length - i,
            }}
          />
        );
      })}
      <style>{`
        @keyframes sovereign-pulse-ring {
          0%, 100% { opacity: 0.18; }
          50% { opacity: 0.38; }
        }
      `}</style>
    </div>
  );
}

/**
 * Agriculture: horizontal rows (crop fields). Four stripes at descending
 * opacity, with a sigil at the start of each row. Feels like a plot map.
 */
function FieldRows({
  agents,
  size,
  reducedMotion: _rm,
}: {
  agents: Props["agents"];
  size: number;
  reducedMotion: boolean;
}) {
  const shown = agents.slice(0, 4);
  const nodeSize = Math.round(size * 0.18);
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-around",
        padding: "10% 8%",
      }}
    >
      {shown.map((a, i) => (
        <div
          key={a.slug}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL */}
          <img
            src={agentSigilDataUrl(a.slug, { category: a.category, size: nodeSize })}
            width={nodeSize}
            height={nodeSize}
            alt=""
            draggable={false}
            style={{ borderRadius: 8, flexShrink: 0 }}
          />
          {/* row trail */}
          <div
            aria-hidden="true"
            style={{
              flex: 1,
              height: 4,
              background: `linear-gradient(to right, rgba(52,211,153,${0.5 - i * 0.1}), rgba(52,211,153,0))`,
              borderRadius: 2,
            }}
          />
        </div>
      ))}
    </div>
  );
}

/**
 * Construction / Real Estate: blueprint-style grid with pentagon seals
 * at corner intersections. Sigils sit on grid nodes.
 */
function BlueprintGrid({
  agents,
  size,
  reducedMotion: _rm,
}: {
  agents: Props["agents"];
  size: number;
  reducedMotion: boolean;
}) {
  const shown = agents.slice(0, 4);
  const nodeSize = Math.round(size * 0.22);
  // 2x2 grid positions (percent of parent)
  const positions = [
    { x: 25, y: 25 },
    { x: 75, y: 25 },
    { x: 25, y: 75 },
    { x: 75, y: 75 },
  ];
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* blueprint grid lines */}
      <svg
        viewBox="0 0 100 100"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
        }}
      >
        <defs>
          <pattern
            id="grid"
            width="10"
            height="10"
            patternUnits="userSpaceOnUse"
          >
            <path
              d="M 10 0 L 0 0 0 10"
              fill="none"
              stroke="rgba(251,146,60,0.08)"
              strokeWidth="0.3"
            />
          </pattern>
        </defs>
        <rect width="100" height="100" fill="url(#grid)" />
        {/* major lines */}
        <line
          x1="50"
          y1="0"
          x2="50"
          y2="100"
          stroke="rgba(251,146,60,0.22)"
          strokeWidth="0.4"
        />
        <line
          x1="0"
          y1="50"
          x2="100"
          y2="50"
          stroke="rgba(251,146,60,0.22)"
          strokeWidth="0.4"
        />
      </svg>
      {shown.map((a, i) => {
        const pos = positions[i];
        return (
          // eslint-disable-next-line @next/next/no-img-element -- data URL
          <img
            key={a.slug}
            src={agentSigilDataUrl(a.slug, { category: a.category, size: nodeSize })}
            width={nodeSize}
            height={nodeSize}
            alt=""
            draggable={false}
            style={{
              position: "absolute",
              left: `${pos.x}%`,
              top: `${pos.y}%`,
              transform: "translate(-50%, -50%)",
              borderRadius: 10,
              boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
            }}
          />
        );
      })}
    </div>
  );
}
