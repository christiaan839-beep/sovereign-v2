/**
 * Tests for GET /api/_synthetic/latest — public read of synthetic probe.
 *
 * Covers:
 *   - returns 200 + JSON + open CORS
 *   - overall=ok when probes succeed
 *   - overall=fail when a probe is unreachable
 *   - cached on subsequent calls (single fetch hit)
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

const realFetch = globalThis.fetch;

async function loadRoute() {
  vi.resetModules();
  return await import("@/app/api/synthetic/latest/route");
}

function makeReq(): Request {
  return new Request("http://localhost/api/synthetic/latest", {
    headers: { host: "localhost:3000", "x-forwarded-proto": "http" },
  });
}

describe("GET /api/synthetic/latest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_APP_URL = "http://test.local";
  });

  it("returns 200 + JSON + open CORS when probes succeed", async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      let status = 200;
      if (url.includes("/api/verify")) status = 405;
      return new Response("", { status });
    }) as typeof fetch;

    try {
      const { GET } = await loadRoute();
      const res = await GET(makeReq());
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toMatch(/application\/json/);
      expect(res.headers.get("access-control-allow-origin")).toBe("*");
      const body = (await res.json()) as {
        overall: string;
        probes: Array<{ ok: boolean }>;
      };
      expect(body.overall).toBe("ok");
      expect(body.probes.every((p) => p.ok)).toBe(true);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("overall=fail when a probe is unreachable", async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error("ECONNREFUSED");
    }) as typeof fetch;

    try {
      const { GET } = await loadRoute();
      const res = await GET(makeReq());
      expect(res.status).toBe(200);
      const body = (await res.json()) as { overall: string };
      expect(body.overall).toBe("fail");
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  it("caches results across calls within TTL", async () => {
    let count = 0;
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      count++;
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
            ? input.toString()
            : input.url;
      let status = 200;
      if (url.includes("/api/verify")) status = 405;
      return new Response("", { status });
    }) as typeof fetch;

    try {
      const { GET } = await loadRoute();
      await GET(makeReq());
      const firstCount = count;
      await GET(makeReq());
      expect(count).toBe(firstCount); // cache hit, no extra fetches
    } finally {
      globalThis.fetch = realFetch;
    }
  });
});
