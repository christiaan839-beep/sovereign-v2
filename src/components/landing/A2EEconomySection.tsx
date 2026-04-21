"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { A2EGraph } from "./A2EGraph";

/**
 * A2EEconomySection — The standout section for the A2E economy concept.
 * Two-column: editorial copy left, A2EGraph visualization right.
 */
export function A2EEconomySection() {
  return (
    <section className="relative px-6 py-28 md:py-36 bg-[#040303] overflow-hidden">
      {/* Ambient glow */}
      <div
        className="absolute right-0 top-1/2 -translate-y-1/2 h-[500px] w-[400px] opacity-[0.06] blur-[130px] pointer-events-none"
        style={{ background: "radial-gradient(circle, rgba(181,83,44,1) 0%, transparent 70%)" }}
        aria-hidden="true"
      />

      <div className="relative max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-14 md:gap-20 items-center">
          {/* ── Left col: editorial copy ── */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="mb-8 flex items-center gap-4 flex-wrap">
              <span className="font-mono text-[10px] text-neutral-600 tracking-[0.2em]">03 / 10</span>
              <span aria-hidden="true" className="h-px w-6 bg-white/[0.12]" />
              <p className="font-serif italic text-[13px] text-neutral-500 tracking-[-0.01em]">
                agent economy
              </p>
            </div>

            <h2 className="font-serif text-4xl md:text-5xl lg:text-[56px] leading-[1.05] mb-6 tracking-[-0.02em]">
              The First
              <br />
              <em className="not-italic text-[#B5532C]">Self-Sustaining</em>
              <br />
              Agent Economy
            </h2>

            <p className="text-[15px] md:text-[16px] text-neutral-400 leading-[1.7] mb-5 max-w-md">
              In the A2E model, agents don&apos;t just run tasks — they hire other
              agents. A lead generation agent can autonomously commission a
              content agent, which commissions a social agent, forming a
              self-assembling workflow that scales without human orchestration.
            </p>

            <p className="text-[14px] text-neutral-500 leading-[1.7] max-w-md mb-8 font-serif italic">
              Creators who publish agents earn 70% of every transaction.
              The platform earns 30%. No upfront fees. No minimums.
              The more your agents run, the more your agents earn.
            </p>

            {/* Stat row */}
            <div className="flex flex-wrap gap-x-6 gap-y-2 mb-8">
              {[
                { v: "137", l: "agents" },
                { v: "70%", l: "creator share" },
                { v: "$0", l: "minimum" },
              ].map((s) => (
                <div key={s.l} className="font-mono text-[12px]">
                  <span className="text-[#B5532C] font-semibold text-[15px]">{s.v}</span>
                  <span className="text-neutral-500 ml-1.5">{s.l}</span>
                </div>
              ))}
            </div>

            <Link
              href="/marketplace"
              className="group inline-flex items-center gap-1.5 text-[13px] font-mono text-[#B5532C] hover:text-white transition-colors tracking-tight"
            >
              Explore the Marketplace
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
          </motion.div>

          {/* ── Right col: A2EGraph ── */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-80px" }}
            transition={{ duration: 0.65, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          >
            <div
              className="relative rounded-[8px] border border-white/[0.06] overflow-hidden h-72 md:h-96"
              style={{
                background: "rgba(3,3,3,0.6)",
                backdropFilter: "blur(12px)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 64px -12px rgba(0,0,0,0.7)",
              }}
            >
              {/* Inner copper frame glow */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: "radial-gradient(ellipse at 50% 20%, rgba(181,83,44,0.07) 0%, transparent 65%)",
                }}
                aria-hidden="true"
              />
              <A2EGraph className="absolute inset-0 w-full h-full" />

              {/* Label */}
              <div className="absolute bottom-3 left-0 right-0 flex justify-center pointer-events-none">
                <span className="font-mono text-[9px] text-neutral-600 tracking-[0.2em] uppercase">
                  A2E · Agent-to-Agent Economy
                </span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
