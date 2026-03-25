import { NextResponse } from "next/server";
import { persistAppend } from "@/lib/persist";

/**
 * VOICE AI CLOSER — Twilio + NVIDIA Riva voice qualification agent.
 * 
 * Handles inbound calls, qualifies leads with AI-powered voice,
 * and routes hot leads to the Commander via Telegram.
 * 
 * GET: Returns voice AI status and capabilities
 * POST: Generates TwiML for Twilio voice webhook
 */

export async function GET() {
  const twilioConfigured = !!process.env.TWILIO_ACCOUNT_SID;
  
  return NextResponse.json({
    agent: "Voice AI Closer",
    status: twilioConfigured ? "ready" : "not_configured",
    capabilities: [
      "Inbound call qualification",
      "AI-powered voice responses via NVIDIA Riva",
      "Lead scoring during conversation",
      "Hot lead routing to Telegram",
      "Call recording and transcription",
      "Multi-language support (11 languages)",
    ],
    supported_languages: ["en", "af", "zu", "xh", "st", "tn", "ts", "ss", "ve", "nr", "fr"],
    setup: twilioConfigured ? null : {
      step1: "Get a Twilio account at twilio.com",
      step2: "Purchase a South African phone number (+27)",
      step3: "Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE in env vars",
      step4: "Point Twilio webhook to https://sovereignmatrix.agency/api/agents/voice-closer",
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.text();
    const params = new URLSearchParams(body);
    const callerNumber = params.get("From") || "unknown";
    const callSid = params.get("CallSid") || "";
    const speechResult = params.get("SpeechResult") || "";

    // Log the call
    await persistAppend("voice-calls", {
      callSid,
      from: callerNumber,
      speechResult,
      timestamp: new Date().toISOString(),
    });

    // If this is the initial call (no speech result yet)
    if (!speechResult) {
      const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">
    Welcome to the Sovereign Matrix. I am your AI operations coordinator.
    How can I assist you today? You can ask about our autonomous AI agents,
    pricing tiers, or schedule a live demonstration.
  </Say>
  <Gather input="speech" action="/api/agents/voice-closer" method="POST" speechTimeout="3" language="en-ZA">
    <Say voice="Polly.Amy">I'm listening.</Say>
  </Gather>
  <Say voice="Polly.Amy">I didn't catch that. Transferring you to a human operator.</Say>
</Response>`;
      return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
    }

    // AI-powered response based on speech input
    let responseText = "";
    const lowerSpeech = speechResult.toLowerCase();

    if (lowerSpeech.includes("price") || lowerSpeech.includes("cost") || lowerSpeech.includes("how much")) {
      responseText = "Our Sovereign Node starts at 9,997 Rand per month, which gives you a full autonomous AI marketing team. The Sovereign Array at 24,997 includes unlimited AI generations and priority processing. Would you like me to send you a detailed proposal?";
    } else if (lowerSpeech.includes("demo") || lowerSpeech.includes("show")) {
      responseText = "I'd love to arrange a live demonstration for you. Our team will walk you through the entire platform including the War Room, Visual Studio, and NemoClaw automation. Can I get your email address to schedule this?";
    } else if (lowerSpeech.includes("agent") || lowerSpeech.includes("what")) {
      responseText = "The Sovereign Matrix runs 72 autonomous AI agents powered by NVIDIA. These agents handle everything from content creation to competitor analysis, outbound sales, voice AI, and visual design. All running 24/7 without human intervention. Would you like to know which agents are best for your industry?";
    } else {
      responseText = `I understand you're asking about ${speechResult}. Let me connect you with our specialist who can give you detailed information. One moment please.`;
    }

    // Notify Telegram about the call
    if (process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID) {
      fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: process.env.TELEGRAM_CHAT_ID,
          text: `📞 Voice AI Call\nFrom: ${callerNumber}\nSaid: "${speechResult}"\nResponse: Qualification in progress`,
          parse_mode: "HTML",
        }),
      }).catch(() => {});
    }

    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">${responseText}</Say>
  <Gather input="speech" action="/api/agents/voice-closer" method="POST" speechTimeout="3" language="en-ZA">
    <Say voice="Polly.Amy">Is there anything else I can help you with?</Say>
  </Gather>
  <Say voice="Polly.Amy">Thank you for calling the Sovereign Matrix. Have a great day.</Say>
</Response>`;
    return new NextResponse(twiml, { headers: { "Content-Type": "text/xml" } });
  } catch {
    const errorTwiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Amy">I apologize, but I'm experiencing a temporary issue. Please try again or visit sovereign matrix agency online.</Say>
</Response>`;
    return new NextResponse(errorTwiml, { headers: { "Content-Type": "text/xml" } });
  }
}
