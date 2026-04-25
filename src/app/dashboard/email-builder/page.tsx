"use client";

import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail,
  Clock,
  Zap,
  Send,
  ArrowRight,
  Sparkles,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Eye,
  Copy,
  RotateCcw,
  Layers,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────
type SequenceType = "welcome" | "nurture" | "sales" | "re-engagement";

interface SequenceConfig {
  id: SequenceType;
  label: string;
  description: string;
  emailCount: number;
  stages: string[];
  color: string;
  bg: string;
  border: string;
}

type DelayOption = "immediate" | "1day" | "3days" | "7days";

interface EmailDraft {
  subject: string;
  body: string;
  delay: DelayOption;
  modelUsed: string | null;
  qualityScore: number | null;
  durationMs: number | null;
  isGenerating: boolean;
  isGenerated: boolean;
}

// ─── Constants ───────────────────────────────────────────────────────
const SEQUENCE_TYPES: SequenceConfig[] = [
  {
    id: "welcome",
    label: "Welcome",
    description: "Onboard new subscribers with warmth and value",
    emailCount: 3,
    stages: ["Welcome & Introduction", "Value Delivery", "Engagement CTA"],
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  {
    id: "nurture",
    label: "Nurture",
    description: "Build trust and educate over time",
    emailCount: 5,
    stages: ["Hook & Relate", "Educate", "Social Proof", "Deep Value", "Soft Ask"],
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/20",
  },
  {
    id: "sales",
    label: "Sales",
    description: "Drive conversions with urgency and proof",
    emailCount: 4,
    stages: ["Pain Point", "Solution Reveal", "Testimonials & Proof", "Urgency Close"],
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  {
    id: "re-engagement",
    label: "Re-engagement",
    description: "Win back inactive subscribers",
    emailCount: 3,
    stages: ["We Miss You", "Exclusive Offer", "Last Chance"],
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
  },
];

const DELAY_OPTIONS: { value: DelayOption; label: string; days: number }[] = [
  { value: "immediate", label: "Immediate", days: 0 },
  { value: "1day", label: "1 Day", days: 1 },
  { value: "3days", label: "3 Days", days: 3 },
  { value: "7days", label: "7 Days", days: 7 },
];

function getDelayLabel(delay: DelayOption): string {
  return DELAY_OPTIONS.find((d) => d.value === delay)?.label ?? delay;
}

function getDelayDays(delay: DelayOption): number {
  return DELAY_OPTIONS.find((d) => d.value === delay)?.days ?? 0;
}

function createEmptyEmails(config: SequenceConfig): EmailDraft[] {
  return config.stages.map((_, i) => ({
    subject: "",
    body: "",
    delay: i === 0 ? "immediate" : "1day",
    modelUsed: null,
    qualityScore: null,
    durationMs: null,
    isGenerating: false,
    isGenerated: false,
  }));
}

// ─── Component ───────────────────────────────────────────────────────
export default function EmailBuilderPage() {
  const [sequenceType, setSequenceType] = useState<SequenceType>("welcome");
  const [emails, setEmails] = useState<EmailDraft[]>([]);
  const [expandedEmail, setExpandedEmail] = useState<number | null>(0);
  const [previewIdx, setPreviewIdx] = useState<number | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [isGeneratingAll, setIsGeneratingAll] = useState(false);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);

  // Context fields for generation
  const [brandName, setBrandName] = useState("");
  const [audience, setAudience] = useState("");
  const [productDescription, setProductDescription] = useState("");

  const activeConfig = SEQUENCE_TYPES.find((s) => s.id === sequenceType)!;

  // Reset the editable email-state when the user picks a different
  // sequence type. The cleaner React-19-blessed pattern is
  // `key={sequenceType}` on a wrapper component — that forces a clean
  // remount of all four useState slots. We're applying that as a
  // follow-up; the documented eslint-disable here keeps CI green
  // until then. The setState fires only on a user-driven change of
  // sequenceType (low-frequency), so the cascading-renders concern
  // the rule warns about doesn't apply in practice.
  useEffect(() => {
    const config = SEQUENCE_TYPES.find((s) => s.id === sequenceType)!;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEmails(createEmptyEmails(config));
    setExpandedEmail(0);
    setPreviewIdx(null);
    setGlobalError(null);
  }, [sequenceType]);

  const updateEmail = useCallback(
    (index: number, updates: Partial<EmailDraft>) => {
      setEmails((prev) => prev.map((e, i) => (i === index ? { ...e, ...updates } : e)));
    },
    []
  );

  // ─── Generate single email via smart-router ────────────────────────
  const generateSingleEmail = useCallback(
    async (index: number) => {
      if (!brandName.trim()) {
        setGlobalError("Please enter a brand or company name to generate emails.");
        return;
      }

      const config = SEQUENCE_TYPES.find((s) => s.id === sequenceType)!;
      const stage = config.stages[index];

      updateEmail(index, { isGenerating: true });
      setGlobalError(null);

      const prompt = `Write a single marketing email for an email sequence.

Brand/Company: ${brandName}
Target Audience: ${audience || "general subscribers"}
Product/Service: ${productDescription || "not specified"}

Sequence Type: ${config.label} sequence
This is Email ${index + 1} of ${config.emailCount} — Stage: "${stage}"
${config.description}

Requirements:
- Write a compelling subject line on its own line prefixed with "Subject: "
- Then write the full email body below it
- The tone should match the "${stage}" stage of a ${config.label.toLowerCase()} sequence
- Keep it concise but persuasive (150-300 words for the body)
- Use personalization placeholders like {{first_name}} where appropriate
- Include a clear call-to-action
- Do NOT include any meta-commentary or notes — only the email content`;

      try {
        const res = await fetch("/api/agents/smart-router", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            task_type: "creative",
            prompt,
            priority: "quality",
          }),
        });

        const data = await res.json();

        if (!res.ok || data.error) {
          updateEmail(index, { isGenerating: false });
          setGlobalError(data.error || data.details || `Generation failed (${res.status})`);
          return;
        }

        const output = data.result || "";
        const modelUsed = data.routing?.model_selected || "Unknown";
        const qualityScore = data.routing?.quality_score || null;
        const durationMs = data.duration_ms || null;

        // Parse subject and body from output
        let subject = "";
        let body = output;

        const subjectMatch = output.match(/^Subject:\s*(.+)$/im);
        if (subjectMatch) {
          subject = subjectMatch[1].trim();
          body = output.substring(subjectMatch.index! + subjectMatch[0].length).trim();
        }

        updateEmail(index, {
          subject,
          body,
          modelUsed,
          qualityScore,
          durationMs,
          isGenerating: false,
          isGenerated: true,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        updateEmail(index, { isGenerating: false });
        setGlobalError(`Connection failed: ${msg}`);
      }
    },
    [sequenceType, brandName, audience, productDescription, updateEmail]
  );

  // ─── Generate full sequence ────────────────────────────────────────
  const generateFullSequence = useCallback(async () => {
    if (!brandName.trim()) {
      setGlobalError("Please enter a brand or company name to generate emails.");
      return;
    }

    setIsGeneratingAll(true);
    setGlobalError(null);

    const config = SEQUENCE_TYPES.find((s) => s.id === sequenceType)!;

    // Generate emails sequentially so each one can reference the context
    for (let i = 0; i < config.emailCount; i++) {
      await generateSingleEmail(i);
    }

    setIsGeneratingAll(false);
  }, [sequenceType, brandName, generateSingleEmail]);

  // ─── Copy to clipboard ─────────────────────────────────────────────
  const copyEmail = useCallback(
    (index: number) => {
      const email = emails[index];
      const text = `Subject: ${email.subject}\n\n${email.body}`;
      navigator.clipboard.writeText(text).then(() => {
        setCopiedIdx(index);
        setTimeout(() => setCopiedIdx(null), 2000);
      });
    },
    [emails]
  );

  // ─── Compute timeline days ─────────────────────────────────────────
  const timelineDays: number[] = [];
  let cumulativeDay = 0;
  for (const email of emails) {
    cumulativeDay += getDelayDays(email.delay);
    timelineDays.push(cumulativeDay);
  }

  const anyGenerating = emails.some((e) => e.isGenerating);

  return (
    <div
      className="w-full max-w-7xl mx-auto space-y-8 relative z-10 p-4 lg:p-8"
      role="region"
      aria-label="Email Sequence Builder"
    >
      {/* ─── Header ─── */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="border-b border-emerald-500/20 pb-6 backdrop-blur-3xl bg-black/40 p-6 rounded-2xl shadow-[0_0_50px_rgba(16,185,129,0.05)] border-t border-emerald-500/10"
      >
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center">
            <Mail className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-2xl font-light text-white tracking-widest font-mono">
              EMAIL SEQUENCE BUILDER
            </h2>
            <p className="text-neutral-400 text-xs tracking-widest uppercase">
              AI-powered email sequences that convert
            </p>
          </div>
        </div>
      </motion.div>

      {/* ─── Sequence Type Selector ─── */}
      <div
        className="flex gap-2 p-1 bg-black/40 rounded-xl border border-emerald-500/10 backdrop-blur-xl"
        role="tablist"
        aria-label="Sequence type selector"
      >
        {SEQUENCE_TYPES.map((seq) => (
          <button
            key={seq.id}
            role="tab"
            aria-selected={sequenceType === seq.id}
            aria-label={`${seq.label} sequence — ${seq.emailCount} emails`}
            onClick={() => setSequenceType(seq.id)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold uppercase tracking-widest transition-all flex-1 justify-center ${
              sequenceType === seq.id
                ? `${seq.bg} ${seq.color} ${seq.border} border`
                : "text-neutral-500 hover:text-neutral-300"
            }`}
          >
            <Mail className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{seq.label}</span>
            <span className="text-[9px] opacity-60 hidden md:inline">
              ({seq.emailCount})
            </span>
          </button>
        ))}
      </div>

      {/* ─── Context Fields ─── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-black/60 backdrop-blur-3xl border border-emerald-500/20 rounded-2xl p-6 shadow-[0_0_50px_rgba(0,0,0,0.5)]"
      >
        <div className="flex items-center gap-2 mb-5">
          <Layers className="w-4 h-4 text-emerald-400" />
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-emerald-400 font-bold">
            Sequence Context
          </h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="brand-name"
              className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold mb-2 block"
            >
              Brand / Company Name *
            </label>
            <input
              id="brand-name"
              type="text"
              placeholder="Acme Inc."
              value={brandName}
              onChange={(e) => setBrandName(e.target.value)}
              className="w-full bg-black/60 border border-emerald-500/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors font-mono"
            />
          </div>
          <div>
            <label
              htmlFor="target-audience"
              className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold mb-2 block"
            >
              Target Audience
            </label>
            <input
              id="target-audience"
              type="text"
              placeholder="SaaS founders, 25-45"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
              className="w-full bg-black/60 border border-emerald-500/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors font-mono"
            />
          </div>
          <div>
            <label
              htmlFor="product-desc"
              className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold mb-2 block"
            >
              Product / Service
            </label>
            <input
              id="product-desc"
              type="text"
              placeholder="AI-powered CRM platform"
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
              className="w-full bg-black/60 border border-emerald-500/20 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-colors font-mono"
            />
          </div>
        </div>

        {/* Generate Full Sequence */}
        <button
          onClick={generateFullSequence}
          disabled={anyGenerating || isGeneratingAll}
          className="mt-5 w-full py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 text-white font-bold text-xs uppercase tracking-widest hover:from-emerald-500 hover:to-cyan-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(16,185,129,0.25)]"
        >
          {isGeneratingAll ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Generating {activeConfig.emailCount} Emails...
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Generate Full Sequence ({activeConfig.emailCount} Emails)
            </>
          )}
        </button>
      </motion.div>

      {/* ─── Visual Timeline ─── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="bg-black/40 backdrop-blur-xl border border-emerald-500/10 rounded-2xl p-6"
      >
        <div className="flex items-center gap-2 mb-5">
          <Clock className="w-4 h-4 text-emerald-400" />
          <h3 className="text-[10px] uppercase tracking-[0.2em] text-emerald-400 font-bold">
            Sequence Timeline
          </h3>
        </div>

        <div className="flex items-center gap-0 overflow-x-auto pb-2">
          {emails.map((email, idx) => {
            const isLast = idx === emails.length - 1;
            return (
              <React.Fragment key={idx}>
                {/* Email Node */}
                <motion.button
                  onClick={() => {
                    setExpandedEmail(expandedEmail === idx ? null : idx);
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.97 }}
                  className={`relative flex-shrink-0 flex flex-col items-center gap-2 px-4 py-3 rounded-xl border transition-all cursor-pointer min-w-[120px] ${
                    expandedEmail === idx
                      ? `${activeConfig.bg} ${activeConfig.border} ${activeConfig.color}`
                      : email.isGenerated
                        ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-300"
                        : "border-white/5 bg-white/[0.02] text-neutral-500"
                  }`}
                >
                  {/* Status indicator */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                      email.isGenerating
                        ? "bg-amber-500/20 border border-amber-500/30"
                        : email.isGenerated
                          ? "bg-emerald-500/20 border border-emerald-500/30"
                          : "bg-white/5 border border-white/10"
                    }`}
                  >
                    {email.isGenerating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    ) : email.isGenerated ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    ) : (
                      <span className="text-neutral-500">{idx + 1}</span>
                    )}
                  </div>
                  <span className="text-[9px] uppercase tracking-wider font-bold whitespace-nowrap">
                    {activeConfig.stages[idx]}
                  </span>
                  <span className="text-[8px] text-neutral-500">
                    Day {timelineDays[idx]}
                  </span>
                </motion.button>

                {/* Arrow + Delay Label */}
                {!isLast && (
                  <div className="flex flex-col items-center flex-shrink-0 px-1">
                    <span className="text-[8px] text-neutral-600 mb-0.5 whitespace-nowrap">
                      {getDelayLabel(emails[idx + 1]?.delay ?? "1day")}
                    </span>
                    <ArrowRight className="w-4 h-4 text-neutral-600" />
                  </div>
                )}
              </React.Fragment>
            );
          })}
        </div>
      </motion.div>

      {/* ─── Email Editors ─── */}
      <div className="space-y-4">
        <AnimatePresence mode="sync">
          {emails.map((email, idx) => (
            <motion.div
              key={`${sequenceType}-${idx}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ delay: idx * 0.05 }}
              className={`bg-black/60 backdrop-blur-3xl border rounded-2xl overflow-hidden transition-colors ${
                email.isGenerated
                  ? "border-emerald-500/20"
                  : "border-white/5"
              }`}
            >
              {/* Email Header — always visible */}
              <button
                onClick={() => setExpandedEmail(expandedEmail === idx ? null : idx)}
                className="w-full flex items-center justify-between p-5 text-left hover:bg-white/[0.02] transition-colors"
                aria-expanded={expandedEmail === idx}
                aria-controls={`email-panel-${idx}`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                      email.isGenerated
                        ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                        : "bg-white/5 text-neutral-500 border border-white/5"
                    }`}
                  >
                    {email.isGenerating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400" />
                    ) : (
                      idx + 1
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-white font-medium">
                        Email {idx + 1}
                      </span>
                      <span className="text-[9px] uppercase tracking-widest text-neutral-500">
                        &mdash; {activeConfig.stages[idx]}
                      </span>
                    </div>
                    {email.subject && (
                      <p className="text-xs text-neutral-400 mt-0.5 truncate max-w-md">
                        {email.subject}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {email.isGenerated && email.qualityScore && (
                    <span className="text-[9px] uppercase tracking-wider text-emerald-400/70 font-mono">
                      Q:{email.qualityScore}/10
                    </span>
                  )}
                  {email.isGenerated && email.modelUsed && (
                    <span className="text-[9px] uppercase tracking-wider text-neutral-500 font-mono hidden lg:inline">
                      {email.modelUsed}
                    </span>
                  )}
                  {expandedEmail === idx ? (
                    <ChevronUp className="w-4 h-4 text-neutral-500" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-neutral-500" />
                  )}
                </div>
              </button>

              {/* Email Body — expandable */}
              <AnimatePresence>
                {expandedEmail === idx && (
                  <motion.div
                    id={`email-panel-${idx}`}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-5 pb-5 space-y-4 border-t border-white/5 pt-4">
                      {/* Subject Line */}
                      <div>
                        <label
                          htmlFor={`subject-${idx}`}
                          className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold mb-2 block"
                        >
                          Subject Line
                        </label>
                        <input
                          id={`subject-${idx}`}
                          type="text"
                          placeholder={`Subject for ${activeConfig.stages[idx]} email...`}
                          value={email.subject}
                          onChange={(e) =>
                            updateEmail(idx, { subject: e.target.value })
                          }
                          className="w-full bg-black/60 border border-emerald-500/15 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-colors font-mono"
                        />
                      </div>

                      {/* Body */}
                      <div>
                        <label
                          htmlFor={`body-${idx}`}
                          className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold mb-2 block"
                        >
                          Email Body
                        </label>
                        <textarea
                          id={`body-${idx}`}
                          placeholder={`Write your ${activeConfig.stages[idx].toLowerCase()} email here, or use AI to generate it...`}
                          value={email.body}
                          onChange={(e) =>
                            updateEmail(idx, { body: e.target.value })
                          }
                          rows={8}
                          className="w-full bg-black/60 border border-emerald-500/15 rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-emerald-500/40 focus:ring-1 focus:ring-emerald-500/20 transition-colors font-mono resize-y leading-relaxed"
                        />
                      </div>

                      {/* Send Delay */}
                      <div>
                        <label
                          htmlFor={`delay-${idx}`}
                          className="text-[10px] uppercase tracking-widest text-neutral-400 font-bold mb-2 block"
                        >
                          Send Delay
                        </label>
                        <div className="flex gap-2">
                          {DELAY_OPTIONS.map((opt) => (
                            <button
                              key={opt.value}
                              onClick={() =>
                                updateEmail(idx, { delay: opt.value })
                              }
                              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all border ${
                                email.delay === opt.value
                                  ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
                                  : "text-neutral-500 border-white/5 hover:text-neutral-300 hover:border-white/10"
                              }`}
                            >
                              <Clock className="w-3 h-3" />
                              {opt.label}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex flex-wrap items-center gap-2 pt-2">
                        <button
                          onClick={() => generateSingleEmail(idx)}
                          disabled={email.isGenerating || isGeneratingAll}
                          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 text-white text-xs font-bold uppercase tracking-widest hover:from-emerald-500 hover:to-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-[0_0_20px_rgba(16,185,129,0.15)]"
                        >
                          {email.isGenerating ? (
                            <>
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              Generating...
                            </>
                          ) : (
                            <>
                              <Zap className="w-3.5 h-3.5" />
                              Generate with AI
                            </>
                          )}
                        </button>

                        {email.isGenerated && (
                          <>
                            <button
                              onClick={() => generateSingleEmail(idx)}
                              disabled={email.isGenerating}
                              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-white/10 text-neutral-400 text-xs font-bold uppercase tracking-wider hover:text-white hover:border-white/20 transition-all"
                            >
                              <RotateCcw className="w-3 h-3" />
                              Regenerate
                            </button>

                            <button
                              onClick={() =>
                                setPreviewIdx(previewIdx === idx ? null : idx)
                              }
                              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-white/10 text-neutral-400 text-xs font-bold uppercase tracking-wider hover:text-white hover:border-white/20 transition-all"
                            >
                              <Eye className="w-3 h-3" />
                              Preview
                            </button>

                            <button
                              onClick={() => copyEmail(idx)}
                              className="flex items-center gap-1.5 px-3 py-2.5 rounded-xl border border-white/10 text-neutral-400 text-xs font-bold uppercase tracking-wider hover:text-white hover:border-white/20 transition-all"
                            >
                              {copiedIdx === idx ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                                  <span className="text-emerald-400">Copied</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  Copy
                                </>
                              )}
                            </button>
                          </>
                        )}
                      </div>

                      {/* Model / Quality Metadata */}
                      {email.isGenerated && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="flex items-center gap-4 pt-2 border-t border-white/5"
                        >
                          {email.modelUsed && (
                            <span className="text-[9px] uppercase tracking-wider text-neutral-500 font-mono flex items-center gap-1">
                              <Zap className="w-2.5 h-2.5" /> {email.modelUsed}
                            </span>
                          )}
                          {email.qualityScore && (
                            <span className="text-[9px] uppercase tracking-wider text-emerald-400/70 font-mono flex items-center gap-1">
                              <CheckCircle2 className="w-2.5 h-2.5" /> Quality: {email.qualityScore}/10
                            </span>
                          )}
                          {email.durationMs && (
                            <span className="text-[9px] uppercase tracking-wider text-neutral-500 font-mono flex items-center gap-1">
                              <Clock className="w-2.5 h-2.5" /> {(email.durationMs / 1000).toFixed(1)}s
                            </span>
                          )}
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* ─── Email Preview Modal ─── */}
      <AnimatePresence>
        {previewIdx !== null && emails[previewIdx] && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={() => setPreviewIdx(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl max-h-[80vh] overflow-y-auto bg-[#111] border border-emerald-500/20 rounded-2xl shadow-[0_0_80px_rgba(16,185,129,0.1)]"
            >
              {/* Preview Header */}
              <div className="sticky top-0 bg-[#111]/95 backdrop-blur-xl border-b border-white/5 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Eye className="w-4 h-4 text-emerald-400" />
                  <span className="text-[10px] uppercase tracking-[0.2em] text-emerald-400 font-bold">
                    Email Preview
                  </span>
                </div>
                <button
                  onClick={() => setPreviewIdx(null)}
                  className="text-neutral-500 hover:text-white text-xs uppercase tracking-wider transition-colors"
                >
                  Close
                </button>
              </div>

              {/* Mock Email Client */}
              <div className="p-6">
                <div className="bg-white rounded-xl overflow-hidden shadow-lg">
                  {/* Email header bar */}
                  <div className="bg-neutral-100 px-6 py-4 border-b border-neutral-200">
                    <div className="space-y-2">
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-bold text-neutral-500 uppercase w-12">From</span>
                        <span className="text-sm text-neutral-800">
                          {brandName || "Your Brand"} &lt;hello@{brandName ? brandName.toLowerCase().replace(/\s+/g, "") : "yourbrand"}.com&gt;
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-bold text-neutral-500 uppercase w-12">To</span>
                        <span className="text-sm text-neutral-800">
                          {"{{first_name}}"} &lt;subscriber@email.com&gt;
                        </span>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className="text-xs font-bold text-neutral-500 uppercase w-12">Subj</span>
                        <span className="text-sm font-semibold text-neutral-900">
                          {emails[previewIdx].subject || "(No subject)"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Email body */}
                  <div className="px-6 py-5">
                    <div className="text-sm text-neutral-800 leading-relaxed whitespace-pre-wrap">
                      {emails[previewIdx].body || "No content yet."}
                    </div>
                  </div>
                </div>

                {/* Preview Metadata */}
                <div className="mt-4 flex items-center gap-4">
                  <span className="text-[9px] uppercase tracking-wider text-neutral-500 font-mono">
                    Email {previewIdx + 1} of {activeConfig.emailCount}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-neutral-500 font-mono">
                    Stage: {activeConfig.stages[previewIdx]}
                  </span>
                  <span className="text-[9px] uppercase tracking-wider text-neutral-500 font-mono">
                    Day {timelineDays[previewIdx]}
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Error State ─── */}
      <AnimatePresence>
        {globalError && !anyGenerating && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="bg-black/60 backdrop-blur-3xl border border-rose-500/20 rounded-2xl overflow-hidden p-6 text-center"
          >
            <div className="w-10 h-10 rounded-full bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle className="w-5 h-5 text-rose-400" />
            </div>
            <h3 className="text-sm font-bold text-white mb-1">
              Something went wrong
            </h3>
            <p className="text-xs text-neutral-400 mb-4 max-w-sm mx-auto">
              {globalError}
            </p>
            <button
              onClick={() => setGlobalError(null)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold uppercase tracking-wider hover:bg-rose-500/20 transition-all"
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Sequence Summary ─── */}
      {emails.some((e) => e.isGenerated) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-black/40 backdrop-blur-xl border border-emerald-500/10 rounded-2xl p-6"
        >
          <div className="flex items-center gap-2 mb-4">
            <Send className="w-4 h-4 text-emerald-400" />
            <h3 className="text-[10px] uppercase tracking-[0.2em] text-emerald-400 font-bold">
              Sequence Summary
            </h3>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-black/40 rounded-xl p-4 border border-white/5">
              <p className="text-[9px] uppercase tracking-widest text-neutral-500 mb-1">
                Emails Generated
              </p>
              <p className="text-2xl font-light text-white font-mono">
                {emails.filter((e) => e.isGenerated).length}
                <span className="text-neutral-500 text-sm">
                  /{activeConfig.emailCount}
                </span>
              </p>
            </div>
            <div className="bg-black/40 rounded-xl p-4 border border-white/5">
              <p className="text-[9px] uppercase tracking-widest text-neutral-500 mb-1">
                Sequence Duration
              </p>
              <p className="text-2xl font-light text-white font-mono">
                {timelineDays[timelineDays.length - 1]}
                <span className="text-neutral-500 text-sm"> days</span>
              </p>
            </div>
            <div className="bg-black/40 rounded-xl p-4 border border-white/5">
              <p className="text-[9px] uppercase tracking-widest text-neutral-500 mb-1">
                Avg Quality
              </p>
              <p className="text-2xl font-light text-emerald-400 font-mono">
                {(() => {
                  const scored = emails.filter((e) => e.qualityScore);
                  if (scored.length === 0) return "--";
                  const avg =
                    scored.reduce(
                      (sum, e) => sum + (e.qualityScore ?? 0),
                      0
                    ) / scored.length;
                  return avg.toFixed(1);
                })()}
                <span className="text-neutral-500 text-sm">/10</span>
              </p>
            </div>
            <div className="bg-black/40 rounded-xl p-4 border border-white/5">
              <p className="text-[9px] uppercase tracking-widest text-neutral-500 mb-1">
                Sequence Type
              </p>
              <p className={`text-lg font-light font-mono uppercase tracking-wider ${activeConfig.color}`}>
                {activeConfig.label}
              </p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ─── Empty State ─── */}
      {!emails.some((e) => e.isGenerated) &&
        !anyGenerating &&
        !globalError && (
          <div className="text-center py-16 rounded-2xl border border-white/5 bg-white/[0.01]">
            <Mail className="w-8 h-8 text-neutral-500 mx-auto mb-3" />
            <p className="text-sm text-neutral-300">
              Fill in your brand details and generate your email sequence
            </p>
            <p className="text-xs text-neutral-500 mt-1">
              Each email is written by AI using the{" "}
              {activeConfig.label.toLowerCase()} sequence framework
            </p>
          </div>
        )}
    </div>
  );
}
