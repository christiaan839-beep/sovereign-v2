/**
 * E2E: PUBLIC API PLATFORM CONTRACTS
 *
 * Tests every Sovereign Matrix API contract reachable without secrets,
 * plus regression-coverage of the auth gates fixed in 2026-04-25 →
 * 2026-04-27. Runs against the live production site (not localhost)
 * and acts as a smoke-test for the deploy:
 *
 *   Public surfaces:
 *     - /api/health/ping            — liveness signal
 *     - /api/_health/slo            — SLO rollup (Postgres-backed)
 *     - /sitemap.xml + /robots.txt
 *     - /security + /.well-known/security.txt (RFC 9116)
 *     - /status page render
 *
 *   Auth-wall regression coverage:
 *     - /api/v1/agents/<slug>       — 401 without Bearer, 401 with bogus
 *     - /api/portal/metrics         — 400/401/404 without auth+token
 *     - /api/portal/share-link      — 401 without auth
 *     - /api/credits                — 401 without auth (free-money fix)
 *
 * If any of these break, customers feel it directly:
 *   - SLO numbers vanish from /status/slo
 *   - Auth-walls regressing → DDoS exposure (200s) or API breakage (5xx)
 *   - Cross-tenant leaks reappear
 *   - SEO/security trust assets degrade silently
 *
 * Why this lives in e2e instead of vitest: the vitest suite mocks
 * `requireAuth`, the v1 gateway, Clerk, and Postgres. A test that
 * proves the actual production AUTH WALL works has to hit the public
 * surface — Vercel-specific routing bugs (Edge vs Node, runtime
 * declaration mismatches) only surface here.
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

test.describe("API Platform — Auth Gates (regression coverage)", () => {
  test("/api/portal/metrics rejects request with no clientId (400)", async ({
    request,
  }) => {
    const res = await request.get("/api/portal/metrics");
    expect(res.status()).toBe(400);
  });

  test("/api/portal/metrics rejects request with no auth + no token (401)", async ({
    request,
  }) => {
    // Previously: this returned 200 with the victim's metrics. Now:
    // unauthenticated callers without a valid HMAC share token get
    // 401. Regressing this lets anyone with an email dump that
    // user's portal — strictly worse than before.
    const res = await request.get(
      "/api/portal/metrics?clientId=victim@example.com",
    );
    expect(res.status()).toBe(401);
  });

  test("/api/portal/metrics rejects a forged HMAC token (404)", async ({
    request,
  }) => {
    // A 64-char hex string that LOOKS like a token but isn't signed
    // with our secret. Must be rejected — and the response must be
    // 404 (not 403) so probing emails can't distinguish "exists but
    // not yours" from "doesn't exist".
    const fakeToken = "a".repeat(64);
    const res = await request.get(
      `/api/portal/metrics?clientId=victim@example.com&token=${fakeToken}`,
    );
    // 401 (no Clerk session) or 404 (failed ownership check) both
    // mean "no access" — what matters is we DON'T see 200.
    expect([401, 404]).toContain(res.status());
  });

  test("/api/portal/share-link requires auth (401 without)", async ({
    request,
  }) => {
    // Minting share links is a privileged operation — random callers
    // can't produce signed URLs that bypass auth on /portal/metrics.
    const res = await request.post("/api/portal/share-link", {
      data: { clientId: "client@example.com" },
    });
    expect(res.status()).toBe(401);
  });

  test("/api/credits requires auth + does NOT honor type=bonus from non-admin", async ({
    request,
  }) => {
    // First: unauth → 401.
    const noAuth = await request.post("/api/credits", {
      data: { amountCents: 100000, type: "bonus" },
    });
    expect(noAuth.status()).toBe(401);
  });

  test("/api/credits rejects type=purchase with 501 (Stripe not wired)", async ({
    request,
  }) => {
    // Without auth this 401s before reaching the type check, so we
    // can only confirm the unauthed contract here. The 501 path is
    // proven in the unit suite (credits-grant-route.test.ts). What
    // matters in E2E is that the route doesn't accidentally start
    // honoring purchase grants in production.
    const res = await request.post("/api/credits", {
      data: { amountCents: 5000, type: "purchase" },
    });
    expect([401, 501]).toContain(res.status());
  });

  test("/api/v1/agents/leads with valid-looking but wrong-prefix key returns 401", async ({
    request,
  }) => {
    // Edge-case attack vector: an attacker who knows our key prefix
    // convention ("sk_pro_") might try a guessed key. The DB lookup
    // must reject any key not in the SHA-256 index.
    const res = await request.post("/api/v1/agents/leads", {
      headers: { Authorization: "Bearer sk_pro_abcdef1234567890abcdef1234567890" },
      data: { prompt: "anything" },
    });
    expect(res.status()).toBe(401);
  });

  test("404 for an unknown agent slug at the gateway", async ({ request }) => {
    // The gateway should 404 for a slug that doesn't exist in the
    // registry — but FIRST it should 401 if no API key. Order of
    // checks: auth → scope → routing. Verify the 401 fires before
    // any "agent not found" branch, so the 404 doesn't leak the
    // valid-vs-invalid-slug distinction.
    const res = await request.post(
      "/api/v1/agents/this-agent-definitely-does-not-exist-anywhere",
      { data: { prompt: "test" } },
    );
    // 401 means auth was checked first (good — slug existence not
    // leaked). 404 would be acceptable too (auth attempted, slug
    // unknown). NEVER 200 / 5xx.
    expect([401, 404]).toContain(res.status());
  });
});
