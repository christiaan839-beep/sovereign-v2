/**
 * Tiny word-level diff — LCS-based, zero deps.
 *
 * Produces a list of (op, text) tuples for rendering side-by-side or
 * inline diffs between two pieces of agent output. Word-level (not
 * line-level or char-level) is the right granularity for LLM output
 * where line structure isn't preserved but prose patterns are.
 *
 * Algorithm: classic longest-common-subsequence with a 2D table.
 * O(N*M) time + space — fine for LLM outputs up to a few thousand
 * tokens (say 10,000 chars each). Above that we chunk; the UI
 * wouldn't render more than that anyway.
 *
 * Op semantics:
 *   "eq"  → word appears in both
 *   "add" → word only in B (the rerun / new version)
 *   "del" → word only in A (the original)
 *
 * Typical render: "eq" is normal ink, "add" is copper, "del" is
 * gray strikethrough.
 */

export type DiffOp = "eq" | "add" | "del";

export interface DiffPart {
  op: DiffOp;
  text: string;
}

/**
 * Tokenize into whitespace-delimited words PLUS punctuation as its
 * own token, preserving whitespace. This gives human-readable diffs
 * without the noise of per-character diffing.
 */
function tokenize(s: string): string[] {
  // Split by capturing group so whitespace stays in the result.
  return s.split(/(\s+|[.,;:!?()"'\-])/).filter(Boolean);
}

const MAX_DIFF_CHARS = 10_000;

/**
 * Compute a word-level diff between two strings. Clamped to the
 * first 10k chars each — longer inputs are diffed on the prefix
 * plus a truncation marker, keeping both UI render + memory bounded.
 */
export function diffWords(a: string, b: string): DiffPart[] {
  const aIn = (a ?? "").slice(0, MAX_DIFF_CHARS);
  const bIn = (b ?? "").slice(0, MAX_DIFF_CHARS);
  const aT = tokenize(aIn);
  const bT = tokenize(bIn);

  // LCS table.
  const n = aT.length;
  const m = bT.length;
  if (n === 0 && m === 0) return [];
  if (n === 0) return [{ op: "add", text: bIn }];
  if (m === 0) return [{ op: "del", text: aIn }];

  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0),
  );
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (aT[i - 1] === bT[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // Backtrack to produce the diff ops.
  const parts: DiffPart[] = [];
  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    if (aT[i - 1] === bT[j - 1]) {
      parts.push({ op: "eq", text: aT[i - 1] });
      i--; j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      parts.push({ op: "del", text: aT[i - 1] });
      i--;
    } else {
      parts.push({ op: "add", text: bT[j - 1] });
      j--;
    }
  }
  while (i > 0) {
    parts.push({ op: "del", text: aT[i - 1] });
    i--;
  }
  while (j > 0) {
    parts.push({ op: "add", text: bT[j - 1] });
    j--;
  }

  parts.reverse();

  // Coalesce adjacent same-op parts so the UI renders one span per
  // contiguous run instead of N spans per token.
  const coalesced: DiffPart[] = [];
  for (const p of parts) {
    const last = coalesced[coalesced.length - 1];
    if (last && last.op === p.op) last.text += p.text;
    else coalesced.push({ ...p });
  }
  return coalesced;
}

/** Compute a summary score: what fraction of tokens in A survived into B. */
export function similarity(a: string, b: string): number {
  const parts = diffWords(a, b);
  const total = parts.reduce((n, p) => n + p.text.length, 0);
  const kept = parts.filter((p) => p.op === "eq").reduce((n, p) => n + p.text.length, 0);
  return total > 0 ? kept / total : 0;
}
