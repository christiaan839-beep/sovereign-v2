import { db } from "@/db";
import { subscriptions } from "@/db/schema";
import { eq, isNull, and } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("acquisition");

/**
 * ACQUISITION ATTRIBUTION — captures UTM + referrer context at signup.
 *
 * Called once per user, on their first post-auth page load. Writes
 * source / medium / campaign / referrer into subscriptions table if
 * they're currently NULL. Immutable after first write so a user
 * can't rewrite their attribution by re-visiting with a different
 * UTM string.
 *
 * Channel heuristics (when explicit UTMs aren't present):
 *   - news.ycombinator.com → "hackernews"
 *   - linkedin.com → "linkedin"
 *   - reddit.com → "reddit"
 *   - product hunt domains → "producthunt"
 *   - twitter/x.com → "twitter"
 *   - google.com → "google"
 *   - bing.com → "bing"
 *   - empty/no referrer → "direct"
 *   - otherwise → "referral:<hostname>"
 *
 * Strategic purpose: during launch week we'll be driving traffic from
 * multiple channels simultaneously. Without this, "40 signups Tuesday"
 * tells us nothing about whether HN or LinkedIn or the founder's
 * cold outreach was the channel worth doubling down on.
 */

export interface AttributionInput {
  userId: string;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  referrer?: string | null;
}

function normalizeReferrerToSource(referrer: string | null | undefined): string {
  if (!referrer) return "direct";
  try {
    const url = new URL(referrer);
    const host = url.hostname.replace(/^www\./, "");

    if (/\bnews\.ycombinator\.com\b/.test(host)) return "hackernews";
    if (/\blinkedin\.com\b/.test(host)) return "linkedin";
    if (/\breddit\.com\b/.test(host)) return "reddit";
    if (/\bproducthunt\.com\b/.test(host) || /\bph\.co\b/.test(host)) return "producthunt";
    if (/\btwitter\.com\b/.test(host) || /\bx\.com\b/.test(host)) return "twitter";
    if (/\bgoogle\.[a-z.]+\b/.test(host)) return "google";
    if (/\bbing\.com\b/.test(host) || /\bduckduckgo\.com\b/.test(host)) return "search";
    if (/\bgithub\.com\b/.test(host)) return "github";
    if (/\banthropic\.com\b/.test(host)) return "anthropic";

    return `referral:${host}`;
  } catch {
    return "direct";
  }
}

/**
 * Record acquisition attribution for a user, only if not already set.
 * Safe to call multiple times — subsequent calls are no-ops.
 */
export async function recordAcquisition(input: AttributionInput): Promise<void> {
  const source =
    input.utmSource ??
    normalizeReferrerToSource(input.referrer ?? null);

  const medium =
    input.utmMedium ??
    (source === "direct"
      ? "direct"
      : source === "google" || source === "search"
      ? "organic"
      : "referral");

  try {
    // Only write if currently NULL — prevents re-attribution attacks
    // (user revisits from a different UTM and their first-touch gets lost).
    await db
      .update(subscriptions)
      .set({
        acquisitionSource: source,
        acquisitionMedium: medium,
        acquisitionCampaign: input.utmCampaign ?? null,
        acquisitionReferrer: input.referrer?.slice(0, 500) ?? null,
        acquiredAt: new Date(),
      })
      .where(
        and(
          eq(subscriptions.userId, input.userId),
          isNull(subscriptions.acquisitionSource),
        ),
      );

    log.info("acquisition recorded", {
      userId: input.userId,
      source,
      medium,
      campaign: input.utmCampaign ?? null,
    });
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "42703") {
      // Pre-migration schema — no-op gracefully
      log.warn("acquisition columns missing; skipping", { userId: input.userId });
      return;
    }
    log.error("acquisition write failed", { error: String(err) });
  }
}
