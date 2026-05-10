/**
 * @sovereign-matrix/agent-sdk — HTTP CLIENT
 *
 * The companion to `createAgent()` for callers on the OTHER side of the
 * wire: run any Sovereign agent from your Node service, browser app, or
 * automation script with three lines of code.
 *
 *   import { SovereignClient } from "@/sdk/client";
 *
 *   const sov = new SovereignClient({ token: process.env.SOVEREIGN_API_KEY });
 *   const { output, receipt } = await sov.agents.run("blog-gen", {
 *     topic: "How HMAC signatures work",
 *   });
 *   console.log(receipt.url); // → https://sovereignmatrix.agency/r/<id>
 *
 * Every invocation returns the agent's structured output AND a `receipt`
 * with `{ id, signature, url }` — the verifiable audit trail. Show it
 * to your end users and they get compliance for free.
 *
 * The same client class powers internal dashboard widgets, so it stays
 * dogfooded — the public surface and the in-app surface are one file.
 */

export interface SovereignClientConfig {
  /** Base URL of the Sovereign deployment. Defaults to https://sovereignmatrix.agency. */
  baseUrl?: string;
  /** Bearer token: Clerk session JWT or server API key. */
  token?: string;
  /** Optional fetch override (for tests or custom transports). */
  fetch?: typeof globalThis.fetch;
  /** Default timeout per request, in ms. Defaults to 60_000. */
  timeoutMs?: number;
}

export interface AgentReceiptStub {
  id: string;
  signature: string;
  url: string;
}

export interface AgentMeta {
  agent: string;
  durationMs: number;
  timestamp: string;
  qualityScore?: number;
  qualityPassed?: boolean;
  piiWarning?: string;
}

export interface AgentRunResult<TOutput = Record<string, unknown>> {
  output: TOutput;
  receipt?: AgentReceiptStub;
  meta?: AgentMeta;
}

export interface AgentReceipt {
  id: string;
  agentName: string;
  modelUsed: string;
  input: unknown;
  output: unknown;
  safetyResult: {
    jailbreak?: "pass" | "fail";
    pii?: "pass" | "fail";
    content?: "pass" | "fail";
    quality?: number;
    critic?: "pass" | "fail";
  };
  durationMs: number;
  trustDecision: string;
  visibility: "private" | "public" | "unlisted";
  signature: string;
  canonical: string;
  createdAt: string | Date;
}

export interface VerifyResult {
  valid: boolean;
  id?: string;
  agentName?: string;
  createdAt?: string;
  algorithm: "HMAC-SHA256";
  canonicalVersion: number;
}

export class SovereignError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = "SovereignError";
    this.status = status;
    this.code = code;
  }
}

const DEFAULT_BASE_URL = "https://sovereignmatrix.agency";

export class SovereignClient {
  private readonly baseUrl: string;
  private readonly token: string | undefined;
  private readonly fetchFn: typeof globalThis.fetch;
  private readonly timeoutMs: number;

  readonly agents: AgentsResource;
  readonly receipts: ReceiptsResource;

  constructor(config: SovereignClientConfig = {}) {
    this.baseUrl = (config.baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
    this.token =
      config.token ??
      (typeof process !== "undefined"
        ? process.env?.SOVEREIGN_API_KEY
        : undefined);
    this.fetchFn = config.fetch ?? globalThis.fetch.bind(globalThis);
    this.timeoutMs = config.timeoutMs ?? 60_000;

    this.agents = new AgentsResource(this);
    this.receipts = new ReceiptsResource(this);
  }

  /** @internal */
  async request<T>(
    path: string,
    init: { method?: "GET" | "POST"; body?: unknown } = {},
  ): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = { Accept: "application/json" };
    if (init.body !== undefined) headers["Content-Type"] = "application/json";
    if (this.token) headers.Authorization = `Bearer ${this.token}`;

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), this.timeoutMs);
    try {
      const res = await this.fetchFn(url, {
        method: init.method ?? "GET",
        headers,
        body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
        signal: ctrl.signal,
      });
      const text = await res.text();
      let parsed: unknown;
      try {
        parsed = text ? JSON.parse(text) : {};
      } catch {
        parsed = { raw: text };
      }
      if (!res.ok) {
        const errBody = parsed as { error?: string; code?: string };
        throw new SovereignError(
          errBody.error ?? `HTTP ${res.status}`,
          res.status,
          errBody.code,
        );
      }
      return parsed as T;
    } finally {
      clearTimeout(timer);
    }
  }
}

class AgentsResource {
  constructor(private readonly client: SovereignClient) {}

  /**
   * Invoke an agent by slug. `input` is whatever the target agent's
   * Zod schema expects — see /marketplace/[agentId] for per-agent
   * input docs.
   */
  async run<TOut = Record<string, unknown>>(
    slug: string,
    input: Record<string, unknown> = {},
  ): Promise<AgentRunResult<TOut>> {
    const raw = await this.client.request<
      Record<string, unknown> & {
        _receipt?: AgentReceiptStub;
        _meta?: AgentMeta;
      }
    >(`/api/_agents/${encodeURIComponent(slug)}`, {
      method: "POST",
      body: input,
    });

    const { _receipt, _meta, ...output } = raw;
    return {
      output: output as unknown as TOut,
      receipt: _receipt,
      meta: _meta,
    };
  }
}

class ReceiptsResource {
  constructor(private readonly client: SovereignClient) {}

  /** Fetch a single receipt. Private receipts require auth. */
  async get(id: string): Promise<AgentReceipt> {
    return this.client.request<AgentReceipt>(
      `/api/agent-runs/${encodeURIComponent(id)}`,
    );
  }

  /** Flip visibility of a receipt the caller owns. */
  async publish(
    id: string,
    visibility: "private" | "public" | "unlisted",
  ): Promise<{ ok: boolean; visibility: string }> {
    return this.client.request<{ ok: boolean; visibility: string }>(
      `/api/agent-runs/${encodeURIComponent(id)}/publish`,
      { method: "POST", body: { visibility } },
    );
  }

  /**
   * Public signature verifier. No auth required. Lets a third party
   * confirm a receipt is authentic without needing access to the key.
   */
  async verify(args: {
    canonical: string;
    signature: string;
  }): Promise<VerifyResult> {
    return this.client.request<VerifyResult>("/api/verify", {
      method: "POST",
      body: args,
    });
  }
}

export default SovereignClient;
