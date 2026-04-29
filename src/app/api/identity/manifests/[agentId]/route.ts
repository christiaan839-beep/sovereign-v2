/**
 * GET /api/identity/manifests/[agentId]
 *
 * PUBLIC, no-auth lookup of an agent's identity manifest.
 *
 * Returns the most-recent ACTIVE (non-revoked, non-expired) manifest
 * for the given agent ID. Includes the full version chain in the
 * response so verifiers can replay history.
 *
 * Default behavior: returns latest-active. Pass ?versions=all to get
 * the full version chain. Pass ?versions=full-chain to also include
 * revoked/expired versions for forensic purposes.
 *
 * NO PRIVATE DATA: only public-safe fields are stored in the manifest
 * (per ADR-0006). owner=userId (not email); capabilities are public;
 * code/training declarations are non-sensitive.
 *
 * Cached for 60s — manifests are immutable once registered (a "new
 * version" is a new row), so caching is safe.
 */

import { NextResponse } from "next/server";
import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("identity-lookup");

export const runtime = "nodejs";
export const revalidate = 60;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ agentId: string }> },
) {
  const { agentId } = await params;
  if (!agentId || agentId.length > 200) {
    return NextResponse.json({ error: "Invalid agent id" }, { status: 400 });
  }

  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      { error: "Database unavailable" },
      { status: 503 },
    );
  }

  const url = new URL(req.url);
  const versions = url.searchParams.get("versions") ?? "active";

  try {
    const { db } = await import("@/db");
    const { agentIdentityManifests } = await import("@/db/schema");

    const now = new Date();

    if (versions === "all" || versions === "full-chain") {
      // Full chain (forensics + version replay)
      const rows = await db
        .select()
        .from(agentIdentityManifests)
        .where(eq(agentIdentityManifests.agentId, agentId))
        .orderBy(desc(agentIdentityManifests.createdAt))
        .limit(50);
      if (rows.length === 0) {
        return NextResponse.json(
          { error: "Agent not found" },
          { status: 404 },
        );
      }
      return NextResponse.json({
        agentId,
        manifests: rows.map((r) => ({
          ...((r.manifestJson as object) ?? {}),
          revokedAt: r.revokedAt?.toISOString() ?? null,
          revocationMessage: r.revocationMessage,
          revocationSignature: r.revocationSignature,
          createdAt: r.createdAt.toISOString(),
        })),
        note:
          "Full version chain. Use @sovereign/inspector to verify each manifest's signature locally.",
      });
    }

    // Default: latest active manifest.
    const rows = await db
      .select()
      .from(agentIdentityManifests)
      .where(
        and(
          eq(agentIdentityManifests.agentId, agentId),
          isNull(agentIdentityManifests.revokedAt),
          gte(agentIdentityManifests.expiresAt, now),
        ),
      )
      .orderBy(desc(agentIdentityManifests.createdAt))
      .limit(1);

    if (rows.length === 0) {
      return NextResponse.json(
        {
          error: "No active manifest for this agent",
          hint: "Try ?versions=all to see expired/revoked versions.",
        },
        { status: 404 },
      );
    }

    const r = rows[0];
    return NextResponse.json({
      agentId,
      manifest: {
        ...((r.manifestJson as object) ?? {}),
        createdAt: r.createdAt.toISOString(),
      },
      note:
        "Verify this manifest locally using `@sovereign/inspector` — Sovereign is not a required trust anchor.",
    });
  } catch (err) {
    log.error("Lookup manifest failed", {
      agentId,
      error: String(err),
    });
    return NextResponse.json(
      { error: "Failed to load manifest" },
      { status: 500 },
    );
  }
}
