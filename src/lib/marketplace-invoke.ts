/**
 * Marketplace invoke — run a SAM-sourced agent + credit the creator.
 *
 * This closes the last gap in the creator flywheel:
 *
 *   list  →  discover (semantic search)  →  INVOKE  →  earnings  →  list more
 *   ✓     →  ✓                           →  (here)  →  ✓         →  ✓
 *
 * The function accepts an agent slug OR a UUID, verifies it's live,
 * synthesises the system prompt from its SAM manifest, routes the
 * call through the smart AI router (NIM-first, free on most calls),
 * and on success credits the creator's earnings at the published
 * pricing.
 *
 * Pricing + billing (v1):
 *   - Pricing is whatever the manifest declared (pricingCents).
 *   - The earnings ledger records gross / 70% creator / 30% platform.
 *   - Actual buyer charging is deferred — we're not billing end users
 *     yet (Stripe Connect onboarding is still pending). Earnings
 *     accumulate in "pending" status; a future payout batch cron
 *     moves them to "paid" once Connect is wired.
 *
 * Graceful modes:
 *   no DB        → returns { ok:false, code:"no_db" }
 *   slug not found → { ok:false, code:"not_found" }
 *   not live     → { ok:false, code:"not_live" }
 *   ai() threw   → { ok:false, code:"upstream_failed" }
 *
 * Every failure mode returns a structured shape; the API layer maps
 * codes to HTTP statuses. Never throws to its caller.
 */

import { eq, or, sql } from "drizzle-orm";
import { db } from "@/db";
import { creatorEarnings, marketplaceAgents } from "@/db/schema";
import { ai } from "@/lib/ai";
import { evaluateSla, type SlaVerdict } from "@/lib/agent-sla";
import { creditEarning } from "@/lib/creator-earnings";
import { synthesizeSystemPromptFromManifest } from "@/lib/creator-submission-persistence";
import {
  signInvocation,
  type Attestation,
  type SlaVerdictLabel,
} from "@/lib/invocation-attestation";
import { createLogger } from "@/lib/logger";

const log = createLogger("marketplace-invoke");

/* ─── Types ───────────────────────────────────────────────────── */

export type InvokeErrorCode =
  | "no_db"
  | "not_found"
  | "not_live"
  | "bad_input"
  | "upstream_failed"
  | "unknown";

export interface InvokeSuccess {
  ok: true;
  invocationId: string;
  agent: {
    id: string;
    slug: string | null;
    name: string;
    pricingCents: number;
  };
  result: string;
  earnings: {
    grossCents: number;
    creatorCents: number;
    platformCents: number;
    creditRecorded: boolean;
    /** True if the SLA was breached and the creator credit was reversed. */
    refundIssued: boolean;
  };
  sla: SlaVerdict;
  /**
   * Ed25519 attestation of this invocation. When the platform signing
   * key is configured, `attestation._sig` is present and verifiable
   * by any third party with our public key (available at
   * /api/platform/public-key). When the key isn't configured the
   * attestation is still emitted but unsigned — auditors can still
   * cross-reference the hashes but have no cryptographic binding.
   */
  attestation: Attestation;
}

export interface InvokeFailure {
  ok: false;
  code: InvokeErrorCode;
  message: string;
}

export type InvokeResult = InvokeSuccess | InvokeFailure;

export interface InvokeInput {
  /** Agent slug (e.g. "invoice-extractor") OR UUID. */
  agentIdOrSlug: string;
  /** The buyer's prompt / query text. Capped at 8000 chars at this layer. */
  input: string;
  /** Max tokens for the response. Bounded at 4000 to contain runaway cost. */
  maxTokens?: number;
}

const MAX_INPUT_CHARS = 8000;
const MAX_TOKENS_HARD_CAP = 4000;

/* ─── Internals ───────────────────────────────────────────────── */

function databaseIsConfigured(): boolean {
  return typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0;
}

function generateInvocationId(): string {
  const ts = Date.now().toString(36);
  const rnd = Math.random().toString(36).slice(2, 8);
  return `inv-${ts}-${rnd}`;
}

interface AgentRow {
  id: string;
  slug: string | null;
  name: string;
  description: string;
  authorEmail: string;
  systemPrompt: string;
  pricePerRun: number;
  verificationStatus: string;
  isPublic: boolean;
  submissionSource: string | null;
  manifestRaw: unknown;
}

async function resolveAgent(idOrSlug: string): Promise<AgentRow | null> {
  if (!databaseIsConfigured() || !idOrSlug) return null;
  try {
    const rows = await db
      .select({
        id: marketplaceAgents.id,
        slug: marketplaceAgents.slug,
        name: marketplaceAgents.name,
        description: marketplaceAgents.description,
        authorEmail: marketplaceAgents.authorEmail,
        systemPrompt: marketplaceAgents.systemPrompt,
        pricePerRun: marketplaceAgents.pricePerRun,
        verificationStatus: marketplaceAgents.verificationStatus,
        isPublic: marketplaceAgents.isPublic,
        submissionSource: marketplaceAgents.submissionSource,
        manifestRaw: marketplaceAgents.manifestRaw,
      })
      .from(marketplaceAgents)
      .where(
        or(
          eq(marketplaceAgents.id, idOrSlug),
          eq(marketplaceAgents.slug, idOrSlug),
        ),
      )
      .limit(1);
    return rows[0] ?? null;
  } catch (err) {
    log.error("resolveAgent failed", {
      idOrSlug,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Pick the system prompt. SAM-sourced agents rebuild the prompt from
 * the manifest on every invocation (so if a creator later tweaks
 * guarantees and re-submits, future invocations pick up the new
 * version). Legacy agents use the stored systemPrompt column.
 */
function selectSystemPrompt(row: AgentRow): string {
  if (row.submissionSource === "sam-v1" && row.manifestRaw && typeof row.manifestRaw === "object") {
    const m = row.manifestRaw as Record<string, unknown>;
    const guarantees: string[] = Array.isArray(m.guarantees)
      ? (m.guarantees as unknown[]).filter((g): g is string => typeof g === "string")
      : [];
    const purpose = typeof m.purpose === "string" ? m.purpose : row.description;
    return synthesizeSystemPromptFromManifest(row.name, purpose, guarantees);
  }
  return row.systemPrompt;
}

async function bumpUsageCounters(
  agentId: string,
  grossCents: number,
  creatorCents: number,
): Promise<void> {
  if (!databaseIsConfigured()) return;
  try {
    await db
      .update(marketplaceAgents)
      .set({
        totalRunCount: sql`${marketplaceAgents.totalRunCount} + 1`,
        weeklyRunCount: sql`${marketplaceAgents.weeklyRunCount} + 1`,
        revenueCents: sql`${marketplaceAgents.revenueCents} + ${grossCents}`,
        creatorRevenueCents: sql`${marketplaceAgents.creatorRevenueCents} + ${creatorCents}`,
      })
      .where(eq(marketplaceAgents.id, agentId));
  } catch (err) {
    // Counter bumps are cosmetic — a failure here shouldn't block the
    // invocation or the earnings credit. Just log.
    log.warn("bumpUsageCounters failed", {
      agentId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/* ─── Public API ──────────────────────────────────────────────── */

export async function invokeMarketplaceAgent(
  args: InvokeInput,
): Promise<InvokeResult> {
  const input = (args.input ?? "").trim();
  if (!input) {
    return { ok: false, code: "bad_input", message: "input is required" };
  }
  if (!databaseIsConfigured()) {
    return { ok: false, code: "no_db", message: "marketplace is offline" };
  }

  const agent = await resolveAgent(args.agentIdOrSlug);
  if (!agent) {
    return { ok: false, code: "not_found", message: "agent not found" };
  }
  if (agent.verificationStatus !== "verified" || !agent.isPublic) {
    return {
      ok: false,
      code: "not_live",
      message: `agent is not published (status: ${agent.verificationStatus})`,
    };
  }

  const systemPrompt = selectSystemPrompt(agent);
  const truncated = input.slice(0, MAX_INPUT_CHARS);
  const maxTokens = Math.min(
    Math.max(args.maxTokens ?? 2000, 256),
    MAX_TOKENS_HARD_CAP,
  );

  const invocationId = generateInvocationId();
  let result: string;
  try {
    result = await ai(truncated, {
      system: systemPrompt,
      model: "nim", // free-tier first; smart router picks best NIM model
      maxTokens,
    });
  } catch (err) {
    log.warn("invoke ai() threw", {
      agentId: agent.id,
      invocationId,
      error: err instanceof Error ? err.message : String(err),
    });
    return {
      ok: false,
      code: "upstream_failed",
      message: "AI provider is temporarily unavailable. Try again.",
    };
  }

  // Evaluate SLA BEFORE crediting. If the output breached the
  // declared SLA, the creator credit is immediately reversed.
  const sla = evaluateSla({
    manifestRaw: agent.manifestRaw,
    output: result,
    expectedJson: false, // future: derive from manifest.output.type
  });

  // Credit earnings. Fire-and-await (not fire-and-forget) because we
  // want the credit to be durable before we return a success. The
  // creditEarning function is idempotent on invocationId so retries
  // are safe.
  const grossCents = agent.pricePerRun;
  const creatorCents = Math.floor(grossCents * 0.7);
  const platformCents = grossCents - creatorCents;

  const creditRecorded = grossCents > 0
    ? await creditEarning({
        agentId: agent.id,
        creatorEmail: agent.authorEmail,
        grossCents,
        invocationId,
      })
    : true;

  // If the SLA breached, flip the just-credited row to "reversed".
  // The earnings ledger remains the source of truth; this is a
  // documented, auditable refund rather than a silent deletion.
  let refundIssued = false;
  if (sla.breached && grossCents > 0 && creditRecorded) {
    try {
      await db
        .update(creatorEarnings)
        .set({ status: "reversed" })
        .where(eq(creatorEarnings.invocationId, invocationId));
      refundIssued = true;
      log.info("SLA-triggered refund applied", {
        invocationId,
        agentId: agent.id,
        refundPct: sla.refundPct,
        confidence: sla.confidence,
      });
    } catch (err) {
      log.warn("SLA refund update failed — credit remains pending", {
        invocationId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Counter bump happens after success. Cosmetic — never blocks.
  void bumpUsageCounters(agent.id, grossCents, creatorCents);

  // Build the cryptographic attestation for this run. Signs the
  // HASHES of input/output (privacy-preserving) + agent + model +
  // timestamp + SLA verdict with the platform's ed25519 key.
  const slaLabel: SlaVerdictLabel = sla.enforced
    ? sla.breached ? "breached" : "met"
    : "not_enforced";
  const attestationResult = await signInvocation({
    agentId: agent.id,
    invocationId,
    input: truncated,
    output: result,
    modelUsed: "nim",
    slaVerdict: slaLabel,
  });

  return {
    ok: true,
    invocationId,
    agent: {
      id: agent.id,
      slug: agent.slug,
      name: agent.name,
      pricingCents: agent.pricePerRun,
    },
    result,
    earnings: {
      grossCents,
      creatorCents,
      platformCents,
      creditRecorded,
      refundIssued,
    },
    sla,
    attestation: attestationResult.attestation,
  };
}
