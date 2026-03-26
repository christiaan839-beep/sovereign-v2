"use client";

import React, { useState, useEffect } from "react";
import { Webhook, Save, Loader2, CheckCircle2, ShieldAlert } from "lucide-react";
import { motion } from "framer-motion";

export default function WebhooksPage() {
  const [webhooks, setWebhooks] = useState({
    onComplete: "",
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{type: "success" | "error", text: string} | null>(null);

  useEffect(() => {
    async function loadWebhooks() {
      try {
        const res = await fetch("/api/settings/webhooks");
        const data = await res.json();
        if (data.webhooks) {
          try {
            const parsed = JSON.parse(data.webhooks);
            setWebhooks(prev => ({ ...prev, ...parsed }));
          } catch (e) {}
        }
      } catch (err) {
      } finally {
        setIsLoading(false);
      }
    }
    loadWebhooks();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const res = await fetch("/api/settings/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(webhooks),
      });
      if (res.ok) {
        setMessage({ type: "success", text: "Webhook saved successfully. The Swarm will now post completion payloads here." });
      } else {
        throw new Error("Failed to save");
      }
    } catch (err) {
      setMessage({ type: "error", text: "Failed to save webhook." });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-[#00B7FF]/10 to-blue-600/5 border border-[#00B7FF]/20 glass-panel">
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
          <Webhook className="w-6 h-6 text-[#00B7FF]" /> Webhook Automations
        </h1>
        <p className="text-neutral-400">
          Connect SOVEREIGN to your existing CRM, Slack, or databases. Provide a Zapier or Make.com URL, and the Swarm will automatically push the final AI briefs there once complete.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="w-8 h-8 text-[#00B7FF] animate-spin" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-black/40">
            <label className="block text-sm font-bold text-white uppercase tracking-widest mb-2">Completion Webhook URL (POST)</label>
            <p className="text-xs text-neutral-500 mb-4">Paste your Make.com or Zapier catch hook. Payload will include `agent`, `task`, and `output` fields.</p>
            <input 
              type="url"
              value={webhooks.onComplete}
              onChange={(e) => setWebhooks({...webhooks, onComplete: e.target.value})}
              placeholder="https://hook.us1.make.com/..."
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#00B7FF]/50 font-mono transition-colors"
            />
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
              className="px-8 py-3 rounded-xl bg-gradient-to-r from-[#00B7FF] to-blue-600 text-white font-bold uppercase tracking-widest text-sm hover:shadow-[0_0_30px_rgba(0,183,255,0.3)] transition-gpu flex items-center gap-2 disabled:opacity-50"
            >
              {isSaving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><Save className="w-4 h-4" /> Save Webhook</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
