/**
 * POST /api/marketplace/view
 *
 * Records an anonymous view of a marketplace agent. Called from the
 * ViewTracker client island rendered inside /marketplace/[slug].
 *
 * Body:
 *   { agentId: string (UUID), slug?: string, anonymousId: string,
 *     referrerHost?: string }
 *
 * The endpoint is deliberately forgiving — bad input returns 200 OK
 * so a tracking request never blocks a page render. The library's
 * sanitizer rejects malformed IDs/hosts at the write layer.
 */

import { NextResponse } from "next/server";
import { recordAgentView } from "@/lib/marketplace-telemetry";

export async function POST(request: Request): Promise<Response> {
  let body: {
    agentId?: unknown;
    slug?: unknown;
    anonymousId?: unknown;
    referrerHost?: unknown;
  };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    // Tracking never blocks the page — accept silently on bad JSON.
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  if (
    typeof body.agentId !== "string" ||
    typeof body.anonymousId !== "string"
  ) {
    return NextResponse.json({ ok: false }, { status: 200 });
  }

  const persisted = await recordAgentView({
    agentId: body.agentId,
    slug: typeof body.slug === "string" ? body.slug : null,
    anonymousId: body.anonymousId,
    referrerHost:
      typeof body.referrerHost === "string" ? body.referrerHost : null,
  });

  return NextResponse.json(
    { ok: persisted },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );
}
