# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> Verifiable receipts surface (the central claim) >> /api/transparency/sth returns a real signed tree head envelope
- Location: e2e/smoke.spec.ts:294:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 402
```

# Test source

```ts
  198 |   }) => {
  199 |     // Wave-32 vertical surface: the sample receipt is signed by signRun()
  200 |     // on every render. The signature should be present in the HTML source
  201 |     // (no client-side fetch — it's server-rendered). Regression-guards
  202 |     // the demonstrability of the central claim from a buyer's browser.
  203 |     const res = await page.goto("/for-claims-triage");
  204 |     expect(res?.status()).toBe(200);
  205 |     // The signature container contains v1=, v2=, or v3= depending on the
  206 |     // configured signing key. The dollar prefix proves we're rendering a
  207 |     // real signature, not just stubbed marketing copy.
  208 |     await expect(page.locator("body")).toContainText(/v[123]=/);
  209 |     // The canonical-projection details block exists and announces its
  210 |     // byte length — both halves of "you can re-derive this".
  211 |     await expect(page.locator("body")).toContainText(
  212 |       /Show input \+ output canonical/,
  213 |     );
  214 |   });
  215 |
  216 |   test("/for-pharmacovigilance renders the second-vertical conversion surface", async ({
  217 |     page,
  218 |   }) => {
  219 |     const res = await page.goto("/for-pharmacovigilance");
  220 |     expect(res?.status()).toBe(200);
  221 |     await expect(page.locator("body")).toContainText(/Pharmacovigilance/i);
  222 |   });
  223 |
  224 |   test("/api/verify rejects a forged receipt id", async ({ request }) => {
  225 |     const res = await request.get(
  226 |       "/api/verify?receiptId=rcpt_forged_does_not_exist",
  227 |     );
  228 |     expect(res.status()).toBe(200);
  229 |     const body = (await res.json()) as { valid?: boolean };
  230 |     expect(body.valid).toBe(false);
  231 |   });
  232 |
  233 |   test("/pilot renders the conversion surface + downloadable sample bundle", async ({
  234 |     page,
  235 |   }) => {
  236 |     const res = await page.goto("/pilot");
  237 |     expect(res?.status()).toBe(200);
  238 |     // The CLI invocation must be on the page — it's the central
  239 |     // demonstration. A regression that hides it breaks the conversion.
  240 |     await expect(page.locator("body")).toContainText(
  241 |       /npx @sovereign-matrix\/verifiable-receipts verify/,
  242 |     );
  243 |     // Both download targets must resolve to real files (procurement
  244 |     // teams click these before they send an email).
  245 |     await expect(page.locator("a[href='/sample-bundle.json']")).toBeVisible();
  246 |     await expect(
  247 |       page.locator("a[href='/sample-bundle.ed25519.pem']"),
  248 |     ).toBeVisible();
  249 |   });
  250 |
  251 |   test("/sample-bundle.json downloads as a parseable signed manifest", async ({
  252 |     request,
  253 |   }) => {
  254 |     const res = await request.get("/sample-bundle.json");
  255 |     expect(res.status()).toBe(200);
  256 |     const body = (await res.json()) as {
  257 |       type?: string;
  258 |       receiptCount?: number;
  259 |       manifestHash?: string;
  260 |       signature?: string;
  261 |     };
  262 |     expect(body.type).toBe("verifiable-receipt-bundle");
  263 |     expect(body.receiptCount).toBeGreaterThan(0);
  264 |     expect(body.manifestHash).toMatch(/^[0-9a-f]{64}$/);
  265 |     expect(body.signature).toMatch(/^v[123]=/);
  266 |   });
  267 |
  268 |   test("/sample-bundle.ed25519.pem downloads as a real PEM", async ({
  269 |     request,
  270 |   }) => {
  271 |     const res = await request.get("/sample-bundle.ed25519.pem");
  272 |     expect(res.status()).toBe(200);
  273 |     const body = await res.text();
  274 |     expect(body).toMatch(/-----BEGIN PUBLIC KEY-----/);
  275 |     expect(body).toMatch(/-----END PUBLIC KEY-----/);
  276 |   });
  277 |
  278 |   test("/transparency renders the public monitor surface", async ({ page }) => {
  279 |     const res = await page.goto("/transparency");
  280 |     expect(res?.status()).toBe(200);
  281 |     // Headline + three documented sections must be present.
  282 |     await expect(page.locator("body")).toContainText(/Signed Tree Head/i);
  283 |     await expect(page.locator("body")).toContainText(/Witness Protocol/i);
  284 |     // Every section anchors a real endpoint — the page is the spec
  285 |     // surfaced as UI, no marketing slop.
  286 |     await expect(page.locator("body")).toContainText(
  287 |       /\/api\/transparency\/sth/,
  288 |     );
  289 |     await expect(page.locator("body")).toContainText(
  290 |       /\/api\/transparency\/proof/,
  291 |     );
  292 |   });
  293 |
  294 |   test("/api/transparency/sth returns a real signed tree head envelope", async ({
  295 |     request,
  296 |   }) => {
  297 |     const res = await request.get("/api/transparency/sth");
> 298 |     expect(res.status()).toBe(200);
      |                          ^ Error: expect(received).toBe(expected) // Object.is equality
  299 |     expect(res.headers()["access-control-allow-origin"]).toBe("*");
  300 |     const body = (await res.json()) as {
  301 |       v?: number;
  302 |       logId?: string;
  303 |       treeSize?: number;
  304 |       rootHash?: string;
  305 |       timestamp?: string;
  306 |       canonical?: string;
  307 |     };
  308 |     expect(body.v).toBe(1);
  309 |     expect(body.logId).toBe("demo.sovereignmatrix.agency");
  310 |     expect(typeof body.treeSize).toBe("number");
  311 |     expect(body.rootHash).toMatch(/^[0-9a-f]{64}$/);
  312 |     expect(typeof body.canonical).toBe("string");
  313 |   });
  314 |
  315 |   test("/security/live renders the machine-readable evidence dashboard", async ({
  316 |     page,
  317 |   }) => {
  318 |     const res = await page.goto("/security/live");
  319 |     expect(res?.status()).toBe(200);
  320 |     // All seven documented sections must be present — the page is
  321 |     // the proof surface, a regression that hides one of them breaks
  322 |     // the procurement signal.
  323 |     await expect(page.locator("body")).toContainText(/RECEIPT SCHEMES/i);
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
```