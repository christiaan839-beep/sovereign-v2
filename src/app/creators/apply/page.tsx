/**
 * /creators/apply — Creator onboarding flow.
 *
 * Three zones stacked:
 *   1. Editorial masthead (the offer: 70/30 split, review in 24h)
 *   2. Manifest paste + client-side validator w/ error table
 *   3. Submit form (contact email) → POST /api/creators/submit
 *
 * Wire-through: the /developers/build-an-agent tutorial links here
 * with a {submit an agent →} CTA. The agent-builder live demo (§09
 * on the landing) also links here for the refusal-path recovery.
 *
 * We validate client-side for fast feedback AND server-side at
 * /api/creators/submit so a curl direct-submission can't skip review.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { CreatorApplyClient } from "./CreatorApplyClient";

export const metadata: Metadata = {
  title: "Apply as a Creator — Sovereign Matrix",
  description:
    "Submit your SAM v1.0 agent to the Sovereign marketplace. 70/30 revenue split, 24-hour safety review, instant listing on approval.",
  alternates: { canonical: "https://sovereignmatrix.agency/creators/apply" },
};

export default function CreatorsApplyPage() {
  return (
    <div className="editorial-dark min-h-screen">
      <main className="ed-page py-16 md:py-24 pb-32">
        <div className="ed-max-narrow">
          <p className="ed-label mb-10 flex items-center gap-3">
            <Link href="/" className="transition-colors hover:opacity-80">
              Sovereign Matrix
            </Link>
            <span style={{ color: "var(--ed-rule)" }}>/</span>
            <span>Creators</span>
            <span style={{ color: "var(--ed-rule)" }}>/</span>
            <span style={{ color: "var(--ed-copper)" }}>Apply</span>
          </p>

          {/* Masthead */}
          <div className="mb-14">
            <p className="ed-mono text-sm mb-4" style={{ color: "var(--ed-ink-dim)" }}>
              Creator Program · SAM v1.0 · 70/30 split
            </p>
            <h1 className="ed-display text-[3.5rem] md:text-[5.2rem] leading-[0.95] mb-6"
                style={{ color: "var(--ed-ink)" }}>
              Submit your
              <br />
              <span className="ed-display-italic" style={{ color: "var(--ed-copper)" }}>
                agent.
              </span>
            </h1>
            <p className="ed-display-italic text-2xl leading-snug max-w-2xl"
               style={{ color: "var(--ed-ink-soft)" }}>
              Paste a SAM v1.0 manifest. We validate inline, review for safety within 24
              hours, and list approved agents in the Staff Directory, Marketplace, and MCP
              surface on the same day.
            </p>
          </div>

          <div className="h-px w-full mb-14" style={{ background: "var(--ed-copper)" }} />

          {/* Offer summary */}
          <div className="grid grid-cols-3 gap-6 mb-14">
            <StatBlock label="Revenue split" value="70/30" sub="Creator takes 70%" />
            <StatBlock label="Safety review" value="24h" sub="Business days" />
            <StatBlock label="Distribution" value="3×" sub="Directory + Marketplace + MCP" />
          </div>

          {/* Client: manifest paste + validator + submit */}
          <CreatorApplyClient />

          {/* Support links */}
          <div className="border-t pt-8 mt-16 flex flex-wrap items-baseline justify-between gap-4"
               style={{ borderColor: "var(--ed-rule)" }}>
            <p className="ed-caption max-w-md">
              Not sure what a SAM manifest is? Walk through the{" "}
              <Link href="/developers/build-an-agent"
                    className="underline transition-colors hover:opacity-80"
                    style={{ color: "var(--ed-copper)" }}>
                30-minute tutorial
              </Link>
              {" "}or read the{" "}
              <Link href="/spec/agent-manifest"
                    className="underline transition-colors hover:opacity-80"
                    style={{ color: "var(--ed-copper)" }}>
                full spec
              </Link>
              .
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatBlock({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="p-5"
         style={{
           background: "var(--ed-bg-raised)",
           border: "1px solid var(--ed-rule)",
           borderRadius: "2px",
         }}>
      <div className="ed-caption mb-2">{label}</div>
      <div className="ed-display text-4xl mb-1" style={{ color: "var(--ed-copper)" }}>
        {value}
      </div>
      <div className="ed-caption">{sub}</div>
    </div>
  );
}
