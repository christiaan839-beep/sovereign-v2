"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Building2, ShoppingCart, Utensils, Heart, Code, Truck, Zap, Brain, Sparkles } from "lucide-react";

const INDUSTRIES = [
  { id: "real-estate", name: "Real Estate", icon: Building2, color: "text-emerald-400", agents: ["Property Listing AI", "Virtual Tour Writer", "Lead Qualifier", "Neighborhood OSINT"] },
  { id: "ecommerce", name: "E-Commerce", icon: ShoppingCart, color: "text-blue-400", agents: ["Product Description AI", "Review Responder", "Price Tracker", "Cart Recovery"] },
  { id: "restaurant", name: "Restaurant / Hospitality", icon: Utensils, color: "text-orange-400", agents: ["Menu Optimizer", "Review Manager", "Local SEO AI", "Reservation Follow-up"] },
  { id: "healthcare", name: "Healthcare / Wellness", icon: Heart, color: "text-red-400", agents: ["Patient Comms AI", "Wellness Content", "Review Manager", "Compliance Filter"] },
  { id: "saas", name: "SaaS / Tech", icon: Code, color: "text-violet-400", agents: ["Onboarding Sequences", "Feature Campaigns", "Churn Predictor", "Technical Writer"] },
  { id: "logistics", name: "Logistics / Fleet", icon: Truck, color: "text-cyan-400", agents: ["Delivery Updates", "Fleet Reports", "Route Comms", "Driver Recruitment"] },
  { id: "agency", name: "Marketing Agency", icon: Brain, color: "text-pink-400", agents: ["Content Factory", "SEO X-Ray", "War Room OSINT", "Ghost Fleet Outbound"] },
  { id: "other", name: "Other Industry", icon: Sparkles, color: "text-yellow-400", agents: ["Smart Router", "Content AI", "Lead Gen", "Competitor Intel"] },
];

/**
 * SmartOnboarding — AI-powered first-run experience.
 * Asks the user's industry, auto-selects the optimal agent stack,
 * then redirects to dashboard with the template pre-configured.
 */
export function SmartOnboarding({ onComplete }: { onComplete: (industry: string) => void }) {
  const [step, setStep] = useState(0);
  const [selectedIndustry, setSelectedIndustry] = useState<typeof INDUSTRIES[0] | null>(null);
  const [businessName, setBusinessName] = useState("");
  const [isDeploying, setIsDeploying] = useState(false);

  const handleDeploy = async () => {
    if (!selectedIndustry) return;
    setIsDeploying(true);

    // Simulate agent provisioning (in production, this calls /api/provisioning)
    await new Promise(r => setTimeout(r, 2500));

    window.localStorage.setItem("sovereign-onboarded", "true");
    window.localStorage.setItem("sovereign-industry", selectedIndustry.id);
    window.localStorage.setItem("sovereign-business", businessName);
    onComplete(selectedIndustry.id);
  };

  return (
    <AnimatePresence mode="wait">
      {step === 0 && (
        <motion.div key="step0" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
          <div className="relative z-10 max-w-2xl w-full text-center">
            <Zap className="w-10 h-10 text-emerald-400 mx-auto mb-6" />
            <h2 className="text-3xl md:text-4xl font-bold text-white serif-text mb-4">What&apos;s your industry?</h2>
            <p className="text-neutral-500 mb-10">We&apos;ll auto-configure the optimal agent stack for your vertical.</p>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-10">
              {INDUSTRIES.map((ind) => (
                <button
                  key={ind.id}
                  onClick={() => setSelectedIndustry(ind)}
                  className={`p-4 rounded-xl border transition-gpu text-left ${selectedIndustry?.id === ind.id ? "border-emerald-500/30 bg-emerald-500/5 ring-1 ring-emerald-500/10" : "border-white/5 bg-white/[0.02] hover:bg-white/[0.04]"}`}
                >
                  <ind.icon className={`w-5 h-5 ${ind.color} mb-2`} />
                  <div className="text-xs font-bold text-white">{ind.name}</div>
                </button>
              ))}
            </div>

            <button
              onClick={() => selectedIndustry && setStep(1)}
              disabled={!selectedIndustry}
              className="px-8 py-4 rounded-xl bg-white text-black font-bold uppercase tracking-widest text-xs hover:bg-neutral-200 transition-gpu disabled:opacity-30 flex items-center gap-2 mx-auto"
            >
              Continue <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </motion.div>
      )}

      {step === 1 && selectedIndustry && (
        <motion.div key="step1" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }} transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[200] flex items-center justify-center p-6">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" />
          <div className="relative z-10 max-w-lg w-full">
            <selectedIndustry.icon className={`w-10 h-10 ${selectedIndustry.color} mb-6`} />
            <h2 className="text-2xl font-bold text-white serif-text mb-2">{selectedIndustry.name} Stack</h2>
            <p className="text-neutral-500 mb-6 text-sm">These agents are optimized for your vertical:</p>

            <div className="space-y-2 mb-8">
              {selectedIndustry.agents.map((agent, i) => (
                <motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] border border-white/5">
                  <Zap className={`w-4 h-4 ${selectedIndustry.color}`} />
                  <span className="text-sm text-neutral-300">{agent}</span>
                  <span className="ml-auto text-[10px] text-emerald-400 font-bold uppercase tracking-widest">Active</span>
                </motion.div>
              ))}
            </div>

            <input
              type="text"
              placeholder="Your business name (optional)"
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500/50 transition-colors mb-6 text-sm"
            />

            <button
              onClick={handleDeploy}
              disabled={isDeploying}
              className="w-full px-8 py-4 rounded-xl bg-white text-black font-bold uppercase tracking-widest text-xs hover:bg-neutral-200 transition-gpu disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isDeploying ? (
                <><Zap className="w-4 h-4 animate-spin" /> Deploying {selectedIndustry.name} Stack...</>
              ) : (
                <><ArrowRight className="w-4 h-4" /> Deploy Agents</>
              )}
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
