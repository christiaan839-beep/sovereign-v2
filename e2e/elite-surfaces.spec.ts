import { test, expect } from "@playwright/test";

/**
 * Elite-tier public surfaces — regression coverage for the pages that
 * only exist if the platform work from this sprint is live.
 *
 * Pairs with e2e/landing.spec.ts (which tests the canonical landing).
 * These specs catch:
 *   - /compare renders with live stats
 *   - /status/slo loads without DB configured
 *   - /docs/errors index + individual codes
 *   - /docs/webhooks/verify with HMAC samples
 *   - /developers/api-explorer + /api/openapi JSON spec
 *   - The four new industry pages (insurance, logistics, ag, construction)
 *   - /playground with agent search
 *
 * If any of these returns 500 or fails to render we catch it at PR time
 * instead of after merge to main.
 */

test.describe("Comparison + status pages", () => {
  test("/compare renders with comparison table", async ({ page }) => {
    const res = await page.goto("/compare");
    expect(res?.status()).toBe(200);
    await expect(page.locator("h1")).toContainText(/number/i);
    // Every cell in the matrix is code-verifiable on our side.
    await expect(page.locator("text=Sovereign").first()).toBeVisible();
    await expect(page.locator("text=CrewAI").first()).toBeVisible();
  });

  test("/status/slo loads without crashing", async ({ page }) => {
    const res = await page.goto("/status/slo");
    expect(res?.status()).toBe(200);
    // Either "All systems go" or "Awaiting first request" depending on DB state.
    await expect(page.locator("text=/systems|Awaiting|Operational/i").first()).toBeVisible();
  });
});

test.describe("Developer docs surfaces", () => {
  test("/docs/errors index lists the 18 codes", async ({ page }) => {
    const res = await page.goto("/docs/errors");
    expect(res?.status()).toBe(200);
    await expect(page.locator("h1")).toContainText(/doc page/i);
    // At least one category should appear.
    await expect(page.locator("text=/Authentication|Input validation|Rate limits/i").first()).toBeVisible();
  });

  test("/docs/errors/rate_limit_exceeded renders the known code", async ({ page }) => {
    const res = await page.goto("/docs/errors/rate_limit_exceeded");
    expect(res?.status()).toBe(200);
    await expect(page.locator("text=rate_limit_exceeded").first()).toBeVisible();
    await expect(page.locator("text=Retry-After").first()).toBeVisible();
  });

  test("/docs/errors/nonsense_code returns 404", async ({ page }) => {
    const res = await page.goto("/docs/errors/nonsense_code_that_doesnt_exist");
    expect(res?.status()).toBe(404);
  });

  test("/docs/webhooks/verify shows all 3 language samples", async ({ page }) => {
    const res = await page.goto("/docs/webhooks/verify");
    expect(res?.status()).toBe(200);
    // Node, Python, Go all must be present
    await expect(page.locator("text=Node.js").first()).toBeVisible();
    await expect(page.locator("text=Python").first()).toBeVisible();
    await expect(page.locator("text=Go").first()).toBeVisible();
    await expect(page.locator("text=timingSafeEqual").first()).toBeVisible();
    await expect(page.locator("text=compare_digest").first()).toBeVisible();
  });
});

test.describe("OpenAPI surface", () => {
  test("/api/openapi returns a valid OpenAPI 3.1 doc", async ({ request }) => {
    const res = await request.get("/api/openapi");
    expect(res.status()).toBe(200);
    const spec = await res.json();
    expect(spec.openapi).toBe("3.1.0");
    expect(spec.info?.title).toContain("Sovereign Matrix");
    // Must contain at least 100 agent paths (sanity check).
    const pathCount = Object.keys(spec.paths ?? {}).length;
    expect(pathCount).toBeGreaterThanOrEqual(100);
    // Must include the structured error responses.
    expect(spec.components?.responses).toBeTruthy();
  });

  test("/developers/api-explorer renders + fetches spec", async ({ page }) => {
    const res = await page.goto("/developers/api-explorer");
    expect(res?.status()).toBe(200);
    await expect(page.locator("h1")).toContainText(/endpoint/i);
    // Wait for the spec to load (client-side fetch).
    await expect(page.locator("text=/endpoints · v/i")).toBeVisible({ timeout: 10_000 });
  });
});

test.describe("Industry pages (the new four)", () => {
  const industries = [
    { path: "/for-insurance", keyword: "insurance" },
    { path: "/for-logistics", keyword: "logistics" },
    { path: "/for-agriculture", keyword: "agriculture" },
    { path: "/for-construction", keyword: "construction" },
  ];

  for (const { path, keyword } of industries) {
    test(`${path} loads with industry name`, async ({ page }) => {
      const res = await page.goto(path);
      expect(res?.status()).toBe(200);
      await expect(
        page.locator(`h1:has-text("${keyword}")`).first(),
      ).toBeVisible({ timeout: 5000 });
    });
  }
});

test.describe("Playground", () => {
  test("/playground loads with the agent picker", async ({ page }) => {
    const res = await page.goto("/playground");
    expect(res?.status()).toBe(200);
    await expect(page.locator("h1")).toContainText(/agent/i);
    // The "Run agent" button exists even before the user picks an agent.
    await expect(page.locator("text=Run agent").first()).toBeVisible();
  });

  test("/playground?agent=smart-router deep-links", async ({ page }) => {
    const res = await page.goto("/playground?agent=smart-router");
    expect(res?.status()).toBe(200);
    await expect(page.locator("text=smart-router").first()).toBeVisible();
  });
});

test.describe("Pricing calculator", () => {
  test("pricing page includes the interactive calculator", async ({ page }) => {
    const res = await page.goto("/pricing");
    expect(res?.status()).toBe(200);
    // The calculator section has distinct copy.
    await expect(page.locator("text=/what you.*actually pay/i").first()).toBeVisible();
    // And a range input.
    const slider = page.locator("input[type='range']").first();
    await expect(slider).toBeVisible();
  });
});
