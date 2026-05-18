/**
 * Tests for GET /api/transparency/witness/observations — the witness
 * federation primitive.
 *
 * Covers:
 *   - returns 200 + open CORS
 *   - schema invariants (version, generated_at, observations array)
 *   - empty observation list when store is fresh
 *   - returns every recorded STH after recordCosignature() calls
 *   - ?limit param caps the response
 *   - ?limit clamps to MAX_LIMIT
 *   - 30-second cache header
 */
import { describe, it, expect, beforeEach } from "vitest";
import { recordCosignature, _resetWitnessStore } from "@/lib/witness-store";

async function load() {
  return await import("@/app/api/transparency/witness/observations/route");
}

interface ObservationDoc {
  version: number;
  generated_at: string;
  issuer: string;
  observation_count: number;
  limit: number;
  observations: Array<{
    sthCanonical: string;
    sthHash: string;
    cosignatures: Array<{
      witnessId: string;
      signature: string;
      submittedAt: string;
      publicKeyUrl?: string;
    }>;
  }>;
}

function makeReq(query = ""): Request {
  return new Request(
    `http://localhost/api/transparency/witness/observations${query}`,
  );
}

describe("GET /api/transparency/witness/observations", () => {
  beforeEach(() => {
    _resetWitnessStore();
  });

  it("returns 200 with open CORS", async () => {
    const { GET } = await load();
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("has 30-second federation cache header", async () => {
    const { GET } = await load();
    const res = await GET(makeReq());
    expect(res.headers.get("Cache-Control")).toContain("max-age=30");
    expect(res.headers.get("Cache-Control")).toContain("s-maxage=30");
  });

  it("emits a stable schema-versioned envelope", async () => {
    const { GET } = await load();
    const res = await GET(makeReq());
    const doc = (await res.json()) as ObservationDoc;

    expect(doc.version).toBe(1);
    expect(typeof doc.generated_at).toBe("string");
    expect(doc.generated_at).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$/,
    );
    expect(typeof doc.issuer).toBe("string");
    expect(doc.issuer.startsWith("http")).toBe(true);
    expect(Array.isArray(doc.observations)).toBe(true);
    expect(typeof doc.observation_count).toBe("number");
    expect(typeof doc.limit).toBe("number");
  });

  it("returns an empty observations array on a fresh store", async () => {
    const { GET } = await load();
    const res = await GET(makeReq());
    const doc = (await res.json()) as ObservationDoc;
    expect(doc.observation_count).toBe(0);
    expect(doc.observations.length).toBe(0);
  });

  it("surfaces every recorded STH after recordCosignature() calls", async () => {
    recordCosignature("sth-a-canonical-bytes-aaaa", {
      witnessId: "EU Witness · Berlin",
      signature: "v2=sigA1",
      submittedAt: new Date().toISOString(),
      publicKeyUrl: "https://example.com/a.pem",
    });
    recordCosignature("sth-b-canonical-bytes-bbbb", {
      witnessId: "US Witness · NYC",
      signature: "v2=sigB1",
      submittedAt: new Date().toISOString(),
    });
    // Same STH, second witness — should aggregate into one entry.
    recordCosignature("sth-a-canonical-bytes-aaaa", {
      witnessId: "JP Witness · Tokyo",
      signature: "v2=sigA2",
      submittedAt: new Date().toISOString(),
    });

    const { GET } = await load();
    const res = await GET(makeReq());
    const doc = (await res.json()) as ObservationDoc;

    expect(doc.observation_count).toBe(2);
    const sthA = doc.observations.find(
      (o) => o.sthCanonical === "sth-a-canonical-bytes-aaaa",
    );
    expect(sthA).toBeDefined();
    expect(sthA?.cosignatures.length).toBe(2);
    expect(sthA?.cosignatures.map((c) => c.witnessId).sort()).toEqual([
      "EU Witness · Berlin",
      "JP Witness · Tokyo",
    ]);
    expect(typeof sthA?.sthHash).toBe("string");
    expect(sthA?.sthHash.length).toBe(64); // sha256 hex
  });

  it("respects ?limit param to cap response size", async () => {
    for (let i = 0; i < 5; i++) {
      recordCosignature(`sth-canonical-${i}`, {
        witnessId: `Witness ${i}`,
        signature: `v2=sig${i}`,
        submittedAt: new Date().toISOString(),
      });
    }
    const { GET } = await load();
    const res = await GET(makeReq("?limit=3"));
    const doc = (await res.json()) as ObservationDoc;
    expect(doc.limit).toBe(3);
    expect(doc.observation_count).toBe(3);
    expect(doc.observations.length).toBe(3);
  });

  it("clamps ?limit to MAX_LIMIT (1000)", async () => {
    const { GET } = await load();
    const res = await GET(makeReq("?limit=99999"));
    const doc = (await res.json()) as ObservationDoc;
    expect(doc.limit).toBe(1000);
  });

  it("ignores non-numeric ?limit and uses default", async () => {
    const { GET } = await load();
    const res = await GET(makeReq("?limit=banana"));
    const doc = (await res.json()) as ObservationDoc;
    expect(doc.limit).toBe(200);
  });

  it("ignores negative ?limit and uses default", async () => {
    const { GET } = await load();
    const res = await GET(makeReq("?limit=-5"));
    const doc = (await res.json()) as ObservationDoc;
    expect(doc.limit).toBe(200);
  });
});
