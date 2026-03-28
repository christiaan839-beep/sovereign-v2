"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { ReactFlow, Background, Controls, type Node, type Edge } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { AgentNode } from "@/components/dashboard/AgentNode";

const nodeTypes = { agent: AgentNode };

interface AgentMeta {
  [key: string]: unknown;
  label: string;
  icon: string;
  status: "active" | "idle" | "always-on";
  description: string;
  lastAction: string;
  route: string;
}

const AGENT_META: Record<string, AgentMeta> = {
  "smart-router": {
    label: "Smart Router",
    icon: "\u{1F9E0}",
    status: "always-on",
    description: "Dynamically routes tasks to the best model based on complexity, speed, and cost.",
    lastAction: "Routed 14 tasks in last hour",
    route: "/dashboard/agent-hq",
  },
  "safety-guard": {
    label: "Safety Guard",
    icon: "\u{1F6E1}\uFE0F",
    status: "always-on",
    description: "Monitors all agent outputs for compliance, toxicity, and brand safety.",
    lastAction: "Filtered 3 outputs",
    route: "/dashboard/cyber-audit",
  },
  "content-writer": {
    label: "Content Writer",
    icon: "\u{270D}\uFE0F",
    status: "active",
    description: "Generates blog posts, social copy, email sequences, and landing page content.",
    lastAction: "Wrote 2 blog drafts",
    route: "/dashboard/content-factory",
  },
  "lead-hunter": {
    label: "Lead Hunter",
    icon: "\u{1F3AF}",
    status: "active",
    description: "Scrapes and qualifies B2B leads from LinkedIn, Apollo, and web sources.",
    lastAction: "Found 47 new leads",
    route: "/dashboard/leads",
  },
  "seo-analyst": {
    label: "SEO Analyst",
    icon: "\u{1F50D}",
    status: "active",
    description: "Analyzes keyword gaps, backlink profiles, and on-page optimization opportunities.",
    lastAction: "Audited 3 pages",
    route: "/dashboard/seo-dominator",
  },
  "outreach-agent": {
    label: "Outreach Agent",
    icon: "\u{1F47B}",
    status: "active",
    description: "Sends personalized cold emails and manages follow-up sequences automatically.",
    lastAction: "Sent 120 emails",
    route: "/dashboard/ghost-protocol",
  },
  "voice-caller": {
    label: "Voice Caller",
    icon: "\u{1F4DE}",
    status: "idle",
    description: "Makes AI-powered phone calls for appointment setting and lead qualification.",
    lastAction: "Completed 8 calls",
    route: "/dashboard/voice-swarm",
  },
  "code-builder": {
    label: "Code Builder",
    icon: "\u{1F6E0}\uFE0F",
    status: "idle",
    description: "Generates full-stack code, APIs, and components from natural language prompts.",
    lastAction: "Built 1 API endpoint",
    route: "/dashboard/build",
  },
  "competitor-scout": {
    label: "Competitor Scout",
    icon: "\u{1F575}\uFE0F",
    status: "active",
    description: "Monitors competitor websites, pricing changes, and new feature launches.",
    lastAction: "Tracked 5 competitors",
    route: "/dashboard/competitor",
  },
  "report-writer": {
    label: "Report Writer",
    icon: "\u{1F4CA}",
    status: "idle",
    description: "Compiles analytics data into executive summaries and performance reports.",
    lastAction: "Generated weekly report",
    route: "/dashboard/agent-analytics",
  },
  "document-reader": {
    label: "Document Reader",
    icon: "\u{1F4C4}",
    status: "idle",
    description: "Extracts and indexes information from PDFs, docs, and spreadsheets using RAG.",
    lastAction: "Processed 12 documents",
    route: "/dashboard/omni-search",
  },
  translator: {
    label: "Translator",
    icon: "\u{1F310}",
    status: "idle",
    description: "Translates content across 50+ languages with context-aware localization.",
    lastAction: "Translated 4 pages",
    route: "/dashboard/live-terminal",
  },
};

const initialNodes: Node[] = [
  // Center hub
  { id: "smart-router", type: "agent", position: { x: 400, y: 300 }, data: AGENT_META["smart-router"] },
  // Ring 1 — close orbit
  { id: "safety-guard", type: "agent", position: { x: 150, y: 120 }, data: AGENT_META["safety-guard"] },
  { id: "content-writer", type: "agent", position: { x: 650, y: 100 }, data: AGENT_META["content-writer"] },
  { id: "lead-hunter", type: "agent", position: { x: 700, y: 420 }, data: AGENT_META["lead-hunter"] },
  { id: "seo-analyst", type: "agent", position: { x: 120, y: 480 }, data: AGENT_META["seo-analyst"] },
  // Ring 2 — outer orbit
  { id: "outreach-agent", type: "agent", position: { x: 900, y: 260 }, data: AGENT_META["outreach-agent"] },
  { id: "voice-caller", type: "agent", position: { x: 950, y: 500 }, data: AGENT_META["voice-caller"] },
  { id: "code-builder", type: "agent", position: { x: -100, y: 300 }, data: AGENT_META["code-builder"] },
  { id: "competitor-scout", type: "agent", position: { x: 500, y: 600 }, data: AGENT_META["competitor-scout"] },
  { id: "report-writer", type: "agent", position: { x: 200, y: 650 }, data: AGENT_META["report-writer"] },
  { id: "document-reader", type: "agent", position: { x: -50, y: 550 }, data: AGENT_META["document-reader"] },
  { id: "translator", type: "agent", position: { x: 750, y: 650 }, data: AGENT_META["translator"] },
];

const routerEdgeStyle = { stroke: "rgba(16,185,129,0.15)", strokeWidth: 1.5 };
const peerEdgeStyle = { stroke: "rgba(16,185,129,0.1)", strokeWidth: 1 };

const initialEdges: Edge[] = [
  // Smart Router → all agents (animated hub connections)
  { id: "r-safety", source: "smart-router", target: "safety-guard", animated: true, style: routerEdgeStyle, type: "smoothstep" },
  { id: "r-content", source: "smart-router", target: "content-writer", animated: true, style: routerEdgeStyle, type: "smoothstep" },
  { id: "r-lead", source: "smart-router", target: "lead-hunter", animated: true, style: routerEdgeStyle, type: "smoothstep" },
  { id: "r-seo", source: "smart-router", target: "seo-analyst", animated: true, style: routerEdgeStyle, type: "smoothstep" },
  { id: "r-outreach", source: "smart-router", target: "outreach-agent", animated: true, style: routerEdgeStyle, type: "smoothstep" },
  { id: "r-voice", source: "smart-router", target: "voice-caller", animated: true, style: routerEdgeStyle, type: "smoothstep" },
  { id: "r-code", source: "smart-router", target: "code-builder", animated: true, style: routerEdgeStyle, type: "smoothstep" },
  { id: "r-scout", source: "smart-router", target: "competitor-scout", animated: true, style: routerEdgeStyle, type: "smoothstep" },
  { id: "r-report", source: "smart-router", target: "report-writer", animated: true, style: routerEdgeStyle, type: "smoothstep" },
  { id: "r-doc", source: "smart-router", target: "document-reader", animated: true, style: routerEdgeStyle, type: "smoothstep" },
  { id: "r-trans", source: "smart-router", target: "translator", animated: true, style: routerEdgeStyle, type: "smoothstep" },
  // Peer-to-peer agent connections
  { id: "lead-outreach", source: "lead-hunter", target: "outreach-agent", style: peerEdgeStyle, type: "smoothstep" },
  { id: "outreach-voice", source: "outreach-agent", target: "voice-caller", style: peerEdgeStyle, type: "smoothstep" },
  { id: "content-seo", source: "content-writer", target: "seo-analyst", style: peerEdgeStyle, type: "smoothstep" },
  { id: "scout-report", source: "competitor-scout", target: "report-writer", style: peerEdgeStyle, type: "smoothstep" },
  { id: "safety-content", source: "safety-guard", target: "content-writer", style: peerEdgeStyle, type: "smoothstep" },
  { id: "safety-outreach", source: "safety-guard", target: "outreach-agent", style: peerEdgeStyle, type: "smoothstep" },
];

interface Activity {
  agent: string;
  action: string;
  timestamp: string;
}

export default function AgentWorldPage() {
  const router = useRouter();
  const [nodes] = useState<Node[]>(initialNodes);
  const [edges] = useState<Edge[]>(initialEdges);
  const [selectedAgent, setSelectedAgent] = useState<Node | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    fetch("/api/agents/analytics")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.activities) setActivities(data.activities);
      })
      .catch(() => {});
  }, []);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedAgent(node);
  }, []);

  const selectedMeta = useMemo(() => {
    if (!selectedAgent) return null;
    return AGENT_META[selectedAgent.id] || null;
  }, [selectedAgent]);

  const agentActivities = useMemo(() => {
    if (!selectedMeta) return [];
    return activities
      .filter((a) => a.agent?.toLowerCase().includes(selectedMeta.label.toLowerCase()))
      .slice(0, 5);
  }, [activities, selectedMeta]);

  const statusLabel = (s: string) => {
    if (s === "always-on") return "Always On";
    if (s === "active") return "Active";
    return "Idle";
  };

  const statusColor = (s: string) => {
    if (s === "always-on") return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
    if (s === "active") return "bg-amber-500/20 text-amber-400 border-amber-500/30";
    return "bg-neutral-700/30 text-neutral-400 border-neutral-600/30";
  };

  return (
    <div className="p-6 pb-0" role="main" aria-label="Agent world network graph">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white tracking-tight">Agent World</h1>
        <p className="text-sm text-neutral-500 mt-1">
          Living network graph — click any agent to inspect
        </p>
      </div>

      <div className="flex h-[calc(100vh-200px)] rounded-xl border border-white/[0.06] overflow-hidden">
        {/* Graph */}
        <div className="flex-1">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            onNodeClick={onNodeClick}
            fitView
            proOptions={{ hideAttribution: true }}
            style={{ background: "#050505" }}
            minZoom={0.3}
            maxZoom={1.5}
          >
            <Background color="rgba(16,185,129,0.03)" gap={40} />
            <Controls
              showInteractive={false}
              className="!bg-[#0A0A0A] !border-white/10 !rounded-lg [&>button]:!bg-[#0A0A0A] [&>button]:!border-white/10 [&>button]:!text-neutral-400 [&>button:hover]:!text-white"
            />
          </ReactFlow>
        </div>

        {/* Detail Panel */}
        <AnimatePresence>
          {selectedAgent && selectedMeta && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              className="border-l border-white/[0.06] bg-[#050505] overflow-hidden shrink-0"
            >
              <div className="w-80 p-6 overflow-y-auto h-full">
                {/* Close */}
                <button
                  onClick={() => setSelectedAgent(null)}
                  aria-label="Close agent details panel"
                  className="mb-4 text-neutral-600 hover:text-white text-xs transition-colors"
                >
                  Close
                </button>

                {/* Agent Header */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-3xl">{selectedMeta.icon}</span>
                  <div>
                    <h2 className="text-sm font-bold text-white">{selectedMeta.label}</h2>
                    <span
                      className={`inline-block mt-1 text-[10px] font-medium px-2 py-0.5 rounded-full border ${statusColor(selectedMeta.status)}`}
                    >
                      {statusLabel(selectedMeta.status)}
                    </span>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-neutral-400 leading-relaxed mb-6">
                  {selectedMeta.description}
                </p>

                {/* Last Action */}
                <div className="mb-6">
                  <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-600 mb-2">
                    Last Action
                  </h3>
                  <p className="text-xs text-neutral-300 font-mono">{selectedMeta.lastAction}</p>
                </div>

                {/* Activities */}
                {agentActivities.length > 0 && (
                  <div className="mb-6">
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-neutral-600 mb-2">
                      Recent Activity
                    </h3>
                    <div className="space-y-2">
                      {agentActivities.map((a, i) => (
                        <div
                          key={i}
                          className="p-2 rounded-lg bg-white/[0.03] border border-white/[0.04]"
                        >
                          <p className="text-[11px] text-neutral-300">{a.action}</p>
                          <p className="text-[9px] text-neutral-600 mt-0.5 font-mono">
                            {a.timestamp}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Run Agent Button */}
                <button
                  onClick={() => router.push(selectedMeta.route)}
                  className="w-full py-2.5 rounded-lg bg-[#00B7FF] hover:bg-[#00B7FF]/80 text-white text-xs font-semibold transition-colors"
                >
                  Open {selectedMeta.label}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
