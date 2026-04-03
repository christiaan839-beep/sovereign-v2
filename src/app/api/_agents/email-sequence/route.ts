import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { emailSequences, sequenceSteps } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ai } from "@/lib/ai";
import { fireUserWebhook } from "@/lib/webhooks";
import { createLogger } from "@/lib/logger";
const log = createLogger("email-sequence");

const SEQUENCE_PROMPT = `You are an expert email marketing strategist who builds automated drip sequences.

When given a business context and audience, generate a complete multi-step email sequence.

## EMAIL RULES
- Subject lines: 6-10 words, curiosity-driven, NO spam trigger words
- Opening line must be personal and hook them immediately
- Each email should deliver standalone value, not just "tease" the next
- CTA per email: exactly ONE, clear, action-oriented
- Tone: professional but warm, like a trusted advisor
- Length: 150-250 words per email (short, scannable)
- NO generic phrases like "I hope this email finds you well"
- Sound like a real person, not a template

Respond in this exact JSON format:
{
  "sequenceName": "Name of the sequence",
  "steps": [
    {
      "stepNumber": 1,
      "subject": "Email subject line",
      "body": "Full email body in plain text",
      "delayDays": 0
    }
  ]
}`;

// GET: List all sequences for the user
export async function GET() {
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const sequences = await db.query.emailSequences.findMany({
      where: eq(emailSequences.userEmail, user.primaryEmailAddress.emailAddress),
      orderBy: (s, { desc }) => [desc(s.createdAt)]
    });
    return NextResponse.json({ sequences });
  } catch (err) {
    log.error("GET /api/agents/email-sequence error", err as Record<string, unknown>);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}

// POST: Generate a new email sequence with AI
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Parse body ONCE (can't read request body twice)
    const body = await req.json();
    const action = body.action || "generate"; // Default to generate for playbook compatibility

    if (action === "generate") {
      // Support both formats:
      // Old: { action: "generate", businessDescription, sequenceType, numberOfEmails, targetAudience }
      // New (playbooks): { product, audience, tone, context }
      const product = body.product || body.businessDescription || "Business";
      const audience = body.audience || body.targetAudience || "Decision-makers";
      const tone = body.tone || "Professional";
      const context = body.context || "";
      const sequenceType = body.sequenceType || "Lead Nurture";
      const numberOfEmails = body.numberOfEmails || 5;

      const prompt = `Generate a ${numberOfEmails}-email ${sequenceType} sequence.

PRODUCT/SERVICE: ${product}
TARGET AUDIENCE: ${audience}
TONE: ${tone}
NUMBER OF EMAILS: ${numberOfEmails}
${context ? `\nADDITIONAL CONTEXT (use this to personalize the emails):\n${context.slice(0, 2000)}` : ""}

Make each email specific to the product and audience. Reference real pain points. Include specific numbers and outcomes where possible.`;

      const result = await ai(prompt, { system: SEQUENCE_PROMPT, maxTokens: 4000 });

      let parsed;
      try {
        const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = { sequenceName: "Generated Sequence", steps: [], raw: result.slice(0, 500) };
      }

      // Save sequence to DB
      if (parsed.steps?.length > 0) {
        try {
          const [newSequence] = await db.insert(emailSequences).values({
            userEmail: user.primaryEmailAddress.emailAddress,
            name: parsed.sequenceName,
            trigger: "manual",
            status: "draft",
            totalSteps: String(parsed.steps.length),
          }).returning();

          for (const step of parsed.steps) {
            await db.insert(sequenceSteps).values({
              sequenceId: newSequence.id,
              stepNumber: String(step.stepNumber),
              subject: step.subject,
              body: step.body,
              delayDays: String(step.delayDays || 0),
            });
          }

          await fireUserWebhook("EmailSequences", "SequenceCreated", {
            name: parsed.sequenceName,
            steps: parsed.steps.length,
          });

          return NextResponse.json({ success: true, sequence: newSequence, ...parsed });
        } catch (dbErr) {
          log.warn("DB save failed, returning generated sequence without persistence", { error: String(dbErr) });
          return NextResponse.json({ success: true, ...parsed });
        }
      }

      return NextResponse.json({ success: true, ...parsed });
    }

    // Get steps for a specific sequence
    if (action === "getSteps") {
      const sequenceId = body.sequenceId;
      if (!sequenceId) return NextResponse.json({ error: "sequenceId required" }, { status: 400 });

      const steps = await db.query.sequenceSteps.findMany({
        where: eq(sequenceSteps.sequenceId, sequenceId),
      });
      return NextResponse.json({ steps });
    }

    return NextResponse.json({ error: "Invalid action. Use 'generate' or 'getSteps'." }, { status: 400 });
  } catch (err) {
    log.error("POST /api/agents/email-sequence error", err as Record<string, unknown>);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
