/**
 * SOVEREIGN MATRIX — Browserbase runner (Cook 79)
 *
 * Concrete adapter for the Cook 61 `BrowserRunner` contract using
 * Browserbase's stateless session API. Each session is opened,
 * driven through the requested actions, and closed in one call.
 *
 * Falls back to a structured "not configured" result when
 * `BROWSERBASE_API_KEY` is absent.
 */

import type {
  BrowserRunner,
  BrowserSessionResult,
  BrowserActionInput,
  BrowserStepResult,
} from "@/lib/tools/browser-automation";

const BB_API = "https://api.browserbase.com/v1";

interface SessionContext {
  sessionId: string;
  apiKey: string;
}

async function createSession(apiKey: string): Promise<SessionContext> {
  const projectId = process.env.BROWSERBASE_PROJECT_ID;
  const res = await fetch(`${BB_API}/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-bb-api-key": apiKey,
    },
    body: JSON.stringify({ projectId }),
  });
  if (!res.ok) {
    throw new Error(
      `Browserbase session creation failed: ${res.status} ${await res.text()}`,
    );
  }
  const data = (await res.json()) as { id?: string };
  if (!data.id) throw new Error("Browserbase session missing id");
  return { sessionId: data.id, apiKey };
}

async function closeSession(ctx: SessionContext): Promise<void> {
  try {
    await fetch(`${BB_API}/sessions/${ctx.sessionId}`, {
      method: "DELETE",
      headers: { "x-bb-api-key": ctx.apiKey },
    });
  } catch {
    /* best-effort */
  }
}

async function runOne(
  ctx: SessionContext,
  action: BrowserActionInput,
  perStepTimeoutMs: number,
): Promise<BrowserStepResult> {
  const start = Date.now();
  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), perStepTimeoutMs)
    : null;
  try {
    const res = await fetch(`${BB_API}/sessions/${ctx.sessionId}/actions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-bb-api-key": ctx.apiKey,
      },
      body: JSON.stringify(action),
      signal: controller?.signal,
    });
    if (!res.ok) {
      return {
        kind: action.kind,
        ok: false,
        error: `Browserbase ${action.kind} returned ${res.status}`,
        durationMs: Date.now() - start,
      };
    }
    const data = (await res.json()) as {
      result?: string;
      ok?: boolean;
      error?: string;
    };
    return {
      kind: action.kind,
      ok: data.ok !== false,
      result: data.result,
      error: data.error,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    const aborted = err instanceof Error && err.name === "AbortError";
    return {
      kind: action.kind,
      ok: false,
      error: aborted
        ? `timeout after ${perStepTimeoutMs}ms`
        : err instanceof Error
          ? err.message
          : String(err),
      durationMs: Date.now() - start,
    };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export function buildBrowserbaseRunner(): BrowserRunner {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  if (!apiKey) {
    return async (actions): Promise<BrowserSessionResult> => ({
      steps: actions.map((a) => ({
        kind: a.kind,
        ok: false,
        error:
          "Browserbase runner not configured — set BROWSERBASE_API_KEY to enable",
        durationMs: 0,
      })),
      finalUrl: null,
      partialFailure: true,
    });
  }
  return async (actions, options): Promise<BrowserSessionResult> => {
    let ctx: SessionContext;
    try {
      ctx = await createSession(apiKey);
    } catch (err) {
      return {
        steps: [
          {
            kind: actions[0]?.kind ?? "navigate",
            ok: false,
            error: err instanceof Error ? err.message : String(err),
            durationMs: 0,
          },
        ],
        finalUrl: null,
        partialFailure: true,
      };
    }
    const steps: BrowserStepResult[] = [];
    let finalUrl: string | null = null;
    try {
      for (const action of actions) {
        const step = await runOne(ctx, action, options.perStepTimeoutMs);
        steps.push(step);
        if (action.kind === "navigate" && step.ok) {
          finalUrl = action.url;
        }
        // Hard stop on any failure — caller decides whether to retry.
        if (!step.ok) break;
      }
    } finally {
      await closeSession(ctx);
    }
    return {
      steps,
      finalUrl,
      partialFailure: steps.some((s) => !s.ok),
    };
  };
}
