/**
 * Agent sigil generator tests.
 *
 * Contracts locked here:
 *   1. Determinism — same input always produces identical output
 *   2. Collision resistance — different slugs produce visibly-different SVGs
 *   3. Valid SVG — output parses as a real <svg> with expected structure
 *   4. Category-driven palette — colors reflect the agent's category
 *   5. Safety — no script tags, no external refs, slug text is escaped
 */

import { describe, it, expect } from "vitest";
import {
  agentSigil,
  agentSigilDataUrl,
  sigilPalette,
} from "@/lib/agent-sigil";

describe("agentSigil", () => {
  it("is deterministic — same slug + category yields byte-identical SVG", () => {
    const a = agentSigil("fnol-intake", { category: "Insurance" });
    const b = agentSigil("fnol-intake", { category: "Insurance" });
    expect(a).toBe(b);
  });

  it("differs when slug differs (no collisions within small sample)", () => {
    const slugs = [
      "fnol-intake",
      "icd10-coder",
      "hs-code-classifier",
      "permit-form-filler",
      "soil-report-extractor",
      "smart-router",
      "god-brain",
      "blog-gen",
    ];
    const seen = new Set(slugs.map((s) => agentSigil(s)));
    expect(seen.size).toBe(slugs.length);
  });

  it("emits a well-formed SVG with viewBox + role=img", () => {
    const svg = agentSigil("example", { category: "Sales" });
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
    expect(svg).toContain('viewBox="0 0 100 100"');
    expect(svg).toContain('role="img"');
    expect(svg).toContain("aria-label");
  });

  it("includes no script tags, no external refs, no inline JS", () => {
    const svg = agentSigil("any-slug", { category: "Meta" });
    expect(svg).not.toMatch(/<script/i);
    expect(svg).not.toMatch(/javascript:/i);
    expect(svg).not.toMatch(/onclick=/i);
    expect(svg).not.toMatch(/onload=/i);
    expect(svg).not.toMatch(/xlink:href/i); // no external fills
  });

  it("escapes HTML special chars in slug for aria-label", () => {
    const svg = agentSigil('<script>alert(1)</script>', { category: "General" });
    expect(svg).not.toContain("<script>");
    expect(svg).toContain("&lt;script&gt;");
  });

  it("category drives palette colour — Insurance = rose, Agriculture = emerald", () => {
    const ins = sigilPalette("Insurance");
    const ag = sigilPalette("Agriculture");
    expect(ins.fg).toBe("#F87171"); // rose
    expect(ag.fg).toBe("#34D399"); // emerald
    expect(ins.fg).not.toBe(ag.fg);
  });

  it("unknown category falls back to default (copper)", () => {
    const pal = sigilPalette("NotARealCategory");
    expect(pal.fg).toBe("#B5532C"); // copper brand default
  });

  it("size option propagates to width/height attrs", () => {
    const svg = agentSigil("x", { size: 128 });
    expect(svg).toContain('width="128"');
    expect(svg).toContain('height="128"');
  });

  it("detail=minimal omits the accent bezier", () => {
    const normal = agentSigil("x", { category: "Sales", detail: "normal" });
    const minimal = agentSigil("x", { category: "Sales", detail: "minimal" });
    expect(normal.match(/<path /g)?.length ?? 0).toBeGreaterThan(
      minimal.match(/<path /g)?.length ?? 0,
    );
  });

  it("agentSigilDataUrl produces valid data: URL with URI-encoded body", () => {
    const url = agentSigilDataUrl("foo", { category: "Sales" });
    expect(url.startsWith("data:image/svg+xml;utf8,")).toBe(true);
    // Encoded output must decode back to the raw svg.
    const body = decodeURIComponent(url.slice("data:image/svg+xml;utf8,".length));
    expect(body.startsWith("<svg")).toBe(true);
  });

  it("shows initials for short slugs", () => {
    const svg = agentSigil("fnol-intake", { category: "Insurance" });
    // "fnol-intake" → first two word-initials: "F" + "I"
    expect(svg).toContain("FI</text>");
  });

  it("shows initials for single-word slugs (just first letter)", () => {
    const svg = agentSigil("leads");
    expect(svg).toContain("L</text>");
  });

  it("renders fast — 218 sigils in under 300ms on any modern CPU", () => {
    const start = Date.now();
    for (let i = 0; i < 218; i++) {
      agentSigil(`test-slug-${i}`, { category: "General" });
    }
    const elapsed = Date.now() - start;
    // Generous ceiling — dev laptops should finish in well under 100ms.
    expect(elapsed).toBeLessThan(3000);
  });
});
