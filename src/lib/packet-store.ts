/**
 * packet-store — persistence helper for the four vertical packet runs.
 *
 * Why a helper, not direct Drizzle calls inside each route:
 *   - The four packet routes have differently shaped output objects but
 *     share identical persistence semantics (write the whole thing as
 *     JSON, count errors, record duration).
 *   - Writes are best-effort by design. A DB hiccup must NOT prevent the
 *     packet response from reaching the user — they already paid one run
 *     credit; failing the response would be the worst outcome.
 *   - The helper swallows errors and logs them; the agent route returns
 *     the packet to the user regardless.
 *
 * Reading is exposed via getPacketsForUser / getPacketById, used by the
 * /dashboard/packets pages.
 */
import { db } from "@/db";
import { packets } from "@/db/schema";
import { and, desc, eq } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("packet-store");

/** The four packet kinds we persist. Anything else is rejected. */
export const PACKET_KINDS = [
  "agency-content-packet",
  "recruiting-sourcing-sprint",
  "growth-pulse",
  "listing-pulse",
] as const;

export type PacketKind = (typeof PACKET_KINDS)[number];

export function isPacketKind(value: unknown): value is PacketKind {
  return (
    typeof value === "string" &&
    (PACKET_KINDS as readonly string[]).includes(value)
  );
}

export interface SavePacketArgs {
  userId: string;
  kind: PacketKind;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  errorCount: number;
  durationMs: number;
}

export interface PacketRow {
  id: string;
  userId: string;
  kind: PacketKind;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  errorCount: number;
  durationMs: number;
  createdAt: string;
}

/**
 * Persist a packet run. Returns the new row id on success, null on
 * silent failure (no DB / table missing). Never throws.
 */
export async function savePacket(args: SavePacketArgs): Promise<string | null> {
  if (!args.userId || !args.userId.trim()) return null;

  try {
    const [row] = await db
      .insert(packets)
      .values({
        userId: args.userId,
        kind: args.kind,
        inputJson: JSON.stringify(args.input),
        outputJson: JSON.stringify(args.output),
        errorCount: Math.max(0, args.errorCount | 0),
        durationMs: Math.max(0, args.durationMs | 0),
      })
      .returning({ id: packets.id });
    return row?.id ?? null;
  } catch (err) {
    // Best-effort write — DB unavailable / table missing must not surface
    // to the user. Log + return null so the route still returns the packet.
    log.warn("savePacket failed (response still returned to user)", {
      kind: args.kind,
      userId: args.userId,
      error: (err as Error)?.message,
    });
    return null;
  }
}

function rowToPacket(row: typeof packets.$inferSelect): PacketRow | null {
  if (!isPacketKind(row.kind)) return null;
  let input: Record<string, unknown> = {};
  let output: Record<string, unknown> = {};
  try {
    input = JSON.parse(row.inputJson || "{}");
  } catch {
    /* malformed legacy row — leave as empty object */
  }
  try {
    output = JSON.parse(row.outputJson || "{}");
  } catch {
    /* malformed legacy row — leave as empty object */
  }
  return {
    id: row.id,
    userId: row.userId,
    kind: row.kind,
    input,
    output,
    errorCount: row.errorCount,
    durationMs: row.durationMs,
    createdAt:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
  };
}

/**
 * List a user's packets in reverse chronological order. Returns at most
 * `limit` rows. Returns an empty array if the DB is unavailable so the
 * dashboard can still render its empty state.
 */
export async function getPacketsForUser(
  userId: string,
  options: { limit?: number; kind?: PacketKind } = {},
): Promise<PacketRow[]> {
  const limit = Math.min(Math.max(options.limit ?? 25, 1), 100);
  if (!userId || !userId.trim()) return [];

  try {
    const where = options.kind
      ? and(eq(packets.userId, userId), eq(packets.kind, options.kind))
      : eq(packets.userId, userId);
    const rows = await db
      .select()
      .from(packets)
      .where(where)
      .orderBy(desc(packets.createdAt))
      .limit(limit);
    return rows.map(rowToPacket).filter((r): r is PacketRow => r !== null);
  } catch (err) {
    log.warn("getPacketsForUser failed", {
      userId,
      error: (err as Error)?.message,
    });
    return [];
  }
}

/**
 * Fetch a single packet by id, scoped to the requesting user. Returns
 * null if not found or not owned by the user (avoids leaking the
 * existence of other users' packets).
 */
export async function getPacketById(
  userId: string,
  id: string,
): Promise<PacketRow | null> {
  if (!userId || !userId.trim() || !id) return null;
  try {
    const rows = await db
      .select()
      .from(packets)
      .where(and(eq(packets.id, id), eq(packets.userId, userId)))
      .limit(1);
    const row = rows[0];
    return row ? rowToPacket(row) : null;
  } catch (err) {
    log.warn("getPacketById failed", {
      id,
      userId,
      error: (err as Error)?.message,
    });
    return null;
  }
}

/**
 * Count a user's total packets (across all kinds). Useful for the
 * dashboard badge.
 */
export async function countPacketsForUser(userId: string): Promise<number> {
  if (!userId || !userId.trim()) return 0;
  try {
    const rows = await db
      .select({ id: packets.id })
      .from(packets)
      .where(eq(packets.userId, userId));
    return rows.length;
  } catch {
    return 0;
  }
}
