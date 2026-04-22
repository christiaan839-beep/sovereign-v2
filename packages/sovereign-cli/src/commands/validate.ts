/**
 * `sovereign validate <path>`
 *
 * Read a SAM v1.0 manifest from disk, run it through the official
 * @sovereignmatrix/agent-validator, return a CommandResult.
 *
 * Exit codes:
 *   0 — valid manifest
 *   1 — manifest has validation errors (details in .data.errors)
 *   3 — usage error (missing path, file not found, bad JSON)
 *
 * Pure — takes a FileSystem adapter so tests can inject an in-memory
 * fake instead of touching real disk.
 */

import { validate } from "@sovereignmatrix/agent-validator";
import type { CommandResult, FileSystem } from "../types.js";

export async function runValidate(args: {
  path: string | undefined;
  fs: FileSystem;
}): Promise<CommandResult> {
  if (!args.path) {
    return {
      kind: "failure",
      exitCode: 3,
      message: "Usage: sovereign validate <path-to-manifest.json>",
    };
  }

  let rawText: string;
  try {
    rawText = await args.fs.readTextFile(args.path);
  } catch (err) {
    return {
      kind: "failure",
      exitCode: 3,
      message: `Cannot read file: ${args.path}`,
      details: {
        cause: err instanceof Error ? err.message : String(err),
      },
    };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch (err) {
    return {
      kind: "failure",
      exitCode: 3,
      message: `File is not valid JSON: ${args.path}`,
      details: {
        cause: err instanceof Error ? err.message : String(err),
      },
    };
  }

  const result = validate(parsed);
  if (!result.valid) {
    return {
      kind: "failure",
      exitCode: 1,
      message: `${result.errors.length} validation error${result.errors.length === 1 ? "" : "s"}`,
      details: {
        errors: result.errors,
      },
    };
  }

  const m = parsed as Record<string, unknown>;
  return {
    kind: "success",
    message: "Valid SAM v1.0 manifest",
    data: {
      slug: String(m.slug ?? "—"),
      displayName: String(m.displayName ?? "—"),
      category: String(m.category ?? "—"),
      version: String(m.version ?? "—"),
    },
  };
}
