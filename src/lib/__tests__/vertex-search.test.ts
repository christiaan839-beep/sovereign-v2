/**
 * Tests for src/lib/vertex-search.ts — Wave 137.
 *
 * Covers env detection + the response parser. The HTTP call goes
 * through outboundFetchAsResponse which is hard-mocked.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

const fetchMock = vi.fn();
vi.mock("@/lib/outbound-fetch", () => ({
  outboundFetchAsResponse: (...args: unknown[]) => fetchMock(...args),
}));

import {
  isVertexSearchConfigured,
  parseVertexResponse,
  vertexSearch,
} from "@/lib/vertex-search";

beforeEach(() => {
  fetchMock.mockReset();
  delete process.env.GCP_VERTEX_SEARCH_PROJECT;
  delete process.env.GCP_VERTEX_SEARCH_ENGINE_ID;
  delete process.env.GCP_VERTEX_SEARCH_LOCATION;
  delete process.env.GCP_VERTEX_SEARCH_ACCESS_TOKEN;
});

afterEach(() => {
  delete process.env.GCP_VERTEX_SEARCH_PROJECT;
  delete process.env.GCP_VERTEX_SEARCH_ENGINE_ID;
  delete process.env.GCP_VERTEX_SEARCH_LOCATION;
  delete process.env.GCP_VERTEX_SEARCH_ACCESS_TOKEN;
});

describe("isVertexSearchConfigured", () => {
  it("returns false when nothing is set", () => {
    expect(isVertexSearchConfigured()).toBe(false);
  });

  it("returns false when only some env vars are set", () => {
    process.env.GCP_VERTEX_SEARCH_PROJECT = "p";
    process.env.GCP_VERTEX_SEARCH_ENGINE_ID = "e";
    expect(isVertexSearchConfigured()).toBe(false);
  });

  it("returns true when project + engine + token are set", () => {
    process.env.GCP_VERTEX_SEARCH_PROJECT = "p";
    process.env.GCP_VERTEX_SEARCH_ENGINE_ID = "e";
    process.env.GCP_VERTEX_SEARCH_ACCESS_TOKEN = "tok";
    expect(isVertexSearchConfigured()).toBe(true);
  });

  it("treats whitespace-only values as unset", () => {
    process.env.GCP_VERTEX_SEARCH_PROJECT = "   ";
    process.env.GCP_VERTEX_SEARCH_ENGINE_ID = "e";
    process.env.GCP_VERTEX_SEARCH_ACCESS_TOKEN = "tok";
    expect(isVertexSearchConfigured()).toBe(false);
  });
});

describe("parseVertexResponse", () => {
  it("returns empty result on missing data", () => {
    const r = parseVertexResponse("q", null);
    expect(r.snippets).toEqual([]);
    expect(r.totalResults).toBe(0);
    expect(r.summary).toBeUndefined();
  });

  it("flattens snippets with link + title + score", () => {
    const r = parseVertexResponse("q", {
      results: [
        {
          modelScore: 0.88,
          document: {
            derivedStructData: {
              link: "https://example.com/a",
              title: "Example A",
              snippets: [{ snippet: "First match." }, { snippet: "Second." }],
            },
          },
        },
      ],
      totalSize: 1,
    });
    expect(r.snippets).toHaveLength(2);
    expect(r.snippets[0].uri).toBe("https://example.com/a");
    expect(r.snippets[0].title).toBe("Example A");
    expect(r.snippets[0].score).toBe(0.88);
    expect(r.totalResults).toBe(1);
  });

  it("drops snippets missing link or text", () => {
    const r = parseVertexResponse("q", {
      results: [
        {
          document: {
            derivedStructData: {
              link: "https://example.com/a",
              snippets: [{ snippet: "" }, { snippet: "ok" }],
            },
          },
        },
        {
          document: {
            derivedStructData: {
              snippets: [{ snippet: "no-link" }],
            },
          },
        },
      ],
    });
    expect(r.snippets).toHaveLength(1);
    expect(r.snippets[0].text).toBe("ok");
  });

  it("captures generative summary when present", () => {
    const r = parseVertexResponse("q", {
      results: [],
      summary: { summaryText: "  The answer is 42.  " },
    });
    expect(r.summary).toBe("The answer is 42.");
  });

  it("collapses whitespace in snippets", () => {
    const r = parseVertexResponse("q", {
      results: [
        {
          document: {
            derivedStructData: {
              link: "https://x",
              snippets: [{ snippet: "  line1\n\n  line2  " }],
            },
          },
        },
      ],
    });
    expect(r.snippets[0].text).toBe("line1 line2");
  });
});

describe("vertexSearch", () => {
  it("returns null when not configured", async () => {
    expect(await vertexSearch("query")).toBeNull();
  });

  it("returns null on empty query", async () => {
    process.env.GCP_VERTEX_SEARCH_PROJECT = "p";
    process.env.GCP_VERTEX_SEARCH_ENGINE_ID = "e";
    process.env.GCP_VERTEX_SEARCH_ACCESS_TOKEN = "tok";
    expect(await vertexSearch("   ")).toBeNull();
  });

  it("returns parsed snippets on 200", async () => {
    process.env.GCP_VERTEX_SEARCH_PROJECT = "p";
    process.env.GCP_VERTEX_SEARCH_ENGINE_ID = "e";
    process.env.GCP_VERTEX_SEARCH_ACCESS_TOKEN = "tok";
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [
          {
            document: {
              derivedStructData: {
                link: "https://x",
                snippets: [{ snippet: "hit" }],
              },
            },
          },
        ],
      }),
    });
    const r = await vertexSearch("q");
    expect(r).not.toBeNull();
    expect(r?.snippets[0].uri).toBe("https://x");
  });

  it("returns null on non-2xx", async () => {
    process.env.GCP_VERTEX_SEARCH_PROJECT = "p";
    process.env.GCP_VERTEX_SEARCH_ENGINE_ID = "e";
    process.env.GCP_VERTEX_SEARCH_ACCESS_TOKEN = "tok";
    fetchMock.mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => "Forbidden",
    });
    expect(await vertexSearch("q")).toBeNull();
  });

  it("returns null when fetch throws (no error escape)", async () => {
    process.env.GCP_VERTEX_SEARCH_PROJECT = "p";
    process.env.GCP_VERTEX_SEARCH_ENGINE_ID = "e";
    process.env.GCP_VERTEX_SEARCH_ACCESS_TOKEN = "tok";
    fetchMock.mockRejectedValue(new Error("network"));
    expect(await vertexSearch("q")).toBeNull();
  });

  it("sends Authorization Bearer + pinned allowedHost", async () => {
    process.env.GCP_VERTEX_SEARCH_PROJECT = "proj";
    process.env.GCP_VERTEX_SEARCH_ENGINE_ID = "eng";
    process.env.GCP_VERTEX_SEARCH_ACCESS_TOKEN = "secret-token";
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    await vertexSearch("hello");
    const [url, init, opts] = fetchMock.mock.calls[0]!;
    expect(String(url)).toContain("discoveryengine.googleapis.com");
    expect(String(url)).toContain("proj");
    expect(String(url)).toContain("eng");
    expect(
      (init as { headers: Record<string, string> }).headers.Authorization,
    ).toBe("Bearer secret-token");
    expect((opts as { allowedHosts: string[] }).allowedHosts).toContain(
      "discoveryengine.googleapis.com",
    );
  });
});
