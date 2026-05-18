/**
 * Tests for src/lib/industries-registry.ts — Wave 29.
 *
 * Verifies the catalog's structural invariants + the cryptographic
 * attestation roundtrip.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes, createHash } from "crypto";
import {
  listIndustries,
  listAllWorkflows,
  findIndustry,
  registrySummary,
  canonicalize,
  signRegistry,
} from "@/lib/industries-registry";

const originalSecret = process.env.AGENT_RUN_SIGNING_SECRET;
const originalEd = process.env.AGENT_RUN_ED25519_PRIVATE_KEY;

beforeAll(() => {
  delete process.env.AGENT_RUN_ED25519_PRIVATE_KEY;
  process.env.AGENT_RUN_SIGNING_SECRET = randomBytes(24).toString("hex");
});
afterAll(() => {
  if (originalSecret !== undefined)
    process.env.AGENT_RUN_SIGNING_SECRET = originalSecret;
  else delete process.env.AGENT_RUN_SIGNING_SECRET;
  if (originalEd !== undefined)
    process.env.AGENT_RUN_ED25519_PRIVATE_KEY = originalEd;
});

describe("listIndustries", () => {
  it("returns at least 20 industries (the heavy-regulation set alone)", () => {
    expect(listIndustries().length).toBeGreaterThanOrEqual(20);
  });

  it("every industry has a non-empty workflows array", () => {
    for (const i of listIndustries()) {
      expect(i.workflows.length).toBeGreaterThan(0);
    }
  });

  it("every industry has a non-empty positioning sentence", () => {
    for (const i of listIndustries()) {
      expect(i.positioning.length).toBeGreaterThan(20);
    }
  });

  it("category + slug + retention fields are well-formed everywhere", () => {
    for (const i of listIndustries()) {
      expect(i.category).toMatch(/^[a-z0-9-]+$/);
      for (const w of i.workflows) {
        expect(w.slug).toMatch(/^[a-z0-9-]+$/);
        expect(w.retentionYears).toBeGreaterThan(0);
        expect(w.regulations.length).toBeGreaterThan(0);
        expect(["shipped", "in-progress", "scoped"]).toContain(w.agentStatus);
      }
    }
  });

  it("workflow slugs are globally unique across the registry", () => {
    const slugs = listAllWorkflows().map((w) => w.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("findIndustry", () => {
  it("returns the matching industry by category", () => {
    const i = findIndustry("healthcare");
    expect(i?.name).toMatch(/Healthcare/);
  });

  it("returns undefined for an unknown category", () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(findIndustry("not-a-real-category" as any)).toBeUndefined();
  });
});

describe("registrySummary", () => {
  it("totals match listAllWorkflows", () => {
    const s = registrySummary();
    expect(s.workflowCount).toBe(listAllWorkflows().length);
    expect(s.industryCount).toBe(listIndustries().length);
  });

  it("shipped + in-progress + scoped sums to workflowCount", () => {
    const s = registrySummary();
    expect(s.shippedCount + s.inProgressCount + s.scopedCount).toBe(
      s.workflowCount,
    );
  });

  it("byWeight sums to industryCount", () => {
    const s = registrySummary();
    expect(s.byWeight.heavy + s.byWeight.medium + s.byWeight.light).toBe(
      s.industryCount,
    );
  });

  it("heavy bucket dominates (this is the regulated-industry product)", () => {
    const s = registrySummary();
    expect(s.byWeight.heavy).toBeGreaterThanOrEqual(s.byWeight.medium);
  });
});

describe("canonicalize", () => {
  it("emits a deterministic, version-stamped projection", () => {
    const a = canonicalize();
    const b = canonicalize();
    expect(a).toBe(b);
    const parsed = JSON.parse(a);
    expect(parsed.v).toBe(1);
    expect(parsed.type).toBe("industries-registry");
  });

  it("sorts regulations within each workflow for byte-stability", () => {
    const parsed = JSON.parse(canonicalize());
    for (const ind of parsed.industries) {
      for (const w of ind.workflows) {
        const sorted = [...w.regulations].sort();
        expect(w.regulations).toEqual(sorted);
      }
    }
  });
});

describe("signRegistry", () => {
  it("returns canonical + contentHash + signature", () => {
    const r = signRegistry();
    expect(r.canonical).toMatch(/"type":"industries-registry"/);
    expect(r.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(r.signature).toMatch(/^v1=[0-9a-f]+$/);
  });

  it("contentHash equals SHA-256 of canonical", () => {
    const r = signRegistry();
    const expected = createHash("sha256").update(r.canonical).digest("hex");
    expect(r.contentHash).toBe(expected);
  });

  it("is reproducible — same call twice produces same hash + signature", () => {
    const a = signRegistry();
    const b = signRegistry();
    expect(a.canonical).toBe(b.canonical);
    expect(a.contentHash).toBe(b.contentHash);
    expect(a.signature).toBe(b.signature);
  });
});
