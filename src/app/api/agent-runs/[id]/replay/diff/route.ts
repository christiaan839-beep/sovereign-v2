/**
 * POST /api/agent-runs/[id]/replay/diff
 *
 * The "reproducibility proof" endpoint. Replays a stored receipt
 * via the same path as /api/agent-runs/[id]/replay, then computes
 * a structured diff against the original output and returns:
 *   { original, replayed, diff, summary }
 *
 * Investor pitch: "the platform's output is deterministic enough
 * that a re-run from the same signed input produces a hash that
 * matches the original — or, if it diverges, the diff is auditable
 * field-by-field."
 *
 * Auth: owner-only (same as the base replay endpoint). Forwards
 * cookies + Authorization so plan + tenant isolation apply on the
 * re-run exactly as they did on the original.
 *
 * SSRF guard: AGENT_SLUGS allowlist + pinned NEXT_PUBLIC_APP_URL /
 * VERCEL_URL origin — exact same protections as the parent replay
 * route. Reused here to keep the security surface in one place.
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getRun } from "@/lib/agent-runs";
import { AGENT_SLUGS } from "@/lib/agent-slugs";
import { computeReplayDiff, summariseDiff } from "@/lib/replay-diff";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/agent-runs/replay-diff");
const AGENT_SLUG_SET = new Set(AGENT_SLUGS);

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

  const original = await getRun(id);
  if (!original) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (original.userId !== userId) {
    return NextResponse.json({ error: "Not yours" }, { status: 403 });
  }
  if (!AGENT_SLUG_SET.has(original.agentName)) {
    log.warn("diff rejected: unknown agentName in stored receipt", {
      id: original.id,
      agentName: original.agentName,
    });
    return NextResponse.json(
      { error: "Diff unavailable for this run" },
      { status: 422 },
    );
  }

  const allowedOrigin = (() => {
    if (process.env.NEXT_PUBLIC_APP_URL) {
      return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
    }
    if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}`;
    }
    return null;
  })();
  if (!allowedOrigin) {
    return NextResponse.json(
      { error: "Replay-diff unavailable in this environment" },
      { status: 503 },
    );
  }

  // Build the replay payload — strip underscored internal keys
  const originalInput =
    typeof original.input === "object" && original.input !== null
      ? (original.input as Record<string, unknown>)
      : {};
  const cleanInput: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(originalInput)) {
    if (!k.startsWith("_")) cleanInput[k] = v;
  }
  cleanInput._replayedFrom = original.id;

  const target = `${allowedOrigin}/api/_agents/${encodeURIComponent(
    original.agentName,
  )}`;
  const cookieHeader = req.headers.get("cookie") ?? "";
  const authHeader = req.headers.get("authorization") ?? "";

  let agentRes: Response;
  let replayed: unknown;
  let replayStatus: number;
  const replayStart = Date.now();
  try {
    agentRes = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(cleanInput),
      signal: AbortSignal.timeout(120_000),
    });
    replayStatus = agentRes.status;
    try {
      replayed = await agentRes.json();
    } catch {
      replayed = { error: "Agent returned non-JSON response" };
    }
  } catch (err) {
    log.warn("replay-diff forward failed", {
      id,
      agent: original.agentName,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Replay-diff forward failed", target },
      { status: 502 },
    );
  }
  const replayDurationMs = Date.now() - replayStart;

  // The original.output is the canonical "before" payload
  const originalOutput =
    typeof original.output === "object" && original.output !== null
      ? (original.output as Record<string, unknown>)
      : original.output;

  const diff = computeReplayDiff(originalOutput, replayed);
  const summary = summariseDiff(diff);

  return NextResponse.json(
    {
      replayOf: {
        id: original.id,
        agentName: original.agentName,
        modelUsed: original.modelUsed,
        createdAt: original.createdAt,
      },
      original: originalOutput,
      replayed,
      diff,
      summary,
      meta: {
        replayStatus,
        replayDurationMs,
        canonicalHashesMatch: diff.hashesMatch,
      },
    },
    {
      status: 200,
      headers: { "X-Replay-Diff-Of": original.id },
    },
  );
}
