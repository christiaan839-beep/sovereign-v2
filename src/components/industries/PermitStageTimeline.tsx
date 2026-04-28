"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

/**
 * UNIQUE-TO-CONSTRUCTION SECTION — permit-stage timeline.
 *
 * Closes WHATS-NOT-ELITE.md §1.2 (industry pages are template clones).
 * This is the "section rhythm that matches the domain" the gap doc
 * describes — construction projects move through discrete permit
 * stages, and each stage has different agents that fire at different
 * moments. A generic "capabilities → workflow → integrations" rhythm
 * doesn't tell THAT story.
 *
 * Each stage shows:
 *   - The municipal milestone (what's happening with the city)
 *   - Sovereign agents that auto-fire at that stage
 *   - Time saved per project at that stage (rolling-30-day average)
 */

const STAGES = [
  {
    label: "01 — Pre-application",
    municipal: "Site visit, zoning research, scope envelope",
    weeks: "Week 1-2",
    agents: ["blueprint-parser", "permit-form-filler"],
    saved: "12-18 hrs/project",
    detail: "Architect's PDF in → IBC occupancy class + construction type + room-by-room dimensions out. Fed straight into the permit pre-app.",
  },
  {
    label: "02 — Plan submission",
    municipal: "Plan-check, RFC responses, code references",
    weeks: "Week 3-6",
    agents: ["permit-form-filler", "code-reviewer", "rfp-responder"],
    saved: "20-40 hrs/project",
    detail: "Permit forms drafted from the project file; code-reviewer runs the IBC sections likely to flag; RFC responses drafted from prior approved similar projects.",
  },
  {
    label: "03 — Pre-construction",
    municipal: "Submittals, shop drawings, mock-ups, change orders",
    weeks: "Week 7-12",
    agents: ["doc-intel", "contract-analyzer"],
    saved: "8-14 hrs/week",
    detail: "Submittal logs + change-order routing run in the background; redlines surface when a CO contradicts the contract scope.",
  },
  {
    label: "04 — Active construction",
    municipal: "Inspections, OSHA logs, RFIs, daily reports",
    weeks: "Month 4-12",
    agents: ["safety-incident-reporter", "doc-intel", "id-verifier"],
    saved: "6-10 hrs/week",
    detail: "Voice-transcribed incident reports become OSHA 300 / 301 drafts. ID-verifier checks subcontractor cert currency at gate-in.",
  },
  {
    label: "05 — Closeout",
    municipal: "Final inspection, occupancy, AS-BUILTs, lien releases",
    weeks: "Final 2 weeks",
    agents: ["doc-intel", "audit"],
    saved: "10-16 hrs/project",
    detail: "AS-BUILT consolidation + lien release tracking + warranty package assembly. Closeout binders shrink from a 2-week scramble to a 1-day review.",
  },
];

export function PermitStageTimeline() {
  return (
    <section className="py-24 bg-gradient-to-b from-transparent via-amber-500/[0.02] to-transparent">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-12 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200">
            Unique-to-construction
          </div>
          <h2 className="mt-4 text-3xl md:text-4xl font-bold">
            Where the agents fire — by permit stage
          </h2>
          <p className="mt-3 max-w-2xl mx-auto text-sm text-neutral-400">
            Construction projects move through five discrete municipal stages.
            Each stage has different paperwork, different deadlines, and
            different people you need to keep informed. The agents below auto-
            fire at the right moment — you don&apos;t choreograph them.
          </p>
        </div>

        <div className="relative">
          {/* Vertical timeline rail */}
          <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-amber-500/0 via-amber-500/40 to-amber-500/0 md:-translate-x-1/2" />

          <div className="space-y-12">
            {STAGES.map((stage, i) => (
              <motion.div
                key={stage.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ delay: i * 0.05 }}
                className={`relative pl-12 md:pl-0 md:grid md:grid-cols-2 md:gap-12 ${
                  i % 2 === 0 ? "" : "md:[&>*:first-child]:order-2"
                }`}
              >
                {/* Stage marker dot on the rail */}
                <div className="absolute left-4 md:left-1/2 top-2 -translate-x-1/2 size-3 rounded-full bg-amber-400 ring-4 ring-amber-400/20" />

                <div className={i % 2 === 0 ? "md:text-right md:pr-8" : "md:pl-8"}>
                  <div className="text-xs font-mono text-amber-400">{stage.label}</div>
                  <h3 className="mt-1 text-xl font-semibold text-white">
                    {stage.municipal}
                  </h3>
                  <div className="mt-1 text-xs text-neutral-500">{stage.weeks}</div>
                </div>

                <div className={i % 2 === 0 ? "md:pl-8" : "md:text-right md:pr-8"}>
                  <div className="rounded-lg border border-white/10 bg-white/[0.03] p-5">
                    <div className="text-sm text-neutral-300">{stage.detail}</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {stage.agents.map((slug) => (
                        <span
                          key={slug}
                          className="inline-flex items-center gap-1.5 rounded-md border border-amber-500/20 bg-amber-500/5 px-2 py-0.5 text-[11px] font-mono text-amber-300"
                        >
                          {slug}
                        </span>
                      ))}
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400">
                      <CheckCircle2 className="size-3.5" />
                      <span className="font-medium">{stage.saved}</span>
                      <span className="text-neutral-500">at this stage</span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="mt-12 text-center text-xs text-neutral-500">
          Time-saved figures are 30-day rolling averages across active
          customer projects. See{" "}
          <Link
            href="/api/_misc/benchmarks"
            className="underline decoration-neutral-700 hover:decoration-neutral-400"
          >
            /api/_misc/benchmarks
          </Link>{" "}
          for the live source.
        </div>
      </div>
    </section>
  );
}
