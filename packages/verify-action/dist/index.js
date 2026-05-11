// src/index.ts
import { promises as fs } from "node:fs";
var RECEIPT_ID_RE = /^[0-9a-f-]{32,40}$/i;
function readInput(name, fallback = "") {
  const key = `INPUT_${name.replace(/-/g, "_").toUpperCase()}`;
  return process.env[key] ?? fallback;
}
function readBoolInput(name, fallback) {
  const v = readInput(name, "").toLowerCase().trim();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return fallback;
}
function csv(input) {
  return input.split(/[,\n]/).map((s) => s.trim()).filter((s) => s.length > 0);
}
function validateHost(raw) {
  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`verifier-host is not a valid URL: ${raw}`);
  }
  const isLocal = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !isLocal) {
    throw new Error(
      `verifier-host must be https:// (or localhost for testing). Got: ${parsed.protocol}`
    );
  }
  return parsed.origin;
}
function extractReceiptIds(text, verifierHost) {
  const ids = /* @__PURE__ */ new Set();
  const hostOrigin = validateHost(verifierHost);
  const urlPattern = /https?:\/\/[^\s<>"']+/g;
  for (const match of text.matchAll(urlPattern)) {
    let url;
    try {
      url = new URL(match[0]);
    } catch {
      continue;
    }
    if (url.origin !== hostOrigin) continue;
    const m = url.pathname.match(/^\/r\/([0-9a-f-]{32,40})\/?$/i) ?? url.pathname.match(/^\/api\/agent-runs\/([0-9a-f-]{32,40})(?:\/|$)/i);
    if (m && m[1]) ids.add(m[1].toLowerCase());
  }
  const textWithoutUrls = text.replace(urlPattern, " ");
  const idPattern = /\b[0-9a-f]{8,}(?:-[0-9a-f]+){0,8}\b/gi;
  for (const match of textWithoutUrls.matchAll(idPattern)) {
    const candidate = match[0];
    if (RECEIPT_ID_RE.test(candidate)) {
      ids.add(candidate.toLowerCase());
    }
  }
  return [...ids];
}
function sanitizeIds(rawIds) {
  const out = /* @__PURE__ */ new Set();
  for (const id of rawIds) {
    const cleaned = id.trim().toLowerCase();
    if (RECEIPT_ID_RE.test(cleaned)) out.add(cleaned);
  }
  return [...out];
}
function urlsToIds(rawUrls, verifierHost) {
  const out = /* @__PURE__ */ new Set();
  const hostOrigin = validateHost(verifierHost);
  for (const raw of rawUrls) {
    let url;
    try {
      url = new URL(raw.trim());
    } catch {
      continue;
    }
    if (url.origin !== hostOrigin) continue;
    const m = url.pathname.match(/^\/r\/([0-9a-f-]{32,40})\/?$/i) ?? url.pathname.match(/^\/api\/agent-runs\/([0-9a-f-]{32,40})(?:\/|$)/i);
    if (m && m[1]) out.add(m[1].toLowerCase());
  }
  return [...out];
}
async function verifyOne(id, verifierHost, fetchImpl = fetch) {
  const host = validateHost(verifierHost);
  try {
    const fetchRes = await fetchImpl(`${host}/api/agent-runs/${id}`);
    if (fetchRes.status === 404) {
      return { status: "unreachable", error: "404 (private or missing)" };
    }
    if (!fetchRes.ok) {
      return { status: "unreachable", error: `HTTP ${fetchRes.status}` };
    }
    const receipt = await fetchRes.json();
    if (!receipt.canonical || !receipt.signature) {
      return {
        status: "unreachable",
        error: "Receipt missing canonical/signature"
      };
    }
    const verifyRes = await fetchImpl(`${host}/api/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        canonical: receipt.canonical,
        signature: receipt.signature
      })
    });
    if (!verifyRes.ok) {
      return {
        status: "unreachable",
        error: `verifier HTTP ${verifyRes.status}`
      };
    }
    const body = await verifyRes.json();
    return { status: body.valid ? "verified" : "invalid" };
  } catch (err) {
    return {
      status: "unreachable",
      error: err instanceof Error ? err.message : String(err)
    };
  }
}
async function run(inputs) {
  const allIds = /* @__PURE__ */ new Set();
  for (const id of sanitizeIds(inputs.receiptIds)) allIds.add(id);
  for (const id of urlsToIds(inputs.receiptUrls, inputs.verifierHost)) {
    allIds.add(id);
  }
  if (inputs.text) {
    for (const id of extractReceiptIds(inputs.text, inputs.verifierHost)) {
      allIds.add(id);
    }
  }
  const ids = [...allIds];
  const details = [];
  let verified = 0;
  let invalid = 0;
  let unreachable = 0;
  for (const id of ids) {
    const outcome = await verifyOne(id, inputs.verifierHost);
    details.push({ id, ...outcome });
    if (outcome.status === "verified") verified++;
    else if (outcome.status === "invalid") invalid++;
    else unreachable++;
  }
  return {
    total: ids.length,
    verified,
    invalid,
    unreachable,
    ids,
    details
  };
}
async function writeOutputs(outcome) {
  const lines = [
    `total=${outcome.total}`,
    `verified=${outcome.verified}`,
    `invalid=${outcome.invalid}`,
    `unreachable=${outcome.unreachable}`,
    `receipt-ids-found=${outcome.ids.join(",")}`
  ];
  const path = process.env.GITHUB_OUTPUT;
  if (path) {
    await fs.appendFile(path, lines.join("\n") + "\n");
  }
}
function printSummary(outcome, host) {
  console.log(`
Sovereign Matrix \u2014 verify-ai-receipts`);
  console.log(`  verifier: ${host}`);
  console.log(`  total:    ${outcome.total}`);
  console.log(`  \u2713 valid:   ${outcome.verified}`);
  console.log(`  \u2717 invalid: ${outcome.invalid}`);
  console.log(`  ? unreachable: ${outcome.unreachable}`);
  if (outcome.details.length === 0) {
    console.log(`  (no receipt IDs found in the inputs)`);
    return;
  }
  console.log(`
  Per-receipt:`);
  for (const d of outcome.details) {
    const icon = d.status === "verified" ? "\u2713" : d.status === "invalid" ? "\u2717" : "?";
    const reason = d.error ? ` \u2014 ${d.error}` : "";
    console.log(`    ${icon} ${d.id}: ${d.status}${reason}`);
  }
}
async function main() {
  const inputs = {
    receiptIds: csv(readInput("receipt-ids")),
    receiptUrls: csv(readInput("receipt-urls")),
    text: readInput("text"),
    verifierHost: readInput("verifier-host", "https://sovereignmatrix.agency"),
    failOnInvalid: readBoolInput("fail-on-invalid", true),
    failOnZero: readBoolInput("fail-on-zero", false)
  };
  const outcome = await run(inputs);
  printSummary(outcome, inputs.verifierHost);
  await writeOutputs(outcome);
  if (inputs.failOnZero && outcome.total === 0) {
    console.error(
      "\n::error::No receipt IDs found in inputs (fail-on-zero=true)."
    );
    process.exit(1);
  }
  if (inputs.failOnInvalid && (outcome.invalid > 0 || outcome.unreachable > 0)) {
    const what = [
      outcome.invalid > 0 ? `${outcome.invalid} invalid` : null,
      outcome.unreachable > 0 ? `${outcome.unreachable} unreachable` : null
    ].filter(Boolean).join(", ");
    console.error(`
::error::Receipt verification failed (${what}).`);
    process.exit(1);
  }
}
var isMain = typeof import.meta !== "undefined" && // @ts-expect-error import.meta.url is ESM-only; tsconfig is CJS
import.meta.url && // @ts-expect-error import.meta.url is ESM-only; tsconfig is CJS
process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  void main();
}
export {
  extractReceiptIds,
  main,
  run,
  verifyOne
};
