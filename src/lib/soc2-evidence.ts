/**
 * SOVEREIGN MATRIX — SOC 2 evidence collector (Cook 153).
 *
 * Composes existing primitives (audit logs, receipt timeline, drift
 * detector, rate-limit telemetry, encryption posture) into a single
 * SOC 2-aligned evidence bundle the auditor imports. Maps each
 * Trust Services Criteria control to the existing module that ships
 * the actual control.
 *
 * Pure module — caller wires the persistence + delivery (typically
 * scheduled monthly via the Cook 56 audit-bundle subscription).
 */

// ── Trust Services Criteria mapping ──────────────────────────────────────

export type TSCCategory =
  | "security"
  | "availability"
  | "processing-integrity"
  | "confidentiality"
  | "privacy";

export interface ControlMapping {
  /** TSC control id (CC1.1 … CC9.x, A1.x, PI1.x, C1.x, P1.x …). */
  controlId: string;
  category: TSCCategory;
  description: string;
  /** Sovereign module that ships the control. */
  evidenceSource: string;
  /** Cron / endpoint that produces the evidence artifact. */
  collectionPath: string;
  /** Expected cadence the auditor sees evidence collected at. */
  cadence: "real-time" | "daily" | "weekly" | "monthly" | "quarterly";
}

export const CONTROLS: ControlMapping[] = [
  // ── Security ──────────────────────────────────────────────────────────
  {
    controlId: "CC1.4",
    category: "security",
    description:
      "Background-check and onboarding controls for personnel with access to customer data.",
    evidenceSource: "HRIS log + signed offer letters",
    collectionPath: "manual:hr-quarterly",
    cadence: "quarterly",
  },
  {
    controlId: "CC2.1",
    category: "security",
    description:
      "Communication of security policies + responsibilities to all personnel.",
    evidenceSource: "docs/SECURITY.md acknowledgement records",
    collectionPath: "src/lib/audit-log.ts:policy-ack",
    cadence: "quarterly",
  },
  {
    controlId: "CC4.1",
    category: "security",
    description:
      "Continuous monitoring of system performance + security posture.",
    evidenceSource: "Cook 58 SOC 2 posture monitor + circuit breakers",
    collectionPath: "/api/admin/preflight",
    cadence: "real-time",
  },
  {
    controlId: "CC5.1",
    category: "security",
    description:
      "Risk identification + assessment for new features that touch customer data.",
    evidenceSource: "security-reviewer agent on PR touching auth/payments",
    collectionPath: ".claude/agents/security-reviewer.md",
    cadence: "real-time",
  },
  {
    controlId: "CC6.1",
    category: "security",
    description:
      "Logical access control — every endpoint authenticates + authorizes per tenant.",
    evidenceSource:
      "src/lib/auth-guard.ts + src/lib/api-guard.ts + src/lib/tenant-scope.ts",
    collectionPath: "src/lib/audit-log.ts:auth-events",
    cadence: "real-time",
  },
  {
    controlId: "CC6.6",
    category: "security",
    description:
      "Encryption in transit (TLS 1.3) + at rest (AES-256-GCM envelope encryption).",
    evidenceSource:
      "src/lib/envelope-encryption.ts + next.config.ts HSTS headers",
    collectionPath: "src/lib/audit-log.ts:encryption-events",
    cadence: "real-time",
  },
  {
    controlId: "CC6.7",
    category: "security",
    description:
      "Transmission of confidential information uses encrypted channels and signed receipts.",
    evidenceSource: "Cryptographic receipt fabric (Cooks 94, 130, 136)",
    collectionPath: "src/lib/receipt-chain.ts + src/lib/receipt-ratchet.ts",
    cadence: "real-time",
  },
  {
    controlId: "CC6.8",
    category: "security",
    description:
      "Unauthorized software / scripts prevented via CSP + sandboxing.",
    evidenceSource: "next.config.ts CSP headers + src/lib/sandbox-egress.ts",
    collectionPath: "manual:csp-config-review",
    cadence: "quarterly",
  },
  {
    controlId: "CC7.1",
    category: "security",
    description: "Vulnerability identification + remediation lifecycle.",
    evidenceSource: ".github/workflows/ci.yml security-audit job",
    collectionPath: "github:actions-runs",
    cadence: "weekly",
  },
  {
    controlId: "CC7.2",
    category: "security",
    description:
      "System monitoring with anomaly detection for security events.",
    evidenceSource: "Cook 117 cost-anomaly + Cook 41 hallucination + drift",
    collectionPath: "src/lib/cost-anomaly.ts + src/lib/drift-detector.ts",
    cadence: "real-time",
  },
  {
    controlId: "CC7.3",
    category: "security",
    description: "Incident response — defined playbooks per failure class.",
    evidenceSource: "docs/runbooks/*",
    collectionPath: "docs/runbooks/clerk-jwks-failing.md, db-down.md, etc.",
    cadence: "real-time",
  },
  {
    controlId: "CC8.1",
    category: "security",
    description: "Change management — every code change reviewed before merge.",
    evidenceSource: "GitHub PR reviews + security-reviewer agent",
    collectionPath: "github:pull-request-reviews",
    cadence: "real-time",
  },
  {
    controlId: "CC9.1",
    category: "security",
    description: "Risk-mitigation activities for vendor sub-processors.",
    evidenceSource: "docs/GDPR-PROCESSOR.md §4 sub-processor list",
    collectionPath: "manual:annual-vendor-review",
    cadence: "quarterly",
  },

  // ── Availability ──────────────────────────────────────────────────────
  {
    controlId: "A1.1",
    category: "availability",
    description: "Service-level commitments documented + monitored.",
    evidenceSource: "docs/slo.md + /status page",
    collectionPath: "/api/health + /status",
    cadence: "real-time",
  },
  {
    controlId: "A1.2",
    category: "availability",
    description:
      "Environmental + infrastructure resilience (cloud + multi-region).",
    evidenceSource: "Vercel multi-region + Neon read replicas",
    collectionPath: "manual:vercel-region-config",
    cadence: "quarterly",
  },
  {
    controlId: "A1.3",
    category: "availability",
    description: "Backup + disaster-recovery procedures.",
    evidenceSource: "Neon PITR + docs/runbooks/dr.md",
    collectionPath: "manual:dr-quarterly-drill",
    cadence: "quarterly",
  },

  // ── Processing integrity ─────────────────────────────────────────────
  {
    controlId: "PI1.1",
    category: "processing-integrity",
    description:
      "Processing is complete, valid, accurate, timely, and authorized.",
    evidenceSource: "Cryptographic receipts on every agent run",
    collectionPath: "src/lib/agent-runs.ts:signReceipt",
    cadence: "real-time",
  },
  {
    controlId: "PI1.4",
    category: "processing-integrity",
    description:
      "Tamper-evident record of every system output across the audit window.",
    evidenceSource: "Receipt-chain ratchet (Cook 94) + Merkle inclusion proof",
    collectionPath: "src/lib/receipt-ratchet.ts",
    cadence: "real-time",
  },
  {
    controlId: "PI1.5",
    category: "processing-integrity",
    description: "Identification + handling of system processing errors.",
    evidenceSource: "Cook 41 hallucination detector + 5-layer output verifier",
    collectionPath: "src/lib/output-verifier.ts + src/lib/output-guard.ts",
    cadence: "real-time",
  },

  // ── Confidentiality ──────────────────────────────────────────────────
  {
    controlId: "C1.1",
    category: "confidentiality",
    description:
      "Confidential information identified + protected throughout its lifecycle.",
    evidenceSource: "Per-tenant data scoping + envelope encryption",
    collectionPath: "src/lib/tenant-scope.ts + src/lib/envelope-encryption.ts",
    cadence: "real-time",
  },
  {
    controlId: "C1.2",
    category: "confidentiality",
    description: "Disposal of confidential information at end of lifecycle.",
    evidenceSource: "Right-of-erasure cascade + signed deletion receipts",
    collectionPath: "/api/account/delete",
    cadence: "real-time",
  },

  // ── Privacy ──────────────────────────────────────────────────────────
  {
    controlId: "P1.1",
    category: "privacy",
    description: "Notice + consent for personal-data collection.",
    evidenceSource: "Cookie banner (POPIA + GDPR) + DPA references",
    collectionPath: "src/components/CookieBanner.tsx + docs/GDPR-PROCESSOR.md",
    cadence: "real-time",
  },
  {
    controlId: "P4.1",
    category: "privacy",
    description: "Data-subject rights handling (access, erasure, portability).",
    evidenceSource: "/api/account/export + /api/account/delete",
    collectionPath: "src/app/api/account/*",
    cadence: "real-time",
  },
  {
    controlId: "P5.1",
    category: "privacy",
    description:
      "Cross-border transfer controls (SCCs + per-tenant data residency).",
    evidenceSource: "docs/GDPR-PROCESSOR.md §7 + Cook 119 data residency",
    collectionPath: "src/lib/tenant-residency.ts",
    cadence: "real-time",
  },
];

// ── Public types ──────────────────────────────────────────────────────────

export interface EvidenceBundle {
  /** Audit period start (Unix ms). */
  periodStart: number;
  /** Audit period end (Unix ms). */
  periodEnd: number;
  /** Auditor-facing controls in scope. */
  controls: ControlMapping[];
  /** Counts of evidence artifacts produced per control during the period. */
  artifactCounts: Record<string, number>;
  /** Bundle hash for tamper-evidence (caller computes over canonical
   *  serialization). */
  bundleHash?: string;
  /** Unix ms when the bundle was produced. */
  generatedAt: number;
}

export interface BundleRequest {
  periodStart: number;
  periodEnd: number;
  /** Optional filter: limit to a single TSC category. */
  category?: TSCCategory;
  /** Caller-supplied counts per controlId from the source of truth
   *  (audit log, telemetry warehouse, etc). */
  artifactCounts?: Record<string, number>;
  now?: number;
}

// ── Public API ────────────────────────────────────────────────────────────

/**
 * List the canonical TSC controls Sovereign Matrix supports.
 * Pure — does not query the DB.
 */
export function listControls(category?: TSCCategory): ControlMapping[] {
  return category ? CONTROLS.filter((c) => c.category === category) : CONTROLS;
}

/**
 * Build an evidence bundle for an auditor. The caller supplies the
 * per-control artifact counts from their telemetry source; this
 * function composes the deterministic SOC 2 envelope around it.
 */
export function buildBundle(req: BundleRequest): EvidenceBundle {
  if (req.periodEnd <= req.periodStart) {
    throw new Error("buildBundle: periodEnd must be after periodStart");
  }
  const controls = listControls(req.category);
  const artifactCounts: Record<string, number> = {};
  for (const c of controls) {
    artifactCounts[c.controlId] = req.artifactCounts?.[c.controlId] ?? 0;
  }
  return {
    periodStart: req.periodStart,
    periodEnd: req.periodEnd,
    controls,
    artifactCounts,
    generatedAt: req.now ?? Date.now(),
  };
}

/**
 * Summary for the dashboard — which controls are real-time, daily,
 * monthly, quarterly. Caller surfaces this so the compliance officer
 * can see what evidence is auto-collected vs needs manual collection.
 */
export function cadenceSummary(): Record<ControlMapping["cadence"], number> {
  const out: Record<ControlMapping["cadence"], number> = {
    "real-time": 0,
    daily: 0,
    weekly: 0,
    monthly: 0,
    quarterly: 0,
  };
  for (const c of CONTROLS) out[c.cadence]++;
  return out;
}

/**
 * Map a TSC category to the count of in-scope controls. Useful for
 * the trust-posture board.
 */
export function categorySummary(): Record<TSCCategory, number> {
  const out: Record<TSCCategory, number> = {
    security: 0,
    availability: 0,
    "processing-integrity": 0,
    confidentiality: 0,
    privacy: 0,
  };
  for (const c of CONTROLS) out[c.category]++;
  return out;
}

/**
 * Resolve a control id to its mapping. Returns undefined if unknown.
 */
export function findControl(controlId: string): ControlMapping | undefined {
  return CONTROLS.find((c) => c.controlId === controlId);
}
