import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/public/atlas-edges/route";

describe("GET /api/public/atlas-edges", () => {
  it("returns edges array with source/target/weight triples", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.edges)).toBe(true);
    if (body.edges.length > 0) {
      expect(body.edges[0]).toHaveProperty("source");
      expect(body.edges[0]).toHaveProperty("target");
      expect(body.edges[0]).toHaveProperty("weight");
    }
  });

  it("sets long cache header (edges rarely change)", async () => {
    const res = await GET();
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=3600");
  });
});
