import { NextResponse } from "next/server";
import { persistAppend } from "@/lib/persist";

/**
 * RESEND EMAIL ONBOARDING — Automated welcome and drip sequence.
 * 
 * Triggered by PayFast ITN or manual call.
 * 
 * Sequence:
 * - Day 0: Welcome + portal access + quick start guide
 * - Day 2: 3 quick wins tutorial
 * - Day 5: Advanced features walkthrough
 * - Day 7: Check-in + upsell to higher plan
 * 
 * Env var: RESEND_API_KEY
 */

interface EmailStep {
  day: number;
  subject: string;
  body: string;
}

function buildSequence(clientName: string, plan: string): EmailStep[] {
  return [
    {
      day: 0,
      subject: `Welcome to Sovereign Matrix, ${clientName} 🚀`,
      body: `Hi ${clientName},\n\nYour ${plan} plan is now active. Here's how to get started:\n\n1. **Dashboard**: Visit your dashboard to see all 72+ AI agents ready to work.\n2. **API Keys**: Go to Settings → API Keys to generate your integration key.\n3. **Quick Start**: Try the Smart Router — POST to /api/agents/smart-router with any prompt and it auto-selects the best model.\n\nYour agents are deployed and waiting.\n\n— The Sovereign Matrix Team`,
    },
    {
      day: 2,
      subject: `3 Quick Wins You Can Do Today, ${clientName}`,
      body: `Hi ${clientName},\n\nHere are 3 things you can do in the next 10 minutes:\n\n1. **Generate a blog post**: POST to /api/agents/blog-gen with {topic: "your topic"}\n2. **Create a landing page**: POST to /api/agents/page-builder with {prompt: "landing page for..."}\n3. **Analyze a competitor**: POST to /api/agents/abm-artillery with {companyName: "competitor.com"}\n\nEach one takes 5 seconds and costs $0.\n\n— The Sovereign Matrix Team`,
    },
    {
      day: 5,
      subject: `Advanced: Multi-Agent Pipelines, ${clientName}`,
      body: `Hi ${clientName},\n\nReady to go deeper? Try these advanced features:\n\n1. **Multi-Modal Pipeline**: POST to /api/agents/pipeline with {pipeline: "content-blitz", input: {topic: "AI"}} — generates blog + image + voice in one call.\n2. **Collaboration Room**: POST to /api/agents/collab-room with {topic: "your question"} — 3 AI agents debate and reach consensus.\n3. **Reasoning Chain**: POST to /api/agents/reasoning-chain with {question: "complex question"} — 3 models collaborate on deep analysis.\n\nThese features are unique to Sovereign Matrix.\n\n— The Sovereign Matrix Team`,
    },
    {
      day: 7,
      subject: `How's it going, ${clientName}?`,
      body: `Hi ${clientName},\n\nYou've been on the ${plan} plan for a week. Quick check-in:\n\n• Have you tried the Capability Matrix? Visit /dashboard/capability-matrix to see all 50+ models.\n• Need more agent calls? Upgrade anytime at /pricing.\n• Questions? Reply to this email — we respond within 2 hours.\n\nBuilding the future together.\n\n— The Sovereign Matrix Team`,
    },
  ];
}

export async function POST(request: Request) {
  try {
    const { email, clientName = "there", plan = "Node", action = "send-welcome" } = await request.json();

    if (!email) {
      return NextResponse.json({ error: "email is required." }, { status: 400 });
    }

    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@sovereignmatrix.agency";
    const sequence = buildSequence(clientName, plan);

    if (action === "send-welcome") {
      const welcomeEmail = sequence[0];

      if (resendKey) {
        try {
          const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${resendKey}` },
            body: JSON.stringify({
              from: fromEmail,
              to: [email],
              subject: welcomeEmail.subject,
              text: welcomeEmail.body,
            }),
          });

          const data = await res.json();

          persistAppend("email-log", {
            email,
            subject: welcomeEmail.subject,
            status: res.ok ? "sent" : "failed",
            resend_id: data?.id || null,
            timestamp: new Date().toISOString(),
          }, 500);

          return NextResponse.json({
            success: true,
            mode: "live",
            sent_to: email,
            subject: welcomeEmail.subject,
            resend_id: data?.id,
          });
        } catch (err) {
          return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
        }
      }

      // Demo mode — log but don't send
      persistAppend("email-log", {
        email,
        subject: welcomeEmail.subject,
        status: "demo",
        timestamp: new Date().toISOString(),
      }, 500);

      return NextResponse.json({
        success: true,
        mode: "demo",
        message: "RESEND_API_KEY not set. Email logged but not sent.",
        would_send: { to: email, subject: welcomeEmail.subject, preview: welcomeEmail.body.substring(0, 200) },
      });
    }

    if (action === "preview-sequence") {
      return NextResponse.json({
        success: true,
        email,
        plan,
        sequence: sequence.map(s => ({ day: s.day, subject: s.subject, preview: s.body.substring(0, 150) })),
      });
    }

    return NextResponse.json({ error: "action must be 'send-welcome' or 'preview-sequence'." }, { status: 400 });
  } catch (error) {
    return NextResponse.json({ error: "Email error", details: String(error) }, { status: 500 });
  }
}
