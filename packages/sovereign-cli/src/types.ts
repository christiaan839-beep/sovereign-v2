/**
 * Shared types for sovereign-cli commands.
 *
 * ## The Result discriminated union
 *
 * Commands never throw for expected failures — they return a
 * `CommandResult`. This means the CLI shell (cli.ts) knows exactly
 * how to format output and pick an exit code, and tests can assert
 * on the return value without wrapping in try/catch or mocking
 * process.exit.
 *
 * Unexpected failures (bugs, panics) still throw — caught at the
 * top of cli.ts and reported as exit code 1 with a stack trace.
 *
 * ## The FileSystem + HttpClient adapters
 *
 * Pure-function commands take these as parameters so tests can inject
 * in-memory fakes. The real adapters live in cli.ts and wire to
 * node:fs and global fetch respectively.
 */

/* ─── Result ──────────────────────────────────────────────────── */

export interface CommandSuccess {
  kind: "success";
  message: string;
  /** Structured data for machine-readable output (--json flag). */
  data?: Record<string, unknown>;
}

export interface CommandFailure {
  kind: "failure";
  /** UNIX-style exit code. 1 = validation, 2 = network, 3 = usage. */
  exitCode: 1 | 2 | 3;
  message: string;
  details?: Record<string, unknown>;
}

export type CommandResult = CommandSuccess | CommandFailure;

/* ─── Adapters ────────────────────────────────────────────────── */

export interface FileSystem {
  /** Read a file as UTF-8 text. Throws if missing or unreadable. */
  readTextFile(path: string): Promise<string>;
}

export interface HttpClient {
  /** POST JSON; return parsed response + status. */
  postJson(
    url: string,
    body: unknown,
  ): Promise<{ status: number; body: unknown }>;
}
