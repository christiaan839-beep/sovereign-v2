/**
 * sign CLI integration tests.
 *
 * Spawns bin/sign.mjs as a subprocess, signs a fixture receipt body,
 * then verifies the signature locally against the public key. Tests
 * the full round-trip + the canonical-projection contract (the
 * signed bytes match what verifyInclusionProof / verifyManifest /
 * any external VAOS verifier would compute).
 *
 * Note: like witness-cli.test.ts, the subprocess-to-parent network
 * tests are sandboxed in this dev env, but THESE tests don't need
 * network — sign.mjs is a pure crypto operation. They should pass
 * everywhere.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { spawnSync } from "node:child_process";
import {
  generateKeyPairSync,
  createPublicKey,
  verify as edVerify,
} from "node:crypto";
import { mkdtempSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CLI = join(__dirname, "..", "bin", "sign.mjs");

interface CliResult {
  status: number | null;
  stdout: string;
  stderr: string;
}

function runCli(args: string[], stdinData?: string): CliResult {
  const r = spawnSync("node", [CLI, ...args], {
    encoding: "utf8",
    input: stdinData,
    timeout: 10_000,
  });
  return {
    status: r.status,
    stdout: r.stdout ?? "",
    stderr: r.stderr ?? "",
  };
}

function sortKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(value as Record<string, unknown>).sort()) {
    out[k] = sortKeysDeep((value as Record<string, unknown>)[k]);
  }
  return out;
}

function canonicalize(body: Record<string, unknown>): string {
  const copy: Record<string, unknown> = { ...body };
  delete copy.signature;
  return JSON.stringify(sortKeysDeep(copy));
}

let tmp: string;
let keyPath: string;
let inputPath: string;
let outPath: string;
let privateKey: ReturnType<typeof generateKeyPairSync>["privateKey"];

const FIXTURE_BODY = {
  v: 1,
  id: "rcpt_sign_test_001",
  agentName: "echo",
  modelUsed: "nim",
  input: { prompt: "hello" },
  output: { text: "hello" },
  safetyResult: { passed: true, score: 1 },
  durationMs: 5,
  createdAt: "2026-05-17T00:00:00.000Z",
};

beforeAll(() => {
  tmp = mkdtempSync(join(tmpdir(), "vr-sign-"));
  keyPath = join(tmp, "ed25519.pem");
  inputPath = join(tmp, "body.json");
  outPath = join(tmp, "signed.json");
  const kp = generateKeyPairSync("ed25519");
  privateKey = kp.privateKey;
  writeFileSync(
    keyPath,
    kp.privateKey.export({ format: "pem", type: "pkcs8" }) as string,
  );
  writeFileSync(inputPath, JSON.stringify(FIXTURE_BODY));
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

describe("sign CLI — argv parsing", () => {
  it("--help prints usage + exits 0", () => {
    const r = runCli(["--help"]);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/verifiable-receipts-sign/);
    expect(r.stdout).toMatch(/Exit codes/);
  });

  it("exits 2 when --key is missing", () => {
    const r = runCli(["--input", inputPath]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/--key/);
  });

  it("exits 2 when --key points at a missing file", () => {
    const r = runCli([
      "--input",
      inputPath,
      "--key",
      join(tmp, "does-not-exist.pem"),
    ]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/could not load --key/);
  });
});

describe("sign CLI — signs a real VAOS v2 receipt", () => {
  it("writes a signed receipt that round-trips against Ed25519 verify", () => {
    const r = runCli([
      "--input",
      inputPath,
      "--key",
      keyPath,
      "--out",
      outPath,
    ]);
    expect(r.status).toBe(0);

    const signed = JSON.parse(readFileSync(outPath, "utf8")) as Record<
      string,
      unknown
    > & { signature: string };
    expect(typeof signed.signature).toBe("string");
    expect(signed.signature.startsWith("v2=")).toBe(true);

    // Recompute the canonical projection and Ed25519-verify
    const canonical = canonicalize(signed);
    const sigBytes = Buffer.from(signed.signature.slice(3), "base64");
    const pubKey = createPublicKey(privateKey);
    const ok = edVerify(null, Buffer.from(canonical, "utf8"), pubKey, sigBytes);
    expect(ok).toBe(true);
  });

  it("preserves all original receipt fields", () => {
    const r = runCli([
      "--input",
      inputPath,
      "--key",
      keyPath,
      "--out",
      outPath,
    ]);
    expect(r.status).toBe(0);
    const signed = JSON.parse(readFileSync(outPath, "utf8")) as Record<
      string,
      unknown
    >;
    for (const k of Object.keys(FIXTURE_BODY)) {
      expect(signed[k]).toEqual(
        FIXTURE_BODY[k as keyof typeof FIXTURE_BODY] as unknown,
      );
    }
  });

  it("removes any pre-existing signature before signing", () => {
    // If the caller hands us a body that already has a signature
    // field, that field MUST be stripped before canonicalization —
    // otherwise the signature would be over a payload that includes
    // a stale signature, which can't be reproduced by any verifier.
    const dirtyInput = join(tmp, "dirty-body.json");
    writeFileSync(
      dirtyInput,
      JSON.stringify({ ...FIXTURE_BODY, signature: "v2=stale" }),
    );
    const r = runCli([
      "--input",
      dirtyInput,
      "--key",
      keyPath,
      "--out",
      outPath,
    ]);
    expect(r.status).toBe(0);
    const signed = JSON.parse(readFileSync(outPath, "utf8")) as Record<
      string,
      unknown
    > & { signature: string };
    // The signature must be over the SAME canonical as the fixture
    // (with no signature field) so it verifies against the same key.
    const canonical = canonicalize(signed);
    expect(canonical).toBe(canonicalize(FIXTURE_BODY));
    const ok = edVerify(
      null,
      Buffer.from(canonical, "utf8"),
      createPublicKey(privateKey),
      Buffer.from(signed.signature.slice(3), "base64"),
    );
    expect(ok).toBe(true);
  });

  it("reads body from stdin when --input is omitted", () => {
    const r = runCli(
      ["--key", keyPath, "--json"],
      JSON.stringify(FIXTURE_BODY),
    );
    expect(r.status).toBe(0);
    const signed = JSON.parse(r.stdout.trim()) as Record<string, unknown> & {
      signature: string;
    };
    expect(signed.signature.startsWith("v2=")).toBe(true);
    const ok = edVerify(
      null,
      Buffer.from(canonicalize(signed), "utf8"),
      createPublicKey(privateKey),
      Buffer.from(signed.signature.slice(3), "base64"),
    );
    expect(ok).toBe(true);
  });

  it("rejects non-JSON input with exit 2", () => {
    const garbage = join(tmp, "garbage.txt");
    writeFileSync(garbage, "this is not json {");
    const r = runCli(["--input", garbage, "--key", keyPath, "--out", outPath]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/not valid JSON/);
  });

  it("rejects non-object JSON (array or primitive) with exit 2", () => {
    const arrInput = join(tmp, "array.json");
    writeFileSync(arrInput, JSON.stringify(["not", "an", "object"]));
    const r = runCli(["--input", arrInput, "--key", keyPath]);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/object/i);
  });
});
