/**
 * CLI verifier integration tests.
 *
 * Spawns the actual bin/verify.mjs as a subprocess against a real
 * Ed25519-signed manifest and asserts the exit code + output shape.
 * This is the elite-tier test for the CLI — anything less (mocking
 * the spawn, faking exit codes) would let real regressions slip
 * through.
 *
 * Tests cover every path a regulator hits in 2040 when they have
 * the package, a public key, and a manifest.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import { generateKeyPairSync, sign, type KeyObject } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildSignedBundle } from "../src/bundle.js";

// Resolve the CLI binary relative to this test file. The package
// root is two parents up from tests/.
const CLI = join(__dirname, "..", "bin", "verify.mjs");

interface CliResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function runCli(args: string[], stdinData?: string): CliResult {
  const r = spawnSync("node", [CLI, ...args], {
    encoding: "utf8",
    input: stdinData,
    // 10s per CLI run is plenty; keeps a runaway test from hanging CI.
    timeout: 10_000,
  });
  return {
    status: r.status,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
}

let tmp: string;
let pemPath: string;
let manifestPath: string;
let wrongPemPath: string;
let privateKey: KeyObject;

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "vr-cli-"));
  pemPath = join(tmp, "ed25519.pem");
  wrongPemPath = join(tmp, "wrong.pem");
  manifestPath = join(tmp, "MANIFEST.signed.json");

  const { privateKey: priv, publicKey } = generateKeyPairSync("ed25519");
  privateKey = priv;
  writeFileSync(
    pemPath,
    publicKey.export({ format: "pem", type: "spki" }) as string,
  );

  // A second, unrelated keypair — used to verify the signature-mismatch path.
  const other = generateKeyPairSync("ed25519");
  writeFileSync(
    wrongPemPath,
    other.publicKey.export({ format: "pem", type: "spki" }) as string,
  );

  // Build a real signed manifest with two minimal receipt rows.
  const rows = [
    {
      id: "rcpt_cli_test_001",
      agentName: "echo",
      modelUsed: "nim-nemotron",
      durationMs: 42,
      createdAt: "2026-05-17T00:00:00.000Z",
      signature: "v2=AAAA",
      canonical: '{"v":1,"id":"rcpt_cli_test_001"}',
    },
    {
      id: "rcpt_cli_test_002",
      agentName: "echo",
      modelUsed: "nim-nemotron",
      durationMs: 73,
      createdAt: "2026-05-17T00:01:00.000Z",
      signature: "v2=BBBB",
      canonical: '{"v":1,"id":"rcpt_cli_test_002"}',
    },
  ];

  const { manifest } = buildSignedBundle(rows, (manifestHash) => {
    const sig = sign(null, Buffer.from(manifestHash, "utf8"), privateKey);
    return "v2=" + sig.toString("base64");
  });
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("verifiable-receipts CLI — happy path", () => {
  it("exits 0 on a valid manifest + correct pubkey", () => {
    const r = runCli([
      "verify",
      "--manifest",
      manifestPath,
      "--pubkey",
      pemPath,
    ]);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("MANIFEST VERIFIED");
    expect(r.stderr).toBe("");
  });

  it("emits a JSON envelope under --json", () => {
    const r = runCli([
      "verify",
      "--manifest",
      manifestPath,
      "--pubkey",
      pemPath,
      "--json",
    ]);
    expect(r.status).toBe(0);
    const body = JSON.parse(r.stdout) as {
      ok: boolean;
      receiptCount: number;
      bundleDigest: string;
      manifestHash: string;
      generatedAt: string;
    };
    expect(body.ok).toBe(true);
    expect(body.receiptCount).toBe(2);
    expect(body.bundleDigest).toMatch(/^[0-9a-f]{64}$/);
    expect(body.manifestHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("reads the manifest from stdin when --manifest is omitted", () => {
    const stdinBody = readFileSync(manifestPath, "utf8");
    const r = runCli(["verify", "--pubkey", pemPath, "--json"], stdinBody);
    expect(r.status).toBe(0);
    const body = JSON.parse(r.stdout) as { ok: boolean };
    expect(body.ok).toBe(true);
  });
});

describe("verifiable-receipts CLI — tamper detection", () => {
  it("exits 1 with hash-mismatch when a byte of the canonical content is edited", () => {
    const m = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      receipts: Array<{ id: string }>;
    };
    m.receipts[0].id = "rcpt_TAMPERED_001";
    const tamperedPath = join(tmp, "manifest-tampered.json");
    writeFileSync(tamperedPath, JSON.stringify(m, null, 2));
    const r = runCli([
      "verify",
      "--manifest",
      tamperedPath,
      "--pubkey",
      pemPath,
      "--json",
    ]);
    expect(r.status).toBe(1);
    const body = JSON.parse(r.stdout) as { ok: boolean; reason: string };
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("hash-mismatch");
  });

  it("exits 1 with signature-mismatch when the wrong pubkey is supplied", () => {
    const r = runCli([
      "verify",
      "--manifest",
      manifestPath,
      "--pubkey",
      wrongPemPath,
      "--json",
    ]);
    expect(r.status).toBe(1);
    const body = JSON.parse(r.stdout) as { ok: boolean; reason: string };
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("signature-mismatch");
  });

  it("exits 1 with wrong-type when the input is not a verifiable-receipt-bundle", () => {
    const bogus = join(tmp, "not-a-manifest.json");
    writeFileSync(bogus, JSON.stringify({ hello: "world" }));
    const r = runCli([
      "verify",
      "--manifest",
      bogus,
      "--pubkey",
      pemPath,
      "--json",
    ]);
    expect(r.status).toBe(1);
    const body = JSON.parse(r.stdout) as { ok: boolean; reason: string };
    expect(body.ok).toBe(false);
    expect(body.reason).toBe("wrong-type");
  });
});

describe("verifiable-receipts CLI — usage errors", () => {
  it("exits 2 when --pubkey is missing", () => {
    const r = runCli(["verify", "--manifest", manifestPath]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/--pubkey/);
  });

  it("exits 2 when --manifest is missing AND stdin is a TTY (no piped data)", () => {
    // We can't actually attach a TTY to spawned stdin from a test,
    // but supplying empty stdin reproduces the "no manifest data"
    // branch which is structurally equivalent — the CLI errors out
    // with a usage message rather than silently reading nothing.
    const r = runCli(["verify", "--pubkey", pemPath], "");
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/manifest/i);
  });

  it("exits 2 when --pubkey points at a missing file", () => {
    const r = runCli([
      "verify",
      "--manifest",
      manifestPath,
      "--pubkey",
      join(tmp, "does-not-exist.pem"),
    ]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/could not read --pubkey/);
  });

  it("exits 2 when --pubkey is not a valid PEM", () => {
    const garbage = join(tmp, "garbage.pem");
    writeFileSync(garbage, "this is not a pem");
    const r = runCli([
      "verify",
      "--manifest",
      manifestPath,
      "--pubkey",
      garbage,
    ]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/not a valid PEM/);
  });

  it("exits 2 when --manifest contains malformed JSON", () => {
    const bad = join(tmp, "malformed.json");
    writeFileSync(bad, "{ this is not json");
    const r = runCli(["verify", "--manifest", bad, "--pubkey", pemPath]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/parse failed/);
  });

  it("prints help and exits 0 when --help is passed", () => {
    const r = runCli(["--help"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/verifiable-receipts verify/);
    expect(r.stdout).toMatch(/Exit codes/);
  });

  it("rejects unknown subcommands with exit 2", () => {
    const r = runCli(["unknown-cmd"]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/unknown subcommand/);
  });
});
