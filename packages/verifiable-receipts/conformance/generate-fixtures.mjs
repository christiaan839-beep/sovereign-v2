/**
 * Regenerates the v2 signature fixtures + public-key.pem for the
 * cross-language conformance corpus.
 *
 * Why this exists: the corpus is only auditable if the verification
 * key ships with it. The original corpus was signed with a throwaway
 * keypair whose public half was never committed (the root .gitignore
 * `*.pem` rule swallowed it), which made every fresh clone fail the
 * TypeScript/Python/Go harnesses. This script makes the corpus
 * reproducible: one command regenerates the keypair, re-signs the v2
 * fixtures, and writes the public key next to them.
 *
 * The private key is intentionally discarded — verification needs
 * only the public half, and discarding the private key preserves the
 * "issuer-side signing is the only canonical path" property.
 *
 * Inclusion-proof fixtures (inclusion-*.json) are key-independent
 * and are NOT touched by this script.
 *
 * Usage: node packages/verifiable-receipts/conformance/generate-fixtures.mjs
 */
import { generateKeyPairSync, createHash, sign } from "node:crypto";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, "fixtures");

const CANONICAL =
  '{"agentSlug":"loan-underwriter","issuedAt":"2026-05-18T10:00:00Z","overall":"pass","rules":[{"ruleId":"hipaa-no-raw-ssn","verdict":"pass","durationMs":2}],"runId":"run_conformance_001","tokenId":"tok_001","verdictId":"v_conf_001"}';
// Same receipt with overall flipped to "warn" — the signature and
// contentHash still cover the "pass" bytes, so verifiers must reject
// on contentHash mismatch first.
const CANONICAL_TAMPERED = CANONICAL.replace(
  '"overall":"pass"',
  '"overall":"warn"',
);

const contentHash =
  "sha256:" + createHash("sha256").update(CANONICAL, "utf8").digest("hex");

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const { privateKey: wrongKey } = generateKeyPairSync("ed25519");

const signWith = (key) =>
  "v2=" + sign(null, Buffer.from(CANONICAL, "utf8"), key).toString("base64");

const fixtures = {
  "v2-valid-001.json": {
    description: "v2 valid — well-formed Guardian attestation",
    receipt: {
      canonical: CANONICAL,
      contentHash,
      signature: signWith(privateKey),
    },
    expected: { ok: true },
  },
  "v2-invalid-tampered.json": {
    description: "v2 invalid — canonical bytes tampered post-sign",
    receipt: {
      canonical: CANONICAL_TAMPERED,
      contentHash,
      signature: signWith(privateKey),
    },
    expected: { ok: false, reasonContains: "contentHash" },
  },
  "v2-invalid-wrong-key.json": {
    description: "v2 invalid — signature under wrong key",
    receipt: {
      canonical: CANONICAL,
      contentHash,
      signature: signWith(wrongKey),
    },
    expected: { ok: false, reasonContains: "signature" },
  },
  "v2-invalid-bad-base64.json": {
    description: "v2 invalid — signature base64 malformed",
    receipt: {
      canonical: CANONICAL,
      signature: "v2=!!!notbase64!!!",
    },
    expected: { ok: false, reasonContains: "base64" },
  },
  "v2-invalid-wrong-version.json": {
    description: "v2 invalid — signature has v1 prefix",
    receipt: {
      canonical: CANONICAL,
      signature: "v1=aG1hYw==",
    },
    expected: { ok: false, reasonContains: "v2" },
  },
};

const pem = publicKey.export({ type: "spki", format: "pem" });
writeFileSync(join(HERE, "public-key.pem"), pem);
console.log("wrote public-key.pem");

for (const [name, fixture] of Object.entries(fixtures)) {
  const body = JSON.stringify(fixture, null, 2) + "\n";
  writeFileSync(join(FIXTURES, name), body);
  const sha = createHash("sha256").update(body, "utf8").digest("hex");
  console.log(`wrote fixtures/${name}  sha256:${sha}`);
}

console.log(
  "\nDone. Private keys were held in memory only and are now discarded.",
);
