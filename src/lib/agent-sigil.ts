/**
 * agent-sigil.ts — deterministic algorithmic SVG per agent.
 *
 * WHY
 * ───
 * Every one of our 218 agents needed a unique visual identity. Hiring
 * a designer for 218 bespoke marks is a $50K, 6-month project. Instead:
 * the sigil for every agent is *procedurally generated* from its slug.
 *
 * PATTERN
 * ───────
 * 1. Hash the slug → seed a deterministic PRNG (mulberry32)
 * 2. Pick a palette from the agent's category (copper for Meta, rose for
 *    Insurance, emerald for Agriculture, etc.)
 * 3. Draw a composed glyph using the seeded PRNG:
 *    - base frame: rounded rect (always-present grounding)
 *    - orbital nodes: 3-6 circles at golden-ratio angles
 *    - inner mark: parametric shape (triangle / pentagon / hex / spiral / concentric)
 *    - accent bezier across the figure
 *    - slug initials for readability at tiny sizes
 *
 * The same slug ALWAYS produces the same sigil. Palette AND composition
 * differ per agent. Cache-friendly because output is deterministic.
 *
 * SAFETY
 * ──────
 * The only user-derived input in the output is the slug's initials + the
 * aria-label. Both are escaped via `escapeAttr()`. The SVG string returned
 * contains no event handlers, no external references, no scripts.
 *
 * USE
 * ───
 *   import { agentSigil } from "@/lib/agent-sigil";
 *   const svg = agentSigil("fnol-intake", { category: "Insurance", size: 64 });
 *
 *   // Server-render: embed directly via React's __html escape hatch in
 *   //   a component you control (never from user-submitted data).
 *   // Data-URL (for CSS or <img src=>): use agentSigilDataUrl().
 *
 * PERFORMANCE
 * ───────────
 * ~200µs per sigil on an M1. For a directory of 218 sigils rendered at
 * once that's ~44ms total CPU — well under Next.js's render budget.
 *
 * WHY NOT IDENTICONS / BORING AVATARS
 * ────────────────────────────────────
 * Identicons are uniform. Our agents aren't. Category-driven palettes
 * + geometric style variants mean the sigil *signals* what the agent
 * does. A user scanning the directory can guess an agent's shape from
 * 30 pixels.
 */

import { createHash } from "node:crypto";

// ─── Types ────────────────────────────────────────────────────

export interface SigilOptions {
  /** Agent category — drives the palette. */
  category?: string;
  /** Render size in pixels (viewBox is always 0 0 100 100 internally). */
  size?: number;
  /** Override for detail level. "minimal" = cleaner icon at small sizes. */
  detail?: "minimal" | "normal" | "rich";
}

interface Palette {
  bg: string;
  fg: string;
  accent: string;
  dim: string;
}

// ─── Deterministic PRNG ────────────────────────────────────────

/**
 * Mulberry32 — 32-bit seeded PRNG. Fast, good-enough distribution,
 * deterministic across platforms. Returns a function that emits
 * floats in [0, 1) on each call.
 */
function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Hash a string to a 32-bit integer seed (deterministic, pure). */
function hashSeed(input: string): number {
  // SHA-256 is overkill numerically but guarantees no pathological
  // collisions for short strings like slugs. We only need 32 bits.
  const hex = createHash("sha256").update(input).digest("hex").slice(0, 8);
  return parseInt(hex, 16);
}

// ─── Palettes ──────────────────────────────────────────────────

/**
 * Category → palette map. Aligns with the landing + industry pages so
 * a user sees a consistent color across surfaces. Unknown categories
 * fall back to the copper brand palette.
 */
const PALETTES: Record<string, Palette> = {
  // Brand default
  default: { bg: "#0A0807", fg: "#B5532C", accent: "#E8DDD0", dim: "#5C544A" },

  // Industries (match /for-* page accents)
  Insurance: { bg: "#0E0607", fg: "#F87171", accent: "#FECACA", dim: "#7F1D1D" },
  // Logistics shifted to yellow-gold — readably distinct from Real Estate's
  // warmer orange at 32px. Previous amber (#F59E0B) and orange (#FB923C)
  // read as the same brand color on the playground dropdown.
  Logistics: { bg: "#0F0A05", fg: "#FDE047", accent: "#FEF08A", dim: "#854D0E" },
  Healthcare: { bg: "#05090F", fg: "#22D3EE", accent: "#A5F3FC", dim: "#164E63" },
  Agriculture: { bg: "#050E08", fg: "#34D399", accent: "#A7F3D0", dim: "#064E3B" },
  "Real Estate": { bg: "#080805", fg: "#FB923C", accent: "#FED7AA", dim: "#7C2D12" },
  Compliance: { bg: "#060508", fg: "#A78BFA", accent: "#DDD6FE", dim: "#4C1D95" },
  Legal: { bg: "#070508", fg: "#C084FC", accent: "#E9D5FF", dim: "#581C87" },

  // Functional categories
  Sales: { bg: "#050808", fg: "#60A5FA", accent: "#BFDBFE", dim: "#1E3A8A" },
  Content: { bg: "#0A0807", fg: "#B5532C", accent: "#E8DDD0", dim: "#5C544A" },
  Research: { bg: "#060606", fg: "#E879F9", accent: "#F5D0FE", dim: "#701A75" },
  Meta: { bg: "#0A0807", fg: "#B5532C", accent: "#E8DDD0", dim: "#5C544A" },
  Finance: { bg: "#050907", fg: "#10B981", accent: "#6EE7B7", dim: "#065F46" },
  Voice: { bg: "#05070A", fg: "#818CF8", accent: "#C7D2FE", dim: "#312E81" },
  "Vision & Media": { bg: "#060407", fg: "#F472B6", accent: "#FBCFE8", dim: "#831843" },
  Safety: { bg: "#080404", fg: "#EF4444", accent: "#FCA5A5", dim: "#7F1D1D" },
  Ecommerce: { bg: "#0A0706", fg: "#FB7185", accent: "#FECDD3", dim: "#881337" },
  General: { bg: "#0A0807", fg: "#B5532C", accent: "#E8DDD0", dim: "#5C544A" },
};

function paletteFor(category?: string): Palette {
  return PALETTES[category ?? "default"] ?? PALETTES.default;
}

/**
 * Inner-mark types, in stable order. Category affinity weights (below)
 * bias which mark a category *tends* to get without making it deterministic.
 * The slug-derived PRNG still chooses the final mark — the weighting just
 * shifts the probability distribution so the sigil *signals* the domain.
 *
 *   0 triangle      → general geometric, no strong semantic
 *   1 pentagon      → seal / authority / legal
 *   2 hexagon+dot   → compliance / regulation / structure
 *   3 spiral        → growth / reasoning / process
 *   4 concentric    → scan / data / health / monitoring
 */
type MarkType = 0 | 1 | 2 | 3 | 4;

/**
 * Category → mark-weight distribution. Each row is a 5-tuple of
 * integer weights summing to 10. Slug's PRNG picks a cumulative
 * bucket — so a Healthcare agent is 5/10 likely to get a concentric-
 * rings mark but can still get a spiral or triangle for variety.
 *
 * Unlisted categories use the uniform `default` [2,2,2,2,2].
 */
const MARK_AFFINITY: Record<string, [number, number, number, number, number]> = {
  default:        [2, 2, 2, 2, 2],

  // Industries
  Healthcare:     [0, 1, 1, 3, 5],  // concentric = scan, spiral = physiology
  "Real Estate":  [1, 1, 4, 2, 2],  // hexagon = structure / blueprint
  Compliance:     [0, 2, 5, 1, 2],  // hexagon = regulation / seal
  Legal:          [0, 5, 3, 1, 1],  // pentagon = seal, hexagon = charter
  Insurance:      [1, 3, 2, 2, 2],  // pentagon (policy seal) + mixed
  Logistics:      [3, 1, 2, 1, 3],  // triangle (directional) + concentric (scan)
  Agriculture:    [1, 1, 1, 5, 2],  // spiral = growth, rings = seasons
  Finance:        [0, 2, 1, 3, 4],  // spiral + concentric (charts, flow)

  // Functional categories
  Sales:          [2, 2, 1, 3, 2],  // slight spiral lean (funnel/flow)
  Content:        [2, 1, 1, 4, 2],  // spiral (flow / narrative)
  Research:       [1, 2, 1, 2, 4],  // concentric (inquiry depth)
  Meta:           [2, 3, 2, 2, 1],  // pentagon / hex lean (architecture)
  Voice:          [2, 1, 1, 4, 2],  // spiral (waveform echo)
  "Vision & Media":[1, 1, 2, 2, 4], // concentric (lens / aperture)
  Safety:         [0, 3, 4, 1, 2],  // pentagon + hex (shield feel)
  Ecommerce:      [3, 1, 2, 2, 2],  // triangle (checkout flow)
  General:        [2, 2, 2, 2, 2],
};

function pickMarkType(rng: () => number, category?: string): MarkType {
  const weights = MARK_AFFINITY[category ?? "default"] ?? MARK_AFFINITY.default;
  const total = weights[0] + weights[1] + weights[2] + weights[3] + weights[4];
  let pick = rng() * total;
  for (let i = 0; i < 5; i++) {
    pick -= weights[i];
    if (pick < 0) return i as MarkType;
  }
  return 4; // numerical safety net
}

// ─── Sigil generator ──────────────────────────────────────────

/**
 * Generate an SVG markup string for a given agent slug.
 * Deterministic: same inputs → identical output, every call, every machine.
 */
export function agentSigil(slug: string, opts: SigilOptions = {}): string {
  const size = opts.size ?? 64;
  const palette = paletteFor(opts.category);
  const detail = opts.detail ?? "normal";

  const seed = hashSeed(`${slug}:${opts.category ?? ""}`);
  const rng = mulberry32(seed);

  // ── Layer 1: background frame (always same shape, palette-driven) ──
  const frames: string[] = [];
  frames.push(
    `<rect x="2" y="2" width="96" height="96" rx="12" fill="${palette.bg}"/>`,
  );
  frames.push(
    `<rect x="8" y="8" width="84" height="84" rx="10" fill="none" stroke="${palette.dim}" stroke-width="0.6" opacity="0.35"/>`,
  );

  // ── Layer 2: orbital nodes (3-6 per sigil, golden-ratio angles) ──
  const nodeCount = detail === "minimal" ? 3 : 3 + Math.floor(rng() * 4);
  const nodes: string[] = [];
  const cx = 50;
  const cy = 50;
  const radius = 30 + rng() * 8;
  // Golden ratio drives the angular distribution — produces
  // pleasingly-spaced points even for small N.
  const GOLDEN = 137.50776; // degrees
  const phase = rng() * 360;
  for (let i = 0; i < nodeCount; i++) {
    const angle = (phase + i * GOLDEN) * (Math.PI / 180);
    const x = cx + Math.cos(angle) * radius;
    const y = cy + Math.sin(angle) * radius;
    const r = 2 + rng() * 2.5;
    const opacity = 0.5 + rng() * 0.5;
    nodes.push(
      `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="${r.toFixed(2)}" fill="${palette.fg}" opacity="${opacity.toFixed(2)}"/>`,
    );
  }

  // ── Layer 3: inner mark — one of 5 parametric shapes, category-biased ──
  // The slug's PRNG still chooses, but category affinity shifts the
  // probability so Healthcare tends to get concentric rings (scan),
  // Legal tends to get a pentagon (seal), Agriculture tends to get a
  // spiral (growth), etc. Variety persists but domain is now readable.
  const markType = pickMarkType(rng, opts.category);
  const innerRadius = 14 + rng() * 4;
  let inner = "";
  switch (markType) {
    case 0: {
      // Triangle
      const rot = rng() * 360;
      const pts: string[] = [];
      for (let i = 0; i < 3; i++) {
        const a = ((rot + i * 120) * Math.PI) / 180;
        pts.push(
          `${(cx + Math.cos(a) * innerRadius).toFixed(2)},${(cy + Math.sin(a) * innerRadius).toFixed(2)}`,
        );
      }
      inner = `<polygon points="${pts.join(" ")}" fill="none" stroke="${palette.fg}" stroke-width="1.1" opacity="0.85"/>`;
      break;
    }
    case 1: {
      // Pentagon
      const rot = rng() * 360;
      const pts: string[] = [];
      for (let i = 0; i < 5; i++) {
        const a = ((rot + i * 72) * Math.PI) / 180;
        pts.push(
          `${(cx + Math.cos(a) * innerRadius).toFixed(2)},${(cy + Math.sin(a) * innerRadius).toFixed(2)}`,
        );
      }
      inner = `<polygon points="${pts.join(" ")}" fill="none" stroke="${palette.fg}" stroke-width="1" opacity="0.9"/>`;
      break;
    }
    case 2: {
      // Hexagon with inner circle
      const rot = rng() * 60;
      const pts: string[] = [];
      for (let i = 0; i < 6; i++) {
        const a = ((rot + i * 60) * Math.PI) / 180;
        pts.push(
          `${(cx + Math.cos(a) * innerRadius).toFixed(2)},${(cy + Math.sin(a) * innerRadius).toFixed(2)}`,
        );
      }
      inner =
        `<polygon points="${pts.join(" ")}" fill="none" stroke="${palette.fg}" stroke-width="0.9" opacity="0.8"/>` +
        `<circle cx="${cx}" cy="${cy}" r="${(innerRadius * 0.4).toFixed(2)}" fill="${palette.fg}" opacity="0.7"/>`;
      break;
    }
    case 3: {
      // Spiral (approximated by polyline of 40 points)
      const turns = 2 + rng() * 1.5;
      const pts: string[] = [];
      const maxR = innerRadius;
      const steps = 40;
      for (let i = 0; i < steps; i++) {
        const t = i / (steps - 1);
        const a = t * turns * 2 * Math.PI;
        const r = t * maxR;
        pts.push(
          `${(cx + Math.cos(a) * r).toFixed(2)},${(cy + Math.sin(a) * r).toFixed(2)}`,
        );
      }
      inner = `<polyline points="${pts.join(" ")}" fill="none" stroke="${palette.fg}" stroke-width="1.1" stroke-linecap="round" opacity="0.88"/>`;
      break;
    }
    case 4:
    default: {
      // Concentric circles — data/scan feel
      const rings = 3;
      const parts: string[] = [];
      for (let i = 0; i < rings; i++) {
        const r = innerRadius * (1 - i * 0.25);
        parts.push(
          `<circle cx="${cx}" cy="${cy}" r="${r.toFixed(2)}" fill="none" stroke="${palette.fg}" stroke-width="${(1 - i * 0.2).toFixed(2)}" opacity="${(0.9 - i * 0.2).toFixed(2)}"/>`,
        );
      }
      inner = parts.join("");
      break;
    }
  }

  // ── Layer 4: accent — a single bezier across the composition ──
  const accent =
    detail === "minimal"
      ? ""
      : (() => {
          const x1 = 10 + rng() * 80;
          const y1 = 10 + rng() * 30;
          const x2 = 10 + rng() * 80;
          const y2 = 60 + rng() * 30;
          const cx1 = 20 + rng() * 60;
          const cy1 = 20 + rng() * 60;
          return `<path d="M ${x1.toFixed(1)} ${y1.toFixed(1)} Q ${cx1.toFixed(1)} ${cy1.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}" stroke="${palette.accent}" stroke-width="0.6" fill="none" opacity="0.3"/>`;
        })();

  // ── Layer 5: initials centre (for readability at tiny sizes) ──
  const initials = slug
    .split("-")
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
  const initialsLayer =
    detail === "rich"
      ? ""
      : `<text x="${cx}" y="${cy + 2}" text-anchor="middle" dominant-baseline="middle" font-family="ui-monospace, monospace" font-size="10" font-weight="600" fill="${palette.accent}" opacity="0.85" letter-spacing="-0.02em">${escapeAttr(initials)}</text>`;

  // ── Compose ──
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="${size}" height="${size}" role="img" aria-label="${escapeAttr(slug)} sigil">${frames.join("")}${accent}${nodes.join("")}${inner}${initialsLayer}</svg>`;
}

/**
 * Convenience: return a data URL for use in CSS / <img src=""> / OG images.
 */
export function agentSigilDataUrl(slug: string, opts: SigilOptions = {}): string {
  const svg = agentSigil(slug, opts);
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Return only the palette for a slug — useful when the caller wants to
 * match a border or glow color to the sigil without rendering it.
 */
export function sigilPalette(category?: string): Palette {
  return paletteFor(category);
}

// ─── Utils ────────────────────────────────────────────────────

function escapeAttr(s: string): string {
  return s.replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case '"':
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return ch;
    }
  });
}
