import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// Node.js runtime required for crypto.createHmac
// export const runtime = "edge";

/**
 * Twilio WhatsApp Webhook — validates HMAC-SHA1 signature
 * and routes inbound messages to the WhatsApp agent.
 */
export function validateTwilioSignature(signature: string | null, url: string, params: Record<string, string>) {
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!token || !signature) return false; // Fail secure
  
  const sortedKeys = Object.keys(params).sort();
  let data = url;
  for (const key of sortedKeys) {
    data += key + params[key];
  }
  
  const expectedSignature = crypto.createHmac("sha1", token).update(data).digest("base64");
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

export async function POST(request: NextRequest) {
  try {
    // Parse real Twilio form-encoded body
    const formData = await request.formData();
    const incomingText = formData.get("Body")?.toString() || "";
    const from = formData.get("From")?.toString() || "unknown";

    // ENFORCE signature validation in production
    if (process.env.NODE_ENV === "production" && process.env.TWILIO_AUTH_TOKEN) {
      const signature = request.headers.get("x-twilio-signature");
      const url = request.url;
      const params: Record<string, string> = {};
      formData.forEach((v, k) => { params[k] = v.toString(); });
      if (!validateTwilioSignature(signature, url, params)) {
        return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { 
          status: 403, headers: { "Content-Type": "text/xml" }
        });
      }
    }

    if (!incomingText) {
      return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { 
        status: 200, headers: { "Content-Type": "text/xml" }
      });
    }
    
    // NVIDIA Nemotron 3 Super via NIM (upgraded from 340B)
    const nimResponse = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.NVIDIA_NIM_API_KEY}`,
      },
      body: JSON.stringify({
        model: "nvidia/nemotron-3-super-120b-a12b",
        messages: [
          { role: "system", content: "You are a professional AI assistant for Sovereign Matrix. Help the user with their inquiry clearly and concisely. If they ask about pricing, direct them to https://sovereignmatrix.agency/pricing" },
          { role: "user", content: `[From: ${from}] ${incomingText}` }
        ],
        max_tokens: 250,
      })
    });
    const data = await nimResponse.json();
    const aiResponse = data?.choices?.[0]?.message?.content || "System is processing your request. Please try again shortly.";
    
    const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
    <Message><Body>${aiResponse}</Body></Message>
</Response>`;

    return new NextResponse(twimlResponse, {
      status: 200,
      headers: { "Content-Type": "text/xml" },
    });

  } catch {
    return new NextResponse('<?xml version="1.0" encoding="UTF-8"?><Response></Response>', { 
      status: 200, 
      headers: { "Content-Type": "text/xml" }
    });
  }
}
