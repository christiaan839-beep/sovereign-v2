/**
 * POST /api/agent-runs/[id]/replay — re-run a stored receipt.
 *
 * The "regression test for AI" feature. The original receipt's input
 * is pulled from the DB, the same agent is invoked again, and a new
 * signed receipt comes back. Both are linked: the new run's input
 * carries `_replayedFrom: <originalId>`, which becomes part of the
 * canonical projection and therefore part of the new signature.
 *
 * Auth: only the owner of the original run can replay it. Public/
 * unlisted runs DO NOT bypass this — replaying is a write op against
 * the platform's compute, not a read op against the receipt.
 *
 * The route doesn't second-guess the agent's existence — it forwards
 * to /api/_agents/<slug> and returns whatever that route returns,
 * with a `replayOf` field stamped on top so the caller can stitch
 * old → new client-side.
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getRun } from "@/lib/agent-runs";
import { AGENT_SLUGS } from "@/lib/agent-slugs";
import { createLogger } from "@/lib/logger";

const log = createLogger("api/agent-runs/replay");

// Snapshot once at module load — the registry is static.
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

  // Owner-only — visibility doesn't grant replay rights.
  if (original.userId !== userId) {
    return NextResponse.json({ error: "Not yours" }, { status: 403 });
  }

  // Pull the original input. We strip out any internal underscored
  // fields and add a `_replayedFrom` marker so the new run's canonical
  // projection (and therefore its signature) carries the parent link.
  const originalInput =
    typeof original.input === "object" && original.input !== null
      ? (original.input as Record<string, unknown>)
      : {};
  const cleanInput: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(originalInput)) {
    if (!k.startsWith("_")) cleanInput[k] = v;
  }
  cleanInput._replayedFrom = original.id;

  // SSRF guard: agentName came from a stored DB row but the row's value
  // could in theory be tainted (a future migration, a hand-edited row,
  // etc.). Hard-validate against the static registry before letting it
  // anywhere near a fetch URL. Bug history: a poisoned agentName would
  // have steered the credential-forwarding fetch to /api/_agents/<anything>.
  if (!AGENT_SLUG_SET.has(original.agentName)) {
    log.warn("replay rejected: unknown agentName in stored receipt", {
      id: original.id,
      agentName: original.agentName,
    });
    return NextResponse.json(
      { error: "Replay unavailable for this run" },
      { status: 422 },
    );
  }

  // SSRF + credential-leak guard: the forward target MUST be the
  // platform's own deployment, never a Host-header-spoofed origin.
  // We forward the caller's Cookie + Authorization so plan + tenant
  // isolation apply on the re-run — sending those to a spoofed host
  // would hand session credentials to an attacker. Hard-require
  // NEXT_PUBLIC_APP_URL or the Vercel-injected VERCEL_URL; reject
  // anything else with a 503 instead of risking the leak.
  const allowedOrigin = (() => {
    if (process.env.NEXT_PUBLIC_APP_URL) {
      return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "");
    }
    // VERCEL_URL is set by Vercel runtime, not by request header → safe.
    if (process.env.VERCEL_URL) {
      return `https://${process.env.VERCEL_URL}`;
    }
    return null;
  })();
  if (!allowedOrigin) {
    log.error("replay rejected: no NEXT_PUBLIC_APP_URL or VERCEL_URL set");
    return NextResponse.json(
      { error: "Replay unavailable in this environment" },
      { status: 503 },
    );
  }

  const target = `${allowedOrigin}/api/_agents/${encodeURIComponent(
    original.agentName,
  )}`;

  // Forward the caller's auth so plan limits + tenant isolation apply
  // on the re-run exactly as they did on the original. We deliberately
  // do NOT inherit any verifier opt-out from the original — replay
  // always uses the route's current default config.
  const cookieHeader = req.headers.get("cookie") ?? "";
  const authHeader = req.headers.get("authorization") ?? "";

  let agentRes: Response;
  try {
    agentRes = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(cookieHeader ? { Cookie: cookieHeader } : {}),
        ...(authHeader ? { Authorization: authHeader } : {}),
      },
      body: JSON.stringify(cleanInput),
      // Replay can be slow — the platform's own /api/_agents routes
      // already cap at 60s via vercel.json.
      signal: AbortSignal.timeout(120_000),
    });
  } catch (err) {
    log.warn("replay forward failed", {
      id,
      agent: original.agentName,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Replay forward failed", target },
      { status: 502 },
    );
  }

  let body: unknown;
  try {
    body = await agentRes.json();
  } catch {
    body = { error: "Agent returned non-JSON response" };
  }

  // Stamp the parent link onto the response. If the upstream agent
  // already produced a `_receipt`, it's already signed with
  // `_replayedFrom: <id>` baked into the canonical projection.
  const wrapped = {
    ...(typeof body === "object" && body !== null
      ? (body as Record<string, unknown>)
      : { result: body }),
    replayOf: {
      id: original.id,
      agentName: original.agentName,
      modelUsed: original.modelUsed,
      createdAt: original.createdAt,
      url: `/r/${original.id}`,
    },
  };

  return NextResponse.json(wrapped, {
    status: agentRes.status,
    headers: { "X-Replay-Of": original.id },
  });
}
