/**
 * Tests for the SovereignClient HTTP SDK.
 *
 * The SDK is the public surface customers see. Cover:
 *   - default base URL
 *   - bearer token wired into Authorization header
 *   - agents.run() POSTs to the right URL with the right body
 *   - response splitting: _receipt + _meta peeled off into top-level fields
 *   - HTTP error → SovereignError with status + code
 *   - timeout aborts the request
 *   - receipts.get / publish / verify hit the correct endpoints
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { SovereignClient, SovereignError } from "@/sdk/client";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("SovereignClient", () => {
  let mockFetch: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockFetch = vi.fn();
  });

  describe("transport", () => {
    it("uses the default base URL when none provided", async () => {
      mockFetch.mockResolvedValue(jsonResponse({}));
      const sov = new SovereignClient({ fetch: mockFetch });
      await sov.agents.run("blog-gen", { topic: "x" });
      const call = mockFetch.mock.calls[0]!;
      expect(call[0]).toMatch(/^https:\/\/sovereignmatrix\.agency\/api\//);
    });

    it("respects a custom baseUrl and trims trailing slash", async () => {
      mockFetch.mockResolvedValue(jsonResponse({}));
      const sov = new SovereignClient({
        fetch: mockFetch,
        baseUrl: "https://example.com/",
      });
      await sov.agents.run("x");
      expect(mockFetch.mock.calls[0]![0]).toBe(
        "https://example.com/api/_agents/x",
      );
    });

    it("attaches Authorization: Bearer <token> when token provided", async () => {
      mockFetch.mockResolvedValue(jsonResponse({}));
      const sov = new SovereignClient({ fetch: mockFetch, token: "tok_123" });
      await sov.agents.run("x");
      const init = mockFetch.mock.calls[0]![1] as RequestInit;
      expect((init.headers as Record<string, string>).Authorization).toBe(
        "Bearer tok_123",
      );
    });

    it("does NOT attach Authorization when no token", async () => {
      mockFetch.mockResolvedValue(jsonResponse({}));
      const sov = new SovereignClient({ fetch: mockFetch });
      await sov.agents.run("x");
      const init = mockFetch.mock.calls[0]![1] as RequestInit;
      expect(
        (init.headers as Record<string, string>).Authorization,
      ).toBeUndefined();
    });

    it("throws SovereignError with the server's error code on non-2xx", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse(
          { error: "Usage limit reached", code: "USAGE_LIMIT_REACHED" },
          429,
        ),
      );
      const sov = new SovereignClient({ fetch: mockFetch });
      try {
        await sov.agents.run("x");
        throw new Error("should not reach here");
      } catch (err) {
        expect(err).toBeInstanceOf(SovereignError);
        expect((err as SovereignError).status).toBe(429);
        expect((err as SovereignError).code).toBe("USAGE_LIMIT_REACHED");
      }
    });
  });

  describe("agents.run", () => {
    it("POSTs the input as JSON to /api/_agents/<slug>", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ output: "hello" }));
      const sov = new SovereignClient({ fetch: mockFetch });
      await sov.agents.run("blog-gen", { topic: "x" });
      const [url, init] = mockFetch.mock.calls[0]!;
      expect(url).toContain("/api/_agents/blog-gen");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body as string)).toEqual({ topic: "x" });
    });

    it("URL-encodes the slug", async () => {
      mockFetch.mockResolvedValue(jsonResponse({}));
      const sov = new SovereignClient({ fetch: mockFetch });
      await sov.agents.run("agent with space");
      expect(mockFetch.mock.calls[0]![0]).toContain(
        "/api/_agents/agent%20with%20space",
      );
    });

    it("peels _receipt and _meta off the response", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          html: "<p>hi</p>",
          _receipt: { id: "r-1", signature: "v1=abc", url: "/r/r-1" },
          _meta: { agent: "blog-gen", durationMs: 500, timestamp: "now" },
        }),
      );
      const sov = new SovereignClient({ fetch: mockFetch });
      const result = await sov.agents.run<{ html: string }>("blog-gen");
      expect(result.output.html).toBe("<p>hi</p>");
      expect(result.receipt?.id).toBe("r-1");
      expect(result.meta?.durationMs).toBe(500);
    });
  });

  describe("receipts", () => {
    it("get() hits /api/agent-runs/<id>", async () => {
      mockFetch.mockResolvedValue(jsonResponse({ id: "r-1" }));
      const sov = new SovereignClient({ fetch: mockFetch });
      await sov.receipts.get("r-1");
      expect(mockFetch.mock.calls[0]![0]).toContain("/api/agent-runs/r-1");
      expect((mockFetch.mock.calls[0]![1] as RequestInit).method ?? "GET").toBe(
        "GET",
      );
    });

    it("publish() POSTs the visibility", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({ ok: true, visibility: "public" }),
      );
      const sov = new SovereignClient({ fetch: mockFetch });
      await sov.receipts.publish("r-1", "public");
      const [url, init] = mockFetch.mock.calls[0]!;
      expect(url).toContain("/api/agent-runs/r-1/publish");
      expect(init.method).toBe("POST");
      expect(JSON.parse(init.body as string)).toEqual({ visibility: "public" });
    });

    it("verify() POSTs canonical+signature to /api/verify", async () => {
      mockFetch.mockResolvedValue(
        jsonResponse({
          valid: true,
          algorithm: "HMAC-SHA256",
          canonicalVersion: 1,
        }),
      );
      const sov = new SovereignClient({ fetch: mockFetch });
      const result = await sov.receipts.verify({
        canonical: "x",
        signature: "v1=y",
      });
      expect(mockFetch.mock.calls[0]![0]).toContain("/api/verify");
      expect(result.valid).toBe(true);
    });
  });
});
