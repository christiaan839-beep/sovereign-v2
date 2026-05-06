import { createAgentRoute } from "@/lib/agent-factory";
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

async function _postHandler(request: Request) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const body = await request.json();
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


// Factory wrapper for POST (adds safety pipeline)
export const POST = createAgentRoute({
  name: "error-log",
  handler: async ({ input, email, userId, request }) => {
    // Delegate to existing handler
    const fakeReq = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const res = await _postHandler(fakeReq);
    return res instanceof Response ? await res.json() : res;
  },
});
