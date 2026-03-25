"use client";

import { useState, useCallback, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  addEdge,
  type Connection,
  type Node,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Layers, Sparkles, Play } from "lucide-react";
import { motion } from "framer-motion";

import { ScreenNode } from "@/components/canvas/ScreenNode";
import { NoteNode } from "@/components/canvas/NoteNode";
import { VibeBar } from "@/components/canvas/VibeBar";
import { AgentPanel, type GenerationTask } from "@/components/canvas/AgentPanel";
import { FlowExport } from "@/components/canvas/FlowExport";

const nodeTypes = {
  screen: ScreenNode,
  note: NoteNode,
};

export default function CanvasPage() {
  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [tasks, setTasks] = useState<GenerationTask[]>([]);
  const [agentPanelOpen, setAgentPanelOpen] = useState(false);
  const [flowPreviewOpen, setFlowPreviewOpen] = useState(false);
  const [generating, setGenerating] = useState(false);
  const nodeCountRef = useRef(0);

  // Handle edge connections between nodes
  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((eds) => addEdge({ ...connection, animated: true, style: { stroke: "rgba(0,183,255,0.3)", strokeWidth: 2 } }, eds));
    },
    [setEdges]
  );

  // Delete a node
  const handleDeleteNode = useCallback(
    (nodeId: string) => {
      setNodes((nds) => nds.filter((n) => n.id !== nodeId));
      setEdges((eds) => eds.filter((e) => e.source !== nodeId && e.target !== nodeId));
    },
    [setNodes, setEdges]
  );

  // Expand a screen to fullscreen preview
  const handleExpandNode = useCallback(
    (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (node?.data && typeof node.data === "object" && "html" in node.data) {
        const d = node.data as { html: string; label: string };
        // Open single screen in flow preview
        setFlowPreviewOpen(true);
      }
    },
    [nodes]
  );

  // Update note text
  const handleUpdateNote = useCallback(
    (nodeId: string, text: string) => {
      setNodes((nds) =>
        nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, text } } : n))
      );
    },
    [setNodes]
  );

  // Add a sticky note
  const handleAddNote = useCallback(() => {
    const id = `note-${Date.now()}`;
    const newNode: Node = {
      id,
      type: "note",
      position: { x: 200 + nodeCountRef.current * 30, y: 200 + nodeCountRef.current * 30 },
      data: { text: "", onDelete: handleDeleteNode, onUpdate: handleUpdateNote },
    };
    nodeCountRef.current++;
    setNodes((nds) => [...nds, newNode]);
  }, [setNodes, handleDeleteNode, handleUpdateNote]);

  // Generate a screen from prompt + vibe
  const handleGenerate = useCallback(
    async (prompt: string, vibe: string) => {
      setGenerating(true);
      const nodeId = `screen-${Date.now()}`;
      const taskId = `task-${Date.now()}`;

      // Create placeholder node
      const col = nodeCountRef.current % 3;
      const row = Math.floor(nodeCountRef.current / 3);
      const newNode: Node = {
        id: nodeId,
        type: "screen",
        position: { x: 100 + col * 420, y: 100 + row * 340 },
        data: {
          label: prompt.slice(0, 40),
          html: "",
          vibe,
          prompt,
          status: "generating",
          progress: 0,
          onDelete: handleDeleteNode,
          onExpand: handleExpandNode,
        },
      };
      nodeCountRef.current++;
      setNodes((nds) => [...nds, newNode]);

      // Track task
      const task: GenerationTask = { id: taskId, prompt, vibe, status: "generating", timestamp: Date.now(), nodeId };
      setTasks((prev) => [...prev, task]);
      setAgentPanelOpen(true);

      try {
        const res = await fetch("/api/agents/page-builder-stream", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            businessName: prompt,
            industry: vibe,
            offer: prompt,
            targetAudience: "general audience",
            vibe,
          }),
        });

        if (!res.ok || !res.body) throw new Error("Generation failed");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finalHtml = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const parts = buffer.split("\n\n");
          buffer = parts.pop() || "";

          for (const part of parts) {
            if (!part.trim()) continue;
            try {
              const parsed = JSON.parse(part);
              if (parsed.type === "progress") {
                setNodes((nds) =>
                  nds.map((n) =>
                    n.id === nodeId
                      ? { ...n, data: { ...n.data, progress: (parsed.data.step / 8) * 100 } }
                      : n
                  )
                );
              } else if (parsed.type === "complete") {
                finalHtml = parsed.data.code;
              }
            } catch { /* skip malformed */ }
          }
        }

        // Update node with generated HTML
        setNodes((nds) =>
          nds.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  data: {
                    ...n.data,
                    html: finalHtml,
                    status: finalHtml ? "ready" : "error",
                    progress: 100,
                  },
                }
              : n
          )
        );
        setTasks((prev) =>
          prev.map((t) => (t.id === taskId ? { ...t, status: finalHtml ? "complete" : "error" } : t))
        );

        // TTS feedback
        if (finalHtml && window.speechSynthesis) {
          const utterance = new SpeechSynthesisUtterance("Screen generated successfully.");
          utterance.rate = 1.1;
          utterance.pitch = 1;
          const voices = window.speechSynthesis.getVoices();
          const preferred = voices.find((v) => v.name.includes("Google") || v.name.includes("Samantha"));
          if (preferred) utterance.voice = preferred;
          window.speechSynthesis.speak(utterance);
        }
      } catch {
        setNodes((nds) =>
          nds.map((n) => (n.id === nodeId ? { ...n, data: { ...n.data, status: "error" } } : n))
        );
        setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, status: "error" } : t)));
      } finally {
        setGenerating(false);
      }
    },
    [setNodes, handleDeleteNode, handleExpandNode]
  );

  // Explore More — generate 3 variants from an existing task
  const handleExploreMore = useCallback(
    (task: GenerationTask) => {
      const vibes = ["minimalist", "playful", "brutalist"].filter((v) => v !== task.vibe);
      vibes.forEach((vibe) => {
        handleGenerate(task.prompt, vibe);
      });
    },
    [handleGenerate]
  );

  // Get connected screens for flow preview
  const getFlowScreens = useCallback(() => {
    const screenNodes = nodes.filter((n) => n.type === "screen" && n.data && typeof n.data === "object" && "html" in n.data && (n.data as { status: string }).status === "ready");
    return screenNodes.map((n) => {
      const d = n.data as { label: string; html: string };
      return { id: n.id, label: d.label, html: d.html };
    });
  }, [nodes]);

  const hasScreens = nodes.some((n) => n.type === "screen");

  return (
    <div className="h-screen w-full bg-[#050505] relative overflow-hidden">
      {/* Top bar */}
      <div className="absolute top-0 left-0 right-0 z-30 flex items-center justify-between px-5 py-3 bg-[#050505]/80 backdrop-blur-xl border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[#00B7FF]/10 border border-[#00B7FF]/20 flex items-center justify-center">
            <Layers className="w-4 h-4 text-[#00B7FF]" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-white">Design Canvas</h1>
            <p className="text-[10px] text-neutral-500">{nodes.length} elements &middot; {edges.length} connections</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {hasScreens && (
            <button
              onClick={() => setFlowPreviewOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#00B7FF]/10 text-[#00B7FF] text-[10px] font-semibold hover:bg-[#00B7FF]/20 transition-colors border border-[#00B7FF]/20"
            >
              <Play className="w-3 h-3" />
              Preview Flow
            </button>
          )}
          <button
            onClick={() => setAgentPanelOpen(!agentPanelOpen)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-colors border ${
              agentPanelOpen
                ? "bg-[#00B7FF]/10 text-[#00B7FF] border-[#00B7FF]/20"
                : "bg-white/[0.03] text-neutral-400 border-white/[0.06] hover:text-white"
            }`}
          >
            <Sparkles className="w-3 h-3" />
            Agent ({tasks.length})
          </button>
        </div>
      </div>

      {/* ReactFlow Canvas */}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodeTypes={nodeTypes}
        fitView={nodes.length > 0}
        className="bg-[#050505]"
        minZoom={0.2}
        maxZoom={2}
        defaultViewport={{ x: 0, y: 60, zoom: 0.8 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={40} size={1} color="rgba(0,183,255,0.03)" />
        <Controls
          showInteractive={true}
          className="!bg-[#0A0A0A] !border-white/[0.08] !rounded-xl !shadow-2xl [&>button]:!bg-transparent [&>button]:!text-neutral-400 [&>button]:!border-white/[0.06] [&>button:hover]:!text-white"
        />
        <MiniMap
          style={{ background: "#0A0A0A", border: "1px solid rgba(255,255,255,0.06)" }}
          nodeColor={() => "#00B7FF"}
          maskColor="rgba(0,0,0,0.8)"
          className="!rounded-xl !shadow-2xl"
        />
      </ReactFlow>

      {/* Empty state */}
      {nodes.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center"
          >
            <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
              <Layers className="w-7 h-7 text-neutral-600" />
            </div>
            <h2 className="text-lg font-semibold text-neutral-400 mb-1">Your canvas is empty</h2>
            <p className="text-xs text-neutral-600 max-w-xs">
              Describe what you want to build below. Each generation appears as a draggable screen on this canvas.
            </p>
          </motion.div>
        </div>
      )}

      {/* Agent Panel */}
      <AgentPanel
        open={agentPanelOpen}
        onClose={() => setAgentPanelOpen(false)}
        tasks={tasks}
        onExploreMore={handleExploreMore}
      />

      {/* VibeBar */}
      <VibeBar
        onGenerate={handleGenerate}
        onAddNote={handleAddNote}
        generating={generating}
      />

      {/* Flow Preview Modal */}
      <FlowExport
        open={flowPreviewOpen}
        onClose={() => setFlowPreviewOpen(false)}
        screens={getFlowScreens()}
      />
    </div>
  );
}
