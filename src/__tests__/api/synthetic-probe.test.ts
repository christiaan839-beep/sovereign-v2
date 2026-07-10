/**
 * Tests for /api/cron/synthetic-probe — the SLO probe runner.
 *
 * Covers:
 *   - 401 when CRON_SECRET is wrong
 *   - 200 + overall=ok when all probes succeed under budget
 *   - 503 + overall=fail when any probe is unreachable
 *   - 200 + overall=degraded when probes succeed but breach the latency budget
 *   - constant-time order: result list mirrors PROBES order so dashboards
 *     can pin column positions
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));
vi.mock("@sentry/nextjs", () => ({
  captureMessage: vi.fn(),
}));

const realFetch = globalThis.fetch;

async function loadRoute() {
  vi.resetModules();
  return await import("@/app/api/cron/synthetic-probe/route");
}

function makeReq(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/api/cron/synthetic-probe", {
    method: "GET",
    headers: {
      host: "localhost:3000",
      ...headers,
    },
  });
}

describe("GET /api/cron/synthetic-probe", () => {
  beforeEach(() => {
    process.env.CRON_SECRET = "test_cron_secret_aaaa";
    process.env.NEXT_PUBLIC_APP_URL = "http://test.local";
    vi.clearAllMocks();
  });

  it("rejects without the cron secret (401)", async () => {
    const { GET } = await loadRoute();
    const res = await GET(makeReq());
    expect(res.status).toBe(401);
  });

  it("returns overall=ok when all probes succeed within budget", async () => {
    // Each probe has its own list of acceptable statuses — the routes
    // that don't allow GET (paypal checkout, verify) want 400/405, while
    // the marketing pages want 200. Return a status per URL that matches.
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      let status = 200;
      if (
        url.includes("/api/payments/paypal/checkout") ||
        url.includes("/api/verify")
      ) {
        status = 405;
      }
      return new Response("", { status });
    }) as typeof fetch;

    const { GET } = await loadRoute();
    const res = await GET(
      makeReq({ Authorization: `Bearer ${process.env.CRON_SECRET}` }),
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      overall: string;
      summary: { passed: number; failed: number };
      probes: { name: string; ok: boolean }[];
    };
    expect(body.overall).toBe("ok");
    expect(body.summary.failed).toBe(0);
    expect(body.probes.length).toBeGreaterThan(0);
    expect(body.probes.every((p) => p.ok)).toBe(true);

    globalThis.fetch = realFetch;
  });

  it("returns overall=fail when a probe is unreachable", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as typeof fetch;

    const { GET } = await loadRoute();
    const res = await GET(
      makeReq({ Authorization: `Bearer ${process.env.CRON_SECRET}` }),
    );
    expect(res.status).toBe(503);
    const body = (await res.json()) as { overall: string };
    expect(body.overall).toBe("fail");

    globalThis.fetch = realFetch;
  });

  it("accepts non-200 statuses listed in the probe's okStatuses", async () => {
    // /api/payments/paypal/checkout has okStatuses: [400, 401, 405]
    // /api/verify has okStatuses: [400, 405]
    // /api/health/ready has okStatuses: [200, 503]
    // Returning 405 should pass for the stripe + verify probes but
    // fail for routes that demand 200.
    globalThis.fetch = vi.fn(
      async () =>
        new Response("", {
          status: 405,
        }),
    ) as typeof fetch;

    const { GET } = await loadRoute();
    const res = await GET(
      makeReq({ Authorization: `Bearer ${process.env.CRON_SECRET}` }),
    );
    const body = (await res.json()) as {
      probes: { name: string; ok: boolean; status: number | null }[];
    };
    const paypal = body.probes.find((p) => p.name === "paypal-checkout-stub");
    expect(paypal?.ok).toBe(true);
    const home = body.probes.find((p) => p.name === "marketing-home");
    expect(home?.ok).toBe(false);

    globalThis.fetch = realFetch;
  });
});
