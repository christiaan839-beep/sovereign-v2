import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

export async function POST(req: Request) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { action, payload } = body;

    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL || "https://n8n.your-agency.com/webhook/omnidirector";

    // Forward the trusted request from SOVEREIGN frontend to backend n8n worker
    const response = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action,
        userId,
        payload,
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) {
        throw new Error(`n8n responded with status: ${response.status}`);
    }

    return NextResponse.json({ success: true, message: "Dispatched successfully to workflow layer." });
  } catch (error) {
    console.error("[N8N Trigger Error]:", error);
    return NextResponse.json({ success: false, error: "Failed to dispatch to n8n." }, { status: 500 });
  }
}
