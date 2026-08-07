# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> Verifiable receipts surface (the central claim) >> /feed.xml returns a well-formed Atom feed
- Location: e2e/smoke.spec.ts:422:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 402
```

# Test source

```ts
  324 |     await expect(page.locator("body")).toContainText(/CHAIN OF CUSTODY/i);
  325 |     await expect(page.locator("body")).toContainText(/TRANSPORT SECURITY/i);
  326 |     await expect(page.locator("body")).toContainText(/AUTHENTICATION/i);
  327 |     await expect(page.locator("body")).toContainText(/COMPLIANCE MAPPING/i);
  328 |     await expect(page.locator("body")).toContainText(/OPEN-SOURCE PRIMITIVES/i);
  329 |   });
  330 |
  331 |   test("/security marketing page links to the live posture", async ({
  332 |     page,
  333 |   }) => {
  334 |     const res = await page.goto("/security");
  335 |     expect(res?.status()).toBe(200);
  336 |     // The auditor-strip link must be present so a procurement reviewer
  337 |     // who lands on the marketing page can pivot to the machine-readable
  338 |     // surface in one click.
  339 |     await expect(page.locator("a[href='/security/live']")).toBeVisible();
  340 |     await expect(page.locator("a[href='/api/security/posture']")).toBeVisible();
  341 |   });
  342 |
  343 |   test("/changelog/live renders the git-log timeline", async ({ page }) => {
  344 |     const res = await page.goto("/changelog/live");
  345 |     expect(res?.status()).toBe(200);
  346 |     // Header + at least one wave indicator must be present. Even on a
  347 |     // fresh checkout this should pick up the most recent wave commit.
  348 |     await expect(page.locator("body")).toContainText(/Every wave/i);
  349 |     await expect(page.locator("body")).toContainText(/CHANGELOG · LIVE/i);
  350 |   });
  351 |
  352 |   test("/transparency/verify renders the in-browser verifier widget", async ({
  353 |     page,
  354 |   }) => {
  355 |     const res = await page.goto("/transparency/verify");
  356 |     expect(res?.status()).toBe(200);
  357 |     await expect(page.locator("body")).toContainText(/Verify a proof/i);
  358 |     await expect(page.locator("button[type='submit']")).toBeVisible();
  359 |     await expect(page.locator("input[type='number']").first()).toBeVisible();
  360 |     await expect(page.locator("body")).toContainText(/Web Crypto/i);
  361 |   });
  362 |
  363 |   test("/transparency links to the in-browser verifier", async ({ page }) => {
  364 |     const res = await page.goto("/transparency");
  365 |     expect(res?.status()).toBe(200);
  366 |     await expect(page.locator("a[href='/transparency/verify']")).toBeVisible();
  367 |   });
  368 |
  369 |   test("/vaos renders the adoption registry + links to the JSON sibling", async ({
  370 |     page,
  371 |   }) => {
  372 |     const res = await page.goto("/vaos");
  373 |     expect(res?.status()).toBe(200);
  374 |     await expect(page.locator("body")).toContainText(/Sovereign Matrix/i);
  375 |     await expect(page.locator("body")).toContainText(/ACTIVE ISSUERS/i);
  376 |     await expect(
  377 |       page.locator("a[href='/.well-known/sovereign-receipts/issuers.json']"),
  378 |     ).toBeVisible();
  379 |   });
  380 |
  381 |   test("/.well-known/sovereign-receipts/issuers.json returns the schema-stable registry", async ({
  382 |     request,
  383 |   }) => {
  384 |     const res = await request.get(
  385 |       "/.well-known/sovereign-receipts/issuers.json",
  386 |     );
  387 |     expect(res.status()).toBe(200);
  388 |     expect(res.headers()["access-control-allow-origin"]).toBe("*");
  389 |     const body = (await res.json()) as {
  390 |       version: number;
  391 |       issuers: Array<{
  392 |         id: string;
  393 |         ed25519PublicKeyUrl: string;
  394 |         schemes: string[];
  395 |       }>;
  396 |     };
  397 |     expect(body.version).toBe(1);
  398 |     expect(Array.isArray(body.issuers)).toBe(true);
  399 |     expect(body.issuers.length).toBeGreaterThan(0);
  400 |     expect(body.issuers[0].id).toBe("sovereignmatrix.agency");
  401 |     expect(body.issuers[0].schemes).toContain("v2");
  402 |   });
  403 |
  404 |   test("/status/integrity renders the crypto-integrity dashboard", async ({
  405 |     page,
  406 |   }) => {
  407 |     const res = await page.goto("/status/integrity");
  408 |     expect(res?.status()).toBe(200);
  409 |     // All six documented tiles + the verdict banner.
  410 |     await expect(page.locator("body")).toContainText(
  411 |       /Integrity, in one number/i,
  412 |     );
  413 |     await expect(page.locator("body")).toContainText(/Receipt schemes active/i);
  414 |     await expect(page.locator("body")).toContainText(/Transparency log size/i);
  415 |     await expect(page.locator("body")).toContainText(/Latest STH age/i);
  416 |     await expect(page.locator("body")).toContainText(/Last Bitcoin anchor/i);
  417 |     await expect(page.locator("body")).toContainText(
  418 |       /Witnesses on current STH/i,
  419 |     );
  420 |   });
  421 |
  422 |   test("/feed.xml returns a well-formed Atom feed", async ({ request }) => {
  423 |     const res = await request.get("/feed.xml");
> 424 |     expect(res.status()).toBe(200);
      |                          ^ Error: expect(received).toBe(expected) // Object.is equality
  425 |     expect(res.headers()["content-type"]).toMatch(/application\/atom\+xml/);
  426 |     expect(res.headers()["access-control-allow-origin"]).toBe("*");
  427 |     const body = await res.text();
  428 |     // Atom envelope present even when no entries are available.
  429 |     expect(body).toContain('xmlns="http://www.w3.org/2005/Atom"');
  430 |     expect(body).toContain("<feed");
  431 |     expect(body).toContain("</feed>");
  432 |     expect(body).toContain("Sovereign Matrix — Signed Receipts");
  433 |   });
  434 |
  435 |   test("/diff renders the receipt diff widget", async ({ page }) => {
  436 |     const res = await page.goto("/diff");
  437 |     expect(res?.status()).toBe(200);
  438 |     // Headline + both input fields + the procurement use-case section
  439 |     // must be present. Regression-guard the diff surface.
  440 |     await expect(page.locator("body")).toContainText(/What changed/i);
  441 |     await expect(page.locator("input[type='text']").first()).toBeVisible();
  442 |     await expect(page.locator("button[type='submit']")).toBeVisible();
  443 |     await expect(page.locator("body")).toContainText(/Procurement use cases/i);
  444 |   });
  445 | });
  446 |
```