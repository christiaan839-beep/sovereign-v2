"use client";

import { motion } from "framer-motion";
import { X, Copy, ExternalLink, Code2, Image as ImageIcon, Globe } from "lucide-react";
import { useState } from "react";

interface PreviewPanelProps {
  content: { type: string; content: string };
  onClose: () => void;
}

export function PreviewPanel({ content, onClose }: PreviewPanelProps) {
  const [copied, setCopied] = useState(false);

  const copyContent = () => {
    navigator.clipboard.writeText(content.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const typeIcon = content.type === "html" ? Globe : content.type === "image" ? ImageIcon : Code2;
  const TypeIcon = typeIcon;
  const typeLabel = content.type === "html" ? "Live Preview" : content.type === "image" ? "Generated Image" : "Code Output";

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
          <button onClick={copyContent} className="p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors" title="Copy">
            <Copy className="w-3.5 h-3.5 text-neutral-500" />
          </button>
          {copied && <span className="text-[9px] text-emerald-400">Copied</span>}
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/[0.05] transition-colors" title="Close">
            <X className="w-3.5 h-3.5 text-neutral-500" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {content.type === "html" && (
          <iframe
            srcDoc={content.content}
            className="w-full h-full border-0"
            sandbox="allow-scripts allow-same-origin"
            title="Preview"
          />
        )}

        {content.type === "image" && (
          <div className="flex items-center justify-center p-6 h-full">
            <img src={content.content} alt="Generated" className="max-w-full max-h-full rounded-lg object-contain" />
          </div>
        )}

        {content.type === "code" && (
          <pre className="p-4 text-xs text-neutral-300 font-mono leading-relaxed overflow-auto whitespace-pre-wrap">
            {content.content}
          </pre>
        )}
      </div>
    </motion.div>
  );
}
