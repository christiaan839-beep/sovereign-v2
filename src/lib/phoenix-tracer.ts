/**
 * Phoenix tracer — emits OpenTelemetry spans for every AI call so
 * we can debug prompts, attribute cost per customer, and inspect
 * traces in Phoenix's web UI without standing up a paid platform.
 *
 * Phoenix is Apache-2.0, self-hostable, and free
 * (https://phoenix.arize.com / https://github.com/Arize-ai/phoenix).
 * It speaks OpenTelemetry — so this module emits OTel spans via
 * `fetch` to the OTLP/HTTP collector. No SDK lock-in.
 *
 * Why a hand-rolled OTel exporter and not @arizeai/openinference:
 *
 *   1. The official auto-instrumentation pulls in
 *      @opentelemetry/sdk-node which has a Node-only dependency
 *      tree. Several of our agent routes run on the edge runtime;
 *      a Node-only tracer crashes them.
 *   2. We only emit one span shape (`ai.call`) — a 60-line custom
 *      exporter is a smaller dependency surface than an SDK.
 *   3. Graceful degradation matters: if `PHOENIX_OTLP_ENDPOINT`
 *      is unset, every `traceAi()` call is a zero-cost no-op. The
 *      OTel SDK pre-builds a noop tracer but still bundles ~3 MB.
 *
 * Wiring into the unified router lives in `src/lib/ai.ts`. This
 * file is just the typed client + the OTLP/HTTP exporter.
 *
 * Self-host Phoenix locally: `docker compose -f
 * docker-compose.phoenix.yml up -d`. The compose file maps
 * port 6006 (UI) and 6006 (OTLP/HTTP collector) on the same
 * container. Set `PHOENIX_OTLP_ENDPOINT=http://localhost:6006/v1/traces`
 * in your `.env.local` and every AI call appears in the
 * traces tab of `http://localhost:6006`.
 */

import { fetchWithTimeout, TimeoutError } from "@/lib/with-timeout";
import { createLogger } from "@/lib/logger";

const log = createLogger("phoenix-tracer");

export interface AiSpanAttributes {
  /** Provider bucket — anthropic | nvidia-nim | gemini | groq | etc. */
  provider: string;
  /** Specific model id served (e.g. "nvidia/llama-3.1-nemotron-ultra"). */
  model: string;
  /** Logical operation — agent name, route, or "ai-call". */
  operation: string;
  /** Reported prompt-token count, when known. */
  inputTokens?: number;
  /** Reported completion-token count, when known. */
  outputTokens?: number;
  /** Estimated USD cents for the call (from cost-ledger). */
  costCents?: number;
  /** Authenticated user id, when applicable. */
  userId?: string;
  /** Tenant id, when applicable. */
  tenantId?: string;
  /** Request id from the route, for cross-referencing logs. */
  requestId?: string;
  /** Whether the call ultimately succeeded. */
  success: boolean;
  /** Error message when `success=false`. */
  error?: string;
  /** Free-form metadata — keep keys flat, < 10 entries. */
  extra?: Record<string, string | number | boolean>;
}

export interface AiSpanInput {
  /** Sanitised prompt text — first 1024 chars retained. */
  prompt?: string;
  /** Sanitised completion text — first 1024 chars retained. */
  completion?: string;
}

interface ExportedSpan {
  /** Hex-encoded 16-byte trace id. */
  traceId: string;
  /** Hex-encoded 8-byte span id. */
  spanId: string;
  /** Unix epoch nanoseconds. */
  startTimeUnixNano: string;
  /** Unix epoch nanoseconds. */
  endTimeUnixNano: string;
  attributes: AiSpanAttributes & { sample?: AiSpanInput };
}

const SERVICE_NAME = "sovereign-matrix";
const PHOENIX_PROJECT = process.env.PHOENIX_PROJECT_NAME ?? "default";
const MAX_PROMPT_PREVIEW_CHARS = 1024;
const EXPORT_TIMEOUT_MS = 3_000;

function getEndpoint(): string | null {
  return process.env.PHOENIX_OTLP_ENDPOINT?.trim() || null;
}

function isConfigured(): boolean {
  return getEndpoint() !== null;
}

/**
 * Cryptographically strong span/trace id generation. Uses the
 * Web Crypto API which is available in both Node.js and edge.
 */
function newId(bytes: number): string {
  const buf = new Uint8Array(bytes);
  crypto.getRandomValues(buf);
  return Array.from(buf, (b) => b.toString(16).padStart(2, "0")).join("");
}

// One million as BigInt. Defined as a constant rather than the
// `1_000_000n` literal so this file compiles under pre-ES2020 lib
// targets — the rest of the codebase doesn't rely on n-suffix
// literals and we don't need to lift the global tsconfig target
// just for one constant.
const NANOS_PER_MS = BigInt(1_000_000);

function nanosFromMs(ms: number): string {
  // BigInt for 64-bit precision on epoch-nanos
  return (BigInt(Math.floor(ms)) * NANOS_PER_MS).toString();
}

/**
 * Truncate prompts/completions before they leave our process.
 * Phoenix accepts arbitrary-size attributes but we cap to keep
 * payloads small + reduce accidental PII surface area.
 */
function clip(s: string | undefined): string | undefined {
  if (!s) return undefined;
  if (s.length <= MAX_PROMPT_PREVIEW_CHARS) return s;
  return s.slice(0, MAX_PROMPT_PREVIEW_CHARS) + " …[truncated]";
}

/**
 * Convert our internal span to OTLP/HTTP JSON. Phoenix accepts
 * the standard OpenTelemetry trace JSON format — see
 * https://github.com/open-telemetry/opentelemetry-proto/blob/main/opentelemetry/proto/trace/v1/trace.proto
 */
function toOtlpResourceSpans(span: ExportedSpan) {
  const attrs = span.attributes;
  const otelAttrs: Array<{
    key: string;
    value: { stringValue?: string; intValue?: string; boolValue?: boolean };
  }> = [];

  function pushString(key: string, value: string | undefined) {
    if (value === undefined || value === null) return;
    otelAttrs.push({ key, value: { stringValue: value } });
  }
  function pushInt(key: string, value: number | undefined) {
    if (value === undefined || value === null) return;
    otelAttrs.push({ key, value: { intValue: String(Math.round(value)) } });
  }
  function pushBool(key: string, value: boolean | undefined) {
    if (value === undefined || value === null) return;
    otelAttrs.push({ key, value: { boolValue: value } });
  }

  // Standard OpenInference attribute keys so Phoenix groups + filters work
  pushString("openinference.span.kind", "LLM");
  pushString("llm.provider", attrs.provider);
  pushString("llm.model_name", attrs.model);
  pushString("operation.name", attrs.operation);
  pushInt("llm.token_count.prompt", attrs.inputTokens);
  pushInt("llm.token_count.completion", attrs.outputTokens);
  pushInt("llm.cost.cents", attrs.costCents);
  pushString("user.id", attrs.userId);
  pushString("tenant.id", attrs.tenantId);
  pushString("request.id", attrs.requestId);
  pushBool("operation.success", attrs.success);
  pushString("operation.error", attrs.error);
  pushString("input.value", clip(attrs.sample?.prompt));
  pushString("output.value", clip(attrs.sample?.completion));
  if (attrs.extra) {
    for (const [k, v] of Object.entries(attrs.extra)) {
      if (typeof v === "string") pushString(`extra.${k}`, v);
      else if (typeof v === "number") pushInt(`extra.${k}`, v);
      else if (typeof v === "boolean") pushBool(`extra.${k}`, v);
    }
  }

  return {
    resourceSpans: [
      {
        resource: {
          attributes: [
            { key: "service.name", value: { stringValue: SERVICE_NAME } },
            {
              key: "phoenix.project.name",
              value: { stringValue: PHOENIX_PROJECT },
            },
          ],
        },
        scopeSpans: [
          {
            scope: { name: "sovereign-matrix.ai" },
            spans: [
              {
                traceId: span.traceId,
                spanId: span.spanId,
                name: attrs.operation,
                kind: 3, // SPAN_KIND_CLIENT
                startTimeUnixNano: span.startTimeUnixNano,
                endTimeUnixNano: span.endTimeUnixNano,
                attributes: otelAttrs,
                status: {
                  code: attrs.success ? 1 /* OK */ : 2 /* ERROR */,
                  message: attrs.error ?? "",
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

async function exportSpan(span: ExportedSpan): Promise<void> {
  const endpoint = getEndpoint();
  if (!endpoint) return;
  try {
    const res = await fetchWithTimeout(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(toOtlpResourceSpans(span)),
      timeoutMs: EXPORT_TIMEOUT_MS,
      label: "phoenix-export",
    });
    if (!res.ok) {
      log.warn("Phoenix export non-2xx", { status: res.status });
    }
  } catch (err) {
    if (err instanceof TimeoutError) {
      // Phoenix sidecar slow — don't propagate; observability is
      // never on the critical path.
      return;
    }
    log.warn("Phoenix export failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Wrap an async AI call so its duration, attributes, and (small)
 * sample of input/output emit as a Phoenix trace. Returns the
 * inner result unchanged. Never throws because of telemetry —
 * if the Phoenix sidecar is gone, the AI call still proceeds.
 *
 * Usage:
 *   const text = await traceAi(
 *     { provider: "nvidia-nim", model: nimModel.id, operation: "lead-blitz" },
 *     async () => nimChat(prompt, system),
 *     { sample: { prompt } },
 *   );
 */
export async function traceAi<T>(
  baseAttrs: Pick<
    AiSpanAttributes,
    | "provider"
    | "model"
    | "operation"
    | "userId"
    | "tenantId"
    | "requestId"
    | "extra"
  >,
  fn: () => Promise<T>,
  opts: {
    /** Capture a small sample of input/output for the trace UI. */
    sample?: AiSpanInput;
    /**
     * Extract input/output token counts from the result. Called
     * with whatever `fn()` returned. If your `fn()` returns just
     * the text string, leave this unset — span emits without
     * token counts.
     */
    extractTokens?: (result: T) => { input?: number; output?: number };
  } = {},
): Promise<T> {
  const startMs = Date.now();
  const traceId = newId(16);
  const spanId = newId(8);

  let result: T;
  let success = true;
  let error: string | undefined;

  try {
    result = await fn();
    return result;
  } catch (err) {
    success = false;
    error = err instanceof Error ? err.message : String(err);
    throw err;
  } finally {
    if (isConfigured()) {
      const endMs = Date.now();
      let inputTokens: number | undefined;
      let outputTokens: number | undefined;
      try {
        const t =
          opts.extractTokens && success
            ? opts.extractTokens(result!)
            : undefined;
        inputTokens = t?.input;
        outputTokens = t?.output;
      } catch {
        // Token extraction is best-effort.
      }
      void exportSpan({
        traceId,
        spanId,
        startTimeUnixNano: nanosFromMs(startMs),
        endTimeUnixNano: nanosFromMs(endMs),
        attributes: {
          ...baseAttrs,
          inputTokens,
          outputTokens,
          success,
          error,
          sample: opts.sample,
        },
      });
    }
  }
}

export function isPhoenixConfigured(): boolean {
  return isConfigured();
}
