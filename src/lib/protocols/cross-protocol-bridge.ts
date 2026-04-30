/**
 * R162 CROSS-PROTOCOL PRIVILEGE ALIGNMENT — Move 12 of the proof-
 * conversion arc.
 *
 * Pure-function bridge that prevents A2A→MCP scope-elevation attacks.
 * The threat model is documented in arXiv:2602.11327 (April 2026):
 * MCP uses coarse-grained tokens; A2A uses cross-organizational
 * trust. An agent authenticated through A2A can request MCP tool
 * access at a higher privilege level than intended because the two
 * protocols' trust assumptions don't align.
 *
 *   Concrete attack: peer P presents a valid A2A handshake with
 *   "user" privileges and then invokes Sovereign's "finance:write:*"
 *   tools — the MCP layer accepts because the A2A handshake was OK,
 *   but the MCP tool's required scope was never checked against the
 *   A2A peer's actual authorization profile.
 *
 * THE FIX:
 *
 *   This module is the pure-function bridge between R160 A2A Agent
 *   Card auth + R161 MCP Tool Descriptor scope evaluator. Given:
 *
 *     - the A2A peer's auth profile (scheme + claimed capabilities)
 *     - the MCP tool's required scopes
 *     - an explicit scope-translation policy (operator-supplied)
 *
 *   it produces a DETERMINISTIC mapping of A2A peer claims → MCP
 *   scopes, then runs the standard R161 evaluator over the result.
 *   Default behavior is LEAST-PRIVILEGE: a peer claim must be
 *   explicitly mapped before it grants any MCP scope. No mapping →
 *   no scope. This eliminates the silent privilege-escalation
 *   path the threat-model paper documents.
 *
 *   Every refusal fires the agent.cross_protocol_block audit action
 *   already declared in the audit-log vocabulary on disk (R144,
 *   committed in 6d0511c7).
 *
 * SCOPE OF THIS MOVE:
 *
 *   This module ships:
 *     - PeerAuthProfile schema (A2A auth scheme + claimed
 *       capabilities + verified scopes)
 *     - ScopeTranslationPolicy type (peer-claim → MCP scope grants)
 *     - bridgeAuthorization() pure-function evaluator
 *     - Audit-entry shape for blocks
 *     - 4 typed failure reasons (no_mapping / scope_missing /
 *       claim_unverified / mismatched_scheme)
 *
 *   NOT in this move:
 *     - The actual A2A handshake → MCP session wiring (network layer)
 *     - Operator UI for editing translation policies (admin surface)
 */

import {
  evaluateToolScope,
  type MCPScope,
  type MCPToolDescriptor,
  type ScopeEvaluation,
} from "@/lib/protocols/mcp/tool-descriptor";
import type { A2AAuthScheme } from "@/lib/protocols/a2a/agent-card";

// ── Peer auth profile (the A2A side of the bridge) ───────────────

/**
 * What we know about an A2A peer at the moment they initiate a tool
 * invocation. The auth scheme is whichever they completed during
 * handshake; claimed capabilities are free-form per peer; verified
 * scopes are MCP scopes the operator's translation policy granted
 * to the peer based on those claims.
 */
export interface PeerAuthProfile {
  /** Stable id of the peer agent (matches their Agent Card id). */
  peerId: string;
  /** A2A handshake auth scheme used (e.g. "act-token", "oauth2"). */
  authScheme: A2AAuthScheme;
  /** Free-form claims the peer made during handshake. */
  claims: ReadonlyArray<string>;
  /** Optional ACT chain hash if the peer used Sovereign R37 ACT. */
  actChainHash?: string;
}

// ── Scope translation policy (the operator-supplied bridge) ──────

/**
 * One rule in the operator's translation policy. The condition fires
 * when ALL constraints match the peer profile. On match, the rule
 * grants the named MCP scopes.
 *
 * Conditions:
 *   - authScheme:    must match peer.authScheme (or "*")
 *   - claim:         must appear in peer.claims (literal string match;
 *                    no wildcards — keeps the bridge deterministic
 *                    and easy to audit)
 *   - peerId:        optional — restricts the rule to a specific peer
 *
 * If multiple rules fire, the union of grants applies (operators
 * pre-sort rules by priority and the first-match-wins per resource:
 * action key).
 */
export interface ScopeTranslationRule {
  /** Stable id for audit + rule-trace. */
  id: string;
  /** Procurement-readable description. */
  description: string;
  /** "*" matches any scheme; specific value restricts. */
  matchAuthScheme: A2AAuthScheme | "*";
  /** Required claim string (case-sensitive literal). */
  matchClaim: string;
  /** Optional peer-id restriction. */
  matchPeerId?: string;
  /** MCP scopes this rule grants when all conditions match. */
  grants: ReadonlyArray<MCPScope>;
}

export type ScopeTranslationPolicy = ReadonlyArray<ScopeTranslationRule>;

// ── Bridge evaluation ────────────────────────────────────────────

export interface BridgeAuthorizationInput {
  peer: PeerAuthProfile;
  tool: MCPToolDescriptor;
  policy: ScopeTranslationPolicy;
}

export interface BridgeMatchedRule {
  ruleId: string;
  description: string;
  granted: ReadonlyArray<MCPScope>;
}

export type BridgeAuthorizationResult =
  | {
      ok: true;
      grantedScopes: ReadonlyArray<MCPScope>;
      matchedRules: ReadonlyArray<BridgeMatchedRule>;
      scopeEvaluation: Extract<ScopeEvaluation, { ok: true }>;
    }
  | {
      ok: false;
      reason:
        | "no_mapping"
        | "scope_missing"
        | "claim_unverified"
        | "mismatched_scheme";
      details: string;
      grantedScopes: ReadonlyArray<MCPScope>;
      matchedRules: ReadonlyArray<BridgeMatchedRule>;
      scopeEvaluation?: Extract<ScopeEvaluation, { ok: false }>;
      response: {
        error: "cross_protocol_block";
        peerId: string;
        toolId: string;
        reason: string;
        details: string;
      };
      auditEntry: {
        action: "agent.cross_protocol_block";
        resource: string;
        details: {
          peerId: string;
          toolId: string;
          authScheme: A2AAuthScheme;
          requiredScopes: ReadonlyArray<MCPScope>;
          grantedScopes: ReadonlyArray<MCPScope>;
          matchedRules: ReadonlyArray<BridgeMatchedRule>;
          missingScopes?: ReadonlyArray<MCPScope>;
          reason: string;
        };
      };
    };

/**
 * Pure: evaluate the cross-protocol bridge.
 *
 * Algorithm:
 *   1. Walk the translation policy. For each rule, check:
 *      - matchAuthScheme matches peer.authScheme (or "*")
 *      - matchClaim appears in peer.claims
 *      - matchPeerId (if set) matches peer.peerId
 *      All three must hold for the rule to fire.
 *   2. If NO rule fires → no_mapping (least-privilege default).
 *      The peer has no MCP scopes by default.
 *   3. Aggregate grants from all matched rules (union).
 *   4. Run the R161 scope evaluator: tool.requiredScopes vs grants.
 *      Pass → ok. Fail → scope_missing (named missing scopes).
 */
export function bridgeAuthorization(
  input: BridgeAuthorizationInput,
): BridgeAuthorizationResult {
  const matchedRules: BridgeMatchedRule[] = [];
  const grantedScopes: MCPScope[] = [];

  for (const rule of input.policy) {
    if (
      rule.matchAuthScheme !== "*" &&
      rule.matchAuthScheme !== input.peer.authScheme
    ) {
      continue;
    }
    if (!input.peer.claims.includes(rule.matchClaim)) continue;
    if (
      rule.matchPeerId !== undefined &&
      rule.matchPeerId !== input.peer.peerId
    ) {
      continue;
    }
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
      auditEntry: buildBridgeBlockAudit(
        input,
        [],
        [],
        "no_mapping",
        reasonText,
      ),
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
      auditEntry: buildBridgeBlockAudit(
        input,
        grantedScopes,
        matchedRules,
        "scope_missing",
        detailsText,
        missing,
      ),
    };
  }

  return {
    ok: true,
    grantedScopes,
    matchedRules,
    scopeEvaluation: evaluation,
  };
}

// ── Audit-entry builder (R144 firing module) ─────────────────────

function buildBridgeBlockAudit(
  input: BridgeAuthorizationInput,
  grantedScopes: ReadonlyArray<MCPScope>,
  matchedRules: ReadonlyArray<BridgeMatchedRule>,
  reason: string,
  details: string,
  missingScopes?: ReadonlyArray<MCPScope>,
) {
  return {
    action: "agent.cross_protocol_block" as const,
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

// ── Pre-built translation policy templates ───────────────────────

/**
 * The most conservative possible policy: refuse everything. Useful
 * as a default for new deployments — operators must explicitly
 * grant any cross-protocol bridge mapping. Composes with the
 * least-privilege design.
 */
export const REFUSE_ALL_POLICY: ScopeTranslationPolicy = [];

/**
 * A common pattern: peers that completed Sovereign-to-Sovereign
 * ACT-token handshake with a claim of "sovereign-internal" get
 * unrestricted finance-read access. Operators copy + adapt this
 * template to their own resource taxonomy.
 */
export const SOVEREIGN_INTERNAL_FINANCE_READ: ScopeTranslationRule = {
  id: "sov.internal.finance-read",
  description:
    "Sovereign-to-Sovereign internal calls authenticated via R37 ACT chain may invoke any finance:read tool.",
  matchAuthScheme: "act-token",
  matchClaim: "sovereign-internal",
  grants: ["finance:read"],
};
