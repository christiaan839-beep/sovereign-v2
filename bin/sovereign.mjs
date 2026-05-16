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
      "Sovereign CLI — v2 (Wave 35)",
      "",
      "Usage: sovereign <command> [args]",
      "",
      "Agent commands:",
      "  run <agent> [--input=./file.json] [--text=...]   Invoke an agent",
      "  verify <receiptId>                               Verify a receipt",
      "  replay <receiptId>                               Forensic re-derive",
      "",
      "Observability:",
      "  status                                           Production p50/p95/p99",
      "  health                                           Liveness probe",
      "  anchor [--head=<sha>|--id=<uuid>]                Latest BTC chain anchor",
      "",
      "Identity:",
      "  tokens [--agent=<slug>] [--limit=N]              List active JIT tokens",
      "",
      "Trust:",
      "  built [--limit=N]                                Signed shipped-work ledger",
      "  industries                                       Verifiable industry catalog",
      "",
      "Other:",
      "  help                                             This message",
      "",
      "Env:",
      "  SOVEREIGN_PAT  Personal access token (required for run + replay)",
      "  SOVEREIGN_API  Override the API base URL",
      "",
      "Examples:",
      "  sovereign status",
      "  sovereign verify 01HXTEST00000000000000000000000",
      "  sovereign run lead-blitz --input=./icp.json",
      "  sovereign anchor",
      "",
    ].join("\n"),
  );
}

async function getJson(path) {
  const url = `${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: PAT ? { authorization: `Bearer ${PAT}` } : {},
  });
  const text = await res.text();
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    fail(`non-JSON response from ${path} (HTTP ${res.status})`);
  }
  if (!res.ok) {
    fail(`${path} → HTTP ${res.status}: ${JSON.stringify(parsed)}`, 2);
  }
  return parsed;
}

async function cmdStatus() {
  const m = await getJson("/api/status/metrics");
  stdout.write(`overall: ${m.overall}\n`);
  stdout.write(`generated: ${m.generatedAt}\n\n`);
  for (const w of m.windows ?? []) {
    const l = w.latencyMs ?? {};
    stdout.write(
      `${w.window.padEnd(4)}  count=${String(w.count).padStart(6)} ` +
        `success=${(w.successRate * 100).toFixed(2)}%  ` +
        `p50=${l.p50 ?? "—"}ms p95=${l.p95 ?? "—"}ms p99=${l.p99 ?? "—"}ms\n`,
    );
  }
}

async function cmdHealth() {
  const res = await fetch(`${API_BASE}/api/health/ping`);
  if (!res.ok) fail(`health ping → HTTP ${res.status}`, 2);
  const text = await res.text();
  stdout.write(text + (text.endsWith("\n") ? "" : "\n"));
}

async function cmdAnchor(flags) {
  const params = [];
  if (flags.head) params.push(`head=${encodeURIComponent(flags.head)}`);
  if (flags.id) params.push(`id=${encodeURIComponent(flags.id)}`);
  const qs = params.length ? `?${params.join("&")}` : "";
  const a = await getJson(`/api/auditor/anchor${qs}`);
  stdout.write(`chain head:  ${a.chainHead}\n`);
  stdout.write(`row count:   ${a.rowCount}\n`);
  stdout.write(`ok:          ${a.ok}\n`);
  stdout.write(`attested at: ${a.attestedAt}\n`);
  stdout.write(`proofs:      ${(a.proofs ?? []).length}\n`);
  for (const p of a.proofs ?? []) {
    stdout.write(`  · ${p.calendar} (${p.submittedAt})\n`);
  }
}

async function cmdTokens(flags) {
  const params = [];
  if (flags.agent) params.push(`agent=${encodeURIComponent(flags.agent)}`);
  if (flags.limit) params.push(`limit=${encodeURIComponent(flags.limit)}`);
  const qs = params.length ? `?${params.join("&")}` : "";
  const r = await getJson(`/api/agent-tokens${qs}`);
  stdout.write(`active tokens: ${r.count}\n\n`);
  for (const t of r.tokens ?? []) {
    const ttlMin = Math.max(
      0,
      Math.round(
        (new Date(t.expiresAt).getTime() - Date.now()) / 60_000,
      ),
    );
    stdout.write(
      `${t.id}  ${t.agentSlug.padEnd(28)} ${t.scheme.padEnd(4)} ${ttlMin}m left\n`,
    );
    stdout.write(`  scopes: ${(t.scopes ?? []).join(", ") || "—"}\n`);
  }
}

async function cmdBuilt(flags) {
  const r = await getJson("/api/built/ledger");
  const limit = flags.limit ? Math.max(1, Number(flags.limit)) : r.count ?? 0;
  stdout.write(`built ledger:  ${r.count} entries\n`);
  stdout.write(`digest:        ${r.digest}\n\n`);
  const entries = (r.entries ?? []).slice(-limit);
  for (const e of entries) {
    const m = e.entry ?? {};
    stdout.write(
      `W${String(m.wave ?? "?").padStart(2, "0")}  ${m.commit ?? "—"}  ${m.title ?? ""}\n`,
    );
  }
}

async function cmdIndustries() {
  const r = await getJson("/api/industries/registry");
  const s = r.summary ?? {};
  stdout.write(
    `industries: ${s.industryCount} · workflows: ${s.workflowCount} ` +
      `(shipped=${s.shippedCount} in-progress=${s.inProgressCount} scoped=${s.scopedCount})\n\n`,
  );
  for (const ind of r.industries ?? []) {
    stdout.write(
      `[${ind.weight.toUpperCase().padEnd(6)}] ${ind.name} — ${ind.workflows.length} workflow(s)\n`,
    );
  }
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
    case "status":
      await cmdStatus();
      return;
    case "health":
      await cmdHealth();
      return;
    case "anchor":
      await cmdAnchor(flags);
      return;
    case "tokens":
      await cmdTokens(flags);
      return;
    case "built":
      await cmdBuilt(flags);
      return;
    case "industries":
      await cmdIndustries();
      return;
    default:
      fail(`unknown command: ${cmd}`, 64);
  }
}

main().catch((err) => fail(err?.message ?? String(err)));
