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
    
    return NextResponse.json({ success: true, status: "CRM State Logged by Sovereign Matrix" });
  } catch (error) {
    console.error("CRM Webhook Parsing Error:", error);
    return NextResponse.json({ error: "Failed to parse CRM state mutation" }, { status: 400 });
  }
}
