/**
 * `sovereign submit <path> [--email <addr>] [--api <url>]`
 *
 * Read + validate a SAM manifest locally, then POST it to
 * /api/creators/submit. Reuses the `validate` command for the local
 * check — single source of truth, cannot drift.
 *
 * Exit codes:
 *   0 — submission accepted (queued for review or auto-published)
 *   1 — manifest is invalid (same as validate)
 *   2 — network / server error
 *   3 — usage error
 *
 * Pure — takes FileSystem and HttpClient adapters for testability.
 */

import type { CommandResult, FileSystem, HttpClient } from "../types.js";
import { runValidate } from "./validate.js";

export const DEFAULT_API_URL = "https://sovereignmatrix.agency";

export async function runSubmit(args: {
  path: string | undefined;
  email: string | undefined;
  apiUrl: string;
  fs: FileSystem;
  http: HttpClient;
}): Promise<CommandResult> {
  // Local validation first — same rules the server applies. No network
  // call for obviously-invalid manifests.
  const local = await runValidate({ path: args.path, fs: args.fs });
  if (local.kind !== "success") return local;

  // Read the file again (validated above) — runValidate only returns
  // the summary data, not the full manifest. Small duplication here
  // in exchange for a clean contract on validate.
  let parsed: unknown;
  try {
    const raw = await args.fs.readTextFile(args.path as string);
    parsed = JSON.parse(raw);
  } catch (err) {
    return {
      kind: "failure",
      exitCode: 3,
      message: "Could not re-read manifest after validation",
      details: { cause: err instanceof Error ? err.message : String(err) },
    };
  }

  const submitUrl = new URL("/api/creators/submit", args.apiUrl).toString();
  const body = {
    manifest: parsed,
    contactEmail: args.email,
  };

  let response: { status: number; body: unknown };
  try {
    response = await args.http.postJson(submitUrl, body);
  } catch (err) {
    return {
      kind: "failure",
      exitCode: 2,
      message: `Network error talking to ${submitUrl}`,
      details: { cause: err instanceof Error ? err.message : String(err) },
    };
  }

  const rb = (typeof response.body === "object" && response.body !== null
    ? (response.body as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  if (response.status === 201 || response.status === 202) {
    return {
      kind: "success",
      message:
        response.status === 201
          ? "Agent published live"
          : "Submission accepted — queued for review",
      data: {
        httpStatus: response.status,
        referenceId: String(rb.referenceId ?? ""),
        status: String(rb.status ?? ""),
        policy: String(rb.policy ?? ""),
        reason: String(rb.reason ?? ""),
        liveUrl: rb.liveUrl ? String(rb.liveUrl) : undefined,
      },
    };
  }

  // Server returned a 4xx/5xx — surface the body for the user.
  return {
    kind: "failure",
    exitCode: response.status >= 500 ? 2 : 1,
    message: `Server rejected submission (HTTP ${response.status})`,
    details: {
      httpStatus: response.status,
      error: rb.error,
      errors: rb.errors,
    },
  };
}
