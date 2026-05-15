/**
 * SOVEREIGN MATRIX — Hallucination detector (Cook 41 / Tier 3 #14)
 *
 * Verifier layer 6. Flags claims in an agent's output that are NOT
 * grounded in the supplied sources. Composes cleanly on top of the
 * RAG layer (Cook 38) — the same `RetrievedMemory[]` that feeds the
 * model also lets us audit which sentences cite which memory.
 *
 * Pure module — no AI calls of its own. Caller supplies the sources
 * and the answer; the detector scores groundedness sentence-by-sentence.
 *
 * Scoring contract:
 *
 *   - `groundedSentences` — at least one explicit citation OR ≥ 60 %
 *     token overlap with at least one source.
 *   - `ungroundedSentences` — fail both checks. These are flagged.
 *   - `score` — fraction of sentences that are grounded (0..1).
 *   - `verdict` — `"grounded"` when score ≥ threshold (default 0.7),
 *     `"partial"` between 0.4 and threshold, `"hallucinated"` below.
 *
 * The threshold is a Cook-37-orchestration-style knob — callers can
 * raise it for compliance traffic and drop it for creative tasks.
 */

import { tokenize } from "@/lib/rag";

// ── Public types ──────────────────────────────────────────────────────────

export interface Source {
  /** Stable id the model is expected to cite as `[m-1]`, `[m-2]`, etc. */
  id: string;
  /** Source body — the text the model is supposed to ground claims in. */
  body: string;
}

export interface DetectionRequest {
  /** Final answer the agent produced. */
  answer: string;
  /** Sources the agent was given. Empty = pure-prior — every claim is ungrounded. */
  sources: Source[];
  /**
   * Token-overlap threshold a single sentence must clear to be
   * considered "supported by" a source. Default 0.6.
   */
  overlapThreshold?: number;
  /**
   * Verdict threshold — fraction of sentences that must be grounded
   * for the answer to be marked "grounded". Default 0.7.
   */
  verdictThreshold?: number;
  /** Minimum tokens a sentence must have to count. Default 3. */
  minSentenceTokens?: number;
}

export interface SentenceFinding {
  index: number;
  text: string;
  grounded: boolean;
  /** Source ids that supported this sentence (citation or overlap). */
  supportedBy: string[];
  /** Best overlap fraction against any source (0..1). */
  bestOverlap: number;
}

export interface DetectionResult {
  verdict: "grounded" | "partial" | "hallucinated";
  /** Fraction of sentences that are grounded (0..1). */
  score: number;
  sentences: SentenceFinding[];
  /** Convenience: sentences that failed groundedness. */
  ungroundedSentences: SentenceFinding[];
  /** Source ids that were cited explicitly by [id] markers. */
  citedSources: string[];
}

// ── Sentence splitting ────────────────────────────────────────────────────

/**
 * Lightweight sentence splitter. Handles `.?!` boundaries while
 * preserving common abbreviations from accidentally splitting (`e.g.`,
 * `Inc.`, etc.). Not perfect, but deterministic + no NLP dependency.
 */
export function splitSentences(text: string): string[] {
  const COMMON_ABBR = new Set([
    "e.g",
    "i.e",
    "etc",
    "mr",
    "mrs",
    "dr",
    "vs",
    "inc",
    "ltd",
    "co",
  ]);
  const out: string[] = [];
  let buf = "";
  const tokens = text.split(/(\s+)/);
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i];
    buf += tok;
    if (/[.!?]$/.test(tok.trim())) {
      const word = tok.replace(/[.!?]+$/, "").toLowerCase();
      if (!COMMON_ABBR.has(word) && buf.trim().length > 0) {
        out.push(buf.trim());
        buf = "";
      }
    }
  }
  const tail = buf.trim();
  if (tail.length > 0) out.push(tail);
  return out;
}

// ── Citation extraction ───────────────────────────────────────────────────

const CITATION_RE = /\[([a-z]-?\d+|m-\d+)\]/gi;

function extractCitationsFromSentence(sentence: string): string[] {
  const out: string[] = [];
  for (const match of sentence.matchAll(CITATION_RE)) {
    out.push(match[1]);
  }
  return out;
}

// ── Token overlap ─────────────────────────────────────────────────────────

function overlap(sentenceTokens: Set<string>, source: Source): number {
  if (sentenceTokens.size === 0) return 0;
  const src = new Set(tokenize(source.body));
  if (src.size === 0) return 0;
  let hits = 0;
  for (const t of sentenceTokens) {
    if (src.has(t)) hits++;
  }
  return hits / sentenceTokens.size;
}

// ── Detection ─────────────────────────────────────────────────────────────

/**
 * Score an answer against its sources sentence-by-sentence. Pure,
 * deterministic. The returned object is fully JSON-serializable so
 * the receipt can embed it verbatim.
 */
export function detect(req: DetectionRequest): DetectionResult {
  const overlapThreshold = req.overlapThreshold ?? 0.6;
  const verdictThreshold = req.verdictThreshold ?? 0.7;
  const minTokens = req.minSentenceTokens ?? 3;

  const sources = req.sources;
  const sourceIds = new Set(sources.map((s) => s.id));

  const sentences = splitSentences(req.answer);
  const findings: SentenceFinding[] = [];
  const citedAll = new Set<string>();

  sentences.forEach((sentence, index) => {
    const sentTokens = new Set(tokenize(sentence));
    if (sentTokens.size < minTokens) {
      // Too short to evaluate; treat as grounded so single-word affirmations
      // ("Yes.") don't poison the score.
      findings.push({
        index,
        text: sentence,
        grounded: true,
        supportedBy: [],
        bestOverlap: 0,
      });
      return;
    }

    const citations = extractCitationsFromSentence(sentence).filter((c) =>
      sourceIds.has(c),
    );
    citations.forEach((c) => citedAll.add(c));

    let bestOverlap = 0;
    const overlapSupports: string[] = [];
    for (const src of sources) {
      const o = overlap(sentTokens, src);
      if (o > bestOverlap) bestOverlap = o;
      if (o >= overlapThreshold) overlapSupports.push(src.id);
    }

    const supportedBy = [...new Set([...citations, ...overlapSupports])];

    findings.push({
      index,
      text: sentence,
      grounded: supportedBy.length > 0,
      supportedBy,
      bestOverlap,
    });
  });

  const evaluable = findings.filter(
    (f) => tokenize(f.text).length >= minTokens,
  );
  const grounded = evaluable.filter((f) => f.grounded).length;
  const score = evaluable.length === 0 ? 1 : grounded / evaluable.length;

  let verdict: DetectionResult["verdict"];
  if (score >= verdictThreshold) verdict = "grounded";
  else if (score >= 0.4) verdict = "partial";
  else verdict = "hallucinated";

  return {
    verdict,
    score,
    sentences: findings,
    ungroundedSentences: findings.filter((f) => !f.grounded),
    citedSources: [...citedAll],
  };
}
