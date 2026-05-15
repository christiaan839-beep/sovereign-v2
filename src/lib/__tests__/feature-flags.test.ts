/**
 * Tests for src/lib/feature-flags.ts — Cook 126.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  _resetForTests,
  defineFlag,
  enabledFlagsFor,
  getFlag,
  isEnabled,
  listFlags,
} from "../feature-flags";

beforeEach(() => {
  _resetForTests();
});

describe("defineFlag — validation", () => {
  it("rejects malformed keys", () => {
    expect(() =>
      defineFlag({
        key: "BAD",
        description: "x",
        strategy: { kind: "boolean", enabled: true },
      }),
    ).toThrow();
    expect(() =>
      defineFlag({
        key: "",
        description: "x",
        strategy: { kind: "boolean", enabled: true },
      }),
    ).toThrow();
  });

  it("rejects out-of-range percentage", () => {
    expect(() =>
      defineFlag({
        key: "x",
        description: "x",
        strategy: { kind: "percentage", percent: -1 },
      }),
    ).toThrow();
    expect(() =>
      defineFlag({
        key: "x",
        description: "x",
        strategy: { kind: "percentage", percent: 101 },
      }),
    ).toThrow();
  });
});

describe("boolean strategy", () => {
  it("returns the strategy's enabled value", () => {
    defineFlag({
      key: "alpha",
      description: "x",
      strategy: { kind: "boolean", enabled: true },
    });
    expect(isEnabled("alpha", "any-tenant")).toBe(true);
    defineFlag({
      key: "beta",
      description: "x",
      strategy: { kind: "boolean", enabled: false },
    });
    expect(isEnabled("beta", "any-tenant")).toBe(false);
  });
});

describe("allowlist strategy", () => {
  it("returns true only for explicitly listed tenants", () => {
    defineFlag({
      key: "private-preview",
      description: "x",
      strategy: { kind: "allowlist", tenantIds: ["t-a", "t-b"] },
    });
    expect(isEnabled("private-preview", "t-a")).toBe(true);
    expect(isEnabled("private-preview", "t-b")).toBe(true);
    expect(isEnabled("private-preview", "t-c")).toBe(false);
  });
});

describe("percentage strategy", () => {
  it("returns a deterministic verdict for the same tenant", () => {
    defineFlag({
      key: "rollout",
      description: "x",
      strategy: { kind: "percentage", percent: 50 },
    });
    const first = isEnabled("rollout", "t-1");
    const again = isEnabled("rollout", "t-1");
    expect(first).toBe(again);
  });

  it("0 % rollout disables every tenant", () => {
    defineFlag({
      key: "off",
      description: "x",
      strategy: { kind: "percentage", percent: 0 },
    });
    for (let i = 0; i < 20; i++) {
      expect(isEnabled("off", `t-${i}`)).toBe(false);
    }
  });

  it("100 % rollout enables every tenant", () => {
    defineFlag({
      key: "on",
      description: "x",
      strategy: { kind: "percentage", percent: 100 },
    });
    for (let i = 0; i < 20; i++) {
      expect(isEnabled("on", `t-${i}`)).toBe(true);
    }
  });

  it("approximates the target percent over many tenants", () => {
    defineFlag({
      key: "half",
      description: "x",
      strategy: { kind: "percentage", percent: 50 },
    });
    let enabled = 0;
    for (let i = 0; i < 1000; i++) {
      if (isEnabled("half", `t-${i}`)) enabled++;
    }
    expect(enabled).toBeGreaterThan(400);
    expect(enabled).toBeLessThan(600);
  });
});

describe("kill switch", () => {
  it("overrides any strategy state", () => {
    defineFlag({
      key: "killed",
      description: "x",
      strategy: { kind: "boolean", enabled: true },
      killed: true,
    });
    expect(isEnabled("killed", "any-tenant")).toBe(false);
  });
});

describe("unknown flag", () => {
  it("returns false (never auto-enables)", () => {
    expect(isEnabled("ghost", "t-1")).toBe(false);
  });
});

describe("enabledFlagsFor + listFlags + getFlag", () => {
  it("listFlags returns every defined flag", () => {
    defineFlag({
      key: "a",
      description: "x",
      strategy: { kind: "boolean", enabled: true },
    });
    defineFlag({
      key: "b",
      description: "x",
      strategy: { kind: "boolean", enabled: false },
    });
    expect(listFlags().length).toBe(2);
  });

  it("enabledFlagsFor returns only enabled keys", () => {
    defineFlag({
      key: "a",
      description: "x",
      strategy: { kind: "boolean", enabled: true },
    });
    defineFlag({
      key: "b",
      description: "x",
      strategy: { kind: "boolean", enabled: false },
    });
    expect(enabledFlagsFor("t").sort()).toEqual(["a"]);
  });

  it("getFlag returns the definition", () => {
    defineFlag({
      key: "a",
      description: "desc",
      strategy: { kind: "boolean", enabled: true },
    });
    expect(getFlag("a")?.description).toBe("desc");
  });
});
