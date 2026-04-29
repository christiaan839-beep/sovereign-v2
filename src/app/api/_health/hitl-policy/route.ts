/**
 * GET /api/health/hitl-policy
 *
 * PUBLIC, no-auth endpoint exposing the platform's multi-stage HITL
 * routing rules as a procurement audit artifact.
 *
 * Procurement teams reviewing the platform want to see WHAT triggers
 * human review and WHICH approval chain fires. This endpoint returns
 * the rules in a machine-readable form that can be diff'd against
 * past versions.
 *
 * SECURITY: the rules array is part of the source code (not secret).
 * The match() function bodies are stringified with `.toString()` so
 * a procurement reviewer can see EXACTLY the predicate logic.
 *
 * Cached 5 min — rules change only on a deploy.
 */

import { NextResponse } from "next/server";
import { HITL_ROUTING_RULES } from "@/lib/hitl-routing-rules";

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET() {
  const rules = HITL_ROUTING_RULES.map((r) => ({
    name: r.name,
    rationale: r.rationale ?? null,
    // Stringify the match function so the predicate is auditable
    // by external reviewers without needing source access.
    matchSource: r.match.toString(),
    stages: r.stages.map((s) => ({
      role: s.role,
      timeoutSeconds: s.timeoutSeconds,
    })),
  }));
  return NextResponse.json(
    {
      rules,
      ruleCount: rules.length,
      note: "Multi-stage HITL routing policy. Rules evaluate top-to-bottom; first match wins. Default (no match) = no HITL. Tenant-Enterprise+ can override via tenant-policy-resolver.",
      shippedIn: "R33",
      auditFile: "src/lib/hitl-routing-rules.ts",
      generatedAt: new Date().toISOString(),
    },
    {
      status: 200,
      headers: {
        "Cache-Control":
          "public, max-age=300, s-maxage=300, stale-while-revalidate=900",
      },
    },
  );
}
