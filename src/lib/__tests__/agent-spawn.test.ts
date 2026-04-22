/**
 * Tests for src/lib/agent-spawn.ts — A2E spawn helper.
 *
 * Covers:
 *   - Slug not in registry → throws SpawnError("UNKNOWN_AGENT").
 *   - Depth already at MAX_A2E_DEPTH → throws SpawnError("A2E_DEPTH_EXCEEDED").
 *   - A2E cap exceeded for this parent → throws SpawnError("A2E_CAP_EXCEEDED").
 *   - Happy path → places hold, calls child via fetch, captures on 2xx.
 *   - Child HTTP non-2xx → releases hold, propagates SpawnError("CHILD_HTTP_ERROR").
 *
 * All external deps (credits, registry, fetch) are mocked. This file
 * exercises only the control-flow invariants of `spawnAgent`.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Mocks ────────────────────────────────────────────────────────────────

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

const { placeHold, captureHold, releaseHold } = vi.hoisted(() => ({
  placeHold: vi.fn(),
  captureHold: vi.fn(),
  releaseHold: vi.fn(),
}));
vi.mock("@/lib/credits", () => {
  class InsufficientCreditsError extends Error {
    constructor(
      public userId: string,
      public required: number,
      public available: number,
    ) {
      super(`Insufficient credits for ${userId}: need ${required}c, have ${available}c`);
      this.name = "InsufficientCreditsError";
    }
  }
  return {
    placeHold: (...args: unknown[]) => placeHold(...args),
    captureHold: (...args: unknown[]) => captureHold(...args),
    releaseHold: (...args: unknown[]) => releaseHold(...args),
    InsufficientCreditsError,
  };
});

vi.mock("@/app/api/agents/registry", () => ({
  // Minimal registry — three slugs are enough to cover all branches.
  AGENT_REGISTRY: {
    "known-agent": () => Promise.resolve({}),
    competitor: () => Promise.resolve({}),
    leads: () => Promise.resolve({}),
  },
}));

vi.mock("@/lib/base-url", () => ({
  getBaseUrl: () => "http://localhost:3000",
}));

// ── Import module under test after mocks ────────────────────────────────

import {
  spawnAgent,
  MAX_A2E_DEPTH,
  estimatedHoldCents,
  _getParentSpendCents,
  _resetParentSpend,
} from "@/lib/agent-spawn";

// ── Helpers ──────────────────────────────────────────────────────────────

type Parent = Parameters<typeof spawnAgent>[0]["parent"];
function makeParent(overrides: Partial<Parent> = {}): Parent {
  return {
    userId: "user_123",
    parentAgentSlug: "leads",
    parentHoldId: "parent_hold_abc",
    depth: 0,
    ...overrides,
  };
}

function mockFetchOk(body: Record<string, unknown> = { ok: true }): void {
  (globalThis as { fetch: typeof fetch }).fetch = vi.fn(async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }),
  ) as unknown as typeof fetch;
}

function mockFetchFail(status = 500): void {
  (globalThis as { fetch: typeof fetch }).fetch = vi.fn(async () =>
    new Response(JSON.stringify({ error: "oops" }), {
      status,
      headers: { "Content-Type": "application/json" },
    }),
  ) as unknown as typeof fetch;
}

// ── Tests ────────────────────────────────────────────────────────────────

describe("spawnAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetParentSpend();
    process.env.CRON_SECRET = "test_internal_secret";
    delete process.env.A2E_MAX_SPEND_CENTS_PER_PARENT;
    // Default: placeHold returns a deterministic child-hold id, capture
    // + release are both no-op resolvers. Individual tests override.
    placeHold.mockImplementation(async () => `hold_${Math.random().toString(36).slice(2, 10)}`);
    captureHold.mockResolvedValue(undefined);
    releaseHold.mockResolvedValue(undefined);
  });

  afterEach(() => {
    _resetParentSpend();
  });

  // ── 1. Unknown agent slug ──────────────────────────────────────────────

  it("throws SpawnError(UNKNOWN_AGENT) when slug is not in the registry", async () => {
    mockFetchOk();

    await expect(
      spawnAgent({
        slug: "no-such-agent",
        inputs: { foo: "bar" },
        parent: makeParent(),
      }),
    ).rejects.toMatchObject({
      name: "SpawnError",
      code: "UNKNOWN_AGENT",
    });

    // Critical: unknown-slug path must never touch billing.
    expect(placeHold).not.toHaveBeenCalled();
    expect(captureHold).not.toHaveBeenCalled();
    expect(releaseHold).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  // ── 2. Recursion depth cap ─────────────────────────────────────────────

  it("throws SpawnError(A2E_DEPTH_EXCEEDED) when parent depth is at the limit", async () => {
    mockFetchOk();

    await expect(
      spawnAgent({
        slug: "known-agent",
        inputs: {},
        parent: makeParent({ depth: MAX_A2E_DEPTH }),
      }),
    ).rejects.toMatchObject({
      name: "SpawnError",
      code: "A2E_DEPTH_EXCEEDED",
    });

    expect(placeHold).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("throws when parent depth is already beyond the limit", async () => {
    mockFetchOk();
    await expect(
      spawnAgent({
        slug: "known-agent",
        inputs: {},
        parent: makeParent({ depth: MAX_A2E_DEPTH + 5 }),
      }),
    ).rejects.toMatchObject({ code: "A2E_DEPTH_EXCEEDED" });
  });

  // ── 3. Per-parent spend cap ────────────────────────────────────────────

  it("throws SpawnError(A2E_CAP_EXCEEDED) when spawning would exceed the cap", async () => {
    // Configure a tiny per-parent cap so a single hold is right at the ceiling.
    process.env.A2E_MAX_SPEND_CENTS_PER_PARENT = "15";
    mockFetchOk();

    // First spawn consumes 10c → ledger now at 10, under 15c cap.
    await spawnAgent({
      slug: "known-agent",
      inputs: {},
      parent: makeParent(),
    });
    expect(_getParentSpendCents("parent_hold_abc")).toBe(
      estimatedHoldCents("known-agent"),
    );

    // Second spawn would push ledger to 20 > 15 → should reject.
    await expect(
      spawnAgent({
        slug: "known-agent",
        inputs: {},
        parent: makeParent(),
      }),
    ).rejects.toMatchObject({
      name: "SpawnError",
      code: "A2E_CAP_EXCEEDED",
    });

    // Confirm the cap check happens BEFORE the hold is placed for the
    // OVER-cap call. The first spawn DID place a hold; the over-cap
    // spawn short-circuits before touching credits.
    expect(placeHold).toHaveBeenCalledTimes(1);
  });

  it("different parents share no spend ledger", async () => {
    process.env.A2E_MAX_SPEND_CENTS_PER_PARENT = "15";
    mockFetchOk();

    await spawnAgent({
      slug: "known-agent",
      inputs: {},
      parent: makeParent({ parentHoldId: "parent_A" }),
    });
    // Second parent starts fresh → should succeed even if parent_A is
    // maxed out.
    await expect(
      spawnAgent({
        slug: "known-agent",
        inputs: {},
        parent: makeParent({ parentHoldId: "parent_B" }),
      }),
    ).resolves.toBeTruthy();
  });

  // ── 4. Happy path ──────────────────────────────────────────────────────

  it("places hold with correct metadata, calls child via HTTP, captures on success", async () => {
    mockFetchOk({ ok: true, result: "hello" });

    const out = await spawnAgent({
      slug: "competitor",
      inputs: { competitorName: "Acme", yourBusiness: "X" },
      parent: makeParent({
        parentAgentSlug: "leads",
        parentHoldId: "parent_hold_xyz",
        depth: 0,
      }),
    });

    expect(out).toEqual({ ok: true, result: "hello" });

    // Hold placed with extraMetadata carrying full A2E attribution.
    // The credits.ts safelist (agentSlug, parentHoldId, parentAgentSlug,
    // a2eDepth) propagates these onto the hold_capture row automatically.
    expect(placeHold).toHaveBeenCalledTimes(1);
    const [userId, amountCents, opts] = placeHold.mock.calls[0] as [
      string,
      number,
      { ttlMs?: number; extraMetadata?: Record<string, unknown> },
    ];
    expect(userId).toBe("user_123");
    expect(amountCents).toBe(estimatedHoldCents("competitor"));
    expect(opts.extraMetadata).toEqual({
      agentSlug: "competitor",
      parentHoldId: "parent_hold_xyz",
      parentAgentSlug: "leads",
      a2eDepth: 1, // parent depth was 0 → child is 1
    });
    // TTL is 5 minutes (matches agent-factory's default).
    expect(opts.ttlMs).toBe(5 * 60_000);

    // Child was invoked via fetch with the internal-secret headers.
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const fetchCall = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0];
    const [url, init] = fetchCall as [string, RequestInit];
    expect(url).toBe("http://localhost:3000/api/agents/competitor");
    expect((init.headers as Record<string, string>)["X-Sovereign-Internal-Secret"]).toBe(
      "test_internal_secret",
    );
    expect((init.headers as Record<string, string>)["X-Sovereign-User-Id"]).toBe("user_123");
    expect((init.headers as Record<string, string>)["X-A2E-Depth"]).toBe("1");

    // Body was forwarded + depth tag injected.
    const body = JSON.parse(init.body as string);
    expect(body.competitorName).toBe("Acme");
    expect(body._a2eDepth).toBe(1);
    expect(body._a2eParentSlug).toBe("leads");

    // On success: captureHold fires once, releaseHold never.
    expect(captureHold).toHaveBeenCalledTimes(1);
    expect(releaseHold).not.toHaveBeenCalled();
  });

  it("happy path increments the per-parent ledger", async () => {
    mockFetchOk();
    expect(_getParentSpendCents("parent_hold_abc")).toBe(0);
    await spawnAgent({
      slug: "known-agent",
      inputs: {},
      parent: makeParent(),
    });
    expect(_getParentSpendCents("parent_hold_abc")).toBe(
      estimatedHoldCents("known-agent"),
    );
  });

  // ── 5. Child HTTP failure → release hold, bubble error ─────────────────

  it("releases hold via releaseHold when the child HTTP call returns non-2xx", async () => {
    mockFetchFail(500);

    await expect(
      spawnAgent({
        slug: "competitor",
        inputs: {},
        parent: makeParent(),
      }),
    ).rejects.toMatchObject({
      name: "SpawnError",
      code: "CHILD_HTTP_ERROR",
    });

    // Hold placed ...
    expect(placeHold).toHaveBeenCalledTimes(1);
    // ... and released (refunds the user's balance + marks hold
    // released so the sweep-expired cron doesn't double-refund).
    expect(releaseHold).toHaveBeenCalledTimes(1);
    // captureHold must NOT be called on failure.
    expect(captureHold).not.toHaveBeenCalled();
    // releaseHold takes the childHoldId returned from placeHold.
    const [releasedHoldId] = releaseHold.mock.calls[0] as [string];
    expect(typeof releasedHoldId).toBe("string");
    expect(releasedHoldId).toMatch(/^hold_/);

    // Ledger was rolled back so subsequent spawns for this parent still
    // have their full budget available.
    expect(_getParentSpendCents("parent_hold_abc")).toBe(0);
  });

  it("also releases hold and bubbles a thrown network error", async () => {
    (globalThis as { fetch: typeof fetch }).fetch = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as unknown as typeof fetch;

    await expect(
      spawnAgent({
        slug: "known-agent",
        inputs: {},
        parent: makeParent(),
      }),
    ).rejects.toThrow(/ECONNREFUSED/);

    expect(placeHold).toHaveBeenCalledTimes(1);
    expect(releaseHold).toHaveBeenCalledTimes(1);
    expect(captureHold).not.toHaveBeenCalled();
    expect(_getParentSpendCents("parent_hold_abc")).toBe(0);
  });

  // ── 6. Internal-secret fail-closed ─────────────────────────────────────

  it("refuses to call the child when CRON_SECRET is unset (fail-closed), and refunds", async () => {
    delete process.env.CRON_SECRET;
    mockFetchOk(); // Shouldn't be reached anyway.

    await expect(
      spawnAgent({
        slug: "known-agent",
        inputs: {},
        parent: makeParent(),
      }),
    ).rejects.toMatchObject({
      name: "SpawnError",
      code: "INTERNAL_AUTH_UNCONFIGURED",
    });

    // Hold was placed optimistically, then released when the secret check
    // rejected the outbound call. This is the correct ordering: we cannot
    // know CRON_SECRET is unset until we're about to make the call, since
    // other env cases (transient unset, hot-reload) should still refund.
    expect(placeHold).toHaveBeenCalledTimes(1);
    expect(releaseHold).toHaveBeenCalledTimes(1);
    expect(captureHold).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
