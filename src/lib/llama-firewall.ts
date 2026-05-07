/**
 * LlamaFirewall — Meta's open-source agent firewall (Apache 2.0).
 *
 * https://github.com/meta-llama/PurpleLlama (LlamaFirewall)
 *
 * Three guardrail capabilities:
 *
 *   1. PromptGuard — detects prompt-injection attempts in user
 *      input before the model sees it (BERT-style classifier).
 *   2. AlignmentCheck — verifies the model's planned tool calls
 *      align with the user's stated intent (catches goal drift
 *      after a successful injection).
 *   3. CodeShield — static analysis on generated code for known
 *      insecure patterns (CWE coverage).
 *
 * LlamaFirewall is Python-first. For Next.js/edge usage we run
 * it as a sidecar HTTP service (their `llamafirewall serve`
 * command, or any container that exposes `/check`) and call
 * it over REST. This file is the typed client.
 *
 * Failure mode:
 *   - `LLAMA_FIREWALL_URL` unset → `check()` returns
 *     `{ allow: true, skipped: "LLAMA_FIREWALL_URL not set" }`.
 *     The output verifier degrades to its existing 5-layer
 *     pipeline; nothing breaks.
 *   - Sidecar 5xx / timeout → fail-OPEN by default (allow the
 *     request through with a warning logged + Sentry capture).
 *     Operator can flip `LLAMA_FIREWALL_FAIL_CLOSED=1` to
 *     fail-closed if they prefer paranoid posture.
 *
 * Why fail-open by default: at customer #0–5, a misbehaving
 * sidecar that blocks legitimate requests is a much worse
 * customer experience than missing one prompt-injection. As
 * usage scales we ratchet to fail-closed.
 *
 * Wiring into the existing safety pipeline lives in
 * `src/lib/output-verifier.ts` — this file is just the client.
 */

import { fetchWithTimeout, TimeoutError } from "@/lib/with-timeout";
import { captureException } from "@/lib/sentry";
import { createLogger } from "@/lib/logger";

const log = createLogger("llama-firewall");

export type FirewallScanType =
  | "prompt-guard"
  | "alignment-check"
  | "code-shield";

export interface FirewallCheckArgs {
  /** Free-form text to scan. For alignment-check, pass the
   * user's intent + the agent's planned-action JSON concatenated. */
  content: string;
  /** Which scanner(s) to run. Empty = all available. */
  scans?: FirewallScanType[];
  /** Optional context the firewall can use for alignment-check. */
  context?: {
    userIntent?: string;
    plannedToolCalls?: Array<{ name: string; args: unknown }>;
  };
  /** Per-call timeout in ms. Default 3 s — guardrails on the hot path. */
  timeoutMs?: number;
}

export interface FirewallVerdict {
  /** Final allow/deny decision. */
  allow: boolean;
  /** When `allow=false`, which scanner blocked. */
  blockedBy?: FirewallScanType;
  /** Human-readable reason — surfaced in error_logs + Sentry. */
  reason?: string;
  /** Confidence in [0,1] for the highest-severity finding. */
  confidence?: number;
  /** Per-scanner raw output, for debugging. */
  scans?: Partial<
    Record<
      FirewallScanType,
      { score: number; flagged: boolean; detail?: string }
    >
  >;
  /** When set, the call was skipped (env not configured). */
  skipped?: string;
}

const DEFAULT_TIMEOUT_MS = 3_000;

function getEndpoint(): string | null {
  return process.env.LLAMA_FIREWALL_URL?.trim() || null;
}

function failClosed(): boolean {
  return process.env.LLAMA_FIREWALL_FAIL_CLOSED === "1";
}

/**
 * Run LlamaFirewall against `content`. Returns a verdict with
 * structured per-scanner output for telemetry.
 *
 * Always succeeds in returning a verdict — never throws. Even
 * sidecar errors degrade to a graceful allow (or deny if
 * `LLAMA_FIREWALL_FAIL_CLOSED=1`).
 */
export async function check(args: FirewallCheckArgs): Promise<FirewallVerdict> {
  const endpoint = getEndpoint();
  if (!endpoint) {
    return {
      allow: true,
      skipped: "LLAMA_FIREWALL_URL not configured — guardrail skipped",
    };
  }

  const timeoutMs = args.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const res = await fetchWithTimeout(`${endpoint.replace(/\/$/, "")}/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        content: args.content,
        scans: args.scans ?? ["prompt-guard", "alignment-check", "code-shield"],
        context: args.context ?? {},
      }),
      timeoutMs,
      label: "llama-firewall-check",
    });

    if (!res.ok) {
      const reason = `LlamaFirewall HTTP ${res.status}`;
      log.warn(reason);
      return failClosed()
        ? { allow: false, reason, blockedBy: "prompt-guard" }
        : { allow: true, skipped: reason };
    }

    const data = (await res.json()) as {
      allow: boolean;
      blocked_by?: FirewallScanType;
      reason?: string;
      confidence?: number;
      scans?: FirewallVerdict["scans"];
    };

    return {
      allow: data.allow,
      blockedBy: data.blocked_by,
      reason: data.reason,
      confidence: data.confidence,
      scans: data.scans,
    };
  } catch (err) {
    if (err instanceof TimeoutError) {
      log.warn("LlamaFirewall timed out", { timeoutMs });
    } else {
      captureException(err, {
        module: "llama-firewall",
        action: "check",
        severity: "warning",
      });
    }
    return failClosed()
      ? {
          allow: false,
          reason:
            err instanceof Error ? err.message : "LlamaFirewall unreachable",
          blockedBy: "prompt-guard",
        }
      : {
          allow: true,
          skipped:
            err instanceof Error ? err.message : "LlamaFirewall unreachable",
        };
  }
}

/**
 * Convenience wrapper for the prompt-injection check only — used
 * as a Layer-6 pre-flight in the output verifier on user input.
 */
export async function checkPromptInjection(
  userPrompt: string,
): Promise<FirewallVerdict> {
  return check({ content: userPrompt, scans: ["prompt-guard"] });
}

/**
 * Convenience wrapper for code-shield — used post-generation when
 * an agent emits code (code-reviewer, code-sandbox routes).
 */
export async function checkGeneratedCode(
  code: string,
): Promise<FirewallVerdict> {
  return check({ content: code, scans: ["code-shield"] });
}

export function isLlamaFirewallConfigured(): boolean {
  return getEndpoint() !== null;
}
