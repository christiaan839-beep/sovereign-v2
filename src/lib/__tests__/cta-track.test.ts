/**
 * Tests for src/lib/cta-track.ts — client CTA click tracking.
 *
 * A regression that loses CTA attribution would hide which surfaces
 * are driving signups. Lock the payload shape + transport strategy
 * (sendBeacon-first, fetch-keepalive fallback) down behaviourally.
 *
 * The project vitest env is "node" (no DOM). We use vi.stubGlobal
 * to install minimal window/localStorage/navigator/Blob shims.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

class MemStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.has(k) ? (this.m.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, v);
  }
  clear(): void {
    this.m.clear();
  }
}

// Install DOM-ish globals once at the module level so the import of
// the module under test sees them if it reads at module-load time.
// (cta-track only reads them at call time, but this is safer.)
const mem = new MemStorage();
vi.stubGlobal("window", { location: { pathname: "/test" } } as unknown as Window);
vi.stubGlobal("localStorage", mem);
vi.stubGlobal(
  "Blob",
  class {
    constructor(
      public parts: unknown[],
      public opts?: { type?: string },
    ) {}
  } as unknown as typeof Blob,
);

import { trackCtaClick, getOrCreateSessionId } from "@/lib/cta-track";

describe("getOrCreateSessionId", () => {
  beforeEach(() => mem.clear());

  it("generates and persists an id", () => {
    const id = getOrCreateSessionId();
    expect(id.length).toBeGreaterThan(10);
    expect(mem.getItem("sovereign-session-v1")).toBe(id);
  });

  it("returns the same id on subsequent calls", () => {
    const a = getOrCreateSessionId();
    const b = getOrCreateSessionId();
    expect(a).toBe(b);
  });
});

describe("trackCtaClick", () => {
  type BeaconFn = (url: string, data?: BodyInit) => boolean;
  let sendBeaconSpy: ReturnType<typeof vi.fn>;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mem.clear();
    sendBeaconSpy = vi.fn(() => true);
    vi.stubGlobal("navigator", { sendBeacon: sendBeaconSpy as unknown as BeaconFn });
    fetchMock = vi.fn().mockResolvedValue(new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // Re-install the persistent window/localStorage/Blob shims for
    // the next test (unstubAllGlobals clears everything).
    vi.stubGlobal("window", { location: { pathname: "/test" } } as unknown as Window);
    vi.stubGlobal("localStorage", mem);
    vi.stubGlobal(
      "Blob",
      class {
        constructor(
          public parts: unknown[],
          public opts?: { type?: string },
        ) {}
      } as unknown as typeof Blob,
    );
  });

  it("posts to /api/_misc/cta-click via sendBeacon", () => {
    trackCtaClick("primary-hero", { sourcePath: "/" });

    expect(sendBeaconSpy).toHaveBeenCalledTimes(1);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(sendBeaconSpy.mock.calls[0][0]).toBe("/api/_misc/cta-click");
  });

  it("falls back to fetch keepalive when sendBeacon is missing", () => {
    vi.stubGlobal("navigator", {});

    trackCtaClick("seat-claim");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/_misc/cta-click");
    expect(init).toMatchObject({
      method: "POST",
      keepalive: true,
      headers: { "Content-Type": "application/json" },
    });
  });

  it("includes ctaName, sourcePath, and sessionId in the payload", () => {
    vi.stubGlobal("navigator", {});

    trackCtaClick("playbook-card", { sourcePath: "/landing" });

    const [, init] = fetchMock.mock.calls[0];
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toMatchObject({
      ctaName: "playbook-card",
      sourcePath: "/landing",
    });
    expect(typeof body.sessionId).toBe("string");
    expect(body.sessionId.length).toBeGreaterThan(10);
  });

  it("never throws when fetch rejects (analytics must not block clicks)", () => {
    vi.stubGlobal("navigator", {});
    fetchMock.mockRejectedValueOnce(new Error("network down"));

    expect(() => trackCtaClick("email-founder")).not.toThrow();
  });
});
