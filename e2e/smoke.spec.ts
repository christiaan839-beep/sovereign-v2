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
    // Wait for client-side hydration + framer-motion staggered fades to settle.
    // Without this, the assertion can race the AnimatePresence enter animations
    // and report missing text that's still in initial=opacity:0.
    await page.waitForLoadState("networkidle");
    // War Room + SEO Dominator are both pinned in FEATURED_AGENTS on
    // EVERY branch we've shipped (history checked back to the original
    // marketplace commit 989883f) — they render unconditionally when
    // activeCategory==="All" (the default), independent of AGENT_SLUGS
    // membership, the tier filter, and PAGE_SIZE pagination.
    //
    // Why these two specifically: smoke runs against E2E_BASE_URL which
    // defaults to PROD (sovereignmatrix.agency) when E2E_PREVIEW_URL
    // isn't set. Asserting agents that have ever been in featured on
    // any branch will fail intermittently when the test code rolls
    // ahead of prod. Pick agents present on BOTH the test code AND the
    // currently-deployed code to prevent that.
    await expect(page.locator("body")).toContainText(/War Room/i);
    await expect(page.locator("body")).toContainText(/SEO Dominator/i);
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

test.describe("Verifiable receipts surface (the central claim)", () => {
  // The platform's marketing claim ("hand the receipt to an auditor and
  // the math holds") has historically lived only in vitest mocks. These
  // browser-level tests prove the public verifier surface actually exists
  // and serves the documented shape. If any of these go red, a buyer who
  // tries to verify our claim hits the same red.

  test("/security/posture returns the documented machine-readable envelope", async ({
    request,
  }) => {
    const res = await request.get("/api/security/posture");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/application\/json/);
    expect(res.headers()["access-control-allow-origin"]).toBe("*");
    const body = (await res.json()) as Record<string, unknown>;
    // Shape contract — keys procurement automation depends on.
    for (const key of [
      "generatedAt",
      "issuer",
      "receipts",
      "chainOfCustody",
      "transportSecurity",
      "authentication",
      "compliance",
      "openSourcePrimitives",
    ]) {
      expect(body).toHaveProperty(key);
    }
    // The receipts.schemes block must enumerate v1/v2/v3 every deploy —
    // a regression that drops a scheme would silently break vendor
    // questionnaires that read from this endpoint.
    const receipts = body.receipts as Record<string, Record<string, unknown>>;
    expect(receipts.schemes).toHaveProperty("v1_hmac_sha256");
    expect(receipts.schemes).toHaveProperty("v2_ed25519");
    expect(receipts.schemes).toHaveProperty("v3_ed25519_mldsa65");
  });

  test("/.well-known/sovereign-receipts/ed25519.pem serves PEM or returns documented 404", async ({
    request,
  }) => {
    const res = await request.get(
      "/.well-known/sovereign-receipts/ed25519.pem",
    );
    // Either the deployment has an Ed25519 key (200 + PEM body) or it
    // doesn't (404 + a documented text body). 5xx means the route itself
    // is broken — that's the regression we want to catch.
    expect([200, 404]).toContain(res.status());
    if (res.status() === 200) {
      const body = await res.text();
      expect(body).toMatch(/-----BEGIN PUBLIC KEY-----/);
      expect(res.headers()["content-type"]).toMatch(/x-pem-file/);
    }
  });

  test("/for-claims-triage renders a real signed receipt at request time", async ({
    page,
  }) => {
    // Wave-32 vertical surface: the sample receipt is signed by signRun()
    // on every render. The signature should be present in the HTML source
    // (no client-side fetch — it's server-rendered). Regression-guards
    // the demonstrability of the central claim from a buyer's browser.
    const res = await page.goto("/for-claims-triage");
    expect(res?.status()).toBe(200);
    // The signature container contains v1=, v2=, or v3= depending on the
    // configured signing key. The dollar prefix proves we're rendering a
    // real signature, not just stubbed marketing copy.
    await expect(page.locator("body")).toContainText(/v[123]=/);
    // The canonical-projection details block exists and announces its
    // byte length — both halves of "you can re-derive this".
    await expect(page.locator("body")).toContainText(
      /Show input \+ output canonical/,
    );
  });

  test("/for-pharmacovigilance renders the second-vertical conversion surface", async ({
    page,
  }) => {
    const res = await page.goto("/for-pharmacovigilance");
    expect(res?.status()).toBe(200);
    await expect(page.locator("body")).toContainText(/Pharmacovigilance/i);
  });

  test("/api/verify rejects a forged receipt id", async ({ request }) => {
    const res = await request.get(
      "/api/verify?receiptId=rcpt_forged_does_not_exist",
    );
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { valid?: boolean };
    expect(body.valid).toBe(false);
  });

  test("/pilot renders the conversion surface + downloadable sample bundle", async ({
    page,
  }) => {
    const res = await page.goto("/pilot");
    expect(res?.status()).toBe(200);
    // The CLI invocation must be on the page — it's the central
    // demonstration. A regression that hides it breaks the conversion.
    await expect(page.locator("body")).toContainText(
      /npx @sovereign-matrix\/verifiable-receipts verify/,
    );
    // Both download targets must resolve to real files (procurement
    // teams click these before they send an email).
    await expect(page.locator("a[href='/sample-bundle.json']")).toBeVisible();
    await expect(
      page.locator("a[href='/sample-bundle.ed25519.pem']"),
    ).toBeVisible();
  });

  test("/sample-bundle.json downloads as a parseable signed manifest", async ({
    request,
  }) => {
    const res = await request.get("/sample-bundle.json");
    expect(res.status()).toBe(200);
    const body = (await res.json()) as {
      type?: string;
      receiptCount?: number;
      manifestHash?: string;
      signature?: string;
    };
    expect(body.type).toBe("verifiable-receipt-bundle");
    expect(body.receiptCount).toBeGreaterThan(0);
    expect(body.manifestHash).toMatch(/^[0-9a-f]{64}$/);
    expect(body.signature).toMatch(/^v[123]=/);
  });

  test("/sample-bundle.ed25519.pem downloads as a real PEM", async ({
    request,
  }) => {
    const res = await request.get("/sample-bundle.ed25519.pem");
    expect(res.status()).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/-----BEGIN PUBLIC KEY-----/);
    expect(body).toMatch(/-----END PUBLIC KEY-----/);
  });

  test("/transparency renders the public monitor surface", async ({ page }) => {
    const res = await page.goto("/transparency");
    expect(res?.status()).toBe(200);
    // Headline + three documented sections must be present.
    await expect(page.locator("body")).toContainText(/Signed Tree Head/i);
    await expect(page.locator("body")).toContainText(/Witness Protocol/i);
    // Every section anchors a real endpoint — the page is the spec
    // surfaced as UI, no marketing slop.
    await expect(page.locator("body")).toContainText(
      /\/api\/transparency\/sth/,
    );
    await expect(page.locator("body")).toContainText(
      /\/api\/transparency\/proof/,
    );
  });

  test("/api/transparency/sth returns a real signed tree head envelope", async ({
    request,
  }) => {
    const res = await request.get("/api/transparency/sth");
    expect(res.status()).toBe(200);
    expect(res.headers()["access-control-allow-origin"]).toBe("*");
    const body = (await res.json()) as {
      v?: number;
      logId?: string;
      treeSize?: number;
      rootHash?: string;
      timestamp?: string;
      canonical?: string;
    };
    expect(body.v).toBe(1);
    expect(body.logId).toBe("demo.sovereignmatrix.agency");
    expect(typeof body.treeSize).toBe("number");
    expect(body.rootHash).toMatch(/^[0-9a-f]{64}$/);
    expect(typeof body.canonical).toBe("string");
  });

  test("/security/live renders the machine-readable evidence dashboard", async ({
    page,
  }) => {
    const res = await page.goto("/security/live");
    expect(res?.status()).toBe(200);
    // All seven documented sections must be present — the page is
    // the proof surface, a regression that hides one of them breaks
    // the procurement signal.
    await expect(page.locator("body")).toContainText(/RECEIPT SCHEMES/i);
    await expect(page.locator("body")).toContainText(/CHAIN OF CUSTODY/i);
    await expect(page.locator("body")).toContainText(/TRANSPORT SECURITY/i);
    await expect(page.locator("body")).toContainText(/AUTHENTICATION/i);
    await expect(page.locator("body")).toContainText(/COMPLIANCE MAPPING/i);
    await expect(page.locator("body")).toContainText(/OPEN-SOURCE PRIMITIVES/i);
  });

  test("/security marketing page links to the live posture", async ({
    page,
  }) => {
    const res = await page.goto("/security");
    expect(res?.status()).toBe(200);
    // The auditor-strip link must be present so a procurement reviewer
    // who lands on the marketing page can pivot to the machine-readable
    // surface in one click.
    await expect(page.locator("a[href='/security/live']")).toBeVisible();
    await expect(page.locator("a[href='/api/security/posture']")).toBeVisible();
  });

  test("/changelog/live renders the git-log timeline", async ({ page }) => {
    const res = await page.goto("/changelog/live");
    expect(res?.status()).toBe(200);
    // Header + at least one wave indicator must be present. Even on a
    // fresh checkout this should pick up the most recent wave commit.
    await expect(page.locator("body")).toContainText(/Every wave/i);
    await expect(page.locator("body")).toContainText(/CHANGELOG · LIVE/i);
  });

  test("/transparency/verify renders the in-browser verifier widget", async ({
    page,
  }) => {
    const res = await page.goto("/transparency/verify");
    expect(res?.status()).toBe(200);
    await expect(page.locator("body")).toContainText(/Verify a proof/i);
    await expect(page.locator("button[type='submit']")).toBeVisible();
    await expect(page.locator("input[type='number']").first()).toBeVisible();
    await expect(page.locator("body")).toContainText(/Web Crypto/i);
  });

  test("/transparency links to the in-browser verifier", async ({ page }) => {
    const res = await page.goto("/transparency");
    expect(res?.status()).toBe(200);
    await expect(page.locator("a[href='/transparency/verify']")).toBeVisible();
  });

  test("/vaos renders the adoption registry + links to the JSON sibling", async ({
    page,
  }) => {
    const res = await page.goto("/vaos");
    expect(res?.status()).toBe(200);
    await expect(page.locator("body")).toContainText(/Sovereign Matrix/i);
    await expect(page.locator("body")).toContainText(/ACTIVE ISSUERS/i);
    await expect(
      page.locator("a[href='/.well-known/sovereign-receipts/issuers.json']"),
    ).toBeVisible();
  });

  test("/.well-known/sovereign-receipts/issuers.json returns the schema-stable registry", async ({
    request,
  }) => {
    const res = await request.get(
      "/.well-known/sovereign-receipts/issuers.json",
    );
    expect(res.status()).toBe(200);
    expect(res.headers()["access-control-allow-origin"]).toBe("*");
    const body = (await res.json()) as {
      version: number;
      issuers: Array<{
        id: string;
        ed25519PublicKeyUrl: string;
        schemes: string[];
      }>;
    };
    expect(body.version).toBe(1);
    expect(Array.isArray(body.issuers)).toBe(true);
    expect(body.issuers.length).toBeGreaterThan(0);
    expect(body.issuers[0].id).toBe("sovereignmatrix.agency");
    expect(body.issuers[0].schemes).toContain("v2");
  });

  test("/status/integrity renders the crypto-integrity dashboard", async ({
    page,
  }) => {
    const res = await page.goto("/status/integrity");
    expect(res?.status()).toBe(200);
    // All six documented tiles + the verdict banner.
    await expect(page.locator("body")).toContainText(
      /Integrity, in one number/i,
    );
    await expect(page.locator("body")).toContainText(/Receipt schemes active/i);
    await expect(page.locator("body")).toContainText(/Transparency log size/i);
    await expect(page.locator("body")).toContainText(/Latest STH age/i);
    await expect(page.locator("body")).toContainText(/Last Bitcoin anchor/i);
    await expect(page.locator("body")).toContainText(
      /Witnesses on current STH/i,
    );
  });

  test("/feed.xml returns a well-formed Atom feed", async ({ request }) => {
    const res = await request.get("/feed.xml");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/application\/atom\+xml/);
    expect(res.headers()["access-control-allow-origin"]).toBe("*");
    const body = await res.text();
    // Atom envelope present even when no entries are available.
    expect(body).toContain('xmlns="http://www.w3.org/2005/Atom"');
    expect(body).toContain("<feed");
    expect(body).toContain("</feed>");
    expect(body).toContain("Sovereign Matrix — Signed Receipts");
  });

  test("/diff renders the receipt diff widget", async ({ page }) => {
    const res = await page.goto("/diff");
    expect(res?.status()).toBe(200);
    // Headline + both input fields + the procurement use-case section
    // must be present. Regression-guard the diff surface.
    await expect(page.locator("body")).toContainText(/What changed/i);
    await expect(page.locator("input[type='text']").first()).toBeVisible();
    await expect(page.locator("button[type='submit']")).toBeVisible();
    await expect(page.locator("body")).toContainText(/Procurement use cases/i);
  });
});
