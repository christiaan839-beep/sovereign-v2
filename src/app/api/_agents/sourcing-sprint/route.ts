/**
 * RECRUITING SOURCING SPRINT — Vertical 2 cornerstone deliverable.
 *
 * One role brief → five production-ready sourcing assets, sized for the
 * boutique tech / finance / sales recruiting agency that ships ~5–10 hires
 * a month and lives or dies on outbound talent flow.
 *
 *   1. Structured ICP profile (years, skills, motivators, signals)
 *   2. Three boolean search strings (LinkedIn, Google X-Ray, GitHub)
 *   3. Three outreach variants (LinkedIn DM ≤300 chars, cold email
 *      ≤180 words, voicemail script ≤30 seconds)
 *   4. Five specific sourcing channels with rationale + first action
 *   5. Four-objection playbook with response + escalation
 *
 * Why this deliverable:
 *   Recruiters don't need another scraped database — they have LinkedIn
 *   Recruiter, Apollo, Loxo, etc. They need *better aim*: a sharper ICP,
 *   tighter boolean strings, outreach copy that converts, and a script for
 *   the four candidate objections that kill 80% of pipelines. The sprint
 *   wraps the inference work into a single weekly artifact they hand to
 *   their sourcers.
 *
 * Architecture mirrors agency-packet/route.ts:
 *   - Single safety pipeline at the createAgentRoute boundary.
 *   - Five pure async generators called via Promise.allSettled — one
 *     failure never sinks the sprint.
 *   - Generators exported so the test suite + future cron can call them
 *     directly without going through HTTP.
 */
import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { createLogger } from "@/lib/logger";
import { z } from "zod";

const log = createLogger("sourcing-sprint");

// ─── Input schema ──────────────────────────────────────────────────────────

export const sourcingSprintSchema = z.object({
  roleTitle: z.string().min(2).max(120),
  companyName: z.string().min(2).max(80),
  companyDescription: z.string().min(20).max(2000),
  mustHaveSkills: z.array(z.string().min(1).max(60)).min(1).max(10),
  seniorityLevel: z
    .enum(["junior", "mid", "senior", "staff", "principal"])
    .default("senior"),
  locationPreferences: z.string().max(200).optional(),
  compensationRange: z.string().max(120).optional(),
  urgency: z
    .enum(["fast-hire", "perfect-fit", "passive-talent"])
    .default("perfect-fit"),
});

export type SourcingSprintInput = z.infer<typeof sourcingSprintSchema>;

// ─── Output types ──────────────────────────────────────────────────────────

export interface IcpProfile {
  archetype: string;
  yearsExperienceMin: number;
  yearsExperienceMax: number;
  mustHaveSignals: string[];
  niceToHaveSignals: string[];
  motivators: string[];
  redFlags: string[];
}

export interface BooleanSearches {
  linkedin: string;
  googleXRay: string;
  github: string;
}

export interface OutreachPack {
  linkedinDm: { body: string; charCount: number };
  coldEmail: { subject: string; body: string; wordCount: number };
  voicemail: { script: string; estimatedSeconds: number };
}

export interface SourcingChannel {
  channel: string;
  why: string;
  firstAction: string;
}

export interface ObjectionPlay {
  objection: string;
  response: string;
  escalation: string;
}

export interface SourcingSprint {
  role: { title: string; company: string };
  generatedAt: string;
  durationMs: number;
  urgency: SourcingSprintInput["urgency"];
  icp: IcpProfile | null;
  booleans: BooleanSearches | null;
  outreach: OutreachPack | null;
  channels: SourcingChannel[] | null;
  objections: ObjectionPlay[] | null;
  errors: Array<{ asset: string; message: string }>;
}

// ─── Asset generators ──────────────────────────────────────────────────────

const URGENCY_TONE: Record<SourcingSprintInput["urgency"], string> = {
  "fast-hire":
    "Speed-biased. Cast a wide net. Accept slightly lower fit if the candidate can start in 30 days.",
  "perfect-fit":
    "Quality-biased. Narrow the ICP. Long-tail signals matter more than volume.",
  "passive-talent":
    "Patience-biased. Target candidates who are happy where they are; lead with curiosity, not opportunity.",
};

function commonContextBlock(input: SourcingSprintInput): string {
  return `ROLE: ${input.roleTitle} at ${input.companyName}
COMPANY: ${input.companyDescription}
SENIORITY: ${input.seniorityLevel}
MUST-HAVE SKILLS: ${input.mustHaveSkills.join(", ")}
${input.locationPreferences ? `LOCATION: ${input.locationPreferences}` : ""}
${input.compensationRange ? `COMP: ${input.compensationRange}` : ""}
SOURCING POSTURE: ${URGENCY_TONE[input.urgency]}`;
}

export async function generateIcp(
  input: SourcingSprintInput,
): Promise<IcpProfile> {
  const system = `You are a senior technical recruiter writing a structured ICP for a sourcing team.

${commonContextBlock(input)}

Output ONLY valid JSON matching this exact shape:
{
  "archetype": "string — 2-6 word persona name (e.g. 'Series B platform engineer')",
  "yearsExperienceMin": number,
  "yearsExperienceMax": number,
  "mustHaveSignals": ["string", ...] — 4-6 specific signals (companies, projects, certifications, OSS contributions, conference talks)
  "niceToHaveSignals": ["string", ...] — 3-5 secondary signals
  "motivators": ["string", ...] — 3-5 reasons this archetype changes jobs
  "redFlags": ["string", ...] — 3-5 patterns that disqualify or signal a bad fit
}

Be specific. "Worked at a Series A-C startup" beats "startup experience." "Spoke at PyCon" beats "active in community."

Return ONLY the JSON. No prose, no fence.`;

  const raw = await ai("Produce the ICP JSON.", {
    system,
    maxTokens: 900,
    taskType: "analysis",
  });
  return parseJsonOrThrow<IcpProfile>(raw, "icp");
}

export async function generateBooleans(
  input: SourcingSprintInput,
): Promise<BooleanSearches> {
  const system = `You are a senior sourcer writing boolean strings.

${commonContextBlock(input)}

Output ONLY valid JSON:
{
  "linkedin": "string — LinkedIn Recruiter / standard search syntax. Include title variants, must-have skills with AND, exclusions with NOT. ≤300 chars.",
  "googleXRay": "string — site:linkedin.com/in/ syntax with the same constraints. ≤300 chars.",
  "github": "string — GitHub Advanced Search syntax (location: language: followers:>N). ≤300 chars."
}

Use parentheses + OR for title/skill variants. Use NOT to exclude bootcamp grads, recruiters, students. Anchor to the must-have skills.

Return ONLY the JSON. No prose, no fence.`;

  const raw = await ai("Produce the boolean JSON.", {
    system,
    maxTokens: 600,
    taskType: "analysis",
  });
  return parseJsonOrThrow<BooleanSearches>(raw, "booleans");
}

export async function generateOutreach(
  input: SourcingSprintInput,
): Promise<OutreachPack> {
  const system = `You write outbound recruiting outreach that converts.

${commonContextBlock(input)}

VOICE RULES:
- No "Hi {{first_name}} — I came across your profile and was impressed".
- No "I hope this finds you well".
- Lead with one specific signal that ties to the candidate's actual work.
- Compensation is mentioned but never as the lead.
- One ask per message.

Output ONLY valid JSON:
{
  "linkedinDm": { "body": "string — ≤300 chars total, no subject line on LinkedIn" },
  "coldEmail": { "subject": "string — 5-8 words, curiosity-driven", "body": "string — ≤180 words, 3 short paragraphs" },
  "voicemail": { "script": "string — ≤90 words, conversational, ends with one specific next step" }
}

Return ONLY the JSON. No prose, no fence.`;

  const raw = await ai(
    `Produce the outreach JSON. The signal in the LinkedIn DM should reference one of the must-have skills.`,
    {
      system,
      maxTokens: 1200,
      taskType: "creative",
    },
  );

  const parsed = parseJsonOrThrow<{
    linkedinDm: { body: string };
    coldEmail: { subject: string; body: string };
    voicemail: { script: string };
  }>(raw, "outreach");

  return {
    linkedinDm: {
      body: parsed.linkedinDm.body,
      charCount: parsed.linkedinDm.body.length,
    },
    coldEmail: {
      subject: parsed.coldEmail.subject,
      body: parsed.coldEmail.body,
      wordCount: parsed.coldEmail.body.split(/\s+/).filter(Boolean).length,
    },
    voicemail: {
      script: parsed.voicemail.script,
      // Conservative reading rate: ~3 words/second.
      estimatedSeconds: Math.round(
        parsed.voicemail.script.split(/\s+/).filter(Boolean).length / 3,
      ),
    },
  };
}

export async function generateChannels(
  input: SourcingSprintInput,
): Promise<SourcingChannel[]> {
  const system = `You are a senior sourcer naming the 5 best non-LinkedIn places to find this archetype.

${commonContextBlock(input)}

Output ONLY a valid JSON array of exactly 5 objects:
[
  { "channel": "string — name of the channel/community", "why": "string — 1 sentence on why this archetype clusters here", "firstAction": "string — the first concrete step to take this week" }
]

Examples of good channels:
- "r/ExperiencedDevs" with a specific filter
- "PyCon attendee list 2025"
- "GitHub trending for [language] this month"
- "Conference Slack — KubeCon community"
- "Specific Substack — [author]'s subscriber base"

NOT: "Twitter", "LinkedIn", "Indeed" — those are not channels, those are databases.

Return ONLY the JSON array. No prose, no fence.`;

  const raw = await ai("Name 5 channels.", {
    system,
    maxTokens: 1000,
    taskType: "analysis",
  });
  const parsed = parseJsonOrThrow<SourcingChannel[]>(raw, "channels");
  if (!Array.isArray(parsed) || parsed.length < 5) {
    throw new Error("Channels generator returned fewer than 5 entries.");
  }
  return parsed.slice(0, 5);
}

export async function generateObjections(
  input: SourcingSprintInput,
): Promise<ObjectionPlay[]> {
  const system = `You write the playbook for the four most common candidate objections.

${commonContextBlock(input)}

The four objections to cover (in this order):
1. "I'm not looking right now."
2. "Compensation isn't competitive enough."
3. "I haven't heard of ${input.companyName}."
4. "Too risky — I'd be giving up [equity / promotion / vest]."

Output ONLY a valid JSON array of exactly 4 objects:
[
  { "objection": "string — the candidate's actual words", "response": "string — recruiter's reply, 2-3 sentences", "escalation": "string — what to send / do if the candidate stays cold" }
]

Responses should be honest and specific. Don't manipulate.

Return ONLY the JSON array. No prose, no fence.`;

  const raw = await ai("Produce the playbook.", {
    system,
    maxTokens: 1200,
    taskType: "creative",
  });
  const parsed = parseJsonOrThrow<ObjectionPlay[]>(raw, "objections");
  if (!Array.isArray(parsed) || parsed.length < 4) {
    throw new Error("Objections generator returned fewer than 4 plays.");
  }
  return parsed.slice(0, 4);
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function parseJsonOrThrow<T>(raw: string, asset: string): T {
  const cleaned = raw
    .replace(/^\s*```(?:json)?\s*/u, "")
    .replace(/\s*```\s*$/u, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch (err) {
    log.warn("sourcing-sprint asset returned non-JSON", {
      asset,
      raw: cleaned.slice(0, 300),
    });
    throw new Error(
      `${asset}: model returned non-JSON (${(err as Error).message})`,
    );
  }
}

// ─── Orchestrator ──────────────────────────────────────────────────────────

export async function buildSourcingSprint(
  input: SourcingSprintInput,
): Promise<SourcingSprint> {
  const start = Date.now();

  const [icpR, boolR, outR, chR, objR] = await Promise.allSettled([
    generateIcp(input),
    generateBooleans(input),
    generateOutreach(input),
    generateChannels(input),
    generateObjections(input),
  ]);

  const errors: SourcingSprint["errors"] = [];
  const recordError = (asset: string, r: PromiseSettledResult<unknown>) => {
    if (r.status === "rejected") {
      errors.push({
        asset,
        message:
          r.reason instanceof Error ? r.reason.message : String(r.reason),
      });
    }
  };
  recordError("icp", icpR);
  recordError("booleans", boolR);
  recordError("outreach", outR);
  recordError("channels", chR);
  recordError("objections", objR);

  return {
    role: { title: input.roleTitle, company: input.companyName },
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - start,
    urgency: input.urgency,
    icp: icpR.status === "fulfilled" ? icpR.value : null,
    booleans: boolR.status === "fulfilled" ? boolR.value : null,
    outreach: outR.status === "fulfilled" ? outR.value : null,
    channels: chR.status === "fulfilled" ? chR.value : null,
    objections: objR.status === "fulfilled" ? objR.value : null,
    errors,
  };
}

// ─── Route export ──────────────────────────────────────────────────────────

export const POST = createAgentRoute({
  name: "sourcing-sprint",
  schema: sourcingSprintSchema,
  useCritic: false,
  handler: async ({ input }) => {
    const parsed = sourcingSprintSchema.parse(input);
    const sprint = await buildSourcingSprint(parsed);
    return sprint as unknown as Record<string, unknown>;
  },
});
