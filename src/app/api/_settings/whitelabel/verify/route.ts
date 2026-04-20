import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { whitelabelConfig } from "@/db/schema";
import { eq } from "drizzle-orm";
import { verifyDomainOwnership, bustWhitelabelCache } from "@/lib/whitelabel-resolver";
import { createLogger } from "@/lib/logger";

const log = createLogger("whitelabel-verify");

/**
 * POST /api/_settings/whitelabel/verify
 *
 * Checks that the caller's configured custom domain has DNS pointing
 * at Vercel (CNAME to cname.vercel-dns.com OR A to 76.76.21.21).
 *
 * This is the last missing piece of Proposal T — without domain
 * verification, anyone could claim any domain and hijack the resolver
 * cache. With it, we only serve branded content for domains whose DNS
 * actually points at us (and therefore whose owner must have set the
 * record intentionally).
 *
 * Flow:
 *   1. User enters their domain in /dashboard/settings/whitelabel
 *   2. They set up DNS at their registrar (CNAME or A record)
 *   3. They click "Verify" → this endpoint runs `dig` equivalent checks
 *   4. On success, we bust the resolver cache so the next page view
 *      uses the fresh branding
 */
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userEmail = user.primaryEmailAddress.emailAddress;

  let body: { domain?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const domain = body.domain?.trim().toLowerCase();
  if (!domain) {
    return NextResponse.json({ error: "Missing `domain`" }, { status: 400 });
  }

  // Sanity-check the domain shape. Reject obvious bogus inputs so we
  // don't waste a DNS lookup (and don't accept protocol-prefixed URLs).
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) {
    return NextResponse.json({ error: "Invalid domain format" }, { status: 400 });
  }

  // Make sure this domain actually belongs to the caller's config row
  // (or no one else has claimed it yet). Prevents the scenario where
  // User A verifies User B's domain because they both set the same one.
  try {
    const [row] = await db
      .select()
      .from(whitelabelConfig)
      .where(eq(whitelabelConfig.domain, domain))
      .limit(1);
    if (row && row.userEmail !== userEmail) {
      return NextResponse.json(
        { error: "Domain is already registered to another account." },
        { status: 409 },
      );
    }
  } catch {
    // Table missing or query failed — let verification proceed; save
    // will fail cleanly if DB isn't available.
  }

  const result = await verifyDomainOwnership(domain);
  if (!result.ok) {
    log.info("Domain verification failed", { userEmail, domain, reason: result.reason });
    return NextResponse.json(
      {
        ok: false,
        reason: result.reason,
        records: result.records ?? [],
        nextSteps: [
          "Add a CNAME record at your DNS provider: name=<subdomain>, value=cname.vercel-dns.com",
          "OR add an A record: name=@ or <subdomain>, value=76.76.21.21",
          "Wait 5-60 minutes for DNS to propagate, then retry.",
        ],
      },
      { status: 422 },
    );
  }

  // DNS verified. Upsert the verified domain into whitelabelConfig.
  try {
    const [existing] = await db
      .select()
      .from(whitelabelConfig)
      .where(eq(whitelabelConfig.userEmail, userEmail))
      .limit(1);

    if (existing) {
      await db
        .update(whitelabelConfig)
        .set({ domain, updatedAt: new Date() })
        .where(eq(whitelabelConfig.userEmail, userEmail));
    } else {
      await db.insert(whitelabelConfig).values({
        userEmail,
        agencyName: "SOVEREIGN",
        domain,
      });
    }
  } catch (err) {
    log.error("Failed to persist verified domain", { userEmail, domain, error: String(err) });
    return NextResponse.json({ error: "DB update failed" }, { status: 500 });
  }

  // Invalidate the resolver cache so the new domain resolves immediately.
  bustWhitelabelCache(domain);

  log.info("Domain verified", { userEmail, domain });
  return NextResponse.json({ ok: true, domain, records: result.records });
}
