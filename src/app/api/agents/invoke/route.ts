/**
 * POST /api/agents/invoke
 *
 * Body: { agent: "<slug or uuid>", input: "<user query>", maxTokens?: number }
 *
 * Public endpoint (no auth required) — invocations are free to the
 * buyer in v1 since end-user billing via Stripe Connect is still
 * pending. Rate limited per IP to prevent abuse.
 *
 * Error-code → HTTP map:
 *   not_found          404
 *   not_live           403
 *   bad_input          400
 *   no_db              503
 *   upstream_failed    502
 *   unknown            500
 */

import { NextResponse } from "next/server";
import {
  checkIpRateLimit,
  extractClientIp,
} from "@/lib/api-guard";
import {
  invokeMarketplaceAgent,
  type InvokeErrorCode,
} from "@/lib/marketplace-invoke";

const ERROR_HTTP: Record<InvokeErrorCode, number> = {
  bad_input: 400,
  not_found: 404,
  not_live: 403,
  no_db: 503,
  upstream_failed: 502,
  unknown: 500,
};

export async function POST(request: Request): Promise<Response> {
  // Rate limit: 30 invocations / minute / IP. Generous enough for
  // live playground demos, tight enough to block crawlers.
  const ip = extractClientIp(request.headers);
  const gate = checkIpRateLimit(ip, {
    bucket: "marketplace-invoke",
    windowMs: 60_000,
    max: 30,
  });
  if (!gate.allowed) {
    return NextResponse.json(
      {
        ok: false,
        error: "Rate limited — try again in a minute.",
        code: "rate_limited",
      },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(Math.ceil(gate.resetIn / 1000)),
        },
      },
    );
  }

  let body: { agent?: unknown; input?: unknown; maxTokens?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { ok: false, error: "Invalid JSON body", code: "bad_input" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const agent = typeof body.agent === "string" ? body.agent.trim() : "";
  const input = typeof body.input === "string" ? body.input : "";
  const maxTokens =
    typeof body.maxTokens === "number" ? body.maxTokens : undefined;

  if (!agent) {
    return NextResponse.json(
      { ok: false, error: "'agent' (slug or uuid) is required", code: "bad_input" },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const result = await invokeMarketplaceAgent({
    agentIdOrSlug: agent,
    input,
    maxTokens,
  });

  if (result.ok) {
    return NextResponse.json(result, {
      status: 200,
      headers: { "Cache-Control": "no-store" },
    });
  }

  const status = ERROR_HTTP[result.code] ?? 500;
  return NextResponse.json(
    { ok: false, error: result.message, code: result.code },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}
