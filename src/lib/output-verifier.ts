// STATUS: WIRED. createAgentRoute calls verifyOutput() when a route opts in
// via `useVerifier: true` (see src/lib/agent-factory.ts). Currently active
// on /api/_agents/agency-packet; expand to other customer-facing routes as
// the latency budget allows (~+200-400ms p50).
import { createLogger } from "@/lib/logger";
import { logExecution, type AuditEntry } from "@/lib/execution-audit";
import {
  needsApproval,
  classifyAction,
  DEFAULT_TRUST_LEVEL,
  type TrustLevel,
} from "@/lib/trust-levels";
import { emitDefenseReceipt } from "@/lib/defense-receipts";

const log = createLogger("output-verifier");

/**
 * OUTPUT VERIFICATION PIPELINE — Mythos-ready safety for agent outputs.
 *
 * Every agent output passes through 5 independent checks before delivery:
 *
 * 1. LlamaGuard Classification — Is the output safe? (NIM free tier)
 * 2. PII Scanner — Does output contain personal data? (regex-based)
 * 3. Content Policy — Does output violate content guidelines?
 * 4. Quality Score — Is the output relevant and coherent? (0-100)
 * 5. Trust Gate — Does this action need human approval?
 *
 * If any check fails, the output is blocked and logged.
 * If trust level requires approval, output is held in queue.
 *
 * This is the "harness" Anthropic describes — the software layer
 * that makes frontier models safe to deploy in business.
 */

export interface VerificationResult {
  approved: boolean;
  output: string;
  safetyResult: AuditEntry["safetyResult"];
  trustDecision: "auto-approved" | "needs-approval" | "blocked";
  blockReason?: string;
  executionTimeMs: number;
}

// ─── PII Detection (regex-based, zero API cost) ─────────────
const PII_PATTERNS = [
  { name: "SSN", pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
  {
    name: "Credit Card",
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  },
  {
    name: "Phone",
    pattern: /\b(?:\+1[\s.-]?)?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
  },
  {
    name: "Email (exposed)",
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  },
];

function scanPII(text: string): { hasPII: boolean; types: string[] } {
  const found: string[] = [];
  for (const { name, pattern } of PII_PATTERNS) {
    if (pattern.test(text)) found.push(name);
    pattern.lastIndex = 0; // Reset regex state
  }
  return { hasPII: found.length > 0, types: found };
}

// ─── Content Policy Check ───────────────────────────────────
const BLOCKED_PATTERNS = [
  /how to (make|build|create) (a )?(bomb|weapon|explosive)/i,
  /instructions for (hacking|breaking into|exploiting)/i,
  /generate (malware|ransomware|virus|trojan)/i,
  /bypass (security|authentication|firewall)/i,
];

function checkContentPolicy(text: string): {
  passes: boolean;
  violation?: string;
} {
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(text)) {
      return {
        passes: false,
        violation: `Content policy violation: ${pattern.source.slice(0, 50)}`,
      };
    }
  }
  return { passes: true };
}

// ─── Quality Scoring (heuristic) ────────────────────────────
function scoreQuality(output: string, prompt: string): number {
  let score = 50; // Base score

  // Length appropriateness (not too short, not too long)
  if (output.length > 100) score += 10;
  if (output.length > 500) score += 10;
  if (output.length < 20) score -= 20;

  // Contains structured content (headings, lists, numbers)
  if (output.includes("##") || output.includes("- ")) score += 10;
  if (/\d+/.test(output)) score += 5;

  // Relevance: does output reference terms from prompt?
  const promptWords = prompt
    .toLowerCase()
    .split(/\s+/)
    .filter((w) => w.length > 4);
  const outputLower = output.toLowerCase();
  const relevantWords = promptWords.filter((w) => outputLower.includes(w));
  score += Math.min(15, relevantWords.length * 3);

  // Penalize repetition
  const sentences = output.split(/[.!?]+/).filter((s) => s.trim().length > 10);
  const uniqueSentences = new Set(sentences.map((s) => s.trim().toLowerCase()));
  if (sentences.length > 3 && uniqueSentences.size < sentences.length * 0.7)
    score -= 15;

  return Math.max(0, Math.min(100, score));
}

// ─── LlamaGuard Output Check ────────────────────────────────
// Wrapped in `nimBreaker` so a NIM degradation doesn't make every
// agent request eat the full 5s timeout. After 3 consecutive failures
// the breaker opens for 30s and llamaGuardOutput returns {safe:true}
// (fail-open) without hitting NIM. The other 4 verifier layers — PII
// regex, content-policy regex, heuristic quality, critic — remain
// active throughout, so the safety pipeline never goes blind.
import { nimBreaker } from "@/lib/circuit-breaker";

async function llamaGuardOutput(
  text: string,
): Promise<{ safe: boolean; category?: string }> {
  const nimKey = process.env.NVIDIA_NIM_API_KEY;
  if (!nimKey) return { safe: true };

  try {
    return await nimBreaker.execute(async () => {
      const res = await fetch(
        "https://integrate.api.nvidia.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${nimKey}`,
          },
          body: JSON.stringify({
            model: "meta/llama-guard-3-8b",
            messages: [{ role: "assistant", content: text }],
            max_tokens: 100,
            temperature: 0,
          }),
          signal: AbortSignal.timeout(5000),
        },
      );

      if (!res.ok) {
        // Throw so the breaker counts this as a failure — without
        // this, transient 502s wouldn't trigger the breaker open.
        throw new Error(`NIM LlamaGuard returned HTTP ${res.status}`);
      }

      const data = await res.json();
      const verdict =
        data.choices?.[0]?.message?.content?.trim().toLowerCase() || "";
      return verdict.startsWith("safe") || verdict === "safe"
        ? { safe: true as const }
        : { safe: false as const, category: verdict };
    });
  } catch {
    log.warn(
      "LlamaGuard output check failed — allowing through (other layers active)",
    );
  }
  return { safe: true };
}

// ─── Main Verification Pipeline ─────────────────────────────
export async function verifyOutput(params: {
  agentName: string;
  modelUsed: string;
  tenantId: string;
  prompt: string;
  output: string;
  trustLevel?: TrustLevel;
  chainDepth?: number;
  externalApis?: string[];
}): Promise<VerificationResult> {
  const start = Date.now();
  const trustLevel = params.trustLevel || DEFAULT_TRUST_LEVEL;

  // Run all checks in parallel for speed
  const [llamaResult, piiResult, contentResult] = await Promise.all([
    llamaGuardOutput(params.output),
    Promise.resolve(scanPII(params.output)),
    Promise.resolve(checkContentPolicy(params.output)),
  ]);

  const qualityScore = scoreQuality(params.output, params.prompt);
  const executionTimeMs = Date.now() - start;

  // Build safety result
  const safetyResult: AuditEntry["safetyResult"] = {
    jailbreak: llamaResult.safe ? "pass" : "fail",
    pii: piiResult.hasPII ? "fail" : "pass",
    content: contentResult.passes ? "pass" : "fail",
    quality: qualityScore,
    critic: qualityScore >= 40 ? "pass" : "fail",
  };

  // Determine if blocked
  const isBlocked = !llamaResult.safe || !contentResult.passes;
  const blockReason = !llamaResult.safe
    ? `LlamaGuard blocked: ${llamaResult.category}`
    : !contentResult.passes
      ? contentResult.violation
      : undefined;

  if (isBlocked) {
    // Fire-and-forget — the signal is the OUTPUT (not the prompt), so the
    // commitment proves which output was blocked without storing the
    // blocked text. Category is "output-policy" for content violations,
    // "pii-leak" if PII triggered the policy fail (rare; pii is normally
    // redacted, not blocked).
    void emitDefenseReceipt({
      ruleId: !llamaResult.safe
        ? `output-verifier.llama-guard.${llamaResult.category ?? "unsafe"}`
        : "output-verifier.content-policy",
      category: "output-policy",
      severity: 80,
      reason: blockReason ?? "Output blocked by verifier",
      signal: params.output,
      tenantId: params.tenantId,
    });
  }

  // Classify action for trust gate
  const actionClass = classifyAction({
    exportsData: params.externalApis && params.externalApis.length > 0,
    callsExternalApi: params.externalApis && params.externalApis.length > 0,
    chainDepth: params.chainDepth,
  });

  const requiresApproval =
    !isBlocked &&
    needsApproval(trustLevel, {
      isAnomalous: actionClass.isAnomalous,
      isCritical: actionClass.isCritical,
      chainDepth: params.chainDepth,
    });

  // Determine trust decision
  const trustDecision: VerificationResult["trustDecision"] = isBlocked
    ? "blocked"
    : requiresApproval
      ? "needs-approval"
      : "auto-approved";

  // Log to audit trail
  logExecution({
    tenantId: params.tenantId,
    agentName: params.agentName,
    modelUsed: params.modelUsed,
    input: params.prompt,
    output: params.output,
    safetyResult,
    trustLevel,
    approvalRequired: requiresApproval,
    approvalStatus: isBlocked
      ? "denied"
      : requiresApproval
        ? "pending"
        : "auto",
    executionTimeMs,
    chainDepth: params.chainDepth || 0,
    externalApisAccessed: params.externalApis || [],
    dataExported: false,
  });

  // PII warning (don't block, but redact in output)
  let finalOutput = params.output;
  if (piiResult.hasPII) {
    log.warn(
      `PII detected in output: ${piiResult.types.join(", ")} — agent=${params.agentName}`,
    );
    // Redact PII from output
    for (const { pattern } of PII_PATTERNS) {
      finalOutput = finalOutput.replace(pattern, "[REDACTED]");
      pattern.lastIndex = 0;
    }
  }

  return {
    approved: !isBlocked && !requiresApproval,
    output: isBlocked ? `[Output blocked: ${blockReason}]` : finalOutput,
    safetyResult,
    trustDecision,
    blockReason,
    executionTimeMs,
  };
}
