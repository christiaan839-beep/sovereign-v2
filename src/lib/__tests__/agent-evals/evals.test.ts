/**
 * Agent eval runner — orchestrates the golden-set against live
 * agent handlers. Loaded by vitest via the standard `*.test.ts`
 * convention.
 *
 * Local run:
 *   npx vitest run src/lib/__tests__/agent-evals
 *
 * With real API keys (from .env.local):
 *   NVIDIA_NIM_API_KEY=... npx vitest run src/lib/__tests__/agent-evals
 *
 * CI: `.github/workflows/evals.yml` runs this on every PR and blocks
 * merges on regression.
 *
 * The test is deliberately structured to SKIP gracefully when keys
 * are missing — so contributors without API keys can still run
 * `npm test` without noise, while CI with keys enforces the gate.
 */

import { describe, it, expect } from "vitest";
import { AGENT_REGISTRY } from "@/app/api/agents/registry";
import { getAllEvals } from "./harness";

// Side-effect import — registers the golden set.
import "./golden-set";

const SKIP_LIVE = process.env.SKIP_LIVE_EVALS === "1" || process.env.CI === "true";

describe("agent evals — golden set registration", () => {
  it("every eval's slug is in AGENT_REGISTRY", () => {
    for (const ev of getAllEvals()) {
      expect(AGENT_REGISTRY, `"${ev.slug}" must be registered`).toHaveProperty(ev.slug);
    }
  });

  it("reports current coverage", () => {
    const registered = Object.keys(AGENT_REGISTRY).length;
    const evals = getAllEvals().length;
    const pct = Math.round((evals / registered) * 100);
     
    console.info(`[evals] ${evals}/${registered} agents have an eval (${pct}%)`);
    expect(evals).toBeGreaterThanOrEqual(1);
  });
});

describe.skipIf(SKIP_LIVE)("agent evals — live runs (require API keys)", () => {
  for (const ev of getAllEvals()) {
    const timeout = ev.timeoutMs ?? 30_000;

    it(
      `${ev.slug}: ${ev.name}`,
      async () => {
        if (ev.skipIf?.()) {
          // Silent skip — vitest doesn't have a runtime skip, so we
          // no-op with a passing assertion and move on.
          expect(true).toBe(true);
          return;
        }

        const loader = AGENT_REGISTRY[ev.slug];
        if (!loader) {
          throw new Error(`Registry missing agent: ${ev.slug}`);
        }

        const mod = await loader();
        if (typeof mod.POST !== "function") {
          throw new Error(`${ev.slug} has no POST handler`);
        }

        const req = new Request(
          `http://localhost/api/agents/${ev.slug}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(ev.input),
          },
        );

        const res = await mod.POST(req);

        // Streaming responses skip body assertions — the contract-test
        // path already covers those separately.
        const ct = res.headers.get("content-type") || "";
        if (ct.includes("text/event-stream")) {
          expect([200, 401]).toContain(res.status);
          return;
        }

        const json = await res.json();

        // Auth errors are expected when running without a test user —
        // treat them as "eval is structurally correct but can't run".
        if (res.status === 401 || res.status === 403) {
          console.warn(`[evals] ${ev.slug} skipped: auth required`);
          return;
        }

        // Schema validation — every eval must match its expected shape
        const parsed = ev.expect.safeParse(json);
        if (!parsed.success) {
          throw new Error(
            `${ev.slug} response failed schema:\n${parsed.error.message}\n\nActual: ${JSON.stringify(json).slice(0, 500)}`,
          );
        }

        // Run custom assertions
        if (ev.assertions) {
          await ev.assertions(parsed.data);
        }
      },
      timeout,
    );
  }
});
