/**
 * A published figure must be one this repository can produce.
 *
 * CLAUDE.md has said so all along, and the site still published "39+ models"
 * on ten surfaces against a registry of twenty, and six different agent counts
 * across live pages and outbound email. Intention did not keep those true, so
 * this does.
 *
 * The check scans the source that actually reaches a reader — pages,
 * components, and the API routes that compose emails and docs — for a
 * hardcoded count next to the word it counts, and fails when the number is not
 * the derived one. Interpolating `MODELS_LABEL` / `AGENTS_LABEL` passes,
 * because there is no literal to disagree with.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  MODEL_COUNT,
  PROVIDER_COUNT,
  AGENT_COUNT,
  MODELS_LABEL,
  AGENTS_LABEL,
} from "../published-counts";
import { MODELS } from "../model-registry";
import { AGENT_SLUGS } from "@/app/api/agents/registry";

const ROOT = process.cwd();
/**
 * Surfaces a reader actually sees: pages, layouts, the OG image, shared
 * components, and the routes that compose outbound email or public API docs.
 * Deliberately not every file under src/app — a first attempt scanned all of
 * it and produced 223 hits, almost all of them runtime values and limits
 * ("top 5 agents", `.slice(0, 10)`) or fragments of larger numbers ("10,000
 * agent runs" matching as "000 agent"). A gate that cries wolf gets muted.
 */
const SCAN_GLOBS = [
  { dir: "src/components", match: /\.(ts|tsx)$/ },
  { dir: "src/app", match: /(page|layout|opengraph-image|twitter-image)\.tsx?$/ },
];
const EXTRA_FILES = [
  "src/app/api/_email/send/route.ts",
  "src/app/api/_misc/api-docs/route.ts",
  "src/app/api/_misc/api-catalog/route.ts",
];

/** Files whose job is to define or test the counts themselves. */
const EXEMPT = [
  "src/app/api/agents/registry.ts",
  "src/lib/published-counts.ts",
  // A changelog is a historical record. "124 agents" in a wave-63 entry was
  // true when it was written; rewriting it to today's number would falsify
  // the history rather than correct a claim.
  "src/app/changelog/page.tsx",
];

function sourceFiles(dir: string, match: RegExp): string[] {
  const out: string[] = [];
  const walk = (d: string) => {
    for (const entry of readdirSync(d)) {
      const full = join(d, entry);
      if (statSync(full).isDirectory()) {
        if (entry === "node_modules" || entry === "__tests__") continue;
        walk(full);
      } else if (match.test(entry) && !/\.test\.tsx?$/.test(entry)) {
        out.push(full);
      }
    }
  };
  walk(join(ROOT, dir));
  return out;
}

/**
 * A capability claim, not a runtime value: either the "N+" marketing shape, or
 * a bare number large enough that it can only be asserting the whole catalogue.
 * The negative lookbehind stops "10,000 agent runs" matching as "000 agent".
 */
const CLAIM =
  /(?<![\d,.])(\d{1,4})\s*(\+)?\s*(?:(?:AI|specialized|specialised|production|custom|autonomous)\s+){0,2}(models?|model backends?|agents?|providers?)\b/gi;

/** Below these, a bare number is a limit or a sample, not a catalogue claim. */
const CATALOGUE_FLOOR: Record<string, number> = { model: 15, agent: 100, provider: 5 };

describe("published counts are derived, not typed", () => {
  it("the derived counts match the registries", () => {
    expect(MODEL_COUNT).toBe(Object.keys(MODELS).length);
    expect(AGENT_COUNT).toBe(AGENT_SLUGS.length);
    expect(PROVIDER_COUNT).toBe(
      new Set(Object.values(MODELS).map((m) => m.provider)).size,
    );
    // Guards the guard: if a registry emptied, every assertion below would
    // pass vacuously against zero.
    expect(MODEL_COUNT).toBeGreaterThan(0);
    expect(AGENT_COUNT).toBeGreaterThan(0);
  });

  it("no published source states a count the registries contradict", () => {
    const offences: string[] = [];

    const files = [
      ...SCAN_GLOBS.flatMap((g) => sourceFiles(g.dir, g.match)),
      ...EXTRA_FILES.map((f) => join(ROOT, f)),
    ];
    {
      for (const file of files) {
        const rel = relative(ROOT, file);
        if (EXEMPT.some((e) => rel === e)) continue;
        const text = readFileSync(file, "utf8");

        for (const m of text.matchAll(CLAIM)) {
          const n = Number(m[1]);
          const plus = Boolean(m[2]);
          const noun = m[3].toLowerCase();
          const kind = noun.startsWith("model")
            ? "model"
            : noun.startsWith("agent")
              ? "agent"
              : "provider";
          const expected =
            kind === "model" ? MODEL_COUNT : kind === "agent" ? AGENT_COUNT : PROVIDER_COUNT;
          // A bare small number is a limit ("top 5 agents"), not a claim.
          if (!plus && n < CATALOGUE_FLOOR[kind]) continue;
          if (n !== expected) {
            const line = text.slice(0, m.index).split("\n").length;
            offences.push(`${rel}:${line}  "${m[0].trim()}" — registry says ${expected}`);
          }
        }
      }
    }

    expect(
      offences,
      `published source states ${offences.length} count(s) the registries do not support.\n` +
        `Interpolate MODELS_LABEL / AGENTS_LABEL from src/lib/published-counts.ts instead:\n\n` +
        offences.map((o) => "  " + o).join("\n"),
    ).toEqual([]);
  });

  it("the labels read correctly", () => {
    expect(MODELS_LABEL).toBe(`${MODEL_COUNT} models`);
    expect(AGENTS_LABEL).toBe(`${AGENT_COUNT} agents`);
  });
});
