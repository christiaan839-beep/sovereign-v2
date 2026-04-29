/**
 * @sovereign/inspector — Customer-managed audit-log export verifier (R45).
 *
 * Pure-function port of src/lib/audit-export.ts. Customers store
 * exported audit batches in their own S3 / GCS / blob storage and
 * verify integrity offline — even if Sovereign disappears, the
 * customer can prove every action ever taken.
 *
 * Trustless contract:
 *   1. Customer stores `signed-export.json` somewhere they control.
 *   2. Years later: `cat signed-export.json | sovereign-inspect audit-export-verify`
 *   3. Inspector recomputes the batch root + verifies the Ed25519
 *      signature + walks the row chain.
 *   4. ✓ Untampered. ✗ Tampered (with reason).
 *
 * Sovereign is irrelevant to the historical record. The math + the
 * customer's storage are the truth.
 */

import { createHash, createPublicKey, verify } from "node:crypto";

// ── helpers (mirror agent-delegation.ts) ───────────────────────────

function fromBase64Url(s) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  return Buffer.from(s.replace(/-/g, "+").replace(/_/g, "/") + pad, "base64");
}

function publicKeyFromB64Url(b64url) {
  const pkBytes = fromBase64Url(b64url);
  const der = Buffer.concat([Buffer.from("302a300506032b6570032100", "hex"), pkBytes]);
  return createPublicKey({ key: der, format: "der", type: "spki" });
}

function verifyEd25519(publicKeyB64Url, message, signatureB64Url) {
  try {
    const keyObj = publicKeyFromB64Url(publicKeyB64Url);
    const sigBytes = fromBase64Url(signatureB64Url);
    return verify(null, Buffer.from(message, "utf8"), keyObj, sigBytes);
  } catch {
    return false;
  }
}

// Canonical JSON (key-sorted) — mirrors agent-delegation.ts.
function canonicalJsonStringify(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) {
    return `[${v.map(canonicalJsonStringify).join(",")}]`;
  }
  const keys = Object.keys(v).sort();
  return `{${keys
    .map(
      (k) =>
        `${JSON.stringify(k)}:${canonicalJsonStringify(v[k])}`,
    )
    .join(",")}}`;
}

// ── Pure functions ─────────────────────────────────────────────────

export function computeBatchRoot(rows) {
  return createHash("sha256")
    .update(canonicalJsonStringify(rows))
    .digest("hex");
}

export function buildBatchMessage(b) {
  return [
    "v1",
    "audit-export-batch",
    `user:${b.userId}`,
    `window:${b.windowStart ?? "all"}|${b.windowEnd ?? "all"}`,
    `rows:${b.rowCount}`,
    `batchRoot:${b.batchRoot}`,
    `exportedAt:${b.exportedAt}`,
  ].join("\n");
}

export function verifyAuditBatch({ signedExport, expectedPlatformPublicKey }) {
  const e = signedExport;

  // 1. Reconstruct canonical message.
  const expectedMessage = buildBatchMessage({
    userId: e.userId,
    windowStart: e.windowStart,
    windowEnd: e.windowEnd,
    rowCount: e.rowCount,
    rows: e.rows,
    batchRoot: e.batchRoot,
    exportedAt: e.exportedAt,
  });
  if (e.batchMessage !== expectedMessage) {
    return { valid: false, reason: "batch_message_mismatch" };
  }

  // 2. Recompute batch root.
  const recomputedRoot = computeBatchRoot(e.rows);
  if (recomputedRoot !== e.batchRoot) {
    return { valid: false, reason: "batch_root_mismatch" };
  }

  // 3. Verify signature.
  if (
    !verifyEd25519(
      e.platformPublicKey,
      e.batchMessage,
      e.batchSignature,
    )
  ) {
    return { valid: false, reason: "signature_invalid" };
  }

  // 4. Optional pubkey assertion.
  if (
    expectedPlatformPublicKey &&
    e.platformPublicKey !== expectedPlatformPublicKey
  ) {
    return { valid: false, reason: "platform_pubkey_mismatch" };
  }

  // 5. Walk the row chain.
  for (let i = 1; i < e.rows.length; i++) {
    const cur = e.rows[i];
    const prev = e.rows[i - 1];
    if (cur.prevHash === null || prev.rowHash === null) continue;
    if (cur.prevHash !== prev.rowHash) {
      return { valid: false, reason: "row_chain_break", rowIndex: i };
    }
  }

  return { valid: true, rowsVerified: e.rows.length };
}
