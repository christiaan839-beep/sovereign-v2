/**
 * PII guard — post-extraction scanner + masker.
 *
 * WHY THIS EXISTS
 * ───────────────
 * Content-safety (`src/lib/content-safety.ts`) runs on INPUT — blocks
 * obvious prompt-injection attempts and flags input that contains PII.
 * But agents that OCR documents (1099-reader, w2-reader, id-verifier,
 * coi-verifier, bill-of-lading-reader, business-card-reader, blueprint-
 * parser) produce OUTPUT that contains PII by design — SSNs, credit
 * cards, phone numbers, addresses, recipient names.
 *
 * The 2026-04-24 code review flagged this: 1099-reader's system prompt
 * says "mask SSN to XXX-XX-NNNN" but if the model drifts or the layout
 * is adversarial, a full SSN can slip through. This guard is the
 * structural enforcement — regex + Luhn — that catches what the prompt
 * misses.
 *
 * POLICY
 * ──────
 * Every agent output gets scanned. Matches are classified:
 *   - SSN (9 digits with dashes or spaces)
 *   - Credit card (13-19 digits passing Luhn)
 *   - E.164 phone (with +)
 *   - US phone (with or without parens)
 *   - Email address
 *
 * By default, matches are MASKED (preserving the last 4 of numeric IDs,
 * the first letter + domain of emails). Agents can opt out via
 * `piiGuardMode: "skip"` when the PII is intentional (resume-normalizer,
 * business-card-reader — users expect contact info preserved).
 *
 * SAFETY INVARIANT
 * ────────────────
 * This guard is FAIL-OPEN for performance reasons — a scan failure
 * returns the original payload unchanged rather than blocking the
 * response. It is defense-in-depth, not the primary defense. The
 * primary defense is the agent's system prompt.
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("pii-guard");

export type PiiMode = "mask" | "flag" | "skip";

export interface PiiFinding {
  type: "ssn" | "credit_card" | "phone" | "email";
  matchedText: string;
  maskedText: string;
  /** 0-based character offset where the match starts. */
  index: number;
}

export interface PiiGuardResult {
  original: string;
  scrubbed: string;
  findings: PiiFinding[];
  /** True when at least one PII match was found + masked. */
  mutated: boolean;
}

// ─── Regex patterns ────────────────────────────────────────────

const SSN_RE =
  // Matches ###-##-####  OR ### ## ####  (not obviously-masked like XXX-XX-)
  /\b(?:(?!000|666|9\d\d)\d{3}[-\s](?!00)\d{2}[-\s](?!0000)\d{4})\b/g;

const CREDIT_CARD_RE =
  // Visa/MC/Amex/Discover rough patterns, 13-19 digits with optional spaces/dashes.
  // Real validation via Luhn below.
  /\b(?:\d[-\s]?){13,19}\b/g;

const E164_PHONE_RE =
  // +<country><number>, 10-15 digits total after +
  /\+\d{1,3}[-\s]?\d{3,14}\b/g;

const US_PHONE_RE =
  // (###) ###-####  or  ###-###-####  or  ###.###.####
  // No leading \b — "(" isn't a word boundary, so \b would prevent
  // matching the parens form when it follows a word + space
  // ("call (415) 555-0101"). Each alternative carries its own
  // left-anchor (either "(" or \b).
  /(?:\(\d{3}\)\s*|\b\d{3}[-.\s])\d{3}[-.\s]\d{4}\b/g;

const EMAIL_RE =
  // Pragmatic email — not RFC 5322, but close enough for leak detection.
  /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

// ─── Maskers ───────────────────────────────────────────────────

function maskSsn(s: string): string {
  // "123-45-6789" → "XXX-XX-6789"
  const last4 = s.replace(/\D/g, "").slice(-4);
  return `XXX-XX-${last4}`;
}

function maskCard(s: string): string {
  const digits = s.replace(/\D/g, "");
  const last4 = digits.slice(-4);
  return `**** **** **** ${last4}`;
}

function maskPhone(s: string): string {
  const digits = s.replace(/\D/g, "");
  const last4 = digits.slice(-4);
  return `(***) ***-${last4}`;
}

function maskEmail(s: string): string {
  // "alice.smith@acme.co" → "a*******@acme.co"
  const [local, domain] = s.split("@");
  if (!local || !domain) return "***@***";
  const first = local.charAt(0);
  return `${first}${"*".repeat(Math.max(1, local.length - 1))}@${domain}`;
}

// ─── Luhn (credit card checksum) ───────────────────────────────

function luhnValid(digits: string): boolean {
  const d = digits.replace(/\D/g, "");
  if (d.length < 13 || d.length > 19) return false;
  let sum = 0;
  let alt = false;
  for (let i = d.length - 1; i >= 0; i--) {
    let n = d.charCodeAt(i) - 48;
    if (n < 0 || n > 9) return false;
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

// ─── Public API ────────────────────────────────────────────────

export function scanPii(text: string): PiiFinding[] {
  const findings: PiiFinding[] = [];
  if (!text || typeof text !== "string") return findings;

  pushMatches(text, SSN_RE, "ssn", maskSsn, findings);

  // Credit card — regex is permissive; gate final acceptance on Luhn.
  for (const match of text.matchAll(CREDIT_CARD_RE)) {
    if (match.index === undefined) continue;
    const m = match[0];
    if (!luhnValid(m)) continue;
    findings.push({
      type: "credit_card",
      matchedText: m,
      maskedText: maskCard(m),
      index: match.index,
    });
  }

  pushMatches(text, E164_PHONE_RE, "phone", maskPhone, findings);
  pushMatches(text, US_PHONE_RE, "phone", maskPhone, findings);
  pushMatches(text, EMAIL_RE, "email", maskEmail, findings);

  // Dedupe overlapping findings — SSN regex sometimes catches phone-
  // shaped strings. Prefer the more-specific type (ssn > card > phone >
  // email) when positions overlap.
  return dedupeOverlapping(findings);
}

function pushMatches(
  text: string,
  re: RegExp,
  type: PiiFinding["type"],
  mask: (s: string) => string,
  out: PiiFinding[],
): void {
  for (const match of text.matchAll(re)) {
    if (match.index === undefined) continue;
    out.push({
      type,
      matchedText: match[0],
      maskedText: mask(match[0]),
      index: match.index,
    });
  }
}

function dedupeOverlapping(findings: PiiFinding[]): PiiFinding[] {
  // Sort by (index, specificity). SSN=0, card=1, phone=2, email=3 — lower = more specific.
  const rank = { ssn: 0, credit_card: 1, phone: 2, email: 3 } as const;
  const sorted = [...findings].sort((a, b) => {
    if (a.index !== b.index) return a.index - b.index;
    return rank[a.type] - rank[b.type];
  });

  const kept: PiiFinding[] = [];
  let lastEnd = -1;
  for (const f of sorted) {
    const end = f.index + f.matchedText.length;
    if (f.index >= lastEnd) {
      kept.push(f);
      lastEnd = end;
    }
  }
  return kept;
}

/**
 * Scrub PII from text. Replaces each finding in-place with its masked
 * form. Right-to-left so indices stay valid during replacement.
 *
 * Returns both original + scrubbed so callers can log findings without
 * leaking the original values. When `mode === "flag"`, returns findings
 * only without mutating (useful for dry-run alerts).
 */
export function scrubPii(text: string, mode: PiiMode = "mask"): PiiGuardResult {
  try {
    if (mode === "skip" || !text) {
      return { original: text, scrubbed: text, findings: [], mutated: false };
    }
    const findings = scanPii(text);
    if (findings.length === 0) {
      return { original: text, scrubbed: text, findings: [], mutated: false };
    }
    if (mode === "flag") {
      return { original: text, scrubbed: text, findings, mutated: false };
    }
    // mask mode — rebuild string right-to-left so earlier indices stay valid.
    let scrubbed = text;
    const sorted = [...findings].sort((a, b) => b.index - a.index);
    for (const f of sorted) {
      scrubbed =
        scrubbed.slice(0, f.index) +
        f.maskedText +
        scrubbed.slice(f.index + f.matchedText.length);
    }
    return { original: text, scrubbed, findings, mutated: true };
  } catch (err) {
    // Fail-open — a scan bug should never break the user's response.
    log.warn("scrubPii failed — passing through unchanged", {
      error: (err as Error).message,
    });
    return { original: text, scrubbed: text, findings: [], mutated: false };
  }
}

/**
 * Walk a JSON-serializable value, scrub every string leaf. Used by the
 * agent factory to apply the guard across structured response payloads
 * (not just top-level strings).
 *
 * Returns the scrubbed tree + an aggregated findings list across all
 * scrubbed leaves. Non-string leaves pass through untouched.
 */
export function scrubPiiDeep(
  value: unknown,
  mode: PiiMode = "mask",
  options: { maxDepth?: number } = {},
): { scrubbed: unknown; findings: PiiFinding[] } {
  const maxDepth = options.maxDepth ?? 10;
  const all: PiiFinding[] = [];

  const walk = (v: unknown, depth: number): unknown => {
    if (depth >= maxDepth) return v;
    if (typeof v === "string") {
      const r = scrubPii(v, mode);
      all.push(...r.findings);
      return r.scrubbed;
    }
    if (Array.isArray(v)) return v.map((x) => walk(x, depth + 1));
    if (v && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
        out[k] = walk(val, depth + 1);
      }
      return out;
    }
    return v;
  };

  return { scrubbed: walk(value, 0), findings: all };
}
