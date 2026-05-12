/**
 * CLINICAL PROTOCOL REVIEWER — pharma vertical agent (Cook 34).
 *
 * Replaces the junior CRA reviewing protocol deviations. Takes a
 * deviation description + the relevant protocol section and returns
 * a structured triage with severity classification, root cause, CAPA
 * action, and the regulatory citation behind the call.
 *
 * Stack:
 *   - confidence-gate: CRITICAL tier — pharma decisions are
 *     irreversible-cost. Sub-0.95 gets escalated; sub-0.5 abstains
 *     to a human CRA.
 *   - expert-critic: pharma-protocol-deviation rubric (15-yr CRA
 *     persona, ICH-GCP E6(R3) Section 5.20 + 21 CFR 312.62(b) bar).
 *   - factory verifier: 5-layer (LlamaGuard + PII + content policy +
 *     quality + trust).
 *   - cryptographic-receipt: HMAC + Merkle + OTS for the auditor.
 *
 * Six independent safety layers. Customer-facing surface is /pharma.
 */

import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { runSuperAgent, toResponseEnvelope } from "@/lib/super-agent";

const schema = z.object({
  /** The protocol section that was potentially violated. */
  protocolSection: z.string().min(1).max(20_000),
  /** What actually happened on the ground. CRA's narrative. */
  deviationDescription: z.string().min(20).max(20_000),
  /** Site identifier (anonymous code, not site name). */
  siteId: z.string().min(1).max(60),
  /** Subject identifier (study-anonymized). */
  subjectId: z.string().min(1).max(60),
  /** Optional study phase (I / II / III / IV) for context. */
  studyPhase: z.enum(["I", "II", "III", "IV"]).optional(),
});

const SYSTEM_PROMPT = `You are a Clinical Research Associate triaging a protocol deviation against ICH-GCP E6(R3) Section 5.20 and 21 CFR 312.62(b).

Return a single JSON object on one line, exactly matching:
{"severity":"minor|major|critical","violatedSection":string,"rootCause":string,"capa":{"correctiveAction":string,"preventiveAction":string,"owner":string,"dueDays":number},"regulatoryCitation":string,"reportingTriggers":{"irbIec":boolean,"sponsor":boolean,"fda":boolean},"reasoning":string}

Rules:
- severity: minor = no impact on subject safety/data integrity. major = potential impact, requires CAPA. critical = subject safety affected, regulator-reportable.
- violatedSection: cite the EXACT protocol section number and title (e.g. "Section 7.2.1 inclusion criterion 4 — eGFR ≥ 60").
- rootCause: SPECIFIC to this site/subject — never "human error" alone. If the input doesn't support a specific root cause, say "requires site investigation".
- capa: corrective + preventive must be auditable steps, not generic procedure references.
- regulatoryCitation: name the framework that drives the classification (ICH-GCP E6(R3) §5.20, 21 CFR 312.62(b), etc.).
- reportingTriggers: irbIec/sponsor/fda flags based on severity + protocol-specific reporting rules. Conservative — when uncertain, set true.
- NEVER guess severity if the data doesn't support a classification. Set severity to "major" with reasoning explaining the uncertainty so a human reviews.
- Respond with the JSON only.`;

export const POST = createAgentRoute({
  name: "clinical-protocol-reviewer",
  schema,
  handler: async ({ input }) => {
    const {
      protocolSection,
      deviationDescription,
      siteId,
      subjectId,
      studyPhase,
    } = input as z.infer<typeof schema>;

    const userPrompt = [
      `Site: ${siteId}`,
      `Subject: ${subjectId}`,
      studyPhase ? `Study phase: ${studyPhase}` : null,
      "",
      "Protocol section under question:",
      protocolSection,
      "",
      "Deviation as observed:",
      deviationDescription,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await runSuperAgent(userPrompt, {
      agentSlug: "clinical-protocol-reviewer",
      systemPrompt: SYSTEM_PROMPT,
      confidenceTier: "critical",
      rubricId: "pharma-protocol-deviation",
      maxTokens: 2000,
    });

    return toResponseEnvelope(result);
  },
});
