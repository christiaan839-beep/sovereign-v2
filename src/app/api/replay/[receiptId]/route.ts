/**
 * POST /api/replay/[receiptId] — receipt-driven agent replay.
 *
 * Cook 35 reliability primitive. Anyone with access to a signed
 * receipt can ask the platform to re-run the same input through the
 * SAME agent and report whether the output drifted.
 *
 * The audit-grade use case: a regulator (or your own QA team) wants
 * proof that a six-month-old AI decision is reproducible. They paste
 * the receipt id, the platform re-runs the exact input, and returns
 * a structured drift report. Three outcomes:
 *
 *   1. Byte-identical — the model + prompt + temperature stayed
 *      deterministic enough to repeat. Strongest possible signal.
 *   2. Within tolerance — semantic + structural similarity above
 *      threshold. Output evolved but the substantive answer is the
 *      same. Standard expectation for non-zero-temperature LLMs.
 *   3. Drifted — the model has regressed (or the prompt template
 *      changed). Surface the diff for human review.
 *
 * Authorization model:
 *   - Public receipts: anyone can replay (the audit-trail moat).
 *   - Unlisted: needs a tenant-matching auth token.
 *   - Private: owner-only.
 *
 * The replay invokes the agent via the unified router (`/api/agents/
 * <slug>`) with the receipt's original input as the request body.
 * That keeps the safety stack (rate limit, factory verifier, etc.)
 * in the loop — replays go through the same gauntlet as fresh runs.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getRun } from "@/lib/agent-runs";
import { detectDrift } from "@/lib/drift-detector";
import { AGENT_REGISTRY } from "@/app/api/agents/registry";
import { createLogger } from "@/lib/logger";

const log = createLogger("replay-endpoint");

export async function POST(
  req: Request,
  { params }: { params: Promise<{ receiptId: string }> },
) {
  const { receiptId } = await params;

  // ── Step 1: Validate receipt id format ──────────────────────
  if (!receiptId || !/^[0-9a-f-]{32,40}$/i.test(receiptId)) {
    return NextResponse.json(
      { error: "Invalid receipt id format." },
      { status: 400 },
    );
  }

  // ── Step 2: Fetch the original receipt ──────────────────────
  const original = await getRun(receiptId).catch(() => null);
  if (!original) {
    // Public-existence guard: same response for "doesn't exist" and
    // "exists but private to another tenant" so we don't leak the
    // existence of private receipts to enumerators.
    return NextResponse.json({ error: "Receipt not found." }, { status: 404 });
  }

  // ── Step 3: Authorization based on visibility ───────────────
  if (original.visibility !== "public") {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: "Receipt not found." },
        { status: 404 },
      );
    }
    if (original.userId && original.userId !== userId) {
      log.warn("Cross-tenant replay attempt blocked", {
        receiptId,
        ownerUserId: original.userId,
        attemptedBy: userId,
      });
      return NextResponse.json(
        { error: "Receipt not found." },
        { status: 404 },
      );
    }
  }

  // ── Step 4: Route to the original agent via the registry ────────
  const loader = AGENT_REGISTRY[original.agentName];
  if (!loader) {
    return NextResponse.json(
      {
        error: `Agent '${original.agentName}' is no longer registered. Cannot replay.`,
        code: "AGENT_RETIRED",
      },
      { status: 410 }, // Gone — semantically correct for retired agents
    );
  }

  let replayHandler: { POST?: (req: Request) => Promise<Response> };
  try {
    replayHandler = await loader();
  } catch (err) {
    log.warn("Failed to load agent module for replay", {
      agentName: original.agentName,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { error: "Replay agent module failed to load.", code: "LOAD_FAILED" },
      { status: 500 },
    );
  }

  if (!replayHandler.POST) {
    return NextResponse.json(
      { error: "Replay agent has no POST handler.", code: "NO_HANDLER" },
      { status: 500 },
    );
  }

  // ── Step 5: Invoke the agent with the original input ────────────
  const replayStart = Date.now();
  let replayBody: unknown;
  let replayStatus = 0;
  try {
    const replayReq = new Request(
      new URL("/api/replay/internal", req.url).toString(),
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          // Forward auth so the agent's auth check passes — replays
          // run as the requesting user, not the original receipt's
          // owner. That's intentional: replays count against your
          // quota, not theirs.
          ...(req.headers.get("Authorization")
            ? { Authorization: req.headers.get("Authorization")! }
            : {}),
        },
        body: JSON.stringify(original.input),
      },
    );
    const replayRes = await replayHandler.POST(replayReq);
    replayStatus = replayRes.status;
    replayBody = await replayRes.json().catch(() => null);
  } catch (err) {
    log.warn("Replay agent invocation failed", {
      receiptId,
      agentName: original.agentName,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      {
        error: "Replay agent threw during invocation.",
        code: "INVOCATION_FAILED",
        receipt: { id: original.id, agentName: original.agentName },
      },
      { status: 500 },
    );
  }
  const replayDurationMs = Date.now() - replayStart;

  if (replayStatus < 200 || replayStatus >= 300) {
    return NextResponse.json(
      {
        error: "Replay agent returned non-2xx.",
        code: "REPLAY_NON_2XX",
        replayStatus,
        replayBody,
      },
      { status: 502 }, // Bad Gateway — upstream agent failed
    );
  }

  // ── Step 6: Compare original vs. replay output via drift detector
  const drift = detectDrift(original.output, replayBody, {
    tolerance: 0.15,
    diffLimit: 25,
  });

  return NextResponse.json({
    ok: true,
    receiptId: original.id,
    agentName: original.agentName,
    drifted: drift.drifted,
    summary: drift.summary,
    score: drift.score,
    diffs: drift.diffs,
    timing: {
      originalMs: original.durationMs,
      replayMs: replayDurationMs,
    },
    original: {
      output: original.output,
      modelUsed: original.modelUsed,
      createdAt: original.createdAt,
    },
    replay: {
      output: replayBody,
    },
  });
}

export async function GET() {
  return NextResponse.json(
    {
      error: "Method not allowed. Replay is POST-only.",
      hint: "POST /api/replay/<receiptId> with no body to re-run the agent and compare outputs.",
    },
    { status: 405, headers: { Allow: "POST" } },
  );
}
