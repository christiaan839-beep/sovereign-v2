/**
 * @sovereign/inspector — R150 AIBOM Generator (Move 8).
 *
 * Pure-function port of src/lib/supply-chain/aibom.ts to standalone
 * Node ESM. Customer or auditor uses this module to:
 *   1. Verify any published AIBOM document is internally consistent
 *      (every component fingerprint correct, document hash correct).
 *   2. Run a vulnerability-blocklist check offline against any
 *      AIBOM document, without any Sovereign network call.
 */

import { createHash } from "node:crypto";

export const AIBOM_COMPONENT_KINDS = ["model", "tool", "data-source", "agent", "dependency"];
export const AIBOM_RELATIONSHIP_KINDS = [
  "DEPENDS_ON",
  "CONTAINS",
  "INVOKES",
  "READS_FROM",
  "TRAINED_ON",
  "PROVIDED_BY",
];
export const AIBOM_GENERATOR_VERSION = "1.0.0";
export const AIBOM_DOCUMENT_NAME = "Sovereign Matrix Agentic BOM";

export function computeComponentFingerprint(args) {
  const canonical = [
    args.id,
    args.kind,
    args.name,
    args.version,
    args.license,
    args.supplier ?? "",
    args.homepage ?? "",
    (args.knownVulnerabilities ?? []).slice().sort().join(","),
  ].join("|");
  return createHash("sha256").update(canonical).digest("hex");
}

export function computeDocumentHash(args) {
  const componentLines = args.components
    .map((c) => `${c.id}|${c.fingerprint}`)
    .sort()
    .join("\n");
  const relLines = args.relationships
    .map((r) => `${r.fromId}|${r.kind}|${r.toId}`)
    .sort()
    .join("\n");
  const canonical = [
    AIBOM_DOCUMENT_NAME,
    `scope=${args.scope}`,
    `generatedAt=${args.generatedAt}`,
    `generator=@sovereign/aibom@${AIBOM_GENERATOR_VERSION}`,
    "components:",
    componentLines,
    "relationships:",
    relLines,
  ].join("\n");
  return createHash("sha256").update(canonical).digest("hex");
}

export function validateAIBOMDocument(doc) {
  if (!doc.scope || doc.scope.trim().length === 0) {
    return { ok: false, reason: "missing_scope", details: "scope must be non-empty" };
  }
  if (!doc.generatedAt || Number.isNaN(Date.parse(doc.generatedAt))) {
    return { ok: false, reason: "missing_generated_at", details: "generatedAt must be ISO 8601" };
  }
  const seenIds = new Set();
  for (const c of doc.components) {
    if (seenIds.has(c.id)) {
      return { ok: false, reason: "duplicate_component_id", details: `${c.id} duplicate` };
    }
    seenIds.add(c.id);
    if (!AIBOM_COMPONENT_KINDS.includes(c.kind)) {
      return {
        ok: false,
        reason: "invalid_component_kind",
        details: `${c.id} has invalid kind ${c.kind}`,
      };
    }
    const expected = computeComponentFingerprint(c);
    if (c.fingerprint !== expected) {
      return {
        ok: false,
        reason: "fingerprint_mismatch",
        details: `${c.id} fingerprint ${c.fingerprint} !== ${expected}`,
      };
    }
  }
  for (const r of doc.relationships) {
    if (!AIBOM_RELATIONSHIP_KINDS.includes(r.kind)) {
      return {
        ok: false,
        reason: "invalid_relationship_kind",
        details: `${r.fromId}->${r.toId} has kind ${r.kind}`,
      };
    }
    if (!seenIds.has(r.fromId) || !seenIds.has(r.toId)) {
      return {
        ok: false,
        reason: "relationship_references_unknown_component",
        details: `${r.fromId}->${r.toId}`,
      };
    }
  }
  const expected = computeDocumentHash({
    scope: doc.scope,
    generatedAt: doc.generatedAt,
    components: doc.components,
    relationships: doc.relationships,
  });
  if (doc.documentHash !== expected) {
    return {
      ok: false,
      reason: "document_hash_mismatch",
      details: `documentHash ${doc.documentHash} !== ${expected}`,
    };
  }
  return { ok: true };
}

export function checkVulnerabilityBlocklist({ doc, blocklist }) {
  const matched = [];
  const blockSet = new Set(blocklist);
  for (const c of doc.components) {
    for (const v of c.knownVulnerabilities ?? []) {
      if (blockSet.has(v)) matched.push({ componentId: c.id, vulnerability: v });
    }
  }
  if (matched.length === 0) return { ok: true, matched: [] };
  return {
    ok: false,
    matched,
    summary: `AIBOM has ${matched.length} blocklist matches`.slice(0, 200),
  };
}
