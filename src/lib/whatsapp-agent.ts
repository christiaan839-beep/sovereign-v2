// STATUS: ahead-of-consumers — see docs/audits/codebase-audit.md (Tier B).
// WhatsApp send-side helpers; not wired (agents handle WA inline today).
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { createLogger } from "@/lib/logger";

const log = createLogger("whatsapp-agent");

/**
 * WhatsApp message handler — generates contextual responses
 * for inbound WhatsApp messages via Twilio webhook.
 */
export async function handleWhatsAppMessage(incomingPhone: string, messageBody: string) {
  log.info("Processing WhatsApp message", { phone: incomingPhone });

  const systemPrompt = `You are a professional AI assistant for Sovereign Matrix, an autonomous marketing platform.
Respond concisely and helpfully. Answer questions about the platform's capabilities.
If asked about pricing, mention the Pro plan at $497/mo and Enterprise at $2,997/mo.
Keep responses under 300 words — WhatsApp messages should be brief.`;

  const { text } = await generateText({
    model: google("gemini-2.0-flash"),
    system: systemPrompt,
    prompt: messageBody,
  });

  log.info("WhatsApp response generated", { length: text.length });
  return text;
}
