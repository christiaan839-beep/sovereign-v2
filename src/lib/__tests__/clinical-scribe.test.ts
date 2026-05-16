/**
 * Tests for src/lib/clinical-scribe.ts — Wave 19 healthcare vertical.
 *
 * All hermetic; HMAC v1 scheme via AGENT_RUN_SIGNING_SECRET.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { randomBytes } from "crypto";
import {
  structureSoapNote,
  signScribeReceipt,
  requiresClinicianApproval,
  type ScribeInput,
} from "@/lib/clinical-scribe";

const originalSecret = process.env.AGENT_RUN_SIGNING_SECRET;
const originalEd = process.env.AGENT_RUN_ED25519_PRIVATE_KEY;
beforeAll(() => {
  delete process.env.AGENT_RUN_ED25519_PRIVATE_KEY;
  process.env.AGENT_RUN_SIGNING_SECRET = randomBytes(24).toString("hex");
});
afterAll(() => {
  if (originalSecret !== undefined)
    process.env.AGENT_RUN_SIGNING_SECRET = originalSecret;
  else delete process.env.AGENT_RUN_SIGNING_SECRET;
  if (originalEd !== undefined)
    process.env.AGENT_RUN_ED25519_PRIVATE_KEY = originalEd;
});

const FULL_TRANSCRIPT = `
Subjective:
Patient is a 56-year-old male presenting with chest discomfort for 2 days. Reports
shortness of breath on exertion and mild fatigue.

Objective:
BP 142/88, HR 92 bpm, Temperature 37.1C. Lungs clear to auscultation. ECG shows
sinus rhythm. Potassium 4.1 mEq/L.

Assessment:
Likely stable angina; rule out acute coronary syndrome.

Plan:
Aspirin 81mg daily, low-dose statin, refer to cardiology for stress test within 7 days.
`.trim();

const SHORT_TRANSCRIPT = "Patient feels okay today. No complaints.";

const INPUT_BASE: ScribeInput = {
  transcript: FULL_TRANSCRIPT,
  clinicianId: "user_doc_1",
  patientPseudonym: "pseudo_a1b2c3",
  encounterId: "enc_2026_05_16_001",
  agentTokenId: "tok_test_clinical",
};

describe("structureSoapNote", () => {
  it("extracts all four sections from a well-formed transcript", () => {
    const { note, alerts } = structureSoapNote(FULL_TRANSCRIPT);
    expect(note.subjective).toContain("56-year-old male");
    expect(note.objective).toContain("BP 142/88");
    expect(note.assessment).toContain("stable angina");
    expect(note.plan).toContain("Aspirin");
    expect(note.confidence).toBe("high");
    // No critical-value alert (potassium 4.1 is in range).
    expect(alerts.some((a) => a.kind === "critical-value")).toBe(false);
  });

  it("flags missing-vitals when no BP/HR/temp mentioned", () => {
    const transcript = `
Subjective: patient ok.
Objective: looks well.
Assessment: routine follow-up.
Plan: come back in 6 months.
`.trim();
    const { alerts } = structureSoapNote(transcript);
    expect(alerts.some((a) => a.kind === "missing-vitals")).toBe(true);
  });

  it("flags critical-value when potassium is dangerously high", () => {
    const transcript = `
${FULL_TRANSCRIPT}
Lab results updated: potassium 6.5 mEq/L (recheck).
`.trim();
    const { alerts } = structureSoapNote(transcript);
    const crit = alerts.find((a) => a.kind === "critical-value");
    expect(crit?.severity).toBe("critical");
    expect(crit?.description).toMatch(/potassium 6\.5/i);
  });

  it("flags allergy-mismatch when penicillin is mentioned alongside allergy history", () => {
    const transcript = `
${FULL_TRANSCRIPT}
Allergies: documented in chart. Prescribe penicillin 500mg.
`.trim();
    const { alerts } = structureSoapNote(transcript);
    expect(alerts.some((a) => a.kind === "allergy-mismatch")).toBe(true);
  });

  it("returns confidence=low on a transcript missing 2+ sections", () => {
    const { note, alerts } = structureSoapNote(SHORT_TRANSCRIPT);
    expect(note.confidence).toBe("low");
    expect(alerts.some((a) => a.kind === "ambiguous-input")).toBe(true);
  });

  it("never throws on empty-ish transcripts", () => {
    expect(() => structureSoapNote("ok")).not.toThrow();
    expect(() => structureSoapNote(" ")).not.toThrow();
  });
});

describe("signScribeReceipt", () => {
  it("returns a signed receipt with note + alerts + canonical", () => {
    const r = signScribeReceipt(INPUT_BASE);
    expect(r.receiptId).toMatch(/^[0-9a-f-]{36}$/);
    expect(r.contentHash).toMatch(/^[0-9a-f]{64}$/);
    expect(r.signature).toMatch(/^v1=[0-9a-f]+$/);
    expect(r.canonical).toMatch(/"type":"clinical-soap\/1"/);
    expect(r.encounterId).toBe(INPUT_BASE.encounterId);
    expect(r.clinicianId).toBe(INPUT_BASE.clinicianId);
  });

  it("binds encounterId, clinicianId, agentTokenId into the canonical", () => {
    const r = signScribeReceipt(INPUT_BASE);
    const parsed = JSON.parse(r.canonical) as Record<string, unknown>;
    expect(parsed.encounterId).toBe(INPUT_BASE.encounterId);
    expect(parsed.clinicianId).toBe(INPUT_BASE.clinicianId);
    expect(parsed.agentTokenId).toBe(INPUT_BASE.agentTokenId);
    expect(parsed.patientPseudonym).toBe(INPUT_BASE.patientPseudonym);
  });

  it("throws when transcript is missing", () => {
    expect(() => signScribeReceipt({ ...INPUT_BASE, transcript: "" })).toThrow(
      /transcript/,
    );
  });

  it("throws when agentTokenId is missing (Wave-16 invariant)", () => {
    expect(() =>
      signScribeReceipt({ ...INPUT_BASE, agentTokenId: "" }),
    ).toThrow(/agentTokenId/);
  });

  it("throws when encounterId is missing", () => {
    expect(() => signScribeReceipt({ ...INPUT_BASE, encounterId: "" })).toThrow(
      /encounterId/,
    );
  });

  it("throws when clinicianId is missing", () => {
    expect(() => signScribeReceipt({ ...INPUT_BASE, clinicianId: "" })).toThrow(
      /clinicianId/,
    );
  });
});

describe("requiresClinicianApproval", () => {
  it("requires approval on low-confidence notes", () => {
    const r = signScribeReceipt({
      ...INPUT_BASE,
      transcript: SHORT_TRANSCRIPT,
    });
    expect(requiresClinicianApproval(r)).toBe(true);
  });

  it("requires approval on any critical-severity alert", () => {
    const r = signScribeReceipt({
      ...INPUT_BASE,
      transcript: `${FULL_TRANSCRIPT}\nLab: potassium 6.5 mEq/L`,
    });
    expect(requiresClinicianApproval(r)).toBe(true);
  });

  it("passes a high-confidence note with no critical alerts", () => {
    const r = signScribeReceipt(INPUT_BASE);
    // FULL_TRANSCRIPT yields high confidence + no critical alerts
    expect(requiresClinicianApproval(r)).toBe(false);
  });
});
