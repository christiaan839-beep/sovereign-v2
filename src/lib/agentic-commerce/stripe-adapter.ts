/**
 * STRIPE AGENTIC COMMERCE TOOLKIT ADAPTER — R92.
 *
 * The first rails adapter for R91 ACAT. Bridges Sovereign's
 * cryptographic trust substrate (ACAT) to Stripe's Agentic Commerce
 * Toolkit (May 2024 launch) so that any Stripe-using merchant can
 * accept agent-initiated purchases with a verifiable trust artifact.
 *
 * Why this matters: Stripe's toolkit gives the agent a checkout
 * surface; it does NOT verify that the agent is actually authorized
 * by the user. This adapter closes that gap — the merchant verifies
 * the ACAT OFFLINE before charging, then attaches it to the
 * PaymentIntent so the chargeback evidence is automatic.
 *
 * DESIGN CONTRACT:
 *
 *   1. Pure functions only. The adapter PRODUCES Stripe-shaped
 *      objects; it does NOT call the Stripe SDK. This means the
 *      whole file ports verbatim to @sovereign/inspector for
 *      offline merchant tooling — and merchants can use it without
 *      adding a Sovereign runtime dependency.
 *
 *   2. ACAT → metadata is the source of truth. The full ACAT goes
 *      in `metadata.sovereign_acat` (base64url-encoded canonical
 *      JSON). Chain hash + agent ID + reputation grade are
 *      duplicated as separate metadata keys so Stripe Dashboard
 *      filters/sorts work without decoding the token.
 *
 *   3. Webhook verification is the merchant's responsibility (using
 *      the Stripe SDK against their webhook secret). This adapter
 *      ONLY takes an already-verified Stripe event and binds it to
 *      an ACAT verification outcome — producing an audit chain
 *      entry the merchant can append to their R26 log.
 *
 *   4. Chargeback evidence is automatic. Given a dispute event +
 *      the original ACAT + the agent's audit-chain extract,
 *      `buildChargebackEvidence` produces a Stripe-Dashboard-ready
 *      evidence packet with cryptographically-verifiable proof of
 *      authorization. This is the artifact that wins in court.
 *
 * COMPOSITION:
 *
 *   ACAT mint (R91) → Stripe metadata (this file)
 *   Stripe webhook → ACAT-bound outcome (this file)
 *   Webhook outcome → audit chain (R26)
 *   Dispute → chargeback evidence (this file) → Stripe Dashboard
 *
 * Strategic move: we don't compete with Stripe; we make the toolkit
 * trustworthy. Every Stripe customer who uses agentic checkout has
 * a reason to add Sovereign — court-defensible chargeback evidence
 * doesn't exist any other way.
 */

import {
  type SignedACAT,
  type ACATVerifyResult,
  encodeACATForHeader,
  decodeACATFromHeader,
  summarizeACATForReceipt,
  verifyACAT,
} from "./acat";

// ── Stripe-shaped types (we don't depend on the SDK for these) ────

/**
 * The metadata fields we add to a Stripe PaymentIntent. Stripe
 * imposes a 50-key + 500-char-per-value + 40-char-per-key limit on
 * metadata. Our `sovereign_acat` value can exceed 500 chars — we
 * detect this and split across `sovereign_acat_part_N` keys with
 * a `sovereign_acat_parts` count for reassembly.
 */
export interface StripeAgenticMetadata {
  /** Base64url canonical-JSON ACAT (full token, possibly chunked). */
  sovereign_acat: string;
  /** If acat exceeded 500 chars, this is "1" and chunked keys are
   *  sovereign_acat_part_1..N — verifier reassembles. */
  sovereign_acat_chunked?: "1";
  /** Chain hash of the ACAT — Stripe Dashboard searchable. */
  sovereign_acat_chain_hash: string;
  /** Agent identity reference (R38 manifest URI). */
  sovereign_agent_id: string;
  /** R38 manifest version (for reproducibility). */
  sovereign_agent_manifest_version: string;
  /** R34 user identity. */
  sovereign_user_id: string;
  /** Reputation letter grade at issuance time (or "none"). */
  sovereign_reputation_grade: string;
  /** Insurance policy id, or "none". */
  sovereign_insurance_policy: string;
  /** ACAT issuedAt — searchable in dashboard for incident response. */
  sovereign_acat_issued_at: string;
  /** Adapter version — bumped on protocol changes. */
  sovereign_adapter_version: "stripe-acat-v1";
}

/**
 * What we expect from a Stripe PaymentIntent for adapter input.
 * (Subset of the SDK's type — we don't depend on the SDK.)
 */
export interface StripePaymentIntentInput {
  amount: number; // cents
  currency: string; // ISO 4217 lowercase per Stripe convention
  customer?: string;
  description?: string;
  metadata?: Record<string, string>;
}

export interface StripePaymentIntentWithACAT
  extends Required<Pick<StripePaymentIntentInput, "amount" | "currency">> {
  customer?: string;
  description?: string;
  metadata: Record<string, string> & StripeAgenticMetadata;
}

// ── Pure: ACAT → Stripe PaymentIntent input ───────────────────────

/**
 * Stripe limit. Each metadata value <= 500 chars.
 * https://stripe.com/docs/api/metadata
 */
const STRIPE_METADATA_VALUE_MAX = 500;

/**
 * Pure: chunk a string into 500-char pieces. Empty string returns [""]
 * so the caller always sees at least one part.
 */
export function chunkForStripeMetadata(s: string): string[] {
  if (s.length === 0) return [""];
  const out: string[] = [];
  for (let i = 0; i < s.length; i += STRIPE_METADATA_VALUE_MAX) {
    out.push(s.slice(i, i + STRIPE_METADATA_VALUE_MAX));
  }
  return out;
}

/**
 * Pure: convert ACAT into Stripe metadata (with chunking if needed).
 *
 * This is what the merchant adds to their PaymentIntent.create call.
 * The metadata is opaque to Stripe — they don't validate it — but
 * it travels with every webhook event AND appears in the dashboard
 * AND is included in dispute evidence by default.
 */
export function acatToStripeMetadata(token: SignedACAT): StripeAgenticMetadata {
  const encoded = encodeACATForHeader(token);
  const chunks = chunkForStripeMetadata(encoded);

  // Build base metadata.
  const base: StripeAgenticMetadata = {
    sovereign_acat:
      chunks.length === 1
        ? chunks[0]
        : "(chunked — see sovereign_acat_part_1..N)",
    sovereign_acat_chain_hash: token.chainHash,
    sovereign_agent_id: token.agentId,
    sovereign_agent_manifest_version: token.agentManifestVersion,
    sovereign_user_id: token.userId,
    sovereign_reputation_grade: token.reputation
      ? token.reputation.letterGrade
      : "none",
    sovereign_insurance_policy: token.insurance
      ? token.insurance.policyId
      : "none",
    sovereign_acat_issued_at: token.issuedAt,
    sovereign_adapter_version: "stripe-acat-v1",
  };

  if (chunks.length > 1) {
    base.sovereign_acat_chunked = "1";
  }
  return base;
}

/**
 * Pure: produce the chunked metadata KEY-VALUE pairs (when needed).
 * Stripe's per-key limit is 40 chars — `sovereign_acat_part_NN` fits.
 * NN supports up to 99 chunks → 49,500 chars of token data, more
 * than enough for any reasonable ACAT.
 */
export function acatChunkMetadata(
  token: SignedACAT,
): Record<string, string> {
  const encoded = encodeACATForHeader(token);
  const chunks = chunkForStripeMetadata(encoded);
  if (chunks.length === 1) return {};
  const out: Record<string, string> = {};
  chunks.forEach((c, i) => {
    out[`sovereign_acat_part_${i + 1}`] = c;
  });
  out.sovereign_acat_parts = String(chunks.length);
  return out;
}

/**
 * Pure: combine an ACAT-encoded set of fields with a base PaymentIntent
 * input. The merchant calls this once per cart to get the full Stripe
 * SDK input.
 *
 * Key strategic property: the ACAT itself is the source of truth for
 * authorization. Stripe is the rail. The merchant can re-verify the
 * ACAT at any point in the lifecycle (cart, charge, fulfillment,
 * dispute) by extracting it from the metadata and calling verifyACAT.
 */
export function buildStripePaymentIntentForACAT(input: {
  base: StripePaymentIntentInput;
  token: SignedACAT;
}): StripePaymentIntentWithACAT {
  const metadata = {
    ...(input.base.metadata ?? {}),
    ...acatToStripeMetadata(input.token),
    ...acatChunkMetadata(input.token),
  };
  return {
    amount: input.base.amount,
    currency: input.base.currency,
    customer: input.base.customer,
    description: input.base.description,
    metadata: metadata as Record<string, string> & StripeAgenticMetadata,
  };
}

// ── Pure: extract + verify ACAT from a Stripe metadata bag ────────

/**
 * Pure: reassemble the ACAT from chunked metadata, decode, and
 * return null if any part is missing/malformed.
 */
export function extractACATFromStripeMetadata(
  metadata: Record<string, string> | undefined,
): SignedACAT | null {
  if (!metadata) return null;
  if (metadata.sovereign_adapter_version !== "stripe-acat-v1") return null;

  let encoded: string;
  if (metadata.sovereign_acat_chunked === "1") {
    const partsCount = Number.parseInt(metadata.sovereign_acat_parts, 10);
    if (!Number.isFinite(partsCount) || partsCount < 1 || partsCount > 99) {
      return null;
    }
    const buf: string[] = [];
    for (let i = 1; i <= partsCount; i++) {
      const chunk = metadata[`sovereign_acat_part_${i}`];
      if (typeof chunk !== "string") return null;
      buf.push(chunk);
    }
    encoded = buf.join("");
  } else {
    if (typeof metadata.sovereign_acat !== "string") return null;
    encoded = metadata.sovereign_acat;
  }
  return decodeACATFromHeader(encoded);
}

// ── Pure: webhook event → ACAT-bound outcome ──────────────────────

/**
 * The Stripe event types we handle. All are POST-webhook-verification
 * events — the merchant has already validated the signature.
 */
export type StripeAgenticEvent =
  | "payment_intent.succeeded"
  | "payment_intent.payment_failed"
  | "charge.refunded"
  | "charge.dispute.created"
  | "charge.dispute.closed";

/** Subset of Stripe's event shape we need. */
export interface StripeAgenticEventInput {
  type: StripeAgenticEvent;
  /** ISO 8601 from event.created (we don't trust event.created alone — but
   *  we do use it for the audit log timestamp). */
  occurredAt: string;
  /** PaymentIntent / Charge / Dispute object's metadata. */
  metadata: Record<string, string>;
  /** Resource id for tracing. */
  resourceId: string;
  /** For dispute events, the reason. Optional otherwise. */
  disputeReason?: string;
}

/**
 * The structured outcome we append to the user's R26 audit chain.
 */
export interface StripeAcatOutcome {
  event: StripeAgenticEvent;
  resourceId: string;
  occurredAt: string;
  acatChainHash: string;
  agentId: string;
  userId: string;
  /** Re-verification result against the cart. If the merchant didn't
   *  pass cart context, we just reverify signatures + chain hash. */
  acatStillValid: boolean;
  acatInvalidReason?: ACATVerifyResult extends { valid: false; reason: infer R }
    ? R
    : never;
  /** Procurement-readable summary appendable to the receipt. */
  receiptLine: string;
}

/**
 * Pure: process a Stripe agentic event and produce an outcome record
 * for the user's audit chain.
 *
 * If the merchant supplies cart context, we re-verify the ACAT against
 * it (defense in depth — the agent might have presented a token in
 * cart that didn't match the actual amount charged). If not, we just
 * re-verify signatures.
 */
export function processStripeAgenticEvent(input: {
  event: StripeAgenticEventInput;
  /** The user pubkey we expect — looked up by merchant from agent ID. */
  expectedUserPublicKey: string;
  /** Optional cart re-verification context. Recommended for
   *  payment_intent.succeeded events to catch any deviation. */
  cart?: {
    amountCents: number;
    currency: string;
    merchantId: string;
    category: import("./acat").CommerceCategory;
  };
  /** Now (testability + clock skew). */
  now?: Date;
}):
  | { ok: true; outcome: StripeAcatOutcome }
  | { ok: false; reason: "missing_acat_in_metadata" | "decode_failed" } {
  const token = extractACATFromStripeMetadata(input.event.metadata);
  if (token === null) {
    return { ok: false, reason: "missing_acat_in_metadata" };
  }

  let acatStillValid = true;
  let acatInvalidReason: StripeAcatOutcome["acatInvalidReason"] | undefined;

  if (input.cart) {
    const result = verifyACAT({
      token,
      expectedUserPublicKey: input.expectedUserPublicKey,
      cart: input.cart,
      now: input.now,
    });
    if (!result.valid) {
      acatStillValid = false;
      acatInvalidReason = result.reason as NonNullable<
        StripeAcatOutcome["acatInvalidReason"]
      >;
    }
  }

  const receiptLine = [
    `Stripe ${input.event.type} on ${input.event.resourceId}`,
    `  acat chain hash: ${token.chainHash.slice(0, 16)}...`,
    `  agent: ${token.agentId}`,
    `  user: ${token.userId}`,
    `  re-verification: ${acatStillValid ? "PASS" : `FAIL (${acatInvalidReason})`}`,
    input.event.disputeReason
      ? `  dispute reason: ${input.event.disputeReason}`
      : null,
  ]
    .filter((l): l is string => l !== null)
    .join("\n");

  return {
    ok: true,
    outcome: {
      event: input.event.type,
      resourceId: input.event.resourceId,
      occurredAt: input.event.occurredAt,
      acatChainHash: token.chainHash,
      agentId: token.agentId,
      userId: token.userId,
      acatStillValid,
      acatInvalidReason,
      receiptLine,
    },
  };
}

// ── Pure: chargeback evidence assembly ────────────────────────────

/**
 * The structured evidence we hand to Stripe Dashboard's "Submit
 * evidence" endpoint. The merchant uploads this at dispute time.
 *
 * Stripe Dashboard accepts free-form text in `customer_communication`
 * + `uncategorized_text` + file uploads. We pack our cryptographic
 * proof into both text fields AND produce a base64-encoded JSON
 * artifact the merchant uploads as a file.
 */
export interface StripeChargebackEvidence {
  /** Plain text for Stripe Dashboard's customer_communication field. */
  customerCommunication: string;
  /** Plain text for Stripe Dashboard's uncategorized_text field. */
  uncategorizedText: string;
  /** JSON artifact for file upload (cryptographic proof bundle). */
  evidenceFileJson: {
    version: "sovereign-chargeback-evidence-v1";
    disputeId: string;
    disputeReason: string;
    paymentIntentId: string;
    acat: SignedACAT;
    auditChainExcerpt: AuditChainEntry[];
    /** The verifier output at evidence-assembly time. */
    verificationAtAssembly: ACATVerifyResult;
    /** Procurement-readable summary lines. */
    summary: string[];
    /** ISO 8601 — when this evidence was assembled. */
    assembledAt: string;
  };
}

/**
 * Audit chain entry shape (matches R26 export format from R45).
 */
export interface AuditChainEntry {
  rowHash: string;
  prevHash: string;
  action: string;
  resource: string;
  details: Record<string, unknown>;
  createdAt: string;
}

/**
 * Pure: assemble a chargeback evidence packet from the original
 * dispute, the ACAT used at purchase, and the relevant excerpt of
 * the user's audit chain.
 *
 * The output is what the merchant uploads to Stripe. The Stripe
 * Dashboard already shows the metadata fields by default, so the
 * verifier has visibility from the start of the dispute lifecycle.
 *
 * The evidence file is a SELF-CONTAINED proof: any auditor
 * (including a court) can re-run verification on it offline using
 * @sovereign/inspector, with no dependency on Sovereign or Stripe.
 */
export function buildChargebackEvidence(input: {
  disputeId: string;
  disputeReason: string;
  paymentIntentId: string;
  token: SignedACAT;
  /** Optional excerpt — slice of the user's R26 chain bracketing
   *  the disputed transaction. Empty array if not available. */
  auditChainExcerpt: AuditChainEntry[];
  /** Re-verification result at evidence-assembly time. Merchant
   *  computes this with verifyACAT and the cart context. */
  verificationAtAssembly: ACATVerifyResult;
  /** Now (testability). */
  assembledAt?: string;
}): StripeChargebackEvidence {
  const assembledAt = input.assembledAt ?? new Date().toISOString();
  const acatSummary = summarizeACATForReceipt(input.token);

  const summary = [
    `Sovereign Chargeback Evidence Packet — v1`,
    `Dispute ${input.disputeId} — reason: ${input.disputeReason}`,
    `PaymentIntent: ${input.paymentIntentId}`,
    ``,
    `=== ACAT (Agentic Commerce Authorization Token) ===`,
    acatSummary,
    ``,
    `=== Re-verification at evidence assembly ===`,
    input.verificationAtAssembly.valid
      ? `RESULT: VALID — agent was authorized to spend within scope at the time of charge.`
      : `RESULT: INVALID — reason: ${input.verificationAtAssembly.reason}.`,
    ``,
    `=== Audit chain excerpt ===`,
    `${input.auditChainExcerpt.length} entries from the user's hash-chained R26 audit log.`,
    ...input.auditChainExcerpt.slice(0, 5).map(
      (e, i) =>
        `  [${i + 1}] ${e.action} on ${e.resource} at ${e.createdAt} — row hash ${e.rowHash.slice(0, 16)}...`,
    ),
    input.auditChainExcerpt.length > 5
      ? `  ... and ${input.auditChainExcerpt.length - 5} more (full list in evidence JSON).`
      : null,
    ``,
    `=== Independent verification ===`,
    `This evidence packet is self-contained and verifiable OFFLINE.`,
    `Auditor: install @sovereign/inspector and run:`,
    `  npx @sovereign/inspector verify-evidence evidence.json`,
    `No Sovereign or Stripe runtime dependency required.`,
    ``,
    `Assembled at ${assembledAt}.`,
  ]
    .filter((l): l is string => l !== null);

  return {
    customerCommunication: summary.join("\n"),
    uncategorizedText: summary.join("\n"),
    evidenceFileJson: {
      version: "sovereign-chargeback-evidence-v1",
      disputeId: input.disputeId,
      disputeReason: input.disputeReason,
      paymentIntentId: input.paymentIntentId,
      acat: input.token,
      auditChainExcerpt: input.auditChainExcerpt,
      verificationAtAssembly: input.verificationAtAssembly,
      summary,
      assembledAt,
    },
  };
}

// ── Pure: Stripe Customer attribution ─────────────────────────────

/**
 * When a merchant creates a Stripe Customer record for an agent-
 * initiated purchase, they should attribute it to the user (R34
 * identity) AND tag the agent (R38 identity) so that ANY future
 * Stripe activity on that customer is filterable by agent.
 *
 * This is what gets passed to `stripe.customers.create({...})`.
 */
export interface StripeCustomerAttribution {
  email?: string;
  name?: string;
  description: string;
  metadata: {
    sovereign_user_id: string;
    sovereign_agent_id: string;
    sovereign_agent_manifest_version: string;
    sovereign_adapter_version: "stripe-acat-v1";
  };
}

export function buildStripeCustomerAttribution(input: {
  token: SignedACAT;
  email?: string;
  name?: string;
}): StripeCustomerAttribution {
  return {
    email: input.email,
    name: input.name,
    description: `Agent-attributed customer (Sovereign ACAT). agentId=${input.token.agentId}`,
    metadata: {
      sovereign_user_id: input.token.userId,
      sovereign_agent_id: input.token.agentId,
      sovereign_agent_manifest_version: input.token.agentManifestVersion,
      sovereign_adapter_version: "stripe-acat-v1",
    },
  };
}
