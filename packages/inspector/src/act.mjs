/**
 * @sovereign/inspector — Agent Capability Token (ACT) primitives.
 *
 * Pure-function port of src/lib/agent-capability-tokens.ts to standalone
 * Node ESM. Same semantics, same crypto, same chain-hash math.
 *
 * Customers can verify ACT chains LOCALLY using just this file —
 * no Sovereign server required. The signature math is the truth.
 */

import { createHash } from "node:crypto";
import {
  signMessage,
  verifySignature,
  canonicalJsonStringify,
} from "./verify.mjs";

export function buildTokenMessage(input) {
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

export function computeTokenChainHash(input) {
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

export function additionalIsNarrowing(parent, additional) {
  if (additional.max_cents !== undefined) {
    if (
      parent.max_cents !== undefined &&
      additional.max_cents > parent.max_cents
    ) return { ok: false, reason: "max_cents_widened" };
  }
  if (additional.expires_at) {
    if (
      parent.expires_at &&
      new Date(additional.expires_at) > new Date(parent.expires_at)
    ) return { ok: false, reason: "expires_at_extended" };
  }
  if (additional.allowed_merchants && parent.allowed_merchants) {
    const parentSet = new Set(parent.allowed_merchants);
    for (const m of additional.allowed_merchants) {
      if (!parentSet.has(m)) return { ok: false, reason: `allowed_merchants_added:${m}` };
    }
  }
  if (additional.allowed_actions && parent.allowed_actions) {
    const parentSet = new Set(parent.allowed_actions);
    for (const a of additional.allowed_actions) {
      if (!parentSet.has(a)) return { ok: false, reason: `allowed_actions_added:${a}` };
    }
  }
  if (additional.merchant_categories && parent.merchant_categories) {
    const parentSet = new Set(parent.merchant_categories);
    for (const c of additional.merchant_categories) {
      if (!parentSet.has(c)) return { ok: false, reason: `merchant_categories_added:${c}` };
    }
  }
  return { ok: true };
}

export function narrowsCaveats(parent, child) {
  if (
    parent.max_cents !== undefined &&
    (child.max_cents === undefined || child.max_cents > parent.max_cents)
  ) return { ok: false, reason: "max_cents_widened" };
  if (parent.expires_at && child.expires_at) {
    if (new Date(child.expires_at) > new Date(parent.expires_at)) {
      return { ok: false, reason: "expires_at_extended" };
    }
  } else if (parent.expires_at && !child.expires_at) {
    return { ok: false, reason: "expires_at_removed" };
  }
  if (parent.allowed_merchants && child.allowed_merchants) {
    const parentSet = new Set(parent.allowed_merchants);
    for (const m of child.allowed_merchants) {
      if (!parentSet.has(m)) return { ok: false, reason: `allowed_merchants_added:${m}` };
    }
  } else if (parent.allowed_merchants && !child.allowed_merchants) {
    return { ok: false, reason: "allowed_merchants_removed" };
  }
  if (parent.allowed_actions && child.allowed_actions) {
    const parentSet = new Set(parent.allowed_actions);
    for (const a of child.allowed_actions) {
      if (!parentSet.has(a)) return { ok: false, reason: `allowed_actions_added:${a}` };
    }
  } else if (parent.allowed_actions && !child.allowed_actions) {
    return { ok: false, reason: "allowed_actions_removed" };
  }
  if (parent.merchant_categories && child.merchant_categories) {
    const parentSet = new Set(parent.merchant_categories);
    for (const c of child.merchant_categories) {
      if (!parentSet.has(c)) return { ok: false, reason: `merchant_categories_added:${c}` };
    }
  } else if (parent.merchant_categories && !child.merchant_categories) {
    return { ok: false, reason: "merchant_categories_removed" };
  }
  return { ok: true };
}

export function caveatsSatisfied(caveats, action, now = new Date()) {
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
      return { ok: false, reason: "caveat_merchant_category_requires_action_category" };
    }
    if (!caveats.merchant_categories.includes(action.merchantCategory)) {
      return { ok: false, reason: "caveat_merchant_category_not_allowed" };
    }
  }
  return { ok: true };
}

export function verifyTokenChain({ rootIssuerPublicKey, chain, action, now = new Date() }) {
  if (!Array.isArray(chain) || chain.length === 0) {
    return { valid: false, reason: "empty_chain", tokenIndex: -1 };
  }
  const root = chain[0];
  if (root.issuerPublicKey !== rootIssuerPublicKey) {
    return { valid: false, reason: "root_issuer_mismatch", tokenIndex: 0 };
  }
  if (root.parentChainHash !== null) {
    return { valid: false, reason: "root_has_parent", tokenIndex: 0 };
  }
  for (let i = 0; i < chain.length; i++) {
    const token = chain[i];
    const parent = i > 0 ? chain[i - 1] : null;
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
    if (!verifySignature(token.issuerPublicKey, token.tokenMessage, token.signature)) {
      return { valid: false, reason: "signature_invalid", tokenIndex: i };
    }
    const expectedChainHash = computeTokenChainHash({
      parentChainHash: token.parentChainHash,
      tokenMessage: token.tokenMessage,
      signature: token.signature,
    });
    if (token.chainHash !== expectedChainHash) {
      return { valid: false, reason: "chain_hash_mismatch", tokenIndex: i };
    }
    if (parent !== null) {
      if (token.parentChainHash !== parent.chainHash) {
        return { valid: false, reason: "parent_chain_hash_mismatch", tokenIndex: i };
      }
      if (token.issuerPublicKey !== parent.subjectPublicKey) {
        return { valid: false, reason: "issuer_not_parent_subject", tokenIndex: i };
      }
      const narrowing = narrowsCaveats(parent.caveats, token.caveats);
      if (!narrowing.ok) {
        return { valid: false, reason: `attenuation_widened:${narrowing.reason}`, tokenIndex: i };
      }
      if (new Date(token.expiresAt) > new Date(parent.expiresAt)) {
        return { valid: false, reason: "expiry_extended", tokenIndex: i };
      }
    }
    if (now >= new Date(token.expiresAt)) {
      return { valid: false, reason: "token_expired", tokenIndex: i };
    }
  }
  const leaf = chain[chain.length - 1];
  const satisfied = caveatsSatisfied(leaf.caveats, action, now);
  if (!satisfied.ok) {
    return { valid: false, reason: satisfied.reason, tokenIndex: chain.length - 1 };
  }
  return { valid: true, effectiveCaveats: leaf.caveats };
}
