import { getNimKey } from "@/lib/nvidia";
import { NextResponse } from "next/server";
import { enhanceWithSkills } from "@/lib/skill-engine";

/**
 * INTELLIGENT MODEL ROUTER — Automatically selects the best NIM model
 * for each task type based on benchmarking data and task classification.
 *
 * Instead of hardcoding models, agents call this router and it picks
 * the optimal model based on the task category.
 */

// ── Route cache: avoid redundant embedding calls for identical prompts ──
const routeCache = new Map<string, { model: string; modelId: string; taskType: string; timestamp: number }>();
const CACHE_TTL = 60_000; // 60s

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32-bit integer
  }
  return String(hash);
}

interface ModelProfile {
  id: string;
  name: string;
  strengths: string[];
  avg_speed_ms: number;
  quality_score: number; // 1-10
  cost_tier: "free" | "low" | "medium";
}

const MODEL_REGISTRY: ModelProfile[] = [
  // ─── NVIDIA NIM (Free, Open Source) ───
  { id: "nvidia/llama-3.1-nemotron-ultra-253b", name: "Nemotron Ultra 253B", strengths: ["synthesis", "debate", "consensus", "research", "reasoning"], avg_speed_ms: 6000, quality_score: 10, cost_tier: "free" },
  { id: "nvidia/nemotron-340b", name: "Nemotron 340B", strengths: ["complex-reasoning", "legal", "compliance", "technical"], avg_speed_ms: 8000, quality_score: 10, cost_tier: "free" },
  { id: "nvidia/nemotron-3-super-120b-a12b", name: "Nemotron 3 Super 120B", strengths: ["long-context", "analysis", "research", "synthesis", "reasoning"], avg_speed_ms: 4000, quality_score: 9, cost_tier: "free" },
  { id: "nvidia/devstral-2-123b-instruct-2512", name: "Devstral 2 123B", strengths: ["code", "html", "css", "javascript", "page-building"], avg_speed_ms: 4000, quality_score: 9, cost_tier: "free" },
  { id: "nvidia/nemotron-content-safety-reasoning-4b", name: "Content Safety 4B", strengths: ["pii", "safety", "moderation", "compliance", "guardrails"], avg_speed_ms: 800, quality_score: 8, cost_tier: "free" },
  { id: "nvidia/nemotron-voicechat", name: "Nemotron Voicechat", strengths: ["voice", "conversation", "phone", "support", "sales-call"], avg_speed_ms: 1500, quality_score: 8, cost_tier: "free" },
  // ─── New Frontier Models (NIM) ───
  { id: "qwen/qwen3-235b-a22b", name: "Qwen 3 235B", strengths: ["reasoning", "code", "multilingual", "analysis", "thinking", "math"], avg_speed_ms: 3000, quality_score: 10, cost_tier: "free" },
  { id: "meta/llama-4-maverick-17b-128e", name: "Llama 4 Maverick", strengths: ["multimodal", "vision", "image-understanding", "creative", "chat"], avg_speed_ms: 2000, quality_score: 9, cost_tier: "free" },
  { id: "thudm/glm-5", name: "GLM-5 400B", strengths: ["agentic", "planning", "long-horizon", "complex-reasoning", "research"], avg_speed_ms: 5000, quality_score: 10, cost_tier: "free" },
  // ─── Existing Open Source ───
  { id: "deepseek-ai/deepseek-v3.2", name: "DeepSeek V3.2", strengths: ["reasoning", "analysis", "writing", "code", "strategy", "thinking"], avg_speed_ms: 3500, quality_score: 9, cost_tier: "free" },
  { id: "mistralai/mistral-nemotron", name: "Mistral Nemotron", strengths: ["instruction-following", "chat", "summarization", "email", "outreach"], avg_speed_ms: 2800, quality_score: 8, cost_tier: "free" },
  { id: "thudm/glm-4-9b-chat", name: "GLM 4.7", strengths: ["multilingual", "translation", "creative", "brainstorming"], avg_speed_ms: 2200, quality_score: 7, cost_tier: "free" },
  // ─── Groq (Ultra-Fast Inference) ───
  { id: "groq/deepseek-r1-distill-llama-70b", name: "DeepSeek-R1 (Groq)", strengths: ["deep-reasoning", "math", "logic", "strategy", "analysis", "thinking"], avg_speed_ms: 1200, quality_score: 10, cost_tier: "free" },
  { id: "groq/llama-3.1-8b-instant", name: "Llama 3.1 8B (Groq)", strengths: ["chat", "email", "outreach", "summarization", "instruction-following"], avg_speed_ms: 200, quality_score: 7, cost_tier: "free" },
  { id: "groq/qwen-qwq-32b", name: "Qwen QwQ 32B (Groq)", strengths: ["thinking", "reasoning", "math", "code", "analysis"], avg_speed_ms: 800, quality_score: 9, cost_tier: "free" },
  // ─── Frontier Models (Wave 3) ───
  { id: "kimi-dev-72b", name: "Kimi-Dev-72B", strengths: ["code-generation", "debugging", "refactoring", "software-engineering", "code-review"], avg_speed_ms: 3000, quality_score: 10, cost_tier: "free" },
  { id: "qwen/qwen3-coder-480b-a35b", name: "Qwen3-Coder-480B", strengths: ["code-generation", "agentic-coding", "repo-analysis", "architecture"], avg_speed_ms: 5000, quality_score: 10, cost_tier: "free" },
  { id: "thudm/glm-4.1v-9b-thinking", name: "GLM-4.1V-9B-Thinking", strengths: ["vision", "screenshot-analysis", "ocr", "document-reading", "image-understanding"], avg_speed_ms: 2000, quality_score: 9, cost_tier: "free" },
  { id: "deepseek-ai/deepseek-r1", name: "DeepSeek-R1 Full", strengths: ["deep-reasoning", "math", "logic", "strategy", "complex-analysis"], avg_speed_ms: 4000, quality_score: 10, cost_tier: "free" },
  { id: "meta/llama-4-scout-17b-16e", name: "Llama 4 Scout", strengths: ["long-context", "document-analysis", "summarization", "multimodal"], avg_speed_ms: 2500, quality_score: 9, cost_tier: "free" },
  { id: "microsoft/phi-4", name: "Phi-4", strengths: ["fast-chat", "instruction-following", "edge-reasoning"], avg_speed_ms: 800, quality_score: 8, cost_tier: "free" },
  { id: "mistralai/devstral-small-2", name: "Devstral Small 2", strengths: ["code-generation", "code-review", "html-css", "page-building"], avg_speed_ms: 1500, quality_score: 9, cost_tier: "free" },
  { id: "qwen/qwen3-asr", name: "Qwen3-ASR", strengths: ["transcription", "speech-to-text", "voice-input"], avg_speed_ms: 1000, quality_score: 10, cost_tier: "free" },
  { id: "nvidia/nemotron-speech-streaming", name: "Nemotron-Speech-Streaming", strengths: ["voice", "real-time-transcription", "streaming-asr"], avg_speed_ms: 500, quality_score: 9, cost_tier: "free" },
  { id: "moonshotai/kimi-k2.5", name: "Kimi K2.5", strengths: ["vision", "multimodal", "code-generation", "reasoning", "math", "image-understanding", "video-understanding", "agentic-coding"], avg_speed_ms: 3000, quality_score: 10, cost_tier: "free" },
];

const TASK_CATEGORY_MAP: Record<string, string[]> = {
  "translation": ["multilingual", "translation"],
  "code-generation": ["code", "html", "css", "javascript", "page-building"],
  "content-writing": ["writing", "creative", "brainstorming"],
  "analysis": ["reasoning", "analysis", "strategy", "research"],
  "email": ["instruction-following", "email", "outreach", "chat"],
  "safety": ["pii", "safety", "moderation", "compliance", "guardrails"],
  "voice": ["voice", "conversation", "phone", "support", "sales-call"],
  "legal": ["complex-reasoning", "legal", "compliance", "technical"],
  "debate": ["synthesis", "debate", "consensus"],
  "summarization": ["summarization", "chat"],
  "deep-reasoning": ["deep-reasoning", "math", "logic", "strategy", "thinking"],
  "vision": ["multimodal", "vision", "image-understanding"],
  "agentic": ["agentic", "planning", "long-horizon", "complex-reasoning"],
  "long-context": ["long-context", "analysis", "research", "synthesis", "document-analysis"],
  "software-engineering": ["code-generation", "debugging", "refactoring", "software-engineering", "code-review"],
  "architecture": ["code-generation", "agentic-coding", "repo-analysis", "architecture"],
  "ocr": ["vision", "screenshot-analysis", "ocr", "document-reading", "image-understanding"],
  "transcription": ["transcription", "speech-to-text", "voice-input", "real-time-transcription", "streaming-asr"],
  "fast-chat": ["fast-chat", "instruction-following", "edge-reasoning"],
  "math": ["math", "reasoning", "logic", "analysis"],
  "video-understanding": ["video-understanding", "multimodal", "vision", "image-understanding"],
};

function findBestModel(taskType: string, priority: "speed" | "quality" = "quality"): ModelProfile {
  const requiredStrengths = TASK_CATEGORY_MAP[taskType] || TASK_CATEGORY_MAP["analysis"];

  // Score each model by how many required strengths it has
  const scored = MODEL_REGISTRY.map(model => {
    const matchCount = requiredStrengths.filter(s => model.strengths.includes(s)).length;
    const matchScore = matchCount / requiredStrengths.length;
    
    const finalScore = priority === "speed"
      ? matchScore * 0.6 + (1 - model.avg_speed_ms / 10000) * 0.4
      : matchScore * 0.7 + (model.quality_score / 10) * 0.3;

    return { ...model, score: finalScore };
  });

  scored.sort((a, b) => b.score - a.score);
  return scored[0];
}

export async function POST(request: Request) {
  try {
    const { task_type, priority = "quality", prompt } = await request.json();

    if (!task_type && !prompt) {
      return NextResponse.json({
        error: "task_type or prompt required.",
        available_types: Object.keys(TASK_CATEGORY_MAP),
      }, { status: 400 });
    }

    // Auto-classify task type from prompt if not provided
    let resolvedType = task_type;
    if (!resolvedType && prompt) {
      const promptLower = prompt.toLowerCase();
      if (promptLower.includes("translat")) resolvedType = "translation";
      else if (promptLower.includes("code") || promptLower.includes("html") || promptLower.includes("build")) resolvedType = "code-generation";
      else if (promptLower.includes("write") || promptLower.includes("blog") || promptLower.includes("article")) resolvedType = "content-writing";
      else if (promptLower.includes("email") || promptLower.includes("outreach")) resolvedType = "email";
      else if (promptLower.includes("pii") || promptLower.includes("safety") || promptLower.includes("redact")) resolvedType = "safety";
      else if (promptLower.includes("voice") || promptLower.includes("call") || promptLower.includes("phone")) resolvedType = "voice";
      else if (promptLower.includes("legal") || promptLower.includes("contract") || promptLower.includes("compliance")) resolvedType = "legal";
      else if (promptLower.includes("debate") || promptLower.includes("compare") || promptLower.includes("pros and cons")) resolvedType = "debate";
      else if (promptLower.includes("image") || promptLower.includes("screenshot") || promptLower.includes("photo") || promptLower.includes("picture")) resolvedType = "vision";
      else if (promptLower.includes("plan") || promptLower.includes("step by step") || promptLower.includes("automate") || promptLower.includes("workflow")) resolvedType = "agentic";
      else if (promptLower.includes("document") || promptLower.includes("long") || promptLower.includes("entire") || promptLower.includes("full report")) resolvedType = "long-context";
      else if (promptLower.includes("debug") || promptLower.includes("refactor") || promptLower.includes("swe") || promptLower.includes("pull request")) resolvedType = "software-engineering";
      else if (promptLower.includes("architecture") || promptLower.includes("repo") || promptLower.includes("codebase")) resolvedType = "architecture";
      else if (promptLower.includes("ocr") || promptLower.includes("scan") || promptLower.includes("read this image")) resolvedType = "ocr";
      else if (promptLower.includes("transcrib") || promptLower.includes("speech") || promptLower.includes("audio")) resolvedType = "transcription";
      else resolvedType = "analysis";
    }

    const bestModel = findBestModel(resolvedType, priority);

    // ── Check route cache for repeated prompts ──
    if (prompt) {
      const cacheKey = `smartrouter:${simpleHash(prompt + resolvedType + priority)}`;
      const cached = routeCache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return NextResponse.json({
          success: true,
          cached: true,
          routing: {
            task_type: cached.taskType,
            priority,
            model_selected: cached.model,
            model_id: cached.modelId,
          },
          message: "Returned cached model selection (60s TTL)",
        });
      }
    }

    // If no prompt provided, just return the routing metadata
    if (!prompt) {
      return NextResponse.json({
        success: true,
        routing: {
          task_type: resolvedType,
          priority,
          model_selected: bestModel.name,
          model_id: bestModel.id,
          quality_score: bestModel.quality_score,
          avg_speed_ms: bestModel.avg_speed_ms,
          strengths: bestModel.strengths,
        },
      });
    }

    const nimKey = await getNimKey();
    if (!nimKey) {
      return NextResponse.json({ error: "NVIDIA_NIM_API_KEY not set" }, { status: 500 });
    }

    // ==========================================
    // LONG-TERM SWARM MEMORY (PINECONE + NEMOTRON RAG)
    // ==========================================
    let contextMemory = "";
    
    // Using a try-catch so routing never fails even if memory is offline
    try {
      const pineconeKey = process.env.PINECONE_API_KEY;
      if (pineconeKey) {
        // 1. Embed the user's prompt using free Nemotron 1B
        const embedRes = await fetch("https://integrate.api.nvidia.com/v1/embeddings", {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${nimKey}` },
          body: JSON.stringify({
            model: "nvidia/llama-3.2-nv-embedqa-1b-v2",
            input: [prompt],
            input_type: "query",
            encoding_format: "float",
            truncate: "NONE"
          }),
        });
        
        if (embedRes.ok) {
          const embedData = await embedRes.json();
          const vector = embedData.data[0].embedding;
          
          // 2. Query Pinecone for relevant past interactions (simulated HTTP endpoint structure)
          const pcHost = process.env.PINECONE_HOST || "sovereign-memory.svc.pinecone.io";
          const queryRes = await fetch(`https://${pcHost}/query`, {
            method: "POST",
            headers: { "Api-Key": pineconeKey, "Content-Type": "application/json" },
            body: JSON.stringify({
              vector,
              topK: 3,
              includeMetadata: true
            })
          });
          
          if (queryRes.ok) {
            const memoryData = await queryRes.json();
            if (memoryData.matches?.length > 0) {
              contextMemory = "PAST SWARM MEMORY:\n" + memoryData.matches
                .map((m: { metadata?: { text?: string }; id: string }) => `- ${m.metadata?.text || m.id}`)
                .join("\n");
            }
          }
        }
      }
    } catch (memLogErr) {
      console.error("Swarm Memory Context Fail:", memLogErr);
    }

    // ==========================================
    // SKILL AUTO-ACTIVATION (Google-inspired)
    // ==========================================
    let skillContext = "";
    let activatedSkillNames: string[] = [];
    try {
      const skillResult = await enhanceWithSkills(prompt, {
        maxSkills: 2,
        enableGrounding: false, // Skip URL fetching for speed
      });
      skillContext = skillResult.context;
      activatedSkillNames = skillResult.activatedSkills.map(s => s.skill.name);
    } catch {
      // Skills are optional — never block routing
    }

    // ==========================================
    // EXECUTE AGENT WITH MEMORY + SKILLS
    // ==========================================
    const start = Date.now();
    let systemPrompt = "You are an elite expert agent.";
    if (contextMemory) {
      systemPrompt += `\n\nUse the following past memory context to inform your answer if relevant:\n${contextMemory}`;
    }
    if (skillContext) {
      systemPrompt += skillContext;
    }

    const res = await fetch("https://integrate.api.nvidia.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${nimKey}` },
      body: JSON.stringify({
        model: bestModel.id,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: prompt }
        ],
        max_tokens: 1024,
        temperature: 0.7,
      }),
    });

    const data = await res.json();
    const finalResult = data?.choices?.[0]?.message?.content || String(data.error?.message || "Generation failed.");

    // ── Write to route cache ──
    const cacheKey = `smartrouter:${simpleHash(prompt + resolvedType + priority)}`;
    routeCache.set(cacheKey, {
      model: bestModel.name,
      modelId: bestModel.id,
      taskType: resolvedType,
      timestamp: Date.now(),
    });
    // Evict stale entries when cache grows large
    if (routeCache.size > 200) {
      const now = Date.now();
      for (const [k, v] of routeCache) {
        if (now - v.timestamp > CACHE_TTL) routeCache.delete(k);
      }
    }

    return NextResponse.json({
      success: true,
      routing: {
        task_type: resolvedType,
        priority,
        model_selected: bestModel.name,
        model_id: bestModel.id,
        quality_score: bestModel.quality_score,
        memory_loaded: !!contextMemory,
        skills_activated: activatedSkillNames,
      },
      result: finalResult,
      duration_ms: Date.now() - start,
    });
  } catch (error) {
    return NextResponse.json({ error: "Router error", details: String(error) }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({
    status: "Intelligent Model Router — Active",
    models: MODEL_REGISTRY.length,
    task_types: Object.keys(TASK_CATEGORY_MAP),
    registry: MODEL_REGISTRY.map(m => ({
      name: m.name,
      strengths: m.strengths,
      quality: m.quality_score,
      speed: `${m.avg_speed_ms}ms`,
    })),
  });
}
