"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  Sparkles,
  Loader2,
  X,
  ArrowUpRight,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface Team {
  key: string;
  name: string;
  members: string[];
  lead: string;
}

interface DebateRound {
  round: number;
  critiques: Array<{ from: string; to: string; critique: string }>;
}

interface TeamResult {
  team: string;
  perspectives: Array<{ role: string; analysis: string }>;
  synthesis: string;
  debate: DebateRound[];
  confidence: number;
  duration: number;
}

interface UpgradePayload {
  currentPlan: string;
  currentLimit: number;
  used: number;
  nextPlan: string;
  nextLimit: number;
  nextPrice: string;
  upgradeUrl: string;
  resetDate: string;
}

const TEAM_BLURBS: Record<
  string,
  { tagline: string; useCase: string; accent: string }
> = {
  "war-room": {
    tagline: "Strategic battle plan from 4 specialists",
    useCase:
      "Use for: market entries, competitor takedowns, pricing decisions, strategic pivots.",
    accent: "from-emerald-500/20 to-cyan-500/10 border-emerald-500/20",
  },
  "content-council": {
    tagline: "Editorial alignment from 3 experts",
    useCase:
      "Use for: content strategy, editorial calendars, SEO + storytelling balance.",
    accent: "from-violet-500/20 to-fuchsia-500/10 border-violet-500/20",
  },
  "deal-room": {
    tagline: "Sales war-game with objection coverage",
    useCase:
      "Use for: account research, objection handling, deal negotiation prep.",
    accent: "from-amber-500/20 to-orange-500/10 border-amber-500/20",
  },
};

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [active, setActive] = useState<Team | null>(null);

  useEffect(() => {
    fetch("/api/teams")
      .then((r) => r.json())
      .then((d) => setTeams(d.teams || []))
      .catch(() => setTeams([]))
      .finally(() => setLoadingTeams(false));
  }, []);

  return (
    <div className="min-h-screen bg-[#030303] text-neutral-200 px-4 lg:px-8 py-10">
      <div className="max-w-6xl mx-auto">
        <header className="mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.04] border border-white/[0.06] text-[10px] uppercase tracking-widest text-emerald-400/80 mb-4">
            <Sparkles className="w-3 h-3" /> Multi-agent debate
          </div>
          <h1 className="text-3xl lg:text-4xl font-black tracking-tight text-white mb-3">
            Agent Teams
          </h1>
          <p className="text-sm text-neutral-500 max-w-2xl">
            Pick a team. Drop in your objective. Each member analyzes
            independently, debates the others' perspectives, and the lead
            synthesizes a single decisive output. Cost-optimized: parallel
            analyses on Cerebras, debate on NIM, synthesis on Gemini.
          </p>
        </header>

        {loadingTeams ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="h-56 rounded-2xl bg-white/[0.02] border border-white/[0.04] animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {teams.map((team) => {
              const blurb = TEAM_BLURBS[team.key] ?? {
                tagline: `${team.members.length} specialists + lead synthesis`,
                useCase: "",
                accent: "from-white/[0.04] to-white/[0.02] border-white/[0.06]",
              };
              return (
                <motion.button
                  key={team.key}
                  whileHover={{ y: -3 }}
                  onClick={() => setActive(team)}
                  className={`text-left p-6 rounded-2xl bg-gradient-to-br ${blurb.accent} backdrop-blur-xl transition-all hover:shadow-[0_0_40px_-10px_rgba(16,185,129,0.18)]`}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-10 h-10 rounded-xl bg-white/[0.05] border border-white/[0.08] flex items-center justify-center">
                      <Users className="w-5 h-5 text-emerald-400" />
                    </div>
                    <ArrowUpRight className="w-4 h-4 text-neutral-500" />
                  </div>

                  <h3 className="text-lg font-bold text-white mb-1">
                    {team.name}
                  </h3>
                  <p className="text-xs text-neutral-400 mb-4">
                    {blurb.tagline}
                  </p>

                  <div className="space-y-1 mb-4">
                    <div className="text-[10px] uppercase tracking-wider text-neutral-600 mb-1">
                      Lead
                    </div>
                    <div className="text-xs text-emerald-300">{team.lead}</div>
                  </div>

                  <div>
                    <div className="text-[10px] uppercase tracking-wider text-neutral-600 mb-1">
                      Members
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {team.members.map((m) => (
                        <span
                          key={m}
                          className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-neutral-400"
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  </div>

                  {blurb.useCase && (
                    <p className="text-[10px] text-neutral-600 mt-4 italic">
                      {blurb.useCase}
                    </p>
                  )}
                </motion.button>
              );
            })}
          </div>
        )}
      </div>

      <AnimatePresence>
        {active && <RunModal team={active} onClose={() => setActive(null)} />}
      </AnimatePresence>
    </div>
  );
}

function RunModal({ team, onClose }: { team: Team; onClose: () => void }) {
  const [objective, setObjective] = useState("");
  const [context, setContext] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<TeamResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [upgrade, setUpgrade] = useState<UpgradePayload | null>(null);

  async function run() {
    setError(null);
    setUpgrade(null);
    setResult(null);
    if (objective.trim().length < 10) {
      setError("Objective must be at least 10 characters.");
      return;
    }
    setRunning(true);
    try {
      const res = await fetch("/api/teams/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          team: team.key,
          objective: objective.trim(),
          context: context.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.status === 429 && data?.upgrade) {
        setUpgrade(data.upgrade as UpgradePayload);
        setError(data.message || "Usage limit reached.");
      } else if (!res.ok) {
        setError(data?.error || `Run failed (HTTP ${res.status})`);
      } else {
        setResult(data.result as TeamResult);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    }
    setRunning(false);
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 24, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 16, opacity: 0 }}
        transition={{ duration: 0.25 }}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-3xl my-12 rounded-2xl bg-[#0A0A0A]/95 border border-white/[0.08] backdrop-blur-xl shadow-2xl"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-lg bg-white/[0.04] border border-white/[0.06] flex items-center justify-center text-neutral-500 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="p-7 border-b border-white/[0.05]">
          <div className="text-[10px] uppercase tracking-widest text-emerald-400/80 mb-2">
            {team.lead} · {team.members.length} members
          </div>
          <h2 className="text-2xl font-black text-white">{team.name}</h2>
        </div>

        {!result && (
          <div className="p-7 space-y-5">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
                Objective <span className="text-emerald-400">*</span>
              </label>
              <textarea
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="What should the team analyze? Be specific."
                rows={3}
                maxLength={4000}
                className="w-full bg-[#040404] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500/30 transition-colors resize-none"
              />
              <div className="text-[10px] text-neutral-600 mt-1">
                {objective.length} / 4000
              </div>
            </div>

            <div>
              <label className="block text-[10px] uppercase tracking-widest text-neutral-500 mb-2">
                Context (optional)
              </label>
              <textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                placeholder="Background, constraints, prior research, links..."
                rows={4}
                maxLength={8000}
                className="w-full bg-[#040404] border border-white/[0.06] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500/30 transition-colors resize-none"
              />
            </div>

            {error && !upgrade && (
              <div className="p-3 rounded-lg bg-red-500/[0.06] border border-red-500/20 text-xs text-red-300">
                {error}
              </div>
            )}

            {upgrade && (
              <div className="p-4 rounded-xl bg-amber-500/[0.06] border border-amber-500/20">
                <div className="text-[10px] uppercase tracking-widest text-amber-400 mb-2">
                  Usage limit reached
                </div>
                <p className="text-xs text-neutral-300 mb-3">
                  You've used {upgrade.used}/{upgrade.currentLimit} runs on the{" "}
                  {upgrade.currentPlan} plan. Upgrade to {upgrade.nextPlan} for{" "}
                  {upgrade.nextLimit.toLocaleString()} runs/month at{" "}
                  {upgrade.nextPrice}.
                </p>
                <a
                  href={upgrade.upgradeUrl}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-300 hover:text-amber-200"
                >
                  Upgrade <ArrowUpRight className="w-3 h-3" />
                </a>
              </div>
            )}

            <button
              onClick={run}
              disabled={running || objective.trim().length < 10}
              className="w-full px-5 py-3 rounded-xl bg-emerald-500/15 border border-emerald-500/25 text-sm font-semibold text-emerald-400 hover:bg-emerald-500/25 disabled:opacity-30 transition-all flex items-center justify-center gap-2"
            >
              {running ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Team is debating…
                </>
              ) : (
                <>
                  Run {team.name}
                  <ArrowUpRight className="w-4 h-4" />
                </>
              )}
            </button>

            {running && (
              <p className="text-[10px] text-neutral-600 text-center">
                Typically 30-90s. Parallel analyses → adversarial debate → lead
                synthesis.
              </p>
            )}
          </div>
        )}

        {result && (
          <ResultView result={result} onReset={() => setResult(null)} />
        )}
      </motion.div>
    </motion.div>
  );
}

function ResultView({
  result,
  onReset,
}: {
  result: TeamResult;
  onReset: () => void;
}) {
  const [showPerspectives, setShowPerspectives] = useState(false);
  const [showDebate, setShowDebate] = useState(false);

  return (
    <div className="p-7 space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">
            Confidence
          </div>
          <div className="text-sm font-bold text-emerald-400">
            {Math.round(result.confidence * 100)}%
          </div>
          <div className="text-[10px] uppercase tracking-widest text-neutral-500">
            · {(result.duration / 1000).toFixed(1)}s
          </div>
        </div>
        <button
          onClick={onReset}
          className="text-[10px] uppercase tracking-widest text-neutral-500 hover:text-white"
        >
          Run again
        </button>
      </div>

      <div>
        <div className="text-[10px] uppercase tracking-widest text-emerald-400/80 mb-2">
          Synthesis
        </div>
        <div className="p-5 rounded-xl bg-emerald-500/[0.04] border border-emerald-500/15">
          <pre className="text-xs text-neutral-200 whitespace-pre-wrap leading-relaxed font-sans">
            {result.synthesis}
          </pre>
        </div>
      </div>

      <Collapsible
        title={`${result.perspectives.length} perspectives`}
        open={showPerspectives}
        onToggle={() => setShowPerspectives((v) => !v)}
      >
        <div className="space-y-3">
          {result.perspectives.map((p, i) => (
            <div
              key={i}
              className="p-4 rounded-xl bg-white/[0.02] border border-white/[0.04]"
            >
              <div className="text-[10px] uppercase tracking-widest text-emerald-400/70 mb-1">
                {p.role}
              </div>
              <pre className="text-xs text-neutral-300 whitespace-pre-wrap leading-relaxed font-sans">
                {p.analysis}
              </pre>
            </div>
          ))}
        </div>
      </Collapsible>

      {result.debate.length > 0 && (
        <Collapsible
          title={`${result.debate.length} debate round${result.debate.length === 1 ? "" : "s"}`}
          open={showDebate}
          onToggle={() => setShowDebate((v) => !v)}
        >
          <div className="space-y-4">
            {result.debate.map((round) => (
              <div key={round.round}>
                <div className="text-[10px] uppercase tracking-widest text-neutral-600 mb-2">
                  Round {round.round}
                </div>
                <div className="space-y-2">
                  {round.critiques.map((c, i) => (
                    <div
                      key={i}
                      className="p-3 rounded-lg bg-white/[0.02] border border-white/[0.04]"
                    >
                      <div className="text-[10px] text-neutral-500 mb-1">
                        <span className="text-amber-400">{c.from}</span> →{" "}
                        <span className="text-cyan-400">{c.to}</span>
                      </div>
                      <pre className="text-xs text-neutral-300 whitespace-pre-wrap leading-relaxed font-sans">
                        {c.critique}
                      </pre>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Collapsible>
      )}
    </div>
  );
}

function Collapsible({
  title,
  open,
  onToggle,
  children,
}: {
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-white/[0.05]">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-white/[0.02] transition-colors"
      >
        <span className="text-xs uppercase tracking-widest text-neutral-400">
          {title}
        </span>
        {open ? (
          <ChevronUp className="w-4 h-4 text-neutral-500" />
        ) : (
          <ChevronDown className="w-4 h-4 text-neutral-500" />
        )}
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 border-t border-white/[0.04]">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
