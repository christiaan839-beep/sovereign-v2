/**
 * Tests for src/lib/base-url.ts — Base URL Resolution
 *
 * Covers env-var fallback chains for both server-to-server URLs
 * (getBaseUrl) and user-facing URLs (getPublicUrl).
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";

import { getBaseUrl, getPublicUrl } from "@/lib/base-url";

describe("getBaseUrl", () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const originalVercelUrl = process.env.VERCEL_URL;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_URL;
  });

  afterEach(() => {
    if (originalAppUrl !== undefined) process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    else delete process.env.NEXT_PUBLIC_APP_URL;
    if (originalVercelUrl !== undefined) process.env.VERCEL_URL = originalVercelUrl;
    else delete process.env.VERCEL_URL;
  });

  it("prefers NEXT_PUBLIC_APP_URL when set", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://staging.example.com";
    process.env.VERCEL_URL = "vercel-preview.vercel.app";
    expect(getBaseUrl()).toBe("https://staging.example.com");
  });

  it("falls back to VERCEL_URL with https prefix when NEXT_PUBLIC_APP_URL unset", () => {
    process.env.VERCEL_URL = "my-preview-abc123.vercel.app";
    expect(getBaseUrl()).toBe("https://my-preview-abc123.vercel.app");
  });

  it("falls back to localhost when both env vars are unset", () => {
    expect(getBaseUrl()).toBe("http://localhost:3000");
  });

  it("treats empty string NEXT_PUBLIC_APP_URL as unset", () => {
    process.env.NEXT_PUBLIC_APP_URL = "";
    process.env.VERCEL_URL = "fallback.vercel.app";
    expect(getBaseUrl()).toBe("https://fallback.vercel.app");
  });
});

describe("getPublicUrl", () => {
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const originalVercelUrl = process.env.VERCEL_URL;

  beforeEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
    delete process.env.VERCEL_URL;
  });

  afterEach(() => {
    if (originalAppUrl !== undefined) process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    else delete process.env.NEXT_PUBLIC_APP_URL;
    if (originalVercelUrl !== undefined) process.env.VERCEL_URL = originalVercelUrl;
    else delete process.env.VERCEL_URL;
  });

  it("prefers NEXT_PUBLIC_APP_URL when set", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://prod.example.com";
    expect(getPublicUrl()).toBe("https://prod.example.com");
  });

  it("falls back to VERCEL_URL with https prefix", () => {
    process.env.VERCEL_URL = "preview.vercel.app";
    expect(getPublicUrl()).toBe("https://preview.vercel.app");
  });

  it("falls back to production domain when env vars unset (NOT localhost)", () => {
    expect(getPublicUrl()).toBe("https://sovereignmatrix.agency");
  });

  it("returns a URL that is safe for payment gateway redirects", () => {
    // Payment gateways need a publicly-reachable URL; localhost would break them.
    const url = getPublicUrl();
    expect(url).not.toMatch(/localhost/);
    expect(url).toMatch(/^https:\/\//);
  });
});
