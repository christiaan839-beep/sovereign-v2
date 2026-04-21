"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const LAYERS = [
  {
    id: "jailbreak",
    title: "Jailbreak Guard",
    passRate: "99.8%",
    desc: "Blocks prompt injection, adversarial inputs, and role-play exploits before any model processes the request. Uses a dedicated classifier trained on red-team datasets — not just regex patterns.",
  },
  {
    id: "pii",
    title: "PII Redactor",
    passRate: "99.9%",
    desc: "Strips personal data — email addresses, phone numbers, SSNs, passport numbers, and financial identifiers — before any model sees the payload. Redacted data is never stored in memory.",
  },
  {
    id: "content",
    title: "Content Policy",
    passRate: "99.7%",
    desc: "NSFW, harmful content, hate speech, and dangerous instructions are filtered at ingress. The policy is context-aware: medical agents and legal agents have calibrated thresholds for clinical language.",
  },
  {
    id: "quality",
    title: "Quality Critic",
    passRate: "97.2%",
    desc: "A second model reviews every output against the playbook guarantee. Outputs that fail the quality bar are automatically retried with adjusted parameters — up to 3 times before the run is voided.",
  },
  {
    id: "hitl",
    title: "Human Override",
    passRate: "Always available",
    desc: "Enterprise workflows can require human-in-the-loop approval before any destructive, financial, or irreversible action is taken. Approval requests surface in the Security Command Center dashboard.",
  },
];

/**
 * VerificationPipeline — 5-layer safety pipeline, expandable accordion rows.
 */
export function VerificationPipeline() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <section className="px-6 py-28 md:py-36 bg-[#0A0807]">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8 flex items-center gap-4 flex-wrap">
          <span className="font-mono text-[10px] text-neutral-600 tracking-[0.2em]">06 / 10</span>
          <span aria-hidden="true" className="h-px w-6 bg-white/[0.12]" />
          <p className="font-serif italic text-[13px] text-neutral-500 tracking-[-0.01em]">
            trust layer
          </p>
        </div>

        <h2 className="font-serif text-4xl md:text-5xl lg:text-[58px] leading-[1.05] mb-4 tracking-[-0.02em] max-w-3xl">
          5 Layers of Safety.
          <br />
          <em className="not-italic text-[#B5532C]">Every Single Run.</em>
        </h2>
        <p className="text-neutral-400 text-[15px] mb-12 max-w-xl leading-relaxed">
          Not optional. Not enterprise-only. Every execution — free tier included — passes through
          the full verification pipeline before output reaches you.
        </p>

        {/* Accordion */}
        <div className="border border-white/[0.06] rounded-[6px] overflow-hidden">
          {LAYERS.map((layer, i) => {
            const isOpen = openId === layer.id;
            return (
              <div
                key={layer.id}
                className={`border-b border-white/[0.06] last:border-b-0 ${isOpen ? "bg-white/[0.02]" : ""} transition-colors`}
              >
                <button
                  className="w-full flex items-center gap-4 px-6 py-5 text-left hover:bg-white/[0.015] transition-colors"
                  onClick={() => setOpenId(isOpen ? null : layer.id)}
                  aria-expanded={isOpen}
                >
                  {/* Copper check */}
                  <span
                    className="flex-shrink-0 w-5 h-5 rounded-full border flex items-center justify-center"
                    style={{
                      borderColor: "rgba(181,83,44,0.5)",
                      background: "rgba(181,83,44,0.08)",
                    }}
                    aria-hidden="true"
                  >
                    <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                      <path d="M1 3l2 2 4-4" stroke="#B5532C" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>

                  {/* Step number */}
                  <span className="font-mono text-[10px] text-neutral-600 flex-shrink-0 w-5 text-center">
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  {/* Title */}
                  <span className="flex-1 font-serif text-[17px] md:text-[19px] text-white tracking-tight">
                    {layer.title}
                  </span>

                  {/* Pass rate */}
                  <span className="font-mono text-[11px] text-[#B5532C] flex-shrink-0 hidden sm:block">
                    {layer.passRate}
                  </span>

                  {/* Chevron */}
                  <span
                    className={`flex-shrink-0 ml-2 text-neutral-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  >
                    <svg width="12" height="7" viewBox="0 0 12 7" fill="none">
                      <path d="M1 1l5 5 5-5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>

                <AnimatePresence>
                  {isOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      style={{ overflow: "hidden" }}
                    >
                      <div className="px-6 pb-5 pl-16 md:pl-20">
                        <p className="text-[13.5px] text-neutral-400 leading-[1.7]">
                          {layer.desc}
                        </p>
                        <span className="mt-2 block font-mono text-[10px] text-[#B5532C] sm:hidden">
                          Pass rate: {layer.passRate}
                        </span>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Audit trail note */}
        <p className="mt-8 text-[12px] font-mono text-neutral-600 leading-relaxed">
          Every execution is immutably logged.{" "}
          <span className="text-neutral-500">CISO-ready audit trail available on Node and Enterprise plans.</span>
        </p>
      </div>
    </section>
  );
}
