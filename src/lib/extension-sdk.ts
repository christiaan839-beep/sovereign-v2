/**
 * SOVEREIGN MATRIX — Extension SDK (Cook 65 / Tier 5 #22 + #23)
 *
 * Shared protocol library for the browser extension AND the VS Code
 * extension. Both surfaces need to:
 *
 *   1. Auth against the platform via a Personal Access Token (PAT).
 *   2. POST a normalized "selection" — selected text, surrounding
 *      context, source url / file path — to /api/agents/:slug.
 *   3. Render the structured response (headline, body, citations,
 *      receipt id) without each extension reinventing the rules.
 *
 * The SDK is pure — caller injects the `fetch` impl so it works in
 * both the browser (`window.fetch`) and the VS Code extension host
 * (`node-fetch` / `globalThis.fetch`).
 */

// ── Public types ──────────────────────────────────────────────────────────

export interface AuthConfig {
  /** Base URL (no trailing slash). */
  apiBase: string;
  /** Personal access token. */
  pat: string;
  /** Optional client identifier for analytics ("browser-ext" | "vscode-ext"). */
  clientId?: string;
}

export type Selection =
  | {
      kind: "browser-text";
      text: string;
      pageUrl: string;
      pageTitle?: string;
    }
  | {
      kind: "editor-text";
      text: string;
      languageId: string;
      filePath?: string;
      lineRange?: { start: number; end: number };
    };

export interface InvokeRequest {
  agentSlug: string;
  selection: Selection;
  /** Optional per-request controls. */
  options?: {
    timeoutMs?: number;
    streaming?: boolean;
  };
}

export interface InvokeResponse {
  receiptId: string;
  headline: string;
  body: string;
  citations: Array<{ id: string; label: string; url?: string }>;
  /** Whether the response was streamed. */
  streamed: boolean;
}

export type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>;

export type InvokeOutcome =
  | { ok: true; result: InvokeResponse }
  | {
      ok: false;
      reason:
        | "missing-pat"
        | "missing-agent"
        | "invalid-selection"
        | "rate-limited"
        | "upstream-error"
        | "network-error"
        | "malformed-response";
      status?: number;
      message?: string;
    };

// ── Validation ────────────────────────────────────────────────────────────

const MAX_SELECTION_BYTES = 50_000;
const DEFAULT_TIMEOUT_MS = 30_000;

function selectionByteLength(s: Selection): number {
  return new TextEncoder().encode(s.text).byteLength;
}

function validateSelection(s: Selection): string | null {
  if (!s.text || s.text.trim().length === 0) return "selection is empty";
  if (selectionByteLength(s) > MAX_SELECTION_BYTES) {
    return `selection exceeds ${MAX_SELECTION_BYTES} bytes`;
  }
  if (s.kind === "browser-text") {
    try {
      const u = new URL(s.pageUrl);
      if (u.protocol !== "https:" && u.protocol !== "http:") {
        return "browser selection pageUrl must be http(s)";
      }
    } catch {
      return "browser selection pageUrl is malformed";
    }
  }
  return null;
}

// ── Public API ────────────────────────────────────────────────────────────

const AGENT_SLUG_RE = /^[a-z][a-z0-9-]{1,63}$/;

/**
 * Invoke an agent with a typed selection. Returns a structured
 * outcome (no exceptions). Composable in both extension hosts.
 */
export async function invokeAgent(
  auth: AuthConfig,
  req: InvokeRequest,
  fetchImpl: FetchImpl,
): Promise<InvokeOutcome> {
  if (!auth.pat) return { ok: false, reason: "missing-pat" };
  if (!AGENT_SLUG_RE.test(req.agentSlug)) {
    return { ok: false, reason: "missing-agent" };
  }
  const validationError = validateSelection(req.selection);
  if (validationError) {
    return {
      ok: false,
      reason: "invalid-selection",
      message: validationError,
    };
  }

  const url = `${auth.apiBase}/api/agents/${req.agentSlug}`;
  const timeoutMs = req.options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller =
    typeof AbortController !== "undefined" ? new AbortController() : null;
  const timer = controller
    ? setTimeout(() => controller.abort(), timeoutMs)
    : null;

  let res: Response;
  try {
    res = await fetchImpl(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${auth.pat}`,
        "Content-Type": "application/json",
        "X-Sovereign-Client": auth.clientId ?? "extension",
      },
      body: JSON.stringify(req.selection),
      signal: controller?.signal,
    });
  } catch (err) {
    return {
      ok: false,
      reason: "network-error",
      message: err instanceof Error ? err.message : String(err),
    };
  } finally {
    if (timer) clearTimeout(timer);
  }

  if (res.status === 429) {
    return { ok: false, reason: "rate-limited", status: 429 };
  }
  if (res.status < 200 || res.status >= 300) {
    return { ok: false, reason: "upstream-error", status: res.status };
  }
  let parsed: unknown;
  try {
    parsed = await res.json();
  } catch {
    return { ok: false, reason: "malformed-response" };
  }
  if (!isInvokeResponse(parsed)) {
    return { ok: false, reason: "malformed-response" };
  }
  return { ok: true, result: parsed };
}

function isInvokeResponse(x: unknown): x is InvokeResponse {
  if (typeof x !== "object" || x === null) return false;
  const o = x as Record<string, unknown>;
  return (
    typeof o.receiptId === "string" &&
    typeof o.headline === "string" &&
    typeof o.body === "string" &&
    Array.isArray(o.citations) &&
    typeof o.streamed === "boolean"
  );
}

/**
 * Render an InvokeResponse as a plain-text block for hosts that
 * don't support rich rendering (terminal output, hover popups).
 */
export function renderPlainText(r: InvokeResponse): string {
  const lines = [r.headline, "", r.body];
  if (r.citations.length > 0) {
    lines.push("", "Citations:");
    for (const c of r.citations) {
      lines.push(`  [${c.id}] ${c.label}${c.url ? ` — ${c.url}` : ""}`);
    }
  }
  lines.push("", `Receipt: ${r.receiptId}`);
  return lines.join("\n");
}

export const EXTENSION_SDK_CONSTANTS = {
  MAX_SELECTION_BYTES,
  DEFAULT_TIMEOUT_MS,
  AGENT_SLUG_RE,
};
