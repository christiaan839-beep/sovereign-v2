import Link from "next/link";
import { ArrowLeft, Clock, Calendar, Zap } from "lucide-react";

/**
 * BLOG POST PAGE — Renders individual blog articles.
 * Uses article metadata from the ARTICLES registry.
 * Content is pre-written for SEO (not AI-generated on each load).
 */

const ARTICLES: Record<string, { title: string; excerpt: string; category: string; readTime: string; date: string; content: string }> = {
  "why-agencies-are-dying": {
    title: "Why Marketing Agencies Are Dying — And What Replaces Them",
    excerpt: "The agency model relies on one assumption: you need humans.",
    category: "Industry",
    readTime: "8 min",
    date: "Mar 12, 2026",
    content: `The traditional marketing agency charges R100,000–R250,000 per month for a team that works 9-5, takes holidays, and forgets what worked last quarter. This model is dying — not because the people are bad, but because the economics no longer make sense.

Autonomous AI systems now outperform full teams at 3% of the cost. A single Sovereign Matrix deployment can find leads, write content, optimize SEO, make voice calls, and close deals — simultaneously, 24/7, with zero salary overhead.

The agencies that survive will be the ones that stop selling human hours and start selling AI-powered outcomes. The ones that don't will be replaced by a single person with a laptop and a Sovereign Node license.

This isn't a prediction. It's already happening. Three of our case studies — TechVentures (+226% revenue), Apex Fitness (+68% growth), and Digital Forge (+233% revenue) — achieved these results with zero human employees on the marketing team.

The question isn't whether AI will replace agencies. The question is whether you'll be the agency that does the replacing, or the one that gets replaced.`,
  },
  "autonomous-marketing-playbook": {
    title: "The Autonomous Marketing Playbook: How to Run R500k/mo in Ads Without Touching a Button",
    excerpt: "Ghost Mode changes everything.",
    category: "Guide",
    readTime: "12 min",
    date: "Mar 10, 2026",
    content: `Ghost Mode is the most powerful feature most Sovereign Matrix users haven't tried yet. It's the difference between using AI as a tool and deploying AI as a workforce.

Here's how it works: You set your ROAS threshold (say, 3.0x). You deploy your campaigns. Then you walk away. The system monitors every ad, every hour. When a creative drops below your threshold, it gets killed. When a variation outperforms, it gets scaled. New copy gets written, tested, and deployed — all without human intervention.

The key insight is that humans are terrible at this job. We get attached to creative we wrote. We check dashboards at 10am but miss the 3am performance spike. We take weekends off while competitors don't.

An autonomous system has no ego, no schedule, and no blind spots. It executes your strategy with mathematical precision, 168 hours per week.

The playbook is simple: Define your goals. Set your guardrails. Deploy. Review results weekly instead of managing campaigns daily. That's the shift from operator to orchestrator — from doing the work to commanding the workforce that does it.`,
  },
  "swarm-intelligence-marketing": {
    title: "Swarm Intelligence: Why Two AI Agents Write Better Copy Than Any Human",
    excerpt: "When a Creator agent writes copy and a Critic agent tears it apart, the result is copy that scores 9+/10 consistently.",
    category: "Deep Dive",
    readTime: "6 min",
    date: "Mar 8, 2026",
    content: `Single-model AI outputs plateau at around 7/10 quality. They're good enough to be useful, but not good enough to be exceptional. The breakthrough comes from adversarial collaboration — what we call Swarm Intelligence.

The pattern is simple: Agent A (the Creator) writes a first draft. Agent B (the Critic) ruthlessly evaluates it against brand guidelines, engagement metrics, and factual accuracy. The Creator rewrites. The Critic evaluates again. This loop continues until the Critic approves.

In our testing, swarm-generated copy consistently scores 9+/10 on our Nemotron reward model, while single-pass generation averages 6.8/10.

The psychology is the same reason why peer review produces better academic papers, why editors make writers better, and why debate sharpens arguments. The difference is that AI agents can run this loop in 8 seconds instead of 8 days.

This is implemented in Sovereign Matrix's War Room — a multi-agent debate arena where agents argue, critique, and synthesize until the output meets your quality threshold.`,
  },
  "ai-replacing-10k-retainers": {
    title: "How AI Is Replacing R100k/mo Agency Retainers",
    excerpt: "Three agency owners share how they replaced their entire marketing team.",
    category: "Case Study",
    readTime: "10 min",
    date: "Mar 5, 2026",
    content: `TechVentures, a SaaS company paying R150k/month to their agency, switched to Sovereign Matrix and saw a 226% revenue increase in 60 days. Their pipeline grew 3x with zero human SDRs.

Apex Fitness, spending R80k/month on a marketing team, deployed the Sovereign Array and achieved 68% revenue growth plus 271% email list growth. Their voice agent books calls while the team sleeps.

Digital Forge, a marketing agency themselves, white-labeled Sovereign Matrix and now resells it to their own clients. Zero employees, pure margin. Revenue up 233%.

The common pattern across all three: they stopped paying for human hours and started paying for AI-powered outcomes. The math is simple — R9,997/month for a Node license vs R100,000+/month for a human team that delivers less.

The transition isn't painless. It requires trust in the system, willingness to let go of manual control, and patience during the first 30 days while the AI learns your brand voice and business context. But after that learning period, the compound intelligence effect kicks in — the system gets smarter every day, remembering what works and discarding what doesn't.`,
  },
  "ai-vector-memory": {
    title: "AI Memory: The Vector System That Never Forgets a Winning Pattern",
    excerpt: "Every successful campaign pattern is stored in vector memory.",
    category: "Technology",
    readTime: "7 min",
    date: "Mar 2, 2026",
    content: `Traditional AI tools reset every conversation. They have no memory of what worked yesterday, last week, or last quarter. This is why most AI content feels generic — it starts from zero every time.

Sovereign Matrix's vector memory system changes this fundamentally. Every successful campaign pattern, every high-scoring email subject line, every blog post that ranked — they're all embedded as vectors in Pinecone and recalled for future tasks.

When you ask the system to write a cold email, it doesn't just generate from its training data. It recalls your top 5 performing cold emails, analyzes what made them work (tone, length, CTA placement, personalization depth), and generates new content that inherits those winning patterns.

This is compound intelligence. The system gets measurably better with every execution. After 6 months, it knows your business better than a junior employee who's been there a year.

The technical implementation uses contextual retrieval — we don't just embed raw text. We generate semantic summaries of each chunk before embedding, so retrieval is precise and hallucination-free.`,
  },
  "white-label-ai-agency": {
    title: "Build a R600k/mo White-Label AI Agency With Zero Technical Skills",
    excerpt: "Use SOVEREIGN as your agency backend.",
    category: "Business",
    readTime: "9 min",
    date: "Feb 28, 2026",
    content: `The Sovereign Network license exists for one reason: to let you build an agency without building any technology.

Here's the playbook: Sign up for a Sovereign Network license (R49,997/mo). You get a white-labeled dashboard with your branding, your domain, and your client portals. Your clients log in and think you built the entire platform.

Service 12 clients at R50,000/month each. That's R600,000 in monthly revenue. Your cost: R49,997 for the license. Your margin: R550,000/month.

You don't need developers. You don't need designers. You don't need a content team. The platform handles lead generation, content creation, SEO, voice calls, email sequences, and competitor analysis — all autonomously.

Your job becomes sales and client management. Find businesses that need marketing automation, show them the demo, close the deal, onboard them on your white-labeled portal.

The 5 sub-licenses included with the Sovereign Network mean you can give access to 5 clients simultaneously. Need more? Each additional sub-license is available as an add-on.

This is the agency model of the future: high margin, zero overhead, infinite scale.`,
  },
};

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params;
  const article = ARTICLES[slug];

  if (!article) {
    return (
      <div className="min-h-screen bg-midnight text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Article not found</h1>
          <Link href="/blog" className="text-emerald-400 hover:underline">Back to blog</Link>
        </div>
      </div>
    );
  }

  const paragraphs = article.content.split("\n\n");

  return (
    <div className="min-h-screen bg-midnight text-white">
      <nav className="flex items-center justify-between px-8 py-6 max-w-4xl mx-auto">
        <Link href="/blog" className="flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back to Blog
        </Link>
        <Link href="/" className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-[8px] font-bold">S</div>
          <span className="text-xs font-medium tracking-[0.15em] uppercase">SOVEREIGN</span>
        </Link>
      </nav>

      <article className="px-8 pt-8 pb-24 max-w-3xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase">{article.category}</span>
            <span className="text-[10px] text-neutral-500 flex items-center gap-1"><Clock className="w-2.5 h-2.5" />{article.readTime}</span>
            <span className="text-[10px] text-neutral-500 flex items-center gap-1"><Calendar className="w-2.5 h-2.5" />{article.date}</span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight mb-4">{article.title}</h1>
          <div className="h-px bg-gradient-to-r from-emerald-500/20 via-transparent to-transparent" />
        </div>

        <div className="space-y-6">
          {paragraphs.map((p, i) => (
            <p key={i} className="text-base text-neutral-300 leading-relaxed">{p}</p>
          ))}
        </div>

        <div className="mt-16 p-8 rounded-2xl border border-emerald-500/10 bg-emerald-500/[0.02]">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Ready to deploy?</span>
          </div>
          <p className="text-sm text-neutral-400 mb-4">132 autonomous agents. 51+ models. $0 per-token cost. Start free.</p>
          <Link href="/onboarding" className="inline-flex items-center gap-2 px-6 py-3 bg-white text-black font-bold rounded-full text-sm hover:shadow-[0_0_40px_rgba(255,255,255,0.12)] transition-all">
            Deploy Your First Agent
          </Link>
        </div>
      </article>

      <footer className="border-t border-white/[0.04] px-8 py-10 text-center">
        <p className="text-[10px] text-neutral-600 uppercase tracking-[0.4em]">SOVEREIGN MATRIX</p>
      </footer>
    </div>
  );
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  const article = ARTICLES[slug];
  if (!article) return { title: "Article Not Found | Sovereign Matrix" };
  return {
    title: `${article.title} | Sovereign Matrix Blog`,
    description: article.excerpt,
  };
}
