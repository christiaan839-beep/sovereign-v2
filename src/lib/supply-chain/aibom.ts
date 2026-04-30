/**
 * R150 AGENTIC AI BILL OF MATERIALS (AIBOM) — Move 8 of the proof-
 * conversion arc.
 *
 * Pure-function generator that walks the platform's agent / model /
 * tool inventory and emits a machine-readable Bill of Materials
 * compatible with SPDX 3.1's living-knowledge-graph evolution.
 *
 * STRATEGIC PURPOSE:
 *
 *   The "Agentic AIBOMs" arXiv paper (March 2026) extends traditional
 *   software bills of materials to capture the dynamic supply chain
 *   of agentic systems: model weights, tool configurations, MCP
 *   server dependencies, prompt templates, agent cards, update
 *   channels. Traditional SBOMs are static; agentic supply chains
 *   are LIVE — models update weekly, MCP servers added at runtime,
 *   tools pulled from registries mid-execution.
 *
 *   The OWASP ASI04 (Agentic Supply Chain Vulnerabilities) threat
 *   class has three real exemplars:
 *     - the LiteLLM compromise that propagated through Mercor
 *     - CVE-2026-25253 (OpenClaw) RCE on 135K instances
 *     - the ClawHavoc skill-marketplace campaign (1,200+ malicious
 *       skills, 6,487 tools cataloged by MalTool)
 *
 *   Regulators are converging on machine-readable SBOM mandates
 *   across critical sectors. AIBOM is the agentic version: every
 *   agent deployment must be able to enumerate WHICH models,
 *   WHICH tools, WHICH external dependencies, WITH WHICH licenses,
 *   AT WHICH versions, WITH WHICH known CVEs.
 *
 * SAFETY POSTURE:
 *
 *   1. Pure function. No I/O. No clocks (caller passes generatedAt).
 *      Ports verbatim to @sovereign/inspector for offline auditor
 *      verification.
 *   2. SPDX 3.1-compatible JSON-LD output. The structure is a
 *      directed acyclic graph of components linked by relationships,
 *      not a flat list. This is the "living knowledge graph" form
 *      SPDX 3.1 introduced.
 *   3. Hash-anchored: every component carries a SHA-256 of its
 *      identifying tuple, and the document carries a SHA-256 of the
 *      canonical-encoded component list. Tampering breaks the chain.
 *   4. Default-OFF gating not needed — generation is on-demand,
 *      called by /api/admin/aibom or the deployment gate. No
 *      runtime cost when not invoked.
 */

import { createHash } from "node:crypto";

// ── Component taxonomy ─────────────────────────────────────────────

/**
 * The five categories of components an agentic AIBOM tracks. Maps
 * to the threat-surface taxonomy in the March 2026 paper:
 *
 *   - model:        weights / inference endpoint (OpenAI, Anthropic,
 *                   open-weight via vLLM, etc.)
 *   - tool:         function the agent can invoke (HTTP API, MCP
 *                   tool, local binary)
 *   - data-source:  RAG corpus, knowledge graph, vector index
 *   - agent:        the agent definition itself (composes models +
 *                   tools + data-sources + sub-agents)
 *   - dependency:   runtime / library / npm package the agent
 *                   transitively depends on
 */
export type AIBOMComponentKind =
  | "model"
  | "tool"
  | "data-source"
  | "agent"
  | "dependency";

export const AIBOM_COMPONENT_KINDS: ReadonlyArray<AIBOMComponentKind> = [
  "model",
  "tool",
  "data-source",
  "agent",
  "dependency",
];

// ── Relationship taxonomy (SPDX 3.1 living-knowledge-graph form) ──

/**
 * Per the SPDX 3.1 evolution from flat-list to knowledge-graph,
 * components link to other components via typed relationships.
 * These mirror the canonical SPDX edge kinds used for AI/ML BOMs.
 */
export type AIBOMRelationshipKind =
  | "DEPENDS_ON"          // agent depends on model / tool / dependency
  | "CONTAINS"            // agent contains a sub-agent
  | "INVOKES"             // agent invokes a tool
  | "READS_FROM"          // agent reads from a data source
  | "TRAINED_ON"          // model trained on a data set
  | "PROVIDED_BY";        // model/tool provided by a vendor or registry

export const AIBOM_RELATIONSHIP_KINDS: ReadonlyArray<AIBOMRelationshipKind> = [
  "DEPENDS_ON",
  "CONTAINS",
  "INVOKES",
  "READS_FROM",
  "TRAINED_ON",
  "PROVIDED_BY",
];

// ── Component shape ────────────────────────────────────────────────

export interface AIBOMComponent {
  /** Stable id within this AIBOM document — kebab-case. */
  id: string;
  kind: AIBOMComponentKind;
  /** Display name. */
  name: string;
  /** Free-form version (model snapshot, npm semver, MCP server tag). */
  version: string;
  /** SPDX license identifier ("MIT", "Apache-2.0", "Proprietary", etc.). */
  license: string;
  /** Optional vendor / registry / source URL. */
  supplier?: string;
  /** Optional homepage / repo / model-card URL. */
  homepage?: string;
  /** Optional CVE list (each starts with CVE- or AVE-). */
  knownVulnerabilities?: string[];
  /** Optional tags for filtering / grouping. */
  tags?: string[];
  /** SHA-256 of (id|kind|name|version|license|supplier). Anchors edits. */
  fingerprint: string;
}

export interface AIBOMRelationship {
  /** id of the source component. */
  fromId: string;
  /** id of the target component. */
  toId: string;
  kind: AIBOMRelationshipKind;
}

export interface AIBOMDocument {
  /** "Sovereign Matrix Agentic BOM" — fixed string. */
  documentName: string;
  /** Caller-supplied — "platform", "tenant:abc", deployment id, etc. */
  scope: string;
  /** ISO 8601 — when the document was generated. */
  generatedAt: string;
  /** Generator identifier — "@sovereign/aibom@<version>". */
  generator: string;
  /** Components keyed by kind for procurement-readable structure. */
  components: AIBOMComponent[];
  relationships: AIBOMRelationship[];
  /** SHA-256 of (canonical components list). Anchors document. */
  documentHash: string;
}

export const AIBOM_GENERATOR_VERSION = "1.0.0";
export const AIBOM_DOCUMENT_NAME = "Sovereign Matrix Agentic BOM";

// ── Component fingerprinting (anti-tampering anchor) ──────────────

/**
 * Pure: SHA-256 of the canonical-encoded identifying tuple.
 * Used as AIBOMComponent.fingerprint. Any change to id / kind /
 * name / version / license / supplier produces a different
 * fingerprint, which propagates into the documentHash.
 */
export function computeComponentFingerprint(
  args: Omit<AIBOMComponent, "fingerprint">,
): string {
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

/**
 * Pure: build a component with a fresh fingerprint. Convenience
 * wrapper so callers don't have to call computeComponentFingerprint
 * by hand.
 */
export function buildComponent(
  args: Omit<AIBOMComponent, "fingerprint">,
): AIBOMComponent {
  const fingerprint = computeComponentFingerprint(args);
  return { ...args, fingerprint };
}

// ── Document hashing (anti-tampering at document level) ───────────

/**
 * Pure: SHA-256 of the canonical-encoded list of (id|fingerprint)
 * pairs, sorted by id for determinism. The relationship list is
 * also included (each relationship hashed as fromId|kind|toId).
 *
 * This is the document-level anchor: any change to ANY component
 * fingerprint or any relationship changes the documentHash.
 */
export function computeDocumentHash(args: {
  scope: string;
  generatedAt: string;
  components: AIBOMComponent[];
  relationships: AIBOMRelationship[];
}): string {
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

// ── Validation ────────────────────────────────────────────────────

export type AIBOMValidation =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "missing_scope"
        | "missing_generated_at"
        | "duplicate_component_id"
        | "invalid_component_kind"
        | "invalid_relationship_kind"
        | "relationship_references_unknown_component"
        | "fingerprint_mismatch"
        | "document_hash_mismatch";
      details: string;
    };

/**
 * Pure: structural + cryptographic validation. Used by the inspector
 * port for offline replay. Recomputes every component fingerprint
 * and the document hash; returns the FIRST failure encountered for
 * deterministic audit-entry shape.
 */
export function validateAIBOMDocument(doc: AIBOMDocument): AIBOMValidation {
  if (!doc.scope || doc.scope.trim().length === 0) {
    return { ok: false, reason: "missing_scope", details: "scope must be non-empty" };
  }
  if (!doc.generatedAt || Number.isNaN(Date.parse(doc.generatedAt))) {
    return {
      ok: false,
      reason: "missing_generated_at",
      details: "generatedAt must be a valid ISO 8601",
    };
  }

  const seenIds = new Set<string>();
  for (const c of doc.components) {
    if (seenIds.has(c.id)) {
      return {
        ok: false,
        reason: "duplicate_component_id",
        details: `component id ${c.id} appears more than once`,
      };
    }
    seenIds.add(c.id);
    if (!AIBOM_COMPONENT_KINDS.includes(c.kind)) {
      return {
        ok: false,
        reason: "invalid_component_kind",
        details: `component ${c.id} has invalid kind ${c.kind}`,
      };
    }
    const expectedFp = computeComponentFingerprint(c);
    if (c.fingerprint !== expectedFp) {
      return {
        ok: false,
        reason: "fingerprint_mismatch",
        details: `component ${c.id} fingerprint ${c.fingerprint} does not match recomputed ${expectedFp}`,
      };
    }
  }

  for (const r of doc.relationships) {
    if (!AIBOM_RELATIONSHIP_KINDS.includes(r.kind)) {
      return {
        ok: false,
        reason: "invalid_relationship_kind",
        details: `relationship from ${r.fromId} to ${r.toId} has invalid kind ${r.kind}`,
      };
    }
    if (!seenIds.has(r.fromId) || !seenIds.has(r.toId)) {
      return {
        ok: false,
        reason: "relationship_references_unknown_component",
        details: `relationship references unknown component (from=${r.fromId} to=${r.toId})`,
      };
    }
  }

  const expectedDocHash = computeDocumentHash({
    scope: doc.scope,
    generatedAt: doc.generatedAt,
    components: doc.components,
    relationships: doc.relationships,
  });
  if (doc.documentHash !== expectedDocHash) {
    return {
      ok: false,
      reason: "document_hash_mismatch",
      details: `documentHash ${doc.documentHash} does not match recomputed ${expectedDocHash}`,
    };
  }

  return { ok: true };
}

// ── Generator (composes a document from raw inventory) ───────────

export interface BuildAIBOMInput {
  scope: string;
  generatedAt: string;
  components: ReadonlyArray<Omit<AIBOMComponent, "fingerprint">>;
  relationships: ReadonlyArray<AIBOMRelationship>;
}

/**
 * Pure: build a complete AIBOMDocument from raw inputs. Computes
 * every fingerprint + the document hash. Caller serializes via
 * JSON.stringify(); SPDX 3.1 JSON-LD wrappers can be added at
 * the export layer without changing the internal shape.
 */
export function buildAIBOMDocument(input: BuildAIBOMInput): AIBOMDocument {
  const components: AIBOMComponent[] = input.components.map((c) =>
    buildComponent(c),
  );
  const relationships: AIBOMRelationship[] = input.relationships.slice();
  const documentHash = computeDocumentHash({
    scope: input.scope,
    generatedAt: input.generatedAt,
    components,
    relationships,
  });
  return {
    documentName: AIBOM_DOCUMENT_NAME,
    scope: input.scope,
    generatedAt: input.generatedAt,
    generator: `@sovereign/aibom@${AIBOM_GENERATOR_VERSION}`,
    components,
    relationships,
    documentHash,
  };
}

// ── CVE / AVE blocklist check (deployment gate) ───────────────────

export interface VulnerabilityBlocklistInput {
  doc: AIBOMDocument;
  /** CVE / AVE identifiers that, if present, block deployment. */
  blocklist: ReadonlyArray<string>;
}

export type VulnerabilityCheckResult =
  | { ok: true; matched: [] }
  | {
      ok: false;
      matched: Array<{ componentId: string; vulnerability: string }>;
      summary: string;
    };

/**
 * Pure: scan an AIBOM for any component carrying a vulnerability
 * id present in the blocklist. Used by the R130 deployment gate
 * (when wired) to block production deploys whose supply chain
 * contains a known CVE.
 */
export function checkVulnerabilityBlocklist(
  input: VulnerabilityBlocklistInput,
): VulnerabilityCheckResult {
  const matched: Array<{ componentId: string; vulnerability: string }> = [];
  const blockSet = new Set(input.blocklist);
  for (const c of input.doc.components) {
    for (const v of c.knownVulnerabilities ?? []) {
      if (blockSet.has(v)) {
        matched.push({ componentId: c.id, vulnerability: v });
      }
    }
  }
  if (matched.length === 0) return { ok: true, matched: [] };
  const summary = `AIBOM has ${matched.length} component(s) with blocklisted vulnerabilities: ${matched
    .map((m) => `${m.componentId} (${m.vulnerability})`)
    .join("; ")}`.slice(0, 200);
  return { ok: false, matched, summary };
}

// ── Audit-entry shape (caller fires agent.sbom_generated) ─────────

export interface AIBOMAuditEntry {
  action: "agent.sbom_generated";
  resource: string;
  details: {
    scope: string;
    generatedAt: string;
    componentCount: number;
    relationshipCount: number;
    documentHash: string;
    blocklistMatches?: number;
  };
}

/**
 * Pure: produce the R26 audit entry that records this AIBOM was
 * generated. Caller writes via auditLog().
 */
export function buildAIBOMAuditEntry(
  doc: AIBOMDocument,
  blocklistMatches?: number,
): AIBOMAuditEntry {
  return {
    action: "agent.sbom_generated",
    resource: `aibom:${doc.scope}`,
    details: {
      scope: doc.scope,
      generatedAt: doc.generatedAt,
      componentCount: doc.components.length,
      relationshipCount: doc.relationships.length,
      documentHash: doc.documentHash,
      blocklistMatches,
    },
  };
}
