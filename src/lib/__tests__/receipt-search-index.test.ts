/**
 * Tests for src/lib/receipt-search-index.ts — Cook 128.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  _resetForTests,
  deleteReceipt,
  indexReceipt,
  searchReceipts,
  statsFor,
  type IndexedReceipt,
} from "../receipt-search-index";

function rcpt(
  id: string,
  tenantId: string,
  answer: string,
  extra: Partial<IndexedReceipt> = {},
): IndexedReceipt {
  return {
    id,
    tenantId,
    agentSlug: "lead-blitz",
    status: "committed",
    answer,
    committedAt: 1000 + id.length,
    ...extra,
  };
}

beforeEach(() => {
  _resetForTests();
});

describe("indexReceipt + searchReceipts", () => {
  it("finds receipts by token overlap", () => {
    indexReceipt(rcpt("a", "t-1", "alpha bravo charlie"));
    indexReceipt(rcpt("b", "t-1", "delta echo foxtrot"));
    const hits = searchReceipts({ tenantId: "t-1", q: "alpha bravo" });
    expect(hits.length).toBe(1);
    expect(hits[0].receipt.id).toBe("a");
    expect(hits[0].score).toBeGreaterThan(0);
    expect(hits[0].matchedTokens).toContain("alpha");
    expect(hits[0].matchedTokens).toContain("bravo");
  });

  it("returns nothing when nothing matches", () => {
    indexReceipt(rcpt("a", "t-1", "alpha bravo"));
    expect(searchReceipts({ tenantId: "t-1", q: "missing" })).toEqual([]);
  });

  it("hard-scopes by tenant", () => {
    indexReceipt(rcpt("a", "t-1", "alpha"));
    indexReceipt(rcpt("b", "t-2", "alpha"));
    const hits = searchReceipts({ tenantId: "t-1", q: "alpha" });
    expect(hits.length).toBe(1);
    expect(hits[0].receipt.tenantId).toBe("t-1");
  });
});

describe("searchReceipts — facet filters", () => {
  beforeEach(() => {
    indexReceipt(rcpt("a", "t", "alpha bravo", { agentSlug: "lead-blitz" }));
    indexReceipt(
      rcpt("b", "t", "alpha bravo", {
        agentSlug: "content-machine",
        status: "drifted",
        verdict: "pass",
      }),
    );
  });

  it("filters by agentSlug", () => {
    const hits = searchReceipts({
      tenantId: "t",
      q: "alpha",
      agentSlug: "lead-blitz",
    });
    expect(hits.length).toBe(1);
    expect(hits[0].receipt.id).toBe("a");
  });

  it("filters by status", () => {
    const hits = searchReceipts({
      tenantId: "t",
      q: "alpha",
      status: "drifted",
    });
    expect(hits.length).toBe(1);
    expect(hits[0].receipt.id).toBe("b");
  });

  it("filters by verdict", () => {
    const hits = searchReceipts({
      tenantId: "t",
      q: "alpha",
      verdict: "pass",
    });
    expect(hits.length).toBe(1);
  });
});

describe("searchReceipts — time window", () => {
  it("filters by committedAt range", () => {
    indexReceipt(rcpt("a", "t", "alpha", { committedAt: 100 }));
    indexReceipt(rcpt("b", "t", "alpha", { committedAt: 500 }));
    indexReceipt(rcpt("c", "t", "alpha", { committedAt: 900 }));
    const hits = searchReceipts({
      tenantId: "t",
      q: "alpha",
      startMs: 200,
      endMs: 800,
    });
    expect(hits.length).toBe(1);
    expect(hits[0].receipt.id).toBe("b");
  });
});

describe("searchReceipts — ranking", () => {
  it("exact-substring match boosts score", () => {
    indexReceipt(rcpt("scatter", "t", "alpha green bravo"));
    indexReceipt(rcpt("exact", "t", "alpha bravo direct"));
    const hits = searchReceipts({ tenantId: "t", q: "alpha bravo" });
    // exact ranks first.
    expect(hits[0].receipt.id).toBe("exact");
  });

  it("ties break by newest committedAt first", () => {
    indexReceipt(rcpt("old", "t", "alpha", { committedAt: 100 }));
    indexReceipt(rcpt("new", "t", "alpha", { committedAt: 999 }));
    const hits = searchReceipts({ tenantId: "t", q: "alpha" });
    expect(hits[0].receipt.id).toBe("new");
  });

  it("limit caps result count", () => {
    for (let i = 0; i < 50; i++) {
      indexReceipt(rcpt(`r-${i}`, "t", "alpha"));
    }
    expect(searchReceipts({ tenantId: "t", q: "alpha", limit: 5 }).length).toBe(
      5,
    );
  });
});

describe("indexReceipt — update existing", () => {
  it("removes old tokens when a receipt is re-indexed", () => {
    indexReceipt(rcpt("a", "t", "alpha"));
    expect(searchReceipts({ tenantId: "t", q: "alpha" }).length).toBe(1);
    indexReceipt(rcpt("a", "t", "delta"));
    expect(searchReceipts({ tenantId: "t", q: "alpha" }).length).toBe(0);
    expect(searchReceipts({ tenantId: "t", q: "delta" }).length).toBe(1);
  });
});

describe("deleteReceipt", () => {
  it("removes the receipt + its tokens", () => {
    indexReceipt(rcpt("a", "t", "alpha"));
    expect(deleteReceipt("t", "a")).toBe(true);
    expect(searchReceipts({ tenantId: "t", q: "alpha" })).toEqual([]);
  });

  it("returns false on missing", () => {
    expect(deleteReceipt("t", "missing")).toBe(false);
  });
});

describe("statsFor", () => {
  it("returns document + token counts", () => {
    indexReceipt(rcpt("a", "t", "alpha bravo charlie"));
    indexReceipt(rcpt("b", "t", "alpha delta echo"));
    const s = statsFor("t");
    expect(s.documents).toBe(2);
    expect(s.uniqueTokens).toBeGreaterThan(3);
    expect(s.topTokens.find((t) => t.token === "alpha")?.documentCount).toBe(2);
  });
});
