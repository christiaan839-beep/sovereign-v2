#!/usr/bin/env node
/**
 * Deterministic conformance-corpus generator.
 *
 * WHY THIS EXISTS
 * ---------------
 * The cross-language conformance corpus signs its v2 fixtures with an
 * Ed25519 key, and `public-key.pem` is the verification key every harness
 * (TypeScript / Python / Go) loads. A conformance signing key is NOT a
 * secret — exactly like the CT, JOSE, and Sigstore conformance suites, the
 * signing key is published so the corpus is independently reproducible and
 * the public key can be committed. This script derives that key
 * deterministically from a documented, fixed seed, re-signs the
 * key-dependent fixtures, and writes `public-key.pem`. Running it twice
 * produces byte-identical output, so the corpus stays stable while remaining
 * auditable from a clean clone.
 *
 *   node packages/verifiable-receipts/conformance/generate-fixtures.mjs
 *
 * Only the three key-dependent fixtures are touched:
 *   - v2-valid-001.json        → signed by the published test key (accepts)
 *   - v2-invalid-wrong-key.json→ signed by a DIFFERENT key (must reject)
 *   - v2-invalid-tampered.json → carries a valid-base64 sig but a mismatched
 *                                contentHash, so it rejects at the hash check
 * The base64-malformed, wrong-version, and all RFC-9162 inclusion fixtures
 * are key-independent and are never modified.
 */
import {
  createHash,
  createPrivateKey,
  createPublicKey,
  sign as edSign,
} from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures");

// PKCS#8 DER prefix for an Ed25519 private key, followed by the 32-byte seed.
const PKCS8_ED25519_PREFIX = Buffer.from(
  "302e020100300506032b657004220420",
  "hex",
);

/** Derive a stable 32-byte Ed25519 seed from a documented label. */
function seedFromLabel(label) {
  return createHash("sha256").update(label, "utf8").digest(); // 32 bytes
}

function keyFromSeed(seed) {
  const der = Buffer.concat([PKCS8_ED25519_PREFIX, seed]);
  const privateKey = createPrivateKey({ key: der, format: "der", type: "pkcs8" });
  const publicKey = createPublicKey(privateKey);
  return { privateKey, publicKey };
}

// Published, fixed test keys. These labels are the canonical source of the
// corpus signing material — changing them changes the corpus, so don't.
const PUBLISHED = keyFromSeed(
  seedFromLabel("sovereign-matrix/conformance/v2-signing-key/v1"),
);
const WRONG = keyFromSeed(
  seedFromLabel("sovereign-matrix/conformance/v2-wrong-key/v1"),
);

function signV2(canonical, privateKey) {
  const sig = edSign(null, Buffer.from(canonical, "utf8"), privateKey);
  return `v2=${sig.toString("base64")}`;
}

function readFixture(name) {
  return JSON.parse(readFileSync(join(FIXTURES, name), "utf8"));
}

function writeFixture(name, obj) {
  writeFileSync(join(FIXTURES, name), JSON.stringify(obj, null, 2) + "\n");
}

// 1. Publish the verification key.
const pubPem = PUBLISHED.publicKey.export({ format: "pem", type: "spki" });
writeFileSync(join(HERE, "public-key.pem"), pubPem);

// 2. v2-valid-001 — signed by the published key over its own canonical.
const valid = readFixture("v2-valid-001.json");
valid.receipt.signature = signV2(valid.receipt.canonical, PUBLISHED.privateKey);
writeFixture("v2-valid-001.json", valid);

// 3. v2-invalid-wrong-key — signed by a different key; rejects under pubkey.
const wrongKey = readFixture("v2-invalid-wrong-key.json");
wrongKey.receipt.signature = signV2(
  wrongKey.receipt.canonical,
  WRONG.privateKey,
);
writeFixture("v2-invalid-wrong-key.json", wrongKey);

// 4. v2-invalid-tampered — valid-base64 signature (so it reaches the hash
//    check) but the canonical was mutated post-sign, so contentHash mismatches
//    and the verifier rejects before the signature is ever checked.
const tampered = readFixture("v2-invalid-tampered.json");
tampered.receipt.signature = valid.receipt.signature;
writeFixture("v2-invalid-tampered.json", tampered);

console.log("Regenerated conformance corpus:");
console.log("  public-key.pem");
console.log("  fixtures/v2-valid-001.json");
console.log("  fixtures/v2-invalid-wrong-key.json");
console.log("  fixtures/v2-invalid-tampered.json");
console.log(pubPem.trim());
