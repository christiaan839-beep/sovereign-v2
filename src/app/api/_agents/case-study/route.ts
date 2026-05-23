import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { getNimKey } from "@/lib/nvidia";
import { db } from "@/db";
import { caseStudies } from "@/db/schema";
import { isAdmin } from "@/lib/admin-auth";

/**
 * CASE STUDY GENERATOR — Takes client metrics and generates a polished
 * case study document in HTML format. Optionally persists to the DB
 * (admin-only) so the result appears on the public /case-studies page.
 *
 * Auto-publish flow (admin only):
 *   POST { clientName, industry, metric, outcome, playbook, persist: true,
 *          publish: true, approvedByCompany: true, slug?: "acme" }
 *
 * Without `persist: true` the agent returns generated HTML and never
 * touches the DB — useful for previewing copy before saving.
 */

import { outboundFetchAsResponse } from "@/lib/outbound-fetch";

const schema = z
  .object({
    clientName: z.string().max(200).optional(),
    industry: z.string().max(100).optional(),
    metrics: z.record(z.string(), z.string()).optional(),
    metric: z.string().max(80).optional(),
    outcome: z.string().max(280).optional(),
    playbook: z.string().max(80).optional(),
    challenge: z.string().max(2000).optional(),
    result: z.string().max(2000).optional(),
    prompt: z.string().max(5000).optional(),
    topic: z.string().max(500).optional(),
    context: z.string().max(5000).optional(),
    /** When true, persist to case_studies table. Admin-only. */
    persist: z.boolean().optional(),
    /** When true, set publishedAt on insert. Requires persist + admin. */
    publish: z.boolean().optional(),
    /** Customer signed off on the case study. Required for publish. */
    approvedByCompany: z.boolean().optional(),
    /** Override the auto-derived slug. Lowercase kebab-case. */
    slug: z
      .string()
      .min(2)
      .max(120)
      .regex(/^[a-z0-9][a-z0-9-]*$/u, "slug must be lowercase kebab-case")
      .optional(),
  })
  .refine((d) => d.clientName || d.prompt || d.topic, {
    message: "Provide at least a clientName, prompt, or topic",
  });

function makeSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "draft"
  );
}

export const POST = createAgentRoute({
  name: "case-study",
  schema,
  // Wave 114 M3 batch 8: memory hooks. Per-industry case studies compound —
  // "what stuck for similar clients" informs which angle / metrics framing
  // to lean on this time. Surface that as `pastContextAsPrompt()` without
  // re-stating the entire prior case study.
  memory: {
    search: {
      query: (input) => {
        const industry =
          (typeof input.industry === "string" && input.industry) || "general";
        const playbook =
          (typeof input.playbook === "string" && input.playbook) || "";
        return `case-study industry:${industry} playbook:${playbook}`.trim();
      },
      limit: 2,
    },
    store: {
      extract: (result) => {
        const r = result as {
          clientName?: string;
          industry?: string;
          playbook?: string;
          metric?: string;
          outcome?: string;
        };
        if (!r.clientName && !r.industry) return null;
        const head = [
          r.clientName ? `client=${r.clientName}` : "",
          r.industry ? `industry=${r.industry}` : "",
          r.playbook ? `playbook=${r.playbook}` : "",
          r.metric ? `metric=${r.metric}` : "",
          r.outcome ? `outcome=${r.outcome.slice(0, 160)}` : "",
        ]
          .filter(Boolean)
          .join(" · ");
        return head || null;
      },
      metadata: (input) => ({
        industry: typeof input.industry === "string" ? input.industry : "",
        playbook: typeof input.playbook === "string" ? input.playbook : "",
        kind: "case-study",
      }),
    },
  },
  handler: async ({ input }) => {
    const clientName = (input.clientName as string) || "";
    const industry = (input.industry as string) || "Technology";
    const metrics = (input.metrics as Record<string, string>) || {};
    const challenge = (input.challenge as string) || "";
    const outcome = (input.result as string) || "";
    const prompt = (input.prompt || input.topic || "") as string;
    const context = (input.context || "") as string;

    const nimRes = await outboundFetchAsResponse("https://integrate.api.nvidia.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getNimKey()}`,
        },
        body: JSON.stringify({
          model: "deepseek-ai/deepseek-v3.2",
          messages: [
            {
              role: "system",
              content: `You are a professional case study writer. Generate a detailed, persuasive case study in HTML format. Structure:
1. H1: "[Client Name] Case Study"
2. Executive Summary (2-3 sentences)
3. The Challenge (what problem they faced)
4. The Solution (how the platform solved it)
5. The Results (specific metrics and improvements)
6. Key Takeaways (3 bullet points)

Be specific and data-driven. Use semantic HTML.${context ? `\n\nCONTEXT:\n${context}` : ""}`,
            },
            {
              role: "user",
              content: `${prompt ? `Task: ${prompt}\n\n` : ""}Client: ${clientName || "Client"}
Industry: ${industry}
Metrics: ${JSON.stringify(Object.keys(metrics).length > 0 ? metrics : { leads: "+340%", revenue: "+R180,000/mo" })}
Challenge: ${challenge || "Not specified"}
Outcome: ${outcome || "Not specified"}`,
            },
          ],
          max_tokens: 3000,
          temperature: 0.7,
        }),
      }, { ruleId: "agents.case-study.route.1", allowedHosts: ["integrate.api.nvidia.com"] });

    if (!nimRes.ok) {
      throw new Error(`NIM API returned ${nimRes.status}`);
    }

    const nimData = await nimRes.json();
    const caseStudyHtml = nimData?.choices?.[0]?.message?.content || "";

    const persist = Boolean(input.persist);
    const slug = (input.slug as string | undefined) ?? makeSlug(clientName);
    const headlineMetric =
      (input.metric as string | undefined) ??
      (Object.values(metrics)[0] as string | undefined) ??
      "verified result";
    const headlineOutcome =
      ((input.outcome as string | undefined) ?? outcome) ||
      `${clientName || "Customer"} delivered measurable wins with Sovereign Matrix.`;
    const playbook =
      (input.playbook as string | undefined) ?? "Custom Pipeline";
    const publish = Boolean(input.publish);
    const approvedByCompany = Boolean(input.approvedByCompany);

    let persisted: { slug: string; published: boolean } | null = null;

    if (persist) {
      // SECURITY: persistence is admin-only. The public /case-studies
      // page reads only approved+published rows, so a non-admin couldn't
      // expose anything anyway — but we hard-block writes regardless to
      // keep the table from being used as scratch storage.
      const callerUserId = (input as { userId?: string }).userId;
      if (!callerUserId || !isAdmin(callerUserId)) {
        return {
          success: false,
          html: caseStudyHtml,
          error:
            "Persistence is admin-only. Add your Clerk user ID to ADMIN_USER_IDS.",
        };
      }

      try {
        await db
          .insert(caseStudies)
          .values({
            slug,
            company: clientName || "Anonymous customer",
            industry,
            outcome: headlineOutcome.slice(0, 280),
            metric: String(headlineMetric).slice(0, 80),
            playbook,
            body: caseStudyHtml,
            approvedByCompany,
            publishedAt: publish && approvedByCompany ? new Date() : null,
          })
          .onConflictDoUpdate({
            target: caseStudies.slug,
            set: {
              company: clientName || "Anonymous customer",
              industry,
              outcome: headlineOutcome.slice(0, 280),
              metric: String(headlineMetric).slice(0, 80),
              playbook,
              body: caseStudyHtml,
              approvedByCompany,
              publishedAt: publish && approvedByCompany ? new Date() : null,
              updatedAt: new Date(),
            },
          });
        persisted = { slug, published: publish && approvedByCompany };
      } catch {
        // Table missing or DB error — never fail the agent on persistence;
        // the operator can copy the HTML and try the admin route directly.
        persisted = null;
      }
    }

    return {
      success: true,
      clientName: clientName || "Draft",
      industry,
      html: caseStudyHtml,
      wordCount: caseStudyHtml.split(/\s+/).length,
      slug: persisted ? `/case-studies/${slug}` : `/case-studies/${slug}`,
      persisted: Boolean(persisted),
      published: persisted?.published ?? false,
    };
  },
});
