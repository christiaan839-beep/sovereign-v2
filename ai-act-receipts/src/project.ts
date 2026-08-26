/**
 * Project logs you already have into `ReceiptRecord`s.
 *
 * The reason this file exists: every compliance tool that requires you
 * to adopt its format first is a tool nobody adopts. You already have
 * AI call logs — in Postgres, in CloudWatch, in an OpenTelemetry
 * collector, in a JSONL file. This turns those rows into the shape the
 * Annex IV exporter reads, without you writing a mapper by hand.
 *
 * IMPORTANT — projected records are NOT cryptographic evidence.
 *
 * A record minted by `mintMessageReceipt()` carries a signature over a
 * canonical projection: a third party can re-derive it and prove it was
 * not altered. A record projected from a log carries no such proof — it
 * asserts only what your logging pipeline asserted. Both are legitimate
 * inputs to Annex IV documentation; they are not equal in evidentiary
 * weight, and the generated report distinguishes them. Do not describe
 * projected records as signed, verified, or tamper-evident.
 *
 * @packageDocumentation
 */

import type { ReceiptRecord, Verdict } from "./types.js";

/** Pull a value from a row: by key, by dotted path, or by function. */
export type FieldSource = string | ((row: Record<string, unknown>) => unknown);

export interface ProjectOptions {
  /** Where the unique id lives. Auto-detected when omitted. */
  id?: FieldSource;
  /** Where the ISO 8601 timestamp lives. Auto-detected when omitted. */
  issuedAt?: FieldSource;
  /** Where the outcome lives. Defaults to `pass` when absent. */
  verdict?: FieldSource;
  /** Where the agent / system name lives. Auto-detected when omitted. */
  agentSlug?: FieldSource;
  /** Extra field names to carry onto the record verbatim. */
  carry?: string[];
  /**
   * What to do with a row missing an id or a usable timestamp.
   * `"skip"` (default) collects it in `skipped`; `"throw"` aborts.
   */
  onInvalid?: "skip" | "throw";
}

export interface SkippedRow {
  /** Index in the input array. */
  index: number;
  /** Why this row could not be projected. */
  reason: string;
}

export interface ProjectionResult {
  records: ReceiptRecord[];
  /** Every row that could not be projected, and why. Never silent. */
  skipped: SkippedRow[];
  /** Rows examined, including skipped ones. */
  scanned: number;
}

// Field names observed across the common AI-logging stacks. Order is
// significance, not alphabetical — a purpose-built id beats a trace id.
const ID_KEYS = [
  "verdictId",
  "verdict_id",
  "id",
  "requestId",
  "request_id",
  "runId",
  "run_id",
  "messageId",
  "message_id",
  "uuid",
  "spanId",
  "span_id",
  "traceId",
  "trace_id",
];

const TIME_KEYS = [
  "issuedAt",
  "issued_at",
  "timestamp",
  "createdAt",
  "created_at",
  "startTime",
  "start_time",
  "time",
  "date",
  "ts",
];

const AGENT_KEYS = [
  "agentSlug",
  "agent_slug",
  "agent",
  "system",
  "service",
  "name",
  "model",
  "operation",
];

const VERDICT_KEYS = ["overall", "verdict", "status", "outcome", "result"];

/**
 * Normalise the vocabulary real logs use into the three verdicts.
 *
 * Anything unrecognised becomes `warn` rather than `pass`: an outcome
 * we could not read is not evidence that nothing was wrong.
 */
export function normaliseVerdict(raw: unknown): Verdict {
  if (raw === null || raw === undefined || raw === "") return "pass";
  const v = String(raw).trim().toLowerCase();
  if (/^(pass|ok|okay|success|succeeded|allow|allowed|clean|200|true)$/.test(v))
    return "pass";
  if (/^(warn|warning|flag|flagged|review|degraded|partial)$/.test(v))
    return "warn";
  if (
    /^(block|blocked|deny|denied|fail|failed|failure|error|reject|rejected|false)$/.test(
      v,
    )
  )
    return "block";
  return "warn";
}

/** Read `a.b.c` out of a nested object without throwing. */
function readPath(row: Record<string, unknown>, path: string): unknown {
  if (path in row) return row[path];
  if (!path.includes(".")) return undefined;
  let cur: unknown = row;
  for (const seg of path.split(".")) {
    if (cur === null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[seg];
  }
  return cur;
}

function read(row: Record<string, unknown>, src: FieldSource): unknown {
  return typeof src === "function" ? src(row) : readPath(row, src);
}

function firstPresent(
  row: Record<string, unknown>,
  keys: string[],
): unknown | undefined {
  for (const k of keys) {
    const v = readPath(row, k);
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

/**
 * Coerce to an ISO 8601 string, or null when the value is not a time.
 *
 * Accepts ISO strings, `Date`s, and epoch numbers in seconds,
 * milliseconds, or microseconds — the three units logging stacks
 * disagree about. Magnitude decides the unit.
 */
export function toIso(raw: unknown): string | null {
  if (raw instanceof Date) {
    return Number.isNaN(raw.getTime()) ? null : raw.toISOString();
  }
  if (typeof raw === "number" && Number.isFinite(raw)) {
    // < 1e11  → seconds (through year 5138)
    // < 1e14  → milliseconds
    // else    → microseconds
    const ms = raw < 1e11 ? raw * 1000 : raw < 1e14 ? raw : raw / 1000;
    const d = new Date(ms);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  return null;
}

/**
 * Project arbitrary log rows into `ReceiptRecord`s.
 *
 * Rows that cannot be projected are reported in `skipped` with the
 * reason and their index — never dropped silently. Evidence you
 * quietly discarded is worse than evidence you never had.
 *
 * @example
 * const { records, skipped } = projectRecords(rows, {
 *   id: "request_id",
 *   issuedAt: "created_at",
 *   verdict: (r) => (r.blocked ? "block" : "pass"),
 *   agentSlug: "model",
 * });
 */
export function projectRecords(
  rows: readonly unknown[],
  opts: ProjectOptions = {},
): ProjectionResult {
  if (!Array.isArray(rows)) {
    throw new TypeError("projectRecords: rows must be an array");
  }
  const onInvalid = opts.onInvalid ?? "skip";
  const records: ReceiptRecord[] = [];
  const skipped: SkippedRow[] = [];

  const fail = (index: number, reason: string): void => {
    if (onInvalid === "throw") {
      throw new Error(`projectRecords: row ${index} — ${reason}`);
    }
    skipped.push({ index, reason });
  };

  rows.forEach((raw, index) => {
    if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
      fail(index, "not an object");
      return;
    }
    const row = raw as Record<string, unknown>;

    const rawId = opts.id ? read(row, opts.id) : firstPresent(row, ID_KEYS);
    if (rawId === undefined || rawId === null || rawId === "") {
      fail(index, `no id found (looked for: ${ID_KEYS.slice(0, 5).join(", ")})`);
      return;
    }

    const rawTime = opts.issuedAt
      ? read(row, opts.issuedAt)
      : firstPresent(row, TIME_KEYS);
    const issuedAt = toIso(rawTime);
    if (issuedAt === null) {
      fail(
        index,
        rawTime === undefined
          ? `no timestamp found (looked for: ${TIME_KEYS.slice(0, 4).join(", ")})`
          : `timestamp ${JSON.stringify(rawTime)} is not a date`,
      );
      return;
    }

    const rawVerdict = opts.verdict
      ? read(row, opts.verdict)
      : firstPresent(row, VERDICT_KEYS);
    const rawAgent = opts.agentSlug
      ? read(row, opts.agentSlug)
      : firstPresent(row, AGENT_KEYS);

    const record: ReceiptRecord = {
      verdictId: String(rawId),
      overall: normaliseVerdict(rawVerdict),
      issuedAt,
      // Marks provenance in the generated report. A projected record
      // carries no signature and must never be counted as one.
      source: "projected",
    };
    if (rawAgent !== undefined && rawAgent !== null && rawAgent !== "") {
      record.agentSlug = String(rawAgent);
    }
    for (const key of opts.carry ?? []) {
      const v = readPath(row, key);
      if (v !== undefined) record[key] = v;
    }
    records.push(record);
  });

  return { records, skipped, scanned: rows.length };
}

// `isAttested` lives with the record type it tests. Re-exported here
// because callers reach for it right after projecting.
export { isAttested } from "./types.js";
