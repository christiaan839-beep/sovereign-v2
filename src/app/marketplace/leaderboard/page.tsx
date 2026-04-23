/**
 * /marketplace/leaderboard — public agent-quality rankings.
 *
 * Server component. Shows the top 30 agents by volume, with their
 * health grade + composite score. Creators compete on quality
 * signals, buyers see trust-at-a-glance.
 *
 * The letter grade is the hero — buyers don't need to read four
 * separate numbers. Each row links to the agent detail page, where
 * the same grade appears in the masthead.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { getTopAgentHealth, type AgentGrade } from "@/lib/agent-health";

export const metadata: Metadata = {
  title: "Marketplace Leaderboard — Sovereign Matrix",
  description:
    "Top-rated agents by health grade. Success rate, safety score, and latency compose a single letter grade (A/B/C/D/F).",
};

function gradeColor(grade: AgentGrade): string {
  switch (grade) {
    case "A":
      return "var(--ed-copper)";
    case "B":
      return "var(--ed-ink)";
    case "C":
      return "var(--ed-ink-soft)";
    default:
      return "var(--ed-copper)";
  }
}

function gradeLabel(grade: AgentGrade): string {
  switch (grade) {
    case "A": return "Elite";
    case "B": return "Strong";
    case "C": return "Developing";
    case "D": return "Needs work";
    case "F": return "Failing";
  }
}

export default async function Page() {
  const agents = await getTopAgentHealth(30);

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
            Leaderboard
          </p>
          <h1 className="ed-display text-5xl mb-4" style={{ color: "var(--ed-ink)" }}>
            Top-rated agents
          </h1>
          <p className="ed-body max-w-2xl" style={{ color: "var(--ed-ink-soft)" }}>
            Composite grade derived from success rate (40%), safety score
            (20%), latency (25%), and volume confidence (15%). Safety below
            threshold is an automatic F — no fast-and-unsafe rankings.
          </p>
        </header>

        {/* Grade key */}
        <div
          className="mb-8 p-4 flex items-center gap-6 flex-wrap ed-caption"
          style={{
            border: "1px solid var(--ed-rule)",
            background: "var(--ed-bg-raised)",
            borderRadius: "2px",
          }}
        >
          {(["A", "B", "C", "D", "F"] as AgentGrade[]).map((g) => (
            <div key={g} className="flex items-baseline gap-2">
              <span
                className="ed-display text-lg"
                style={{ color: gradeColor(g) }}
              >
                {g}
              </span>
              <span>{gradeLabel(g)}</span>
            </div>
          ))}
        </div>

        {agents.length === 0 ? (
          <EmptyPanel />
        ) : (
          <div style={{ border: "1px solid var(--ed-rule)", borderRadius: "2px" }}>
            <div
              className="grid grid-cols-[auto_2fr_1fr_1fr_1fr] gap-4 px-5 py-3 ed-label"
              style={{
                borderBottom: "1px solid var(--ed-rule)",
                background: "var(--ed-bg-raised)",
                color: "var(--ed-ink-soft)",
              }}
            >
              <span>Grade</span>
              <span>Agent</span>
              <span>Category</span>
              <span>Runs</span>
              <span className="text-right">Score</span>
            </div>
            {agents.map((a) => (
              <Link
                key={a.agentId}
                href={a.slug ? `/marketplace/${a.slug}` : `/marketplace/${a.agentId}`}
                className="grid grid-cols-[auto_2fr_1fr_1fr_1fr] gap-4 px-5 py-4 items-baseline transition-colors hover:bg-[var(--ed-bg-raised)]"
                style={{ borderBottom: "1px solid var(--ed-rule)" }}
              >
                <span
                  className="ed-display text-2xl w-8"
                  style={{ color: gradeColor(a.grade) }}
                >
                  {a.grade}
                </span>
                <span className="ed-body" style={{ color: "var(--ed-ink)" }}>
                  {a.name}
                </span>
                <span className="ed-caption" style={{ color: "var(--ed-ink-soft)" }}>
                  {a.category}
                </span>
                <span
                  className="ed-mono text-sm"
                  style={{ color: "var(--ed-ink-soft)" }}
                >
                  {a.sampleSize.toLocaleString()}
                </span>
                <span
                  className="ed-mono text-sm text-right"
                  style={{ color: "var(--ed-copper)" }}
                >
                  {a.score}
                </span>
              </Link>
            ))}
          </div>
        )}

        <footer
          className="mt-14 pt-8 ed-caption flex items-baseline gap-6 flex-wrap"
          style={{ borderTop: "1px solid var(--ed-rule)" }}
        >
          <Link
            href="/marketplace/search"
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            Search all agents →
          </Link>
          <Link
            href="/creators/apply"
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            Submit your own →
          </Link>
          <span>Grades refresh on every page load. Volume regression keeps low-sample agents honest.</span>
        </footer>
      </div>
    </div>
  );
}

function EmptyPanel() {
  return (
    <div
      className="p-10 text-center"
      style={{
        border: "1px solid var(--ed-rule)",
        background: "var(--ed-bg-raised)",
        color: "var(--ed-ink-soft)",
        borderRadius: "2px",
      }}
    >
      <p className="ed-body mb-3">No agents with recorded runs yet.</p>
      <p className="ed-caption">
        Agents earn a grade after their first invocation.
      </p>
    </div>
  );
}
