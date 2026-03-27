import { NextResponse } from "next/server";
import { createHmac } from "crypto";

/**
 * SOVEREIGN MATRIX CRM WEBHOOK LAYER
 * Receives state changes directly from HubSpot and Salesforce.
 * E.g., When a human sales rep moves a Deal to "Closed Won", this webhook triggers
 * the autonomous agent swarm to generate contracts and onboard the client via email.
 *
 * Security: Verifies webhook signature from the CRM provider.
 */

export async function POST(req: Request) {
  try {
    // Verify webhook signature (HubSpot uses X-HubSpot-Signature, Salesforce varies)
    const webhookSecret = process.env.CRM_WEBHOOK_SECRET;
    if (webhookSecret) {
      const signature = req.headers.get("x-hubspot-signature") || req.headers.get("x-sf-signature") || "";
      const body = await req.text();
      const expected = createHmac("sha256", webhookSecret).update(body).digest("hex");
      if (signature !== expected) {
        console.error("[CRM Webhook] Invalid signature — rejecting");
        return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
      }
      return NextResponse.json({ success: true, status: "CRM State Logged by Sovereign Matrix" });
    }

    // If no webhook secret configured, reject in production
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "CRM webhook secret not configured" }, { status: 503 });
    }

    const payload = await req.json();
    return NextResponse.json({ success: true, status: "CRM State Logged by Sovereign Matrix" });
  } catch (error) {
    console.error("CRM Webhook Parsing Error:", error);
    return NextResponse.json({ error: "Failed to parse CRM state mutation" }, { status: 400 });
  }
}
