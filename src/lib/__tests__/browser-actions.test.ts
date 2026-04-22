/**
 * browser-actions.ts — tests.
 *
 * Phase 1 of the Computer Use Expansion plan. Exercises the `fillForm`
 * typed action and the ACTION_REGISTRY scaffold. The session is a pure
 * mock — we never touch a real browser; we only assert that `fillForm`
 * validates inputs correctly and drives the mocked `page.fill(...)` in
 * the right order.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

import type { BrowserContextLike, PageLike } from "@/lib/browser-session";

function makeMockPage(): PageLike & { fill: ReturnType<typeof vi.fn> } {
  return {
    fill: vi.fn(async () => undefined),
    click: vi.fn(async () => undefined),
    waitForSelector: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
  };
}

function makeMockContext(page: PageLike): BrowserContextLike {
  return {
    newPage: vi.fn(async () => page),
    close: vi.fn(async () => undefined),
  };
}

describe("browser-actions — fillForm input validation", () => {
  let page: ReturnType<typeof makeMockPage>;
  let ctx: BrowserContextLike;

  beforeEach(() => {
    page = makeMockPage();
    ctx = makeMockContext(page);
  });

  it("rejects an empty fields array", async () => {
    const { fillForm } = await import("@/lib/browser-actions");
    await expect(fillForm(ctx, { fields: [] })).rejects.toThrow(/non-empty/i);
  });

  it("rejects a field with an empty selector", async () => {
    const { fillForm } = await import("@/lib/browser-actions");
    await expect(
      fillForm(ctx, { fields: [{ selector: "", value: "hi" }] }),
    ).rejects.toThrow(/selector/i);
  });

  it("rejects a field whose value is not a string", async () => {
    const { fillForm } = await import("@/lib/browser-actions");
    await expect(
      fillForm(ctx, {
        // @ts-expect-error — intentional bad input for the test
        fields: [{ selector: "#email", value: 123 }],
      }),
    ).rejects.toThrow();
  });

  it("rejects a field object missing selector entirely", async () => {
    const { fillForm } = await import("@/lib/browser-actions");
    await expect(
      fillForm(ctx, {
        // @ts-expect-error — missing required selector
        fields: [{ value: "abc" }],
      }),
    ).rejects.toThrow();
  });

  it("rejects when fields is not an array at all", async () => {
    const { fillForm } = await import("@/lib/browser-actions");
    await expect(
      // @ts-expect-error — intentional wrong shape
      fillForm(ctx, { fields: "not-an-array" }),
    ).rejects.toThrow();
  });
});

describe("browser-actions — fillForm happy path", () => {
  let page: ReturnType<typeof makeMockPage>;
  let ctx: BrowserContextLike;

  beforeEach(() => {
    page = makeMockPage();
    ctx = makeMockContext(page);
  });

  it("fills a single field", async () => {
    const { fillForm } = await import("@/lib/browser-actions");
    const result = await fillForm(ctx, {
      fields: [{ selector: "#email", value: "user@example.com" }],
    });
    expect(result.success).toBe(true);
    expect(result.filled).toBe(1);
    expect(page.fill).toHaveBeenCalledTimes(1);
    expect(page.fill).toHaveBeenCalledWith("#email", "user@example.com");
  });

  it("fills fields in the given order", async () => {
    const { fillForm } = await import("@/lib/browser-actions");
    await fillForm(ctx, {
      fields: [
        { selector: "#first", value: "alpha" },
        { selector: "#second", value: "beta" },
        { selector: "#third", value: "gamma" },
      ],
    });
    // Inspect the order of calls — mock.calls preserves invocation order.
    const calls = page.fill.mock.calls;
    expect(calls.map((c) => c[0])).toEqual(["#first", "#second", "#third"]);
    expect(calls.map((c) => c[1])).toEqual(["alpha", "beta", "gamma"]);
  });

  it("returns filled count equal to the field count on success", async () => {
    const { fillForm } = await import("@/lib/browser-actions");
    const result = await fillForm(ctx, {
      fields: [
        { selector: "a", value: "1" },
        { selector: "b", value: "2" },
      ],
    });
    expect(result.filled).toBe(2);
  });

  it("opens exactly one page on the context", async () => {
    const { fillForm } = await import("@/lib/browser-actions");
    await fillForm(ctx, {
      fields: [{ selector: "#x", value: "y" }],
    });
    expect(ctx.newPage).toHaveBeenCalledTimes(1);
  });

  it("accepts empty-string values (which are valid HTML form content)", async () => {
    const { fillForm } = await import("@/lib/browser-actions");
    // Clearing a field by filling with "" is a legitimate use case.
    const result = await fillForm(ctx, {
      fields: [{ selector: "#note", value: "" }],
    });
    expect(result.success).toBe(true);
    expect(page.fill).toHaveBeenCalledWith("#note", "");
  });
});

describe("browser-actions — fillForm failure handling", () => {
  it("surfaces an error mid-sequence with partial-progress count", async () => {
    const page = makeMockPage();
    // Succeed on the first call, throw on the second, stop there.
    let callIdx = 0;
    page.fill.mockImplementation(async () => {
      callIdx += 1;
      if (callIdx === 2) throw new Error("selector not found: #bad");
    });
    const ctx = makeMockContext(page);
    const { fillForm } = await import("@/lib/browser-actions");

    const result = await fillForm(ctx, {
      fields: [
        { selector: "#ok", value: "yes" },
        { selector: "#bad", value: "no" },
        { selector: "#never-reached", value: "x" },
      ],
    });

    expect(result.success).toBe(false);
    expect(result.filled).toBe(1);
    expect(result.error).toMatch(/selector not found/);
    // We should NOT continue after the failure — the third field stays
    // untouched so the test verifies we stopped on first error.
    expect(page.fill).toHaveBeenCalledTimes(2);
  });

  it("surfaces an error from newPage itself", async () => {
    const page = makeMockPage();
    const ctx: BrowserContextLike = {
      newPage: vi.fn(async () => {
        throw new Error("context is closed");
      }),
      close: vi.fn(),
    };
    const { fillForm } = await import("@/lib/browser-actions");

    const result = await fillForm(ctx, {
      fields: [{ selector: "#x", value: "y" }],
    });

    expect(result.success).toBe(false);
    expect(result.filled).toBe(0);
    expect(result.error).toMatch(/context is closed/);
    expect(page.fill).not.toHaveBeenCalled();
  });
});

describe("browser-actions — ACTION_REGISTRY scaffolding", () => {
  it("registers fillForm and keeps a stable key", async () => {
    const { ACTION_REGISTRY } = await import("@/lib/browser-actions");
    expect(typeof ACTION_REGISTRY.fillForm).toBe("function");
  });

  it("exposes the list of known action names", async () => {
    const { getKnownActions } = await import("@/lib/browser-actions");
    const names = getKnownActions();
    expect(Array.isArray(names)).toBe(true);
    expect(names).toContain("fillForm");
  });

  it("registry entry calls through to fillForm", async () => {
    const { ACTION_REGISTRY } = await import("@/lib/browser-actions");
    const page = makeMockPage();
    const ctx = makeMockContext(page);
    const result = (await ACTION_REGISTRY.fillForm(ctx, {
      fields: [{ selector: "#x", value: "y" }],
    })) as { success: boolean; filled: number };
    expect(result.success).toBe(true);
    expect(result.filled).toBe(1);
  });
});
