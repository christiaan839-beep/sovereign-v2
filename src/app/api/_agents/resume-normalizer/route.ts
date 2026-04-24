/**
 * Resume Normalizer — parse a free-form resume into structured
 * ATS-compatible JSON (HR-XML / JSON-Resume v1.0.0 schema).
 *
 * Every ATS (Greenhouse, Lever, Workable, Ashby) defines its own schema
 * for candidate intake. This agent emits the most permissive superset —
 * JSON-Resume schema — which downstream adapters can project into
 * specific ATS formats.
 *
 * HANDLES
 * ───────
 *   - PII: email, phone, LinkedIn URL preserved verbatim (job application
 *     context is consent to process by submission)
 *   - Dates: normalized to ISO-8601 month ("2023-06"). Present-tense
 *     positions become `endDate: null`.
 *   - Skills: deduped + lowercased-without-punctuation for matching
 *   - Experience: chronologically sorted (newest first)
 */

import { createAgentRoute } from "@/lib/agent-factory";
import { nimChat, NIM_MODELS } from "@/lib/nvidia";

const SYSTEM_PROMPT = `You are a resume-to-ATS normalizer. Parse a
free-form resume (text or text-from-PDF) into JSON-Resume v1.0.0 format.

Output JSON (strict schema):

{
  "basics": {
    "name": "string",
    "label": "string",                   // headline / title
    "email": "string | null",
    "phone": "string | null",             // E.164 format if possible
    "website": "string | null",
    "summary": "string | null",           // 1-3 sentences
    "location": {
      "city": "string | null",
      "region": "string | null",           // state / province
      "country": "string | null"
    },
    "profiles": [
      { "network": "string", "username": "string", "url": "string" }
    ]
  },
  "work": [
    {
      "name": "string",                    // company
      "position": "string",
      "startDate": "YYYY-MM",
      "endDate": "YYYY-MM | null",         // null = present
      "summary": "string | null",
      "highlights": ["string"]              // bullet points, verbatim where possible
    }
  ],
  "education": [
    {
      "institution": "string",
      "area": "string | null",
      "studyType": "string | null",        // Bachelor / Master / PhD / ...
      "startDate": "YYYY-MM | null",
      "endDate": "YYYY-MM | null",
      "gpa": "string | null"
    }
  ],
  "skills": [
    { "name": "string", "level": "string | null", "keywords": ["string"] }
  ],
  "languages": [
    { "language": "string", "fluency": "string | null" }
  ],
  "parseQuality": {
    "confidence": "high" | "medium" | "low",
    "missing": ["string"]                   // field paths that couldn't be filled
  }
}

Rules:
  1. NEVER invent dates, titles, or companies. If unclear, return null
     + add to missing.
  2. Preserve original email / phone / URLs VERBATIM (don't normalize
     case — "Foo.Bar@Acme.COM" stays as-is; normalize phone to E.164 only
     if country is unambiguous).
  3. Work history sorted newest → oldest. "Present" / "current" becomes
     endDate: null.
  4. Skills: dedupe case-insensitively, preserve the display form from
     the first occurrence.
  5. Return valid JSON only. No prose outside.`;

export const POST = createAgentRoute({
  name: "resume-normalizer",
  requiredFields: ["resumeText"],
  handler: async ({ input }) => {
    const { resumeText } = input as { resumeText: string };

    const output = await nimChat(
      NIM_MODELS.reasoning,
      [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: `Resume:\n${resumeText.slice(0, 12000)}` },
      ],
      { maxTokens: 3000, temperature: 0.1 },
    );

    return {
      success: true,
      resume: output,
      model: NIM_MODELS.reasoning,
      domain: "recruiting",
      samVersion: "1.0",
      category: "Recruiting",
    };
  },
});
