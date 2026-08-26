#!/usr/bin/env node
/**
 * MCP server — three composable tools over stdio.
 *
 *   project_records   arbitrary log rows  → ReceiptRecord[] + skip report
 *   verify_receipt    signed attestation  → ok / the reason it failed
 *   build_annex_iv    ReceiptRecord[]     → EU AI Act Annex IV Markdown
 *
 * They compose in that order, which is the whole workflow: point it at
 * logs you already have, verify whatever was signed, hand a regulator
 * the document. Nothing here calls the network or touches disk outside
 * paths you pass it.
 *
 * Wire format: JSON-RPC 2.0 over stdio, newline-delimited, per the
 * Model Context Protocol specification. No SDK dependency — the
 * protocol is small enough that a dependency costs more than it saves,
 * and an auditor can read this file end to end.
 *
 * Register it with Claude Code / Claude Desktop:
 *
 *   {
 *     "mcpServers": {
 *       "ai-act-receipts": {
 *         "command": "npx",
 *         "args": ["-y", "ai-act-receipts"]
 *       }
 *     }
 *   }
 *
 * @packageDocumentation
 */

import { createPublicKey, verify as edVerify } from "node:crypto";
import { buildAnnexIv, toMarkdown, type SystemDescription } from "./annex-iv.js";
import { verifyGuardianAttestation, type GuardianAttestation } from "./guardian.js";
import { projectRecords, type ProjectOptions } from "./project.js";
import type { ReceiptRecord } from "./types.js";

const SERVER_NAME = "ai-act-receipts";
const SERVER_VERSION = "0.1.0";

/**
 * MCP revisions this server implements, newest first.
 *
 * Negotiation per spec: echo the client's version when we support it,
 * otherwise answer with our newest and let the client decide. Revisit
 * this list when the specification publishes a new revision — a stale
 * list is the most common reason a working server stops connecting.
 */
const SUPPORTED_PROTOCOL_VERSIONS = [
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
] as const;

// ── JSON-RPC types ──────────────────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: "2.0";
  /** Absent on notifications, which MUST NOT be answered. */
  id?: string | number;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id?: string | number | null;
  result?: unknown;
  error?: { code: number; message: string };
}

interface ToolResult {
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

const ok = (text: string): ToolResult => ({ content: [{ type: "text", text }] });
const fail = (text: string): ToolResult => ({
  content: [{ type: "text", text }],
  isError: true,
});

// ── Tool declarations ───────────────────────────────────────────────

const TOOLS = [
  {
    name: "project_records",
    description:
      "Turn AI call logs you already have into the record shape the Annex IV exporter reads. " +
      "Accepts any array of JSON objects; auto-detects common id / timestamp / outcome field names, " +
      "or takes an explicit mapping. Reports every row it could not project and why — it never drops " +
      "a row silently. Projected records are NOT signed and carry no cryptographic weight.",
    inputSchema: {
      type: "object",
      properties: {
        rows: {
          type: "array",
          description: "The log rows, as an array of JSON objects.",
        },
        id: {
          type: "string",
          description:
            "Field name (or dotted path) holding the unique id. Auto-detected when omitted.",
        },
        issuedAt: {
          type: "string",
          description:
            "Field name holding the timestamp. ISO strings, Dates, and epoch s/ms/us are all accepted.",
        },
        verdict: {
          type: "string",
          description:
            "Field name holding the outcome. Common vocabularies (ok/success/denied/...) are normalised.",
        },
        agentSlug: {
          type: "string",
          description: "Field name holding the agent or model name.",
        },
        carry: {
          type: "array",
          items: { type: "string" },
          description: "Extra field names to preserve on each record.",
        },
      },
      required: ["rows"],
    },
  },
  {
    name: "verify_receipt",
    description:
      "Re-verify a signed Guardian attestation against an Ed25519 public key. Re-derives the canonical " +
      "projection, re-checks the SHA-256 content hash, then checks the signature. Returns the specific " +
      "reason on failure (canonical-mismatch / hash-mismatch / signature-mismatch) rather than a bare false.",
    inputSchema: {
      type: "object",
      properties: {
        attestation: {
          type: "object",
          description:
            "The signed attestation, as returned by mintMessageReceipt().",
        },
        publicKeyPem: {
          type: "string",
          description: "Ed25519 public key in PEM (SPKI) format.",
        },
      },
      required: ["attestation", "publicKeyPem"],
    },
  },
  {
    name: "build_annex_iv",
    description:
      "Generate EU AI Act Annex IV technical documentation (Article 11, Regulation (EU) 2024/1689) from " +
      "a set of records. Populates the sections evidence can mechanically support (§3 monitoring, §4 " +
      "performance, §6 lifecycle changes, §9 post-market monitoring) and emits explicit OPERATOR-AUTHORED " +
      "stubs for the sections that require a human (§1, §2, §5, §7, §8). This produces documentation; " +
      "it does not make anyone compliant.",
    inputSchema: {
      type: "object",
      properties: {
        system: {
          type: "object",
          description:
            "The AI system: name, identifier, riskCategory, provider, intendedPurpose, placedOnMarketAt.",
        },
        records: {
          type: "array",
          description:
            "ReceiptRecords — from project_records, or minted directly.",
        },
        format: {
          type: "string",
          enum: ["markdown", "json"],
          description: "Output format. Defaults to markdown.",
        },
        nextReportDue: {
          type: "string",
          description:
            "ISO 8601 date the next post-market monitoring report is due (typically +90 days).",
        },
        operatorActions: {
          type: "array",
          items: { type: "string" },
          description:
            "Actions the operator took in response to anomalies, for §9.",
        },
      },
      required: ["system", "records"],
    },
  },
] as const;

// ── Tool dispatch ───────────────────────────────────────────────────

async function callTool(
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  try {
    switch (name) {
      case "project_records": {
        const rows = args.rows;
        if (!Array.isArray(rows)) return fail("`rows` must be an array.");
        const opts: ProjectOptions = {};
        if (typeof args.id === "string") opts.id = args.id;
        if (typeof args.issuedAt === "string") opts.issuedAt = args.issuedAt;
        if (typeof args.verdict === "string") opts.verdict = args.verdict;
        if (typeof args.agentSlug === "string") opts.agentSlug = args.agentSlug;
        if (Array.isArray(args.carry)) {
          opts.carry = args.carry.filter(
            (c): c is string => typeof c === "string",
          );
        }
        const result = projectRecords(rows, opts);
        return ok(JSON.stringify(result, null, 2));
      }

      case "verify_receipt": {
        const attestation = args.attestation as GuardianAttestation | undefined;
        const pem = args.publicKeyPem;
        if (!attestation || typeof attestation !== "object") {
          return fail("`attestation` must be the signed attestation object.");
        }
        if (typeof pem !== "string" || !pem.includes("BEGIN")) {
          return fail("`publicKeyPem` must be an Ed25519 public key in PEM form.");
        }
        let key;
        try {
          key = createPublicKey({ key: pem, format: "pem" });
        } catch (e) {
          return fail(
            `Could not read the public key: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
        const result = verifyGuardianAttestation(attestation, (canonical, sig) => {
          // Wire form is `v2=<base64>`; tolerate a bare base64 signature.
          const b64 = sig.startsWith("v2=") ? sig.slice(3) : sig;
          try {
            return edVerify(
              null,
              Buffer.from(canonical, "utf8"),
              key,
              Buffer.from(b64, "base64"),
            );
          } catch {
            return false;
          }
        });
        return ok(JSON.stringify(result, null, 2));
      }

      case "build_annex_iv": {
        const system = args.system as SystemDescription | undefined;
        const records = args.records;
        if (!system || typeof system !== "object") {
          return fail("`system` must describe the AI system.");
        }
        if (!Array.isArray(records)) return fail("`records` must be an array.");
        const report = buildAnnexIv({
          system,
          receipts: records as ReceiptRecord[],
          nextReportDue:
            typeof args.nextReportDue === "string"
              ? args.nextReportDue
              : undefined,
          operatorActions: Array.isArray(args.operatorActions)
            ? args.operatorActions.filter(
                (a): a is string => typeof a === "string",
              )
            : undefined,
        });
        return ok(
          args.format === "json"
            ? JSON.stringify(report, null, 2)
            : toMarkdown(report),
        );
      }

      default:
        return fail(`Unknown tool: ${name}`);
    }
  } catch (e) {
    return fail(`Tool error: ${e instanceof Error ? e.message : String(e)}`);
  }
}

// ── JSON-RPC dispatch ───────────────────────────────────────────────

/**
 * Handle one request.
 *
 * Returns `null` for anything that must not be answered — every
 * notification (no `id`), including `notifications/initialized`, which
 * clients send immediately after the handshake. Answering a
 * notification is a JSON-RPC protocol violation, and strict clients
 * drop the connection over it.
 */
async function handleRequest(
  req: JsonRpcRequest,
): Promise<JsonRpcResponse | null> {
  const isNotification = req.id === undefined || req.id === null;
  if (isNotification) return null;
  const id = req.id;

  switch (req.method) {
    case "initialize": {
      const requested = (req.params as { protocolVersion?: string } | undefined)
        ?.protocolVersion;
      const protocolVersion =
        requested &&
        (SUPPORTED_PROTOCOL_VERSIONS as readonly string[]).includes(requested)
          ? requested
          : SUPPORTED_PROTOCOL_VERSIONS[0];
      return {
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion,
          serverInfo: { name: SERVER_NAME, version: SERVER_VERSION },
          capabilities: { tools: {} },
        },
      };
    }

    case "tools/list":
      return { jsonrpc: "2.0", id, result: { tools: TOOLS } };

    case "tools/call": {
      const params = (req.params ?? {}) as {
        name?: string;
        arguments?: Record<string, unknown>;
      };
      if (typeof params.name !== "string") {
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32602, message: "tools/call requires a tool name" },
        };
      }
      const result = await callTool(params.name, params.arguments ?? {});
      return { jsonrpc: "2.0", id, result };
    }

    case "ping":
      return { jsonrpc: "2.0", id, result: {} };

    default:
      return {
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${req.method}` },
      };
  }
}

// ── stdio transport ─────────────────────────────────────────────────

/**
 * Drive the server over a newline-delimited JSON-RPC stream.
 *
 * Exported so the test suite can exercise the real protocol path
 * rather than a mock of it.
 */
export function serve(
  stdin: NodeJS.ReadableStream,
  stdout: { write(chunk: string): unknown },
  onClose?: () => void,
): void {
  let buffer = "";
  // Requests are processed strictly in arrival order. Without this,
  // a second `data` event can begin handling line N+1 while line N is
  // still awaiting, and responses interleave.
  let queue: Promise<void> = Promise.resolve();

  const enqueue = (line: string): void => {
    queue = queue.then(async () => {
      let req: JsonRpcRequest;
      try {
        req = JSON.parse(line) as JsonRpcRequest;
      } catch (e) {
        stdout.write(
          JSON.stringify({
            jsonrpc: "2.0",
            id: null,
            error: {
              code: -32700,
              message: `Parse error: ${e instanceof Error ? e.message : String(e)}`,
            },
          } satisfies JsonRpcResponse) + "\n",
        );
        return;
      }
      const res = await handleRequest(req);
      if (res !== null) stdout.write(JSON.stringify(res) + "\n");
    });
  };

  stdin.setEncoding("utf-8");
  stdin.on("data", (chunk: string | Buffer) => {
    buffer += typeof chunk === "string" ? chunk : chunk.toString("utf-8");
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl).trim();
      buffer = buffer.slice(nl + 1);
      if (line) enqueue(line);
    }
  });

  stdin.on("end", () => {
    void queue.then(() => onClose?.());
  });
}

// Only take over stdio when run as a binary, not when imported by tests.
if (process.argv[1] && /ai-act-receipts|mcp\.(js|ts)$/.test(process.argv[1])) {
  serve(process.stdin, process.stdout, () => process.exit(0));
  process.on("uncaughtException", (e) => {
    // stderr, never stdout — stdout is the protocol channel.
    process.stderr.write(`fatal: ${e.message}\n`);
    process.exit(1);
  });
}
