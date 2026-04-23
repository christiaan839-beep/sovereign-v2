/**
 * /marketplace/search — semantic search over the catalog.
 *
 * Server-shell-renders the page skeleton with an initial result set
 * for the ?q=<query> param (so /marketplace/search?q=invoice is
 * shareable + crawlable by search engines). Interactive live-search
 * is handled by the client island below.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { SearchClient } from "./SearchClient";
import { searchMarketplace } from "@/lib/marketplace-search";

type SP = Promise<{ q?: string }>;

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const title = query
    ? `"${query}" — Sovereign Marketplace search`
    : "Search the Sovereign Marketplace";
  return {
    title,
    description:
      "Find verified agents by purpose, guarantees, or category. Semantic search powered by NVIDIA NIM embeddings + Nemotron reranking.",
  };
}

export default async function Page({ searchParams }: { searchParams: SP }) {
  const { q } = await searchParams;
  const query = (q ?? "").trim();

  // SSR the initial hits. Subsequent searches happen client-side.
  const initial = query
    ? await searchMarketplace(query, { limit: 20 })
    : { hits: [], mode: "empty" as const };

  return (
    <div className="min-h-screen" style={{ background: "var(--ed-bg)" }}>
      <div className="max-w-5xl mx-auto px-6 pt-14 pb-24">
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
            Search
          </p>
          <h1 className="ed-display text-5xl mb-4" style={{ color: "var(--ed-ink)" }}>
            Find the agent you need
          </h1>
          <p className="ed-body max-w-2xl" style={{ color: "var(--ed-ink-soft)" }}>
            Semantic search over every verified agent. Describe what you want in
            plain English —{" "}
            <span className="ed-mono text-sm" style={{ color: "var(--ed-copper)" }}>
              &ldquo;extract data from invoice PDFs&rdquo;
            </span>
            {" "}beats keyword matching every time.
          </p>
        </header>

        <SearchClient initialQuery={query} initialHits={initial.hits} initialMode={initial.mode} />

        <footer
          className="mt-14 pt-8 ed-caption flex items-baseline gap-6 flex-wrap"
          style={{ borderTop: "1px solid var(--ed-rule)" }}
        >
          <span>Embeddings: nvidia/llama-3.2-nv-embedqa-1b-v2 · Rerank: llama-nemotron-rerank-1b-v2</span>
        </footer>
      </div>
    </div>
  );
}
