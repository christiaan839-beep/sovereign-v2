/**
 * Receipt Streaming Attestation — Merkle-rooted commitment over the
 * full chunk sequence of an LLM stream.
 *
 * Most agent platforms today sign only the FINAL output. That misses
 * the tampering surface that matters most: an attacker (or buggy
 * proxy, or malicious middlebox) can inject, drop, or modify tokens
 * mid-stream and the final-output signature still verifies because
 * it commits only to the concatenated bytes the issuer saw last.
 *
 * Streaming Attestation fixes this by:
 *
 *   1. Hashing every chunk as the stream emits it.
 *   2. Building an RFC 9162-style Merkle tree over the chunk hashes.
 *   3. Signing the Merkle root + total chunk count + concatenated
 *      output in the final attestation.
 *
 * The auditor can then:
 *   - Prove chunk N at position k was part of the original stream
 *     (inclusion proof against the signed Merkle root).
 *   - Prove the stream has exactly N chunks (the count is signed).
 *   - Prove the concatenated final output matches the chunk sequence
 *     (each chunk's content is committed separately).
 *
 * Wire format: a JSON envelope that the issuer signs with their
 * existing Ed25519 (v2) or dual (v3) key.
 *
 *   {
 *     scheme: "rsa1",
 *     streamId: "stream_01H...",
 *     totalChunks: 42,
 *     merkleRoot: "abc...",        // hex sha256
 *     finalOutput: "...",          // concatenated chunks
 *     finalOutputHash: "def...",   // sha256(finalOutput)
 *     finishedAt: "2026-05-18T..."
 *   }
 *
 * Inclusion proof reuses the existing RFC 9162 verifier from
 * ./transparency — same primitive, different tree.
 *
 * @packageDocumentation
 */

import { createHash } from "node:crypto";
import {
  leafHash as transparencyLeafHash,
  treeRoot as transparencyTreeRoot,
  inclusionProof as transparencyInclusionProof,
  verifyInclusionProof as transparencyVerifyInclusionProof,
} from "./transparency.js";

/**
 * One emitted chunk. `index` MUST be a 0-based, monotonically
 * increasing integer matching the position in the stream.
 */
export interface StreamChunk {
  index: number;
  content: string;
}

/**
 * The signed envelope for a finished stream. Issuers serialize this
 * with `canonicalizeStreamAttestation()` + sign as VAOS 2.0/3.0 — no
 * new wire path.
 */
export interface StreamAttestation {
  scheme: "rsa1";
  /** Stable id for the stream — typically `runId + ":" + agentSlug`. */
  streamId: string;
  /** Number of chunks emitted. */
  totalChunks: number;
  /** Hex-encoded sha256 of the Merkle tree root over chunk leaf-hashes. */
  merkleRoot: string;
  /** Concatenated chunk content. */
  finalOutput: string;
  /** sha256(finalOutput), hex. */
  finalOutputHash: string;
  /** ISO-8601 of the last emitted chunk. */
  finishedAt: string;
}

/**
 * Stateful builder for an in-flight stream. Append chunks as they
 * arrive; call `finalize()` when the stream ends to mint the
 * envelope.
 *
 * Chunks MUST arrive in strict index order (0, 1, 2, ...). Out-of-
 * order chunks throw — streams are linear by definition.
 */
export class StreamAttestationBuilder {
  private readonly streamId: string;
  private nextIndex = 0;
  private readonly leafHexes: string[] = [];
  private readonly buffer: string[] = [];

  constructor(streamId: string) {
    if (!streamId) throw new Error("stream-attestation: streamId required");
    this.streamId = streamId;
  }

  /**
   * Add the next chunk. Throws if `chunk.index !== nextExpectedIndex`.
   * The chunk's content is hashed with RFC 9162 leaf-hash domain
   * separation (0x00 || data) so the resulting tree composes with the
   * platform's existing transparency-log primitives.
   */
  append(chunk: StreamChunk): void {
    if (chunk.index !== this.nextIndex) {
      throw new Error(
        `stream-attestation: out-of-order chunk (expected ${this.nextIndex}, got ${chunk.index})`,
      );
    }
    this.nextIndex += 1;
    this.buffer.push(chunk.content);
    this.leafHexes.push(transparencyLeafHash(chunk.content));
  }

  /** Number of chunks appended so far. */
  size(): number {
    return this.leafHexes.length;
  }

  /** Stream id this builder was initialized with. */
  id(): string {
    return this.streamId;
  }

  /**
   * Finalize the stream and emit the unsigned envelope. The issuer
   * then signs `canonicalizeStreamAttestation(envelope)` with their
   * existing Ed25519 key and ships the (envelope, signature) pair.
   *
   * Throws when called on an empty stream — a streaming attestation
   * with zero chunks has no commitment surface.
   */
  finalize(finishedAt?: string): StreamAttestation {
    if (this.leafHexes.length === 0) {
      throw new Error(
        "stream-attestation: cannot finalize an empty stream (append at least one chunk first)",
      );
    }
    const finalOutput = this.buffer.join("");
    return {
      scheme: "rsa1",
      streamId: this.streamId,
      totalChunks: this.leafHexes.length,
      merkleRoot: transparencyTreeRoot(this.leafHexes),
      finalOutput,
      finalOutputHash: createHash("sha256")
        .update(finalOutput, "utf8")
        .digest("hex"),
      finishedAt: finishedAt ?? new Date().toISOString(),
    };
  }

  /**
   * Build an inclusion proof for the chunk at `index`. Useful when an
   * auditor wants to prove "chunk #47 had this exact content" without
   * shipping every other chunk in the stream.
   */
  buildInclusionProof(index: number): {
    leafIndex: number;
    treeSize: number;
    auditPath: string[];
    leafHashHex: string;
  } {
    if (index < 0 || index >= this.leafHexes.length) {
      throw new Error(
        `stream-attestation: index ${index} out of range [0, ${this.leafHexes.length})`,
      );
    }
    return {
      leafIndex: index,
      treeSize: this.leafHexes.length,
      auditPath: transparencyInclusionProof(index, this.leafHexes),
      leafHashHex: this.leafHexes[index],
    };
  }
}

/**
 * Stable canonical projection of a StreamAttestation. The issuer signs
 * the UTF-8 bytes of this string with their existing Ed25519 key.
 *
 * Field order is fixed lexicographically (alphabetical). v2 (when
 * shipped) MUST switch to full RFC 8785; v1 carries no nested objects
 * so simple sort suffices.
 */
export function canonicalizeStreamAttestation(
  attestation: StreamAttestation,
): string {
  return JSON.stringify({
    finalOutput: attestation.finalOutput,
    finalOutputHash: attestation.finalOutputHash,
    finishedAt: attestation.finishedAt,
    merkleRoot: attestation.merkleRoot,
    scheme: attestation.scheme,
    streamId: attestation.streamId,
    totalChunks: attestation.totalChunks,
  });
}

/**
 * Options for chunk-inclusion verification.
 */
export interface ChunkInclusionOptions {
  /**
   * Required: a callback that verifies the attestation envelope's
   * Ed25519/ML-DSA signature against the issuer's public key. Returns
   * true iff the envelope is authentic. Without this, the verifier
   * would accept any (envelope, audit_path, chunk) triple — including
   * envelopes the issuer never signed.
   *
   * Caller typically passes a closure that wraps `verifyDualSig()`
   * from ./pq-sign with the issuer's pubkey pre-bound.
   *
   * The signature precondition is mandatory in v0.2+. v0.1 callers
   * that explicitly want the old behavior can pass `() => true`
   * after acknowledging the risk in their threat model.
   */
  verifyEnvelopeSignature: (attestation: StreamAttestation) => boolean;
}

/**
 * Verify that a chunk with the given content was actually part of the
 * signed stream at the given index.
 *
 * Returns true iff ALL of:
 *   - opts.verifyEnvelopeSignature(attestation) returns true
 *   - sha256(0x00 || chunkContent) reconstructs the leaf hash
 *   - the inclusion proof verifies against attestation.merkleRoot
 *
 * Without the envelope-signature precondition the merkleRoot in the
 * envelope is just an attacker's claim — anyone who knows the chunk
 * content can forge an "inclusion proof" against an unsigned
 * envelope. v0.2+ enforces the precondition at the verifier API
 * boundary rather than relying on caller discipline.
 */
export function verifyChunkInclusion(
  attestation: StreamAttestation,
  chunk: { index: number; content: string },
  auditPath: readonly string[],
  opts: ChunkInclusionOptions,
): boolean {
  // Signature precondition first — never trust the envelope's
  // merkleRoot until we've confirmed the envelope itself is signed
  // by the issuer.
  if (!opts.verifyEnvelopeSignature(attestation)) return false;

  const leaf = transparencyLeafHash(chunk.content);
  return transparencyVerifyInclusionProof(
    leaf,
    chunk.index,
    attestation.totalChunks,
    auditPath,
    attestation.merkleRoot,
  );
}

/**
 * Cross-check the envelope's finalOutputHash against a re-derived
 * sha256 of the concatenated finalOutput. Catches a tampered
 * envelope where the hash and the output diverge.
 */
export function verifyFinalOutputHash(attestation: StreamAttestation): boolean {
  const actual = createHash("sha256")
    .update(attestation.finalOutput, "utf8")
    .digest("hex");
  return actual === attestation.finalOutputHash;
}
