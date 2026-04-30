/**
 * @sovereign/inspector — R161 MCP Tool Gateway (Move 11).
 *
 * Pure-function port of src/lib/protocols/mcp/tool-descriptor.ts. An
 * MCP-aware client (Claude Desktop, ChatGPT, Cursor, etc.) fetching
 * a Sovereign tool descriptor uses this module to verify offline
 * that the descriptor is internally consistent + the fingerprint
 * matches the canonical encoding of identity-shaped fields, AND to
 * replay scope-authorization decisions deterministically.
 */

import { createHash } from "node:crypto";

const SCOPE_RE = /^[a-z][a-z0-9-]*:[a-z][a-z0-9-]*(?::[a-z][a-z0-9-]*)?$/;
const TOOL_ID_RE = /^[a-z][a-z0-9-]*(?:\.[a-z][a-z0-9-]*)*$/;

const VALID_AUDIT_CLASSES = [
  "internal_read",
  "internal_write",
  "external_read",
  "external_write",
  "tool_call",
];

export function isValidScope(scope) {
  return SCOPE_RE.test(scope);
}

export function parseScope(scope) {
  if (!isValidScope(scope)) return null;
  const parts = scope.split(":");
  return { resource: parts[0], action: parts[1], qualifier: parts[2] };
}

export function evaluateToolScope({ required, granted }) {
  for (const r of required) {
    if (!isValidScope(r)) {
      return {
        ok: false,
        reason: "malformed_required",
        missing: [],
        details: `required scope ${JSON.stringify(r)} fails grammar`,
      };
    }
  }
  for (const g of granted) {
    if (!isValidScope(g)) {
      return {
        ok: false,
        reason: "malformed_granted",
        missing: [],
        details: `granted scope ${JSON.stringify(g)} fails grammar`,
      };
    }
  }

  const matched = [];
  const missing = [];
  for (const req of required) {
    const r = parseScope(req);
    if (!r) {
      missing.push(req);
      continue;
    }
    let isMatched = false;
    for (const grant of granted) {
      const g = parseScope(grant);
      if (!g) continue;
      if (g.resource !== r.resource || g.action !== r.action) continue;
      if (r.qualifier === undefined) {
        isMatched = true;
        break;
      }
      if (g.qualifier === r.qualifier) {
        isMatched = true;
        break;
      }
    }
    if (isMatched) matched.push(req);
    else missing.push(req);
  }

  if (missing.length > 0) {
    return {
      ok: false,
      reason: "missing_required_scope",
      missing,
      details: `caller missing ${missing.length} of ${required.length} scope(s): ${missing.join(", ")}`,
    };
  }
  return { ok: true, matched };
}

export function canonicalEncodeToolDescriptor(args) {
  const inputHash = createHash("sha256").update(JSON.stringify(args.inputSchemaShape)).digest("hex");
  const outputHash = createHash("sha256").update(JSON.stringify(args.outputSchemaShape)).digest("hex");
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

export function computeToolFingerprint(args) {
  return createHash("sha256").update(canonicalEncodeToolDescriptor(args)).digest("hex");
}

export function validateToolDescriptor(desc) {
  if (!desc.id || !TOOL_ID_RE.test(desc.id)) {
    return { ok: false, reason: "invalid_id", details: `id ${JSON.stringify(desc.id)} fails namespaced kebab-case` };
  }
  if (!desc.name || desc.name.trim().length === 0) {
    return { ok: false, reason: "missing_name", details: "name must be non-empty" };
  }
  if (!desc.description || desc.description.trim().length === 0) {
    return { ok: false, reason: "missing_description", details: "description must be non-empty" };
  }
  if (!VALID_AUDIT_CLASSES.includes(desc.auditClass)) {
    return { ok: false, reason: "invalid_audit_class", details: `${desc.auditClass} not canonical` };
  }
  for (const s of desc.requiredScopes) {
    if (!isValidScope(s)) {
      return { ok: false, reason: "scope_grammar_violation", details: `${JSON.stringify(s)} fails grammar` };
    }
  }
  const expected = computeToolFingerprint(desc);
  if (desc.fingerprint !== expected) {
    return { ok: false, reason: "fingerprint_mismatch", details: `${desc.fingerprint} !== ${expected}` };
  }
  return { ok: true };
}

/**
 * Replay-and-confirm helper: given a claimed scope evaluation result
 * (e.g. from an audit entry) and the same inputs, verify the result
 * is reproducible.
 */
export function verifyScopeEvaluation({ required, granted, claimed }) {
  const replay = evaluateToolScope({ required, granted });
  if (replay.ok !== claimed.ok) {
    return {
      ok: false,
      errors: [`ok mismatch: replay=${replay.ok} claimed=${claimed.ok}`],
      replay,
    };
  }
  if (!replay.ok && claimed.ok === false) {
    const replayMissing = new Set(replay.missing ?? []);
    const claimedMissing = new Set(claimed.missing ?? []);
    const errors = [];
    for (const m of replayMissing) {
      if (!claimedMissing.has(m)) errors.push(`replay missing ${m} not in claimed`);
    }
    for (const m of claimedMissing) {
      if (!replayMissing.has(m)) errors.push(`claimed missing ${m} not in replay`);
    }
    if (errors.length > 0) return { ok: false, errors, replay };
  }
  return { ok: true, replay };
}
