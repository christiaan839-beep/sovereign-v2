"use client";

import { motion } from "framer-motion";
import { SpotlightCard } from "@/components/ui/SpotlightCard";

/**
 * ThreeMoatsGrid — 3-column grid showcasing the three unique moats.
 * Pure copper accent. No rainbow. Glassmorphism + copper top border.
 */
export function ThreeMoatsGrid() {
  const moats = [
    {
      id: "a2e",
      title: "A2E Economy",
      desc: "The only platform where agents hire agents autonomously. Creators earn 70%. The marketplace compounds with every deployment.",
      icon: (
        <svg
          width="36"
          height="36"
          viewBox="0 0 36 36"
          fill="none"
          aria-hidden="true"
        >
          {/* Node graph: center node + 5 outer nodes with copper lines */}
          <circle
            cx="18"
            cy="18"
            r="3.5"
            stroke="#B5532C"
            strokeWidth="1.5"
            fill="rgba(181,83,44,0.15)"
          />
          <circle
            cx="6"
            cy="12"
            r="2.5"
            stroke="#B5532C"
            strokeWidth="1"
            fill="rgba(181,83,44,0.08)"
            strokeOpacity="0.6"
          />
          <circle
            cx="30"
            cy="12"
            r="2.5"
            stroke="#B5532C"
            strokeWidth="1"
            fill="rgba(181,83,44,0.08)"
            strokeOpacity="0.6"
          />
          <circle
            cx="8"
            cy="26"
            r="2.5"
            stroke="#B5532C"
            strokeWidth="1"
            fill="rgba(181,83,44,0.08)"
            strokeOpacity="0.6"
          />
          <circle
            cx="28"
            cy="26"
            r="2.5"
            stroke="#B5532C"
            strokeWidth="1"
            fill="rgba(181,83,44,0.08)"
            strokeOpacity="0.6"
          />
          <circle
            cx="18"
            cy="30"
            r="2"
            stroke="#B5532C"
            strokeWidth="1"
            fill="rgba(181,83,44,0.08)"
            strokeOpacity="0.5"
          />
          {/* Edges from center */}
          <line
            x1="18"
            y1="18"
            x2="6"
            y2="12"
            stroke="#B5532C"
            strokeWidth="0.75"
            strokeOpacity="0.45"
          />
          <line
            x1="18"
            y1="18"
            x2="30"
            y2="12"
            stroke="#B5532C"
            strokeWidth="0.75"
            strokeOpacity="0.45"
          />
          <line
            x1="18"
            y1="18"
            x2="8"
            y2="26"
            stroke="#B5532C"
            strokeWidth="0.75"
            strokeOpacity="0.45"
          />
          <line
            x1="18"
            y1="18"
            x2="28"
            y2="26"
            stroke="#B5532C"
            strokeWidth="0.75"
            strokeOpacity="0.45"
          />
          <line
            x1="18"
            y1="18"
            x2="18"
            y2="30"
            stroke="#B5532C"
            strokeWidth="0.75"
            strokeOpacity="0.45"
          />
          {/* Lateral edge */}
          <line
            x1="6"
            y1="12"
            x2="8"
            y2="26"
            stroke="#B5532C"
            strokeWidth="0.5"
            strokeOpacity="0.25"
          />
          <line
            x1="30"
            y1="12"
            x2="28"
            y2="26"
            stroke="#B5532C"
            strokeWidth="0.5"
            strokeOpacity="0.25"
          />
        </svg>
      ),
    },
    {
      id: "memory",
      title: "Semantic Memory",
      desc: "Every run gets smarter. 1,024-dim embeddings store context across all executions. Compounding intelligence that no competitor can replicate overnight.",
      icon: (
        <svg
          width="36"
          height="36"
          viewBox="0 0 36 36"
          fill="none"
          aria-hidden="true"
        >
          {/* Waveform / brain outline — copper lines */}
          <path
            d="M2 18 Q5 10 8 18 Q11 26 14 18 Q17 10 20 18 Q23 26 26 18 Q29 10 32 18 Q34 22 36 18"
            stroke="#B5532C"
            strokeWidth="1.5"
            fill="none"
            strokeOpacity="0.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M2 22 Q5 16 8 22 Q11 28 14 22 Q17 16 20 22 Q23 28 26 22 Q29 16 32 22"
            stroke="#B5532C"
            strokeWidth="0.75"
            fill="none"
            strokeOpacity="0.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* Vertical tick marks */}
          <line
            x1="14"
            y1="10"
            x2="14"
            y2="26"
            stroke="#B5532C"
            strokeWidth="0.5"
            strokeOpacity="0.25"
          />
          <line
            x1="20"
            y1="10"
            x2="20"
            y2="26"
            stroke="#B5532C"
            strokeWidth="0.5"
            strokeOpacity="0.25"
          />
        </svg>
      ),
    },
    {
      id: "sovereignty",
      title: "Model Sovereignty",
      desc: "39+ models. Best-in-class routing. Sovereign Mode routes zero traffic through Chinese providers. Your data never trains anything.",
      icon: (
        <svg
          width="36"
          height="36"
          viewBox="0 0 36 36"
          fill="none"
          aria-hidden="true"
        >
          {/* Grid of nodes */}
          {[6, 18, 30].map((cx) =>
            [6, 18, 30].map((cy) => (
              <circle
                key={`${cx}-${cy}`}
                cx={cx}
                cy={cy}
                r="2.5"
                stroke="#B5532C"
                strokeWidth="1"
                fill="rgba(181,83,44,0.1)"
                strokeOpacity={cx === 18 && cy === 18 ? 0.9 : 0.4}
              />
            )),
          )}
          {/* Horizontal grid lines */}
          {[6, 18, 30].map((y) => (
            <line
              key={`h${y}`}
              x1="8.5"
              y1={y}
              x2="27.5"
              y2={y}
              stroke="#B5532C"
              strokeWidth="0.5"
              strokeOpacity="0.2"
            />
          ))}
          {/* Vertical grid lines */}
          {[6, 18, 30].map((x) => (
            <line
              key={`v${x}`}
              x1={x}
              y1="8.5"
              x2={x}
              y2="27.5"
              stroke="#B5532C"
              strokeWidth="0.5"
              strokeOpacity="0.2"
            />
          ))}
          {/* Lock icon overlay on center node */}
          <rect
            x="15.5"
            y="16.5"
            width="5"
            height="4"
            rx="0.75"
            stroke="#B5532C"
            strokeWidth="1"
            fill="rgba(181,83,44,0.25)"
            strokeOpacity="0.8"
          />
          <path
            d="M16.5 16.5 V15 a1.5 1.5 0 0 1 3 0 V16.5"
            stroke="#B5532C"
            strokeWidth="1"
            fill="none"
            strokeOpacity="0.8"
          />
        </svg>
      ),
    },
  ];

  return (
    <section className="px-6 py-20 md:py-28 bg-[#030303]">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8 flex items-center gap-4 flex-wrap">
          <span className="font-mono text-[10px] text-neutral-600 tracking-[0.2em]">
            02 / 09
          </span>
          <span aria-hidden="true" className="h-px w-6 bg-white/[0.12]" />
          <p className="font-serif italic text-[13px] text-neutral-500 tracking-[-0.01em]">
            three moats
          </p>
        </div>

        <h2 className="font-serif text-4xl md:text-5xl lg:text-[58px] leading-[1.05] mb-4 tracking-[-0.02em] max-w-3xl">
          Why competitors can&apos;t
          <br />
          <em className="not-italic text-[#B5532C]">catch up.</em>
        </h2>
        <p className="text-neutral-400 text-[15px] mb-12 max-w-lg leading-relaxed">
          Three structural advantages that compound over time. Not features —
          moats.
        </p>

        <div className="grid md:grid-cols-3 gap-4">
          {moats.map((moat, i) => (
            <motion.div
              key={moat.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-60px" }}
              transition={{
                delay: i * 0.1,
                duration: 0.55,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              {/* SpotlightCard: mouse-reactive radial glow tracks the
                  cursor across the card surface. Antigravity / Linear
                  / Vercel signature move. Copper accent here (this
                  section is the marketing-surface "three moats"
                  pitch); audit-surface usages should pass
                  accent="cyan". */}
              <SpotlightCard
                accent="copper"
                radius={360}
                className="p-7 rounded-[6px] border border-white/[0.06] bg-white/[0.025] transition-all duration-300"
                style={{
                  borderTopColor: "rgba(181,83,44,0.55)",
                  borderTopWidth: "2px",
                  boxShadow:
                    "inset 0 1px 0 rgba(255,255,255,0.06), 0 1px 0 rgba(0,0,0,0.5)",
                }}
              >
                <div className="mb-5">{moat.icon}</div>
                <h3 className="font-serif text-[22px] text-white mb-3 leading-tight tracking-tight">
                  {moat.title}
                </h3>
                <p className="text-[13.5px] text-neutral-400 leading-[1.65]">
                  {moat.desc}
                </p>
              </SpotlightCard>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
