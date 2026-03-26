"use client";

import React, { useState, useRef, useEffect } from "react";
import { Terminal, Play, Loader2, Send, Zap, Clock } from "lucide-react";

interface TerminalLine {
  time: string;
  type: "system" | "input" | "output" | "error" | "success";
  text: string;
}

const AGENTS = [
  { id: "translate", label: "Translator", placeholder: '{"text":"Hello","target_lang":"es"}' },
  { id: "pii-redactor", label: "PII Redactor", placeholder: '{"text":"John Smith, john@email.com"}' },
  { id: "blog-gen", label: "Blog Generator", placeholder: '{"topic":"AI marketing trends 2026"}' },
  { id: "swarm", label: "Multi-Agent Swarm", placeholder: '{"task":"Best growth strategy for SaaS"}' },
  { id: "voice-chat", label: "Voice Agent", placeholder: '{"text":"Hi, I need to book an appointment"}' },
  { id: "gliner-pii", label: "GLiNER PII", placeholder: '{"text":"Jane Doe, 123-45-6789, jane@corp.com"}' },
  { id: "benchmark", label: "Model Benchmark", placeholder: '{"prompt":"Explain quantum computing in 100 words"}' },
  { id: "case-study", label: "Case Study", placeholder: '{"clientName":"Acme Corp","industry":"Tech"}' },
];

export default function LiveTerminalPage() {
  const [selectedAgent, setSelectedAgent] = useState("translate");
  const [input, setInput] = useState("");
  const [lines, setLines] = useState<TerminalLine[]>([
    { time: new Date().toLocaleTimeString(), type: "system", text: "═══ SOVEREIGN MATRIX — LIVE AGENT TERMINAL ═══" },
    { time: new Date().toLocaleTimeString(), type: "system", text: `System online. ${AGENTS.length} agents ready. Select an agent and send a payload.` },
  ]);
  const [running, setRunning] = useState(false);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  const addLine = (type: TerminalLine["type"], text: string) => {
    setLines(prev => [...prev, { time: new Date().toLocaleTimeString(), type, text }]);
  };

  const execute = async () => {
    if (!input.trim() || running) return;

    const agent = AGENTS.find(a => a.id === selectedAgent);
    setRunning(true);

    addLine("input", `$ POST /api/agents/${selectedAgent}`);

    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(input);
      addLine("system", `▸ Payload: ${JSON.stringify(payload)}`);
    } catch {
      addLine("error", "✗ Invalid JSON. Sending as raw text.");
      payload = { text: input, topic: input, task: input, prompt: input };
    }

    addLine("system", `▸ Routing to ${agent?.label || selectedAgent}...`);

    const startTime = Date.now();

    try {
      const res = await fetch(`/api/agents/${selectedAgent}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      const duration = Date.now() - startTime;

      addLine("success", `✓ Response received in ${duration}ms`);

      // Format output based on agent type
      const outputStr = JSON.stringify(data, null, 2);
      const outputLines = outputStr.split("\n").slice(0, 20);
      for (const line of outputLines) {
        addLine("output", line);
      }
      if (outputStr.split("\n").length > 20) {
        addLine("system", `... (${outputStr.split("\n").length - 20} more lines truncated)`);
      }

      addLine("system", `▸ Duration: ${duration}ms | Status: ${res.status}`);
    } catch (err) {
      addLine("error", `✗ Error: ${String(err)}`);
    }

    addLine("system", "─────────────────────────────────");
    setRunning(false);
  };

  const typeColors: Record<string, string> = {
    system: "text-neutral-500",
    input: "text-[#00B7FF]",
    output: "text-emerald-400",
    error: "text-red-400",
    success: "text-emerald-400",
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white p-6 md:p-8 font-mono">
      <div className="max-w-5xl mx-auto space-y-6">
        <header className="border-b border-[#00B7FF]/20 pb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#00B7FF]/10 border border-[#00B7FF]/30 flex items-center justify-center">
              <Terminal className="w-6 h-6 text-[#00B7FF]" />
            </div>
            <div>
              <h1 className="text-2xl font-black uppercase tracking-[0.2em]">Live Agent Terminal</h1>
              <p className="text-[#00B7FF]/60 text-xs uppercase tracking-widest">Real-Time Agent Execution · JSON I/O · Full Audit Trail</p>
            </div>
          </div>
        </header>

        {/* Agent Selector */}
        <div className="flex flex-wrap gap-2">
          {AGENTS.map(a => (
            <button
              key={a.id}
              onClick={() => { setSelectedAgent(a.id); setInput(a.placeholder); }}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest border transition-gpu ${
                selectedAgent === a.id
                  ? "bg-[#00B7FF] text-black border-[#00B7FF]"
                  : "bg-transparent text-neutral-500 border-neutral-800 hover:border-neutral-600"
              }`}
            >
              {a.label}
            </button>
          ))}
        </div>

        {/* Terminal Output */}
        <div ref={terminalRef} className="bg-neutral-950 border border-neutral-800 p-4 h-[400px] overflow-y-auto font-mono text-[11px] leading-relaxed">
          {lines.map((line, i) => (
            <div key={i} className={`flex gap-3 ${typeColors[line.type]}`}>
              <span className="text-neutral-700 shrink-0">[{line.time}]</span>
              <span className="whitespace-pre-wrap break-all">{line.text}</span>
            </div>
          ))}
          {running && (
            <div className="flex items-center gap-2 text-[#00B7FF] mt-1">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Processing...</span>
            </div>
          )}
        </div>

        {/* Input */}
        <div className="flex gap-2">
          <div className="flex items-center gap-2 px-3 bg-neutral-950 border border-neutral-800 text-neutral-600 text-[10px] font-bold uppercase tracking-widest shrink-0">
            <Zap className="w-3 h-3" /> {selectedAgent}
          </div>
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && execute()}
            placeholder="Enter JSON payload..."
            className="flex-1 bg-neutral-950 border border-neutral-800 px-4 py-3 text-xs text-white placeholder:text-neutral-700 focus:outline-none focus:border-neutral-600 font-mono"
          />
          <button
            onClick={execute}
            disabled={running}
            className="px-4 py-3 bg-[#00B7FF] text-black font-bold text-sm hover:bg-[#00A0E0] transition-gpu disabled:opacity-50 flex items-center gap-2"
          >
            {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Send className="w-4 h-4" /> Run</>}
          </button>
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-3 gap-3 text-center">
          <div className="bg-neutral-950 border border-neutral-800 p-3">
            <p className="text-lg font-black text-emerald-400">{lines.filter(l => l.type === "success").length}</p>
            <p className="text-[8px] text-neutral-500 uppercase">Successful Runs</p>
          </div>
          <div className="bg-neutral-950 border border-neutral-800 p-3 flex items-center justify-center gap-2">
            <Clock className="w-3 h-3 text-[#00B7FF]" />
            <p className="text-lg font-black text-[#00B7FF]">{AGENTS.length}</p>
            <p className="text-[8px] text-neutral-500 uppercase">Agents Online</p>
          </div>
          <div className="bg-neutral-950 border border-neutral-800 p-3 flex items-center justify-center gap-2">
            <Play className="w-3 h-3 text-[#A855F7]" />
            <p className="text-lg font-black text-[#A855F7]">{lines.length}</p>
            <p className="text-[8px] text-neutral-500 uppercase">Terminal Lines</p>
          </div>
        </div>
      </div>
    </div>
  );
}
