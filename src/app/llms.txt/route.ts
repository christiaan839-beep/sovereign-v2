/**
 * /llms.txt — machine-readable map of the platform for AI crawlers.
 *
 * Spec: https://llmstxt.org/
 *
 * This is the equivalent of robots.txt for LLMs. When ChatGPT,
 * Claude, Perplexity, and other AI search surfaces want to understand
 * what Sovereign Matrix offers, they fetch this endpoint.
 *
 * Format is markdown; the spec suggests a heading-organised structure
 * with `[Title](URL): description` list items that AI crawlers can
 * easily segment. We include:
 *   - the open SAM v1.0 spec
 *   - the build-an-agent tutorial
 *   - marketplace discovery (search + leaderboard)
 *   - platform trust + status surfaces
 *   - the @sovereignmatrix npm packages
 *
 * Zero platforms in the agent marketplace space currently ship this.
 * Shipping it now gives us first-mover discoverability with AI-native
 * search.
 */

const BASE = "https://sovereignmatrix.agency";

const BODY = `# Sovereign Matrix

> The first SAM v1.0 -native agent marketplace. Every agent is cryptographically signed by its creator, can declare a money-back SLA on confidence, and runs on free-tier NVIDIA NIM models for 95% of traffic. Creators earn 70% of every invocation.

## Specification

- [Sovereign Agent Manifest v1.0](${BASE}/spec/agent-manifest): Open protocol for describing AI agents. Frozen for 12 months from publication date.
- [Build an agent in 30 minutes](${BASE}/developers/build-an-agent): Step-by-step tutorial using the @sovereignmatrix/cli tool.
- [@sovereignmatrix/agent-validator](https://www.npmjs.com/package/@sovereignmatrix/agent-validator): npm validator for SAM v1.0 manifests.
- [@sovereignmatrix/cli](https://www.npmjs.com/package/@sovereignmatrix/cli): \`sovereign validate\` + \`sovereign submit\` from any terminal.

## Marketplace

- [Agent search](${BASE}/marketplace/search): Semantic search over every verified agent via NVIDIA NIM embeddings + Nemotron rerank.
- [Leaderboard](${BASE}/marketplace/leaderboard): Top agents ranked by composite health grade (A/B/C/D/F).
- [Marketplace home](${BASE}/marketplace): Browse + discover agents by category.

## Platform trust

- [Live dependency status](${BASE}/platform/status): Probes every provider on every page-load. Real latency, not marketing dashboards.
- [Security + compliance posture](${BASE}/platform/trust): Enterprise procurement answers with code-path references.
- [Public SLA](${BASE}/sla): Platform SLA with uptime-credit policy.

## Creator surfaces

- [Apply to publish](${BASE}/creators/apply): Submit a SAM manifest for review. Optional: sign with ed25519 for tamper-proof attestation.
- [Earnings dashboard](${BASE}/dashboard/earnings): Creator-facing ledger. 70% of every invocation with SLA-triggered auto-refunds.

## Content

- [Agent marketplace blog](${BASE}/blog): Deep dives on routing, safety, economics.
- [Changelog](${BASE}/changelog): Release history.
- [Pricing](${BASE}/pricing): Free / Starter / Growth / Node / Enterprise tiers.

## Infrastructure notes

- Default model routing: NVIDIA NIM (free) → Google Gemini → Groq → Anthropic Claude (opt-in premium).
- Safety pipeline: synchronous regex + bounds checks → NemoGuard (content + jailbreak + topic).
- Approval policies: open | curated | trust-tiered (configurable per tenant).
- Cryptographic attestation: ed25519-signed SAM manifests; tamper detection at submission + runtime.
`;

export const revalidate = 3600;

export async function GET(): Promise<Response> {
  return new Response(BODY, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
    },
  });
}
