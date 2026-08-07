# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> Verifiable receipts surface (the central claim) >> /.well-known/sovereign-receipts/ed25519.pem serves PEM or returns documented 404
- Location: e2e/smoke.spec.ts:179:7

# Error details

```
Error: expect(received).toContain(expected) // indexOf

Expected value: 402
Received array: [200, 404]
```

# Test source

```ts
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
  101 |     expect([200, 503]).toContain(res.status());
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
> 188 |     expect([200, 404]).toContain(res.status());
      |                        ^ Error: expect(received).toContain(expected) // indexOf
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
```