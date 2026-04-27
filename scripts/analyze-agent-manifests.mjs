#!/usr/bin/env node
/**
 * Auto-generate src/lib/agent-manifests.generated.ts from per-agent
 * static analysis of src/app/api/_agents/<slug>/route.ts.
 *
 * For every agent we extract:
 *   - models[]   from imports + call patterns
 *   - tools[]    from third-party SDK imports / fetch hostnames
 *   - signals[]  from db.* + fetch + email/voice/browser/payment patterns
 *   - pii        from createAgentRoute({ piiGuardMode })
 *
 * Then derive:
 *   - tier         via lib/agent-manifest.ts:deriveTierFromSignals
 *   - confidence   based on the strength + count of signals
 *   - outputClass  heuristic from agent-name keywords + tier
 *
 * Why static analysis (not runtime introspection):
 *   - Auditor LLMs need a stable artifact published BEFORE any
 *     request fires; runtime introspection only works after.
 *   - Static signals are deterministic across deploys.
 *   - It catches bugs where an agent SAYS it's Tier 1 but actually
 *     calls db.insert() — the signal exposes the misclassification.
 *
 * Run:
 *   - `npm run gen:registry`   ← also runs this analyzer
 *   - `node scripts/analyze-agent-manifests.mjs --report` (show
 *      coverage + low-confidence agents)
 */

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const AGENTS_DIR = resolve(ROOT, "src/app/api/_agents");
const OUTPUT = resolve(ROOT, "src/lib/agent-manifests.generated.ts");

// ─── Patterns ────────────────────────────────────────────────────

const SIGNAL_PATTERNS = [
  // db_write — actually mutating data
  { kind: "db_write", re: /\bdb\.(?:insert|update|delete)\(/g },
  // db_read — read-only DB access (drizzle + raw SQL)
  { kind: "db_read", re: /\bdb\.select\(|db\.query\.\w+\.find\w+\(|db\.execute\(/g },
  // model_call — reaching for a foundation model. Expanded to catch:
  //   - createVisionAgentRoute (always invokes a vision model under the hood)
  //   - nim variants (nimChat, nimEmbed, nimRerank)
  //   - generateText/generateObject (AI SDK)
  //   - ai.messages.* (Anthropic SDK)
  //   - groqChat / groqEmbed
  {
    kind: "model_call",
    re: /\b(?:nimChat|nimEmbed|nimRerank|ai|research_ai|consensus|anthropic\.messages\.create|openai\.chat\.completions\.create|geminiText|geminiVision|generateText|generateObject|groqChat|groqEmbed|createVisionAgentRoute)\s*\(/g,
  },
  // email_send — outbound email (resend, sendgrid, postmark, mailgun)
  {
    kind: "email_send",
    re: /\b(?:resend\.emails\.send|sendEmail|sendMail|sgMail\.send|postmark\.|mailgun\.messages\.create)\(/g,
  },
  // voice_call — outbound voice (twilio voice, livekit, elevenlabs TTS,
  // magpie ASR, voice-* agents). Also catches `voice-` slug heuristic
  // via the model_call layer above (createVoiceRoute).
  {
    kind: "voice_call",
    re: /\b(?:twilio\.calls\.create|voiceAgent|elevenlabs\.|magpie|livekit\.|createVoiceAgent)/g,
  },
  // browser_control — computer-use / playwright. Recognize the
  // Anthropic computer-use tool definition string.
  {
    kind: "browser_control",
    re: /\b(?:Anthropic.*computer-use|playwright|chromium\.launch|computer_20241022|browser_20250124|claude-3-5-sonnet.*computer)/g,
  },
  // file_write — local FS mutation
  {
    kind: "file_write",
    re: /\b(?:writeFileSync|fs\.writeFile|persistToDisk|appendFileSync|createWriteStream)\(/g,
  },
  // payment_op — stripe/yoco/lemon SDK calls
  {
    kind: "payment_op",
    re: /\b(?:stripe\.\w+\.create|stripe\.subscriptions|yoco\.\w+|charges\.create|lemon\.checkouts\.create)\(/g,
  },
  // uses_byok — pulling user-supplied keys from settings
  {
    kind: "uses_byok",
    re: /\b(?:userSettings\.apiKeys|safeDecrypt\(.*apiKeys)\b/g,
  },
  // dispatches — agent-to-agent dispatch / orchestration. These agents
  // delegate to other agents whose tier the orchestrator can't know
  // statically; classify as Tier 2 by default (writes happen via children).
  {
    kind: "db_write", // orchestrators commonly write a coordination row
    re: /\b(?:runAgent|invokeAgent|dispatchAgent|spawnChild|orchestrator\.run)\s*\(/g,
  },
];

const EXTERNAL_FETCH_RE = /\bfetch\s*\(\s*["'`]?(?:https?:\/\/|process\.env\.\w*_(?:URL|ENDPOINT))/g;

// Imports → model providers
const PROVIDER_IMPORTS = [
  { provider: "anthropic",   re: /from\s+["']@anthropic-ai\/sdk["']|new\s+Anthropic\b/ },
  { provider: "google",      re: /from\s+["']@google\/generative-ai["']|new\s+GoogleGenerativeAI\b|geminiText/ },
  { provider: "openai",      re: /from\s+["']openai["']|new\s+OpenAI\b/ },
  { provider: "groq",        re: /from\s+["']groq-sdk["']|groqChat\(|new\s+Groq\b/ },
  { provider: "nvidia-nim",  re: /\bnimChat|@\/lib\/nvidia/ },
  { provider: "cerebras",    re: /\bcerebras|@cerebras\/cerebras_cloud_sdk/ },
  { provider: "ollama",      re: /\bollama|@\/lib\/ollama/ },
  { provider: "xai",         re: /\bgrok\b|x\.ai/ },
  { provider: "mistral",     re: /@mistralai\/mistralai|mistral\.chat\.complete/ },
  { provider: "cohere",      re: /from\s+["']cohere-ai["']/ },
  { provider: "openrouter",  re: /openrouter\.ai|openrouter/i },
  { provider: "together",    re: /together\.ai|together-ai/ },
  { provider: "databricks",  re: /databricks\.com\/serving/ },
  { provider: "replicate",   re: /from\s+["']replicate["']/ },
];

// Third-party SDK imports → tools
const TOOL_IMPORTS = [
  { name: "stripe",       re: /from\s+["']stripe["']/, origin: "stripe.com" },
  { name: "twilio",       re: /from\s+["']twilio["']/, origin: "twilio.com" },
  { name: "resend",       re: /from\s+["']resend["']/, origin: "resend.com" },
  { name: "sendgrid",     re: /from\s+["']@sendgrid\//, origin: "sendgrid.com" },
  { name: "slack",        re: /from\s+["']@slack\//, origin: "slack.com" },
  { name: "hubspot",      re: /from\s+["']@hubspot\//, origin: "hubspot.com" },
  { name: "salesforce",   re: /jsforce/, origin: "salesforce.com" },
  { name: "tavily",       re: /from\s+["']@tavily\//, origin: "tavily.com" },
  { name: "elevenlabs",   re: /elevenlabs/, origin: "elevenlabs.io" },
  { name: "firecrawl",    re: /firecrawl/, origin: "firecrawl.dev" },
  { name: "apollo",       re: /apollo\.io/, origin: "apollo.io" },
  { name: "clearbit",     re: /clearbit\.com/, origin: "clearbit.com" },
  { name: "calendly",     re: /calendly\.com/, origin: "calendly.com" },
  { name: "googleCalendar", re: /googleapis\.com\/calendar/, origin: "googleapis.com" },
];

// ─── Helpers ─────────────────────────────────────────────────────

async function collectSlugs() {
  const entries = await readdir(AGENTS_DIR, { withFileTypes: true });
  const out = [];
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    const route = join(AGENTS_DIR, e.name, "route.ts");
    try {
      const s = await stat(route);
      if (s.isFile()) out.push(e.name);
    } catch { /* dir without route.ts → skip */ }
  }
  return out.sort((a, b) => a.localeCompare(b));
}

function extractSignals(source) {
  const signals = [];
  for (const { kind, re } of SIGNAL_PATTERNS) {
    const matches = source.match(re);
    if (matches && matches.length > 0) {
      signals.push({ kind, detail: `${matches.length} occurrence${matches.length === 1 ? "" : "s"}` });
    }
  }
  // external_fetch is special — only count fetch() calls to a URL we
  // can confidently say is off-platform (starts with http(s):// or
  // resolves env-var URL). fetch() to a relative URL stays inside
  // Sovereign and isn't a tier-up signal.
  const externalFetches = source.match(EXTERNAL_FETCH_RE);
  if (externalFetches && externalFetches.length > 0) {
    signals.push({
      kind: "external_fetch",
      detail: `${externalFetches.length} occurrence${externalFetches.length === 1 ? "" : "s"}`,
    });
  }
  return signals;
}

function extractModels(source) {
  const found = [];
  for (const { provider, re } of PROVIDER_IMPORTS) {
    if (re.test(source)) {
      // Pick a representative inference function name from the source
      // by scanning for a few canonical call sites; default to "import".
      let inferenceFn = "import";
      const callRe = /(nimChat|ai|research_ai|geminiText|anthropic\.messages\.create|openai\.chat\.completions\.create|groqChat|consensus)\s*\(/;
      const m = source.match(callRe);
      if (m) inferenceFn = m[1];
      found.push({ provider, inferenceFn });
    }
  }
  return found;
}

function extractTools(source) {
  const tools = [];
  for (const { name, re, origin } of TOOL_IMPORTS) {
    if (re.test(source)) tools.push({ name, origin });
  }
  return tools;
}

function extractPiiMode(source) {
  const m = source.match(/piiGuardMode\s*:\s*["'](mask|flag|skip)["']/);
  return m ? m[1] : "default-mask";
}

function extractActionTierOverride(source) {
  const m = source.match(/actionTier\s*:\s*([1-3])/);
  return m ? Number(m[1]) : null;
}

function classifyOutput(slug, tier, signals) {
  // Crude heuristic — auditor agents reading this can see the
  // rationale via `signals[]` so it's transparent.
  const lc = slug.toLowerCase();
  if (
    lc.includes("public") ||
    lc.includes("seo") ||
    lc.includes("blog-gen") ||
    lc.includes("press-release")
  ) {
    return "public";
  }
  if (
    lc.includes("contract") ||
    lc.includes("legal") ||
    lc.includes("medical") ||
    lc.includes("hipaa") ||
    signals.some((s) => s.kind === "uses_byok")
  ) {
    return "confidential";
  }
  return tier === 1 ? "tenant-private" : "tenant-private";
}

function classifierConfidence(signals, models, tools) {
  // Confidence reflects how much the analyzer "sees" — agents with
  // many signals are easy to classify; those with few are guesses.
  const total = signals.length + models.length + tools.length;
  if (total >= 5) return 0.95;
  if (total >= 3) return 0.85;
  if (total >= 1) return 0.7;
  return 0.45; // extremely thin — likely a stub or template clone
}

// ─── Main ────────────────────────────────────────────────────────

function renderManifestsFile(manifests) {
  const lines = [
    "/**",
    " * AUTO-GENERATED — DO NOT EDIT BY HAND.",
    " *",
    " * Produced by scripts/analyze-agent-manifests.mjs. Each entry derives",
    " * from static analysis of src/app/api/_agents/<slug>/route.ts.",
    " * Manual overrides go in src/lib/agent-manifest-overrides.ts.",
    " *",
    ` * Generated at: ${new Date().toISOString()}`,
    ` * Agent count: ${manifests.length}`,
    " */",
    "",
    'import type { AgentManifest } from "./agent-manifest";',
    "",
    "export const AGENT_MANIFESTS: Record<string, AgentManifest> = {",
  ];

  for (const m of manifests) {
    lines.push(`  ${JSON.stringify(m.slug)}: ${JSON.stringify(m, null, 2).replace(/\n/g, "\n  ")},`);
  }
  lines.push("};");
  lines.push("");
  lines.push("/** Total manifests in this build (used by weekly-health.mjs). */");
  lines.push(`export const AGENT_MANIFEST_COUNT = ${manifests.length};`);
  lines.push("");

  return lines.join("\n");
}

async function main() {
  const slugs = await collectSlugs();
  const manifests = [];
  const lowConfidence = [];

  for (const slug of slugs) {
    const path = join(AGENTS_DIR, slug, "route.ts");
    const source = await readFile(path, "utf8");

    const signals = extractSignals(source);
    const models = extractModels(source);
    const tools = extractTools(source);
    const piiMode = extractPiiMode(source);

    const piiHandlesByDesign = piiMode === "flag";

    const derived = (await import("../src/lib/agent-manifest.js").catch(() => null))?.deriveTierFromSignals
      ? null // we'll inline the rule for stability
      : null;

    // Inline tier derivation (mirrors lib/agent-manifest.ts to keep
    // the generator a one-shot ESM script with no TS compile step).
    const kinds = new Set(signals.map((s) => s.kind));
    let tier;
    let tierReason;
    if (
      kinds.has("browser_control") ||
      kinds.has("payment_op") ||
      kinds.has("voice_call") ||
      kinds.has("email_send")
    ) {
      const why = [
        kinds.has("browser_control") ? "browser control" : null,
        kinds.has("payment_op") ? "payment operations" : null,
        kinds.has("voice_call") ? "voice calls" : null,
        kinds.has("email_send") ? "email send" : null,
      ].filter(Boolean).join(" + ");
      tier = 3;
      tierReason = `Tier 3: ${why} require admin approval`;
    } else if (kinds.has("db_write") || kinds.has("file_write")) {
      tier = 2;
      tierReason = "Tier 2: writes data — user should confirm before execute";
    } else if (kinds.has("external_fetch")) {
      tier = 2;
      tierReason = "Tier 2: network egress to a non-platform host";
    } else {
      tier = 1;
      tierReason = "Tier 1: read-only / inference-only / no side effects";
    }

    const tierOverride = extractActionTierOverride(source);
    const tierOverridden = tierOverride !== null && tierOverride !== tier;
    if (tierOverridden) {
      tier = tierOverride;
      tierReason += ` (overridden to Tier ${tierOverride} via createAgentRoute config)`;
    }

    const confidence = classifierConfidence(signals, models, tools);
    if (confidence < 0.6) lowConfidence.push(slug);

    const manifest = {
      slug,
      tier,
      tierReason,
      ...(tierOverridden ? { tierOverridden: true } : {}),
      models,
      tools,
      pii: { guardMode: piiMode, handlesByDesign: piiHandlesByDesign },
      outputClass: classifyOutput(slug, tier, signals),
      signals,
      classifierConfidence: confidence,
    };
    manifests.push(manifest);
    void derived;
  }

  // Coverage stats for the gen log.
  const tierCounts = { 1: 0, 2: 0, 3: 0 };
  for (const m of manifests) tierCounts[m.tier]++;

  await writeFile(OUTPUT, renderManifestsFile(manifests), "utf8");

  // eslint-disable-next-line no-console -- intentional build diagnostic
  console.log(
    `[manifests] wrote ${manifests.length} agents → ${OUTPUT}\n` +
    `[manifests] tier breakdown: ${tierCounts[1]} tier-1, ${tierCounts[2]} tier-2, ${tierCounts[3]} tier-3\n` +
    `[manifests] low-confidence agents (<0.6): ${lowConfidence.length}` +
    (lowConfidence.length > 0
      ? `\n[manifests]   ${lowConfidence.slice(0, 10).join(", ")}${lowConfidence.length > 10 ? ` … (+${lowConfidence.length - 10} more)` : ""}`
      : ""),
  );

  if (process.argv.includes("--report")) {
    console.log("\n[manifests] Low-confidence agents — manual review recommended:");
    for (const s of lowConfidence) console.log(`  - ${s}`);
  }
}

main().catch((err) => {
  console.error("[manifests] failed:", err);
  process.exit(1);
});
