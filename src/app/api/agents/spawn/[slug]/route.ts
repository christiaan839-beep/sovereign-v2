/**
 * A2E SPAWN ENDPOINT — POST /api/agents/spawn/<slug>
 *
 * Thin wrapper around src/lib/agent-spawn.ts for *external* callers
 * (other agents running in separate processes, custom integrations, the
 * MCP bridge). Library callers inside the same process should call
 * `spawnAgent()` directly rather than round-tripping HTTP.
 *
 * Auth
 * ----
 * Two-header handshake, both required:
 *   X-Sovereign-Internal-Secret  —  must match CRON_SECRET
 *   X-Sovereign-User-Id          —  Clerk user id that funds the call
 *
 * Fail-closed: if CRON_SECRET is unset, the route returns 503 rather than
 * falling through, matching the cron-auth helper's policy.
 *
 * Path note
 * ---------
 * The spec asked for /api/agents/[slug]/spawn, but that collides with the
 * existing /api/agents/[...slug] catch-all (Next.js refuses two dynamic
 * folder names at the same directory level). So the endpoint lives at
 * /api/agents/spawn/<slug> instead — static "spawn" + dynamic slug — and
 * behaves the same otherwise.
 *
 * Body
 * ----
 *   {
 *     "inputs": { ... },          // forwarded to the child agent
 *     "parent": {
 *       "parentAgentSlug": "leads",
 *       "parentHoldId":    "a2e_xxx",
 *       "depth":           0
 *     }
 *   }
 *
 * The `parent.userId` is *not* taken from the body — it's read from the
 * X-Sovereign-User-Id header so an attacker holding the internal secret
 * can't silently fund spawns from any user id they choose.
 */

import { NextResponse } from "next/server";
import { spawnAgent, SpawnError } from "@/lib/agent-spawn";
import { createLogger } from "@/lib/logger";

const log = createLogger("api:agents-spawn");

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  // ── Auth: internal secret + user-id headers ──
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length === 0) {
    return NextResponse.json(
      { error: "CRON_SECRET not configured" },
      { status: 503 },
    );
  }
  const providedSecret = req.headers.get("x-sovereign-internal-secret") ?? "";
  if (providedSecret !== secret) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 },
    );
  }

  const userId = req.headers.get("x-sovereign-user-id") ?? "";
  if (!userId) {
    return NextResponse.json(
      { error: "Missing X-Sovereign-User-Id header" },
      { status: 400 },
    );
  }

  // ── Parse body ──
  let body: { inputs?: unknown; parent?: unknown };
  try {
    body = (await req.json()) as { inputs?: unknown; parent?: unknown };
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const inputs = body.inputs as Record<string, unknown> | undefined;
  const parent = body.parent as
    | { parentAgentSlug?: unknown; parentHoldId?: unknown; depth?: unknown }
    | undefined;

  if (!inputs || typeof inputs !== "object") {
    return NextResponse.json(
      { error: "Missing or invalid `inputs`" },
      { status: 400 },
    );
  }
  if (!parent || typeof parent !== "object") {
    return NextResponse.json(
      { error: "Missing or invalid `parent`" },
      { status: 400 },
    );
  }

  const parentAgentSlug =
    typeof parent.parentAgentSlug === "string" ? parent.parentAgentSlug : "";
  const parentHoldId =
    typeof parent.parentHoldId === "string" ? parent.parentHoldId : "";
  const depth = typeof parent.depth === "number" ? parent.depth : Number.NaN;

  if (!parentAgentSlug || !parentHoldId || !Number.isFinite(depth)) {
    return NextResponse.json(
      { error: "`parent` must include parentAgentSlug, parentHoldId, depth" },
      { status: 400 },
    );
  }

  // ── Execute the spawn ──
  const { slug } = await params;
  try {
    const result = await spawnAgent({
      slug,
      inputs,
      parent: {
        userId,
        parentAgentSlug,
        parentHoldId,
        depth,
      },
    });
    return NextResponse.json(result, { status: 200 });
  } catch (err) {
    if (err instanceof SpawnError) {
      // Map known codes to HTTP status — the helper tells us exactly
      // which guard tripped so we can 403 vs 429 vs 400 precisely.
      const status =
        err.code === "UNKNOWN_AGENT"
          ? 404
          : err.code === "A2E_DEPTH_EXCEEDED" || err.code === "A2E_CAP_EXCEEDED"
            ? 429
            : err.code === "INTERNAL_AUTH_UNCONFIGURED"
              ? 503
              : err.code === "HOLD_FAILED"
                ? 402
                : err.code === "CHILD_HTTP_ERROR"
                  ? 502
                  : 400;
      return NextResponse.json(
        { error: err.message, code: err.code },
        { status },
      );
    }
    log.error("Unexpected spawn failure", {
      slug,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Internal error during spawn" },
      { status: 500 },
    );
  }
}
