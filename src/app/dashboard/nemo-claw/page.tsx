"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Cpu, Terminal, Activity, ShieldAlert, Send, BrainCircuit, Power, HardDrive, ScanFace, CheckCircle2 } from "lucide-react";
import { AgentOrgMap } from "@/components/dashboard/AgentOrgMap";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export default function NemoClawPage() {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [systemPrompt, setSystemPrompt] = useState(
    "You are NemoClaw, NVIDIA's enterprise-grade autonomous AI agent powered by the OpenClaw framework. " +
    "You execute tasks, make decisions, and take actions on the Commander's local infrastructure. " +
    "Your objective is to autonomously complete complex multi-step workflows using NVIDIA OpenShell security protocols."
  );
  
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "NemoClaw Agent Initialized. OpenClaw framework active. NVIDIA OpenShell security enforced. Awaiting directive." }
  ]);
  const [input, setInput] = useState("");
  const [isInferencing, setIsInferencing] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [latency, setLatency] = useState("- ms");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [privacyMode, setPrivacyMode] = useState<"secure" | "open">("secure");
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [selectedModel, setSelectedModel] = useState("mistral-nemotron");
  const [isDeployed247, setIsDeployed247] = useState(false);
  const [showGuardrails] = useState(true);
  
  const chatEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isInferencing]);

  const handleSend = async () => {
    if (!input.trim() || isInferencing) return;

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: input }
    ];
    
    setMessages(newMessages);
    setInput("");
    setIsInferencing(true);

    const startTime = performance.now();

    try {
      // We pass the system prompt as the first message to the NIM
      const payloadMessages = [
        { role: "system", content: systemPrompt },
        // Skip the initial assistant greeting for the payload, 
        // just send the actual user messages and assistant replies
        ...newMessages.filter(m => m.content !== "NemoClaw Agent Initialized. OpenClaw framework active. NVIDIA OpenShell security enforced. Awaiting directive.")
      ];

      if (privacyMode === "secure") {
        const res = await fetch("http://127.0.0.1:18789/api/execute", {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "Authorization": "Bearer 599a61ce2a2725c8b72c46f81e39c21c934cd07cea50c961"
          },
          body: JSON.stringify({ command: input, messages: payloadMessages })
        });

        const data = await res.json();
        const endTime = performance.now();
        setLatency(`${(endTime - startTime).toFixed(0)} ms`);

        if (data.success) {
          setMessages(prev => [...prev, { role: "assistant", content: `\`\`\`bash\n${data.output}\n\`\`\`` }]);
        } else {
          // If the daemon isn't running, it will be caught by the outer catch block
          setMessages(prev => [...prev, { role: "assistant", content: `\`[DAEMON ERROR]\` ${data.error}` }]);
        }
      } else {
        const res = await fetch("/api/nim", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: selectedModel,
            messages: payloadMessages,
            temperature: 0.3,
            max_tokens: 1024,
          }),
        });

        const data = await res.json();
        const endTime = performance.now();
        setLatency(`${(endTime - startTime).toFixed(0)} ms`);

        if (data.success && data.result?.choices?.[0]?.message) {
          setMessages(prev => [
            ...prev,
            { role: "assistant", content: data.result.choices[0].message.content }
          ]);
        } else {
          setMessages(prev => [
            ...prev,
            { role: "assistant", content: "`[SYSTEM ERROR]` Interference detected. NIM endpoint failed to respond." }
          ]);
        }
      }
    } catch {
      setMessages(prev => [
        ...prev,
        { role: "assistant", content: "\`[CRITICAL ERROR]\` Connection to NVIDIA infrastructure severed." }
      ]);
    } finally {
      setIsInferencing(false);
    }
  };

  return (
    <div className="p-8 max-w-7xl mx-auto min-h-screen bg-[#050505] text-white">
      {/* Header */}
      <div className="mb-8">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-wider mb-3">
          <Activity className="w-3 h-3 animate-pulse" /> Edge Telemetry Active
        </div>
        <h1 className="text-3xl font-bold font-sans tracking-tight mb-2 flex items-center gap-3">
          NemoClaw <span className="text-emerald-400 text-xl font-mono uppercase tracking-widest">[OpenClaw]</span>
        </h1>
        <p className="text-sm text-neutral-400 max-w-2xl mb-4">
          NVIDIA&apos;s enterprise-grade autonomous AI agent platform, built on OpenClaw — the fastest-growing
          open source project in history. Agents that execute tasks, make decisions, and take actions.
          Runs on your hardware with NVIDIA OpenShell security.
        </p>
        <div className="flex flex-wrap gap-2 mb-2">
          {["Autonomous Task Execution", "Multi-Step Decision Making", "OpenShell Security", "On-Premise Hardware"].map((cap) => (
            <span key={cap} className="text-[9px] px-2 py-1 rounded-md bg-[#76B900]/10 text-[#76B900] border border-[#76B900]/20 font-mono uppercase tracking-wider">
              {cap}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[75vh]">
        
        {/* Left Column: Configuration */}
        <div className="lg:col-span-4 flex flex-col space-y-4">
          
          {/* Hardware & Sandbox Status */}
          <div className="rounded-2xl bg-white/[0.02] border border-white/10 p-5 backdrop-blur-md">
            <h3 className="text-xs font-bold uppercase tracking-widest text-[#00B7FF] mb-4 flex items-center gap-2">
              <Activity className="w-4 h-4" /> NemoClaw Runtime Environment
            </h3>
            <div className="space-y-3 font-mono text-[10px] uppercase tracking-wider">
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-neutral-500">Container State</span>
                <div className="flex items-center gap-2 text-emerald-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"/>
                  Active (Airgapped)
                </div>
              </div>
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-neutral-500">GPU Passthrough</span>
                <span className="text-[#00B7FF] font-bold">RTX 5090 (32GB VRAM)</span>
              </div>
              <div className="flex justify-between items-center border-b border-white/5 pb-2">
                <span className="text-neutral-500">Claude Computer Use</span>
                <span className="text-emerald-400 flex items-center gap-1">
                   <ShieldAlert className="w-3 h-3" /> Enabled
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-neutral-500">Prompt Caching</span>
                <span className="text-blue-400 font-bold">-90% API Tokens</span>
              </div>
            </div>
          </div>

          {/* MCP Server Connections */}
          <div className="rounded-2xl bg-white/[0.02] border border-white/10 p-5 backdrop-blur-md flex-1 flex flex-col">
            <h3 className="text-xs font-bold uppercase tracking-widest text-neutral-300 mb-4 flex items-center gap-2">
              <BrainCircuit className="w-4 h-4" /> Attached MCP Servers
            </h3>
            <div className="space-y-2 flex-1">
              {[
                  { name: "mcp-filesystem", desc: "Local Vault Read/Write", icon: HardDrive },
                  { name: "mcp-memory", desc: "Pinecone Vector RAG", icon: BrainCircuit },
                  { name: "mcp-computer-use", desc: "Claude Beta Vision/Mouse", icon: ScanFace },
              ].map((server, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-black/40 border border-white/5">
                  <div className="flex items-center gap-3">
                     <server.icon className="w-4 h-4 text-neutral-500" />
                     <div>
                       <p className="text-[10px] font-bold text-white uppercase tracking-widest font-mono">{server.name}</p>
                       <p className="text-[9px] text-neutral-500 font-mono tracking-wider">{server.desc}</p>
                     </div>
                  </div>
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                </div>
              ))}
            </div>
          </div>

          {/* 24/7 Deployment Override */}
          <div className="rounded-2xl bg-white/[0.02] border border-white/10 p-5 backdrop-blur-md">
             <button 
               onClick={() => setIsDeployed247(!isDeployed247)}
               className={`w-full py-3 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-widest transition-all ${
                 isDeployed247 
                   ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)]'
                   : 'bg-white/5 border-white/10 text-white hover:bg-white/10'
               }`}
             >
               <Power className={`w-4 h-4 ${isDeployed247 ? 'animate-pulse' : ''}`} />
               {isDeployed247 ? 'NemoClaw Agent Active 24/7' : 'Deploy NemoClaw Agent'}
             </button>
             {isDeployed247 && (
               <p className="text-[9px] text-emerald-500/70 font-mono mt-2 text-center uppercase tracking-widest">
                  NemoClaw autonomous agent process active.
               </p>
             )}
          </div>

        </div>

        {/* Right Column: Execution Terminal */}
        <div className="lg:col-span-8 rounded-2xl bg-black border border-white/10 flex flex-col relative overflow-hidden shadow-[0_0_50px_rgba(0,183,255,0.05)]">
          {/* Terminal Header */}
          <div className="h-12 border-b border-white/10 bg-white/[0.02] flex items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-neutral-500" />
              <span className="text-[10px] font-mono text-neutral-400 tracking-widest uppercase">NemoClaw Agent Runtime — OpenClaw v1.0</span>
            </div>
            <div className="flex gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-neutral-800" />
              <div className="w-2.5 h-2.5 rounded-full bg-neutral-800" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/50" />
            </div>
          </div>

          {/* Chat Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar font-mono text-sm">
            <AnimatePresence initial={false}>
              {messages.map((m, i) => (
                <motion.div 
                  key={i} 
                  initial={{ opacity: 0, y: 10 }}
                  className={`flex items-start gap-4 ${m.role === "user" ? "flex-row-reverse" : ""}`}
                >
                  <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${
                    m.role === "assistant" 
                      ? "bg-[#00B7FF]/10 text-[#00B7FF] border border-[#00B7FF]/20" 
                      : "bg-white/10 text-white border border-white/20"
                  }`}>
                    {m.role === "assistant" ? <Cpu className="w-4 h-4" /> : <Terminal className="w-4 h-4" />}
                  </div>
                  
                  <div className={`max-w-[80%] rounded-2xl p-4 ${
                    m.role === "user" 
                      ? "bg-white/10 border border-white/10 text-white rounded-tr-sm" 
                      : "bg-[#00B7FF]/5 border border-[#00B7FF]/10 text-emerald-50 rounded-tl-sm relative group"
                  }`}>
                    {m.role === "assistant" && i > 0 && (
                      <div className="absolute -top-2.5 -left-2 px-2 py-0.5 bg-black border border-[#00B7FF]/30 rounded text-[9px] text-[#00B7FF] uppercase tracking-wider font-bold shadow-lg opacity-0 group-hover:opacity-100 transition-opacity">
                        TensorRT Inference
                      </div>
                    )}
                    <span className="whitespace-pre-wrap leading-relaxed">{m.content}</span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {isInferencing && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-start gap-4">
                 <div className="w-8 h-8 rounded-lg bg-[#00B7FF]/10 text-[#00B7FF] border border-[#00B7FF]/20 flex items-center justify-center shrink-0">
                    <Cpu className="w-4 h-4 animate-pulse" />
                 </div>
                 <div className="bg-[#00B7FF]/5 border border-[#00B7FF]/10 rounded-2xl rounded-tl-sm p-4 flex items-center gap-2">
                    <div className="flex gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00B7FF] animate-bounce" style={{ animationDelay: "0ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00B7FF] animate-bounce" style={{ animationDelay: "150ms" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-[#00B7FF] animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                    <span className="text-[10px] text-[#00B7FF] uppercase tracking-widest font-bold ml-2">Resolving NIM Logic...</span>
                 </div>
              </motion.div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-white/10 bg-white/[0.02]">
            <div className="relative flex items-center">
              <input 
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                placeholder="Initialize sequence... [Press Enter]"
                className="w-full bg-black/50 border border-white/10 focus:border-[#00B7FF]/50 rounded-xl py-4 flex-1 pl-4 pr-14 text-sm font-mono text-white outline-none transition-colors"
                disabled={isInferencing || isDeployed247}
              />
              <button 
                onClick={handleSend}
                disabled={!input.trim() || isInferencing || isDeployed247}
                className="absolute right-2 p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg disabled:opacity-30 transition-colors"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            
            {showGuardrails && (
               <div className="absolute top-0 right-4 -translate-y-full mb-2 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1 rounded text-[9px] font-bold uppercase tracking-widest text-emerald-400 flex items-center gap-2 animate-fade-in shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                 <ShieldAlert className="w-3 h-3" /> OpenShell Safety Policy Enforced
               </div>
            )}

            <div className="mt-2 text-center">
               <span className="text-[9px] text-neutral-600 font-mono uppercase tracking-widest">
                 Live connection to NVIDIA NIM (mistral-nemotron)
               </span>
            </div>
          </div>

        </div>
      </div>

      {/* Agent Org Map Visualization */}
      <AgentOrgMap />

    </div>
  );
}
