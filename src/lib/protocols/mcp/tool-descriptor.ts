/**
 * R161 MCP TOOL GATEWAY — Move 11 of the proof-conversion arc.
 *
 * Pure-function core for Anthropic's Model Context Protocol (MCP),
 * which by April 2026 was hosted by the Linux Foundation Agentic AI
 * Foundation with 97M+ installs. MCP is the canonical "tool" protocol
 * for AI agents — the way an LLM agent discovers, describes, invokes,
 * and authenticates against external capabilities.
 *
 * STRATEGIC PURPOSE:
 *
 *   Sovereign exposes 130+ agents. Each agent has multiple
 *   capabilities. Without an MCP-compatible Tool Gateway, every
 *   capability needs a custom integration. With this module, every
 *   capability becomes a standardized MCP tool descriptor — any
 *   MCP-aware client (Claude Desktop, ChatGPT plugins, Anthropic's
 *   Computer Use, Aider, the Cursor agentic-IDE, etc.) can discover
 *   and invoke them through a single canonical surface.
 *
 *   The MOAT is in the SCOPE-BASED AUTHORIZATION. Every Sovereign MCP
 *   tool descriptor declares the minimum scope needed to invoke it.
 *   The pure-function authorization mapper (evaluateToolScope below)
 *   takes a caller's claimed scopes and returns a deterministic
 *   allow/deny verdict with named failure reasons. This composes
 *   cleanly with R100 policy gate, R37 ACT capability tokens, and
 *   the R155 HITL routing decision — a tool the caller's scope
 *   doesn't permit gets HITL-escalated rather than silently denied.
 *
 * SCOPE OF THIS MOVE:
 *
 *   This module ships:
 *     - MCPToolDescriptor schema (the canonical "tool card")
 *     - JSON Schema input/output validation primitives
 *     - Scope grammar (resource:action[:qualifier] tuples)
 *     - evaluateToolScope (pure authorization)
 *     - Tool fingerprint (anti-tampering anchor)
 *     - Audit-entry shape for tool invocations
 *
 *   NOT in this move:
 *     - HTTP server / streamable-HTTP transport
 *     - Subprocess MCP server adapter (already in R121 Aider)
 *     - The full MCP request/response runtime
 */

import { createHash } from "node:crypto";

// ── MCP Tool Descriptor schema ────────────────────────────────────

/**
 * The procurement-readable JSON-shape every Sovereign MCP tool
 * exposes. Mirrors the upstream MCP tool descriptor spec but adds
 * Sovereign-specific fields: required scopes, regulatory citation,
 * audit-class hint.
 */
export interface MCPToolDescriptor {
  /** Stable id — kebab-case namespaced (e.g. "finance.reconcile-trades"). */
  id: string;
  /** Display name. */
  name: string;
  /** Procurement-readable description (1-3 sentences). */
  description: string;
  /** JSON Schema for the input arguments (validation primitive only — see schemaShape below). */
  inputSchemaShape: MCPSchemaShape;
  /** JSON Schema for the output. */
  outputSchemaShape: MCPSchemaShape;
  /** Scopes the caller MUST hold to invoke. Empty array = public read. */
  requiredScopes: ReadonlyArray<MCPScope>;
  /** Optional regulatory citation. */
  regulatoryCitation?: string;
  /** Audit class for the R26 chain entry on invocation. */
  auditClass: "internal_read" | "internal_write" | "external_read" | "external_write" | "tool_call";
  /** Optional cost band hint (procurement-readable; cents resolved by R102). */
  costBand?: "free" | "low" | "medium" | "high";
  /** SHA-256 of identity-shaped fields. */
  fingerprint: string;
}

/**
 * A minimal JSON-Schema-compatible shape used for input/output
 * validation. We support the canonical primitive types + object
 * structure. Full JSON Schema $ref / allOf / anyOf intentionally
 * excluded — they introduce non-decidable validation complexity
 * the procurement audience does not need.
 */
export type MCPSchemaShape =
  | { type: "string"; enum?: ReadonlyArray<string>; minLength?: number; maxLength?: number }
  | { type: "number"; minimum?: number; maximum?: number }
  | { type: "boolean" }
  | { type: "null" }
  | { type: "array"; items: MCPSchemaShape; minItems?: number; maxItems?: number }
  | {
      type: "object";
      properties: Record<string, MCPSchemaShape>;
      required?: ReadonlyArray<string>;
      additionalProperties?: boolean;
    };

// ── Scope grammar ─────────────────────────────────────────────────

/**
 * Sovereign MCP scopes follow the grammar:
 *
 *   resource ":" action [ ":" qualifier ]
 *
 * Examples:
 *   "finance:read"
 *   "finance:write:reconciliation"
 *   "commerce:execute:cart"
 *
 * resource and action are lowercase letters/digits/dashes.
 * qualifier is optional, also lowercase letters/digits/dashes.
 */
export type MCPScope = string; // semantic: matches SCOPE_RE below

const SCOPE_RE = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*(?::[a-z][a-z0-9-]*)?$/;

export function isValidScope(scope: string): boolean {
  return SCOPE_RE.test(scope);
}

/**
 * Pure: parse a scope into its 2 or 3 components. Returns null if
 * the scope is malformed.
 */
export function parseScope(
  scope: string,
): { resource: string; action: string; qualifier?: string } | null {
  if (!isValidScope(scope)) return null;
  const parts = scope.split(":");
  return {
    resource: parts[0],
    action: parts[1],
    qualifier: parts[2],
  };
}

// ── Authorization evaluator ───────────────────────────────────────

export interface ScopeEvaluationInput {
  required: ReadonlyArray<MCPScope>;
  granted: ReadonlyArray<MCPScope>;
}

export type ScopeEvaluation =
  | { ok: true; matched: ReadonlyArray<MCPScope> }
  | {
      ok: false;
      reason: "missing_required_scope" | "malformed_required" | "malformed_granted";
      missing: ReadonlyArray<MCPScope>;
      details: string;
    };

/**
 * Pure: deterministic scope evaluator with three semantics:
 *
 *   1. A required scope WITHOUT qualifier ("finance:read") is
 *      satisfied by any granted scope sharing the same
 *      resource:action prefix (granted "finance:read" OR
 *      "finance:read:reports" both satisfy it).
 *
 *   2. A required scope WITH qualifier ("finance:write:reconciliation")
 *      is satisfied ONLY by an exact match OR a wildcard
 *      ("finance:write:*") IF wildcards are supported (this version
 *      does NOT support wildcards; deferred to a future scope move).
 *
 *   3. ALL required scopes must be satisfied — partial-grant fails
 *      with the missing scopes named.
 */
export function evaluateToolScope(
  input: ScopeEvaluationInput,
): ScopeEvaluation {
  for (const r of input.required) {
    if (!isValidScope(r)) {
      return {
        ok: false,
        reason: "malformed_required",
        missing: [],
        details: `required scope ${JSON.stringify(r)} fails grammar`,
      };
    }
  }
  for (const g of input.granted) {
    if (!isValidScope(g)) {
      return {
        ok: false,
        reason: "malformed_granted",
        missing: [],
        details: `granted scope ${JSON.stringify(g)} fails grammar`,
      };
    }
  }

  const matched: MCPScope[] = [];
  const missing: MCPScope[] = [];

  for (const required of input.required) {
    const r = parseScope(required);
    if (!r) {
      // Already handled above; defensive.
      missing.push(required);
      continue;
    }
    let isMatched = false;
    for (const granted of input.granted) {
      const g = parseScope(granted);
      if (!g) continue;
      if (g.resource !== r.resource || g.action !== r.action) continue;
      if (r.qualifier === undefined) {
        // Required has no qualifier — any granted with same resource+action
        // satisfies (qualifier-narrower granted still implies the broader
        // required).
        isMatched = true;
        break;
      }
      // Required has qualifier — granted must match exactly.
      if (g.qualifier === r.qualifier) {
        isMatched = true;
        break;
      }
    }
    if (isMatched) matched.push(required);
    else missing.push(required);
  }

  if (missing.length > 0) {
    return {
      ok: false,
      reason: "missing_required_scope",
      missing,
      details: `caller missing ${missing.length} of ${input.required.length} required scope(s): ${missing.join(", ")}`,
    };
  }
  return { ok: true, matched };
}

// ── Fingerprint + canonical encoding ──────────────────────────────

/**
 * Pure: canonical encoding of identity-shaped fields. Excludes
 * description / costBand / regulatoryCitation (surface-only fields
 * that can change without altering tool identity).
 */
export function canonicalEncodeToolDescriptor(
  args: Omit<MCPToolDescriptor, "fingerprint">,
): string {
  const inputHash = createHash("sha256")
    .update(JSON.stringify(args.inputSchemaShape))
    .digest("hex");
  const outputHash = createHash("sha256")
    .update(JSON.stringify(args.outputSchemaShape))
    .digest("hex");
  const sortedScopes = [...args.requiredScopes].sort().join(",");
  return [
    `id=${args.id}`,
    `name=${args.name}`,
    `auditClass=${args.auditClass}`,
    `requiredScopes=[${sortedScopes}]`,
    `inputSchemaHash=${inputHash}`,
    `outputSchemaHash=${outputHash}`,
  ].join("|");
}

export function computeToolFingerprint(
  args: Omit<MCPToolDescriptor, "fingerprint">,
): string {
  return createHash("sha256")
    .update(canonicalEncodeToolDescriptor(args))
    .digest("hex");
}

export function buildToolDescriptor(
  args: Omit<MCPToolDescriptor, "fingerprint">,
): MCPToolDescriptor {
  return { ...args, fingerprint: computeToolFingerprint(args) };
}

// ── Validation ────────────────────────────────────────────────────

const TOOL_ID_RE = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/;

export type ToolDescriptorValidation =
  | { ok: true }
  | {
      ok: false;
      reason:
        | "invalid_id"
        | "missing_name"
        | "missing_description"
        | "invalid_audit_class"
        | "scope_grammar_violation"
        | "fingerprint_mismatch";
      details: string;
    };

const VALID_AUDIT_CLASSES: ReadonlyArray<MCPToolDescriptor["auditClass"]> = [
  "internal_read",
  "internal_write",
  "external_read",
  "external_write",
  "tool_call",
];

export function validateToolDescriptor(
  desc: MCPToolDescriptor,
): ToolDescriptorValidation {
  if (!desc.id || !TOOL_ID_RE.test(desc.id)) {
    return {
      ok: false,
      reason: "invalid_id",
      details: `id ${JSON.stringify(desc.id)} fails namespaced kebab-case`,
    };
  }
  if (!desc.name || desc.name.trim().length === 0) {
    return { ok: false, reason: "missing_name", details: "name must be non-empty" };
  }
  if (!desc.description || desc.description.trim().length === 0) {
    return { ok: false, reason: "missing_description", details: "description must be non-empty" };
  }
  if (!VALID_AUDIT_CLASSES.includes(desc.auditClass)) {
    return {
      ok: false,
      reason: "invalid_audit_class",
      details: `audit class ${desc.auditClass} not in canonical list`,
    };
  }
  for (const s of desc.requiredScopes) {
    if (!isValidScope(s)) {
      return {
        ok: false,
        reason: "scope_grammar_violation",
        details: `required scope ${JSON.stringify(s)} fails grammar`,
      };
    }
  }
  const expected = computeToolFingerprint(desc);
  if (desc.fingerprint !== expected) {
    return {
      ok: false,
      reason: "fingerprint_mismatch",
      details: `fingerprint ${desc.fingerprint} does not match recomputed ${expected}`,
    };
  }
  return { ok: true };
}

// ── Audit-entry shape ────────────────────────────────────────────

export interface ToolInvocationAuditEntry {
  action: "agent.governance_consult";
  resource: string;
  details: {
    phase: "mcp-tool";
    toolId: string;
    fingerprint: string;
    requiredScopes: ReadonlyArray<MCPScope>;
    grantedScopes: ReadonlyArray<MCPScope>;
    scopeOk: boolean;
    missing?: ReadonlyArray<MCPScope>;
  };
}

export function buildToolInvocationAuditEntry(
  desc: MCPToolDescriptor,
  granted: ReadonlyArray<MCPScope>,
  evaluation: ScopeEvaluation,
): ToolInvocationAuditEntry {
  return {
    action: "agent.governance_consult",
    resource: `mcp-tool:${desc.id}`,
    details: {
      phase: "mcp-tool",
      toolId: desc.id,
      fingerprint: desc.fingerprint,
      requiredScopes: desc.requiredScopes,
      grantedScopes: granted,
      scopeOk: evaluation.ok,
      missing: evaluation.ok ? undefined : evaluation.missing,
    },
  };
}
