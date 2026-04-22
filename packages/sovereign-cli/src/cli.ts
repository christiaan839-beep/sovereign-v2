#!/usr/bin/env node

/**
 * sovereign — CLI entry point.
 *
 * Parses argv, wires real adapters (node:fs + global fetch), delegates
 * to the pure command functions, then formats + prints the result and
 * exits with the right code.
 *
 * Env vars:
 *   SOVEREIGN_API_URL     override the default production API URL
 *   NO_COLOR / FORCE_COLOR standard colour-off signals
 */

import { readFile } from "node:fs/promises";
import {
  runInfo,
  runSubmit,
  runValidate,
  DEFAULT_API_URL,
  CLI_VERSION,
} from "./index.js";
import { parseArgv } from "./parse-argv.js";
import type { CommandResult, FileSystem, HttpClient } from "./types.js";
import { color, symbol } from "./output.js";

/* ─── Real adapters ───────────────────────────────────────────── */

const realFs: FileSystem = {
  readTextFile: (path) => readFile(path, "utf8"),
};

const realHttp: HttpClient = {
  async postJson(url, body) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    let parsed: unknown;
    try {
      parsed = await res.json();
    } catch {
      parsed = null;
    }
    return { status: res.status, body: parsed };
  },
};

/* ─── Help text ───────────────────────────────────────────────── */

const HELP = `sovereign — Sovereign Agent Manifest CLI v${CLI_VERSION}

Usage
  sovereign <command> [options]

Commands
  validate <path>          Validate a SAM v1.0 manifest file locally
  submit   <path>          Validate + POST to /api/creators/submit
  info                     Show version + resolved API URL

Options for submit
  --email <addr>           Contact email used for review correspondence
  --api   <url>            Override the API URL (default: ${DEFAULT_API_URL})

Environment
  SOVEREIGN_API_URL        Same effect as --api
  NO_COLOR                 Disable colored output
  FORCE_COLOR              Force colored output even when piped

Docs
  Spec       https://sovereignmatrix.agency/spec/agent-manifest
  Tutorial   https://sovereignmatrix.agency/developers/build-an-agent

Exit codes
  0  success
  1  manifest invalid / server rejected submission
  2  network / server error
  3  usage / file / JSON error
`;

/* ─── Result printer ──────────────────────────────────────────── */

function printResult(result: CommandResult): void {
  if (result.kind === "success") {
    console.log(color.green(symbol.check), color.bold(result.message));
    if (result.data) {
      for (const [k, v] of Object.entries(result.data)) {
        if (v === undefined || v === "") continue;
        console.log(`  ${color.gray(k.padEnd(14))} ${v}`);
      }
    }
    return;
  }

  console.log(color.red(symbol.cross), color.bold(result.message));
  if (!result.details) return;

  const errors = result.details.errors as
    | Array<{ path: string; message: string }>
    | undefined;
  if (Array.isArray(errors)) {
    for (const err of errors) {
      console.log(
        `  ${color.yellow(err.path.padEnd(18))} ${err.message}`,
      );
    }
    return;
  }

  if (typeof result.details.cause === "string") {
    console.log(`  ${color.gray(result.details.cause)}`);
  }
  if (typeof result.details.error === "string") {
    console.log(`  ${color.yellow(result.details.error)}`);
  }
}

/* ─── Main ────────────────────────────────────────────────────── */

async function main(): Promise<number> {
  const parsed = parseArgv(process.argv.slice(2));

  if (parsed.showHelp && !parsed.command) {
    console.log(HELP);
    return 0;
  }

  if (!parsed.command) {
    console.log(HELP);
    return 3;
  }

  const apiUrl = String(
    parsed.flags.api ?? process.env.SOVEREIGN_API_URL ?? DEFAULT_API_URL,
  );

  let result: CommandResult;
  switch (parsed.command) {
    case "validate":
      result = await runValidate({
        path: parsed.positional[0],
        fs: realFs,
      });
      break;
    case "submit":
      result = await runSubmit({
        path: parsed.positional[0],
        email:
          typeof parsed.flags.email === "string" ? parsed.flags.email : undefined,
        apiUrl,
        fs: realFs,
        http: realHttp,
      });
      break;
    case "info":
      result = runInfo({ apiUrl });
      break;
    case "help":
    case "--help":
      console.log(HELP);
      return 0;
    default:
      console.log(color.red(symbol.cross), `Unknown command: ${parsed.command}`);
      console.log("");
      console.log(HELP);
      return 3;
  }

  printResult(result);
  return result.kind === "success" ? 0 : result.exitCode;
}

// Only run the CLI when this file is invoked directly via the
// `sovereign` bin. When imported (e.g. by tests that want main() or
// printResult in isolation) we stay silent. ESM equivalent of the
// CommonJS `require.main === module` idiom.
const isDirectInvocation =
  typeof process !== "undefined" &&
  Array.isArray(process.argv) &&
  process.argv[1] !== undefined &&
  import.meta.url === `file://${process.argv[1]}`;

if (isDirectInvocation) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      // Unexpected panic — surface stack for bug reports.
      console.error(color.red(symbol.cross), "Unexpected failure");
      console.error(err);
      process.exit(1);
    },
  );
}

export { main };
