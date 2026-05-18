/**
 * Tests for src/lib/ai-trace.ts — AI observability wrapper.
 *
 * Verifies:
 *   - The wrapper executes the work and returns its value (no-Sentry path)
 *   - Errors propagate (the wrapper never swallows)
 *   - spanAttributesFrom maps every field onto the gen_ai.* + sovereign.*
 *     OpenTelemetry semantic-convention namespace
 *   - User ids never appear raw on a span — only hashed
 *   - The Sentry path is invoked when startSpan exists (mocked)
 */
import { describe, it, expect, vi } from "vitest";
import {
  withAiSpan,
  spanAttributesFrom,
  type AiSpanAttributes,
} from "@/lib/ai-trace";

// ── spanAttributesFrom — pure projection ──────────────────────────────

describe("spanAttributesFrom", () => {
  it("emits the OpenTelemetry gen_ai.* attribute namespace", () => {
    const a: AiSpanAttributes = {
      model: "claude-sonnet-4-6",
      provider: "anthropic",
      taskType: "reasoning",
      inputTokens: 1200,
      outputTokens: 450,
      costCents: 7,
      cacheHit: false,
    };
    const out = spanAttributesFrom(a);
    expect(out["gen_ai.system"]).toBe("anthropic");
    expect(out["gen_ai.request.model"]).toBe("claude-sonnet-4-6");
    expect(out["gen_ai.task.type"]).toBe("reasoning");
    expect(out["gen_ai.usage.input_tokens"]).toBe(1200);
    expect(out["gen_ai.usage.output_tokens"]).toBe(450);
    expect(out["gen_ai.usage.cost_cents"]).toBe(7);
    expect(out["gen_ai.cache.hit"]).toBe(false);
  });

  it("never emits a raw user id — only the hashed observability id", () => {
    const out = spanAttributesFrom({
      model: "x",
      provider: "anthropic",
      userId: "user_2nA0p9XzReal",
    });
    expect(out["sovereign.user.id_hash"]).toBeTypeOf("string");
    expect(out["sovereign.user.id_hash"]).toMatch(/^[0-9a-f]{8}$/);
    // The raw id must not appear anywhere in the attribute map.
    expect(JSON.stringify(out)).not.toContain("user_2nA0p9XzReal");
  });

  it("omits optional fields cleanly", () => {
    const out = spanAttributesFrom({ model: "x", provider: "anthropic" });
    expect(Object.keys(out)).toEqual(["gen_ai.system", "gen_ai.request.model"]);
  });

  it("tenantId is passed through verbatim (it's already an internal id)", () => {
    const out = spanAttributesFrom({
      model: "x",
      provider: "anthropic",
      tenantId: "tenant_001",
    });
    expect(out["sovereign.tenant.id"]).toBe("tenant_001");
  });
});

// ── withAiSpan — no-Sentry path ───────────────────────────────────────

describe("withAiSpan — fast path (no Sentry)", () => {
  // The wrapper lazy-imports Sentry; when @sentry/nextjs returns no
  // startSpan, we expect the wrapper to just execute the work and
  // structured-log the call. In the test environment Sentry's startSpan
  // is present but harmless (no DSN means it no-ops upstream).

  it("returns the work's resolved value", async () => {
    const r = await withAiSpan(
      { model: "claude-sonnet-4-6", provider: "anthropic" },
      async () => "hello world",
    );
    expect(r).toBe("hello world");
  });

  it("propagates thrown errors (never swallows)", async () => {
    await expect(
      withAiSpan(
        { model: "claude-sonnet-4-6", provider: "anthropic" },
        async () => {
          throw new Error("kaboom");
        },
      ),
    ).rejects.toThrow("kaboom");
  });

  it("supports synchronous-style return values via async wrapper", async () => {
    const out = await withAiSpan(
      { model: "x", provider: "google" },
      async () => ({ ok: true, n: 42 }),
    );
    expect(out).toEqual({ ok: true, n: 42 });
  });
});

// ── withAiSpan — Sentry mocked ────────────────────────────────────────

describe("withAiSpan — Sentry path", () => {
  it("invokes Sentry.startSpan with the gen_ai.* attribute payload when available", async () => {
    // Mock @sentry/nextjs for this test only — reset modules so our
    // doMock is picked up by the lazy import inside ai-trace.
    const startSpan = vi.fn(
      async (
        _opts: { name: string; attributes: Record<string, unknown> },
        cb: (span: unknown) => Promise<unknown>,
      ) => cb({}),
    );
    vi.doMock("@sentry/nextjs", () => ({ startSpan }));
    vi.resetModules();

    const fresh = await import("@/lib/ai-trace");
    const out = await fresh.withAiSpan(
      {
        model: "claude-opus-4-7",
        provider: "anthropic",
        taskType: "reasoning",
        inputTokens: 100,
      },
      async () => "ok",
    );

    expect(out).toBe("ok");
    expect(startSpan).toHaveBeenCalledTimes(1);
    const callArgs = startSpan.mock.calls[0]![0]!;
    expect(callArgs.name).toBe("ai.anthropic.claude-opus-4-7");
    expect(callArgs.attributes).toEqual(
      expect.objectContaining({
        "gen_ai.system": "anthropic",
        "gen_ai.request.model": "claude-opus-4-7",
        "gen_ai.task.type": "reasoning",
        "gen_ai.usage.input_tokens": 100,
      }),
    );

    vi.doUnmock("@sentry/nextjs");
    vi.resetModules();
  });
});
