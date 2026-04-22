/**
 * DELETE /api/account — GDPR Article 17 right-to-erasure endpoint.
 *
 * Auth: Clerk required — the user can ONLY delete their own account.
 *
 * Body: { confirmation: "DELETE MY ACCOUNT" }
 *   The exact-phrase confirmation is enforced here AND rendered in
 *   the UI. This is "double-intention" — an accidental fetch call
 *   with auth headers cannot trigger irreversible deletion.
 *
 * Response:
 *   200  { deleted: true, steps: {...} } — full per-step summary
 *        so the client can render a clear "we've deleted X, Y, Z"
 *        confirmation screen and the user knows what actually happened.
 *   400  { error: "Confirmation phrase required" }
 *   401  { error: "Unauthorized" }
 *   500  { error: "..." } — the deletion helper never throws for
 *        per-step failures (they become steps[...]==='failed'), so
 *        a 500 from here means something catastrophic (DB down).
 *
 * Rate-limited via the /api/account prefix in rate-limits.ts.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { z } from "zod";
import {
  deleteUserAccount,
  DELETION_CONFIRMATION_PHRASE,
} from "@/lib/account-deletion";

const BodySchema = z.object({
  confirmation: z.string(),
});

export async function DELETE(req: Request): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Confirmation phrase required" },
      { status: 400 },
    );
  }

  if (parsed.data.confirmation !== DELETION_CONFIRMATION_PHRASE) {
    return NextResponse.json(
      {
        error: "Confirmation phrase does not match",
        expected: DELETION_CONFIRMATION_PHRASE,
      },
      { status: 400 },
    );
  }

  const result = await deleteUserAccount(userId);

  return NextResponse.json(
    { deleted: true, ...result },
    {
      status: 200,
      // Clear any caching — the user's session is about to be nuked.
      headers: { "Cache-Control": "no-store" },
    },
  );
}
