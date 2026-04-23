"use client";

/**
 * SearchClient — live semantic search UI for /marketplace/search.
 *
 * Debounced input (250ms) so live-typing doesn't hammer NIM. Results
 * hydrate from the server-side initial set first; subsequent queries
 * fetch from /api/marketplace/search.
 *
 * URL sync: the current query is mirrored to `?q=...` via
 * history.replaceState so pressing back restores state and shareable
 * URLs work. Uses replaceState (not push) to avoid bloating the history
 * stack while typing.
 *
 * Empty states:
 *   - no query        → prompts the user to type
 *   - semantic zero   → fallback to keyword (handled server-side)
 *   - total zero      → "no agents matched — try different words"
 */

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

export interface SearchHit {
  id: string;
  slug: string | null;
  name: string;
  description: string;
  category: string;
  pricingCents: number;
  score: number;
  mode: string;
}

interface Props {
  initialQuery: string;
  initialHits: SearchHit[];
  initialMode: string;
}

export function SearchClient({ initialQuery, initialHits, initialMode }: Props) {
  const [q, setQ] = useState(initialQuery);
  const [hits, setHits] = useState<SearchHit[]>(initialHits);
  const [mode, setMode] = useState<string>(initialMode);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const inFlightRef = useRef<AbortController | null>(null);

  // Sync URL to the current query (replaceState to avoid history spam).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (q) url.searchParams.set("q", q);
    else url.searchParams.delete("q");
    window.history.replaceState({}, "", url.toString());
  }, [q]);

  // Debounced fetch.
  useEffect(() => {
    if (q === initialQuery) {
      // Nothing to re-fetch on initial render — SSR already gave us hits.
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (inFlightRef.current) inFlightRef.current.abort();

    const trimmed = q.trim();
    if (!trimmed) {
      setHits([]);
      setMode("empty");
      setError(null);
      setLoading(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      setError(null);
      const controller = new AbortController();
      inFlightRef.current = controller;

      try {
        const res = await fetch(
          `/api/marketplace/search?q=${encodeURIComponent(trimmed)}&limit=20`,
          { signal: controller.signal },
        );
        if (!res.ok) {
          if (res.status === 429) {
            setError("Too many searches in a minute — slow down.");
          } else {
            setError(`Search failed (HTTP ${res.status}).`);
          }
          setLoading(false);
          return;
        }
        const body = (await res.json()) as {
          hits: SearchHit[];
          mode: string;
        };
        setHits(body.hits ?? []);
        setMode(body.mode ?? "empty");
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError("Network error. Try again.");
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q, initialQuery]);

  const helperText = useMemo(() => {
    if (loading) return "Searching…";
    if (error) return error;
    if (!q.trim()) return "Type anything. Plain English works best.";
    if (hits.length === 0) return "No agents matched. Try different words.";
    const modeLabel =
      mode === "rerank"
        ? "semantic + rerank"
        : mode === "semantic"
        ? "semantic"
        : mode === "keyword"
        ? "keyword (fallback)"
        : "";
    return `${hits.length} result${hits.length === 1 ? "" : "s"} · ${modeLabel}`;
  }, [loading, error, q, hits.length, mode]);

  return (
    <div>
      {/* Input */}
      <div className="mb-3">
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Describe what you need…"
          className="w-full ed-body text-xl bg-transparent p-4 outline-none transition-colors"
          style={{
            border: "1px solid var(--ed-rule)",
            color: "var(--ed-ink)",
            borderRadius: "2px",
          }}
          autoFocus
        />
      </div>

      <p
        className="ed-caption mb-8"
        style={{ color: error ? "var(--ed-copper)" : "var(--ed-ink-soft)" }}
      >
        {helperText}
      </p>

      {/* Results */}
      {hits.length > 0 && (
        <ul className="space-y-3">
          {hits.map((h) => (
            <li
              key={h.id}
              style={{
                border: "1px solid var(--ed-rule)",
                borderRadius: "2px",
                background: "var(--ed-bg-raised)",
              }}
            >
              <Link
                href={h.slug ? `/marketplace/${h.slug}` : `/marketplace/${h.id}`}
                className="block p-5 transition-colors hover:border-[var(--ed-copper)]"
              >
                <div className="flex items-baseline justify-between gap-4 mb-2">
                  <h3
                    className="ed-display text-2xl"
                    style={{ color: "var(--ed-ink)" }}
                  >
                    {h.name}
                  </h3>
                  <span
                    className="ed-label flex-shrink-0"
                    style={{ color: "var(--ed-copper)" }}
                  >
                    {h.pricingCents === 0
                      ? "Free"
                      : h.pricingCents < 100
                      ? `${h.pricingCents}¢`
                      : `$${(h.pricingCents / 100).toFixed(2)}`}
                  </span>
                </div>
                <p
                  className="ed-body text-sm mb-3"
                  style={{ color: "var(--ed-ink-soft)" }}
                >
                  {h.description}
                </p>
                <div className="flex items-center gap-4 ed-caption">
                  <span>{h.category}</span>
                  {h.mode === "rerank" && (
                    <span style={{ color: "var(--ed-copper)" }}>
                      rerank · {h.score.toFixed(2)}
                    </span>
                  )}
                  {h.mode === "semantic" && (
                    <span style={{ color: "var(--ed-copper)" }}>
                      semantic · {h.score.toFixed(2)}
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
