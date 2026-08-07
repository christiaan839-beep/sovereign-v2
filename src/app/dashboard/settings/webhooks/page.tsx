"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  Webhook,
  Save,
  Loader2,
  CheckCircle2,
  ShieldAlert,
  Zap,
  Puzzle,
  Globe,
  X,
  Copy,
  ExternalLink,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// ─── Types ────────────────────────────────────────────────────────

interface WebhookTemplate {
  id: string;
  platform: "Zapier" | "Make" | "Generic";
  name: string;
  description: string;
  trigger: string;
  webhookUrl: string;
  payload: Record<string, string>;
  configured: boolean;
  active: boolean;
  savedWebhookUrl: string | null;
}

type Tab = "custom" | "templates";

// ─── Platform helpers ─────────────────────────────────────────────

function platformIcon(platform: string) {
  switch (platform) {
    case "Zapier":
      return <Zap className="w-5 h-5" />;
    case "Make":
      return <Puzzle className="w-5 h-5" />;
    default:
      return <Globe className="w-5 h-5" />;
  }
}

function platformColor(platform: string) {
  switch (platform) {
    case "Zapier":
      return "#FF4F00";
    case "Make":
      return "#6D00CC";
    default:
      return "#6366F1";
  }
}

// ─── Page ─────────────────────────────────────────────────────────

export default function WebhooksPage() {
  const [tab, setTab] = useState<Tab>("custom");

  // ── Custom webhook state ──
  const [webhooks, setWebhooks] = useState({ onComplete: "" });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // ── Templates state ──
  const [templates, setTemplates] = useState<WebhookTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [configModal, setConfigModal] = useState<WebhookTemplate | null>(null);
  const [configUrl, setConfigUrl] = useState("");
  const [configSaving, setConfigSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [configMessage, setConfigMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  // ── Load custom webhook ──
  useEffect(() => {
    async function loadWebhooks() {
      try {
        const res = await fetch("/api/settings/webhooks");
        const data = await res.json();
        if (data.webhooks) {
          try {
            const parsed = JSON.parse(data.webhooks);
            setWebhooks((prev) => ({ ...prev, ...parsed }));
          } catch (_e) {
            /* ignore parse errors */
          }
        }
      } catch (_err) {
        /* ignore fetch errors */
      } finally {
        setIsLoading(false);
      }
    }
    loadWebhooks();
  }, []);

  // ── Load templates ──
  const loadTemplates = useCallback(async () => {
    setTemplatesLoading(true);
    try {
      const res = await fetch("/api/integrations/templates");
      const data = await res.json();
      if (data.templates) setTemplates(data.templates);
    } catch (_err) {
      /* ignore */
    } finally {
      setTemplatesLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "templates") loadTemplates();
  }, [tab, loadTemplates]);

  // ── Save custom webhook ──
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
        setMessage({
          type: "success",
          text: "Webhook saved successfully. The Swarm will now post completion payloads here.",
        });
      } else {
        throw new Error("Failed to save");
      }
    } catch (_err) {
      setMessage({ type: "error", text: "Failed to save webhook." });
    } finally {
      setIsSaving(false);
    }
  };

  // ── Save template config ──
  const handleConfigSave = async () => {
    if (!configModal) return;
    setConfigSaving(true);
    setConfigMessage(null);
    try {
      const res = await fetch("/api/integrations/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          templateId: configModal.id,
          webhookUrl: configUrl,
        }),
      });
      if (res.ok) {
        setConfigMessage({
          type: "success",
          text: "Webhook activated. Events will fire to this URL.",
        });
        // Refresh templates
        await loadTemplates();
        setTimeout(() => setConfigModal(null), 1200);
      } else {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save");
      }
    } catch (err) {
      setConfigMessage({
        type: "error",
        text: err instanceof Error ? err.message : "Failed to save configuration.",
      });
    } finally {
      setConfigSaving(false);
    }
  };

  // ── Copy payload to clipboard ──
  const copyPayload = (payload: Record<string, string>) => {
    navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8 p-6 rounded-2xl bg-gradient-to-br from-[#00B7FF]/10 to-blue-600/5 border border-[#00B7FF]/20 glass-panel">
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
          <Webhook className="w-6 h-6 text-[#00B7FF]" /> Webhook Automations
        </h1>
        <p className="text-neutral-400">
          Connect SOVEREIGN to your existing CRM, Slack, or databases. Provide a
          Zapier or Make.com URL, and the Swarm will automatically push the final
          AI briefs there once complete.
        </p>
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-2 mb-6">
        {(["custom", "templates"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2.5 rounded-xl text-sm font-bold uppercase tracking-widest transition-all ${
              tab === t
                ? "bg-[#00B7FF]/20 text-[#00B7FF] border border-[#00B7FF]/30"
                : "bg-white/5 text-neutral-500 border border-white/5 hover:text-neutral-300 hover:bg-white/10"
            }`}
          >
            {t === "custom" ? "Custom Webhook" : "Templates"}
          </button>
        ))}
      </div>

      {/* ──────── Custom Webhook Tab ──────── */}
      <AnimatePresence mode="wait">
        {tab === "custom" && (
          <motion.div
            key="custom"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            {isLoading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 text-[#00B7FF] animate-spin" />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="glass-panel p-6 rounded-2xl border border-white/5 bg-black/40">
                  <label className="block text-sm font-bold text-white uppercase tracking-widest mb-2">
                    Completion Webhook URL (POST)
                  </label>
                  <p className="text-xs text-neutral-500 mb-4">
                    Paste your Make.com or Zapier catch hook. Payload will
                    include `agent`, `task`, and `output` fields.
                  </p>
                  <input
                    type="url"
                    value={webhooks.onComplete}
                    onChange={(e) =>
                      setWebhooks({ ...webhooks, onComplete: e.target.value })
                    }
                    placeholder="https://hook.us1.make.com/..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#00B7FF]/50 font-mono transition-colors"
                  />
                </div>

                {message && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${
                      message.type === "success"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-red-500/10 text-red-400 border border-red-500/20"
                    }`}
                  >
                    {message.type === "success" ? (
                      <CheckCircle2 className="w-5 h-5" />
                    ) : (
                      <ShieldAlert className="w-5 h-5" />
                    )}
                    {message.text}
                  </motion.div>
                )}

                <div className="flex justify-end pt-4">
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="px-8 py-3 rounded-xl bg-gradient-to-r from-[#00B7FF] to-blue-600 text-white font-bold uppercase tracking-widest text-sm hover:shadow-[0_0_30px_rgba(0,183,255,0.3)] transition-gpu flex items-center gap-2 disabled:opacity-50"
                  >
                    {isSaving ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-4 h-4" /> Save Webhook
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ──────── Templates Tab ──────── */}
        {tab === "templates" && (
          <motion.div
            key="templates"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.2 }}
          >
            {templatesLoading ? (
              <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 text-[#00B7FF] animate-spin" />
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm text-neutral-500 mb-2">
                  Pre-built webhook configurations for popular automation
                  platforms. Click &quot;Configure&quot; to activate.
                </p>
                {templates.map((t) => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-panel p-5 rounded-2xl border border-white/5 bg-black/40 flex items-center gap-4"
                  >
                    {/* Platform icon */}
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: `${platformColor(t.platform)}20`,
                        color: platformColor(t.platform),
                      }}
                    >
                      {platformIcon(t.platform)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="text-white font-bold text-sm truncate">
                          {t.name}
                        </h3>
                        {t.active && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5 truncate">
                        {t.description}
                      </p>
                      <p className="text-[10px] text-neutral-500 font-mono mt-1">
                        Trigger: {t.trigger}
                      </p>
                    </div>

                    {/* Action */}
                    <button
                      onClick={() => {
                        setConfigModal(t);
                        setConfigUrl(t.savedWebhookUrl ?? "");
                        setConfigMessage(null);
                      }}
                      className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-widest transition-all shrink-0 ${
                        t.active
                          ? "bg-white/5 text-neutral-400 border border-white/10 hover:bg-white/10"
                          : "bg-gradient-to-r from-[#00B7FF] to-blue-600 text-white hover:shadow-[0_0_20px_rgba(0,183,255,0.3)]"
                      }`}
                    >
                      {t.active ? "Edit" : "Configure"}
                    </button>
                  </motion.div>
                ))}

                {templates.length === 0 && (
                  <div className="text-center py-16 text-neutral-500">
                    No templates available.
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ──────── Configure Modal ──────── */}
      <AnimatePresence>
        {configModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setConfigModal(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="w-full max-w-lg rounded-2xl border border-white/10 bg-[#0a0a0a] p-6 shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal header */}
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{
                      backgroundColor: `${platformColor(configModal.platform)}20`,
                      color: platformColor(configModal.platform),
                    }}
                  >
                    {platformIcon(configModal.platform)}
                  </div>
                  <div>
                    <h2 className="text-white font-bold text-lg">
                      {configModal.name}
                    </h2>
                    <p className="text-xs text-neutral-500">
                      {configModal.platform} integration
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setConfigModal(null)}
                  className="p-2 rounded-lg hover:bg-white/10 text-neutral-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Description */}
              <p className="text-sm text-neutral-400 mb-5">
                {configModal.description}
              </p>

              {/* Webhook URL input */}
              <label className="block text-xs font-bold text-white uppercase tracking-widest mb-2">
                Webhook URL
              </label>
              <input
                type="url"
                value={configUrl}
                onChange={(e) => setConfigUrl(e.target.value)}
                placeholder={
                  configModal.platform === "Zapier"
                    ? "https://hooks.zapier.com/hooks/catch/..."
                    : configModal.platform === "Make"
                      ? "https://hook.make.com/..."
                      : "https://your-endpoint.com/webhook"
                }
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-neutral-500 focus:outline-none focus:border-[#00B7FF]/50 font-mono text-sm transition-colors mb-5"
              />

              {/* Payload preview */}
              <div className="mb-5">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-white uppercase tracking-widest">
                    Payload Preview
                  </label>
                  <button
                    onClick={() => copyPayload(configModal.payload)}
                    className="flex items-center gap-1 text-[10px] text-neutral-500 hover:text-[#00B7FF] transition-colors"
                  >
                    {copied ? <CheckCircle2 className="w-3 h-3 text-[#00B7FF]" /> : <Copy className="w-3 h-3" />} {copied ? "Copied" : "Copy"}
                  </button>
                </div>
                <pre className="bg-white/5 border border-white/5 rounded-xl p-4 text-xs text-neutral-400 font-mono overflow-x-auto">
                  {JSON.stringify(configModal.payload, null, 2)}
                </pre>
              </div>

              {/* Trigger info */}
              <div className="flex items-center gap-2 text-xs text-neutral-500 mb-5">
                <ExternalLink className="w-3 h-3" />
                <span className="font-mono">{configModal.trigger}</span>
              </div>

              {/* Message */}
              <AnimatePresence>
                {configMessage && (
                  <motion.div
                    initial={{ opacity: 0, y: -8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    className={`p-3 rounded-xl flex items-center gap-2 text-xs font-medium mb-4 ${
                      configMessage.type === "success"
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                        : "bg-red-500/10 text-red-400 border border-red-500/20"
                    }`}
                  >
                    {configMessage.type === "success" ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <ShieldAlert className="w-4 h-4" />
                    )}
                    {configMessage.text}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Actions */}
              <div className="flex gap-3 justify-end">
                <button
                  onClick={() => setConfigModal(null)}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold text-neutral-500 bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleConfigSave}
                  disabled={configSaving || !configUrl}
                  className="px-6 py-2.5 rounded-xl text-sm font-bold text-white bg-gradient-to-r from-[#00B7FF] to-blue-600 hover:shadow-[0_0_30px_rgba(0,183,255,0.3)] transition-all flex items-center gap-2 disabled:opacity-50"
                >
                  {configSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" /> Save & Activate
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
