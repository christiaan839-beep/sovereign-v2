import { test, expect } from '@playwright/test';

test.describe('Landing Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('page loads with correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/Sovereign Matrix/);
  });

  test('hero heading contains "Your AI"', async ({ page }) => {
    const heading = page.locator('h1').first();
    await expect(heading).toContainText('Your AI');
  });

  test('navigation links are visible', async ({ page }) => {
    await expect(page.getByRole('link', { name: /Platform/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Pricing/i })).toBeVisible();
    await expect(page.getByRole('link', { name: /Enterprise/i })).toBeVisible();
  });

  test('"Get Started" button links to /onboarding', async ({ page }) => {
    const getStarted = page.getByRole('link', { name: /Get Started/i });
    await expect(getStarted).toBeVisible();
    await expect(getStarted).toHaveAttribute('href', /\/onboarding/);
  });

  test('capabilities section shows 6 cards', async ({ page }) => {
    const capabilities = page.locator('[data-section="capabilities"], #capabilities, section').filter({ hasText: /capabilit/i }).first();
    // Scroll to ensure the section is in view
    if (await capabilities.count()) {
      await capabilities.scrollIntoViewIfNeeded();
    }
    // Look for capability cards — adjust selector to match actual markup
    const cards = page.locator('[data-section="capabilities"] > div > div, #capabilities .card, section:has-text("capabilit") [class*="card"], section:has-text("capabilit") > div > div > div');
    await expect(cards).toHaveCount(6);
  });

  test('footer contains key links', async ({ page }) => {
    const footer = page.locator('footer');
    await expect(footer.getByRole('link', { name: /docs/i })).toBeVisible();
    await expect(footer.getByRole('link', { name: /playground/i })).toBeVisible();
    await expect(footer.getByRole('link', { name: /status/i })).toBeVisible();
  });
});
