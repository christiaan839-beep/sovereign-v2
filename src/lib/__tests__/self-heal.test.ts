/**
 * Tests for src/lib/self-heal.ts
 *
 * Regression coverage: 7 agent routes (`leads`, `supply-chain`, `threat-hunt`,
 * `agri-intel`, `prior-auth`, `healthcare-docs`, `compliance-monitor`) import
 * `withSelfHeal` from this module. If the module is missing, all 7 routes
 * fail at module-load time in production (see git history).
 */
import { describe, it, expect, vi } from "vitest";
import { z } from "zod";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import { withSelfHeal } from "@/lib/self-heal";

describe("withSelfHeal", () => {
  it("returns the handler result on success", async () => {
    const handler = vi.fn().mockResolvedValue({ ok: true });
    const wrapped = withSelfHeal(handler, { label: "test" });
    const result = await wrapped({ input: { foo: "bar" } });
    expect(result).toEqual({ ok: true });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("retries up to maxRetries on recoverable failures", async () => {
    const handler = vi
      .fn()
      .mockRejectedValueOnce(new Error("transient"))
      .mockResolvedValue({ ok: true });
    const wrapped = withSelfHeal(handler, { label: "test", maxRetries: 1 });
    const result = await wrapped({ input: {} });
    expect(handler).toHaveBeenCalledTimes(2);
    // Heal trace surfaces on success after a retry
    expect(
      (result as { _healAttempts?: unknown[] })._healAttempts,
    ).toHaveLength(1);
  });

  it("re-throws after exhausting retries", async () => {
    const handler = vi.fn().mockRejectedValue(new Error("persistent failure"));
    const wrapped = withSelfHeal(handler, { label: "test", maxRetries: 2 });
    await expect(wrapped({ input: {} })).rejects.toThrow("persistent failure");
    expect(handler).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
  });

  it("does NOT retry security errors — they propagate immediately", async () => {
    const handler = vi
      .fn()
      .mockRejectedValue(new Error("Jailbreak attempt detected"));
    const wrapped = withSelfHeal(handler, { label: "test", maxRetries: 5 });
    await expect(wrapped({ input: {} })).rejects.toThrow("Jailbreak");
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not retry rate-limit / paywall errors", async () => {
    const cases = [
      "Rate limit exceeded",
      "Paywall block",
      "Quota exceeded",
      "Plan limit reached",
      "Unauthorized request",
      "Content safety violation",
    ];
    for (const msg of cases) {
      const handler = vi.fn().mockRejectedValue(new Error(msg));
      const wrapped = withSelfHeal(handler, { label: "test", maxRetries: 3 });
      await expect(wrapped({ input: {} })).rejects.toThrow(msg);
      expect(handler).toHaveBeenCalledTimes(1);
    }
  });

  it("validates input via Zod schema before running the handler", async () => {
    const schema = z.object({ niche: z.string().min(1) });
    const handler = vi.fn().mockResolvedValue({ ok: true });
    const wrapped = withSelfHeal(handler, {
      label: "test",
      maxRetries: 1,
      inputSchema: schema,
    });

    await expect(wrapped({ input: { niche: "" } })).rejects.toThrow(
      /input validation failed/,
    );
    expect(handler).not.toHaveBeenCalled();
  });

  it("schema validation failures do not trigger retries", async () => {
    const schema = z.object({ niche: z.string().min(1) });
    const handler = vi.fn().mockResolvedValue({ ok: true });
    const wrapped = withSelfHeal(handler, {
      label: "test",
      maxRetries: 5,
      inputSchema: schema,
    });
    await expect(wrapped({ input: { niche: "" } })).rejects.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });
});
