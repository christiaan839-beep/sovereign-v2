# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> Verifiable receipts surface (the central claim) >> /api/verify rejects a forged receipt id
- Location: e2e/smoke.spec.ts:224:7

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: 200
Received: 402
```

# Test source

```ts
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
> 228 |     expect(res.status()).toBe(200);
      |                          ^ Error: expect(received).toBe(expected) // Object.is equality
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
  298 |     expect(res.status()).toBe(200);
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
```