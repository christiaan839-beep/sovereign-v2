/**
 * E2E: PUBLIC API PLATFORM CONTRACTS
 *
 * Tests every Sovereign Matrix API contract that customers can call WITHOUT
 * authentication. These run against the live production site (not localhost)
 * and act as a smoke-test for the deploy:
 *
 *   - /api/health/ping            — liveness signal
 *   - /api/_health/slo            — SLO rollup (now backed by Postgres)
 *   - /api/v1/agents/<slug>       — gateway 401 without API key (auth wall)
 *   - /api/v1/health/ping         — gateway also requires the API key
 *   - /sitemap.xml                — SEO surface
 *   - /robots.txt                 — bot policy
 *
 * If any of these break, customers feel it directly:
 *   - SLO numbers vanish from /status/slo (the one we just fixed)
 *   - Auth-walls break → either DDoS exposure (if 200s) or API breakage
 *     (if 5xx)
 *   - SEO degrades silently
 *
 * Why this lives in e2e instead of vitest: the vitest suite mocks
 * `requireAuth`, the v1 gateway, and Postgres. A test that proves the
 * AUTH WALL works has to actually hit the public surface.
 */

import { test, expect } from "@playwright/test";

test.describe("API Platform — Public Contracts", () => {
  test("/api/health/ping returns ok", async ({ request }) => {
    // Vercel cron pings this every 4 minutes; if it ever stops returning
    // 200 we want to know before the cron alerts us.
    const res = await request.get("/api/health/ping");
    expect(res.status()).toBe(200);
  });

  test("/api/_health/slo returns shape with platform + topEndpoints", async ({
    request,
  }) => {
    // The SLO endpoint was just refactored to read from Postgres
    // (cross-instance accuracy). The shape it returns is what
    // /status/slo and any third-party uptime watcher consume.
    const res = await request.get("/api/_health/slo");
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body).toHaveProperty("platform");
    expect(body.platform).toHaveProperty("successRatePct");
    expect(body.platform).toHaveProperty("p95Ms");
    expect(body).toHaveProperty("topEndpoints");
    expect(Array.isArray(body.topEndpoints)).toBe(true);
    expect(body).toHaveProperty("generatedAt");

    // The meta.source field tells us which read path served the request
    // — postgres (good) or the per-instance ring buffer (degraded).
    // We don't fail on either, but at least one of the strings should
    // be present.
    expect(body.meta).toBeDefined();
    expect(typeof body.meta.source).toBe("string");
  });

  test("/api/v1/agents/leads requires a Bearer token (401 without)", async ({
    request,
  }) => {
    // The v1 gateway is the public API surface. It MUST return 401
    // without auth — never accidentally let an unauthenticated request
    // through to an agent handler. Anyone testing this contract should
    // see the same 401.
    const res = await request.post("/api/v1/agents/leads", {
      data: { prompt: "anything" },
    });
    expect(res.status()).toBe(401);
    const body = await res.json();
    expect(body.success).toBe(false);
    expect(typeof body.error).toBe("string");
    expect(body.error).toMatch(/api key/i);
  });

  test("/api/v1/agents/leads with bogus key returns 401", async ({
    request,
  }) => {
    // A correctly-shaped but invalid key should be rejected, not
    // mistaken for valid. The validateApiKey() flow looks up the
    // SHA-256 of the key in Postgres; a fake one yields no row → 401.
    const res = await request.post("/api/v1/agents/leads", {
      headers: { Authorization: "Bearer sk_pro_thisisnotarealkey" },
      data: { prompt: "anything" },
    });
    expect(res.status()).toBe(401);
  });

  test("/sitemap.xml is reachable and contains <urlset>", async ({
    request,
  }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toContain("<urlset");
    // Sanity: should reference at least one canonical URL we know exists.
    expect(text).toMatch(/sovereignmatrix\.agency/);
  });

  test("/robots.txt is reachable and not a 404", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const text = await res.text();
    // We deliberately allow indexing on most paths; the file should at
    // least be a real robots.txt with at least one User-agent line.
    expect(text).toMatch(/User-agent/i);
  });

  test("/api/health/ping responds in under 5 seconds", async ({ request }) => {
    // The ping endpoint is supposed to be cheap. If it's >5s, something
    // is wrong (probably a DB connection trying to succeed).
    const t0 = Date.now();
    const res = await request.get("/api/health/ping");
    const ms = Date.now() - t0;
    expect(res.status()).toBe(200);
    expect(ms).toBeLessThan(5000);
  });
});

test.describe("API Platform — SEO + Trust Surfaces", () => {
  test("/security page renders trust statement", async ({ page }) => {
    // Procurement teams hit this URL directly. If it breaks they think
    // we don't care about security.
    await page.goto("/security");
    await expect(page).toHaveTitle(/Security|Sovereign/i);
  });

  test("/.well-known/security.txt is reachable (RFC 9116)", async ({
    request,
  }) => {
    const res = await request.get("/.well-known/security.txt");
    expect(res.status()).toBe(200);
    const text = await res.text();
    // RFC 9116 requires Contact at minimum.
    expect(text).toMatch(/Contact:/i);
  });

  test("/status page renders without errors", async ({ page }) => {
    await page.goto("/status");
    // We use this as an external uptime probe — the page must render.
    await expect(page.locator("body")).toBeVisible();
  });
});
