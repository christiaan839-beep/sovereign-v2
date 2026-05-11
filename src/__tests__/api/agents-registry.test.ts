/**
 * Tests for GET /api/agents — public agent catalog.
 *
 * Covers:
 *   - returns 200 + open CORS
 *   - default surface excludes deprecated agents
 *   - ?tier=core returns only core agents
 *   - ?tier=experimental returns only experimental agents
 *   - tiers summary counts match the items array
 *   - sort order: core first, then alphabetical
 *   - invalid ?tier param falls back to default surface
 */
import { describe, it, expect } from "vitest";

async function load() {
  return await import("@/app/api/agents/route");
}

interface ApiResponse {
  items: Array<{
    slug: string;
    name: string;
    tier: "core" | "experimental" | "deprecated";
    invokeUrl: string;
  }>;
  total: number;
  tiers: { core: number; experimental: number; deprecated: number };
}

function makeReq(query = ""): Request {
  return new Request(`http://localhost/api/agents${query}`);
}

describe("GET /api/agents", () => {
  it("returns 200 with open CORS for cross-origin SDK discovery", async () => {
    const { GET } = await load();
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("cache-control")).toMatch(/max-age=300/);
  });

  it("default surface excludes deprecated agents", async () => {
    const { GET } = await load();
    const body = (await (await GET(makeReq())).json()) as ApiResponse;
    expect(body.items.every((a) => a.tier !== "deprecated")).toBe(true);
  });

  it("?tier=core returns only core agents", async () => {
    const { GET } = await load();
    const body = (await (
      await GET(makeReq("?tier=core"))
    ).json()) as ApiResponse;
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((a) => a.tier === "core")).toBe(true);
  });

  it("?tier=experimental returns only experimental agents", async () => {
    const { GET } = await load();
    const body = (await (
      await GET(makeReq("?tier=experimental"))
    ).json()) as ApiResponse;
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((a) => a.tier === "experimental")).toBe(true);
  });

  it("tiers summary counts match items array", async () => {
    const { GET } = await load();
    const body = (await (await GET(makeReq())).json()) as ApiResponse;
    const counted = {
      core: body.items.filter((a) => a.tier === "core").length,
      experimental: body.items.filter((a) => a.tier === "experimental").length,
      deprecated: body.items.filter((a) => a.tier === "deprecated").length,
    };
    expect(counted.core).toBe(body.tiers.core);
    expect(counted.experimental).toBe(body.tiers.experimental);
    expect(body.total).toBe(body.items.length);
  });

  it("sort order: core agents come before experimental ones", async () => {
    const { GET } = await load();
    const body = (await (await GET(makeReq())).json()) as ApiResponse;
    let seenExperimental = false;
    for (const a of body.items) {
      if (a.tier === "experimental") seenExperimental = true;
      if (a.tier === "core" && seenExperimental) {
        throw new Error(
          `Sort order broken: core agent "${a.slug}" appears after experimental`,
        );
      }
    }
  });

  it("invalid ?tier value falls back to the default surface", async () => {
    const { GET } = await load();
    const body = (await (
      await GET(makeReq("?tier=banana"))
    ).json()) as ApiResponse;
    // Should match the default (no filter) shape
    expect(body.items.length).toBeGreaterThan(0);
    expect(body.items.every((a) => a.tier !== "deprecated")).toBe(true);
  });

  it("every item carries an invokeUrl pointing at /api/_agents/<slug>", async () => {
    const { GET } = await load();
    const body = (await (await GET(makeReq())).json()) as ApiResponse;
    for (const a of body.items) {
      expect(a.invokeUrl).toBe(`/api/_agents/${a.slug}`);
    }
  });
});
