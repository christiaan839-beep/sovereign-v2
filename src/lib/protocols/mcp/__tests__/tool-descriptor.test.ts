/**
 * R161 MCP Tool Descriptor — pure-function tests.
 */

import { describe, it, expect } from "vitest";
import {
  isValidScope,
  parseScope,
  evaluateToolScope,
  buildToolDescriptor,
  computeToolFingerprint,
  canonicalEncodeToolDescriptor,
  validateToolDescriptor,
  buildToolInvocationAuditEntry,
} from "../tool-descriptor";

const sampleTool = (overrides = {}) => ({
  id: "finance.reconcile",
  name: "Reconcile Trades",
  description: "Reconciles a daily trade ledger.",
  inputSchemaShape: {
    type: "object" as const,
    properties: { date: { type: "string" as const } },
    required: ["date"],
  },
  outputSchemaShape: {
    type: "object" as const,
    properties: { reconciled: { type: "boolean" as const } },
  },
  requiredScopes: ["finance:write:reconciliation"],
  auditClass: "internal_write" as const,
  ...overrides,
});

describe("Scope grammar", () => {
  it("accepts resource:action and resource:action:qualifier forms", () => {
    expect(isValidScope("finance:read")).toBe(true);
    expect(isValidScope("finance:write:reconciliation")).toBe(true);
    expect(isValidScope("a:b")).toBe(true);
  });

  it("rejects malformed scopes", () => {
    expect(isValidScope("Finance:Read")).toBe(false);
    expect(isValidScope("finance")).toBe(false);
    expect(isValidScope("finance:")).toBe(false);
    expect(isValidScope("finance:write:")).toBe(false);
    expect(isValidScope("finance:write:scope:extra")).toBe(false);
  });

  it("parseScope decomposes correctly", () => {
    expect(parseScope("finance:write:reconciliation")).toEqual({
      resource: "finance",
      action: "write",
      qualifier: "reconciliation",
    });
    expect(parseScope("finance:read")).toEqual({
      resource: "finance",
      action: "read",
      qualifier: undefined,
    });
    expect(parseScope("bad")).toBeNull();
  });
});

describe("evaluateToolScope", () => {
  it("ok when caller exactly matches required scopes", () => {
    const r = evaluateToolScope({
      required: ["finance:write:reconciliation"],
      granted: ["finance:write:reconciliation"],
    });
    expect(r.ok).toBe(true);
  });

  it("required without qualifier satisfied by granted with qualifier (broader implies narrower)", () => {
    const r = evaluateToolScope({
      required: ["finance:read"],
      granted: ["finance:read:reports"],
    });
    expect(r.ok).toBe(true);
  });

  it("required with qualifier NOT satisfied by granted without qualifier (narrower not broader)", () => {
    const r = evaluateToolScope({
      required: ["finance:write:reconciliation"],
      granted: ["finance:write"],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.missing).toEqual(["finance:write:reconciliation"]);
  });

  it("partial match fails with named missing scopes", () => {
    const r = evaluateToolScope({
      required: ["finance:read", "commerce:execute:cart"],
      granted: ["finance:read"],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.missing).toEqual(["commerce:execute:cart"]);
      expect(r.reason).toBe("missing_required_scope");
    }
  });

  it("rejects malformed required scope", () => {
    const r = evaluateToolScope({
      required: ["BAD-SCOPE"],
      granted: [],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("malformed_required");
  });

  it("rejects malformed granted scope", () => {
    const r = evaluateToolScope({
      required: ["finance:read"],
      granted: ["BAD"],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe("malformed_granted");
  });

  it("empty required = always ok regardless of granted", () => {
    expect(evaluateToolScope({ required: [], granted: [] }).ok).toBe(true);
    expect(evaluateToolScope({ required: [], granted: ["a:b"] }).ok).toBe(true);
  });

  it("admin scope (multiple grants) covers a tool requiring two scopes", () => {
    const r = evaluateToolScope({
      required: ["finance:read", "finance:write:reconciliation"],
      granted: ["finance:read", "finance:write:reconciliation"],
    });
    expect(r.ok).toBe(true);
  });
});

describe("Tool fingerprint + canonical encoding", () => {
  it("is deterministic for identical descriptors", () => {
    const a = computeToolFingerprint(sampleTool());
    const b = computeToolFingerprint(sampleTool());
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("invariant under requiredScopes order", () => {
    const a = canonicalEncodeToolDescriptor(
      sampleTool({ requiredScopes: ["a:b", "c:d"] }),
    );
    const b = canonicalEncodeToolDescriptor(
      sampleTool({ requiredScopes: ["c:d", "a:b"] }),
    );
    expect(a).toBe(b);
  });

  it("excludes description from canonical encoding", () => {
    const a = computeToolFingerprint(sampleTool({ description: "v1" }));
    const b = computeToolFingerprint(sampleTool({ description: "v2" }));
    expect(a).toBe(b);
  });

  it("changes when audit class changes", () => {
    const a = computeToolFingerprint(sampleTool({ auditClass: "internal_read" }));
    const b = computeToolFingerprint(sampleTool({ auditClass: "internal_write" }));
    expect(a).not.toBe(b);
  });
});

describe("buildToolDescriptor + validateToolDescriptor", () => {
  it("freshly built descriptor passes validation", () => {
    const desc = buildToolDescriptor(sampleTool());
    expect(validateToolDescriptor(desc).ok).toBe(true);
  });

  it("rejects malformed id (non-namespaced)", () => {
    const desc = buildToolDescriptor(sampleTool({ id: "BadId" }));
    const v = validateToolDescriptor(desc);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("invalid_id");
  });

  it("accepts namespaced id (a.b.c)", () => {
    const desc = buildToolDescriptor(sampleTool({ id: "ns.sub.tool" }));
    expect(validateToolDescriptor(desc).ok).toBe(true);
  });

  it("rejects empty description", () => {
    const desc = buildToolDescriptor(sampleTool({ description: "" }));
    const v = validateToolDescriptor(desc);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("missing_description");
  });

  it("rejects scope grammar violation", () => {
    const desc = buildToolDescriptor(sampleTool({ requiredScopes: ["BAD"] }));
    const v = validateToolDescriptor(desc);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("scope_grammar_violation");
  });

  it("rejects fingerprint tampering", () => {
    const desc = buildToolDescriptor(sampleTool());
    desc.fingerprint = "0".repeat(64);
    const v = validateToolDescriptor(desc);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("fingerprint_mismatch");
  });

  it("rejects unknown audit class", () => {
    const desc = buildToolDescriptor(sampleTool());
    (desc as { auditClass: string }).auditClass = "garbage";
    desc.fingerprint = computeToolFingerprint(desc as never);
    const v = validateToolDescriptor(desc);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("invalid_audit_class");
  });
});

describe("buildToolInvocationAuditEntry", () => {
  it("emits agent.governance_consult with phase=mcp-tool and scope evaluation", () => {
    const desc = buildToolDescriptor(sampleTool());
    const granted = ["finance:write:reconciliation"];
    const evaluation = evaluateToolScope({
      required: desc.requiredScopes,
      granted,
    });
    const entry = buildToolInvocationAuditEntry(desc, granted, evaluation);
    expect(entry.action).toBe("agent.governance_consult");
    expect(entry.resource).toBe("mcp-tool:finance.reconcile");
    expect(entry.details.phase).toBe("mcp-tool");
    expect(entry.details.scopeOk).toBe(true);
    expect(entry.details.fingerprint).toBe(desc.fingerprint);
  });

  it("includes missing scope list when evaluation fails", () => {
    const desc = buildToolDescriptor(sampleTool());
    const granted: string[] = [];
    const evaluation = evaluateToolScope({
      required: desc.requiredScopes,
      granted,
    });
    const entry = buildToolInvocationAuditEntry(desc, granted, evaluation);
    expect(entry.details.scopeOk).toBe(false);
    expect(entry.details.missing).toEqual(["finance:write:reconciliation"]);
  });
});
