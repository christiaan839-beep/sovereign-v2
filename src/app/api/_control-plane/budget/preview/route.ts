/**
 * POST /api/control-plane/budget/preview
 *
 * PUBLIC, no-auth, rate-limited budget preview. Caller passes a
 * spend snapshot; engine returns a procurement-readable per-scope
 * breakdown (tenant / team / agent) with utilization + alert level.
 *
 * Stateless. Useful for CI dashboards and procurement evaluations
 * before adopting Sovereign — they run "what would my budgets look
 * like for this team's typical day?" against synthetic data.
 *
 * Body:
 *   {
 *     tenantId, agentId, teamId?,
 *     tenantSpentCents, tenantCap: BudgetCap,
 *     teamSpentCents?, teamCap?: BudgetCap,
 *     agentSpentCents?, agentCap?: BudgetCap
 *   }
 */

import { NextResponse } from "next/server";
import { headers } from "next/headers";
import {
  previewBudgets,
  type BudgetCap,
} from "@/lib/control-plane/cost-governance";
import { applyRateLimit, rateLimitHeaders } from "@/lib/rate-limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface Body {
  tenantId?: unknown;
  agentId?: unknown;
  teamId?: unknown;
  tenantSpentCents?: unknown;
  tenantCap?: unknown;
  teamSpentCents?: unknown;
  teamCap?: unknown;
  agentSpentCents?: unknown;
  agentCap?: unknown;
}

function isCap(v: unknown): v is BudgetCap {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.capCents === "number" &&
    typeof o.windowStart === "string" &&
    typeof o.windowEnd === "string"
  );
}

export async function POST(request: Request) {
  const hdrs = await headers();
  const ip =
    hdrs.get("x-forwarded-for")?.split(",")[0].trim() ??
    hdrs.get("x-real-ip") ??
    null;
  const rate = await applyRateLimit("/api/_control-plane/budget/preview", {
    ip,
  });
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

  if (
    typeof body.tenantId !== "string" ||
    typeof body.agentId !== "string" ||
    typeof body.tenantSpentCents !== "number" ||
    !isCap(body.tenantCap)
  ) {
    return NextResponse.json(
      {
        error: "bad_request",
        details:
          "Required: tenantId (string), agentId (string), tenantSpentCents (number), tenantCap ({capCents,windowStart,windowEnd})",
      },
      { status: 400 },
    );
  }

  const rows = previewBudgets({
    tenantId: body.tenantId,
    agentId: body.agentId,
    teamId: typeof body.teamId === "string" ? body.teamId : undefined,
    tenantSpentCents: body.tenantSpentCents,
    tenantCap: body.tenantCap,
    teamSpentCents:
      typeof body.teamSpentCents === "number"
        ? body.teamSpentCents
        : undefined,
    teamCap: isCap(body.teamCap) ? body.teamCap : undefined,
    agentSpentCents:
      typeof body.agentSpentCents === "number"
        ? body.agentSpentCents
        : undefined,
    agentCap: isCap(body.agentCap) ? body.agentCap : undefined,
  });

  return NextResponse.json(
    {
      previews: rows,
      verifierNote:
        "Same pure function as @sovereign/inspector. Run locally to confirm.",
    },
    { status: 200 },
  );
}
