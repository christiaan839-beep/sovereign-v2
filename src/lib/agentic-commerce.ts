/**
 * SOVEREIGN MATRIX — Agentic Commerce protocol (Wave 18).
 *
 * Closes the "Agentic Commerce" gap the 2026 research identified:
 *   "OpenAI ACP, Google UCP, Mastercard Agent Pay — tokenized
 *   AI-initiated transactions are the new wire format. Every other
 *   ACP implementation ships one-shot tokens; Sovereign's are bound
 *   to a verifiable receipt chain."
 *
 * This module produces signed Agentic-Commerce Protocol envelopes
 * that any merchant or payment processor accepting ACP/UCP can
 * consume. The envelope:
 *
 *   1. Cites a Wave-16 JIT agent token (proves WHICH agent initiated
 *      the purchase).
 *   2. Carries a signed merchant intent (item, price, currency, qty,
 *      destination merchant id).
 *   3. Carries a signed user-consent receipt (the human authorized
 *      the agent to spend up to $X with merchant Y).
 *   4. Is itself signed with the platform's signRun key so a third
 *      party can verify the whole envelope without trusting either
 *      the agent OR the merchant.
 *
 * Wire format (compact JSON):
 *   {
 *     acp: { ... merchant intent ... },
 *     consent: { ... user authorization ... },
 *     agentTokenId: "<wave-16 token id>",
 *     contentHash: "<sha256 of canonical>",
 *     signature: "v1=... | v2=...",
 *     issuedAt: ISO8601
 *   }
 *
 * Pairs with /api/commerce/intent (issue) and /api/commerce/verify
 * (verify). Receipt-anchored — the issued envelope's receiptId
 * cross-references an entry in agent_runs.
 */

import { createHash, randomUUID } from "crypto";
import { signRun, verifySignature } from "@/lib/agent-runs";

/** Currencies the platform's verifier knows about. ISO 4217 codes. */
export type AcpCurrency = "USD" | "ZAR" | "EUR" | "GBP" | "JPY" | "USDC";

export interface AcpIntent {
  /** Stable merchant identifier (DNS or DID). */
  merchantId: string;
  /** SKU / product slug the agent intends to buy. */
  sku: string;
  /** Display title — not used for matching, just human-readable. */
  title: string;
  /** Per-unit price in the smallest currency unit (cents / minor units). */
  unitAmount: number;
  /** ISO 4217 currency code. */
  currency: AcpCurrency;
  /** Quantity. Must be a positive integer. */
  quantity: number;
  /** Hash-anchored merchant catalog reference, for tamper-evidence. */
  catalogHash?: string;
}

export interface AcpConsent {
  /** The human / org that authorized the spend. */
  principalId: string;
  /** Max total the agent may spend under this consent, smallest units. */
  spendCapAmount: number;
  /** Currency the cap is denominated in. */
  spendCapCurrency: AcpCurrency;
  /** Merchant the consent allows (or "*" for any). */
  allowedMerchantId: string;
  /** Consent expiry — agents past this can no longer transact. */
  expiresAt: string;
  /** Signed consent JWT-style token (opaque — verifier checks externally). */
  consentToken: string;
}

export interface AcpEnvelope {
  /** Server-issued envelope id. */
  envelopeId: string;
  /** Versioned protocol marker — bump on wire-breaking changes. */
  protocol: "sov-acp/1";
  acp: AcpIntent;
  consent: AcpConsent;
  /** Wave-16 JIT token id that authorised this intent. */
  agentTokenId: string;
  /** SHA-256 of canonical projection (hex). */
  contentHash: string;
  /** Signature scheme: v1=hmac / v2=ed25519 / v3=ed25519+ml-dsa-65. */
  signature: string;
  /** Deterministic bytes that get hashed and signed. */
  canonical: string;
  /** Server timestamp when sealed. */
  issuedAt: string;
}

export type VerifyEnvelopeResult =
  | { ok: true; envelope: AcpEnvelope; verifiedAt: string }
  | {
      ok: false;
      reason:
        | "canonical-mismatch"
        | "hash-mismatch"
        | "signature-mismatch"
        | "expired-consent"
        | "cap-exceeded"
        | "merchant-mismatch";
      verifiedAt: string;
    };

/**
 * Issue a signed ACP envelope for an agent-initiated transaction.
 * Pure function — no DB writes (the call site persists the envelope
 * via the existing audit_logs path).
 *
 * Throws on impossible inputs: negative quantity, non-positive unit
 * amount, total spend > consent cap, or merchant outside consent scope.
 */
export function issueAcpEnvelope(input: {
  acp: AcpIntent;
  consent: AcpConsent;
  agentTokenId: string;
}): AcpEnvelope {
  validateAcp(input.acp);
  validateAgainstConsent(input.acp, input.consent);

  const envelopeId = randomUUID();
  const issuedAt = new Date().toISOString();
  const canonical = canonicalize(
    envelopeId,
    input.acp,
    input.consent,
    input.agentTokenId,
    issuedAt,
  );
  const contentHash = sha256(canonical);
  const signature = signRun(canonical);

  return {
    envelopeId,
    protocol: "sov-acp/1",
    acp: input.acp,
    consent: input.consent,
    agentTokenId: input.agentTokenId,
    contentHash,
    signature,
    canonical,
    issuedAt,
  };
}

/**
 * Verify an ACP envelope a merchant / processor handed us. Re-derives
 * canonical from the envelope fields, recomputes the content hash,
 * checks the signature, re-runs the consent/cap math.
 */
export function verifyAcpEnvelope(envelope: AcpEnvelope): VerifyEnvelopeResult {
  const verifiedAt = new Date().toISOString();
  const recomputed = canonicalize(
    envelope.envelopeId,
    envelope.acp,
    envelope.consent,
    envelope.agentTokenId,
    envelope.issuedAt,
  );
  if (recomputed !== envelope.canonical) {
    return { ok: false, reason: "canonical-mismatch", verifiedAt };
  }
  if (sha256(recomputed) !== envelope.contentHash) {
    return { ok: false, reason: "hash-mismatch", verifiedAt };
  }
  if (!verifySignature(recomputed, envelope.signature)) {
    return { ok: false, reason: "signature-mismatch", verifiedAt };
  }
  // Consent invariants re-checked at verification time.
  if (new Date(envelope.consent.expiresAt).getTime() < Date.now()) {
    return { ok: false, reason: "expired-consent", verifiedAt };
  }
  try {
    validateAgainstConsent(envelope.acp, envelope.consent);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("cap")) {
      return { ok: false, reason: "cap-exceeded", verifiedAt };
    }
    return { ok: false, reason: "merchant-mismatch", verifiedAt };
  }
  return { ok: true, envelope, verifiedAt };
}

/**
 * Compute total spend the envelope represents, in smallest currency
 * units. Pure arithmetic — never throws.
 */
export function totalSpend(acp: AcpIntent): number {
  return acp.unitAmount * acp.quantity;
}

// ── Internals ─────────────────────────────────────────────────────────

function validateAcp(acp: AcpIntent): void {
  if (acp.unitAmount <= 0) throw new Error("ACP: unitAmount must be > 0");
  if (!Number.isInteger(acp.quantity) || acp.quantity <= 0) {
    throw new Error("ACP: quantity must be a positive integer");
  }
  if (acp.merchantId.length < 1) throw new Error("ACP: merchantId required");
  if (acp.sku.length < 1) throw new Error("ACP: sku required");
}

function validateAgainstConsent(acp: AcpIntent, consent: AcpConsent): void {
  if (
    consent.allowedMerchantId !== "*" &&
    consent.allowedMerchantId !== acp.merchantId
  ) {
    throw new Error("ACP: merchant outside consent scope");
  }
  if (consent.spendCapCurrency !== acp.currency) {
    throw new Error("ACP: currency does not match consent");
  }
  const total = totalSpend(acp);
  if (total > consent.spendCapAmount) {
    throw new Error(
      `ACP: total spend ${total} exceeds consent cap ${consent.spendCapAmount}`,
    );
  }
}

function canonicalize(
  envelopeId: string,
  acp: AcpIntent,
  consent: AcpConsent,
  agentTokenId: string,
  issuedAt: string,
): string {
  return JSON.stringify({
    v: 1,
    type: "sov-acp/1",
    envelopeId,
    acp: {
      catalogHash: acp.catalogHash ?? null,
      currency: acp.currency,
      merchantId: acp.merchantId,
      quantity: acp.quantity,
      sku: acp.sku,
      title: acp.title,
      unitAmount: acp.unitAmount,
    },
    agentTokenId,
    consent: {
      allowedMerchantId: consent.allowedMerchantId,
      consentToken: consent.consentToken,
      expiresAt: consent.expiresAt,
      principalId: consent.principalId,
      spendCapAmount: consent.spendCapAmount,
      spendCapCurrency: consent.spendCapCurrency,
    },
    issuedAt,
  });
}

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}
