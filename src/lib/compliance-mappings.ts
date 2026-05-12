/**
 * SOVEREIGN MATRIX — Compliance control mappings (Cook 49 / Tier 7 #31-32)
 *
 * Pre-mapped control libraries that turn platform features into
 * regulator-grade evidence:
 *
 *   - EU AI Act Annex IV  — technical documentation requirements
 *   - NIST AI RMF 1.0     — Govern / Map / Measure / Manage functions
 *   - ISO/IEC 42001       — AI management system requirements
 *
 * Each control row links a regulator requirement to one or more
 * Sovereign capabilities (verifiable receipts, drift detector, expert
 * critic, etc.). The result is a SCORECARD: every control is either
 * implemented (we have a feature), partial (in progress), or not
 * covered.
 *
 * The mapping is a CONSTANT — versioned alongside the codebase.
 * Procurement and audit teams consume the JSON form directly.
 */

// ── Public types ──────────────────────────────────────────────────────────

export type Framework = "eu-ai-act-annex-iv" | "nist-ai-rmf" | "iso-42001";

export interface Control {
  id: string;
  framework: Framework;
  title: string;
  description: string;
  /** Sovereign Matrix capability slugs that satisfy this control. */
  satisfiedBy: string[];
  /** Implementation state. */
  status: "implemented" | "partial" | "planned";
  /** Implementation notes (audit-ready language). */
  evidence?: string;
}

// ── Mapping ───────────────────────────────────────────────────────────────

export const CONTROLS: Control[] = [
  // ── EU AI Act Annex IV ──────────────────────────────────────────────
  {
    id: "EU-AIA-IV-1",
    framework: "eu-ai-act-annex-iv",
    title: "General description of the AI system",
    description:
      "Intended purpose, primary use cases, classes of users, foreseeable misuse.",
    satisfiedBy: ["agent-registry", "marketplace-detail-pages", "spec-page"],
    status: "implemented",
    evidence:
      "Every registered agent has a public detail page documenting purpose, expected inputs, models used, and safety layers.",
  },
  {
    id: "EU-AIA-IV-2",
    framework: "eu-ai-act-annex-iv",
    title: "Design specifications + system architecture",
    description:
      "How the system was designed, key assumptions, third-party tools and frameworks used.",
    satisfiedBy: ["model-attribution", "ai-router", "spec-page"],
    status: "implemented",
    evidence:
      "Model selection is logged per call (model-attribution.ts) and the AI router source is open-source-style documented at /spec.",
  },
  {
    id: "EU-AIA-IV-3",
    framework: "eu-ai-act-annex-iv",
    title: "Logging and traceability",
    description:
      "Detailed logs sufficient to retrace inputs, decisions, and outputs.",
    satisfiedBy: ["receipts", "agent-replay", "audit-log", "receipt-chain"],
    status: "implemented",
    evidence:
      "Every agent run produces a signed receipt (HMAC + Ed25519) reproducible via /api/replay/:id.",
  },
  {
    id: "EU-AIA-IV-4",
    framework: "eu-ai-act-annex-iv",
    title: "Risk management procedures",
    description: "Identified risks + mitigation measures.",
    satisfiedBy: [
      "jailbreak-detect",
      "content-safety",
      "nemo-guardrails",
      "red-team",
      "hallucination-detector",
      "bias-auditor",
    ],
    status: "implemented",
    evidence:
      "5-layer output verifier + 6th hallucination detector + red-team probes run per release.",
  },
  {
    id: "EU-AIA-IV-5",
    framework: "eu-ai-act-annex-iv",
    title: "Human oversight",
    description: "Mechanisms enabling human review and override.",
    satisfiedBy: ["action-tiers", "approval-gate", "tool-registry"],
    status: "implemented",
    evidence:
      "Three-tier approval (autonomous / confirm / admin) gates every tool call; Tier-3 actions require an explicit allowlist grant.",
  },
  {
    id: "EU-AIA-IV-6",
    framework: "eu-ai-act-annex-iv",
    title: "Accuracy / robustness / cybersecurity",
    description: "Test results demonstrating accuracy + robustness.",
    satisfiedBy: [
      "quality-scorer",
      "drift-detector",
      "red-team",
      "confidence-gate",
    ],
    status: "implemented",
    evidence:
      "Quality scoring rejects low-quality outputs pre-delivery; drift-detector compares replays against the original; red-team probes execute on every release.",
  },

  // ── NIST AI RMF 1.0 ─────────────────────────────────────────────────
  {
    id: "NIST-AI-RMF-GOVERN-1.1",
    framework: "nist-ai-rmf",
    title: "Legal and regulatory requirements involving AI are understood",
    description: "Inventory of applicable laws + regulations.",
    satisfiedBy: ["compliance-mappings", "privacy-rights", "terms-page"],
    status: "implemented",
    evidence:
      "This module is the inventory; /privacy-rights and /terms expose user-facing obligations.",
  },
  {
    id: "NIST-AI-RMF-MAP-1.1",
    framework: "nist-ai-rmf",
    title: "Context is established and understood",
    description: "Intended use, deployment context, beneficiaries identified.",
    satisfiedBy: ["agent-registry", "marketplace-detail-pages"],
    status: "implemented",
  },
  {
    id: "NIST-AI-RMF-MEASURE-2.1",
    framework: "nist-ai-rmf",
    title: "Quality of outputs is measured",
    description:
      "Quantitative metrics, regression testing, evaluator outputs available.",
    satisfiedBy: ["quality-scorer", "drift-detector", "hallucination-detector"],
    status: "implemented",
  },
  {
    id: "NIST-AI-RMF-MEASURE-2.7",
    framework: "nist-ai-rmf",
    title: "Safety and security are measured",
    description: "Adversarial testing + red-team results recorded.",
    satisfiedBy: ["red-team", "ci-workflow"],
    status: "implemented",
    evidence:
      "Adversarial probes run on every PR via the red-team campaign module; results embedded in CI gate.",
  },
  {
    id: "NIST-AI-RMF-MANAGE-1.3",
    framework: "nist-ai-rmf",
    title: "Mechanisms for response to identified risks",
    description: "Documented incident-response + drift-response procedures.",
    satisfiedBy: ["agent-replay", "drift-detector", "audit-log"],
    status: "implemented",
  },

  // ── ISO/IEC 42001 ───────────────────────────────────────────────────
  {
    id: "ISO-42001-6.1.2",
    framework: "iso-42001",
    title: "AI risk assessment",
    description: "Documented assessment of AI-related risks.",
    satisfiedBy: ["red-team", "hallucination-detector", "bias-auditor"],
    status: "implemented",
  },
  {
    id: "ISO-42001-8.2",
    framework: "iso-42001",
    title: "AI system impact assessment",
    description: "Assessment of impact on individuals, groups, and society.",
    satisfiedBy: ["bias-auditor", "expert-critic"],
    status: "implemented",
  },
  {
    id: "ISO-42001-8.3",
    framework: "iso-42001",
    title: "Data quality + data management",
    description: "Documented data sources + quality controls.",
    satisfiedBy: ["rag", "tenant-memory", "input-sanitizer"],
    status: "implemented",
  },
  {
    id: "ISO-42001-9.2",
    framework: "iso-42001",
    title: "Continuous monitoring",
    description: "Ongoing measurement of system performance + drift.",
    satisfiedBy: ["drift-detector", "cost-telemetry", "agent-replay"],
    status: "implemented",
  },
];

// ── Aggregation / scorecard ───────────────────────────────────────────────

export interface FrameworkScorecard {
  framework: Framework;
  total: number;
  implemented: number;
  partial: number;
  planned: number;
  coverageFraction: number;
  controls: Control[];
}

/**
 * Build a per-framework scorecard from the constant control list.
 * Pure function — caller can extend with custom controls if needed.
 */
export function buildScorecard(
  framework: Framework,
  extraControls: Control[] = [],
): FrameworkScorecard {
  const merged = [...CONTROLS, ...extraControls].filter(
    (c) => c.framework === framework,
  );
  const total = merged.length;
  const implemented = merged.filter((c) => c.status === "implemented").length;
  const partial = merged.filter((c) => c.status === "partial").length;
  const planned = merged.filter((c) => c.status === "planned").length;
  // Implemented counts as 1, partial as 0.5, planned as 0.
  const coverageFraction =
    total === 0 ? 0 : (implemented + partial * 0.5) / total;
  return {
    framework,
    total,
    implemented,
    partial,
    planned,
    coverageFraction,
    controls: merged,
  };
}

/**
 * Render a per-control evidence line — used by the attestation-letter
 * generator and the /trust page.
 */
export function renderControlLine(c: Control): string {
  const status =
    c.status === "implemented" ? "[✓]" : c.status === "partial" ? "[~]" : "[ ]";
  const sat = c.satisfiedBy.length
    ? ` — satisfied by: ${c.satisfiedBy.join(", ")}`
    : "";
  return `${status} ${c.id}: ${c.title}${sat}`;
}
