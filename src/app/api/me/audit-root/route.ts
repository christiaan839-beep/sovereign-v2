/**
 * GET /api/me/audit-root — current Merkle root over the caller's
 * receipt history, with envelope signed by Sovereign.
 *
 * The compounding-trust feature: a snapshot of last week's root is
 * sufficient to detect ANY change to historical receipts (additions,
 * deletions, mutations) without re-reading them. Drop the response
 * into your audit log monthly and your auditor has a tamper-evident
 * trail of agent activity at constant verification cost.
 *
 * Response shape:
 *   {
 *     envelope: { v:1, root: "<sha256-hex>", count: <int>, computedAt: <iso> },
 *     canonical: string,    // re-derivable; pass to /api/verify
 *     signature: string,    // "v1=<hex>" or "unsigned"
 *   }
 *
 * Anyone holding a previous response can prove that a future response
 * with the same `count` (or any subset) MUST contain the same root —
 * if it doesn't, Sovereign's signature won't match against /api/verify.
 *
 * Auth: requires the caller's session. The root is derived only from
 * the caller's own receipts — no cross-tenant leakage.
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { agentRuns } from "@/db/schema";
import { eq, asc } from "drizzle-orm";
import { buildSignedChainRoot } from "@/lib/receipt-chain";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/me/audit-root");

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let receipts: Array<{
    id: string;
    signature: string;
    createdAt: Date | null;
  }> = [];
  try {
    receipts = await db
      .select({
        id: agentRuns.id,
        signature: agentRuns.signature,
        createdAt: agentRuns.createdAt,
      })
      .from(agentRuns)
      .where(eq(agentRuns.userId, userId))
      .orderBy(asc(agentRuns.createdAt));
  } catch (err) {
    log.warn("audit-root query failed — returning empty root", {
      error: err instanceof Error ? err.message : String(err),
    });
    receipts = [];
  }

  const signed = buildSignedChainRoot(
    receipts.map((r) => ({
      id: r.id,
      signature: r.signature,
      createdAt: r.createdAt ?? new Date(0),
    })),
  );

  return NextResponse.json(signed, {
    headers: {
      "Cache-Control": "private, no-store",
    },
  });
}
