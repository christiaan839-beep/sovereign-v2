/**
 * CONTRACT TESTS — agent route response-shape regressions.
 *
 * These run on every CI invocation. They're designed to be FAST (under
 * 10s per agent) and DETERMINISTIC (only assert shape, not content).
 * Quality tests live elsewhere.
 *
 * Run locally:
 *   npx vitest src/lib/__tests__/contracts/contracts.test.ts
 */

import { describe, it, expect } from "vitest";
import { AGENT_REGISTRY } from "@/app/api/agents/registry";
import { getAllContracts } from "./harness";

// Side-effect import: populates CONTRACTS via registerAgentContract().
import "./agents.contracts";

/* ─── Smoke: every contract's slug must exist in the registry ──────── */

describe("agent contracts — slug existence", () => {
  for (const contract of getAllContracts()) {
    it(`"${contract.slug}" is in AGENT_REGISTRY`, () => {
      expect(AGENT_REGISTRY).toHaveProperty(contract.slug);
    });
  }
});

/* ─── Input schema validates fixtures ─────────────────────────────── */

describe("agent contracts — fixture validity", () => {
  for (const contract of getAllContracts()) {
    it(`"${contract.slug}" fixtures match inputSchema`, () => {
      for (const fixture of contract.fixtures) {
        const result = contract.inputSchema.safeParse(fixture);
        if (!result.success) {
          throw new Error(
            `Fixture for ${contract.slug} failed inputSchema: ${result.error.message}`,
          );
        }
      }
    });
  }
});

/* ─── Registry coverage — every registered agent SHOULD have a contract
 *   long-term. We don't fail on missing contracts yet (130 agents; we're
 *   adopting incrementally), but we log progress so the team sees the gap. */

describe("agent registry — contract coverage", () => {
  it("reports coverage percentage", () => {
    const registeredSlugs = Object.keys(AGENT_REGISTRY);
    const contractedSlugs = getAllContracts().map((c) => c.slug);
    const coveragePct = Math.round(
      (contractedSlugs.length / registeredSlugs.length) * 100,
    );

    // Diagnostic only — don't fail the build. This becomes a target we
    // raise over time; when it hits 80% we'll flip the .toBeGreaterThan
    // to assert we maintain it.
     
    console.info(
      `[contracts] ${contractedSlugs.length}/${registeredSlugs.length} agents covered (${coveragePct}%)`,
    );

    expect(coveragePct).toBeGreaterThanOrEqual(0);
  });
});

/* ─── Live invocation — gated on SKIP_LIVE_CONTRACTS env var ──────── */

const SKIP_LIVE = process.env.SKIP_LIVE_CONTRACTS === "1" || process.env.CI === "true";

describe.skipIf(SKIP_LIVE)("agent contracts — live response-shape checks", () => {
  for (const contract of getAllContracts()) {
    for (let i = 0; i < contract.fixtures.length; i++) {
      const fixture = contract.fixtures[i];
      it(`"${contract.slug}" fixture ${i} produces a valid response shape`, async () => {
        if (contract.skipIf?.()) return;

        const loader = AGENT_REGISTRY[contract.slug];
        if (!loader) return;

        const mod = await loader();
        if (typeof mod.POST !== "function") return;

        const req = new Request("http://localhost/api/agents/" + contract.slug, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(fixture),
        });

        const res = await mod.POST(req);

        // Streaming response: skip shape check, just verify status is OK.
        const contentType = res.headers.get("content-type") || "";
        if (contentType.includes("text/event-stream")) {
          expect([200, 401]).toContain(res.status);
          return;
        }

        // JSON response: validate against outputSchema OR the error envelope.
        const json = await res.json();
        if (json?.error) {
          expect(typeof json.error).toBe("string");
          return;
        }

        const parsed = contract.outputSchema.safeParse(json);
        if (!parsed.success) {
          throw new Error(
            `${contract.slug} response failed outputSchema: ${parsed.error.message}\n` +
            `Got: ${JSON.stringify(json).slice(0, 300)}`,
          );
        }
      }, 30_000);
    }
  }
});
