/**
 * /api/creators/submit — tests.
 *
 * Guards server-side SAM v1.0 validation (defense-in-depth) and the
 * response envelope shape. The UI validates client-side too — these
 * tests exist to prove a curl-direct submission fails the same way.
 */

import { afterEach, beforeEach, describe, it, expect } from "vitest";
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
  // The default (no env var) is the curated policy — every submission
  // queues for operator review. All the tests in this outer block rely
  // on that default. Per-policy behaviour is covered in the nested
  // describe block below.
  const ORIGINAL_POLICY = process.env.SOVEREIGN_APPROVAL_POLICY;
  beforeEach(() => {
    delete process.env.SOVEREIGN_APPROVAL_POLICY;
  });
  afterEach(() => {
    if (ORIGINAL_POLICY === undefined) {
      delete process.env.SOVEREIGN_APPROVAL_POLICY;
    } else {
      process.env.SOVEREIGN_APPROVAL_POLICY = ORIGINAL_POLICY;
    }
  });

  it("returns 202 Accepted with a reference ID on valid submission (curated default)", async () => {
    const res = await POST(req({ manifest: VALID_MINIMAL, contactEmail: "dev@example.com" }));
    expect(res.status).toBe(202);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.referenceId).toMatch(/^SAM-[0-9a-f]+-[0-9a-f]+$/);
    expect(body.status).toBe("queued");
    expect(body.policy).toBe("curated");
    expect(body.reason).toMatch(/operator review/);
    expect(body.liveUrl).toBeUndefined();
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

  /* ─── Per-policy behaviour ───────────────────────────────── */

  describe("approval policy switching", () => {
    it("under 'open' policy: returns 201 live with a marketplace URL", async () => {
      process.env.SOVEREIGN_APPROVAL_POLICY = "open";
      const res = await POST(
        req({ manifest: VALID_MINIMAL, contactEmail: "dev@example.com" }),
      );
      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.status).toBe("live");
      expect(body.policy).toBe("open");
      expect(body.liveUrl).toBe("/marketplace/extract-invoice");
      expect(body.nextSteps.some((s: string) => s.includes("70%"))).toBe(true);
    });

    it("under 'trust-tiered' policy with a new creator: returns 202 queued", async () => {
      // priorApprovedCount is hardcoded to 0 until persistence lands,
      // so trust-tiered should behave like curated for every submission
      // today. Verifies the outcome carries the correct policy label.
      process.env.SOVEREIGN_APPROVAL_POLICY = "trust-tiered";
      const res = await POST(req({ manifest: VALID_MINIMAL }));
      expect(res.status).toBe(202);
      const body = await res.json();
      expect(body.status).toBe("queued");
      expect(body.policy).toBe("trust-tiered");
      expect(body.reason).toMatch(/first submission/);
      expect(body.liveUrl).toBeUndefined();
    });

    it("under 'curated' policy (explicit): returns 202 queued", async () => {
      process.env.SOVEREIGN_APPROVAL_POLICY = "curated";
      const res = await POST(req({ manifest: VALID_MINIMAL }));
      expect(res.status).toBe(202);
      const body = await res.json();
      expect(body.policy).toBe("curated");
    });

    it("under an unknown policy value: falls back to curated (no 500)", async () => {
      process.env.SOVEREIGN_APPROVAL_POLICY = "wild-west";
      const res = await POST(req({ manifest: VALID_MINIMAL }));
      expect(res.status).toBe(202);
      const body = await res.json();
      expect(body.policy).toBe("curated");
    });

    it("response always includes policy and reason (auditability)", async () => {
      process.env.SOVEREIGN_APPROVAL_POLICY = "open";
      const res = await POST(req({ manifest: VALID_MINIMAL }));
      const body = await res.json();
      expect(typeof body.policy).toBe("string");
      expect(typeof body.reason).toBe("string");
      expect(body.reason.length).toBeGreaterThan(0);
    });
  });
});
