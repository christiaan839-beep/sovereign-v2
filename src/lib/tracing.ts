/**
 * SOVEREIGN MATRIX — Distributed tracing primitive (Cook 120).
 *
 * Correlation IDs + span tree for multi-agent flows. Every agent
 * run, tool call, and provider request becomes a span tied to a
 * single trace id. Receipts embed the trace so an auditor can
 * reconstruct the full causal chain.
 *
 * Pure module — no I/O. Caller's HTTP / DB layer reads tracing
 * headers + creates new spans. Compatible with W3C Trace Context
 * (`traceparent`) so OTel collectors ingest cleanly.
 */

import { createHash, randomBytes } from "crypto";

// ── Public types ──────────────────────────────────────────────────────────

export interface SpanContext {
  /** 16-byte trace id (hex). Identical across every span in one request. */
  traceId: string;
  /** 8-byte span id (hex). Unique per span. */
  spanId: string;
  /** Parent span's id; empty string for the root. */
  parentSpanId: string;
}

export interface Span extends SpanContext {
  /** Logical operation name ("agent.run", "tool.fetch_url"). */
  name: string;
  /** Component this span belongs to. */
  kind: "agent" | "tool" | "model" | "router" | "verifier" | "external";
  /** Unix ms start. */
  startMs: number;
  /** Unix ms end (set on `endSpan`). */
  endMs?: number;
  /** Free-form attributes. JSON-serializable. */
  attributes: Record<string, string | number | boolean>;
  /** Status — "ok" by default, set to "error" on failure. */
  status: "unset" | "ok" | "error";
  /** Optional error message when status="error". */
  errorMessage?: string;
}

// ── ID generation ─────────────────────────────────────────────────────────

export function newTraceId(): string {
  return randomBytes(16).toString("hex");
}

export function newSpanId(): string {
  return randomBytes(8).toString("hex");
}

// ── W3C Trace Context interop ────────────────────────────────────────────

const TRACEPARENT_RE = /^00-([a-f0-9]{32})-([a-f0-9]{16})-([0-9a-f]{2})$/;

/**
 * Parse a W3C `traceparent` header. Returns the parent context the
 * receiver should attach new spans to. Returns null on malformed
 * input; caller mints a new traceId in that case.
 */
export function parseTraceparent(
  header: string | null | undefined,
): SpanContext | null {
  if (!header) return null;
  const m = TRACEPARENT_RE.exec(header.trim());
  if (!m) return null;
  return {
    traceId: m[1],
    spanId: newSpanId(),
    parentSpanId: m[2],
  };
}

/** Render the current span's outgoing traceparent for downstream calls. */
export function formatTraceparent(ctx: SpanContext): string {
  return `00-${ctx.traceId}-${ctx.spanId}-01`;
}

// ── Span builder ──────────────────────────────────────────────────────────

export function startSpan(args: {
  parent?: SpanContext;
  name: string;
  kind: Span["kind"];
  attributes?: Record<string, string | number | boolean>;
  now?: number;
}): Span {
  const now = args.now ?? Date.now();
  return {
    traceId: args.parent?.traceId ?? newTraceId(),
    spanId: newSpanId(),
    parentSpanId: args.parent?.spanId ?? "",
    name: args.name,
    kind: args.kind,
    startMs: now,
    attributes: { ...(args.attributes ?? {}) },
    status: "unset",
  };
}

export function endSpan(
  span: Span,
  result: { error?: string } = {},
  now?: number,
): Span {
  return {
    ...span,
    endMs: now ?? Date.now(),
    status: result.error ? "error" : "ok",
    ...(result.error ? { errorMessage: result.error } : {}),
  };
}

export function setAttribute(
  span: Span,
  key: string,
  value: string | number | boolean,
): Span {
  return {
    ...span,
    attributes: { ...span.attributes, [key]: value },
  };
}

// ── Trace tree ───────────────────────────────────────────────────────────

export interface SpanNode {
  span: Span;
  children: SpanNode[];
}

/**
 * Build a parent/child tree from a flat span list. Spans with an
 * unknown parent are orphaned at the top level (defensive — never
 * drops spans).
 */
export function buildTree(spans: Span[]): SpanNode[] {
  const byId = new Map<string, SpanNode>();
  for (const span of spans) {
    byId.set(span.spanId, { span, children: [] });
  }
  const roots: SpanNode[] = [];
  for (const node of byId.values()) {
    if (node.span.parentSpanId && byId.has(node.span.parentSpanId)) {
      byId.get(node.span.parentSpanId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

/**
 * Stable hash of the trace shape. Useful for grouping similar
 * traces in observability dashboards — same agent flow → same hash
 * regardless of trace ids.
 */
export function traceShapeHash(spans: Span[]): string {
  const shape = spans
    .map((s) => `${s.kind}:${s.name}`)
    .sort()
    .join("|");
  return createHash("sha256").update(shape).digest("hex");
}
