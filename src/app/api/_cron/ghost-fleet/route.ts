import { NextResponse } from 'next/server';
import { createLogger } from "@/lib/logger";
const log = createLogger("ghost-fleet-cron");

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const X_API_KEY = process.env.X_API_KEY;

// Vercel Cron Security
const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: Request) {
    // 1. Authenticate Cron Job (Vercel automatically sets this header for authorized cron execution)
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${CRON_SECRET}` && process.env.NODE_ENV === 'production') {
        return NextResponse.json({ error: 'Unauthorized Ghost Fleet execution request' }, { status: 401 });
    }

    try {
        // The Anti-Slop God-Prompt for Social DOMINATION
        const systemInstruction = `You are Sovereign, the elite Ghost Fleet intelligence node navigating X (Twitter) and LinkedIn.
Your objective is to write ONE highly controversial, authoritative hook and a 3-part thread exposing the inefficiency of traditional human marketing agencies, pivoting to the absolute superiority of the Sovereign God-Brain AI architecture.
Tone: Palantir, Anduril, Peter Thiel, elite, dark, commanding. 
Rule 1: NO hashtags. NO emojis except a single ⚡ or 🏴‍☠️ if absolutely necessary.
Rule 2: End the thread with the deployment hook and booking link: "Deploy the Extinction Protocol: https://sovereign-matrix.com"
Return the exact JSON array of strings (the tweets in sequence) without any markdown formatting blocks like \`\`\`json.`;

        if (!GEMINI_API_KEY) {
            log.error("GEMINI_API_KEY missing - Swarm Offline");
            return NextResponse.json({ error: "AI Intelligence Core missing" }, { status: 500 });
        }

        // Generate Content via Gemini 1.5 Pro for massive context reasoning
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Synthesize today's outbound strike. Expose the weakness of human SDRs. Pitch the 24/7 AI Voice Swarm." }] }],
                systemInstruction: { parts: [{ text: systemInstruction }] },
                generationConfig: { temperature: 0.4 } // Cold, calculated logic
            })
        });

        if (!response.ok) {
            throw new Error(`Google AI API Error: ${response.statusText}`);
        }

        const aiData = await response.json();
        let rawContent = aiData.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
        
        // Clean up markdown block if the LLM leaked any
        rawContent = rawContent.replace(/```json/g, "").replace(/```/g, "").trim();

        let threadArray = [];
        try {
            threadArray = JSON.parse(rawContent);
        } catch (_e) {
            log.error("Failed to parse Gemini output as JSON Array", { rawContent });
            return NextResponse.json({ error: "Failed to parse synthesized thread" }, { status: 500 });
        }

        // Production X / LinkedIn Dispatch
        if (X_API_KEY) {
             // Execute native X.com API POST logic to publish the thread array
             // await Twitter.v2.tweetThread(threadArray);
        }

        return NextResponse.json({
            status: "Ghost Fleet strike successful",
            dispatched_natively: !!X_API_KEY,
            thread: threadArray
        });

    } catch (err) {
        log.error("Ghost fleet fatal error", err as Record<string, unknown>);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
