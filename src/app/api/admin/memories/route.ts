/**
 * GET    /api/admin/memories[?userId=&agent=&q=&limit=&sort=]
 * DELETE /api/admin/memories?id=<uuid>
 *
 * Admin-only memory browser. Cross-user, cross-agent search over
 * the vector memory pool. State previews may contain sensitive
 * content — operator-only by design.
 */
import { NextResponse } from "next/server";
import { auth, clerkClient } from "@clerk/nextjs/server";
import { db } from "@/db";
import { sql } from "drizzle-orm";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";
import {
  parseMemoryFilters,
  truncateContent,
  projectMetadata,
  sortFragment,
} from "@/lib/admin-memories-helpers";

const log = createLogger("admin-memories");

const ADMIN_EMAILS = new Set<string>([
  "christiaan839@gmail.com",
  "christiaandewet28@icloud.com",
]);

const limiter = rateLimit({ interval: 60, limit: 30 });

async function isCurrentUserAdmin(): Promise<boolean> {
  try {
    const { userId } = await auth();
    if (!userId) return false;
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const email = user.emailAddresses?.[0]?.emailAddress?.toLowerCase() ?? "";
    return ADMIN_EMAILS.has(email);
  } catch (err) {
    log.warn("admin check failed", { error: String(err) });
    return false;
  }
}

function isMissingTableError(err: unknown): boolean {
  const code = (err as { code?: string })?.code;
  const msg = err instanceof Error ? err.message : String(err);
  return code === "42P01" || /does not exist/.test(msg);
}

export async function GET(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const admin = await isCurrentUserAdmin();
  if (!admin) {
    return NextResponse.json({ error: "admin-only" }, { status: 403 });
  }

  const url = new URL(req.url);
  const filters = parseMemoryFilters(url.searchParams);

  try {
    const conds: string[] = ["1=1"];
    const args: Record<string, unknown> = {};
    if (filters.userId) {
      conds.push("user_id = ${userId}");
      args.userId = filters.userId;
    }
    if (filters.agentName) {
      conds.push("agent_name = ${agentName}");
      args.agentName = filters.agentName;
    }
    if (filters.search) {
      conds.push("content ILIKE ${pattern}");
      args.pattern = `%${filters.search.replace(/[%_]/g, "")}%`;
    }

    // Build with parameterised sql template — fall back to a typed
    // ad-hoc query per filter shape to keep injection-safe.
    let rowsRaw;
    if (filters.userId && filters.agentName && filters.search) {
      const pattern = `%${filters.search.replace(/[%_]/g, "")}%`;
      rowsRaw = await db.execute(sql`
        SELECT id, user_id, agent_name, content, metadata, created_at
        FROM agent_memories
        WHERE user_id = ${filters.userId}
          AND agent_name = ${filters.agentName}
          AND content ILIKE ${pattern}
        ORDER BY ${sql.raw(sortFragment(filters.sort))}
        LIMIT ${filters.limit}
      `);
    } else if (filters.userId && filters.agentName) {
      rowsRaw = await db.execute(sql`
        SELECT id, user_id, agent_name, content, metadata, created_at
        FROM agent_memories
        WHERE user_id = ${filters.userId}
          AND agent_name = ${filters.agentName}
        ORDER BY ${sql.raw(sortFragment(filters.sort))}
        LIMIT ${filters.limit}
      `);
    } else if (filters.userId && filters.search) {
      const pattern = `%${filters.search.replace(/[%_]/g, "")}%`;
      rowsRaw = await db.execute(sql`
        SELECT id, user_id, agent_name, content, metadata, created_at
        FROM agent_memories
        WHERE user_id = ${filters.userId}
          AND content ILIKE ${pattern}
        ORDER BY ${sql.raw(sortFragment(filters.sort))}
        LIMIT ${filters.limit}
      `);
    } else if (filters.agentName && filters.search) {
      const pattern = `%${filters.search.replace(/[%_]/g, "")}%`;
      rowsRaw = await db.execute(sql`
        SELECT id, user_id, agent_name, content, metadata, created_at
        FROM agent_memories
        WHERE agent_name = ${filters.agentName}
          AND content ILIKE ${pattern}
        ORDER BY ${sql.raw(sortFragment(filters.sort))}
        LIMIT ${filters.limit}
      `);
    } else if (filters.userId) {
      rowsRaw = await db.execute(sql`
        SELECT id, user_id, agent_name, content, metadata, created_at
        FROM agent_memories
        WHERE user_id = ${filters.userId}
        ORDER BY ${sql.raw(sortFragment(filters.sort))}
        LIMIT ${filters.limit}
      `);
    } else if (filters.agentName) {
      rowsRaw = await db.execute(sql`
        SELECT id, user_id, agent_name, content, metadata, created_at
        FROM agent_memories
        WHERE agent_name = ${filters.agentName}
        ORDER BY ${sql.raw(sortFragment(filters.sort))}
        LIMIT ${filters.limit}
      `);
    } else if (filters.search) {
      const pattern = `%${filters.search.replace(/[%_]/g, "")}%`;
      rowsRaw = await db.execute(sql`
        SELECT id, user_id, agent_name, content, metadata, created_at
        FROM agent_memories
        WHERE content ILIKE ${pattern}
        ORDER BY ${sql.raw(sortFragment(filters.sort))}
        LIMIT ${filters.limit}
      `);
    } else {
      rowsRaw = await db.execute(sql`
        SELECT id, user_id, agent_name, content, metadata, created_at
        FROM agent_memories
        ORDER BY ${sql.raw(sortFragment(filters.sort))}
        LIMIT ${filters.limit}
      `);
    }

    const rows = Array.isArray(rowsRaw)
      ? (rowsRaw as unknown as Array<{
          id: string;
          user_id: string;
          agent_name: string;
          content: string;
          metadata: unknown;
          created_at: Date | string;
        }>)
      : ((rowsRaw as { rows?: unknown }).rows ?? []);

    const memories = (
      rows as Array<{
        id: string;
        user_id: string;
        agent_name: string;
        content: string;
        metadata: unknown;
        created_at: Date | string;
      }>
    ).map((r) => ({
      id: r.id,
      userId: r.user_id,
      agentName: r.agent_name,
      preview: truncateContent(r.content),
      metadata: projectMetadata(r.metadata),
      createdAt:
        r.created_at instanceof Date
          ? r.created_at.toISOString()
          : String(r.created_at),
    }));

    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        count: memories.length,
        filters,
        memories,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err) {
    if (isMissingTableError(err)) {
      return NextResponse.json(
        {
          generatedAt: new Date().toISOString(),
          count: 0,
          filters,
          memories: [],
          warning: "agent_memories table missing — run pgvector setup",
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    }
    log.warn("admin memories query failed", { error: String(err) });
    return NextResponse.json({ error: "query-failed" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  const admin = await isCurrentUserAdmin();
  if (!admin) {
    return NextResponse.json({ error: "admin-only" }, { status: 403 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id")?.trim();
  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json(
      { error: "valid uuid id required" },
      { status: 400 },
    );
  }

  try {
    await db.execute(sql`DELETE FROM agent_memories WHERE id = ${id}::uuid`);
    return NextResponse.json({ success: true, deleted: id });
  } catch (err) {
    log.warn("admin memories delete failed", { error: String(err) });
    return NextResponse.json({ error: "delete-failed" }, { status: 500 });
  }
}
