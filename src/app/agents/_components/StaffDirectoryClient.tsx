"use client";

/**
 * Staff Directory — client shell.
 *
 * Owns:
 *   - category filter state (URL-synced via ?category= for shareable links)
 *   - free-text search state (in-page filter, distinct from ⌘K palette)
 *   - command-palette open state (triggered by ⌘K / Ctrl+K)
 *
 * Does NOT own:
 *   - the data — that's handed in from the server component
 *   - the look-and-feel of the rows — that lives in AgentDossierCard
 *
 * Keyboard:
 *   - "/"      focuses the inline search box
 *   - "⌘K/Ctrl+K" opens the command palette (ranked fuzzy over full set)
 *   - "Esc"    clears inline search if it's focused
 *
 * URL sync:
 *   - `?category=Cybersec` selects that filter on page load
 *   - Category change calls router.replace() so the URL tracks the
 *     active filter — good for sharing "/agents?category=A2E" links.
 *   - Inline search query is intentionally NOT URL-synced (too noisy
 *     for a shared link, and the palette handles discoverability).
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { PublicAgent } from "@/lib/agent-catalog";
import { DirectoryHeader } from "./DirectoryHeader";
import { CategoryTabs } from "./CategoryTabs";
import { AgentDossierCard } from "./AgentDossierCard";
import { CommandPalette } from "./CommandPalette";

interface Props {
  agents: PublicAgent[];
}

const ALL_CATEGORY = "All";

function matchesQuery(agent: PublicAgent, q: string): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return (
    agent.slug.toLowerCase().includes(needle) ||
    agent.displayName.toLowerCase().includes(needle) ||
    (agent.tagline?.toLowerCase().includes(needle) ?? false) ||
    (agent.description?.toLowerCase().includes(needle) ?? false) ||
    agent.tags.some((t) => t.toLowerCase().includes(needle)) ||
    agent.category.toLowerCase().includes(needle)
  );
}

export function StaffDirectoryClient({ agents }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialCategory = searchParams.get("category") ?? ALL_CATEGORY;

  const [category, setCategoryState] = useState<string>(initialCategory);
  const [query, setQuery] = useState<string>("");
  const [paletteOpen, setPaletteOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  // setCategory: sets local state AND updates URL. Wrapped so the
  // CategoryTabs only needs to know the simple signature.
  const setCategory = useCallback(
    (name: string) => {
      setCategoryState(name);
      const params = new URLSearchParams(searchParams.toString());
      if (name === ALL_CATEGORY) {
        params.delete("category");
      } else {
        params.set("category", name);
      }
      const next = params.toString() ? `?${params.toString()}` : "";
      router.replace(`/agents${next}`, { scroll: false });
    },
    [router, searchParams],
  );

  // React to URL changes from browser back/forward.
  useEffect(() => {
    const urlCategory = searchParams.get("category") ?? ALL_CATEGORY;
    if (urlCategory !== category) {
      setCategoryState(urlCategory);
    }
    // Only need to react to URL changes — adding `category` would loop.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Keyboard handlers.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Don't steal keys from other inputs.
      const target = e.target as HTMLElement | null;
      const isTypingElsewhere =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);

      // ⌘K / Ctrl+K — opens the command palette (works even from inputs).
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
        return;
      }
      // "/" — focus the inline search (only outside inputs).
      if (!isTypingElsewhere && e.key === "/") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      // Esc inside inline search clears it.
      if (e.key === "Escape" && document.activeElement === searchRef.current) {
        setQuery("");
        searchRef.current?.blur();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Category counts — precomputed once per agents-prop change.
  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    counts.set(ALL_CATEGORY, agents.length);
    for (const a of agents) {
      counts.set(a.category, (counts.get(a.category) ?? 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => {
        // All goes first, then alphabetical.
        if (a.name === ALL_CATEGORY) return -1;
        if (b.name === ALL_CATEGORY) return 1;
        return a.name.localeCompare(b.name);
      });
  }, [agents]);

  // Applied filter + search.
  const visible = useMemo(() => {
    return agents.filter((a) => {
      const inCategory = category === ALL_CATEGORY || a.category === category;
      return inCategory && matchesQuery(a, query);
    });
  }, [agents, category, query]);

  const featuredCount = agents.filter((a) => a.featured).length;

  return (
    <main className="ed-page pb-32">
      <DirectoryHeader
        total={agents.length}
        featured={featuredCount}
        query={query}
        onQueryChange={setQuery}
        searchRef={searchRef}
      />

      <div className="ed-max">
        <CategoryTabs categories={categories} active={category} onChange={setCategory} />

        <div className="mt-10">
          {visible.length === 0 ? (
            <EmptyState query={query} category={category} />
          ) : (
            <ul className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10">
              {visible.map((agent, i) => (
                <li key={agent.slug}>
                  <AgentDossierCard agent={agent} index={i} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <ResultsFootnote total={agents.length} visibleCount={visible.length} query={query} category={category} />
      </div>

      <CommandPalette
        open={paletteOpen}
        agents={agents}
        onClose={() => setPaletteOpen(false)}
      />
    </main>
  );
}

function EmptyState({ query, category }: { query: string; category: string }) {
  const hasFilter = query !== "" || category !== ALL_CATEGORY;
  return (
    <div className="py-24 text-center border-t border-b" style={{ borderColor: "var(--ed-rule)" }}>
      <div className="ed-display text-5xl mb-4" style={{ color: "var(--ed-ink)" }}>
        {hasFilter ? "No matches." : "No agents registered."}
      </div>
      <div className="ed-caption max-w-md mx-auto">
        {hasFilter ? (
          <>
            Nothing in <span className="ed-mono" style={{ color: "var(--ed-copper)" }}>{category}</span>
            {query ? <> matches &ldquo;{query}&rdquo;</> : null}.
          </>
        ) : (
          <>
            The agent-metadata table is empty. The seed script runs on deploy
            and populates it from the registry — if you&rsquo;re seeing this on
            production, the DB may have drifted.
          </>
        )}
      </div>
    </div>
  );
}

function ResultsFootnote({
  total,
  visibleCount,
  query,
  category,
}: {
  total: number;
  visibleCount: number;
  query: string;
  category: string;
}) {
  return (
    <div className="mt-16 pt-6 border-t flex flex-wrap items-baseline justify-between gap-4"
         style={{ borderColor: "var(--ed-rule)" }}>
      <p className="ed-caption">
        <span className="ed-mono">{String(visibleCount).padStart(3, "0")}</span>
        {" "}of{" "}
        <span className="ed-mono">{String(total).padStart(3, "0")}</span>
        {category !== ALL_CATEGORY && (
          <>
            {" "}·{" "}
            <span style={{ color: "var(--ed-copper)" }}>{category}</span>
          </>
        )}
        {query && (
          <>
            {" "}·{" "}
            matching <span className="ed-mono">&ldquo;{query}&rdquo;</span>
          </>
        )}
      </p>
      <p className="ed-caption">
        Edition 2026.04 · Pressed by{" "}
        <span style={{ color: "var(--ed-copper)" }}>Sovereign Matrix</span>
      </p>
    </div>
  );
}
