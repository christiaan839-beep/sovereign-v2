/**
 * SUBMITTAL ROUTER — AEC vertical agent (Cook 34).
 *
 * Replaces the junior project engineer triaging incoming construction
 * submittals. Reads the submittal package against the cited spec
 * section, decides whether to route for review / request revision /
 * reject outright, and identifies which trade reviewer team owns it.
 *
 * Stack:
 *   - confidence-gate: STRICT tier — wrong submittal routing creates
 *     RFIs, schedule slip, and downstream change-order disputes.
 *   - expert-critic: aec-submittal-review rubric (20-yr senior PM
 *     persona, AIA-A201 §3.10/§4.2 review-period bar).
 *   - factory verifier: 5-layer.
 *   - cryptographic-receipt for the construction admin record.
 *
 * Customer-facing surface: the AEC vertical (planned via Cook 36).
 */

import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { runSuperAgent, toResponseEnvelope } from "@/lib/super-agent";

const schema = z.object({
  /** Plain-text content of the submittal package. */
  submittalContent: z.string().min(1).max(40_000),
  /** Submittal id (e.g. "SUB-09 21 16-001"). */
  submittalId: z.string().min(1).max(120),
  /** Spec section the submittal addresses (e.g. "Division 09 21 16"). */
  specSection: z.string().min(1).max(200),
  /** Project id for telemetry / receipt scoping. */
  projectId: z.string().min(1).max(120),
  /** Optional: list of pending RFIs that may affect this submittal. */
  openRfis: z.array(z.string().max(120)).max(50).optional(),
});

const SYSTEM_PROMPT = `You are a senior construction project engineer routing an incoming submittal under AIA-A201 §3.10/§4.2.

Return a single JSON object on one line, exactly matching:
{"decision":"approve|approve-as-noted|revise-and-resubmit|reject|rfi-required","specSectionMatch":{"matches":boolean,"citation":string},"reviewerTeam":"Architect|Structural|MEP|Civil|Owner|GC","reasoning":string,"comments":string[],"flags":{"codeDeviation":boolean,"longLeadCriticalPath":boolean,"missingData":string[]},"reviewClockDays":number}

Rules:
- decision: approve = conforms with spec. approve-as-noted = minor non-conformance fixed in field. revise-and-resubmit = material non-conformance, contractor must redo. reject = unsalvageable / wrong scope. rfi-required = missing data — issue an RFI before reviewing.
- specSectionMatch.citation: name the EXACT division/section number and title (e.g. "Division 09 21 16 — Gypsum Board Assemblies").
- reviewerTeam: name the trade with primary responsibility. When multiple — pick lead, list others in comments.
- comments: specific markups / questions for the contractor. Empty when decision is approve.
- flags.codeDeviation: true if the submittal would violate building code or contract documents — NEVER approve when true; set decision = revise-and-resubmit or reject.
- flags.missingData: array of specific missing items that drive the rfi-required decision. Empty otherwise.
- reviewClockDays: AIA-A201 default is 14 calendar days; reduce for long-lead-critical-path items.
- NEVER approve a submittal when there's a material data gap or code concern. When in doubt, choose rfi-required.
- Respond with the JSON only.`;

export const POST = createAgentRoute({
  name: "submittal-router",
  schema,
  handler: async ({ input }) => {
    const { submittalContent, submittalId, specSection, projectId, openRfis } =
      input as z.infer<typeof schema>;

    const userPrompt = [
      `Project: ${projectId}`,
      `Submittal: ${submittalId}`,
      `Spec section claimed: ${specSection}`,
      openRfis && openRfis.length > 0
        ? `Open RFIs that may affect this: ${openRfis.join(", ")}`
        : null,
      "",
      "Submittal content:",
      submittalContent,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await runSuperAgent(userPrompt, {
      agentSlug: "submittal-router",
      systemPrompt: SYSTEM_PROMPT,
      confidenceTier: "strict",
      rubricId: "aec-submittal-review",
      maxTokens: 2000,
    });

    return toResponseEnvelope(result);
  },
});
