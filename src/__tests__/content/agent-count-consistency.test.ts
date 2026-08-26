/**
 * One agent count, everywhere.
 *
 * Why this exists: the platform shipped 140 agents while the site claimed
 * 117, 123, 124, 126, 129, 130, 131, 135, 137 and 145 — ten different
 * numbers across ~50 files, including the press page, the investor deck and
 * every /vs/* comparison. `src/lib/constants.ts` declared itself the single
 * source of truth and said every page MUST reference it, but almost nothing
 * did, so each surface hard-coded its own figure and drifted.
 *
 * Worse than the copy: `src/lib/agent-slugs.ts` — the client-safe list that
 * /agents, /marketplace, /api/agents and the OpenAPI spec all read — had
 * drifted to 136 entries. Four agents with working routes were invisible
 * everywhere a user browses. The file claimed to be generated; nothing
 * generated it.
 *
 * Both are now derived from the routes on disk via
 * `npm run gen:registry` (with a --check gate). This test guards the copy:
 * a three-digit agent count in shipped source must equal the real number,
 * and a "N+" floor must actually be a floor.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { AGENT_SLUGS } from "@/lib/agent-slugs";
import { METRICS } from "@/lib/constants";

const SRC = join(process.cwd(), "src");

/**
 * A count that describes *our* agents. Three digits only, so plan tiers
 * ("10 agents"), competitor figures ("12 agents") and playbook step counts
 * ("2 agents") are out of scope. The negative lookbehind keeps quota copy
 * like "10,000 agent runs/month" from matching on its last three digits,
 * and the trailing lookahead excludes the other quota shapes — "500 agent
 * calls/day", "100 agent runs per month" — which count usage, not agents.
 */
const CLAIM =
  /(?<![\d,.])(\d{3})(\+?)\s+(?:AI |pre-built |specialized |purpose-built |ready-to-run |)agents?\b(?!\s*(?:calls|runs|executions|tool|per\b))/gi;

/** A changelog records what a past release shipped; it is not a live claim. */
const EXEMPT = ["changelog"];

function sourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "__tests__") continue;
      sourceFiles(full, out);
    } else if (/\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe("agent count is consistent across the product", () => {
  it("the generated slug list matches the registry on disk", () => {
    const registry = readFileSync(
      join(SRC, "app", "api", "agents", "registry.ts"),
      "utf8",
    );
    const inRegistry = [...registry.matchAll(/^\s+"([a-z0-9-]+)":/gm)].map((m) => m[1]);
    expect(inRegistry.length).toBe(AGENT_SLUGS.length);
    // Not just the same length — the same agents. A swap would pass a
    // count check and still hide an agent from every browse surface.
    expect([...AGENT_SLUGS].sort()).toEqual([...inRegistry].sort());
  });

  it("constants.ts derives its count rather than hard-coding one", () => {
    expect(METRICS.agentCount).toBe(AGENT_SLUGS.length);
    expect(METRICS.agentEndpoints).toBe(AGENT_SLUGS.length);
  });

  it("no shipped file states a different agent count", () => {
    const violations: string[] = [];

    for (const file of sourceFiles(SRC)) {
      if (EXEMPT.some((e) => file.includes(e))) continue;
      const text = readFileSync(file, "utf8");
      const lines = text.split("\n");

      for (const [i, line] of lines.entries()) {
        for (const match of line.matchAll(CLAIM)) {
          const n = Number(match[1]);
          const isFloor = match[2] === "+";
          const rel = file.slice(SRC.length + 1);

          if (isFloor && n > AGENT_SLUGS.length) {
            violations.push(`${rel}:${i + 1} claims a floor of ${n}+ but only ${AGENT_SLUGS.length} agents exist`);
          } else if (!isFloor && n !== AGENT_SLUGS.length) {
            violations.push(`${rel}:${i + 1} says ${n} agents; the real count is ${AGENT_SLUGS.length}`);
          }
        }
      }
    }

    expect(violations, `\n${violations.join("\n")}\n`).toEqual([]);
  });
});
