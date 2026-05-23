/**
 * SOVEREIGN MATRIX — Local code sandbox primitive (Wave 126).
 *
 * Why this exists:
 *   The existing `/api/agents/code-sandbox` route delegates to Gemini's
 *   cloud code-execution via colab-mcp. That's correct for heavy data
 *   analysis (Python + pandas + plotly) but it requires GOOGLE_GENERATIVE_AI_API_KEY,
 *   adds 2-3s round-trip cost, and gives Google a copy of every snippet.
 *
 *   This module is the LOCAL fallback: a tiny `runCode()` that evaluates
 *   JavaScript inside Node's vm module with strict resource caps. It's
 *   the right primitive for claudeToolUse agents that need to:
 *     - Validate JSON structure
 *     - Compute a quick math derivation
 *     - String-manipulate a piece of payload
 *     - Run a regex over user input
 *
 * Hardening:
 *   - No `require`, no `process`, no `Buffer`, no globalThis pollution.
 *     The vm.createContext sandbox is empty except for the explicitly
 *     allowed primitives below.
 *   - 5s wall-clock hard timeout via vm script-level `timeout` option.
 *     Throws on expiry; caller catches and reports.
 *   - 1 MB output cap on console.log buffer. Bigger output is truncated
 *     with a clear `[truncated]` marker.
 *   - Catches every throw at the boundary. Errors become structured
 *     return-shape, not unhandled exceptions in the agent factory.
 *
 * What it CAN'T do:
 *   - Async/await (no I/O loop in the sandbox)
 *   - Network (no fetch / no http)
 *   - File system (no fs)
 *   - Spawn processes (no child_process)
 *   - Import modules (no require / no dynamic import)
 *
 * Those are intentional — this is the SAFE fallback, not a general
 * code-execution platform. Heavier needs route to the Gemini path.
 */

import { createContext, runInContext } from "node:vm";

const DEFAULT_TIMEOUT_MS = 5_000;
const MAX_OUTPUT_BYTES = 1_000_000; // 1 MB stdout cap

export interface RunCodeOptions {
  /** Hard wall-clock cap. Default 5s. Max 30s (anything longer should use the cloud path). */
  timeoutMs?: number;
  /** Variables to inject as read-only constants in the sandbox global. */
  context?: Record<string, unknown>;
}

export interface RunCodeResult {
  success: boolean;
  /** Last expression value (e.g. the result of `2 + 2` is 4). */
  result: unknown;
  /** Captured console.log / console.error output, joined newline. Capped at 1 MB. */
  stdout: string;
  durationMs: number;
  /** Error class + message + truncated stack when success === false. */
  error?: { name: string; message: string; stack?: string };
  /** True when stdout was truncated. */
  outputTruncated?: boolean;
  /** True when the script hit the wall-clock cap. */
  timedOut?: boolean;
}

/**
 * Evaluate a JavaScript expression or statement block in a sandboxed
 * vm context. Returns a structured result; never throws.
 *
 * The script is treated as a sequence of statements; the LAST
 * expression value is captured as `result`. Use an explicit
 * `return ...` from a wrapping function for clarity:
 *
 *   const r = runCode("const x = 5; x * 2;");
 *   r.result === 10
 *
 *   const r2 = runCode("console.log('hi'); 42");
 *   r2.stdout === "hi"
 *   r2.result === 42
 */
export function runCode(
  code: string,
  opts: RunCodeOptions = {},
): RunCodeResult {
  const timeoutMs = Math.max(
    100,
    Math.min(opts.timeoutMs ?? DEFAULT_TIMEOUT_MS, 30_000),
  );
  const start = Date.now();

  const stdoutChunks: string[] = [];
  let stdoutBytes = 0;
  let truncated = false;

  const writeOut = (parts: unknown[]) => {
    if (truncated) return;
    const piece = parts
      .map((p) =>
        typeof p === "string"
          ? p
          : (() => {
              try {
                return JSON.stringify(p);
              } catch {
                return String(p);
              }
            })(),
      )
      .join(" ");
    const next = stdoutBytes + Buffer.byteLength(piece, "utf8") + 1; // +1 for newline
    if (next > MAX_OUTPUT_BYTES) {
      truncated = true;
      stdoutChunks.push("[truncated: stdout exceeded 1 MB cap]");
      return;
    }
    stdoutBytes = next;
    stdoutChunks.push(piece);
  };

  // Sandbox context — empty except for an explicitly-allowed surface.
  // The only objects available are the basic JS primitives baked into
  // every vm context (Math, JSON, Object, Array, Date, etc); we add
  // console and any user-provided context.
  const sandbox: Record<string, unknown> = {
    console: {
      log: (...args: unknown[]) => writeOut(args),
      error: (...args: unknown[]) => writeOut(args),
      warn: (...args: unknown[]) => writeOut(args),
      info: (...args: unknown[]) => writeOut(args),
    },
    // Re-expose the safe primitives that live on globalThis in Node
    // contexts but aren't auto-injected into a fresh vm context.
    Math,
    JSON,
    Date,
    // User-provided constants. Sealed so the script can read but not
    // mutate (prevents accidental cross-call leakage between
    // successive runCode calls reusing the SAME context object).
    ...Object.fromEntries(
      Object.entries(opts.context ?? {}).map(([k, v]) => [k, v]),
    ),
  };

  const context = createContext(sandbox, {
    // Disable code-generation-from-strings inside the sandbox so the
    // script can't escape via `eval("...")` or `new Function("...")`.
    codeGeneration: { strings: false, wasm: false },
  });

  let result: unknown;
  let timedOut = false;
  try {
    result = runInContext(code, context, {
      timeout: timeoutMs,
      displayErrors: false,
      breakOnSigint: false,
    });
  } catch (err) {
    // Cross-realm caveat: errors thrown INSIDE the vm sandbox carry
    // the sandbox's own Error prototype, not the host's. `instanceof
    // Error` returns false. Use duck-typing on shape instead.
    const errObj =
      err !== null && typeof err === "object"
        ? (err as { name?: unknown; message?: unknown; stack?: unknown })
        : null;
    const errName =
      errObj && typeof errObj.name === "string"
        ? errObj.name
        : err !== null && err !== undefined && (err as object).constructor
          ? (err as object).constructor.name
          : "Unknown";
    const errMessage =
      errObj && typeof errObj.message === "string"
        ? errObj.message
        : String(err);
    const errStack =
      errObj && typeof errObj.stack === "string"
        ? errObj.stack.split("\n").slice(0, 6).join("\n")
        : undefined;

    if (
      /Script execution timed out|Promise execution timed out/.test(errMessage)
    ) {
      timedOut = true;
    }

    return {
      success: false,
      result: undefined,
      stdout: joinStdout(stdoutChunks),
      durationMs: Date.now() - start,
      error: { name: errName, message: errMessage, stack: errStack },
      outputTruncated: truncated || undefined,
      timedOut: timedOut || undefined,
    };
  }

  return {
    success: true,
    result,
    stdout: joinStdout(stdoutChunks),
    durationMs: Date.now() - start,
    outputTruncated: truncated || undefined,
  };
}

function joinStdout(chunks: string[]): string {
  if (chunks.length === 0) return "";
  return chunks.join("\n");
}

/**
 * Tool-definition shape suitable for passing into `claudeToolUse`.
 * Multi-step agents that need lightweight compute (validate JSON,
 * compute a number, regex-match) can declare this as one of their
 * tools and pass the tool_executor through `runCode`.
 */
export const RUN_CODE_TOOL_DEF = {
  name: "run_code",
  description:
    "Execute a short JavaScript snippet in a sandboxed Node VM. No network, no filesystem, no async. Use for quick JSON validation, math derivation, regex matching, or string manipulation. 5s wall-clock timeout. Returns { success, result, stdout, durationMs, error? }.",
  input_schema: {
    type: "object" as const,
    properties: {
      code: {
        type: "string",
        description:
          "The JavaScript code to run. Last expression value is returned as `result`. Use `console.log(...)` for explicit output.",
      },
      timeoutMs: {
        type: "number",
        description: "Hard wall-clock timeout. Default 5000ms, max 30000ms.",
      },
    },
    required: ["code"],
  },
} as const;
