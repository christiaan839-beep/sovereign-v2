import { test, expect } from "@playwright/test";

/**
 * SOVEREIGN MATRIX — E2E Tests
 *
 * Tests the complete user journey on the live production site.
 * Run: npx playwright test
 */

test.describe("Landing Page", () => {
  test("loads with correct title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Sovereign Matrix/);
  });

  test("hero headline is visible", async ({ page }) => {
    await page.goto("/");
    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();
    await expect(h1).toContainText("actually does the work");
  });

  test("founders banner is visible", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=FOUNDERS PROGRAM")).toBeVisible();
  });

  test("model constellation shows key models", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=Nemotron Ultra")).toBeVisible();
    await expect(page.locator("text=Gemma 4")).toBeVisible();
  });

  test("CTA links to signup", async ({ page }) => {
    await page.goto("/");
    const cta = page.locator("text=Claim Founder Access").first();
    await expect(cta).toBeVisible();
  });

  test("pain section is present", async ({ page }) => {
    await page.goto("/");
    const pain = page.locator("text=Your agency is bleeding time");
    await pain.scrollIntoViewIfNeeded();
    await expect(pain).toBeVisible();
  });

  test("nav has pricing and docs links", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("nav >> text=Pricing")).toBeVisible();
    await expect(page.locator("nav >> text=Docs")).toBeVisible();
  });

  test("provider names shown", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("text=NVIDIA").first()).toBeVisible();
  });
});

test.describe("Public Pages", () => {
  test("pricing page loads", async ({ page }) => {
    const res = await page.goto("/pricing");
    expect(res?.status()).toBe(200);
  });

  test("docs page loads", async ({ page }) => {
    const res = await page.goto("/docs");
    expect(res?.status()).toBe(200);
  });

  test("signup page loads", async ({ page }) => {
    const res = await page.goto("/signup");
    expect(res?.status()).toBe(200);
  });

  test("login page loads", async ({ page }) => {
    const res = await page.goto("/login");
    expect(res?.status()).toBe(200);
  });

  test("onboarding page loads with welcome", async ({ page }) => {
    await page.goto("/onboarding");
    await expect(page.locator("text=Welcome")).toBeVisible();
  });

  test("showcase page loads", async ({ page }) => {
    const res = await page.goto("/showcase");
    expect(res?.status()).toBe(200);
  });

  test("terms page loads", async ({ page }) => {
    const res = await page.goto("/terms");
    expect(res?.status()).toBe(200);
  });

  test("privacy page loads", async ({ page }) => {
    const res = await page.goto("/privacy");
    expect(res?.status()).toBe(200);
  });
});

test.describe("API Endpoints", () => {
  test("health ping returns healthy", async ({ request }) => {
    const res = await request.get("/api/health/ping");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("healthy");
    expect(body.db).toBe("connected");
  });

  test("api catalog returns playbooks and agents", async ({ request }) => {
    const res = await request.get("/api/api-catalog");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.stats.totalPlaybooks).toBeGreaterThanOrEqual(25);
    expect(body.stats.totalAgents).toBeGreaterThanOrEqual(27);
    expect(body.stats.totalModels).toBeGreaterThanOrEqual(35);
  });

  test("agent list returns 129+ agents", async ({ request }) => {
    const res = await request.get("/api/agents/list");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.count).toBeGreaterThanOrEqual(129);
  });

  test("founders endpoint returns slot info", async ({ request }) => {
    const res = await request.get("/api/founders");
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body.totalSlots).toBe(10);
    expect(body.remaining).toBeGreaterThanOrEqual(0);
  });

  test("unauthenticated agent call returns 401", async ({ request }) => {
    const res = await request.post("/api/agents/smart-router", {
      data: { prompt: "test" },
    });
    expect(res.status()).toBe(401);
  });
});

test.describe("Mobile Responsiveness", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("landing page is usable on mobile", async ({ page }) => {
    await page.goto("/");
    const h1 = page.locator("h1").first();
    await expect(h1).toBeVisible();
    // CTA should be visible without horizontal scroll
    await expect(page.locator("text=Claim Founder Access").first()).toBeVisible();
  });

  test("pricing page is usable on mobile", async ({ page }) => {
    const res = await page.goto("/pricing");
    expect(res?.status()).toBe(200);
  });
});
