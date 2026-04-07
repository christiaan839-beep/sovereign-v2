"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { CheckCircle2, Zap, Shield, Network, Cpu } from "lucide-react";

// ─── Model registry ─────────────────────────────────────────────────────────
const MODELS = [
  { id: "nemotron", name: "Nemotron-Ultra-253B", short: "NMT", provider: "NVIDIA NIM", color: "#10b981", colorClass: "emerald" },
  { id: "deepseek", name: "DeepSeek-V3.2-671B", short: "DSK", provider: "DeepSeek AI", color: "#06b6d4", colorClass: "cyan" },
  { id: "gemma4",   name: "Gemma-4-31B-IT",     short: "GMM", provider: "Google AI",  color: "#8b5cf6", colorClass: "violet" },
  { id: "qwen3",    name: "Qwen-3-235B-A22B",   short: "QWN", provider: "Alibaba",    color: "#f59e0b", colorClass: "amber" },
];

// ─── Example consensus run ───────────────────────────────────────────────────
const EXAMPLE = {
  task: "classify_outreach_quality",
  prompt: "Eval: Is this cold email likely to get a reply from a fintech CMO?",
  drafts: [
    { tokens: 3847, latency: 142, confidence: 0.743, critique: "Hook strong. CTA too vague — no specific ask or time anchor.", verdict: -1 },
    { tokens: 4102, latency: 189, confidence: 0.681, critique: "Personalisation thin. Recommend injecting Q4 pipeline pain point.", verdict: -1 },
    { tokens: 3519, latency: 138, confidence: 0.817, critique: "Tone professional. CTA unspecific — rewrite with concrete meeting ask.", verdict: -1 },
    { tokens: 4441, latency: 201, confidence: 0.726, critique: "Opening line converts well. Closing too aggressive — soften close.", verdict: -1 },
  ],
  synthesis: {
    output: "Probability of reply: 68.4% ↑ (baseline: 31%). Applied: stronger CTA with Thursday 3pm anchor, Q4 pipeline hook, softened close with value-first framing. Confidence delta: +22.8pp. Ready to deploy.",
    confidence: 0.892,
    tokens: 15909,
    models_agree: 4,
    latency_total: 670,
  },
};

// ─── Live number flicker ─────────────────────────────────────────────────────
function LiveNumber({ value, decimals = 0, suffix = "", prefix = "", className = "" }: {
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}) {
  const [display, setDisplay] = useState(value);
  const raf = useRef<number>(0);

  useEffect(() => {
    let frame = 0;
    const noise = () => {
      const jitter = (Math.random() - 0.5) * value * 0.012;
      setDisplay(value + jitter);
      frame = (frame + 1) % 6;
      raf.current = requestAnimationFrame(noise);
    };
    raf.current = requestAnimationFrame(noise);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);

  return (
    <span className={className}>
      {prefix}{display.toFixed(decimals)}{suffix}
    </span>
  );
}

// ─── Confidence bar ──────────────────────────────────────────────────────────
function ConfidenceBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-0.5 bg-white/5 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${value * 100}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <span className="text-[9px] font-mono tabular-nums" style={{ color }}>
        {(value * 100).toFixed(1)}%
      </span>
    </div>
  );
}

// ─── Disagreement radar ──────────────────────────────────────────────────────
function DisagreementMatrix({ active }: { active: boolean }) {
  const size = 80;
  const center = size / 2;

  const points = [
    { x: center, y: 8 },
    { x: size - 8, y: center },
    { x: center, y: size - 8 },
    { x: 8, y: center },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: active ? 1 : 0, scale: active ? 1 : 0.8 }}
      transition={{ duration: 0.4 }}
      className="relative mx-auto"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} className="absolute inset-0">
        {/* Connections */}
        {points.map((a, i) =>
          points.slice(i + 1).map((b, j) => (
            <motion.line
              key={`${i}-${i + j + 1}`}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke="rgba(245,158,11,0.3)"
              strokeWidth="0.5"
              animate={{ opacity: [0.2, 0.6, 0.2] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: (i + j) * 0.2 }}
            />
          ))
        )}
        {/* Nodes */}
        {MODELS.map((model, i) => (
          <motion.circle
            key={model.id}
            cx={points[i].x}
            cy={points[i].y}
            r={4}
            fill={model.color}
            animate={{ r: [3.5, 5, 3.5] }}
            transition={{ duration: 1.8, repeat: Infinity, delay: i * 0.4 }}
          />
        ))}
      </svg>
    </motion.div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
type Phase = "idle" | "generate" | "critique" | "synthesize" | "complete";

export function ConsensusEngine() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [revealedCards, setRevealedCards] = useState<number[]>([]);
  const [synthText, setSynthText] = useState("");
  const [synthDone, setSynthDone] = useState(false);
  const sectionRef = useRef<HTMLElement>(null);
  const isInView = useInView(sectionRef, { once: true, margin: "-100px" });
  const started = useRef(false);

  const runCycle = useCallback(() => {
    // Reset
    setPhase("generate");
    setRevealedCards([]);
    setSynthText("");
    setSynthDone(false);

    // Stagger-reveal model cards
    MODELS.forEach((_, i) => {
      setTimeout(() => setRevealedCards((p) => [...p, i]), i * 350 + 200);
    });

    // → Critique
    setTimeout(() => setPhase("critique"), 3400);

    // → Synthesize + typewriter
    setTimeout(() => {
      setPhase("synthesize");
      const full = EXAMPLE.synthesis.output;
      let i = 0;
      const iv = setInterval(() => {
        if (i < full.length) {
          setSynthText(full.slice(0, i + 1));
          i++;
        } else {
          clearInterval(iv);
          setSynthDone(true);
          setPhase("complete");
          // Loop
          setTimeout(runCycle, 5000);
        }
      }, 16);
    }, 6800);
  }, []);

  useEffect(() => {
    if (isInView && !started.current) {
      started.current = true;
      setTimeout(runCycle, 600);
    }
  }, [isInView, runCycle]);

  const isGenerating = phase === "generate";
  const isCritiquing = phase === "critique";
  const isSynthesizing = phase === "synthesize" || phase === "complete";
  const anyActive = phase !== "idle";

  return (
    <section
      ref={sectionRef}
      className="relative py-28 px-6 bg-[#020203] overflow-hidden perf-section"
    >
      {/* Circuit grid */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.02)_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_70%_60%_at_50%_50%,black,transparent)] pointer-events-none" />
      {/* Glow blob */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[500px] rounded-full bg-emerald-500/[0.022] blur-[160px] pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto">

        {/* ── Header ──────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="max-w-2xl mb-16"
        >
          <p className="text-[10px] font-bold uppercase tracking-[0.35em] text-emerald-500/50 mb-4 font-mono">
            CONSENSUS-ENGINE · v3.2 · ACTIVE
          </p>
          <h2 className="text-4xl md:text-6xl font-black text-white tracking-tight leading-[1.05] mb-5">
            Four models debate.<br />
            <span className="text-emerald-400">One answer is correct.</span>
          </h2>
          <p className="text-sm text-neutral-400 leading-relaxed">
            Every output runs through 4 independent large models simultaneously. They generate,
            critique each other, then converge. The result isn&apos;t the most popular answer —
            it&apos;s the most defensible one.
          </p>
        </motion.div>

        {/* ── Two-column layout ───────────────────────────── */}
        <div className="grid lg:grid-cols-5 gap-6">

          {/* ── Left: 4 model cards ──────────────── */}
          <div className="lg:col-span-3 grid grid-cols-2 gap-3">
            {MODELS.map((model, i) => {
              const draft = EXAMPLE.drafts[i];
              const isVisible = revealedCards.includes(i);

              return (
                <motion.div
                  key={model.id}
                  animate={{
                    opacity: isVisible ? 1 : 0,
                    y: isVisible ? 0 : 16,
                    scale: isVisible ? 1 : 0.96,
                  }}
                  transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="relative rounded-2xl border bg-[#060608] overflow-hidden"
                  style={{ borderColor: isVisible ? `${model.color}20` : "rgba(255,255,255,0.04)" }}
                >
                  {/* Active glow */}
                  {isVisible && (
                    <motion.div
                      className="absolute inset-0 pointer-events-none"
                      style={{ background: `radial-gradient(ellipse at 50% 0%, ${model.color}08, transparent 70%)` }}
                    />
                  )}

                  <div className="p-4">
                    {/* Model header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="text-[9px] font-mono font-bold uppercase tracking-wider mb-0.5" style={{ color: model.color }}>
                          {model.short}
                        </div>
                        <div className="text-[10px] text-neutral-300 font-mono leading-tight">{model.name}</div>
                        <div className="text-[8px] text-neutral-600 mt-0.5">{model.provider}</div>
                      </div>
                      <div className="text-right">
                        <AnimatePresence>
                          {isVisible && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                              <div className="text-[9px] font-mono tabular-nums text-neutral-500">
                                <LiveNumber value={draft.latency} suffix="ms" />
                              </div>
                              <div className="text-[8px] text-neutral-600 font-mono">
                                <LiveNumber value={draft.tokens} decimals={0} suffix=" tok" />
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>

                    {/* Confidence */}
                    {isVisible && (
                      <div className="mb-3">
                        <ConfidenceBar value={draft.confidence} color={model.color} />
                      </div>
                    )}

                    {/* Output */}
                    <AnimatePresence mode="wait">
                      {isGenerating && isVisible && (
                        <motion.div key="gen" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          <p className="text-[10px] font-mono text-neutral-400 leading-relaxed">
                            {draft.critique}
                            <motion.span
                              animate={{ opacity: [1, 0, 1] }}
                              transition={{ duration: 0.8, repeat: Infinity }}
                              style={{ color: model.color }}
                            >
                              ▌
                            </motion.span>
                          </p>
                        </motion.div>
                      )}
                      {isCritiquing && isVisible && (
                        <motion.div key="crit" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                          <p className="text-[10px] font-mono text-neutral-400 leading-relaxed mb-2">
                            {draft.critique}
                          </p>
                          <div className="flex items-center gap-1">
                            <span className="text-[8px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/15 font-mono">
                              ΔCONF: −{(0.15 + Math.random() * 0.1).toFixed(2)}
                            </span>
                          </div>
                        </motion.div>
                      )}
                      {isSynthesizing && (
                        <motion.div key="synth" initial={{ opacity: 0.4 }} animate={{ opacity: 0.25 }} exit={{ opacity: 0 }}>
                          <p className="text-[10px] font-mono text-neutral-600 leading-relaxed line-through">
                            {draft.critique}
                          </p>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* ── Right: pipeline + output ─────────── */}
          <div className="lg:col-span-2 flex flex-col gap-4">

            {/* Pipeline status */}
            <div className="rounded-2xl border border-white/[0.05] bg-[#060608] p-5">
              <div className="flex items-center gap-2 mb-4">
                <Network className="w-3.5 h-3.5 text-emerald-500/60" />
                <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider">Pipeline Status</span>
              </div>

              <div className="space-y-3">
                {[
                  { label: "GENERATE", done: anyActive, active: isGenerating },
                  { label: "CRITIQUE", done: isCritiquing || isSynthesizing, active: isCritiquing },
                  { label: "SYNTHESIZE", done: isSynthesizing, active: isSynthesizing },
                  { label: "VERIFY", done: synthDone, active: synthDone },
                ].map((step) => (
                  <div key={step.label} className="flex items-center gap-3">
                    <motion.div
                      animate={{
                        backgroundColor: step.done ? "#10b981" : step.active ? "#10b98140" : "rgba(255,255,255,0.05)",
                        boxShadow: step.active ? "0 0 8px rgba(16,185,129,0.4)" : "none",
                      }}
                      transition={{ duration: 0.3 }}
                      className="w-2 h-2 rounded-full flex-shrink-0"
                    />
                    <span className={`text-[10px] font-mono uppercase tracking-wider flex-1 ${step.done ? "text-emerald-400" : step.active ? "text-white" : "text-neutral-700"}`}>
                      {step.label}
                    </span>
                    {step.active && (
                      <motion.span
                        animate={{ opacity: [1, 0.3, 1] }}
                        transition={{ duration: 0.8, repeat: Infinity }}
                        className="text-[8px] text-emerald-500 font-mono"
                      >
                        ●●●
                      </motion.span>
                    )}
                    {step.done && !step.active && (
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    )}
                  </div>
                ))}
              </div>

              {/* Network graph (critique phase) */}
              <div className="mt-4 flex items-center justify-between">
                <DisagreementMatrix active={isCritiquing} />
                <div className="flex flex-col gap-1 text-right">
                  <div className="text-[9px] text-neutral-600 font-mono">4 models</div>
                  <div className="text-[9px] text-neutral-600 font-mono">
                    <LiveNumber value={EXAMPLE.synthesis.tokens} decimals={0} suffix=" tok total" />
                  </div>
                  <div className="text-[9px] text-neutral-600 font-mono">
                    <LiveNumber value={EXAMPLE.synthesis.latency_total} suffix="ms total" />
                  </div>
                </div>
              </div>
            </div>

            {/* Synthesis output box */}
            <div className="flex-1 rounded-2xl border bg-[#060608] overflow-hidden relative"
              style={{ borderColor: isSynthesizing ? "rgba(16,185,129,0.25)" : "rgba(255,255,255,0.05)" }}>
              <motion.div
                className="absolute inset-0 pointer-events-none"
                animate={{ opacity: isSynthesizing ? 1 : 0 }}
                style={{ background: "radial-gradient(ellipse at 50% 100%, rgba(16,185,129,0.06), transparent 70%)" }}
              />

              <div className="p-5 h-full flex flex-col">
                <div className="flex items-center gap-2 mb-4">
                  <Cpu className="w-3.5 h-3.5 text-emerald-500/60" />
                  <span className="text-[10px] font-mono text-neutral-500 uppercase tracking-wider flex-1">Consensus Output</span>
                  {synthDone && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20"
                    >
                      <div className="w-1 h-1 rounded-full bg-emerald-400" />
                      <span className="text-[8px] text-emerald-400 font-mono font-bold">VERIFIED</span>
                    </motion.div>
                  )}
                </div>

                <div className="flex-1 flex flex-col justify-between">
                  <AnimatePresence mode="wait">
                    {!isSynthesizing && (
                      <motion.div
                        key="waiting"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="flex flex-col items-center justify-center h-full gap-2 py-6"
                      >
                        <div className="grid grid-cols-4 gap-1">
                          {MODELS.map((model) => (
                            <motion.div
                              key={model.id}
                              animate={{ opacity: revealedCards.length > 0 ? [0.3, 0.7, 0.3] : 0.1 }}
                              transition={{ duration: 1.5 + Math.random(), repeat: Infinity, delay: Math.random() }}
                              className="w-8 h-8 rounded-lg border flex items-center justify-center text-[9px] font-mono font-bold"
                              style={{ borderColor: `${model.color}20`, color: model.color }}
                            >
                              {model.short}
                            </motion.div>
                          ))}
                        </div>
                        <p className="text-[9px] text-neutral-600 font-mono text-center">
                          {isGenerating ? "Models generating..." : isCritiquing ? "Cross-critiquing..." : "Awaiting task..."}
                        </p>
                      </motion.div>
                    )}

                    {isSynthesizing && (
                      <motion.div
                        key="output"
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                      >
                        <p className="text-[11px] font-mono text-neutral-200 leading-relaxed">
                          {synthText}
                          {!synthDone && (
                            <motion.span
                              animate={{ opacity: [1, 0, 1] }}
                              transition={{ duration: 0.6, repeat: Infinity }}
                              className="text-emerald-400"
                            >
                              ▌
                            </motion.span>
                          )}
                        </p>

                        {synthDone && (
                          <motion.div
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="mt-4 space-y-2"
                          >
                            <ConfidenceBar value={EXAMPLE.synthesis.confidence} color="#10b981" />
                            <div className="flex items-center gap-2 mt-2">
                              {["4/4 agree", "5-layer pass", "deploy ready"].map((b) => (
                                <span key={b} className="text-[8px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 font-mono">
                                  ✓ {b}
                                </span>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Bottom bar ─────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.6 }}
          className="mt-8 flex flex-wrap items-center justify-between gap-4"
        >
          <div className="flex items-center gap-6">
            {[
              { label: "Models", value: "4 parallel" },
              { label: "Latency", value: "<700ms" },
              { label: "Accuracy boost", value: "+22.8pp" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-sm font-black text-white font-mono">{stat.value}</div>
                <div className="text-[9px] text-neutral-600 uppercase tracking-wider">{stat.label}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 text-[10px] text-neutral-500 font-mono">
            <Shield className="w-3.5 h-3.5 text-emerald-500/40" />
            5-layer NeMo Guardrails · every request · always
          </div>
        </motion.div>
      </div>
    </section>
  );
}
