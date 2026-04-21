/**
 * sentence-splitter.ts — streaming sentence boundary detector.
 *
 * Consumes LLM tokens incrementally (push) and emits complete sentences
 * as soon as they're ready. The voice pipeline uses this to start TTS
 * synthesis on sentence #1 while the LLM is still generating sentence #2
 * — every saved millisecond is a perceived-latency win.
 *
 * Boundary rule:
 *   A sentence ends when we see [.?!] followed by whitespace OR
 *   end-of-text, UNLESS the word immediately before the terminator
 *   is a known abbreviation (Dr., e.g., etc.).
 *
 * Design choices:
 *   - ".Foo" (terminator without trailing space) is NOT a boundary.
 *     We wait for the next token — the trailing space/newline is the
 *     signal. If the stream ends without one, flush() picks it up.
 *   - Abbreviation matching is case-insensitive and tests the raw word
 *     INCLUDING its trailing period (so "e.g." matches, not "e.g").
 *   - No lookahead beyond the current buffer. If a boundary is
 *     ambiguous (the terminator is the last char pushed so far), we
 *     wait for the next push before deciding.
 */

/** Set of words that end in a period but do NOT terminate a sentence. */
const ABBREVIATIONS = new Set<string>([
  // Titles
  "mr.", "mrs.", "ms.", "dr.", "prof.", "sr.", "jr.", "st.",
  // Academic
  "ph.d.", "m.d.", "b.a.", "m.a.", "b.sc.", "m.sc.",
  // Latin / discourse
  "e.g.", "i.e.", "etc.", "vs.", "cf.", "al.",
  // Address-y
  "ave.", "blvd.", "rd.", "ln.",
  // Common short-forms
  "no.", "vol.", "fig.", "ch.", "sec.", "sect.", "pp.", "p.",
  "inc.", "ltd.", "co.", "corp.",
]);

/**
 * Match anywhere in buffer: [.?!] (optionally followed by a closing
 * quote) then whitespace OR end-of-string.
 *
 * The optional `["']?` captures the trailing quote of a sentence like
 * `He said "Hello."` so we cut AFTER the quote, preserving the full
 * quoted material in the emitted sentence.
 */
const BOUNDARY_RE = /([.?!]["']?)(\s|$)/g;

export class SentenceBuffer {
  private buf = "";

  /**
   * Push a chunk of LLM output. Returns zero or more complete
   * sentences that became available. The trailing fragment (if any)
   * stays buffered for the next push or flush.
   */
  push(chunk: string): string[] {
    this.buf += chunk;
    const emitted: string[] = [];

    // Scan for boundaries left-to-right. matchAll gives us an iterator
    // that captures every candidate; we decide per-match whether to
    // actually split (abbreviations get skipped).
    const matches = [...this.buf.matchAll(BOUNDARY_RE)];
    let consumedUpTo = 0;

    for (const match of matches) {
      const terminatorIdx = match.index!;
      const terminatorLen = match[1].length; // 1 for ".", 2 for ".\""
      const trailingChar = match[2];

      // End-of-string trailing means the terminator is the very last
      // char. Ambiguous — wait for more input. (flush() handles it.)
      if (trailingChar === "") break;

      // Skip abbreviations — they end in '.' but don't close a sentence.
      // An abbreviation never has a trailing quote (length 1), so we
      // only check the single-period case.
      if (terminatorLen === 1 && this.isAbbreviation(this.buf, terminatorIdx)) continue;

      // Real boundary. Emit the sentence (inclusive of terminator + quote).
      const sentenceEnd = terminatorIdx + terminatorLen;
      const sentence = this.buf.slice(consumedUpTo, sentenceEnd).trim();
      if (sentence) emitted.push(sentence);
      consumedUpTo = sentenceEnd;
    }

    // Drop consumed prefix (plus any leading whitespace left over).
    if (consumedUpTo > 0) {
      this.buf = this.buf.slice(consumedUpTo).replace(/^\s+/, "");
    }

    return emitted;
  }

  /**
   * Emit any trailing fragment that push() held back because no
   * terminal whitespace followed. Called when the LLM stream closes.
   */
  flush(): string[] {
    const trailing = this.buf.trim();
    this.buf = "";
    return trailing ? [trailing] : [];
  }

  /** Drop buffered text without emitting. Used by barge-in. */
  reset(): void {
    this.buf = "";
  }

  /**
   * Look back from the terminator to find the word ending at that spot,
   * INCLUDING its period. Check against the abbreviation set.
   *
   * Example: buf = "... e.g. see below", terminator at the "." after "g".
   *   wordStart = index after the preceding space → 0 or wherever.
   *   word = "e.g." → matches ABBREVIATIONS.
   */
  private isAbbreviation(buf: string, terminatorIdx: number): boolean {
    if (buf[terminatorIdx] !== ".") return false; // ?/! can't be abbreviations

    // Walk back to the start of this "word" (bounded by whitespace).
    let wordStart = terminatorIdx;
    while (wordStart > 0 && !/\s/.test(buf[wordStart - 1])) wordStart--;

    const wordWithDot = buf.slice(wordStart, terminatorIdx + 1).toLowerCase();
    return ABBREVIATIONS.has(wordWithDot);
  }
}
