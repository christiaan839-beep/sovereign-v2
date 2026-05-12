/**
 * Expert Critic — domain-aware final-pass review of agent output.
 *
 * The eighth super-agent primitive from the expansion playbook. After
 * an agent has produced its answer (and the confidence-gate has cleared
 * it), an expert critic runs a final structured review against an
 * industry-specific rubric ("would a Clinical Research Associate
 * approve this protocol-deviation triage? Would an SEC-registered
 * climate-disclosure auditor sign off on this Scope 3 calculation?").
 *
 * What this is NOT: a second model running the same prompt. That's
 * `consensusAi`. This is a model running a DIFFERENT prompt — the
 * rubric prompt — over the candidate answer, evaluating it against
 * domain-specific criteria. The two layers compose.
 *
 * Architecture:
 *   - Per-domain `ExpertRubric` defines the role, the checklist, and
 *     the bar (must-pass criteria vs. nice-to-have).
 *   - `expertReview(answer, rubric)` invokes a critic model with the
 *     rubric as its system prompt and returns a structured verdict.
 *   - Verdict is JSON-parseable {pass, findings[], severity, suggestion}
 *     so callers can branch (commit | revise | abstain).
 *
 * Failure mode targeted: the agent that looks competent and confident
 * but is missing a regulatory citation a domain expert would flag in
 * seconds. The critic acts as the missing senior reviewer.
 */

import { ai } from "./ai";
import { createLogger } from "./logger";

const log = createLogger("expert-critic");

/** Severity ladder for findings. Higher = more action required. */
export type FindingSeverity = "info" | "minor" | "major" | "blocker";

/** A single finding from an expert review. */
export interface ExpertFinding {
  severity: FindingSeverity;
  /** Short label, e.g. "missing citation", "ambiguous causality". */
  category: string;
  /** Specific instance, with line/section reference when possible. */
  detail: string;
  /** What to do about it. */
  suggestion: string;
}

/** Rubric: the prompt + bar for a given domain. */
export interface ExpertRubric {
  /** Slug identifying the rubric (e.g. "pharma-protocol-deviation"). */
  id: string;
  /** Human-readable label. */
  label: string;
  /**
   * The expert role the critic should embody, written as a system
   * prompt. Example: "You are a senior CRA with 15 years experience
   * monitoring oncology trials at a top-10 sponsor. You read every
   * protocol deviation triage for accuracy, regulatory citation,
   * and CAPA suitability before it goes to the auditor."
   */
  expertSystem: string;
  /**
   * Domain-specific must-pass criteria. The critic must explicitly
   * evaluate each. When any criterion fails with severity ≥ major,
   * the verdict's overall `pass` is false.
   */
  mustPass: string[];
  /** Nice-to-have criteria. Failure is logged but not blocking. */
  niceToHave: string[];
}

/** The critic's verdict on a candidate answer. */
export interface ExpertVerdict {
  /** True only if the answer passes every must-pass criterion. */
  pass: boolean;
  /** Highest finding severity present. Null if no findings. */
  worstSeverity: FindingSeverity | null;
  /** All findings, sorted by severity (blocker → info). */
  findings: ExpertFinding[];
  /**
   * Concrete revision suggestion the agent can use to self-correct.
   * Empty when `pass === true`.
   */
  revisionPrompt: string;
  /** The rubric id this verdict was rendered against. */
  rubricId: string;
}

/**
 * Severity rank for sorting. Higher = worse.
 */
const SEVERITY_RANK: Record<FindingSeverity, number> = {
  info: 0,
  minor: 1,
  major: 2,
  blocker: 3,
};

/**
 * Built-in rubric library. Add new rubrics here as new domains ship.
 * Each rubric is a self-contained system-prompt-plus-checklist; the
 * critic model loads it as its system prompt and evaluates the
 * candidate answer against the criteria.
 */
export const RUBRICS: Record<string, ExpertRubric> = {
  "pharma-protocol-deviation": {
    id: "pharma-protocol-deviation",
    label: "Pharma — Protocol Deviation Triage",
    expertSystem:
      "You are a senior Clinical Research Associate (CRA) with 15 years experience monitoring oncology trials at a top-10 sponsor. You evaluate every protocol deviation triage for ICH-GCP E6(R3) Section 5.20 alignment, root-cause specificity, CAPA actionability, and 21 CFR 312.62(b) recordkeeping completeness.",
    mustPass: [
      "Names the specific protocol section violated (e.g. 'Section 7.2.1 inclusion criterion 4').",
      "Classifies severity as minor / major / critical with a defensible rationale.",
      "Identifies a root cause that is specific to this site/subject (not 'human error').",
      "Proposes a CAPA that is auditable, not just procedural.",
      "Cites the regulatory framework that drives the classification (ICH-GCP, 21 CFR).",
    ],
    niceToHave: [
      "References whether this deviation triggers any reporting obligation to the IRB/IEC.",
      "Notes whether the deviation pattern is recurring at this site.",
    ],
  },

  "climate-scope-calculation": {
    id: "climate-scope-calculation",
    label: "Climate — Scope 1/2/3 Emissions Calculation",
    expertSystem:
      "You are a registered greenhouse-gas verifier accredited under ISO 14065. You review every Scope 1/2/3 emissions calculation for GHG Protocol Corporate Standard alignment, factor source provenance, allocation method defensibility, and limited-assurance readiness under CSRD Article 8a.",
    mustPass: [
      "Cites the specific emission factor used, with source (IPCC AR6, EPA eGRID, IEA, DEFRA).",
      "States the GWP basis (AR5 vs AR6) explicitly.",
      "Identifies the operational vs. financial control boundary used.",
      "Shows the activity-data → emissions formula plainly so a third-party can replay.",
      "Notes any allocation method (mass / economic / hybrid) when relevant.",
    ],
    niceToHave: [
      "References whether this falls under SEC S-K 1500 'material' threshold.",
      "Notes ISSB IFRS S2 cross-applicability if international.",
    ],
  },

  "aec-submittal-review": {
    id: "aec-submittal-review",
    label: "AEC — Construction Submittal Review",
    expertSystem:
      "You are a senior construction project engineer with 20 years experience reviewing submittals on commercial and infrastructure projects. You evaluate every submittal routing decision for spec-section alignment, code-compliance flagging, RFI-trigger detection, and the AIA-A201 review-period clock.",
    mustPass: [
      "Names the specific spec section the submittal addresses (e.g. 'Division 09 21 16 — Gypsum Board Assemblies').",
      "Routes to a defensible reviewer team (Architect, Structural, MEP, Civil, Owner) with rationale.",
      "Flags any code/spec deviation in the submittal — never approves a non-conforming item silently.",
      "Calls out missing data that would trigger an RFI rather than guessing values.",
      "Cites the contract document (drawings, spec section, RFI #, ASI #) the decision rests on.",
    ],
    niceToHave: [
      "Notes whether this submittal is on the long-lead-item critical path.",
      "References the AIA-A201 §3.10 / §4.2 review-period implications.",
    ],
  },

  "generic-audit-ready": {
    id: "generic-audit-ready",
    label: "Generic — Audit-Ready Output",
    expertSystem:
      "You are a senior audit reviewer who reads every AI-generated document before it goes to an external auditor. You catch missing citations, unsupported claims, ambiguous attributions, and statements a regulator would challenge.",
    mustPass: [
      "Every factual claim has a citable source.",
      "No statement is more confident than the evidence supports.",
      "Attributions are unambiguous (no 'studies show').",
      "Numbers carry units and methodology references.",
    ],
    niceToHave: [
      "Counter-evidence is acknowledged where it exists.",
      "Limitations of the analysis are stated explicitly.",
    ],
  },
};

/**
 * Build the user prompt the critic sees. Kept as a pure helper so
 * tests can assert on the exact rubric-injection text without
 * exercising the network.
 */
export function buildCriticPrompt(
  candidateAnswer: string,
  rubric: ExpertRubric,
): string {
  const mustPassList = rubric.mustPass
    .map((c, i) => `  ${i + 1}. ${c}`)
    .join("\n");
  const niceList = rubric.niceToHave
    .map((c, i) => `  ${i + 1}. ${c}`)
    .join("\n");

  return [
    `Evaluate the following candidate output against the ${rubric.label} rubric.`,
    "",
    "MUST-PASS CRITERIA (failure of any → blocker / major):",
    mustPassList,
    "",
    "NICE-TO-HAVE CRITERIA (failure → minor / info):",
    niceList,
    "",
    "CANDIDATE OUTPUT (delimited):",
    "<<<CANDIDATE",
    candidateAnswer,
    "CANDIDATE>>>",
    "",
    "Respond ONLY with a single JSON object on one line, matching this exact schema:",
    `{"pass":boolean,"findings":[{"severity":"info|minor|major|blocker","category":string,"detail":string,"suggestion":string}],"revisionPrompt":string}`,
    "",
    "Rules:",
    "- `pass` is false if ANY must-pass criterion fails with major or blocker severity.",
    "- `findings` may be empty when the output is excellent. Be honest, not generous.",
    "- `revisionPrompt` should be a concrete instruction the original agent can use to fix issues. Empty string if `pass` is true.",
    "- Respond with the JSON object only — no preamble, no markdown fences.",
  ].join("\n");
}

/**
 * Extract a JSON object from the model's raw response. Models
 * occasionally wrap JSON in ```json fences or add a preamble; this
 * helper is forgiving but strict — it finds the FIRST balanced
 * top-level object and parses it. Anything that can't be parsed
 * cleanly returns null.
 *
 * Pure function — exported for unit testing.
 */
export function extractJsonObject(raw: string): unknown | null {
  if (!raw) return null;
  // Strip common code-fence wrapping
  const cleaned = raw.replace(/^```(?:json)?\s*/gm, "").replace(/```$/gm, "");
  // Find the first { … }-balanced span
  let depth = 0;
  let start = -1;
  for (let i = 0; i < cleaned.length; i++) {
    const ch = cleaned[i];
    if (ch === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        const candidate = cleaned.slice(start, i + 1);
        try {
          return JSON.parse(candidate);
        } catch {
          // Continue searching; might be a stray brace
          start = -1;
        }
      }
    }
  }
  return null;
}

/**
 * Normalize the parsed JSON into an `ExpertVerdict`. Defensive — when
 * the model omits or malforms fields, the verdict still surfaces a
 * sensible failure (worstSeverity=blocker, pass=false) so the caller
 * never accepts a missing review as a pass.
 *
 * Pure function — exported for unit testing.
 */
export function normalizeVerdict(
  parsed: unknown,
  rubricId: string,
): ExpertVerdict {
  const obj = (parsed ?? {}) as Record<string, unknown>;
  const rawFindings = Array.isArray(obj.findings) ? obj.findings : [];

  const findings: ExpertFinding[] = rawFindings
    .map((raw): ExpertFinding | null => {
      if (typeof raw !== "object" || raw === null) return null;
      const f = raw as Record<string, unknown>;
      const severity = (f.severity as string) ?? "info";
      if (!["info", "minor", "major", "blocker"].includes(severity))
        return null;
      return {
        severity: severity as FindingSeverity,
        category: typeof f.category === "string" ? f.category : "uncategorized",
        detail: typeof f.detail === "string" ? f.detail : "",
        suggestion: typeof f.suggestion === "string" ? f.suggestion : "",
      };
    })
    .filter((f): f is ExpertFinding => f !== null)
    .sort((a, b) => SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity]);

  const worstSeverity = findings.length > 0 ? findings[0].severity : null;
  // Treat the model's `pass` claim as advisory; if any blocker/major
  // finding is present, override to false. This stops a malformed
  // verdict like {pass:true, findings:[{severity:"blocker"}]} from
  // shipping.
  const modelPass = obj.pass === true;
  const anyBlocking = findings.some(
    (f) => SEVERITY_RANK[f.severity] >= SEVERITY_RANK.major,
  );
  const pass = modelPass && !anyBlocking;

  return {
    pass,
    worstSeverity,
    findings,
    revisionPrompt:
      typeof obj.revisionPrompt === "string" ? obj.revisionPrompt : "",
    rubricId,
  };
}

/**
 * Run the expert critic on a candidate answer.
 *
 * Always returns an ExpertVerdict — never throws. Network or parse
 * failures degrade to a `pass=false, worstSeverity=blocker` verdict
 * with a clear `revisionPrompt` so the caller defaults safe.
 */
export async function expertReview(
  candidateAnswer: string,
  rubricOrId: string | ExpertRubric,
): Promise<ExpertVerdict> {
  const rubric =
    typeof rubricOrId === "string" ? RUBRICS[rubricOrId] : rubricOrId;

  if (!rubric) {
    log.warn("expertReview called with unknown rubric id", { rubricOrId });
    return {
      pass: false,
      worstSeverity: "blocker",
      findings: [
        {
          severity: "blocker",
          category: "config",
          detail: `Rubric '${String(rubricOrId)}' not registered.`,
          suggestion:
            "Pass a rubric registered in RUBRICS, or provide an ExpertRubric inline.",
        },
      ],
      revisionPrompt:
        "No expert review possible — rubric not registered. Route to human review.",
      rubricId: String(rubricOrId),
    };
  }

  const prompt = buildCriticPrompt(candidateAnswer, rubric);

  try {
    const raw = await ai(prompt, { system: rubric.expertSystem });
    const parsed = extractJsonObject(raw);

    if (parsed === null) {
      // Model didn't return a parseable JSON object. Treat as a
      // blocker — we never silently accept "looks ok lol".
      return {
        pass: false,
        worstSeverity: "blocker",
        findings: [
          {
            severity: "blocker",
            category: "critic-parse",
            detail:
              "Critic model returned a response that could not be parsed as JSON.",
            suggestion:
              "Re-run the critic with a deterministic model and the same rubric.",
          },
        ],
        revisionPrompt:
          "Expert review inconclusive (response malformed). Route to human review.",
        rubricId: rubric.id,
      };
    }

    return normalizeVerdict(parsed, rubric.id);
  } catch (err) {
    log.warn("expertReview upstream failure", {
      error: err instanceof Error ? err.message : String(err),
      rubricId: rubric.id,
    });

    return {
      pass: false,
      worstSeverity: "blocker",
      findings: [
        {
          severity: "blocker",
          category: "critic-unavailable",
          detail: "Critic model upstream call failed.",
          suggestion: "Retry the critic after a backoff, or route to a human.",
        },
      ],
      revisionPrompt:
        "Expert review unavailable. Route to human review before committing.",
      rubricId: rubric.id,
    };
  }
}
