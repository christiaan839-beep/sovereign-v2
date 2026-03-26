"use client";

import React, { useState, useEffect } from "react";
import { Palette, Save, Loader2, CheckCircle2, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";

export default function WhitelabelPage() {
  const [settings, setSettings] = useState({
    agencyName: "SOVEREIGN",
    logoUrl: "",
    primaryColor: "#00B7FF",
    supportEmail: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{type: "success" | "error", text: string} | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/settings/whitelabel");
        const data = await res.json();
        if (data.config) {
          setSettings({
            agencyName: data.config.agencyName || "SOVEREIGN",
            logoUrl: data.config.logoUrl || "",
            primaryColor: data.config.primaryColor || "#00B7FF",
            supportEmail: data.config.supportEmail || "",
          });
        }
      } catch (err) {
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/whitelabel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Brand settings saved. Exported PDFs and portals will now use your branding." });
      } else {
        throw new Error("Failed to save");
      }
    } catch (err) {
      setMessage({ type: "error", text: "Failed to save brand settings." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-violet-500/10 to-purple-600/5 border border-violet-500/20 glass-panel">
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
          <Palette className="w-6 h-6 text-violet-400" /> White-Label Exports
        </h1>
        <p className="text-neutral-400">
          Customize the SOVEREIGN portal and AI-generated PDF reports with your own agency&apos;s branding, colors, and logos.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-black/40">
              <label className="block text-sm font-bold text-white uppercase tracking-widest mb-2">Agency Name</label>
              <input 
                type="text"
                value={settings.agencyName}
                onChange={(e) => setSettings({...settings, agencyName: e.target.value})}
                placeholder="e.g. Apex Marketing"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-neutral-600 focus:outline-none focus:border-violet-500/50 transition-colors"
              />
            </div>

            <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-black/40">
              <label className="block text-sm font-bold text-white uppercase tracking-widest mb-2">Support Email</label>
              <input 
                type="email"
                value={settings.supportEmail}
                onChange={(e) => setSettings({...settings, supportEmail: e.target.value})}
                placeholder="support@apexmarketing.com"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-neutral-600 focus:outline-none focus:border-violet-500/50 transition-colors"
              />
            </div>
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-black/40">
            <label className="block text-sm font-bold text-white uppercase tracking-widest mb-2">Agency Logo URL</label>
            <p className="text-xs text-neutral-500 mb-4">Paste a public URL to your transparent PNG logo (recommended size 400x120px).</p>
            <input 
              type="url"
              value={settings.logoUrl}
              onChange={(e) => setSettings({...settings, logoUrl: e.target.value})}
              placeholder="https://yourdomain.com/logo.png"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-neutral-600 focus:outline-none focus:border-violet-500/50 font-mono transition-colors"
            />
            {settings.logoUrl && (
              <div className="mt-4 p-4 bg-white/5 rounded-xl border border-white/10 flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={settings.logoUrl} alt="Logo Preview" className="max-h-12 object-contain" onError={(e) => e.currentTarget.style.display = 'none'} />
              </div>
            )}
          </div>

          <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-black/40">
            <label className="block text-sm font-bold text-white uppercase tracking-widest mb-2">Primary Accent Color</label>
            <p className="text-xs text-neutral-500 mb-4">Used for buttons, highlights, and charts in exported PDF reports.</p>
            <div className="flex items-center gap-4">
              <input 
                type="color"
                value={settings.primaryColor}
                onChange={(e) => setSettings({...settings, primaryColor: e.target.value})}
                className="w-16 h-16 rounded-xl cursor-pointer bg-transparent border-0 p-0"
              />
              <input 
                type="text"
                value={settings.primaryColor}
                onChange={(e) => setSettings({...settings, primaryColor: e.target.value})}
                className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-violet-500/50 font-mono transition-colors uppercase"
              />
            </div>
          </div>

          {message && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
              className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${
                message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'
              }`}
            >
              {message.type === 'success' ? <CheckCircle2 className="w-5 h-5" /> : <ShieldAlert className="w-5 h-5" />}
              {message.text}
            </motion.div>
          )}

          <div className="flex justify-end pt-4">
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-bold uppercase tracking-widest text-sm hover:shadow-[0_0_30px_rgba(139,92,246,0.3)] transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Brand Identity</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
