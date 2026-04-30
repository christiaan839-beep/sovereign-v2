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
 *   reputation <url> <agentId>
 *     Fetch + display the agent's reputation score with full
 *     signal breakdown (R40).
 *
 *   reputation-verify <url> <agentId>
 *     Fetch raw signals + recompute the score locally; compare to
 *     the platform's published claim. Catches fabricated reputation (R41).
 *
 *   credit <url> <agentId>
 *     Fetch + display the agent's Trust-as-Collateral credit line
 *     (multiplier × base = effective daily limit) (R42).
 *
 *   credit-verify <url> <agentId>
 *     Fetch the credit line + recompute locally from the published
 *     grade; compare. Catches fabricated credit lines (R42).
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
import { fetchReputation, verifyReputationLocally } from "./reputation.mjs";
import { fetchCreditLine, verifyCreditLineLocally } from "./credit.mjs";
import { fetchReliability, verifyReliabilityLocally } from "./reliability.mjs";
import { verifyAuditBatch as verifyAuditBatchLocal } from "./audit-export.mjs";
import {
  fetchPermanence,
  fetchHitlPolicy,
  fetchDiagnose,
  fetchTrace,
  fetchTrustDiscovery,
  crawlFederation,
} from "./fetch.mjs";
import {
  verifyACAT,
  decodeACATFromHeader,
  summarizeACATForReceipt,
  verifyStripeChargebackEvidence,
} from "./acat.mjs";
import {
  composePerceptionMesh,
  correlateAcrossNodes,
} from "./perception.mjs";
import {
  resolveRouting,
  preflightDispatch,
  buildPreflightFailure,
  createDefaultEdgeNodeRegistry,
} from "./edge-nodes.mjs";
import {
  validateBenchmarkResult,
  findTargetById,
  buildBenchmarkAttestationMessage,
  computeAttestationChainHash,
  gapReport,
} from "./performance.mjs";
import {
  verifyGovernanceTraceStructure,
  GOVERNANCE_LAYERS,
} from "./governance.mjs";
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
  console.log("  reputation-verify <url> <id>  Trustless verify: fetch signals + recompute locally + compare");
  console.log("  credit <url> <id>       Show Trust-as-Collateral credit line (multiplier × base)");
  console.log("  credit-verify <url> <id>  Trustless verify: recompute the credit line locally + compare");
  console.log("  reliability <url>       Show platform's signed reliability attestation");
  console.log("  reliability-verify <url>  Trustless verify: check the attestation signature locally");
  console.log("  audit-export-verify     Verify a saved customer audit export (stdin JSON)");
  console.log("  delegation <url>        Verify delegation from stdin (no platform trust)");
  console.log("  audit-chain             Verify audit log array from stdin");
  console.log("  verify-token            Verify ACT chain from stdin (Macaroon attenuation)");
  console.log("  verify-acat             Verify an ACAT (R91) from stdin (base64url or JSON)");
  console.log("                          + cart context flags: --pubkey --amount --currency --merchant --category");
  console.log("  verify-evidence         Verify a Stripe chargeback evidence packet from stdin (JSON)");
  console.log("                          + --pubkey <userPublicKey>");
  console.log("  verify-perception-plan  Verify a perception-mesh plan from stdin (JSON)");
  console.log("                          { spec, inputs }");
  console.log("  verify-edge-dispatch    Verify an edge-node dispatch decision from stdin (JSON)");
  console.log("                          { request, policy, cost, persona?, deployment? }");
  console.log("  verify-benchmark        Verify a benchmark result + attestation message from stdin (JSON)");
  console.log("                          { result, attestedAt? }");
  console.log("  verify-governance-trace Replay a PAGRL governance consultation from stdin (JSON)");
  console.log("                          { rules, context, claimed: { verdict, matchedRuleId, finalLayer } }");
  console.log("");
  console.log("DOCS: https://sovereignmatrix.agency/trust/agentic-commerce");
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

async function cmdReputationVerify(url, agentId) {
  header(`Reputation TRUSTLESS verification — ${agentId}`);
  info("Fetching raw signals from platform...");
  let result;
  try {
    result = await verifyReputationLocally(url, agentId);
  } catch (err) {
    bad(`Failed to fetch signals: ${err.message}`);
    return 1;
  }
  console.log("");
  console.log(c.bold("Platform claims:"));
  console.log(
    `  Grade: ${c.cyan(result.published.letterGrade)} (${result.published.numericScore}/100)`,
  );
  console.log("");
  console.log(c.bold("Local recompute (your machine):"));
  console.log(
    `  Grade: ${c.cyan(result.recomputed.letterGrade)} (${result.recomputed.numericScore}/100)`,
  );
  console.log("");
  if (result.match) {
    ok(c.bold("✓ MATCH — platform's reputation claim is mathematically correct"));
    console.log("");
    info(
      "The platform did not fabricate this reputation. Same math, same answer.",
    );
    return 0;
  }
  bad(c.bold("✗ MISMATCH — platform's published score is fabricated"));
  console.log("");
  console.log(c.red("This reputation claim cannot be trusted. Report:"));
  console.log(`  Published: ${result.published.letterGrade} ${result.published.numericScore}`);
  console.log(`  Recomputed: ${result.recomputed.letterGrade} ${result.recomputed.numericScore}`);
  console.log(c.gray(`  Signals (raw):`));
  console.log(c.gray(`    ${JSON.stringify(result.signals)}`));
  return 1;
}

async function cmdAuditExportVerify() {
  header("Audit-export TRUSTLESS verification (LOCAL)");
  const stdin = readFileSync(0, "utf8");
  let body;
  try {
    body = JSON.parse(stdin);
  } catch (err) {
    bad(`Failed to parse stdin as JSON: ${err.message}`);
    return 1;
  }
  // Tolerate two shapes: { export: {...} } (server response) or
  // a SignedAuditExport object directly (customer's saved file).
  const signedExport = body.export ?? body;
  if (!signedExport.batchSignature || !signedExport.batchRoot) {
    bad(
      "Input does not look like a SignedAuditExport. " +
        "Pipe the JSON returned by POST /api/admin/audit/export, " +
        "or the customer-saved JSON file containing the signed export.",
    );
    return 1;
  }
  const result = verifyAuditBatchLocal({ signedExport });
  console.log("");
  console.log(c.bold("Export claim:"));
  console.log(`  ${c.gray("user:")} ${signedExport.userId}`);
  console.log(`  ${c.gray("window:")} ${signedExport.windowStart ?? "all"} → ${signedExport.windowEnd ?? "all"}`);
  console.log(`  ${c.gray("rows:")} ${signedExport.rowCount}`);
  console.log(`  ${c.gray("exportedAt:")} ${signedExport.exportedAt}`);
  console.log(`  ${c.gray("batch root:")} ${signedExport.batchRoot.slice(0, 16)}...`);
  console.log(`  ${c.gray("platform pubkey:")} ${signedExport.platformPublicKey.slice(0, 16)}...`);
  console.log("");
  if (result.valid) {
    ok(c.bold(`✓ MATCH — export is intact (${result.rowsVerified} rows verified)`));
    console.log("");
    info(
      "Batch root matches recompute, Ed25519 signature is valid, " +
        "row hash chain is intact. The platform did not fabricate or tamper " +
        "with this export. You can store this audit record forever.",
    );
    return 0;
  }
  bad(c.bold(`✗ TAMPERED — verification failed (${result.reason})`));
  if (result.rowIndex !== undefined) {
    console.log(c.red(`  First broken row index: ${result.rowIndex}`));
  }
  console.log("");
  console.log(c.red("This audit export cannot be trusted as-is."));
  return 1;
}

/**
 * Verify an ACAT (R91) entirely offline.
 *
 * Input: stdin can be either:
 *   - base64url-encoded canonical-JSON of a SignedACAT
 *   - JSON object that is the SignedACAT directly
 *
 * Required flags:
 *   --pubkey <expectedUserPublicKey>
 *   --amount <amountCents>
 *   --currency <ISO 4217>
 *   --merchant <merchantId>
 *   --category <CommerceCategory>
 *
 * Optional:
 *   --now <ISO 8601>      override clock (testing)
 */
function parseFlags(argv) {
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const val = argv[i + 1];
      if (val === undefined || val.startsWith("--")) {
        flags[key] = true;
      } else {
        flags[key] = val;
        i++;
      }
    }
  }
  return flags;
}

async function cmdVerifyACAT(argv) {
  header("ACAT TRUSTLESS verification (LOCAL, OFFLINE)");
  const flags = parseFlags(argv);
  const stdin = readFileSync(0, "utf8").trim();
  if (!stdin) {
    bad("No stdin input. Pipe an ACAT (base64url or JSON).");
    return 2;
  }

  // Try base64url decode first, fall back to JSON.
  let token = decodeACATFromHeader(stdin);
  if (token === null) {
    try {
      token = JSON.parse(stdin);
    } catch {
      bad("stdin is neither valid base64url ACAT nor JSON.");
      return 2;
    }
  }
  if (!token || token.version !== "acat-v1") {
    bad("Decoded payload is not an ACAT v1 token.");
    return 2;
  }

  if (!flags.pubkey) {
    bad("--pubkey <expectedUserPublicKey> required.");
    return 2;
  }
  if (!flags.amount || !flags.currency || !flags.merchant || !flags.category) {
    bad(
      "Cart context required: --amount <cents> --currency <ISO> --merchant <id> --category <commerce-category>",
    );
    return 2;
  }

  console.log(c.bold("ACAT summary:"));
  console.log(summarizeACATForReceipt(token));
  console.log("");

  const result = verifyACAT({
    token,
    expectedUserPublicKey: flags.pubkey,
    cart: {
      amountCents: Number.parseInt(flags.amount, 10),
      currency: flags.currency,
      merchantId: flags.merchant,
      category: flags.category,
    },
    now: flags.now ? new Date(flags.now) : undefined,
  });

  if (result.valid) {
    ok(c.bold(`✓ VALID — agent authorized for this cart`));
    console.log(
      c.gray(`  remaining authorized cents: ${result.remainingMaxCents}`),
    );
    if (result.reputation) {
      console.log(
        c.gray(
          `  agent reputation at issuance: ${result.reputation.letterGrade} ` +
            `(${result.reputation.numericScore}/100)`,
        ),
      );
    }
    return 0;
  }
  bad(c.bold(`✗ INVALID — reason: ${result.reason}`));
  console.log("");
  console.log(
    c.red(
      "Do NOT proceed with the charge. The agent is not authorized for this " +
        "cart under the user's ACAT scope.",
    ),
  );
  return 1;
}

async function cmdVerifyEvidence(argv) {
  header("Stripe chargeback evidence TRUSTLESS verification (OFFLINE)");
  const flags = parseFlags(argv);
  const stdin = readFileSync(0, "utf8");
  let evidence;
  try {
    const parsed = JSON.parse(stdin);
    evidence = parsed.evidenceFileJson ?? parsed;
  } catch (err) {
    bad(`Failed to parse stdin as JSON: ${err.message}`);
    return 1;
  }
  if (!flags.pubkey) {
    bad("--pubkey <expectedUserPublicKey> required.");
    return 2;
  }

  const result = verifyStripeChargebackEvidence({
    evidence,
    expectedUserPublicKey: flags.pubkey,
  });

  if (result.ok) {
    ok(c.bold(`✓ VALID — evidence packet is intact and verifiable`));
    console.log(c.gray(`  dispute id: ${result.disputeId}`));
    console.log(c.gray(`  payment intent: ${result.paymentIntentId}`));
    console.log(c.gray(`  acat chain hash: ${result.acatChainHash}`));
    console.log(c.gray(`  audit chain entries: ${result.auditChainEntries}`));
    console.log("");
    info(result.summary);
    return 0;
  }
  bad(c.bold(`✗ TAMPERED — reason: ${result.reason}`));
  console.log("");
  console.log(
    c.red(
      "This chargeback evidence packet has been altered or is malformed. " +
        "Do NOT submit it as authoritative proof of authorization.",
    ),
  );
  return 1;
}

/**
 * Verify a perception-mesh plan from stdin (JSON: {spec, inputs}).
 * Recomputes the deterministic plan and prints it back. If the
 * customer compares to what the platform's audit chain says was
 * planned, they should match exactly.
 */
async function cmdVerifyPerceptionPlan() {
  header("Perception-mesh plan TRUSTLESS verification (LOCAL, OFFLINE)");
  const stdin = readFileSync(0, "utf8");
  let body;
  try {
    body = JSON.parse(stdin);
  } catch (err) {
    bad(`Failed to parse stdin as JSON: ${err.message}`);
    return 1;
  }
  if (!body.spec || !body.inputs) {
    bad("Body must contain { spec, inputs }");
    return 2;
  }
  let plan;
  try {
    plan = composePerceptionMesh(body.spec, body.inputs);
  } catch (err) {
    bad(`Plan composition failed: ${err.message}`);
    return 1;
  }
  ok(c.bold(`✓ Plan composed (${plan.nodePlans.length} nodes)`));
  console.log(c.gray(`  estimated max-tokens: ${plan.estimatedMaxTokens}`));
  console.log("");
  for (const np of plan.nodePlans) {
    console.log(`  ${c.gray("•")} ${np.nodeId} (${np.kind})`);
    console.log(c.gray(`      parts: ${np.partKindsRouted.join(", ") || "—"}`));
  }
  console.log("");
  console.log(c.gray(plan.rationale));

  // Optional: if the request also passed `outputs` + `rules`, run correlation.
  if (Array.isArray(body.outputs) && Array.isArray(body.rules)) {
    const sigs = correlateAcrossNodes(body.outputs, body.rules);
    console.log("");
    console.log(c.bold(`Correlation signals: ${sigs.length}`));
    for (const s of sigs) {
      console.log(`  ${c.gray(s.severity)} · ${s.ruleName} — ${s.reason}`);
    }
  }
  return 0;
}

/**
 * Verify an edge-node dispatch decision from stdin (JSON: {request,
 * policy, cost, persona?, deployment?}). Recomputes routing +
 * preflight. Customer compares to platform's audit chain entry.
 */
async function cmdVerifyEdgeDispatch() {
  header("Edge-node dispatch TRUSTLESS verification (LOCAL, OFFLINE)");
  const stdin = readFileSync(0, "utf8");
  let body;
  try {
    body = JSON.parse(stdin);
  } catch (err) {
    bad(`Failed to parse stdin as JSON: ${err.message}`);
    return 1;
  }
  if (!body.request || !body.request.userId || !body.request.capability) {
    bad("Body.request must include userId + capability");
    return 2;
  }
  const policy = body.policy ?? { decision: "allow" };
  const cost = body.cost ?? { decision: "proceed" };
  const registry = createDefaultEdgeNodeRegistry();
  const decision = resolveRouting(registry, {
    capability: body.request.capability,
    deployment: body.deployment,
    persona: body.persona,
  });
  const preflight = preflightDispatch({ policy, cost, request: body.request });

  console.log(c.bold("Routing decision:"));
  console.log(`  kind: ${decision.kind}`);
  if (decision.kind === "route") {
    console.log(`  target: ${decision.target.id}`);
    console.log(c.gray(`  rationale: ${decision.rationale}`));
  }
  if (decision.kind === "all-stub") {
    console.log(`  best stub: ${decision.best.id} (${decision.reason})`);
  }
  if (decision.kind === "no-match") {
    console.log(`  reason: ${decision.reason}`);
  }
  console.log("");

  console.log(c.bold("Preflight verdict:"));
  if (preflight.ok) {
    console.log(c.green("  ✓ ok"));
  } else {
    console.log(c.red(`  ✗ refused — ${preflight.reason}`));
    if (preflight.details) console.log(c.gray(`  ${preflight.details}`));
  }
  console.log("");

  // Materialize the projected DispatchResult (preview only — no upstream invoked).
  let projected;
  if (decision.kind === "no-match") {
    projected = {
      ok: false,
      edgeNodeId: "<none>",
      capability: body.request.capability,
      reason: "edge_node_not_found",
      receiptLine: `[edge-node-dispatch] no node supports ${body.request.capability}`,
    };
  } else if (!preflight.ok) {
    const targetId =
      decision.kind === "route"
        ? decision.target.id
        : decision.kind === "all-stub"
          ? decision.best.id
          : "<none>";
    projected = buildPreflightFailure({
      edgeNodeId: targetId,
      request: body.request,
      preflight,
    });
  } else if (decision.kind === "all-stub") {
    projected = {
      ok: false,
      edgeNodeId: decision.best.id,
      capability: body.request.capability,
      reason: "edge_node_not_configured",
      details: `only stubs available for capability '${body.request.capability}'`,
    };
  } else {
    projected = {
      ok: true,
      edgeNodeId: decision.target.id,
      capability: body.request.capability,
      receiptLine: `[edge-node-dispatch] preview ok via ${decision.target.id}`,
    };
  }
  console.log(c.bold("Projected result:"));
  console.log(`  ${projected.ok ? c.green("✓ ok") : c.red("✗ refused")}`);
  console.log(c.gray(`  ${JSON.stringify(projected, null, 2)}`));
  return 0;
}

/**
 * Verify a benchmark result + return attestation message from stdin
 * (JSON: {result, attestedAt?}). Customer signs locally with the
 * platform's published Ed25519 key OR compares the message against
 * the signed attestation in the audit chain.
 */
async function cmdVerifyBenchmark() {
  header("Benchmark result TRUSTLESS verification (LOCAL, OFFLINE)");
  const stdin = readFileSync(0, "utf8");
  let body;
  try {
    body = JSON.parse(stdin);
  } catch (err) {
    bad(`Failed to parse stdin as JSON: ${err.message}`);
    return 1;
  }
  if (!body.result || !body.result.targetId) {
    bad("Body must contain { result: BenchmarkResult }");
    return 2;
  }
  const target = findTargetById(body.result.targetId);
  const validation = validateBenchmarkResult({
    result: body.result,
    target,
  });
  if (!validation.ok) {
    bad(c.bold(`✗ INVALID — reason: ${validation.reason}`));
    if (validation.details) console.log(c.gray(`  ${validation.details}`));
    return 1;
  }
  ok(c.bold(`✓ VALID — result satisfies all structural rules`));
  console.log(c.gray(`  target: ${target.name} (${target.id})`));
  console.log(
    c.gray(
      `  measured: ${body.result.measuredValue}${target.unit} (target ${target.targetValue}${target.unit})`,
    ),
  );
  console.log(c.gray(`  verification: ${body.result.verification}`));

  const attestedAt = body.attestedAt ?? new Date().toISOString();
  const message = buildBenchmarkAttestationMessage({
    target,
    result: body.result,
    attestedAt,
  });
  console.log("");
  console.log(c.bold("Canonical attestation message (sign this):"));
  console.log(c.gray("  ─".repeat(40)));
  for (const line of message.split("\n")) {
    console.log(c.gray(`  ${line}`));
  }
  console.log(c.gray("  ─".repeat(40)));
  console.log("");
  console.log(
    info(
      `Sign with: signMessage(platformPrivateKey, "<message-above>") → use Ed25519 (R44 reliability-attestation pattern).`,
    ),
  );

  // Optional: if the body has history, run gap analysis.
  if (Array.isArray(body.history) && body.history.length > 0) {
    const report = gapReport({
      target,
      history: body.history,
      asOf: body.asOf ? new Date(body.asOf) : undefined,
    });
    console.log("");
    console.log(c.bold("Gap report:"));
    console.log(c.gray(`  ${report.headline}`));
    console.log(
      c.gray(`  measurements: ${report.measurementCount}`),
    );
    if (report.timeToTarget.estimatedDays !== null) {
      console.log(
        c.gray(
          `  ETA: ${report.timeToTarget.estimatedDays.toFixed(0)} days at current trend`,
        ),
      );
    }
  }

  // Show the chain hash anchor for parent=null (GENESIS).
  const chainHashGenesis = computeAttestationChainHash({
    parentChainHash: null,
    message,
    signature: "<your-signature-here>",
  });
  console.log("");
  console.log(
    c.gray(
      `  GENESIS chain-hash anchor (with placeholder signature): ${chainHashGenesis.slice(0, 16)}...`,
    ),
  );
  return 0;
}

async function cmdReliability(url) {
  header(`Reliability attestation — ${url}/api/health/reliability/attestation`);
  const data = await fetchReliability(url);
  if (!data.attestation) {
    info("No reliability attestation signed yet for this deployment.");
    return 0;
  }
  const a = data.attestation;
  const okSym = a.metCommitment ? c.green("✓") : c.red("✗");
  ok(`Window: ${a.windowStart} → ${a.windowEnd}`);
  console.log("");
  console.log(c.bold("Reliability:"));
  console.log(`  ${c.gray("uptime:")} ${(a.uptimePct >= a.commitmentThresholdPct ? c.green : c.red)(`${a.uptimePct}%`)}`);
  console.log(`  ${c.gray("commitment:")} ≥${a.commitmentThresholdPct}%`);
  console.log(`  ${c.gray("met commitment:")} ${okSym}`);
  console.log(`  ${c.gray("snapshots:")} ${a.passingHealthSnapshots}/${a.totalHealthSnapshots} passing (${a.failingHealthSnapshots} failing)`);
  if (a.auditChainIntact === false) {
    console.log(`  ${c.gray("audit chain:")} ${c.red("BROKEN")} — first broken row: ${a.auditChainFirstBrokenId}`);
  } else if (a.auditChainIntact === true) {
    console.log(`  ${c.gray("audit chain:")} ${c.green("intact")} (${a.auditChainTotalRows} rows)`);
  } else {
    console.log(`  ${c.gray("audit chain:")} ${c.yellow("unknown")}`);
  }
  console.log("");
  console.log(c.bold("Cryptographic state:"));
  console.log(`  ${c.gray("platform public key:")} ${a.platformPublicKey.slice(0, 16)}...`);
  console.log(`  ${c.gray("chain hash:")} ${a.chainHash.slice(0, 16)}...`);
  console.log(`  ${c.gray("previous chain hash:")} ${a.previousChainHash ? a.previousChainHash.slice(0, 16) + "..." : c.gray("(genesis)")}`);
  console.log("");
  info(
    "Verify the signature locally with `sovereign-inspect reliability-verify <url>`. " +
      "Sovereign cannot fabricate this — math is the truth.",
  );
  return 0;
}

async function cmdReliabilityVerify(url) {
  header(`Reliability TRUSTLESS verification — ${url}`);
  info("Fetching signed attestation...");
  let result;
  try {
    result = await verifyReliabilityLocally(url);
  } catch (err) {
    bad(`Failed to fetch attestation: ${err.message}`);
    return 1;
  }
  if (result.match === null) {
    info(result.note || "No attestation published yet.");
    return 0;
  }
  console.log("");
  console.log(c.bold("Platform claims:"));
  console.log(
    `  Window: ${result.attestation.windowStart} → ${result.attestation.windowEnd}`,
  );
  console.log(
    `  Uptime: ${result.attestation.uptimePct}% (commitment ≥${result.attestation.commitmentThresholdPct}%)`,
  );
  console.log(`  Met commitment: ${result.attestation.metCommitment ? c.green("yes") : c.red("no")}`);
  console.log("");
  console.log(c.bold("Local verification (your machine):"));
  if (result.match) {
    ok(c.bold("✓ Signature valid + chain hash matches recompute"));
    console.log("");
    info(
      "The platform did not fabricate this reliability claim. " +
        "Same math, same answer. Trust is math, not marketing.",
    );
    return 0;
  }
  bad(c.bold("✗ MISMATCH — published reliability claim is fabricated"));
  console.log("");
  console.log(c.red(`Reason: ${result.reason}`));
  console.log(c.red("This reliability claim cannot be trusted."));
  return 1;
}

async function cmdCredit(url, agentId) {
  header(`Agent credit line — ${url}/api/identity/credit/${agentId}`);
  const data = await fetchCreditLine(url, agentId);
  if (!data.creditLine) {
    info(`Agent ${agentId} has no credit line yet (cron rolls up daily after reputation is established).`);
    return 0;
  }
  const cl = data.creditLine;
  const grade = cl.letterGrade;
  const gradeColor =
    grade.startsWith("A") ? c.green :
    grade.startsWith("B") ? c.cyan :
    grade.startsWith("C") ? c.yellow :
    c.red;
  ok(`Grade: ${gradeColor(c.bold(grade))} (${cl.numericScore}/100)`);
  console.log("");
  console.log(c.bold("Credit line:"));
  console.log(`  ${c.gray("multiplier:")} ${gradeColor(c.bold(`${cl.multiplier}×`))}`);
  console.log(`  ${c.gray("base daily limit:")} $${(cl.baseDailyLimitCents / 100).toFixed(2)}`);
  console.log(`  ${c.gray("effective daily limit:")} ${gradeColor(c.bold(`$${(cl.effectiveDailyLimitCents / 100).toFixed(2)}`))}`);
  console.log(`  ${c.gray("framing:")} ${cl.framing}`);
  console.log(`  ${c.gray("computed at:")} ${cl.computedAt}`);
  console.log("");
  console.log(c.bold("Trust-as-Collateral wire status:"));
  console.log(`  ${c.gray(data.wireStatus || "R42 publishes the credit line as a SIGNAL.")}`);
  console.log("");
  info(
    "Recompute locally with computeCreditLine() from @sovereign/inspector " +
      "or run `sovereign-inspect credit-verify <url> <agentId>` to verify the math.",
  );
  return 0;
}

async function cmdCreditVerify(url, agentId) {
  header(`Credit line TRUSTLESS verification — ${agentId}`);
  info("Fetching published credit line from platform...");
  let result;
  try {
    result = await verifyCreditLineLocally(url, agentId);
  } catch (err) {
    bad(`Failed to fetch credit line: ${err.message}`);
    return 1;
  }
  if (result.match === null) {
    info(result.note || "No credit line published yet.");
    return 0;
  }
  console.log("");
  console.log(c.bold("Platform claims:"));
  console.log(
    `  Grade: ${c.cyan(result.published.letterGrade)} (${result.published.numericScore}/100)`,
  );
  console.log(
    `  Multiplier: ${c.cyan(`${result.published.multiplier}×`)}`,
  );
  console.log(
    `  Effective daily limit: ${c.cyan(`$${(result.published.effectiveDailyLimitCents / 100).toFixed(2)}`)}`,
  );
  console.log("");
  console.log(c.bold("Local recompute (your machine):"));
  console.log(
    `  Multiplier: ${c.cyan(`${result.recomputed.multiplier}×`)}`,
  );
  console.log(
    `  Effective daily limit: ${c.cyan(`$${(result.recomputed.effectiveDailyLimitCents / 100).toFixed(2)}`)}`,
  );
  console.log("");
  if (result.match) {
    ok(c.bold("✓ MATCH — platform's credit line is mathematically correct"));
    console.log("");
    info(
      "The platform did not fabricate this credit line. Same math, same answer.",
    );
    return 0;
  }
  bad(c.bold("✗ MISMATCH — platform's published credit line is fabricated"));
  console.log("");
  console.log(c.red("This credit line cannot be trusted. Report:"));
  console.log(`  Published effective: $${(result.published.effectiveDailyLimitCents / 100).toFixed(2)}`);
  console.log(`  Recomputed effective: $${(result.recomputed.effectiveDailyLimitCents / 100).toFixed(2)}`);
  return 1;
}

/**
 * R142 PAGRL — verify-governance-trace.
 *
 * Reads a claimed PAGRL governance trace from stdin (JSON) and
 * structurally verifies it against PAGRL semantics WITHOUT requiring
 * the live predicates (which can't survive JSON serialization).
 *
 * Body shape:
 *   {
 *     trace: GovernanceTraceEntry[],
 *     claimed: { verdict, matchedRuleId, finalLayer }
 *   }
 *
 * Verifies: canonical layer order, first-match-wins per layer,
 * verdict = most-restrictive matched effect, matchedRuleId/finalLayer
 * consistency, escalate short-circuit.
 */
async function cmdVerifyGovernanceTrace() {
  header("PAGRL governance trace TRUSTLESS verification (LOCAL, OFFLINE)");
  const stdin = readFileSync(0, "utf8");
  let body;
  try {
    body = JSON.parse(stdin);
  } catch (err) {
    bad(`Failed to parse stdin as JSON: ${err.message}`);
    return 1;
  }
  if (!body.trace || !body.claimed) {
    bad("Body must contain { trace, claimed: { verdict, matchedRuleId, finalLayer } }");
    return 2;
  }
  const result = verifyGovernanceTraceStructure({
    trace: body.trace,
    claimed: body.claimed,
  });
  if (!result.ok) {
    bad(c.bold(`✗ INVALID — trace failed structural verification`));
    for (const err of result.errors) {
      console.log(c.red(`  • ${err}`));
    }
    return 1;
  }
  ok(c.bold(`✓ VALID — trace conforms to PAGRL semantics`));
  console.log(c.gray(`  layers (canonical): ${GOVERNANCE_LAYERS.join(" → ")}`));
  console.log(c.gray(`  trace length: ${body.trace.length}`));
  console.log(c.gray(`  matched entries: ${body.trace.filter((t) => t.matched).length}`));
  console.log(c.gray(`  claimed verdict: ${body.claimed.verdict}`));
  if (body.claimed.matchedRuleId) {
    console.log(c.gray(`  matched rule: ${body.claimed.matchedRuleId} @ ${body.claimed.finalLayer}`));
  } else {
    console.log(c.gray(`  matched rule: (none — clean permit)`));
  }
  console.log("");
  console.log(
    info(
      "This verifier checks structural consistency only. To replay against the live rule set, use the programmatic verifyGovernanceTrace() with predicates loaded.",
    ),
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
    case "reputation-verify":
      if (!argv[1] || !argv[2]) {
        bad("usage: sovereign-inspect reputation-verify <url> <agentId>");
        return 2;
      }
      return cmdReputationVerify(argv[1], argv[2]);
    case "credit":
      if (!argv[1] || !argv[2]) {
        bad("usage: sovereign-inspect credit <url> <agentId>");
        return 2;
      }
      return cmdCredit(argv[1], argv[2]);
    case "credit-verify":
      if (!argv[1] || !argv[2]) {
        bad("usage: sovereign-inspect credit-verify <url> <agentId>");
        return 2;
      }
      return cmdCreditVerify(argv[1], argv[2]);
    case "reliability":
      if (!argv[1]) {
        bad("usage: sovereign-inspect reliability <url>");
        return 2;
      }
      return cmdReliability(argv[1]);
    case "reliability-verify":
      if (!argv[1]) {
        bad("usage: sovereign-inspect reliability-verify <url>");
        return 2;
      }
      return cmdReliabilityVerify(argv[1]);
    case "audit-export-verify":
      return cmdAuditExportVerify();
    case "verify-acat":
      return cmdVerifyACAT(argv.slice(1));
    case "verify-evidence":
      return cmdVerifyEvidence(argv.slice(1));
    case "verify-perception-plan":
      return cmdVerifyPerceptionPlan();
    case "verify-edge-dispatch":
      return cmdVerifyEdgeDispatch();
    case "verify-benchmark":
      return cmdVerifyBenchmark();
    case "verify-governance-trace":
      return cmdVerifyGovernanceTrace();
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
