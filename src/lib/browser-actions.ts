/**
 * SOVEREIGN MATRIX — Typed Browser Actions
 *
 * Phase 1 of the Computer Use Expansion plan. Ships `fillForm` as the first
 * typed action an agent can run against a live `BrowserContextLike` (from
 * browser-session.ts). The scaffold is intentionally shaped so follow-up
 * actions (`click`, `waitForSelector`, `extractTable`) slot in without
 * refactoring callers:
 *
 *   - Each action validates its own inputs via Zod.
 *   - Each action takes the same first two params (context, input).
 *   - Each action returns a `{ success, ... }` envelope.
 *   - The ACTION_REGISTRY exposes actions by name for the future
 *     `/api/agents/computer-use-persistent/action` route (Phase 2).
 *
 * ── Design choices ──
 *
 * 1. **Actions operate on a BrowserContextLike, not a pre-opened page.**
 *    Each invocation opens a fresh page, does its work, and lets the
 *    caller decide whether to close it. That means an agent can call
 *    `fillForm → click → extractTable` across the SAME session without
 *    re-auth (the context keeps cookies), while each action stays pure
 *    with respect to page state.
 *
 * 2. **Sequential fills, not parallel.**
 *    `Promise.all(fields.map(f => page.fill(...)))` is tempting but wrong —
 *    modern SPAs trigger onchange side effects that can race. We fill in
 *    order so the DOM state progression is deterministic and reproducible
 *    (critical when this work later powers the teach-once replay engine).
 *
 * 3. **Failures return a structured envelope, not throws.**
 *    Input validation still throws (Zod `.parse`) because the caller has a
 *    bug. Runtime failures (selector missing, context closed, network) go
 *    into `{ success: false, error, filled }` so the orchestrator can
 *    decide whether to retry, escalate to HITL, or abort the playbook.
 *
 * 4. **No direct Playwright import.**
 *    Everything here talks to the minimal `PageLike` / `BrowserContextLike`
 *    surface. That keeps the module drop-in compatible with the Browserbase
 *    and Hyperbrowser adapters once they land (Phase 2, Task 8).
 */

import { z } from "zod";

import type { BrowserContextLike } from "@/lib/browser-session";

// ── Zod schemas ─────────────────────────────────────────────────────────

const FillFormFieldSchema = z.object({
  selector: z.string().min(1, "selector must be a non-empty string"),
  value: z.string(),
});

const FillFormInputSchema = z.object({
  fields: z
    .array(FillFormFieldSchema)
    .nonempty("fields must be a non-empty array"),
});

export type FillFormField = z.infer<typeof FillFormFieldSchema>;
export type FillFormInput = z.infer<typeof FillFormInputSchema>;

export interface FillFormResult {
  success: boolean;
  filled: number;
  /** Present only on failure. Human-readable reason for the first error. */
  error?: string;
}

/**
 * Fill a sequence of form fields on a fresh page, in order.
 *
 * Educational note: we deliberately open a new page each invocation rather
 * than accepting an already-open `PageLike`. That keeps the action atomic
 * from the caller's perspective — if you want to chain actions on the same
 * page, use a Phase-2 multi-step action once we ship them. For Phase 1,
 * one action = one page = one deterministic result.
 */
export async function fillForm(
  context: BrowserContextLike,
  rawInput: FillFormInput,
): Promise<FillFormResult> {
  // Zod throws ZodError on bad input. We let it bubble — it's a developer
  // error, not a runtime condition the orchestrator needs to recover from.
  const input = FillFormInputSchema.parse(rawInput);

  let filled = 0;
  try {
    const page = await context.newPage();
    for (const field of input.fields) {
      await page.fill(field.selector, field.value);
      filled += 1;
    }
    return { success: true, filled };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, filled, error: message };
  }
}

// ── Action registry ─────────────────────────────────────────────────────
//
// The registry maps action names to their implementations. Phase 2 (Task
// 12) will route a JSON payload through this map. Keeping the types loose
// (`unknown` inputs, `unknown` outputs) is intentional — each action
// re-validates with its own Zod schema, so the registry doesn't need to
// know the shape in advance.

export type BrowserAction = (
  context: BrowserContextLike,
  input: unknown,
) => Promise<unknown>;

export const ACTION_REGISTRY: Record<string, BrowserAction> = {
  fillForm: (ctx, input) => fillForm(ctx, input as FillFormInput),
};

export function getKnownActions(): string[] {
  return Object.keys(ACTION_REGISTRY);
}
