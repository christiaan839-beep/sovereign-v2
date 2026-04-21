import { NextResponse } from "next/server";
import { verifyQstashSignature, type JobPayload } from "@/lib/job-queue";
import { runStepAndContinue } from "@/lib/playbook-step-runner";
import { createLogger } from "@/lib/logger";
import {
  runWithRequestContext,
  generateRequestId,
} from "@/lib/request-context";

const log = createLogger("playbook-worker");

/**
 * POST /api/_internal/playbook-worker
 *
 * QStash webhook endpoint. QStash POSTs a JobPayload here for each
 * playbook step; we verify the signature, run the step, update the
 * run status, and return 2xx on success or throw 5xx to trigger
 * QStash retry.
 *
 * In dev (no QStash keys configured), this endpoint rejects so nothing
 * can call it as an internal backdoor.
 *
 * Correlation:
 *   - QStash forwards our X-Request-Id header via Upstash-Forward-X-Request-Id
 *   - We wrap the step execution in runWithRequestContext so log lines
 *     stay correlated to the original playbook-run request
 */

export async function POST(req: Request) {
  const rawBody = await req.text();

  // Signature verification — locks this endpoint down to QStash only.
  // Without this, anyone who discovers the URL could execute arbitrary
  // playbook steps for any userId.
  const verification = await verifyQstashSignature(req, rawBody);
  if (!verification.valid) {
    log.warn("worker rejected unsigned/invalid request", {
      reason: verification.reason,
    });
    // Return 404 rather than 401 — don't leak that this endpoint exists
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let payload: JobPayload;
  try {
    payload = JSON.parse(rawBody) as JobPayload;
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Shape-validate the payload before running anything.
  if (
    typeof payload.runId !== "string" ||
    typeof payload.stepIndex !== "number" ||
    typeof payload.agent !== "string" ||
    typeof payload.userId !== "string" ||
    !payload.params ||
    typeof payload.params !== "object"
  ) {
    return NextResponse.json({ error: "Malformed payload" }, { status: 400 });
  }

  // Restore the request-id from QStash's forward header.
  const forwardedRequestId = req.headers.get("x-request-id") ?? generateRequestId();

  return runWithRequestContext(
    {
      requestId: forwardedRequestId,
      userId: payload.userId,
      agentName: payload.agent,
      path: "/api/_internal/playbook-worker",
    },
    async () => {
      try {
        // runStepAndContinue runs this step AND enqueues the next one.
        // Each step lives in its own function invocation — no 60s Vercel
        // ceiling on a multi-step chain. If this step fails, the chain
        // halts and the user can POST /api/playbooks/runs/:id/resume.
        const result = await runStepAndContinue(payload);

        log.info("step processed", {
          runId: payload.runId,
          stepIndex: payload.stepIndex,
          agent: payload.agent,
          status: result.status,
          skipped: result.skippedAsAlreadyDone,
        });

        return NextResponse.json({ ok: true, result });
      } catch (err) {
        // Throw a 5xx so QStash retries with backoff.
        const msg = err instanceof Error ? err.message : String(err);
        log.warn("step threw (QStash will retry)", {
          runId: payload.runId,
          stepIndex: payload.stepIndex,
          error: msg,
        });
        return NextResponse.json({ error: msg }, { status: 503 });
      }
    },
  );
}

/** GET allowed only for liveness checks. */
export async function GET() {
  return NextResponse.json({
    ok: true,
    worker: "playbook-worker",
    expects: "POST with Upstash-Signature header",
  });
}
