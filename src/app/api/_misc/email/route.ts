import { NextResponse } from "next/server";
import { db } from "@/db";
import { generations } from "@/db/schema";

/**
 * TRANSACTIONAL EMAIL — Resend-compatible email sender.
 * Sends welcome emails, invoices, lead notifications, and drip sequences.
 * Free tier: 100 emails/day via Resend, or falls back to logged-only mode.
 * All sends are audit-logged to the database.
 */
export async function POST(req: Request) {
  try {
    const { to, subject, html, text, template, data, body: bodyText } = await req.json();

    // Support simplified { to, subject, body } workflow payloads
    const effectiveSubject = subject;
    const effectiveText = text || bodyText;

    if (!to || !effectiveSubject) return NextResponse.json({ error: "Missing `to` or `subject`." }, { status: 400 });

    const resendKey = process.env.RESEND_API_KEY;

    // Template system
    const templates: Record<string, (d: any) => { subject: string; html: string }> = {
      welcome: (d) => ({
        subject: `Welcome to Sovereign Matrix, ${d.name || "Operator"}`,
        html: `
          <div style="font-family: monospace; background: #0a0a0a; color: #e5e5e5; padding: 40px; max-width: 600px;">
            <div style="border-bottom: 2px solid #00B7FF; padding-bottom: 20px; margin-bottom: 20px;">
              <h1 style="color: white; font-size: 24px; margin: 0;">SOVEREIGN MATRIX</h1>
              <p style="color: #666; font-size: 10px; letter-spacing: 3px; text-transform: uppercase;">Neural Command Interface Active</p>
            </div>
            <p>Welcome, <strong style="color: #00B7FF;">${d.name || "Operator"}</strong>.</p>
            <p>Your autonomous AI infrastructure is now live. Here's what's running:</p>
            <ul style="color: #999; line-height: 2;">
              <li>✅ 10 NVIDIA NIM models (free tier)</li>
              <li>✅ 130+ API endpoints</li>
              <li>✅ NemoClaw browser automation</li>
              <li>✅ Ghost Fleet outbound system</li>
            </ul>
            <a href="${d.dashboardUrl || '#'}" style="display: inline-block; background: #00B7FF; color: black; padding: 12px 24px; font-weight: bold; text-decoration: none; margin-top: 20px; font-size: 12px; letter-spacing: 2px; text-transform: uppercase;">ACCESS COMMAND CENTER</a>
            <p style="margin-top: 30px; font-size: 11px; color: #444;">— Sovereign Matrix Autonomous Systems</p>
          </div>
        `,
      }),
      lead_captured: (d) => ({
        subject: `🎯 New Lead Captured: ${d.leadName || "Unknown"}`,
        html: `
          <div style="font-family: monospace; background: #0a0a0a; color: #e5e5e5; padding: 40px; max-width: 600px;">
            <h2 style="color: #00ff66;">New Lead Captured by Ghost Fleet</h2>
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
              <tr><td style="color: #666; padding: 8px 0;">Name</td><td style="color: white; font-weight: bold;">${d.leadName || "N/A"}</td></tr>
              <tr><td style="color: #666; padding: 8px 0;">Email</td><td style="color: #00B7FF;">${d.leadEmail || "N/A"}</td></tr>
              <tr><td style="color: #666; padding: 8px 0;">Source</td><td style="color: white;">${d.source || "Organic"}</td></tr>
              <tr><td style="color: #666; padding: 8px 0;">Score</td><td style="color: #00ff66; font-weight: bold;">${d.score || "85"}/100</td></tr>
            </table>
          </div>
        `,
      }),
      audit_report: (d) => ({
        subject: `⚡ Audit Complete: ${d.targetUrl || "Target"}`,
        html: `
          <div style="font-family: monospace; background: #0a0a0a; color: #e5e5e5; padding: 40px; max-width: 600px;">
            <h2 style="color: #ff6b6b;">Audit & Destroy Report</h2>
            <p>Target: <strong style="color: white;">${d.targetUrl}</strong></p>
            <p>Vulnerabilities found: <strong style="color: #ff6b6b;">${d.vulnCount || 0}</strong></p>
            <p style="color: #666;">Full report attached to your Sovereign dashboard.</p>
            <a href="${d.reportUrl || '#'}" style="display: inline-block; background: #ff6b6b; color: white; padding: 12px 24px; font-weight: bold; text-decoration: none; margin-top: 20px; font-size: 12px;">VIEW FULL REPORT</a>
          </div>
        `,
      }),
    };

    let emailBody = html || effectiveText || "";
    let emailSubject = effectiveSubject;

    if (template && templates[template]) {
      const tpl = templates[template](data || {});
      emailBody = tpl.html;
      emailSubject = tpl.subject;
    }

    // Audit log to database (non-blocking)
    try {
      await db.insert(generations).values({
        userEmail: typeof to === "string" ? to : to[0] || "system",
        tool: "email",
        action: template || "send",
        inputSummary: `Email to ${to}: ${emailSubject}`,
        output: JSON.stringify({ to, subject: emailSubject, template: template || null, provider: resendKey ? "resend" : "log-only" }),
        tokens: 0,
      });
    } catch {
      // Non-blocking: audit logging failure should not prevent email delivery
    }

    // Send via Resend if API key exists
    if (resendKey) {
      const resendRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendKey}` },
        body: JSON.stringify({
          from: process.env.RESEND_FROM || "Sovereign Matrix <noreply@sovereign.ai>",
          to: Array.isArray(to) ? to : [to],
          subject: emailSubject,
          html: emailBody,
        }),
      });
      const resendData = await resendRes.json();
      return NextResponse.json({ sent: true, provider: "resend", id: resendData.id });
    }

    // Fallback: Log mode (no external dependency)
    return NextResponse.json({ sent: false, provider: "log-only", message: "Set RESEND_API_KEY for delivery.", to, subject: emailSubject });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
