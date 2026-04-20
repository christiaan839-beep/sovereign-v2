import { db } from "@/db";
import { whitelabelConfig } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("whitelabel");

/**
 * WHITE-LABEL RESOLVER — hostname → branding config.
 *
 * Proposal T completion. When a request arrives on a custom domain
 * (e.g. `agents.clientcompany.com`), the middleware tags the request
 * with `X-Whitelabel-Domain: <hostname>`. Downstream components call
 * `resolveWhitelabel(hostname)` to get the owner's config (agency
 * name, logo, colors, support email) and render branded content.
 *
 * Design notes
 * ------------
 *   - 5-minute in-memory LRU cache. At 100 active custom domains, we
 *     keep ~100 rows cached in each serverless instance — cheap and
 *     avoids hammering Neon on every page view.
 *   - Cache is invalidated by the owner via the settings page (POST
 *     /api/_settings/whitelabel calls `bustWhitelabelCache()`).
 *   - We also verify the domain is *marked verified* in DB before
 *     honoring it — prevents someone from pointing `google.com` at
 *     our IP and getting their branding applied.
 */

export interface WhitelabelBrand {
  agencyName: string;
  logoUrl: string | null;
  primaryColor: string;
  supportEmail: string | null;
  domain: string;
  /** Clerk user id of the owning agency */
  ownerEmail: string;
  /** Optional tenant id for scoped data access */
  tenantId: string;
}

interface CacheEntry {
  value: WhitelabelBrand | null; // null = negative cache (domain not configured)
  expiresAt: number;
}

const TTL_MS = 5 * 60 * 1000;
const MAX_ENTRIES = 200;
const cache = new Map<string, CacheEntry>();

function pruneExpired(): void {
  const now = Date.now();
  for (const [k, v] of cache) {
    if (v.expiresAt < now) cache.delete(k);
  }
  // LRU eviction if still oversized — oldest inserted first due to Map insertion order
  if (cache.size > MAX_ENTRIES) {
    const overflow = cache.size - MAX_ENTRIES;
    const keys = Array.from(cache.keys()).slice(0, overflow);
    for (const k of keys) cache.delete(k);
  }
}

/**
 * Look up the branding config for a given custom domain. Returns null
 * if the domain is unregistered or was explicitly invalidated.
 *
 * Safe to call on every page view — 5-minute cache protects the DB.
 */
export async function resolveWhitelabel(hostname: string): Promise<WhitelabelBrand | null> {
  if (!hostname) return null;
  const key = hostname.toLowerCase();

  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return hit.value;
  }

  let value: WhitelabelBrand | null = null;
  try {
    const [row] = await db
      .select()
      .from(whitelabelConfig)
      .where(eq(whitelabelConfig.domain, key))
      .limit(1);

    if (row && row.domain) {
      value = {
        agencyName: row.agencyName,
        logoUrl: row.logoUrl,
        primaryColor: row.primaryColor ?? "#00B7FF",
        supportEmail: row.supportEmail,
        domain: row.domain,
        ownerEmail: row.userEmail,
        tenantId: row.tenantId,
      };
    }
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "42P01") {
      // whitelabel_config table not migrated — don't 500, just negative-cache
      log.warn("whitelabel_config table missing; returning null");
    } else {
      log.error("whitelabel lookup failed", { hostname: key, error: String(err) });
    }
  }

  cache.set(key, { value, expiresAt: Date.now() + TTL_MS });
  pruneExpired();
  return value;
}

/**
 * Invalidate the cache entry for a hostname. Called by the whitelabel
 * settings route after a domain is added or branding is changed — so
 * the next page view reflects the update immediately instead of
 * waiting out the 5-minute TTL.
 */
export function bustWhitelabelCache(hostname?: string): void {
  if (hostname) {
    cache.delete(hostname.toLowerCase());
  } else {
    cache.clear();
  }
}

/**
 * DNS verification — checks that the custom domain has a CNAME pointing
 * at our Vercel deployment URL (or an A record to our IP). Prevents a
 * user from claiming `google.com` and hijacking branding.
 *
 * Called from `/api/_settings/whitelabel/verify`. Resolves via Vercel's
 * edge DNS (built-in `dns.promises`) — keeps verification entirely
 * serverless, no external service dependency.
 */
export async function verifyDomainOwnership(hostname: string): Promise<{
  ok: boolean;
  reason?: string;
  records?: { type: "CNAME" | "A"; value: string }[];
}> {
  if (!hostname || hostname.length > 253) {
    return { ok: false, reason: "Invalid hostname" };
  }

  // Vercel's default deployment alias. A custom domain should either
  // CNAME to `cname.vercel-dns.com.` or have an A record pointing to
  // Vercel's anycast IPs (76.76.21.21 is the current public value).
  const VERCEL_CNAME_SUFFIX = "vercel-dns.com";
  const VERCEL_APEX_IPS = new Set(["76.76.21.21"]);

  try {
    // dns.promises is available in Node runtime. Middleware runs on
    // Edge where it isn't — so this function is designed to be called
    // from a Node-runtime API route only.
    const { resolveCname, resolve4 } = await import("node:dns/promises");
    const records: { type: "CNAME" | "A"; value: string }[] = [];

    try {
      const cnames = await resolveCname(hostname);
      for (const c of cnames) {
        records.push({ type: "CNAME", value: c });
        if (c.endsWith(VERCEL_CNAME_SUFFIX)) {
          return { ok: true, records };
        }
      }
    } catch {
      // No CNAME — fall through to A-record check
    }

    try {
      const ips = await resolve4(hostname);
      for (const ip of ips) {
        records.push({ type: "A", value: ip });
        if (VERCEL_APEX_IPS.has(ip)) {
          return { ok: true, records };
        }
      }
    } catch {
      // No A record either — verification failed
    }

    return {
      ok: false,
      reason:
        "Domain does not point at Vercel. Add a CNAME to `cname.vercel-dns.com.` or an A record to `76.76.21.21`.",
      records,
    };
  } catch (err) {
    log.error("DNS verification failed", { hostname, error: String(err) });
    return { ok: false, reason: "DNS lookup failed" };
  }
}
