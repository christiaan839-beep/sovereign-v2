/**
 * Tests for src/lib/rag.ts — Cook 38 retrieval contracts.
 *
 *   - retrieve(): tenant scope is HARD; category filter; topK; deterministic
 *     ordering on score ties; zero-score noise dropped; citation ids stable.
 *   - Lexical + semantic blending matches the documented weight contract.
 *   - renderContextBlock(): stable formatting; empty memories handled.
 *   - extractCitations(): in order of first appearance; dedups; drops
 *     hallucinated ids.
 */

import { describe, it, expect } from "vitest";
import {
  retrieve,
  renderContextBlock,
  extractCitations,
  tokenize,
  type Memory,
} from "../rag";

const NOW = 1_700_000_000_000;

function mem(id: string, body: string, extra: Partial<Memory> = {}): Memory {
  return {
    id,
    tenantId: "tenant-1",
    body,
    createdAt: NOW,
    ...extra,
  };
}

describe("tokenize", () => {
  it("lowercases, strips punctuation, drops stopwords + short tokens", () => {
    expect(tokenize("The quick, BROWN fox: jumps!")).toEqual([
      "quick",
      "brown",
      "fox",
      "jumps",
    ]);
  });

  it("returns an empty list for empty input", () => {
    expect(tokenize("")).toEqual([]);
    expect(tokenize("the it a is")).toEqual([]);
  });
});

describe("retrieve — tenant scope", () => {
  it("never returns memories from other tenants", () => {
    const memories = [
      mem("a", "alpha bravo charlie", { tenantId: "tenant-1" }),
      mem("b", "alpha bravo charlie", { tenantId: "tenant-2" }),
    ];
    const results = retrieve(memories, {
      query: "alpha",
      tenantId: "tenant-1",
    });
    expect(results.map((r) => r.memory.id)).toEqual(["a"]);
  });

  it("throws when tenantId is missing", () => {
    expect(() => retrieve([], { query: "x", tenantId: "" })).toThrow(
      /cross-tenant guard/,
    );
  });
});

describe("retrieve — filtering and ranking", () => {
  it("applies the category filter", () => {
    const memories = [
      mem("a", "alpha bravo", { category: "preferences" }),
      mem("b", "alpha bravo", { category: "deal" }),
    ];
    const results = retrieve(memories, {
      query: "alpha",
      tenantId: "tenant-1",
      category: "deal",
    });
    expect(results.map((r) => r.memory.id)).toEqual(["b"]);
  });

  it("respects topK and orders by score descending", () => {
    const memories = [
      mem("low", "completely unrelated content"),
      mem("hi", "alpha bravo charlie delta echo"),
      mem("mid", "alpha bravo something else"),
    ];
    const results = retrieve(memories, {
      query: "alpha bravo charlie delta echo",
      tenantId: "tenant-1",
      topK: 2,
    });
    expect(results.length).toBe(2);
    expect(results[0].memory.id).toBe("hi");
    expect(results[1].memory.id).toBe("mid");
  });

  it("breaks score ties by newer createdAt", () => {
    const memories = [
      mem("old", "alpha", { createdAt: NOW - 1000 }),
      mem("new", "alpha", { createdAt: NOW + 1000 }),
    ];
    const results = retrieve(memories, {
      query: "alpha",
      tenantId: "tenant-1",
    });
    expect(results[0].memory.id).toBe("new");
  });

  it("drops zero-score noise instead of padding to topK", () => {
    const memories = [
      mem("a", "alpha"),
      mem("b", "completely unrelated"),
      mem("c", "also off-topic"),
    ];
    const results = retrieve(memories, {
      query: "alpha",
      tenantId: "tenant-1",
      topK: 5,
    });
    expect(results.map((r) => r.memory.id)).toEqual(["a"]);
  });

  it("assigns stable citation ids in rank order", () => {
    const memories = [mem("a", "alpha bravo charlie"), mem("b", "alpha bravo")];
    const results = retrieve(memories, {
      query: "alpha bravo charlie",
      tenantId: "tenant-1",
    });
    expect(results[0].citationId).toBe("m-1");
    expect(results[1].citationId).toBe("m-2");
  });
});

describe("retrieve — semantic + lexical blending", () => {
  it("uses lexical alone when no embeddings are present", () => {
    const memories = [mem("a", "alpha bravo charlie")];
    const results = retrieve(memories, {
      query: "alpha",
      tenantId: "tenant-1",
    });
    expect(results[0].semanticScore).toBe(-1);
    expect(results[0].lexicalScore).toBeGreaterThan(0);
    expect(results[0].score).toBe(results[0].lexicalScore);
  });

  it("blends semantic + lexical when both are present", () => {
    const memories = [
      mem("semantic-heavy", "completely unrelated text", {
        embedding: [1, 0, 0],
      }),
      mem("lexical-heavy", "alpha bravo", { embedding: [0, 1, 0] }),
    ];
    const results = retrieve(memories, {
      query: "alpha",
      queryEmbedding: [1, 0, 0],
      tenantId: "tenant-1",
      semanticWeight: 0.9,
    });
    // semantic dominates → unrelated-text wins because its embedding matches.
    expect(results[0].memory.id).toBe("semantic-heavy");
  });

  it("falls back to lexical when semanticWeight=0", () => {
    const memories = [
      mem("a", "alpha bravo", { embedding: [1, 0, 0] }),
      mem("b", "unrelated entirely", { embedding: [0, 1, 0] }),
    ];
    const results = retrieve(memories, {
      query: "alpha",
      queryEmbedding: [0, 1, 0],
      tenantId: "tenant-1",
      semanticWeight: 0,
    });
    // lexical-only → "alpha bravo" wins despite embedding mismatch.
    expect(results[0].memory.id).toBe("a");
  });
});

describe("renderContextBlock", () => {
  it("renders a stable, citation-ready memory block", () => {
    const memories = [
      mem("a", "alpha facts here", { title: "Alpha", category: "knowledge" }),
      mem("b", "bravo facts here", { title: "Bravo" }),
    ];
    const results = retrieve(memories, {
      query: "alpha bravo",
      tenantId: "tenant-1",
    });
    const block = renderContextBlock(results);
    expect(block).toContain("─── MEMORY ───");
    expect(block).toContain("[m-1]");
    expect(block).toContain("[m-2]");
    expect(block).toContain("(knowledge)");
    expect(block).toContain("alpha facts here");
  });

  it("renders a no-memory placeholder when retrieved list is empty", () => {
    const block = renderContextBlock([]);
    expect(block).toContain("no relevant memories");
  });
});

describe("extractCitations", () => {
  it("returns matched citations in order of first appearance, deduped", () => {
    const memories = [
      mem("a", "alpha facts"),
      mem("b", "bravo facts"),
      mem("c", "charlie facts"),
    ];
    const results = retrieve(memories, {
      query: "alpha bravo charlie",
      tenantId: "tenant-1",
    });
    const answer = "We learned X [m-2], and Y [m-1], and Z [m-2] again.";
    const cited = extractCitations(answer, results);
    expect(cited.map((c) => c.citationId)).toEqual(["m-2", "m-1"]);
  });

  it("drops citations the model hallucinated", () => {
    const memories = [mem("a", "alpha facts")];
    const results = retrieve(memories, {
      query: "alpha",
      tenantId: "tenant-1",
    });
    const answer = "Per [m-99] this is wrong, and [m-1] is right.";
    const cited = extractCitations(answer, results);
    expect(cited.map((c) => c.citationId)).toEqual(["m-1"]);
  });
});
