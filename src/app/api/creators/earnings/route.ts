/**
 * GET /api/creators/earnings
 *
 * Authenticated. Returns the signed-in user's earnings summary +
 * per-agent breakdown.
 *
 * The dashboard page uses this same endpoint via server-side fetch —
 * one source of truth for earnings shape.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import {
  earningsByAgentForCreator,
  summarizeForCreator,
} from "@/lib/creator-earnings";

export async function GET(): Promise<Response> {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  const [summary, byAgent] = await Promise.all([
    summarizeForCreator(auth.email),
    earningsByAgentForCreator(auth.email, 30),
  ]);

  return NextResponse.json(
    { summary, byAgent },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
