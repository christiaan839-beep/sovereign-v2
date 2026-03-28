"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  Brain,
  PenTool,
  Target,
  Route,
  Shield,
  Phone,
  Code,
  Search,
  Zap,
  CheckCircle,
} from "lucide-react";

const agents = [
  {
    codename: "Nexus",
    role: "Lead Hunter",
    color: "emerald",
    icon: Brain,
    description:
      "Finds and qualifies leads across LinkedIn, Apollo, and web scraping",
    tasks: 2847,
    successRate: 94,
  },
  {
    codename: "Cipher",
    role: "Content Engine",
    color: "blue",
    icon: PenTool,
    description:
      "Writes blog posts, emails, and social content with anti-slop pipeline",
    tasks: 1923,
    successRate: 97,
  },
  {
    codename: "Phantom",
    role: "Site Assassin",
    color: "red",
    icon: Target,
    description:
      "Reverse-engineers competitor tech stacks, SEO gaps, and strategies",
    tasks: 891,
    successRate: 92,
  },
  {
    codename: "Atlas",
    role: "Smart Router",
    color: "violet",
    icon: Route,
    description:
      "Routes every request to the optimal model across 51+ options",
    tasks: 12450,
    successRate: 99,
  },
  {
    codename: "Sentinel",
    role: "Guardian",
    color: "amber",
    icon: Shield,
    description:
      "5-layer safety pipeline: jailbreak, PII, content, topic, quality",
    tasks: 8234,
    successRate: 100,
  },
  {
    codename: "Echo",
    role: "Voice Closer",
    color: "cyan",
    icon: Phone,
    description:
      "Sub-200ms voice calls for lead qualification and appointment booking",
    tasks: 456,
    successRate: 88,
  },
  {
    codename: "Forge",
    role: "Code Agent",
    color: "orange",
    icon: Code,
    description:
      "Writes, reviews, and deploys code from natural language prompts",
    tasks: 634,
    successRate: 91,
  },
  {
    codename: "Oracle",
    role: "Deep Search",
    color: "pink",
    icon: Search,
    description:
      "Perplexity-style research with citations and source verification",
    tasks: 1102,
    successRate: 95,
  },
];

const colorMap: Record<string, { bg: string; text: string; ring: string; bar: string }> = {
  emerald: {
    bg: "bg-emerald-500/20",
    text: "text-emerald-400",
    ring: "ring-emerald-500/30",
    bar: "bg-emerald-500",
  },
  blue: {
    bg: "bg-blue-500/20",
    text: "text-blue-400",
    ring: "ring-blue-500/30",
    bar: "bg-blue-500",
  },
  red: {
    bg: "bg-red-500/20",
    text: "text-red-400",
    ring: "ring-red-500/30",
    bar: "bg-red-500",
  },
  violet: {
    bg: "bg-violet-500/20",
    text: "text-violet-400",
    ring: "ring-violet-500/30",
    bar: "bg-violet-500",
  },
  amber: {
    bg: "bg-amber-500/20",
    text: "text-amber-400",
    ring: "ring-amber-500/30",
    bar: "bg-amber-500",
  },
  cyan: {
    bg: "bg-cyan-500/20",
    text: "text-cyan-400",
    ring: "ring-cyan-500/30",
    bar: "bg-cyan-500",
  },
  orange: {
    bg: "bg-orange-500/20",
    text: "text-orange-400",
    ring: "ring-orange-500/30",
    bar: "bg-orange-500",
  },
  pink: {
    bg: "bg-pink-500/20",
    text: "text-pink-400",
    ring: "ring-pink-500/30",
    bar: "bg-pink-500",
  },
};

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: "easeOut" as const } },
};

export default function AgentProfilePage() {
  const [deployed, setDeployed] = useState<Set<string>>(new Set());

  const handleDeploy = (codename: string) => {
    setDeployed((prev) => {
      const next = new Set(prev);
      next.add(codename);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-[#000000] px-4 py-12 sm:px-6 lg:px-8" role="main" aria-label="Agent profiles">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="mx-auto max-w-7xl mb-12"
      >
        <h1 className="text-3xl font-bold text-white sm:text-4xl">
          Agent Profiles
        </h1>
        <p className="mt-2 text-neutral-400 text-lg">
          Deploy specialized AI agents to automate every layer of your pipeline.
        </p>
      </motion.div>

      {/* Grid */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="mx-auto grid max-w-7xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        {agents.map((agent) => {
          const colors = colorMap[agent.color];
          const Icon = agent.icon;
          const isDeployed = deployed.has(agent.codename);

          return (
            <motion.div
              key={agent.codename}
              variants={item}
              whileHover={{ scale: 1.03 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="group relative flex flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl"
            >
              {/* Icon circle */}
              <div
                className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${colors.bg} ring-1 ${colors.ring}`}
              >
                <Icon className={`h-9 w-9 ${colors.text}`} strokeWidth={1.5} />
              </div>

              {/* Name & role */}
              <h2 className="mt-5 text-center text-xl font-bold text-white">
                {agent.codename}
              </h2>
              <p className={`mt-1 text-center text-sm font-medium ${colors.text}`}>
                {agent.role}
              </p>

              {/* Description */}
              <p className="mt-3 flex-1 text-center text-sm leading-relaxed text-neutral-400">
                {agent.description}
              </p>

              {/* Stats */}
              <div className="mt-5 flex items-center justify-between rounded-xl bg-white/[0.03] px-4 py-3">
                <div className="text-center">
                  <p className="text-xs text-neutral-500">Tasks</p>
                  <p className="text-sm font-semibold text-white">
                    {agent.tasks.toLocaleString()}
                  </p>
                </div>
                <div className="h-6 w-px bg-white/10" />
                <div className="text-center">
                  <p className="text-xs text-neutral-500">Success</p>
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-16 overflow-hidden rounded-full bg-white/10">
                      <div
                        className={`h-full rounded-full ${colors.bar}`}
                        style={{ width: `${agent.successRate}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-white">
                      {agent.successRate}%
                    </span>
                  </div>
                </div>
              </div>

              {/* Deploy button */}
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={() => handleDeploy(agent.codename)}
                disabled={isDeployed}
                className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                  isDeployed
                    ? "cursor-default bg-white/5 text-neutral-500"
                    : `${colors.bg} ${colors.text} hover:brightness-125 cursor-pointer`
                }`}
              >
                {isDeployed ? (
                  <>
                    <CheckCircle className="h-4 w-4" />
                    Deployed
                  </>
                ) : (
                  <>
                    <Zap className="h-4 w-4" />
                    Deploy Agent
                  </>
                )}
              </motion.button>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
