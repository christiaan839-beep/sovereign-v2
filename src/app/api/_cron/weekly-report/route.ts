import { NextResponse } from "next/server";
import { persistRead } from "@/lib/persist";

/**
 * CRON WEEKLY REPORT — Triggered via Vercel Cron every Sunday at midnight.
 * Sends real performance telemetry to active clients via Resend.
 */

export async function GET(req: Request) {
  // Secure with Vercel cron secret
  const authHeader = req.headers.get("authorization");
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    // Pull real metrics from persistence layer
    const generations = persistRead("generations", []);
    const leads = persistRead("leads", []);
    const agentLogs = persistRead("agent-activity", []);
    const clients = persistRead("clients", []);

    const genCount = Array.isArray(generations) ? generations.length : 0;
    const leadCount = Array.isArray(leads) ? leads.length : 0;
    const actionCount = Array.isArray(agentLogs) ? agentLogs.length : 0;

    // If no active clients, report to owner
    const activeClients = Array.isArray(clients) && clients.length > 0
      ? clients
      : [{ name: "Sovereign Operator", email: process.env.RESEND_FROM_EMAIL || "reports@sovereignmatrix.agency" }];

    const emailContent = `
    <div style="font-family: 'Helvetica Neue', sans-serif; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #ffffff; padding: 40px; border-radius: 16px;">
      <h1 style="font-size: 24px; font-weight: 700; margin-bottom: 8px;">Sovereign Matrix</h1>
      <p style="color: #10B981; font-size: 12px; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 32px;">Weekly Intelligence Report</p>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 32px;">
        <div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.06); text-align: center;">
          <p style="color: #737373; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Agent Actions</p>
          <p style="font-size: 28px; font-weight: 700;">${actionCount}</p>
        </div>
        <div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.06); text-align: center;">
          <p style="color: #737373; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Content Pieces</p>
          <p style="font-size: 28px; font-weight: 700; color: #10B981;">${genCount}</p>
        </div>
        <div style="background: rgba(255,255,255,0.03); padding: 16px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.06); text-align: center;">
          <p style="color: #737373; font-size: 10px; text-transform: uppercase; letter-spacing: 1px;">Leads</p>
          <p style="font-size: 28px; font-weight: 700; color: #10B981;">${leadCount}</p>
        </div>
      </div>

      <p style="color: #a3a3a3; font-size: 13px;">The Sovereign Swarm continues to operate. No human intervention required.</p>
      
      <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.06);">
        <a href="https://sovereignmatrix.agency/dashboard" style="display: inline-block; background: #ffffff; color: #000000; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 12px; text-transform: uppercase; letter-spacing: 1px;">View Dashboard →</a>
      </div>
    </div>
    `;

    // Send via Resend if configured
    if (process.env.RESEND_API_KEY) {
      const fromEmail = process.env.RESEND_FROM_EMAIL || "reports@sovereignmatrix.agency";
      for (const client of activeClients) {
        const clientObj = client as { name?: string; email?: string };
        if (clientObj.email) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${process.env.RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: fromEmail,
              to: clientObj.email,
              subject: `📊 Sovereign Matrix — Weekly Report`,
              html: emailContent,
            }),
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      status: "Report dispatched",
      metrics: { actionCount, genCount, leadCount },
      recipients: activeClients.length,
    });

  } catch {
    return NextResponse.json({ error: "Report generation failed" }, { status: 500 });
  }
}
