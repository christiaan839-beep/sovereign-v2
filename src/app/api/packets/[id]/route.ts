/**
 * GET /api/packets/[id] — fetch a single saved packet, scoped to the
 * caller. 404 (rather than 403) when the packet exists but isn't owned
 * by the caller — avoids leaking the existence of other users' rows.
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getPacketById } from "@/lib/packet-store";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  const { id } = await params;
  const packet = await getPacketById(userId, id);
  if (!packet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ packet });
}
