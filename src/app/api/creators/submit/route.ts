/**
 * POST /api/creators/submit
 *
 * Receives a Sovereign Agent Manifest (SAM v1.0) from a prospective
 * creator and — after validation — consults the active approval policy
 * (see src/lib/creator-approval-policy.ts) to decide whether to:
 *
 *   • auto-publish immediately (outcome: "auto-publish", HTTP 201)
 *   • queue for operator review (outcome: "queue",       HTTP 202)
 *
 * Defence in depth: server validation deliberately duplicates the
 * client validator in CreatorApplyClient. A manifest submitted directly
 * via curl must fail the same way as one submitted through the form.
 *
 * Persistence note: this route does not yet write to a
 * `creator_submissions` table. Submissions are emitted as structured
 * log lines (event="creator_submission") that operators tail. When the
 * table lands in a subsequent migration the priorApprovedCount query
 * will replace the `0` stub in buildCreatorContext() and trust-tiered
 * behaviour will differentiate from curated.
 *
 * Rate limit: 10 submissions/hour/IP via an edge rule. Low cap because
 * spam submissions burn operator-review time, not model tokens.
 */

import { NextResponse } from "next/server";
import {
  checkIpRateLimit,
  extractClientIp,
} from "@/lib/api-guard";
import {
  evaluateSubmission,
  type ApprovalDecision,
  type CreatorContext,
  type ManifestContext,
} from "@/lib/creator-approval-policy";
import {
  countPriorApprovals,
  persistSubmission,
  synthesizeSystemPromptFromManifest,
} from "@/lib/creator-submission-persistence";
import { notifySubmissionReceived } from "@/lib/creator-emails";
import {
  runDeepSafety,
  runSyncSafety,
  type SafetyInput,
} from "@/lib/submission-safety";

/* ─── SAM v1.0 validator (server-side mirror) ──────────────────── */
/*
 * Kept inline to avoid cross-package import complications in Next.js
 * App Router. The external @sovereignmatrix/agent-validator package
 * exists for third-party tooling; this code path must stay in-repo.
 */

const VALID_CATEGORIES = new Set([
  "Growth",
  "Content",
  "Dev",
  "Finance",
  "HR",
  "Legal",
  "Ecommerce",
  "Research",
  "Cybersec",
  "Real Estate",
  "Gov",
  "Productivity",
  "Creative",
  "Data",
  "A2E",
  "Meta",
  "Integration",
  "Safety",
]);

const SLUG_PATTERN = /^[a-z][a-z0-9-]{2,63}$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/;
const REQUIRED_FIELDS = [
  "sam",
  "slug",
  "displayName",
  "purpose",
  "category",
  "version",
  "inputs",
  "output",
  "guarantees",
];

interface ValidationError {
  path: string;
  message: string;
}

function validateManifest(manifest: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
    return [{ path: "/", message: "Manifest must be a JSON object." }];
  }

  const m = manifest as Record<string, unknown>;

  for (const field of REQUIRED_FIELDS) {
    if (!(field in m)) {
      errors.push({ path: `/${field}`, message: `Required field "${field}" is missing.` });
    }
  }

  if ("sam" in m && m.sam !== "1.0") {
    errors.push({ path: "/sam", message: `"sam" must be exactly "1.0".` });
  }

  if ("slug" in m && typeof m.slug === "string" && !SLUG_PATTERN.test(m.slug)) {
    errors.push({ path: "/slug", message: `"slug" must be kebab-case (3-64 chars, starts with letter).` });
  }

  if ("category" in m && typeof m.category === "string" && !VALID_CATEGORIES.has(m.category)) {
    errors.push({ path: "/category", message: `"category" must be one of the 18 official categories.` });
  }

  if ("version" in m && typeof m.version === "string" && !SEMVER_PATTERN.test(m.version)) {
    errors.push({ path: "/version", message: `"version" must be SemVer.` });
  }

  if ("guarantees" in m) {
    if (!Array.isArray(m.guarantees) || m.guarantees.length < 1) {
      errors.push({ path: "/guarantees", message: `"guarantees" must contain at least 1 clause.` });
    }
  }

  return errors;
}

/* ─── Context builders ─────────────────────────────────────────── */

function buildManifestContext(m: Record<string, unknown>): ManifestContext {
  const pricing = m.pricing as { cents?: unknown } | undefined;
  const pricingCents =
    pricing && typeof pricing.cents === "number" ? pricing.cents : undefined;
  return {
    slug: String(m.slug ?? ""),
    displayName: String(m.displayName ?? ""),
    category: String(m.category ?? ""),
    pricingCents,
  };
}

async function buildCreatorContext(
  contactEmail: string | null,
): Promise<CreatorContext> {
  // Queries marketplace_agents for how many agents this email has had
  // approved ("verified"). Safe when DB is unconfigured or query fails
  // — returns 0 (treat as new creator, queue submission). This means
  // trust-tiered without a DB degrades to curated behaviour, which is
  // the intended safe default.
  const priorApprovedCount = await countPriorApprovals(contactEmail);
  return {
    contactEmail,
    priorApprovedCount,
  };
}

/* ─── Reference ID ─────────────────────────────────────────────── */

function generateReferenceId(): string {
  // Short, human-friendly. 8 hex chars timestamp + 4 random.
  const time = Date.now().toString(16);
  const rand = Math.random().toString(16).slice(2, 6);
  return `SAM-${time.slice(-8)}-${rand}`;
}

/* ─── Next-steps copy (per outcome) ────────────────────────────── */

function nextStepsFor(decision: ApprovalDecision, slug: string): string[] {
  if (decision.outcome === "auto-publish") {
    return [
      `Your agent is live at /marketplace/${slug}.`,
      "You'll earn 70% of every invocation (payout monthly via Stripe Connect).",
      "Post-hoc safety audit runs in the background — we'll email if anything needs revision.",
    ];
  }
  return [
    "Operator will review within 24 hours (business days).",
    "You'll receive an email at the provided address with the verdict.",
    "Approved agents are listed in the Staff Directory + Marketplace immediately after approval.",
  ];
}

/* ─── Handler ──────────────────────────────────────────────────── */

export async function POST(request: Request): Promise<Response> {
  // IP-keyed rate limit. This endpoint is public + unauthenticated by
  // design (creators can submit before signing up), so a user-ID key
  // isn't available. 10 submissions/hour/IP — spam bots hit the wall
  // long before they cost us a meaningful Claude bill.
  const ip = extractClientIp(request.headers);
  const gate = checkIpRateLimit(ip, {
    bucket: "creators-submit",
    windowMs: 60 * 60 * 1000,
    max: 10,
  });
  if (!gate.allowed) {
    return NextResponse.json(
      {
        error: "Too many submissions from this IP. Try again later.",
        resetIn: gate.resetIn,
      },
      {
        status: 429,
        headers: {
          "Cache-Control": "no-store",
          "Retry-After": String(Math.ceil(gate.resetIn / 1000)),
        },
      },
    );
  }

  let manifest: unknown;
  let contactEmail: string | null = null;

  try {
    const body = (await request.json()) as {
      manifest?: unknown;
      contactEmail?: string;
    };
    manifest = body.manifest;
    if (typeof body.contactEmail === "string" && body.contactEmail.length <= 320) {
      contactEmail = body.contactEmail;
    }
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (manifest === undefined) {
    return NextResponse.json(
      { error: "Missing 'manifest' field in request body." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Server-side validation (defence in depth).
  const errors = validateManifest(manifest);
  if (errors.length > 0) {
    return NextResponse.json(
      {
        error: "Manifest failed SAM v1.0 validation.",
        errors,
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Optional email format sanity check.
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return NextResponse.json(
      { error: "contactEmail is not a valid email address." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const validManifest = manifest as Record<string, unknown>;
  const manifestCtx = buildManifestContext(validManifest);
  const creatorCtx = await buildCreatorContext(contactEmail);

  // Build the safety input once — used for both sync + (conditional) deep checks.
  const guaranteesArr: string[] = Array.isArray(validManifest.guarantees)
    ? (validManifest.guarantees as unknown[]).map((g) => String(g))
    : [];
  const purposeStr = String(validManifest.purpose ?? "");
  const safetyInput: SafetyInput = {
    displayName: manifestCtx.displayName,
    purpose: purposeStr,
    guarantees: guaranteesArr,
    pricingCents: manifestCtx.pricingCents ?? 0,
    systemPrompt: synthesizeSystemPromptFromManifest(
      manifestCtx.displayName,
      purposeStr,
      guaranteesArr,
    ),
  };

  // Layer 1-3: synchronous safety (always runs, ~$0). Hard-rejects if
  // the submission contains PII / jailbreak boilerplate / out-of-bounds
  // fields. These are the kind of issues a human reviewer would also
  // reject — blocking at the gate saves everyone time.
  const syncSafety = runSyncSafety(safetyInput);
  if (!syncSafety.passed) {
    return NextResponse.json(
      {
        error: "Submission failed safety review.",
        reason: syncSafety.reason,
        code: syncSafety.code,
        field: syncSafety.field,
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Policy decision: auto-publish vs queue.
  const decision = evaluateSubmission(manifestCtx, creatorCtx);
  let effectiveOutcome = decision.outcome;
  let effectiveReason = decision.reason;
  let deepSafetyScore: number | null = null;

  // Layer 4-5: deep LLM safety ONLY when the policy decided to
  // auto-publish. Queued submissions will be reviewed by a human and
  // don't need the expensive check.
  //
  // If deep safety fails, we DOWNGRADE to queue rather than reject —
  // the submission is still recorded (so the creator has a reference
  // ID), it just goes into the review queue with the failure reason
  // annotated. This protects the creator UX: a false positive from the
  // LLM critic becomes a 24-hour wait, not a hard rejection.
  if (decision.outcome === "auto-publish") {
    const deep = await runDeepSafety(safetyInput);
    deepSafetyScore = deep.safetyScore;
    if (!deep.passed) {
      effectiveOutcome = "queue";
      effectiveReason = `auto-publish blocked by deep safety (${deep.reason ?? "LLM critic"}); queued for human review`;
    }
  }

  const referenceId = generateReferenceId();
  const receivedAt = new Date().toISOString();

  // Persist to marketplace_agents. Graceful-no-DB: returns false if
  // DATABASE_URL is unset or insert failed; the structured log below is
  // the durable audit trail of last resort.
  const persisted = await persistSubmission({
    referenceId,
    slug: manifestCtx.slug,
    displayName: manifestCtx.displayName,
    purpose: purposeStr,
    samCategory: manifestCtx.category,
    pricingCents: manifestCtx.pricingCents ?? 0,
    contactEmail,
    guarantees: guaranteesArr,
    manifestRaw: validManifest,
    policy: decision.policy,
    reason: effectiveReason,
    autoPublished: effectiveOutcome === "auto-publish",
  });

  // Structured log — one line per submission, parseable by any log
  // aggregator. `persisted: false` + a `reason` in the log tells
  // operators which submissions might need hand-processing.
  // `downgradedByDeepSafety` flags rows where auto-publish was blocked
  // and is the most important signal for post-hoc audit.
  console.log(
    JSON.stringify({
      event: "creator_submission",
      referenceId,
      slug: manifestCtx.slug,
      displayName: manifestCtx.displayName,
      category: manifestCtx.category,
      pricingCents: manifestCtx.pricingCents ?? null,
      contactEmail: contactEmail ?? "(not provided)",
      priorApprovedCount: creatorCtx.priorApprovedCount,
      policy: decision.policy,
      originalOutcome: decision.outcome,
      effectiveOutcome,
      downgradedByDeepSafety:
        decision.outcome === "auto-publish" && effectiveOutcome !== "auto-publish",
      deepSafetyScore,
      reason: effectiveReason,
      persisted,
      receivedAt,
    }),
  );

  const status = effectiveOutcome === "auto-publish" ? "live" : "queued";
  const httpStatus = effectiveOutcome === "auto-publish" ? 201 : 202;
  const liveUrl =
    effectiveOutcome === "auto-publish"
      ? `/marketplace/${manifestCtx.slug}`
      : undefined;

  const effectiveDecision: ApprovalDecision = {
    outcome: effectiveOutcome,
    policy: decision.policy,
    reason: effectiveReason,
  };

  // Fire-and-forget acknowledgement email. Creators get the reference
  // ID + status URL in their inbox even if they close the browser tab
  // before reading the success panel. Silent degradation without
  // RESEND_API_KEY — the HTTP response is still authoritative.
  if (contactEmail) {
    void notifySubmissionReceived({
      to: contactEmail,
      displayName: manifestCtx.displayName,
      referenceId,
      effectiveOutcome,
      liveUrl:
        effectiveOutcome === "auto-publish"
          ? `/marketplace/${manifestCtx.slug}`
          : undefined,
    });
  }

  return NextResponse.json(
    {
      success: true,
      referenceId,
      status,
      policy: decision.policy,
      reason: effectiveReason,
      liveUrl,
      safetyScore: deepSafetyScore,
      nextSteps: nextStepsFor(effectiveDecision, manifestCtx.slug),
    },
    {
      status: httpStatus,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
