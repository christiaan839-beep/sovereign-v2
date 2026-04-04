"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Wand2, Plus, Play, Pencil, Trash2, Copy, Send,
  Bot, Briefcase, FileText, Code2, MessageSquare, Loader2,
  ChevronDown, X, Clock, Sparkles, Upload, Check,
} from "lucide-react";
import { useToast } from "@/components/ui/ToastProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { MODEL_REGISTRY } from "@/config/models";
import type { ModelConfig } from "@/config/models";

/* ─── Types ─── */

interface Skill {
  id: string;
  name: string;
  description: string | null;
  systemPrompt: string;
  createdAt: string;
}

interface RunResult {
  result: string;
  model: string;
  responseTimeMs: number;
}

/* ─── Starter Templates ─── */

const STARTER_TEMPLATES = [
  {
    id: "sales-qualifier",
    name: "Sales Qualifier",
    description: "Qualifies inbound leads by asking discovery questions and scoring fit",
    icon: Briefcase,
    systemPrompt: `You are an elite B2B sales qualification agent. Your job is to analyze a lead's information and determine their qualification level.

For each lead, evaluate:
1. Budget - Can they afford the solution?
2. Authority - Are they a decision maker?
3. Need - Do they have a clear pain point?
4. Timeline - When do they need a solution?

Score each criterion 1-10 and provide an overall qualification score (1-100).
Output a structured assessment with: Score, Verdict (Hot/Warm/Cold), Key Objections, and Recommended Next Steps.`,
  },
  {
    id: "content-rewriter",
    name: "Content Rewriter",
    description: "Rewrites content in your brand voice while preserving meaning",
    icon: FileText,
    systemPrompt: `You are an expert content strategist and copywriter. Your job is to take existing content and rewrite it to be more engaging, persuasive, and on-brand.

Rules:
1. Maintain the core message and factual accuracy
2. Make the tone confident, direct, and modern
3. Use power words and action-oriented language
4. Break up long paragraphs into scannable sections
5. Add compelling hooks and transitions
6. Optimize for readability (aim for Grade 8 reading level)

Output the rewritten content with a brief note on what you changed and why.`,
  },
  {
    id: "meeting-summarizer",
    name: "Meeting Summarizer",
    description: "Summarizes meeting notes into structured action items",
    icon: MessageSquare,
    systemPrompt: `You are a precision meeting analyst. Given raw meeting notes or a transcript, produce a structured summary.

Output format:
## Meeting Summary
- Date/Context (if mentioned)
- Key Discussion Points (3-5 bullets)

## Decisions Made
- List each decision with owner

## Action Items
| # | Task | Owner | Deadline |
|---|------|-------|----------|
| 1 | ...  | ...   | ...      |

## Open Questions
- List unresolved items

## Follow-ups Required
- Next meeting topics or pre-work needed

Be concise. Focus on actionable outputs. If information is missing, note it.`,
  },
  {
    id: "code-reviewer",
    name: "Code Reviewer",
    description: "Reviews code for bugs, security issues, and best practices",
    icon: Code2,
    systemPrompt: `You are a senior software engineer performing a thorough code review. Analyze the provided code for:

1. **Bugs & Logic Errors** - Off-by-one errors, null references, race conditions
2. **Security Vulnerabilities** - SQL injection, XSS, CSRF, auth issues, secrets exposure
3. **Performance Issues** - N+1 queries, memory leaks, unnecessary re-renders
4. **Code Quality** - Naming conventions, DRY violations, complexity, readability
5. **Best Practices** - Error handling, type safety, testing considerations

For each finding, provide:
- Severity: Critical / Warning / Suggestion
- Line reference (if applicable)
- What's wrong
- How to fix it (with code snippet)

End with an overall assessment and a quality score out of 10.`,
  },
];

/* ─── Main Page ─── */

export default function AgentBuilderPage() {
  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [selectedModel, setSelectedModel] = useState("auto");
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Edit state
  const [editingId, setEditingId] = useState<string | null>(null);

  // Skills list
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);

  // Run state
  const [runningId, setRunningId] = useState<string | null>(null);
  const [runPrompt, setRunPrompt] = useState("");
  const [runResult, setRunResult] = useState<RunResult | null>(null);
  const [runOpen, setRunOpen] = useState<string | null>(null);

  // Publish state
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [publishedIds, setPublishedIds] = useState<Set<string>>(new Set());
  const toast = useToast();

  // Fetch skills
  const fetchSkills = useCallback(async () => {
    try {
      const res = await fetch("/api/skills");
      if (res.ok) {
        const data = await res.json();
        setSkills(data.skills || []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSkills();
  }, [fetchSkills]);

  // Create / Update skill
  const handleSave = async () => {
    if (!name.trim() || !systemPrompt.trim()) return;
    setCreating(true);
    try {
      const url = editingId ? `/api/skills/${editingId}` : "/api/skills";
      const method = editingId ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, description, systemPrompt }),
      });
      if (res.ok) {
        resetForm();
        fetchSkills();
      }
    } catch {
      // silent
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setName("");
    setDescription("");
    setSystemPrompt("");
    setSelectedModel("auto");
    setEditingId(null);
  };

  // Edit skill
  const startEdit = (skill: Skill) => {
    setName(skill.name);
    setDescription(skill.description || "");
    setSystemPrompt(skill.systemPrompt);
    setEditingId(skill.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Delete skill
  const handleDelete = async (id: string) => {
    await fetch(`/api/skills/${id}`, { method: "DELETE" });
    setSkills((prev) => prev.filter((s) => s.id !== id));
    if (runOpen === id) {
      setRunOpen(null);
      setRunResult(null);
    }
  };

  // Run skill
  const handleRun = async (id: string) => {
    if (!runPrompt.trim()) return;
    setRunningId(id);
    setRunResult(null);
    try {
      const res = await fetch(`/api/skills/${id}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: runPrompt }),
      });
      if (res.ok) {
        const data = await res.json();
        setRunResult(data);
      }
    } catch {
      // silent
    } finally {
      setRunningId(null);
    }
  };

  // Use template
  const applyTemplate = (template: (typeof STARTER_TEMPLATES)[number]) => {
    setName(template.name);
    setDescription(template.description);
    setSystemPrompt(template.systemPrompt);
    setEditingId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Publish to marketplace
  const handlePublish = async (skill: Skill) => {
    setPublishingId(skill.id);
    try {
      const res = await fetch("/api/marketplace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          skillId: skill.id,
          name: skill.name,
          description: skill.description || `Custom agent: ${skill.name}`,
          category: "automation",
          systemPrompt: skill.systemPrompt,
        }),
      });
      if (res.ok) {
        setPublishedIds((prev) => new Set(prev).add(skill.id));
        toast.success("Published to marketplace!");
      } else {
        const data = await res.json();
        if (res.status === 409) {
          setPublishedIds((prev) => new Set(prev).add(skill.id));
          toast.success("Already published!");
        } else {
          toast.error(data.error || "Failed to publish.");
        }
      }
    } catch {
      toast.error("Publish failed. Please try again.");
    } finally {
      setPublishingId(null);
    }
  };

  const selectedModelConfig = MODEL_REGISTRY.find((m) => m.id === selectedModel) || MODEL_REGISTRY[0];

  return (
    <div className="min-h-screen bg-[#000000] px-6 lg:px-8 py-8 pb-32" role="region" aria-label="Agent builder">
      <PageHeader
        title="Agent Builder"
        description="Create custom AI agents with your own instructions, model selection, and tools"
        badge={
          <span className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full">
            Beta
          </span>
        }
      />

      {/* ─── Create / Edit Agent Card ─── */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-6 lg:p-8 mb-10"
      >
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <Wand2 className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-white">
              {editingId ? "Edit Agent" : "Create New Agent"}
            </h2>
            <p className="text-xs text-neutral-500">
              {editingId
                ? "Update your agent's configuration"
                : "Define your agent's personality, instructions, and model"}
            </p>
          </div>
          {editingId && (
            <button
              onClick={resetForm}
              aria-label="Cancel editing"
              className="ml-auto p-2 rounded-lg text-neutral-500 hover:text-white hover:bg-white/5 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">Agent Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Sales Qualifier, Code Reviewer..."
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500/40 transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of what this agent does..."
              rows={2}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500/40 transition-colors resize-none"
            />
          </div>

          {/* System Prompt */}
          <div>
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">
              System Prompt
              <span className="text-neutral-500 ml-2">The core instructions that define your agent</span>
            </label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are an expert... Your job is to..."
              rows={8}
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500/40 transition-colors resize-y font-mono text-[13px] leading-relaxed"
            />
          </div>

          {/* Model Selector */}
          <div className="relative">
            <label className="block text-xs font-medium text-neutral-400 mb-1.5">Model</label>
            <button
              onClick={() => setModelDropdownOpen(!modelDropdownOpen)}
              aria-expanded={modelDropdownOpen}
              aria-label="Select model"
              className="w-full flex items-center justify-between bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-3 text-sm text-white hover:border-white/[0.12] transition-colors"
            >
              <div className="flex items-center gap-3">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: selectedModelConfig.color }}
                />
                <span>{selectedModelConfig.name}</span>
                <span className="text-xs text-neutral-500">{selectedModelConfig.description}</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-neutral-500 transition-transform ${modelDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            <AnimatePresence>
              {modelDropdownOpen && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute z-50 top-full mt-2 w-full bg-[#0a0a0a] border border-white/10 rounded-xl shadow-2xl max-h-64 overflow-y-auto custom-scrollbar"
                >
                  {MODEL_REGISTRY.map((model: ModelConfig) => (
                    <button
                      key={model.id}
                      onClick={() => {
                        setSelectedModel(model.id);
                        setModelDropdownOpen(false);
                      }}
                      className={`w-full flex items-center gap-3 px-4 py-3 text-sm text-left transition-colors ${
                        selectedModel === model.id
                          ? "bg-emerald-500/10 text-white"
                          : "text-neutral-300 hover:bg-white/[0.04]"
                      }`}
                    >
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: model.color }}
                      />
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{model.name}</span>
                        <span className="ml-2 text-xs text-neutral-500">{model.description}</span>
                      </div>
                      {model.costTier === "free" && (
                        <span className="text-[9px] font-bold uppercase text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                          Free
                        </span>
                      )}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Submit */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={!name.trim() || !systemPrompt.trim() || creating}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {creating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : editingId ? (
                <Pencil className="w-4 h-4" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              {editingId ? "Update Agent" : "Create Agent"}
            </button>
            {editingId && (
              <button
                onClick={resetForm}
                className="px-4 py-3 rounded-xl text-sm text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* ─── My Agents Grid ─── */}
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-5">
          <Bot className="w-5 h-5 text-neutral-400" />
          <h2 className="text-lg font-semibold text-white">My Agents</h2>
          <span className="text-xs text-neutral-500 font-mono">{skills.length} agents</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-neutral-500 animate-spin" />
          </div>
        ) : skills.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white/[0.02] border border-white/[0.04] border-dashed rounded-2xl py-16 flex flex-col items-center gap-3"
          >
            <Sparkles className="w-8 h-8 text-neutral-500" />
            <p className="text-sm text-neutral-500">No agents yet. Create one above or use a starter template below.</p>
          </motion.div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <AnimatePresence>
              {skills.map((skill, i) => (
                <motion.div
                  key={skill.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.3, delay: i * 0.05 }}
                  className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 flex flex-col"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-white/[0.05] border border-white/[0.08]">
                        <Bot className="w-4 h-4 text-emerald-400" />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">{skill.name}</h3>
                        {skill.description && (
                          <p className="text-[11px] text-neutral-500 mt-0.5 line-clamp-1">{skill.description}</p>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-3 mb-4 flex-1">
                    <p className="text-[11px] text-neutral-500 font-mono leading-relaxed line-clamp-4">
                      {skill.systemPrompt}
                    </p>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-neutral-500 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(skill.createdAt).toLocaleDateString()}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setRunOpen(runOpen === skill.id ? null : skill.id);
                          setRunResult(null);
                          setRunPrompt("");
                        }}
                        className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors"
                        title="Run"
                        aria-label={`Run ${skill.name}`}
                        aria-expanded={runOpen === skill.id}
                      >
                        <Play className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handlePublish(skill)}
                        disabled={publishingId === skill.id || publishedIds.has(skill.id)}
                        className={`p-2 rounded-lg transition-colors ${
                          publishedIds.has(skill.id)
                            ? "text-emerald-400 cursor-default"
                            : "text-neutral-400 hover:text-cyan-400 hover:bg-cyan-500/10"
                        } disabled:opacity-70`}
                        title={publishedIds.has(skill.id) ? "Published" : "Publish to Marketplace"}
                      >
                        {publishingId === skill.id ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : publishedIds.has(skill.id) ? (
                          <Check className="w-3.5 h-3.5" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => startEdit(skill)}
                        className="p-2 rounded-lg text-neutral-400 hover:text-white hover:bg-white/5 transition-colors"
                        title="Edit"
                        aria-label={`Edit ${skill.name}`}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(skill.id)}
                        className="p-2 rounded-lg text-neutral-400 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Delete"
                        aria-label={`Delete ${skill.name}`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Run Panel */}
                  <AnimatePresence>
                    {runOpen === skill.id && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 pt-4 border-t border-white/[0.06] space-y-3">
                          <div className="flex gap-2">
                            <input
                              value={runPrompt}
                              onChange={(e) => setRunPrompt(e.target.value)}
                              onKeyDown={(e) => e.key === "Enter" && handleRun(skill.id)}
                              placeholder="Enter a prompt to test your agent..."
                              aria-label="Test prompt for agent"
                              className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-emerald-500/40 transition-colors"
                            />
                            <button
                              onClick={() => handleRun(skill.id)}
                              disabled={!runPrompt.trim() || runningId === skill.id}
                              aria-label="Run agent test"
                              className="p-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition-colors disabled:opacity-40"
                            >
                              {runningId === skill.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Send className="w-4 h-4" />
                              )}
                            </button>
                          </div>

                          {runResult && (
                            <motion.div
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              className="bg-white/[0.02] border border-white/[0.04] rounded-lg p-3"
                              aria-live="polite"
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-[9px] font-bold uppercase text-emerald-400 tracking-wider">Result</span>
                                <span className="text-[9px] text-neutral-500 font-mono">
                                  {runResult.responseTimeMs}ms
                                </span>
                              </div>
                              <p className="text-xs text-neutral-300 font-mono leading-relaxed whitespace-pre-wrap max-h-48 overflow-y-auto custom-scrollbar">
                                {runResult.result}
                              </p>
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
        )}
      </div>

      {/* ─── Starter Templates ─── */}
      <div>
        <div className="flex items-center gap-3 mb-5">
          <Copy className="w-5 h-5 text-neutral-400" />
          <h2 className="text-lg font-semibold text-white">Starter Templates</h2>
          <span className="text-xs text-neutral-500">Clone a pre-built agent to get started fast</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {STARTER_TEMPLATES.map((template, i) => (
            <motion.div
              key={template.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 + i * 0.06 }}
              className="bg-white/[0.03] border border-white/[0.06] rounded-2xl p-5 flex flex-col group hover:border-emerald-500/20 transition-colors"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                  <template.icon className="w-4 h-4 text-emerald-400" />
                </div>
                <h3 className="text-sm font-semibold text-white">{template.name}</h3>
              </div>
              <p className="text-[11px] text-neutral-500 leading-relaxed mb-4 flex-1">
                {template.description}
              </p>
              <button
                onClick={() => applyTemplate(template)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-neutral-300 hover:text-white hover:bg-emerald-500/10 hover:border-emerald-500/20 transition-gpu"
              >
                <Copy className="w-3.5 h-3.5" />
                Use Template
              </button>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
