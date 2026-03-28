/**
 * SOVEREIGN MATRIX — Error Log API
 *
 * GET  → Returns the in-memory error log.
 * POST → Manually report an error { error: string, context?: string }.
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { getErrorLog, reportError } from "@/lib/error-reporter";

export async function GET() {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  return NextResponse.json({ errors: getErrorLog() });
}

export async function POST(req: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const errorMsg = body?.error ?? "Unknown error";
    const context = body?.context ?? undefined;

    reportError(new Error(String(errorMsg)), String(context));

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 }
    );
  }
}
