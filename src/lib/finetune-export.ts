/**
 * SOVEREIGN MATRIX — Fine-tune dataset export (Wave 133).
 *
 * Pulls high-quality `agent_runs` rows and emits them as JSONL in the
 * shape NeMo Customizer (and OpenAI's fine-tune API, and most open
 * trainers) expect:
 *
 *   { messages: [
 *       { role: "system", content: "..." },
 *       { role: "user",   content: "..." },
 *       { role: "assistant", content: "..." }
 *     ] }
 *
 * Selection criteria for a row to be included:
 *   - trust_decision === "auto-approved"  (the verifier liked the output)
 *   - duration_ms > 0                     (real completion, not error)
 *   - input/output JSON parses cleanly
 *   - input has a non-empty `prompt` / `text` / `query` field
 *   - output stringifies to ≥ 50 chars and ≤ 8K chars
 *   - de-duplicated by input hash (keep highest-priority)
 *
 * Pure aggregator + a DB-backed wrapper. The aggregator is unit-tested.
 *
 * Output is one JSON object per line (JSONL), the format NeMo
 * Customizer reads directly from a GCS bucket / local file.
 */

import { db } from "@/db";
import { agentRuns } from "@/db/schema";
import { eq, gt, and } from "drizzle-orm";
import { createHash } from "node:crypto";
import { createLogger } from "@/lib/logger";

const log = createLogger("finetune-export");

const MIN_OUTPUT_LEN = 50;
const MAX_OUTPUT_LEN = 8_000;
const MAX_INPUT_LEN = 4_000;

/** Wire shape — what we read out of the DB. */
export interface RawRun {
  id: string;
  agentName: string;
  modelUsed: string;
  inputJson: string;
  outputJson: string;
  trustDecision: string;
  durationMs: number;
  createdAt: Date;
}

/** Wire shape — one row of the JSONL output. */
export interface TrainingExample {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  /** Source agent — useful when training agent-specific adapters. */
  agentName: string;
  /** Original model that produced this output — for stratified sampling. */
  modelUsed: string;
  /** Stable hash of the prompt for dedup + traceability. */
  promptHash: string;
}

export interface AggregateOptions {
  /** Cap on emitted rows. Default 5000 (NeMo Customizer sweet spot). */
  maxRows?: number;
  /** Skip rows from agents in this list. */
  excludeAgents?: string[];
  /** Only emit rows whose `agentName` is in this list (if provided). */
  includeAgents?: string[];
  /** Optional system prompt prepended to each example. */
  systemPrompt?: string;
}

/** Read the most useful text from an `input_json` blob — heuristic. */
export function extractInputText(inputJson: string): string | null {
  try {
    const parsed = JSON.parse(inputJson);
    if (typeof parsed === "string") return parsed.slice(0, MAX_INPUT_LEN);
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Record<string, unknown>;
    // Priority: prompt → text → query → message → goal → input → problem
    const candidates = [
      "prompt",
      "text",
      "query",
      "message",
      "goal",
      "input",
      "problem",
      "topic",
      "question",
    ];
    for (const k of candidates) {
      const v = obj[k];
      if (typeof v === "string" && v.trim().length > 0) {
        return v.slice(0, MAX_INPUT_LEN);
      }
    }
    // Fallback: stringify the whole object up to the cap
    const stringified = JSON.stringify(obj);
    if (stringified.length > MAX_INPUT_LEN) {
      return stringified.slice(0, MAX_INPUT_LEN);
    }
    return stringified;
  } catch {
    return null;
  }
}

/** Pull the assistant output from an `output_json` blob. */
export function extractOutputText(outputJson: string): string | null {
  try {
    const parsed = JSON.parse(outputJson);
    if (typeof parsed === "string") return parsed.slice(0, MAX_OUTPUT_LEN);
    if (!parsed || typeof parsed !== "object") return null;
    const obj = parsed as Record<string, unknown>;
    const candidates = [
      "result",
      "output",
      "response",
      "text",
      "answer",
      "content",
      "analysis",
      "summary",
      "agentResponse",
      "final_answer",
    ];
    for (const k of candidates) {
      const v = obj[k];
      if (typeof v === "string" && v.trim().length > 0) {
        return v.slice(0, MAX_OUTPUT_LEN);
      }
    }
    return null;
  } catch {
    return null;
  }
}

/** Pure aggregator — takes the raw rows + options, returns training examples. */
export function aggregateTrainingSet(
  rows: RawRun[],
  opts: AggregateOptions = {},
): TrainingExample[] {
  const maxRows = Math.max(1, opts.maxRows ?? 5000);
  const exclude = new Set(opts.excludeAgents ?? []);
  const include =
    opts.includeAgents && opts.includeAgents.length > 0
      ? new Set(opts.includeAgents)
      : null;
  const systemPrompt = opts.systemPrompt;

  const seenHashes = new Set<string>();
  const examples: TrainingExample[] = [];

  for (const r of rows) {
    if (examples.length >= maxRows) break;
    if (r.trustDecision !== "auto-approved") continue;
    if (r.durationMs <= 0) continue;
    if (exclude.has(r.agentName)) continue;
    if (include && !include.has(r.agentName)) continue;

    const inputText = extractInputText(r.inputJson);
    if (!inputText || inputText.trim().length === 0) continue;
    const outputText = extractOutputText(r.outputJson);
    if (!outputText) continue;
    if (outputText.length < MIN_OUTPUT_LEN) continue;
    if (outputText.length > MAX_OUTPUT_LEN) continue;

    const promptHash = createHash("sha256")
      .update(inputText)
      .update("|")
      .update(r.agentName)
      .digest("hex")
      .slice(0, 24);

    if (seenHashes.has(promptHash)) continue;
    seenHashes.add(promptHash);

    const messages: TrainingExample["messages"] = [];
    if (systemPrompt && systemPrompt.trim().length > 0) {
      messages.push({ role: "system", content: systemPrompt });
    } else {
      messages.push({
        role: "system",
        content: `You are the Sovereign Matrix ${r.agentName} agent.`,
      });
    }
    messages.push({ role: "user", content: inputText });
    messages.push({ role: "assistant", content: outputText });

    examples.push({
      messages,
      agentName: r.agentName,
      modelUsed: r.modelUsed,
      promptHash,
    });
  }

  return examples;
}

/** Serialise to JSONL (one JSON object per line). Stable ordering. */
export function toJsonl(examples: TrainingExample[]): string {
  return examples
    .map((e) => JSON.stringify({ messages: e.messages }))
    .join("\n");
}

/**
 * Live DB pull. `sinceDays` defaults to 90, the same window the
 * cohort analytics use. Returns the JSONL string ready to upload
 * to NeMo Customizer / GCS / a fine-tune blob.
 *
 * Returns empty string on missing table (42P01) so the operator can
 * call this against a fresh deploy without hitting an error.
 */
export async function exportTrainingJsonl(
  sinceDays: number = 90,
  opts: AggregateOptions = {},
): Promise<{ jsonl: string; rows: number; bytes: number }> {
  const since = new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000);
  try {
    const rows = await db
      .select({
        id: agentRuns.id,
        agentName: agentRuns.agentName,
        modelUsed: agentRuns.modelUsed,
        inputJson: agentRuns.inputJson,
        outputJson: agentRuns.outputJson,
        trustDecision: agentRuns.trustDecision,
        durationMs: agentRuns.durationMs,
        createdAt: agentRuns.createdAt,
      })
      .from(agentRuns)
      .where(
        and(
          eq(agentRuns.trustDecision, "auto-approved"),
          gt(agentRuns.createdAt, since),
        ),
      );
    const examples = aggregateTrainingSet(rows, opts);
    const jsonl = toJsonl(examples);
    return {
      jsonl,
      rows: examples.length,
      bytes: Buffer.byteLength(jsonl, "utf8"),
    };
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "42P01") {
      log.warn("agent_runs table missing — empty export");
      return { jsonl: "", rows: 0, bytes: 0 };
    }
    log.warn("export failed", { error: String(err) });
    return { jsonl: "", rows: 0, bytes: 0 };
  }
}
