/**
 * POST /api/v1/a2a/[peer]
 *
 * Move 19. The A2A request handler that wires R162 cross-protocol-bridge
 * (Move 12) into a real runtime gate. Any peer agent can POST a tool
 * invocation request here. Sovereign:
 *
 *   1. Validates the peer's authentication shape
 *   2. Resolves the requested tool from the platform's MCP descriptor
 *      registry
 *   3. Calls bridgeAuthorization({ peer, tool, policy }) to apply the
 *      least-privilege scope-translation policy
 *   4. On refusal: fires agent.cross_protocol_block on the audit chain
 *      and returns the standard refusal response
 *   5. On grant: returns 501 with a stub indicating the tool would be
 *      dispatched (the actual MCP transport is shipped in a later move)
 *
 * THE STANDARD-SETTING POSTURE
 *
 *   Until this commit, R162 was a library-only primitive. The
 *   `verify-bridge-authorization` verifier endpoint accepted
 *   caller-provided evidence but no path on Sovereign actually
 *   GENERATED such evidence. This route is the generator: every A2A
 *   request produces a real audit entry that the public verifier
 *   surface can replay.
 *
 *   The platform-side bridge POLICY is sourced from a single
 *   constant for now (REFUSE_ALL_POLICY by default — least
 *   privilege). Future: load policy per tenant from DB.
 *
 * SECURITY
 *
 *   - No auth on the route itself: A2A peers authenticate via the
 *     declared scheme in the request body (act-token / oauth2 /
 *     api-key / acat-mandate / mutual-tls). Validation of the
 *     credential's substance is delegated to bridgeAuthorization
 *     via the policy's matchAuthScheme + matchClaim predicates.
 *   - 1MB body cap to prevent DoS.
 *   - CORS open: discovery is public.
 *   - Always-fire audit on refusal — no silent denials.
 */

import { NextResponse } from "next/server";
import {
  bridgeAuthorization,
  REFUSE_ALL_POLICY,
  type BridgeAuthorizationInput,
  type ScopeTranslationPolicy,
} from "@/lib/protocols/cross-protocol-bridge";
import {
  buildToolDescriptor,
  type MCPToolDescriptor,
} from "@/lib/protocols/mcp/tool-descriptor";
import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";

const log = createLogger("v1-a2a");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 1_000_000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
} as const;

function jsonResponse(body: unknown, status: number) {
  return NextResponse.json(body, {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
      ...corsHeaders,
    },
  });
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

/**
 * Resolve the active scope-translation policy. Default = REFUSE_ALL
 * (least privilege). Future: per-tenant policy from DB.
 */
function getActivePolicy(): ScopeTranslationPolicy {
  // Read-only env override for staging / tenant policy testing. The
  // env value is a JSON-encoded array of ScopeTranslationRule. If
  // absent or malformed, fall back to REFUSE_ALL (least privilege).
  const raw = process.env.SOVEREIGN_A2A_POLICY_JSON;
  if (!raw) return REFUSE_ALL_POLICY;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as ScopeTranslationPolicy;
  } catch {
    // Fall through to REFUSE_ALL.
  }
  return REFUSE_ALL_POLICY;
}

/**
 * Resolve the requested MCP tool. For now: a stub catalog with one
 * read-only tool so the wiring is testable. Future: load from a
 * tenant-scoped MCP tool registry table.
 */
function resolveTool(toolId: string): MCPToolDescriptor | null {
  // Stub: a single internal-read tool. Real implementations will
  // index this from the agent registry + per-tenant config.
  if (toolId === "platform.health-check") {
    return buildToolDescriptor({
      id: "platform.health-check",
      name: "Platform health check",
      description: "Returns platform health snapshot",
      inputSchemaShape: { type: "object", properties: {} },
      outputSchemaShape: {
        type: "object",
        properties: { status: { type: "string" } },
      },
      requiredScopes: ["health:read"],
      auditClass: "internal_read",
    });
  }
  return null;
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ peer: string }> },
) {
  const { peer } = await ctx.params;

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return jsonResponse(
      {
        ok: false,
        error: "payload_too_large",
        maxBytes: MAX_BODY_BYTES,
      },
      413,
    );
  }

  let body: {
    peerCard?: { peerId: string; authScheme: string; claims: string[] };
    request?: { toolId: string; args?: Record<string, unknown> };
  };
  try {
    body = JSON.parse(raw);
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        error: "bad_request",
        details: `Body is not valid JSON: ${(err as Error).message}`,
      },
      400,
    );
  }

  if (!body?.peerCard?.peerId || !body?.request?.toolId) {
    return jsonResponse(
      {
        ok: false,
        error: "bad_request",
        details: "Body must include peerCard {peerId, authScheme, claims} + request {toolId}",
      },
      400,
    );
  }

  // Resolve tool. 404 if unknown — leak nothing about the catalog.
  const tool = resolveTool(body.request.toolId);
  if (!tool) {
    return jsonResponse(
      {
        ok: false,
        error: "tool_not_found",
        toolId: body.request.toolId,
      },
      404,
    );
  }

  // Apply R162 cross-protocol bridge.
  const input: BridgeAuthorizationInput = {
    peer: {
      peerId: body.peerCard.peerId,
      authScheme: body.peerCard.authScheme as BridgeAuthorizationInput["peer"]["authScheme"],
      claims: body.peerCard.claims,
    },
    tool,
    policy: getActivePolicy(),
  };

  const decision = bridgeAuthorization(input);

  if (!decision.ok) {
    // Fire R162 audit action. agent.cross_protocol_block is forward-
    // declared in src/lib/audit-log.ts; this is the firing site.
    auditLog({
      userId: "system-a2a",
      action: decision.auditEntry.action,
      resource: decision.auditEntry.resource,
      details: decision.auditEntry.details,
    }).catch(() => {});
    log.info("A2A request refused by R162 bridge", {
      peer,
      peerId: body.peerCard.peerId,
      toolId: tool.id,
      reason: decision.reason,
    });
    return jsonResponse(decision.response, 403);
  }

  // Authorized. Tool dispatch is stubbed — the streamable-HTTP MCP
  // transport (R161) lands in a later move. Return 501 with a clear
  // shape so callers can distinguish "authorized but transport not
  // yet wired" from a real refusal.
  log.info("A2A request authorized; tool dispatch stubbed", {
    peer,
    peerId: body.peerCard.peerId,
    toolId: tool.id,
    grantedScopes: decision.grantedScopes,
  });
  return jsonResponse(
    {
      ok: false,
      error: "tool_dispatch_not_yet_implemented",
      details:
        "R162 bridge granted authorization. MCP streamable-HTTP transport (R161) lands in a later move.",
      authorization: {
        peerId: body.peerCard.peerId,
        toolId: tool.id,
        grantedScopes: decision.grantedScopes,
        matchedRules: decision.matchedRules.map((r) => r.ruleId),
      },
    },
    501,
  );
}
