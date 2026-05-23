import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { getNimKey } from "@/lib/nvidia";

/**
 * CREATIVE DIRECTOR — Kimi K2.5 MoE model for creative content.
 * Generates ad copy, social campaigns, brand storytelling, video scripts.
 */

import { outboundFetchAsResponse } from "@/lib/outbound-fetch";

const STYLE_GUIDES: Record<string, string> = {
  professional:
    "Polished, authoritative, data-driven. Think McKinsey meets Apple.",
  bold: "Provocative, disruptive, attention-grabbing. Think Ogilvy meets Nike.",
  conversational: "Warm, relatable, human. Think Mailchimp meets Innocent.",
  luxury: "Exclusive, refined, aspirational.",
  tech: "Clean, precise, innovative. Think Stripe meets Vercel.",
};

const PLATFORM_GUIDES: Record<string, string> = {
  general: "Create versatile content adaptable to any channel.",
  twitter: "Max 280 characters per post. Punchy, engagement-focused.",
  linkedin: "Professional tone, thought-leadership, 150-300 words.",
  instagram: "Visual-first descriptions, emoji-friendly, 125-150 words.",
  email:
    "Subject line + body. Clear CTA. Personalization tokens like {firstName}.",
};

const schema = z.object({
  brief: z.string().min(3, "Creative brief is required").max(2000),
  style: z
    .enum(["professional", "bold", "conversational", "luxury", "tech"])
    .optional()
    .default("professional"),
  platform: z
    .enum(["general", "twitter", "linkedin", "instagram", "email"])
    .optional()
    .default("general"),
  count: z.number().int().min(1).max(10).optional().default(3),
  prompt: z.string().max(5000).optional(),
});

export const POST = createAgentRoute({
  name: "creative-director",
  schema,
  // Wave 116 M3 batch 10: memory hooks. Per-brief style+platform variations
  // compound — last quarter's "bold + twitter" creatives inform what
  // angles already shipped so the model produces fresh variants.
  memory: {
    search: {
      query: (input) =>
        `creative ${input.style ?? "any"} ${input.platform ?? "any"} ${String(input.brief ?? "").slice(0, 80)}`,
      limit: 2,
    },
    store: {
      extract: (result) => {
        const r = result as { variations?: Array<{ hook?: string }> };
        const hooks = (r.variations ?? [])
          .slice(0, 3)
          .map((v) => v.hook?.slice(0, 80) ?? "")
          .filter(Boolean)
          .join(" | ");
        return hooks || null;
      },
      metadata: (input) => ({
        style: typeof input.style === "string" ? input.style : "",
        platform: typeof input.platform === "string" ? input.platform : "",
        kind: "creative-director",
      }),
    },
  },
  handler: async ({ input }) => {
    const { brief, style, platform, count } = input as z.infer<typeof schema>;
    const start = Date.now();

    const res = await outboundFetchAsResponse(
      "https://integrate.api.nvidia.com/v1/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${await getNimKey()}`,
        },
        body: JSON.stringify({
          model: "moonshotai/kimi-k2.5",
          messages: [
            {
              role: "system",
              content: `You are a Creative Director. Style: ${STYLE_GUIDES[style]}. Platform: ${PLATFORM_GUIDES[platform]}. Generate exactly ${count} creative variations. Each should be distinct in approach.`,
            },
            { role: "user", content: `Brief: ${brief}` },
          ],
          max_tokens: 1200,
          temperature: 0.8,
        }),
      },
      {
        ruleId: "agents.creative-director.route.1",
        allowedHosts: ["integrate.api.nvidia.com"],
      },
    );

    if (!res.ok) throw new Error(`NIM API returned ${res.status}`);
    const data = await res.json();

    return {
      success: true,
      model: "Kimi K2.5",
      style,
      platform,
      creatives: data?.choices?.[0]?.message?.content || "",
      duration_ms: Date.now() - start,
    };
  },
});
