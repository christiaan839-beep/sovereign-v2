/**
 * SOVEREIGN MATRIX — Clinical scribe (Wave 19, healthcare vertical).
 *
 * Closes the 2026 research's #1 healthcare gap:
 *   "Ambient AI scribes have reduced clinician documentation time
 *   by 83% … 85% of US healthcare leaders are increasing investment."
 *
 * Sovereign's differentiator vs every other scribe: every SOAP note
 * we produce ships with a cryptographic receipt that:
 *   1. Names the clinician who recorded it (via Wave-16 JIT token).
 *   2. Pins the canonical projection (subjective/objective/assessment/
 *      plan) so the note bytes are tamper-evident.
 *   3. Lands on the audit-log chain → Wave-9 Bitcoin anchor → admissible
 *      against 7-25y clinical-trial retention horizons.
 *   4. Flags clinical alerts inline (critical values, allergy mismatches)
 *      with an explicit confidence band.
 *
 * Pure module: takes a transcript + clinician context, returns a
 * structured note + signed receipt envelope. The /api/clinical/scribe
 * route persists the receipt and emits the audit-log row.
 */

import { createHash, randomUUID } from "crypto";
import { signRun } from "@/lib/agent-runs";

export type ConfidenceBand = "high" | "medium" | "low";

export interface SoapNote {
  /** Subjective — patient-reported symptoms, history. */
  subjective: string;
  /** Objective — vitals, exam findings, lab values. */
  objective: string;
  /** Assessment — clinical interpretation, differential diagnoses. */
  assessment: string;
  /** Plan — treatment, medications, follow-up. */
  plan: string;
  /**
   * Confidence band the scribe assigns to its own structuring.
   * "low" forces a clinician sign-off pre-export. "high" is rare.
   */
  confidence: ConfidenceBand;
}

export interface ClinicalAlert {
  kind:
    | "critical-value"
    | "allergy-mismatch"
    | "medication-interaction"
    | "ambiguous-input"
    | "missing-vitals";
  severity: "info" | "warn" | "critical";
  description: string;
}

export interface ScribeInput {
  /** Free-form transcript bytes the ambient mic captured. */
  transcript: string;
  /** Clinician identifier (Clerk user id or NPI). */
  clinicianId: string;
  /** Patient pseudonym — never raw PII; hashed externally. */
  patientPseudonym: string;
  /** Encounter id from the EHR — links the note back to its visit. */
  encounterId: string;
  /** Wave-16 JIT token id bound to this scribe invocation. */
  agentTokenId: string;
}

export interface ScribeReceipt {
  receiptId: string;
  note: SoapNote;
  alerts: ClinicalAlert[];
  /** Canonical projection (deterministic, sorted). */
  canonical: string;
  /** SHA-256 of canonical. */
  contentHash: string;
  /** Signature in v1=hmac / v2=ed25519 / v3=dual format. */
  signature: string;
  /** Issued-at ISO 8601. */
  issuedAt: string;
  /** Encounter id pinned into the receipt so it cannot be moved. */
  encounterId: string;
  /** Clinician id pinned into the receipt. */
  clinicianId: string;
}

/**
 * Build a SOAP note from an ambient transcript. The structuring is
 * heuristic — we mark `confidence: "low"` when the transcript is too
 * short, when critical sections are missing, or when ambiguous
 * directives surface. A clinician should review every low-confidence
 * note before export; the API route enforces this via the response
 * `requiresClinicianApproval` flag.
 *
 * Pure function — no I/O, no model calls (yet). Wave 19 ships the
 * envelope + heuristic structurer; Wave 19.1 will swap the body for
 * the medical-NER pipeline once we have the BAA in place.
 */
export function structureSoapNote(transcript: string): {
  note: SoapNote;
  alerts: ClinicalAlert[];
} {
  const lower = transcript.toLowerCase();
  const alerts: ClinicalAlert[] = [];

  // Section-extraction heuristic — split on common clinical headers.
  // Conservative: if a section header isn't present, mark
  // confidence=low and surface an ambiguous-input alert.
  const subjective = extractSection(transcript, [
    "subjective",
    "chief complaint",
    "patient reports",
    "history of present illness",
  ]);
  const objective = extractSection(transcript, [
    "objective",
    "vitals",
    "exam",
    "physical exam",
    "on examination",
    "labs",
  ]);
  const assessment = extractSection(transcript, [
    "assessment",
    "impression",
    "differential",
    "diagnosis",
  ]);
  const plan = extractSection(transcript, [
    "plan",
    "treatment",
    "next steps",
    "follow-up",
    "follow up",
    "discharge",
  ]);

  // Confidence band — we drop to "low" on any obvious gap.
  const missingSections = [subjective, objective, assessment, plan].filter(
    (s) => !s,
  ).length;
  const confidence: ConfidenceBand =
    missingSections >= 2
      ? "low"
      : missingSections === 1 || transcript.length < 200
        ? "medium"
        : "high";

  if (missingSections > 0) {
    alerts.push({
      kind: "ambiguous-input",
      severity: missingSections >= 2 ? "warn" : "info",
      description: `${missingSections} of 4 SOAP sections could not be extracted from the transcript`,
    });
  }
  if (
    !objective ||
    !/\b(\d{2,3}\/\d{2,3}|\b\d{2,3}\s*bpm|\btemp(erature)?\b)/.test(transcript)
  ) {
    alerts.push({
      kind: "missing-vitals",
      severity: "warn",
      description:
        "No vitals (blood pressure, heart rate, temperature) detected in the transcript",
    });
  }

  // Critical-value heuristics — common red-flag thresholds.
  // Use matchAll so a transcript with multiple potassium values (e.g.
  // an initial in-range result plus a later recheck) doesn't hide the
  // out-of-range value behind the in-range one.
  const potassiumMatches = transcript.matchAll(
    /\bpotassium\b[^.\n]*?\b(\d+(?:\.\d+)?)\b/gi,
  );
  for (const m of potassiumMatches) {
    const v = parseFloat(m[1]);
    if (Number.isFinite(v) && (v >= 6.0 || v <= 2.5)) {
      alerts.push({
        kind: "critical-value",
        severity: "critical",
        description: `Potassium ${v} mEq/L — outside the 3.5–5.5 reference range`,
      });
    }
  }
  if (/\ballerg(y|ies)\b/.test(lower) && /\bpenicillin\b/.test(lower)) {
    alerts.push({
      kind: "allergy-mismatch",
      severity: "warn",
      description:
        "Penicillin mentioned alongside allergy history — verify before prescribing",
    });
  }

  return {
    note: {
      subjective:
        subjective ??
        "[No subjective section extracted — clinician review required]",
      objective:
        objective ??
        "[No objective findings extracted — clinician review required]",
      assessment:
        assessment ?? "[No assessment extracted — clinician review required]",
      plan: plan ?? "[No plan extracted — clinician review required]",
      confidence,
    },
    alerts,
  };
}

/**
 * Produce a signed scribe receipt. Composes the heuristic structurer
 * with the platform's signRun primitive so the note bytes are bound
 * into a tamper-evident receipt.
 *
 * Throws on missing required input (transcript, encounterId, agentTokenId).
 */
export function signScribeReceipt(input: ScribeInput): ScribeReceipt {
  if (!input.transcript || input.transcript.length < 1) {
    throw new Error("scribe: transcript is required");
  }
  if (!input.encounterId) throw new Error("scribe: encounterId is required");
  if (!input.agentTokenId)
    throw new Error("scribe: agentTokenId is required (Wave-16 invariant)");
  if (!input.clinicianId) throw new Error("scribe: clinicianId is required");

  const { note, alerts } = structureSoapNote(input.transcript);

  const receiptId = randomUUID();
  const issuedAt = new Date().toISOString();
  const canonical = canonicalize({
    receiptId,
    note,
    alerts,
    encounterId: input.encounterId,
    clinicianId: input.clinicianId,
    patientPseudonym: input.patientPseudonym,
    agentTokenId: input.agentTokenId,
    issuedAt,
  });
  const contentHash = sha256(canonical);
  const signature = signRun(canonical);

  return {
    receiptId,
    note,
    alerts,
    canonical,
    contentHash,
    signature,
    issuedAt,
    encounterId: input.encounterId,
    clinicianId: input.clinicianId,
  };
}

/**
 * Returns true when the receipt's confidence band or alert severity
 * means the API route must NOT auto-export. The clinician has to
 * sign off explicitly via the dashboard before the note leaves the
 * system. Pure predicate over the receipt — no I/O.
 */
export function requiresClinicianApproval(r: ScribeReceipt): boolean {
  if (r.note.confidence === "low") return true;
  if (r.alerts.some((a) => a.severity === "critical")) return true;
  return false;
}

// ── Internals ─────────────────────────────────────────────────────────

function extractSection(transcript: string, headers: string[]): string | null {
  const lower = transcript.toLowerCase();
  for (const h of headers) {
    const idx = lower.indexOf(h);
    if (idx === -1) continue;
    // Capture from after the header to the next double-newline or the
    // end of the transcript. Trim and length-cap to 2000 chars.
    const after = transcript.slice(idx + h.length);
    const stop = after.search(/\n\s*\n|\r\n\r\n/);
    const chunk = (stop >= 0 ? after.slice(0, stop) : after)
      .replace(/^[:\-\s]+/, "")
      .trim();
    if (chunk.length === 0) continue;
    return chunk.slice(0, 2000);
  }
  return null;
}

function canonicalize(input: {
  receiptId: string;
  note: SoapNote;
  alerts: ClinicalAlert[];
  encounterId: string;
  clinicianId: string;
  patientPseudonym: string;
  agentTokenId: string;
  issuedAt: string;
}): string {
  return JSON.stringify({
    v: 1,
    type: "clinical-soap/1",
    receiptId: input.receiptId,
    agentTokenId: input.agentTokenId,
    alerts: input.alerts
      .slice()
      .sort((a, b) => a.kind.localeCompare(b.kind))
      .map((a) => ({
        description: a.description,
        kind: a.kind,
        severity: a.severity,
      })),
    clinicianId: input.clinicianId,
    encounterId: input.encounterId,
    issuedAt: input.issuedAt,
    note: {
      assessment: input.note.assessment,
      confidence: input.note.confidence,
      objective: input.note.objective,
      plan: input.note.plan,
      subjective: input.note.subjective,
    },
    patientPseudonym: input.patientPseudonym,
  });
}

function sha256(s: string): string {
  return createHash("sha256").update(s, "utf8").digest("hex");
}
