"use client";

/**
 * ConstellationPreview — landing-page tease for the full /world constellation.
 *
 * Shows ~40 sigils from the live catalog, arranged on a deterministic
 * orbital grid. Hover floats a sigil forward, mouse movement parallaxes
 * the whole field. Click → /world (or click a specific sigil → that agent).
 *
 * Design goals:
 *   - Visual PROOF of the 218-agent catalog without being a cluttered grid
 *   - Subtle ambient motion (not jarring); respects prefers-reduced-motion
 *   - Mobile: reduces to 18 sigils on a simplified spiral
 *
 * Performance: ~40 <img> elements with data-URL sigils. No canvas, no
 * WebGL, no runtime generation in the browser — the server pre-renders
 * each sigil string via agentSigilDataUrl, the browser just paints them.
 */

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { agentSigilDataUrl, type SigilOptions } from "@/lib/agent-sigil";
import { useReducedMotion } from "@/lib/hooks/use-reduced-motion";

interface PreviewAgent {
  slug: string;
  displayName: string;
  category: string;
}

interface Props {
  /** Agents to preview — typically a curated slice of the full catalog. */
  agents: PreviewAgent[];
  /** Total count in the full catalog — drives the "NNN total" badge. */
  totalCount?: number;
}

export function ConstellationPreview({ agents, totalCount = 218 }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [parallax, setParallax] = useState({ x: 0, y: 0 });
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (reducedMotion) return;
    const container = containerRef.current;
    if (!container) return;
    const onMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      // Normalize to [-1, 1] so translations stay bounded.
      const nx = (e.clientX - cx) / rect.width;
      const ny = (e.clientY - cy) / rect.height;
      setParallax({ x: nx, y: ny });
    };
    container.addEventListener("mousemove", onMove, { passive: true });
    return () => container.removeEventListener("mousemove", onMove);
  }, [reducedMotion]);

  // Position each sigil on a deterministic polar grid. Rings + slots
  // distribute visibly; the center is reserved for a "+NNN more" hint.
  const positions = computePositions(agents.length);

  return (
    <section className="relative py-24 md:py-32 px-6 border-y border-white/[0.04]">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10 flex items-center gap-4 flex-wrap">
          <span className="font-mono text-[10px] text-neutral-600 tracking-[0.2em]">
            CONSTELLATION
          </span>
          <span aria-hidden="true" className="h-px w-6 bg-white/[0.12]" />
          <p className="font-serif italic text-[13px] text-neutral-500 tracking-[-0.01em]">
            Every agent, mapped.
          </p>
          <span aria-hidden="true" className="h-px flex-1 bg-white/[0.04]" />
          <Link
            href="/world"
            className="font-mono text-[10px] text-neutral-600 hover:text-[#B5532C] transition-colors tracking-[0.1em] inline-flex items-center gap-1.5"
          >
            Explore the full map <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="grid md:grid-cols-12 gap-10 md:gap-14 items-center">
          <div className="md:col-span-5">
            <h2 className="ed-display text-3xl md:text-5xl leading-[1.02] mb-6">
              223 agents.<br />
              <span className="ed-display-italic text-[#B5532C]">One living map.</span>
            </h2>
            <p className="text-sm md:text-base text-neutral-400 leading-relaxed mb-6">
              Every agent has a procedurally-generated sigil derived from its slug +
              category. Hover for the name, click for the full page, tap
              &quot;Explore&quot; for the interactive constellation where nodes
              cluster by category and size by activity.
            </p>
            <Link
              href="/world"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[4px] bg-[#B5532C] hover:bg-[#C96234] text-white text-sm font-semibold transition-colors"
            >
              Explore the constellation <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="md:col-span-7">
            <div
              ref={containerRef}
              className="relative aspect-square max-w-[520px] mx-auto"
              style={{
                transform: reducedMotion
                  ? "none"
                  : `perspective(900px) rotateY(${parallax.x * 4}deg) rotateX(${-parallax.y * 4}deg)`,
                transformStyle: "preserve-3d",
                transition: "transform 120ms ease-out",
              }}
            >
              {/* Subtle orbital rings for context.
               *  Outermost ring rotates slowly (60s loop) to signal "living
               *  map" without animating the sigils themselves. Respects
               *  prefers-reduced-motion via the CSS media query below. */}
              <div
                aria-hidden="true"
                className="absolute inset-[12%] rounded-full border border-white/[0.04]"
                style={{
                  animation:
                    "sovereign-ring-rotate 60s linear infinite",
                  // Stop rotating when user prefers reduced motion — set
                  // via the inline stylesheet below so it applies in SSR
                  // before hydration.
                }}
              />
              <div
                aria-hidden="true"
                className="absolute inset-[30%] rounded-full border border-white/[0.03]"
              />
              <div
                aria-hidden="true"
                className="absolute inset-[48%] rounded-full border border-white/[0.02]"
              />
              {/* Keyframes for the outer-ring rotation. Scoped to this
               *  component via unique animation name. Zero-dep, no Framer
               *  for this one since it's a single ambient 60s loop. */}
              <style>{`
                @keyframes sovereign-ring-rotate {
                  from { transform: rotate(0deg); }
                  to   { transform: rotate(360deg); }
                }
                @media (prefers-reduced-motion: reduce) {
                  div[style*="sovereign-ring-rotate"] {
                    animation: none !important;
                  }
                }
              `}</style>

              {/* Sigil nodes */}
              {agents.map((agent, i) => {
                const pos = positions[i];
                if (!pos) return null;
                return (
                  <SigilNode
                    key={agent.slug}
                    agent={agent}
                    left={pos.x}
                    top={pos.y}
                    size={pos.size}
                    delay={i * 40}
                  />
                );
              })}

              {/* Centre "+NNN more" hint */}
              <Link
                href="/world"
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center w-[22%] aspect-square rounded-full bg-[#B5532C]/[0.08] border border-[#B5532C]/30 backdrop-blur-sm hover:bg-[#B5532C]/[0.14] transition-colors group"
              >
                <span className="ed-display text-2xl md:text-3xl text-white leading-none mb-1">
                  +{Math.max(0, totalCount - agents.length)}
                </span>
                <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-neutral-400 group-hover:text-[#B5532C] transition-colors">
                  more
                </span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SigilNode({
  agent,
  left,
  top,
  size,
  delay,
}: {
  agent: PreviewAgent;
  left: number;
  top: number;
  size: number;
  delay: number;
}) {
  const sigilOpts: SigilOptions = { category: agent.category, size, detail: "minimal" };
  const src = agentSigilDataUrl(agent.slug, sigilOpts);
  return (
    <Link
      href={`/agents/${agent.slug}`}
      className="absolute block group transition-transform hover:scale-[1.18] hover:z-20"
      style={{
        left: `${left}%`,
        top: `${top}%`,
        width: `${size}px`,
        height: `${size}px`,
        transform: "translate(-50%, -50%)",
        animationDelay: `${delay}ms`,
      }}
      title={agent.displayName}
      aria-label={agent.displayName}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- data URL, no remote fetch */}
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        draggable={false}
        className="rounded-[6px] transition-all opacity-75 group-hover:opacity-100"
      />
      <span className="absolute left-1/2 -translate-x-1/2 top-[calc(100%+6px)] whitespace-nowrap font-mono text-[9px] text-neutral-500 opacity-0 group-hover:opacity-100 transition-opacity bg-[#030303]/95 px-2 py-0.5 rounded-[3px] border border-white/[0.06] pointer-events-none">
        {agent.displayName}
      </span>
    </Link>
  );
}

/**
 * Deterministic polar grid — rings of varying radius.
 * Returns (x%, y%, size) tuples for each index.
 *
 * Ring structure:
 *   Ring 0 (innermost): 6 sigils at 25% radius, larger (48px)
 *   Ring 1:            12 sigils at 38% radius, medium (40px)
 *   Ring 2 (outermost): remaining sigils at 47% radius, smaller (34px)
 */
function computePositions(count: number): Array<{ x: number; y: number; size: number }> {
  const pos: Array<{ x: number; y: number; size: number }> = [];
  const rings = [
    { count: 6, radius: 25, size: 48, startAngle: 0 },
    { count: 12, radius: 38, size: 40, startAngle: Math.PI / 12 },
    { count: 22, radius: 47, size: 34, startAngle: 0 },
  ];
  let i = 0;
  for (const ring of rings) {
    const take = Math.min(ring.count, count - i);
    for (let k = 0; k < take; k++) {
      const a = ring.startAngle + (k / ring.count) * 2 * Math.PI;
      pos.push({
        x: 50 + Math.cos(a) * ring.radius,
        y: 50 + Math.sin(a) * ring.radius,
        size: ring.size,
      });
      i++;
    }
    if (i >= count) break;
  }
  return pos;
}
