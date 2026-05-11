/**
 * AGENT-RUNS — verifiable receipts for every agent execution.
 *
 * Each row in `agent_runs` is the public proof that:
 *   - input X
 *   - was processed by agent A using model M
 *   - passed safety checks S
 *   - and produced output Y
 * at a specific time, signed by the server.
 *
 * The signature is an HMAC-SHA256 over a canonical JSON projection of
 * the run, keyed by AGENT_RUN_SIGNING_SECRET. Anyone with the public
 * receipt URL can re-derive the canonical projection and verify the
 * signature against the server (without ever seeing the secret).
 *
 * This is the "verifiable AI output" claim that no agent SaaS ships
 * today. The infrastructure cost is one row per agent run — already
 * within the existing audit-log retention budget.
 */
import { createHmac, timingSafeEqual } from "crypto";
import { db } from "@/db";
import { agentRuns } from "@/db/schema";
import { eq } from "drizzle-orm";
import { createLogger } from "@/lib/logger";

const log = createLogger("agent-runs");

export interface SafetyResultPayload {
  jailbreak?: "pass" | "fail";
  pii?: "pass" | "fail";
  content?: "pass" | "fail";
  quality?: number;
  critic?: "pass" | "fail";
}

export interface RecordRunInput {
  userId?: string | null;
  tenantId?: string | null;
  agentName: string;
  modelUsed?: string;
  input: unknown;
  output: unknown;
  safetyResult?: SafetyResultPayload;
  durationMs?: number;
  chainDepth?: number;
  trustDecision?: "auto-approved" | "needs-approval" | "blocked";
}

export interface AgentRunRecord {
  id: string;
  userId: string | null;
  tenantId: string | null;
  agentName: string;
  modelUsed: string;
  input: unknown;
  output: unknown;
  safetyResult: SafetyResultPayload;
  durationMs: number;
  chainDepth: number;
  trustDecision: string;
  visibility: "private" | "public" | "unlisted";
  signature: string;
  createdAt: Date;
}

const MAX_INPUT_BYTES = 4_000;
const MAX_OUTPUT_BYTES = 16_000;

/**
 * Canonical projection used as the HMAC payload. Order at the top level
 * is locked. Nested objects (input, output, safetyResult) are walked
 * recursively and their keys sorted, so two clients that submit the
 * same logical input with different JS object key orders produce
 * BYTE-IDENTICAL canonical strings — and therefore identical signatures.
 *
 * `undefined` values are dropped (matching JSON.stringify's default).
 * `NaN` / `Infinity` become `null` (also matching JSON.stringify).
 * Arrays preserve element order (Array order IS canonical input).
 */
function canonicalize(run: {
  id: string;
  agentName: string;
  modelUsed: string;
  input: unknown;
  output: unknown;
  safetyResult: SafetyResultPayload;
  durationMs: number;
  createdAt: string;
}): string {
  return JSON.stringify({
    v: 1,
    id: run.id,
    agentName: run.agentName,
    modelUsed: run.modelUsed,
    input: sortKeysDeep(run.input),
    output: sortKeysDeep(run.output),
    safetyResult: sortKeysDeep(run.safetyResult) as SafetyResultPayload,
    durationMs: run.durationMs,
    createdAt: run.createdAt,
  });
}

/**
 * Recursively sort object keys so JSON.stringify produces identical
 * output regardless of how the consumer constructed their object literal.
 * Pure: returns a new object/array, never mutates input.
 */
function sortKeysDeep(value: unknown): unknown {
  if (value === null || typeof value !== "object") return value;
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(value as Record<string, unknown>).sort()) {
    out[k] = sortKeysDeep((value as Record<string, unknown>)[k]);
  }
  return out;
}

function getSecret(): string | null {
  const s =
    process.env.AGENT_RUN_SIGNING_SECRET ?? process.env.CRON_SECRET ?? null;
  if (!s || s.length < 16) return null;
  return s;
}

/**
 * Sign the canonical projection with HMAC-SHA256.
 * Returns "v1=<hex>" so the version prefix is part of the wire format
 * and we can rotate the algorithm later without breaking old receipts.
 */
export function signRun(canonical: string): string {
  const secret = getSecret();
  if (!secret) {
    return "unsigned";
  }
  const mac = createHmac("sha256", secret).update(canonical).digest("hex");
  return `v1=${mac}`;
}

/**
 * Constant-time signature verification. Returns true iff `signature`
 * matches the canonical projection under the current secret.
 */
export function verifySignature(canonical: string, signature: string): boolean {
  if (!signature || signature === "unsigned") return false;
  const expected = signRun(canonical);
  if (expected.length !== signature.length) return false;
  try {
    return timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(signature, "utf8"),
    );
  } catch {
    return false;
  }
}

function clip(value: unknown, maxBytes: number): unknown {
  if (value == null) return value;
  const json = typeof value === "string" ? value : JSON.stringify(value);
  if (json.length <= maxBytes) {
    try {
      return typeof value === "string" ? value : JSON.parse(json);
    } catch {
      return value;
    }
  }
  // Truncate string output; for objects, drop to a placeholder rather than
  // emit a malformed JSON. Worst case we lose tail; signature still valid
  // because we sign what we store.
  if (typeof value === "string") return value.slice(0, maxBytes) + "…";
  return { _truncated: true, bytes: json.length, head: json.slice(0, 1000) };
}

/**
 * Persist an agent run + return the signed record. Best-effort: a DB
 * outage must NEVER prevent the agent response from shipping.
 */
export async function recordRun(
  input: RecordRunInput,
): Promise<AgentRunRecord | null> {
  try {
    const id = crypto.randomUUID();
    const createdAt = new Date();
    const trimmedInput = clip(input.input, MAX_INPUT_BYTES);
    const trimmedOutput = clip(input.output, MAX_OUTPUT_BYTES);
    const safety = input.safetyResult ?? {};

    const canonical = canonicalize({
      id,
      agentName: input.agentName,
      modelUsed: input.modelUsed ?? "unknown",
      input: trimmedInput,
      output: trimmedOutput,
      safetyResult: safety,
      durationMs: input.durationMs ?? 0,
      createdAt: createdAt.toISOString(),
    });
    const signature = signRun(canonical);

    await db.insert(agentRuns).values({
      id,
      userId: input.userId ?? null,
      tenantId: input.tenantId ?? null,
      agentName: input.agentName,
      modelUsed: input.modelUsed ?? "unknown",
      inputJson: JSON.stringify(trimmedInput ?? {}),
      outputJson: JSON.stringify(trimmedOutput ?? {}),
      safetyResult: JSON.stringify(safety),
      durationMs: input.durationMs ?? 0,
      chainDepth: input.chainDepth ?? 0,
      trustDecision: input.trustDecision ?? "auto-approved",
      visibility: "private",
      signature,
      createdAt,
    });

    return {
      id,
      userId: input.userId ?? null,
      tenantId: input.tenantId ?? null,
      agentName: input.agentName,
      modelUsed: input.modelUsed ?? "unknown",
      input: trimmedInput,
      output: trimmedOutput,
      safetyResult: safety,
      durationMs: input.durationMs ?? 0,
      chainDepth: input.chainDepth ?? 0,
      trustDecision: input.trustDecision ?? "auto-approved",
      visibility: "private",
      signature,
      createdAt,
    };
  } catch (err) {
    log.warn("recordRun failed (run not persisted)", {
      agent: input.agentName,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Read a single run by id. Visibility gating is the caller's job —
 * this returns the row if it exists and lets the API decide whether
 * to expose it to the requester.
 */
export async function getRun(id: string): Promise<AgentRunRecord | null> {
  try {
    const rows = await db
      .select()
      .from(agentRuns)
      .where(eq(agentRuns.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) return null;
    return {
      id: row.id,
      userId: row.userId,
      tenantId: row.tenantId,
      agentName: row.agentName,
      modelUsed: row.modelUsed,
      input: safeParse(row.inputJson),
      output: safeParse(row.outputJson),
      safetyResult: safeParse(row.safetyResult) as SafetyResultPayload,
      durationMs: row.durationMs,
      chainDepth: row.chainDepth,
      trustDecision: row.trustDecision,
      visibility: row.visibility as "private" | "public" | "unlisted",
      signature: row.signature,
      createdAt: row.createdAt ?? new Date(),
    };
  } catch (err) {
    log.warn("getRun failed", {
      id,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

export async function setRunVisibility(
  id: string,
  userId: string,
  visibility: "private" | "public" | "unlisted",
): Promise<boolean> {
  try {
    const rows = await db
      .select({ userId: agentRuns.userId })
      .from(agentRuns)
      .where(eq(agentRuns.id, id))
      .limit(1);
    const row = rows[0];
    if (!row || row.userId !== userId) return false;
    await db.update(agentRuns).set({ visibility }).where(eq(agentRuns.id, id));
    return true;
  } catch (err) {
    log.warn("setRunVisibility failed", {
      id,
      error: err instanceof Error ? err.message : String(err),
    });
    return false;
  }
}

/**
 * Re-derive the canonical projection of a stored run for verification.
 * Anyone holding the row's data can call this — it's deterministic.
 */
export function canonicalizeRun(run: {
  id: string;
  agentName: string;
  modelUsed: string;
  input: unknown;
  output: unknown;
  safetyResult: SafetyResultPayload;
  durationMs: number;
  createdAt: Date | string;
}): string {
  const createdAt =
    run.createdAt instanceof Date ? run.createdAt.toISOString() : run.createdAt;
  return canonicalize({ ...run, createdAt });
}

function safeParse(s: string): unknown {
  try {
    return JSON.parse(s);
  } catch {
    return s;
  }
}
