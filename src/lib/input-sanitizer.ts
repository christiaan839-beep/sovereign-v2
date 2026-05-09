// STATUS: ahead-of-consumers — see docs/audits/codebase-audit.md (Tier B).
// generic Zod-pre input sanitization; agents use Zod inline.
/**
 * SOVEREIGN MATRIX — Input Sanitizer
 *
 * Cleans user input before sending to any model.
 * Strips dangerous content, enforces size limits,
 * and normalizes encoding issues.
 */

const MAX_INPUT_LENGTH = 50_000;

// Matches all HTML tags including self-closing
const HTML_TAG_RE = /<\/?[a-zA-Z][^>]*\/?>/g;

// Matches null bytes (literal and escaped)
const NULL_BYTE_RE = /\0/g;

// Matches runs of whitespace (spaces, tabs, but NOT newlines)
const EXCESSIVE_SPACES_RE = /[^\S\n]{2,}/g;

// Matches 3+ consecutive newlines
const EXCESSIVE_NEWLINES_RE = /\n{3,}/g;

/**
 * Sanitize user input before sending to any model.
 *
 * 1. Strips HTML tags
 * 2. Limits to 50,000 characters
 * 3. Removes null bytes
 * 4. Normalizes whitespace
 */
export function sanitizeInput(input: string): string {
  let cleaned = input;

  // 1. Strip HTML tags
  cleaned = cleaned.replace(HTML_TAG_RE, "");

  // 2. Remove null bytes
  cleaned = cleaned.replace(NULL_BYTE_RE, "");

  // 3. Normalize whitespace — collapse runs of spaces/tabs
  cleaned = cleaned.replace(EXCESSIVE_SPACES_RE, " ");

  // 4. Collapse excessive newlines (3+ -> 2)
  cleaned = cleaned.replace(EXCESSIVE_NEWLINES_RE, "\n\n");

  // 5. Trim leading/trailing whitespace
  cleaned = cleaned.trim();

  // 6. Enforce character limit
  if (cleaned.length > MAX_INPUT_LENGTH) {
    cleaned = cleaned.slice(0, MAX_INPUT_LENGTH);
  }

  return cleaned;
}
