# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> Golden path smoke >> readiness probe returns 200 only when all critical deps are green
- Location: e2e/smoke.spec.ts:94:7

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected value: 402
Received array: [200, 503]
```

# Test source

```ts
  1   | import { test, expect } from "@playwright/test";
  2   |
  3   | /**
  4   |  * GOLDEN-PATH SMOKE — runs against every Vercel preview URL and prod.
  5   |  *
  6   |  * The golden path: a brand-new visitor lands on the site, can find a paid
  7   |  * agent in the marketplace, can see pricing, and can hit the auth gate.
  8   |  * Every step here MUST work for the platform to be considered "shipped."
  9   |  *
  10  |  * Designed to be:
  11  |  *   - Fast (< 30s total) so it can run on every PR.
  12  |  *   - Hermetic (no dependency on test users, no Stripe charges) — auth-gated
  13  |  *     flows are verified by their 401 response, not by signing in.
  14  |  *   - Loud on regressions: when this goes red, an actual customer journey
  15  |  *     is broken, not a test fixture.
  16  |  *
  17  |  * If you're tempted to add a test that needs a fake credit card or a magic
  18  |  * Clerk token, put it in `e2e/auth-flow.spec.ts` (a separate, slower suite
  19  |  * that runs nightly) — not here.
  20  |  */
  21  |
  22  | test.describe("Golden path smoke", () => {
  23  |   test("home page loads, headline renders", async ({ page }) => {
  24  |     const res = await page.goto("/");
  25  |     expect(res?.status()).toBe(200);
  26  |     const h1 = page.locator("h1").first();
  27  |     await expect(h1).toBeVisible();
  28  |   });
  29  |
  30  |   test("pricing page renders all marketing plans", async ({ page }) => {
  31  |     const res = await page.goto("/pricing");
  32  |     expect(res?.status()).toBe(200);
  33  |     // At least one plan name from getMarketingPlans() must be visible —
  34  |     // otherwise the JSON-LD Offer list and the pricing UI both broke.
  35  |     await expect(page.locator("body")).toContainText(/Starter|Node|Free/i);
  36  |   });
  37  |
  38  |   test("marketplace renders multiple agents from the registry", async ({
  39  |     page,
  40  |   }) => {
  41  |     const res = await page.goto("/marketplace");
  42  |     expect(res?.status()).toBe(200);
  43  |     // Wait for client-side hydration + framer-motion staggered fades to settle.
  44  |     // Without this, the assertion can race the AnimatePresence enter animations
  45  |     // and report missing text that's still in initial=opacity:0.
  46  |     await page.waitForLoadState("networkidle");
  47  |     // War Room + SEO Dominator are both pinned in FEATURED_AGENTS on
  48  |     // EVERY branch we've shipped (history checked back to the original
  49  |     // marketplace commit 989883f) — they render unconditionally when
  50  |     // activeCategory==="All" (the default), independent of AGENT_SLUGS
  51  |     // membership, the tier filter, and PAGE_SIZE pagination.
  52  |     //
  53  |     // Why these two specifically: smoke runs against E2E_BASE_URL which
  54  |     // defaults to PROD (sovereignmatrix.agency) when E2E_PREVIEW_URL
  55  |     // isn't set. Asserting agents that have ever been in featured on
  56  |     // any branch will fail intermittently when the test code rolls
  57  |     // ahead of prod. Pick agents present on BOTH the test code AND the
  58  |     // currently-deployed code to prevent that.
  59  |     await expect(page.locator("body")).toContainText(/War Room/i);
  60  |     await expect(page.locator("body")).toContainText(/SEO Dominator/i);
  61  |   });
  62  |
  63  |   test("hand-curated agent detail loads", async ({ page }) => {
  64  |     // lead-blitz has hand-curated copy in KNOWN_AGENTS — should always
  65  |     // render the rich detail page, not the "not found" view.
  66  |     const res = await page.goto("/marketplace/lead-blitz");
  67  |     expect(res?.status()).toBe(200);
  68  |     await expect(page.locator("h1").first()).toContainText(/Lead Blitz/i);
  69  |   });
  70  |
  71  |   test("registry-derived agent detail loads (proves the long-tail fix)", async ({
  72  |     page,
  73  |   }) => {
  74  |     // god-brain is in AGENT_REGISTRY but not in KNOWN_AGENTS' rich list —
  75  |     // the page should still resolve via buildGenericDetail() and NOT show
  76  |     // the not-found view. Regression-guards the marketplace finish work.
  77  |     const res = await page.goto("/marketplace/god-brain");
  78  |     expect(res?.status()).toBe(200);
  79  |     await expect(page.locator("body")).not.toContainText(/Agent not found/i);
  80  |   });
  81  |
  82  |   test("truly unknown agent slug shows the not-found view", async ({
  83  |     page,
  84  |   }) => {
  85  |     await page.goto("/marketplace/this-agent-does-not-exist-nope");
  86  |     await expect(page.locator("body")).toContainText(/not found/i);
  87  |   });
  88  |
  89  |   test("liveness probe returns 200", async ({ request }) => {
  90  |     const res = await request.get("/api/health/ping");
  91  |     expect(res.status()).toBe(200);
  92  |   });
  93  |
  94  |   test("readiness probe returns 200 only when all critical deps are green", async ({
  95  |     request,
  96  |   }) => {
  97  |     const res = await request.get("/api/health/ready");
  98  |     // Either 200 ready=true, or 503 ready=false — both are valid runtime
  99  |     // responses. The smoke test only fails if the endpoint itself is
  100 |     // missing / throws (404 / 5xx without ready=false).
> 101 |     expect([200, 503]).toContain(res.status());
      |                        ^ Error: expect(received).toContain(expected) // indexOf
  102 |     const body = (await res.json()) as { ready: boolean; failures: string[] };
  103 |     expect(typeof body.ready).toBe("boolean");
  104 |     expect(Array.isArray(body.failures)).toBe(true);
  105 |     // On preview/prod we expect ready=true. If your local dev env doesn't
  106 |     // have Clerk or DB configured, this assertion will fire — that's
  107 |     // intentional. Smoke tests run against deployed URLs, not local dev.
  108 |     if (process.env.E2E_REQUIRE_READY === "true") {
  109 |       expect(body.ready).toBe(true);
  110 |     }
  111 |   });
  112 | });
  113 |
  114 | test.describe("Auth gate smoke (no sign-in)", () => {
  115 |   test("anonymous credit POST is rejected (no minting without auth)", async ({
  116 |     request,
  117 |   }) => {
  118 |     const res = await request.post("/api/credits", {
  119 |       data: { amountCents: 100000, type: "purchase" },
  120 |     });
  121 |     // 401 (most common) or 400 (Zod rejection before auth lookup) — anything
  122 |     // in the 400 range means we did NOT mint credits for an unauth request.
  123 |     expect(res.status()).toBeGreaterThanOrEqual(400);
  124 |     expect(res.status()).toBeLessThan(500);
  125 |   });
  126 |
  127 |   test("anonymous agent run is rejected", async ({ request }) => {
  128 |     const res = await request.post("/api/agents/smart-router", {
  129 |       data: { prompt: "smoke test" },
  130 |     });
  131 |     expect(res.status()).toBe(401);
  132 |   });
  133 |
  134 |   test("admin checklist endpoint is gated", async ({ request }) => {
  135 |     const res = await request.get("/api/admin/setup-checklist");
  136 |     // requireAdmin() returns 401 if signed-out, 404 if signed-in but
  137 |     // not on the allowlist. Anonymous request should hit 401.
  138 |     expect([401, 404]).toContain(res.status());
  139 |   });
  140 | });
  141 |
  142 | test.describe("Verifiable receipts surface (the central claim)", () => {
  143 |   // The platform's marketing claim ("hand the receipt to an auditor and
  144 |   // the math holds") has historically lived only in vitest mocks. These
  145 |   // browser-level tests prove the public verifier surface actually exists
  146 |   // and serves the documented shape. If any of these go red, a buyer who
  147 |   // tries to verify our claim hits the same red.
  148 |
  149 |   test("/security/posture returns the documented machine-readable envelope", async ({
  150 |     request,
  151 |   }) => {
  152 |     const res = await request.get("/api/security/posture");
  153 |     expect(res.status()).toBe(200);
  154 |     expect(res.headers()["content-type"]).toMatch(/application\/json/);
  155 |     expect(res.headers()["access-control-allow-origin"]).toBe("*");
  156 |     const body = (await res.json()) as Record<string, unknown>;
  157 |     // Shape contract — keys procurement automation depends on.
  158 |     for (const key of [
  159 |       "generatedAt",
  160 |       "issuer",
  161 |       "receipts",
  162 |       "chainOfCustody",
  163 |       "transportSecurity",
  164 |       "authentication",
  165 |       "compliance",
  166 |       "openSourcePrimitives",
  167 |     ]) {
  168 |       expect(body).toHaveProperty(key);
  169 |     }
  170 |     // The receipts.schemes block must enumerate v1/v2/v3 every deploy —
  171 |     // a regression that drops a scheme would silently break vendor
  172 |     // questionnaires that read from this endpoint.
  173 |     const receipts = body.receipts as Record<string, Record<string, unknown>>;
  174 |     expect(receipts.schemes).toHaveProperty("v1_hmac_sha256");
  175 |     expect(receipts.schemes).toHaveProperty("v2_ed25519");
  176 |     expect(receipts.schemes).toHaveProperty("v3_ed25519_mldsa65");
  177 |   });
  178 |
  179 |   test("/.well-known/sovereign-receipts/ed25519.pem serves PEM or returns documented 404", async ({
  180 |     request,
  181 |   }) => {
  182 |     const res = await request.get(
  183 |       "/.well-known/sovereign-receipts/ed25519.pem",
  184 |     );
  185 |     // Either the deployment has an Ed25519 key (200 + PEM body) or it
  186 |     // doesn't (404 + a documented text body). 5xx means the route itself
  187 |     // is broken — that's the regression we want to catch.
  188 |     expect([200, 404]).toContain(res.status());
  189 |     if (res.status() === 200) {
  190 |       const body = await res.text();
  191 |       expect(body).toMatch(/-----BEGIN PUBLIC KEY-----/);
  192 |       expect(res.headers()["content-type"]).toMatch(/x-pem-file/);
  193 |     }
  194 |   });
  195 |
  196 |   test("/for-claims-triage renders a real signed receipt at request time", async ({
  197 |     page,
  198 |   }) => {
  199 |     // Wave-32 vertical surface: the sample receipt is signed by signRun()
  200 |     // on every render. The signature should be present in the HTML source
  201 |     // (no client-side fetch — it's server-rendered). Regression-guards
```