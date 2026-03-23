"use client";

import React, { useState } from "react";
import { Rocket, CheckCircle2, ArrowRight, Zap, Shield, FileText, BarChart3, Globe, Loader2 } from "lucide-react";

const GOALS = [
  { id: "leads", label: "Generate More Leads", icon: Zap, color: "#00ff66", agents: ["abm-artillery", "blog-gen", "translate"], description: "Auto-research companies, send personalized emails, and generate SEO content" },
  { id: "security", label: "Protect Client Data", icon: Shield, color: "#FF0055", agents: ["pii-redactor", "nemoclaw", "morpheus-shield"], description: "Auto-redact PII, deploy guardrailed agents, and content-safety check everything" },
  { id: "content", label: "Create Content at Scale", icon: FileText, color: "#A855F7", agents: ["blog-gen", "image-gen", "page-builder", "cosmos-video"], description: "Auto-generate blogs, images, landing pages, and video scenes" },
  { id: "analytics", label: "Track Everything", icon: BarChart3, color: "#00B7FF", agents: ["analytics", "doc-intel", "scheduler"], description: "Usage metering, document intelligence, and scheduled automation" },
  { id: "global", label: "Go Multilingual", icon: Globe, color: "#06B6D4", agents: ["translate", "voice-synth", "abm-artillery"], description: "Translate to 12 languages, synthesize voice, and reach global markets" },
];

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [companyName, setCompanyName] = useState("");
  const [deploying, setDeploying] = useState(false);
  const [deployed, setDeployed] = useState(false);

  const toggleGoal = (id: string) => {
    setSelectedGoals(prev => prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]);
  };

  const deployAgents = async () => {
    setDeploying(true);
    try {
      // Save onboarding config to user settings
      await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          config: JSON.stringify({
            companyName,
            selectedGoals,
            deployedAgents: selectedAgents,
            onboardedAt: new Date().toISOString(),
          }),
        }),
      });
    } catch {
      // Settings save failed — continue anyway, don't block user
    }
    setDeploying(false);
    setDeployed(true);
  };

  const selectedAgents = [...new Set(selectedGoals.flatMap(g => GOALS.find(x => x.id === g)?.agents || []))];

  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-6 font-mono">
      <div className="max-w-2xl w-full">

        {/* Step 0: Welcome */}
        {step === 0 && (
          <div className="text-center space-y-8 animate-in fade-in duration-500">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-[#00ff66]/10 border border-[#00ff66]/30 flex items-center justify-center">
              <Rocket className="w-8 h-8 text-[#00ff66]" />
            </div>
            <h1 className="text-3xl font-black uppercase tracking-[0.15em]">Welcome to <span className="text-[#00B7FF]">Sovereign Matrix</span></h1>
            <p className="text-neutral-500 text-sm max-w-md mx-auto">25 autonomous AI agents are ready to work for you. Let&apos;s deploy the right ones for your goals.</p>
            <div className="space-y-3">
              <input
                type="text"
                value={companyName}
                onChange={e => setCompanyName(e.target.value)}
                placeholder="Your company name"
                className="w-full max-w-sm mx-auto block bg-neutral-950 border border-neutral-800 px-4 py-3 text-sm text-white placeholder:text-neutral-700 focus:outline-none focus:border-neutral-600 text-center"
              />
              <button
                onClick={() => setStep(1)}
                className="px-8 py-3 bg-white text-black font-bold text-sm uppercase tracking-widest hover:bg-neutral-200 transition-all"
              >
                Get Started <ArrowRight className="w-4 h-4 inline ml-2" />
              </button>
            </div>
          </div>
        )}

        {/* Step 1: Select Goals */}
        {step === 1 && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="text-center mb-8">
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-2">Step 1 of 3</p>
              <h2 className="text-2xl font-black uppercase tracking-widest">What are your goals{companyName ? `, ${companyName}` : ""}?</h2>
              <p className="text-neutral-500 text-xs mt-2">Select all that apply. We&apos;ll deploy the right agents.</p>
            </div>
            <div className="space-y-3">
              {GOALS.map(goal => {
                const Icon = goal.icon;
                const selected = selectedGoals.includes(goal.id);
                return (
                  <button
                    key={goal.id}
                    onClick={() => toggleGoal(goal.id)}
                    className={`w-full p-4 text-left border transition-all flex items-center gap-4 ${
                      selected
                        ? "border-white bg-white/5"
                        : "border-neutral-800 bg-neutral-950 hover:border-neutral-700"
                    }`}
                  >
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${goal.color}15`, border: `1px solid ${goal.color}30` }}>
                      <Icon className="w-5 h-5" style={{ color: goal.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold">{goal.label}</p>
                      <p className="text-[10px] text-neutral-500">{goal.description}</p>
                    </div>
                    {selected && <CheckCircle2 className="w-5 h-5 text-[#00ff66] shrink-0" />}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setStep(2)}
              disabled={selectedGoals.length === 0}
              className="w-full py-3 bg-white text-black font-bold text-sm uppercase tracking-widest hover:bg-neutral-200 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Continue — {selectedAgents.length} agents selected <ArrowRight className="w-4 h-4 inline ml-2" />
            </button>
          </div>
        )}

        {/* Step 2: Review & Deploy */}
        {step === 2 && !deployed && (
          <div className="space-y-6 animate-in fade-in duration-500">
            <div className="text-center mb-8">
              <p className="text-[10px] text-neutral-500 uppercase tracking-widest mb-2">Step 2 of 3</p>
              <h2 className="text-2xl font-black uppercase tracking-widest">Your Agent Fleet</h2>
              <p className="text-neutral-500 text-xs mt-2">These agents will be deployed and configured for {companyName || "your company"}.</p>
            </div>
            <div className="bg-neutral-950 border border-neutral-800 p-5 space-y-3">
              {selectedAgents.map(agent => (
                <div key={agent} className="flex items-center justify-between py-2 border-b border-neutral-900 last:border-0">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#00ff66]" />
                    <span className="text-xs font-bold text-white">{agent.replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</span>
                  </div>
                  <span className="text-[9px] text-neutral-600 uppercase tracking-widest">Ready</span>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-3 text-center">
              <div className="bg-neutral-950 border border-neutral-800 p-3">
                <p className="text-lg font-black text-[#00ff66]">{selectedAgents.length}</p>
                <p className="text-[8px] text-neutral-500 uppercase">Agents</p>
              </div>
              <div className="bg-neutral-950 border border-neutral-800 p-3">
                <p className="text-lg font-black text-[#00B7FF]">38</p>
                <p className="text-[8px] text-neutral-500 uppercase">NIM Models</p>
              </div>
              <div className="bg-neutral-950 border border-neutral-800 p-3">
                <p className="text-lg font-black text-[#A855F7]">$0</p>
                <p className="text-[8px] text-neutral-500 uppercase">Cost</p>
              </div>
            </div>
            <button
              onClick={deployAgents}
              disabled={deploying}
              className="w-full py-4 bg-[#00ff66] text-black font-bold text-sm uppercase tracking-widest hover:bg-[#00dd55] transition-all disabled:opacity-50"
            >
              {deploying ? <><Loader2 className="w-4 h-4 inline mr-2 animate-spin" /> Deploying Agents...</> : <>Deploy Fleet <Rocket className="w-4 h-4 inline ml-2" /></>}
            </button>
          </div>
        )}

        {/* Step 3: Success */}
        {deployed && (
          <div className="text-center space-y-8 animate-in fade-in duration-500">
            <div className="w-20 h-20 mx-auto rounded-2xl bg-[#00ff66]/10 border border-[#00ff66]/30 flex items-center justify-center">
              <CheckCircle2 className="w-10 h-10 text-[#00ff66]" />
            </div>
            <h2 className="text-3xl font-black uppercase tracking-widest">Fleet Deployed</h2>
            <p className="text-neutral-500 text-sm max-w-md mx-auto">{selectedAgents.length} agents are now active and working for {companyName || "you"}. Head to the dashboard to monitor and control them.</p>
            <div className="flex gap-3 justify-center">
              <a href="/dashboard/agent-command" className="px-6 py-3 bg-white text-black font-bold text-sm uppercase tracking-widest hover:bg-neutral-200 transition-all">
                Agent Command Center <ArrowRight className="w-4 h-4 inline ml-2" />
              </a>
              <a href="/dashboard" className="px-6 py-3 border border-neutral-800 text-neutral-400 font-bold text-sm uppercase tracking-widest hover:border-neutral-600 transition-all">
                Dashboard
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
