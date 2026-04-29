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
import { verifyTokenChain } from "./act.mjs";
import {
  verifyManifest as verifyManifestLocal,
  fetchAgentManifest,
  fetchRegistry,
} from "./identity.mjs";
import { fetchReputation } from "./reputation.mjs";
import {
  fetchPermanence,
  fetchHitlPolicy,
  fetchDiagnose,
  fetchTrace,
  fetchTrustDiscovery,
  crawlFederation,
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
  console.log("  identify <url>          Fetch /.well-known/sovereign-trust");
  console.log("  federation <url>        Crawl federation graph from a seed");
  console.log("  permanence <url>        Show permanence snapshot");
  console.log("  policy <url>            Show SHIPPED HITL routing rules");
  console.log("  diagnose <url>          Show deploy diagnostic");
  console.log("  trace <url> <traceId>   Show anonymized public trace");
  console.log("  agent-identity <url> <id>  Fetch + verify a single agent's manifest");
  console.log("  registry <url>          List all registered agent manifests");
  console.log("  reputation <url> <id>   Fetch + display reputation score with breakdown");
  console.log("  delegation <url>        Verify delegation from stdin (no platform trust)");
  console.log("  audit-chain             Verify audit log array from stdin");
  console.log("  verify-token            Verify ACT chain from stdin (Macaroon attenuation)");
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

async function cmdAgentIdentity(url, agentId) {
  header(`Agent identity — ${url}/api/identity/manifests/${agentId}`);
  const data = await fetchAgentManifest(url, agentId);
  if (!data.manifest) {
    bad("No active manifest found");
    return 1;
  }
  const m = data.manifest;
  ok(`Agent: ${c.bold(m.name)} v${m.version}`);
  console.log(`  ${c.gray("id:")} ${m.id}`);
  console.log(`  ${c.gray("owner:")} ${m.owner}`);
  console.log(`  ${c.gray("ownerPublicKey:")} ${m.ownerPublicKey.slice(0, 16)}...`);
  console.log(`  ${c.gray("purpose:")} ${m.purpose}`);
  console.log(`  ${c.gray("capabilities:")} ${m.capabilities.join(", ")}`);
  if (m.modelProvenance) {
    console.log(`  ${c.gray("models:")} ${m.modelProvenance.models.join(", ")}`);
  }
  if (m.codeProvenance?.commitHash) {
    console.log(`  ${c.gray("commit:")} ${m.codeProvenance.commitHash.slice(0, 12)}...`);
  }
  console.log(`  ${c.gray("expires:")} ${m.expiresAt}`);
  console.log("");

  // VERIFY LOCALLY — this is the whole point of the CLI
  const verification = verifyManifestLocal({
    manifest: m,
    expectedOwnerPublicKey: m.ownerPublicKey,
  });
  if (verification.valid) {
    ok(`Cryptographically VALID${verification.revoked ? " (revoked)" : ""}`);
    info("Verification ran on YOUR machine — Sovereign is not a required trust anchor");
    return verification.revoked ? 1 : 0;
  }
  bad(`Manifest INVALID — ${verification.reason}`);
  return 1;
}

async function cmdRegistry(url) {
  header(`Public agent registry — ${url}/api/identity/registry`);
  const data = await fetchRegistry(url, { limit: 50 });
  if (!data.agents || data.agents.length === 0) {
    info("Registry is empty (no manifests registered yet)");
    return 0;
  }
  ok(`${data.agents.length} agent(s) registered`);
  console.log("");
  for (const agent of data.agents) {
    console.log(
      `  ${c.cyan(agent.name)} ${c.gray(`v${agent.version}`)} ${c.gray(`(${agent.agentId})`)}`,
    );
    console.log(`    ${c.gray("by")} ${agent.owner}`);
    if (agent.purpose) {
      console.log(`    ${c.gray(agent.purpose.slice(0, 80))}`);
    }
    if (agent.capabilities && agent.capabilities.length > 0) {
      console.log(`    ${c.gray("capabilities:")} ${agent.capabilities.join(", ")}`);
    }
    console.log("");
  }
  if (data.pagination?.hasMore) {
    info(`More results: --cursor ${data.pagination.nextCursor}`);
  }
  return 0;
}

async function cmdReputation(url, agentId) {
  header(`Agent reputation — ${url}/api/identity/reputation/${agentId}`);
  const data = await fetchReputation(url, agentId);
  if (!data.reputation) {
    info(`Agent ${agentId} has no score yet (cron rolls up daily).`);
    return 0;
  }
  const r = data.reputation;
  const grade = r.letterGrade;
  const gradeColor =
    grade.startsWith("A") ? c.green :
    grade.startsWith("B") ? c.cyan :
    grade.startsWith("C") ? c.yellow :
    c.red;
  ok(`Grade: ${gradeColor(c.bold(grade))} (${r.numericScore}/100)`);
  console.log("");
  console.log(c.bold("Signals:"));
  console.log(`  ${c.gray("reversal rate (30d):")} ${r.reversalRatePct}%`);
  console.log(`  ${c.gray("HITL rejection (30d):")} ${r.hitlRejectionPct}%`);
  console.log(`  ${c.gray("audit chain intact:")} ${r.auditIntegrity ? c.green("yes") : c.red("no")}`);
  console.log(`  ${c.gray("manifest age:")} ${r.manifestAgeDays} days`);
  console.log(`  ${c.gray("usage (30d):")} ${r.usageCount30d} runs`);
  console.log(`  ${c.gray("cost efficiency:")} ${r.costEfficiencyScore}/10`);
  console.log(`  ${c.gray("anomalies (30d):")} ${r.anomalyCount30d}`);
  console.log("");
  console.log(c.bold("Score breakdown:"));
  const b = r.signalsBreakdown;
  console.log(`  ${c.gray("base:")} ${b.base}`);
  if (b.reversalPenalty) console.log(`  ${c.red("- reversal penalty:")} ${b.reversalPenalty}`);
  if (b.hitlPenalty) console.log(`  ${c.red("- HITL penalty:")} ${b.hitlPenalty}`);
  console.log(`  ${b.auditModifier >= 0 ? c.green("+ audit:") : c.red("- audit:")} ${b.auditModifier}`);
  if (b.ageBonus) console.log(`  ${c.green("+ age bonus:")} ${b.ageBonus}`);
  if (b.usageBonus) console.log(`  ${c.green("+ usage bonus:")} ${b.usageBonus}`);
  if (b.costBonus) console.log(`  ${c.green("+ cost bonus:")} ${b.costBonus}`);
  if (b.anomalyPenalty) console.log(`  ${c.red("- anomaly penalty:")} ${b.anomalyPenalty}`);
  console.log(`  ${c.bold(`= final: ${b.finalClamped}`)}`);
  console.log("");
  info(
    "This score was computed by a pure function. Recompute it locally with " +
      "computeReputationScore() from @sovereign/inspector.",
  );
  return 0;
}

async function cmdVerifyToken() {
  header("ACT chain verification (LOCAL — Macaroon-pattern attenuation)");
  const stdin = readFileSync(0, "utf8");
  let body;
  try {
    body = JSON.parse(stdin);
  } catch (err) {
    bad(`Invalid JSON on stdin: ${err.message}`);
    return 2;
  }
  if (!body.rootIssuerPublicKey || !body.chain || !body.action) {
    bad("stdin must be: { rootIssuerPublicKey, chain: [...], action: {...} }");
    return 2;
  }
  const result = verifyTokenChain({
    rootIssuerPublicKey: body.rootIssuerPublicKey,
    chain: body.chain,
    action: body.action,
  });
  if (result.valid) {
    ok(`ACT chain VALID — ${body.chain.length} token(s) verified`);
    info("Verification ran on YOUR machine — no Sovereign server involved");
    info(`Effective caveats: ${JSON.stringify(result.effectiveCaveats)}`);
    return 0;
  }
  bad(`ACT chain INVALID — ${result.reason} at token #${result.tokenIndex}`);
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

async function cmdIdentify(url) {
  header(`Trust discovery — ${url}/.well-known/sovereign-trust`);
  const doc = await fetchTrustDiscovery(url);
  ok(`Instance: ${doc.identity.name}`);
  console.log(`  ${c.gray(doc.identity.canonicalUrl)}`);
  console.log(`  ${c.gray(doc.identity.description.slice(0, 100))}…`);
  ok(`Spec version: ${doc.$schema?.split("/").pop() ?? "unknown"}`);
  if (doc.identity.keyFingerprint) {
    ok(`Key fingerprint: ${doc.identity.keyFingerprint}`);
  } else {
    info("No platform-level signing key fingerprint (R34 keys are per-user)");
  }
  console.log("");
  console.log(c.bold("Capabilities:"));
  for (const [cap, supported] of Object.entries(doc.capabilities ?? {})) {
    (supported ? ok : bad)(`  ${cap}`);
  }
  console.log("");
  console.log(c.bold("Verifier:"));
  ok(`  npm: ${doc.verifier.npmPackage}`);
  console.log(`  ${c.gray(doc.verifier.install)}`);
  console.log(`  ${c.gray("source: " + doc.verifier.source)}`);
  console.log("");
  console.log(c.bold("Federation peers:"));
  if (!doc.federation.peers || doc.federation.peers.length === 0) {
    info("  (none yet — single-instance trust root)");
  } else {
    for (const peer of doc.federation.peers) console.log(`  ${peer}`);
  }
  console.log("");
  console.log(c.bold("Stats:"));
  console.log(`  ${doc.stats.agents} agents · ${doc.stats.models} models`);
  return 0;
}

async function cmdFederation(url) {
  header(`Federation crawl — starting at ${url}`);
  const graph = await crawlFederation(url, { maxDepth: 3, maxNodes: 32 });
  const nodes = Object.entries(graph);
  ok(`Discovered ${nodes.length} instance(s) in the federation graph`);
  for (const [canonicalUrl, doc] of nodes) {
    if (doc.error) {
      bad(`  ${canonicalUrl} — ${doc.error}`);
      continue;
    }
    const peers = doc?.federation?.peers ?? [];
    console.log(
      `  ${c.cyan(canonicalUrl)} ${c.gray(`(${peers.length} peer${peers.length === 1 ? "" : "s"})`)}`,
    );
  }
  return 0;
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
    case "identify":
      if (!argv[1]) {
        bad("usage: sovereign-inspect identify <url>");
        return 2;
      }
      return cmdIdentify(argv[1]);
    case "federation":
      if (!argv[1]) {
        bad("usage: sovereign-inspect federation <url>");
        return 2;
      }
      return cmdFederation(argv[1]);
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
    case "verify-token":
      return cmdVerifyToken();
    case "agent-identity":
      if (!argv[1] || !argv[2]) {
        bad("usage: sovereign-inspect agent-identity <url> <agentId>");
        return 2;
      }
      return cmdAgentIdentity(argv[1], argv[2]);
    case "registry":
      if (!argv[1]) {
        bad("usage: sovereign-inspect registry <url>");
        return 2;
      }
      return cmdRegistry(argv[1]);
    case "reputation":
      if (!argv[1] || !argv[2]) {
        bad("usage: sovereign-inspect reputation <url> <agentId>");
        return 2;
      }
      return cmdReputation(argv[1], argv[2]);
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
