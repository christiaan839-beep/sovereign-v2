/**
 * TransparencyLog + LogStore tests.
 *
 * Covers the v0.2 reference server's invariants:
 *   - InMemory + File stores are append-only and behave identically
 *   - FileLogStore is crash-recoverable: a fresh instance pointing at
 *     an existing file rehydrates the leaf count and contents
 *   - FileLogStore rejects a corrupted file at construction
 *   - TransparencyLog produces STHs that match the underlying tree
 *     root and size
 *   - inclusion + consistency proofs returned by the Log verify
 *     against the same STH the Log emitted (round-trip)
 *   - proveInclusion / proveConsistency reject out-of-range arguments
 *   - the alreadyHashed flag bypasses leaf-hashing
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  TransparencyLog,
  InMemoryLogStore,
  FileLogStore,
} from "../src/log-store.js";
import {
  leafHash,
  verifyInclusionProof,
  verifyConsistencyProof,
  treeRoot,
} from "../src/transparency.js";

function sha256Hex(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}

describe("InMemoryLogStore", () => {
  it("starts empty and grows by one on append", () => {
    const s = new InMemoryLogStore();
    expect(s.count()).toBe(0);
    const idx = s.append(leafHash("a"));
    expect(idx).toBe(0);
    expect(s.count()).toBe(1);
  });

  it("returns leaves in insertion order via get() + snapshot()", () => {
    const s = new InMemoryLogStore();
    const h1 = leafHash("a");
    const h2 = leafHash("b");
    s.append(h1);
    s.append(h2);
    expect(s.get(0)).toBe(h1);
    expect(s.get(1)).toBe(h2);
    expect(s.snapshot()).toEqual([h1, h2]);
  });

  it("throws when get() is out of range", () => {
    const s = new InMemoryLogStore();
    s.append(leafHash("a"));
    expect(() => s.get(5)).toThrow();
  });

  it("rejects a non-hex leaf input", () => {
    const s = new InMemoryLogStore();
    expect(() => s.append("not-a-hex-hash")).toThrow();
  });

  it("snapshot() returns a defensive copy (mutating it does not affect the store)", () => {
    const s = new InMemoryLogStore();
    s.append(leafHash("a"));
    const snap = s.snapshot() as string[];
    snap.push("attacker-injected");
    expect(s.count()).toBe(1);
  });
});

describe("FileLogStore", () => {
  let tmp: string;
  let path: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "vr-log-"));
    path = join(tmp, "log.txt");
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("creates a new file on first append + writes a 65-char line per leaf", () => {
    const s = new FileLogStore(path);
    const h = leafHash("leaf-0");
    s.append(h);
    const raw = readFileSync(path, "utf8");
    expect(raw).toBe(h + "\n");
    expect(raw.length).toBe(65);
  });

  it("recovers leaf state from an existing file at construction", () => {
    const s1 = new FileLogStore(path);
    s1.append(leafHash("a"));
    s1.append(leafHash("b"));
    s1.append(leafHash("c"));

    // Fresh instance — should read the file and rehydrate.
    const s2 = new FileLogStore(path);
    expect(s2.count()).toBe(3);
    expect(s2.get(2)).toBe(leafHash("c"));
  });

  it("rejects construction when the file contains a malformed line", () => {
    writeFileSync(path, "this-is-not-a-leaf-hash\n", { mode: 0o600 });
    expect(() => new FileLogStore(path)).toThrow(/not a valid leaf hash/);
  });

  it("handles an empty existing file gracefully (count=0)", () => {
    writeFileSync(path, "", { mode: 0o600 });
    const s = new FileLogStore(path);
    expect(s.count()).toBe(0);
  });
});

describe("TransparencyLog", () => {
  it("requires a non-empty logId", () => {
    expect(() => new TransparencyLog("")).toThrow();
  });

  it("appends a raw leaf, returning index + STH with the post-append root", () => {
    const fixedClock = () => new Date("2026-05-17T00:00:00.000Z");
    const log = new TransparencyLog(
      "test-log",
      new InMemoryLogStore(),
      fixedClock,
    );
    const r1 = log.append("first");
    expect(r1.index).toBe(0);
    expect(r1.leafHashHex).toBe(leafHash("first"));
    expect(r1.sth.treeSize).toBe(1);
    expect(r1.sth.rootHash).toBe(leafHash("first"));
    expect(r1.sth.logId).toBe("test-log");
    expect(r1.sth.timestamp).toBe("2026-05-17T00:00:00.000Z");
    expect(r1.sth.signature).toBeUndefined();
  });

  it("alreadyHashed=true bypasses leaf-hashing", () => {
    const log = new TransparencyLog("test-log");
    const preHashed = sha256Hex("anything"); // 64-hex, but not a valid leaf hash per RFC
    const r = log.append(preHashed, { alreadyHashed: true });
    expect(r.leafHashHex).toBe(preHashed);
  });

  it("alreadyHashed=true requires a string input", () => {
    const log = new TransparencyLog("test-log");
    expect(() =>
      log.append(Buffer.from("not-a-string"), { alreadyHashed: true }),
    ).toThrow();
  });

  it("currentSth() reflects the current size + root", () => {
    const log = new TransparencyLog("t");
    log.append("a");
    log.append("b");
    log.append("c");
    const sth = log.currentSth();
    expect(sth.treeSize).toBe(3);
    expect(sth.rootHash).toBe(
      treeRoot([leafHash("a"), leafHash("b"), leafHash("c")]),
    );
  });

  it("inclusion proof returned by the Log verifies against its own root", () => {
    const log = new TransparencyLog("t");
    for (let i = 0; i < 16; i++) log.append(`leaf-${i}`);
    const sth = log.currentSth();
    for (let i = 0; i < 16; i++) {
      const proof = log.proveInclusion(i);
      const leaf = log.leafAt(i);
      expect(
        verifyInclusionProof(leaf, i, sth.treeSize, proof, sth.rootHash),
      ).toBe(true);
    }
  });

  it("consistency proof returned by the Log verifies between two STHs", () => {
    const log = new TransparencyLog("t");
    for (let i = 0; i < 5; i++) log.append(`leaf-${i}`);
    const oldSth = log.currentSth();
    for (let i = 5; i < 12; i++) log.append(`leaf-${i}`);
    const newSth = log.currentSth();
    const proof = log.proveConsistency(oldSth.treeSize, newSth.treeSize);
    expect(
      verifyConsistencyProof(
        oldSth.treeSize,
        newSth.treeSize,
        oldSth.rootHash,
        newSth.rootHash,
        proof,
      ),
    ).toBe(true);
  });

  it("proveInclusion throws when treeSize exceeds current count", () => {
    const log = new TransparencyLog("t");
    log.append("a");
    expect(() => log.proveInclusion(0, 99)).toThrow(/exceeds current count/);
  });

  it("proveInclusion throws when idx is out of range for the requested treeSize", () => {
    const log = new TransparencyLog("t");
    log.append("a");
    log.append("b");
    expect(() => log.proveInclusion(5, 2)).toThrow();
  });

  it("proveConsistency throws when newSize exceeds current count", () => {
    const log = new TransparencyLog("t");
    log.append("a");
    expect(() => log.proveConsistency(0, 99)).toThrow(/exceeds current count/);
  });

  it("proveConsistency throws when oldSize > newSize", () => {
    const log = new TransparencyLog("t");
    for (let i = 0; i < 5; i++) log.append(`leaf-${i}`);
    expect(() => log.proveConsistency(10, 5)).toThrow(/out of range/);
  });
});

describe("TransparencyLog — file-backed persistence", () => {
  let tmp: string;
  let path: string;

  beforeEach(() => {
    tmp = mkdtempSync(join(tmpdir(), "vr-log-"));
    path = join(tmp, "log.txt");
  });

  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true });
  });

  it("survives a process restart: a fresh Log against the same file sees prior leaves", () => {
    {
      const log = new TransparencyLog("persistent", new FileLogStore(path));
      log.append("first");
      log.append("second");
      log.append("third");
    }
    // Simulated process restart: build a new Log over the same file.
    const log2 = new TransparencyLog("persistent", new FileLogStore(path));
    expect(log2.size()).toBe(3);
    expect(log2.leafAt(2)).toBe(leafHash("third"));
    const sth = log2.currentSth();
    expect(sth.rootHash).toBe(
      treeRoot([leafHash("first"), leafHash("second"), leafHash("third")]),
    );
  });

  it("a consistency proof spans a process restart", () => {
    // Establish 4 leaves, capture an STH, restart, append 6 more,
    // then prove the original 4 are still a prefix of the post-restart
    // 10. This is the canonical "the log didn't rewrite itself across
    // an outage" scenario.
    let oldRoot: string;
    {
      const log = new TransparencyLog("persistent", new FileLogStore(path));
      for (let i = 0; i < 4; i++) log.append(`pre-${i}`);
      oldRoot = log.currentSth().rootHash;
    }
    const log2 = new TransparencyLog("persistent", new FileLogStore(path));
    for (let i = 0; i < 6; i++) log2.append(`post-${i}`);
    const newSth = log2.currentSth();
    const proof = log2.proveConsistency(4, 10);
    expect(verifyConsistencyProof(4, 10, oldRoot, newSth.rootHash, proof)).toBe(
      true,
    );
  });
});
