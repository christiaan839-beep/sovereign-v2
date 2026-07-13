/**
 * Regression tests for the GLiNER PII detector's failure handling
 * (wave 122.6).
 *
 * Two bugs fixed here, both in the direction of a compliance detector
 * falsely reporting "clean":
 *   1. A failed/non-2xx NIM call fell through to `.json()` unchecked;
 *      the resulting empty content defaulted to `[]` — read as "no PII
 *      found" — instead of surfacing that the check never ran.
 *   2. `compliance: { gdpr: true, popia: true, ccpa: true }` was
 *      hardcoded even on a SUCCESSFUL call that found PII.
 *
 * Follows the established pattern (see growth-pulse.test.ts et al.):
 * createAgentRoute is mocked to a no-op so the route module can be
 * imported for its exported pure handler without pulling in the full
 * auth/plan-enforcement/guardrail pipeline.
 */
import { describe, it, expect, afterEach, vi } from "vitest";

vi.mock("@/lib/agent-factory", () => ({
  createAgentRoute: () => () => new Response("noop"),
}));

vi.mock("@/lib/nvidia", () => ({
  getNimKey: async () => "fake-nim-key",
}));

import { detectPii } from "@/app/api/_agents/gliner-pii/route";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("detectPii — NIM failure handling", () => {
  it("falls back to regex detection instead of falsely reporting CLEAN on a failed call", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Internal Server Error", { status: 500 })),
    );

    const result = await detectPii({
      input: { text: "Contact me at attacker@example.com" },
    });

    expect(result.success).toBe(true);
    expect(result.degraded).toBe(true);
    expect(result.model).toBe("regex-fallback");
    // The regex fallback actually found the email — must NOT report CLEAN.
    expect(result.risk_level).not.toBe("CLEAN");
    expect(result.entities_found).toBeGreaterThan(0);
    expect(result.compliance).toEqual({
      gdpr: false,
      popia: false,
      ccpa: false,
    });
  });

  it("reports CLEAN + compliant via the fallback when no PII pattern matches", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("Internal Server Error", { status: 500 })),
    );

    const result = await detectPii({
      input: { text: "Just a normal sentence." },
    });

    expect(result.degraded).toBe(true);
    expect(result.risk_level).toBe("CLEAN");
    expect(result.compliance).toEqual({ gdpr: true, popia: true, ccpa: true });
  });
});

describe("detectPii — compliance reflects findings on a successful call", () => {
  it("does NOT claim compliant when the model found PII (regression for the hardcoded-true bug)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              choices: [
                {
                  message: {
                    content: JSON.stringify([
                      {
                        type: "EMAIL",
                        value: "user@example.com",
                        start: 0,
                        confidence: 0.9,
                      },
                    ]),
                  },
                },
              ],
            }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    );

    const result = await detectPii({
      input: { text: "user@example.com is my email" },
    });

    expect(result.success).toBe(true);
    expect(result.entities_found).toBe(1);
    expect(result.risk_level).not.toBe("CLEAN");
    // Previously this was unconditionally {gdpr:true,popia:true,ccpa:true}
    // even though PII was just found.
    expect(result.compliance).toEqual({
      gdpr: false,
      popia: false,
      ccpa: false,
    });
  });

  it("claims compliant when the model finds no PII", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ choices: [{ message: { content: "[]" } }] }),
            { status: 200, headers: { "content-type": "application/json" } },
          ),
      ),
    );

    const result = await detectPii({
      input: { text: "nothing sensitive here" },
    });

    expect(result.risk_level).toBe("CLEAN");
    expect(result.compliance).toEqual({ gdpr: true, popia: true, ccpa: true });
  });
});
