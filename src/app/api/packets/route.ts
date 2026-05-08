/**
 * GET /api/packets — list the caller's saved packet runs.
 *
 * Query params:
 *   limit?: 1–100 (default 25)
 *   kind?:  one of the four packet kinds — filters the result
 *
 * Auth: required. Anonymous callers get 401. Always returns
 * `{ packets: [] }` (never null) so the client can render an empty
 * state without branching on shape.
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  getPacketsForUser,
  isPacketKind,
  type PacketKind,
} from "@/lib/packet-store";

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required", packets: [] },
      { status: 401 },
    );
  }

  const url = new URL(req.url);
  const limitParam = url.searchParams.get("limit");
  const kindParam = url.searchParams.get("kind");

  const limit = limitParam ? Number.parseInt(limitParam, 10) : 25;
  const kind: PacketKind | undefined = isPacketKind(kindParam)
    ? kindParam
    : undefined;

  const packets = await getPacketsForUser(userId, {
    limit: Number.isFinite(limit) ? limit : 25,
    kind,
  });

  return NextResponse.json({ packets });
}
