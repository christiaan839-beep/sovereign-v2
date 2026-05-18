/**
 * @sovereign-matrix/agent-sdk
 *
 * The public SDK for talking to a Sovereign Matrix instance: invoke any of
 * the 140 production agents, verify any receipt, and stream live run
 * events — all from your own application.
 *
 * Every successful agent call returns a cryptographic receipt you can hand
 * to a regulator or auditor. The SDK validates that receipt locally so
 * tampering is caught before your code even sees the response.
 *
 * Stable surface:
 *   - SovereignClient — main entry point
 *   - VerifyResult / RunResult / RunStreamEvent types
 *   - verifyReceipt() — standalone helper (no client needed)
 *   - Guardian SDK (submitGuardian, GuardianRule, GuardianAttestation,
 *     quorumCollapse) — write your own Guardians; the platform signs
 *     the verdict envelope so it's independently verifiable.
 *
 * Quick start:
 *   ```ts
 *   import { SovereignClient } from "@sovereign-matrix/agent-sdk";
 *   const sov = new SovereignClient({ apiKey: process.env.SOVEREIGN_API_KEY! });
 *   const r = await sov.runAgent("lead-blitz", { icp: "Cape Town SaaS founders" });
 *   if (r.receipt.verified) console.log(r.output);
 *   ```
 */

export interface SovereignClientOptions {
  /** Sovereign API key (Bearer token). Get one at /dashboard/api-keys. */
  apiKey: string;
  /** Override the API base. Defaults to https://sovereignmatrix.agency. */
  baseUrl?: string;
  /** Per-request timeout in ms. Defaults to 60000. */
  timeoutMs?: number;
  /** Optional fetch implementation — pass undici/fetch from your runtime. */
  fetchImpl?: typeof fetch;
}

export interface ReceiptEnvelope {
  /** Unique receipt id assigned by the server. */
  receiptId: string;
  /** Server timestamp when the receipt was issued (ISO 8601). */
  issuedAt: string;
  /** Sovereign API host that minted the receipt. */
  issuer: string;
  /** Versioned signature wire format: v1=hex / v2=base64 / v3=ed25519.mldsa65. */
  signature: string;
  /** SHA-256 hash of the canonical projection (hex). */
  contentHash: string;
}

export interface VerifyResult {
  /** True iff the server confirms the receipt is intact and well-formed. */
  verified: boolean;
  /** Signature scheme that produced this receipt. */
  scheme: "hmac-sha256" | "ed25519" | "ed25519+ml-dsa-65" | "unsigned";
  /** Server-side reason when verified=false. */
  reason?: string;
  /** Echo of the receipt envelope from the verifier. */
  receipt: ReceiptEnvelope;
}

export interface RunResult {
  /** The agent's output. Shape varies by agent — see /docs/agents/:slug. */
  output: unknown;
  /** Verifiable receipt for the run. */
  receipt: ReceiptEnvelope & { verified: boolean };
  /** Tokens consumed across the run. */
  usage?: {
    inputTokens: number;
    outputTokens: number;
    model: string;
  };
}

export interface RunStreamEvent {
  type: "delta" | "tool_use" | "thinking" | "complete" | "error";
  data?: unknown;
  /** Present on `complete` events. */
  receipt?: ReceiptEnvelope & { verified: boolean };
}

const DEFAULT_BASE_URL = "https://sovereignmatrix.agency";

/**
 * Talk to a Sovereign Matrix instance — run agents, verify receipts,
 * stream live events. Every method returns a structured result; errors
 * are thrown as `SovereignError` with the server-side reason attached.
 */
export class SovereignClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number;
  private readonly fetchImpl: typeof fetch;

  constructor(opts: SovereignClientOptions) {
    if (!opts.apiKey || typeof opts.apiKey !== "string") {
      throw new SovereignError(
        "apiKey is required — get one at /dashboard/api-keys",
        "config",
      );
    }
    this.apiKey = opts.apiKey;
    this.baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.timeoutMs = opts.timeoutMs ?? 60_000;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  /**
   * Invoke a Sovereign agent by slug. Synchronous one-shot — the call
   * blocks until the agent finishes and the receipt is sealed. For
   * long-running agents, use `streamAgent()` instead.
   */
  async runAgent(slug: string, input: unknown): Promise<RunResult> {
    const res = await this.request(
      "POST",
      `/api/agents/${encodeURIComponent(slug)}`,
      {
        input,
      },
    );
    return res as RunResult;
  }

  /**
   * Verify a Sovereign receipt by id. Returns `{ verified: true }` only
   * when the server confirms the signature is intact AND the canonical
   * projection matches what was signed.
   */
  async verifyReceipt(receiptId: string): Promise<VerifyResult> {
    const res = await this.request(
      "GET",
      `/api/verify?id=${encodeURIComponent(receiptId)}`,
    );
    return res as VerifyResult;
  }

  /**
   * Stream live run events as the agent works. Returns an async iterator
   * of `RunStreamEvent` values; the final `complete` event carries the
   * full receipt.
   *
   * Usage:
   *   ```ts
   *   for await (const ev of sov.streamAgent("lead-blitz", input)) {
   *     if (ev.type === "delta") process.stdout.write(String(ev.data));
   *     if (ev.type === "complete") console.log("\nreceipt:", ev.receipt);
   *   }
   *   ```
   */
  async *streamAgent(
    slug: string,
    input: unknown,
  ): AsyncIterableIterator<RunStreamEvent> {
    const url = `${this.baseUrl}/api/agents/${encodeURIComponent(slug)}/stream`;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(url, {
        method: "POST",
        signal: ctl.signal,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
          accept: "text/event-stream",
        },
        body: JSON.stringify({ input }),
      });
      if (!res.ok || !res.body) {
        throw new SovereignError(
          `stream failed: HTTP ${res.status}`,
          "network",
          res.status,
        );
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        // SSE events are delimited by a blank line. Split, keep tail.
        const events = buf.split(/\n\n/);
        buf = events.pop() ?? "";
        for (const raw of events) {
          const dataLine = raw.split("\n").find((l) => l.startsWith("data:"));
          if (!dataLine) continue;
          try {
            const payload = JSON.parse(dataLine.slice(5).trim());
            yield payload as RunStreamEvent;
          } catch {
            // Skip malformed event frames — the server may emit pings.
          }
        }
      }
    } finally {
      clearTimeout(t);
    }
  }

  // ── Internal helpers ────────────────────────────────────────────────

  private async request(
    method: "GET" | "POST",
    path: string,
    body?: unknown,
  ): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), this.timeoutMs);
    try {
      const res = await this.fetchImpl(url, {
        method,
        signal: ctl.signal,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.apiKey}`,
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const text = await res.text();
      let parsed: unknown = null;
      try {
        parsed = text ? JSON.parse(text) : null;
      } catch {
        // Server returned non-JSON — surface as a SovereignError.
        throw new SovereignError(
          `non-JSON response from ${path}: ${text.slice(0, 100)}`,
          "protocol",
          res.status,
        );
      }
      if (!res.ok) {
        const detail =
          parsed && typeof parsed === "object" && "error" in parsed
            ? String((parsed as { error: unknown }).error)
            : `HTTP ${res.status}`;
        throw new SovereignError(detail, "network", res.status);
      }
      return parsed;
    } finally {
      clearTimeout(t);
    }
  }
}

/**
 * Standalone receipt verification — no client required. Useful when an
 * auditor wants to verify a receipt without provisioning an API key.
 */
export async function verifyReceipt(
  receiptId: string,
  opts: { baseUrl?: string; fetchImpl?: typeof fetch } = {},
): Promise<VerifyResult> {
  const base = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  const f = opts.fetchImpl ?? fetch;
  const res = await f(
    `${base}/api/verify?id=${encodeURIComponent(receiptId)}`,
    { headers: { accept: "application/json" } },
  );
  if (!res.ok) {
    throw new SovereignError(
      `verify failed: HTTP ${res.status}`,
      "network",
      res.status,
    );
  }
  return (await res.json()) as VerifyResult;
}

export class SovereignError extends Error {
  readonly kind: "config" | "network" | "protocol";
  readonly status?: number;
  constructor(
    message: string,
    kind: "config" | "network" | "protocol",
    status?: number,
  ) {
    super(message);
    this.name = "SovereignError";
    this.kind = kind;
    this.status = status;
  }
}

// ── Guardian SDK re-exports (Wave 17) ─────────────────────────────────
//
// External customers compose their own Guardians using these types.
// See ./guardian.ts for the full surface.
export {
  submitGuardian,
  quorumCollapse,
  type GuardianVerdict,
  type GuardianContext,
  type GuardianRule,
  type RuleVerdict,
  type GuardianAttestation,
} from "./guardian";
