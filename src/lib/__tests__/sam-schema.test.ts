/**
 * /api/public/sam/schema — tests.
 *
 * The schema IS the contract — changes must be intentional. These
 * tests guard the 10 required top-level fields, the 18-category enum,
 * the slug pattern, and the frozen "1.0" const.
 */

import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/public/sam/schema/route";

describe("GET /api/public/sam/schema", () => {
  it("returns a JSON-Schema document with the SAM 1.0 id", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.$schema).toContain("json-schema.org");
    expect(body.title).toMatch(/Sovereign Agent Manifest/);
  });

  it("requires the 9 core fields", async () => {
    const body = await (await GET()).json();
    const required = body.required;
    expect(required).toContain("sam");
    expect(required).toContain("slug");
    expect(required).toContain("displayName");
    expect(required).toContain("purpose");
    expect(required).toContain("category");
    expect(required).toContain("version");
    expect(required).toContain("inputs");
    expect(required).toContain("output");
    expect(required).toContain("guarantees");
  });

  it("pins the sam field to the literal '1.0' (frozen spec)", async () => {
    const body = await (await GET()).json();
    expect(body.properties.sam.const).toBe("1.0");
  });

  it("enumerates exactly 18 official categories", async () => {
    const body = await (await GET()).json();
    expect(body.properties.category.enum).toHaveLength(18);
    expect(body.properties.category.enum).toContain("A2E");
    expect(body.properties.category.enum).toContain("Cybersec");
    expect(body.properties.category.enum).toContain("Real Estate");
  });

  it("enforces kebab-case slug via regex pattern", async () => {
    const body = await (await GET()).json();
    expect(body.properties.slug.pattern).toBe("^[a-z][a-z0-9-]{2,63}$");
  });

  it("declares the 4 safety trust tiers", async () => {
    const body = await (await GET()).json();
    expect(body.properties.safety.properties.trustTier.enum).toEqual([
      "supervised",
      "guided",
      "autonomous",
      "full-auto",
    ]);
  });

  it("requires guarantees to be a non-empty array", async () => {
    const body = await (await GET()).json();
    expect(body.properties.guarantees.minItems).toBe(1);
  });

  it("enforces SemVer pattern on version", async () => {
    const body = await (await GET()).json();
    // Must accept "1.0.0" and "1.0.0-beta.1"
    const pattern = new RegExp(body.properties.version.pattern);
    expect(pattern.test("1.0.0")).toBe(true);
    expect(pattern.test("2.3.4-beta.1")).toBe(true);
    expect(pattern.test("1.0")).toBe(false); // incomplete — fails
    expect(pattern.test("abc")).toBe(false);
  });

  it("sets aggressive edge-cache for the frozen spec", async () => {
    const res = await GET();
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=86400");
    expect(res.headers.get("X-SAM-Version")).toBe("1.0");
  });

  it("advertises schema+json content type for tooling", async () => {
    const res = await GET();
    expect(res.headers.get("Content-Type")).toContain("schema+json");
  });
});
