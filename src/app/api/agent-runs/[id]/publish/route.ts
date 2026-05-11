/**
 * POST /api/agent-runs/[id]/publish — flip a run's visibility.
 *
 * Body: `{ visibility: "private" | "public" | "unlisted" }`
 *
 * Only the owning userId can publish or unpublish. Public/unlisted
 * receipts are readable without auth at /r/[id].
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { setRunVisibility } from "@/lib/agent-runs";

const ALLOWED = new Set(["private", "public", "unlisted"]);

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  if (!id || !/^[0-9a-f-]{32,40}$/i.test(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body must be JSON" }, { status: 400 });
  }

  const visibility = (body as { visibility?: string }).visibility;
  if (!visibility || !ALLOWED.has(visibility)) {
    return NextResponse.json(
      {
        error: "visibility must be one of: private, public, unlisted",
      },
      { status: 400 },
    );
  }

  const ok = await setRunVisibility(
    id,
    userId,
    visibility as "private" | "public" | "unlisted",
  );
  if (!ok) {
    return NextResponse.json(
      { error: "Not found or not yours" },
      { status: 404 },
    );
  }

  return NextResponse.json({ ok: true, visibility });
}
