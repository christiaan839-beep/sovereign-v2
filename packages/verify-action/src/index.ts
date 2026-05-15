/**
 * Sovereign Matrix — verify-ai-receipts GitHub Action.
 *
 * Verifies Sovereign agent-run receipts referenced in a PR description,
 * commit body, or explicit input list. Fails the build if any signature
 * is invalid.
 *
 * Why we hand-roll the GitHub-Actions runtime contract instead of
 * depending on @actions/core:
 *   1. No external dependencies → smaller dist/ → faster cold-start +
 *      no supply-chain surface area.
 *   2. The contract is tiny: read inputs from process.env.INPUT_*,
 *      write outputs by appending to process.env.GITHUB_OUTPUT, set
 *      failure with process.exit(1).
 *   3. Action consumers don't have to trust @actions/core's transitive
 *      deps — the entire action is one ~200-line auditable file.
 *
 * Security model:
 *   - The verifier-host input is validated against a strict URL parse
 *     and an explicit https-only requirement (with localhost allowed
 *     for tests). Prevents an action consumer from being tricked into
 *     hitting an attacker-controlled "verifier."
 *   - Receipt IDs are sanitized to /^[0-9a-f-]{32,40}$/i — anything
 *     outside that pattern is dropped silently rather than causing the
 *     action to make weird network calls.
 *   - URL extraction parses /r/<id> and /api/agent-runs/<id> patterns
 *     ONLY from URLs whose origin matches verifier-host. Cross-origin
 *     receipt URLs are not enumerated (would expand attack surface).
 *
 * Threat model: an attacker submits a PR with crafted description text
 * trying to use this action as an SSRF gateway or DoS amplifier
 * against arbitrary hosts. The whitelist on verifier-host + ID format
 * filter close that.
 */

import { promises as fs } from "node:fs";

interface ActionInputs {
  receiptIds: string[];
  receiptUrls: string[];
  text: string;
  verifierHost: string;
  failOnInvalid: boolean;
  failOnZero: boolean;
}

interface VerifyOutcome {
  total: number;
  verified: number;
  invalid: number;
  unreachable: number;
  ids: string[];
  details: Array<{
    id: string;
    status: "verified" | "invalid" | "unreachable";
    error?: string;
  }>;
}

const RECEIPT_ID_RE = /^[0-9a-f-]{32,40}$/i;

function readInput(name: string, fallback = ""): string {
  const key = `INPUT_${name.replace(/-/g, "_").toUpperCase()}`;
  return process.env[key] ?? fallback;
}

function readBoolInput(name: string, fallback: boolean): boolean {
  const v = readInput(name, "").toLowerCase().trim();
  if (v === "true" || v === "1" || v === "yes") return true;
  if (v === "false" || v === "0" || v === "no") return false;
  return fallback;
}

function csv(input: string): string[] {
  return input
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function validateHost(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error(`verifier-host is not a valid URL: ${raw}`);
  }
  // Allow https:// in production. Allow http:// only for localhost
  // (test harness, local development of the action itself).
  const isLocal =
    parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !isLocal) {
    throw new Error(
      `verifier-host must be https:// (or localhost for testing). Got: ${parsed.protocol}`,
    );
  }
  return parsed.origin;
}

/**
 * Pull receipt IDs out of a free-form text blob. Recognises:
 *   - Bare 32-40 char hex IDs (with optional dashes)
 *   - URLs to /r/<id> or /api/agent-runs/<id>
 *
 * SECURITY: only matches URLs whose origin equals the verifier host
 * — prevents an attacker from posting an arbitrary URL in a PR
 * description and tricking this action into hitting it.
 */
export function extractReceiptIds(
  text: string,
  verifierHost: string,
): string[] {
  const ids = new Set<string>();
  const hostOrigin = validateHost(verifierHost);

  // 1. Match URLs first. URLs from the verifier host get their
  //    embedded receipt id extracted; URLs from any other origin
  //    are dropped. We then strip ALL URLs from the working text
  //    so step 2 doesn't pick the receipt id back up out of an
  //    attacker-supplied URL fragment (the SSRF attack the
  //    test suite catches).
  const urlPattern = /https?:\/\/[^\s<>"']+/g;
  for (const match of text.matchAll(urlPattern)) {
    let url: URL;
    try {
      url = new URL(match[0]);
    } catch {
      continue;
    }
    if (url.origin !== hostOrigin) continue;
    const m =
      url.pathname.match(/^\/r\/([0-9a-f-]{32,40})\/?$/i) ??
      url.pathname.match(/^\/api\/agent-runs\/([0-9a-f-]{32,40})(?:\/|$)/i);
    if (m && m[1]) ids.add(m[1].toLowerCase());
  }

  // 2. Strip every URL (any origin) before bare-ID matching, so an
  //    attacker can't smuggle a verifier-host id inside a URL whose
  //    origin we'd otherwise reject. Without this step the bare-ID
  //    regex would catch the id back up via the URL's path content.
  const textWithoutUrls = text.replace(urlPattern, " ");

  // 3. Bare IDs in the URL-stripped text (separated by whitespace /
  //    punctuation, hex with optional dashes, must match the strict
  //    32-40 char receipt-id shape).
  const idPattern = /\b[0-9a-f]{8,}(?:-[0-9a-f]+){0,8}\b/gi;
  for (const match of textWithoutUrls.matchAll(idPattern)) {
    const candidate = match[0];
    if (RECEIPT_ID_RE.test(candidate)) {
      ids.add(candidate.toLowerCase());
    }
  }

  return [...ids];
}

function sanitizeIds(rawIds: string[]): string[] {
  const out = new Set<string>();
  for (const id of rawIds) {
    const cleaned = id.trim().toLowerCase();
    if (RECEIPT_ID_RE.test(cleaned)) out.add(cleaned);
  }
  return [...out];
}

function urlsToIds(rawUrls: string[], verifierHost: string): string[] {
  const out = new Set<string>();
  const hostOrigin = validateHost(verifierHost);
  for (const raw of rawUrls) {
    let url: URL;
    try {
      url = new URL(raw.trim());
    } catch {
      continue;
    }
    if (url.origin !== hostOrigin) continue;
    const m =
      url.pathname.match(/^\/r\/([0-9a-f-]{32,40})\/?$/i) ??
      url.pathname.match(/^\/api\/agent-runs\/([0-9a-f-]{32,40})(?:\/|$)/i);
    if (m && m[1]) out.add(m[1].toLowerCase());
  }
  return [...out];
}

/**
 * Verify a single receipt by id. Two HTTP hops — fetch the canonical
 * projection then POST it back to /api/verify.
 *
 * Returns one of three outcomes per receipt. Never throws — failure
 * modes are encoded in the return value.
 */
export async function verifyOne(
  id: string,
  verifierHost: string,
  fetchImpl: typeof fetch = fetch,
): Promise<{ status: "verified" | "invalid" | "unreachable"; error?: string }> {
  const host = validateHost(verifierHost);
  try {
    const fetchRes = await fetchImpl(`${host}/api/agent-runs/${id}`);
    if (fetchRes.status === 404) {
      return { status: "unreachable", error: "404 (private or missing)" };
    }
    if (!fetchRes.ok) {
      return { status: "unreachable", error: `HTTP ${fetchRes.status}` };
    }
    const receipt = (await fetchRes.json()) as {
      canonical?: string;
      signature?: string;
    };
    if (!receipt.canonical || !receipt.signature) {
      return {
        status: "unreachable",
        error: "Receipt missing canonical/signature",
      };
    }
    const verifyRes = await fetchImpl(`${host}/api/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        canonical: receipt.canonical,
        signature: receipt.signature,
      }),
    });
    if (!verifyRes.ok) {
      return {
        status: "unreachable",
        error: `verifier HTTP ${verifyRes.status}`,
      };
    }
    const body = (await verifyRes.json()) as { valid?: boolean };
    return { status: body.valid ? "verified" : "invalid" };
  } catch (err) {
    return {
      status: "unreachable",
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function run(inputs: ActionInputs): Promise<VerifyOutcome> {
  const allIds = new Set<string>();
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
  const details: VerifyOutcome["details"] = [];
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
    details,
  };
}

async function writeOutputs(outcome: VerifyOutcome): Promise<void> {
  const lines = [
    `total=${outcome.total}`,
    `verified=${outcome.verified}`,
    `invalid=${outcome.invalid}`,
    `unreachable=${outcome.unreachable}`,
    `receipt-ids-found=${outcome.ids.join(",")}`,
  ];
  const path = process.env.GITHUB_OUTPUT;
  if (path) {
    await fs.appendFile(path, lines.join("\n") + "\n");
  }
}

function printSummary(outcome: VerifyOutcome, host: string): void {
  console.log(`\nSovereign Matrix — verify-ai-receipts`);
  console.log(`  verifier: ${host}`);
  console.log(`  total:    ${outcome.total}`);
  console.log(`  ✓ valid:   ${outcome.verified}`);
  console.log(`  ✗ invalid: ${outcome.invalid}`);
  console.log(`  ? unreachable: ${outcome.unreachable}`);
  if (outcome.details.length === 0) {
    console.log(`  (no receipt IDs found in the inputs)`);
    return;
  }
  console.log(`\n  Per-receipt:`);
  for (const d of outcome.details) {
    const icon =
      d.status === "verified" ? "✓" : d.status === "invalid" ? "✗" : "?";
    const reason = d.error ? ` — ${d.error}` : "";
    console.log(`    ${icon} ${d.id}: ${d.status}${reason}`);
  }
}

export async function main(): Promise<void> {
  const inputs: ActionInputs = {
    receiptIds: csv(readInput("receipt-ids")),
    receiptUrls: csv(readInput("receipt-urls")),
    text: readInput("text"),
    verifierHost: readInput("verifier-host", "https://sovereignmatrix.agency"),
    failOnInvalid: readBoolInput("fail-on-invalid", true),
    failOnZero: readBoolInput("fail-on-zero", false),
  };

  const outcome = await run(inputs);
  printSummary(outcome, inputs.verifierHost);
  await writeOutputs(outcome);

  if (inputs.failOnZero && outcome.total === 0) {
    console.error(
      "\n::error::No receipt IDs found in inputs (fail-on-zero=true).",
    );
    process.exit(1);
  }
  if (
    inputs.failOnInvalid &&
    (outcome.invalid > 0 || outcome.unreachable > 0)
  ) {
    const what = [
      outcome.invalid > 0 ? `${outcome.invalid} invalid` : null,
      outcome.unreachable > 0 ? `${outcome.unreachable} unreachable` : null,
    ]
      .filter(Boolean)
      .join(", ");
    console.error(`\n::error::Receipt verification failed (${what}).`);
    process.exit(1);
  }
}

// Only run main() when invoked as a CLI, not when imported by tests.
// Only invoke main() when this file is the script entry point —
// not when it's imported by tests. The two @ts-expect-error
// directives are intentional: import.meta.url isn't typed in this
// project's tsconfig (CommonJS lib) but the bundled action runs as
// ESM at GitHub Actions runtime where the field exists.
const isMain =
  typeof import.meta !== "undefined" &&
  // @ts-expect-error import.meta.url is ESM-only; tsconfig is CJS
  import.meta.url &&
  // @ts-expect-error import.meta.url is ESM-only; tsconfig is CJS
  process.argv[1] === new URL(import.meta.url).pathname;
if (isMain) {
  void main();
}
