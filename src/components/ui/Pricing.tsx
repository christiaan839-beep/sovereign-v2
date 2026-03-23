"use client";

import React, { useState } from "react";
import { CheckCircle2, X as XIcon, Zap, Crown, Server, ArrowRight, Shield, ShieldAlert, Loader2, Phone } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SovereignLogo } from "@/components/ui/SovereignLogo";

export function Pricing() {
  const tiers = [
    {
      name: "Sovereign Node",
      description: "Replace your SDR and Junior Designer entirely. Includes the OpenClaw Ghost Fleet.",
      price: "R9,997",
      period: "/mo",
      icon: Zap,
      color: "text-[#00B7FF]",
      bg: "bg-[#00B7FF]/5",
      border: "border-[#00B7FF]/20",
      features: [
        { name: "OpenClaw Local Execution", included: true },
        { name: "Apollo Ghost Fleet Targeting", included: true },
        { name: "Sovereign Visual Studio", included: true },
        { name: "NVIDIA Edify 3D Generation", included: true },
        { name: "Morpheus Shield Integration", included: true },
        { name: "Single macOS Node License", included: true },
        { name: "Bring Your Own API Key", included: true },
        { name: "Unlimited generations", included: false },
        { name: "White-label Reseller Hub", included: false },
      ],
      planId: "node",
      buttonText: "Deploy Node",
      buttonStyle: "bg-white/5 hover:bg-white/10 text-white border border-white/10",
    },
    {
      name: "Sovereign Array",
      description: "Replace a full Growth Team. Unlimited generations and priority Nemotron 70B inference.",
      price: "R24,997",
      period: "/mo",
      icon: Crown,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      border: "border-emerald-500/40",
      isPopular: true,
      features: [
        { name: "Everything in Node", included: true },
        { name: "Unlimited AI generations", included: true },
        { name: "Cosmos VLM Video Generation", included: true },
        { name: "Priority AI processing", included: true },
        { name: "War Room Red-Teaming", included: true },
        { name: "Competitor monitoring", included: true },
        { name: "Direct Comm-Link (24h)", included: true },
        { name: "White-label Reseller Hub", included: false },
        { name: "Cartel Sub-Licenses", included: false },
      ],
      planId: "array",
      buttonText: "Deploy Array",
      buttonStyle: "bg-emerald-400 hover:bg-emerald-300 text-black shadow-[0_0_20px_rgba(52,211,153,0.3)]",
    },
    {
      name: "Cartel License",
      description: "White-label the Sovereign Matrix to resell autonomous hubs to local businesses.",
      price: "R49,997",
      period: "/mo",
      icon: Server,
      color: "text-violet-400",
      bg: "bg-violet-500/5",
      border: "border-violet-500/20",
      features: [
        { name: "Everything in Array", included: true },
        { name: "White-label dashboard", included: true },
        { name: "Client portal access", included: true },
        { name: "Root Admin Command Center", included: true },
        { name: "API access for Integrations", included: true },
        { name: "Dedicated Setup & Onboarding", included: true },
        { name: "Custom domain branding", included: true },
        { name: "Cartel Sub-Licenses (5 included)", included: true },
        { name: "SLA guarantee", included: true },
      ],
      planId: "cartel",
      buttonText: "Initialize Cartel",
      buttonStyle: "bg-white/5 hover:bg-white/10 text-white border border-white/10",
    },
  ];

  const [showModal, setShowModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null);
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const initiateCheckout = (planId: string) => {
    if (planId === "node") {
      window.location.assign("/dashboard");
      return;
    }
    setSelectedPlan(planId);
    setShowModal(true);
  };

  const processSecureUplink = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlan || !leadPhone) return;
    setIsProcessing(true);

    try {
      // Step 1: Capture Lead into God-Brain
      await fetch("/api/leads/capture", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: leadName, phone: leadPhone, planId: selectedPlan }),
      });

      // Step 2: Initialize PayFast Execution
      const res = await fetch("/api/payments/payfast/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: selectedPlan }),
      });
      const data = await res.json();

      if (data.success && data.formHtml) {
        const container = document.createElement("div");
        container.innerHTML = data.formHtml;
        container.style.display = "none";
        document.body.appendChild(container);
        const form = container.querySelector("form");
        if (form) form.submit();
        return;
      }
      alert(data.error || "Deployment authorization failed. Ensure PayFast API keys are set.");
    } catch {
      alert("Uplink severed. Try again.");
    } finally {
      setIsProcessing(false);
    }
  };



  return (
    <div className="w-full max-w-7xl mx-auto py-24 px-6 relative z-10">
      <div className="text-center mb-16 flex flex-col items-center">
        <div className="mb-6 animate-[pulse_4s_ease-in-out_infinite]">
           <SovereignLogo size="lg" />
        </div>
        <h2 className="text-4xl md:text-5xl font-bold text-white serif-text mb-6">Enterprise Architecture.</h2>
        <p className="text-neutral-400 max-w-2xl mx-auto">
          Scale your autonomous agency instantly. Deploy a node, authorize an array, or initialize a cartel.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 items-start">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={`relative rounded-3xl p-8 backdrop-blur-3xl border ${tier.border} ${tier.bg} transition-all duration-300 hover:-translate-y-2 gradient-border-card ${tier.isPopular ? "shadow-[0_0_50px_rgba(16,185,129,0.15)] ring-1 ring-emerald-500/50" : "hover:shadow-[0_0_30px_rgba(0,0,0,0.5)]"}`}
          >
            {tier.isPopular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-to-r from-emerald-500 to-emerald-400 text-black text-[10px] font-black uppercase tracking-widest rounded-full shadow-[0_0_20px_rgba(52,211,153,0.5)]">
                Most Popular
              </div>
            )}

            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center bg-black/40 border ${tier.border}`}>
                <tier.icon className={`w-5 h-5 ${tier.color}`} />
              </div>
              <h3 className="text-xl font-bold text-white uppercase tracking-widest">{tier.name}</h3>
            </div>

            <p className="text-sm text-neutral-400 mb-6 h-10">{tier.description}</p>

            <div className="mb-8">
              <div className="flex items-end gap-2 mb-1">
                <span className="text-4xl font-black text-white font-mono tracking-tighter">
                  {tier.price}
                </span>
                {tier.period !== "forever" && (
                  <span className="text-neutral-500 font-bold tracking-widest uppercase text-xs mb-2">{tier.period}</span>
                )}
              </div>
            </div>

            <button
              onClick={() => initiateCheckout(tier.planId)}
              className={`w-full py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all mb-8 flex items-center justify-center gap-2 ${tier.buttonStyle}`}
            >
              <ArrowRight className="w-4 h-4" /> {tier.buttonText}
            </button>

            <ul className="space-y-3">
              {tier.features.map((feature, i) => (
                <li key={i} className={`flex items-start gap-3 ${feature.included ? "" : "opacity-40"}`}>
                  {feature.included ? (
                    <CheckCircle2 className={`w-4 h-4 shrink-0 mt-0.5 ${tier.color}`} />
                  ) : (
                    <XIcon className="w-4 h-4 shrink-0 mt-0.5 text-neutral-600" />
                  )}
                  <span className={`text-sm ${feature.included ? "text-neutral-300 font-medium" : "text-neutral-600"}`}>{feature.name}</span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      {/* Payment Methods */}
      <div className="mt-12 text-center flex items-center justify-center gap-6">
        <span className="flex items-center gap-1 text-[10px] text-emerald-400 font-bold uppercase tracking-wider"><Shield className="w-3 h-3" /> SSL Secured</span>
        <span className="text-xs text-neutral-500 uppercase tracking-widest">Secure payments via PayFast (Cards, Instant EFT, Zapper)</span>
      </div>

      {/* Secure Uplink Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div 
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          >
            <motion.div 
              className="bg-[#0A0A0A] border border-white/10 p-8 rounded-3xl w-full max-w-md relative shadow-[0_0_100px_rgba(0,183,255,0.1)]"
              initial={{ scale: 0.95, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, y: 20 }}
            >
              <button onClick={() => setShowModal(false)} className="absolute top-6 right-6 text-neutral-500 hover:text-white transition-colors">
                <XIcon className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                  <ShieldAlert className="w-6 h-6 text-[#00B7FF]" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white uppercase tracking-widest">Secure Uplink</h3>
                  <p className="text-xs text-[#00B7FF] uppercase tracking-widest">Hardware Binding Protocol</p>
                </div>
              </div>

              <p className="text-sm text-neutral-400 mb-6">
                To authorize your deployment, the Sovereign Matrix requires a direct WhatsApp line. A verification packet will be sent to this number bounding your Cartel license to you physically.
              </p>

              <form onSubmit={processSecureUplink} className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em] mb-2">Commander Name</label>
                  <input 
                    type="text" 
                    required
                    value={leadName}
                    onChange={(e) => setLeadName(e.target.value)}
                    placeholder="John Doe"
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-neutral-700 focus:outline-none focus:border-[#00B7FF]/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-neutral-500 uppercase tracking-[0.2em] mb-2">WhatsApp Number</label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-neutral-500 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input 
                      type="tel" 
                      required
                      value={leadPhone}
                      onChange={(e) => setLeadPhone(e.target.value)}
                      placeholder="+27 82 000 0000"
                      className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-3 text-white placeholder:text-neutral-700 focus:outline-none focus:border-[#00B7FF]/50 transition-colors font-mono"
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={isProcessing || !leadPhone}
                  className="w-full mt-4 py-4 rounded-xl bg-white text-black font-bold uppercase tracking-widest text-sm hover:bg-neutral-200 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /> Authorizing...</> : "Initiate Handshake"}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
