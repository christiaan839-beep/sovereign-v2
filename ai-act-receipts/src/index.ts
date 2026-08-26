/**
 * ai-act-receipts — signed receipts around your Claude calls, and the
 * EU AI Act Annex IV documentation that comes out the other end.
 *
 * Three moving parts, used in whatever combination you need:
 *
 *   1. Mint    `mintMessageReceipt()` wraps an Anthropic message in a
 *              signed Guardian attestation. Three lines at the call site.
 *   2. Project `projectRecords()` turns logs you already have into the
 *              same record shape, so you can start without changing code.
 *   3. Export  `buildAnnexIv()` turns a set of records into Article 11
 *              technical documentation.
 *
 * You can use (3) alone. Most people should: run it over last quarter's
 * logs, see what the document looks like, and only then decide whether
 * signing at the call site is worth it.
 *
 * What this is not: a compliance certification, legal advice, or a
 * determination that your system is high-risk under Annex III. It
 * produces documentation and marks every section a machine cannot fill
 * as OPERATOR-AUTHORED.
 *
 * Zero runtime dependencies. Node 18+.
 *
 * @packageDocumentation
 */

// ── Records ─────────────────────────────────────────────────────────
export type { ReceiptRecord, Verdict } from "./types.js";

// ── 1. Mint ─────────────────────────────────────────────────────────
export {
  mintMessageReceipt,
  withReceipt,
  type AnthropicMessage,
  type MintMessageReceiptOptions,
} from "./anthropic.js";

export {
  runGuardian,
  verifyGuardianAttestation,
  quorumCollapse,
  outputSizeRule,
  forbiddenSubstringRule,
  requireTokenRule,
  type GuardianAttestation,
  type GuardianContext,
  type GuardianRule,
  type GuardianVerdict,
  type RuleVerdict,
} from "./guardian.js";

export {
  euAiActPack,
  euAiActRules,
  composePacks,
  type GuardianPack,
} from "./packs.js";

// ── 2. Project ──────────────────────────────────────────────────────
export {
  projectRecords,
  normaliseVerdict,
  toIso,
  isAttested,
  type FieldSource,
  type ProjectOptions,
  type ProjectionResult,
  type SkippedRow,
} from "./project.js";

// ── 3. Export ───────────────────────────────────────────────────────
export {
  buildAnnexIv,
  toMarkdown,
  toJSON,
  type AnnexIvReport,
  type BuildAnnexIvOptions,
  type ReceiptSummary,
  type SectionStub,
  type SystemDescription,
} from "./annex-iv.js";
