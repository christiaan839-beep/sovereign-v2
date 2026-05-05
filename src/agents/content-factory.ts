import { ai } from "@/lib/ai";
import { runSwarm } from "@/lib/swarm";
import { remember } from "@/lib/memory";
import { ANTI_SLOP_RULES, PLATFORM_RULES } from "@/lib/content-engine";
import type { AgentResult } from "@/types";

// ============================================================
// Content Factory Agent
//
// Mass-produce high-quality marketing content:
// - SEO blog posts
// - Email drip sequences
// - Social media content packs
// - Video scripts
// ============================================================

/** Generate a full SEO-optimized blog post using Swarm for quality */
export async function generateBlogPost(
  topic: string,
  keywords: string[],
  tone: string = "authoritative",
): Promise<AgentResult> {
  const keywordList = keywords.join(", ");

  const result = await runSwarm({
    goal: `Write a comprehensive, SEO-optimized blog post.

TOPIC: ${topic}
PRIMARY KEYWORDS: ${keywordList}
TONE: ${tone}
TARGET LENGTH: 1500-2000 words

Structure:
1. TITLE (include primary keyword, max 60 chars, power word included)
2. META DESCRIPTION (max 155 chars, includes keyword, has a CTA)
3. INTRODUCTION (hook the reader with a bold claim or question — 100 words)
4. BODY (5-7 sections with H2 headings, each keyword-optimized)
   - Use short paragraphs (2-3 sentences max)
   - Include bullet points or numbered lists
   - Add internal linking suggestions [INTERNAL LINK: topic]
   - Natural keyword density (1-2% for primary, 0.5% for secondary)
5. CONCLUSION (summarize + CTA — 100 words)
6. FAQ SECTION (3 questions, structured for featured snippets)

Write the FULL article, not an outline. Every word must be publication-ready.`,

    creatorSystem: `You are a content marketing writer who has generated 500M+ organic impressions. You write with authority and clarity. Every sentence serves a purpose: educate, persuade, or build trust. You never use filler phrases. Your content reads like a conversation with a brilliant mentor.

${ANTI_SLOP_RULES}

${PLATFORM_RULES.blog}`,

    criticSystem: `You are a senior content editor and SEO specialist. Your job is to KILL AI SLOP. Check:
- Does any sentence start with "In today's" or "In the ever-evolving"? DELETE IT.
- Is the keyword placement natural? Does the headline pass the "would I click this?" test?
- Does the content sound like a real person wrote it, or a language model regurgitating patterns?
- Is the content genuinely useful (not generic)? Is the reading level accessible (Grade 8)?
- Would this rank on page 1 for the target keyword?
- Are there specific numbers, examples, and data points — or just vague claims?

${ANTI_SLOP_RULES}`,

    maxRounds: 3,
    // Free OSS via NIM (Nemotron Ultra 253B). Previously paid Claude Sonnet
    // ran 3 rounds × 2 (creator + critic) = 6 paid calls per blog post.
    model: "nim",
  });

  await remember(`Blog post: ${topic} | Keywords: ${keywordList}`);

  return {
    success: true,
    agent: "content-factory",
    output: result.finalOutput,
    timestamp: new Date().toISOString(),
  };
}

/** Generate a multi-step email drip sequence */
export async function generateEmailSequence(
  product: string,
  audience: string,
  steps: number = 5,
): Promise<AgentResult> {
  const output = await ai(
    `Create a ${steps}-step email drip sequence.

PRODUCT: ${product}
AUDIENCE: ${audience}
SEQUENCE LENGTH: ${steps} emails

For EACH email provide:
1. EMAIL # and SEND TIMING (e.g., "Email 1 — Immediately after signup")
2. SUBJECT LINE (A/B: provide 2 options, one curiosity-based, one benefit-based)
3. PREVIEW TEXT (max 90 chars)
4. BODY COPY (300-500 words, ready to paste into your ESP)
5. CTA (button text + link description)
6. PSYCHOLOGY PRINCIPLE used (reciprocity, social proof, scarcity, etc.)
7. KEY METRIC TO TRACK

Sequence Arc:
- Email 1: Welcome + immediate value delivery
- Email 2: Story/case study (build trust)
- Email 3: Education (position as authority)
- Email 4: Social proof + soft pitch
- Email 5: Urgency/scarcity close

Every email must stand alone (reader may open any one) but also build narrative momentum.`,
    {
      taskType: "content",
      system: `You are an email marketing strategist who has written sequences generating $10M+ in revenue. You know that subject lines are 80% of the battle. Your emails feel personal, never corporate. You use psychological triggers ethically and effectively.

${ANTI_SLOP_RULES}

${PLATFORM_RULES.newsletter}`,
      maxTokens: 3500,
    },
  );

  await remember(`Email sequence for ${product}: ${output.slice(0, 300)}`);

  return {
    success: true,
    agent: "content-factory",
    output,
    timestamp: new Date().toISOString(),
  };
}

/** Generate a multi-platform social media content pack */
export async function generateSocialPack(
  topic: string,
  platforms: string[] = ["instagram", "linkedin", "twitter", "tiktok"],
): Promise<AgentResult> {
  const platformList = platforms.join(", ");

  const output = await ai(
    `Create a social media content pack for the following topic.

TOPIC: ${topic}
PLATFORMS: ${platformList}

For EACH platform, generate 3 posts (total: ${platforms.length * 3} posts):

INSTAGRAM:
- Caption (150-300 words, storytelling format, line breaks for readability)
- 30 hashtags (mix of niche, medium, and broad)
- Carousel slide text (5 slides: hook / problem / solution / proof / CTA)
- Reel script (15 seconds, hook-first)

LINKEDIN:
- Post (200-400 words, start with a bold one-liner hook)
- 5 relevant hashtags
- Document/carousel outline (5 slide headlines)

TWITTER/X:
- Thread (5 tweets, each <280 chars, numbered)
- Single viral tweet (hot take or insight)
- Quote tweet template

TIKTOK:
- Script (30 seconds: hook / body / CTA)
- Text-on-screen overlay sequence
- Trending sound suggestion (describe the vibe)

Each post should feel native to its platform — no copy-paste across channels.`,
    {
      taskType: "content",
      system: `You are a social media strategist who has grown accounts from 0 to 1M followers. Each platform has its own language: Instagram rewards storytelling, LinkedIn rewards authority, Twitter rewards wit, TikTok rewards authenticity. You never sound like an AI.

${ANTI_SLOP_RULES}

${platforms.includes("instagram") ? PLATFORM_RULES.instagram : ""}
${platforms.includes("linkedin") ? PLATFORM_RULES.linkedin : ""}
${platforms.includes("twitter") ? PLATFORM_RULES.twitter : ""}
${platforms.includes("tiktok") ? PLATFORM_RULES.tiktok : ""}`,
      maxTokens: 3500,
    },
  );

  await remember(`Social pack for ${topic}: ${output.slice(0, 300)}`);

  return {
    success: true,
    agent: "content-factory",
    output,
    timestamp: new Date().toISOString(),
  };
}

/** Generate a timestamped video script with visual direction */
export async function generateVideoScript(
  topic: string,
  duration: string = "60 seconds",
  style: string = "educational",
): Promise<AgentResult> {
  const output = await ai(
    `Create a professional video script.

TOPIC: ${topic}
DURATION: ${duration}
STYLE: ${style}

Format as a timestamped production script:

1. TITLE & DESCRIPTION
   - Video title (YouTube-optimized, max 60 chars)
   - Description (150 words, SEO-optimized, includes timestamps)
   - 10 tags/keywords

2. TIMESTAMPED SCRIPT
   For each segment:
   [00:00 - 00:05] HOOK
   - SPEAKER: "Exact dialogue"
   - VISUAL: What's on screen (B-roll, text overlay, graphic)
   - AUDIO: Background music / SFX notes
   - MOTION: Camera movement or animation direction

   Continue for every 5-10 second segment until end.

3. THUMBNAIL CONCEPT
   - Text overlay (max 4 words)
   - Background visual description
   - Color scheme
   - Expression/emotion to convey

4. POST-PRODUCTION NOTES
   - Cut rhythm (fast/medium/slow)
   - Color grading direction
   - Lower third text suggestions
   - End screen elements

Make the hook so compelling that viewers CANNOT scroll past.`,
    {
      taskType: "content",
      system: `You are a video director and scriptwriter who has produced content with 100M+ cumulative views. You know that the first 3 seconds determine everything. Your scripts are visual — you think in shots, not just words. Every second of dead air is a viewer lost.

${ANTI_SLOP_RULES}

${PLATFORM_RULES.youtube}`,
      maxTokens: 3000,
    },
  );

  await remember(`Video script: ${topic} (${duration})`);

  return {
    success: true,
    agent: "content-factory",
    output,
    timestamp: new Date().toISOString(),
  };
}
