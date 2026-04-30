/**
 * @sovereign/inspector — R145 Memory Payload Guard (Move 7).
 *
 * Pure-function port of src/lib/memory/payload-guard.ts to standalone
 * Node ESM. Same 5 detector classes, same severity thresholds, same
 * SHA-256 content-hash anchor used in the audit chain.
 *
 * Strategic property: a customer or auditor receives an
 * agent.memory_payload_blocked R26 audit entry from Sovereign.
 * They want to verify offline:
 *   1. Did the platform's scanner correctly flag this content?
 *   2. Does the published findings list match what the scanner
 *      produces when re-run on the same input?
 *   3. Is the content-hash in the audit entry the actual SHA-256
 *      of the content (not a manipulated value)?
 * This module answers all three without any Sovereign network call.
 *
 * Coverage:
 *   - PAYLOAD_DETECTORS canonical order
 *   - scanForEmbeddedInstructions (5 detectors, fail-OPEN posture)
 *   - scanMemoryWrite gate semantics + audit-entry shape
 *   - verifyMemoryPayloadBlock (replay-and-confirm helper)
 */

import { createHash } from "node:crypto";

// ── Detector taxonomy ─────────────────────────────────────────────

export const PAYLOAD_DETECTORS = [
  "role-marker-injection",
  "direct-instruction",
  "tool-call-hijack",
  "propagation-marker",
  "encoded-payload",
];

const MAX_FINDINGS_PER_DETECTOR = 32;
const ENCODED_PAYLOAD_MIN_LENGTH = 64;
const EXCERPT_MAX_LENGTH = 80;

// ── Pattern tables (mirrors platform exactly) ────────────────────

const ROLE_MARKER_PATTERNS = [
  { re: /<\|im_start\|>/gi, label: "im-start-token" },
  { re: /<\|im_end\|>/gi, label: "im-end-token" },
  { re: /\b(?:system|assistant)\s*:\s*(?:you\b|ignore\b|forget\b|new\b)/gi, label: "role-prefix" },
  { re: /^\s*###\s*(?:system|assistant|instructions?)\s*$/gim, label: "markdown-role-header" },
];

const DIRECT_INSTRUCTION_PATTERNS = [
  { re: /\bignore\s+(?:all\s+)?(?:previous|prior|above|earlier)\s+instructions?\b/gi, label: "ignore-previous", severity: "block" },
  { re: /\bforget\s+(?:all|everything|what)\s+(?:you|i)\b/gi, label: "forget-everything", severity: "block" },
  { re: /\byou\s+are\s+now\s+(?:a|an|the)\b/gi, label: "you-are-now", severity: "block" },
  { re: /\bfrom\s+now\s+on(?:,|\s+you)/gi, label: "from-now-on", severity: "warn" },
  { re: /\bdisregard\s+(?:all\s+)?(?:previous|prior|the\s+above)\b/gi, label: "disregard-previous", severity: "block" },
  { re: /\boverride\s+(?:your|all|the)\s+(?:safety|guardrails?|instructions?|rules?)\b/gi, label: "override-safety", severity: "block" },
];

const TOOL_CALL_HIJACK_PATTERNS = [
  { re: /<invoke\s+(?:name|tool)\s*=\s*(?:"[^"]+"|'[^']+')\s*>/gi, label: "fake-invoke-tag" },
  { re: /<function_calls>/gi, label: "function-calls-block" },
  { re: /\bcall_function\s*\(\s*["']\w+["']/gi, label: "call-function-syntax" },
  { re: /```(?:tool_code|tool_call|function|json)\s*\n\s*\{[^}]*"name"\s*:\s*"\w+"/gi, label: "fenced-tool-call" },
];

const PROPAGATION_PATTERNS = [
  { re: /\b(?:share|propagate|forward|distribute)\s+(?:this|these|the\s+following)\s+(?:to|with)\s+(?:all\s+)?(?:other\s+)?agents?\b/gi, label: "share-with-agents", severity: "block" },
  { re: /\bremember\s+to\s+tell\s+(?:every|all|other)\s+agents?\b/gi, label: "tell-all-agents", severity: "block" },
  { re: /\bwhen\s+(?:another|any|other)\s+agent\s+(?:reads|retrieves|loads)\s+this\b/gi, label: "trigger-on-retrieval", severity: "block" },
];

// ── Excerpt masking ──────────────────────────────────────────────

function maskExcerpt(content, offset, matchLen) {
  const start = Math.max(0, offset - 8);
  const end = Math.min(content.length, offset + matchLen + 8);
  let excerpt = content.slice(start, end).replace(/\s+/g, " ").trim();
  if (excerpt.length > EXCERPT_MAX_LENGTH) {
    excerpt = excerpt.slice(0, EXCERPT_MAX_LENGTH - 3) + "...";
  }
  return excerpt;
}

// ── Detector functions ───────────────────────────────────────────

function runPatterns(content, detector, patterns, defaultSeverity) {
  const out = [];
  for (const p of patterns) {
    const re = p.re;
    const severity = p.severity ?? defaultSeverity;
    for (const m of content.matchAll(re)) {
      const idx = m.index ?? 0;
      out.push({
        detector,
        severity,
        excerpt: maskExcerpt(content, idx, m[0].length),
        offset: idx,
        pattern: p.label,
      });
      if (out.length >= MAX_FINDINGS_PER_DETECTOR) return out;
    }
  }
  return out;
}

function decodedLooksLikeInstruction(decoded) {
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

function detectEncodedPayload(content) {
  const out = [];
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

// ── Public scanner ───────────────────────────────────────────────

export function scanForEmbeddedInstructions(content) {
  if (typeof content !== "string" || content.length === 0) {
    return { findings: [], blocked: false, summary: "memory-payload scan ok (empty content)" };
  }

  const findings = [];
  try {
    findings.push(...runPatterns(content, "role-marker-injection", ROLE_MARKER_PATTERNS, "block"));
  } catch {}
  try {
    findings.push(...runPatterns(content, "direct-instruction", DIRECT_INSTRUCTION_PATTERNS, "block"));
  } catch {}
  try {
    findings.push(...runPatterns(content, "tool-call-hijack", TOOL_CALL_HIJACK_PATTERNS, "block"));
  } catch {}
  try {
    findings.push(...runPatterns(content, "propagation-marker", PROPAGATION_PATTERNS, "block"));
  } catch {}
  try {
    findings.push(...detectEncodedPayload(content));
  } catch {}

  const blocked = findings.some((f) => f.severity === "block");
  const summary = buildSummary(findings, blocked);
  return { findings, blocked, summary };
}

function buildSummary(findings, blocked) {
  if (findings.length === 0) return "memory-payload scan ok (no findings)";
  const counts = {};
  for (const f of findings) counts[f.detector] = (counts[f.detector] ?? 0) + 1;
  const parts = Object.entries(counts).map(([d, n]) => `${d}=${n}`);
  const verdict = blocked ? "BLOCKED" : "warn";
  return `memory-payload ${verdict}: ${parts.join(" · ")}`.slice(0, 200);
}

// ── Composite gate ───────────────────────────────────────────────

/**
 * Note: the inspector port does NOT consult an env var. When used for
 * offline verification, the inspector ALWAYS evaluates predicates —
 * otherwise the customer could not check whether the platform's gate
 * worked. This mirrors the same pattern used in governance.mjs.
 */
export function scanMemoryWrite(req) {
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

// ── Verifier (CLI uses this) ─────────────────────────────────────

/**
 * Replay-and-confirm helper for the CLI. Given:
 *   - the original content (the auditor has it from elsewhere)
 *   - the claimed audit entry (from the R26 chain)
 * recompute the scan locally and check the platform's claims:
 *   1. Same blocked verdict
 *   2. Same contentHash (proves no swap)
 *   3. Same set of detectors triggered
 */
export function verifyMemoryPayloadBlock({ content, agentName, claimed }) {
  const replay = scanMemoryWrite({
    agentName,
    content,
    storeId: claimed.details?.storeId,
    source: claimed.details?.source,
  });
  const errors = [];

  if (replay.ok) {
    errors.push(
      `replay scan returned ok (${replay.reason}); claimed audit entry says blocked`,
    );
  } else {
    if (replay.contentHash !== claimed.details?.contentHash) {
      errors.push(
        `contentHash mismatch: replay=${replay.contentHash} claimed=${claimed.details?.contentHash}`,
      );
    }
    const replayDetectors = new Set(replay.result.findings.map((f) => f.detector));
    const claimedDetectors = new Set(
      (claimed.details?.findings ?? []).map((f) => f.detector),
    );
    for (const d of replayDetectors) {
      if (!claimedDetectors.has(d)) {
        errors.push(`replay flagged ${d} but claimed entry omitted it`);
      }
    }
    for (const d of claimedDetectors) {
      if (!replayDetectors.has(d)) {
        errors.push(`claimed entry includes ${d} but replay did not flag it`);
      }
    }
  }

  if (errors.length === 0) {
    return { ok: true, replay };
  }
  return { ok: false, errors, replay };
}
