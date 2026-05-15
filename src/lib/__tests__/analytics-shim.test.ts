/**
 * Tests for src/lib/analytics-shim.ts — Cook 154.
 */

import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  _resetShimConfigCache,
  getShimConfig,
  identifyShim,
  isShimEnabled,
  pageviewShim,
  trackEvent,
} from "../analytics-shim";

const KEYS = [
  "NEXT_PUBLIC_POSTHOG_KEY",
  "NEXT_PUBLIC_POSTHOG_HOST",
  "NEXT_PUBLIC_PLAUSIBLE_DOMAIN",
  "NEXT_PUBLIC_ANALYTICS_INGEST_PATH",
];

function snapshot(): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const k of KEYS) out[k] = process.env[k];
  return out;
}

function restore(snap: Record<string, string | undefined>): void {
  for (const k of KEYS) {
    if (snap[k] === undefined) delete process.env[k];
    else process.env[k] = snap[k];
  }
}

describe("getShimConfig", () => {
  let prev: Record<string, string | undefined>;

  beforeEach(() => {
    prev = snapshot();
    for (const k of KEYS) delete process.env[k];
    _resetShimConfigCache();
  });

  it("returns empty config when nothing is set", () => {
    const cfg = getShimConfig();
    expect(cfg.posthogKey).toBeUndefined();
    expect(cfg.plausibleDomain).toBeUndefined();
    expect(cfg.ingestEndpoint).toBeUndefined();
    restore(prev);
  });

  it("reads PostHog + Plausible env keys", () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
    process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN = "sovereignmatrix.agency";
    _resetShimConfigCache();
    const cfg = getShimConfig();
    expect(cfg.posthogKey).toBe("phc_test");
    expect(cfg.plausibleDomain).toBe("sovereignmatrix.agency");
    restore(prev);
  });

  it("defaults PostHog host when key is set but host is not", () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc_test";
    _resetShimConfigCache();
    expect(getShimConfig().posthogHost).toBe("https://app.posthog.com");
    restore(prev);
  });
});

describe("isShimEnabled", () => {
  let prev: Record<string, string | undefined>;

  beforeEach(() => {
    prev = snapshot();
    for (const k of KEYS) delete process.env[k];
    _resetShimConfigCache();
  });

  it("returns false when no provider configured", () => {
    expect(isShimEnabled()).toBe(false);
    restore(prev);
  });

  it("returns true when PostHog is set", () => {
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "phc";
    _resetShimConfigCache();
    expect(isShimEnabled()).toBe(true);
    restore(prev);
  });

  it("returns true when Plausible is set", () => {
    process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN = "x.com";
    _resetShimConfigCache();
    expect(isShimEnabled()).toBe(true);
    restore(prev);
  });

  it("returns true when first-party ingest endpoint is set", () => {
    process.env.NEXT_PUBLIC_ANALYTICS_INGEST_PATH = "/api/analytics";
    _resetShimConfigCache();
    expect(isShimEnabled()).toBe(true);
    restore(prev);
  });
});

describe("trackEvent — no-op safety", () => {
  let prev: Record<string, string | undefined>;

  beforeEach(() => {
    prev = snapshot();
    for (const k of KEYS) delete process.env[k];
    _resetShimConfigCache();
  });

  it("does not throw with no providers configured", () => {
    expect(() => trackEvent("test", { foo: "bar" })).not.toThrow();
    restore(prev);
  });

  it("does nothing on empty event names", () => {
    expect(() => trackEvent("", { foo: "bar" })).not.toThrow();
    restore(prev);
  });

  it("strips null and empty-string properties", () => {
    const fetchMock = vi.fn(() => Promise.resolve(new Response()));
    process.env.NEXT_PUBLIC_ANALYTICS_INGEST_PATH = "/api/_test/ingest";
    _resetShimConfigCache();

    const realFetch = global.fetch;
    global.fetch = fetchMock as unknown as typeof fetch;
    try {
      trackEvent("e", { a: "x", b: null, c: "", d: 42 });
      const body = JSON.parse(
        (fetchMock.mock.calls[0]?.[1]?.body as string) ?? "{}",
      );
      expect(body.props.a).toBe("x");
      expect(body.props.d).toBe(42);
      expect(body.props.b).toBeUndefined();
      expect(body.props.c).toBeUndefined();
    } finally {
      global.fetch = realFetch;
      restore(prev);
    }
  });
});

describe("pageviewShim + identifyShim", () => {
  let prev: Record<string, string | undefined>;

  beforeEach(() => {
    prev = snapshot();
    for (const k of KEYS) delete process.env[k];
    _resetShimConfigCache();
  });

  it("pageviewShim does not throw without providers", () => {
    expect(() => pageviewShim("/")).not.toThrow();
    restore(prev);
  });

  it("identifyShim is a no-op without a userId", () => {
    expect(() => identifyShim("")).not.toThrow();
    restore(prev);
  });
});
