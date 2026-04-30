/**
 * GET /api/performance/targets
 *
 * PUBLIC, machine-readable Performance Target registry feed. The
 * procurement-grade scoreboard of what "elite" looks like as of
 * 2026 + Sovereign's commitment.
 *
 * Query params:
 *   ?phase=phase-1 | phase-2 | phase-3
 *   ?category=benchmark-coding | benchmark-general | ...
 *   ?verificationKind=independent-replayable | internal-only | claimed-only
 *   ?stats=true     — return registry stats summary
 *
 * Cached 5 minutes — registry contents change only on a deploy.
 */

import { NextResponse } from "next/server";
import {
  DEFAULT_PERFORMANCE_TARGETS,
  listTargets,
  targetRegistryStats,
  type PerformancePhase,
  type PerformanceCategory,
  type VerificationKind,
} from "@/lib/performance";

export const runtime = "nodejs";
export const revalidate = 300;

const VALID_PHASES: ReadonlySet<PerformancePhase> = new Set([
  "phase-1",
  "phase-2",
  "phase-3",
]);
const VALID_CATEGORIES: ReadonlySet<PerformanceCategory> = new Set([
  "benchmark-coding",
  "benchmark-general",
  "benchmark-memory",
  "throughput",
  "latency",
  "messaging",
  "compliance",
]);
const VALID_VERIFICATION: ReadonlySet<VerificationKind> = new Set([
  "independent-replayable",
  "internal-only",
  "claimed-only",
]);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const params = url.searchParams;

  if (params.get("stats") === "true") {
    const stats = targetRegistryStats(DEFAULT_PERFORMANCE_TARGETS);
    return NextResponse.json(
      {
        stats,
        verifierNote:
          "Same pure function as @sovereign/inspector. Registry is the source of truth — every target carries a verificationKind, no exceptions.",
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  }

  const phaseParam = params.get("phase");
  const categoryParam = params.get("category");
  const verificationParam = params.get("verificationKind");

  const filter: Parameters<typeof listTargets>[0] = {};
  if (phaseParam && VALID_PHASES.has(phaseParam as PerformancePhase)) {
    filter.phase = phaseParam as PerformancePhase;
  }
  if (
    categoryParam &&
    VALID_CATEGORIES.has(categoryParam as PerformanceCategory)
  ) {
    filter.category = categoryParam as PerformanceCategory;
  }
  if (
    verificationParam &&
    VALID_VERIFICATION.has(verificationParam as VerificationKind)
  ) {
    filter.verificationKind = verificationParam as VerificationKind;
  }

  const targets = listTargets(filter);
  return NextResponse.json(
    {
      total: targets.length,
      filter,
      targets,
    },
    {
      status: 200,
      headers: {
        "Cache-Control":
          "public, max-age=300, s-maxage=300, stale-while-revalidate=600",
      },
    },
  );
}
