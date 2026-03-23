import { NextResponse } from "next/server";

/**
 * SOVEREIGN MATRIX CRM WEBHOOK LAYER
 * Receives state changes directly from HubSpot and Salesforce.
 * E.g., When a human sales rep moves a Deal to "Closed Won", this webhook triggers
 * the autonomous agent swarm to generate contracts and onboard the client via email.
 */

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    
    // In HubSpot, payload is an array of event objects
    console.log("[CRM WEBHOOK] Event Received:", JSON.stringify(payload, null, 2));

    // Example routing logic:
    // if (payload[0].propertyName === "dealstage" && payload[0].propertyValue === "closedwon") {
    //    fetch("http://localhost:3000/api/agents/workflows", { body: JSON.stringify({ action: "onboard_client", dealId: payload[0].objectId }) })
    // }

    return NextResponse.json({ success: true, status: "CRM State Logged by Sovereign Matrix" });
  } catch (error) {
    console.error("CRM Webhook Parsing Error:", error);
    return NextResponse.json({ error: "Failed to parse CRM state mutation" }, { status: 400 });
  }
}
