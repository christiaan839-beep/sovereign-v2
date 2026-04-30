/**
 * Default subprocess runner for the Aider Edge Node.
 *
 * Isolated in its own file because it's the only place in the
 * codebase that uses node:child_process for this Edge Node. Tests
 * inject a mock AiderSubprocessRunner instead of importing this
 * module — that way the spawn import never reaches the test process.
 *
 * SAFETY:
 *   - Uses spawn (not exec / shell) with shell:false so args go
 *     straight to the OS without shell metacharacter interpretation.
 *   - Hard timeout via setTimeout → SIGTERM, then SIGKILL after 5s
 *     if the child is still alive.
 *   - stdout/stderr buffers capped at 1 MB each. Aider's normal
 *     output is well under this; large diffs are flushed by Aider
 *     itself to file.
 *   - stdin set to "ignore" — Aider won't get an interactive prompt
 *     stream and falls through to --yes-always.
 */

import { spawn } from "node:child_process";
import type {
  AiderSubprocessRunner,
  AiderSubprocessRunResult,
} from "./aider-software-engineer";

const MAX_OUTPUT_BYTES = 1_000_000;
const SIGKILL_GRACE_MS = 5_000;

export const defaultAiderRunner: AiderSubprocessRunner = {
  async run({ command, args, cwd, timeoutMs, env }) {
    const start = Date.now();
    return new Promise<AiderSubprocessRunResult>((resolvePromise) => {
      const child = spawn(command, args, {
        cwd,
        env: env ?? process.env,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });

      const stdoutChunks: Buffer[] = [];
      const stderrChunks: Buffer[] = [];
      let stdoutBytes = 0;
      let stderrBytes = 0;
      let timedOut = false;

      child.stdout?.on("data", (chunk: Buffer) => {
        if (stdoutBytes < MAX_OUTPUT_BYTES) {
          stdoutChunks.push(chunk);
          stdoutBytes += chunk.length;
        }
      });
      child.stderr?.on("data", (chunk: Buffer) => {
        if (stderrBytes < MAX_OUTPUT_BYTES) {
          stderrChunks.push(chunk);
          stderrBytes += chunk.length;
        }
      });

      const termTimer = setTimeout(() => {
        timedOut = true;
        try {
          child.kill("SIGTERM");
        } catch {
          // child may already have exited
        }
        setTimeout(() => {
          try {
            child.kill("SIGKILL");
          } catch {
            // ignored
          }
        }, SIGKILL_GRACE_MS);
      }, timeoutMs);

      child.on("error", (err) => {
        clearTimeout(termTimer);
        resolvePromise({
          exitCode: 127,
          stdout: Buffer.concat(stdoutChunks).toString("utf8"),
          stderr: `spawn error: ${err.message}`,
          timedOut: false,
          durationMs: Date.now() - start,
        });
      });

      child.on("close", (code) => {
        clearTimeout(termTimer);
        resolvePromise({
          exitCode: typeof code === "number" ? code : 1,
          stdout: Buffer.concat(stdoutChunks).toString("utf8"),
          stderr: Buffer.concat(stderrChunks).toString("utf8"),
          timedOut,
          durationMs: Date.now() - start,
        });
      });
    });
  },
};
