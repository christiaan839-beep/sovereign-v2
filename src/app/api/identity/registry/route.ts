/**
 * GET /api/identity/registry
 *
 * PUBLIC, no-auth registry of all known agent identity manifests.
 *
 * Returns the LATEST active manifest for each registered agent_id,
 * paginated. This is the queryable substrate for:
 *   - Reputation systems (R40 future)
 *   - Federation peer discovery
 *   - Procurement audit ("show me every agent that's verified")
 *   - Browser-based discovery (the /agents/registry public page)
 *
 * Public-safe: only manifest fields are returned (no email, no
 * private metadata). Owner is exposed as userId (NOT email).
 *
 * Cached for 5 min.
 *
 * Pagination: ?cursor=<chainHash>&limit=20 (default 20, max 100)
 */

import { NextResponse } from "next/server";
import { and, desc, eq, gte, isNull, lt, sql } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("identity-registry");

export const runtime = "nodejs";
export const revalidate = 300;

export async function GET(req: Request) {
  if (!process.env.DATABASE_URL) {
    return NextResponse.json(
      {
        agents: [],
        note: "Database unavailable — registry warming up.",
        generatedAt: new Date().toISOString(),
      },
      { status: 200 },
    );
  }

  const url = new URL(req.url);
  const cursor = url.searchParams.get("cursor");
  const limitRaw = parseInt(url.searchParams.get("limit") ?? "20", 10);
  const limit = Math.min(Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 20), 100);

  try {
    const { db } = await import("@/db");
    const { agentIdentityManifests } = await import("@/db/schema");

    const now = new Date();

    // Get the most-recent manifest per agent_id where it's active.
    // Postgres-friendly: DISTINCT ON (agent_id) ORDER BY agent_id, createdAt DESC.
    const result = await db.execute(sql`
      SELECT DISTINCT ON (agent_id)
        id,
        agent_id,
        version,
        owner_user_id,
        owner_public_key,
        manifest_json,
        chain_hash,
        previous_manifest_hash,
        expires_at,
        created_at
      FROM ${agentIdentityManifests}
      WHERE revoked_at IS NULL
        AND expires_at >= ${now}
        ${cursor ? sql`AND chain_hash < ${cursor}` : sql``}
      ORDER BY agent_id, created_at DESC
      LIMIT ${limit + 1}
    `);

    const rows = (result as unknown as {
      rows: Array<{
        id: string;
        agent_id: string;
        version: string;
        owner_user_id: string;
        owner_public_key: string;
        manifest_json: Record<string, unknown>;
        chain_hash: string;
        expires_at: Date;
        created_at: Date;
      }>;
    }).rows ?? [];

    const hasMore = rows.length > limit;
    const items = (hasMore ? rows.slice(0, limit) : rows).map((r) => ({
      agentId: r.agent_id,
      name: (r.manifest_json as { name?: string }).name ?? "(unnamed)",
      version: r.version,
      owner: r.owner_user_id,
      ownerPublicKey: r.owner_public_key,
      capabilities: (r.manifest_json as { capabilities?: string[] }).capabilities ?? [],
      purpose: (r.manifest_json as { purpose?: string }).purpose ?? "",
      chainHash: r.chain_hash,
      issuedAt: (r.manifest_json as { issuedAt?: string }).issuedAt ?? r.created_at.toISOString(),
      expiresAt: r.expires_at.toISOString(),
    }));

    const nextCursor = hasMore ? items[items.length - 1].chainHash : null;

    return NextResponse.json(
      {
        agents: items,
        pagination: {
          limit,
          nextCursor,
          hasMore,
        },
        total: items.length,
        note:
          "Public agent identity registry. Verify each manifest locally with @sovereign/inspector — Sovereign is not a required trust anchor.",
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
  } catch (err) {
    log.error("Registry list failed", { error: String(err) });
    return NextResponse.json(
      { error: "Failed to load registry" },
      { status: 500 },
    );
  }
}

// Reference to satisfy unused-import linter; kept for future filtering work.
const _unused = { eq, and, isNull, gte, desc, lt };
void _unused;
