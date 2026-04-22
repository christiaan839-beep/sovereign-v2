/**
 * /agents — Staff Directory (public index).
 *
 * Server component. Fetches the full 198-agent catalog via
 * `listCatalog()` (direct DB, no HTTP hop) and hands it to a client
 * shell that owns the filter + search state.
 *
 * Rendered inside the `.editorial-dark` wrapper so the whole page
 * inherits the Technical Monograph palette (warm near-black,
 * Instrument Serif display, JetBrains Mono data, copper accent). No
 * glass, no gradients, no stock-photography stand-ins — this is
 * deliberately NOT a 2026 SaaS look. The aesthetic is reference
 * volume: dense, typographic, serious.
 *
 * Revalidation: 60 seconds. The catalog changes rarely (new agents
 * ship in batches) and 30-day rollup stats tick over once a day; a
 * minute of cache is fine and keeps the TTFB snappy on cold
 * visitors.
 */

import type { Metadata } from "next";
import { listCatalog, type PublicAgent } from "@/lib/agent-catalog";
import { isFeaturedAgent } from "@/app/api/agents/catalog-meta";
import { StaffDirectoryClient } from "./_components/StaffDirectoryClient";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Staff Directory — Sovereign Matrix",
  description:
    "198 AI agents across 18 domains. Every one real. Every one tested. Finance, HR, legal, cybersecurity, research, real estate, gov, A2E moat.",
  alternates: { canonical: "https://sovereignmatrix.agency/agents" },
  openGraph: {
    title: "Staff Directory — Sovereign Matrix",
    description:
      "The 198-agent workforce. Browse by category, search by capability, hire by playbook.",
    url: "https://sovereignmatrix.agency/agents",
    siteName: "Sovereign Matrix",
    type: "website",
  },
};

export default async function StaffDirectoryPage() {
  // listCatalog() falls back to the registry for slugs without metadata
  // rows, so the page renders even on a freshly deployed environment
  // where the seed hasn't run yet. We merge featured-status from the
  // hand-curated catalog-meta.ts so the card can show the copper badge.
  let agents: PublicAgent[] = [];
  try {
    agents = await listCatalog();
  } catch {
    // DB outage or missing tables (42P01). Graceful empty — the
    // client shell renders a respectful empty-state instead of 500.
    agents = [];
  }

  const enriched = agents
    .map((a) => ({ ...a, featured: a.featured || isFeaturedAgent(a.slug) }))
    // Featured first, then alphabetical. A directory sorts alphabetically;
    // featured-first gives prospects something to latch onto.
    .sort((a, b) => {
      if (a.featured && !b.featured) return -1;
      if (!a.featured && b.featured) return 1;
      return a.displayName.localeCompare(b.displayName);
    });

  return (
    <div className="editorial-dark min-h-screen">
      <StaffDirectoryClient agents={enriched} />
    </div>
  );
}
