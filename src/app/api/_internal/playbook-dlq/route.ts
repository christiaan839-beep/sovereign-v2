import { NextResponse } from "next/server";
import { verifyQstashSignature } from "@/lib/job-queue";
import { db } from "@/db";
import { playbookRuns, playbookRunSteps } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("playbook-dlq");

/**
 * POST /api/_internal/playbook-dlq
 *
 * Dead-letter queue endpoint. QStash POSTs here when a job has
 * exhausted its retry budget (default 3 retries with exponential
 * backoff). We mark the step + run as failed + notify the user.
 *
 * The request body is QStash's standard DLQ envelope:
 *   {
 *     sourceMessageId: string,
 *     sourceUrl: string,
 *     retried: number,
 *     error: string,
 *     headers: {...},
 *     body: <base64 of original JobPayload>
 *   }
 *
 * We decode the original JobPayload, mark the step "failed" with the
 * DLQ error, and call updateRunStatus so the run flips to "failed"
 * if any step DLQ'd.
 *
 * Signature verification is mandatory — same threat model as the
 * worker endpoint. An attacker POSTing here could forge failure
 * markers for other tenants' playbooks.
 */

interface DLQEnvelope {
  sourceMessageId?: string;
  sourceUrl?: string;
  retried?: number;
  error?: string;
  body?: string;
}

interface OriginalPayload {
  runId: string;
  stepIndex: number;
  agent: string;
  userId: string;
}

export async function POST(req: Request) {
  const rawBody = await req.text();

  const verification = await verifyQstashSignature(req, rawBody);
  if (!verification.valid) {
    log.warn("DLQ rejected unsigned/invalid request", {
      reason: verification.reason,
    });
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let envelope: DLQEnvelope;
  try {
    envelope = JSON.parse(rawBody) as DLQEnvelope;
  } catch {
    return NextResponse.json({ error: "Invalid envelope" }, { status: 400 });
  }

  // Decode the original job payload from the base64-encoded body
  let original: OriginalPayload;
  try {
    const decoded = envelope.body
      ? Buffer.from(envelope.body, "base64").toString("utf8")
      : "{}";
    original = JSON.parse(decoded) as OriginalPayload;
  } catch {
    log.error("DLQ payload decode failed", {
      sourceMessageId: envelope.sourceMessageId,
    });
    return NextResponse.json({ error: "Payload decode failed" }, { status: 400 });
  }

  if (!original.runId || typeof original.stepIndex !== "number") {
    return NextResponse.json({ error: "Missing runId / stepIndex" }, { status: 400 });
  }

  const reason = envelope.error ?? "unknown";
  const retries = envelope.retried ?? 0;

  log.error("DLQ — step exhausted retries", {
    runId: original.runId,
    stepIndex: original.stepIndex,
    agent: original.agent,
    retries,
    reason: reason.slice(0, 200),
  });

  // Mark the step failed — the runId + stepIndex combo gives us the
  // specific row without risk of clobbering unrelated steps.
  try {
    await db
      .update(playbookRunSteps)
      .set({
        status: "failed",
        completedAt: new Date(),
        error: `DLQ: ${reason.slice(0, 500)} (after ${retries} retries)`,
      })
      .where(
        and(
          eq(playbookRunSteps.runId, original.runId),
          eq(playbookRunSteps.stepIndex, original.stepIndex),
        ),
      );

    // Flip the parent run to failed — if even one step DLQ'd, the
    // run cannot complete successfully.
    await db
      .update(playbookRuns)
      .set({
        status: "failed",
        completedAt: new Date(),
      })
      .where(eq(playbookRuns.id, original.runId));

    // TODO: notify the user. Hooking this into the existing notify
    // lib would send an in-app notification + optional Slack ping
    // once the Slack integration is set up for that user.

    return NextResponse.json({ ok: true });
  } catch (err) {
    log.error("DLQ write failed", { error: String(err) });
    // Return 200 anyway — don't have QStash retry the DLQ, we'll
    // investigate manually from Sentry.
    return NextResponse.json({ ok: true, note: "DB write failed" });
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    dlq: "playbook-dlq",
    expects: "POST with Upstash-Signature header",
  });
}
