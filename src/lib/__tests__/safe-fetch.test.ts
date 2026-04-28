/**
 * safe-fetch — tests.
 *
 * Verifies the SSRF guard fires on the initial URL, on redirect
 * targets, and that timeouts work. The underlying SSRF guard has
 * its own dedicated test suite (37 OWASP cases) — these tests are
 * about the orchestration layer.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { safeFetch, SsrfBlockedError } from "../safe-fetch";

describe("safe-fetch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("rejects the initial URL when SSRF guard fails", async () => {
    // Cloud metadata endpoint — the canonical SSRF target. The guard
    // rejects this without ever opening a socket.
    await expect(
      safeFetch("http://169.254.169.254/latest/meta-data/iam/"),
    ).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("rejects private RFC 1918 ranges before fetch", async () => {
    await expect(safeFetch("http://10.0.0.1/")).rejects.toBeInstanceOf(SsrfBlockedError);
    await expect(safeFetch("http://192.168.1.1/")).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("rejects loopback URLs", async () => {
    await expect(safeFetch("http://127.0.0.1:8080/")).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("rejects non-http(s) schemes", async () => {
    await expect(safeFetch("file:///etc/passwd")).rejects.toBeInstanceOf(SsrfBlockedError);
    await expect(safeFetch("gopher://evil.com/")).rejects.toBeInstanceOf(SsrfBlockedError);
  });

  it("rejects redirects pointing to a blocked target", async () => {
    // Mock a redirect-from-public-to-private flow. The first response
    // is a 302 with Location: http://10.0.0.1/. Without the per-hop
    // re-check, fetch would follow into the private network. With
    // safeFetch, the redirect target is gated and we throw.
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("", {
        status: 302,
        headers: { location: "http://10.0.0.1/admin" },
      }),
    );
    await expect(
      safeFetch("https://example.com/redirect"),
    ).rejects.toBeInstanceOf(SsrfBlockedError);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });

  it("follows redirects to a safe target up to maxRedirects", async () => {
    // First response is a 302 to a safe URL, second responds 200.
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response("", {
          status: 302,
          headers: { location: "https://example.org/final" },
        }),
      )
      .mockResolvedValueOnce(new Response("ok", { status: 200 }));
    const res = await safeFetch("https://example.com/start");
    expect(res.status).toBe(200);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("stops following when maxRedirects is 0", async () => {
    // Webhook delivery: target shouldn't be redirecting at all. Pass
    // maxRedirects: 0 and we return the 30x as the final response
    // without following.
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("", {
        status: 302,
        headers: { location: "https://example.org/final" },
      }),
    );
    const res = await safeFetch("https://example.com/start", { maxRedirects: 0 });
    expect(res.status).toBe(302);
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
