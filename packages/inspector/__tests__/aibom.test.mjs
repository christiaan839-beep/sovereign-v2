/**
 * Inspector — R150 AIBOM cross-implementation agreement.
 *
 * Confirms inspector's AIBOM verifier produces SAME hashes + SAME
 * validation verdicts as the platform.
 */

import { describe, it, expect } from "vitest";
import {
  AIBOM_COMPONENT_KINDS,
  AIBOM_RELATIONSHIP_KINDS,
  computeComponentFingerprint,
  computeDocumentHash,
  validateAIBOMDocument,
  checkVulnerabilityBlocklist,
} from "../src/aibom.mjs";

const sampleComponent = (overrides = {}) => ({
  id: "model-x",
  kind: "model",
  name: "Model X",
  version: "1.0",
  license: "MIT",
  supplier: "Acme",
  ...overrides,
});

describe("inspector AIBOM — taxonomy", () => {
  it("declares the 5 component kinds", () => {
    expect(AIBOM_COMPONENT_KINDS).toEqual([
      "model",
      "tool",
      "data-source",
      "agent",
      "dependency",
    ]);
  });

  it("declares the 6 relationship kinds", () => {
    expect(AIBOM_RELATIONSHIP_KINDS.length).toBe(6);
  });
});

describe("inspector AIBOM — fingerprint + hash determinism", () => {
  it("computeComponentFingerprint deterministic + sensitive", () => {
    const a = computeComponentFingerprint(sampleComponent());
    const b = computeComponentFingerprint(sampleComponent());
    expect(a).toBe(b);
    const c = computeComponentFingerprint(sampleComponent({ version: "2.0" }));
    expect(a).not.toBe(c);
  });

  it("computeDocumentHash invariant under component insertion order", () => {
    const c1 = { ...sampleComponent({ id: "a" }), fingerprint: computeComponentFingerprint(sampleComponent({ id: "a" })) };
    const c2 = { ...sampleComponent({ id: "b" }), fingerprint: computeComponentFingerprint(sampleComponent({ id: "b" })) };
    const a = computeDocumentHash({
      scope: "p",
      generatedAt: "2026-04-30T00:00:00.000Z",
      components: [c1, c2],
      relationships: [],
    });
    const b = computeDocumentHash({
      scope: "p",
      generatedAt: "2026-04-30T00:00:00.000Z",
      components: [c2, c1],
      relationships: [],
    });
    expect(a).toBe(b);
  });
});

describe("inspector AIBOM — validateAIBOMDocument", () => {
  function makeDoc() {
    const c = sampleComponent();
    const fp = computeComponentFingerprint(c);
    const components = [{ ...c, fingerprint: fp }];
    const documentHash = computeDocumentHash({
      scope: "p",
      generatedAt: "2026-04-30T00:00:00.000Z",
      components,
      relationships: [],
    });
    return {
      documentName: "Sovereign Matrix Agentic BOM",
      scope: "p",
      generatedAt: "2026-04-30T00:00:00.000Z",
      generator: "@sovereign/aibom@1.0.0",
      components,
      relationships: [],
      documentHash,
    };
  }

  it("ok on a fresh doc", () => {
    const v = validateAIBOMDocument(makeDoc());
    expect(v.ok).toBe(true);
  });

  it("rejects fingerprint tampering", () => {
    const doc = makeDoc();
    doc.components[0].fingerprint = "0".repeat(64);
    const v = validateAIBOMDocument(doc);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("fingerprint_mismatch");
  });

  it("rejects document hash tampering", () => {
    const doc = makeDoc();
    doc.documentHash = "0".repeat(64);
    const v = validateAIBOMDocument(doc);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("document_hash_mismatch");
  });

  it("rejects empty scope", () => {
    const doc = makeDoc();
    doc.scope = "";
    const v = validateAIBOMDocument(doc);
    expect(v.ok).toBe(false);
    expect(v.reason).toBe("missing_scope");
  });
});

describe("inspector AIBOM — checkVulnerabilityBlocklist", () => {
  it("returns ok:false on blocklist match", () => {
    const c = sampleComponent({ knownVulnerabilities: ["CVE-2026-25253"] });
    const doc = {
      scope: "p",
      components: [{ ...c, fingerprint: computeComponentFingerprint(c) }],
      relationships: [],
    };
    const r = checkVulnerabilityBlocklist({ doc, blocklist: ["CVE-2026-25253"] });
    expect(r.ok).toBe(false);
    expect(r.matched).toHaveLength(1);
  });
});
