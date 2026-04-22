/**
 * Tests for creator-submission-persistence.
 *
 * Pure functions (category mapping, prompt synthesis) are tested with
 * exhaustive input coverage.
 *
 * DB-dependent functions (persistSubmission, countPriorApprovals) are
 * tested via their graceful-no-DB path — DATABASE_URL is unset and the
 * functions must return safe defaults without throwing. The real DB
 * path is covered by an integration test suite that runs against a
 * local Neon branch (out of scope for unit tests).
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  countPriorApprovals,
  mapSamCategoryToMarketplace,
  persistSubmission,
  synthesizeSystemPromptFromManifest,
  type PersistableSubmission,
} from "../creator-submission-persistence";

/* ─── mapSamCategoryToMarketplace ──────────────────────────────── */

describe("mapSamCategoryToMarketplace()", () => {
  it("maps all 18 SAM categories to valid marketplace categories", () => {
    const ALL_SAM = [
      "Growth",
      "Content",
      "Dev",
      "Finance",
      "HR",
      "Legal",
      "Ecommerce",
      "Research",
      "Cybersec",
      "Real Estate",
      "Gov",
      "Productivity",
      "Creative",
      "Data",
      "A2E",
      "Meta",
      "Integration",
      "Safety",
    ];
    const VALID_MARKETPLACE = new Set([
      "sales",
      "content",
      "seo",
      "code",
      "automation",
      "research",
      "voice",
      "data",
    ]);
    for (const sam of ALL_SAM) {
      const mapped = mapSamCategoryToMarketplace(sam);
      expect(VALID_MARKETPLACE.has(mapped), `${sam} → ${mapped}`).toBe(true);
    }
  });

  it("maps Dev to code (engineering agents go to code bucket)", () => {
    expect(mapSamCategoryToMarketplace("Dev")).toBe("code");
  });

  it("maps Growth/Ecommerce/Real Estate to sales", () => {
    expect(mapSamCategoryToMarketplace("Growth")).toBe("sales");
    expect(mapSamCategoryToMarketplace("Ecommerce")).toBe("sales");
    expect(mapSamCategoryToMarketplace("Real Estate")).toBe("sales");
  });

  it("maps unknown / typo categories to 'automation' (safe fallback)", () => {
    expect(mapSamCategoryToMarketplace("NotARealCategory")).toBe("automation");
    expect(mapSamCategoryToMarketplace("")).toBe("automation");
  });
});

/* ─── synthesizeSystemPromptFromManifest ───────────────────────── */

describe("synthesizeSystemPromptFromManifest()", () => {
  it("includes the display name and purpose", () => {
    const prompt = synthesizeSystemPromptFromManifest(
      "Invoice Extractor",
      "Extract structured data from invoice text",
      ["Never fabricates missing fields"],
    );
    expect(prompt).toContain("Invoice Extractor");
    expect(prompt).toContain("Extract structured data");
  });

  it("formats guarantees as a bulleted list", () => {
    const prompt = synthesizeSystemPromptFromManifest("X", "Do X", [
      "guarantee one",
      "guarantee two",
    ]);
    expect(prompt).toContain("- guarantee one");
    expect(prompt).toContain("- guarantee two");
  });

  it("handles empty guarantees array without blowing up", () => {
    const prompt = synthesizeSystemPromptFromManifest("X", "Do X", []);
    expect(prompt).toContain("(none specified)");
  });

  it("mentions the SAM v1.0 origin (so operators reading the row know where it came from)", () => {
    const prompt = synthesizeSystemPromptFromManifest("X", "Do X", []);
    expect(prompt).toContain("SAM v1.0");
  });
});

/* ─── persistSubmission (no-DB fallback) ───────────────────────── */

describe("persistSubmission() graceful no-DB path", () => {
  const ORIGINAL = process.env.DATABASE_URL;

  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });
  afterEach(() => {
    if (ORIGINAL === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = ORIGINAL;
    }
  });

  const sampleSubmission: PersistableSubmission = {
    referenceId: "SAM-deadbeef-c0de",
    slug: "extract-invoice",
    displayName: "Invoice Extractor",
    purpose: "Extract structured data",
    samCategory: "Finance",
    pricingCents: 5,
    contactEmail: "dev@example.com",
    guarantees: ["Never fabricates"],
    manifestRaw: { sam: "1.0", slug: "extract-invoice" },
    policy: "curated",
    reason: "queued for review",
    autoPublished: false,
  };

  it("returns false when DATABASE_URL is unset (no DB configured)", async () => {
    const ok = await persistSubmission(sampleSubmission);
    expect(ok).toBe(false);
  });

  it("returns false when DATABASE_URL is an empty string", async () => {
    process.env.DATABASE_URL = "";
    const ok = await persistSubmission(sampleSubmission);
    expect(ok).toBe(false);
  });

  it("does not throw when called without a DB (callers rely on this)", async () => {
    await expect(persistSubmission(sampleSubmission)).resolves.not.toThrow();
  });
});

/* ─── countPriorApprovals (no-DB fallback) ─────────────────────── */

describe("countPriorApprovals() graceful no-DB path", () => {
  const ORIGINAL = process.env.DATABASE_URL;

  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });
  afterEach(() => {
    if (ORIGINAL === undefined) {
      delete process.env.DATABASE_URL;
    } else {
      process.env.DATABASE_URL = ORIGINAL;
    }
  });

  it("returns 0 when contactEmail is null (anonymous submission)", async () => {
    const n = await countPriorApprovals(null);
    expect(n).toBe(0);
  });

  it("returns 0 when DATABASE_URL is unset", async () => {
    const n = await countPriorApprovals("dev@example.com");
    expect(n).toBe(0);
  });

  it("does not throw even for a weird input", async () => {
    await expect(countPriorApprovals("")).resolves.toBe(0);
    await expect(countPriorApprovals(null)).resolves.toBe(0);
  });
});
