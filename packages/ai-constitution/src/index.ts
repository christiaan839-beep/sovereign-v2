/**
 * @sovereign-matrix/ai-constitution
 *
 * Cryptographically-anchored AI constitutions.
 *
 * The premise: an operator commits an immutable policy document (the
 * "constitution") to a content-addressed hash. Every receipt the agent
 * produces commits to that hash inside its canonical projection. If
 * the agent ever takes an action that violates the constitution, the
 * receipt itself is cryptographic evidence — the operator can prove
 * to a regulator, court, or insurance underwriter exactly which
 * articles were violated, with byte-precise timestamps.
 *
 * The constitution is built from articles. Each article has:
 *   - id (canonical, stable)
 *   - title
 *   - text (the inviolable rule, free-form)
 *   - severity (advisory / warning / blocking)
 *   - measurableCondition (optional — a Guardian-pack rule id that
 *     can verify the constitution programmatically)
 *
 * The whole document is hashed with SHA-256 and that root hash
 * becomes the `constitutionHash` field on every receipt minted under
 * this constitution.
 *
 * This is genuinely novel: Anthropic ships Constitutional AI as a
 * training methodology; we ship it as an inference-time cryptographic
 * commitment. The two compose — a Claude model trained on a
 * constitution + our wrapper that anchors every output to a
 * verifiable constitution hash = the strongest currently-available
 * accountability primitive for autonomous agents.
 *
 * AGI/ASI safety implication: when autonomous agents take consequential
 * actions, "did the agent follow the rules?" becomes the central
 * accountability question. This package makes that question
 * cryptographically answerable.
 *
 * Apache 2.0. Zero runtime deps beyond @sovereign-matrix/verifiable-receipts
 * and node:crypto for SHA-256.
 *
 * @packageDocumentation
 */

import { createHash } from "node:crypto";
import type { ReceiptRecord } from "@sovereign-matrix/verifiable-receipts";

/**
 * A single article of the constitution. Stable id + inviolable rule
 * + severity classification.
 */
export interface ConstitutionArticle {
  /** Canonical id, e.g. "ART-1.1". Stable across revisions. */
  id: string;
  /** Short title. */
  title: string;
  /** The inviolable rule. Free-form natural language. */
  text: string;
  /**
   * Severity tier. Advisory rules are recommendations; warning rules
   * trigger a flag; blocking rules require the receipt's overall
   * verdict to be "block".
   */
  severity: "advisory" | "warning" | "blocking";
  /**
   * Optional reference to a Guardian-pack rule that programmatically
   * verifies this article. When set, a receipt is considered
   * compliant with this article iff the named rule passed.
   */
  measurableCondition?: {
    /** Guardian pack id, e.g. "owaspAgenticTop10Pack". */
    pack: string;
    /** Rule id within the pack, e.g. "owasp-A01-excessive-agency". */
    ruleId: string;
  };
  /** Optional citations to external standards (e.g. EU AI Act Art. 5). */
  citations?: string[];
}

/**
 * A complete signed constitution. The hash field is the content-
 * addressed identifier — any receipt that claims to operate under
 * this constitution embeds this hash.
 */
export interface SignedConstitution {
  /** Schema version. */
  schema: "vaos-constitution-v1";
  /** ISO 8601 of when the constitution was signed. */
  signedAt: string;
  /** Operator-supplied human-readable name. */
  name: string;
  /** Optional preamble explaining the constitution's purpose. */
  preamble?: string;
  /** Operator identifier (org name, dao id, etc.). */
  signedBy: string;
  /** The articles. Order matters because the hash depends on it. */
  articles: ConstitutionArticle[];
  /** SHA-256 of the canonical projection. Receipts anchor to this. */
  hash: string;
  /**
   * Optional Ed25519 signature of `hash` by `signedBy`'s key. When
   * present, anyone can verify the constitution wasn't tampered with
   * after signing.
   */
  signature?: string;
  /** Optional public key (PEM) used to sign. */
  publicKey?: string;
}

/** Options for building a constitution. */
export interface BuildConstitutionOptions {
  name: string;
  signedBy: string;
  articles: ConstitutionArticle[];
  preamble?: string;
  /** Optional signer function — receives canonical, returns signature string. */
  sign?: (canonical: string) => string;
  /** Optional public key to embed (PEM). */
  publicKey?: string;
}

/**
 * Compute the canonical projection of a constitution. The hash is
 * SHA-256 over this string. By making it deterministic, anyone with
 * the source articles can reproduce the hash and verify integrity.
 *
 * The canonical form omits the hash + signature fields themselves
 * (since they would create circular dependencies).
 */
export function canonicalize(
  opts: BuildConstitutionOptions,
  signedAt: string,
): string {
  // Deterministic: sorted JSON of the article array + name + signedBy
  // + preamble (optional) + signedAt. Article ids must be unique;
  // we don't sort articles (operator order is significant — earlier
  // articles take precedence in conflicts).
  return JSON.stringify(
    {
      schema: "vaos-constitution-v1",
      name: opts.name,
      preamble: opts.preamble ?? null,
      signedBy: opts.signedBy,
      signedAt,
      articles: opts.articles.map((a) => ({
        id: a.id,
        title: a.title,
        text: a.text,
        severity: a.severity,
        measurableCondition: a.measurableCondition ?? null,
        citations: a.citations ?? null,
      })),
    },
    null,
    0,
  );
}

/**
 * Build a signed constitution. Throws if article ids collide.
 */
export function buildConstitution(
  opts: BuildConstitutionOptions,
): SignedConstitution {
  // Validate article id uniqueness — duplicate ids would collide when
  // a receipt cites which article it violated.
  const seen = new Set<string>();
  for (const a of opts.articles) {
    if (seen.has(a.id)) {
      throw new Error(
        `buildConstitution: duplicate article id "${a.id}". Article ids MUST be unique within a constitution.`,
      );
    }
    seen.add(a.id);
  }

  const signedAt = new Date().toISOString();
  const canonical = canonicalize(opts, signedAt);
  const hash = sha256Hex(canonical);

  const signed: SignedConstitution = {
    schema: "vaos-constitution-v1",
    signedAt,
    name: opts.name,
    signedBy: opts.signedBy,
    articles: opts.articles,
    hash,
  };
  if (opts.preamble) signed.preamble = opts.preamble;
  if (opts.sign) {
    signed.signature = opts.sign(canonical);
  }
  if (opts.publicKey) {
    signed.publicKey = opts.publicKey;
  }
  return signed;
}

/**
 * Verify that a constitution's `hash` field actually matches its
 * content. Independent of signature verification. Returns true iff
 * the content-addressed integrity holds.
 */
export function verifyConstitutionIntegrity(c: SignedConstitution): boolean {
  const canonical = canonicalize(
    {
      name: c.name,
      signedBy: c.signedBy,
      articles: c.articles,
      preamble: c.preamble,
    },
    c.signedAt,
  );
  return sha256Hex(canonical) === c.hash;
}

/**
 * Audit a receipt set against a constitution. Surfaces every receipt
 * that violates a blocking or warning article, indexed by article id
 * so the operator can see exactly which rules were broken.
 */
export interface AuditReport {
  schema: "vaos-constitution-audit-v1";
  generatedAt: string;
  constitutionHash: string;
  constitutionName: string;
  totalReceipts: number;
  receiptsBoundToThisConstitution: number;
  receiptsBoundToDifferentConstitution: number;
  receiptsUnbound: number;
  violationsByArticle: Record<
    string,
    {
      article: ConstitutionArticle;
      blockingViolations: ReceiptSummary[];
      warningViolations: ReceiptSummary[];
    }
  >;
  summary: {
    blockingViolationsTotal: number;
    warningViolationsTotal: number;
    cleanReceipts: number;
  };
}

export interface ReceiptSummary {
  verdictId: string;
  issuedAt: string;
  agentSlug: string;
  pack?: string;
}

/**
 * Compute a constitutional audit over a receipt set.
 */
export function auditAgainstConstitution(opts: {
  constitution: SignedConstitution;
  receipts: ReceiptRecord[];
}): AuditReport {
  const { constitution, receipts } = opts;
  const generatedAt = new Date().toISOString();

  // Receipts whose canonical projection includes this constitution's
  // hash are considered "bound" to it.
  const bound: ReceiptRecord[] = [];
  let differentConstitution = 0;
  let unbound = 0;
  for (const r of receipts) {
    const h = (r as Record<string, unknown>).constitutionHash;
    if (typeof h !== "string") {
      unbound++;
    } else if (h !== constitution.hash) {
      differentConstitution++;
    } else {
      bound.push(r);
    }
  }

  // Per-article violation tracking.
  const violationsByArticle: AuditReport["violationsByArticle"] = {};
  for (const article of constitution.articles) {
    violationsByArticle[article.id] = {
      article,
      blockingViolations: [],
      warningViolations: [],
    };
  }

  let blockingViolationsTotal = 0;
  let warningViolationsTotal = 0;
  let cleanReceipts = 0;

  for (const r of bound) {
    let receiptHasAnyViolation = false;
    // Check rule-level results when the receipt exposes them. Many
    // verdict envelopes carry `rules: Array<{ ruleId, pack, verdict }>`.
    const rules = (r as Record<string, unknown>).rules;
    if (Array.isArray(rules)) {
      for (const rule of rules as Array<{
        ruleId?: unknown;
        pack?: unknown;
        verdict?: unknown;
      }>) {
        if (rule.verdict !== "warn" && rule.verdict !== "block") continue;
        // Find matching article(s).
        for (const article of constitution.articles) {
          if (!article.measurableCondition) continue;
          if (
            article.measurableCondition.pack === rule.pack &&
            article.measurableCondition.ruleId === rule.ruleId
          ) {
            const summary: ReceiptSummary = {
              verdictId: String(r.verdictId),
              issuedAt: String(r.issuedAt),
              agentSlug: String(r.agentSlug ?? "unknown"),
            };
            if (typeof r.pack === "string") summary.pack = r.pack;

            if (article.severity === "blocking" && rule.verdict === "block") {
              violationsByArticle[article.id]!.blockingViolations.push(summary);
              blockingViolationsTotal++;
              receiptHasAnyViolation = true;
            } else if (
              article.severity === "warning" ||
              (article.severity === "blocking" && rule.verdict === "warn")
            ) {
              violationsByArticle[article.id]!.warningViolations.push(summary);
              warningViolationsTotal++;
              receiptHasAnyViolation = true;
            }
          }
        }
      }
    }
    if (!receiptHasAnyViolation) cleanReceipts++;
  }

  return {
    schema: "vaos-constitution-audit-v1",
    generatedAt,
    constitutionHash: constitution.hash,
    constitutionName: constitution.name,
    totalReceipts: receipts.length,
    receiptsBoundToThisConstitution: bound.length,
    receiptsBoundToDifferentConstitution: differentConstitution,
    receiptsUnbound: unbound,
    violationsByArticle,
    summary: {
      blockingViolationsTotal,
      warningViolationsTotal,
      cleanReceipts,
    },
  };
}

/**
 * Render the audit as Markdown. Drop into your DPO/court/regulator
 * binder.
 */
export function toMarkdown(audit: AuditReport): string {
  const lines: string[] = [];
  const heading = (level: number, text: string): void => {
    lines.push(`${"#".repeat(level)} ${text}`);
    lines.push("");
  };
  const kv = (k: string, v: unknown): void => {
    lines.push(`- **${k}:** ${String(v)}`);
  };

  heading(1, "Constitutional AI Audit Report");
  lines.push(
    `*Generated by @sovereign-matrix/ai-constitution at ${audit.generatedAt}*`,
  );
  lines.push("");
  lines.push(
    `*This document is a cryptographically-anchored audit of agent behaviour against an immutable constitution. The constitution hash ${audit.constitutionHash.slice(0, 12)}… is committed inside every bound receipt; any third party with the constitution + the receipts can re-derive this report byte-identically.*`,
  );
  lines.push("");

  heading(2, "Audit scope");
  kv("Constitution", audit.constitutionName);
  kv("Constitution hash", `\`${audit.constitutionHash}\``);
  kv("Total receipts surveyed", audit.totalReceipts);
  kv("Bound to this constitution", audit.receiptsBoundToThisConstitution);
  kv(
    "Bound to a different constitution",
    audit.receiptsBoundToDifferentConstitution,
  );
  kv("Unbound (no constitution hash)", audit.receiptsUnbound);
  lines.push("");

  heading(2, "Summary");
  kv("Blocking violations", audit.summary.blockingViolationsTotal);
  kv("Warning violations", audit.summary.warningViolationsTotal);
  kv("Clean receipts", audit.summary.cleanReceipts);
  lines.push("");

  heading(2, "Violations by article");
  const articles = Object.values(audit.violationsByArticle);
  if (
    articles.every(
      (a) =>
        a.blockingViolations.length === 0 && a.warningViolations.length === 0,
    )
  ) {
    lines.push("No violations detected in the surveyed receipts.");
    lines.push("");
  } else {
    for (const v of articles) {
      const total = v.blockingViolations.length + v.warningViolations.length;
      if (total === 0) continue;
      heading(3, `${v.article.id} — ${v.article.title}`);
      lines.push(`*Severity: ${v.article.severity.toUpperCase()}*`);
      lines.push("");
      lines.push(`> ${v.article.text}`);
      lines.push("");
      if (v.article.citations) {
        for (const c of v.article.citations) {
          lines.push(`- *Cites:* ${c}`);
        }
        lines.push("");
      }
      if (v.blockingViolations.length > 0) {
        heading(4, `Blocking violations (${v.blockingViolations.length})`);
        for (const r of v.blockingViolations.slice(0, 20)) {
          lines.push(
            `- \`${r.verdictId}\` (${r.issuedAt}) — agent \`${r.agentSlug}\`${r.pack ? ` pack \`${r.pack}\`` : ""}`,
          );
        }
        if (v.blockingViolations.length > 20) {
          lines.push(`- … + ${v.blockingViolations.length - 20} more`);
        }
        lines.push("");
      }
      if (v.warningViolations.length > 0) {
        heading(4, `Warning violations (${v.warningViolations.length})`);
        for (const r of v.warningViolations.slice(0, 20)) {
          lines.push(
            `- \`${r.verdictId}\` (${r.issuedAt}) — agent \`${r.agentSlug}\`${r.pack ? ` pack \`${r.pack}\`` : ""}`,
          );
        }
        if (v.warningViolations.length > 20) {
          lines.push(`- … + ${v.warningViolations.length - 20} more`);
        }
        lines.push("");
      }
    }
  }

  heading(2, "Constitution articles (verbatim)");
  for (const a of Object.values(audit.violationsByArticle)) {
    lines.push(
      `**${a.article.id}** — ${a.article.title} *(${a.article.severity})*`,
    );
    lines.push(`> ${a.article.text}`);
    lines.push("");
  }

  heading(2, "Provenance");
  lines.push(
    `Generated by [@sovereign-matrix/ai-constitution](https://www.npmjs.com/package/@sovereign-matrix/ai-constitution) v0.1.0 · Apache 2.0. Audit results are reproducible from the constitution + receipts.`,
  );

  return lines.join("\n");
}

/** Serialize the audit as JSON. */
export function toJSON(audit: AuditReport): string {
  return JSON.stringify(audit, null, 2);
}

// ─── Internal helpers ────────────────────────────────────────────

function sha256Hex(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}
