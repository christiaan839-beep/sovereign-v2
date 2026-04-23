/**
 * Creator-submission persistence — write to `marketplace_agents`.
 *
 * Why this module exists: the route in /api/creators/submit should stay
 * focused on HTTP concerns (parse, validate, decide, respond). The
 * "write this SAM submission into the marketplace table" logic is
 * tangential but stateful — pulled out so it can be unit-tested and
 * reused (e.g. by a future CLI pushing manifests).
 *
 * ## Graceful degradation
 *
 * Every function here is safe to call without a configured database:
 *
 *   - DATABASE_URL missing    → function returns a zero / no-op result
 *   - INSERT throws           → error logged, caller continues (202/201)
 *   - SELECT throws           → returns 0 (trust-tiered falls back to
 *                                queue behaviour, which is safe)
 *
 * This matters because (a) unit tests run without a DB, (b) local dev
 * often doesn't have Neon wired up, and (c) a transient Neon outage
 * should not block creator onboarding — the structured log line in
 * the route is the audit trail of last resort.
 *
 * ## Mapping: SAM categories → marketplace categories
 *
 * SAM v1.0 has 18 categories (Growth, Content, Dev, Finance, …); the
 * existing `marketplace_agents.category` is one of 8 (sales, content,
 * seo, code, automation, research, voice, data). The raw SAM category
 * is preserved in `manifest_raw.category` so no information is lost;
 * the mapped value drives marketplace-UI filtering.
 */

import { and, count, eq } from "drizzle-orm";
import { db } from "@/db";
import { marketplaceAgents } from "@/db/schema";
import { createLogger } from "@/lib/logger";
import { agentCorpusText, embedAndStoreAgent } from "@/lib/marketplace-search";

const log = createLogger("creator-submission-persistence");

/* ─── Types ───────────────────────────────────────────────────── */

export interface PersistableSubmission {
  referenceId: string;
  slug: string;
  displayName: string;
  purpose: string;
  samCategory: string;
  pricingCents: number;
  contactEmail: string | null;
  guarantees: string[];
  /** The full manifest JSON — stored as-is for audit. */
  manifestRaw: Record<string, unknown>;
  /** Which approval policy produced the decision (open | curated | trust-tiered). */
  policy: string;
  /** Human-readable explanation of the decision (for audit). */
  reason: string;
  /**
   * Whether this submission was auto-published. Maps to:
   *   true  → verification_status = "verified", is_public = true
   *   false → verification_status = "pending",  is_public = false
   */
  autoPublished: boolean;
}

/* ─── Category mapping ────────────────────────────────────────── */

const SAM_TO_MARKETPLACE_CATEGORY: Record<string, string> = {
  Growth: "sales",
  Content: "content",
  Dev: "code",
  Finance: "automation",
  HR: "automation",
  Legal: "automation",
  Ecommerce: "sales",
  Research: "research",
  Cybersec: "automation",
  "Real Estate": "sales",
  Gov: "automation",
  Productivity: "automation",
  Creative: "content",
  Data: "data",
  A2E: "automation",
  Meta: "automation",
  Integration: "automation",
  Safety: "automation",
};

export function mapSamCategoryToMarketplace(samCategory: string): string {
  return SAM_TO_MARKETPLACE_CATEGORY[samCategory] ?? "automation";
}

/* ─── System-prompt synthesis ─────────────────────────────────── */

/**
 * The marketplace_agents table requires `systemPrompt` (NOT NULL) but
 * SAM v1.0 manifests don't carry one — the handler code is wired up
 * later. Synthesise a placeholder prompt from the manifest's purpose +
 * guarantees so the row is valid and the agent's intent is still
 * documented. When a creator wires up the actual handler, this prompt
 * is replaced (or simply remains as human-readable documentation).
 */
export function synthesizeSystemPromptFromManifest(
  displayName: string,
  purpose: string,
  guarantees: string[],
): string {
  const guaranteeLines =
    guarantees.length > 0
      ? guarantees.map((g) => `- ${g}`).join("\n")
      : "- (none specified)";
  return `You are ${displayName}.

Purpose: ${purpose}

Guarantees:
${guaranteeLines}

Note: This row was created via /creators/apply (SAM v1.0). Handler
implementation is wired up separately after approval.`;
}

/* ─── Persistence (with no-DB fallback) ───────────────────────── */

function databaseIsConfigured(): boolean {
  // Same fast-path signal the Neon driver uses. Kept as a pure function
  // (no import-time side effects) so tests can mutate process.env and
  // re-read without ESM-module-cache headaches.
  return typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0;
}

/**
 * Insert a new row into marketplace_agents representing this submission.
 *
 * Resolves `true` if the row was written, `false` if persistence was
 * skipped (no DB) or failed (error logged). Callers should NOT treat
 * false as a user-visible error — the submission is still accepted;
 * the structured log in the route is the audit trail of last resort.
 */
export async function persistSubmission(
  sub: PersistableSubmission,
): Promise<boolean> {
  if (!databaseIsConfigured()) {
    return false;
  }

  const systemPrompt = synthesizeSystemPromptFromManifest(
    sub.displayName,
    sub.purpose,
    sub.guarantees,
  );

  const verificationStatus = sub.autoPublished ? "verified" : "pending";
  const isPublic = sub.autoPublished;
  const verifiedAt = sub.autoPublished ? new Date() : null;
  const marketplaceCategory = mapSamCategoryToMarketplace(sub.samCategory);

  try {
    const inserted = await db
      .insert(marketplaceAgents)
      .values({
        authorEmail: sub.contactEmail ?? "anonymous@sovereignmatrix.agency",
        authorName: "Anonymous Creator",
        creatorUserId: null,
        name: sub.displayName,
        description: sub.purpose,
        category: marketplaceCategory,
        systemPrompt,
        tags: JSON.stringify([sub.samCategory, "sam-v1"]),
        isPublic,
        pricePerRun: sub.pricingCents,
        verificationStatus,
        verifiedAt,
        slug: sub.slug,
        samVersion: "1.0",
        manifestRaw: sub.manifestRaw,
        referenceId: sub.referenceId,
        submissionPolicy: sub.policy,
        submissionReason: sub.reason,
        submissionSource: "sam-v1",
      })
      .returning({ id: marketplaceAgents.id });

    // Compute + store the search embedding ONLY when the agent is
    // actually live (auto-published). Queued submissions get an
    // embedding at admin-approve time. Fire-and-forget: embedding
    // failure doesn't block the 201 response.
    if (sub.autoPublished && inserted[0]?.id) {
      void embedAndStoreAgent({
        id: inserted[0].id,
        corpusText: agentCorpusText({
          name: sub.displayName,
          description: sub.purpose,
          category: marketplaceCategory,
          manifestRaw: sub.manifestRaw,
        }),
      });
    }
    return true;
  } catch (err) {
    log.error("Failed to persist SAM submission", {
      referenceId: sub.referenceId,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Count how many agents this creator has previously had approved.
 *
 * Used by the trust-tiered approval policy to decide queue vs
 * auto-publish. Returns 0 if:
 *   - email is null (anonymous submission)
 *   - DB isn't configured
 *   - query fails (safe default: treat as new creator, queue)
 *
 * An "approved" agent is one with verification_status in ('verified').
 * Rejected / suspended / pending rows don't count.
 */
export async function countPriorApprovals(
  contactEmail: string | null,
): Promise<number> {
  if (!contactEmail) return 0;
  if (!databaseIsConfigured()) return 0;

  try {
    const rows = await db
      .select({ n: count() })
      .from(marketplaceAgents)
      .where(
        and(
          eq(marketplaceAgents.authorEmail, contactEmail),
          eq(marketplaceAgents.verificationStatus, "verified"),
        ),
      );
    return rows[0]?.n ?? 0;
  } catch (err) {
    log.error("countPriorApprovals failed", {
      error: err instanceof Error ? err.message : String(err),
    });
    return 0;
  }
}
