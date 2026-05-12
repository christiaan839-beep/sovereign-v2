/**
 * EMISSIONS CALCULATOR — climate vertical agent (Cook 34).
 *
 * Replaces the junior ESG analyst computing Scope 1/2/3 emissions
 * from activity data. Caller provides utility bills / fleet logs /
 * supplier data; agent applies the right emission factor and
 * returns a calculated tonnes CO2e with the methodology preserved
 * for an assurance provider's replay.
 *
 * Stack:
 *   - confidence-gate: STRICT tier — emissions numbers go on a
 *     CSRD/SEC disclosure that an assurance provider will challenge.
 *   - expert-critic: climate-scope-calculation rubric (ISO 14065
 *     verifier persona, GHG Protocol + CSRD Article 8a bar).
 *   - factory verifier: 5-layer.
 *   - cryptographic-receipt.
 *
 * Customer-facing surface is /climate.
 */

import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { runSuperAgent, toResponseEnvelope } from "@/lib/super-agent";

const schema = z.object({
  /** Raw activity data (e.g. "12,400 kWh consumed Q1 2026, NYISO grid"). */
  activityData: z.string().min(1).max(20_000),
  /** GHG Protocol scope. */
  scope: z.enum(["1", "2", "3"]),
  /**
   * Optional Scope 3 category (1-15 per GHG Protocol). Required when
   * scope === "3"; ignored otherwise.
   */
  scope3Category: z.number().int().min(1).max(15).optional(),
  /** Region for factor selection (e.g. "US-NY", "EU", "ZA"). */
  region: z.string().min(1).max(60),
  /** Reporting boundary (operational vs financial control). */
  controlBoundary: z.enum(["operational", "financial"]).optional(),
  /** Optional pre-selected emission factor. Agent picks one if omitted. */
  emissionFactor: z.string().max(500).optional(),
});

const SYSTEM_PROMPT = `You are an ISO 14065-accredited GHG verifier computing emissions from activity data.

Return a single JSON object on one line, exactly matching:
{"tonnesCO2e":number,"factor":{"value":number,"unit":string,"source":string,"vintage":string},"gwpBasis":"AR5|AR6","controlBoundary":"operational|financial","formula":string,"allocationMethod":string|null,"materialUnderSEC":boolean,"caveats":string[],"reasoning":string}

Rules:
- tonnesCO2e: rounded to 3 decimal places.
- factor: the SPECIFIC emission factor used. source must be a recognized publisher (IPCC AR6, EPA eGRID YYYY, IEA, DEFRA YYYY, ecoinvent).
- gwpBasis: AR6 unless the methodology mandates AR5 (e.g. legacy PCAF requirements).
- formula: a one-line plain-text equation a third-party can replay (e.g. "12400 kWh × 0.000395 tCO2e/kWh = 4.898 tCO2e").
- allocationMethod: only when an allocation was performed (mass / economic / hybrid). null when none.
- materialUnderSEC: true if this calculation falls under SEC S-K 1500 'material' threshold given the registrant's profile. Set false + caveat if uncertain.
- caveats: unknowns the assurance provider must verify (data-quality concerns, factor-vintage mismatch, allocation assumptions). Empty array when none.
- NEVER fabricate a factor value or source. If the input doesn't support a defensible factor, abstain rather than guess.
- Respond with the JSON only.`;

export const POST = createAgentRoute({
  name: "emissions-calculator",
  schema,
  handler: async ({ input }) => {
    const {
      activityData,
      scope,
      scope3Category,
      region,
      controlBoundary,
      emissionFactor,
    } = input as z.infer<typeof schema>;

    const userPrompt = [
      `Scope: ${scope}${scope === "3" && scope3Category ? ` (Category ${scope3Category})` : ""}`,
      `Region: ${region}`,
      controlBoundary ? `Control boundary: ${controlBoundary}` : null,
      emissionFactor ? `Pre-selected factor: ${emissionFactor}` : null,
      "",
      "Activity data:",
      activityData,
    ]
      .filter(Boolean)
      .join("\n");

    const result = await runSuperAgent(userPrompt, {
      agentSlug: "emissions-calculator",
      systemPrompt: SYSTEM_PROMPT,
      confidenceTier: "strict",
      rubricId: "climate-scope-calculation",
      maxTokens: 2000,
    });

    return toResponseEnvelope(result);
  },
});
