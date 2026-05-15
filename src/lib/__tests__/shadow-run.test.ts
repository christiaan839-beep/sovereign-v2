/**
 * Tests for src/lib/shadow-run.ts — Cook 131.
 */

import { describe, it, expect, vi } from "vitest";
import { shadowRun, shouldShadowSample } from "../shadow-run";

const compare = (a: unknown, b: unknown) => ({
  similarity: JSON.stringify(a) === JSON.stringify(b) ? 1 : 0,
});

describe("shadowRun — sampled out", () => {
  it("only runs live when sampled=false", async () => {
    const live = vi.fn().mockResolvedValue("LIVE");
    const shadow = vi.fn();
    const out = await shadowRun(
      { agentSlug: "x", input: {}, sampled: false },
      live,
      shadow,
      compare,
    );
    expect(out.liveOutput).toBe("LIVE");
    expect(out.shadow.ran).toBe(false);
    expect(shadow).not.toHaveBeenCalled();
  });

  it("only runs live when shadow runner is null", async () => {
    const live = vi.fn().mockResolvedValue("LIVE");
    const out = await shadowRun(
      { agentSlug: "x", input: {}, sampled: true },
      live,
      null,
      compare,
    );
    expect(out.shadow.ran).toBe(false);
  });
});

describe("shadowRun — both succeed", () => {
  it("matches when live + shadow agree", async () => {
    const live = vi.fn().mockResolvedValue({ ok: true });
    const shadow = vi.fn().mockResolvedValue({ ok: true });
    const out = await shadowRun(
      { agentSlug: "x", input: {}, sampled: true },
      live,
      shadow,
      compare,
    );
    expect(out.shadow.ran).toBe(true);
    expect(out.shadow.matched).toBe(true);
    expect(out.shadow.similarity).toBe(1);
  });

  it("flags drift when outputs differ", async () => {
    const live = vi.fn().mockResolvedValue({ ok: true });
    const shadow = vi.fn().mockResolvedValue({ ok: false });
    const out = await shadowRun(
      { agentSlug: "x", input: {}, sampled: true },
      live,
      shadow,
      compare,
    );
    expect(out.shadow.matched).toBe(false);
    expect(out.shadow.similarity).toBe(0);
  });
});

describe("shadowRun — failure handling", () => {
  it("propagates live errors", async () => {
    const live = vi.fn().mockRejectedValue(new Error("live down"));
    const shadow = vi.fn().mockResolvedValue("S");
    await expect(
      shadowRun(
        { agentSlug: "x", input: {}, sampled: true },
        live,
        shadow,
        compare,
      ),
    ).rejects.toThrow(/live down/);
  });

  it("captures shadow errors without affecting live", async () => {
    const live = vi.fn().mockResolvedValue("LIVE");
    const shadow = vi.fn().mockRejectedValue(new Error("shadow down"));
    const out = await shadowRun(
      { agentSlug: "x", input: {}, sampled: true },
      live,
      shadow,
      compare,
    );
    expect(out.liveOutput).toBe("LIVE");
    expect(out.shadow.reason).toBe("shadow-error");
    expect(out.shadow.message).toContain("shadow down");
  });
});

describe("shouldShadowSample", () => {
  it("returns false at 0% rate", () => {
    expect(
      shouldShadowSample({ tenantId: "t", agentSlug: "a", rate: 0, seed: "x" }),
    ).toBe(false);
  });

  it("returns true at 100% rate", () => {
    expect(
      shouldShadowSample({
        tenantId: "t",
        agentSlug: "a",
        rate: 100,
        seed: "x",
      }),
    ).toBe(true);
  });

  it("is deterministic for the same key", () => {
    const a = shouldShadowSample({
      tenantId: "t",
      agentSlug: "a",
      rate: 50,
      seed: "seed-1",
    });
    const b = shouldShadowSample({
      tenantId: "t",
      agentSlug: "a",
      rate: 50,
      seed: "seed-1",
    });
    expect(a).toBe(b);
  });

  it("approximates the target rate over many seeds", () => {
    let sampled = 0;
    for (let i = 0; i < 1000; i++) {
      if (
        shouldShadowSample({
          tenantId: "t",
          agentSlug: "a",
          rate: 50,
          seed: `seed-${i}`,
        })
      ) {
        sampled++;
      }
    }
    expect(sampled).toBeGreaterThan(400);
    expect(sampled).toBeLessThan(600);
  });
});
