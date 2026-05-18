#!/usr/bin/env node
/**
 * verifiable-receipts witness CLI — bin/witness.mjs
 *
 * Polls a transparency log endpoint, verifies consistency since the
 * last witnessed STH, signs the canonical bytes with the operator's
 * Ed25519 key, and submits the cosignature to /api/transparency/witness.
 *
 * Usage:
 *
 *   # One-shot: check once and exit
 *   npx @sovereign-matrix/verifiable-receipts witness \
 *     --url https://sovereignmatrix.agency \
 *     --key ./witness-ed25519.pem \
 *     --witness-id "EU Witness · Berlin" \
 *     --public-key-url https://eu-witness.example/key.pem \
 *     --once
 *
 *   # Daemon: poll every N seconds (default: 3600)
 *   npx @sovereign-matrix/verifiable-receipts witness \
 *     --url https://sovereignmatrix.agency \
 *     --key ./witness-ed25519.pem \
 *     --witness-id "EU Witness · Berlin" \
 *     --interval 3600
 *
 * State file at ~/.sovereign-witness/<sanitized-witness-id>.json:
 *   { lastSize, lastRoot, lastTimestamp, lastSubmittedAt }
 *
 * Exit codes (--once mode):
 *   0  Witnessed successfully OR no change since last poll
 *   1  Fork or rewrite detected — operator MUST investigate
 *   2  Usage error (bad flags, network failure, malformed STH)
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "node:fs";
import {
  createPrivateKey,
  sign as edSign,
} from "node:crypto";
import { join } from "node:path";
import { homedir } from "node:os";
import { verifyConsistencyProof } from "../dist/transparency.js";

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
      "verifiable-receipts-witness — Sovereign Matrix",
      "",
      "Polls a transparency log STH, verifies append-only consistency since",
      "the last witnessed STH, signs the canonical bytes, and submits the",
      "cosignature back. Run as a daemon (--interval) or one-shot (--once).",
      "",
      "Usage:",
      "  verifiable-receipts-witness --url <base> --key <pem> --witness-id <name> [flags]",
      "",
      "Required:",
      "  --url <base>          Transparency log base URL (e.g. https://sovereignmatrix.agency)",
      "  --key <path>          Path to your Ed25519 private key (PEM)",
      "  --witness-id <name>   Display name for your witness",
      "",
      "Optional:",
      "  --public-key-url <url>  URL where you publish your witness public key",
      "  --interval <sec>        Daemon poll interval (default 3600)",
      "  --once                  Single check + exit (don't loop)",
      "  --state <path>          Override state file location",
      "  --json                  Emit JSON envelope per check",
      "  --help                  This message",
      "",
      "Exit codes (--once):",
      "  0  Witnessed OR no change",
      "  1  Fork / rewrite detected (do NOT auto-recover; investigate)",
      "  2  Usage error or network failure",
      "",
    ].join("\n"),
  );
}

function sanitize(s) {
  return s.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 100);
}

function defaultStatePath(witnessId) {
  const dir = join(homedir(), ".sovereign-witness");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
  }
  return join(dir, sanitize(witnessId) + ".json");
}

function loadState(path) {
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, "utf8");
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function saveState(path, state) {
  writeFileSync(path, JSON.stringify(state, null, 2), { mode: 0o600 });
}

function loadPrivateKey(keyPath) {
  let pem;
  try {
    pem = readFileSync(keyPath, "utf8");
  } catch (err) {
    fail(`could not read --key: ${err.message}`);
  }
  try {
    return createPrivateKey({ key: pem, format: "pem" });
  } catch (err) {
    fail(`--key is not a valid PEM private key: ${err.message}`);
  }
}

async function fetchSth(baseUrl) {
  const res = await fetch(`${baseUrl}/api/transparency/sth`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`STH fetch failed: HTTP ${res.status}`);
  }
  const body = await res.json();
  if (
    typeof body.v !== "number" ||
    typeof body.logId !== "string" ||
    typeof body.treeSize !== "number" ||
    typeof body.rootHash !== "string" ||
    typeof body.canonical !== "string"
  ) {
    throw new Error("STH response is malformed");
  }
  return body;
}

async function fetchConsistencyProof(baseUrl, oldSize, newSize) {
  const url = `${baseUrl}/api/transparency/proof?kind=consistency&old=${oldSize}&new=${newSize}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) {
    throw new Error(`consistency proof fetch failed: HTTP ${res.status}`);
  }
  const body = await res.json();
  if (!Array.isArray(body.proof)) {
    throw new Error("consistency proof response is malformed");
  }
  return body.proof;
}

async function submitCosignature(baseUrl, payload) {
  const res = await fetch(`${baseUrl}/api/transparency/witness`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`cosignature submit failed: HTTP ${res.status} ${errBody}`);
  }
  return await res.json();
}

function signCanonical(canonical, privateKey) {
  const sig = edSign(null, Buffer.from(canonical, "utf8"), privateKey);
  return "v2=" + sig.toString("base64");
}

async function runOnce(opts) {
  const log = (line) => {
    if (opts.json !== "true") process.stdout.write(line + "\n");
  };

  const sth = await fetchSth(opts.url);
  log(`[witness] fetched STH: logId=${sth.logId} size=${sth.treeSize} root=${sth.rootHash.slice(0, 16)}…`);

  const state = loadState(opts.statePath);
  if (state) {
    if (
      state.lastSize === sth.treeSize &&
      state.lastRoot === sth.rootHash
    ) {
      log("[witness] no change since last poll — nothing to witness");
      if (opts.json === "true") {
        process.stdout.write(
          JSON.stringify({
            verdict: "no-change",
            treeSize: sth.treeSize,
            rootHash: sth.rootHash,
          }) + "\n",
        );
      }
      return { verdict: "no-change", exit: 0 };
    }
    if (state.lastSize > sth.treeSize) {
      log("[witness] FORK DETECTED — tree size went BACKWARDS");
      return { verdict: "fork-detected", exit: 1 };
    }
    // Fetch + verify consistency proof from last → current.
    const proof = await fetchConsistencyProof(opts.url, state.lastSize, sth.treeSize);
    const ok = verifyConsistencyProof(
      state.lastSize,
      sth.treeSize,
      state.lastRoot,
      sth.rootHash,
      proof,
    );
    if (!ok) {
      log("[witness] CONSISTENCY PROOF FAILED — log forked or rewrote");
      if (opts.json === "true") {
        process.stdout.write(
          JSON.stringify({
            verdict: "fork-detected",
            oldSize: state.lastSize,
            newSize: sth.treeSize,
          }) + "\n",
        );
      }
      return { verdict: "fork-detected", exit: 1 };
    }
    log(`[witness] consistency proof OK (${state.lastSize} → ${sth.treeSize})`);
  } else {
    log("[witness] no prior state — first-time witness of this log");
  }

  // Sign the canonical bytes and submit.
  const signature = signCanonical(sth.canonical, opts.privateKey);
  const submitBody = {
    witnessId: opts.witnessId,
    signature,
    sthCanonical: sth.canonical,
    ...(opts.publicKeyUrl ? { publicKeyUrl: opts.publicKeyUrl } : {}),
  };
  const result = await submitCosignature(opts.url, submitBody);
  log(
    `[witness] cosignature submitted — total witnesses on this STH: ${result.witnessCount}`,
  );

  const newState = {
    lastSize: sth.treeSize,
    lastRoot: sth.rootHash,
    lastTimestamp: sth.timestamp,
    lastSubmittedAt: new Date().toISOString(),
  };
  saveState(opts.statePath, newState);

  if (opts.json === "true") {
    process.stdout.write(
      JSON.stringify({
        verdict: "witnessed",
        treeSize: sth.treeSize,
        rootHash: sth.rootHash,
        totalWitnesses: result.witnessCount,
      }) + "\n",
    );
  }
  return { verdict: "witnessed", exit: 0 };
}

async function runDaemon(opts) {
  const intervalSec = Math.max(60, Number(opts.interval ?? 3600));
  process.stdout.write(
    `[witness] daemon mode — polling ${opts.url} every ${intervalSec}s\n`,
  );
  // Reject obvious finite values during tests (CI shouldn't run a daemon)
  while (true) {
    try {
      const r = await runOnce(opts);
      if (r.verdict === "fork-detected") {
        process.stderr.write(
          "[witness] daemon halting due to fork detection — operator action required\n",
        );
        process.exit(1);
      }
    } catch (err) {
      process.stderr.write(
        `[witness] poll error (will retry in ${intervalSec}s): ${err.message}\n`,
      );
    }
    await new Promise((r) => setTimeout(r, intervalSec * 1000));
  }
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv[0] === "help" || argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(0);
  }
  const flags = parseArgs(argv);
  if (!flags.url) fail("--url is required");
  if (!flags.key) fail("--key is required");
  if (!flags["witness-id"]) fail("--witness-id is required");

  const opts = {
    url: flags.url.replace(/\/+$/, ""),
    witnessId: flags["witness-id"],
    publicKeyUrl: flags["public-key-url"],
    privateKey: loadPrivateKey(flags.key),
    statePath: flags.state ?? defaultStatePath(flags["witness-id"]),
    interval: flags.interval,
    json: flags.json,
  };

  if (flags.once === "true") {
    const r = await runOnce(opts);
    process.exit(r.exit);
  } else {
    await runDaemon(opts);
  }
}

main().catch((err) => fail(err?.message ?? String(err)));
