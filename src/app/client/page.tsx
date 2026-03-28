"use client";

import { motion } from "framer-motion";
import { Building2, BarChart3, FileText, Bot, Globe, Lock, ArrowRight } from "lucide-react";
import { SignInButton } from "@clerk/nextjs";

export default function ClientPortalPage() {
  const features = [
    { icon: BarChart3, title: "Campaign Analytics", desc: "Real-time ROI tracking across all active AI agents. See exactly what your investment generates.", color: "text-emerald-400" },
    { icon: Bot, title: "Agent Outputs", desc: "Browse every piece of content, email, and creative your AI swarm has generated this month.", color: "text-violet-400" },
    { icon: FileText, title: "Weekly Reports", desc: "AI-generated PDF performance reports delivered every Monday. Board-ready intelligence.", color: "text-blue-400" },
    { icon: Globe, title: "White-Label Access", desc: "Cartel license holders get a fully branded client portal with custom domain and logo.", color: "text-orange-400" },
  ];

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Hero */}
      <div className="pt-32 pb-20 px-6 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-violet-500/5 rounded-full blur-[200px]" />
        
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
          className="relative z-10 max-w-4xl mx-auto text-center"
        >
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-neutral-400 text-xs font-medium uppercase tracking-[0.2em] mb-8">
            <Lock className="w-3 h-3" /> Secured Client Access
          </div>

          <h1 className="text-4xl md:text-6xl font-bold text-white serif-text mb-6">Client Portal</h1>
          <p className="text-lg text-neutral-500 max-w-2xl mx-auto mb-12">
            Your dedicated command interface for monitoring AI agent output, campaign performance, and strategic intelligence.
          </p>

          <SignInButton mode="modal" fallbackRedirectUrl="/dashboard">
            <button className="inline-flex items-center gap-3 px-10 py-5 rounded-2xl bg-white text-black font-bold uppercase tracking-widest text-sm hover:bg-neutral-200 transition-gpu shadow-[0_0_40px_rgba(255,255,255,0.15)] group">
              <Building2 className="w-5 h-5" />
              Access Portal
              <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </SignInButton>
        </motion.div>
      </div>

      {/* Features */}
      <div className="max-w-5xl mx-auto px-6 pb-32">
        <div className="grid md:grid-cols-2 gap-6">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="bg-white/[0.02] border border-white/5 rounded-2xl p-8 hover:border-white/10 transition-gpu group"
            >
              <div className={`w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center mb-5 ${f.color}`}>
                <f.icon className="w-6 h-6" />
              </div>
              <h3 className="text-lg font-bold text-white mb-2">{f.title}</h3>
              <p className="text-sm text-neutral-500 leading-relaxed">{f.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
