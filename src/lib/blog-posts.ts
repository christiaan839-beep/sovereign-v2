/**
 * Single source of truth for /blog content.
 *
 * Lived inline in src/app/blog/page.tsx until we added the
 * /feed.xml RSS endpoint — at which point a server route also
 * needed read access. Extracted here so both surfaces stay in sync.
 *
 * No DB: blog content is part of the marketing repo (hand-edited
 * by the team). The /api/blog endpoint that exists serves a
 * superset that includes DB-stored editorial posts when present;
 * this static list is the always-on baseline.
 */

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  readTime: string;
  /** Human-readable date string, e.g. "Apr 9, 2026". Also used for RSS pubDate. */
  date: string;
  featured?: boolean;
}

export const BLOG_POSTS: BlogPost[] = [
  {
    slug: "why-agencies-are-dying",
    title: "Why Marketing Agencies Are Dying — And What Replaces Them",
    excerpt:
      "The agency model relies on one assumption: you need humans. But autonomous AI systems are now outperforming full teams at 3% of the cost. Here's why the next wave of agencies will have zero employees.",
    category: "Industry",
    readTime: "8 min",
    date: "Mar 12, 2026",
    featured: true,
  },
  {
    slug: "autonomous-marketing-playbook",
    title:
      "The Autonomous Marketing Playbook: How to Run $30k/mo in Ads Without Touching a Button",
    excerpt:
      "Set your ROAS threshold, deploy your campaigns, and let agents handle the rest — killing losers, scaling winners, and writing new copy 24/7.",
    category: "Guide",
    readTime: "12 min",
    date: "Mar 10, 2026",
    featured: true,
  },
  {
    slug: "swarm-intelligence-marketing",
    title:
      "Swarm Intelligence: Why Two AI Agents Write Better Copy Than Any Human",
    excerpt:
      "When a Creator agent writes copy and a Critic agent tears it apart, the result is copy that scores 9+/10 consistently. Here's the psychology behind why debate produces better output.",
    category: "Deep Dive",
    readTime: "6 min",
    date: "Mar 8, 2026",
  },
  {
    slug: "ai-replacing-10k-retainers",
    title: "How AI Agents Are Replacing $5k/mo Agency Retainers",
    excerpt:
      "What happens when a $199/mo platform does the same work as a $5,000/mo agency retainer? Three use cases that show the shift.",
    category: "Analysis",
    readTime: "10 min",
    date: "Mar 5, 2026",
  },
  {
    slug: "ai-vector-memory",
    title: "AI Memory: The Vector System That Never Forgets a Winning Pattern",
    excerpt:
      "Every successful campaign pattern is stored in vector memory. Every future campaign starts smarter. This is how compound intelligence works — and why it can't be replicated by humans.",
    category: "Technology",
    readTime: "7 min",
    date: "Mar 2, 2026",
  },
  {
    slug: "white-label-ai-agency",
    title: "Build a White-Label AI Agency With Zero Technical Skills",
    excerpt:
      "Use Sovereign Matrix as your agency backend. Service 10 clients at $99/mo each on a $499/mo Enterprise plan. Zero code, zero hiring.",
    category: "Business",
    readTime: "9 min",
    date: "Feb 28, 2026",
  },
  {
    slug: "ai-agents-vs-chatbots",
    title:
      "AI Agents vs Chatbots: Why the Difference Matters for Your Business",
    excerpt:
      "ChatGPT is a chatbot. It answers questions. An AI agent plans, executes, retries, and delivers results. Here's why the distinction changes everything.",
    category: "Guide",
    readTime: "6 min",
    date: "Apr 5, 2026",
    featured: true,
  },
  {
    slug: "hubspot-alternative-for-agencies",
    title: "The Best HubSpot Alternative for Growth-Stage Agencies in 2026",
    excerpt:
      "HubSpot costs $890/mo for marketing automation. Sovereign Matrix gives you 130 autonomous agents for $199/mo — and they actually execute, not just automate.",
    category: "Comparison",
    readTime: "8 min",
    date: "Apr 3, 2026",
  },
  {
    slug: "consensus-verification-ai",
    title: "Why One AI Model Isn’t Enough: The Case for Consensus Verification",
    excerpt:
      "When 4 independent models generate, critique, and synthesize an answer, accuracy jumps 22.8 percentage points. Here's how multi-model consensus works and why it matters.",
    category: "Technology",
    readTime: "7 min",
    date: "Apr 1, 2026",
  },
  {
    slug: "project-glasswing-what-it-means",
    title: "Project Glasswing: What Anthropic’s Mythos Means for AI Security",
    excerpt:
      "Claude Mythos Preview found zero-days in OpenBSD, FFmpeg, and the Linux kernel. When frontier models can hack autonomously, guardrails aren't optional — they're infrastructure.",
    category: "Industry",
    readTime: "10 min",
    date: "Apr 7, 2026",
    featured: true,
  },
  {
    slug: "ai-agents-for-ecommerce",
    title:
      "How E-Commerce Stores Use AI Agents to Write 10,000 Product Descriptions in a Day",
    excerpt:
      "Manual product descriptions don’t scale. AI agents generate SEO-optimized, brand-voiced descriptions for entire catalogs — while monitoring competitor prices in real time.",
    category: "Use Case",
    readTime: "7 min",
    date: "Apr 8, 2026",
  },
  {
    slug: "fintech-compliance-ai",
    title: "Why Fintech Companies Need Air-Gapped AI — Not Cloud Chatbots",
    excerpt:
      "Fiduciary data can’t touch the cloud. Local execution via Ollama + 5-layer safety pipeline = the only architecture that passes compliance audits.",
    category: "Industry",
    readTime: "9 min",
    date: "Apr 8, 2026",
  },
  {
    slug: "ai-recruiting-agents",
    title:
      "From 1,000 Resumes to 10 Interviews: How AI Agents Transform Recruiting",
    excerpt:
      "Screening 1,000 applicants takes a human recruiter 2 weeks. AI agents do it in 4 minutes — with less bias and better pattern matching.",
    category: "Use Case",
    readTime: "6 min",
    date: "Apr 9, 2026",
  },
  {
    slug: "flat-pricing-vs-credits",
    title: "Why Credit-Based AI Pricing Is a Trap (And What to Use Instead)",
    excerpt:
      "CIOs underestimate AI costs by 1,000%. Credits expire, overages multiply, and per-token billing makes budgeting impossible. Flat pricing fixes all of it.",
    category: "Analysis",
    readTime: "8 min",
    date: "Apr 9, 2026",
    featured: true,
  },
  {
    slug: "multi-model-consensus",
    title: "Single Model vs Multi-Model Consensus: Why 4 Models Beat 1",
    excerpt:
      "When you run the same query through 4 independent models and take the consensus, accuracy jumps 22.8 percentage points. Here’s the data.",
    category: "Technology",
    readTime: "7 min",
    date: "Apr 9, 2026",
  },
];

/**
 * Parse the human-readable date strings ("Apr 9, 2026") into a Date.
 * Used by the RSS feed for pubDate; falls back to "now" if the string
 * doesn't parse so we never emit invalid RFC-822 timestamps.
 */
export function parsePostDate(s: string): Date {
  const d = new Date(s);
  return isNaN(d.getTime()) ? new Date() : d;
}
