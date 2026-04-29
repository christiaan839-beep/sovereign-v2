/**
 * GET /api/identity/reputation/[agentId]/federated
 *
 * Round 50 — federated reputation endpoint. Composes the local
 * reputation grade (R40) with reputation reports fetched from every
 * known federation peer (discovered via /.well-known/sovereign-trust
 * shipped in R36).
 *
 * Returns:
 *   - federated grade (worst-of across instances — conservative)
 *   - median numeric score
 *   - per-instance breakdown (so verifiers can recompute)
 *   - "concerning instances" list (anything below B-)
 *   - procurement-readable summary
 *
 * No auth — federated reputation is public-by-design.
 *
 * Cached 1 hour. Federation queries fan out to peers in parallel
 * with bounded timeouts; one slow peer cannot stall the response.
 */

import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import {
  aggregateFederatedReputation,
  summarizeFederationCoverage,
  type InstanceReputationReport,
} from "@/lib/federation/cross-instance-reputation";
import type { LetterGrade } from "@/lib/agent-reputation";
import { createLogger } from "@/lib/logger";

const log = createLogger("identity-reputation-federated");

export const runtime = "nodejs";
export const revalidate = 3600;

// Hard timeout per peer fetch — one slow peer must not stall the
// federation response. R48 circuit breakers handle the
// availability case longer-term.
const PEER_FETCH_TIMEOUT_MS = 5000;

/**
 * Per-deploy federation peer list.
 *
 * Operators set SOVEREIGN_FEDERATION_PEERS as a comma-separated
 * list of deployment URLs. Empty / unset = local-only (R50 still
 * works; just returns single-instance results).
 *
 * Future R51+ will discover peers automatically via
 * /.well-known/sovereign-trust crawl.
 */
function getFederationPeers(): string[] {
  const raw = process.env.SOVEREIGN_FEDERATION_PEERS ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

/**
 * Fetch a peer's reputation for the given agent. Returns null on
 * any failure (timeout, 4xx, 5xx, network) — federation must be
 * fail-soft. The aggregator handles missing data correctly.
 */
async function fetchPeerReputation(
  peerUrl: string,
  agentId: string,
): Promise<InstanceReputationReport | null> {
  try {
    const url = `${peerUrl}/api/identity/reputation/${encodeURIComponent(agentId)}`;
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(PEER_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.reputation) {
      return {
        deploymentUrl: peerUrl,
        agentId,
        letterGrade: "no_score_yet",
        numericScore: 0,
        computedAt: new Date(0).toISOString(),
      };
    }
    return {
      deploymentUrl: peerUrl,
      agentId,
      letterGrade: data.reputation.letterGrade as LetterGrade,
      numericScore: data.reputation.numericScore,
      computedAt: data.reputation.computedAt,
    };
  } catch (err) {
    log.warn("Federation peer fetch failed", {
      peer: peerUrl,
      agentId,
      error: String(err),
    });
    return null;
  }
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;
  if (!agentId || agentId.length > 200) {
    return NextResponse.json({ error: "Invalid agent id" }, { status: 400 });
  }

  // 1. Read the LOCAL reputation row.
  let localReport: InstanceReputationReport | null = null;
  if (process.env.DATABASE_URL) {
    try {
      const { db } = await import("@/db");
      const { agentReputationScores } = await import("@/db/schema");
      const rows = await db
        .select()
        .from(agentReputationScores)
        .where(eq(agentReputationScores.agentId, agentId))
        .limit(1);
      const r = rows[0];
      const localUrl = new URL(req.url).origin;
      if (r) {
        localReport = {
          deploymentUrl: localUrl,
          agentId,
          letterGrade: r.letterGrade as LetterGrade,
          numericScore: r.numericScore,
          computedAt: r.computedAt.toISOString(),
        };
      } else {
        localReport = {
          deploymentUrl: localUrl,
          agentId,
          letterGrade: "no_score_yet",
          numericScore: 0,
          computedAt: new Date(0).toISOString(),
        };
      }
    } catch (err) {
      log.warn("Local reputation read failed", { agentId, error: String(err) });
    }
  }

  // 2. Fan out to peers in parallel (bounded by per-peer timeout).
  const peers = getFederationPeers();
  const peerReports = await Promise.all(
    peers.map((p) => fetchPeerReputation(p, agentId)),
  );

  // 3. Combine + aggregate.
  const allReports: InstanceReputationReport[] = [
    ...(localReport ? [localReport] : []),
    ...peerReports.filter((r): r is InstanceReputationReport => r !== null),
  ];

  const federation = aggregateFederatedReputation({
    agentId,
    reports: allReports,
  });

  return NextResponse.json(
    {
      agentId,
      federation,
      summary: summarizeFederationCoverage(federation),
      peersAttempted: peers.length + (localReport ? 1 : 0),
      peersResponded: allReports.length,
      verificationNote:
        "Aggregation is a pure function; @sovereign/inspector can recompute " +
        "this federated grade locally from the per-instance reports. " +
        "Worst-of-across-instances is the conservative aggregation rule.",
      peersConfiguredVia: "SOVEREIGN_FEDERATION_PEERS env var (comma-separated)",
    },
    {
      status: 200,
      headers: {
        "Cache-Control":
          "public, max-age=3600, s-maxage=3600, stale-while-revalidate=14400",
      },
    },
  );
}
