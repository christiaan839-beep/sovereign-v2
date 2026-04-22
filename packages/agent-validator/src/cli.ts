#!/usr/bin/env node
/**
 * CLI: sovereign-agent-validator [file.json]
 *
 * Exit codes:
 *   0 — valid manifest
 *   1 — invalid manifest (errors printed)
 *   2 — couldn't read/parse input
 *
 * Pipes: if no file argument is given, reads from stdin. Makes it easy to
 * wire into CI pipelines:
 *   curl -s https://.../my-agent.json | sovereign-agent-validator
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { validateJson, SUPPORTED_SAM_VERSION } from "./index.js";

function usage(): never {
  console.log(
    [
      `sovereign-agent-validator — validate SAM v${SUPPORTED_SAM_VERSION} manifests`,
      "",
      "Usage:",
      "  sovereign-agent-validator <path-to-manifest.json>",
      "  cat manifest.json | sovereign-agent-validator",
      "",
      "Exit codes:",
      "  0  valid",
      "  1  invalid (errors printed to stderr)",
      "  2  couldn't read input",
      "",
      "Spec:  https://sovereignmatrix.agency/spec/agent-manifest",
      "Schema: https://sovereignmatrix.agency/api/public/sam/schema",
    ].join("\n"),
  );
  process.exit(0);
}

async function readInput(): Promise<string> {
  const arg = process.argv[2];

  if (arg === "--help" || arg === "-h") usage();

  if (arg) {
    try {
      return readFileSync(resolve(process.cwd(), arg), "utf8");
    } catch (err) {
      console.error(`Error: could not read ${arg}: ${err instanceof Error ? err.message : err}`);
      process.exit(2);
    }
  }

  // Read from stdin.
  const chunks: Buffer[] = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const content = await readInput();
  const result = validateJson(content);

  if (result.valid) {
    console.log(`✓ Valid SAM v${result.samVersion} manifest`);
    process.exit(0);
  }

  console.error(`✗ Invalid manifest (${result.errors.length} error${result.errors.length === 1 ? "" : "s"}):\n`);
  for (const error of result.errors) {
    console.error(`  [${error.code}] ${error.path}`);
    console.error(`    ${error.message}`);
  }
  console.error(`\nSpec: https://sovereignmatrix.agency/spec/agent-manifest`);
  process.exit(1);
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(2);
});
