import { createLogger } from "@/lib/logger";
import { getRequestContext } from "@/lib/request-context";

const log = createLogger("job-queue");

/**
 * DURABLE JOB QUEUE — abstraction over Upstash QStash with in-process
 * fallback for local dev.
 *
 * Why this exists
 * ───────────────
 * `executePlaybook(...).catch(...)` has zero durability on Vercel. If the
 * function times out or 5xx's mid-execution, multi-step playbooks
 * silently die. Users see "running" forever; we lose the customer trust.
 *
 * The fix: split each playbook step into its own HMAC-signed job that
 * the queue delivers to a dedicated worker endpoint. If that endpoint
 * fails, QStash retries with exponential backoff (default 3 retries);
 * terminal failures land in a dead-letter queue we monitor.
 *
 * Shape of a step job:
 *   {
 *     runId: string,      — which playbook run this belongs to
 *     stepIndex: number,  — 0-based position in the chain
 *     agent: string,      — agent slug (validated against AGENT_REGISTRY)
 *     params: {...},      — input to the agent
 *     userId: string,     — for tenant isolation + rate-limit attribution
 *   }
 *
 * In production (QSTASH_TOKEN set): jobs go to QStash, which posts
 * them to our worker URL. QStash signs requests with a known public
 * key; we verify the signature before processing.
 *
 * In dev (no token): jobs run in-process as before, with a structured
 * log so you see what a real queue call WOULD have done. This keeps
 * local dev friction low while guaranteeing the production code path
 * is exercised by at least the log format.
 */

export interface JobPayload {
  runId: string;
  stepIndex: number;
  agent: string;
  params: Record<string, unknown>;
  userId: string;
}

export interface EnqueueResult {
  enqueued: boolean;
  /** QStash message ID when in queue mode, ephemeral ID when in-process. */
  jobId: string;
  /** "qstash" in prod with QSTASH_TOKEN set; "in-process" otherwise. */
  mode: "qstash" | "in-process";
}

/**
 * Retrieve the QStash token at call time so rotation + swapping between
 * environments works without reloading the module. Module-level cache
 * would be unsafe if the Vercel process is kept warm across deploys.
 */
function getQStashToken(): string | null {
  const token = process.env.QSTASH_TOKEN;
  if (!token || token.length < 16) return null;
  return token;
}

/** Next.js base URL — QStash needs an absolute URL to POST to. */
function getBaseUrl(): string {
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
}

/**
 * Enqueue a playbook step for durable execution.
 *
 * The `requestId` from the ambient request context (if any) flows into
 * the job's headers so the worker can restore the correlation context
 * when it picks the job up off the queue.
 */
export async function enqueuePlaybookStep(payload: JobPayload): Promise<EnqueueResult> {
  const token = getQStashToken();
  const requestId = getRequestContext()?.requestId;

  // ─── In-process fallback (dev / no token configured) ─────────────
  if (!token) {
    const jobId = `ip_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    log.info("[in-process] would enqueue step", {
      jobId,
      runId: payload.runId,
      stepIndex: payload.stepIndex,
      agent: payload.agent,
      requestId,
    });
    // Fire-and-forget the actual work — keeps local dev behavior
    // identical to pre-queue. Production path (below) is durable.
    void executeJobInline(payload).catch((err) => {
      log.error("[in-process] step execution failed", {
        jobId,
        runId: payload.runId,
        stepIndex: payload.stepIndex,
        error: String(err),
      });
    });
    return { enqueued: true, jobId, mode: "in-process" };
  }

  // ─── QStash production path ─────────────────────────────────────
  const workerUrl = `${getBaseUrl()}/api/_internal/playbook-worker`;

  try {
    const res = await fetch("https://qstash.upstash.io/v2/publish/" + encodeURIComponent(workerUrl), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        // Retry 3 times with exponential backoff on 5xx; don't retry
        // on 4xx (those are our bugs, not transient failures).
        "Upstash-Retries": "3",
        // DLQ landing when all retries are exhausted.
        "Upstash-Failure-Callback": `${getBaseUrl()}/api/_internal/playbook-dlq`,
        // Propagate correlation so the worker sees our X-Request-Id.
        ...(requestId ? { "Upstash-Forward-X-Request-Id": requestId } : {}),
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      log.error("qstash publish failed", { status: res.status, detail: detail.slice(0, 200) });
      // Fall back to in-process rather than failing the playbook.
      return enqueuePlaybookStepInProcess(payload);
    }

    const body = await res.json().catch(() => ({}));
    const jobId = typeof body?.messageId === "string" ? body.messageId : `qs_${Date.now()}`;
    return { enqueued: true, jobId, mode: "qstash" };
  } catch (err) {
    log.error("qstash publish threw", { error: (err as Error).message });
    return enqueuePlaybookStepInProcess(payload);
  }
}

/** Internal helper for the QStash-failed fallback path. Keeps the
 *  in-process code in ONE place to avoid drift. */
async function enqueuePlaybookStepInProcess(payload: JobPayload): Promise<EnqueueResult> {
  const jobId = `fallback_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  void executeJobInline(payload).catch((err) => {
    log.error("[fallback] step execution failed", { jobId, error: String(err) });
  });
  return { enqueued: true, jobId, mode: "in-process" };
}

/** The inline executor that runs when QStash is unavailable. The
 *  production worker endpoint (/api/_internal/playbook-worker) calls
 *  the SAME function so both paths share behavior. */
export async function executeJobInline(payload: JobPayload): Promise<void> {
  // Lazy import to avoid creating a circular dependency with the
  // playbook-step executor module.
  const { runPlaybookStep } = await import("@/lib/playbook-step-runner");
  await runPlaybookStep(payload);
}

/**
 * Verify an incoming QStash webhook signature. QStash signs with its
 * own HMAC; we use their published SDK-equivalent verification.
 *
 * We DO NOT implement QStash signature verification from scratch here
 * — it requires tracking their current + previous signing keys via
 * their JWKS endpoint. Instead we document the integration point:
 * the worker endpoint SHOULD call `verifyQstashSignature()` which
 * lazy-imports `@upstash/qstash` (only installed when QSTASH_TOKEN
 * is set).
 */
export async function verifyQstashSignature(
  req: Request,
  rawBody: string,
): Promise<{ valid: boolean; reason?: string }> {
  const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;
  if (!currentSigningKey || !nextSigningKey) {
    return { valid: false, reason: "qstash_keys_not_configured" };
  }
  try {
    // Lazy-import so the package is only required in production workers.
    // @upstash/qstash is an optional peer dep — installs when QStash is
    // actually configured; the type cast makes tsc happy without it.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mod = (await import(/* webpackIgnore: true */ "@upstash/qstash" as any)) as {
      Receiver: new (o: { currentSigningKey: string; nextSigningKey: string }) => {
        verify(o: { signature: string; body: string }): Promise<boolean>;
      };
    };
    const receiver = new mod.Receiver({ currentSigningKey, nextSigningKey });
    const signature = req.headers.get("upstash-signature") ?? "";
    const valid = await receiver.verify({ signature, body: rawBody });
    return valid ? { valid: true } : { valid: false, reason: "signature_mismatch" };
  } catch (err) {
    log.warn("qstash signature verification failed", { error: (err as Error).message });
    return { valid: false, reason: "verify_threw" };
  }
}
