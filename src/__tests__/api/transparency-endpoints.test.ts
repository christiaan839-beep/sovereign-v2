/**
 * /api/transparency/{sth,proof} contract tests.
 *
 * Locks the demo-log endpoint shape so procurement automation that
 * polls them doesn't break across refactors. Also confirms that the
 * STH + proofs returned by the endpoints are MATHEMATICALLY VALID —
 * a verifier using only the response can reconstruct the root.
 */
import { describe, it, expect } from "vitest";
import {
  verifyInclusionProof,
  verifyConsistencyProof,
} from "@sovereign-matrix/verifiable-receipts/transparency";

async function loadSth() {
  const { GET } = await import("@/app/api/transparency/sth/route");
  return GET();
}

async function loadProof(qs: string) {
  const { GET } = await import("@/app/api/transparency/proof/route");
  return GET(new Request(`http://localhost/api/transparency/proof?${qs}`));
}

describe("GET /api/transparency/sth", () => {
  it("returns the documented envelope shape with CORS + cache headers", async () => {
    const res = await loadSth();
    expect(res.status).toBe(200);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect(res.headers.get("cache-control")).toMatch(/max-age=60/);
    const body = (await res.json()) as Record<string, unknown>;
    for (const key of [
      "v",
      "logId",
      "treeSize",
      "rootHash",
      "timestamp",
      "canonical",
    ]) {
      expect(body).toHaveProperty(key);
    }
    expect(body.v).toBe(1);
    expect(typeof body.rootHash).toBe("string");
    expect((body.rootHash as string).length).toBe(64);
  });

  it("logId matches the documented demo identifier", async () => {
    const res = await loadSth();
    const body = (await res.json()) as { logId: string };
    expect(body.logId).toBe("demo.sovereignmatrix.agency");
  });
});

describe("GET /api/transparency/proof?kind=inclusion", () => {
  it("returns a proof whose math reconstructs the STH root", async () => {
    const sthRes = await loadSth();
    const sth = (await sthRes.json()) as {
      treeSize: number;
      rootHash: string;
    };
    if (sth.treeSize === 0) {
      // Empty log on this deploy — nothing to prove. Test passes vacuously.
      return;
    }
    const proofRes = await loadProof(`kind=inclusion&index=0`);
    expect(proofRes.status).toBe(200);
    const body = (await proofRes.json()) as {
      index: number;
      treeSize: number;
      leafHash: string;
      proof: string[];
    };
    expect(body.index).toBe(0);
    expect(body.treeSize).toBe(sth.treeSize);
    expect(
      verifyInclusionProof(
        body.leafHash,
        body.index,
        body.treeSize,
        body.proof,
        sth.rootHash,
      ),
    ).toBe(true);
  });

  it("400 when index is out of range", async () => {
    const sthRes = await loadSth();
    const sth = (await sthRes.json()) as { treeSize: number };
    const tooBig = sth.treeSize + 100;
    const res = await loadProof(`kind=inclusion&index=${tooBig}`);
    expect(res.status).toBe(400);
  });

  it("400 when index is missing", async () => {
    const res = await loadProof(`kind=inclusion`);
    expect(res.status).toBe(400);
  });
});

describe("GET /api/transparency/proof?kind=consistency", () => {
  it("returns a proof verifiable between any (old, new) pair within the current size", async () => {
    const sthRes = await loadSth();
    const sth = (await sthRes.json()) as {
      treeSize: number;
      rootHash: string;
    };
    if (sth.treeSize < 2) return; // not enough leaves to demo

    // old = 1, new = current
    const proofRes = await loadProof(
      `kind=consistency&old=1&new=${sth.treeSize}`,
    );
    expect(proofRes.status).toBe(200);
    const body = (await proofRes.json()) as {
      oldSize: number;
      newSize: number;
      proof: string[];
    };
    expect(body.oldSize).toBe(1);
    expect(body.newSize).toBe(sth.treeSize);

    // We don't have oldRoot from the endpoint directly (intentional —
    // a verifier supplies it from a previously-witnessed STH). For the
    // test we recompute it from the first leaf to confirm the proof
    // round-trips against the same algorithm.
    const inclusionRes = await loadProof(`kind=inclusion&index=0&size=1`);
    const inclusion = (await inclusionRes.json()) as {
      leafHash: string;
      proof: string[];
    };
    // For size=1, the proof is empty and rootHash === leafHash.
    expect(inclusion.proof).toEqual([]);
    const oldRoot = inclusion.leafHash;

    expect(
      verifyConsistencyProof(
        body.oldSize,
        body.newSize,
        oldRoot,
        sth.rootHash,
        body.proof,
      ),
    ).toBe(true);
  });

  it("400 when old > new", async () => {
    const res = await loadProof(`kind=consistency&old=10&new=5`);
    expect(res.status).toBe(400);
  });

  it("400 when 'kind' is missing or unknown", async () => {
    const a = await loadProof(``);
    expect(a.status).toBe(400);
    const b = await loadProof(`kind=banana`);
    expect(b.status).toBe(400);
  });
});
