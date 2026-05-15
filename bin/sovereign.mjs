#!/usr/bin/env node
/**
 * Sovereign CLI bin (Cook 90).
 *
 * Wraps the Cook 24 CommandRegistry shape in a Node entrypoint. Every
 * command authenticates against /api/agents/<slug> using a PAT from
 * the SOVEREIGN_PAT env var.
 *
 *   sovereign run <agent> --input ./file.json
 *   sovereign verify <receiptId>
 *   sovereign replay <receiptId>
 *   sovereign help
 */

import { readFile } from "node:fs/promises";
import { argv, env, exit, stdout, stderr } from "node:process";

const API_BASE = env.SOVEREIGN_API ?? "https://sovereignmatrix.agency";
const PAT = env.SOVEREIGN_PAT ?? "";

function fail(msg, code = 1) {
  stderr.write(`error: ${msg}\n`);
  exit(code);
}

function parseFlags(args) {
  const positional = [];
  const flags = {};
  for (let i = 0; i < args.length; i++) {
    const tok = args[i];
    if (tok.startsWith("--")) {
      const body = tok.slice(2);
      const eq = body.indexOf("=");
      if (eq >= 0) {
        flags[body.slice(0, eq)] = body.slice(eq + 1);
      } else {
        const next = args[i + 1];
        if (next === undefined || next.startsWith("-")) {
          flags[body] = "true";
        } else {
          flags[body] = next;
          i++;
        }
      }
    } else {
      positional.push(tok);
    }
  }
  return { positional, flags };
}

async function loadInput(flags) {
  if (flags.input) {
    const buf = await readFile(flags.input, "utf8");
    return JSON.parse(buf);
  }
  if (flags.text) return { text: flags.text };
  return {};
}

async function runAgent(agent, input) {
  if (!PAT) fail("SOVEREIGN_PAT env var is required");
  const res = await fetch(`${API_BASE}/api/agents/${agent}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${PAT}`,
      "Content-Type": "application/json",
      "X-Sovereign-Client": "cli",
    },
    body: JSON.stringify(input),
  });
  const text = await res.text();
  stdout.write(text + "\n");
  if (!res.ok) exit(2);
}

async function verifyReceipt(id) {
  const res = await fetch(`${API_BASE}/api/verify?receiptId=${encodeURIComponent(id)}`);
  const text = await res.text();
  stdout.write(text + "\n");
  if (!res.ok) exit(2);
}

async function replayReceipt(id) {
  if (!PAT) fail("SOVEREIGN_PAT env var is required");
  const res = await fetch(`${API_BASE}/api/replay/${encodeURIComponent(id)}`, {
    headers: { Authorization: `Bearer ${PAT}` },
  });
  const text = await res.text();
  stdout.write(text + "\n");
  if (!res.ok) exit(2);
}

function printHelp() {
  stdout.write(
    [
      "Usage: sovereign <command> [args]",
      "",
      "Commands:",
      "  run <agent> [--input=./file.json] [--text=...]",
      "  verify <receiptId>",
      "  replay <receiptId>",
      "  help",
      "",
      "Env:",
      "  SOVEREIGN_PAT  Personal access token (required for run + replay)",
      "  SOVEREIGN_API  Override the API base URL",
      "",
    ].join("\n"),
  );
}

async function main() {
  const args = argv.slice(2);
  const [cmd, ...rest] = args;
  if (!cmd || cmd === "help" || cmd === "--help" || cmd === "-h") {
    printHelp();
    return;
  }
  const { positional, flags } = parseFlags(rest);
  switch (cmd) {
    case "run": {
      const agent = positional[0];
      if (!agent) fail("usage: sovereign run <agent>");
      const input = await loadInput(flags);
      await runAgent(agent, input);
      return;
    }
    case "verify": {
      const id = positional[0];
      if (!id) fail("usage: sovereign verify <receiptId>");
      await verifyReceipt(id);
      return;
    }
    case "replay": {
      const id = positional[0];
      if (!id) fail("usage: sovereign replay <receiptId>");
      await replayReceipt(id);
      return;
    }
    default:
      fail(`unknown command: ${cmd}`, 64);
  }
}

main().catch((err) => fail(err?.message ?? String(err)));
