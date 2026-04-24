/**
 * /playground — public agent tryer.
 *
 * WHY
 * ───
 * The landing describes value. The playground lets a visitor *feel* it
 * in under 30 seconds without signing up. This is the biggest funnel fix
 * in the platform — every SaaS with a playground converts 2-5× higher
 * than ones without.
 *
 * ARCHITECTURE
 * ────────────
 * Server component wraps the full agent catalog, then hands off to a
 * client island (PlaygroundClient) that handles:
 *   - agent picker (searchable, grouped by category)
 *   - ?agent=<slug> URL state (so we can deep-link from /agents/[slug])
 *   - prompt input + example presets per agent
 *   - rate-limited execution (IP-based, enforced server-side)
 *   - live response display with latency
 *
 * Closes a real gap: the previous playground hard-coded 5 agents.
 * Now every public agent in the registry is available.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { listCatalog } from "@/lib/agent-catalog";
import { PlaygroundClient } from "./PlaygroundClient";

export const metadata: Metadata = {
  title: "Playground — try 223 agents without signing up · Sovereign Matrix",
  description:
    "Interactive agent playground. Run any of 223 first-party agents with no signup. See real results, real latency. Deep-linkable via ?agent=<slug>.",
  alternates: { canonical: "https://sovereignmatrix.agency/playground" },
  openGraph: {
    title: "Sovereign Matrix Playground",
    description: "Run 223 agents with no signup. Real results, real latency.",
    url: "https://sovereignmatrix.agency/playground",
    type: "website",
  },
};

export const revalidate = 300;

interface PageProps {
  searchParams: Promise<{ agent?: string }>;
}

export default async function PlaygroundPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const initialSlug = typeof params.agent === "string" ? params.agent : null;

  // Pull the full catalog once on the server. The client gets it as a
  // serialized prop — no extra fetch on mount.
  const catalog = await listCatalog({ limit: 500 });

  return (
    <div className="min-h-screen bg-[#010101] text-white antialiased">
      <nav className="px-6 md:px-10 h-16 flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="text-sm font-semibold text-white">
          Sovereign Matrix
        </Link>
        <div className="flex items-center gap-5 text-[13px]">
          <Link
            href="/agents"
            className="text-neutral-400 hover:text-white transition-colors"
          >
            All agents
          </Link>
          <Link
            href="/developers/api-explorer"
            className="text-neutral-400 hover:text-white transition-colors"
          >
            API explorer
          </Link>
          <Link
            href="/pricing"
            className="px-4 py-1.5 rounded-full bg-[#B5532C] hover:bg-[#C96234] text-white text-xs font-semibold transition-colors"
          >
            Upgrade for more
          </Link>
        </div>
      </nav>

      <section className="pt-16 pb-8 px-6 text-center">
        <p className="font-mono text-[10px] text-neutral-600 tracking-[0.22em] uppercase mb-3">
          Playground · No signup required
        </p>
        <h1 className="ed-display text-4xl md:text-6xl mb-4">
          Run an agent.<br />
          <span className="ed-display-italic text-[#B5532C]">See what it does.</span>
        </h1>
        <p className="text-neutral-400 text-sm max-w-xl mx-auto">
          Pick from {catalog.length} first-party agents. Three free runs per
          visitor — no card, no signup. Deep-link a friend: append{" "}
          <code className="font-mono text-xs text-[#B5532C]">?agent=&lt;slug&gt;</code>.
        </p>
      </section>

      <PlaygroundClient catalog={catalog} initialSlug={initialSlug} />

      <section className="py-12 px-6 border-t border-white/[0.04]">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs text-neutral-500 mb-4">
            Rate-limited to 3 runs per IP per hour. Need more? Sign up for free — the
            free tier has 50 runs/month with no IP limit.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[4px] bg-[#B5532C] hover:bg-[#C96234] text-white text-sm font-semibold transition-colors"
            >
              Get a free account
            </Link>
            <Link
              href="/pricing"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-[4px] border border-white/10 text-white text-sm font-semibold hover:bg-white/5 transition-colors"
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
