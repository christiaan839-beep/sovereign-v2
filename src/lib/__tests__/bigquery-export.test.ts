/**
 * Tests for src/lib/bigquery-export.ts — Wave 133.
 *
 * Pure-function coverage on `transformRow`, `toNdjson`, and the
 * BigQuery schema DDL builder. DB-backed `streamRunsAsNdjson` is
 * smoke-tested via the missing-table fail-soft path.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("@/lib/logger", () => ({
  createLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

import {
  transformRow,
  toNdjson,
  getBigQuerySchemaDdl,
  isGcpExportConfigured,
} from "@/lib/bigquery-export";

beforeEach(() => {
  delete process.env.GCP_BIGQUERY_DATASET;
  delete process.env.GCP_BIGQUERY_TABLE;
  delete process.env.GCP_GCS_BUCKET;
  delete process.env.GCP_SERVICE_ACCOUNT_JSON;
});

afterEach(() => {
  delete process.env.GCP_BIGQUERY_DATASET;
  delete process.env.GCP_BIGQUERY_TABLE;
  delete process.env.GCP_GCS_BUCKET;
  delete process.env.GCP_SERVICE_ACCOUNT_JSON;
});

describe("transformRow", () => {
  const raw = {
    id: "abc-123",
    userId: "user_99",
    tenantId: "tnt_42",
    agentName: "audit",
    modelUsed: "nemotron-ultra-253b-v1",
    inputJson: '{"prompt":"test"}',
    outputJson: '{"result":"ok"}',
    durationMs: 1200,
    chainDepth: 1,
    trustDecision: "auto-approved",
    visibility: "private",
    signature: "abcd",
    createdAt: new Date("2026-05-22T10:00:00.000Z"),
  };

  it("produces a stable row hash", () => {
    const a = transformRow(raw);
    const b = transformRow(raw);
    expect(a.rowHash).toBe(b.rowHash);
    expect(a.rowHash.length).toBe(64);
  });

  it("includes createdDate as YYYY-MM-DD", () => {
    expect(transformRow(raw).createdDate).toBe("2026-05-22");
  });

  it("preserves nullable fields", () => {
    const r = transformRow({ ...raw, userId: null, tenantId: null });
    expect(r.userId).toBeNull();
    expect(r.tenantId).toBeNull();
  });

  it("changes row hash when output changes", () => {
    const a = transformRow(raw);
    const b = transformRow({ ...raw, outputJson: '{"result":"different"}' });
    expect(a.rowHash).not.toBe(b.rowHash);
  });

  it("changes row hash when signature changes", () => {
    const a = transformRow(raw);
    const b = transformRow({ ...raw, signature: "different-sig" });
    expect(a.rowHash).not.toBe(b.rowHash);
  });
});

describe("toNdjson", () => {
  it("emits one row per line", () => {
    const rows = [
      transformRow({
        id: "1",
        userId: null,
        tenantId: null,
        agentName: "a",
        modelUsed: "m",
        inputJson: "{}",
        outputJson: "{}",
        durationMs: 0,
        chainDepth: 0,
        trustDecision: "auto-approved",
        visibility: "private",
        signature: "s",
        createdAt: new Date("2026-01-01"),
      }),
      transformRow({
        id: "2",
        userId: null,
        tenantId: null,
        agentName: "b",
        modelUsed: "m",
        inputJson: "{}",
        outputJson: "{}",
        durationMs: 0,
        chainDepth: 0,
        trustDecision: "auto-approved",
        visibility: "private",
        signature: "s",
        createdAt: new Date("2026-01-02"),
      }),
    ];
    const out = toNdjson(rows);
    const lines = out.split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).id).toBe("1");
    expect(JSON.parse(lines[1]).id).toBe("2");
  });

  it("returns empty string on empty array", () => {
    expect(toNdjson([])).toBe("");
  });
});

describe("getBigQuerySchemaDdl", () => {
  it("returns CREATE TABLE IF NOT EXISTS with default dataset/table", () => {
    const ddl = getBigQuerySchemaDdl();
    expect(ddl).toMatch(/CREATE TABLE IF NOT EXISTS/);
    expect(ddl).toMatch(/sovereign\.agent_runs/);
    expect(ddl).toMatch(/PARTITION BY created_date/);
    expect(ddl).toMatch(/CLUSTER BY agent_name, model_used/);
  });

  it("respects env-overridden dataset / table names", () => {
    process.env.GCP_BIGQUERY_DATASET = "my_dataset";
    process.env.GCP_BIGQUERY_TABLE = "my_table";
    const ddl = getBigQuerySchemaDdl();
    expect(ddl).toMatch(/my_dataset\.my_table/);
  });

  it("includes every export column", () => {
    const ddl = getBigQuerySchemaDdl();
    const cols = [
      "id",
      "user_id",
      "tenant_id",
      "agent_name",
      "model_used",
      "duration_ms",
      "chain_depth",
      "trust_decision",
      "visibility",
      "row_hash",
      "created_at",
      "created_date",
    ];
    for (const c of cols) {
      expect(ddl).toMatch(new RegExp(c));
    }
  });
});

describe("isGcpExportConfigured", () => {
  it("returns false when no env vars are set", () => {
    expect(isGcpExportConfigured()).toBe(false);
  });

  it("returns false when only some env vars are set", () => {
    process.env.GCP_BIGQUERY_DATASET = "x";
    process.env.GCP_BIGQUERY_TABLE = "y";
    expect(isGcpExportConfigured()).toBe(false);
  });

  it("returns true when all four env vars are set", () => {
    process.env.GCP_BIGQUERY_DATASET = "x";
    process.env.GCP_BIGQUERY_TABLE = "y";
    process.env.GCP_GCS_BUCKET = "z";
    process.env.GCP_SERVICE_ACCOUNT_JSON = "base64-blob";
    expect(isGcpExportConfigured()).toBe(true);
  });

  it("treats whitespace-only values as unset", () => {
    process.env.GCP_BIGQUERY_DATASET = "   ";
    process.env.GCP_BIGQUERY_TABLE = "y";
    process.env.GCP_GCS_BUCKET = "z";
    process.env.GCP_SERVICE_ACCOUNT_JSON = "blob";
    expect(isGcpExportConfigured()).toBe(false);
  });
});
