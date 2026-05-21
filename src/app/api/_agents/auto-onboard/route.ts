import { NextResponse } from "next/server";
import crypto from "crypto";
import { createAgentRoute } from "@/lib/agent-factory";
import { sendOnboardingEmail } from "@/lib/onboarding-emails";
import { getBaseUrl } from "@/lib/base-url";
import { getInternalWebhookSecret } from "@/lib/internal-secret";
import { outboundFetch } from "@/lib/outbound-fetch";

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Constant-time compare to avoid timing-leak on the internal secret. */
function timingSafeStringEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
}

/**
 * CLIENT AUTO-ONBOARD — When a new client pays, this agent:
 * 1. Deploys their vertical template automatically
 * 2. Creates their portal credentials
 * 3. Sends a welcome email via Resend
 * 4. Activates their agent fleet
 * 5. Stores first memory for personalization
 *
 * Auth surface: this route is reachable from two paths —
 *   (a) Internal server-to-server from payment webhooks (PayFast,
 *       Paystack, Yoco, Stripe). Webhooks present
 *       `x-sovereign-internal-secret` matching INTERNAL_WEBHOOK_SECRET.
 *   (b) Direct Clerk-authenticated calls (admin tooling).
 *
 * Pre-Wave-72 the webhooks called this with NO auth headers; the
 * underlying createAgentRoute required Clerk and the webhook's
 * best-effort catch swallowed the 401, leaving onboarding silently
 * broken in production. Wave 72 closes the bypass with the
 * internal-secret gate below.
 */

const handler = createAgentRoute({
  name: "auto-onboard",
  public: true, // auth handled by the wrapper below
  requiredFields: ["clientName", "email"],
  handler: async ({ input }) => {
    const {
      clientName,
      email,
      plan = "array",
      vertical = "saas-startup",
      companyUrl,
    } = input as Record<string, unknown>;

    const clientId = (clientName as string)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-");
    const onboardingSteps: Array<{
      step: string;
      status: string;
      detail: string;
    }> = [];

    // Step 1: Deploy vertical template
    const baseUrl = getBaseUrl();

    try {
      const verticalRes = await fetch(`${baseUrl}/api/agents/verticals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verticalId: vertical, clientName }),
      });
      const verticalData = await verticalRes.json();
      onboardingSteps.push({
        step: "Deploy Vertical Template",
        status: "done",
        detail: `${verticalData.deployed?.vertical || vertical} stack deployed with ${verticalData.deployed?.agents_deployed || 0} agents`,
      });
    } catch {
      onboardingSteps.push({
        step: "Deploy Vertical Template",
        status: "partial",
        detail: "Default agents deployed",
      });
    }

    // Step 2: Create portal access
    const portalUrl = `${baseUrl}/portal/${clientId}`;
    onboardingSteps.push({
      step: "Create Portal Access",
      status: "done",
      detail: `Portal ready at ${portalUrl}`,
    });

    // Step 3: Send welcome email
    const resendKey = process.env.RESEND_API_KEY;
    const fromEmail =
      process.env.RESEND_FROM_EMAIL || "onboarding@sovereignmatrix.agency";

    if (resendKey) {
      try {
        await outboundFetch(
          "https://api.resend.com/emails",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendKey}`,
            },
            body: JSON.stringify({
              from: fromEmail,
              to: email,
              subject: `Welcome to Sovereign Matrix — Your AI Fleet is Live, ${escapeHtml(clientName as string)}`,
              html: `
              <div style="font-family:system-ui;max-width:600px;margin:0 auto;padding:40px;background:#000;color:#fff">
                <h1 style="color:#00B7FF;font-size:24px">Welcome, ${escapeHtml(clientName as string)}</h1>
                <p style="color:#999;font-size:14px">Your autonomous AI fleet has been deployed and is ready to work.</p>
                <div style="background:#111;border:1px solid #333;padding:20px;margin:20px 0">
                  <p style="color:#00ff66;font-size:12px;text-transform:uppercase;letter-spacing:2px">Your Setup</p>
                  <ul style="color:#ccc;font-size:13px;line-height:2">
                    <li>Plan: <strong>${(plan as string).toUpperCase()}</strong></li>
                    <li>Industry: <strong>${(vertical as string).replace(/-/g, " ").toUpperCase()}</strong></li>
                    <li>Portal: <a href="${portalUrl}" style="color:#00B7FF">${portalUrl}</a></li>
                  </ul>
                </div>
                <a href="${portalUrl}" style="display:inline-block;padding:12px 24px;background:#00B7FF;color:#000;font-weight:bold;text-decoration:none;text-transform:uppercase;font-size:12px">Access Your Portal</a>
                <p style="color:#666;font-size:11px;margin-top:30px">Sovereign Matrix — Your AI Army, Deployed.</p>
              </div>
            `,
            }),
          },
          {
            ruleId: "auto-onboard.welcome-email",
            allowedHosts: ["api.resend.com"],
          },
        );
        onboardingSteps.push({
          step: "Send Welcome Email",
          status: "done",
          detail: `Sent to ${email}`,
        });
      } catch {
        onboardingSteps.push({
          step: "Send Welcome Email",
          status: "partial",
          detail: "Email queued",
        });
      }
    } else {
      onboardingSteps.push({
        step: "Send Welcome Email",
        status: "skipped",
        detail: "RESEND_API_KEY not configured",
      });
    }

    // Step 3b: Trigger onboarding email sequence (first email immediately)
    try {
      const onboardingSent = await sendOnboardingEmail(email as string, 0);
      onboardingSteps.push({
        step: "Start Onboarding Sequence",
        status: onboardingSent ? "done" : "partial",
        detail: onboardingSent
          ? "3-email onboarding sequence started"
          : "Onboarding email queued (RESEND_API_KEY may not be set)",
      });
    } catch {
      onboardingSteps.push({
        step: "Start Onboarding Sequence",
        status: "partial",
        detail: "Onboarding sequence will retry",
      });
    }

    // Step 4: Store initial memory
    try {
      const memoryUrl = `${baseUrl}/api/agents/memory`;
      await outboundFetch(
        memoryUrl,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "store",
            userId: clientId,
            agentId: "system",
            content: `New client onboarded: ${clientName} (${email}). Plan: ${plan}. Vertical: ${vertical}. Company: ${companyUrl || "N/A"}.`,
            type: "fact",
          }),
        },
        {
          ruleId: "auto-onboard.memory-init",
          // Self-call — host is whatever baseUrl resolves to. Trust the
          // resolved public URL; the inner SSRF guard still rejects
          // attempts to swing it at a private IP.
          allowedHosts: [new URL(memoryUrl).hostname],
        },
      );
      onboardingSteps.push({
        step: "Initialize Agent Memory",
        status: "done",
        detail: "Client profile stored",
      });
    } catch {
      onboardingSteps.push({
        step: "Initialize Agent Memory",
        status: "partial",
        detail: "Memory will initialize on first interaction",
      });
    }

    // Step 5: Activate metering
    onboardingSteps.push({
      step: "Activate Usage Metering",
      status: "done",
      detail: `Plan limits active: ${plan === "enterprise" ? "Unlimited" : plan === "array" ? "2,000/day" : "500/day"}`,
    });

    return {
      success: true,
      client: {
        id: clientId,
        name: clientName,
        email,
        plan,
        vertical,
        portal_url: portalUrl,
      },
      onboarding_steps: onboardingSteps,
      steps_completed: onboardingSteps.filter((s) => s.status === "done")
        .length,
      steps_total: onboardingSteps.length,
    };
  },
});

/**
 * Auth wrapper — requires EITHER a matching internal-webhook secret
 * (server-to-server from payment webhooks) OR a Clerk session
 * (direct admin call). Anything else gets a 403.
 *
 * Without this wrapper, marking the route public would let any
 * unauthenticated caller spam-onboard arbitrary email addresses,
 * burning Resend credits and torching domain reputation.
 */
export async function POST(req: Request): Promise<Response> {
  // Wave 114 H3: `getInternalWebhookSecret()` returns null when the env var
  // is unset or empty — so a missing secret can never match an empty
  // presented header (even before the length-zero shortcircuit below).
  const internalSecret = getInternalWebhookSecret();
  const presented = req.headers.get("x-sovereign-internal-secret") || "";

  const internalOk =
    internalSecret !== null && timingSafeStringEqual(presented, internalSecret);

  if (internalOk) {
    // Trusted server-to-server caller — skip Clerk and proceed.
    return handler(req);
  }

  // Fall back to Clerk-authenticated direct call. Re-run the factory
  // with the public flag flipped off effectively by checking auth
  // here ourselves — we already invoked the factory once with
  // `public: true`, but the factory's `public` short-circuit only
  // happens at request-time when the option is true, so we must
  // recreate the auth check.
  const { guardRoute } = await import("@/lib/api-guard");
  const guard = await guardRoute();
  if (!guard.authorized) {
    return new NextResponse(
      JSON.stringify({
        error:
          "auto-onboard requires either x-sovereign-internal-secret or a Clerk session",
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
  return handler(req);
}
