/**
 * Manually-maintained agent registry.
 *
 * Every agent whose route.ts lives at src/app/api/_agents/<slug>/route.ts
 * MAY be bundled here so Vercel's serverless packer can see the import
 * paths. Not all on-disk agents are listed — only the 97 entries below
 * are wired into the serverless bundle.
 *
 * Count drift:
 *   On-disk agent route folders: 140
 *   Listed in this registry:     97
 *   Marketing surfaces claim:    140 (the truthful disk count, set in
 *                                page.tsx / layout.tsx / SEO copy)
 *
 * To wire a new agent into the registry, append a line below + run
 * `npm run typecheck` to confirm the import path resolves. The
 * registry-regenerator script flagged in earlier comments was never
 * implemented; flagged for Wave 32 follow-up.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type RouteModule = Record<string, any>;

export const AGENT_REGISTRY: Record<string, () => Promise<RouteModule>> = {
  "agri-intel": () => import("@/app/api/_agents/agri-intel/route"),
  "abm-artillery": () => import("@/app/api/_agents/abm-artillery/route"),
  "ad-report": () => import("@/app/api/_agents/ad-report/route"),
  ads: () => import("@/app/api/_agents/ads/route"),
  "agent-performance": () =>
    import("@/app/api/_agents/agent-performance/route"),
  "agentic-chain": () => import("@/app/api/_agents/agentic-chain/route"),
  "agentic-planner": () => import("@/app/api/_agents/agentic-planner/route"),
  "agency-packet": () => import("@/app/api/_agents/agency-packet/route"),
  "ai-gateway": () => import("@/app/api/_agents/ai-gateway/route"),
  "growth-pulse": () => import("@/app/api/_agents/growth-pulse/route"),
  "listing-pulse": () => import("@/app/api/_agents/listing-pulse/route"),
  analytics: () => import("@/app/api/_agents/analytics/route"),
  asr: () => import("@/app/api/_agents/asr/route"),
  audit: () => import("@/app/api/_agents/audit/route"),
  "auto-heal": () => import("@/app/api/_agents/auto-heal/route"),
  "auto-onboard": () => import("@/app/api/_agents/auto-onboard/route"),
  benchmark: () => import("@/app/api/_agents/benchmark/route"),
  billing: () => import("@/app/api/_agents/billing/route"),
  "blog-gen": () => import("@/app/api/_agents/blog-gen/route"),
  booking: () => import("@/app/api/_agents/booking/route"),
  "brand-audit": () => import("@/app/api/_agents/brand-audit/route"),
  "brand-voice": () => import("@/app/api/_agents/brand-voice/route"),
  calendar: () => import("@/app/api/_agents/calendar/route"),
  "case-study": () => import("@/app/api/_agents/case-study/route"),
  "chain-reactor": () => import("@/app/api/_agents/chain-reactor/route"),
  "claude-capabilities": () =>
    import("@/app/api/_agents/claude-capabilities/route"),
  "claude-think": () => import("@/app/api/_agents/claude-think/route"),
  "claw-queue": () => import("@/app/api/_agents/claw-queue/route"),
  "client-report": () => import("@/app/api/_agents/client-report/route"),
  closer: () => import("@/app/api/_agents/closer/route"),
  "code-agent": () => import("@/app/api/_agents/code-agent/route"),
  "code-reviewer": () => import("@/app/api/_agents/code-reviewer/route"),
  "code-sandbox": () => import("@/app/api/_agents/code-sandbox/route"),
  "collab-room": () => import("@/app/api/_agents/collab-room/route"),
  comms: () => import("@/app/api/_agents/comms/route"),
  "competitive-radar": () =>
    import("@/app/api/_agents/competitive-radar/route"),
  competitor: () => import("@/app/api/_agents/competitor/route"),
  "competitor-scan": () => import("@/app/api/_agents/competitor-scan/route"),
  "competitor-rip": () => import("@/app/api/_agents/competitor-rip/route"),
  "computer-use": () => import("@/app/api/_agents/computer-use/route"),
  content: () => import("@/app/api/_agents/content/route"),
  "content-safety": () => import("@/app/api/_agents/content-safety/route"),
  "compliance-monitor": () =>
    import("@/app/api/_agents/compliance-monitor/route"),
  "contract-analyzer": () =>
    import("@/app/api/_agents/contract-analyzer/route"),
  coordinator: () => import("@/app/api/_agents/coordinator/route"),
  "cosmos-video": () => import("@/app/api/_agents/cosmos-video/route"),
  "creative-director": () =>
    import("@/app/api/_agents/creative-director/route"),
  "dashboard-stats": () => import("@/app/api/_agents/dashboard-stats/route"),
  "deep-search": () => import("@/app/api/_agents/deep-search/route"),
  "deep-think": () => import("@/app/api/_agents/deep-think/route"),
  "deepseek-r1": () => import("@/app/api/_agents/deepseek-r1/route"),
  design: () => import("@/app/api/_agents/design/route"),
  "digital-human": () => import("@/app/api/_agents/digital-human/route"),
  "doc-analyst": () => import("@/app/api/_agents/doc-analyst/route"),
  "doc-intel": () => import("@/app/api/_agents/doc-intel/route"),
  "email-onboard": () => import("@/app/api/_agents/email-onboard/route"),
  "email-sequence": () => import("@/app/api/_agents/email-sequence/route"),
  embed: () => import("@/app/api/_agents/embed/route"),
  "error-log": () => import("@/app/api/_agents/error-log/route"),
  feedback: () => import("@/app/api/_agents/feedback/route"),
  filmmaker: () => import("@/app/api/_agents/filmmaker/route"),
  firecrawl: () => import("@/app/api/_agents/firecrawl/route"),
  "florence-ocr": () => import("@/app/api/_agents/florence-ocr/route"),
  "flux-image": () => import("@/app/api/_agents/flux-image/route"),
  flywheel: () => import("@/app/api/_agents/flywheel/route"),
  "funnel-xray": () => import("@/app/api/_agents/funnel-xray/route"),
  "ghost-fleet": () => import("@/app/api/_agents/ghost-fleet/route"),
  "healthcare-docs": () => import("@/app/api/_agents/healthcare-docs/route"),
  "gliner-pii": () => import("@/app/api/_agents/gliner-pii/route"),
  "god-brain": () => import("@/app/api/_agents/god-brain/route"),
  "grounded-search": () => import("@/app/api/_agents/grounded-search/route"),
  "image-gen": () => import("@/app/api/_agents/image-gen/route"),
  imagen: () => import("@/app/api/_agents/imagen/route"),
  leads: () => import("@/app/api/_agents/leads/route"),
  marketplace: () => import("@/app/api/_agents/marketplace/route"),
  "meeting-notes": () => import("@/app/api/_agents/meeting-notes/route"),
  "meeting-transcriber": () =>
    import("@/app/api/_agents/meeting-transcriber/route"),
  memory: () => import("@/app/api/_agents/memory/route"),
  "meta-prompt": () => import("@/app/api/_agents/meta-prompt/route"),
  "multilingual-voice": () =>
    import("@/app/api/_agents/multilingual-voice/route"),
  "music-gen": () => import("@/app/api/_agents/music-gen/route"),
  nemoclaw: () => import("@/app/api/_agents/nemoclaw/route"),
  "nemoclaw-setup": () => import("@/app/api/_agents/nemoclaw-setup/route"),
  "nemotron-omni": () => import("@/app/api/_agents/nemotron-omni/route"),
  "nemotron3-super": () => import("@/app/api/_agents/nemotron3-super/route"),
  ocr: () => import("@/app/api/_agents/ocr/route"),
  "omni-search": () => import("@/app/api/_agents/omni-search/route"),
  orchestrate: () => import("@/app/api/_agents/orchestrate/route"),
  orchestrator: () => import("@/app/api/_agents/orchestrator/route"),
  "organic-content": () => import("@/app/api/_agents/organic-content/route"),
  outbound: () => import("@/app/api/_agents/outbound/route"),
  "prior-auth": () => import("@/app/api/_agents/prior-auth/route"),
  "page-builder": () => import("@/app/api/_agents/page-builder/route"),
  "page-builder-stream": () =>
    import("@/app/api/_agents/page-builder-stream/route"),
  "pii-guard": () => import("@/app/api/_agents/pii-guard/route"),
  "pii-redactor": () => import("@/app/api/_agents/pii-redactor/route"),
  pipeline: () => import("@/app/api/_agents/pipeline/route"),
  "predictive-deploy": () =>
    import("@/app/api/_agents/predictive-deploy/route"),
  "programmatic-seo": () => import("@/app/api/_agents/programmatic-seo/route"),
  "proposal-generator": () =>
    import("@/app/api/_agents/proposal-generator/route"),
  "rag-pipeline": () => import("@/app/api/_agents/rag-pipeline/route"),
  "reasoning-chain": () => import("@/app/api/_agents/reasoning-chain/route"),
  replays: () => import("@/app/api/_agents/replays/route"),
  reputation: () => import("@/app/api/_agents/reputation/route"),
  rerank: () => import("@/app/api/_agents/rerank/route"),
  "scheduled-report": () => import("@/app/api/_agents/scheduled-report/route"),
  scheduler: () => import("@/app/api/_agents/scheduler/route"),
  seo: () => import("@/app/api/_agents/seo/route"),
  "seo-dominator": () => import("@/app/api/_agents/seo-dominator/route"),
  "site-assassin": () => import("@/app/api/_agents/site-assassin/route"),
  "smart-router": () => import("@/app/api/_agents/smart-router/route"),
  "social-router": () => import("@/app/api/_agents/social-router/route"),
  "sourcing-sprint": () => import("@/app/api/_agents/sourcing-sprint/route"),
  "supply-chain": () => import("@/app/api/_agents/supply-chain/route"),
  "super-agent": () => import("@/app/api/_agents/super-agent/route"),
  "support-bot": () => import("@/app/api/_agents/support-bot/route"),
  swarm: () => import("@/app/api/_agents/swarm/route"),
  "threat-hunt": () => import("@/app/api/_agents/threat-hunt/route"),
  "telegram-router": () => import("@/app/api/_agents/telegram-router/route"),
  translate: () => import("@/app/api/_agents/translate/route"),
  trigger: () => import("@/app/api/_agents/trigger/route"),
  "url-context": () => import("@/app/api/_agents/url-context/route"),
  "vertex-search": () => import("@/app/api/_agents/vertex-search/route"),
  verticals: () => import("@/app/api/_agents/verticals/route"),
  "video-gen": () => import("@/app/api/_agents/video-gen/route"),
  vision: () => import("@/app/api/_agents/vision/route"),
  "vision-analyze": () => import("@/app/api/_agents/vision-analyze/route"),
  "visual-reason": () => import("@/app/api/_agents/visual-reason/route"),
  voice: () => import("@/app/api/_agents/voice/route"),
  "voice-assistant": () => import("@/app/api/_agents/voice-assistant/route"),
  "voice-chat": () => import("@/app/api/_agents/voice-chat/route"),
  "voice-closer": () => import("@/app/api/_agents/voice-closer/route"),
  "voice-synth": () => import("@/app/api/_agents/voice-synth/route"),
  voicechat: () => import("@/app/api/_agents/voicechat/route"),
  "war-room": () => import("@/app/api/_agents/war-room/route"),
  "webhook-gateway": () => import("@/app/api/_agents/webhook-gateway/route"),
  "weekly-report": () => import("@/app/api/_agents/weekly-report/route"),
  whitelabel: () => import("@/app/api/_agents/whitelabel/route"),
  "workflow-engine": () => import("@/app/api/_agents/workflow-engine/route"),
  workflows: () => import("@/app/api/_agents/workflows/route"),
};

/**
 * AGENT_SLUGS — client-safe list of agent identifiers.
 *
 * Re-export this (not AGENT_REGISTRY) from "use client" components.
 * Importing AGENT_REGISTRY directly drags every agent route into the
 * client bundle via Turbopack's static analysis of the dynamic import
 * arms. This list is the slug surface alone — no route modules.
 */
export const AGENT_SLUGS: ReadonlyArray<string> = Object.freeze(
  Object.keys(AGENT_REGISTRY),
);
