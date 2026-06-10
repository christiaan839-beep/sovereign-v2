#!/usr/bin/env node
/**
 * Conformance corpus (re)generator — v2 receipt fixtures only.
 *
 * ⚠️  FROZEN-CORPUS WARNING
 * Once a fixture ships in a tagged release its bytes (and the keypair
 * that signed it) MUST NOT change — external auditors pin fixtures by
 * sha256. Run this ONLY to add new fixtures or to bootstrap a corpus
 * that has never been tagged. See README.md "Stability guarantee".
 *
 * What it does:
 *   1. Generates a fresh Ed25519 keypair (key A, the canonical issuer)
 *      and a second throwaway keypair (key B, for the wrong-key vector).
 *   2. Writes key A's public half to ./public-key.pem — the single PEM
 *      all three language harnesses load. Private halves are NOT
 *      persisted anywhere; the corpus is verify-only by design.
 *   3. Re-signs the v2 fixtures' canonical bytes and rewrites the five
 *      v2-*.json files. Inclusion-proof fixtures are key-independent
 *      and are never touched.
 *
 * Usage: node packages/verifiable-receipts/conformance/generate-fixtures.mjs
 */
import {
  generateKeyPairSync,
  createHash,
  sign as nodeSign,
} from "node:crypto";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures");

// Canonical bytes are part of the frozen corpus — never regenerate these,
// only re-sign them. The tampered variant flips overall pass→warn while
// keeping the original contentHash + signature (post-sign tamper).
const CANONICAL_PASS = JSON.stringify({
  agentSlug: "loan-underwriter",
  issuedAt: "2026-05-18T10:00:00Z",
  overall: "pass",
  rules: [{ ruleId: "hipaa-no-raw-ssn", verdict: "pass", durationMs: 2 }],
  runId: "run_conformance_001",
  tokenId: "tok_001",
  verdictId: "v_conf_001",
});
const CANONICAL_TAMPERED = CANONICAL_PASS.replace(
  '"overall":"pass"',
  '"overall":"warn"',
);

const keyA = generateKeyPairSync("ed25519");
const keyB = generateKeyPairSync("ed25519");

const contentHash =
  "sha256:" + createHash("sha256").update(CANONICAL_PASS, "utf8").digest("hex");

const signWith = (key, canonical) =>
  "v2=" + nodeSign(null, Buffer.from(canonical, "utf8"), key).toString("base64");

const sigA = signWith(keyA.privateKey, CANONICAL_PASS);
const sigB = signWith(keyB.privateKey, CANONICAL_PASS);

const fixtures = {
  "v2-valid-001.json": {
    description: "v2 valid — well-formed Guardian attestation",
    receipt: { canonical: CANONICAL_PASS, contentHash, signature: sigA },
    expected: { ok: true },
  },
  "v2-invalid-tampered.json": {
    description: "v2 invalid — canonical bytes tampered post-sign",
    receipt: { canonical: CANONICAL_TAMPERED, contentHash, signature: sigA },
    expected: { ok: false, reasonContains: "contentHash" },
  },
  "v2-invalid-wrong-key.json": {
    description: "v2 invalid — signature under wrong key",
    receipt: { canonical: CANONICAL_PASS, contentHash, signature: sigB },
    expected: { ok: false, reasonContains: "signature" },
  },
  "v2-invalid-bad-base64.json": {
    description: "v2 invalid — signature base64 malformed",
    receipt: { canonical: CANONICAL_PASS, signature: "v2=!!!notbase64!!!" },
    expected: { ok: false, reasonContains: "base64" },
  },
  "v2-invalid-wrong-version.json": {
    description: "v2 invalid — signature has v1 prefix",
    receipt: { canonical: CANONICAL_PASS, signature: "v1=aG1hYw==" },
    expected: { ok: false, reasonContains: "v2" },
  },
};

writeFileSync(
  join(HERE, "public-key.pem"),
  keyA.publicKey.export({ type: "spki", format: "pem" }),
);
for (const [name, fixture] of Object.entries(fixtures)) {
  writeFileSync(join(FIXTURES, name), JSON.stringify(fixture, null, 2) + "\n");
}

console.log("Wrote public-key.pem + 5 v2 fixtures. Inclusion fixtures untouched.");
console.log("Run all three harnesses (see README.md) before committing.");
