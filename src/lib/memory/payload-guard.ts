/**
 * R145 MEMORY PAYLOAD GUARD — Move 7 of the proof-conversion arc.
 *
 * Pure-function scanner that detects embedded-instruction patterns in
 * content being written to a memory store. The threat model is the
 * "zombie memory" / "cross-agent contagion" attack class documented
 * in the Mnemonic Sovereignty survey (April 2026): an agent reads a
 * poisoned source while completing a benign task and writes the
 * malicious payload into long-term memory through its normal update
 * process; later retrieval by ANY agent triggers the payload.
 *
 * STRATEGIC PURPOSE:
 *
 *   PII guard (src/lib/pii-guard.ts) protects values FLOWING OUT of
 *   the platform — credit cards, SSNs, IBANs in agent responses.
 *   Memory payload guard protects values FLOWING IN to shared
 *   memory — instruction-injection patterns that would persist
 *   across sessions and propagate across agents.
 *
 *   These are different threat models. PII guard is about
 *   confidentiality; payload guard is about integrity. Both belong
 *   in the trust substrate, but they scan different content for
 *   different patterns.
 *
 *   The audit action `agent.memory_payload_blocked` (R145) is
 *   already in the audit-log vocabulary on disk (committed in
 *   6d0511c7 with the Move 5 batch). This module finally fires it.
 *
 * THE FIVE DETECTOR CLASSES:
 *
 *   1. role-marker-injection  — system: / user: / assistant: /
 *                                <|im_start|> markers in narrative
 *                                content where they should not appear
 *   2. direct-instruction      — "ignore previous instructions",
 *                                "forget what you were told",
 *                                "you are now", "from now on you"
 *   3. tool-call-hijack        — function-call syntax embedded in
 *                                narrative payloads (e.g. fake
 *                                <invoke> tags or function blocks)
 *   4. propagation-marker      — explicit "share with other agents",
 *                                "propagate this to", "remember to
 *                                tell every agent"
 *   5. encoded-payload         — base64 / hex sequences that decode
 *                                to suspicious patterns (configurable
 *                                length threshold to reduce false
 *                                positives on legitimate hashes)
 *
 * SAFETY POSTURE:
 *
 *   1. Pure function. No I/O. No clocks. Ports verbatim to
 *      @sovereign/inspector for offline regulator verification.
 *   2. Default-OFF via SOVEREIGN_MEMORY_PAYLOAD_GUARD_ENABLED.
 *      Same posture as R100 / R140 / R142 / R143 gates.
 *   3. Fail-OPEN on scanner exceptions — a bug in the scanner
 *      MUST NOT block a legitimate memory write. Defense in depth,
 *      not the primary defense.
 *   4. SHA-256 hash of blocked payload recorded in audit entry so
 *      SOC reviewers can correlate refused writes across agents
 *      (the same poisoned source hitting multiple agents leaves a
 *      single recurring hash signature, not 50 different excerpts).
 */

import { createHash } from "node:crypto";

// ── Feature flag ───────────────────────────────────────────────────

export function isMemoryPayloadGuardEnabled(): boolean {
  return process.env.SOVEREIGN_MEMORY_PAYLOAD_GUARD_ENABLED === "true";
}

// ── Detector taxonomy ──────────────────────────────────────────────

export type PayloadDetector =
  | "role-marker-injection"
  | "direct-instruction"
  | "tool-call-hijack"
  | "propagation-marker"
  | "encoded-payload";

export const PAYLOAD_DETECTORS: ReadonlyArray<PayloadDetector> = [
  "role-marker-injection",
  "direct-instruction",
  "tool-call-hijack",
  "propagation-marker",
  "encoded-payload",
];

export type Severity = "warn" | "block";

export interface PayloadFinding {
  detector: PayloadDetector;
  severity: Severity;
  /** Procurement-readable excerpt (capped at 80 chars, masked). */
  excerpt: string;
  /** 0-based offset into the content where the match started. */
  offset: number;
  /** Pattern label for SOC review (e.g., "ignore-previous"). */
  pattern: string;
}

export interface PayloadScanResult {
  findings: PayloadFinding[];
  /** True iff at least one finding has severity "block". */
  blocked: boolean;
  /** Procurement-readable one-liner (≤200 chars). */
  summary: string;
}

// ── Detector implementations (pure regex / heuristic) ─────────────

const MAX_FINDINGS_PER_DETECTOR = 32;

/** Pure: role-marker injection detector. */
function detectRoleMarkers(content: string): PayloadFinding[] {
  const out: PayloadFinding[] = [];
  const patterns: Array<{ re: RegExp; label: string }> = [
    { re: /<\|im_start\|>/gi, label: "im-start-token" },
    { re: /<\|im_end\|>/gi, label: "im-end-token" },
    { re: /\b(?:system|assistant)\s*:\s*(?:you\b|ignore\b|forget\b|new\b)/gi, label: "role-prefix" },
    { re: /^\s*###\s*(?:system|assistant|instructions?)\s*$/gim, label: "markdown-role-header" },
  ];
  for (const { re, label } of patterns) {
    for (const m of content.matchAll(re)) {
      const idx = m.index ?? 0;
      out.push({
        detector: "role-marker-injection",
        severity: "block",
        excerpt: maskExcerpt(content, idx, m[0].length),
        offset: idx,
        pattern: label,
      });
      if (out.length >= MAX_FINDINGS_PER_DETECTOR) return out;
    }
  }
  return out;
}

/** Pure: direct-instruction detector. */
function detectDirectInstructions(content: string): PayloadFinding[] {
  const out: PayloadFinding[] = [];
  const patterns: Array<{ re: RegExp; label: string; severity: Severity }> = [
    { re: /\bignore\s+(?:all\s+)?(?:previous|prior|above|earlier)\s+instructions?\b/gi, label: "ignore-previous", severity: "block" },
    { re: /\bforget\s+(?:all|everything|what)\s+(?:you|i)\b/gi, label: "forget-everything", severity: "block" },
    { re: /\byou\s+are\s+now\s+(?:a|an|the)\b/gi, label: "you-are-now", severity: "block" },
    { re: /\bfrom\s+now\s+on(?:,|\s+you)/gi, label: "from-now-on", severity: "warn" },
    { re: /\bdisregard\s+(?:all\s+)?(?:previous|prior|the\s+above)\b/gi, label: "disregard-previous", severity: "block" },
    { re: /\boverride\s+(?:your|all|the)\s+(?:safety|guardrails?|instructions?|rules?)\b/gi, label: "override-safety", severity: "block" },
  ];
  for (const { re, label, severity } of patterns) {
    for (const m of content.matchAll(re)) {
      const idx = m.index ?? 0;
      out.push({
        detector: "direct-instruction",
        severity,
        excerpt: maskExcerpt(content, idx, m[0].length),
        offset: idx,
        pattern: label,
      });
      if (out.length >= MAX_FINDINGS_PER_DETECTOR) return out;
    }
  }
  return out;
}

/** Pure: tool-call hijack detector. */
function detectToolCallHijack(content: string): PayloadFinding[] {
  const out: PayloadFinding[] = [];
  const patterns: Array<{ re: RegExp; label: string }> = [
    { re: /<invoke\s+(?:name|tool)\s*=\s*(?:"[^"]+"|'[^']+')\s*>/gi, label: "fake-invoke-tag" },
    { re: /<function_calls>/gi, label: "function-calls-block" },
    { re: /\bcall_function\s*\(\s*["']\w+["']/gi, label: "call-function-syntax" },
    { re: /```(?:tool_code|tool_call|function|json)\s*\n\s*\{[^}]*"name"\s*:\s*"\w+"/gi, label: "fenced-tool-call" },
  ];
  for (const { re, label } of patterns) {
    for (const m of content.matchAll(re)) {
      const idx = m.index ?? 0;
      out.push({
        detector: "tool-call-hijack",
        severity: "block",
        excerpt: maskExcerpt(content, idx, m[0].length),
        offset: idx,
        pattern: label,
      });
      if (out.length >= MAX_FINDINGS_PER_DETECTOR) return out;
    }
  }
  return out;
}

/** Pure: cross-agent propagation marker detector. */
function detectPropagationMarkers(content: string): PayloadFinding[] {
  const out: PayloadFinding[] = [];
  const patterns: Array<{ re: RegExp; label: string; severity: Severity }> = [
    { re: /\b(?:share|propagate|forward|distribute)\s+(?:this|these|the\s+following)\s+(?:to|with)\s+(?:all\s+)?(?:other\s+)?agents?\b/gi, label: "share-with-agents", severity: "block" },
    { re: /\bremember\s+to\s+tell\s+(?:every|all|other)\s+agents?\b/gi, label: "tell-all-agents", severity: "block" },
    { re: /\bwhen\s+(?:another|any|other)\s+agent\s+(?:reads|retrieves|loads)\s+this\b/gi, label: "trigger-on-retrieval", severity: "block" },
  ];
  for (const { re, label, severity } of patterns) {
    for (const m of content.matchAll(re)) {
      const idx = m.index ?? 0;
      out.push({
        detector: "propagation-marker",
        severity,
        excerpt: maskExcerpt(content, idx, m[0].length),
        offset: idx,
        pattern: label,
      });
      if (out.length >= MAX_FINDINGS_PER_DETECTOR) return out;
    }
  }
  return out;
}

/** Pure: encoded-payload detector. Looks for long base64-ish runs that
 *  decode to instruction-shaped strings. Configurable minimum-length
 *  threshold avoids false positives on legitimate hashes / signatures. */
const ENCODED_PAYLOAD_MIN_LENGTH = 64;

function detectEncodedPayload(content: string): PayloadFinding[] {
  const out: PayloadFinding[] = [];
  const base64Re = /\b[A-Za-z0-9+/]{64,}={0,2}\b/g;
  for (const m of content.matchAll(base64Re)) {
    if (m[0].length < ENCODED_PAYLOAD_MIN_LENGTH) continue;
    let decoded = "";
    try {
      decoded = Buffer.from(m[0], "base64").toString("utf8");
    } catch {
      continue;
    }
    if (decodedLooksLikeInstruction(decoded)) {
      const idx = m.index ?? 0;
      out.push({
        detector: "encoded-payload",
        severity: "block",
        excerpt: maskExcerpt(content, idx, Math.min(m[0].length, 80)),
        offset: idx,
        pattern: "base64-decoded-instruction",
      });
      if (out.length >= 16) return out;
    }
  }
  return out;
}

/** Pure: a decoded blob is suspicious if it contains explicit
 *  instruction tokens after decoding. Conservative — false negatives
 *  preferred to false positives on legit data. */
function decodedLooksLikeInstruction(decoded: string): boolean {
  // Must be mostly printable ASCII to be considered a hidden instruction.
  let printable = 0;
  for (let i = 0; i < decoded.length; i++) {
    const code = decoded.charCodeAt(i);
    if ((code >= 32 && code < 127) || code === 10 || code === 13) printable++;
  }
  const printableRatio = printable / Math.max(decoded.length, 1);
  if (printableRatio < 0.85) return false;
  return (
    /\bignore\s+previous\b/i.test(decoded) ||
    /\byou\s+are\s+now\b/i.test(decoded) ||
    /<\|im_start\|>/.test(decoded) ||
    /\bsystem\s*:\s*you\b/i.test(decoded)
  );
}

// ── Excerpt masking (procurement-readable, no leakage) ────────────

const EXCERPT_MAX_LENGTH = 80;

function maskExcerpt(content: string, offset: number, matchLen: number): string {
  const start = Math.max(0, offset - 8);
  const end = Math.min(content.length, offset + matchLen + 8);
  let excerpt = content.slice(start, end).replace(/\s+/g, " ").trim();
  if (excerpt.length > EXCERPT_MAX_LENGTH) {
    excerpt = excerpt.slice(0, EXCERPT_MAX_LENGTH - 3) + "...";
  }
  return excerpt;
}

// ── Public scanner ─────────────────────────────────────────────────

/**
 * Pure: run all 5 detectors over the content. Returns an aggregated
 * result. Even if the gate is off, callers can invoke this directly
 * for warning-only reporting (the gate behavior is in scanMemoryWrite
 * below).
 *
 * Defensive: each detector runs in a try/catch so a regex bug in one
 * pattern does not blind the others. Fail-OPEN posture — a scanner
 * exception is recorded as no-finding for that detector.
 */
export function scanForEmbeddedInstructions(
  content: string,
): PayloadScanResult {
  if (typeof content !== "string" || content.length === 0) {
    return {
      findings: [],
      blocked: false,
      summary: "memory-payload scan ok (empty content)",
    };
  }

  const findings: PayloadFinding[] = [];
  const detectors: Array<(s: string) => PayloadFinding[]> = [
    detectRoleMarkers,
    detectDirectInstructions,
    detectToolCallHijack,
    detectPropagationMarkers,
    detectEncodedPayload,
  ];
  for (const fn of detectors) {
    try {
      findings.push(...fn(content));
    } catch {
      // Fail-OPEN: scanner exception does NOT block content.
    }
  }

  const blocked = findings.some((f) => f.severity === "block");
  const summary = buildSummary(findings, blocked);
  return { findings, blocked, summary };
}

function buildSummary(findings: PayloadFinding[], blocked: boolean): string {
  if (findings.length === 0) return "memory-payload scan ok (no findings)";
  const counts: Partial<Record<PayloadDetector, number>> = {};
  for (const f of findings) counts[f.detector] = (counts[f.detector] ?? 0) + 1;
  const parts = Object.entries(counts).map(([d, n]) => `${d}=${n}`);
  const verdict = blocked ? "BLOCKED" : "warn";
  return `memory-payload ${verdict}: ${parts.join(" · ")}`.slice(0, 200);
}

// ── Composite gate (the wrapper memory-fabric calls) ──────────────

export interface MemoryWriteRequest {
  /** Stable agent id (matches AgentConfig.name). */
  agentName: string;
  /** Optional memory-store / collection identifier. */
  storeId?: string;
  /** Optional source provenance (URL, agent-id, etc.). */
  source?: string;
  /** The content to be written to memory. */
  content: string;
  /** Optional caller-supplied content-hash override (else SHA-256 of content). */
  contentHash?: string;
}

export type MemoryWriteVerdict =
  | { ok: true; reason: "guard_disabled" | "scan_clean" | "scan_warn"; result: PayloadScanResult }
  | {
      ok: false;
      reason: "memory_payload_blocked";
      result: PayloadScanResult;
      contentHash: string;
      response: {
        error: "memory_write_refused";
        summary: string;
        contentHash: string;
        findings: PayloadFinding[];
      };
      auditEntry: {
        action: "agent.memory_payload_blocked";
        resource: string;
        details: {
          contentHash: string;
          storeId?: string;
          source?: string;
          summary: string;
          findings: PayloadFinding[];
        };
      };
    };

/**
 * Pure: gate a memory write. Defaults to fail-OPEN (returns ok:true
 * with reason "guard_disabled") when the feature flag is off.
 *
 * When the gate is on:
 *   - Clean scan       → ok:true, reason="scan_clean"
 *   - Warnings only    → ok:true, reason="scan_warn" (caller may log)
 *   - Any block-severe → ok:false with audit entry firing R145
 */
export function scanMemoryWrite(req: MemoryWriteRequest): MemoryWriteVerdict {
  if (!isMemoryPayloadGuardEnabled()) {
    return {
      ok: true,
      reason: "guard_disabled",
      result: { findings: [], blocked: false, summary: "memory-payload guard disabled (env flag off)" },
    };
  }

  const result = scanForEmbeddedInstructions(req.content);
  if (!result.blocked) {
    return {
      ok: true,
      reason: result.findings.length === 0 ? "scan_clean" : "scan_warn",
      result,
    };
  }

  const contentHash =
    req.contentHash ?? createHash("sha256").update(req.content).digest("hex");
  return {
    ok: false,
    reason: "memory_payload_blocked",
    result,
    contentHash,
    response: {
      error: "memory_write_refused",
      summary: result.summary,
      contentHash,
      findings: result.findings,
    },
    auditEntry: {
      action: "agent.memory_payload_blocked",
      resource: `agent:${req.agentName}`,
      details: {
        contentHash,
        storeId: req.storeId,
        source: req.source,
        summary: result.summary,
        findings: result.findings,
      },
    },
  };
}
