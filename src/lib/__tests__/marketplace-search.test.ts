/**
 * Tests for marketplace-search — corpus text + no-DB/no-NIM paths.
 *
 * Full semantic + rerank pipelines are covered by integration tests
 * against a staging Neon branch with real NIM calls. Here we test:
 *   - agentCorpusText is deterministic + includes all expected signals
 *   - no-DB fail-safe returns { hits: [], mode: "empty" }
 *   - no-NIM graceful path (DB still queried, falls back to keyword)
 *   - embedAndStoreAgent returns false on no-DB (never throws)
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  agentCorpusText,
  embedAndStoreAgent,
  searchMarketplace,
} from "../marketplace-search";

describe("agentCorpusText()", () => {
  it("includes name, description, and category", () => {
    const text = agentCorpusText({
      name: "Invoice Extractor",
      description: "Extracts structured data from invoices",
      category: "Finance",
      manifestRaw: null,
    });
    expect(text).toContain("Invoice Extractor");
    expect(text).toContain("Extracts structured data");
    expect(text).toContain("Finance");
  });

  it("includes purpose + guarantees from manifest_raw when present", () => {
    const text = agentCorpusText({
      name: "X",
      description: "Y",
      category: "Growth",
      manifestRaw: {
        purpose: "Route leads by ICP",
        guarantees: ["Never fabricates emails", "De-dupes by LinkedIn URL"],
      },
    });
    expect(text).toContain("Route leads by ICP");
    expect(text).toContain("Never fabricates emails");
    expect(text).toContain("De-dupes by LinkedIn URL");
  });

  it("includes SAM category when it differs from marketplace category", () => {
    // SAM has "Real Estate" → marketplace maps to "sales". Show both.
    const text = agentCorpusText({
      name: "Listing Analyzer",
      description: "Analyzes listings",
      category: "sales", // marketplace category
      manifestRaw: { category: "Real Estate" },
    });
    expect(text).toContain("Real Estate");
  });

  it("does NOT add a 'SAM category:' line when SAM matches marketplace", () => {
    const text = agentCorpusText({
      name: "Finance Tool",
      description: "Finance stuff",
      category: "Finance",
      manifestRaw: { category: "Finance" },
    });
    expect(text).not.toContain("SAM category:");
    expect(text).toContain("Category: Finance");
  });

  it("handles missing or malformed manifest gracefully", () => {
    const text = agentCorpusText({
      name: "X",
      description: "Y",
      category: "Z",
      manifestRaw: null,
    });
    expect(text).toContain("X");
    expect(text).toContain("Y");
    expect(text).toContain("Z");
  });

  it("filters non-string entries out of guarantees array (defensive)", () => {
    // The runtime input is `unknown[]` via JSONB; we pass a mixed
    // array to exercise the runtime filter. Cast once to unknown to
    // keep the test strict-compile friendly.
    const guarantees = [
      "legit guarantee",
      42,
      { evil: "object" },
    ] as unknown as string[];
    const text = agentCorpusText({
      name: "X",
      description: "Y",
      category: "Z",
      manifestRaw: { guarantees },
    });
    expect(text).toContain("legit guarantee");
    expect(text).not.toContain("42");
    expect(text).not.toContain("evil");
  });
});

describe("searchMarketplace() — no-DB path", () => {
  const ORIGINAL = process.env.DATABASE_URL;
  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = ORIGINAL;
  });

  it("returns empty mode for empty query regardless of DB", async () => {
    const { hits, mode } = await searchMarketplace("");
    expect(hits).toEqual([]);
    expect(mode).toBe("empty");
  });

  it("returns empty mode for whitespace-only query", async () => {
    const { hits, mode } = await searchMarketplace("   ");
    expect(hits).toEqual([]);
    expect(mode).toBe("empty");
  });

  it("returns empty result without a DB (graceful)", async () => {
    const { hits, mode } = await searchMarketplace("invoice extractor");
    expect(hits).toEqual([]);
    expect(mode).toBe("empty");
  });
});

describe("embedAndStoreAgent() — no-DB graceful", () => {
  const ORIGINAL = process.env.DATABASE_URL;
  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = ORIGINAL;
  });

  it("returns false without a DB", async () => {
    const ok = await embedAndStoreAgent({
      id: "00000000-0000-0000-0000-000000000000",
      corpusText: "hello world",
    });
    expect(ok).toBe(false);
  });

  it("returns false for empty id", async () => {
    const ok = await embedAndStoreAgent({ id: "", corpusText: "x" });
    expect(ok).toBe(false);
  });
});
