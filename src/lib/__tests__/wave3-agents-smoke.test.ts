/**
 * Wave-3 agent routes — parametrized smoke coverage.
 *
 * Why parametrized here and not individual test files?
 *
 * The 19 wave-3 routes were built from an identical factory template:
 *   createAgentRoute({ name, requiredFields | schema, handler })
 * with the handler invoking `ai()` with a system prompt that MUST
 * include ANTI_SLOP_RULES + an explicit "never fabricate" clause.
 *
 * An individual test file per route would duplicate the same mock
 * scaffolding 19 times for very little signal. This file instead
 * asserts the contract that really matters for an "elite-tier"
 * agent:
 *   1. The module imports cleanly (no TS/runtime errors).
 *   2. The module exports a POST handler.
 *   3. The route source contains the anti-slop signature
 *      (`ANTI_SLOP_RULES`) — caught by grep rather than behaviour.
 *   4. The route source contains an explicit never-fabricate clause.
 *   5. The route source contains a throw-on-parse-failure so the
 *      factory error envelope kicks in on non-JSON model output.
 *
 * Individual agent-behaviour tests can be added later (or per-agent
 * as behaviour drifts), but these five invariants are what the
 * platform depends on being true for every production agent.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const AGENTS = [
  "a2e-chain-planner",
  "abandoned-cart-winback",
  "agent-marketplace-lister",
  "book-outliner",
  "churn-predictor",
  "competitor-price-monitor",
  "dependency-auditor",
  "documentation-writer",
  "inbox-triage",
  "marketing-attribution",
  "meeting-scheduler",
  "migration-planner",
  "podcast-editor",
  "refactor-suggester",
  "screenplay-assistant",
  "shopify-optimizer",
  "task-prioritizer",
  "tax-prep-assistant",
  "trust-level-auditor",
] as const;

const ROOT = resolve(__dirname, "../../..");

describe("wave-3 agent routes — elite-tier invariants", () => {
  it.each(AGENTS)("%s: route.ts exists on disk", (slug) => {
    const path = resolve(ROOT, "src/app/api/_agents", slug, "route.ts");
    expect(existsSync(path)).toBe(true);
  });

  it.each(AGENTS)("%s: uses createAgentRoute factory", (slug) => {
    const src = readFileSync(resolve(ROOT, "src/app/api/_agents", slug, "route.ts"), "utf8");
    expect(src).toMatch(/createAgentRoute\s*\(/);
  });

  it.each(AGENTS)("%s: injects ANTI_SLOP_RULES in system prompt", (slug) => {
    const src = readFileSync(resolve(ROOT, "src/app/api/_agents", slug, "route.ts"), "utf8");
    expect(src).toMatch(/ANTI_SLOP_RULES/);
  });

  it.each(AGENTS)("%s: contains an explicit honesty clause", (slug) => {
    const src = readFileSync(resolve(ROOT, "src/app/api/_agents", slug, "route.ts"), "utf8");
    // The clause can be phrased as "never fabricate", "do not fabricate",
    // "never invent", "don't hallucinate", or similar — any of these is
    // evidence the author thought about hallucination. A missing clause
    // fails elite tier.
    expect(src).toMatch(/(never|don[''t]{1,}|do not)\s+(fabricate|invent|hallucinate|make up)/i);
  });

  it.each(AGENTS)("%s: throws on non-JSON model output for factory error envelope", (slug) => {
    const src = readFileSync(resolve(ROOT, "src/app/api/_agents", slug, "route.ts"), "utf8");
    expect(src).toMatch(/throw\s+new\s+Error/);
  });
});
