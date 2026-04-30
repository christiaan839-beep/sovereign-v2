/**
 * @sovereign/inspector — R162 Cross-Protocol Privilege Alignment.
 *
 * Pure-function port of src/lib/protocols/cross-protocol-bridge.ts.
 * Auditor uses this module to replay a cross-protocol authorization
 * decision offline and confirm the platform's claim that a tool
 * invocation was either granted (matched rules + sufficient scope)
 * or blocked (no_mapping or scope_missing).
 */

import { evaluateToolScope } from "./mcp.mjs";

export const REFUSE_ALL_POLICY = [];

export function bridgeAuthorization(input) {
  const matchedRules = [];
  const grantedScopes = [];

  for (const rule of input.policy) {
    if (rule.matchAuthScheme !== "*" && rule.matchAuthScheme !== input.peer.authScheme) continue;
    if (!input.peer.claims.includes(rule.matchClaim)) continue;
    if (rule.matchPeerId !== undefined && rule.matchPeerId !== input.peer.peerId) continue;
    matchedRules.push({
      ruleId: rule.id,
      description: rule.description,
      granted: rule.grants,
    });
    for (const g of rule.grants) {
      if (!grantedScopes.includes(g)) grantedScopes.push(g);
    }
  }

  if (matchedRules.length === 0) {
    const reasonText = `peer ${input.peer.peerId} (scheme=${input.peer.authScheme}) presented claims [${input.peer.claims.join(", ")}] but no translation rule matched; least-privilege default refuses tool ${input.tool.id}`;
    return {
      ok: false,
      reason: "no_mapping",
      details: reasonText,
      grantedScopes: [],
      matchedRules: [],
      response: {
        error: "cross_protocol_block",
        peerId: input.peer.peerId,
        toolId: input.tool.id,
        reason: "no_mapping",
        details: reasonText,
      },
      auditEntry: buildBridgeBlockAudit(input, [], [], "no_mapping", reasonText),
    };
  }

  const evaluation = evaluateToolScope({
    required: input.tool.requiredScopes,
    granted: grantedScopes,
  });

  if (!evaluation.ok) {
    const missing = evaluation.missing;
    const detailsText = `peer ${input.peer.peerId} matched ${matchedRules.length} rule(s) yielding scopes [${grantedScopes.join(", ")}] but tool ${input.tool.id} requires ${input.tool.requiredScopes.length} scope(s); missing: ${missing.join(", ")}`;
    return {
      ok: false,
      reason: "scope_missing",
      details: detailsText,
      grantedScopes,
      matchedRules,
      scopeEvaluation: evaluation,
      response: {
        error: "cross_protocol_block",
        peerId: input.peer.peerId,
        toolId: input.tool.id,
        reason: "scope_missing",
        details: detailsText,
      },
      auditEntry: buildBridgeBlockAudit(input, grantedScopes, matchedRules, "scope_missing", detailsText, missing),
    };
  }

  return { ok: true, grantedScopes, matchedRules, scopeEvaluation: evaluation };
}

function buildBridgeBlockAudit(input, grantedScopes, matchedRules, reason, details, missingScopes) {
  return {
    action: "agent.cross_protocol_block",
    resource: `peer:${input.peer.peerId}->mcp-tool:${input.tool.id}`,
    details: {
      peerId: input.peer.peerId,
      toolId: input.tool.id,
      authScheme: input.peer.authScheme,
      requiredScopes: input.tool.requiredScopes,
      grantedScopes,
      matchedRules,
      missingScopes,
      reason,
    },
  };
}

/**
 * Replay-and-confirm helper. Given a claimed bridge decision, re-run
 * locally and confirm.
 */
export function verifyBridgeAuthorization({ input, claimed }) {
  const replay = bridgeAuthorization(input);
  const errors = [];
  if (replay.ok !== claimed.ok) {
    errors.push(`ok mismatch: replay=${replay.ok} claimed=${claimed.ok}`);
  }
  if (!replay.ok && claimed.ok === false) {
    if (replay.reason !== claimed.reason) {
      errors.push(`reason mismatch: replay=${replay.reason} claimed=${claimed.reason}`);
    }
  }
  if (errors.length === 0) return { ok: true, replay };
  return { ok: false, errors, replay };
}
