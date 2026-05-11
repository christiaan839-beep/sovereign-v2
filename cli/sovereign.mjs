#!/usr/bin/env node
/**
 * Sovereign Matrix — CLI
 *
 * One command, no install:
 *
 *   npx @sovereign-matrix/agent-sdk verify <receipt-id>
 *
 * Subcommands:
 *   verify <id>            Re-derive canonical, ask the public verifier,
 *                          print VERIFIED / TAMPERED with the receipt's
 *                          agent name + creation timestamp.
 *
 *   show <id>              Pretty-print the full receipt (input, output,
 *                          safety, signature). Same data as /r/<id>, in
 *                          your terminal.
 *
 *   feed                   Fetch /r/feed.xml and list the 10 most recent
 *                          public receipts.
 *
 *   help                   Print this help.
 *
 * Flags:
 *   --base-url <url>       Override https://sovereignmatrix.agency
 *                          (or set SOVEREIGN_BASE_URL).
 *   --json                 Emit raw JSON instead of a pretty table —
 *                          useful in shell pipelines.
 *
 * Designed to be vendored into the published SDK package as `bin`.
 * Zero external deps — uses Node's built-in fetch + URL.
 */

import { argv, env, exit, stderr, stdout } from "node:process";

const DEFAULT_BASE_URL = "https://sovereignmatrix.agency";

const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

const isTTY = stdout.isTTY;
const c = (color, s) => (isTTY ? `${ANSI[color]}${s}${ANSI.reset}` : s);

function parseArgs(args) {
  const flags = {};
  const positional = [];
  for (let i = 0; i < args.length; i++) {
    const a = args[i];
    if (a === "--json") flags.json = true;
    else if (a === "--base-url") flags.baseUrl = args[++i];
    else if (a === "-h" || a === "--help") flags.help = true;
    else positional.push(a);
  }
  return { flags, positional };
}

const HELP = `${c("bold", "sovereign")} — verifiable AI agent receipts

Usage:
  ${c("cyan", "npx @sovereign-matrix/agent-sdk verify <receipt-id>")}
  ${c("cyan", "npx @sovereign-matrix/agent-sdk show <receipt-id>")}
  ${c("cyan", "npx @sovereign-matrix/agent-sdk feed")}

Flags:
  --base-url <url>   Override the default deployment URL
                     (default: ${DEFAULT_BASE_URL}, env SOVEREIGN_BASE_URL)
  --json             Emit JSON instead of a pretty table

Examples:
  ${c("dim", "# Verify a receipt id printed by your application:")}
  npx @sovereign-matrix/agent-sdk verify 7f8a3c1d-...

  ${c("dim", "# Show the full receipt JSON:")}
  npx @sovereign-matrix/agent-sdk show 7f8a3c1d-... --json
`;

function ensureValidId(id) {
  if (!id || !/^[0-9a-f-]{32,40}$/i.test(id)) {
    stderr.write(c("red", `error: '${id ?? "<none>"}' is not a valid receipt id\n`));
    exit(2);
  }
}

function resolveBaseUrl(flags) {
  const resolved = (
    flags.baseUrl ??
    env.SOVEREIGN_BASE_URL ??
    DEFAULT_BASE_URL
  ).replace(/\/$/, "");
  // Always print the resolved baseUrl to stderr so a poisoned env
  // (someone setting SOVEREIGN_BASE_URL to attacker.example in a CI
  // runner) is obvious in the log. Goes to stderr so --json mode
  // pipes stay clean.
  if (resolved !== DEFAULT_BASE_URL) {
    stderr.write(c("dim", `→ using base ${resolved}\n`));
  }
  return resolved;
}

async function fetchJson(url, init) {
  let res;
  try {
    res = await fetch(url, init);
  } catch (err) {
    stderr.write(c("red", `network error: ${err?.message ?? String(err)}\n`));
    exit(3);
  }
  let text = "";
  try {
    text = await res.text();
  } catch {
    // empty
  }
  let parsed;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = { raw: text };
  }
  return { status: res.status, ok: res.ok, body: parsed };
}

async function cmdVerify(positional, flags) {
  const id = positional[1];
  ensureValidId(id);
  const baseUrl = resolveBaseUrl(flags);

  const receipt = await fetchJson(
    `${baseUrl}/api/agent-runs/${encodeURIComponent(id)}`,
    { headers: { Accept: "application/json" } },
  );
  if (!receipt.ok) {
    if (flags.json) {
      stdout.write(JSON.stringify({ valid: false, status: receipt.status }) + "\n");
    } else {
      stderr.write(
        c("red", `failed to fetch receipt: HTTP ${receipt.status}\n`),
      );
    }
    exit(1);
  }

  const { canonical, signature, agentName, createdAt } = receipt.body ?? {};
  if (!canonical || !signature) {
    stderr.write(c("red", "receipt response missing canonical/signature\n"));
    exit(1);
  }

  const verify = await fetchJson(`${baseUrl}/api/verify`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ canonical, signature }),
  });
  if (!verify.ok) {
    stderr.write(c("red", `verify endpoint failed: HTTP ${verify.status}\n`));
    exit(1);
  }

  const valid = !!verify.body?.valid;

  if (flags.json) {
    stdout.write(
      JSON.stringify(
        {
          valid,
          id,
          agentName,
          createdAt,
          algorithm: verify.body?.algorithm,
          canonicalVersion: verify.body?.canonicalVersion,
        },
        null,
        2,
      ) + "\n",
    );
    exit(valid ? 0 : 1);
  }

  if (valid) {
    stdout.write(`${c("green", "✓ VERIFIED")} ${c("bold", id)}\n`);
    if (agentName) stdout.write(`  agent:     ${agentName}\n`);
    if (createdAt) stdout.write(`  created:   ${createdAt}\n`);
    stdout.write(`  algorithm: ${verify.body?.algorithm ?? "HMAC-SHA256"}\n`);
    exit(0);
  }

  stdout.write(`${c("red", "✗ TAMPERED")} ${c("bold", id)}\n`);
  stderr.write(c("red", "  The signature does not match the canonical projection.\n"));
  exit(1);
}

async function cmdShow(positional, flags) {
  const id = positional[1];
  ensureValidId(id);
  const baseUrl = resolveBaseUrl(flags);

  const receipt = await fetchJson(
    `${baseUrl}/api/agent-runs/${encodeURIComponent(id)}`,
    { headers: { Accept: "application/json" } },
  );
  if (!receipt.ok) {
    stderr.write(c("red", `failed to fetch receipt: HTTP ${receipt.status}\n`));
    exit(1);
  }

  if (flags.json) {
    stdout.write(JSON.stringify(receipt.body, null, 2) + "\n");
    exit(0);
  }

  const r = receipt.body ?? {};
  stdout.write(`${c("bold", "Receipt")} ${c("cyan", id)}\n\n`);
  stdout.write(`  agent:      ${r.agentName ?? "—"}\n`);
  stdout.write(`  model:      ${r.modelUsed ?? "—"}\n`);
  stdout.write(`  duration:   ${r.durationMs ?? 0} ms\n`);
  stdout.write(`  trust:      ${r.trustDecision ?? "—"}\n`);
  stdout.write(`  visibility: ${r.visibility ?? "—"}\n`);
  stdout.write(`  created:    ${r.createdAt ?? "—"}\n`);
  stdout.write(`  signature:  ${c("dim", r.signature ?? "—")}\n\n`);
  stdout.write(`  ${c("dim", "Open in browser:")} ${baseUrl}/r/${id}\n`);
  exit(0);
}

async function cmdFeed(_positional, flags) {
  const baseUrl = resolveBaseUrl(flags);
  const url = `${baseUrl}/r/feed.xml`;
  let res;
  try {
    res = await fetch(url);
  } catch (err) {
    stderr.write(c("red", `network error: ${err?.message ?? err}\n`));
    exit(3);
  }
  if (!res.ok) {
    stderr.write(c("red", `feed: HTTP ${res.status}\n`));
    exit(1);
  }
  const xml = await res.text();
  // Tiny RSS parser — we only need <title>, <link>, <pubDate>.
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 10);
  if (flags.json) {
    const out = items.map((m) => {
      const block = m[1];
      const get = (tag) =>
        block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`))?.[1]?.trim() ?? "";
      return { title: get("title"), link: get("link"), pubDate: get("pubDate") };
    });
    stdout.write(JSON.stringify(out, null, 2) + "\n");
    exit(0);
  }
  if (items.length === 0) {
    stdout.write(c("dim", "(no public receipts yet)\n"));
    exit(0);
  }
  stdout.write(`${c("bold", "Recent public receipts")}\n\n`);
  for (const m of items) {
    const block = m[1];
    const get = (tag) =>
      block.match(new RegExp(`<${tag}>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`))?.[1]?.trim() ?? "";
    stdout.write(`  ${c("cyan", get("title"))}\n`);
    stdout.write(`    ${c("dim", get("link"))}\n`);
    stdout.write(`    ${c("gray", get("pubDate"))}\n\n`);
  }
  exit(0);
}

async function main() {
  const { flags, positional } = parseArgs(argv.slice(2));

  // Explicit help (--help / -h) → exit 0. Bare `sovereign` → exit 1
  // because no command was selected (signals "this is wrong usage").
  if (flags.help) {
    stdout.write(HELP);
    exit(0);
  }
  if (positional.length === 0) {
    stdout.write(HELP);
    exit(1);
  }

  const cmd = positional[0];
  switch (cmd) {
    case "verify":
      await cmdVerify(positional, flags);
      break;
    case "show":
      await cmdShow(positional, flags);
      break;
    case "feed":
      await cmdFeed(positional, flags);
      break;
    case "help":
      stdout.write(HELP);
      exit(0);
    default:
      stderr.write(c("red", `unknown command: ${cmd}\n\n`));
      stdout.write(HELP);
      exit(2);
  }
}

main().catch((err) => {
  stderr.write(c("red", `unexpected error: ${err?.stack ?? err}\n`));
  exit(99);
});
