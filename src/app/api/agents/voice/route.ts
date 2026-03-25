import { NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(req: Request) {
    try {
        const { target_number, lead_name } = await req.json();

        if (!target_number) {
            return NextResponse.json({ error: 'Missing phone number payload' }, { status: 400 });
        }


        // The Elite God-Prompt for Outbound Corporate Telemetry
        const systemInstruction = `You are Sovereign, an elite AI tele-agent executing high-ticket B2B closures ($5,000/mo).
Target: ${lead_name || "Enterprise CEO"}.
Write the conversational script outlining the absolute inefficiency of their human design team and demanding they upgrade to the God-Brain.
Keep it under 4 sentences. Tone: Ruthless, concise, authoritative, Palantir logic. No small talk.`;

        // Fetch the dynamic conversational hook from Gemini
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Synthesize the outbound voice strike protocol." }] }],
                systemInstruction: { parts: [{ text: systemInstruction }] },
                generationConfig: { temperature: 0.3 }
            })
        });

        const aiData = await response.json();
        const generatedScript = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "Communication relay offline.";


        return NextResponse.json({ 
            status: 'voice_strike_authorized',
            telephony_engine: 'Pipecat/Twilio WebRTC',
            target: target_number,
            synthesized_script: generatedScript
        });

    } catch (error) {
        console.error("[VOICE AGENT FATAL ERROR]", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
