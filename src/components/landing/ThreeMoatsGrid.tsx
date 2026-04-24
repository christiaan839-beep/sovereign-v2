"use client";

import { motion } from "framer-motion";

/**
 * ThreeMoatsGrid — 3-column grid showcasing the three unique moats.
 * Pure copper accent. No rainbow. Glassmorphism + copper top border.
 */
export function ThreeMoatsGrid() {
  const moats = [
    {
      id: "a2e",
      title: "A2E Economy",
      desc: "Agents can declare dependencies on other agents (SAM v1.0 `dependsOn`). Creators earn 70% of every invocation — idempotent per invocationId, SLA-breach-auto-reversed.",
      icon: (
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
          {/* Node graph: center node + 5 outer nodes with copper lines */}
          <circle cx="18" cy="18" r="3.5" stroke="#B5532C" strokeWidth="1.5" fill="rgba(181,83,44,0.15)" />
          <circle cx="6"  cy="12" r="2.5" stroke="#B5532C" strokeWidth="1" fill="rgba(181,83,44,0.08)" strokeOpacity="0.6" />
          <circle cx="30" cy="12" r="2.5" stroke="#B5532C" strokeWidth="1" fill="rgba(181,83,44,0.08)" strokeOpacity="0.6" />
          <circle cx="8"  cy="26" r="2.5" stroke="#B5532C" strokeWidth="1" fill="rgba(181,83,44,0.08)" strokeOpacity="0.6" />
          <circle cx="28" cy="26" r="2.5" stroke="#B5532C" strokeWidth="1" fill="rgba(181,83,44,0.08)" strokeOpacity="0.6" />
          <circle cx="18" cy="30" r="2"   stroke="#B5532C" strokeWidth="1" fill="rgba(181,83,44,0.08)" strokeOpacity="0.5" />
          {/* Edges from center */}
          <line x1="18" y1="18" x2="6"  y2="12" stroke="#B5532C" strokeWidth="0.75" strokeOpacity="0.45" />
          <line x1="18" y1="18" x2="30" y2="12" stroke="#B5532C" strokeWidth="0.75" strokeOpacity="0.45" />
          <line x1="18" y1="18" x2="8"  y2="26" stroke="#B5532C" strokeWidth="0.75" strokeOpacity="0.45" />
          <line x1="18" y1="18" x2="28" y2="26" stroke="#B5532C" strokeWidth="0.75" strokeOpacity="0.45" />
          <line x1="18" y1="18" x2="18" y2="30" stroke="#B5532C" strokeWidth="0.75" strokeOpacity="0.45" />
          {/* Lateral edge */}
          <line x1="6"  y1="12" x2="8"  y2="26" stroke="#B5532C" strokeWidth="0.5" strokeOpacity="0.25" />
          <line x1="30" y1="12" x2="28" y2="26" stroke="#B5532C" strokeWidth="0.5" strokeOpacity="0.25" />
        </svg>
      ),
    },
    {
      id: "memory",
      title: "Semantic Memory",
      desc: "Every run embeds its context into a 1,024-dimensional vector (NIM nv-embedqa-1b-v2). Later runs retrieve relevant prior context via cosine similarity — no re-briefing, no lost context.",
      icon: (
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
          {/* Waveform / brain outline — copper lines */}
          <path
            d="M2 18 Q5 10 8 18 Q11 26 14 18 Q17 10 20 18 Q23 26 26 18 Q29 10 32 18 Q34 22 36 18"
            stroke="#B5532C" strokeWidth="1.5" fill="none" strokeOpacity="0.8"
            strokeLinecap="round" strokeLinejoin="round"
          />
          <path
            d="M2 22 Q5 16 8 22 Q11 28 14 22 Q17 16 20 22 Q23 28 26 22 Q29 16 32 22"
            stroke="#B5532C" strokeWidth="0.75" fill="none" strokeOpacity="0.3"
            strokeLinecap="round" strokeLinejoin="round"
          />
          {/* Vertical tick marks */}
          <line x1="14" y1="10" x2="14" y2="26" stroke="#B5532C" strokeWidth="0.5" strokeOpacity="0.25" />
          <line x1="20" y1="10" x2="20" y2="26" stroke="#B5532C" strokeWidth="0.5" strokeOpacity="0.25" />
        </svg>
      ),
    },
    {
      id: "sovereignty",
      title: "Model Sovereignty",
      desc: "39 models catalogued across 8 providers. Free-tier NIM first (95% of calls). DATA_SOVEREIGNTY_MODE=true removes non-US providers from the failover chain. No training on paid-API traffic, per each provider's ToS.",
      icon: (
        <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true">
          {/* Grid of nodes */}
          {[6, 18, 30].map((cx) =>
            [6, 18, 30].map((cy) => (
              <circle
                key={`${cx}-${cy}`}
                cx={cx} cy={cy} r="2.5"
                stroke="#B5532C" strokeWidth="1"
                fill="rgba(181,83,44,0.1)"
                strokeOpacity={cx === 18 && cy === 18 ? 0.9 : 0.4}
              />
            ))
          )}
          {/* Horizontal grid lines */}
          {[6, 18, 30].map((y) => (
            <line key={`h${y}`} x1="8.5" y1={y} x2="27.5" y2={y}
              stroke="#B5532C" strokeWidth="0.5" strokeOpacity="0.2" />
          ))}
          {/* Vertical grid lines */}
          {[6, 18, 30].map((x) => (
            <line key={`v${x}`} x1={x} y1="8.5" x2={x} y2="27.5"
              stroke="#B5532C" strokeWidth="0.5" strokeOpacity="0.2" />
          ))}
          {/* Lock icon overlay on center node */}
          <rect x="15.5" y="16.5" width="5" height="4" rx="0.75"
            stroke="#B5532C" strokeWidth="1" fill="rgba(181,83,44,0.25)" strokeOpacity="0.8" />
          <path d="M16.5 16.5 V15 a1.5 1.5 0 0 1 3 0 V16.5"
            stroke="#B5532C" strokeWidth="1" fill="none" strokeOpacity="0.8" />
        </svg>
      ),
    },
  ];

  return (
    <section className="editorial-dark px-6 py-24 md:py-32" style={{ background: "var(--ed-bg)" }}>
      <div className="max-w-5xl mx-auto">
        <p className="ed-label mb-10" style={{ color: "var(--ed-copper)" }}>
          Section 02 · Three moats
        </p>

        <h2 className="ed-display text-4xl md:text-5xl lg:text-[58px] leading-[0.95] mb-4 max-w-3xl"
            style={{ color: "var(--ed-ink)" }}>
          Why competitors can&apos;t
          <br />
          <span className="ed-display-italic" style={{ color: "var(--ed-copper)" }}>catch up.</span>
        </h2>
        <p className="ed-body text-[15px] mb-14 max-w-lg leading-relaxed" style={{ color: "var(--ed-ink-soft)" }}>
          Three structural advantages that compound over time. Not features — moats.
        </p>

        <div className="grid md:grid-cols-3 gap-5">
          {moats.map((moat, i) => (
            <motion.div
              key={moat.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{ delay: i * 0.1, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              className="group relative p-7 overflow-hidden transition-all duration-300"
              style={{
                border: "1px solid var(--ed-rule)",
                borderTop: "2px solid var(--ed-copper)",
                background: "var(--ed-bg-raised)",
                borderRadius: "2px",
              }}
            >
              {/* Copper hover wash */}
              <span
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{
                  background: "radial-gradient(ellipse at 50% 0%, var(--ed-copper-wash) 0%, transparent 60%)",
                }}
              />

              <div className="relative mb-6">{moat.icon}</div>
              <h3 className="ed-display relative text-[24px] mb-4 leading-tight" style={{ color: "var(--ed-ink)" }}>
                {moat.title}
              </h3>
              <p className="ed-body relative text-[14px] leading-relaxed" style={{ color: "var(--ed-ink-soft)" }}>
                {moat.desc}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
