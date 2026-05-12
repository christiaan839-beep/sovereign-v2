/**
 * SOVEREIGN MATRIX — Code execution sandbox tool (Cook 54 / Tier 2 #10)
 *
 * Tier-3 tool that lets analyst / researcher agents EXECUTE code in
 * a secure container (e2b.dev / Modal / Firecracker). The tool itself
 * is provider-agnostic — caller wires the actual runner. The
 * registry's three-tier approval gate (Cook 36) restricts it to
 * admin-allowlist users; the schema literal `confirmExecution`
 * makes accidental dispatch a typo-resistant second gate.
 *
 * Contract:
 *
 *   - Language allowlist: python | node | bash (extendable).
 *   - Code size cap: 50 KB (prompt-injection ceiling).
 *   - Wall-clock timeout: caller-supplied (default 30 s, max 300 s).
 *   - Returns structured `stdout` / `stderr` / `exitCode` —
 *     never raw process objects (those are not JSON-serializable).
 *   - Network policy is the runner's responsibility; this tool
 *     forwards a hint via `allowNetwork: boolean` (default false).
 *
 * NO direct shell exec. The runner is the security boundary.
 */

import { z } from "zod";
import type { ToolDefinition } from "@/lib/tool-registry";

// ── Public types ──────────────────────────────────────────────────────────

export type SupportedLanguage = "python" | "node" | "bash";

export interface SandboxRequest {
  language: SupportedLanguage;
  code: string;
  /** Wall-clock cap in ms. Default 30000, max 300000. */
  timeoutMs?: number;
  /** Allow outbound network from inside the sandbox. Default false. */
  allowNetwork?: boolean;
  /** Optional caller-supplied stdin. */
  stdin?: string;
}

export interface SandboxResult {
  language: SupportedLanguage;
  exitCode: number;
  stdout: string;
  stderr: string;
  /** Wall-clock time the sandbox runtime took, milliseconds. */
  durationMs: number;
  /** True if the runner killed the process for hitting the timeout. */
  timedOut: boolean;
}

export type SandboxRunner = (req: SandboxRequest) => Promise<SandboxResult>;

// ── Schema ────────────────────────────────────────────────────────────────

const CODE_MAX_BYTES = 50_000;
const DEFAULT_TIMEOUT_MS = 30_000;
const MAX_TIMEOUT_MS = 300_000;

const SANDBOX_INPUT = z.object({
  language: z.enum(["python", "node", "bash"]),
  code: z
    .string()
    .min(1)
    .refine(
      (c) => new TextEncoder().encode(c).byteLength <= CODE_MAX_BYTES,
      `code must be <= ${CODE_MAX_BYTES} bytes`,
    ),
  timeoutMs: z.number().int().min(100).max(MAX_TIMEOUT_MS).optional(),
  allowNetwork: z.boolean().optional(),
  stdin: z.string().max(50_000).optional(),
  /** Anti-misfire literal — Tier 3 gate + admin allowlist already cover this,
   *  but the literal forces the model to be explicit about intent.  */
  confirmExecution: z.literal("I CONFIRM CODE EXECUTION"),
});

// ── Output shape passed back to the model ─────────────────────────────────

interface SandboxOutput {
  ok: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  language: SupportedLanguage;
  durationMs: number;
  timedOut: boolean;
}

const OUTPUT_TRUNCATE = 20_000;

/**
 * Truncate process output so the model doesn't burn its context
 * window on a 50 MB log dump. Adds an explicit `…[truncated]` marker.
 */
export function truncateOutput(s: string, max = OUTPUT_TRUNCATE): string {
  if (s.length <= max) return s;
  return s.slice(0, max) + `\n…[truncated ${s.length - max} chars]`;
}

// ── Tool factory ──────────────────────────────────────────────────────────

export function buildCodeSandboxTool(
  runner: SandboxRunner,
): ToolDefinition<z.infer<typeof SANDBOX_INPUT>, SandboxOutput> {
  return {
    name: "run_code",
    description:
      "Execute Python/Node/Bash code in a secure sandbox. Admin-only (Tier 3). 30s default timeout, 50KB code cap, no network unless explicitly granted.",
    inputSchema: SANDBOX_INPUT,
    tier: 3,
    execute: async (input) => {
      const result = await runner({
        language: input.language,
        code: input.code,
        timeoutMs: input.timeoutMs ?? DEFAULT_TIMEOUT_MS,
        allowNetwork: input.allowNetwork ?? false,
        stdin: input.stdin,
      });
      return {
        ok: result.exitCode === 0 && !result.timedOut,
        exitCode: result.exitCode,
        stdout: truncateOutput(result.stdout),
        stderr: truncateOutput(result.stderr),
        language: result.language,
        durationMs: result.durationMs,
        timedOut: result.timedOut,
      };
    },
  };
}

export const SANDBOX_CONSTANTS = {
  CODE_MAX_BYTES,
  DEFAULT_TIMEOUT_MS,
  MAX_TIMEOUT_MS,
  OUTPUT_TRUNCATE,
};
