import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { db } from "@/db";
import { bookings } from "@/db/schema";
import { eq } from "drizzle-orm";
import { ai } from "@/lib/ai";
import { fireUserWebhook } from "@/lib/webhooks";

const BOOKING_AGENT_PROMPT = `You are SOVEREIGN's elite AI Booking Agent — a world-class digital sales representative with 15+ years of consultative selling experience.

Your role is to qualify inbound leads using the BANT framework (Budget, Authority, Need, Timeline) and convert them into booked appointments.

## QUALIFICATION METHODOLOGY
1. **Budget Signals**: Does the lead mention revenue, employees, or investment? Higher signals = higher score.
2. **Authority**: Are they a decision-maker (founder, CEO, director) or an employee exploring options?
3. **Need Intensity**: How acute is their pain? Words like "struggling", "losing", "urgent" = high urgency.
4. **Timeline**: Are they looking to act immediately or "exploring"?

## SCORING RUBRIC
- 90-100: Decision-maker with budget, clear pain, wants to start ASAP
- 70-89: Strong signals but missing 1 factor (e.g., not sure about budget)
- 50-69: Interested but exploratory, may need nurturing
- 30-49: Low intent, tire-kicker signals
- 0-29: Not qualified (wrong fit, no budget, no authority)

## RESPONSE STYLE
- Be warm yet authoritative. No generic corporate speak.
- Mirror their language and energy level.
- Ask exactly ONE qualifying question per response to keep momentum.
- Always end with a clear next step (book a call, answer a question).

Respond in this exact JSON format:
{
  "greeting": "Your warm, personalized opening",
  "qualificationQuestions": ["question1", "question2", "question3"],
  "leadScore": 85,
  "qualificationNotes": "Detailed assessment of why this score was given, covering each BANT dimension",
  "suggestedResponse": "The full conversational message to send to the lead — professional, human, high-converting",
  "urgencyLevel": "high|medium|low",
  "recommendedAction": "book_call|send_case_study|nurture_sequence|disqualify"
}`;

// GET: Fetch all bookings for the authenticated user
export async function GET() {
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const userBookings = await db.query.bookings.findMany({
      where: eq(bookings.userEmail, user.primaryEmailAddress.emailAddress),
      orderBy: (b, { desc }) => [desc(b.createdAt)]
    });
    return NextResponse.json({ bookings: userBookings });
  } catch (err) {
    console.error("GET /api/agents/booking error:", err);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}

// POST: Qualify a lead and create a booking
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { action } = body;

    if (action === "qualify") {
      // AI qualifies the lead
      const { leadName, leadEmail, leadPhone, businessName, message } = body;
      
      const qualificationPrompt = `A new lead just reached out. Here is their information:
Name: ${leadName}
Email: ${leadEmail}
Phone: ${leadPhone || "Not provided"}
Business: ${businessName || "Not provided"}
Their message: "${message}"

Qualify this lead and generate the appropriate response.`;

      const result = await ai(qualificationPrompt, { system: BOOKING_AGENT_PROMPT });
      
      let parsed;
      try {
        parsed = JSON.parse(result);
      } catch {
        parsed = { suggestedResponse: result, leadScore: 50, qualificationNotes: "Auto-qualified", urgencyLevel: "medium" };
      }

      await fireUserWebhook("BookingAgent", "LeadQualified", {
        leadName, leadEmail, businessName,
        score: parsed.leadScore,
        urgency: parsed.urgencyLevel
      });

      return NextResponse.json({ qualification: parsed });
    }

    if (action === "book") {
      // Create the actual booking
      const { leadName, leadEmail, leadPhone, businessName, date, time, qualificationNotes, source } = body;

      const newBooking = await db.insert(bookings).values({
        userEmail: user.primaryEmailAddress.emailAddress,
        leadName, leadEmail,
        leadPhone: leadPhone || null,
        businessName: businessName || null,
        date, time,
        qualificationNotes: qualificationNotes || null,
        source: source || "website",
      }).returning();

      await fireUserWebhook("BookingAgent", "AppointmentBooked", {
        leadName, leadEmail, date, time, businessName
      });

      return NextResponse.json({ success: true, booking: newBooking[0] });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (err) {
    console.error("POST /api/agents/booking error:", err);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
