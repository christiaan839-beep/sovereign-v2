import { NextResponse } from 'next/server';
import { createLogger } from "@/lib/logger";
const log = createLogger("tiktok-autopilot");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: Request) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${CRON_SECRET}` && process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized TikTok Fleet Request' }, { status: 401 });
    }

    try {
        const systemInstruction = `You are Sovereign, an elite Faceless TikTok/Reels architect.
Write a 15-second hyper-aggressive, contrarian video script explaining exactly how traditional digital marketing agencies and human SDRs are extinct because of Autonomous AI Swarms.
Tone: Palantir, cold, elite, matrix software aesthetic. No hype. Only authority.
Format: Return exactly a JSON object containing { "hook_text": "...", "voiceover_script": "...", "veo3_background_prompt": "..." } without any markdown.`;

        if (!GEMINI_API_KEY) {
            return NextResponse.json({ error: "AI Engine Offline" }, { status: 500 });
        }

        // Utilize massive reasoning layer to orchestrate short-form video content
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Synthesize the TikTok script for today's God-Brain agency replacement pitch." }] }],
                systemInstruction: { parts: [{ text: systemInstruction }] },
                generationConfig: { temperature: 0.5 }
            })
        });

        const aiData = await response.json();
        let rawContent = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        rawContent = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();

        let scriptObject: Record<string, unknown> = {};
        try {
            scriptObject = JSON.parse(rawContent);
        } catch (_e) {
            log.error("Gemini JSON parse failed", { rawContent });
            return NextResponse.json({ error: "Failed to parse synthesized script" }, { status: 500 });
        }

        return NextResponse.json({
            status: "tiktok_payload_queued",
            script: scriptObject
        });

    } catch (err) {
        log.error("TikTok cron error", err as Record<string, unknown>);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
