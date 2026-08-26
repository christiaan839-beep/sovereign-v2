/**
 * MCP protocol tests, driven through the real `serve()` transport.
 *
 * These exercise the wire path rather than calling the tool functions
 * directly, because the bugs that actually break an MCP integration
 * live in the transport: answering a notification, botching version
 * negotiation, interleaving responses. The upstream server this was
 * extracted from had no tests and shipped the first two.
 */

import { describe, it, expect } from "vitest";
import { PassThrough } from "node:stream";
import { generateKeyPairSync, sign as edSign } from "node:crypto";
import { serve } from "../src/mcp.js";
import { mintMessageReceipt } from "../src/anthropic.js";
import { euAiActPack, composePacks } from "../src/packs.js";

interface Rpc {
  jsonrpc: "2.0";
  id?: string | number | null;
  result?: any;
  error?: { code: number; message: string };
}

/** Send lines through a live server; resolve with the responses it wrote. */
async function exchange(lines: string[]): Promise<Rpc[]> {
  const stdin = new PassThrough();
  const written: string[] = [];
  const stdout = { write: (c: string) => void written.push(c) };

  const closed = new Promise<void>((resolve) => {
    serve(stdin, stdout, resolve);
  });
  for (const line of lines) stdin.write(line + "\n");
  stdin.end();
  await closed;

  return written
    .join("")
    .split("\n")
    .filter((l) => l.trim())
    .map((l) => JSON.parse(l) as Rpc);
}

const req = (id: number | string, method: string, params?: unknown): string =>
  JSON.stringify({ jsonrpc: "2.0", id, method, params });

describe("MCP handshake", () => {
  it("echoes a protocol version it supports", async () => {
    const [res] = await exchange([
      req(1, "initialize", { protocolVersion: "2025-03-26" }),
    ]);
    expect(res?.result.protocolVersion).toBe("2025-03-26");
    expect(res?.result.serverInfo.name).toBe("ai-act-receipts");
    expect(res?.result.capabilities.tools).toBeDefined();
  });

  it("falls back to its newest version for an unknown one", async () => {
    const [res] = await exchange([
      req(1, "initialize", { protocolVersion: "1999-01-01" }),
    ]);
    expect(res?.result.protocolVersion).toBe("2025-06-18");
  });

  it("initializes when the client sends no version at all", async () => {
    const [res] = await exchange([req(1, "initialize")]);
    expect(res?.result.protocolVersion).toBe("2025-06-18");
  });

  it("never answers a notification", async () => {
    // `notifications/initialized` arrives right after the handshake and
    // carries no id. Replying to it is a JSON-RPC violation; strict
    // clients drop the connection. The upstream server replied with
    // "Method not found".
    const out = await exchange([
      req(1, "initialize", {}),
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }),
      req(2, "ping"),
    ]);
    expect(out.map((r) => r.id)).toEqual([1, 2]);
  });
});

describe("MCP dispatch", () => {
  it("lists exactly the three tools, each with a schema", async () => {
    const [res] = await exchange([req(1, "tools/list")]);
    const names = res?.result.tools.map((t: { name: string }) => t.name);
    expect(names).toEqual([
      "project_records",
      "verify_receipt",
      "build_annex_iv",
    ]);
    for (const t of res?.result.tools) {
      expect(t.inputSchema.type).toBe("object");
      expect(t.description.length).toBeGreaterThan(40);
    }
  });

  it("answers unknown methods with -32601, not a crash", async () => {
    const [res] = await exchange([req(1, "resources/list")]);
    expect(res?.error?.code).toBe(-32601);
  });

  it("reports a parse error without an id and keeps serving", async () => {
    const out = await exchange(["{not json", req(2, "ping")]);
    expect(out[0]?.error?.code).toBe(-32700);
    expect(out[0]?.id).toBeNull();
    expect(out[1]?.id).toBe(2);
  });

  it("rejects tools/call without a tool name", async () => {
    const [res] = await exchange([req(1, "tools/call", { arguments: {} })]);
    expect(res?.error?.code).toBe(-32602);
  });

  it("preserves request order across many calls", async () => {
    const lines = Array.from({ length: 25 }, (_, i) => req(i, "ping"));
    const out = await exchange(lines);
    expect(out.map((r) => r.id)).toEqual([...Array(25).keys()]);
  });
});

describe("project_records over MCP", () => {
  it("projects rows and surfaces the skip report", async () => {
    const [res] = await exchange([
      req(1, "tools/call", {
        name: "project_records",
        arguments: {
          rows: [
            { id: "a", ts: "2026-03-01T00:00:00Z", status: "ok" },
            { ts: "2026-03-01T00:00:00Z" },
          ],
        },
      }),
    ]);
    const payload = JSON.parse(res?.result.content[0].text);
    expect(payload.records).toHaveLength(1);
    expect(payload.skipped).toHaveLength(1);
    expect(payload.scanned).toBe(2);
  });

  it("returns isError for a non-array rows argument", async () => {
    const [res] = await exchange([
      req(1, "tools/call", {
        name: "project_records",
        arguments: { rows: "nope" },
      }),
    ]);
    expect(res?.result.isError).toBe(true);
  });
});

describe("verify_receipt over MCP", () => {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const publicKeyPem = publicKey
    .export({ type: "spki", format: "pem" })
    .toString();
  const signer = (canonical: string): string =>
    "v2=" + edSign(null, Buffer.from(canonical), privateKey).toString("base64");

  const mint = () =>
    mintMessageReceipt(
      {
        id: "msg_1",
        model: "claude-opus-5",
        content: [{ type: "text", text: "hello" }],
      },
      {
        sign: signer,
        agentSlug: "test",
        runId: "run_1",
        rules: composePacks(euAiActPack),
      },
    );

  it("verifies a genuine attestation", async () => {
    const attestation = await mint();
    const [res] = await exchange([
      req(1, "tools/call", {
        name: "verify_receipt",
        arguments: { attestation, publicKeyPem },
      }),
    ]);
    expect(JSON.parse(res?.result.content[0].text)).toEqual({ ok: true });
  });

  it("names the reason when the envelope was altered", async () => {
    const attestation = await mint();
    const tampered = { ...attestation, overall: "pass" as const, issuedAt: "2000-01-01T00:00:00.000Z" };
    const [res] = await exchange([
      req(1, "tools/call", {
        name: "verify_receipt",
        arguments: { attestation: tampered, publicKeyPem },
      }),
    ]);
    const out = JSON.parse(res?.result.content[0].text);
    expect(out.ok).toBe(false);
    expect(out.reason).toBe("canonical-mismatch");
  });

  it("fails closed against the wrong key", async () => {
    const attestation = await mint();
    const other = generateKeyPairSync("ed25519")
      .publicKey.export({ type: "spki", format: "pem" })
      .toString();
    const [res] = await exchange([
      req(1, "tools/call", {
        name: "verify_receipt",
        arguments: { attestation, publicKeyPem: other },
      }),
    ]);
    const out = JSON.parse(res?.result.content[0].text);
    expect(out.ok).toBe(false);
    expect(out.reason).toBe("signature-mismatch");
  });

  it("rejects a malformed public key without throwing", async () => {
    const attestation = await mint();
    const [res] = await exchange([
      req(1, "tools/call", {
        name: "verify_receipt",
        arguments: { attestation, publicKeyPem: "BEGIN nonsense" },
      }),
    ]);
    expect(res?.result.isError).toBe(true);
  });
});

describe("build_annex_iv over MCP", () => {
  const system = {
    name: "Acme Prior-Auth Reviewer",
    identifier: "acme-pa-001",
    riskCategory: "high-risk" as const,
    provider: "Acme Health",
    intendedPurpose: "Assist clinicians in prior-authorisation review.",
    placedOnMarketAt: "2026-03-01",
  };
  const records = [
    { verdictId: "v1", overall: "pass" as const, issuedAt: "2026-03-01T00:00:00Z" },
    { verdictId: "v2", overall: "block" as const, issuedAt: "2026-03-02T00:00:00Z" },
  ];

  it("emits Markdown that names the regulation and the operator gaps", async () => {
    const [res] = await exchange([
      req(1, "tools/call", {
        name: "build_annex_iv",
        arguments: { system, records },
      }),
    ]);
    const md = res?.result.content[0].text as string;
    expect(md).toContain("Annex IV");
    expect(md).toContain("2024/1689");
    expect(md).toContain("Acme Prior-Auth Reviewer");
    // The honesty contract: sections a machine cannot fill are marked.
    expect(md).toContain("OPERATOR-AUTHORED");
  });

  it("emits JSON on request", async () => {
    const [res] = await exchange([
      req(1, "tools/call", {
        name: "build_annex_iv",
        arguments: { system, records, format: "json" },
      }),
    ]);
    const report = JSON.parse(res?.result.content[0].text);
    expect(report.schema).toBe("vaos-annex-iv-v1");
  });

  it("returns isError rather than a half-built report on bad input", async () => {
    const [res] = await exchange([
      req(1, "tools/call", {
        name: "build_annex_iv",
        arguments: { system, records: "not an array" },
      }),
    ]);
    expect(res?.result.isError).toBe(true);
  });
});
