/**
 * Built-in tool set for the Cook 36 tool registry.
 *
 * Three starter tools that exercise every tier of the approval matrix:
 *
 *   Tier 1 (autonomous): `fetch_url` — read-only HTTP GET with SSRF
 *     guards and size caps. Safe to dispatch inline.
 *
 *   Tier 2 (confirm): `write_memory` — append a fact to the calling
 *     tenant's `tenantMemories` table. Side-effecting; needs an
 *     approvalToken from the UI before it runs.
 *
 *   Tier 3 (restricted): `purge_memory` — delete all of a tenant's
 *     memories. Reserved for admin allowlist; even the owner can't
 *     run this without explicit elevation.
 *
 * The tools are intentionally lean — they exist to validate the
 * registry's contract under realistic side effects. Production tools
 * (sendEmail, postSlack, callMCP, etc.) bolt on as further
 * registrations using this same pattern.
 */

import { z } from "zod";
import { type ToolDefinition } from "../tool-registry";

// ────────────────────────────────────────────────────────────────
// fetch_url — Tier 1, read-only HTTP GET
// ────────────────────────────────────────────────────────────────

/**
 * Reject URLs that would enable SSRF. Pure function — exported for
 * unit testing.
 */
export function isSafeUrl(raw: string): boolean {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;
  // Strip bracketed IPv6 if the parser preserved them.
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  // Block private + link-local + loopback + metadata endpoints.
  const bad =
    host === "localhost" ||
    host === "0.0.0.0" ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "169.254.169.254" || // AWS / GCP metadata
    /^127\./.test(host) ||
    /^10\./.test(host) ||
    /^192\.168\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) ||
    /^fe80::/.test(host) ||
    /^fc00:/.test(host) ||
    host === "::1" ||
    host === "0:0:0:0:0:0:0:1";
  return !bad;
}

const FETCH_URL_INPUT = z.object({
  url: z.string().url().max(2048).refine(isSafeUrl, {
    message: "URL targets a private / loopback / metadata host (SSRF guard)",
  }),
  /** Optional cap on response bytes. Default 64 KiB. */
  maxBytes: z.number().int().min(1).max(1_000_000).optional(),
});

export interface FetchUrlOutput {
  status: number;
  contentType: string;
  /** Truncated to maxBytes; trailing ellipsis if cut. */
  body: string;
  bytesRead: number;
  truncated: boolean;
}

/**
 * Build the fetch_url tool definition. Factory takes an optional
 * `fetchImpl` so tests can inject a mock fetch — the production
 * caller passes `globalThis.fetch`.
 */
export function buildFetchUrlTool(
  fetchImpl: typeof globalThis.fetch = globalThis.fetch,
): ToolDefinition<z.infer<typeof FETCH_URL_INPUT>, FetchUrlOutput> {
  return {
    name: "fetch_url",
    description:
      "GET a public URL (http/https only) and return its body up to maxBytes. Read-only. Blocks private / loopback / metadata hosts as SSRF protection.",
    inputSchema: FETCH_URL_INPUT,
    tier: 1,
    async execute(input) {
      const maxBytes = input.maxBytes ?? 64 * 1024;
      // 8s timeout — long enough for slow sites, short enough that a
      // hanging server doesn't lock an agent run.
      const ctl = new AbortController();
      const timeout = setTimeout(() => ctl.abort(), 8_000);
      try {
        const res = await fetchImpl(input.url, {
          method: "GET",
          redirect: "follow",
          signal: ctl.signal,
          headers: {
            "User-Agent": "SovereignMatrix-Tool/1.0",
            Accept: "text/html, application/json, text/plain, */*;q=0.5",
          },
        });
        const raw = await res.arrayBuffer();
        const truncated = raw.byteLength > maxBytes;
        const slice = truncated ? raw.slice(0, maxBytes) : raw;
        const decoder = new TextDecoder("utf-8", { fatal: false });
        return {
          status: res.status,
          contentType: res.headers.get("content-type") ?? "",
          body: decoder.decode(slice) + (truncated ? "…" : ""),
          bytesRead: slice.byteLength,
          truncated,
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}

// ────────────────────────────────────────────────────────────────
// write_memory — Tier 2, side-effecting
// ────────────────────────────────────────────────────────────────

const WRITE_MEMORY_INPUT = z.object({
  /** Short label for the memory (e.g. "preferred-tone", "company-icp"). */
  key: z.string().min(1).max(120),
  /** Free-form payload. Persisted as-is. */
  value: z.string().min(1).max(20_000),
  /** Optional category to scope retrieval. */
  category: z.string().max(120).optional(),
});

export interface WriteMemoryOutput {
  written: true;
  key: string;
  tenantId: string;
  /** When the memory was committed. */
  committedAt: string;
}

/**
 * Build the write_memory tool. Factory accepts a `writer` callback so
 * production can inject the live Drizzle writer (tenantMemories
 * table) while tests inject a memo-mock. Keeping the IO injected
 * makes the tool unit-testable without a live DB.
 */
export function buildWriteMemoryTool(
  writer: (input: {
    key: string;
    value: string;
    category?: string;
    tenantId: string;
    userId: string;
  }) => Promise<void>,
): ToolDefinition<z.infer<typeof WRITE_MEMORY_INPUT>, WriteMemoryOutput> {
  return {
    name: "write_memory",
    description:
      "Append a key/value memory to the calling tenant's persistent store. Future agent runs can retrieve these via read_memory.",
    inputSchema: WRITE_MEMORY_INPUT,
    tier: 2,
    async execute(input, ctx) {
      if (!ctx.tenantId) {
        throw new Error("write_memory requires a tenantId in the context");
      }
      await writer({
        key: input.key,
        value: input.value,
        category: input.category,
        tenantId: ctx.tenantId,
        userId: ctx.userId,
      });
      return {
        written: true,
        key: input.key,
        tenantId: ctx.tenantId,
        committedAt: new Date().toISOString(),
      };
    },
  };
}

// ────────────────────────────────────────────────────────────────
// purge_memory — Tier 3, admin-only
// ────────────────────────────────────────────────────────────────

const PURGE_MEMORY_INPUT = z.object({
  /** Tenant whose memories to purge. */
  tenantId: z.string().min(1).max(120),
  /** Optional category filter. When omitted, ALL memories purged. */
  category: z.string().max(120).optional(),
  /**
   * Confirmation string the caller must echo verbatim. Stops
   * accidental purges when a model "helpfully" calls this tool.
   */
  confirmPhrase: z.literal("I UNDERSTAND THIS WILL DELETE EVERYTHING"),
});

export interface PurgeMemoryOutput {
  purged: true;
  tenantId: string;
  rowsDeleted: number;
}

/**
 * Build the purge_memory tool. Tier-3, admin-allowlisted at the
 * registry level. The `confirmPhrase` literal IS a second belt — a
 * misbehaving model can't synthesize the exact string by accident.
 */
export function buildPurgeMemoryTool(
  purger: (input: {
    tenantId: string;
    category?: string;
  }) => Promise<{ rowsDeleted: number }>,
): ToolDefinition<z.infer<typeof PURGE_MEMORY_INPUT>, PurgeMemoryOutput> {
  return {
    name: "purge_memory",
    description:
      "ADMIN-ONLY. Delete a tenant's persistent memories (optionally filtered by category). Irreversible. Requires confirmPhrase exactly: 'I UNDERSTAND THIS WILL DELETE EVERYTHING'.",
    inputSchema: PURGE_MEMORY_INPUT,
    tier: 3,
    async execute(input) {
      const { rowsDeleted } = await purger({
        tenantId: input.tenantId,
        category: input.category,
      });
      return {
        purged: true,
        tenantId: input.tenantId,
        rowsDeleted,
      };
    },
  };
}
