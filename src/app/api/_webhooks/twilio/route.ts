import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";

const log = createLogger("twilio-webhook");

// Node.js runtime required for crypto.createHmac
// export const runtime = "edge";

/**
 * Twilio WhatsApp Webhook — validates HMAC-SHA1 signature
 * and routes inbound messages to the WhatsApp agent.
 *
 * SECURITY:
 * - Signature is enforced in ALL environments (not just production).
 * - Missing TWILIO_AUTH_TOKEN = 503 (fail secure, don't silently accept).
 * - timingSafeEqual requires equal-length buffers; length check first.
 * - AI response is XML-escaped before interpolation into TwiML
 *   (prevents TwiML injection → toll fraud / SMS spam / Redirect attacks).
 */

const limiter = rateLimit({ interval: 60, limit: 30 });

const EMPTY_TWIML =
  '<?xml version="1.0" encoding="UTF-8"?><Response></Response>';
const XML_HEADERS = { "Content-Type": "text/xml" };

/** XML-escape a string before interpolating into TwiML. */
function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function validateTwilioSignature(
  signature: string | null,
  url: string,
  params: Record<string, string>,
): boolean {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token || !signature) return false; // Fail secure

  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + params[key];
  }

  const expectedSignature = crypto
    .createHmac("sha1", token)
    .update(data)
    .digest("base64");

  // timingSafeEqual throws on mismatched lengths — length check first.
  const a = Buffer.from(signature);
  const b = Buffer.from(expectedSignature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  const limited = await limiter.check(request);
  if (limited) return limited;

  // Fail-secure: require TWILIO_AUTH_TOKEN in all environments.
  if (!process.env.TWILIO_AUTH_TOKEN) {
    log.error("TWILIO_AUTH_TOKEN not configured — rejecting webhook");
    return new NextResponse(EMPTY_TWIML, { status: 503, headers: XML_HEADERS });
  }

  try {
    // Parse real Twilio form-encoded body
    const formData = await request.formData();
    const incomingText = formData.get("Body")?.toString() || "";
    const fromRaw = formData.get("From")?.toString() || "unknown";
    // Sanitize From to E.164-safe characters to mitigate prompt injection.
    const from = fromRaw.replace(/[^+0-9a-zA-Z:_-]/g, "").slice(0, 32);

    // ENFORCE signature validation in ALL environments.
    const signature = request.headers.get("x-twilio-signature");
    const url = request.url;
    const params: Record<string, string> = {};
    formData.forEach((v, k) => {
      params[k] = v.toString();
    });
    if (!validateTwilioSignature(signature, url, params)) {
      log.error("Invalid Twilio signature", { from });
      return new NextResponse(EMPTY_TWIML, {
        status: 403,
        headers: XML_HEADERS,
      });
    }

    if (!incomingText) {
      return new NextResponse(EMPTY_TWIML, {
        status: 200,
        headers: XML_HEADERS,
      });
    }

    // NVIDIA Nemotron 3 Super via NIM (upgraded from 340B)
    const nimResponse = await fetch(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.NVIDIA_NIM_API_KEY}`,
        },
        body: JSON.stringify({
          model: "nvidia/nemotron-3-super-120b-a12b",
          messages: [
            {
              role: "system",
              content:
                "You are a professional AI assistant for Sovereign Matrix. Help the user with their inquiry clearly and concisely. If they ask about pricing, direct them to https://sovereignmatrix.agency/pricing",
            },
            { role: "user", content: `[From: ${from}] ${incomingText}` },
          ],
          max_tokens: 250,
        }),
      },
    );
    const data = await nimResponse.json();
    const aiResponse =
      data?.choices?.[0]?.message?.content ||
      "System is processing your request. Please try again shortly.";

    // XML-escape before interpolation — prevents TwiML injection.
    const safeResponse = xmlEscape(aiResponse);

    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message><Body>${safeResponse}</Body></Message>
</Response>`;

    return new NextResponse(twimlResponse, {
      status: 200,
      headers: XML_HEADERS,
    });
  } catch (error) {
    log.error("Twilio webhook handler error", {
      error: (error as Error).message,
    });
    return new NextResponse(EMPTY_TWIML, {
      status: 500,
      headers: XML_HEADERS,
    });
  }
}
