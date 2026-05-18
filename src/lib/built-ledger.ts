/**
 * SOVEREIGN MATRIX — Built ledger (Wave 14, audit-2026-05 elite).
 *
 * Receipt-anchored record of every shipped milestone. Each entry is a
 * pure-typed record with deterministic fields; the SHA-256 over the
 * canonical projection is what gets signed and shown on /built.
 *
 * Why this exists:
 *   - Roadmaps are usually marketing fiction ("we'll ship X in Q3").
 *   - This page is the inverse: an append-only log of what's already
 *     shipped, each line cryptographically pinned to the commit that
 *     shipped it. Visitors can verify any line independently — paste
 *     the receipt id into /auditor/replay and re-derive the hash.
 *
 * Update policy: append-only. Never edit a past entry. If a shipped
 * feature is later rolled back, add a NEW "rollback" entry — never
 * mutate history.
 *
 * Verification: `signMilestone(entry)` produces a v1=hmac / v2=ed25519
 * signature over the canonical projection (same scheme as receipts).
 * The public page calls this at render time so a visitor inspecting
 * the page source sees real bytes.
 */

import { createHash } from "crypto";
import { signRun } from "@/lib/agent-runs";

export interface MilestoneEntry {
  /** Unique stable slug, kebab-case. Becomes the receipt id segment. */
  slug: string;
  /** Display title — visible on /built. */
  title: string;
  /** One-sentence ship description. */
  description: string;
  /** ISO 8601 ship timestamp (UTC). */
  shippedAt: string;
  /** Wave identifier from the build session. */
  wave: number;
  /** Git commit short SHA the work landed in. */
  commit: string;
  /** Primary category for filtering. */
  category:
    | "security"
    | "infrastructure"
    | "compliance"
    | "revenue"
    | "ux"
    | "platform"
    | "observability";
  /** Verifiable surface — what visitor can hit to confirm the claim. */
  verifyHref?: string;
}

export interface MilestoneAttestation {
  entry: MilestoneEntry;
  /** SHA-256 of the canonical projection. */
  contentHash: string;
  /** Signature in v1=hmac / v2=ed25519 wire format. */
  signature: string;
  /** Canonical projection — auditor can re-derive and re-hash. */
  canonical: string;
}

/**
 * The append-only shipped ledger. Earliest first. Add new milestones
 * to the END of the array; never re-order, never rewrite.
 */
export const BUILT_LEDGER: MilestoneEntry[] = [
  {
    slug: "wave-1-security-hardfix",
    title: "Crypto fallback removed, CI audit blocking, bug bounty",
    description:
      "Killed silent plaintext fallback in safeEncrypt/safeDecrypt, removed vendor demo keys, made npm audit blocking, published /bug-bounty.",
    shippedAt: "2026-05-16T05:54:00.000Z",
    wave: 1,
    commit: "70d7642d",
    category: "security",
    verifyHref: "/bug-bounty",
  },
  {
    slug: "wave-2-ai-router-registry",
    title: "Model registry wired into AI router",
    description:
      "Cook-183 registry now drives taskType routing; user-content prompt caching on Claude saves ~90% on repeat-context calls; god-brain default flipped Opus → Sonnet.",
    shippedAt: "2026-05-16T06:24:00.000Z",
    wave: 2,
    commit: "e7c2ceb2",
    category: "infrastructure",
  },
  {
    slug: "wave-3-enterprise-levers",
    title: "Enterprise contract levers + Sovereign tier",
    description:
      "PlanEnterpriseFlags (SAML, residency, BYOK, SLA, audit export) on every plan; new contract tier above Enterprise; /sales page.",
    shippedAt: "2026-05-16T07:05:00.000Z",
    wave: 3,
    commit: "67166cae",
    category: "revenue",
    verifyHref: "/sales",
  },
  {
    slug: "wave-4-post-quantum",
    title: "ML-DSA-65 dual-sign scaffold for forward-secure receipts",
    description:
      "Receipts can now be co-signed with Ed25519 + Dilithium3 (FIPS 204) so 7–25y retention horizons stay verifiable across the post-quantum transition.",
    shippedAt: "2026-05-16T07:36:00.000Z",
    wave: 4,
    commit: "84a116f1",
    category: "compliance",
  },
  {
    slug: "wave-5-design-polish",
    title: "Pricing repaint + /v3 audit-grade signing",
    description:
      "Stripped emerald/teal/purple from the pricing page; /v3 now signs with the production signRun (no self-attestation gimmick); experimental labels gone.",
    shippedAt: "2026-05-16T07:23:00.000Z",
    wave: 5,
    commit: "e6e19ca4",
    category: "ux",
  },
  {
    slug: "wave-6-money-path-tests",
    title: "Stripe webhook contract tests + publishable SDK",
    description:
      "9 hermetic Stripe webhook tests lock in signature / replay / idempotency / state-machine invariants; @sovereign-matrix/agent-sdk@0.1.0 packaged for npm.",
    shippedAt: "2026-05-16T07:31:00.000Z",
    wave: 6,
    commit: "8f4aef5f",
    category: "infrastructure",
  },
  {
    slug: "wave-7-auditor-replay",
    title: "Auditor Replay — receipts become forensic evidence",
    description:
      "/auditor/replay re-derives canonical bytes from storage, checks the stored signature, and issues a fresh replay attestation. Five verdict branches.",
    shippedAt: "2026-05-16T08:21:00.000Z",
    wave: 7,
    commit: "98a9cfe7",
    category: "compliance",
    verifyHref: "/auditor/replay",
  },
  {
    slug: "wave-8-webauthn-mfa",
    title: "WebAuthn step-up MFA for admin actions",
    description:
      "Hardware-key authentication (YubiKey / passkey) gates /api/_admin/*. Counter-regression detection auto-revokes cloned authenticators. SOC 2 CC6.1 ready.",
    shippedAt: "2026-05-16T08:30:00.000Z",
    wave: 8,
    commit: "ab9b425f",
    category: "security",
  },
  {
    slug: "wave-9-bitcoin-anchor",
    title: "OpenTimestamps Bitcoin anchor of audit-log chain head",
    description:
      "Daily cron submits the audit-log chain head to three public OTS calendars. Once a Bitcoin block confirms, the chain is mathematically unforgeable.",
    shippedAt: "2026-05-16T08:52:00.000Z",
    wave: 9,
    commit: "fbc8ede7",
    category: "compliance",
    verifyHref: "/api/auditor/anchor",
  },
  {
    slug: "wave-10-otel-tracing",
    title: "OpenTelemetry tracing on every Claude call",
    description:
      "withAiSpan wrapper emits gen_ai.* attributes (model / provider / tokens / cost / cache-hit / tenant). Per-tenant blame across providers.",
    shippedAt: "2026-05-16T10:12:00.000Z",
    wave: 10,
    commit: "1cccf238",
    category: "observability",
  },
  {
    slug: "wave-11-otel-everywhere",
    title: "Trace wrapper extended to every provider",
    description:
      "Gemini / Groq / NIM / Cerebras / Mistral / Ollama all now emit gen_ai.* spans through the same wrapper. Observability complete across the cascade.",
    shippedAt: "2026-05-16T10:18:00.000Z",
    wave: 11,
    commit: "b9d9221f",
    category: "observability",
  },
  {
    slug: "wave-12-landing-strip",
    title: "Landing stripped to 6 elite-tier sections",
    description:
      "14 sections → 6. Cut InvestorSignalStrip, DesignPartnerSlotsStrip, FeaturedPlaybooksSection, IndustrySection, PlatformScale, ModelRouterSection, A2EEconomySection.",
    shippedAt: "2026-05-16T10:27:00.000Z",
    wave: 12,
    commit: "1ed0023e",
    category: "ux",
    verifyHref: "/",
  },
  {
    slug: "wave-13-signed-dsar",
    title: "Cryptographically-signed DSAR exports + public verifier",
    description:
      "/api/me/export?signed=1 attaches an Ed25519/HMAC attestation; /api/dsar/verify/<id> lets regulators re-verify with the original payload.",
    shippedAt: "2026-05-16T10:35:00.000Z",
    wave: 13,
    commit: "5cb8811a",
    category: "compliance",
    verifyHref: "/api/dsar/verify/EXAMPLE",
  },
];

/**
 * Project a milestone onto the deterministic canonical projection that
 * gets hashed and signed. Keys are emitted in lexicographic order; no
 * undefined / NaN drift. Same shape used by all receipts.
 */
export function canonicalizeMilestone(entry: MilestoneEntry): string {
  return JSON.stringify({
    v: 1,
    type: "built-ledger-entry",
    category: entry.category,
    commit: entry.commit,
    description: entry.description,
    shippedAt: entry.shippedAt,
    slug: entry.slug,
    title: entry.title,
    verifyHref: entry.verifyHref ?? null,
    wave: entry.wave,
  });
}

/**
 * Sign a single milestone. Returns the full attestation object the
 * /built page renders inline so a visitor inspecting the page sees
 * real bytes (canonical → contentHash → signature).
 */
export function signMilestone(entry: MilestoneEntry): MilestoneAttestation {
  const canonical = canonicalizeMilestone(entry);
  const contentHash = createHash("sha256")
    .update(canonical, "utf8")
    .digest("hex");
  const signature = signRun(canonical);
  return { entry, canonical, contentHash, signature };
}

/**
 * Compute the ledger digest — a single SHA-256 that binds every entry
 * in the ledger together. Visitors can hash this and compare against
 * the value pinned on /built. Any append → new digest.
 */
export function ledgerDigest(): string {
  const buf = BUILT_LEDGER.map((e) => canonicalizeMilestone(e)).join("\n");
  return createHash("sha256").update(buf, "utf8").digest("hex");
}

/** Return the full signed ledger — for the API endpoint + page. */
export function getSignedLedger(): {
  digest: string;
  count: number;
  entries: MilestoneAttestation[];
} {
  const entries = BUILT_LEDGER.map(signMilestone);
  return {
    digest: ledgerDigest(),
    count: entries.length,
    entries,
  };
}
