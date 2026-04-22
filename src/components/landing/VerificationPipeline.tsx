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
    <section className="editorial-dark px-6 py-28 md:py-36" style={{ background: "var(--ed-bg)" }}>
      <div className="max-w-4xl mx-auto">
        <p className="ed-label mb-10" style={{ color: "var(--ed-copper)" }}>
          Section 06 · Trust layer
        </p>

        <h2 className="ed-display text-4xl md:text-5xl lg:text-[58px] leading-[0.95] mb-4 max-w-3xl"
            style={{ color: "var(--ed-ink)" }}>
          5 Layers of Safety.
          <br />
          <span className="ed-display-italic" style={{ color: "var(--ed-copper)" }}>Every single run.</span>
        </h2>
        <p className="ed-body text-[15px] mb-14 max-w-xl leading-relaxed" style={{ color: "var(--ed-ink-soft)" }}>
          Not optional. Not enterprise-only. Every execution — free tier included — passes through
          the full verification pipeline before output reaches you.
        </p>

        {/* Accordion */}
        <div className="overflow-hidden"
             style={{ border: "1px solid var(--ed-rule)", borderRadius: "2px" }}>
          {LAYERS.map((layer, i) => {
            const isOpen = openId === layer.id;
            return (
              <div
                key={layer.id}
                className="transition-colors last:border-b-0"
                style={{
                  borderBottom: "1px solid var(--ed-rule)",
                  background: isOpen ? "var(--ed-bg-raised)" : "transparent",
                }}
              >
                <button
                  className="w-full flex items-center gap-4 px-6 py-5 text-left transition-colors"
                  onClick={() => setOpenId(isOpen ? null : layer.id)}
                  aria-expanded={isOpen}
                  style={{ color: "var(--ed-ink)" }}
                >
                  {/* Copper check */}
                  <span
                    className="flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center"
                    style={{
                      border: "1px solid var(--ed-copper)",
                      background: "var(--ed-copper-wash)",
                    }}
                    aria-hidden="true"
                  >
                    <svg width="8" height="6" viewBox="0 0 8 6" fill="none">
                      <path d="M1 3l2 2 4-4" stroke="var(--ed-copper)" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>

                  {/* Step number */}
                  <span className="ed-mono text-[10px] flex-shrink-0 w-5 text-center"
                        style={{ color: "var(--ed-ink-dim)" }}>
                    {String(i + 1).padStart(2, "0")}
                  </span>

                  {/* Title */}
                  <span className="ed-display flex-1 text-[18px] md:text-[20px]" style={{ color: "var(--ed-ink)" }}>
                    {layer.title}
                  </span>

                  {/* Pass rate */}
                  <span className="ed-mono text-[11px] flex-shrink-0 hidden sm:block"
                        style={{ color: "var(--ed-copper)" }}>
                    {layer.passRate}
                  </span>

                  {/* Chevron */}
                  <span
                    className={`flex-shrink-0 ml-2 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                    style={{ color: "var(--ed-ink-dim)" }}
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
                        <p className="ed-body text-[14px] leading-relaxed" style={{ color: "var(--ed-ink-soft)" }}>
                          {layer.desc}
                        </p>
                        <span className="mt-2 block ed-mono text-[10px] sm:hidden"
                              style={{ color: "var(--ed-copper)" }}>
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
        <p className="ed-caption mt-8 leading-relaxed">
          Every execution is immutably logged.{" "}
          <span style={{ color: "var(--ed-ink-soft)" }}>
            CISO-ready audit trail available on Node and Enterprise plans.
          </span>
        </p>
      </div>
    </section>
  );
}
