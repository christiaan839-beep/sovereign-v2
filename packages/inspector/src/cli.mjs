#!/usr/bin/env node
/**
 * sovereign-inspect — trustless verifier CLI.
 *
 * Verify any Sovereign Matrix deployment's audit chain, delegation
 * chain, HITL policy, and platform health WITHOUT trusting Sovereign.
 * All verification math runs locally; the Sovereign server is only
 * a data source, not a trust anchor.
 *
 * USAGE:
 *
 *   sovereign-inspect <command> [args]
 *
 * COMMANDS:
 *
 *   permanence <url>
 *     Fetch + display platform permanence snapshot.
 *
 *   policy <url>
 *     Fetch + display the SHIPPED HITL routing rules.
 *
 *   diagnose <url>
 *     Fetch + display the deploy diagnostic (env, DB, tables).
 *
 *   trace <url> <traceId>
 *     Fetch + display a public anonymized reasoning trace.
 *
 *   delegation <url>
 *     Read JSON from stdin: { userPublicKey, delegation }.
 *     Verify LOCALLY (math runs on your machine, not the server).
 *
 *   audit-chain
 *     Read JSON from stdin: an array of audit log rows.
 *     Verify the SHA-256 chain locally.
 *
 *   full <url>
 *     Run permanence + policy + diagnose against a deployment;
 *     return overall green/yellow/red status.
 *
 * EXAMPLES:
 *
 *   sovereign-inspect full https://sovereignmatrix.agency
 *
 *   sovereign-inspect policy https://sovereignmatrix.agency
 *
 *   echo '{"userPublicKey":"...", "delegation":{...}}' | \
 *     sovereign-inspect delegation https://sovereignmatrix.agency
 *
 * EXIT CODES:
 *   0 — all verifications pass
 *   1 — one or more verifications failed (printed)
 *   2 — usage / argument error
 */

import {
  verifyDelegation,
  verifyAuditChain,
} from "./verify.mjs";
import {
  fetchPermanence,
  fetchHitlPolicy,
  fetchDiagnose,
  fetchTrace,
} from "./fetch.mjs";
import { readFileSync } from "node:fs";

// ── Color output (no deps) ──────────────────────────────────────────

const isTty = process.stdout.isTTY && !process.env.NO_COLOR;
const c = {
  green: (s) => (isTty ? `\x1b[32m${s}\x1b[0m` : s),
  red: (s) => (isTty ? `\x1b[31m${s}\x1b[0m` : s),
  yellow: (s) => (isTty ? `\x1b[33m${s}\x1b[0m` : s),
  cyan: (s) => (isTty ? `\x1b[36m${s}\x1b[0m` : s),
  gray: (s) => (isTty ? `\x1b[90m${s}\x1b[0m` : s),
  bold: (s) => (isTty ? `\x1b[1m${s}\x1b[0m` : s),
};

function ok(msg) {
  console.log(`${c.green("✓")} ${msg}`);
}
function bad(msg) {
  console.log(`${c.red("✗")} ${msg}`);
}
function info(msg) {
  console.log(`${c.cyan("ℹ")} ${msg}`);
}
function warn(msg) {
  console.log(`${c.yellow("⚠")} ${msg}`);
}
function header(msg) {
  console.log(`\n${c.bold(c.cyan(msg))}`);
}

function printUsage() {
  console.log(`sovereign-inspect — trustless verifier for Sovereign Matrix`);
  console.log("");
  console.log("USAGE:");
  console.log("  sovereign-inspect <command> [args]");
  console.log("");
  console.log("COMMANDS:");
  console.log("  full <url>              Run all checks against a deployment");
  console.log("  permanence <url>        Show permanence snapshot");
  console.log("  policy <url>            Show SHIPPED HITL routing rules");
  console.log("  diagnose <url>          Show deploy diagnostic");
  console.log("  trace <url> <traceId>   Show anonymized public trace");
  console.log("  delegation <url>        Verify delegation from stdin (no platform trust)");
  console.log("  audit-chain             Verify audit log array from stdin");
  console.log("");
  console.log("DOCS: https://sovereignmatrix.agency/agentic-commerce");
}

// ── Commands ────────────────────────────────────────────────────────

async function cmdPermanence(url) {
  header(`Permanence snapshot — ${url}`);
  const data = await fetchPermanence(url);
  const h = data.headline ?? {};
  if (h.uptime30Day !== null && h.uptime30Day !== undefined) {
    ok(`30-day uptime: ${h.uptime30Day.toFixed(2)}%`);
  } else {
    warn("30-day uptime: not yet measured (telemetry warming up)");
  }
  if (h.invariantsTotal !== null && h.invariantsPassing !== null) {
    const passing = h.invariantsPassing === h.invariantsTotal;
    (passing ? ok : bad)(
      `Anti-drift invariants: ${h.invariantsPassing}/${h.invariantsTotal}`,
    );
  } else {
    warn("Anti-drift invariants: not yet captured");
  }
  if (h.permanenceArtifactsPresent && h.permanenceArtifactsTotal) {
    ok(
      `Permanence artifacts: ${h.permanenceArtifactsPresent}/${h.permanenceArtifactsTotal}`,
    );
  }
  return h.lastSnapshotHealthy === true || h.lastSnapshotHealthy === null
    ? 0
    : 1;
}

async function cmdPolicy(url) {
  header(`HITL routing policy — ${url}`);
  const data = await fetchHitlPolicy(url);
  if (!data.rules || data.rules.length === 0) {
    warn("No routing rules — every action passes without HITL.");
    return 1;
  }
  ok(`${data.rules.length} routing rule(s) shipped`);
  for (const rule of data.rules) {
    console.log(
      `  ${c.cyan(rule.name)} → [${rule.stages.map((s) => s.role).join(" → ")}]`,
    );
    if (rule.rationale) {
      console.log(`    ${c.gray(rule.rationale)}`);
    }
  }
  return 0;
}

async function cmdDiagnose(url) {
  header(`Deploy diagnostic — ${url}`);
  const data = await fetchDiagnose(url);
  const fn = data.status === "healthy" ? ok : data.status === "degraded" ? warn : bad;
  fn(`Status: ${data.status} — ${data.summary}`);
  if (data.hints && data.hints.length > 0) {
    for (const hint of data.hints) {
      info(hint);
    }
  }
  return data.status === "broken" ? 1 : 0;
}

async function cmdTrace(url, traceId) {
  header(`Public reasoning trace — ${url}/${traceId}`);
  const data = await fetchTrace(url, traceId);
  ok(`Agent: ${data.agentName}`);
  ok(`Total duration: ${data.totalDurationMs}ms`);
  ok(`Total cost: $${(data.totalCostCents / 100).toFixed(4)}`);
  ok(`Spans: ${data.spanCount}`);
  if (data.firstError) {
    bad(`First error: ${data.firstError}`);
    return 1;
  }
  return 0;
}

async function cmdDelegation(_url) {
  header("Delegation verification (LOCAL — no platform trust)");
  const stdin = readFileSync(0, "utf8");
  let body;
  try {
    body = JSON.parse(stdin);
  } catch (err) {
    bad(`Invalid JSON on stdin: ${err.message}`);
    return 2;
  }
  if (!body.userPublicKey || !body.delegation) {
    bad("stdin must be: { userPublicKey: '...', delegation: {...} }");
    return 2;
  }
  const result = verifyDelegation({
    delegation: body.delegation,
    userPublicKey: body.userPublicKey,
  });
  if (result.valid) {
    ok(`Delegation valid${result.revoked ? " (revoked)" : ""}`);
    info("Verification ran on YOUR machine — no Sovereign server involved");
    return 0;
  }
  bad(`Delegation INVALID — ${result.reason}`);
  return 1;
}

async function cmdAuditChain() {
  header("Audit chain verification (LOCAL — sha256 walk)");
  const stdin = readFileSync(0, "utf8");
  let rows;
  try {
    rows = JSON.parse(stdin);
  } catch (err) {
    bad(`Invalid JSON on stdin: ${err.message}`);
    return 2;
  }
  if (!Array.isArray(rows)) {
    bad("stdin must be a JSON array of audit log rows");
    return 2;
  }
  const result = verifyAuditChain(rows);
  if (result.valid) {
    ok(`Chain intact — ${result.rowCount} row(s) verified`);
    info("Verification ran on YOUR machine — sha256 walk, no platform trust");
    return 0;
  }
  bad(`Chain BROKEN at row ${result.brokenAt}`);
  console.log(`  ${c.red("expected:")} ${result.expected}`);
  console.log(`  ${c.red("found:   ")} ${result.found}`);
  return 1;
}

async function cmdFull(url) {
  let exit = 0;
  try {
    const r1 = await cmdDiagnose(url);
    if (r1 !== 0) exit = 1;
  } catch (err) {
    bad(`Diagnose failed: ${err.message}`);
    exit = 1;
  }
  try {
    const r2 = await cmdPermanence(url);
    if (r2 !== 0) exit = 1;
  } catch (err) {
    bad(`Permanence failed: ${err.message}`);
    exit = 1;
  }
  try {
    const r3 = await cmdPolicy(url);
    if (r3 !== 0) exit = 1;
  } catch (err) {
    bad(`Policy failed: ${err.message}`);
    exit = 1;
  }
  console.log("");
  if (exit === 0) {
    ok(c.bold(`OVERALL: ${url} passes all verifiable checks`));
  } else {
    bad(c.bold(`OVERALL: one or more checks failed`));
  }
  return exit;
}

// ── Entry ───────────────────────────────────────────────────────────

async function main() {
  const argv = process.argv.slice(2);
  const cmd = argv[0];
  if (!cmd || cmd === "--help" || cmd === "-h") {
    printUsage();
    return cmd === "--help" || cmd === "-h" ? 0 : 2;
  }
  if (cmd === "--version" || cmd === "-v") {
    console.log("@sovereign/inspector v0.1.0");
    return 0;
  }
  switch (cmd) {
    case "full":
      if (!argv[1]) {
        bad("usage: sovereign-inspect full <url>");
        return 2;
      }
      return cmdFull(argv[1]);
    case "permanence":
      if (!argv[1]) {
        bad("usage: sovereign-inspect permanence <url>");
        return 2;
      }
      return cmdPermanence(argv[1]);
    case "policy":
      if (!argv[1]) {
        bad("usage: sovereign-inspect policy <url>");
        return 2;
      }
      return cmdPolicy(argv[1]);
    case "diagnose":
      if (!argv[1]) {
        bad("usage: sovereign-inspect diagnose <url>");
        return 2;
      }
      return cmdDiagnose(argv[1]);
    case "trace":
      if (!argv[1] || !argv[2]) {
        bad("usage: sovereign-inspect trace <url> <traceId>");
        return 2;
      }
      return cmdTrace(argv[1], argv[2]);
    case "delegation":
      return cmdDelegation(argv[1]);
    case "audit-chain":
      return cmdAuditChain();
    default:
      bad(`Unknown command: ${cmd}`);
      printUsage();
      return 2;
  }
}

main()
  .then((code) => process.exit(code))
  .catch((err) => {
    console.error(c.red(`fatal: ${err.message}`));
    process.exit(1);
  });
