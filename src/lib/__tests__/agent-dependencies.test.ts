/**
 * Tests for agent-dependencies — parse + no-DB resolution.
 *
 * DB-connected path is integration-tested against a seeded Neon branch.
 * Here we cover the parsing logic + graceful no-DB behavior.
 */

import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  detectCycles,
  parseDependsOn,
  resolveDependencies,
} from "../agent-dependencies";

describe("parseDependsOn()", () => {
  it("returns [] for manifests without a dependsOn array", () => {
    expect(parseDependsOn({})).toEqual([]);
    expect(parseDependsOn({ purpose: "x" })).toEqual([]);
    expect(parseDependsOn(null)).toEqual([]);
    expect(parseDependsOn([])).toEqual([]);
  });

  it("extracts a flat list of slugs", () => {
    expect(parseDependsOn({ dependsOn: ["a", "b", "c"] })).toEqual(["a", "b", "c"]);
  });

  it("trims whitespace and lowercases", () => {
    expect(parseDependsOn({ dependsOn: [" Invoice-OCR ", "Receipt-Scanner"] })).toEqual([
      "invoice-ocr",
      "receipt-scanner",
    ]);
  });

  it("dedupes while preserving order", () => {
    expect(parseDependsOn({ dependsOn: ["a", "b", "a", "c", "b"] })).toEqual(["a", "b", "c"]);
  });

  it("filters out non-string / empty entries", () => {
    expect(
      parseDependsOn({ dependsOn: ["a", 42, "", null, "b", { slug: "c" }] }),
    ).toEqual(["a", "b"]);
  });

  it("returns [] for non-array dependsOn", () => {
    expect(parseDependsOn({ dependsOn: "not-an-array" })).toEqual([]);
    expect(parseDependsOn({ dependsOn: { a: 1 } })).toEqual([]);
  });
});

describe("resolveDependencies() — no DB path", () => {
  const ORIG = process.env.DATABASE_URL;
  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });
  afterEach(() => {
    if (ORIG === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = ORIG;
  });

  it("returns empty result when manifest has no dependsOn", async () => {
    const r = await resolveDependencies({});
    expect(r.declared).toEqual([]);
    expect(r.resolved).toEqual([]);
    expect(r.missing).toEqual([]);
  });

  it("treats all declared deps as missing when DB is unreachable", async () => {
    const r = await resolveDependencies({ dependsOn: ["a", "b"] });
    expect(r.declared).toEqual(["a", "b"]);
    expect(r.missing).toEqual(["a", "b"]);
    expect(r.resolved).toEqual([]);
  });
});

describe("detectCycles() — no DB path", () => {
  const ORIG = process.env.DATABASE_URL;
  beforeEach(() => {
    delete process.env.DATABASE_URL;
  });
  afterEach(() => {
    if (ORIG === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = ORIG;
  });

  it("catches self-dependency immediately (no DB needed)", async () => {
    const cycles = await detectCycles({
      thisSlug: "a",
      dependsOn: ["a", "b"],
    });
    expect(cycles.length).toBeGreaterThan(0);
    expect(cycles[0]).toContain("a");
  });

  it("returns [] when no self-dep and no DB available", async () => {
    const cycles = await detectCycles({
      thisSlug: "a",
      dependsOn: ["b", "c"],
    });
    expect(cycles).toEqual([]);
  });

  it("returns [] for empty dependsOn", async () => {
    const cycles = await detectCycles({
      thisSlug: "a",
      dependsOn: [],
    });
    expect(cycles).toEqual([]);
  });
});
