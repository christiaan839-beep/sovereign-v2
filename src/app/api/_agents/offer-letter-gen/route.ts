import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

/**
 * OFFER-LETTER-GEN — Generate an offer letter with compensation,
 * equity vesting, and jurisdiction-aware legal clauses.
 *
 * Input:
 *   {
 *     role:              string,
 *     candidate:         string,
 *     baseSalary:        string,
 *     equity:            string,
 *     startDate?:        string,
 *     reportingManager?: string,
 *     jurisdiction?:     string   // e.g. "US-CA", "US-NY", "SA", "UK"
 *   }
 *
 * Output:
 *   {
 *     offerLetter:       string (markdown),
 *     atWillDisclaimer:  string,
 *     nextSteps:         string[]
 *   }
 *
 * Pairs with:
 *   - `resume-screener` — upstream candidate scoring
 *   - `nda-triage` — downstream NDA review
 */

const OFFER_SYSTEM_PROMPT = `You are an HR + legal specialist drafting employment offer letters.

${ANTI_SLOP_RULES}

## DRAFTING RULES
1. For US jurisdictions (default when unspecified but context suggests US), include clear AT-WILL employment language. For CA, NY, WA flag state-specific overtime/paid-leave nuances.
2. For South Africa (SA), draft under the Basic Conditions of Employment Act (BCEA): include 30-day probation language, statutory leave (21 days annual + 6 weeks maternity), and note NO at-will employment exists under SA law.
3. For UK, EU, or any jurisdiction you're unsure about, always include a "⚠️ LOCAL COUNSEL REVIEW REQUIRED" banner at the top of the markdown letter.
4. Equity: render vesting schedule explicitly (e.g. "4-year vest, 1-year cliff, monthly thereafter") when mentioned. Do NOT invent terms the user didn't provide.
5. Never promise benefits that weren't specified in the input. Use placeholders like [BENEFIT DETAILS TBD] when unsure.
6. Output a clean markdown letter as the main offer; add atWillDisclaimer as a standalone string (empty for non-at-will jurisdictions); nextSteps as a 3-5 item checklist.`;

export const POST = createAgentRoute({
  name: "offer-letter-gen",
  requiredFields: ["role", "candidate", "baseSalary", "equity"],
  handler: async ({ input }) => {
    const {
      role,
      candidate,
      baseSalary,
      equity,
      startDate,
      reportingManager,
      jurisdiction,
    } = input as {
      role: string;
      candidate: string;
      baseSalary: string;
      equity: string;
      startDate?: string;
      reportingManager?: string;
      jurisdiction?: string;
    };

    const prompt = `Draft an offer letter in markdown.

Role: ${role}
Candidate: ${candidate}
Base salary: ${baseSalary}
Equity: ${equity}
Start date: ${startDate ?? "[TBD]"}
Reporting manager: ${reportingManager ?? "[TBD]"}
Jurisdiction: ${jurisdiction ?? "US (assumed)"}

Return three sections separated by the literal delimiters below:

===LETTER===
<markdown offer letter>
===DISCLAIMER===
<at-will disclaimer string, or empty if not applicable>
===NEXT_STEPS===
<one next-step per line, 3-5 lines>`;

    const response = await ai(prompt, {
      system: OFFER_SYSTEM_PROMPT,
      maxTokens: 2500,
      model: "claude",
    });

    const raw = String(response);
    const letterMatch = raw.split("===LETTER===")[1]?.split("===DISCLAIMER===")[0]?.trim() ?? raw.trim();
    const disclaimerMatch =
      raw.split("===DISCLAIMER===")[1]?.split("===NEXT_STEPS===")[0]?.trim() ?? "";
    const nextStepsRaw = raw.split("===NEXT_STEPS===")[1]?.trim() ?? "";

    const nextSteps = nextStepsRaw
      .split("\n")
      .map((line) => line.replace(/^[-*\d.\s]+/, "").trim())
      .filter((line) => line.length > 0);

    return {
      success: true,
      result: {
        offerLetter: letterMatch,
        atWillDisclaimer: disclaimerMatch,
        nextSteps,
      },
    };
  },
});
