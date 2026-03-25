import { NextResponse } from 'next/server';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

export async function POST(req: Request) {
  try {
    const data = await req.json();
    
    const { topic, duration = "60s", targetAudience = "B2B Executives" } = data;

    if (!topic) {
        return NextResponse.json({ error: 'Missing film topic parameter' }, { status: 400 });
    }


    // The Anti-Slop God-Prompt for Video Generation
    const systemInstruction = `You are Nova, the Sovereign Filmmaker Agent utilizing Google AI Ultra (Veo 3.1, Imagen, and Music Gen).
Your objective is to generate an elite, hyper-cinematic production brief and prompt sequence for a video about "${topic}".

CRITICAL ANTI-SLOP GUARDRAILS:
1. NO generic neon cyberpunk grids.
2. NO happy corporate stock music. Use "Stoic Contemplation" or "Ambient Focus" descriptions.
3. NO 120fps ultra-smooth motion. Specify 24fps cinematic shutter angles with film grain.
4. NO enthusiastic AI chatbot language. Tone must be authoritative, Palantir-esque, defense-grade.

Output a highly structured JSON array of 5 exact visual prompts to be fed into Veo 3.1, along with a voiceover script and a specific Music Gen prompt.`;
    
    if (!GEMINI_API_KEY) {
        return NextResponse.json({ error: "GEMINI_API_KEY missing" }, { status: 500 });
    }

    // Google Gemini 1.5 Pro via REST API for maximum orchestration reasoning
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            contents: [{ parts: [{ text: `Generate the Veo 3.1 prompt sequence for: ${topic}. Target Audience: ${targetAudience}. Duration: ${duration}.` }] }],
            systemInstruction: { parts: [{ text: systemInstruction }] },
            generationConfig: {
                temperature: 0.2, // Clinical precision
                responseMimeType: "application/json",
            }
        })
    });

    if (!response.ok) {
        throw new Error(`Google AI API Error: ${response.statusText}`);
    }

    const aiData = await response.json();
    const productionBrief = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

    // In a live environment, this brief would trigger Google Flow / Whisk Animate APIs
    // await GoogleVeoAPI.submitJob(JSON.parse(productionBrief));

    return NextResponse.json({ 
        status: 'production_scheduled', 
        pipeline: 'Google Flow (Veo 3.1 + Imagen)',
        orchestration_brief: JSON.parse(productionBrief)
    });

  } catch (error) {
    console.error("[FILMMAKER FATAL ERROR]", error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
