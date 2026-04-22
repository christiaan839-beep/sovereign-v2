/**
 * /api/creators/submit — tests.
 *
 * Guards server-side SAM v1.0 validation (defense-in-depth) and the
 * response envelope shape. The UI validates client-side too — these
 * tests exist to prove a curl-direct submission fails the same way.
 */

import { describe, it, expect } from "vitest";
import { POST } from "@/app/api/creators/submit/route";

const VALID_MINIMAL = {
  sam: "1.0",
  slug: "extract-invoice",
  displayName: "Invoice Extractor",
  purpose: "Extract structured data from invoice text",
  category: "Finance",
  version: "1.0.0",
  inputs: [],
  output: { type: "object" },
  guarantees: ["Never fabricates missing fields"],
};

function req(body: unknown): Request {
  return new Request("http://l/api/creators/submit", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/creators/submit", () => {
  it("returns 202 Accepted with a reference ID on valid submission", async () => {
    const res = await POST(req({ manifest: VALID_MINIMAL, contactEmail: "dev@example.com" }));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.referenceId).toMatch(/^SAM-[0-9a-f]+-[0-9a-f]+$/);
    expect(body.nextSteps).toHaveLength(3);
  });

  it("accepts valid submission without a contact email (optional field)", async () => {
    const res = await POST(req({ manifest: VALID_MINIMAL }));
    expect(res.status).toBe(202);
  });

  it("returns 400 when manifest is missing", async () => {
    const res = await POST(req({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Missing 'manifest'/);
  });

  it("returns 400 when manifest fails SAM validation", async () => {
    const invalid = { ...VALID_MINIMAL, sam: "0.9" };
    const res = await POST(req({ manifest: invalid }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/validation/i);
    expect(body.errors).toBeDefined();
    expect(body.errors.some((e: { path: string }) => e.path === "/sam")).toBe(true);
  });

  it("reports multiple validation errors in one response", async () => {
    const invalid = {
      sam: "1.0",
      slug: "NOT-kebab",
      displayName: "X",
      purpose: "",
      category: "Nonsense",
      version: "not-semver",
      inputs: [],
      output: {},
      guarantees: [],
    };
    const res = await POST(req({ manifest: invalid }));
    const body = await res.json();
    expect(body.errors.length).toBeGreaterThan(3);
  });

  it("returns 400 on malformed contactEmail", async () => {
    const res = await POST(req({ manifest: VALID_MINIMAL, contactEmail: "not-email" }));
    expect(res.status).toBe(400);
  });

  it("returns 400 on malformed JSON body", async () => {
    const res = await POST(
      new Request("http://l/api/creators/submit", {
        method: "POST",
        body: "{ not json",
      }),
    );
    expect(res.status).toBe(400);
  });

  it("sets no-store cache header", async () => {
    const res = await POST(req({ manifest: VALID_MINIMAL }));
    expect(res.headers.get("Cache-Control")).toContain("no-store");
  });
});
