/**
 * Tests for src/lib/timestamp-authority.ts — Cook 105.
 */

import { describe, it, expect, vi } from "vitest";
import {
  notarize,
  verifyAll,
  quorumOk,
  type TsaClient,
} from "../timestamp-authority";

const HASH = "a".repeat(64);

function okClient(name: string): TsaClient {
  return {
    name,
    submit: vi.fn(async (h: string) => `proof-${name}-${h.slice(0, 8)}`),
    verify: vi.fn(
      async (h: string, p: string) =>
        p.startsWith(`proof-${name}-`) && p.endsWith(h.slice(0, 8)),
    ),
  };
}

function failingClient(name: string): TsaClient {
  return {
    name,
    submit: vi.fn(async () => {
      throw new Error(`${name} unavailable`);
    }),
    verify: vi.fn(async () => false),
  };
}

describe("notarize", () => {
  it("rejects malformed receipt hash", async () => {
    await expect(notarize("not-hex", [])).rejects.toThrow();
  });

  it("returns ok=false when no clients", async () => {
    const r = await notarize(HASH, []);
    expect(r.ok).toBe(false);
    expect(r.proofs).toEqual([]);
  });

  it("fan-outs in parallel and aggregates proofs", async () => {
    const r = await notarize(HASH, [
      okClient("opentimestamps"),
      okClient("algorand"),
    ]);
    expect(r.ok).toBe(true);
    expect(r.proofs.length).toBe(2);
    expect(r.failures).toEqual([]);
  });

  it("partial-fails gracefully — surviving TSAs still produce proofs", async () => {
    const r = await notarize(HASH, [okClient("ots"), failingClient("sia")]);
    expect(r.ok).toBe(true);
    expect(r.proofs.length).toBe(1);
    expect(r.failures.length).toBe(1);
    expect(r.failures[0].authority).toBe("sia");
  });

  it("returns ok=false when every TSA fails", async () => {
    const r = await notarize(HASH, [failingClient("a"), failingClient("b")]);
    expect(r.ok).toBe(false);
    expect(r.proofs).toEqual([]);
  });
});

describe("verifyAll", () => {
  it("re-runs each TSA's verifier against the recorded proof", async () => {
    const clients = [okClient("ots"), okClient("algorand")];
    const n = await notarize(HASH, clients);
    const v = await verifyAll(HASH, n.proofs, clients);
    expect(v.length).toBe(2);
    expect(v.every((r) => r.valid)).toBe(true);
  });

  it("flags unknown-authority proofs", async () => {
    const v = await verifyAll(
      HASH,
      [{ authority: "ghost", proof: "x", notarizedAt: 0 }],
      [okClient("ots")],
    );
    expect(v[0].valid).toBe(false);
    expect(v[0].message).toContain("Unknown authority");
  });
});

describe("quorumOk", () => {
  it("returns true when ≥ required verifications are valid", () => {
    const v = [
      { authority: "a", valid: true },
      { authority: "b", valid: true },
      { authority: "c", valid: false },
    ];
    expect(quorumOk(v, 2)).toBe(true);
    expect(quorumOk(v, 3)).toBe(false);
  });

  it("returns true when required is 0", () => {
    expect(quorumOk([], 0)).toBe(true);
  });
});
