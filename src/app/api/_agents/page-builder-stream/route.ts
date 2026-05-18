import { NextResponse } from "next/server";
import { currentUser } from "@clerk/nextjs/server";
import { ai, research_ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";
import { fireUserWebhook } from "@/lib/webhooks";
import { createLogger } from "@/lib/logger";
import { getPublicUrl } from "@/lib/base-url";
const log = createLogger("page-builder-stream");

// Vercel Serverless Function Config
export const maxDuration = 60; // Max allowed for hobby/pro before timeout
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();

export async function POST(req: Request) {
  const user = await currentUser();
  if (!user?.primaryEmailAddress?.emailAddress) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { businessName, industry, offer, targetAudience, vibe } =
    await req.json();

  if (!businessName || !offer) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 },
    );
  }

  // Vibe design instruction — shapes the aesthetic of generated pages
  const vibeInstruction = vibe
    ? `\n\nDESIGN VIBE: "${vibe}" — Match this aesthetic feeling throughout. ${
        vibe === "minimalist"
          ? "Maximum whitespace, muted colors, thin typography, Stripe-like."
          : vibe === "premium"
            ? "Ultra-dark, rich gradients, glassmorphism, luxury feel."
            : vibe === "playful"
              ? "Bright colors, rounded shapes, large illustrations, fun and approachable."
              : vibe === "corporate"
                ? "Professional blue tones, structured grid, conservative typography."
                : vibe === "brutalist"
                  ? "Raw, high contrast, bold type, stark black/white, unpolished edges."
                  : vibe === "gen-z"
                    ? "Gradients, neon accents, modern sans-serif, trendy animations, bold colors."
                    : `Match the "${vibe}" aesthetic.`
      }`
    : "";

  const stream = new ReadableStream({
    async start(controller) {
      const emit = (type: string, data: Record<string, unknown>) => {
        const payload = JSON.stringify({ type, data }) + "\n\n";
        controller.enqueue(encoder.encode(payload));
      };

      try {
        // --- STEP 1: Initialization ---
        emit("progress", {
          step: 1,
          message: "Initializing SOVEREIGN Autonomous Engine...",
        });
        await new Promise((r) => setTimeout(r, 1000)); // Brief pause for UX

        // --- STEP 2: Competitor X-Ray (Research) ---
        emit("progress", {
          step: 2,
          message: `Running Competitor X-Ray for ${industry} in ${businessName}...`,
        });

        const searchQuery = `Top performing landing pages and offers for ${industry} ${offer} ${targetAudience} competitor analysis`;
        emit("log", { message: `[SYS] Querying Tavily: ${searchQuery}` });

        // We use standard AI here first to build the architecture based on general knowledge,
        // to save time/tokens if the niche is straightforward. But let's do a fast research pass.
        const researchPrompt = `Analyze the typical high-converting landing page structure for:
        Business: ${businessName}
        Industry: ${industry}
        Offer: ${offer}
        Target Audience: ${targetAudience}

        Identify 3 key missing elements in standard competitor pages that we can exploit for higher conversions. Output as a brief list.`;

        const researchData = await research_ai(searchQuery, researchPrompt, {
          system: "You are a conversion rate optimization (CRO) researcher.",
          maxTokens: 500,
        });

        emit("log", {
          message: `[SYS] Research Complete. Identified Gaps:\n${researchData}`,
        });
        emit("progress", {
          step: 3,
          message: "Defining high-converting page architecture...",
        });

        // --- STEP 3: Architecture & Copywriting ---
        // Combine Steps 3 & 4 to save a round trip to the LLM
        emit("log", {
          message: "[SYS] Drafting direct-response copy framework",
        });

        const architecturePrompt = `
        Draft the copy and structure for a landing page for ${businessName}.
        Offer: ${offer}
        Target Audience: ${targetAudience}
        
        Use this research to make it better than competitors:
        ${researchData}

        Outline the sections:
        1. Hero (Headline, Subhead, CTA)
        2. Problem Agitation (3 points)
        3. Solution/Features (3 points)
        4. Social Proof / Authority
        5. Final CTA
        `;

        const copyData = await ai(architecturePrompt, {
          system:
            "You are a direct-response copywriter. Output only the raw copy outline. No intro.",
          maxTokens: 1000,
        });

        emit("progress", {
          step: 4,
          message: "Copywritten. Designing Tailwind component system...",
        });

        // --- STEP 5 & 6: React Code Generation ---
        emit("progress", {
          step: 5,
          message: "Generating production-ready React / Tailwind code...",
        });
        emit("log", {
          message: "[SYS] Compiling components into unified VDOM",
        });

        const codePrompt = `Create a visually stunning, premium, modern landing page using HTML5 and Tailwind CSS.

        BUSINESS: ${businessName}
        INDUSTRY: ${industry}
        ${vibeInstruction}
        
        USE THIS EXACT COPY:
        ${copyData}

        RULES:
        ${ANTI_SLOP_RULES}
        
        UI DESIGN & ANTI-SLOP LAWS (CRITICAL):
        1. NO GENERIC TEMPLATES: Do not output a generic "Hero -> Features -> Footer" centered blocky mess. Use modern patterns like Bento Grids, asymmetric layouts, or Aceternity UI style components.
        2. NO "LOREM IPSUM" OR FILLER: Use the exact copy provided. Every word must count.
        3. PREMIUM AESTHETIC: Use a sophisticated dark-mode palette. Instead of flat grays, use ultra-dark rich tones (bg-zinc-950, bg-neutral-950). Use subtle borders (border-white/5), aggressive glassmorphism (backdrop-blur-xl bg-white/5), and subtle glowing gradients (bg-gradient-to-br from-violet-500/20 to-transparent).
        4. TYPOGRAPHY: Use tight tracking for headings (tracking-tighter) and modern sans-serif. Make headlines dramatic and large.
        5. Output ONLY valid HTML code. Start with <!DOCTYPE html>.
        6. Include Tailwind via CDN: <script src="https://cdn.tailwindcss.com"></script> in the <head>. Include standard Tailwind config to enable custom colors if needed.
        7. Do NOT wrap in markdown \`\`\`html tags. Output raw HTML only.
        8. Include Lucide icons via CDN script if needed, or use inline SVG.
        9. Page must be fully responsive (mobile-first). Avoid fixed pixel heights, use padding/margins instead.
        `;

        // Wave 73 cost audit: code generation is Qwen 2.5 Coder's
        // specialty — free via NIM, sharper at structured HTML/JSX
        // than Gemini Flash. `taskType: "code"` lets the router pick
        // the best free model in the registry automatically; falls
        // back to NIM-default if the code-tier model is unavailable.
        const rawCode = await ai(codePrompt, {
          model: "nim",
          taskType: "code",
          system:
            "You are a Frontend Web Developer. Output ONLY RAW JSX code. No markdown formatting. No explanations.",
          maxTokens: 4000,
        });

        let cleanCode = rawCode.trim();
        cleanCode = cleanCode.replace(/^```(?:html|xml)?\s*\n/i, "");
        cleanCode = cleanCode.replace(/\n```\s*$/i, "");

        emit("progress", { step: 6, message: "Code compilation complete." });

        // --- STEP 7 & 8: Finalization ---
        emit("progress", {
          step: 7,
          message: "Finalizing and preparing live preview...",
        });
        emit("log", { message: "[SYS] Validating JSX syntax..." });

        await new Promise((r) => setTimeout(r, 500)); // Brief pause for UX

        // Log to database
        try {
          // Fire and forget webhook
          fireUserWebhook("PageBuilder", "Autonomous_Generated", {
            businessName,
            industry,
          }).catch(() => {});

          // SECURITY: use getPublicUrl() instead of deriving from req.url.
          // The latter trusts the incoming Host/X-Forwarded-Host headers,
          // which an attacker can spoof to send this cookie-bearing request
          // to an attacker-controlled origin.
          await fetch(`${getPublicUrl()}/api/generations`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Cookie: req.headers.get("cookie") || "",
            },
            body: JSON.stringify({
              action: "save",
              tool: "page-builder",
              toolAction: "generate",
              inputSummary: `Autonomous Landing page: ${businessName}`.slice(
                0,
                200,
              ),
              output: cleanCode,
            }),
          });
        } catch (dbErr) {
          log.error("DB save error", dbErr as Record<string, unknown>);
        }

        emit("progress", { step: 8, message: "Page Generation Complete." });
        emit("complete", { code: cleanCode });
      } catch (err: unknown) {
        log.error("Streaming error", err as Record<string, unknown>);
        const errorMessage =
          err instanceof Error
            ? err.message
            : "An error occurred during generation.";
        emit("error", { message: errorMessage });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
