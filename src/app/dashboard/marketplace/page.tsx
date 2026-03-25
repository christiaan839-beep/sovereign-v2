"use client";

import { motion } from "framer-motion";
import { ArrowRight, Building2, ShoppingCart, Utensils, Heart, Code, Truck, Zap } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useToast } from "@/components/ui/ToastProvider";

const TEMPLATES = [
  {
    id: "real-estate",
    name: "Real Estate Empire",
    icon: Building2,
    color: "text-emerald-400",
    border: "border-emerald-500/20",
    bg: "bg-emerald-500/5",
    agents: 14,
    description: "Automated property listing generation, virtual tour scripts, neighborhood analysis, and lead qualification for real estate agencies.",
    features: ["Property Description Generator", "Virtual Tour Script Writer", "Neighborhood OSINT Analysis", "Lead Qualification Calls", "Competitor Price Monitoring", "Social Media Property Posts"],
  },
  {
    id: "ecommerce",
    name: "E-Commerce Dominance",
    icon: ShoppingCart,
    color: "text-blue-400",
    border: "border-blue-500/20",
    bg: "bg-blue-500/5",
    agents: 16,
    description: "Product descriptions, review response automation, competitor price tracking, abandoned cart recovery, and social commerce at scale.",
    features: ["Product Description Engine", "Review Response Automation", "Competitor Price Tracker", "Abandoned Cart Recovery", "Social Commerce Posts", "Inventory Demand Forecasting"],
  },
  {
    id: "restaurant",
    name: "Restaurant & Hospitality",
    icon: Utensils,
    color: "text-orange-400",
    border: "border-orange-500/20",
    bg: "bg-orange-500/5",
    agents: 10,
    description: "Menu optimization, reservation management, review aggregation, local SEO domination, and social media food content.",
    features: ["Menu Copy Optimization", "Review Aggregation & Response", "Local SEO Content Generator", "Social Media Food Posts", "Reservation Follow-up Automation", "Competitor Menu Analysis"],
  },
  {
    id: "healthcare",
    name: "Healthcare & Wellness",
    icon: Heart,
    color: "text-red-400",
    border: "border-red-500/20",
    bg: "bg-red-500/5",
    agents: 12,
    description: "Patient communication, appointment reminders, wellness content, HIPAA-compliant data handling, and practitioner marketing.",
    features: ["Patient Communication Automation", "Appointment Reminder System", "Wellness Blog Generator", "Practitioner Profile Optimization", "Review Management", "Compliance-Safe Marketing"],
  },
  {
    id: "saas",
    name: "SaaS Growth Engine",
    icon: Code,
    color: "text-violet-400",
    border: "border-violet-500/20",
    bg: "bg-violet-500/5",
    agents: 18,
    description: "Onboarding sequences, feature announcement campaigns, churn prediction, competitor feature tracking, and technical content.",
    features: ["Onboarding Email Sequences", "Feature Announcement Campaigns", "Churn Prediction & Win-back", "Competitor Feature Tracker", "Technical Blog Generator", "API Documentation Writer"],
  },
  {
    id: "logistics",
    name: "Logistics & Fleet",
    icon: Truck,
    color: "text-cyan-400",
    border: "border-cyan-500/20",
    bg: "bg-cyan-500/5",
    agents: 11,
    description: "Route optimization communications, customer delivery updates, fleet performance reports, and logistics content marketing.",
    features: ["Delivery Update Automation", "Customer Communication Engine", "Fleet Performance Reports", "Route Optimization Comms", "Logistics Blog Content", "Driver Recruitment Marketing"],
  },
];

export default function MarketplacePage() {
  const [selected, setSelected] = useState<string | null>(null);
  const active = TEMPLATES.find(t => t.id === selected);
  const toast = useToast();

  return (
    <div className="space-y-8 bg-[#050505] min-h-screen p-8">
      <div>
        <h1 className="text-3xl font-bold text-white serif-text flex items-center gap-3">
          <Zap className="w-7 h-7 text-emerald-400" /> Marketplace Templates
        </h1>
        <p className="text-neutral-500 mt-2">One-click industry deployments. Each template pre-configures the optimal agent stack for your vertical.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {TEMPLATES.map((t, i) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            onClick={() => setSelected(selected === t.id ? null : t.id)}
            className={`cursor-pointer rounded-2xl p-6 border transition-all duration-300 hover:-translate-y-1 ${t.border} ${t.bg} ${selected === t.id ? "ring-1 ring-white/20 shadow-lg" : "hover:shadow-[0_0_30px_rgba(0,0,0,0.3)]"}`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className={`w-10 h-10 rounded-xl bg-black/40 border ${t.border} flex items-center justify-center`}>
                <t.icon className={`w-5 h-5 ${t.color}`} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">{t.name}</h3>
                <span className="text-[10px] text-neutral-500 font-mono">{t.agents} agents pre-configured</span>
              </div>
            </div>
            <p className="text-xs text-neutral-400 leading-relaxed mb-4">{t.description}</p>
            <div className="flex items-center justify-between">
              <span className={`text-[10px] font-bold uppercase tracking-widest ${t.color}`}>Deploy →</span>
              <span className="text-[10px] text-neutral-600 font-mono">~2 min setup</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Detail Panel */}
      {active && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`rounded-2xl p-8 border ${active.border} ${active.bg}`}
        >
          <div className="flex items-center gap-3 mb-6">
            <active.icon className={`w-8 h-8 ${active.color}`} />
            <div>
              <h2 className="text-xl font-bold text-white">{active.name}</h2>
              <span className="text-xs text-neutral-500 font-mono">{active.agents} autonomous agents</span>
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mb-8">
            {active.features.map((f, i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-black/30 border border-white/5">
                <Zap className={`w-4 h-4 ${active.color} flex-shrink-0`} />
                <span className="text-sm text-neutral-300">{f}</span>
              </div>
            ))}
          </div>

          <button
            onClick={() => {
              toast.success(`To deploy "${active.name}", go to the assistant and describe what you need.`);
            }}
            className={`px-8 py-4 rounded-xl font-bold uppercase tracking-widest text-sm transition-all flex items-center gap-2 bg-white text-black hover:bg-neutral-200`}
          >
            <ArrowRight className="w-4 h-4" /> Deploy {active.name}
          </button>
        </motion.div>
      )}
    </div>
  );
}
