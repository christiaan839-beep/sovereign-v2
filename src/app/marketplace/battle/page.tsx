/**
 * /marketplace/battle — public A/B arena.
 *
 * Buyer picks 2–3 agent slugs (via URL query ?a=slug1&b=slug2 or
 * by typing), provides one input, and sees both outputs side-by-side
 * with confidence + latency + SLA verdict. Winner highlighted.
 *
 * Server component renders the page shell + reads query params for
 * preselected agents. The client island does the POST to
 * /api/agents/battle and renders the streaming-like result.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { BattleClient } from "./BattleClient";

export const metadata: Metadata = {
  title: "Battle — Sovereign Marketplace",
  description:
    "Side-by-side A/B comparison of any two agents on the same input. Confidence scores + latency + SLA verdict. Pick the winner live.",
};

type SP = Promise<{ a?: string; b?: string; c?: string }>;

export default async function Page({ searchParams }: { searchParams: SP }) {
  const { a, b, c } = await searchParams;

  return (
    <div className="min-h-screen" style={{ background: "var(--ed-bg)" }}>
      <div className="max-w-6xl mx-auto px-6 pt-14 pb-24">
        <nav className="ed-caption mb-10">
          <Link
            href="/marketplace"
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            ← Marketplace
          </Link>
        </nav>

        <header className="mb-10">
          <p className="ed-label mb-2" style={{ color: "var(--ed-copper)" }}>
            Battle
          </p>
          <h1 className="ed-display text-5xl mb-4" style={{ color: "var(--ed-ink)" }}>
            Pick the winner live
          </h1>
          <p className="ed-body max-w-2xl" style={{ color: "var(--ed-ink-soft)" }}>
            Run any two or three agents against the same input in parallel.
            See confidence scores, latency, and SLA verdicts head-to-head
            before you commit to one in your workflow.
          </p>
        </header>

        <BattleClient
          initialA={typeof a === "string" ? a : ""}
          initialB={typeof b === "string" ? b : ""}
          initialC={typeof c === "string" ? c : ""}
        />

        <footer
          className="mt-14 pt-8 ed-caption flex items-baseline gap-6 flex-wrap"
          style={{ borderTop: "1px solid var(--ed-rule)" }}
        >
          <Link
            href="/marketplace/search"
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            Find agents by search →
          </Link>
          <Link
            href="/marketplace/leaderboard"
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            Leaderboard →
          </Link>
          <span>Rate limited 5/min per IP — each battle fires up to 3 LLM calls.</span>
        </footer>
      </div>
    </div>
  );
}
