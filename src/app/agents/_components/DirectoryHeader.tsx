"use client";

/**
 * DirectoryHeader — the masthead for the Staff Directory.
 *
 * Three zones, stacked:
 *   1. Breadcrumb strip (very small mono) — place in site hierarchy
 *   2. Display title block — serif, editorial, with the roman-numeral
 *      ordinal "No. I" as an art piece
 *   3. Meta strip — tagline in serif italic, counts in mono, search
 *      input aligned right.
 *
 * This is the one place in the app that uses the full editorial display
 * type treatment at scale. Deliberately quiet below 640px — the serif
 * collapses to a readable size rather than trying to be clever with
 * typesetting tricks on phones.
 */

import type { RefObject } from "react";

interface Props {
  total: number;
  featured: number;
  query: string;
  onQueryChange: (q: string) => void;
  searchRef: RefObject<HTMLInputElement | null>;
}

export function DirectoryHeader({ total, featured, query, onQueryChange, searchRef }: Props) {
  return (
    <header className="ed-max pt-16 md:pt-24 pb-10">
      {/* Breadcrumb strip */}
      <p className="ed-label mb-10 flex items-center gap-3">
        <span>Sovereign Matrix</span>
        <span style={{ color: "var(--ed-rule)" }}>/</span>
        <span style={{ color: "var(--ed-copper)" }}>Staff Directory</span>
      </p>

      {/* Display block — ordinal + title side-by-side */}
      <div className="grid grid-cols-12 gap-4 items-end mb-8">
        <div className="col-span-12 md:col-span-2 ed-enter ed-d-1">
          <div className="ed-display-italic text-4xl md:text-5xl" style={{ color: "var(--ed-copper)" }}>
            No. I
          </div>
          <div className="ed-caption mt-2">Edition 2026.04</div>
        </div>

        <h1 className="col-span-12 md:col-span-10 ed-display text-[3.2rem] sm:text-[4.4rem] md:text-[5.6rem] leading-[0.92] ed-enter ed-d-2"
            style={{ color: "var(--ed-ink)" }}>
          Staff
          <br />
          <span className="ed-display-italic" style={{ color: "var(--ed-ink-soft)" }}>
            Directory.
          </span>
        </h1>
      </div>

      {/* Copper rule */}
      <div className="h-px w-full mb-8 ed-enter ed-d-3"
           style={{ background: "var(--ed-copper)" }} />

      {/* Meta strip — tagline + counts + search */}
      <div className="grid grid-cols-12 gap-4 items-end ed-enter ed-d-4">
        <div className="col-span-12 md:col-span-6">
          <p className="ed-display-italic text-2xl md:text-[1.7rem] leading-snug"
             style={{ color: "var(--ed-ink-soft)" }}>
            A reference volume of the operators, researchers, and strategists
            who compose the Sovereign Matrix workforce.
          </p>
        </div>

        <div className="col-span-6 md:col-span-3 ed-caption">
          <div>
            <span className="ed-display text-4xl" style={{ color: "var(--ed-ink)" }}>
              {String(total).padStart(3, "0")}
            </span>
          </div>
          <div className="mt-1">total agents on roll</div>
        </div>

        <div className="col-span-6 md:col-span-3 ed-caption">
          <div>
            <span className="ed-display text-4xl" style={{ color: "var(--ed-copper)" }}>
              {String(featured).padStart(3, "0")}
            </span>
          </div>
          <div className="mt-1">featured in edition</div>
        </div>
      </div>

      {/* Search bar */}
      <div className="mt-10 ed-enter ed-d-5">
        <label className="block ed-label mb-3">
          Search — name, slug, tag, capability
        </label>
        <div className="flex items-center gap-3 border-b pb-3"
             style={{ borderColor: query ? "var(--ed-copper)" : "var(--ed-rule)" }}>
          <input
            ref={searchRef}
            type="search"
            placeholder="e.g. invoice, churn, nda, phishing…"
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            className="ed-mono flex-1 bg-transparent border-0 outline-none text-lg md:text-xl placeholder:opacity-40"
            style={{ color: "var(--ed-ink)" }}
            aria-label="Search agents"
          />
          <kbd className="ed-label px-2 py-1 border"
               style={{
                 borderColor: "var(--ed-rule)",
                 color: "var(--ed-ink-dim)",
               }}>
            ⌘ K
          </kbd>
        </div>
      </div>
    </header>
  );
}
