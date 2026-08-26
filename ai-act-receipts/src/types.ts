/**
 * The one shape everything in this package speaks.
 *
 * `ReceiptRecord` is deliberately open. The three required fields are
 * the only ones the Annex IV exporter needs; everything else you carry
 * on a record is preserved and ignored. That is the point: you do NOT
 * have to adopt a receipt format to use this. Project whatever you
 * already log — an Anthropic message, an OpenTelemetry span, a row out
 * of your own audit table — into this shape and the exporter works.
 *
 * A record minted by `mintMessageReceipt()` already satisfies it.
 *
 * @packageDocumentation
 */

/** Every verdict a record can carry, worst to best. */
export type Verdict = "pass" | "warn" | "block";

/**
 * The minimum an exporter needs to place one AI decision on the
 * regulatory record.
 */
export interface ReceiptRecord {
  /** Stable, unique id for this decision. Any opaque string. */
  verdictId: string;
  /** Outcome of whatever checks ran. `pass` when nothing ran. */
  overall: Verdict;
  /** ISO 8601 instant the decision was made. */
  issuedAt: string;

  /** Which agent / system produced it. Groups the Annex IV §3 table. */
  agentSlug?: string;
  /** Idempotency or correlation key. */
  tokenId?: string;
  /** Rule pack that evaluated it, if any. */
  pack?: string;
  /** How many rules ran. */
  ruleCount?: number;
  /** Wire signature, if the record was signed. */
  signature?: string;
  /** SHA-256 over the canonical projection, if signed. */
  contentHash?: string;

  /** Anything else you carry. Preserved, never interpreted. */
  [key: string]: unknown;
}

/**
 * True when a record carries a signature a verifier could re-check.
 *
 * Requires BOTH a signature and the content hash it was taken over —
 * a `signature` field carried in from someone else's log is not a
 * proof this package produced, and must not read as one. The Annex IV
 * exporter uses this to separate attested rows from projected ones so
 * a reader is never left to assume which is which.
 */
export function isAttested(record: ReceiptRecord): boolean {
  return (
    typeof record.signature === "string" &&
    record.signature.length > 0 &&
    typeof record.contentHash === "string" &&
    record.contentHash.length > 0
  );
}
