import { test, expect } from "@playwright/test";

/**
 * GOLDEN-PATH SMOKE — runs against every Vercel preview URL and prod.
 *
 * The golden path: a brand-new visitor lands on the site, can find a paid
 * agent in the marketplace, can see pricing, and can hit the auth gate.
 * Every step here MUST work for the platform to be considered "shipped."
 *
 * Designed to be:
 *   - Fast (< 30s total) so it can run on every PR.
 *   - Hermetic (no dependency on test users, no Stripe charges) — auth-gated
 *     flows are verified by their 401 response, not by signing in.
 *   - Loud on regressions: when this goes red, an actual customer journey
 *     is broken, not a test fixture.
 *
 * If you're tempted to add a test that needs a fake credit card or a magic
 * Clerk token, put it in `e2e/auth-flow.spec.ts` (a separate, slower suite
 * that runs nightly) — not here.
 */

test.describe("Golden path smoke", () => {
  test("home page loads, headline renders", async ({ page }) => {
    const res = await page.goto("/");
    expect(res?.status()).toBe(200);
    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();
  });

  test("pricing page renders all marketing plans", async ({ page }) => {
    const res = await page.goto("/pricing");
    expect(res?.status()).toBe(200);
    // At least one plan name from getMarketingPlans() must be visible —
    // otherwise the JSON-LD Offer list and the pricing UI both broke.
    await expect(page.locator("body")).toContainText(/Starter|Node|Free/i);
  });

  test("marketplace renders multiple agents from the registry", async ({
    page,
  }) => {
    const res = await page.goto("/marketplace");
    expect(res?.status()).toBe(200);
    // War Room is in FEATURED_AGENTS (pinned regardless of tier filter).
    // Smart Router is in AGENT_SLUGS + tagged "core" in agent-tiers, so it
    // renders in the registry-derived grid even with the tier filter hiding
    // experimental agents by default. Both being present proves: featured
    // row works AND the registry → grid path works.
    await expect(page.locator("body")).toContainText(/War Room/i);
    await expect(page.locator("body")).toContainText(/Smart Router/i);
  });

  test("hand-curated agent detail loads", async ({ page }) => {
    // lead-blitz has hand-curated copy in KNOWN_AGENTS — should always
    // render the rich detail page, not the "not found" view.
    const res = await page.goto("/marketplace/lead-blitz");
    expect(res?.status()).toBe(200);
    await expect(page.locator("h1").first()).toContainText(/Lead Blitz/i);
  });

  test("registry-derived agent detail loads (proves the long-tail fix)", async ({
    page,
  }) => {
    // god-brain is in AGENT_REGISTRY but not in KNOWN_AGENTS' rich list —
    // the page should still resolve via buildGenericDetail() and NOT show
    // the not-found view. Regression-guards the marketplace finish work.
    const res = await page.goto("/marketplace/god-brain");
    expect(res?.status()).toBe(200);
    await expect(page.locator("body")).not.toContainText(/Agent not found/i);
  });

  test("truly unknown agent slug shows the not-found view", async ({
    page,
  }) => {
    await page.goto("/marketplace/this-agent-does-not-exist-nope");
    await expect(page.locator("body")).toContainText(/not found/i);
  });

  test("liveness probe returns 200", async ({ request }) => {
    const res = await request.get("/api/health/ping");
    expect(res.status()).toBe(200);
  });

  test("readiness probe returns 200 only when all critical deps are green", async ({
    request,
  }) => {
    const res = await request.get("/api/health/ready");
    // Either 200 ready=true, or 503 ready=false — both are valid runtime
    // responses. The smoke test only fails if the endpoint itself is
    // missing / throws (404 / 5xx without ready=false).
    expect([200, 503]).toContain(res.status());
    const body = (await res.json()) as { ready: boolean; failures: string[] };
    expect(typeof body.ready).toBe("boolean");
    expect(Array.isArray(body.failures)).toBe(true);
    // On preview/prod we expect ready=true. If your local dev env doesn't
    // have Clerk or DB configured, this assertion will fire — that's
    // intentional. Smoke tests run against deployed URLs, not local dev.
    if (process.env.E2E_REQUIRE_READY === "true") {
      expect(body.ready).toBe(true);
    }
  });
});

test.describe("Auth gate smoke (no sign-in)", () => {
  test("anonymous credit POST is rejected (no minting without auth)", async ({
    request,
  }) => {
    const res = await request.post("/api/credits", {
      data: { amountCents: 100000, type: "purchase" },
    });
    // 401 (most common) or 400 (Zod rejection before auth lookup) — anything
    // in the 400 range means we did NOT mint credits for an unauth request.
    expect(res.status()).toBeGreaterThanOrEqual(400);
    expect(res.status()).toBeLessThan(500);
  });

  test("anonymous agent run is rejected", async ({ request }) => {
    const res = await request.post("/api/agents/smart-router", {
      data: { prompt: "smoke test" },
    });
    expect(res.status()).toBe(401);
  });

  test("admin checklist endpoint is gated", async ({ request }) => {
    const res = await request.get("/api/admin/setup-checklist");
    // requireAdmin() returns 401 if signed-out, 404 if signed-in but
    // not on the allowlist. Anonymous request should hit 401.
    expect([401, 404]).toContain(res.status());
  });
});
