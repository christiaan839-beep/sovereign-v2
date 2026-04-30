import { describe, it, expect } from "vitest";
import {
  isValidScope,
  parseScope,
  evaluateToolScope,
  computeToolFingerprint,
  validateToolDescriptor,
  verifyScopeEvaluation,
} from "../src/mcp.mjs";

const sampleTool = (overrides = {}) => {
  const base = {
    id: "ns.tool",
    name: "Tool",
    description: "x",
    inputSchemaShape: { type: "object", properties: {} },
    outputSchemaShape: { type: "object", properties: {} },
    requiredScopes: ["finance:read"],
    auditClass: "internal_read",
    ...overrides,
  };
  return { ...base, fingerprint: computeToolFingerprint(base) };
};

describe("inspector MCP — scope grammar", () => {
  it("accepts canonical 2- and 3-part scopes", () => {
    expect(isValidScope("a:b")).toBe(true);
    expect(isValidScope("a:b:c")).toBe(true);
  });

  it("rejects 4-part scopes and uppercase", () => {
    expect(isValidScope("a:b:c:d")).toBe(false);
    expect(isValidScope("A:B")).toBe(false);
  });

  it("parseScope decomposes correctly", () => {
    expect(parseScope("a:b:c")).toEqual({ resource: "a", action: "b", qualifier: "c" });
  });
});

describe("inspector MCP — evaluateToolScope", () => {
  it("ok on exact match", () => {
    expect(
      evaluateToolScope({ required: ["a:b"], granted: ["a:b"] }).ok,
    ).toBe(true);
  });

  it("required without qualifier matched by granted with qualifier", () => {
    expect(
      evaluateToolScope({ required: ["a:b"], granted: ["a:b:c"] }).ok,
    ).toBe(true);
  });

  it("required with qualifier NOT matched by granted without qualifier", () => {
    const r = evaluateToolScope({ required: ["a:b:c"], granted: ["a:b"] });
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(["a:b:c"]);
  });

  it("missing scope failure named", () => {
    const r = evaluateToolScope({
      required: ["finance:read", "commerce:exec:cart"],
      granted: ["finance:read"],
    });
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(["commerce:exec:cart"]);
  });
});

describe("inspector MCP — validateToolDescriptor", () => {
  it("ok on a fresh descriptor", () => {
    expect(validateToolDescriptor(sampleTool()).ok).toBe(true);
  });

  it("rejects fingerprint tampering", () => {
    const desc = sampleTool();
    desc.fingerprint = "0".repeat(64);
    expect(validateToolDescriptor(desc).ok).toBe(false);
  });

  it("rejects scope grammar violation", () => {
    const desc = sampleTool({ requiredScopes: ["BAD"] });
    expect(validateToolDescriptor(desc).ok).toBe(false);
  });
});

describe("inspector MCP — verifyScopeEvaluation", () => {
  it("ok when claim matches replay", () => {
    const claimed = evaluateToolScope({ required: ["a:b"], granted: ["a:b"] });
    expect(
      verifyScopeEvaluation({ required: ["a:b"], granted: ["a:b"], claimed }).ok,
    ).toBe(true);
  });

  it("flags claim mismatch", () => {
    const claimed = { ok: true, matched: ["a:b"] };
    const v = verifyScopeEvaluation({
      required: ["a:b:c"],
      granted: [],
      claimed,
    });
    expect(v.ok).toBe(false);
    expect(v.errors[0]).toContain("ok mismatch");
  });
});
