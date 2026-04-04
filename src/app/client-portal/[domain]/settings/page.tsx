"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import { Save, Palette, Mail, Building2, Loader2, CheckCircle2 } from "lucide-react";

interface PageProps {
  params: Promise<{ domain: string }>;
}

export default function WhiteLabelSettings({ params: _params }: PageProps) {
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const [config, setConfig] = useState({
    agencyName: "",
    primaryColor: "#00B7FF",
    supportEmail: "",
    logoUrl: "",
  });

  const update = (key: string, value: string) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    // Simulate save to database
    await new Promise((r) => setTimeout(r, 1500));
    setIsSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0B] p-6 lg:p-10">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-light text-white tracking-widest font-mono mb-2">Portal Settings</h1>
        <p className="text-[10px] uppercase tracking-widest text-neutral-500 mb-8">Customize your branded client experience</p>

        <div className="space-y-6">
          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-5">
              <Building2 className="w-4 h-4 text-cyan-400" /> Brand Identity
            </h2>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-neutral-400 mb-2 block">Agency Name</label>
                <input value={config.agencyName} onChange={(e) => update("agencyName", e.target.value)} placeholder="e.g. Apex Marketing" className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-neutral-300 placeholder:text-neutral-600 focus:outline-none focus:border-cyan-500/50 font-mono" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest font-bold text-neutral-400 mb-2 block">Logo URL</label>
                <input type="url" inputMode="url" value={config.logoUrl} onChange={(e) => update("logoUrl", e.target.value)} placeholder="https://..." className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-neutral-300 placeholder:text-neutral-600 focus:outline-none focus:border-cyan-500/50 font-mono" />
              </div>
            </div>
          </div>

          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-5">
              <Palette className="w-4 h-4 text-purple-400" /> Theme
            </h2>
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-neutral-400 mb-2 block">Primary Brand Color</label>
              <div className="flex items-center gap-3">
                <input type="color" value={config.primaryColor} onChange={(e) => update("primaryColor", e.target.value)} className="w-12 h-12 rounded-xl border border-white/10 cursor-pointer bg-transparent" />
                <input value={config.primaryColor} onChange={(e) => update("primaryColor", e.target.value)} className="flex-1 bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-neutral-300 font-mono focus:outline-none focus:border-cyan-500/50" />
              </div>
            </div>
          </div>

          <div className="bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
            <h2 className="text-sm font-bold text-white uppercase tracking-widest flex items-center gap-2 mb-5">
              <Mail className="w-4 h-4 text-emerald-400" /> Support
            </h2>
            <div>
              <label className="text-[10px] uppercase tracking-widest font-bold text-neutral-400 mb-2 block">Support Email</label>
              <input type="email" inputMode="email" value={config.supportEmail} onChange={(e) => update("supportEmail", e.target.value)} placeholder="support@youragency.com" className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-sm text-neutral-300 placeholder:text-neutral-600 focus:outline-none focus:border-cyan-500/50 font-mono" />
            </div>
          </div>

          <motion.button
            onClick={handleSave}
            disabled={isSaving}
            whileTap={{ scale: 0.98 }}
            className="w-full px-6 py-4 bg-gradient-to-r from-cyan-500/10 to-cyan-500/5 border border-cyan-500/30 text-cyan-400 rounded-xl flex items-center justify-center gap-3 uppercase tracking-widest font-bold font-mono text-xs disabled:opacity-50 hover:from-cyan-500/20 transition-gpu"
          >
            {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {isSaving ? "Saving Configuration..." : saved ? "Configuration Saved" : "Save Changes"}
          </motion.button>
        </div>
      </div>
    </div>
  );
}
