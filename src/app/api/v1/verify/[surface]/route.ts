/**
 * POST /api/v1/verify/[surface]
 *
 * R162+ — Move 14. Public verifier endpoint that turns every
 * @sovereign/inspector subcommand into a curl-able HTTP route.
 * The standard-setting move: anyone with `curl` can verify our
 * trust claims without trusting us.
 *
 * NO AUTH REQUIRED. This endpoint accepts caller-provided evidence
 * and replays it through the platform's pure-function verifiers.
 * It reveals nothing secret — every input must be supplied by the
 * caller; we don't fetch any internal state.
 *
 * SURFACES (one verifier per protocol primitive):
 *
 *   audit-chain        — POST { rows: AuditChainRow[] }
 *                        Verifies SHA-256 hash chain (R26)
 *   agent-card         — POST { card: A2AAgentCard }
 *                        Validates structure + fingerprint (R160)
 *   aibom              — POST { doc: AIBOMDocument, blocklist? }
 *                        Validates supply-chain manifest (R150)
 *   scope-evaluation   — POST { required: string[], granted: string[] }
 *                        MCP scope grammar evaluation (R161)
 *   bridge-authorization — POST { input, claimed }
 *                        Replays cross-protocol bridge decision (R162)
 *   memory-payload     — POST { content: string }
 *                        Scans for embedded instruction patterns (R145)
 *
 * RESPONSE SHAPE (uniform across surfaces):
 *
 *   200 { ok: boolean, surface: string, ...verifierFields }
 *   400 { ok: false, error: "bad_request", details: string }
 *   404 { ok: false, error: "unknown_surface", surfaces: string[] }
 *   413 { ok: false, error: "payload_too_large", maxBytes: number }
 *
 * RATE LIMITING: not in this commit. Body size cap (1 MB) +
 * computationally bounded verifiers make this self-throttling.
 * Future: add the existing rate-limit middleware once usage is real.
 *
 * CORS: open. Discovery + verification are public-good services.
 *
 * STANDARD-SETTING POSTURE:
 *
 *   This is the procurement-grade differentiator. CrewAI / Lindy /
 *   n8n / Manus do not publish endpoints like this. After this ships,
 *   "auditor can re-verify trust claims with a single curl" becomes
 *   the bar.
 */

import { NextResponse } from "next/server";
import {
  validateAgentCard,
  type A2AAgentCard,
} from "@/lib/protocols/a2a/agent-card";
import {
  validateAIBOMDocument,
  checkVulnerabilityBlocklist,
  type AIBOMDocument,
} from "@/lib/supply-chain/aibom";
import {
  evaluateToolScope,
  isValidScope,
} from "@/lib/protocols/mcp/tool-descriptor";
import {
  bridgeAuthorization,
  type BridgeAuthorizationInput,
} from "@/lib/protocols/cross-protocol-bridge";
import { scanForEmbeddedInstructions } from "@/lib/memory/payload-guard";
import {
  verifyAuditChainRows,
  type AuditChainRow,
} from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";

const log = createLogger("v1-verify");

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 1 MB cap. Larger payloads return 413; this protects against DoS. */
const MAX_BODY_BYTES = 1_000_000;

const KNOWN_SURFACES = [
  "audit-chain",
  "agent-card",
  "aibom",
  "scope-evaluation",
  "bridge-authorization",
  "memory-payload",
] as const;

type KnownSurface = (typeof KNOWN_SURFACES)[number];

function isKnownSurface(s: string): s is KnownSurface {
  return (KNOWN_SURFACES as readonly string[]).includes(s);
}

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
 * GET returns a self-describing index of available surfaces. Useful
 * for `curl https://.../api/v1/verify/index` clients.
 */
export async function GET(
  _req: Request,
  ctx: { params: Promise<{ surface: string }> },
) {
  const { surface } = await ctx.params;
  if (surface === "index") {
    return jsonResponse(
      {
        ok: true,
        surfaces: KNOWN_SURFACES,
        usage: "POST /api/v1/verify/<surface> with JSON body. See docs.",
        docs: "https://github.com/christiaan839-beep/sovereign-v2/tree/main/packages/inspector",
      },
      200,
    );
  }
  return jsonResponse(
    {
      ok: false,
      error: "method_not_allowed",
      details: "Use POST. Try GET /api/v1/verify/index for surface list.",
    },
    405,
  );
}

export async function POST(
  req: Request,
  ctx: { params: Promise<{ surface: string }> },
) {
  const { surface } = await ctx.params;

  if (!isKnownSurface(surface)) {
    return jsonResponse(
      {
        ok: false,
        error: "unknown_surface",
        surfaces: KNOWN_SURFACES,
      },
      404,
    );
  }

  // Body-size guard. Read raw text first so we can reject huge bodies
  // BEFORE JSON.parse (which would still allocate the full string).
  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return jsonResponse(
      {
        ok: false,
        error: "payload_too_large",
        maxBytes: MAX_BODY_BYTES,
        receivedBytes: raw.length,
      },
      413,
    );
  }

  let body: unknown;
  try {
    body = raw.length === 0 ? {} : JSON.parse(raw);
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

  log.info("verifier invoked", {
    surface,
    bodyBytes: raw.length,
  });

  try {
    switch (surface) {
      case "audit-chain":
        return jsonResponse(handleAuditChain(body), 200);
      case "agent-card":
        return jsonResponse(handleAgentCard(body), 200);
      case "aibom":
        return jsonResponse(handleAIBOM(body), 200);
      case "scope-evaluation":
        return jsonResponse(handleScopeEvaluation(body), 200);
      case "bridge-authorization":
        return jsonResponse(handleBridgeAuthorization(body), 200);
      case "memory-payload":
        return jsonResponse(handleMemoryPayload(body), 200);
    }
  } catch (err) {
    log.error("verifier surface threw", {
      surface,
      err: (err as Error).message,
    });
    return jsonResponse(
      {
        ok: false,
        surface,
        error: "verifier_error",
        details: (err as Error).message,
      },
      400,
    );
  }
}

// ── Surface handlers (each is pure-function-shaped) ───────────────

function handleAuditChain(body: unknown) {
  const b = body as { rows?: AuditChainRow[] };
  if (!b || !Array.isArray(b.rows)) {
    throw new Error("audit-chain requires { rows: AuditChainRow[] }");
  }
  const result = verifyAuditChainRows(b.rows);
  return { ok: result.valid, surface: "audit-chain", ...result };
}

function handleAgentCard(body: unknown) {
  const b = body as { card?: A2AAgentCard };
  if (!b || !b.card) {
    throw new Error("agent-card requires { card: A2AAgentCard }");
  }
  const v = validateAgentCard(b.card);
  if (v.ok) {
    return { ok: true, surface: "agent-card", fingerprint: b.card.fingerprint };
  }
  return {
    ok: false,
    surface: "agent-card",
    reason: v.reason,
    details: v.details,
  };
}

function handleAIBOM(body: unknown) {
  const b = body as { doc?: AIBOMDocument; blocklist?: string[] };
  if (!b || !b.doc) {
    throw new Error("aibom requires { doc: AIBOMDocument, blocklist? }");
  }
  const v = validateAIBOMDocument(b.doc);
  if (!v.ok) {
    return {
      ok: false,
      surface: "aibom",
      reason: v.reason,
      details: v.details,
    };
  }
  let blocklistMatches: ReturnType<typeof checkVulnerabilityBlocklist> | null =
    null;
  if (Array.isArray(b.blocklist) && b.blocklist.length > 0) {
    blocklistMatches = checkVulnerabilityBlocklist({
      doc: b.doc,
      blocklist: b.blocklist,
    });
    if (!blocklistMatches.ok) {
      return {
        ok: false,
        surface: "aibom",
        reason: "blocklist_match",
        blocklistMatches: blocklistMatches.matched,
      };
    }
  }
  return {
    ok: true,
    surface: "aibom",
    documentHash: b.doc.documentHash,
    componentCount: b.doc.components.length,
    relationshipCount: b.doc.relationships.length,
    blocklistChecked: blocklistMatches !== null,
  };
}

function handleScopeEvaluation(body: unknown) {
  const b = body as { required?: string[]; granted?: string[] };
  if (!b || !Array.isArray(b.required) || !Array.isArray(b.granted)) {
    throw new Error(
      "scope-evaluation requires { required: string[], granted: string[] }",
    );
  }
  // Quick syntactic gate so callers get a clean error when a scope
  // doesn't match the resource:action[:qualifier] grammar (R161).
  for (const s of [...b.required, ...b.granted]) {
    if (!isValidScope(s)) {
      throw new Error(
        `Invalid scope ${JSON.stringify(s)} — must match resource:action[:qualifier]`,
      );
    }
  }
  const r = evaluateToolScope({ required: b.required, granted: b.granted });
  return { surface: "scope-evaluation", ...r };
}

function handleBridgeAuthorization(body: unknown) {
  const b = body as {
    input?: BridgeAuthorizationInput;
    claimed?: { ok: boolean; reason?: string };
  };
  if (!b || !b.input || !b.claimed) {
    throw new Error(
      "bridge-authorization requires { input: BridgeAuthorizationInput, claimed: { ok, reason? } }",
    );
  }
  const replay = bridgeAuthorization(b.input);
  const errors: string[] = [];
  if (replay.ok !== b.claimed.ok) {
    errors.push(
      `ok mismatch: replay=${replay.ok} claimed=${b.claimed.ok}`,
    );
  }
  if (!replay.ok && b.claimed.ok === false) {
    if (replay.reason !== b.claimed.reason) {
      errors.push(
        `reason mismatch: replay=${replay.reason} claimed=${b.claimed.reason}`,
      );
    }
  }
  return {
    ok: errors.length === 0,
    surface: "bridge-authorization",
    errors: errors.length > 0 ? errors : undefined,
    replay: {
      ok: replay.ok,
      reason: replay.ok === false ? replay.reason : undefined,
    },
  };
}

function handleMemoryPayload(body: unknown) {
  const b = body as { content?: string };
  if (!b || typeof b.content !== "string") {
    throw new Error("memory-payload requires { content: string }");
  }
  const scan = scanForEmbeddedInstructions(b.content);
  return {
    ok: !scan.blocked,
    surface: "memory-payload",
    blocked: scan.blocked,
    findings: scan.findings,
    summary: scan.summary,
  };
}
