/**
 * SOVEREIGN MATRIX — Built-in Tools (Cook 36)
 *
 * Three starter tools that exercise every tier of the approval matrix:
 *
 *   - fetch_url      (Tier 1) — read-only HTTPS GET with SSRF guard
 *   - write_memory   (Tier 2) — append to per-tenant memory store
 *   - purge_memory   (Tier 3) — admin-only memory deletion
 *
 * Each tool is built via a factory that takes the side-effecting
 * dependency as a parameter (fetchImpl / writer / purger) so
 * production wires the real DB/fetch and tests inject mocks.
 */

import { z } from "zod";
import type { ToolDefinition } from "@/lib/tool-registry";

// ── SSRF guard ────────────────────────────────────────────────────────────

const BLOCKED_HOST_PATTERNS: RegExp[] = [
  // RFC 5735 reserved
  /^127\./,
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  // Cloud metadata endpoints
  /^169\.254\.169\.254$/,
  // Link-local IPv4 catch-all (excludes 169.254.169.254 already)
  /^169\.254\./,
];

const BLOCKED_HOST_LITERALS = new Set([
  "localhost",
  "::1",
  "0:0:0:0:0:0:0:1",
  "0.0.0.0",
]);

const BLOCKED_TLD_SUFFIXES = [".local", ".internal", ".localhost"];

/**
 * Returns true iff the URL is safe to fetch from an agent. Blocks:
 *   - non-http(s) schemes (file:, ftp:, javascript:, gopher:, …)
 *   - RFC-1918 private space (10/8, 192.168/16, 172.16-31/12)
 *   - link-local (169.254/16) including AWS/GCP metadata
 *   - loopback (127/8, localhost, ::1)
 *   - IPv6 unique-local (fc00::/7) and link-local (fe80::/10)
 *   - mDNS-style TLDs (.local, .internal, .localhost)
 *   - URLs that fail the WHATWG parser
 */
export function isSafeUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return false;
  }
  // Strip IPv6 brackets so `[::1]` matches the literal set.
  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (BLOCKED_HOST_LITERALS.has(host)) return false;
  if (BLOCKED_TLD_SUFFIXES.some((s) => host.endsWith(s))) return false;
  if (BLOCKED_HOST_PATTERNS.some((re) => re.test(host))) return false;
  // IPv6 unique-local (fc00::/7) + link-local (fe80::/10)
  if (
    host.startsWith("fc") ||
    host.startsWith("fd") ||
    host.startsWith("fe80:")
  )
    return false;
  return true;
}

// ── Tool: fetch_url (Tier 1) ──────────────────────────────────────────────

type FetchImpl = (input: string, init?: RequestInit) => Promise<Response>;

interface FetchUrlOutput {
  status: number;
  contentType: string | null;
  body: string;
  bytesRead: number;
  truncated: boolean;
}

const FETCH_URL_INPUT = z.object({
  url: z.string().url().refine(isSafeUrl, {
    message:
      "URL is not safe to fetch (blocked by SSRF guard: non-https, private network, metadata host, or link-local)",
  }),
  maxBytes: z.number().int().min(1).max(2_000_000).optional(),
});

const DEFAULT_FETCH_TIMEOUT_MS = 8_000;
const DEFAULT_FETCH_MAX_BYTES = 200_000;

export function buildFetchUrlTool(
  fetchImpl: FetchImpl,
): ToolDefinition<z.infer<typeof FETCH_URL_INPUT>, FetchUrlOutput> {
  return {
    name: "fetch_url",
    description:
      "GET an HTTPS URL and return up to maxBytes of body (default 200 KB). 8s timeout, SSRF-guarded. Read-only.",
    inputSchema: FETCH_URL_INPUT,
    tier: 1,
    execute: async (input) => {
      const max = input.maxBytes ?? DEFAULT_FETCH_MAX_BYTES;
      const controller =
        typeof AbortController !== "undefined" ? new AbortController() : null;
      const timeout = controller
        ? setTimeout(() => controller.abort(), DEFAULT_FETCH_TIMEOUT_MS)
        : null;
      try {
        const res = await fetchImpl(input.url, {
          method: "GET",
          redirect: "follow",
          signal: controller?.signal,
        });
        const text = await res.text();
        const truncated = text.length > max;
        const body = truncated ? text.slice(0, max) + "…" : text;
        return {
          status: res.status,
          contentType: res.headers.get("content-type"),
          body,
          bytesRead: truncated ? max : text.length,
          truncated,
        };
      } finally {
        if (timeout) clearTimeout(timeout);
      }
    },
  };
}

// ── Tool: write_memory (Tier 2) ───────────────────────────────────────────

interface WriteMemoryOutput {
  written: true;
  tenantId: string;
  committedAt: string;
}

const WRITE_MEMORY_INPUT = z.object({
  key: z.string().min(1).max(120),
  value: z.string().min(1).max(2_000),
  category: z.string().min(1).max(60).optional(),
});

export type MemoryWriter = (opts: {
  key: string;
  value: string;
  category: string | undefined;
  tenantId: string;
  userId: string;
}) => Promise<void>;

export function buildWriteMemoryTool(
  writer: MemoryWriter,
): ToolDefinition<z.infer<typeof WRITE_MEMORY_INPUT>, WriteMemoryOutput> {
  return {
    name: "write_memory",
    description:
      "Append a key/value memory to the calling tenant's persistent store. Side-effecting; requires confirmation.",
    inputSchema: WRITE_MEMORY_INPUT,
    tier: 2,
    execute: async (input, ctx) => {
      if (!ctx.tenantId) {
        throw new Error(
          "write_memory called without a tenantId in context — multi-tenant safety violation",
        );
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
        tenantId: ctx.tenantId,
        committedAt: new Date().toISOString(),
      };
    },
  };
}

// ── Tool: purge_memory (Tier 3, admin-only) ───────────────────────────────

interface PurgeMemoryOutput {
  purged: true;
  rowsDeleted: number;
}

const PURGE_MEMORY_INPUT = z.object({
  tenantId: z.string().min(1),
  category: z.string().min(1).optional(),
  // Literal schema doubles as a typo guard — even an admin can't
  // accidentally fire-and-forget a purge.
  confirmPhrase: z.literal("I UNDERSTAND THIS WILL DELETE EVERYTHING"),
});

export type MemoryPurger = (filter: {
  tenantId: string;
  category?: string;
}) => Promise<{ rowsDeleted: number }>;

export function buildPurgeMemoryTool(
  purger: MemoryPurger,
): ToolDefinition<z.infer<typeof PURGE_MEMORY_INPUT>, PurgeMemoryOutput> {
  return {
    name: "purge_memory",
    description:
      "DELETE memories for a tenant (optionally filtered by category). Admin-only. Requires literal confirmPhrase.",
    inputSchema: PURGE_MEMORY_INPUT,
    tier: 3,
    execute: async (input) => {
      const result = await purger({
        tenantId: input.tenantId,
        category: input.category,
      });
      return { purged: true, rowsDeleted: result.rowsDeleted };
    },
  };
}
