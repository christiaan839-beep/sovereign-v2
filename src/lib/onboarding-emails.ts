import { createLogger } from "@/lib/logger";
const log = createLogger("onboarding-emails");

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = "Sovereign Matrix <noreply@sovereignmatrix.agency>";

interface EmailStep {
  delay: number; // minutes after signup
  subject: string;
  body: string; // HTML
}

const SEQUENCE: EmailStep[] = [
  {
    delay: 0,
    subject: "Welcome to Sovereign Matrix — your AI workforce is ready",
    body: `<div style="font-family:system-ui;max-width:600px;margin:0 auto;padding:40px 20px;color:#333">
      <h1 style="color:#10b981">Welcome aboard</h1>
      <p>Your command center is live with <strong>124 AI agents</strong> and <strong>65+ models</strong> — all ready to work.</p>
      <p>Here's how to get started in 60 seconds:</p>
      <ol>
        <li><strong>Find leads</strong> — Go to Leads in your dashboard and describe your ideal customer</li>
        <li><strong>Create content</strong> — Open Content Factory and generate a blog post or email sequence</li>
        <li><strong>Build a workflow</strong> — Chain agents together in the Workflow Builder</li>
      </ol>
      <a href="https://sovereignmatrix.agency/dashboard" style="display:inline-block;padding:12px 24px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;margin-top:16px">Open Dashboard</a>
      <p style="margin-top:24px;color:#666;font-size:13px">Questions? Reply to this email — a real human will answer.</p>
    </div>`,
  },
  {
    delay: 1440, // 24 hours
    subject: "Did you try the Lead Gen agent?",
    body: `<div style="font-family:system-ui;max-width:600px;margin:0 auto;padding:40px 20px;color:#333">
      <h2>Your agents are waiting</h2>
      <p>Most users find their first 50 qualified leads within 30 seconds. Here's how:</p>
      <p>Just type: <em>"Find 50 SaaS companies in the US with Series A funding"</em></p>
      <p>The Lead Gen agent will search, enrich with emails, and score each lead automatically.</p>
      <a href="https://sovereignmatrix.agency/dashboard" style="display:inline-block;padding:12px 24px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;margin-top:16px">Try Lead Gen Now</a>
    </div>`,
  },
  {
    delay: 4320, // 3 days
    subject: "Build your first automated workflow",
    body: `<div style="font-family:system-ui;max-width:600px;margin:0 auto;padding:40px 20px;color:#333">
      <h2>Automate your entire pipeline</h2>
      <p>The Workflow Builder lets you chain agents together:</p>
      <p><strong>Find Leads → Write Emails → Send to Slack → Add to Google Sheets</strong></p>
      <p>With conditional branching, qualified leads go to your voice agent while others get email sequences.</p>
      <a href="https://sovereignmatrix.agency/dashboard/workflow-builder" style="display:inline-block;padding:12px 24px;background:#10b981;color:#fff;text-decoration:none;border-radius:8px;margin-top:16px">Build a Workflow</a>
    </div>`,
  },
];

export async function sendOnboardingEmail(email: string, stepIndex: number): Promise<boolean> {
  if (!RESEND_API_KEY || stepIndex >= SEQUENCE.length) return false;

  const step = SEQUENCE[stepIndex];
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: email,
        subject: step.subject,
        html: step.body,
      }),
    });
    log.info("Onboarding email sent", { email, step: stepIndex, success: res.ok });
    return res.ok;
  } catch (err) {
    log.error("Onboarding email failed", err as Record<string, unknown>);
    return false;
  }
}

export function getSequenceLength(): number { return SEQUENCE.length; }
export function getStepDelay(index: number): number { return SEQUENCE[index]?.delay ?? 0; }
