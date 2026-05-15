/**
 * Tests for src/lib/receipt-schema.ts — Cook 123.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  _resetMigrations,
  CURRENT_SCHEMA_VERSION,
  fingerprint,
  migrateUp,
  registerMigration,
  validateVersion,
  type VersionedReceipt,
} from "../receipt-schema";

function receipt(
  version: number,
  body: Record<string, unknown>,
): VersionedReceipt {
  return {
    header: {
      id: "r-1",
      schemaVersion: version as 1 | 2 | 3 | 4,
      sealedAt: 1000,
    },
    body,
    signatures: { hmac: "abc" },
  };
}

beforeEach(() => {
  _resetMigrations();
});

describe("validateVersion", () => {
  it("accepts v1..CURRENT", () => {
    for (let v = 1; v <= CURRENT_SCHEMA_VERSION; v++) {
      expect(validateVersion(receipt(v, {})).valid).toBe(true);
    }
  });

  it("rejects v0 + v(CURRENT+1)", () => {
    expect(validateVersion(receipt(0, {})).valid).toBe(false);
    expect(validateVersion(receipt(CURRENT_SCHEMA_VERSION + 1, {})).valid).toBe(
      false,
    );
  });
});

describe("migrateUp", () => {
  it("returns the body unchanged when target=current version", () => {
    const r = receipt(2, { x: 1 });
    const out = migrateUp(r, 2);
    expect(out.body).toEqual({ x: 1 });
    expect(out.trail).toEqual([2]);
  });

  it("throws when target < receipt version", () => {
    expect(() => migrateUp(receipt(3, {}), 1)).toThrow();
  });

  it("applies registered migrations in order", () => {
    registerMigration<{ a: number }, { a: number; b: number }>(1, (b) => ({
      ...b,
      b: 2,
    }));
    registerMigration<
      { a: number; b: number },
      { a: number; b: number; c: number }
    >(2, (b) => ({ ...b, c: 3 }));
    const out = migrateUp(receipt(1, { a: 1 }), 3);
    expect(out.body).toEqual({ a: 1, b: 2, c: 3 });
    expect(out.trail).toEqual([1, 2, 3]);
  });

  it("throws when migration is missing for the chain", () => {
    registerMigration<{ a: number }, { a: number; b: number }>(1, (b) => ({
      ...b,
      b: 2,
    }));
    // 2→3 not registered.
    expect(() => migrateUp(receipt(1, { a: 1 }), 3)).toThrow();
  });
});

describe("registerMigration — validation", () => {
  it("rejects from < 1 or from >= CURRENT", () => {
    expect(() => registerMigration(0 as 1, (b) => b)).toThrow();
    expect(() => registerMigration(CURRENT_SCHEMA_VERSION, (b) => b)).toThrow();
  });
});

describe("fingerprint", () => {
  it("returns deterministic hash for same content + version", () => {
    expect(fingerprint(receipt(1, { x: 1 }))).toBe(
      fingerprint(receipt(1, { x: 1 })),
    );
  });

  it("differs when version differs (same body)", () => {
    expect(fingerprint(receipt(1, { x: 1 }))).not.toBe(
      fingerprint(receipt(2, { x: 1 })),
    );
  });

  it("differs when body differs (same version)", () => {
    expect(fingerprint(receipt(1, { x: 1 }))).not.toBe(
      fingerprint(receipt(1, { x: 2 })),
    );
  });
});
