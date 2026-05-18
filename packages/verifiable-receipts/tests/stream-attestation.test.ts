/**
 * Receipt Streaming Attestation tests.
 *
 * Proves:
 *   - Builder rejects out-of-order chunks
 *   - Builder rejects finalize on empty stream
 *   - Finalize produces stable merkleRoot + correct finalOutputHash
 *   - Inclusion proof verifies for every chunk against the signed root
 *   - Inclusion proof FAILS when chunk content is tampered
 *   - Canonicalize emits lexicographically-sorted JSON
 *   - verifyFinalOutputHash catches a tampered envelope
 */
import { describe, it, expect } from "vitest";
import { createHash } from "node:crypto";
import {
  StreamAttestationBuilder,
  canonicalizeStreamAttestation,
  verifyChunkInclusion,
  verifyFinalOutputHash,
  type StreamAttestation,
} from "../src/stream-attestation.js";

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

describe("StreamAttestationBuilder — basic invariants", () => {
  it("constructs with a non-empty streamId", () => {
    const b = new StreamAttestationBuilder("stream_001");
    expect(b.id()).toBe("stream_001");
    expect(b.size()).toBe(0);
  });

  it("throws on empty streamId", () => {
    expect(() => new StreamAttestationBuilder("")).toThrow(/streamId/);
  });

  it("throws when finalize is called on an empty stream", () => {
    const b = new StreamAttestationBuilder("stream_002");
    expect(() => b.finalize()).toThrow(/empty/);
  });

  it("throws on out-of-order chunk indices", () => {
    const b = new StreamAttestationBuilder("stream_003");
    b.append({ index: 0, content: "first" });
    expect(() => b.append({ index: 2, content: "skipped" })).toThrow(
      /out-of-order/,
    );
  });

  it("size() increments on each append", () => {
    const b = new StreamAttestationBuilder("stream_004");
    b.append({ index: 0, content: "a" });
    expect(b.size()).toBe(1);
    b.append({ index: 1, content: "b" });
    expect(b.size()).toBe(2);
  });
});

describe("finalize() — envelope shape", () => {
  it("emits scheme rsa1 + concatenated final output", () => {
    const b = new StreamAttestationBuilder("stream_finalize");
    b.append({ index: 0, content: "Hello, " });
    b.append({ index: 1, content: "world!" });
    const att = b.finalize("2026-05-18T15:00:00Z");
    expect(att.scheme).toBe("rsa1");
    expect(att.streamId).toBe("stream_finalize");
    expect(att.totalChunks).toBe(2);
    expect(att.finalOutput).toBe("Hello, world!");
    expect(att.finalOutputHash).toBe(sha256Hex("Hello, world!"));
    expect(att.merkleRoot.length).toBe(64);
    expect(att.finishedAt).toBe("2026-05-18T15:00:00Z");
  });

  it("merkleRoot is deterministic for the same chunk sequence", () => {
    const a = new StreamAttestationBuilder("stream_det");
    const b = new StreamAttestationBuilder("stream_det");
    for (const c of ["x", "y", "z"]) {
      a.append({ index: a.size(), content: c });
      b.append({ index: b.size(), content: c });
    }
    expect(a.finalize().merkleRoot).toBe(b.finalize().merkleRoot);
  });

  it("merkleRoot differs when chunk order differs", () => {
    const a = new StreamAttestationBuilder("stream_order_a");
    a.append({ index: 0, content: "x" });
    a.append({ index: 1, content: "y" });
    const b = new StreamAttestationBuilder("stream_order_b");
    b.append({ index: 0, content: "y" });
    b.append({ index: 1, content: "x" });
    expect(a.finalize().merkleRoot).not.toBe(b.finalize().merkleRoot);
  });
});

describe("Inclusion proof — RFC 9162 verifier composability", () => {
  function buildStream(chunks: string[]) {
    const b = new StreamAttestationBuilder("stream_proof");
    chunks.forEach((c, i) => b.append({ index: i, content: c }));
    return b;
  }

  it("verifies inclusion for every chunk in a 4-chunk stream", () => {
    const chunks = ["alpha", "beta", "gamma", "delta"];
    const b = buildStream(chunks);
    const att = b.finalize();
    for (let i = 0; i < chunks.length; i++) {
      const proof = b.buildInclusionProof(i);
      expect(
        verifyChunkInclusion(
          att,
          { index: i, content: chunks[i] },
          proof.auditPath,
        ),
      ).toBe(true);
    }
  });

  it("verifies inclusion for a single-chunk stream (empty proof)", () => {
    const b = buildStream(["only-one"]);
    const att = b.finalize();
    const proof = b.buildInclusionProof(0);
    expect(proof.auditPath.length).toBe(0);
    expect(
      verifyChunkInclusion(att, { index: 0, content: "only-one" }, []),
    ).toBe(true);
  });

  it("rejects inclusion when chunk content is tampered", () => {
    const chunks = ["alpha", "beta", "gamma"];
    const b = buildStream(chunks);
    const att = b.finalize();
    const proof = b.buildInclusionProof(1);
    expect(
      verifyChunkInclusion(
        att,
        { index: 1, content: "TAMPERED" },
        proof.auditPath,
      ),
    ).toBe(false);
  });

  it("rejects inclusion when chunk index is wrong", () => {
    const chunks = ["alpha", "beta", "gamma"];
    const b = buildStream(chunks);
    const att = b.finalize();
    const proof = b.buildInclusionProof(1);
    expect(
      verifyChunkInclusion(
        att,
        { index: 2, content: "beta" }, // chunk 1's content claimed at index 2
        proof.auditPath,
      ),
    ).toBe(false);
  });

  it("buildInclusionProof throws on out-of-range index", () => {
    const b = buildStream(["a", "b"]);
    expect(() => b.buildInclusionProof(5)).toThrow(/out of range/);
    expect(() => b.buildInclusionProof(-1)).toThrow(/out of range/);
  });
});

describe("canonicalizeStreamAttestation — wire stability", () => {
  function fixture(): StreamAttestation {
    return {
      scheme: "rsa1",
      streamId: "stream_canon",
      totalChunks: 3,
      merkleRoot: "abc123",
      finalOutput: "xyz",
      finalOutputHash: "def456",
      finishedAt: "2026-05-18T15:00:00Z",
    };
  }

  it("emits keys in lexicographic order", () => {
    const canonical = canonicalizeStreamAttestation(fixture());
    // Cheap parse check — keys appear in alpha order in the string.
    const expectedOrder = [
      "finalOutput",
      "finalOutputHash",
      "finishedAt",
      "merkleRoot",
      "scheme",
      "streamId",
      "totalChunks",
    ];
    let last = -1;
    for (const k of expectedOrder) {
      const at = canonical.indexOf(`"${k}":`);
      expect(at).toBeGreaterThan(last);
      last = at;
    }
  });

  it("two semantically equal attestations canonicalize to byte-identical strings", () => {
    const a = canonicalizeStreamAttestation(fixture());
    const b = canonicalizeStreamAttestation(fixture());
    expect(a).toBe(b);
  });

  it("changing one byte changes the canonical output", () => {
    const att = fixture();
    const tampered = { ...att, finalOutput: "xyZ" };
    expect(canonicalizeStreamAttestation(att)).not.toBe(
      canonicalizeStreamAttestation(tampered),
    );
  });
});

describe("verifyFinalOutputHash — defense against tampered envelopes", () => {
  it("returns true for a consistent attestation", () => {
    const b = new StreamAttestationBuilder("stream_consistent");
    b.append({ index: 0, content: "consistent" });
    const att = b.finalize();
    expect(verifyFinalOutputHash(att)).toBe(true);
  });

  it("returns false when finalOutputHash diverges from finalOutput", () => {
    const b = new StreamAttestationBuilder("stream_drift");
    b.append({ index: 0, content: "original" });
    const att = b.finalize();
    const tampered = { ...att, finalOutput: "swapped" };
    expect(verifyFinalOutputHash(tampered)).toBe(false);
  });
});
