import { z, type ZodType } from "zod";

/**
 * AGENT EVALS HARNESS
 *
 * Unlike contract tests (src/lib/__tests__/contracts/) which verify
 * response SHAPE, evals verify response QUALITY — does the agent
 * actually produce useful output for a known input?
 *
 * Why we needed this:
 *   - Contract tests pass if the agent returns `{ok: true, leads: []}`
 *   - An eval catches that an empty array means the agent failed to
 *     generate anything useful for a prompt it should have handled
 *   - Prevents a whole class of regressions where refactoring breaks
 *     the agent in a way that still matches the schema
 *
 * Eval philosophy (inspired by Anthropic's internal eval practices):
 *   - Small, focused, fast — each eval runs in <30s
 *   - Deterministic assertions only: length, presence-of-field,
 *     regex match, NO "does this look right" LLM-as-judge (expensive,
 *     flaky, deepens the testing-with-testing-with-testing hole)
 *   - SKIP gracefully when provider keys are missing — CI without API
 *     keys passes the eval run, just records them as skipped
 *   - Golden-set style: 30 reference prompts × expected-shape assertions
 *
 * Run:
 *   npx vitest run src/lib/__tests__/agent-evals
 *
 * Gating merges on these:
 *   .github/workflows/evals.yml runs this with real API keys; the
 *   merge is blocked if any eval regresses.
 */

export interface AgentEval<I = unknown, O = unknown> {
  /** Slug matching the registry key (agents/<slug>). */
  slug: string;
  /** Short name shown in test output ("Leads finds US SaaS companies"). */
  name: string;
  /** Input fixture matching the agent's inputSchema. */
  input: I;
  /** Zod schema that the response must match + inspect. */
  expect: ZodType<O>;
  /** Optional free-form assertions run after schema validation. Throw
   *  to fail the eval; return void on success. */
  assertions?: (output: O) => void | Promise<void>;
  /** Skip if missing API keys. Called before invocation. */
  skipIf?: () => boolean;
  /** Deadline in ms (default 30s). */
  timeoutMs?: number;
}

const REGISTERED: AgentEval[] = [];

export function registerEval<I, O>(eval_: AgentEval<I, O>): void {
  REGISTERED.push(eval_ as AgentEval);
}

export function getAllEvals(): AgentEval[] {
  return REGISTERED.slice();
}

/** Helper: assert an array has at least N items, else throw. */
export function assertArrayAtLeast(arr: unknown, n: number, field: string): void {
  if (!Array.isArray(arr) || arr.length < n) {
    throw new Error(
      `${field}: expected array with >=${n} items, got ${
        Array.isArray(arr) ? arr.length : typeof arr
      }`,
    );
  }
}

/** Helper: assert a string contains ALL of the given substrings (case-insensitive). */
export function assertStringContains(str: unknown, needles: string[], field: string): void {
  if (typeof str !== "string") {
    throw new Error(`${field}: expected string, got ${typeof str}`);
  }
  const lower = str.toLowerCase();
  const missing = needles.filter((n) => !lower.includes(n.toLowerCase()));
  if (missing.length > 0) {
    throw new Error(
      `${field}: missing expected substrings: ${missing.join(", ")}\n  Actual: "${str.slice(0, 200)}..."`,
    );
  }
}

/** Helper: assert a string is at least N chars long (catches empty/stub outputs). */
export function assertStringMinLength(str: unknown, minLen: number, field: string): void {
  if (typeof str !== "string" || str.length < minLen) {
    throw new Error(
      `${field}: expected string with >=${minLen} chars, got ${
        typeof str === "string" ? str.length : typeof str
      }`,
    );
  }
}

/** Common output envelope — every factory-wrapped agent ships
 *  `{success?: true, _meta?: {...}, ...payload}`. Evals can .and(theirPayload). */
export const EnvelopeWithMeta = z
  .object({
    _meta: z
      .object({
        agent: z.string(),
        durationMs: z.number(),
        timestamp: z.string(),
        modelsConsulted: z.array(z.string()).optional(),
        providersConsulted: z.array(z.string()).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export { z };
