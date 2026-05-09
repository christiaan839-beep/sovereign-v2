// STATUS: ahead-of-consumers — see docs/audits/codebase-audit.md (Tier B).
// pre-typed agent schemas; agents use Zod inline.
/**
 * SOVEREIGN MATRIX — Reusable Agent Input Schemas
 *
 * Zod schemas for common agent input patterns.
 * Use with the `schema` field in AgentConfig to get automatic
 * validation before the handler runs.
 *
 * Usage:
 *   import { leadGenSchema } from "@/lib/agent-schemas";
 *
 *   export const POST = createAgentRoute({
 *     name: "leads",
 *     schema: leadGenSchema,
 *     handler: async ({ input }) => { ... },
 *   });
 */

import { z } from "zod";

// ── Primitive Schemas ──

export const urlSchema = z.string().url("Must be a valid URL").max(2048, "URL too long");
export const emailSchema = z.string().email("Must be a valid email address");
export const nicheSchema = z.string().min(2, "Niche is too short").max(200, "Niche is too long");
export const locationSchema = z.string().min(2, "Location is too short").max(200, "Location is too long");
export const promptSchema = z.string().min(3, "Prompt is too short").max(50_000, "Prompt exceeds maximum length");
export const contentSchema = z.string().min(10, "Content is too short").max(100_000, "Content exceeds maximum length");

// ── Common Agent Input Schemas ──

/** Lead generation: niche + optional location/count */
export const leadGenSchema = z.object({
  niche: nicheSchema,
  location: locationSchema.optional(),
  count: z.number().int().min(1).max(50).optional(),
  prompt: promptSchema.optional(),
});

/** SEO/site analysis: URL is required */
export const siteAnalysisSchema = z.object({
  url: urlSchema,
  prompt: promptSchema.optional(),
  depth: z.enum(["quick", "standard", "deep"]).optional(),
});

/** Content generation: topic + optional style/length */
export const contentGenSchema = z.object({
  prompt: promptSchema,
  topic: z.string().min(2).max(500).optional(),
  style: z.string().max(100).optional(),
  length: z.enum(["short", "medium", "long", "custom"]).optional(),
  wordCount: z.number().int().min(50).max(10_000).optional(),
});

/** Email sequence: target + optional tone */
export const emailSequenceSchema = z.object({
  prompt: promptSchema,
  target: z.string().min(2).max(500).optional(),
  tone: z.string().max(100).optional(),
  steps: z.number().int().min(1).max(10).optional(),
});

/** Competitor/brand analysis: company or URL */
export const competitorSchema = z.object({
  company: z.string().min(1).max(200).optional(),
  url: urlSchema.optional(),
  prompt: promptSchema.optional(),
}).refine(
  (data) => data.company || data.url || data.prompt,
  { message: "Provide at least a company name, URL, or prompt" }
);

/** Generic prompt-only agent */
export const promptOnlySchema = z.object({
  prompt: promptSchema,
});

/** Vision/image analysis */
export const visionSchema = z.object({
  url: urlSchema.optional(),
  image: z.string().optional(),
  prompt: promptSchema.optional(),
}).refine(
  (data) => data.url || data.image || data.prompt,
  { message: "Provide an image URL, base64 image, or prompt" }
);
