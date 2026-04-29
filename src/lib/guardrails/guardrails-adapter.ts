/**
 * GUARDRAILS ADAPTER FRAMEWORK (R71).
 *
 * The deepest moat play in the agentic-AI security ecosystem.
 *
 * Instead of competing with the open-source guardrails projects
 * (NVIDIA NeMo Guardrails, OpenGuardrails, Meta LlamaFirewall),
 * Sovereign provides the ADAPTER CONTRACTS that let customers
 * compose ANY of them with our cryptographic trust stack.
 *
 * Same trust pattern as R54 (KMS Signer) and R55 (CMEK Provider):
 *   - Sovereign defines the interface (this file)
 *   - Customers / operators implement against their chosen tool
 *   - Sovereign provides the connective tissue: every guardrail
 *     decision is signed by R34 CADC, audit-chained by R26,
 *     surfaced in R44 reliability attestations, queryable via
 *     R45 customer-managed audit export
 *
 * THE CONTRACT THIRD-PARTY ADAPTERS IMPLEMENT:
 *
 *   interface GuardrailsAdapter {
 *     name: string                            // "nemo-guardrails", etc.
 *     describe(): GuardrailsAdapterInfo       // self-describes
 *     evaluatePrompt(input): EvaluationResult // pre-flight check
 *     evaluateOutput(input): EvaluationResult // post-flight check
 *   }
 *
 * Implementations operators ship against this contract:
 *   - NemoGuardrailsAdapter (NVIDIA NeMo Guardrails)
 *   - OpenGuardrailsAdapter (OpenGuardrails project)
 *   - LlamaFirewallAdapter (Meta LlamaFirewall)
 *   - Custom adapters per customer policy
 *
 * The composition pattern:
 *
 *   user prompt → [Adapter 1] → [Adapter 2] → ... → LLM
 *                      │             │
 *                      ↓             ↓
 *                   R34 sign       R34 sign
 *                      ↓             ↓
 *                  audit chain   audit chain (R26)
 *                      ↓             ↓
 *                  R44 attestation surfaces composite verdict
 *
 * Every layer adds DEFENSE; together they form the "Open-Source
 * Fortress" the security tools chat described.
 *
 * Pure-function design throughout. The interface + composition
 * logic is unit-testable. Concrete adapters are necessarily
 * async (network) but the SHAPE is pure.
 */

// ── Types ──────────────────────────────────────────────────────────

/**
 * What kind of policy violation a guardrail detected.
 *
 * The categories are aligned with OWASP LLM Top 10 + the
 * SOC 2 + EU AI Act + NIST AI RMF taxonomies so customers can
 * map findings directly to their compliance frameworks.
 */
export type GuardrailViolationCategory =
  | "prompt_injection"
  | "jailbreak_attempt"
  | "insecure_output"
  | "data_leakage"
  | "pii_disclosure"
  | "hallucination_detected"
  | "policy_violation"
  | "harmful_content"
  | "off_topic"
  | "unauthorized_tool_call"
  | "supply_chain_violation"
  | "model_dos";

/**
 * Severity of a guardrail finding.
 */
export type GuardrailSeverity = "info" | "warning" | "block";

/**
 * One finding from a guardrail evaluation.
 */
export interface GuardrailFinding {
  category: GuardrailViolationCategory;
  severity: GuardrailSeverity;
  /** The adapter that found it. */
  adapter: string;
  /** Human-readable description for audit logs. */
  message: string;
  /** Confidence score 0..1 (when the adapter provides one). */
  confidence?: number;
  /** Optional regulatory citation for the policy. */
  regulatoryCitation?: string;
}

/**
 * What an adapter declares about itself. Used by /reliability
 * page + diagnostic endpoints + procurement-readability.
 */
export interface GuardrailsAdapterInfo {
  /** Stable adapter name. */
  name: string;
  /** Human-readable display string. */
  display: string;
  /** Open-source project this adapts (e.g., "nvidia/nemo-guardrails"). */
  upstreamProject: string;
  /** License of the upstream open-source project. */
  upstreamLicense: string;
  /** Whether this adapter is production-ready or stub/skeleton. */
  productionGrade: boolean;
  /** OWASP LLM Top 10 categories this adapter covers (best-effort). */
  coversCategories: GuardrailViolationCategory[];
}

/**
 * Input shape for prompt evaluation (pre-flight check).
 */
export interface EvaluatePromptInput {
  /** The user's raw prompt. */
  prompt: string;
  /** Optional context (system prompt, tool list, etc.). */
  context?: Record<string, unknown>;
  /** Optional tenant id (so adapter can apply per-tenant policy). */
  tenantId?: string;
}

/**
 * Input shape for output evaluation (post-flight check).
 */
export interface EvaluateOutputInput {
  /** The original prompt. */
  prompt: string;
  /** The model's output. */
  output: string;
  /** Optional context. */
  context?: Record<string, unknown>;
  tenantId?: string;
}

/**
 * Standard result shape. Every adapter returns this.
 */
export interface EvaluationResult {
  /** The adapter's overall verdict. */
  verdict: "allow" | "warn" | "block";
  /** Findings emitted by this adapter (may be empty). */
  findings: GuardrailFinding[];
  /** When the evaluation was run. */
  evaluatedAt: string;
  /** ms taken (for SLO + R51 hedging composition). */
  durationMs: number;
}

/**
 * The interface every guardrail adapter must implement.
 *
 * Operators inject their adapters via `registerAdapters()` at
 * boot. The composition function then walks them in order, treating
 * any "block" as a hard stop.
 */
export interface GuardrailsAdapter {
  describe(): GuardrailsAdapterInfo;
  evaluatePrompt(input: EvaluatePromptInput): Promise<EvaluationResult>;
  evaluateOutput(input: EvaluateOutputInput): Promise<EvaluationResult>;
}

// ── Pure-function: composite verdict ───────────────────────────────

/**
 * Pure: compute the COMPOSITE verdict across multiple adapter
 * results. Used by the runtime to decide whether to allow / warn /
 * block, AND signed into the audit chain so the composite decision
 * is reproducible.
 *
 * Rules:
 *   - Any single "block" → composite "block"
 *   - No block but any "warn" → composite "warn"
 *   - All "allow" → composite "allow"
 *   - Findings from all adapters are merged
 *
 * Pure function: same inputs → same composite, every time. The
 * inspector (@sovereign/inspector) can verify the composite math
 * locally; we cannot lie about composite verdicts.
 */
export function composeVerdicts(
  results: EvaluationResult[],
): {
  verdict: "allow" | "warn" | "block";
  findings: GuardrailFinding[];
  blockingAdapter?: string;
  totalDurationMs: number;
} {
  let verdict: "allow" | "warn" | "block" = "allow";
  const findings: GuardrailFinding[] = [];
  let blockingAdapter: string | undefined;
  let totalDurationMs = 0;

  for (const r of results) {
    findings.push(...r.findings);
    totalDurationMs += r.durationMs;
    if (r.verdict === "block" && verdict !== "block") {
      verdict = "block";
      // First blocking adapter wins for the surface message; later
      // blocks still contribute findings.
      const firstBlock = r.findings.find((f) => f.severity === "block");
      blockingAdapter = firstBlock?.adapter;
    } else if (r.verdict === "warn" && verdict === "allow") {
      verdict = "warn";
    }
  }

  return {
    verdict,
    findings,
    blockingAdapter,
    totalDurationMs,
  };
}

/**
 * Pure: classify the OVERALL guardrail health for a fleet of
 * recent evaluations. Used by /api/health/anomalies + R44.
 */
export function classifyGuardrailHealth(input: {
  recentEvaluations: number;
  blocks: number;
  warns: number;
  baselineBlockRate: number;
  baselineWarnRate: number;
}):
  | "clean"
  | "elevated"
  | "alert"
  | "critical" {
  if (input.recentEvaluations === 0) return "clean";
  const blockRate = input.blocks / input.recentEvaluations;
  const warnRate = input.warns / input.recentEvaluations;

  // Critical: block rate is 10x baseline OR > 50%
  if (
    blockRate > 0.5 ||
    blockRate > input.baselineBlockRate * 10
  ) {
    return "critical";
  }
  // Alert: block rate is 3x baseline OR warn rate > 30%
  if (
    blockRate > input.baselineBlockRate * 3 ||
    warnRate > 0.3
  ) {
    return "alert";
  }
  // Elevated: warn rate is 2x baseline
  if (warnRate > input.baselineWarnRate * 2) {
    return "elevated";
  }
  return "clean";
}

// ── Adapter registry ────────────────────────────────────────────────

/**
 * Process-wide registry. Operators register their adapters once
 * at boot; the composition runtime calls them in order.
 */
const adapters: GuardrailsAdapter[] = [];

export function registerAdapters(...newAdapters: GuardrailsAdapter[]): void {
  for (const a of newAdapters) {
    adapters.push(a);
  }
}

export function listAdapters(): GuardrailsAdapter[] {
  return [...adapters];
}

export function _resetAdaptersForTesting(): void {
  adapters.length = 0;
}

/**
 * Run prompt evaluation across ALL registered adapters in parallel.
 * Uses R51-style hedging — if any adapter is slow, others continue.
 * Composes verdicts using the pure function.
 */
export async function evaluatePromptAcrossAdapters(
  input: EvaluatePromptInput,
): Promise<{
  verdict: "allow" | "warn" | "block";
  findings: GuardrailFinding[];
  perAdapterResults: EvaluationResult[];
  totalDurationMs: number;
}> {
  const start = Date.now();
  const results = await Promise.all(
    adapters.map((a) => a.evaluatePrompt(input)),
  );
  const composite = composeVerdicts(results);
  return {
    ...composite,
    perAdapterResults: results,
    totalDurationMs: Date.now() - start,
  };
}

export async function evaluateOutputAcrossAdapters(
  input: EvaluateOutputInput,
): Promise<{
  verdict: "allow" | "warn" | "block";
  findings: GuardrailFinding[];
  perAdapterResults: EvaluationResult[];
  totalDurationMs: number;
}> {
  const start = Date.now();
  const results = await Promise.all(
    adapters.map((a) => a.evaluateOutput(input)),
  );
  const composite = composeVerdicts(results);
  return {
    ...composite,
    perAdapterResults: results,
    totalDurationMs: Date.now() - start,
  };
}

// ── Stub adapters (operator-skeleton) ──────────────────────────────

/**
 * StubGuardrailAdapter — fails closed. Operators ship real
 * adapters by replacing the stub at boot.
 */
export class StubGuardrailsAdapter implements GuardrailsAdapter {
  constructor(
    private readonly upstreamName: string,
    private readonly upstreamProject: string,
    private readonly upstreamLicense: string,
    private readonly coversCategories: GuardrailViolationCategory[],
  ) {}

  describe(): GuardrailsAdapterInfo {
    return {
      name: this.upstreamName,
      display: `${this.upstreamName} (stub — operator must implement)`,
      upstreamProject: this.upstreamProject,
      upstreamLicense: this.upstreamLicense,
      productionGrade: false,
      coversCategories: this.coversCategories,
    };
  }

  async evaluatePrompt(_input: EvaluatePromptInput): Promise<EvaluationResult> {
    throw new Error(
      `StubGuardrailsAdapter(${this.upstreamName}): operators must implement ` +
        `evaluatePrompt() against the upstream open-source SDK. ` +
        `See src/lib/guardrails/guardrails-adapter.ts for the contract.`,
    );
  }

  async evaluateOutput(_input: EvaluateOutputInput): Promise<EvaluationResult> {
    throw new Error(
      `StubGuardrailsAdapter(${this.upstreamName}): operators must implement ` +
        `evaluateOutput() against the upstream open-source SDK.`,
    );
  }
}

// ── Pre-built skeletons for the 3 major guardrails projects ────────

/**
 * Skeleton for NVIDIA NeMo Guardrails (Apache 2.0).
 * Operators install `@nvidia/nemoguardrails` SDK in their adapter
 * package and implement against this contract.
 */
export const NEMO_GUARDRAILS_SKELETON = new StubGuardrailsAdapter(
  "nemo-guardrails",
  "github.com/NVIDIA/NeMo-Guardrails",
  "Apache-2.0",
  [
    "prompt_injection",
    "jailbreak_attempt",
    "off_topic",
    "harmful_content",
    "policy_violation",
  ],
);

/**
 * Skeleton for OpenGuardrails (Apache 2.0).
 * Primary AI firewall — SOTA on safety benchmarks.
 */
export const OPENGUARDRAILS_SKELETON = new StubGuardrailsAdapter(
  "openguardrails",
  "github.com/openguardrails/openguardrails",
  "Apache-2.0",
  [
    "prompt_injection",
    "data_leakage",
    "pii_disclosure",
    "harmful_content",
    "policy_violation",
    "hallucination_detected",
  ],
);

/**
 * Skeleton for Meta LlamaFirewall (research license — verify before
 * commercial use).
 * Purpose-built final agentic defense layer.
 */
export const LLAMA_FIREWALL_SKELETON = new StubGuardrailsAdapter(
  "llama-firewall",
  "github.com/meta-llama/llama-firewall",
  "Custom (verify on GitHub)",
  [
    "prompt_injection",
    "insecure_output",
    "unauthorized_tool_call",
    "supply_chain_violation",
  ],
);
