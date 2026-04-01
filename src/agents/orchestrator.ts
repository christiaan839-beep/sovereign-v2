import { remember } from "@/lib/memory";
import { competitorXRay, contentGapKiller } from "./seo-dominator";
import { generateBlogPost, generateSocialPack, generateEmailSequence } from "./content-factory";
import { generateCloseSequence } from "./closer";

// ============================================================
// Unified Agency Orchestrator
//
// Master conductor that chains all agents into automated pipelines.
// One-click execution of multi-agent workflows.
// ============================================================

export interface Pipeline {
  id: string;
  name: string;
  description: string;
  agents: string[];
  color: string;
}

export interface PipelineResult {
  pipeline: string;
  steps: { agent: string; status: string; output: string; durationMs: number }[];
  totalDurationMs: number;
  success: boolean;
}

/** Available pipelines */
export function getAvailablePipelines(): Pipeline[] {
  return [
    {
      id: "content-blitz",
      name: "Content Blitz",
      description: "SEO gap analysis → Blog post creation → Social media pack. Finds what's missing, writes it, and distributes it.",
      agents: ["seo-dominator", "content-factory", "social"],
      color: "emerald",
    },
    {
      id: "lead-machine",
      name: "Lead Machine",
      description: "Competitor X-Ray → Close sequence generation → Nurture email sequence. Identifies targets, writes the pitch, automates follow-up.",
      agents: ["seo-dominator", "closer", "content-factory"],
      color: "rose",
    },
    {
      id: "brand-launch",
      name: "Brand Launch",
      description: "Full brand content stack: Blog post + Email sequence + Social pack + Video script. Everything you need to launch.",
      agents: ["content-factory (blog)", "content-factory (email)", "content-factory (social)", "content-factory (video)"],
      color: "violet",
    },
    {
      id: "full-agency",
      name: "Full Agency Cycle",
      description: "The nuclear option. Runs every agent in sequence: SEO → Content → Social → Close sequence. Complete agency output in one click.",
      agents: ["seo-dominator", "content-factory", "closer", "social"],
      color: "amber",
    },
  ];
}

/** Execute a multi-agent pipeline */
export async function runPipeline(
  pipelineId: string,
  params: {
    topic?: string;
    business?: string;
    domain?: string;
    competitors?: string[];
    niche?: string;
    audience?: string;
    product?: string;
    leadName?: string;
    company?: string;
  }
): Promise<PipelineResult> {
  const totalStart = Date.now();
  const steps: PipelineResult["steps"] = [];
  const topic = params.topic || params.niche || "AI marketing automation";
  const business = params.business || params.product || "Sovereign Node";

  switch (pipelineId) {
    case "content-blitz": {
      // Step 1: SEO Gap Analysis
      const step1Start = Date.now();
      try {
        const seoResult = await contentGapKiller(
          params.domain || "yourdomain.com",
          params.competitors || ["competitor1.com"],
          params.niche || topic
        );
        steps.push({
          agent: "seo-dominator",
          status: "complete",
          output: seoResult.output.slice(0, 500) + "...",
          durationMs: Date.now() - step1Start,
        });
      } catch (e: unknown) {
        steps.push({ agent: "seo-dominator", status: "failed", output: (e as Error).message, durationMs: Date.now() - step1Start });
      }

      // Step 2: Blog Post
      const step2Start = Date.now();
      try {
        const blogResult = await generateBlogPost(topic, [topic], "authoritative");
        steps.push({
          agent: "content-factory (blog)",
          status: "complete",
          output: blogResult.output.slice(0, 500) + "...",
          durationMs: Date.now() - step2Start,
        });
      } catch (e: unknown) {
        steps.push({ agent: "content-factory (blog)", status: "failed", output: (e as Error).message, durationMs: Date.now() - step2Start });
      }

      // Step 3: Social Pack
      const step3Start = Date.now();
      try {
        const socialResult = await generateSocialPack(topic);
        steps.push({
          agent: "content-factory (social)",
          status: "complete",
          output: socialResult.output.slice(0, 500) + "...",
          durationMs: Date.now() - step3Start,
        });
      } catch (e: unknown) {
        steps.push({ agent: "content-factory (social)", status: "failed", output: (e as Error).message, durationMs: Date.now() - step3Start });
      }
      break;
    }

    case "lead-machine": {
      // Step 1: Competitor X-Ray
      const step1Start = Date.now();
      try {
        const xrayResult = await competitorXRay(
          params.competitors || ["competitor1.com"],
          business
        );
        steps.push({
          agent: "seo-dominator (x-ray)",
          status: "complete",
          output: xrayResult.output.slice(0, 500) + "...",
          durationMs: Date.now() - step1Start,
        });
      } catch (e: unknown) {
        steps.push({ agent: "seo-dominator (x-ray)", status: "failed", output: (e as Error).message, durationMs: Date.now() - step1Start });
      }

      // Step 2: Close Sequence
      const step2Start = Date.now();
      try {
        const closeResult = await generateCloseSequence(
          params.leadName || "Target Lead",
          params.company || "Target Company"
        );
        steps.push({
          agent: "closer",
          status: "complete",
          output: closeResult.output.slice(0, 500) + "...",
          durationMs: Date.now() - step2Start,
        });
      } catch (e: unknown) {
        steps.push({ agent: "closer", status: "failed", output: (e as Error).message, durationMs: Date.now() - step2Start });
      }

      // Step 3: Email Sequence
      const step3Start = Date.now();
      try {
        const emailResult = await generateEmailSequence(
          params.product || business,
          params.audience || "B2B SaaS founders"
        );
        steps.push({
          agent: "content-factory (email)",
          status: "complete",
          output: emailResult.output.slice(0, 500) + "...",
          durationMs: Date.now() - step3Start,
        });
      } catch (e: unknown) {
        steps.push({ agent: "content-factory (email)", status: "failed", output: (e as Error).message, durationMs: Date.now() - step3Start });
      }
      break;
    }

    case "brand-launch": {
      const contentTypes = [
        { action: "blog", label: "content-factory (blog)", fn: () => generateBlogPost(topic, [topic]) },
        { action: "email", label: "content-factory (email)", fn: () => generateEmailSequence(params.product || business, params.audience || "target audience") },
        { action: "social", label: "content-factory (social)", fn: () => generateSocialPack(topic) },
      ];

      for (const ct of contentTypes) {
        const start = Date.now();
        try {
          const result = await ct.fn();
          steps.push({ agent: ct.label, status: "complete", output: result.output.slice(0, 500) + "...", durationMs: Date.now() - start });
        } catch (e: unknown) {
          steps.push({ agent: ct.label, status: "failed", output: (e as Error).message, durationMs: Date.now() - start });
        }
      }
      break;
    }

    case "full-agency": {
      // Run everything
      const agents = [
        { label: "seo-dominator", fn: () => contentGapKiller(params.domain || "yourdomain.com", params.competitors || [], params.niche || topic) },
        { label: "content-factory (blog)", fn: () => generateBlogPost(topic, [topic]) },
        { label: "content-factory (social)", fn: () => generateSocialPack(topic) },
        { label: "closer", fn: () => generateCloseSequence(params.leadName || "Lead", params.company || "Company") },
      ];

      for (const agent of agents) {
        const start = Date.now();
        try {
          const result = await agent.fn();
          steps.push({ agent: agent.label, status: "complete", output: result.output.slice(0, 500) + "...", durationMs: Date.now() - start });
        } catch (e: unknown) {
          steps.push({ agent: agent.label, status: "failed", output: (e as Error).message, durationMs: Date.now() - start });
        }
      }
      break;
    }

    default:
      steps.push({ agent: "orchestrator", status: "failed", output: `Unknown pipeline: ${pipelineId}`, durationMs: 0 });
  }

  const totalDurationMs = Date.now() - totalStart;
  const success = steps.every((s) => s.status === "complete");

  await remember(`Pipeline ${pipelineId} executed: ${steps.length} steps, ${success ? "all succeeded" : "some failed"}, ${totalDurationMs}ms`);

  return { pipeline: pipelineId, steps, totalDurationMs, success };
}
