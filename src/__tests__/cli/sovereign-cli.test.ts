/**
 * Tests for the sovereign CLI (cli/sovereign.mjs).
 *
 * Scope: only the no-network cases — help text, argument parsing, and
 * invalid-id rejection. The CLI is a thin shell over /api/agent-runs/[id]
 * + /api/verify, both of which have direct integration tests. Spinning
 * up a mock HTTP server inside vitest + spawning child processes per
 * test is too brittle (flaky on slow CI runners — verified).
 *
 * What we DO cover:
 *   - bin script is executable from a clean shell
 *   - --help / -h prints usage and exits 0
 *   - unknown command exits 2
 *   - invalid receipt id exits 2 before any fetch
 *   - no args prints usage and exits 1
 *
 * What we deliberately don't cover here:
 *   - verify happy path (covered: /api/verify happy-path test)
 *   - tampered detection (covered: /api/verify tamper test)
 *   - feed parsing (covered: /r/feed.xml direct tests)
 *   - --json shape (covered: client.test.ts shape pinning)
 */
import { describe, it, expect } from "vitest";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";

const CLI_PATH = resolve(__dirname, "../../../cli/sovereign.mjs");

function runCli(args: string[]) {
  return spawnSync("node", [CLI_PATH, ...args], {
    encoding: "utf8",
    timeout: 5000,
  });
}

describe("sovereign CLI — argument handling", () => {
  it("no args prints usage + exits 1", () => {
    const r = runCli([]);
    expect(r.status).toBe(1);
    expect(r.stdout).toMatch(/Usage:/);
    expect(r.stdout).toMatch(/verify/);
  });

  it("--help exits 0 with usage", () => {
    const r = runCli(["--help"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/sovereign/i);
    expect(r.stdout).toMatch(/Usage:/);
  });

  it("-h short flag also exits 0 with usage", () => {
    const r = runCli(["-h"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/Usage:/);
  });

  it("help subcommand exits 0", () => {
    const r = runCli(["help"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/Usage:/);
  });

  it("unknown command exits 2 with error", () => {
    const r = runCli(["bogus-command"]);
    expect(r.status).toBe(2);
    expect((r.stderr ?? "") + (r.stdout ?? "")).toMatch(/unknown command/i);
  });

  it("verify with invalid id exits 2 BEFORE hitting the network", () => {
    const r = runCli(["verify", "not-a-uuid"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/not a valid receipt id/);
  });

  it("verify with no id exits 2", () => {
    const r = runCli(["verify"]);
    expect(r.status).toBe(2);
  });

  it("show with invalid id exits 2", () => {
    const r = runCli(["show", "garbage-id"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/not a valid receipt id/);
  });
});
