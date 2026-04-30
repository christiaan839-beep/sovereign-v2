/**
 * POST /api/edge-nodes/dispatch
 *
 * PUBLIC, no-auth, rate-limited dispatch endpoint. Caller passes a
 * DispatchRequest + the policy + cost decisions they want enforced
 * (the platform also evaluates them via R100 / R102 in production
 * paths, but the public preview honors the caller's inputs so CI
 * pipelines can simulate scenarios).
 *
 * Stateless. The math is the truth — same pure functions shipped
 * in @sovereign/inspector. CI pipelines hit this to verify their
 * routing + preflight logic against synthetic registries.
 *
 * Body shape:
 *   {
 *     request: DispatchRequest,
 *     policy?:  { decision: "allow" | "deny" | "require-act" | "require-acat", reason?: string }
 *     cost?:    { decision: "proceed" | "deny", reason?: string }
 *     persona?: EdgeNodePersona,
 *     deployment?: EdgeNodeDeployment
 *   }
 *
 * Returns:
 *   { decision: RoutingDecision, preflight: Preflight, projectedDispatchResult: DispatchResult }
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  createDefaultEdgeNodeRegistry,
  resolveRouting,
  preflightDispatch,
  buildPreflightFailure,
  type DispatchRequest,
  type EdgeNodeDeployment,
  type EdgeNodePersona,
} from "@/lib/edge-nodes";
import { applyRateLimit, rateLimitHeaders } from "@/lib/rate-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  request?: unknown;
  policy?: unknown;
  cost?: unknown;
  persona?: unknown;
  deployment?: unknown;
}

const VALID_PERSONAS: ReadonlySet<EdgeNodePersona> = new Set([
  "software-engineer",
  "analyst",
  "operator",
  "custom",
]);
const VALID_DEPLOYMENTS: ReadonlySet<EdgeNodeDeployment> = new Set([
  "air-gapped",
  "customer-cloud",
  "managed-cloud",
  "hybrid",
]);

export async function POST(request: Request) {
  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0].trim() ??
    hdrs.get("x-real-ip") ??
    null;
  const rate = await applyRateLimit("/api/_edge-nodes/dispatch", { ip });
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "rate_limited", retryAfterSeconds: rate.resetInSeconds },
      { status: 429, headers: rateLimitHeaders(rate) },
    );
  }

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return NextResponse.json(
      { error: "bad_request", details: "Body must be JSON" },
      { status: 400 },
    );
  }

  if (!body.request || typeof body.request !== "object") {
    return NextResponse.json(
      {
        error: "bad_request",
        details: "`request` (DispatchRequest) is required",
      },
      { status: 400 },
    );
  }

  const dispatchReq = body.request as DispatchRequest;
  if (!dispatchReq.userId || !dispatchReq.capability) {
    return NextResponse.json(
      {
        error: "bad_request",
        details:
          "`request.userId` and `request.capability` are required fields",
      },
      { status: 400 },
    );
  }

  // Default policy/cost: allow / proceed if not provided.
  const policy =
    (body.policy as
      | { decision: "allow" }
      | { decision: "deny"; reason: string }
      | { decision: "require-act" }
      | { decision: "require-acat" }
      | undefined) ?? { decision: "allow" };
  const cost =
    (body.cost as
      | { decision: "proceed" }
      | { decision: "deny"; reason: string }
      | undefined) ?? { decision: "proceed" };

  const personaParam =
    typeof body.persona === "string" &&
    VALID_PERSONAS.has(body.persona as EdgeNodePersona)
      ? (body.persona as EdgeNodePersona)
      : undefined;
  const deploymentParam =
    typeof body.deployment === "string" &&
    VALID_DEPLOYMENTS.has(body.deployment as EdgeNodeDeployment)
      ? (body.deployment as EdgeNodeDeployment)
      : undefined;

  const registry = createDefaultEdgeNodeRegistry();

  // 1. Routing decision.
  const decision = resolveRouting(registry, {
    capability: dispatchReq.capability,
    deployment: deploymentParam,
    persona: personaParam,
  });

  // 2. Preflight gates.
  const preflight = preflightDispatch({
    policy,
    cost,
    request: dispatchReq,
  });

  // 3. Projected result — what dispatch WOULD return if executed.
  let projected;
  if (decision.kind === "no-match") {
    projected = {
      ok: false,
      edgeNodeId: "<none>",
      capability: dispatchReq.capability,
      reason: "edge_node_not_found",
      details: `no Edge Node supports capability '${dispatchReq.capability}'`,
      receiptLine: `[edge-node-dispatch] no node supports ${dispatchReq.capability}`,
    };
  } else if (!preflight.ok) {
    const targetId =
      decision.kind === "route"
        ? decision.target.id
        : decision.kind === "all-stub"
          ? decision.best.id
          : "<none>";
    projected = buildPreflightFailure({
      edgeNodeId: targetId,
      request: dispatchReq,
      preflight,
    });
  } else if (decision.kind === "all-stub") {
    projected = {
      ok: false,
      edgeNodeId: decision.best.id,
      capability: dispatchReq.capability,
      reason: "edge_node_not_configured",
      details: `only stubs available for capability '${dispatchReq.capability}'; configure an upstream integration`,
      receiptLine: `[edge-node-dispatch] only stubs available for ${dispatchReq.capability}`,
    };
  } else {
    // route + preflight ok → real dispatch would run; we only return
    // the projection (this endpoint is preview-only, no live invocation)
    projected = {
      ok: true,
      edgeNodeId: decision.target.id,
      capability: dispatchReq.capability,
      output: { previewOnly: true },
      durationMs: 0,
      costCents: 0,
      receiptLine: `[edge-node-dispatch] preview ok via ${decision.target.id}`,
    };
  }

  return NextResponse.json(
    {
      decision,
      preflight,
      projectedDispatchResult: projected,
      verifierNote:
        "Same pure function as @sovereign/inspector and src/lib/edge-nodes/. This endpoint is PREVIEW-ONLY — it does NOT invoke any Edge Node. Real dispatch routes through the agent factory + R26 audit pipeline.",
    },
    { status: 200 },
  );
}
