import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { emailSequences, sequenceSteps } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ai } from "@/lib/ai";
import { fireUserWebhook } from "@/lib/webhooks";

const SEQUENCE_PROMPT = `You are an elite email marketing strategist who builds automated drip sequences that agencies charge $3,000-$5,000 to create.

When given a business context and sequence type, generate a complete multi-step email sequence.

## SEQUENCE TYPES
1. **Welcome / Onboarding**: Warm welcome → Value delivery → Social proof → Soft upsell
2. **Lead Nurture**: Education → Trust building → Case study → Offer
3. **Post-Purchase Upsell**: Thank you → Quick win → Advanced tip → Premium offer
4. **Re-Engagement**: "We miss you" → New feature/value → Limited offer → Last chance
5. **Sales / Launch**: Announcement → Benefits → Social proof → Urgency → Last call

## EMAIL RULES
- Subject lines: 6-10 words, curiosity-driven, NO spam trigger words
- Opening line must be personal and hook them immediately
- Each email should deliver standalone value, not just "tease" the next
- CTA per email: exactly ONE, clear, action-oriented
- Tone: professional but warm, like a trusted advisor
- Length: 150-250 words per email (short, scannable)

Respond in this exact JSON format:
{
  "sequenceName": "Name of the sequence",
  "steps": [
    {
      "stepNumber": 1,
      "subject": "Email subject line",
      "body": "Full email body in plain text with paragraphs separated by double newlines",
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
    console.error("GET /api/agents/email-sequence error:", err);
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
    const { action } = await req.json();

    if (action === "generate") {
      const { businessDescription, sequenceType, numberOfEmails, targetAudience } = await req.json().catch(() => ({}));

      const prompt = `Generate a ${numberOfEmails || 5}-email ${sequenceType || "lead nurture"} sequence for this business:

BUSINESS: ${businessDescription || "Premium coaching/consulting business"}
TARGET AUDIENCE: ${targetAudience || "Professional decision-makers"}
SEQUENCE TYPE: ${sequenceType || "Lead Nurture"}
NUMBER OF EMAILS: ${numberOfEmails || 5}`;

      const result = await ai(prompt, { system: SEQUENCE_PROMPT, maxTokens: 4000 });

      let parsed;
      try {
        const cleaned = result.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
        parsed = JSON.parse(cleaned);
      } catch {
        parsed = { sequenceName: "Generated Sequence", steps: [] };
      }

      // Save sequence to DB
      if (parsed.steps?.length > 0) {
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
          type: sequenceType || "lead_nurture"
        });

        return NextResponse.json({ success: true, sequence: newSequence, ...parsed });
      }

      return NextResponse.json({ success: true, ...parsed });
    }

    // Get steps for a specific sequence
    if (action === "getSteps") {
      const { sequenceId } = await req.json().catch(() => ({}));
      if (!sequenceId) return NextResponse.json({ error: "sequenceId required" }, { status: 400 });

      const steps = await db.query.sequenceSteps.findMany({
        where: eq(sequenceSteps.sequenceId, sequenceId),
      });
      return NextResponse.json({ steps });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("POST /api/agents/email-sequence error:", err);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
