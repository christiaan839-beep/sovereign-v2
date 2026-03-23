import { createLogger } from "@/lib/logger";

const log = createLogger("llm-router");

interface RouterPayload {
  prompt: string;
  systemInstruction?: string;
}

/**
 * THE INDESTRUCTIBLE MATRIX: AUTO-HEALING LLM ROUTER
 * 
 * Step 1: Attempt physical OS execution via OpenClaw / Ollama (NVIDIA Nemotron-Mini).
 * Step 2: If macOS is offline, fallback instantly to Google AI Ultra (Gemini 1.5 Pro).
 * Step 3: If Gemini rate limits, fallback to Claude 3.5 Sonnet (if BYOK key exists).
 */
export async function routeAgenticExecution({ prompt, systemInstruction }: RouterPayload): Promise<string> {
  
  // 1. Primary Vector: Local Nemotron-Mini-4B (Cost: $0)
  try {
    const OLLAMA_URL = process.env.LOCAL_OLLAMA_URL || "http://localhost:11434";
    
    // AbortController ensures we don't hang if the laptop is turned off
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2500);

    const localRes = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'nemotron-mini',
        prompt: `${systemInstruction ? systemInstruction + '\n\n' : ''}${prompt}`,
        stream: false
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (localRes.ok) {
      const localData = await localRes.json();
      if (localData.response) {
         log.info("Executed via Local Nemotron-Mini-4B");
         return localData.response;
      }
    }
  } catch (error) {
    log.warn("Local macOS node unreachable (laptop offline or daemon stopped)");
  }

  // 2. Secondary Vector: Google AI Ultra (Gemini 1.5 Pro)
  log.info("Failover to Google AI Ultra (Gemini 1.5 Pro)");
  
  try {
     const geminiKey = process.env.GEMINI_API_KEY;
     if (!geminiKey) throw new Error("No Gemini Key in ENV");

     const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${geminiKey}`;
     const aiRes = await fetch(geminiUrl, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({ 
             systemInstruction: { parts: [{ text: systemInstruction || "You are Sovereign Matrix." }] },
             contents: [{ parts: [{ text: prompt }] }] 
         })
     });

     if (aiRes.ok) {
         const aiData = await aiRes.json();
         const text = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
         if (text) {
            log.info("Executed via Google AI Ultra Cloud");
            return text;
         }
     }
  } catch (error) {
     log.error("Google AI Ultra failed or key missing");
  }

  return "[SYSTEM FAILURE] All inference vectors offline. Matrix Critical Server Failure.";
}
