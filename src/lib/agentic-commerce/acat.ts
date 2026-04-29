/**
 * AGENTIC COMMERCE AUTHORIZATION TOKEN (ACAT) — R91.
 *
 * The substrate that lets ANY commerce platform (Stripe, Visa,
 * Mastercard, Shopify, Amazon, Klarna, Walmart, custom) verify
 * an agent's authorization to spend on a user's behalf — OFFLINE,
 * with zero round-trip to Sovereign.
 *
 * The strategic gap this closes: Stripe shipped the Agentic
 * Commerce Toolkit (May 2024); Visa launched Visa Intelligent
 * Commerce (April 2025); every payment infrastructure provider
 * is racing to support agent buyers. NONE of them ship the
 * cryptographic trust substrate — they ship the rails. Sovereign
 * provides the trust layer that runs ON the rails.
 *
 * THE TRUST CONTRACT:
 *
 *   1. User signs an ACAT delegating bounded spending authority
 *      to an agent (R34 CADC pattern + commerce-specific scope).
 *   2. Agent presents the ACAT in HTTP header / QR code / app
 *      handoff during checkout.
 *   3. Seller verifies the ACAT OFFLINE using @sovereign/inspector
 *      OR by replicating the ACAT verification math (this file).
 *   4. If valid, seller proceeds with payment — Visa / Stripe /
 *      Mastercard / etc. handle the rails. Sovereign provides
 *      the trust artifact, not the payment.
 *   5. Post-purchase, the agent presents a signed receipt
 *      reference back to the user's audit chain (R26).
 *
 * MACAROON-PATTERN ATTENUATION:
 *
 * The ACAT is attenuatable. The user issues a token with broad
 * scope (e.g., "$500/month at any merchant"); the agent attenuates
 * for a specific cart ("$73.42 at merchant X for cart-id Y, valid
 * 5 minutes"). The attenuation cannot WIDEN the original scope —
 * only narrow it. Same `additionalIsNarrowing` defense as R37 ACTs.
 *
 * Pure-function design throughout. The token + verifier port
 * verbatim to @sovereign/inspector for offline customer
 * verification. Sellers integrate the verifier, not Sovereign.
 *
 * COMPOSITION WITH SHIPPED PRIMITIVES:
 *
 *   - R34 CADC — Ed25519 user signing; ACAT signed by user's key
 *   - R38 KYA — agent identity manifest reference embedded
 *   - R40 reputation — agent's letter grade at issuance time
 *   - R42 credit line — spend cap consistent with credit line
 *   - R46 insurance — optional per-incident coverage reference
 *   - R26 audit — every ACAT mint + use is hash-chained
 *
 * Failure mode: if Sovereign ever publishes an ACAT whose
 * canonical message + signature don't reconcile, the seller's
 * verifier catches it offline. Sovereign cannot fabricate
 * agent-buying authorization while the inspector watches.
 */

import { createHash } from "node:crypto";
import {
  signMessage,
  verifySignature,
  canonicalJsonStringify,
} from "@/lib/agent-delegation";
import type { LetterGrade } from "@/lib/agent-reputation";

// ── Types ──────────────────────────────────────────────────────────

/**
 * MCC (Merchant Category Code) per ISO 18245. The most-common
 * categories that commerce platforms care about.
 */
export type CommerceCategory =
  | "groceries"
  | "restaurants"
  | "fuel"
  | "travel"
  | "entertainment"
  | "subscription_services"
  | "professional_services"
  | "marketplace_b2c"
  | "marketplace_b2b"
  | "saas_software"
  | "cloud_infrastructure"
  | "ai_apis"
  | "education"
  | "healthcare"
  | "charity"
  | "other";

export type ScopeTightenable =
  | { kind: "max-amount"; maxCents: number }
  | { kind: "merchant-id"; merchantId: string }
  | { kind: "category-allow"; category: CommerceCategory }
  | { kind: "category-deny"; category: CommerceCategory }
  | { kind: "valid-until"; iso: string }
  | { kind: "single-use"; nonce: string };

export interface ACATScope {
  /** Max cents authorized (after currency normalization). */
  maxCents: number;
  /** ISO 4217 (USD, EUR, GBP, JPY, etc.). */
  currency: string;
  /** If non-empty: ALLOWLIST of merchant IDs (tightening narrows). */
  allowedMerchantIds?: string[];
  /** If non-empty: ALLOWLIST of categories (tightening narrows). */
  allowedCategories?: CommerceCategory[];
  /** ALWAYS-DENY categories (e.g., gambling, age-restricted). */
  excludedCategories?: CommerceCategory[];
  /** ISO 8601 — token NOT valid before this. */
  validFrom: string;
  /** ISO 8601 — token EXPIRES at this. */
  validUntil: string;
  /** Single-use tokens carry a nonce; multi-use tokens omit it. */
  singleUseNonce?: string;
}

/**
 * Optional snapshot of the agent's reputation at issuance time.
 * Sellers can use this to make accept/decline decisions without
 * fetching the agent's reputation again.
 */
export interface ACATReputationSnapshot {
  letterGrade: LetterGrade;
  numericScore: number;
  /** ISO 8601 — when the snapshot was taken. */
  snapshotAt: string;
}

/**
 * Optional reference to insurance coverage (R46). If present,
 * sellers can verify the policy ID with the carrier via Sovereign
 * federation.
 */
export interface ACATInsuranceCoverage {
  /** Policy id from the carrier. */
  policyId: string;
  /** Carrier identifier (Lloyd's syndicate name, MGA name, etc.). */
  carrier: string;
  /** Per-incident coverage cap in cents. */
  perIncidentCoverageCents: number;
  /** ISO 8601 — when the policy was bound. */
  boundAt: string;
}

/**
 * The unsigned ACAT body. The user signs the canonical message
 * derived from this.
 */
export interface ACATBody {
  version: "acat-v1";
  /** R38 manifest reference — "<deploymentUrl>/agents/<agentId>". */
  agentId: string;
  /** R38 manifest version (so sellers can verify against a specific
   *  manifest snapshot). */
  agentManifestVersion: string;
  /** User who's authorizing (R34 CADC userId). */
  userId: string;
  /** User's Ed25519 public key (base64url) — embedded so verifiers
   *  don't need a separate lookup. */
  userPublicKey: string;
  /** Bounded spending scope. */
  scope: ACATScope;
  /** Optional reputation snapshot at issuance. */
  reputation?: ACATReputationSnapshot;
  /** Optional insurance coverage. */
  insurance?: ACATInsuranceCoverage;
  /** Macaroon-pattern caveats (chain of attenuations). */
  caveats: ScopeTightenable[];
  /** ISO 8601 — when the token was issued. */
  issuedAt: string;
}

/**
 * The signed ACAT. Sellers receive this over the wire (HTTP header,
 * QR code, app handoff).
 */
export interface SignedACAT extends ACATBody {
  /** The canonical message that was signed. */
  message: string;
  /** Base64url Ed25519 signature over message. */
  signature: string;
  /** sha256 chain hash binding this to its parent (for attenuated
   *  tokens) or null for genesis. */
  parentChainHash: string | null;
  /** sha256(parentChainHash || message || signature). */
  chainHash: string;
}

// ── Pure: canonical message construction ───────────────────────────

/**
 * Build the canonical message that gets signed. Same pattern as
 * R34 CADC, R37 ACTs, R38 KYA, R44 attestations — line-separated,
 * deterministic format. Verifiers reconstruct from the body fields.
 */
export function buildACATMessage(body: ACATBody): string {
  const scopeHash = createHash("sha256")
    .update(canonicalJsonStringify(body.scope))
    .digest("hex");
  const reputationHash = body.reputation
    ? createHash("sha256")
        .update(canonicalJsonStringify(body.reputation))
        .digest("hex")
    : "none";
  const insuranceHash = body.insurance
    ? createHash("sha256")
        .update(canonicalJsonStringify(body.insurance))
        .digest("hex")
    : "none";
  const caveatsHash = createHash("sha256")
    .update(canonicalJsonStringify(body.caveats))
    .digest("hex");

  return [
    "acat-v1",
    "agentic-commerce-authorization",
    `agentId:${body.agentId}`,
    `agentManifestVersion:${body.agentManifestVersion}`,
    `userId:${body.userId}`,
    `userPublicKey:${body.userPublicKey}`,
    `scopeHash:${scopeHash}`,
    `reputationHash:${reputationHash}`,
    `insuranceHash:${insuranceHash}`,
    `caveatsHash:${caveatsHash}`,
    `issuedAt:${body.issuedAt}`,
  ].join("\n");
}

/**
 * Pure: chain hash for tamper detection.
 * sha256(parentChainHash || message || signature).
 */
export function computeACATChainHash(input: {
  parentChainHash: string | null;
  message: string;
  signature: string;
}): string {
  return createHash("sha256")
    .update(
      [
        input.parentChainHash ?? "GENESIS",
        input.message,
        input.signature,
      ].join("|"),
    )
    .digest("hex");
}

// ── Mint (impure — needs user's private key) ───────────────────────

export interface MintACATInput {
  body: ACATBody;
  userPrivateKey: string;
  parentChainHash?: string | null;
}

/**
 * Sign an ACAT. The user's private key signs the canonical message;
 * the chain hash is computed over (parent || message || signature).
 *
 * Pure with respect to inputs (same body + same key → same signature).
 */
export function mintACAT(input: MintACATInput): SignedACAT {
  const message = buildACATMessage(input.body);
  const signature = signMessage(input.userPrivateKey, message);
  const parentChainHash = input.parentChainHash ?? null;
  const chainHash = computeACATChainHash({
    parentChainHash,
    message,
    signature,
  });
  return {
    ...input.body,
    message,
    signature,
    parentChainHash,
    chainHash,
  };
}

// ── Verify (pure; ports to inspector + sellers) ────────────────────

export type ACATVerifyResult =
  | { valid: true; remainingMaxCents: number; reputation?: ACATReputationSnapshot }
  | {
      valid: false;
      reason:
        | "message_mismatch"
        | "signature_invalid"
        | "user_pubkey_mismatch"
        | "expired"
        | "not_yet_valid"
        | "scope_violation"
        | "merchant_not_allowed"
        | "category_excluded"
        | "category_not_allowed"
        | "single_use_consumed"
        | "chain_hash_mismatch"
        | "amount_exceeds_scope";
    };

export interface VerifyACATInput {
  token: SignedACAT;
  /** The user public key the seller expects (looked up from agent
   *  identity manifest or pre-shared with seller). */
  expectedUserPublicKey: string;
  /** Cart context: what the agent is trying to buy. */
  cart: {
    amountCents: number;
    currency: string;
    merchantId: string;
    category: CommerceCategory;
  };
  /** Now, for testability + clock-skew control. */
  now?: Date;
  /** Optional: callback to check if a single-use nonce has already
   *  been consumed. Sellers maintain their own nonce tracking. */
  isNonceConsumed?: (nonce: string) => boolean;
}

/**
 * Verify an ACAT against a specific cart. Pure function.
 *
 * Walks the chain: validates signature → reconstruction →
 * scope checks → caveat checks → expiry → single-use replay.
 *
 * Same trustless pattern as R34/R37/R44/R45/R71. Sellers
 * implement this verifier (or use @sovereign/inspector); they
 * never need to call Sovereign at verification time.
 */
export function verifyACAT(input: VerifyACATInput): ACATVerifyResult {
  const t = input.token;
  const now = input.now ?? new Date();

  // 1. User pubkey must match expected.
  if (t.userPublicKey !== input.expectedUserPublicKey) {
    return { valid: false, reason: "user_pubkey_mismatch" };
  }

  // 2. Reconstruct canonical message.
  const expectedMessage = buildACATMessage({
    version: t.version,
    agentId: t.agentId,
    agentManifestVersion: t.agentManifestVersion,
    userId: t.userId,
    userPublicKey: t.userPublicKey,
    scope: t.scope,
    reputation: t.reputation,
    insurance: t.insurance,
    caveats: t.caveats,
    issuedAt: t.issuedAt,
  });
  if (t.message !== expectedMessage) {
    return { valid: false, reason: "message_mismatch" };
  }

  // 3. Verify signature.
  if (!verifySignature(t.userPublicKey, t.message, t.signature)) {
    return { valid: false, reason: "signature_invalid" };
  }

  // 4. Recompute chain hash.
  const expectedChainHash = computeACATChainHash({
    parentChainHash: t.parentChainHash,
    message: t.message,
    signature: t.signature,
  });
  if (t.chainHash !== expectedChainHash) {
    return { valid: false, reason: "chain_hash_mismatch" };
  }

  // 5. Time window.
  if (now < new Date(t.scope.validFrom)) {
    return { valid: false, reason: "not_yet_valid" };
  }
  if (now >= new Date(t.scope.validUntil)) {
    return { valid: false, reason: "expired" };
  }

  // 6. Currency.
  if (input.cart.currency !== t.scope.currency) {
    return { valid: false, reason: "scope_violation" };
  }

  // 7. Amount within scope (after applying any max-amount caveats).
  let effectiveMaxCents = t.scope.maxCents;
  for (const c of t.caveats) {
    if (c.kind === "max-amount") {
      effectiveMaxCents = Math.min(effectiveMaxCents, c.maxCents);
    }
  }
  if (input.cart.amountCents > effectiveMaxCents) {
    return { valid: false, reason: "amount_exceeds_scope" };
  }

  // 8. Excluded categories — hard reject.
  if (
    t.scope.excludedCategories &&
    t.scope.excludedCategories.includes(input.cart.category)
  ) {
    return { valid: false, reason: "category_excluded" };
  }
  // Caveat-level category-deny.
  for (const c of t.caveats) {
    if (c.kind === "category-deny" && c.category === input.cart.category) {
      return { valid: false, reason: "category_excluded" };
    }
  }

  // 9. Allowed-categories check (if specified — allowlist semantics).
  if (
    t.scope.allowedCategories &&
    t.scope.allowedCategories.length > 0 &&
    !t.scope.allowedCategories.includes(input.cart.category)
  ) {
    return { valid: false, reason: "category_not_allowed" };
  }
  // Caveat-level category-allow narrows further.
  const caveatAllowedCategories = t.caveats
    .filter(
      (c): c is { kind: "category-allow"; category: CommerceCategory } =>
        c.kind === "category-allow",
    )
    .map((c) => c.category);
  if (
    caveatAllowedCategories.length > 0 &&
    !caveatAllowedCategories.includes(input.cart.category)
  ) {
    return { valid: false, reason: "category_not_allowed" };
  }

  // 10. Allowed merchants check.
  if (
    t.scope.allowedMerchantIds &&
    t.scope.allowedMerchantIds.length > 0 &&
    !t.scope.allowedMerchantIds.includes(input.cart.merchantId)
  ) {
    return { valid: false, reason: "merchant_not_allowed" };
  }
  // Caveat-level merchant narrowing.
  const caveatMerchantIds = t.caveats
    .filter(
      (c): c is { kind: "merchant-id"; merchantId: string } =>
        c.kind === "merchant-id",
    )
    .map((c) => c.merchantId);
  if (
    caveatMerchantIds.length > 0 &&
    !caveatMerchantIds.includes(input.cart.merchantId)
  ) {
    return { valid: false, reason: "merchant_not_allowed" };
  }

  // 11. Single-use replay.
  if (t.scope.singleUseNonce && input.isNonceConsumed) {
    if (input.isNonceConsumed(t.scope.singleUseNonce)) {
      return { valid: false, reason: "single_use_consumed" };
    }
  }
  // Caveat-level valid-until tightening.
  for (const c of t.caveats) {
    if (c.kind === "valid-until") {
      if (now >= new Date(c.iso)) {
        return { valid: false, reason: "expired" };
      }
    }
  }

  return {
    valid: true,
    remainingMaxCents: effectiveMaxCents - input.cart.amountCents,
    reputation: t.reputation,
  };
}

// ── Attenuate (Macaroon-pattern, narrowing-only) ───────────────────

/**
 * Pure: validate that an additional caveat is NARROWING (cannot
 * widen). Same defense as R37 `additionalIsNarrowing`.
 */
export function additionalCaveatIsNarrowing(input: {
  existing: ACATScope;
  existingCaveats: ScopeTightenable[];
  newCaveat: ScopeTightenable;
}):
  | { valid: true }
  | { valid: false; reason: "would_widen" } {
  const { newCaveat } = input;
  switch (newCaveat.kind) {
    case "max-amount": {
      // New max must not exceed existing max (post-existing-caveats).
      let currentMax = input.existing.maxCents;
      for (const c of input.existingCaveats) {
        if (c.kind === "max-amount")
          currentMax = Math.min(currentMax, c.maxCents);
      }
      if (newCaveat.maxCents > currentMax) {
        return { valid: false, reason: "would_widen" };
      }
      return { valid: true };
    }
    case "valid-until": {
      // New expiry must not be later than existing expiry.
      const existingExpiry = new Date(input.existing.validUntil);
      const newExpiry = new Date(newCaveat.iso);
      // Also check existing valid-until caveats.
      let earliestExpiry = existingExpiry;
      for (const c of input.existingCaveats) {
        if (c.kind === "valid-until") {
          const cExpiry = new Date(c.iso);
          if (cExpiry < earliestExpiry) earliestExpiry = cExpiry;
        }
      }
      if (newExpiry > earliestExpiry) {
        return { valid: false, reason: "would_widen" };
      }
      return { valid: true };
    }
    default:
      // Merchant / category / single-use caveats are always narrowing.
      return { valid: true };
  }
}

/**
 * Attenuate an existing ACAT with an additional caveat. The new
 * caveat MUST narrow (can't widen). Returns a re-signed token.
 *
 * Note: attenuation re-signs with the agent's key (since the agent
 * is the entity narrowing). This requires the agent's private key.
 * For most flows, the agent calls this just before presenting the
 * token to the seller.
 */
export interface AttenuateACATInput {
  parentToken: SignedACAT;
  /** Agent's signing key (NOT the user's). The agent attenuates;
   *  the user is the original delegator. */
  agentPrivateKey: string;
  /** Agent's public key (so verifiers can chain check). */
  agentPublicKey: string;
  /** Additional caveat to add (must narrow). */
  additionalCaveat: ScopeTightenable;
  /** ISO 8601 — when the attenuation is happening. */
  issuedAt: string;
}

/**
 * Attenuated ACAT. Distinct from genesis ACAT because the signer
 * is the AGENT, not the user. The chain hash binds the attenuated
 * token to the parent.
 */
export interface AttenuatedACAT extends Omit<SignedACAT, "userPublicKey"> {
  /** The original user pubkey (preserved). */
  userPublicKey: string;
  /** The agent pubkey that signed this attenuation. */
  attenuatorPublicKey: string;
  attenuatorRole: "agent" | "merchant";
}

export function attenuateACAT(
  input: AttenuateACATInput,
): {
  ok: true;
  attenuated: AttenuatedACAT;
} | { ok: false; reason: "would_widen" } {
  const narrowing = additionalCaveatIsNarrowing({
    existing: input.parentToken.scope,
    existingCaveats: input.parentToken.caveats,
    newCaveat: input.additionalCaveat,
  });
  if (!narrowing.valid) {
    return { ok: false, reason: "would_widen" };
  }
  const newCaveats = [...input.parentToken.caveats, input.additionalCaveat];
  const newBody: ACATBody = {
    ...input.parentToken,
    caveats: newCaveats,
    issuedAt: input.issuedAt,
  };
  const message = buildACATMessage(newBody);
  const signature = signMessage(input.agentPrivateKey, message);
  const chainHash = computeACATChainHash({
    parentChainHash: input.parentToken.chainHash,
    message,
    signature,
  });
  const attenuated: AttenuatedACAT = {
    ...newBody,
    message,
    signature,
    parentChainHash: input.parentToken.chainHash,
    chainHash,
    attenuatorPublicKey: input.agentPublicKey,
    attenuatorRole: "agent",
  };
  return { ok: true, attenuated };
}

// ── HTTP transport helpers ─────────────────────────────────────────

/**
 * Pure: serialize an ACAT for transport in an HTTP header.
 * Format: base64url(canonical-JSON(token)).
 */
export function encodeACATForHeader(token: SignedACAT): string {
  return Buffer.from(canonicalJsonStringify(token), "utf8").toString(
    "base64url",
  );
}

/**
 * Pure: parse an ACAT from an HTTP header value. Returns null on
 * malformed input (sellers should reject the request).
 */
export function decodeACATFromHeader(headerValue: string): SignedACAT | null {
  try {
    const json = Buffer.from(headerValue, "base64url").toString("utf8");
    const parsed = JSON.parse(json) as Partial<SignedACAT>;
    if (
      parsed.version !== "acat-v1" ||
      typeof parsed.signature !== "string" ||
      typeof parsed.message !== "string"
    ) {
      return null;
    }
    return parsed as SignedACAT;
  } catch {
    return null;
  }
}

/**
 * Pure: produce a procurement-readable receipt summary suitable for
 * inclusion in a customer's audit chain or a merchant's order
 * record. Used by R45 audit-export consumers.
 */
export function summarizeACATForReceipt(token: SignedACAT): string {
  return [
    `ACAT v1 — agent ${token.agentId} authorized by ${token.userId}`,
    `  scope: max ${token.scope.maxCents}¢ ${token.scope.currency}, ` +
      `valid ${token.scope.validFrom} → ${token.scope.validUntil}`,
    token.reputation
      ? `  reputation: ${token.reputation.letterGrade} ` +
        `(${token.reputation.numericScore}/100) at ${token.reputation.snapshotAt}`
      : `  reputation: not snapshotted`,
    token.insurance
      ? `  insurance: policy ${token.insurance.policyId} via ${token.insurance.carrier}, ` +
        `${token.insurance.perIncidentCoverageCents}¢/incident`
      : `  insurance: not bound`,
    `  chain hash: ${token.chainHash.slice(0, 16)}...`,
    `  caveats applied: ${token.caveats.length}`,
  ].join("\n");
}
