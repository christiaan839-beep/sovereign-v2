"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Copy,
  Check,
  ExternalLink,
  Download,
  Code2,
  Image as ImageIcon,
  Globe,
  ChevronDown,
  Mail,
  FileText,
  Clipboard,
} from "lucide-react";
import type { PreviewContent } from "@/components/chat/types";
import { useFocusTrap } from "@/hooks/useFocusTrap";

// ── Toast ──

function Toast({ message, onDone }: { message: string; onDone: () => void }) {
  useEffect(() => {
    const t = setTimeout(onDone, 2500);
    return () => clearTimeout(t);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 16 }}
      className="fixed bottom-6 right-6 z-[100] px-4 py-2 rounded-xl bg-emerald-500/20 border border-emerald-500/30 backdrop-blur-xl text-emerald-300 text-xs font-medium shadow-lg"
    >
      {message}
    </motion.div>
  );
}

// ── Email Modal ──

function EmailModal({
  subject,
  onSend,
  onClose,
}: {
  subject: string;
  onSend: (to: string, subject: string) => void;
  onClose: () => void;
}) {
  const [to, setTo] = useState("");
  const [subj, setSubj] = useState(subject);
  const [sending, setSending] = useState(false);
  const trapRef = useFocusTrap<HTMLDivElement>(true);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleSend = async () => {
    if (!to.trim()) return;
    setSending(true);
    await onSend(to.trim(), subj.trim());
    setSending(false);
    onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        ref={trapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="email-modal-title"
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-[#0c0c0c] border border-white/[0.08] rounded-2xl p-5 w-[380px] space-y-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="email-modal-title" className="text-sm font-semibold text-neutral-200">Send via Email</h3>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1 block">To</label>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="recipient@example.com"
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-neutral-200 placeholder:text-neutral-600 outline-none focus:border-emerald-500/40 transition-colors"
              autoFocus
            />
          </div>
          <div>
            <label className="text-[10px] uppercase tracking-widest text-neutral-500 mb-1 block">Subject</label>
            <input
              type="text"
              value={subj}
              onChange={(e) => setSubj(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-white/[0.04] border border-white/[0.08] text-sm text-neutral-200 outline-none focus:border-emerald-500/40 transition-colors"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded-lg text-xs text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.05] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={!to.trim() || sending}
            className="px-4 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sending ? "Sending..." : "Send"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ── Publish Dropdown ──

function PublishDropdown({ content, type }: { content: string; type: PreviewContent["type"] }) {
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const htmlToMarkdown = (html: string): string => {
    let md = html;
    md = md.replace(/<h1[^>]*>(.*?)<\/h1>/gi, "# $1\n\n");
    md = md.replace(/<h2[^>]*>(.*?)<\/h2>/gi, "## $1\n\n");
    md = md.replace(/<h3[^>]*>(.*?)<\/h3>/gi, "### $1\n\n");
    md = md.replace(/<p[^>]*>(.*?)<\/p>/gi, "$1\n\n");
    md = md.replace(/<strong[^>]*>(.*?)<\/strong>/gi, "**$1**");
    md = md.replace(/<b[^>]*>(.*?)<\/b>/gi, "**$1**");
    md = md.replace(/<em[^>]*>(.*?)<\/em>/gi, "*$1*");
    md = md.replace(/<i[^>]*>(.*?)<\/i>/gi, "*$1*");
    md = md.replace(/<a[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>/gi, "[$2]($1)");
    md = md.replace(/<li[^>]*>(.*?)<\/li>/gi, "- $1\n");
    md = md.replace(/<br\s*\/?>/gi, "\n");
    md = md.replace(/<[^>]+>/g, "");
    md = md.replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'");
    md = md.replace(/\n{3,}/g, "\n\n").trim();
    return md;
  };

  const copyAsMarkdown = () => {
    const markdown = type === "html" ? htmlToMarkdown(content) : content;
    navigator.clipboard.writeText(markdown);
    setToast("Copied as Markdown");
    setOpen(false);
  };

  const downloadAsHtml = () => {
    const blob = new Blob([content], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "artifact.html";
    a.click();
    URL.revokeObjectURL(url);
    setToast("Downloaded as HTML");
    setOpen(false);
  };

  const downloadAsText = () => {
    const text = type === "html" ? htmlToMarkdown(content) : content;
    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "artifact.txt";
    a.click();
    URL.revokeObjectURL(url);
    setToast("Downloaded as Text");
    setOpen(false);
  };

  const handleEmailSend = async (to: string, subject: string) => {
    try {
      await fetch("/api/email/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, body: content }),
      });
      setToast("Email sent");
    } catch {
      setToast("Failed to send email");
    }
  };

  const actions = [
    { label: "Copy as Markdown", icon: Clipboard, onClick: copyAsMarkdown },
    { label: "Send via Email", icon: Mail, onClick: () => { setEmailOpen(true); setOpen(false); } },
    { label: "Download as HTML", icon: Download, onClick: downloadAsHtml },
    { label: "Download as Text", icon: FileText, onClick: downloadAsText },
  ];

  return (
    <>
      <div ref={dropdownRef} className="relative">
        <button
          onClick={() => setOpen(!open)}
          className="flex items-center gap-1 px-2 py-1.5 rounded-lg hover:bg-white/[0.05] transition-colors text-neutral-500 hover:text-neutral-300"
          title="Publish"
        >
          <span className="text-[10px] font-medium">Publish</span>
          <ChevronDown className="w-3 h-3" />
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.96 }}
              transition={{ duration: 0.12 }}
              className="absolute right-0 top-full mt-1 w-48 rounded-xl border border-white/[0.08] bg-[#0c0c0c]/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden"
            >
              {actions.map((action) => {
                const Icon = action.icon;
                return (
                  <button
                    key={action.label}
                    onClick={action.onClick}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-neutral-400 hover:text-neutral-200 hover:bg-white/[0.05] transition-colors"
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {action.label}
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {emailOpen && (
          <EmailModal
            subject="Sovereign Artifact"
            onSend={handleEmailSend}
            onClose={() => setEmailOpen(false)}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toast && <Toast message={toast} onDone={() => setToast(null)} />}
      </AnimatePresence>
    </>
  );
}

// ── Artifact Panel ──

interface ArtifactPanelProps {
  artifacts: PreviewContent[];
  onClose: () => void;
}

export function ArtifactPanel({ artifacts, onClose }: ArtifactPanelProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [copied, setCopied] = useState(false);

  if (artifacts.length === 0) return null;
  const current = artifacts[activeIndex] || artifacts[0];

  const copyContent = () => {
    navigator.clipboard.writeText(current.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const openInNewTab = () => {
    if (current.type === "html") {
      const blob = new Blob([current.content], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
    }
  };

  const downloadArtifact = () => {
    const ext = current.type === "html" ? "html" : current.type === "code" ? "txt" : "txt";
    const blob = new Blob([current.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `artifact.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const typeIcon = current.type === "html" ? Globe : current.type === "image" ? ImageIcon : Code2;
  const TypeIcon = typeIcon;
  const typeLabel = current.type === "html" ? "Live Preview" : current.type === "image" ? "Generated Image" : "Code Output";

  return (
    <motion.div
      initial={{ x: "100%", opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: "100%", opacity: 0 }}
      transition={{ type: "spring", damping: 25, stiffness: 200 }}
      className="h-full flex flex-col border-l border-white/[0.06] bg-[#080808]"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/[0.06]">
        <div className="flex items-center gap-2">
          <TypeIcon className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-xs font-medium text-neutral-300">{typeLabel}</span>
        </div>
        <div className="flex items-center gap-1">
          <PublishDropdown content={current.content} type={current.type} />
          <button onClick={copyContent} className="p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors" title="Copy">
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-neutral-500" />}
          </button>
          {current.type === "html" && (
            <button onClick={openInNewTab} className="p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors" title="Open in new tab">
              <ExternalLink className="w-3.5 h-3.5 text-neutral-500" />
            </button>
          )}
          {current.type !== "image" && (
            <button onClick={downloadArtifact} className="p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors" title="Download">
              <Download className="w-3.5 h-3.5 text-neutral-500" />
            </button>
          )}
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors" title="Close">
            <X className="w-3.5 h-3.5 text-neutral-500" />
          </button>
        </div>
      </div>

      {/* Tabs (when multiple artifacts) */}
      {artifacts.length > 1 && (
        <div className="flex items-center gap-1 px-4 py-2 border-b border-white/[0.04] overflow-x-auto scrollbar-hide">
          {artifacts.map((a, i) => (
            <button
              key={i}
              onClick={() => setActiveIndex(i)}
              className={`px-3 py-1 rounded-lg text-[10px] font-medium whitespace-nowrap transition-gpu ${
                i === activeIndex
                  ? "bg-white/[0.06] text-white border border-white/[0.08]"
                  : "text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.03]"
              }`}
            >
              {a.label || `${a.type} ${i + 1}`}
            </button>
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {current.type === "html" && (
          <iframe srcDoc={current.content} className="w-full h-full border-0" sandbox="allow-scripts allow-same-origin" title="Preview" />
        )}
        {current.type === "image" && (
          <div className="flex items-center justify-center p-6 h-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current.content} alt="Generated" loading="lazy" className="max-w-full max-h-full rounded-lg object-contain" />
          </div>
        )}
        {current.type === "code" && (
          <pre className="p-4 text-xs text-neutral-300 font-mono leading-relaxed overflow-auto whitespace-pre-wrap">{current.content}</pre>
        )}
      </div>
    </motion.div>
  );
}
