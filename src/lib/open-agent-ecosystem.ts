/**
 * SOVEREIGN MATRIX — Open-source agent-ecosystem catalog (Cook 184).
 *
 * Formal registry of every open-source agent framework / agent
 * runtime / agent tool that Sovereign Matrix can integrate with
 * OR compete against. Three integration patterns:
 *
 *   1. ADAPTER: Sovereign wraps the framework and signs receipts
 *      on its agent outputs (LangGraph, CrewAI, AutoGen, Swarm).
 *   2. EMBED: Sovereign exposes its primitives so the framework
 *      can call them directly (Letta / MemGPT memory layer).
 *   3. COEXIST: Different category, no immediate adapter needed
 *      (Aider, OpenHands — coding agents).
 *
 * Pure module — no I/O. Source of truth for the /oss page and the
 * future integration-shim cooks (each framework gets a 200-line
 * adapter that lets a customer's existing agent ship Sovereign
 * receipts).
 */

// ── Public types ──────────────────────────────────────────────────────────

export type AgentFrameworkCategory =
  | "orchestration" // LangGraph, CrewAI, AutoGen — graph/role-based runners
  | "memory" // Letta (MemGPT), Mem0 — stateful agent memory
  | "coding-agent" // OpenHands, Aider, Cline, GPT Engineer
  | "browser-agent" // Browser-Use, Stagehand
  | "research-agent" // GPT Researcher, Perplexica
  | "ui" // Open WebUI, AnythingLLM — front-end shells
  | "rag" // LlamaIndex, Haystack, R2R, GraphRAG
  | "guardrails" // NeMo Guardrails, Guardrails.ai
  | "evaluation" // PromptFoo, DeepEval, LMSYS Arena
  | "inference" // vLLM, TGI, Ollama, llama.cpp
  | "fine-tuning" // Unsloth, Axolotl, LLaMA-Factory
  | "observability"; // Langfuse, Helicone, Phoenix

export type SovereignIntegrationStatus =
  | "adapter-shipped" // Sovereign has an integration-shim live
  | "adapter-planned" // Roadmap; cook number assigned
  | "embed" // The framework can call Sovereign directly today
  | "coexist" // No integration planned — different category
  | "compete"; // Direct competitor to a Sovereign primitive

export interface AgentFramework {
  /** Stable id for the catalog. */
  id: string;
  name: string;
  category: AgentFrameworkCategory;
  /** Open-source license. */
  license: string;
  /** GitHub stars (rough, for "popularity" surfacing). */
  starsK: number;
  /** Primary language. */
  language: "Python" | "TypeScript" | "Go" | "Rust" | "Multi";
  /** One-sentence description for the /oss page. */
  blurb: string;
  /** Sovereign's relationship to it. */
  sovereignStatus: SovereignIntegrationStatus;
  /** Optional cook number tracking the integration work. */
  cookId?: string;
  /** Optional adapter path inside src/lib once shipped. */
  adapterPath?: string;
  homepage: string;
}

// ── The canonical ecosystem catalog ──────────────────────────────────────

export const ECOSYSTEM: Record<string, AgentFramework> = {
  // ── Orchestration ─────────────────────────────────────────────────────
  langgraph: {
    id: "langgraph",
    name: "LangGraph",
    category: "orchestration",
    license: "Apache-2.0",
    starsK: 8.5,
    language: "Python",
    blurb:
      "Graph-based stateful agent orchestration from LangChain. The de facto standard for production multi-agent flows.",
    sovereignStatus: "adapter-planned",
    cookId: "187",
    homepage: "https://langchain-ai.github.io/langgraph/",
  },
  crewai: {
    id: "crewai",
    name: "CrewAI",
    category: "orchestration",
    license: "MIT",
    starsK: 23.5,
    language: "Python",
    blurb:
      "Role-playing autonomous agents that collaborate as a crew. Popular with non-engineers for its declarative role/task DSL.",
    sovereignStatus: "adapter-planned",
    cookId: "187",
    homepage: "https://github.com/crewAIInc/crewAI",
  },
  autogen: {
    id: "autogen",
    name: "AutoGen",
    category: "orchestration",
    license: "MIT",
    starsK: 33.7,
    language: "Python",
    blurb:
      "Microsoft's conversational multi-agent framework. AutoGen Studio is the visual designer that ships with it.",
    sovereignStatus: "adapter-planned",
    cookId: "187",
    homepage: "https://github.com/microsoft/autogen",
  },
  "openai-swarm": {
    id: "openai-swarm",
    name: "OpenAI Swarm",
    category: "orchestration",
    license: "MIT",
    starsK: 17.0,
    language: "Python",
    blurb:
      "OpenAI's minimal multi-agent orchestration library. Cookbook-style — 4 primitives, no framework lock-in.",
    sovereignStatus: "adapter-planned",
    cookId: "187",
    homepage: "https://github.com/openai/swarm",
  },
  "smol-agents": {
    id: "smol-agents",
    name: "smolagents",
    category: "orchestration",
    license: "Apache-2.0",
    starsK: 6.5,
    language: "Python",
    blurb:
      "HuggingFace's tiny agents library — code-generating agents in ~1000 LOC.",
    sovereignStatus: "coexist",
    homepage: "https://github.com/huggingface/smolagents",
  },
  "pydantic-ai": {
    id: "pydantic-ai",
    name: "Pydantic AI",
    category: "orchestration",
    license: "MIT",
    starsK: 4.2,
    language: "Python",
    blurb:
      "Type-safe agent framework from the Pydantic team. Strong fit for compliance-heavy domains where structured outputs matter.",
    sovereignStatus: "adapter-planned",
    cookId: "187",
    homepage: "https://github.com/pydantic/pydantic-ai",
  },
  "bee-agent": {
    id: "bee-agent",
    name: "Bee Agent Framework",
    category: "orchestration",
    license: "Apache-2.0",
    starsK: 1.4,
    language: "TypeScript",
    blurb:
      "IBM's production-grade TypeScript agent runtime — closest peer to Sovereign's own factory.",
    sovereignStatus: "coexist",
    homepage: "https://github.com/i-am-bee/bee-agent-framework",
  },
  "magentic-one": {
    id: "magentic-one",
    name: "Magentic-One",
    category: "orchestration",
    license: "MIT",
    starsK: 1.8,
    language: "Python",
    blurb:
      "Microsoft Research's multi-agent generalist system. State-of-the-art on agent benchmarks (GAIA, AssistantBench).",
    sovereignStatus: "coexist",
    homepage:
      "https://github.com/microsoft/autogen/tree/main/python/packages/autogen-magentic-one",
  },

  // ── Memory ────────────────────────────────────────────────────────────
  letta: {
    id: "letta",
    name: "Letta (formerly MemGPT)",
    category: "memory",
    license: "Apache-2.0",
    starsK: 14.0,
    language: "Python",
    blurb:
      "Stateful agents with persistent memory + tool use. The reference implementation of MemGPT's hierarchical-memory paper.",
    sovereignStatus: "embed",
    homepage: "https://github.com/letta-ai/letta",
  },
  mem0: {
    id: "mem0",
    name: "Mem0",
    category: "memory",
    license: "Apache-2.0",
    starsK: 23.0,
    language: "Python",
    blurb:
      "Universal memory layer for AI agents. Vector + graph hybrid; works with any LLM provider.",
    sovereignStatus: "embed",
    homepage: "https://github.com/mem0ai/mem0",
  },

  // ── Coding agents ────────────────────────────────────────────────────
  openhands: {
    id: "openhands",
    name: "OpenHands (formerly OpenDevin)",
    category: "coding-agent",
    license: "MIT",
    starsK: 36.0,
    language: "Python",
    blurb:
      "Autonomous software engineering agent. Browses, edits files, runs commands, opens PRs. The Devin-equivalent in open source.",
    sovereignStatus: "coexist",
    homepage: "https://github.com/All-Hands-AI/OpenHands",
  },
  aider: {
    id: "aider",
    name: "Aider",
    category: "coding-agent",
    license: "Apache-2.0",
    starsK: 23.0,
    language: "Python",
    blurb:
      "AI pair programming in the terminal. Strongest at editing-existing-codebases workflows.",
    sovereignStatus: "coexist",
    homepage: "https://github.com/Aider-AI/aider",
  },
  cline: {
    id: "cline",
    name: "Cline",
    category: "coding-agent",
    license: "Apache-2.0",
    starsK: 22.5,
    language: "TypeScript",
    blurb:
      "VS Code agentic coding assistant. Reads/edits files, runs commands, with user approval gates.",
    sovereignStatus: "coexist",
    homepage: "https://github.com/cline/cline",
  },
  "gpt-engineer": {
    id: "gpt-engineer",
    name: "GPT Engineer",
    category: "coding-agent",
    license: "MIT",
    starsK: 53.0,
    language: "Python",
    blurb:
      "Generate entire codebases from a natural-language spec. One of the original agent-coding projects.",
    sovereignStatus: "coexist",
    homepage: "https://github.com/AntonOsika/gpt-engineer",
  },

  // ── Browser agents ───────────────────────────────────────────────────
  "browser-use": {
    id: "browser-use",
    name: "Browser-Use",
    category: "browser-agent",
    license: "MIT",
    starsK: 38.0,
    language: "Python",
    blurb:
      "Browser automation agent — the open-source Manus / Operator equivalent. Built on Playwright.",
    sovereignStatus: "adapter-planned",
    cookId: "188",
    homepage: "https://github.com/browser-use/browser-use",
  },
  stagehand: {
    id: "stagehand",
    name: "Stagehand",
    category: "browser-agent",
    license: "MIT",
    starsK: 9.0,
    language: "TypeScript",
    blurb:
      "Production browser-automation framework from Browserbase. TypeScript-first, atomic actions over flaky scripts.",
    sovereignStatus: "adapter-planned",
    cookId: "188",
    homepage: "https://github.com/browserbase/stagehand",
  },

  // ── Research agents ──────────────────────────────────────────────────
  "gpt-researcher": {
    id: "gpt-researcher",
    name: "GPT Researcher",
    category: "research-agent",
    license: "MIT",
    starsK: 16.0,
    language: "Python",
    blurb:
      "Autonomous research agent — runs queries, synthesises sources, drafts reports with citations.",
    sovereignStatus: "coexist",
    homepage: "https://github.com/assafelovic/gpt-researcher",
  },
  perplexica: {
    id: "perplexica",
    name: "Perplexica",
    category: "research-agent",
    license: "MIT",
    starsK: 22.5,
    language: "TypeScript",
    blurb:
      "Open-source Perplexity alternative. SearXNG + Local LLM + clean answer-with-citations UX.",
    sovereignStatus: "coexist",
    homepage: "https://github.com/ItzCrazyKns/Perplexica",
  },

  // ── UI shells ────────────────────────────────────────────────────────
  "open-webui": {
    id: "open-webui",
    name: "Open WebUI",
    category: "ui",
    license: "MIT",
    starsK: 78.0,
    language: "TypeScript",
    blurb:
      "ChatGPT-style UI for local LLMs. The most popular open-source LLM front-end.",
    sovereignStatus: "coexist",
    homepage: "https://github.com/open-webui/open-webui",
  },
  anythingllm: {
    id: "anythingllm",
    name: "AnythingLLM",
    category: "ui",
    license: "MIT",
    starsK: 31.0,
    language: "TypeScript",
    blurb:
      "Full-stack LLM application with built-in RAG, agents, and multi-user support.",
    sovereignStatus: "coexist",
    homepage: "https://github.com/Mintplex-Labs/anything-llm",
  },

  // ── RAG ──────────────────────────────────────────────────────────────
  llamaindex: {
    id: "llamaindex",
    name: "LlamaIndex",
    category: "rag",
    license: "MIT",
    starsK: 36.0,
    language: "Python",
    blurb:
      "Data framework for RAG over enterprise knowledge. The category-defining RAG library.",
    sovereignStatus: "embed",
    homepage: "https://github.com/run-llama/llama_index",
  },
  haystack: {
    id: "haystack",
    name: "Haystack",
    category: "rag",
    license: "Apache-2.0",
    starsK: 18.0,
    language: "Python",
    blurb:
      "End-to-end NLP framework with production-grade RAG pipelines. Used in regulated industries.",
    sovereignStatus: "embed",
    homepage: "https://github.com/deepset-ai/haystack",
  },
  graphrag: {
    id: "graphrag",
    name: "GraphRAG",
    category: "rag",
    license: "MIT",
    starsK: 20.5,
    language: "Python",
    blurb:
      "Microsoft Research's knowledge-graph RAG. Better than vector-only for cross-document reasoning.",
    sovereignStatus: "adapter-planned",
    cookId: "189",
    homepage: "https://github.com/microsoft/graphrag",
  },
  r2r: {
    id: "r2r",
    name: "R2R (RAG to Riches)",
    category: "rag",
    license: "MIT",
    starsK: 5.0,
    language: "Python",
    blurb:
      "Production-grade agentic RAG with full observability + multi-tenancy out of the box.",
    sovereignStatus: "coexist",
    homepage: "https://github.com/SciPhi-AI/R2R",
  },

  // ── Guardrails ───────────────────────────────────────────────────────
  "nemo-guardrails": {
    id: "nemo-guardrails",
    name: "NeMo Guardrails",
    category: "guardrails",
    license: "Apache-2.0",
    starsK: 4.0,
    language: "Python",
    blurb:
      "NVIDIA's programmable guardrails framework. Already wired in Sovereign's output verifier.",
    sovereignStatus: "adapter-shipped",
    adapterPath: "src/lib/nemo-guardrails.ts",
    homepage: "https://github.com/NVIDIA/NeMo-Guardrails",
  },
  "guardrails-ai": {
    id: "guardrails-ai",
    name: "Guardrails.ai",
    category: "guardrails",
    license: "Apache-2.0",
    starsK: 4.2,
    language: "Python",
    blurb:
      "Validators + structured-output enforcement for LLMs. Alternative to NeMo for structured-data paths.",
    sovereignStatus: "coexist",
    homepage: "https://github.com/guardrails-ai/guardrails",
  },

  // ── Evaluation ───────────────────────────────────────────────────────
  promptfoo: {
    id: "promptfoo",
    name: "promptfoo",
    category: "evaluation",
    license: "MIT",
    starsK: 5.5,
    language: "TypeScript",
    blurb:
      "Test LLM apps with prompt regression suites. Open-source eval framework for CI.",
    sovereignStatus: "adapter-planned",
    cookId: "190",
    homepage: "https://github.com/promptfoo/promptfoo",
  },
  deepeval: {
    id: "deepeval",
    name: "DeepEval",
    category: "evaluation",
    license: "Apache-2.0",
    starsK: 4.5,
    language: "Python",
    blurb:
      "Pytest-style LLM evaluation framework. 14+ built-in metrics including hallucination + bias.",
    sovereignStatus: "adapter-planned",
    cookId: "190",
    homepage: "https://github.com/confident-ai/deepeval",
  },

  // ── Inference + serving ─────────────────────────────────────────────
  vllm: {
    id: "vllm",
    name: "vLLM",
    category: "inference",
    license: "Apache-2.0",
    starsK: 32.0,
    language: "Python",
    blurb:
      "High-performance LLM inference engine. PagedAttention for 2-4x throughput vs naive serving. **Production path for self-hosted Sovereign customers.**",
    sovereignStatus: "embed",
    homepage: "https://github.com/vllm-project/vllm",
  },
  ollama: {
    id: "ollama",
    name: "Ollama",
    category: "inference",
    license: "MIT",
    starsK: 96.0,
    language: "Go",
    blurb:
      "Local LLM runner with one-line installs. Already wired in Sovereign's cascade — first-refusal model on every request.",
    sovereignStatus: "adapter-shipped",
    adapterPath: "src/lib/ai.ts:ollamaText",
    homepage: "https://github.com/ollama/ollama",
  },
  tgi: {
    id: "tgi",
    name: "Text Generation Inference (TGI)",
    category: "inference",
    license: "Apache-2.0",
    starsK: 9.0,
    language: "Python",
    blurb:
      "HuggingFace's production-grade inference server. Same role as vLLM with deeper HF Hub integration.",
    sovereignStatus: "coexist",
    homepage: "https://github.com/huggingface/text-generation-inference",
  },
  "llama-cpp": {
    id: "llama-cpp",
    name: "llama.cpp",
    category: "inference",
    license: "MIT",
    starsK: 70.0,
    language: "Multi",
    blurb:
      "Pure-C/C++ inference for Llama-family models. CPU-only and edge-device deployments.",
    sovereignStatus: "coexist",
    homepage: "https://github.com/ggerganov/llama.cpp",
  },

  // ── Fine-tuning ──────────────────────────────────────────────────────
  unsloth: {
    id: "unsloth",
    name: "Unsloth",
    category: "fine-tuning",
    license: "Apache-2.0",
    starsK: 18.0,
    language: "Python",
    blurb:
      "Fast fine-tuning of Llama/Mistral/Qwen with 70% less memory. Best path to a customer-specific fine-tune.",
    sovereignStatus: "adapter-planned",
    cookId: "191",
    homepage: "https://github.com/unslothai/unsloth",
  },
  axolotl: {
    id: "axolotl",
    name: "Axolotl",
    category: "fine-tuning",
    license: "Apache-2.0",
    starsK: 7.5,
    language: "Python",
    blurb:
      "Fine-tuning toolkit with YAML configs for every modern training trick. Heavier than Unsloth, more flexible.",
    sovereignStatus: "coexist",
    homepage: "https://github.com/axolotl-ai-cloud/axolotl",
  },
  "llama-factory": {
    id: "llama-factory",
    name: "LLaMA-Factory",
    category: "fine-tuning",
    license: "Apache-2.0",
    starsK: 32.0,
    language: "Python",
    blurb:
      "Unified efficient fine-tuning of 100+ LLMs. Strong on Chinese/Asian-language models (Qwen, ChatGLM).",
    sovereignStatus: "coexist",
    homepage: "https://github.com/hiyouga/LLaMA-Factory",
  },

  // ── Observability ───────────────────────────────────────────────────
  langfuse: {
    id: "langfuse",
    name: "Langfuse",
    category: "observability",
    license: "MIT",
    starsK: 7.0,
    language: "TypeScript",
    blurb:
      "Open LLM observability + tracing. SOC 2 ready. Strong fit alongside Sovereign's existing tracing.",
    sovereignStatus: "adapter-planned",
    cookId: "192",
    homepage: "https://github.com/langfuse/langfuse",
  },
  helicone: {
    id: "helicone",
    name: "Helicone",
    category: "observability",
    license: "Apache-2.0",
    starsK: 3.0,
    language: "TypeScript",
    blurb:
      "Proxy-based LLM observability. Minimal-integration footprint — works with any provider.",
    sovereignStatus: "coexist",
    homepage: "https://github.com/Helicone/helicone",
  },
  phoenix: {
    id: "phoenix",
    name: "Arize Phoenix",
    category: "observability",
    license: "Apache-2.0",
    starsK: 4.5,
    language: "Python",
    blurb:
      "OpenInference-based LLM tracing. Already wired in Sovereign via OTLP/HTTP.",
    sovereignStatus: "adapter-shipped",
    adapterPath: "src/lib/tracing.ts",
    homepage: "https://github.com/Arize-ai/phoenix",
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────

export function listFrameworks(): AgentFramework[] {
  return Object.values(ECOSYSTEM);
}

export function frameworksByCategory(
  category: AgentFrameworkCategory,
): AgentFramework[] {
  return listFrameworks().filter((f) => f.category === category);
}

export function frameworksByStatus(
  status: SovereignIntegrationStatus,
): AgentFramework[] {
  return listFrameworks().filter((f) => f.sovereignStatus === status);
}

/**
 * Stats for the /oss page hero — "we catalog N frameworks across M
 * categories; K already have a Sovereign adapter; J more on the roadmap."
 */
export function ecosystemSummary(): {
  total: number;
  categoryCount: number;
  shippedAdapters: number;
  plannedAdapters: number;
  totalStarsK: number;
} {
  const all = listFrameworks();
  const categories = new Set(all.map((f) => f.category));
  return {
    total: all.length,
    categoryCount: categories.size,
    shippedAdapters: all.filter((f) => f.sovereignStatus === "adapter-shipped")
      .length,
    plannedAdapters: all.filter((f) => f.sovereignStatus === "adapter-planned")
      .length,
    totalStarsK: Math.round(all.reduce((acc, f) => acc + f.starsK, 0)),
  };
}

export function findFramework(id: string): AgentFramework | undefined {
  return ECOSYSTEM[id];
}
