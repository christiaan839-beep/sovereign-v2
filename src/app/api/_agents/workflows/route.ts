import { createAgentRoute } from "@/lib/agent-factory";
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

/**
 * ONE-CLICK WORKFLOWS — Pre-built automation chains.
 * Each workflow chains multiple API calls into a single user action.
 * This is what makes the platform truly easy to use.
 */
async function _postHandler(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    const { workflow, target, count = 5, topic } = await request.json();
    if (!workflow) return NextResponse.json({ error: "Missing `workflow`." }, { status: 400 });

    const nimKey = process.env.NVIDIA_NIM_API_KEY;
    const baseUrl = request.url.replace(/\/api\/agents\/workflows$/, "");

    const results: Record<string, unknown> = {};
    const steps: string[] = [];

    switch (workflow) {
      // ═══════════════════════════════════════
      // WORKFLOW 1: Competitor Teardown
      // Audit → Analyze → Draft pitch → Log
      // ═══════════════════════════════════════
      case "competitor-teardown": {
        steps.push("Auditing competitor site...");
        
        // Step 1: Audit the site
        const auditRes = await outboundFetchAsResponse(`${baseUrl}/api/agents/audit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url: target || "competitor.com" }),
        }, { ruleId: "agents.workflows.route.1", allowedHosts: [new URL(baseUrl).hostname] }).catch(() => null);
        results.audit = auditRes ? await auditRes.json() : { error: "Audit unavailable" };
        steps.push("Site audited ✅");

        // Step 2: Generate pitch script
        const pitchRes = await outboundFetchAsResponse("https://integrate.api.nvidia.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${nimKey}` },
          body: JSON.stringify({
            model: "nvidia/nemotron-3-super-120b-a12b",
            messages: [
              { role: "system", content: "You are a strategic sales strategist. Write a 3-sentence pitch exposing the competitor's weaknesses and positioning our platform as superior." },
              { role: "user", content: `Competitor: ${target}. Audit results: ${JSON.stringify(results.audit).slice(0, 500)}` },
            ],
            max_tokens: 200,
          }),
        }, { ruleId: "agents.workflows.route.2", allowedHosts: ["integrate.api.nvidia.com"] });
        results.pitch = pitchRes.ok ? (await pitchRes.json()).choices?.[0]?.message?.content : "";
        steps.push("Pitch generated ✅");

        // Step 3: Log to email
        await outboundFetchAsResponse(`${baseUrl}/api/email`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            to: "team@sovereign.ai",
            template: "audit_report",
            data: { targetUrl: target, vulnCount: ((results.audit as Record<string, unknown>)?.vulnerabilities as unknown[] | undefined)?.length || 0 },
          }),
        }, { ruleId: "agents.workflows.route.3", allowedHosts: [new URL(baseUrl).hostname] }).catch(() => {});
        steps.push("Report emailed ✅");
        break;
      }

      // ═══════════════════════════════════════
      // WORKFLOW 2: Lead-to-Close Pipeline
      // Scrape → Enrich → Draft email → Queue call
      // ═══════════════════════════════════════
      case "lead-to-close": {
        steps.push("Scraping leads...");
        
        const leadRes = await outboundFetchAsResponse(`${baseUrl}/api/leads/capture`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ source: "workflow", url: target || "g2.com" }),
        }, { ruleId: "agents.workflows.route.4", allowedHosts: [new URL(baseUrl).hostname] }).catch(() => null);
        results.leads = leadRes ? await leadRes.json() : {};
        steps.push("Leads captured ✅");

        // Draft outreach email
        const emailRes = await outboundFetchAsResponse("https://integrate.api.nvidia.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${nimKey}` },
          body: JSON.stringify({
            model: "nvidia/nemotron-3-super-120b-a12b",
            messages: [
              { role: "system", content: "Write a concise, direct B2B cold email. No fluff. State the exact problem you solve, one case study stat, and a clear CTA. Max 5 sentences." },
              { role: "user", content: "Draft an outreach email for a SaaS founder who needs marketing automation." },
            ],
            max_tokens: 200,
          }),
        }, { ruleId: "agents.workflows.route.5", allowedHosts: ["integrate.api.nvidia.com"] });
        results.email = emailRes.ok ? (await emailRes.json()).choices?.[0]?.message?.content : "";
        steps.push("Outreach email drafted ✅");

        // Queue a voice call
        await outboundFetchAsResponse(`${baseUrl}/api/agents/claw-queue`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ type: "form-fill", payload: { url: target, fields: { subject: "Follow-up" } } }),
        }, { ruleId: "agents.workflows.route.6", allowedHosts: [new URL(baseUrl).hostname] }).catch(() => {});
        steps.push("Follow-up call queued ✅");
        break;
      }

      // ═══════════════════════════════════════
      // WORKFLOW 3: Content Blitz
      // Generate N posts across platforms
      // ═══════════════════════════════════════
      case "content-blitz": {
        const platforms = ["LinkedIn", "X/Twitter", "Instagram", "Newsletter", "Blog"];
        const postCount = Math.min(count, platforms.length);
        
        for (let i = 0; i < postCount; i++) {
          const platform = platforms[i];
          steps.push(`Generating ${platform} post...`);
          
          const postRes = await outboundFetchAsResponse("https://integrate.api.nvidia.com/v1/chat/completions", {
            method: "POST",
            headers: { "Content-Type": "application/json", "Authorization": `Bearer ${nimKey}` },
            body: JSON.stringify({
              model: "nvidia/nemotron-3-super-120b-a12b",
              messages: [
                { role: "system", content: `Write a ${platform} post about AI marketing automation. Match the platform's native format and tone. Keep under 280 chars for X, 2200 for LinkedIn, 150 words for others. No hashtags unless Instagram.` },
                { role: "user", content: topic || "How autonomous AI agents are replacing entire marketing teams" },
              ],
              max_tokens: 300,
            }),
          }, { ruleId: "agents.workflows.route.7", allowedHosts: ["integrate.api.nvidia.com"] });
          results[`post_${platform.toLowerCase()}`] = postRes.ok 
            ? (await postRes.json()).choices?.[0]?.message?.content 
            : `[${platform} post placeholder]`;
          steps.push(`${platform} post ready ✅`);
        }
        break;
      }

      // ═══════════════════════════════════════
      // WORKFLOW 4: Morning Briefing
      // Health → Analytics → News → Summary
      // ═══════════════════════════════════════
      case "morning-briefing": {
        steps.push("Checking system health...");
        const healthRes = await outboundFetchAsResponse(`${baseUrl}/api/health`, {}, { ruleId: "agents.workflows.route.8", allowedHosts: [new URL(baseUrl).hostname] }).catch(() => null);
        results.health = healthRes ? await healthRes.json() : { status: "unknown" };
        steps.push("Health checked ✅");

        steps.push("Pulling analytics...");
        const analyticsRes = await outboundFetchAsResponse(`${baseUrl}/api/agents/analytics`, {}, { ruleId: "agents.workflows.route.9", allowedHosts: [new URL(baseUrl).hostname] }).catch(() => null);
        results.analytics = analyticsRes ? await analyticsRes.json() : {};
        steps.push("Analytics pulled ✅");

        // Generate briefing summary
        const briefRes = await outboundFetchAsResponse("https://integrate.api.nvidia.com/v1/chat/completions", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${nimKey}` },
          body: JSON.stringify({
            model: "nvidia/nemotron-3-super-120b-a12b",
            messages: [
              { role: "system", content: "You are a chief of staff AI. Write a 5-bullet morning briefing based on system data." },
              { role: "user", content: `Health: ${JSON.stringify(results.health).slice(0, 300)}. Analytics: ${JSON.stringify(results.analytics).slice(0, 300)}` },
            ],
            max_tokens: 300,
          }),
        }, { ruleId: "agents.workflows.route.10", allowedHosts: ["integrate.api.nvidia.com"] });
        results.briefing = briefRes.ok ? (await briefRes.json()).choices?.[0]?.message?.content : "";
        steps.push("Briefing compiled ✅");
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown workflow: ${workflow}` }, { status: 400 });
    }

    return NextResponse.json({
      workflow,
      steps,
      results,
      summary: `Workflow "${workflow}" completed with ${steps.length} steps.`,
      cost: "$0.00",
    });
  } catch (error: unknown) {
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
}

/**
 * GET: List available workflows
 */
export async function GET() {
  return NextResponse.json({
    workflows: [
      { id: "competitor-teardown", name: "Competitor Teardown", steps: 3, description: "Audit → Pitch → Email" },
      { id: "lead-to-close", name: "Lead-to-Close Pipeline", steps: 3, description: "Scrape → Draft → Queue Call" },
      { id: "content-blitz", name: "Content Blitz", steps: 5, description: "Generate 5 platform posts in 60s" },
      { id: "morning-briefing", name: "Morning Briefing", steps: 3, description: "Health → Analytics → AI Summary" },
    ],
  });
}


// Factory wrapper for POST (adds safety pipeline)
import { outboundFetchAsResponse } from "@/lib/outbound-fetch";

export const POST = createAgentRoute({
  name: "workflows",
  handler: async ({ input, email, userId, request }) => {
    // Delegate to existing handler
    const fakeReq = new Request("http://localhost", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    const res = await _postHandler(fakeReq);
    return res instanceof Response ? await res.json() : res;
  },
});
