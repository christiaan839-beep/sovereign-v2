/**
 * POST /api/agents/invoke/stream
 *
 * Streaming version of /api/agents/invoke. Returns `text/event-stream`
 * and pipes the model's token deltas to the client in real time.
 *
 * Event types emitted:
 *   event: agent        data: {id, name, slug, pricingCents}
 *   event: token        data: {text}            (many)
 *   event: attestation  data: {agentId, invocationId, inputHash, outputHash,
 *                              modelUsed, timestamp, slaVerdict, platform, _sig?}
 *                       — cryptographic proof of the completed run,
 *                         emitted once after the last token
 *   event: done         data: {earnings, invocationId, charsEmitted}
 *   event: error        data: {code, message}
 *
 * Same rate limit + input validation as the non-streaming endpoint.
 * Earnings are credited when the stream completes successfully —
 * a client disconnect mid-stream still credits because the server
 * detected the agent did produce output.
 */

import { checkIpRateLimit, extractClientIp } from "@/lib/api-guard";
import { evaluateSla } from "@/lib/agent-sla";
import { streamAi } from "@/lib/ai-stream";
import { creditEarning } from "@/lib/creator-earnings";
import { synthesizeSystemPromptFromManifest } from "@/lib/creator-submission-persistence";
import { signInvocation, type SlaVerdictLabel } from "@/lib/invocation-attestation";
import { createLogger } from "@/lib/logger";
import { recordSample } from "@/lib/slo-tracking";
import { db } from "@/db";
import { marketplaceAgents } from "@/db/schema";
import { eq, or, sql } from "drizzle-orm";

const log = createLogger("invoke-stream");

function databaseIsConfigured(): boolean {
  return typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0;
}

function generateInvocationId(): string {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 8);
  return `inv-stream-${ts}-${rnd}`;
}

/** Format a value as a one-line SSE event. Always ends with \n\n. */
function sseEvent(event: string, data: unknown): string {
  const payload = JSON.stringify(data);
  return `event: ${event}\ndata: ${payload}\n\n`;
}

export async function POST(request: Request): Promise<Response> {
  const ip = extractClientIp(request.headers);
  const gate = checkIpRateLimit(ip, {
    bucket: "marketplace-invoke-stream",
    windowMs: 60_000,
    max: 30,
  });
  if (!gate.allowed) {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ code: "rate_limited", message: "Slow down." })}\n\n`,
      {
        status: 429,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-store",
          "Retry-After": String(Math.ceil(gate.resetIn / 1000)),
        },
      },
    );
  }

  let body: { agent?: unknown; input?: unknown };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ code: "bad_input", message: "Invalid JSON body" })}\n\n`,
      { status: 400, headers: { "Content-Type": "text/event-stream" } },
    );
  }

  const agentIdOrSlug = typeof body.agent === "string" ? body.agent.trim() : "";
  const input = typeof body.input === "string" ? body.input.trim() : "";
  if (!agentIdOrSlug || !input) {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ code: "bad_input", message: "'agent' and 'input' are required" })}\n\n`,
      { status: 400, headers: { "Content-Type": "text/event-stream" } },
    );
  }
  if (!databaseIsConfigured()) {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ code: "no_db", message: "Marketplace offline" })}\n\n`,
      { status: 503, headers: { "Content-Type": "text/event-stream" } },
    );
  }

  // Resolve the agent before starting the stream so a "not_found"
  // returns a clean 404 rather than an empty stream the browser
  // holds open waiting for events.
  const rows = await db
    .select({
      id: marketplaceAgents.id,
      slug: marketplaceAgents.slug,
      name: marketplaceAgents.name,
      description: marketplaceAgents.description,
      authorEmail: marketplaceAgents.authorEmail,
      systemPrompt: marketplaceAgents.systemPrompt,
      pricePerRun: marketplaceAgents.pricePerRun,
      verificationStatus: marketplaceAgents.verificationStatus,
      isPublic: marketplaceAgents.isPublic,
      submissionSource: marketplaceAgents.submissionSource,
      manifestRaw: marketplaceAgents.manifestRaw,
    })
    .from(marketplaceAgents)
    .where(
      or(
        eq(marketplaceAgents.id, agentIdOrSlug),
        eq(marketplaceAgents.slug, agentIdOrSlug),
      ),
    )
    .limit(1);
  const agent = rows[0];
  if (!agent) {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ code: "not_found", message: "Agent not found" })}\n\n`,
      { status: 404, headers: { "Content-Type": "text/event-stream" } },
    );
  }
  if (agent.verificationStatus !== "verified" || !agent.isPublic) {
    return new Response(
      `event: error\ndata: ${JSON.stringify({ code: "not_live", message: "Agent not published" })}\n\n`,
      { status: 403, headers: { "Content-Type": "text/event-stream" } },
    );
  }

  // Pick the system prompt — SAM agents synthesize from manifest
  // so changes propagate without cache invalidation.
  let systemPrompt = agent.systemPrompt;
  if (agent.submissionSource === "sam-v1" && agent.manifestRaw && typeof agent.manifestRaw === "object") {
    const m = agent.manifestRaw as Record<string, unknown>;
    const guarantees: string[] = Array.isArray(m.guarantees)
      ? (m.guarantees as unknown[]).filter((g): g is string => typeof g === "string")
      : [];
    const purpose = typeof m.purpose === "string" ? m.purpose : agent.description;
    systemPrompt = synthesizeSystemPromptFromManifest(agent.name, purpose, guarantees);
  }

  const invocationId = generateInvocationId();
  const encoder = new TextEncoder();
  // Stream-latency clock starts HERE (after agent resolution) so the
  // SLO sample reflects model-facing latency, not DB lookup time.
  const streamStart = Date.now();

  // Build the SSE stream. Emits agent metadata first, then tokens,
  // then done event with earnings, then closes.
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        controller.enqueue(
          encoder.encode(
            sseEvent("agent", {
              id: agent.id,
              slug: agent.slug,
              name: agent.name,
              pricingCents: agent.pricePerRun,
            }),
          ),
        );

        let charsEmitted = 0;
        // Accumulate the full streamed output for attestation hashing.
        // Memory cost is bounded by maxTokens; for 2000 tokens that's
        // ~8KB — negligible vs the streaming savings.
        let fullOutput = "";
        const truncatedInput = input.slice(0, 8000);
        for await (const token of streamAi(truncatedInput, {
          system: systemPrompt,
          maxTokens: 2000,
          signal: request.signal,
        })) {
          charsEmitted += token.length;
          fullOutput += token;
          controller.enqueue(encoder.encode(sseEvent("token", { text: token })));
        }

        // Credit earnings only when the stream actually produced output.
        // A 0-byte stream likely means an upstream error the client
        // should retry; don't create phantom earnings rows.
        let creditRecorded = false;
        if (charsEmitted > 0 && agent.pricePerRun > 0) {
          creditRecorded = await creditEarning({
            agentId: agent.id,
            creatorEmail: agent.authorEmail,
            grossCents: agent.pricePerRun,
            invocationId,
          });
        } else if (charsEmitted > 0) {
          creditRecorded = true; // free agents still count as successful runs
        }

        // Counter bumps (fire-and-forget).
        if (charsEmitted > 0) {
          void db
            .update(marketplaceAgents)
            .set({
              totalRunCount: sql`${marketplaceAgents.totalRunCount} + 1`,
              weeklyRunCount: sql`${marketplaceAgents.weeklyRunCount} + 1`,
              revenueCents: sql`${marketplaceAgents.revenueCents} + ${agent.pricePerRun}`,
              creatorRevenueCents: sql`${marketplaceAgents.creatorRevenueCents} + ${Math.floor(agent.pricePerRun * 0.7)}`,
            })
            .where(eq(marketplaceAgents.id, agent.id))
            .catch(() => { /* cosmetic — never fail the stream */ });
        }

        const grossCents = agent.pricePerRun;
        const creatorCents = Math.floor(grossCents * 0.7);

        // Evaluate SLA + sign the attestation BEFORE emitting "done".
        // Order matters: buyers watching the stream want the attestation
        // delivered first so their UI can show "verified" right when
        // the last token arrives.
        if (charsEmitted > 0) {
          const slaVerdict = evaluateSla({
            manifestRaw: agent.manifestRaw,
            output: fullOutput,
            expectedJson: false,
          });
          const slaLabel: SlaVerdictLabel = slaVerdict.enforced
            ? slaVerdict.breached
              ? "breached"
              : "met"
            : "not_enforced";
          const attestationResult = await signInvocation({
            agentId: agent.id,
            invocationId,
            input: truncatedInput,
            output: fullOutput,
            modelUsed: "nim",
            slaVerdict: slaLabel,
          });
          controller.enqueue(
            encoder.encode(sseEvent("attestation", attestationResult.attestation)),
          );
        }

        controller.enqueue(
          encoder.encode(
            sseEvent("done", {
              invocationId,
              charsEmitted,
              earnings: {
                grossCents,
                creatorCents,
                platformCents: grossCents - creatorCents,
                creditRecorded,
              },
            }),
          ),
        );

        // Record SLO: a stream run is "successful" if it emitted any
        // tokens in under the 8s p95 target.
        const latency = Date.now() - streamStart;
        const passed = charsEmitted > 0 && latency < 8000;
        void recordSample("agent_latency_p95", latency, passed);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        log.warn("stream errored mid-flight", { invocationId, error: msg });
        controller.enqueue(
          encoder.encode(
            sseEvent("error", {
              code: "upstream_failed",
              message: msg,
            }),
          ),
        );
        // Record the failed sample so SLO reflects reality.
        const latency = Date.now() - streamStart;
        void recordSample("agent_latency_p95", latency, false);
      } finally {
        controller.close();
      }
    },
    cancel() {
      log.info("stream cancelled by client", { invocationId });
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      Connection: "keep-alive",
      // Nginx / Vercel fronts buffer by default — this turns that off.
      "X-Accel-Buffering": "no",
    },
  });
}
