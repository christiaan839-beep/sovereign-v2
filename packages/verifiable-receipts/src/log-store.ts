/**
 * Append-only log store for the AI Receipt Transparency Log.
 *
 * A `LogStore` is a sequence of leaf hashes that supports only
 * `append` and `read`. Combined with the Merkle primitives in
 * `transparency.ts`, this is the v0.2 reference server for the
 * ART-Log design (see `docs/specs/transparency-log.md`).
 *
 * Two implementations ship:
 *
 *   - InMemoryLogStore — pure-RAM array. For tests + ephemeral demos.
 *   - FileLogStore — append-only file. Each line is exactly 65 chars:
 *     64 lowercase hex + a `\n`. Crash-safe via O_APPEND + fsync on
 *     every append; recoverable by line-count without a separate
 *     index file.
 *
 * The `TransparencyLog` class wraps a store and exposes the proof
 * APIs an HTTP server / CLI tool will surface. Signing the STH is the
 * caller's responsibility — the Log returns unsigned envelopes so the
 * deployment can choose Ed25519 (v2) or Ed25519 + ML-DSA-65 (v3) at
 * its discretion.
 *
 * Pure module — only `node:fs` for FileLogStore. No platform
 * coupling, no HTTP, no database.
 */

import {
  appendFileSync,
  readFileSync,
  existsSync,
  openSync,
  fsyncSync,
  closeSync,
  writeSync,
} from "node:fs";
import {
  treeRoot,
  inclusionProof,
  consistencyProof,
  buildSth,
  leafHash,
  type SignedTreeHead,
} from "./transparency.js";

// ── Storage interface ─────────────────────────────────────────────────

/**
 * Append-only sequence of leaf hashes. The store NEVER deletes or
 * mutates a leaf — that's the foundational guarantee of the log.
 */
export interface LogStore {
  /** Append a leaf hash (lowercase hex). Returns the new leaf's index. */
  append(leafHashHex: string): number;
  /** Current number of leaves. */
  count(): number;
  /** Get a leaf hash by index. Throws if idx is out of range. */
  get(idx: number): string;
  /** Read-only view of all leaves (for proof generation). */
  snapshot(): readonly string[];
}

/** In-memory implementation. Resets on process exit. */
export class InMemoryLogStore implements LogStore {
  private leaves: string[] = [];

  append(leafHashHex: string): number {
    if (!/^[0-9a-f]{64}$/.test(leafHashHex)) {
      throw new Error("leafHashHex must be 64 lowercase hex characters");
    }
    this.leaves.push(leafHashHex);
    return this.leaves.length - 1;
  }

  count(): number {
    return this.leaves.length;
  }

  get(idx: number): string {
    if (idx < 0 || idx >= this.leaves.length) {
      throw new Error(
        `leaf idx ${idx} out of range (count=${this.leaves.length})`,
      );
    }
    return this.leaves[idx];
  }

  snapshot(): readonly string[] {
    return this.leaves.slice();
  }
}

/**
 * Append-only file-backed store. Each line is `<64-hex-chars>\n` so:
 *
 *   - Append is a single O_APPEND write followed by fsync — atomic under
 *     POSIX even across crashes.
 *   - Recovery is trivial: line count = leaf count.
 *   - Snapshot reads the whole file once at construction and keeps an
 *     in-memory mirror. For typical regulated workloads (≤ millions
 *     of leaves) this fits comfortably in memory; if it doesn't, swap
 *     in a different LogStore impl backed by a real DB.
 */
export class FileLogStore implements LogStore {
  private leaves: string[];
  private filePath: string;

  constructor(filePath: string) {
    this.filePath = filePath;
    if (existsSync(filePath)) {
      const raw = readFileSync(filePath, "utf8");
      this.leaves =
        raw === "" ? [] : raw.split("\n").filter((s) => s.length > 0);
      // Defensive: every line must be a 64-hex leaf hash. A corrupted
      // line aborts construction; the operator MUST inspect manually
      // rather than silently truncate.
      for (const [i, line] of this.leaves.entries()) {
        if (!/^[0-9a-f]{64}$/.test(line)) {
          throw new Error(
            `FileLogStore: line ${i + 1} of ${filePath} is not a valid leaf hash`,
          );
        }
      }
    } else {
      this.leaves = [];
    }
  }

  append(leafHashHex: string): number {
    if (!/^[0-9a-f]{64}$/.test(leafHashHex)) {
      throw new Error("leafHashHex must be 64 lowercase hex characters");
    }
    // O_APPEND + fsync — POSIX guarantees the write is atomic and durable
    // before the call returns. The line below uses Node's appendFileSync
    // (O_APPEND) then opens for fsync separately because Node's API
    // doesn't expose fsync on the appendFileSync code path.
    appendFileSync(this.filePath, leafHashHex + "\n", { mode: 0o600 });
    const fd = openSync(this.filePath, "r+");
    try {
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
    this.leaves.push(leafHashHex);
    return this.leaves.length - 1;
  }

  count(): number {
    return this.leaves.length;
  }

  get(idx: number): string {
    if (idx < 0 || idx >= this.leaves.length) {
      throw new Error(
        `leaf idx ${idx} out of range (count=${this.leaves.length})`,
      );
    }
    return this.leaves[idx];
  }

  snapshot(): readonly string[] {
    return this.leaves.slice();
  }
}

// ── TransparencyLog ───────────────────────────────────────────────────

export interface AppendResult {
  /** Zero-based index of the newly appended leaf. */
  index: number;
  /** SHA-256 leaf hash that was actually stored (= the input). */
  leafHashHex: string;
  /** Unsigned STH committing to the tree state after the append. */
  sth: SignedTreeHead;
}

/**
 * Thin coordinator over a `LogStore`. Computes Merkle roots, builds
 * proofs, and produces unsigned STHs. The caller is responsible for
 * signing each STH with their preferred primitive (Ed25519 in v2,
 * dual Ed25519 + ML-DSA-65 in v3).
 */
export class TransparencyLog {
  readonly logId: string;
  private readonly store: LogStore;
  private readonly clock: () => Date;

  constructor(
    logId: string,
    store: LogStore = new InMemoryLogStore(),
    clock: () => Date = () => new Date(),
  ) {
    if (!logId || typeof logId !== "string") {
      throw new Error("logId is required");
    }
    this.logId = logId;
    this.store = store;
    this.clock = clock;
  }

  /**
   * Append a leaf to the log and return the post-append STH.
   * Accepts either a raw 64-hex leaf hash or arbitrary leaf bytes
   * (will be RFC 6962 leaf-hashed automatically).
   */
  append(
    input: string | Buffer,
    opts: { alreadyHashed?: boolean } = {},
  ): AppendResult {
    let leafHashHex: string;
    if (opts.alreadyHashed) {
      if (typeof input !== "string") {
        throw new Error("alreadyHashed=true requires a string leaf hash");
      }
      leafHashHex = input;
    } else {
      leafHashHex = leafHash(input);
    }
    const index = this.store.append(leafHashHex);
    const sth = buildSth(this.logId, this.store.snapshot(), this.clock);
    return { index, leafHashHex, sth };
  }

  /** Current STH (unsigned). */
  currentSth(): SignedTreeHead {
    return buildSth(this.logId, this.store.snapshot(), this.clock);
  }

  /** Current tree size. */
  size(): number {
    return this.store.count();
  }

  /** Current Merkle root (hex). */
  rootHash(): string {
    return treeRoot(this.store.snapshot());
  }

  /** Get the leaf hash at idx. */
  leafAt(idx: number): string {
    return this.store.get(idx);
  }

  /**
   * Inclusion proof for the leaf at `idx` against the tree of size
   * `treeSize`. Defaults to the current tree size. Throws if
   * `treeSize` exceeds the current count (can't prove against a
   * future state).
   */
  proveInclusion(idx: number, treeSize?: number): string[] {
    const n = treeSize ?? this.store.count();
    if (n > this.store.count()) {
      throw new Error(
        `treeSize ${n} exceeds current count ${this.store.count()}`,
      );
    }
    if (idx >= n) {
      throw new Error(`idx ${idx} out of range for treeSize ${n}`);
    }
    return inclusionProof(idx, this.store.snapshot().slice(0, n));
  }

  /**
   * Consistency proof from `oldSize` to `newSize`. Defaults `newSize`
   * to the current count. Throws if either size is out of range —
   * better to fail loud than silently produce an unverifiable proof.
   */
  proveConsistency(oldSize: number, newSize?: number): string[] {
    const n = newSize ?? this.store.count();
    if (n > this.store.count()) {
      throw new Error(
        `newSize ${n} exceeds current count ${this.store.count()}`,
      );
    }
    if (oldSize < 0 || oldSize > n) {
      throw new Error(`oldSize ${oldSize} out of range for newSize ${n}`);
    }
    return consistencyProof(oldSize, this.store.snapshot().slice(0, n));
  }
}

// Silence unused-import lint when only the type is referenced.
void writeSync;
