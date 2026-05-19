/**
 * GET /api/honeypot/feed
 *
 * Public federation feed of currently-active attack-signature
 * bulletins. Open-CORS so any federation member (or independent
 * researcher) can consume it.
 *
 * Ethics constraints baked in:
 *   - Only TTL-active bulletins are returned (expired entries are
 *     filtered server-side; the feed never serves stale signatures).
 *   - Every bulletin is signed by its contributing issuer — recipients
 *     verify before consuming.
 *   - All fingerprints are non-PII by construction (TLS JA4, UA digest,
 *     path digest — see attack-fingerprint.ts).
 *   - Rate-limited 20/min per IP to prevent feed-driven scraping that
 *     could fingerprint the federation's defensive surface.
 *
 * Response shape is the stable contract for consumers:
 *   { generatedAt, totalActive, totalExpiredSuppressed,
 *     bulletins: FederationBulletin[] }
 */

import { NextResponse } from "next/server";
import { db } from "@/db";
import { auditLogs } from "@/db/schema";
import { and, eq, gt, desc } from "drizzle-orm";
import { rateLimit } from "@/lib/rate-limit";
import {
  activeBulletins,
  MAX_TTL_HOURS,
  type FederationBulletin,
} from "@/lib/federation-bulletin";
import { createLogger } from "@/lib/logger";

const log = createLogger("honeypot-feed");

export const revalidate = 60;

const limiter = rateLimit({ interval: 60, limit: 20 });

/** Hard cap on returned bulletins regardless of TTL — bounds response size. */
const MAX_BULLETINS_RETURNED = 100;

/**
 * Trusted-issuer allowlist — wave-99 security review H2. The feed
 * trusts ONLY rows whose `issuerId` appears in HONEYPOT_TRUSTED_ISSUERS
 * (comma-separated). This defends the federation namespace from a
 * compromised audit_logs row that would otherwise let an attacker
 * publish bulletins under any issuer banner. Empty/unset = empty
 * allowlist = no rows trusted = feed returns empty (safe default).
 */
function trustedIssuers(): Set<string> {
  const raw = process.env.HONEYPOT_TRUSTED_ISSUERS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );
}

export async function GET(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  // SQL-side TTL prefilter (wave-99 review M3): only fetch rows
  // newer than MAX_TTL_HOURS so the DB does the heavy lifting and we
  // don't parse + discard expired 30KB JSON payloads in Node.
  const earliestPossibleCreatedAt = new Date(
    Date.now() - MAX_TTL_HOURS * 3600 * 1000,
  );
  const allowed = trustedIssuers();

  let rows: Array<{ details: string | null; createdAt: Date | null }> = [];
  try {
    rows = await db
      .select({
        details: auditLogs.details,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.action, "honeypot.bulletin"),
          gt(auditLogs.createdAt, earliestPossibleCreatedAt),
        ),
      )
      .orderBy(desc(auditLogs.createdAt))
      .limit(MAX_BULLETINS_RETURNED * 3); // over-read to allow TTL filtering
  } catch (err) {
    log.warn("audit_logs read failed for honeypot feed", {
      error: String(err),
    });
    // Return an empty feed rather than 500 — federation consumers
    // expect a stable shape. Empty feed is correct on a fresh deploy
    // where no bulletins have been persisted yet.
    return NextResponse.json(
      {
        generatedAt: new Date().toISOString(),
        totalActive: 0,
        totalExpiredSuppressed: 0,
        bulletins: [],
      },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "public, max-age=60, s-maxage=60",
          "Content-Type": "application/json; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
        },
      },
    );
  }

  const allBulletins: FederationBulletin[] = [];
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.details ?? "{}") as Record<string, unknown>;
      // Defensive shape check — drop malformed rows silently.
      if (
        parsed.schema !== "vaos-honeypot-bulletin-v1" ||
        typeof parsed.issuerId !== "string" ||
        typeof parsed.expiresAt !== "string" ||
        !Array.isArray(parsed.fingerprints)
      ) {
        continue;
      }
      // Wave-99 review H2: enforce issuer allowlist. A row whose
      // issuerId isn't pre-trusted is dropped silently — namespace
      // forgery defence.
      if (!allowed.has(parsed.issuerId as string)) {
        continue;
      }
      // Wave-99 review M1: re-derive effective expiry server-side as
      // min(parsed.expiresAt, createdAt + MAX_TTL_HOURS). The row's
      // own expiresAt is "intent" — the DB-side createdAt + the
      // module-level cap is "enforcement". An attacker who rewrites
      // details.expiresAt to year 2099 still gets clamped to
      // createdAt + 7d.
      const createdAtMs = row.createdAt ? new Date(row.createdAt).getTime() : 0;
      const intentExpiryMs = new Date(parsed.expiresAt as string).getTime();
      const cappedExpiryMs = Math.min(
        intentExpiryMs,
        createdAtMs + MAX_TTL_HOURS * 3600 * 1000,
      );
      const enforced = {
        ...(parsed as unknown as FederationBulletin),
        expiresAt: new Date(cappedExpiryMs).toISOString(),
      };
      allBulletins.push(enforced);
    } catch {
      // Skip malformed rows
    }
  }

  const active = activeBulletins(allBulletins).slice(0, MAX_BULLETINS_RETURNED);
  const expiredCount = allBulletins.length - active.length;

  return NextResponse.json(
    {
      generatedAt: new Date().toISOString(),
      totalActive: active.length,
      totalExpiredSuppressed: expiredCount,
      bulletins: active,
      notes:
        "Every bulletin is TTL-bounded; expired entries are filtered. " +
        "Verify each bulletin's mldsa65Sig against the issuer's public key " +
        "from the federation registry before consuming. Fingerprints are " +
        "non-PII (JA4 + UA digest + path digest); no raw IPs or payloads " +
        "are ever published.",
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Cache-Control": "public, max-age=60, s-maxage=60",
        "Content-Type": "application/json; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
      },
    },
  );
}
