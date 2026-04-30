/**
 * R150 AIBOM Generator — pure-function tests.
 *
 * Coverage:
 *   - Component fingerprinting (deterministic, sensitive to changes)
 *   - Document hash (deterministic, sensitive to component/relationship changes)
 *   - buildAIBOMDocument composes correctly
 *   - validateAIBOMDocument: 7 typed failure reasons
 *   - Vulnerability blocklist detection
 *   - Audit-entry shape
 */

import { describe, it, expect } from "vitest";
import {
  AIBOM_COMPONENT_KINDS,
  AIBOM_RELATIONSHIP_KINDS,
  AIBOM_GENERATOR_VERSION,
  buildComponent,
  buildAIBOMDocument,
  computeComponentFingerprint,
  computeDocumentHash,
  validateAIBOMDocument,
  checkVulnerabilityBlocklist,
  buildAIBOMAuditEntry,
} from "../aibom";

const sampleComponent = (overrides = {}) => ({
  id: "model-claude-opus",
  kind: "model" as const,
  name: "Claude Opus",
  version: "4.7",
  license: "Proprietary",
  supplier: "Anthropic",
  ...overrides,
});

describe("AIBOM_COMPONENT_KINDS + AIBOM_RELATIONSHIP_KINDS", () => {
  it("declares the 5 canonical component kinds", () => {
    expect(AIBOM_COMPONENT_KINDS).toEqual([
      "model",
      "tool",
      "data-source",
      "agent",
      "dependency",
    ]);
  });

  it("declares the 6 canonical relationship kinds", () => {
    expect(AIBOM_RELATIONSHIP_KINDS).toEqual([
      "DEPENDS_ON",
      "CONTAINS",
      "INVOKES",
      "READS_FROM",
      "TRAINED_ON",
      "PROVIDED_BY",
    ]);
  });
});

describe("computeComponentFingerprint", () => {
  it("is deterministic for identical inputs", () => {
    const a = computeComponentFingerprint(sampleComponent());
    const b = computeComponentFingerprint(sampleComponent());
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when version changes", () => {
    const a = computeComponentFingerprint(sampleComponent());
    const b = computeComponentFingerprint(sampleComponent({ version: "4.8" }));
    expect(a).not.toBe(b);
  });

  it("changes when license changes", () => {
    const a = computeComponentFingerprint(sampleComponent());
    const b = computeComponentFingerprint(sampleComponent({ license: "MIT" }));
    expect(a).not.toBe(b);
  });

  it("is order-stable on knownVulnerabilities (sort independence)", () => {
    const a = computeComponentFingerprint(
      sampleComponent({ knownVulnerabilities: ["CVE-2026-25253", "AVE-001"] }),
    );
    const b = computeComponentFingerprint(
      sampleComponent({ knownVulnerabilities: ["AVE-001", "CVE-2026-25253"] }),
    );
    expect(a).toBe(b);
  });
});

describe("buildComponent", () => {
  it("produces a component with valid fingerprint", () => {
    const c = buildComponent(sampleComponent());
    expect(c.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(c.id).toBe("model-claude-opus");
  });
});

describe("computeDocumentHash", () => {
  const baseInput = {
    scope: "platform",
    generatedAt: "2026-04-30T00:00:00.000Z",
    components: [buildComponent(sampleComponent())],
    relationships: [],
  };

  it("is deterministic", () => {
    const a = computeDocumentHash(baseInput);
    const b = computeDocumentHash(baseInput);
    expect(a).toBe(b);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("changes when a component is added", () => {
    const a = computeDocumentHash(baseInput);
    const b = computeDocumentHash({
      ...baseInput,
      components: [
        ...baseInput.components,
        buildComponent({ id: "x", kind: "tool", name: "x", version: "1", license: "MIT" }),
      ],
    });
    expect(a).not.toBe(b);
  });

  it("changes when a relationship is added", () => {
    const componentB = buildComponent({
      id: "agent-x",
      kind: "agent",
      name: "X",
      version: "1",
      license: "Apache-2.0",
    });
    const a = computeDocumentHash({
      ...baseInput,
      components: [...baseInput.components, componentB],
    });
    const b = computeDocumentHash({
      ...baseInput,
      components: [...baseInput.components, componentB],
      relationships: [{ fromId: "agent-x", toId: "model-claude-opus", kind: "DEPENDS_ON" }],
    });
    expect(a).not.toBe(b);
  });

  it("is invariant under component insertion order (sorted hash)", () => {
    const c1 = buildComponent({ id: "a", kind: "tool", name: "a", version: "1", license: "MIT" });
    const c2 = buildComponent({ id: "b", kind: "tool", name: "b", version: "1", license: "MIT" });
    const a = computeDocumentHash({ ...baseInput, components: [c1, c2] });
    const b = computeDocumentHash({ ...baseInput, components: [c2, c1] });
    expect(a).toBe(b);
  });
});

describe("buildAIBOMDocument", () => {
  it("produces a fully formed document with computed fingerprints + hash", () => {
    const doc = buildAIBOMDocument({
      scope: "tenant:acme",
      generatedAt: "2026-04-30T00:00:00.000Z",
      components: [
        sampleComponent(),
        { id: "agent-bot", kind: "agent", name: "Bot", version: "1.0", license: "Proprietary" },
      ],
      relationships: [{ fromId: "agent-bot", toId: "model-claude-opus", kind: "DEPENDS_ON" }],
    });
    expect(doc.documentName).toBe("Sovereign Matrix Agentic BOM");
    expect(doc.scope).toBe("tenant:acme");
    expect(doc.generator).toContain(AIBOM_GENERATOR_VERSION);
    expect(doc.components).toHaveLength(2);
    expect(doc.relationships).toHaveLength(1);
    expect(doc.documentHash).toMatch(/^[0-9a-f]{64}$/);
    for (const c of doc.components) {
      expect(c.fingerprint).toMatch(/^[0-9a-f]{64}$/);
    }
  });
});

describe("validateAIBOMDocument", () => {
  const goodDoc = () =>
    buildAIBOMDocument({
      scope: "platform",
      generatedAt: "2026-04-30T00:00:00.000Z",
      components: [sampleComponent()],
      relationships: [],
    });

  it("ok on a freshly built document", () => {
    const v = validateAIBOMDocument(goodDoc());
    expect(v.ok).toBe(true);
  });

  it("rejects empty scope", () => {
    const doc = goodDoc();
    doc.scope = "";
    const v = validateAIBOMDocument(doc);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("missing_scope");
  });

  it("rejects invalid generatedAt", () => {
    const doc = goodDoc();
    doc.generatedAt = "not-a-date";
    const v = validateAIBOMDocument(doc);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("missing_generated_at");
  });

  it("rejects duplicate component ids", () => {
    const c1 = buildComponent(sampleComponent());
    const doc = buildAIBOMDocument({
      scope: "p",
      generatedAt: "2026-04-30T00:00:00.000Z",
      components: [c1, c1],
      relationships: [],
    });
    const v = validateAIBOMDocument(doc);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("duplicate_component_id");
  });

  it("rejects unknown component kind", () => {
    const doc = goodDoc();
    (doc.components[0] as { kind: string }).kind = "garbage";
    const v = validateAIBOMDocument(doc);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("invalid_component_kind");
  });

  it("rejects relationships referencing unknown components", () => {
    const doc = goodDoc();
    doc.relationships = [{ fromId: "missing", toId: "model-claude-opus", kind: "DEPENDS_ON" }];
    // Recompute documentHash so the relationship-kind check is reached
    doc.documentHash = computeDocumentHash({
      scope: doc.scope,
      generatedAt: doc.generatedAt,
      components: doc.components,
      relationships: doc.relationships,
    });
    const v = validateAIBOMDocument(doc);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("relationship_references_unknown_component");
  });

  it("rejects unknown relationship kind", () => {
    const doc = buildAIBOMDocument({
      scope: "p",
      generatedAt: "2026-04-30T00:00:00.000Z",
      components: [
        sampleComponent(),
        { id: "x", kind: "tool", name: "x", version: "1", license: "MIT" },
      ],
      relationships: [],
    });
    doc.relationships = [{ fromId: "x", toId: "model-claude-opus", kind: "garbage" as never }];
    doc.documentHash = computeDocumentHash({
      scope: doc.scope,
      generatedAt: doc.generatedAt,
      components: doc.components,
      relationships: doc.relationships,
    });
    const v = validateAIBOMDocument(doc);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("invalid_relationship_kind");
  });

  it("detects fingerprint tampering", () => {
    const doc = goodDoc();
    doc.components[0].fingerprint = "0".repeat(64); // tampered
    const v = validateAIBOMDocument(doc);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("fingerprint_mismatch");
  });

  it("detects document-hash tampering", () => {
    const doc = goodDoc();
    doc.documentHash = "0".repeat(64);
    const v = validateAIBOMDocument(doc);
    expect(v.ok).toBe(false);
    if (!v.ok) expect(v.reason).toBe("document_hash_mismatch");
  });
});

describe("checkVulnerabilityBlocklist", () => {
  it("returns ok when no component carries a blocklisted CVE", () => {
    const doc = buildAIBOMDocument({
      scope: "p",
      generatedAt: "2026-04-30T00:00:00.000Z",
      components: [sampleComponent({ knownVulnerabilities: ["CVE-2025-1111"] })],
      relationships: [],
    });
    const r = checkVulnerabilityBlocklist({ doc, blocklist: ["CVE-2026-25253"] });
    expect(r.ok).toBe(true);
  });

  it("returns ok:false with matched components on hit", () => {
    const doc = buildAIBOMDocument({
      scope: "p",
      generatedAt: "2026-04-30T00:00:00.000Z",
      components: [
        sampleComponent({ knownVulnerabilities: ["CVE-2026-25253", "CVE-2025-1111"] }),
        { id: "tool-x", kind: "tool", name: "x", version: "1", license: "MIT", knownVulnerabilities: ["AVE-001"] },
      ],
      relationships: [],
    });
    const r = checkVulnerabilityBlocklist({
      doc,
      blocklist: ["CVE-2026-25253", "AVE-001"],
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.matched).toHaveLength(2);
      expect(r.summary).toContain("blocklisted");
    }
  });
});

describe("buildAIBOMAuditEntry", () => {
  it("emits agent.sbom_generated audit action with document hash", () => {
    const doc = buildAIBOMDocument({
      scope: "platform",
      generatedAt: "2026-04-30T00:00:00.000Z",
      components: [sampleComponent()],
      relationships: [],
    });
    const entry = buildAIBOMAuditEntry(doc, 0);
    expect(entry.action).toBe("agent.sbom_generated");
    expect(entry.resource).toBe("aibom:platform");
    expect(entry.details.documentHash).toBe(doc.documentHash);
    expect(entry.details.componentCount).toBe(1);
    expect(entry.details.blocklistMatches).toBe(0);
  });
});
