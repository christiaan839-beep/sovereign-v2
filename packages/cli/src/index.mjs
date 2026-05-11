#!/usr/bin/env node
/**
 * @sovereignmatrix/cli — verify Sovereign Matrix agent-run receipts
 * from your terminal.
 *
 * Usage:
 *   npx @sovereignmatrix/cli verify <id-or-url> [--host=https://your-host]
 *   npx @sovereignmatrix/cli latest [--host=...]
 *   npx @sovereignmatrix/cli recent [--limit=10] [--host=...]
 *
 * Why this exists:
 *   - Every developer's terminal becomes a Sovereign verification
 *     surface. Same distribution principle as the MCP server, but
 *     for the muscle-memory `npx <thing>` audience.
 *   - Single-file Node 20+ ESM, zero deps. The whole thing is
 *     reviewable in one pass.
 *
 * Security: the --host flag is parsed as a URL and required to be
 * https:// (localhost http:// allowed for testing). Receipt IDs are
 * validated against /^[0-9a-f-]{32,40}$/i before being used in URL
 * paths. No shell-injection or weird-path-traversal surface.
 */

import process from "node:process";

const DEFAULT_HOST = "https://sovereignmatrix.agency";
const ID_RE = /^[0-9a-f-]{32,40}$/i;

const COLOR = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

// ── arg parsing (zero deps) ──

function parseArgs(argv) {
  const args = argv.slice(2);
  const command = args.find((a) => !a.startsWith("--")) ?? "";
  const positional = args.filter((a, i) => {
    if (a.startsWith("--")) return false;
    return i !== args.indexOf(command);
  });
  const flags = {};
  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const [k, v] = arg.slice(2).split("=");
    flags[k] = v ?? "true";
  }
  return { command, positional, flags };
}

function validateHost(raw) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    fail(`Invalid --host: ${raw}`);
  }
  const isLocal = url.hostname === "localhost" || url.hostname === "127.0.0.1";
  if (url.protocol !== "https:" && !isLocal) {
    fail(`--host must be https:// (got ${url.protocol})`);
  }
  return url.origin;
}

function extractId(input) {
  // If it's already an ID, return it.
  if (ID_RE.test(input)) return input.toLowerCase();
  // If it's a URL, parse the path for an ID.
  try {
    const url = new URL(input);
    const m =
      url.pathname.match(/^\/r\/([0-9a-f-]{32,40})\/?$/i) ??
      url.pathname.match(/^\/api\/agent-runs\/([0-9a-f-]{32,40})(?:\/|$)/i);
    if (m && m[1]) return m[1].toLowerCase();
  } catch {
    /* not a URL — fall through */
  }
  fail(`'${input}' is not a valid receipt ID or URL.`);
}

function fail(msg) {
  console.error(`${COLOR.red}✗${COLOR.reset} ${msg}`);
  process.exit(1);
}

function usage() {
  console.log(`
${COLOR.bold}@sovereignmatrix/cli${COLOR.reset} — verify Sovereign receipts from your terminal

${COLOR.cyan}Usage:${COLOR.reset}
  sovereign-verify verify <id-or-url>      Verify a receipt's HMAC signature
  sovereign-verify latest                  Show the freshest public receipt
  sovereign-verify recent [--limit=N]      Show recent public receipts (default 10)
  sovereign-verify --help

${COLOR.cyan}Flags:${COLOR.reset}
  --host=URL    Override verifier host (default: ${DEFAULT_HOST})
                Must be https:// (or localhost for testing)

${COLOR.cyan}Examples:${COLOR.reset}
  npx @sovereignmatrix/cli verify abc...
  npx @sovereignmatrix/cli verify https://sovereignmatrix.agency/r/abc...
  npx @sovereignmatrix/cli recent --limit=20
  npx @sovereignmatrix/cli latest --host=https://verify.acme-legal.com
`);
}

// ── commands ──

async function cmdVerify(id, host) {
  const fetchUrl = `${host}/api/agent-runs/${id}`;
  process.stdout.write(`${COLOR.dim}fetching ${fetchUrl}…${COLOR.reset}\n`);
  let receipt;
  try {
    const res = await fetch(fetchUrl);
    if (res.status === 404) {
      fail(`Receipt ${id} not found, or it's marked private.`);
    }
    if (!res.ok) fail(`HTTP ${res.status} fetching receipt`);
    receipt = await res.json();
  } catch (err) {
    fail(`network error: ${err?.message ?? err}`);
  }
  if (!receipt.canonical || !receipt.signature) {
    fail("Receipt response missing canonical or signature fields.");
  }

  process.stdout.write(`${COLOR.dim}verifying signature…${COLOR.reset}\n`);
  const t0 = Date.now();
  let verifyJson;
  try {
    const res = await fetch(`${host}/api/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        canonical: receipt.canonical,
        signature: receipt.signature,
      }),
    });
    if (!res.ok) fail(`HTTP ${res.status} on /api/verify`);
    verifyJson = await res.json();
  } catch (err) {
    fail(`network error during verify: ${err?.message ?? err}`);
  }
  const elapsedMs = Date.now() - t0;

  console.log(`\n${COLOR.bold}Receipt${COLOR.reset}`);
  console.log(`  id:       ${id}`);
  console.log(`  agent:    ${receipt.agentName ?? "(unknown)"}`);
  console.log(`  model:    ${receipt.modelUsed ?? "(unknown)"}`);
  console.log(`  duration: ${receipt.durationMs ?? "?"}ms`);
  console.log(
    `  visibility: ${receipt.visibility ?? "?"}  ·  created: ${receipt.createdAt ?? "?"}`,
  );

  console.log(`\n${COLOR.bold}Verification${COLOR.reset}`);
  console.log(`  endpoint: ${host}/api/verify`);
  console.log(`  round-trip: ${elapsedMs}ms`);
  if (verifyJson.valid === true) {
    console.log(`  ${COLOR.green}✓ signature VALID${COLOR.reset}\n`);
    process.exit(0);
  } else {
    console.log(
      `  ${COLOR.red}✗ signature INVALID${COLOR.reset}  (HMAC mismatch over canonical projection)\n`,
    );
    process.exit(1);
  }
}

async function cmdLatest(host) {
  const res = await fetch(`${host}/api/agent-runs/latest-public`);
  const json = await res.json();
  if (!json.receipt) {
    console.log(
      `${COLOR.yellow}no public receipts yet${COLOR.reset} (reason: ${json.reason ?? "unknown"})`,
    );
    process.exit(0);
  }
  const r = json.receipt;
  console.log(`\n${COLOR.bold}Latest public receipt${COLOR.reset}`);
  console.log(`  id:        ${r.id}`);
  console.log(`  agent:     ${r.agent}`);
  console.log(`  created:   ${r.createdAt}`);
  console.log(`  url:       ${host}/r/${r.id}\n`);
}

async function cmdRecent(host, limit) {
  const res = await fetch(`${host}/api/agent-runs/recent-public?limit=${limit}`);
  const json = await res.json();
  const rows = json.receipts ?? [];
  if (rows.length === 0) {
    console.log(`${COLOR.yellow}no public receipts yet${COLOR.reset}`);
    return;
  }
  console.log(`\n${COLOR.bold}Recent public receipts${COLOR.reset} (${rows.length})\n`);
  for (const r of rows) {
    const id8 = r.id.slice(0, 8);
    console.log(
      `  ${COLOR.cyan}${id8}…${COLOR.reset}  ${r.agentName}  ${COLOR.dim}${r.modelUsed} · ${r.durationMs}ms${COLOR.reset}`,
    );
  }
  console.log();
}

// ── main ──

async function main() {
  const { command, positional, flags } = parseArgs(process.argv);
  if (flags.help || command === "--help" || command === "help" || !command) {
    usage();
    process.exit(0);
  }

  const host = validateHost(flags.host ?? DEFAULT_HOST);

  switch (command) {
    case "verify": {
      const arg = positional[0];
      if (!arg) fail("usage: sovereign-verify verify <id-or-url>");
      await cmdVerify(extractId(arg), host);
      break;
    }
    case "latest":
      await cmdLatest(host);
      break;
    case "recent": {
      let limit = Number.parseInt(flags.limit ?? "10", 10);
      if (!Number.isFinite(limit)) limit = 10;
      limit = Math.min(Math.max(1, limit), 50);
      await cmdRecent(host, limit);
      break;
    }
    default:
      fail(`Unknown command: ${command}. Run --help for usage.`);
  }
}

main().catch((err) => fail(err?.message ?? String(err)));
