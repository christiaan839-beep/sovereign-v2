"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { RevealText } from "@/components/ui/ScrollAnimations";

// ─── FAQ Item ───
function FAQItem({ question, answer }: { question: string; answer: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/5">
      <button type="button" className="w-full flex items-center justify-between py-6 text-left group" onClick={() => setOpen(!open)}>
        <span className="text-sm md:text-base font-medium text-white group-hover:text-neutral-400 transition-colors pr-4">{question}</span>
        <ChevronDown className={`w-5 h-5 text-neutral-500 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`overflow-hidden transition-gpu duration-300 ${open ? 'max-h-60 pb-6' : 'max-h-0'}`}>
        <p className="text-sm text-neutral-400 leading-relaxed">{answer}</p>
      </div>
    </div>
  );
}

const FAQ_DATA = [
  { q: "What is Sovereign Matrix?", a: "130 AI agents that do sales, marketing, content, and ops work. You tell them what you need. They figure out which of the 39+ models to use, execute the task, and deliver the output. No prompt engineering required." },
  { q: "Is this just another ChatGPT wrapper?", a: "No. ChatGPT is a chatbot. Sovereign Matrix is 130+ autonomous agents that execute: finding leads, building pages, writing outreach sequences, qualifying prospects, making calls. They open real browsers, hit real APIs, plan multi-step workflows, and self-correct without manual prompting." },
  { q: "Can agents run locally without cloud?", a: "Yes. NemoClaw runs on your machine via Ollama. Full offline execution — your data never leaves your hardware. Built for sensitive client work and air-gapped environments." },
  { q: "Is there a contract or lock-in?", a: "No contracts. Month-to-month. Cancel from your dashboard. Data is always exportable. NVIDIA NIM inference is free — you only pay for premium features." },
  { q: "How long does setup take?", a: "Under 60 seconds. Sign up, complete the 5-step onboarding wizard, and deploy your first agent immediately. No Docker, no terminal commands, no technical setup required for the cloud version." },
  { q: "What integrations are supported?", a: "NVIDIA NIM, Ollama (local models), ElevenLabs (voice), Pinecone (vector memory), Clerk (auth), Neon PostgreSQL (database), Vercel (hosting), PayFast, Yoco, and PayStack. A public API is available for custom integrations." },
  { q: "Is my data safe?", a: "Yes. A 5-layer NeMo Guardrails safety pipeline protects every interaction: jailbreak detection, topic control, content safety, PII scanning, and quality scoring. Plus local execution means data never touches the cloud if you choose." },
  { q: "What is the white-label Enterprise license?", a: "The Enterprise license lets agencies rebrand the entire platform as their own. Custom domain, client portals, your logo. It is a complete AI business-in-a-box — deploy under your brand and scale your agency without hiring." },
  { q: "Can I use this to run an agency?", a: "Yes. The Enterprise plan ($499/mo) includes white-label: your domain, your logo, your client portals. Resell to 20 clients at $50/mo each = $1,000/mo revenue on a $499 cost." },
];

export function FAQSection() {
  return (
    <section className="py-24 px-6 bg-[#050505] perf-section">
      <motion.div initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }}
        className="max-w-2xl mx-auto">
        <RevealText as="h2" className="text-2xl md:text-3xl font-bold text-white mb-12 text-center tracking-tight">Common Questions</RevealText>
        <div className="rounded-2xl border border-white/[0.06] bg-[#080808] p-1">
          {FAQ_DATA.map((faq, i) => <FAQItem key={i} question={faq.q} answer={faq.a} />)}
        </div>
      </motion.div>
    </section>
  );
}
