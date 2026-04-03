import { defineConfig, devices } from "@playwright/test";

/**
 * SOVEREIGN MATRIX — E2E Test Configuration
 *
 * Tests the complete user journey against the live production site.
 * No local server needed — tests hit sovereignmatrix.agency directly.
 *
 * Run:          npx playwright test
 * Run headed:   npx playwright test --headed
 * Run specific: npx playwright test e2e/landing.spec.ts
 * Run mobile:   npx playwright test --project="Mobile Safari"
 */

export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  retries: 1,
  reporter: [["html", { open: "never" }], ["list"]],

  use: {
    baseURL: process.env.E2E_BASE_URL || "https://sovereignmatrix.agency",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
    viewport: { width: 1280, height: 720 },
  },

  projects: [
    {
      name: "Desktop Chrome",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "Mobile Safari",
      use: { ...devices["iPhone 14"] },
    },
  ],
});
