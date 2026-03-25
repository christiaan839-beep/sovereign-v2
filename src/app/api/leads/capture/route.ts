import { NextResponse } from "next/server";
import { z } from "zod";
import twilio from "twilio";
import { persistAppend } from "@/lib/persist";

// Default Serverless Node.js Runtime (Required for Twilio SDK execution)

// Zod Schema physically guarantees malformed Python data cannot crash the Postgres DB
const leadSchema = z.object({
  name: z.string().min(2),
  phone: z.string(),
  planId: z.string().optional(),
  title: z.string().optional(),
  company: z.string().optional(),
  email: z.string().email().optional(),
  linkedin: z.string().optional()
});

export async function POST(req: Request) {
  try {
    // Node Authentication intentionally bypassed for public Client-Side initiation from Pricing component.

    const rawData = await req.json();
    
    // Parse automatically throws if the Python script sends garbage data
    const lead = leadSchema.parse(rawData);
    
    // Example Production execution:
    // 1. await db.insert(leads).values(lead);
    // 2. await resend.emails.send({ to: lead.email, subject: "Hyper-personalized line generated via Nemotron" });
    
    persistAppend("leads", { email: lead.email, company: lead.company, timestamp: new Date().toISOString() }, 500);

    // ⚡ THE KILOCLAW SENTINEL DIALER LOGIC
    // If the lead provided a phone number, physically call them in 3 seconds.
    if (lead.phone && process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
       const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
       const myTwilioNumber = process.env.TWILIO_PHONE_NUMBER || "+15550000000";
       
       try {
         await client.calls.create({
           url: `https://sovereignmatrix.agency/api/webhooks/twilio/voice?name=${encodeURIComponent(lead.name)}`,
           to: lead.phone,
           from: myTwilioNumber,
         });
          persistAppend("sentinel-calls", { phone: lead.phone, timestamp: new Date().toISOString() }, 200);
        } catch {
          // Twilio dial failure — non-blocking
        }
    }

    return NextResponse.json({ success: true, processed: lead.email }, { status: 200 });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "MALFORMED_LEAD_DATA", details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "EDGE_MATRIX_FAILURE" }, { status: 500 });
  }
}
