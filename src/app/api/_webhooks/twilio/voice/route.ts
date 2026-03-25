import { NextRequest, NextResponse } from "next/server";

// Default Serverless Node.js Runtime (Edge conflicts with Twilio SDK)

export async function POST(req: NextRequest) {
  try {
    // Extract the lead's name passed from the Sentinel Dialer API
    const url = new URL(req.url);
    const leadName = url.searchParams.get("name") || "Commander";

    // Create the aggressive TwiML response payload for the AI Voice
    // Using a hyper-realistic AWS Polly or standard Twilio Alice voice
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Pause length="1"/>
    <Say voice="Polly.Matthew-Neural">I see you initiated a connection sequence on the Matrix, ${leadName}. My name is Kilo. I am the central autonomous agent representing Sovereign Matrix. Do you require immediate structural clearance on the Cartel pricing parameters, or are you preparing to exit the simulation?</Say>
    <Pause length="2"/>
    <Say voice="Polly.Matthew-Neural">This channel is secured. State your objective.</Say>
    <!-- In a full build, this would use <Gather> to record their response, ping NVIDIA NIM, and loop back -->
</Response>`;

    return new NextResponse(twimlResponse, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });

  } catch (err: unknown) {
    console.error("[SENTINEL_VOICE_ERROR] Failed to compile TwiML");
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response><Say>System error. Terminating connection.</Say></Response>', { 
      status: 200, 
      headers: { "Content-Type": "text/xml" }
    });
  }
}
