import { ai } from "@/lib/ai";
import { runSwarm } from "@/lib/swarm";
import { remember } from "@/lib/memory";
import type { AgentResult } from "@/types";

// ============================================================
// Design Agency Agent
//
// Replaces the core output of a design agency:
// - Landing page wireframe briefs
// - Brand identity systems
// - UI/UX specifications
// ============================================================

/** Generate a full landing page brief with wireframe spec */
export async function generateLandingPageBrief(
  product: string,
  audience: string,
  goal: string = "conversions",
): Promise<AgentResult> {
  const result = await runSwarm({
    goal: `Create a complete landing page wireframe brief for:

PRODUCT: ${product}
TARGET AUDIENCE: ${audience}
PRIMARY GOAL: ${goal}

Provide a detailed, section-by-section wireframe specification including:

1. HERO SECTION
   - Headline (max 8 words, power words)
   - Subheadline (max 20 words)
   - Primary CTA button text + color
   - Background treatment (gradient, image direction, video)
   - Social proof element (logos, stats, testimonials)

2. PROBLEM SECTION
   - Section headline
   - 3 pain points with icons
   - Emotional hook copy

3. SOLUTION SECTION
   - How the product solves each pain point
   - Feature/benefit grid (3-4 items)
   - Each with icon, title, description

4. SOCIAL PROOF SECTION
   - Testimonial format (card, slider, grid)
   - 3 sample testimonials with name/role
   - Trust badges / logos / stats bar

5. PRICING SECTION
   - Pricing tier names (if applicable)
   - Feature comparison
   - CTA for each tier
   - Recommended/popular badge placement

6. FAQ SECTION
   - 5 anticipated objections as questions
   - Concise answers that overcome each

7. FINAL CTA SECTION
   - Urgency headline
   - Final value proposition
   - Button text + secondary CTA

8. DESIGN SYSTEM
   - Color palette (5 hex codes: primary, secondary, accent, background, text)
   - Typography (heading font, body font — Google Fonts)
   - Border radius preference (sharp, rounded, pill)
   - Shadow style (none, subtle, dramatic)
   - Animation notes (scroll reveals, hover effects, parallax)`,

    creatorSystem: `You are a world-class landing page designer who has built pages that convert at 15%+. You think in visual hierarchy: the eye must flow naturally from headline → social proof → CTA. Every word earns its place.`,

    criticSystem: `You are a conversion rate optimization (CRO) expert. Ruthlessly evaluate: Does every section reduce friction? Is the value proposition crystal clear in 3 seconds? Are the CTAs positioned at moments of peak persuasion? Does the design system feel premium, not corporate?`,

    maxRounds: 3,
    // Free OSS via NIM (Nemotron Ultra 253B). 3-round swarm × Claude Sonnet
    // was the most expensive single agent on the platform.
    model: "nim",
  });

  await remember(
    `Landing page brief for ${product}: ${result.finalOutput.slice(0, 300)}`,
  );

  return {
    success: true,
    agent: "designer",
    output: result.finalOutput,
    timestamp: new Date().toISOString(),
  };
}

/** Generate a complete brand identity system */
export async function generateBrandIdentity(
  businessName: string,
  industry: string,
  personality: string,
  targetAudience: string = "",
): Promise<AgentResult> {
  const result = await runSwarm({
    goal: `Create a complete brand identity system for:

BUSINESS: ${businessName}
INDUSTRY: ${industry}
PERSONALITY: ${personality}
${targetAudience ? `TARGET AUDIENCE: ${targetAudience}` : ""}

Deliver a comprehensive brand identity document:

1. BRAND ESSENCE
   - Mission statement (1 sentence)
   - Vision statement (1 sentence)
   - Brand promise (what the customer always gets)
   - Tagline / Slogan (max 5 words)

2. VISUAL IDENTITY
   - Logo direction (describe the concept, shape, style — minimalist/bold/organic/geometric)
   - Primary color (#hex) + meaning/psychology
   - Secondary color (#hex)
   - Accent color (#hex)
   - Background color (#hex)
   - Text color (#hex)
   - Gradient direction (if applicable)

3. TYPOGRAPHY
   - Heading font (Google Fonts name) + weight
   - Body font (Google Fonts name) + weight
   - Accent/Display font (Google Fonts name)
   - Font size scale (sm, base, lg, xl, 2xl, 3xl)

4. TONE OF VOICE
   - 5 words that describe the brand voice
   - 5 words the brand NEVER sounds like
   - Sample social media post (Instagram)
   - Sample email subject line
   - Sample ad headline

5. PHOTOGRAPHY & IMAGERY STYLE
   - Color treatment (warm, cool, muted, vibrant, B&W)
   - Subject matter guidelines
   - Composition preferences
   - Mood board keywords (5 words)

6. ICONOGRAPHY
   - Style (outline, filled, duotone)
   - Stroke weight
   - Corner style (sharp, rounded)

7. SPACING & LAYOUT PRINCIPLES
   - Grid type (12-col, asymmetric)
   - Whitespace philosophy (generous, compact)
   - Card style (flat, elevated, glassmorphic)`,

    creatorSystem: `You are a brand strategist and visual designer who has created identities for $100M+ brands. Your designs feel alive — they have personality, not just aesthetics. Every color choice has a psychological reason. Every font pairing creates a specific emotional response.`,

    criticSystem: `You are a brand consistency auditor. Check: Does every element reinforce the same personality? Would this identity stand out in a crowded market? Is it versatile enough for web, mobile, print, and social? Does the color palette have enough contrast for accessibility?`,

    maxRounds: 3,
    model: "nim",
  });

  await remember(
    `Brand identity for ${businessName}: ${result.finalOutput.slice(0, 300)}`,
  );

  return {
    success: true,
    agent: "designer",
    output: result.finalOutput,
    timestamp: new Date().toISOString(),
  };
}

/** Generate detailed UI/UX specifications */
export async function generateUISpec(
  appDescription: string,
  screens: string[],
  style: string = "dark glassmorphic",
): Promise<AgentResult> {
  const screenList = screens.map((s, i) => `${i + 1}. ${s}`).join("\n");

  const output = await ai(
    `Create detailed UI/UX specifications for a web application.

APP DESCRIPTION: ${appDescription}
DESIGN STYLE: ${style}

SCREENS TO DESIGN:
${screenList}

For EACH screen provide:

1. SCREEN NAME & PURPOSE
2. LAYOUT (header, sidebar, main content — with approximate proportions)
3. COMPONENTS LIST (every UI element on the screen)
   - For each component: type (button, card, input, table, chart, etc.), position, content, interaction state
4. USER FLOW (what action does the user take on this screen, where do they go next)
5. MICRO-INTERACTIONS
   - Hover effects
   - Loading states
   - Success/error feedback
   - Transitions between screens
6. RESPONSIVE BEHAVIOR (mobile vs desktop differences)
7. ACCESSIBILITY NOTES (ARIA labels, keyboard navigation, color contrast)

8. CODE HINTS
   - Recommended CSS approach for key layouts
   - Component hierarchy (parent → child structure)
   - State management needs

Make every specification specific enough that a developer can build the screen without asking any follow-up questions.`,
    {
      taskType: "creative",
      system: `You are a senior UI/UX designer and front-end architect. You think in component hierarchies, interaction patterns, and user psychology. Your specs are so detailed that junior developers can build pixel-perfect implementations from them alone. You favor ${style} design patterns.`,
      maxTokens: 3500,
    },
  );

  await remember(`UI/UX spec for ${appDescription}: ${output.slice(0, 300)}`);

  return {
    success: true,
    agent: "designer",
    output,
    timestamp: new Date().toISOString(),
  };
}
