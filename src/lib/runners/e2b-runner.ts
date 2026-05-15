/**
 * SOVEREIGN MATRIX — e2b sandbox runner (Cook 78)
 *
 * Concrete adapter that turns the Cook 54 `SandboxRunner` contract
 * into HTTP calls against the e2b.dev REST API. Pure function — no
 * state. Caller wires it into the registry once at app start.
 *
 * Falls back to a no-op runner when `E2B_API_KEY` is absent so the
 * tool can still be exercised in tests + dev without an account.
 */

import type {
  SandboxRequest,
  SandboxResult,
  SandboxRunner,
} from "@/lib/tools/code-sandbox";

const E2B_API = "https://api.e2b.dev";

function template(language: SandboxRequest["language"]): string {
  switch (language) {
    case "python":
      return "python-3.11";
    case "node":
      return "node-20";
    case "bash":
    default:
      return "base";
  }
}

/** Build the production runner. Returns a no-op when not configured. */
export function buildE2bRunner(): SandboxRunner {
  const key = process.env.E2B_API_KEY;
  if (!key) {
    return async (req): Promise<SandboxResult> => ({
      language: req.language,
      exitCode: 0,
      stdout: "",
      stderr:
        "e2b runner not configured — set E2B_API_KEY to enable code execution",
      durationMs: 0,
      timedOut: false,
    });
  }
  return async (req): Promise<SandboxResult> => {
    const start = Date.now();
    const controller =
      typeof AbortController !== "undefined" ? new AbortController() : null;
    const timeout = controller
      ? setTimeout(() => controller.abort(), req.timeoutMs ?? 30_000)
      : null;
    try {
      const res = await fetch(`${E2B_API}/v1/sandboxes/run`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
          template: template(req.language),
          code: req.code,
          stdin: req.stdin ?? "",
          timeoutMs: req.timeoutMs ?? 30_000,
          // e2b respects this; production wires the per-template default.
          allowNetwork: req.allowNetwork ?? false,
        }),
        signal: controller?.signal,
      });
      if (!res.ok) {
        return {
          language: req.language,
          exitCode: -1,
          stdout: "",
          stderr: `e2b API returned ${res.status}: ${await res.text()}`,
          durationMs: Date.now() - start,
          timedOut: false,
        };
      }
      const data = (await res.json()) as {
        stdout?: string;
        stderr?: string;
        exitCode?: number;
        timedOut?: boolean;
      };
      return {
        language: req.language,
        exitCode: data.exitCode ?? 0,
        stdout: data.stdout ?? "",
        stderr: data.stderr ?? "",
        durationMs: Date.now() - start,
        timedOut: data.timedOut === true,
      };
    } catch (err) {
      const aborted = err instanceof Error && err.name === "AbortError";
      return {
        language: req.language,
        exitCode: -1,
        stdout: "",
        stderr: err instanceof Error ? err.message : String(err),
        durationMs: Date.now() - start,
        timedOut: aborted,
      };
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  };
}
