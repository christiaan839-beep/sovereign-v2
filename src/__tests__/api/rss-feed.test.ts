/**
 * Tests for /r/feed.xml — public RSS feed of agent receipts.
 *
 * Covers:
 *   - returns valid RSS 2.0 XML headers + content-type
 *   - includes channel metadata (title, atom self-link)
 *   - emits one <item> per public/unlisted row
 *   - escapes XML metacharacters in agent names + previews
 *   - returns an empty (still valid) feed on DB error
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

let mockRows: Array<Record<string, unknown>> = [];
let dbShouldThrow = false;

vi.mock("@/db", () => {
  const chain = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    orderBy: () => chain,
    limit: () => {
      if (dbShouldThrow) return Promise.reject(new Error("DB blip"));
      return Promise.resolve(mockRows);
    },
  };
  return { db: chain };
});

async function loadRoute() {
  vi.resetModules();
  return await import("@/app/r/feed.xml/route");
}

function makeReq(): Request {
  return new Request("http://localhost/r/feed.xml", {
    headers: { host: "sovereignmatrix.agency", "x-forwarded-proto": "https" },
  });
}

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: "00000000-0000-0000-0000-000000000001",
    agentName: "blog-gen",
    modelUsed: "claude-sonnet-4-6",
    inputJson: JSON.stringify({ topic: "How HMAC works" }),
    outputJson: JSON.stringify({ html: "<p>An overview…</p>" }),
    durationMs: 1234,
    createdAt: new Date("2026-05-01T00:00:00Z"),
    ...overrides,
  };
}

describe("GET /r/feed.xml", () => {
  beforeEach(() => {
    mockRows = [];
    dbShouldThrow = false;
    vi.clearAllMocks();
  });

  it("returns valid RSS 2.0 with correct content-type", async () => {
    mockRows = [row()];
    const { GET } = await loadRoute();
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toMatch(/application\/rss\+xml/);
    const body = await res.text();
    expect(body).toMatch(/<\?xml version="1\.0"/);
    expect(body).toMatch(/<rss version="2\.0"/);
    expect(body).toMatch(/<atom:link.*rel="self"/);
  });

  it("emits one <item> per row", async () => {
    mockRows = [row({ id: "id-1" }), row({ id: "id-2" })];
    const { GET } = await loadRoute();
    const body = await (await GET(makeReq())).text();
    const matches = body.match(/<item>/g);
    expect(matches?.length).toBe(2);
  });

  it("escapes XML metacharacters in agent names + previews", async () => {
    mockRows = [
      row({
        agentName: "bad<&>'\"agent",
        inputJson: JSON.stringify({ q: "<script>alert('x')</script>" }),
      }),
    ];
    const { GET } = await loadRoute();
    const body = await (await GET(makeReq())).text();
    expect(body).toContain("bad&lt;&amp;&gt;&apos;&quot;agent");
    // The CDATA-wrapped description contains the input — the raw unescaped
    // angle-bracket attack vector should still NOT appear outside CDATA.
    expect(body).not.toMatch(/<script>(?!.*<!\[CDATA\[)/);
  });

  it("returns 200 with empty <channel> when the DB blips", async () => {
    dbShouldThrow = true;
    const { GET } = await loadRoute();
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toMatch(/<rss version="2\.0"/);
    // No items
    expect(body.match(/<item>/g)).toBeNull();
  });

  it("sets a Cache-Control hint", async () => {
    mockRows = [row()];
    const { GET } = await loadRoute();
    const res = await GET(makeReq());
    expect(res.headers.get("cache-control")).toMatch(/max-age=300/);
  });
});
