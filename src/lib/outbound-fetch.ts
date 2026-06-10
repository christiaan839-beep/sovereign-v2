/**
 * SOVEREIGN MATRIX — Generic outbound-fetch wrapper for agent code paths.
 *
 * Problem this solves:
 *   Agent routes today can call bare `fetch(url)` against any host. An
 *   adversarial prompt that gets injected through a scraped page can
 *   pivot the agent into a confused-deputy — calling internal services,
 *   metadata endpoints, or attacker-controlled exfil hosts. The code-
 *   sandbox path already has `src/lib/sandbox-egress.ts`; this module
 *   extends the same policy types to the general agent-route surface.
 *
 * Policy hierarchy (most → least restrictive):
 *   1. `AGENT_EGRESS_MODE` env: "off" | "allowlist" | "open"
 *      Defaults: "allowlist" in production, "open" elsewhere.
 *   2. Per-call allowlist passed by the caller — additive on top of
 *      `AGENT_EGRESS_ALLOWLIST` (comma-separated hostnames).
 *   3. Built-in SSRF guard (`isSafeUrl` from tools/built-in.ts) is
 *      ALWAYS enforced regardless of mode. "open" mode means "any
 *      public host"; it does not mean "metadata endpoints OK".
 *
 * Every block emits a defense receipt via `defense-receipts.ts`.
 *
 * Usage:
 *   import { outboundFetch } from "@/lib/outbound-fetch";
 *   const res = await outboundFetch(url, { method: "GET" }, {
 *     ruleId: "agent.research-fetch",
 *     userId,
 *     allowedHosts: ["en.wikipedia.org"],
 *   });
 */

import { isSafeUrl } from "@/lib/tools/built-in";
import { safeResolveOrNull } from "@/lib/safe-host";
import {
  buildPolicy,
  testUrl,
  meterRequest,
  type EgressPolicy,
  type EgressViolation,
  type EgressMode,
  type SessionMeter,
} from "@/lib/sandbox-egress";
import { emitDefenseReceipt, commit } from "@/lib/defense-receipts";
import { emitCapabilityReceipt } from "@/lib/capability-receipts";
import { createLogger } from "@/lib/logger";

const log = createLogger("outbound-fetch");

/**
 * User-Agent for outbound page fetches (BACKLOG L3). Env-overridable so
 * operators can brand their crawler / satisfy robots policies without a
 * code change. Single source of truth for every scraping tool.
 */
export function scraperUserAgent(): string {
  return (
    process.env.SOVEREIGN_SCRAPER_UA?.trim() ||
    "Mozilla/5.0 (compatible; SovereignBot/1.0)"
  );
}

export class EgressBlockedError extends Error {
  readonly violation: EgressViolation;
  readonly url: string;
  constructor(url: string, violation: EgressViolation) {
    super(`Outbound fetch blocked: ${violation.message}`);
    this.name = "EgressBlockedError";
    this.url = url;
    this.violation = violation;
  }
}

export interface OutboundFetchOptions {
  /** Identifier for the defense receipt's ruleId (e.g. "agent.research-fetch"). */
  ruleId: string;
  /** Additional allowed hostnames for this call only — additive to env list. */
  allowedHosts?: string[];
  /** Override the policy mode for this call. Use sparingly; intended for tests + admin paths. */
  modeOverride?: EgressMode;
  /** Tenant scope for audit. */
  tenantId?: string;
  /** User scope for audit. */
  userId?: string;
  /** Optional in-process session meter; mutated on success. */
  session?: SessionMeter;
  /** Hard byte cap for response (read up to this many bytes). */
  maxResponseBytes?: number;
  /** Request timeout in ms. Default 15_000. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;
const DEFAULT_MAX_RESPONSE_BYTES = 5 * 1024 * 1024; // 5 MB

/**
 * Resolve the active egress policy from env + per-call options.
 * Pulled out so tests can call it directly.
 */
export function resolvePolicy(opts: OutboundFetchOptions): EgressPolicy {
  const envMode = (process.env.AGENT_EGRESS_MODE ?? "").toLowerCase();
  let mode: EgressMode;
  if (opts.modeOverride) {
    mode = opts.modeOverride;
  } else if (
    envMode === "off" ||
    envMode === "allowlist" ||
    envMode === "open"
  ) {
    mode = envMode;
  } else {
    // Defaults: production defaults to allowlist (deny-by-default for the
    // hosts you didn't whitelist), everything else defaults to open so
    // local dev and test runs aren't crippled.
    mode = process.env.NODE_ENV === "production" ? "allowlist" : "open";
  }

  const envHosts = (process.env.AGENT_EGRESS_ALLOWLIST ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  const hosts = [...envHosts, ...(opts.allowedHosts ?? [])];

  return buildPolicy({ mode, hosts });
}

/**
 * Read a response body with a hard byte cap. We do NOT call
 * `response.text()` directly because that has no cap and can blow
 * memory on a malicious or runaway host.
 */
async function readBodyCapped(
  res: Response,
  capBytes: number,
): Promise<{ bytes: Uint8Array; truncated: boolean }> {
  if (!res.body) return { bytes: new Uint8Array(0), truncated: false };
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    if (total + value.byteLength > capBytes) {
      // Take only what fits, then drain + bail.
      const remaining = Math.max(0, capBytes - total);
      if (remaining > 0) {
        chunks.push(value.subarray(0, remaining));
        total += remaining;
      }
      truncated = true;
      try {
        await reader.cancel();
      } catch {
        /* ignore */
      }
      break;
    }
    chunks.push(value);
    total += value.byteLength;
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const c of chunks) {
    out.set(c, offset);
    offset += c.byteLength;
  }
  return { bytes: out, truncated };
}

export interface OutboundFetchResult {
  status: number;
  ok: boolean;
  url: string;
  contentType: string | null;
  body: string;
  bytes: Uint8Array;
  truncated: boolean;
}

/**
 * Policy-checked fetch. Throws `EgressBlockedError` on policy denial;
 * the platform's existing rate-limiter + SSRF guard run automatically.
 * Returns a structured result with content type, status, and
 * cap-truncated body for the caller to consume.
 *
 * Network and parse errors are NOT translated — callers handle them
 * the same way they'd handle a regular `fetch()` failure.
 */
export async function outboundFetch(
  url: string,
  init: RequestInit,
  opts: OutboundFetchOptions,
): Promise<OutboundFetchResult> {
  const policy = resolvePolicy(opts);
  const violation = testUrl(url, policy);

  if (violation) {
    // Belt-and-braces — even in `open` mode, the SSRF guard must agree.
    // testUrl already calls isSafeUrl, but we keep the call here to
    // make the redundant defense visible at the call site.
    log.warn("outbound fetch denied", {
      ruleId: opts.ruleId,
      url,
      reason: violation.reason,
    });
    await emitDefenseReceipt({
      ruleId: opts.ruleId,
      category: violation.reason === "ssrf-blocked" ? "ssrf" : "egress-blocked",
      severity: violation.reason === "ssrf-blocked" ? 90 : 60,
      reason: violation.message,
      signal: url,
      commitments: { url: commit(url) },
      tenantId: opts.tenantId,
      userId: opts.userId,
    });
    throw new EgressBlockedError(url, violation);
  }

  // Double-check after policy passes — defense in depth.
  if (!isSafeUrl(url)) {
    const v: EgressViolation = {
      reason: "ssrf-blocked",
      message: `URL blocked by SSRF guard: ${url}`,
    };
    await emitDefenseReceipt({
      ruleId: opts.ruleId,
      category: "ssrf",
      severity: 95,
      reason: v.message,
      signal: url,
      commitments: { url: commit(url) },
      tenantId: opts.tenantId,
      userId: opts.userId,
    });
    throw new EgressBlockedError(url, v);
  }

  // Wave-107.2: DNS-resolved private-IP check.
  //
  // `isSafeUrl` above is a STRING-prefix regex against the URL's
  // hostname. It catches `https://10.0.0.1` but does NOT resolve
  // DNS — so `https://evil.example.com` whose A record points at
  // `10.0.0.5` (or `169.254.169.254` for cloud metadata) slips
  // past. This is the classic DNS-rebinding shape.
  //
  // `safeResolveOrNull` (promoted from federation-puller in this
  // wave) does a real DNS lookup and rejects the call when ANY
  // returned address is RFC1918 / loopback / link-local / unique-
  // local. Closes the gap uniformly across all `outboundFetch`
  // callers — every existing route that uses this helper now
  // inherits the defense without changing the call site.
  //
  // TOCTOU note: a small window remains between `dns.lookup` here
  // and the actual `fetch` connect downstream. At millisecond
  // scale an attacker would need to swing their DNS record between
  // the lookup and the syscall. Practical mitigation is sticky-IP
  // fetch (resolve once, connect to the address explicitly);
  // that's a future hardening. For now: same envelope federation-
  // puller's audited wave-102 pattern carries.
  try {
    const parsed = new URL(url);
    // Skip the DNS check for IP-literal URLs — isSafeUrl above
    // already rejected the private ones; remaining public IPs
    // need no lookup. This also avoids a needless OS resolver
    // call for the IP literal.
    const isIpLiteral =
      /^\d{1,3}(\.\d{1,3}){3}$/.test(parsed.hostname) ||
      parsed.hostname.startsWith("[");
    if (!isIpLiteral) {
      const resolved = await safeResolveOrNull(parsed.hostname);
      if (resolved === null) {
        const v: EgressViolation = {
          reason: "ssrf-blocked",
          message: `URL blocked: ${parsed.hostname} resolves to a private/loopback/link-local address (or DNS failed)`,
        };
        await emitDefenseReceipt({
          ruleId: opts.ruleId,
          category: "ssrf",
          severity: 95,
          reason: v.message,
          signal: url,
          commitments: { url: commit(url) },
          tenantId: opts.tenantId,
          userId: opts.userId,
        });
        throw new EgressBlockedError(url, v);
      }
    }
  } catch (err) {
    // `new URL(url)` threw or our own EgressBlockedError above —
    // re-throw EgressBlockedError so callers see the typed error;
    // an unparseable URL is rejected.
    if (err instanceof EgressBlockedError) throw err;
    const v: EgressViolation = {
      reason: "ssrf-blocked",
      message: `URL parse failed: ${url}`,
    };
    await emitDefenseReceipt({
      ruleId: opts.ruleId,
      category: "ssrf",
      severity: 90,
      reason: v.message,
      signal: url,
      commitments: { url: commit(url) },
      tenantId: opts.tenantId,
      userId: opts.userId,
    });
    throw new EgressBlockedError(url, v);
  }

  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const startedAt = Date.now();
  let res: Response;
  try {
    res = await fetch(url, {
      ...init,
      signal: controller.signal,
      // Prevent following redirects to private hosts — manual mode lets
      // us re-check Location against the policy if we want to support
      // redirects later. For now, a 3xx response just returns to the
      // caller; they can decide whether to chase it.
      redirect: init.redirect ?? "manual",
    });
  } finally {
    clearTimeout(timer);
  }

  const capBytes = opts.maxResponseBytes ?? DEFAULT_MAX_RESPONSE_BYTES;
  const { bytes, truncated } = await readBodyCapped(res, capBytes);

  // Update the session meter if the caller provided one. We feed it
  // the actual bytes read so the cap reflects real traffic, not
  // hypothetical Content-Length.
  if (opts.session) {
    const v = meterRequest(opts.session, policy, bytes.byteLength);
    if (v) {
      await emitDefenseReceipt({
        ruleId: opts.ruleId,
        category: "budget",
        severity: 50,
        reason: v.message,
        signal: url,
        commitments: { url: commit(url) },
        tenantId: opts.tenantId,
        userId: opts.userId,
      });
      throw new EgressBlockedError(url, v);
    }
  }

  // Capability receipt: every PERMITTED egress also leaves a signed
  // audit trail. Combined with defense-receipts.ts (which records every
  // block), the audit log now captures every gate decision the egress
  // policy makes — provably bounded agent activity.
  void emitCapabilityReceipt({
    ruleId: opts.ruleId,
    kind: "fetch",
    outcome: truncated ? "allowed-truncated" : "allowed",
    summary: `${init.method ?? "GET"} ${new URL(url).host} → ${res.status} (${bytes.byteLength}B)`,
    sensitive: { url },
    durationMs: Date.now() - startedAt,
    responseBytes: bytes.byteLength,
    policyMode: policy.mode,
    tenantId: opts.tenantId,
    userId: opts.userId,
  });

  return {
    status: res.status,
    ok: res.ok,
    url,
    contentType: res.headers.get("content-type"),
    body: new TextDecoder("utf-8", { fatal: false }).decode(bytes),
    bytes,
    truncated,
  };
}
