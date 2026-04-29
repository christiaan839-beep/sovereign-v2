/**
 * AGENT CAPABILITY TOKENS (ACTs)
 *
 * Round 37 — the next-generation primitive on top of R34 CADC.
 * Macaroon-pattern attenuatable capability tokens for AI agents.
 *
 * See docs/adr/0005-agent-capability-tokens.md for full design.
 *
 * THE TRUST CHAIN:
 *
 *   user (R34 user_signing_keys.public_key)
 *     ↓ mints root token via mintToken()
 *   ACT v0 — { caveats: { max_cents: 5000 } }
 *     ↓ agent A attenuates via attenuateToken()
 *   ACT v1 — { caveats: { max_cents: 5000, allowed_merchants: ['Airline'] } }
 *     ↓ agent B attenuates further
 *   ACT v2 — { ..., max_cents: 300, expires_at: '...' }
 *     ↓ verifier validates ENTIRE chain via verifyTokenChain()
 *   ✓ Authorized for THIS specific transaction
 *
 * PURE-FUNCTION CORE: every function in this file is pure given the
 * keys + inputs. No DB, no I/O, no clock unless explicit. The same
 * code is ported to @sovereign/inspector for offline verification —
 * customers can verify tokens locally without contacting Sovereign.
 *
 * SECURITY MODEL:
 *   1. Each token signed by its issuer's Ed25519 key
 *   2. Attenuation creates a child token signed by the PARENT's
 *      subject key (the holder becomes the new issuer)
 *   3. Chain hash links parent → child for tamper detection
 *   4. Caveats can ONLY be NARROWED in attenuation (verifier enforces)
 *   5. Revocation requires the ROOT issuer's signature — sub-agents
 *      cannot forge revocations
 *
 * COMPOSE WITH:
 *   - R26 audit chain: every mint/attenuate gets an audit row
 *   - R30 spend cards: spend authorizations BECOME a special-case ACT
 *   - R33 multi-stage HITL: high-stakes mints route through HITL
 *   - R34 CADC: root token signed by user's CADC key
 *   - R36 federation: ACTs cross instance boundaries
 */

import { createHash } from "node:crypto";
import {
  signMessage,
  verifySignature,
  canonicalJsonStringify,
} from "@/lib/agent-delegation";

// ── Types ──────────────────────────────────────────────────────────

export interface Caveats {
  /** Maximum total spend in cents. Lower-or-equal in attenuation. */
  max_cents?: number;
  /** ISO 8601 expiry. Earlier-or-equal in attenuation. */
  expires_at?: string;
  /** Merchant allowlist. Subset-or-equal in attenuation. */
  allowed_merchants?: string[];
  /** Action allowlist. Subset-or-equal in attenuation. */
  allowed_actions?: string[];
  /** Merchant category allowlist. Subset-or-equal in attenuation. */
  merchant_categories?: string[];
  /** Custom caveats — opaque to the verifier; checked by the consumer. */
  [key: string]: unknown;
}

export interface ActToken {
  /** Root token = "GENESIS"; attenuated tokens carry parent's chain hash. */
  parentChainHash: string | null;
  issuerPublicKey: string;
  subjectPublicKey: string;
  caveats: Caveats;
  /** ISO 8601. */
  issuedAt: string;
  /** ISO 8601. Always <= parent's expires_at if attenuating. */
  expiresAt: string;
  /** The exact canonical message that was signed. */
  tokenMessage: string;
  /** Base64URL Ed25519 signature over tokenMessage by issuer. */
  signature: string;
  /** sha256(parentChainHash || tokenMessage || signature). */
  chainHash: string;
}

/**
 * The proposed action being authorized. The verifier evaluates each
 * caveat against this action; ALL must pass.
 */
export interface ActAction {
  /** What's being done? "purchase", "send", "execute", etc. */
  action: string;
  /** Cost of this action in cents. Verified against max_cents. */
  costCents?: number;
  /** Merchant identifier. Verified against allowed_merchants. */
  merchantName?: string;
  /** Merchant category. Verified against merchant_categories. */
  merchantCategory?: string;
}

// ── Token message construction ─────────────────────────────────────

/**
 * Build the canonical message string that gets signed. Format
 * (line-separated, deterministic):
 *
 *   v1
 *   parent:{parentChainHash | "GENESIS"}
 *   issuer:{issuerPublicKey}
 *   subject:{subjectPublicKey}
 *   caveats:{sha256-hex of canonical-JSON caveats}
 *   issued:{ISO}
 *   expires:{ISO}
 *
 * Canonical JSON ensures key-order-independent caveat hashing.
 */
export function buildTokenMessage(input: {
  parentChainHash: string | null;
  issuerPublicKey: string;
  subjectPublicKey: string;
  caveats: Caveats;
  issuedAt: string;
  expiresAt: string;
}): string {
  const caveatsHash = createHash("sha256")
    .update(canonicalJsonStringify(input.caveats))
    .digest("hex");
  return [
    "v1",
    `parent:${input.parentChainHash ?? "GENESIS"}`,
    `issuer:${input.issuerPublicKey}`,
    `subject:${input.subjectPublicKey}`,
    `caveats:${caveatsHash}`,
    `issued:${input.issuedAt}`,
    `expires:${input.expiresAt}`,
  ].join("\n");
}

/**
 * Compute the chain hash for an ACT row.
 * sha256(parentChainHash || tokenMessage || signature)
 */
export function computeTokenChainHash(input: {
  parentChainHash: string | null;
  tokenMessage: string;
  signature: string;
}): string {
  return createHash("sha256")
    .update(
      [
        input.parentChainHash ?? "GENESIS",
        input.tokenMessage,
        input.signature,
      ].join("|"),
    )
    .digest("hex");
}

// ── Mint a root token ──────────────────────────────────────────────

/**
 * Mint a root capability token. The user signs with their CADC
 * (R34) Ed25519 private key.
 *
 * Pure-function: just compose message, sign, hash.
 */
export function mintToken(input: {
  issuerPrivateKey: string;
  issuerPublicKey: string;
  subjectPublicKey: string;
  caveats: Caveats;
  issuedAt: string;
  expiresAt: string;
}): ActToken {
  const tokenMessage = buildTokenMessage({
    parentChainHash: null,
    issuerPublicKey: input.issuerPublicKey,
    subjectPublicKey: input.subjectPublicKey,
    caveats: input.caveats,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
  });
  const signature = signMessage(input.issuerPrivateKey, tokenMessage);
  const chainHash = computeTokenChainHash({
    parentChainHash: null,
    tokenMessage,
    signature,
  });
  return {
    parentChainHash: null,
    issuerPublicKey: input.issuerPublicKey,
    subjectPublicKey: input.subjectPublicKey,
    caveats: input.caveats,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    tokenMessage,
    signature,
    chainHash,
  };
}

// ── Attenuate (the killer feature) ─────────────────────────────────

/**
 * Attenuate a parent token to produce a more-restricted child token.
 *
 * The CALLER (current holder) signs with their private key — they
 * are the parent's `subjectPublicKey`, which becomes the child's
 * `issuerPublicKey`. The new token's caveats MUST be a strict
 * narrowing of the parent's (`narrowsCaveats` enforces this).
 *
 * Returns null + reason if attenuation rules are violated.
 */
export function attenuateToken(input: {
  parent: ActToken;
  /** Private key of the parent's subject (the current holder). */
  attenuatorPrivateKey: string;
  /** New holder. Could be a sub-agent or a merchant endpoint. */
  newSubjectPublicKey: string;
  /** Additional caveats to apply. MUST narrow the parent's caveats. */
  additionalCaveats: Caveats;
  issuedAt: string;
  /** New expiry. Must be <= parent.expiresAt. */
  expiresAt: string;
}): ActToken | { error: string } {
  // EXPLICIT narrowing check: caller-supplied caveats CANNOT widen
  // the parent's. Silent narrowing (just clamping to min) would hide
  // bugs; we reject explicitly so the caller learns their request
  // was wrong rather than getting a silently-clamped token.
  const additionalCheck = additionalIsNarrowing(
    input.parent.caveats,
    input.additionalCaveats,
  );
  if (!additionalCheck.ok) {
    return { error: `attenuation_widened_caveats:${additionalCheck.reason}` };
  }

  // Build effective caveats: parent's caveats narrowed by additional.
  const effectiveCaveats = mergeCaveats(input.parent.caveats, input.additionalCaveats);

  // Expiry must not exceed parent's.
  if (new Date(input.expiresAt) > new Date(input.parent.expiresAt)) {
    return { error: "attenuation_expiry_extended" };
  }

  // The attenuator's public key must be the parent's subject — i.e.
  // only the parent's holder can attenuate. We don't verify the
  // private key directly (we don't know the public from the private
  // alone in Ed25519 without re-derivation), but the SIGNATURE
  // produced will only verify if the caller's private key matches
  // the parent's subject_public_key. That's the cryptographic
  // enforcement.

  const tokenMessage = buildTokenMessage({
    parentChainHash: input.parent.chainHash,
    issuerPublicKey: input.parent.subjectPublicKey,
    subjectPublicKey: input.newSubjectPublicKey,
    caveats: effectiveCaveats,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
  });
  const signature = signMessage(input.attenuatorPrivateKey, tokenMessage);
  const chainHash = computeTokenChainHash({
    parentChainHash: input.parent.chainHash,
    tokenMessage,
    signature,
  });

  return {
    parentChainHash: input.parent.chainHash,
    issuerPublicKey: input.parent.subjectPublicKey,
    subjectPublicKey: input.newSubjectPublicKey,
    caveats: effectiveCaveats,
    issuedAt: input.issuedAt,
    expiresAt: input.expiresAt,
    tokenMessage,
    signature,
    chainHash,
  };
}

// ── Caveat merging + narrowing ─────────────────────────────────────

/**
 * Merge parent caveats with additional caveats, taking the
 * MORE RESTRICTIVE of each. This is the core of attenuation.
 *
 *   max_cents:       min(parent, additional)
 *   expires_at:      min(parent, additional)
 *   allowed_*:       intersection (subset)
 *   merchant_*:      intersection (subset)
 *   custom keys:     additional overrides parent (caller's responsibility)
 *
 * Pure function.
 */
export function mergeCaveats(parent: Caveats, additional: Caveats): Caveats {
  const out: Caveats = { ...parent, ...additional };

  if (parent.max_cents !== undefined && additional.max_cents !== undefined) {
    out.max_cents = Math.min(parent.max_cents, additional.max_cents);
  }

  if (parent.expires_at && additional.expires_at) {
    out.expires_at =
      new Date(parent.expires_at) <= new Date(additional.expires_at)
        ? parent.expires_at
        : additional.expires_at;
  }

  if (parent.allowed_merchants && additional.allowed_merchants) {
    const parentSet = new Set(parent.allowed_merchants);
    out.allowed_merchants = additional.allowed_merchants.filter((m) =>
      parentSet.has(m),
    );
  }

  if (parent.allowed_actions && additional.allowed_actions) {
    const parentSet = new Set(parent.allowed_actions);
    out.allowed_actions = additional.allowed_actions.filter((a) =>
      parentSet.has(a),
    );
  }

  if (parent.merchant_categories && additional.merchant_categories) {
    const parentSet = new Set(parent.merchant_categories);
    out.merchant_categories = additional.merchant_categories.filter((c) =>
      parentSet.has(c),
    );
  }

  return out;
}

/**
 * Check that the CALLER-SUPPLIED additional caveats don't WIDEN the
 * parent's caveats. Each key in `additional` must be no broader than
 * the corresponding key in `parent` (if present).
 *
 * Different from narrowsCaveats(): this only inspects keys IN
 * additional. Keys present in parent but absent from additional are
 * inherited unchanged — that's NOT widening, just "additional doesn't
 * touch this dimension."
 *
 * Pure function. Returns specific failure reasons.
 */
export function additionalIsNarrowing(
  parent: Caveats,
  additional: Caveats,
): { ok: true } | { ok: false; reason: string } {
  if (additional.max_cents !== undefined) {
    if (
      parent.max_cents !== undefined &&
      additional.max_cents > parent.max_cents
    ) {
      return { ok: false, reason: "max_cents_widened" };
    }
  }
  if (additional.expires_at) {
    if (
      parent.expires_at &&
      new Date(additional.expires_at) > new Date(parent.expires_at)
    ) {
      return { ok: false, reason: "expires_at_extended" };
    }
  }
  if (additional.allowed_merchants && parent.allowed_merchants) {
    const parentSet = new Set(parent.allowed_merchants);
    for (const m of additional.allowed_merchants) {
      if (!parentSet.has(m)) {
        return { ok: false, reason: `allowed_merchants_added:${m}` };
      }
    }
  }
  if (additional.allowed_actions && parent.allowed_actions) {
    const parentSet = new Set(parent.allowed_actions);
    for (const a of additional.allowed_actions) {
      if (!parentSet.has(a)) {
        return { ok: false, reason: `allowed_actions_added:${a}` };
      }
    }
  }
  if (additional.merchant_categories && parent.merchant_categories) {
    const parentSet = new Set(parent.merchant_categories);
    for (const c of additional.merchant_categories) {
      if (!parentSet.has(c)) {
        return { ok: false, reason: `merchant_categories_added:${c}` };
      }
    }
  }
  return { ok: true };
}

/**
 * Verify that `child` is a NARROWING of `parent` — every dimension
 * of `child` is at least as restrictive as `parent`.
 *
 * Pure function. Returns specific failure reasons.
 */
export function narrowsCaveats(
  parent: Caveats,
  child: Caveats,
): { ok: true } | { ok: false; reason: string } {
  if (
    parent.max_cents !== undefined &&
    (child.max_cents === undefined || child.max_cents > parent.max_cents)
  ) {
    return { ok: false, reason: "max_cents_widened" };
  }

  if (parent.expires_at && child.expires_at) {
    if (new Date(child.expires_at) > new Date(parent.expires_at)) {
      return { ok: false, reason: "expires_at_extended" };
    }
  } else if (parent.expires_at && !child.expires_at) {
    // Parent has expiry; child removed it — that's widening.
    return { ok: false, reason: "expires_at_removed" };
  }

  if (parent.allowed_merchants && child.allowed_merchants) {
    const parentSet = new Set(parent.allowed_merchants);
    for (const m of child.allowed_merchants) {
      if (!parentSet.has(m)) {
        return { ok: false, reason: `allowed_merchants_added:${m}` };
      }
    }
  } else if (parent.allowed_merchants && !child.allowed_merchants) {
    return { ok: false, reason: "allowed_merchants_removed" };
  }

  if (parent.allowed_actions && child.allowed_actions) {
    const parentSet = new Set(parent.allowed_actions);
    for (const a of child.allowed_actions) {
      if (!parentSet.has(a)) {
        return { ok: false, reason: `allowed_actions_added:${a}` };
      }
    }
  } else if (parent.allowed_actions && !child.allowed_actions) {
    return { ok: false, reason: "allowed_actions_removed" };
  }

  if (parent.merchant_categories && child.merchant_categories) {
    const parentSet = new Set(parent.merchant_categories);
    for (const c of child.merchant_categories) {
      if (!parentSet.has(c)) {
        return { ok: false, reason: `merchant_categories_added:${c}` };
      }
    }
  } else if (parent.merchant_categories && !child.merchant_categories) {
    return { ok: false, reason: "merchant_categories_removed" };
  }

  return { ok: true };
}

// ── Caveat evaluation ──────────────────────────────────────────────

/**
 * Check if all caveats are satisfied for a proposed action.
 *
 * Pure function. Returns specific failure reasons.
 */
export function caveatsSatisfied(
  caveats: Caveats,
  action: ActAction,
  now: Date = new Date(),
): { ok: true } | { ok: false; reason: string } {
  // expires_at — always check
  if (caveats.expires_at && now >= new Date(caveats.expires_at)) {
    return { ok: false, reason: "caveat_expired" };
  }

  if (caveats.max_cents !== undefined) {
    if (action.costCents === undefined) {
      return { ok: false, reason: "caveat_max_cents_requires_action_cost" };
    }
    if (action.costCents > caveats.max_cents) {
      return { ok: false, reason: "caveat_max_cents_exceeded" };
    }
  }

  if (caveats.allowed_merchants && caveats.allowed_merchants.length > 0) {
    if (!action.merchantName) {
      return { ok: false, reason: "caveat_allowed_merchants_requires_merchant" };
    }
    if (!caveats.allowed_merchants.includes(action.merchantName)) {
      return { ok: false, reason: "caveat_merchant_not_allowed" };
    }
  }

  if (caveats.allowed_actions && caveats.allowed_actions.length > 0) {
    if (!caveats.allowed_actions.includes(action.action)) {
      return { ok: false, reason: "caveat_action_not_allowed" };
    }
  }

  if (caveats.merchant_categories && caveats.merchant_categories.length > 0) {
    if (!action.merchantCategory) {
      return {
        ok: false,
        reason: "caveat_merchant_category_requires_action_category",
      };
    }
    if (!caveats.merchant_categories.includes(action.merchantCategory)) {
      return { ok: false, reason: "caveat_merchant_category_not_allowed" };
    }
  }

  return { ok: true };
}

// ── Full chain verification ────────────────────────────────────────

/**
 * Verify a complete token chain — root signature, attenuation rules,
 * chain hash propagation, and caveats vs proposed action.
 *
 * THIS IS THE PUBLIC API customers use. Pure function.
 *
 * Input: chain ordered ROOT → leaf. Verifier walks forward, checking:
 *   1. Each token's signature against its declared issuer pubkey
 *   2. Each child's chainHash matches recompute from parent
 *   3. Each child's caveats are a narrowing of parent's
 *   4. The leaf's caveats are satisfied by the proposed action
 *
 * NEVER throws. Returns granular failure reasons.
 */
export function verifyTokenChain(input: {
  /** ROOT issuer's expected public key (the user's CADC key). */
  rootIssuerPublicKey: string;
  /** Token chain in order: root → ... → leaf. */
  chain: ActToken[];
  /** The action being authorized. */
  action: ActAction;
  /** Optional: clock for testability. */
  now?: Date;
}):
  | { valid: true; effectiveCaveats: Caveats }
  | { valid: false; reason: string; tokenIndex: number } {
  const now = input.now ?? new Date();

  if (input.chain.length === 0) {
    return { valid: false, reason: "empty_chain", tokenIndex: -1 };
  }

  // 1. Root token: issuer must match the expected root issuer.
  const root = input.chain[0];
  if (root.issuerPublicKey !== input.rootIssuerPublicKey) {
    return {
      valid: false,
      reason: "root_issuer_mismatch",
      tokenIndex: 0,
    };
  }
  if (root.parentChainHash !== null) {
    return { valid: false, reason: "root_has_parent", tokenIndex: 0 };
  }

  // 2. Walk the chain forward, validating each token.
  for (let i = 0; i < input.chain.length; i++) {
    const token = input.chain[i];
    const parent = i > 0 ? input.chain[i - 1] : null;

    // 2a. Reconstruct the expected token message from declared fields.
    const expectedMessage = buildTokenMessage({
      parentChainHash: token.parentChainHash,
      issuerPublicKey: token.issuerPublicKey,
      subjectPublicKey: token.subjectPublicKey,
      caveats: token.caveats,
      issuedAt: token.issuedAt,
      expiresAt: token.expiresAt,
    });
    if (token.tokenMessage !== expectedMessage) {
      return { valid: false, reason: "token_message_mismatch", tokenIndex: i };
    }

    // 2b. Verify the signature against issuer's public key.
    if (!verifySignature(token.issuerPublicKey, token.tokenMessage, token.signature)) {
      return { valid: false, reason: "signature_invalid", tokenIndex: i };
    }

    // 2c. Recompute and verify chain hash.
    const expectedChainHash = computeTokenChainHash({
      parentChainHash: token.parentChainHash,
      tokenMessage: token.tokenMessage,
      signature: token.signature,
    });
    if (token.chainHash !== expectedChainHash) {
      return { valid: false, reason: "chain_hash_mismatch", tokenIndex: i };
    }

    // 2d. If attenuating, verify caveats narrow the parent's.
    if (parent !== null) {
      // Parent's chainHash must equal child's parentChainHash.
      if (token.parentChainHash !== parent.chainHash) {
        return {
          valid: false,
          reason: "parent_chain_hash_mismatch",
          tokenIndex: i,
        };
      }
      // Issuer of child must be subject of parent.
      if (token.issuerPublicKey !== parent.subjectPublicKey) {
        return {
          valid: false,
          reason: "issuer_not_parent_subject",
          tokenIndex: i,
        };
      }
      // Caveats must narrow.
      const narrowing = narrowsCaveats(parent.caveats, token.caveats);
      if (!narrowing.ok) {
        return {
          valid: false,
          reason: `attenuation_widened:${narrowing.reason}`,
          tokenIndex: i,
        };
      }
      // Expiry must not extend.
      if (new Date(token.expiresAt) > new Date(parent.expiresAt)) {
        return { valid: false, reason: "expiry_extended", tokenIndex: i };
      }
    }

    // 2e. Token must not be expired.
    if (now >= new Date(token.expiresAt)) {
      return { valid: false, reason: "token_expired", tokenIndex: i };
    }
  }

  // 3. The leaf's caveats must be satisfied by the proposed action.
  const leaf = input.chain[input.chain.length - 1];
  const satisfied = caveatsSatisfied(leaf.caveats, input.action, now);
  if (!satisfied.ok) {
    return {
      valid: false,
      reason: satisfied.reason,
      tokenIndex: input.chain.length - 1,
    };
  }

  return { valid: true, effectiveCaveats: leaf.caveats };
}
