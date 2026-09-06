/**
 * GET /api/me/audit-bundle — full signed evidence pack of the
 * caller's receipt history.
 *
 * The artifact compliance teams + auditors actually want: ONE
 * downloadable file that contains every receipt they care about,
 * a Merkle root that ties them together, and a Sovereign signature
 * over the root.
 *
 * Response: application/json with Content-Disposition: attachment.
 * Default range: all receipts the caller owns. Optional ?since=ISO
 * + ?until=ISO query params clip the window — useful for monthly
 * audit cycles.
 *
 * Schema:
 *   {
 *     bundleVersion: 1,
 *     issuer: { name, baseUrl },
 *     subject: { userId },
 *     range: { since, until },
 *     receipts: [ { id, agentName, modelUsed, signature, ... } ],
 *     chainRoot: { envelope, canonical, signature },
 *   }
 *
 * A consumer verifies the bundle by:
 *   1. POSTing chainRoot.canonical + signature to /api/verify
 *   2. Recomputing the Merkle root over the receipts[] array using
 *      the algorithm in src/lib/receipt-chain.ts (canonical + open-
 *      source — see packages/vaos-verifier for the JS impl)
 *   3. Asserting the recomputed root matches chainRoot.envelope.root
 *
 * Auth: requires the caller's session AND the `auditLogExport`
 * entitlement (Node tier and above). Receipts in the bundle are
 * scoped to the caller. Bundle generation is audit-logged so the
 * call itself becomes a receipt of the caller having pulled their
 * own history.
 *
 * The entitlement gates the *signed evidence pack* — a commercial
 * compliance artifact — not the data-subject access right. The
 * statutory right of access stays ungated at /api/data-export and
 * /api/dsar for every user on every plan; do not gate those.
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { agentRuns } from "@/db/schema";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import { buildSignedChainRoot } from "@/lib/receipt-chain";
import { requireEntitlement } from "@/lib/plan-enforcement";
import { auditLog } from "@/lib/audit-log";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/me/audit-bundle");

const HARD_CAP_RECEIPTS = 10_000;

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}

function parseDate(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const gate = await requireEntitlement(userId, "auditLogExport");
  if (!gate.allowed) {
    return NextResponse.json(
      {
        error: gate.message,
        requiredPlan: gate.requiredPlan,
        upgradeUrl: gate.upgradeUrl,
        dataSubjectAccess: "/api/data-export",
      },
      { status: 402 },
    );
  }

  const url = new URL(req.url);
  const since = parseDate(url.searchParams.get("since"));
  const until = parseDate(url.searchParams.get("until"));

  const filters = [eq(agentRuns.userId, userId)];
  if (since) filters.push(gte(agentRuns.createdAt, since));
  if (until) filters.push(lte(agentRuns.createdAt, until));

  let rows: Array<{
    id: string;
    agentName: string;
    modelUsed: string;
    inputJson: string;
    outputJson: string;
    safetyResult: string;
    durationMs: number;
    chainDepth: number;
    trustDecision: string;
    visibility: string;
    signature: string;
    createdAt: Date | null;
  }> = [];

  try {
    rows = await db
      .select({
        id: agentRuns.id,
        agentName: agentRuns.agentName,
        modelUsed: agentRuns.modelUsed,
        inputJson: agentRuns.inputJson,
        outputJson: agentRuns.outputJson,
        safetyResult: agentRuns.safetyResult,
        durationMs: agentRuns.durationMs,
        chainDepth: agentRuns.chainDepth,
        trustDecision: agentRuns.trustDecision,
        visibility: agentRuns.visibility,
        signature: agentRuns.signature,
        createdAt: agentRuns.createdAt,
      })
      .from(agentRuns)
      .where(and(...filters))
      .orderBy(asc(agentRuns.createdAt))
      .limit(HARD_CAP_RECEIPTS);
  } catch (err) {
    log.warn("audit-bundle query failed — returning empty bundle", {
      error: err instanceof Error ? err.message : String(err),
    });
    rows = [];
  }

  const receipts = rows.map((r) => ({
    id: r.id,
    agentName: r.agentName,
    modelUsed: r.modelUsed,
    input: safeParse(r.inputJson),
    output: safeParse(r.outputJson),
    safetyResult: safeParse(r.safetyResult),
    durationMs: r.durationMs,
    chainDepth: r.chainDepth,
    trustDecision: r.trustDecision,
    visibility: r.visibility,
    signature: r.signature,
    createdAt: r.createdAt?.toISOString() ?? new Date(0).toISOString(),
  }));

  const chainRoot = buildSignedChainRoot(
    receipts.map((r) => ({
      id: r.id,
      signature: r.signature,
      createdAt: r.createdAt,
    })),
  );

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    "https://sovereignmatrix.agency";

  const bundle = {
    bundleVersion: 1 as const,
    issuer: { name: "Sovereign Matrix", baseUrl },
    subject: { userId },
    range: {
      since: since?.toISOString() ?? null,
      until: until?.toISOString() ?? null,
    },
    truncated: rows.length === HARD_CAP_RECEIPTS,
    receipts,
    chainRoot,
    spec: {
      receiptFormat: "VAOS 1.0",
      receiptSpec: `${baseUrl}/spec`,
      verifyEndpoint: `${baseUrl}/api/verify`,
    },
  };

  // Audit-log the bundle pull. Per GDPR Art. 15 / POPIA s. 23,
  // every right-of-access fulfillment is itself a logged event.
  auditLog({
    userId,
    action: "data.audit-bundle",
    resource: "agent_runs",
    details: {
      count: receipts.length,
      since: since?.toISOString() ?? null,
      until: until?.toISOString() ?? null,
    },
  }).catch(() => {});

  const filename = `sovereign-audit-bundle-${userId.slice(0, 8)}-${new Date()
    .toISOString()
    .slice(0, 10)}.json`;

  return new NextResponse(JSON.stringify(bundle, null, 2), {
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
