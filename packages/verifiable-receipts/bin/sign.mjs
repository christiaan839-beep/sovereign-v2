#!/usr/bin/env node
/**
 * verifiable-receipts sign CLI — bin/sign.mjs
 *
 * Mint a VAOS-compliant signed receipt from any JSON input. Pure
 * one-shot signing operation; no platform dependency, no network
 * calls. The output is byte-identical to what an Ed25519-signed
 * receipt from the Sovereign Matrix platform would look like, so any
 * VAOS verifier (ours or anyone else's) accepts it.
 *
 * Distribution moat: completes the OSS package as a two-sided
 * primitive. Issuers don't need to write their own canonical-projection
 * code or sign-then-stringify glue; they `npx ... sign` and ship.
 *
 * Usage:
 *
 *   # Sign a receipt body from a JSON file
 *   npx @sovereign-matrix/verifiable-receipts-sign \
 *     --input ./receipt-body.json \
 *     --key ./ed25519-private.pem \
 *     --out ./signed-receipt.json
 *
 *   # Or pipe via stdin
 *   cat receipt-body.json | npx @sovereign-matrix/verifiable-receipts-sign \
 *     --key ./ed25519-private.pem
 *
 *   # Dual-sign with ML-DSA-65 (post-quantum forward-secure)
 *   npx @sovereign-matrix/verifiable-receipts-sign \
 *     --input ./receipt-body.json \
 *     --key ./ed25519-private.pem \
 *     --mldsa-key ./mldsa65-secret.b64 \
 *     --out ./signed-receipt-v3.json
 *
 * Input shape: any JSON object. The CLI removes the `signature` field
 * if present, canonicalizes the rest per VAOS §5, signs, and re-adds
 * the signature.
 *
 * Output: the same object with a `signature` field of the form
 * `v2=<base64-ed25519>` or `v3=<base64-ed25519>.<base64-mldsa65>`.
 *
 * Exit codes:
 *   0  Signed successfully
 *   2  Usage error (bad flags, missing file, malformed input)
 */

import { readFileSync, writeFileSync } from "node:fs";
import {
  createPrivateKey,
  sign as edSign,
} from "node:crypto";
import { signMlDsa65 } from "../dist/pq-sign.js";

function fail(message, code = 2) {
  process.stderr.write(`error: ${message}\n`);
  process.exit(code);
}

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const tok = argv[i];
    if (!tok.startsWith("--")) continue;
    const body = tok.slice(2);
    const eq = body.indexOf("=");
    if (eq >= 0) {
      out[body.slice(0, eq)] = body.slice(eq + 1);
    } else {
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        out[body] = "true";
      } else {
        out[body] = next;
        i++;
      }
    }
  }
  return out;
}

function printHelp() {
  process.stdout.write(
    [
      "verifiable-receipts-sign — Sovereign Matrix",
      "",
      "Mint a VAOS-compliant signed receipt from any JSON input.",
      "Pure one-shot signing; no platform dependency, no network calls.",
      "",
      "Usage:",
      "  verifiable-receipts-sign --input <path> --key <ed25519.pem> [flags]",
      "  cat body.json | verifiable-receipts-sign --key <ed25519.pem>",
      "",
      "Required:",
      "  --key <path>          Path to Ed25519 private key (PEM)",
      "",
      "Optional:",
      "  --input <path>        JSON receipt body (omit to read stdin)",
      "  --out <path>          Output file (omit to write to stdout)",
      "  --mldsa-key <path>    ML-DSA-65 secret key, base64-encoded, for v3 dual-sign",
      "  --json                Always emit a single line of JSON to stdout (no pretty-print)",
      "  --help                This message",
      "",
      "Exit codes:",
      "  0  Signed",
      "  2  Usage error",
      "",
      "VAOS canonical projection (deterministic input to the signer):",
      "  • Remove the `signature` field if present.",
      "  • Sort object keys lexicographically at every depth.",
      "  • JSON-stringify with no whitespace.",
      "  • Sign the UTF-8 bytes with Ed25519 per RFC 8032.",
      "  • Wire prefix: `v2=` (Ed25519) or `v3=` (Ed25519 + ML-DSA-65).",
      "",
    ].join("\n"),
  );
}

async function readStdin() {
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  return data;
}

function sortKeysDeep(value) {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  const out = {};
  for (const k of Object.keys(value).sort()) {
    out[k] = sortKeysDeep(value[k]);
  }
  return out;
}

function canonicalize(receiptBody) {
  const copy = { ...receiptBody };
  delete copy.signature;
  return JSON.stringify(sortKeysDeep(copy));
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === "help" || argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }
  const flags = parseArgs(argv);
  if (!flags.key) fail("--key is required (Ed25519 PEM)");

  // Read the receipt body
  let rawInput;
  if (flags.input) {
    try {
      rawInput = readFileSync(flags.input, "utf8");
    } catch (err) {
      fail(`could not read --input: ${err.message}`);
    }
  } else if (!process.stdin.isTTY) {
    rawInput = await readStdin();
    if (!rawInput.trim()) fail("no input on stdin");
  } else {
    fail("--input <path> required (or pipe JSON via stdin)");
  }

  let body;
  try {
    body = JSON.parse(rawInput);
  } catch (err) {
    fail(`input is not valid JSON: ${err.message}`);
  }
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    fail("input must be a JSON object");
  }

  // Load Ed25519 private key
  let edPrivKey;
  try {
    const pem = readFileSync(flags.key, "utf8");
    edPrivKey = createPrivateKey({ key: pem, format: "pem" });
  } catch (err) {
    fail(`could not load --key: ${err.message}`);
  }

  // Optional: load ML-DSA-65 secret key for v3 dual-sign
  let mldsaSecret = null;
  if (flags["mldsa-key"]) {
    try {
      const b64 = readFileSync(flags["mldsa-key"], "utf8").trim();
      mldsaSecret = Buffer.from(b64, "base64");
    } catch (err) {
      fail(`could not load --mldsa-key: ${err.message}`);
    }
    if (mldsaSecret.length < 32) {
      fail("--mldsa-key looks too short for an ML-DSA-65 secret");
    }
  }

  // Canonicalize + sign
  const canonical = canonicalize(body);
  const edSigBytes = edSign(null, Buffer.from(canonical, "utf8"), edPrivKey);
  const edB64 = edSigBytes.toString("base64");

  let wire;
  if (mldsaSecret) {
    const mldsaSig = signMlDsa65(canonical, mldsaSecret);
    wire = `v3=${edB64}.${mldsaSig}`;
  } else {
    wire = `v2=${edB64}`;
  }

  const signedReceipt = { ...body, signature: wire };
  const out =
    flags.json === "true"
      ? JSON.stringify(signedReceipt)
      : JSON.stringify(signedReceipt, null, 2);

  if (flags.out) {
    writeFileSync(flags.out, out + (flags.json === "true" ? "\n" : "\n"));
    process.stderr.write(
      `[sign] wrote ${signedReceipt.signature.slice(0, 24)}… to ${flags.out}\n`,
    );
  } else {
    process.stdout.write(out + "\n");
  }
  process.exit(0);
}

main().catch((err) => fail(err?.message ?? String(err)));
