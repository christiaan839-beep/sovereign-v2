import { z, type ZodType } from "zod";

/**
 * AGENT CONTRACT TEST HARNESS
 *
 * For every agent route we declare:
 *   - Its input schema (what the caller sends)
 *   - Its output schema (what the agent returns on success)
 *   - A set of valid fixtures (inputs the tests run through)
 *
 * The harness loads the route handler, invokes it with each fixture,
 * and asserts the response shape against the output schema. Drift in
 * the response shape (extra field, missing field, wrong type) fails
 * the test — which is the whole point: agents silently shipping a
 * different response shape is the #1 way dashboard pages break in
 * production.
 *
 * We do NOT mock the underlying AI calls. Contract tests verify the
 * CONTRACT (shape + status), not the content. If the model returns
 * garbage, the schema still passes — that's a quality test, not a
 * contract test. Keep them separate.
 *
 * Example:
 *   registerAgentContract({
 *     slug: "summarize",
 *     inputSchema: z.object({ text: z.string().min(1) }),
 *     outputSchema: z.object({ summary: z.string() }),
 *     fixtures: [
 *       { text: "Hello world" },
 *       { text: "Longer example with multiple sentences." },
 *     ],
 *   });
 */

export interface AgentContract<I, O> {
  /** Slug matching the registry key (path in /api/agents/<slug>). */
  slug: string;
  /** Shape of a valid request body. */
  inputSchema: ZodType<I>;
  /** Shape of a successful response. */
  outputSchema: ZodType<O>;
  /** At least one valid input. Multiple fixtures recommended. */
  fixtures: I[];
  /** Optional: skip this contract at runtime (e.g., requires a paid key). */
  skipIf?: () => boolean;
}

const CONTRACTS = new Map<string, AgentContract<unknown, unknown>>();

export function registerAgentContract<I, O>(contract: AgentContract<I, O>): void {
  if (CONTRACTS.has(contract.slug)) {
    throw new Error(`Duplicate contract for agent "${contract.slug}"`);
  }
  CONTRACTS.set(contract.slug, contract as AgentContract<unknown, unknown>);
}

export function getAllContracts(): AgentContract<unknown, unknown>[] {
  return Array.from(CONTRACTS.values());
}

/**
 * Common output envelope shared by createAgentRoute-wrapped agents.
 * The factory injects { success: true, ...payload } or { error: string }.
 */
export const AgentEnvelopeSuccess = <T extends z.ZodTypeAny>(payload: T) =>
  z.object({
    success: z.literal(true),
  }).passthrough().and(payload);

export const AgentEnvelopeError = z.object({
  error: z.string(),
  code: z.string().optional(),
}).passthrough();

/** Helper for agents that return arbitrary additional fields (common). */
export const Loose = z.object({}).passthrough();

export { z };
