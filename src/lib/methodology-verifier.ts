/**
 * SOVEREIGN MATRIX — Methodology-grade output verifier (wave 112).
 *
 * Most "AI safety" pipelines stop at three checks:
 *   - is it harmful?  (LlamaGuard)
 *   - does it contain PII?  (regex)
 *   - is the prose coherent?  (quality scorer)
 *
 * Those gates are necessary but not sufficient for regulated-vertical
 * buyers (legal AI, healthcare AI, financial advisory AI, compliance
 * automation). What those buyers actually need is a research-grade
 * audit of every factual claim the agent produced: are the cited
 * sources current, authoritative, accurate; do the conclusions
 * survive a lateral cross-check; do the hypotheses the agent
 * proposes meet the criteria the buyer's own auditors would apply
 * to a peer-reviewed paper.
 *
 * This module operationalises three frameworks from the social-
 * science methodology literature into runtime primitives:
 *
 *   - CRAAP (Blakeslee, 2004, CSU Chico): Currency, Relevance,
 *     Authority, Accuracy, Purpose. The gold standard for evaluating
 *     a source's credibility.
 *   - SIFT (Caulfield, 2017): Stop, Investigate the source, Find
 *     better coverage, Trace claims back to origin. The lateral-
 *     reading discipline that beats classic media-literacy checklists.
 *   - FINER (Hulley et al.): Feasible, Interesting, Novel, Ethical,
 *     Relevant. The criteria peer-review panels apply to a research
 *     question before grant approval.
 *
 * Each scorer returns a 0-1 aggregate plus dimension breakdowns plus
 * a one-line reasoning trace per dimension — designed to flow into a
 * cryptographic receipt envelope so the buyer can show their own
 * regulator HOW a claim was verified, not just THAT it was.
 *
 * Cost-aware routing: every scorer calls `nimChat` directly with
 * `nvidia/llama-3.1-nemotron-ultra-253b-v1` (NIM free tier,
 * priority-1 per CLAUDE.md). Token budgets are bounded; long inputs
 * are truncated at the scorer's entry point. The orchestrator runs
 * the three scorers in parallel, places a kill-switch checkpoint at
 * entry, and fails open — a scoring outage NEVER blocks a delivery.
 */

import { nimChat } from "@/lib/nvidia";
import { createLogger } from "@/lib/logger";
import { checkpoint as budgetCheckpoint } from "@/lib/execution-budget";

const log = createLogger("methodology-verifier");

// ─── Shared types ──────────────────────────────────────────────────────────

export interface DimensionScore {
  /** 0.0 (fails the dimension) — 1.0 (perfect). */
  score: number;
  /** One-line reasoning trace for the receipt. */
  rationale: string;
}

export interface CraapResult {
  /** Aggregate 0-1, equal-weighted mean of the 5 dimensions. */
  overall: number;
  currency: DimensionScore;
  relevance: DimensionScore;
  authority: DimensionScore;
  accuracy: DimensionScore;
  purpose: DimensionScore;
  /** When true, the scorer either errored or fell back to a neutral
   *  score — callers MUST treat this as "no verification happened"
   *  rather than as an implicit pass. */
  degraded: boolean;
}

export interface SiftClaim {
  /** Raw factual claim extracted from the input. */
  claim: string;
  /** "verified" / "unverified" / "contradicted" / "unverifiable". */
  status: "verified" | "unverified" | "contradicted" | "unverifiable";
  /** 0-1 confidence in the status. */
  confidence: number;
  /** Suggested next-step verification actions for a human reviewer. */
  laterals: string[];
}

export interface SiftResult {
  claims: SiftClaim[];
  /** Aggregate over all claims: ratio that came back "verified". */
  verifiedRatio: number;
  degraded: boolean;
}

export interface FinerResult {
  overall: number;
  feasible: DimensionScore;
  interesting: DimensionScore;
  novel: DimensionScore;
  ethical: DimensionScore;
  relevant: DimensionScore;
  degraded: boolean;
}

export interface MethodologyResult {
  /** 0-1, weighted average across the 3 sub-scores when they apply. */
  overall: number;
  craap?: CraapResult;
  sift?: SiftResult;
  finer?: FinerResult;
  /** When true, at least one sub-scorer degraded. The overall is
   *  still computed from whichever scorers DID succeed; downstream
   *  callers can choose to demand `degraded === false` for the most
   *  critical receipts. */
  degraded: boolean;
  /** Latency (ms) — useful for the receipt's `verification_latency`
   *  field and for observability dashboards. */
  latencyMs: number;
}

// ─── Configuration ─────────────────────────────────────────────────────────

const NIM_MODEL = "nvidia/llama-3.1-nemotron-ultra-253b-v1";
const MAX_INPUT_CHARS = 8_000; // ~ 2K tokens — safe for the NIM free tier
const MAX_CLAIMS_PER_SIFT = 6; // bounded so an adversarial input can't blow up cost

const NEUTRAL_SCORE: DimensionScore = {
  score: 0.5,
  rationale: "scorer unavailable — neutral fallback",
};

// ─── Helpers ───────────────────────────────────────────────────────────────

function truncate(text: string, max = MAX_INPUT_CHARS): string {
  if (typeof text !== "string") return "";
  if (text.length <= max) return text;
  return text.slice(0, max) + "\n…[truncated]";
}

function clamp01(n: unknown): number {
  const x = Number(n);
  if (!Number.isFinite(x)) return 0.5;
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

/**
 * Parse a JSON object from a model response, tolerant to ```json
 * fences, leading/trailing prose, and minor malformations. Returns
 * null on unsalvageable input — callers MUST handle null as the
 * "degraded" signal.
 */
function tryParseJson(text: string): unknown | null {
  if (typeof text !== "string" || text.trim() === "") return null;
  // Strip code fences if present.
  let body = text.trim();
  const fence = body.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) body = fence[1].trim();

  // Find the first `{` and last `}` and try the slice — robust to
  // models that prefix their JSON with a one-line preamble.
  const first = body.indexOf("{");
  const last = body.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) return null;
  const slice = body.slice(first, last + 1);

  try {
    return JSON.parse(slice);
  } catch {
    return null;
  }
}

function toDim(raw: unknown): DimensionScore {
  if (raw && typeof raw === "object") {
    const obj = raw as Record<string, unknown>;
    const score = clamp01(obj.score);
    const rationale =
      typeof obj.rationale === "string" && obj.rationale.trim().length > 0
        ? obj.rationale.trim().slice(0, 400)
        : "no rationale provided";
    return { score, rationale };
  }
  return NEUTRAL_SCORE;
}

// ─── CRAAP ─────────────────────────────────────────────────────────────────

const CRAAP_SYSTEM = `You are an academic research methodologist evaluating a claim or source against the CRAAP framework (Blakeslee, 2004, CSU Chico).

For each of the 5 dimensions, return a numeric score from 0.0 (fails completely) to 1.0 (excellent), plus a one-sentence rationale.

CURRENCY — Is the information up-to-date? Penalize claims that depend on stale data points or out-of-date studies for the domain.
RELEVANCE — Does the claim directly address the question or topic asserted? Penalize tangential or off-target content.
AUTHORITY — Are the cited sources/authors credentialed for this topic? Penalize uncited assertions, anonymous content, or commercial-domain authorship for technical claims.
ACCURACY — Is the claim factually correct, supported by evidence, free of internal contradiction? Penalize uncited statistics, unsupported absolutes, or detectable contradictions with widely-accepted fact.
PURPOSE — What is the apparent intent (inform, persuade, sell, entertain)? Penalize marketing language, undeclared conflicts of interest, or persuasive framing where neutral framing is required.

Respond with EXACTLY this JSON shape and nothing else:
{
  "currency":   { "score": 0.0-1.0, "rationale": "..." },
  "relevance":  { "score": 0.0-1.0, "rationale": "..." },
  "authority":  { "score": 0.0-1.0, "rationale": "..." },
  "accuracy":   { "score": 0.0-1.0, "rationale": "..." },
  "purpose":    { "score": 0.0-1.0, "rationale": "..." }
}`;

/**
 * Score a claim against the 5 CRAAP dimensions.
 *
 * @param claim    The factual claim or excerpt to evaluate.
 * @param context  Optional surrounding context (e.g. the question the
 *                 claim was meant to answer) — improves the
 *                 RELEVANCE dimension.
 */
export async function craap(
  claim: string,
  context?: string,
): Promise<CraapResult> {
  if (typeof claim !== "string" || claim.trim().length === 0) {
    return {
      overall: 0,
      currency: NEUTRAL_SCORE,
      relevance: NEUTRAL_SCORE,
      authority: NEUTRAL_SCORE,
      accuracy: NEUTRAL_SCORE,
      purpose: NEUTRAL_SCORE,
      degraded: true,
    };
  }

  const userPrompt = context
    ? `CONTEXT (the question the claim was supposed to answer):\n${truncate(context, 1500)}\n\nCLAIM:\n${truncate(claim)}`
    : `CLAIM:\n${truncate(claim)}`;

  try {
    const raw = await nimChat(
      NIM_MODEL,
      [
        { role: "system", content: CRAAP_SYSTEM },
        { role: "user", content: userPrompt },
      ],
      { maxTokens: 600, temperature: 0.1 },
    );
    const parsed = tryParseJson(raw);
    if (!parsed || typeof parsed !== "object") {
      return degradedCraap();
    }
    const obj = parsed as Record<string, unknown>;
    const currency = toDim(obj.currency);
    const relevance = toDim(obj.relevance);
    const authority = toDim(obj.authority);
    const accuracy = toDim(obj.accuracy);
    const purpose = toDim(obj.purpose);
    const overall =
      (currency.score +
        relevance.score +
        authority.score +
        accuracy.score +
        purpose.score) /
      5;
    return {
      overall,
      currency,
      relevance,
      authority,
      accuracy,
      purpose,
      degraded: false,
    };
  } catch (err) {
    log.warn("CRAAP scorer failed — returning degraded result", {
      error: err instanceof Error ? err.message : String(err),
    });
    return degradedCraap();
  }
}

function degradedCraap(): CraapResult {
  return {
    overall: 0.5,
    currency: NEUTRAL_SCORE,
    relevance: NEUTRAL_SCORE,
    authority: NEUTRAL_SCORE,
    accuracy: NEUTRAL_SCORE,
    purpose: NEUTRAL_SCORE,
    degraded: true,
  };
}

// ─── SIFT ──────────────────────────────────────────────────────────────────

const SIFT_SYSTEM = `You are an academic fact-checker applying the SIFT method (Caulfield, 2017): Stop, Investigate the source, Find better coverage, Trace claims to origin.

Given a passage, extract every distinct factual claim (a statement that could in principle be checked against an external source). Numbers, dates, attributed quotes, causal assertions, and named-entity statements all count. Ignore opinions, normative statements, and obvious filler.

For each claim, output:
  - claim: the verbatim or near-verbatim statement
  - status: one of "verified" | "unverified" | "contradicted" | "unverifiable"
      • "verified": claim aligns with widely-accepted, well-documented fact you already know
      • "unverified": you have no strong evidence either way
      • "contradicted": claim conflicts with widely-accepted, well-documented fact
      • "unverifiable": claim is structurally impossible to verify (private data, future event, etc.)
  - confidence: 0.0-1.0 numeric confidence in the status assignment
  - laterals: up to 3 short, concrete actions a human reviewer should take to verify the claim further (e.g. "Cross-check the 2024 revenue figure on SEC EDGAR 10-K filing", "Search for the cited author's affiliation on Google Scholar")

Cap the number of claims at ${MAX_CLAIMS_PER_SIFT}. Respond with EXACTLY this JSON shape and nothing else:
{ "claims": [ { "claim": "...", "status": "...", "confidence": 0.0-1.0, "laterals": ["..."] } ] }`;

/**
 * Extract factual claims and apply the SIFT method to each.
 *
 * Returns the per-claim verification ledger plus an aggregate
 * verifiedRatio. Useful as a hard gate ("reject if verifiedRatio <
 * 0.6") or a soft signal ("attach to receipt for buyer review").
 */
export async function sift(text: string): Promise<SiftResult> {
  if (typeof text !== "string" || text.trim().length === 0) {
    return { claims: [], verifiedRatio: 0, degraded: true };
  }

  try {
    const raw = await nimChat(
      NIM_MODEL,
      [
        { role: "system", content: SIFT_SYSTEM },
        { role: "user", content: `PASSAGE:\n${truncate(text)}` },
      ],
      { maxTokens: 1200, temperature: 0.1 },
    );
    const parsed = tryParseJson(raw);
    if (!parsed || typeof parsed !== "object") {
      return { claims: [], verifiedRatio: 0, degraded: true };
    }
    const obj = parsed as { claims?: unknown };
    if (!Array.isArray(obj.claims)) {
      return { claims: [], verifiedRatio: 0, degraded: true };
    }
    const claims: SiftClaim[] = obj.claims
      .slice(0, MAX_CLAIMS_PER_SIFT)
      .map((c) => normaliseClaim(c))
      .filter((c): c is SiftClaim => c !== null);

    if (claims.length === 0) {
      return { claims: [], verifiedRatio: 0, degraded: false };
    }
    const verifiedCount = claims.filter((c) => c.status === "verified").length;
    return {
      claims,
      verifiedRatio: verifiedCount / claims.length,
      degraded: false,
    };
  } catch (err) {
    log.warn("SIFT scorer failed — returning degraded result", {
      error: err instanceof Error ? err.message : String(err),
    });
    return { claims: [], verifiedRatio: 0, degraded: true };
  }
}

function normaliseClaim(raw: unknown): SiftClaim | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, unknown>;
  const claim =
    typeof obj.claim === "string" && obj.claim.trim().length > 0
      ? obj.claim.trim().slice(0, 500)
      : null;
  if (claim === null) return null;

  const allowedStatuses = [
    "verified",
    "unverified",
    "contradicted",
    "unverifiable",
  ] as const;
  type Status = (typeof allowedStatuses)[number];
  const rawStatus = typeof obj.status === "string" ? obj.status : "";
  const status: Status = (allowedStatuses as readonly string[]).includes(
    rawStatus,
  )
    ? (rawStatus as Status)
    : "unverified";

  const confidence = clamp01(obj.confidence);
  const laterals: string[] = Array.isArray(obj.laterals)
    ? obj.laterals
        .filter((s): s is string => typeof s === "string")
        .map((s) => s.slice(0, 200))
        .slice(0, 3)
    : [];
  return { claim, status, confidence, laterals };
}

// ─── FINER ─────────────────────────────────────────────────────────────────

const FINER_SYSTEM = `You are a grant-review panellist applying the FINER framework (Hulley et al.) to a proposed research question or hypothesis.

For each of the 5 dimensions, return a numeric score from 0.0 (fails completely) to 1.0 (excellent), plus a one-sentence rationale.

FEASIBLE — Is the question practically answerable with realistic sample sizes, instruments, budget, timeline? Penalize questions that demand impossible data access or unrealistic n.
INTERESTING — Does answering this advance the field, capture investigator attention, or motivate sustained inquiry? Penalize trivial or well-settled questions.
NOVEL — Does this address an underexplored gap, challenge existing frameworks, or provide new evidence? Penalize questions already definitively answered.
ETHICAL — Does the design respect autonomy, beneficence, non-maleficence, justice? Penalize questions that require deceptive practice, unsafe protocols, or unjust participant burden.
RELEVANT — Will the answer influence clinical practice, public policy, or future research directions? Penalize purely academic exercises with no downstream impact.

Respond with EXACTLY this JSON shape and nothing else:
{
  "feasible":    { "score": 0.0-1.0, "rationale": "..." },
  "interesting": { "score": 0.0-1.0, "rationale": "..." },
  "novel":       { "score": 0.0-1.0, "rationale": "..." },
  "ethical":     { "score": 0.0-1.0, "rationale": "..." },
  "relevant":    { "score": 0.0-1.0, "rationale": "..." }
}`;

/** Score a research question / hypothesis against the FINER criteria. */
export async function finer(question: string): Promise<FinerResult> {
  if (typeof question !== "string" || question.trim().length === 0) {
    return degradedFiner();
  }
  try {
    const raw = await nimChat(
      NIM_MODEL,
      [
        { role: "system", content: FINER_SYSTEM },
        { role: "user", content: `RESEARCH QUESTION:\n${truncate(question)}` },
      ],
      { maxTokens: 600, temperature: 0.1 },
    );
    const parsed = tryParseJson(raw);
    if (!parsed || typeof parsed !== "object") return degradedFiner();
    const obj = parsed as Record<string, unknown>;
    const feasible = toDim(obj.feasible);
    const interesting = toDim(obj.interesting);
    const novel = toDim(obj.novel);
    const ethical = toDim(obj.ethical);
    const relevant = toDim(obj.relevant);
    const overall =
      (feasible.score +
        interesting.score +
        novel.score +
        ethical.score +
        relevant.score) /
      5;
    return {
      overall,
      feasible,
      interesting,
      novel,
      ethical,
      relevant,
      degraded: false,
    };
  } catch (err) {
    log.warn("FINER scorer failed — returning degraded result", {
      error: err instanceof Error ? err.message : String(err),
    });
    return degradedFiner();
  }
}

function degradedFiner(): FinerResult {
  return {
    overall: 0.5,
    feasible: NEUTRAL_SCORE,
    interesting: NEUTRAL_SCORE,
    novel: NEUTRAL_SCORE,
    ethical: NEUTRAL_SCORE,
    relevant: NEUTRAL_SCORE,
    degraded: true,
  };
}

// ─── Orchestrator ──────────────────────────────────────────────────────────

export interface MethodologyOptions {
  /** When provided, runs CRAAP on the input with this context. */
  context?: string;
  /** When true (default), runs the SIFT claim ledger. */
  sift?: boolean;
  /** When true (default), runs the CRAAP scorer. */
  craap?: boolean;
  /** When provided, runs FINER on this research question (separately
   *  from the main text). Omit when the agent output is not a
   *  research question. */
  researchQuestion?: string;
}

/**
 * Top-level orchestrator. Runs the requested scorers in parallel,
 * computes an overall score from whichever ones succeed, and
 * surfaces a `degraded` flag when any sub-scorer fell back.
 *
 * Places a budget checkpoint at entry so the kill-switch can
 * abort the entire methodology pass under cost pressure.
 *
 * Fails open: if EVERY sub-scorer errors, returns overall=0.5
 * with degraded=true. Callers can choose to gate delivery on
 * `result.degraded === false`.
 */
export async function methodologyVerify(
  text: string,
  options: MethodologyOptions = {},
): Promise<MethodologyResult> {
  const start = Date.now();
  // Kill-switch checkpoint — same pattern claudeToolUse uses per
  // CLAUDE.md invariant #6 ("Kill-switch checkpoint inside every
  // iterative tool loop"). Fails closed if budget is exhausted.
  // The checkpoint is synchronous (throws) but we `await` it inside
  // try/catch to absorb both sync and async-rejection forms uniformly
  // (test seams substitute a Promise-returning mock).
  try {
    await budgetCheckpoint("methodology-verifier", { stage: "entry" });
  } catch {
    // Budget abort: return degraded immediately, no scorer calls.
    return {
      overall: 0.5,
      degraded: true,
      latencyMs: Date.now() - start,
    };
  }

  const runCraap = options.craap !== false;
  const runSift = options.sift !== false;
  const runFiner =
    typeof options.researchQuestion === "string" &&
    options.researchQuestion.trim().length > 0;

  const [craapResult, siftResult, finerResult] = await Promise.all([
    runCraap ? craap(text, options.context) : Promise.resolve(undefined),
    runSift ? sift(text) : Promise.resolve(undefined),
    runFiner
      ? finer(options.researchQuestion as string)
      : Promise.resolve(undefined),
  ]);

  const parts: number[] = [];
  if (craapResult && !craapResult.degraded) parts.push(craapResult.overall);
  if (siftResult && !siftResult.degraded) parts.push(siftResult.verifiedRatio);
  if (finerResult && !finerResult.degraded) parts.push(finerResult.overall);

  const overall =
    parts.length > 0 ? parts.reduce((a, b) => a + b, 0) / parts.length : 0.5;

  const anyRequested = runCraap || runSift || runFiner;
  const anyDegraded =
    (runCraap && (!craapResult || craapResult.degraded)) ||
    (runSift && (!siftResult || siftResult.degraded)) ||
    (runFiner && (!finerResult || finerResult.degraded));

  return {
    overall,
    craap: craapResult,
    sift: siftResult,
    finer: finerResult,
    degraded: !anyRequested || anyDegraded,
    latencyMs: Date.now() - start,
  };
}
