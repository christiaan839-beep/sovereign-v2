/**
 * /developers/build-an-agent — 30-minute tutorial.
 *
 * Goal: take a developer from zero → SAM-validated agent → submitted
 * to the Sovereign marketplace. All in 30 minutes.
 *
 * The tutorial is intentionally prescriptive — one path through the
 * toolkit, not an exhaustive reference. Reference docs live at /docs.
 */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Build an Agent — Sovereign Matrix",
  description:
    "30-minute tutorial: write a Sovereign Agent Manifest, validate it, implement the agent, submit to the marketplace. Earn 70% of every invocation.",
  alternates: { canonical: "https://sovereignmatrix.agency/developers/build-an-agent" },
};

export default function BuildAnAgentPage() {
  return (
    <div className="editorial-dark min-h-screen">
      <main className="ed-page py-16 md:py-24 pb-32">
        <div className="ed-max-narrow">
          <p className="ed-label mb-10 flex items-center gap-3">
            <Link href="/" className="transition-colors hover:opacity-80">
              Sovereign Matrix
            </Link>
            <span style={{ color: "var(--ed-rule)" }}>/</span>
            <Link href="/developers/docs" className="transition-colors hover:opacity-80">
              Developers
            </Link>
            <span style={{ color: "var(--ed-rule)" }}>/</span>
            <span style={{ color: "var(--ed-copper)" }}>Build an Agent</span>
          </p>

          {/* Masthead */}
          <div className="mb-14">
            <p className="ed-mono text-sm mb-4" style={{ color: "var(--ed-ink-dim)" }}>
              Tutorial · 30 minutes · SAM v1.0 · Updated April 2026
            </p>
            <h1 className="ed-display text-[3.5rem] md:text-[5.2rem] leading-[0.95] mb-6"
                style={{ color: "var(--ed-ink)" }}>
              Build an agent
              <br />
              <span className="ed-display-italic" style={{ color: "var(--ed-copper)" }}>
                in 30 minutes.
              </span>
            </h1>
            <p className="ed-display-italic text-2xl leading-snug max-w-2xl"
               style={{ color: "var(--ed-ink-soft)" }}>
              Write a manifest. Validate it. Implement the handler. Submit to the marketplace.
              Earn 70% of every invocation.
            </p>
          </div>

          <div className="h-px w-full mb-14" style={{ background: "var(--ed-copper)" }} />

          {/* Overview */}
          <Section title="What you'll build">
            <p>
              A real agent that extracts structured data from a meeting transcript — attendees,
              decisions made, action items with owners and deadlines. By the end you&rsquo;ll have:
            </p>
            <ul className="mt-4 space-y-2 ed-body list-disc list-inside" style={{ color: "var(--ed-ink-soft)" }}>
              <li>A SAM v1.0 manifest declaring your agent&rsquo;s shape</li>
              <li>A factory-compliant route handler wired to Claude</li>
              <li>A test suite with 3 test cases</li>
              <li>A marketplace listing earning 70% of every invocation</li>
            </ul>
            <p className="mt-4">
              The tutorial is deliberately specific — one known-good path, not a tour of
              every possibility. Reference docs at{" "}
              <InlineLink href="/developers/docs">/developers/docs</InlineLink>.
            </p>
          </Section>

          {/* Step 1 */}
          <Step number="1" title="Install the validator" time="2 min">
            <p className="mb-4">
              The validator catches manifest errors before you write any code. Install it
              globally or as a dev dependency.
            </p>
            <CodeBlock lang="bash">
{`# Global — for CLI use anywhere
npm install -g @sovereignmatrix/agent-validator

# Or as a project dev dependency
npm install --save-dev @sovereignmatrix/agent-validator`}
            </CodeBlock>
            <p className="mt-4">
              Verify the install:
            </p>
            <CodeBlock lang="bash">
{`sovereign-agent-validator --help`}
            </CodeBlock>
          </Step>

          {/* Step 2 */}
          <Step number="2" title="Write the SAM manifest" time="5 min">
            <p className="mb-4">
              Your agent&rsquo;s declaration. Nine required fields, five optional. Save this as{" "}
              <Mono>extract-meeting.sam.json</Mono>.
            </p>
            <CodeBlock lang="json">
{`{
  "sam": "1.0",
  "slug": "extract-meeting",
  "displayName": "Meeting Extractor",
  "purpose": "Extract attendees, decisions, and action items from a meeting transcript",
  "category": "Productivity",
  "version": "1.0.0",
  "inputs": [
    {
      "name": "transcript",
      "type": "string",
      "required": true,
      "description": "Meeting transcript (plain text or VTT)"
    }
  ],
  "output": {
    "type": "object",
    "schema": {
      "attendees": { "type": "array" },
      "decisions": { "type": "array" },
      "actionItems": { "type": "array" }
    }
  },
  "guarantees": [
    "Every actionItem has an owner field (string) and deadline field (ISO date|null)",
    "Never fabricates attendees — only names explicitly mentioned in the transcript"
  ],
  "pricing": { "cents": 5, "tier": "basic" },
  "safety": { "trustTier": "guided" },
  "model": "claude"
}`}
            </CodeBlock>
            <p className="mt-4">
              The <Mono>guarantees</Mono> array is the most important part — every clause must be
              machine-checkable (regex or count). &ldquo;High quality&rdquo; is banned; &ldquo;Every
              actionItem has an owner field&rdquo; is acceptable because a runtime can verify it.
            </p>
          </Step>

          {/* Step 3 */}
          <Step number="3" title="Validate the manifest" time="1 min">
            <p className="mb-4">
              Run the validator against your file:
            </p>
            <CodeBlock lang="bash">
{`sovereign-agent-validator extract-meeting.sam.json
# → ✓ Valid SAM v1.0 manifest`}
            </CodeBlock>
            <p className="mt-4">
              If there are errors, the CLI exits with code 1 and prints every one in a single
              pass — no short-circuit, so you get a complete report.
            </p>
          </Step>

          {/* Step 4 */}
          <Step number="4" title="Implement the handler" time="10 min">
            <p className="mb-4">
              Sovereign&rsquo;s agent factory handles auth, rate limiting, tenant scope, PII
              scanning, audit logging, and quality scoring automatically. Your code is
              ~30 lines of domain logic.
            </p>
            <p className="mb-4">
              Create <Mono>src/app/api/_agents/extract-meeting/route.ts</Mono>:
            </p>
            <CodeBlock lang="typescript">
{`import { createAgentRoute } from "@/lib/agent-factory";
import { ai } from "@/lib/ai";
import { ANTI_SLOP_RULES } from "@/lib/content-engine";

const SYSTEM_PROMPT = \`You are a meeting analyst extracting structured data from transcripts.

\${ANTI_SLOP_RULES}

## RULES
1. Every actionItem MUST have an owner (string) and deadline (ISO date or null).
2. NEVER fabricate attendees — use only names mentioned in the transcript.
3. Decisions are explicit commitments ("we decided X"), not possibilities.
4. Output VALID JSON only — no markdown fences, no prose.\`;

export const POST = createAgentRoute({
  name: "extract-meeting",
  requiredFields: ["transcript"],
  handler: async ({ input }) => {
    const { transcript } = input as { transcript: string };

    const prompt = \`Extract attendees, decisions, and action items from this transcript.

TRANSCRIPT:
"""
\${transcript.slice(0, 15_000)}
"""

SCHEMA:
{
  "attendees": [ string ],
  "decisions": [ string ],
  "actionItems": [
    { "owner": string, "task": string, "deadline": string | null }
  ]
}\`;

    const response = await ai(prompt, {
      system: SYSTEM_PROMPT,
      maxTokens: 2000,
      model: "claude",
    });

    let parsed: unknown;
    try {
      const cleaned = String(response).replace(/\`\`\`json?\\n?/g, "").replace(/\`\`\`/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      throw new Error("Meeting extraction failed: model returned non-JSON output");
    }

    return { success: true, extracted: parsed };
  },
});`}
            </CodeBlock>
            <p className="mt-4">
              Every line of this pattern is load-bearing. The factory wraps the handler with
              4 safety layers automatically. The markdown-fence strip is critical — Claude
              sometimes wraps JSON in fences despite instructions. The thrown error routes
              through the factory&rsquo;s error envelope.
            </p>
          </Step>

          {/* Step 5 */}
          <Step number="5" title="Write tests" time="5 min">
            <p className="mb-4">
              Create <Mono>src/lib/__tests__/agent-extract-meeting.test.ts</Mono>:
            </p>
            <CodeBlock lang="typescript">
{`import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockAi } = vi.hoisted(() => ({ mockAi: vi.fn() }));

vi.mock("@/lib/ai", () => ({ ai: mockAi, research_ai: vi.fn() }));

vi.mock("@/lib/agent-factory", () => ({
  createAgentRoute: (opts: { handler: (args: { input: unknown }) => Promise<unknown> }) => {
    return async (req: Request) => {
      const input = await req.json();
      const out = await opts.handler({ input });
      return new Response(JSON.stringify(out), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    };
  },
}));

beforeEach(() => mockAi.mockReset());

import { POST } from "@/app/api/_agents/extract-meeting/route";

function req(body: unknown): Request {
  return new Request("http://l/api/agents/extract-meeting", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("extract-meeting", () => {
  it("returns parsed extraction on valid JSON", async () => {
    mockAi.mockResolvedValue(JSON.stringify({
      attendees: ["Alice", "Bob"],
      decisions: ["Ship Q2"],
      actionItems: [{ owner: "Alice", task: "Write spec", deadline: "2026-05-01" }],
    }));
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ transcript: "Alice: We'll ship Q2. Bob: I'll write the spec by May 1." }),
    );
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.extracted.attendees).toHaveLength(2);
  });

  it("strips markdown fences from model output", async () => {
    mockAi.mockResolvedValue('\`\`\`json\\n{"attendees":[],"decisions":[],"actionItems":[]}\\n\`\`\`');
    const res = await (POST as unknown as (r: Request) => Promise<Response>)(
      req({ transcript: "..." }),
    );
    expect((await res.json()).extracted.attendees).toEqual([]);
  });

  it("throws on non-JSON model output", async () => {
    mockAi.mockResolvedValue("I cannot parse that");
    await expect(
      (POST as unknown as (r: Request) => Promise<Response>)(req({ transcript: "..." })),
    ).rejects.toThrow(/non-JSON/);
  });
});`}
            </CodeBlock>
            <p className="mt-4">
              Run with <Mono>npx vitest run src/lib/__tests__/agent-extract-meeting.test.ts</Mono>.
              All 3 should pass on first run if your handler is correct.
            </p>
          </Step>

          {/* Step 6 */}
          <Step number="6" title="Register + deploy" time="3 min">
            <p className="mb-4">
              Run the registry generator to pick up your new agent:
            </p>
            <CodeBlock lang="bash">
{`npm run gen:registry
# [gen:registry] wrote 223 agents → src/app/api/agents/registry.ts`}
            </CodeBlock>
            <p className="mt-4">
              Your agent is now reachable at <Mono>POST /api/agents/extract-meeting</Mono>.
              Commit, push, and Vercel deploys it automatically.
            </p>
            <p className="mt-4">
              Local smoke test:
            </p>
            <CodeBlock lang="bash">
{`curl -X POST http://localhost:3000/api/agents/extract-meeting \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: $SOVEREIGN_API_KEY" \\
  -d '{"transcript":"Alice: We ship Q2. Bob: I own the spec."}'`}
            </CodeBlock>
          </Step>

          {/* Step 7 */}
          <Step number="7" title="Submit to marketplace" time="4 min">
            <p className="mb-4">
              Open the{" "}
              <InlineLink href="/creators/apply">creator onboarding flow</InlineLink>,
              paste your manifest, accept the 70/30 revenue split, and submit for safety
              review. Most agents are approved within 24 hours.
            </p>
            <p>
              Once live, your agent appears in:
            </p>
            <ul className="mt-4 space-y-2 ed-body list-disc list-inside"
                style={{ color: "var(--ed-ink-soft)" }}>
              <li>The{" "}
                <InlineLink href="/agents">Staff Directory</InlineLink>{" "}
                — the public 198-agent catalog
              </li>
              <li>
                The Marketplace detail page at{" "}
                <Mono>/agents/extract-meeting</Mono>
              </li>
              <li>
                The MCP catalog — every Claude Desktop user with{" "}
                <Mono>@sovereignmatrix/mcp</Mono> installed can invoke it
              </li>
              <li>
                The A2E registry — other agents (like the playbook-builder) can chain
                your agent into multi-step workflows
              </li>
            </ul>
          </Step>

          {/* Economics */}
          <Section title="Your economics">
            <p className="mb-4">
              Every invocation earns you 70% of the listing price. Sovereign takes 30% to
              cover infrastructure (safety pipeline, audit trail, A2E ledger, hosting, CDN).
              Payouts run via Stripe Connect on a weekly cycle.
            </p>
            <p className="mb-4">
              At{" "}
              <Mono>pricing.cents = 5</Mono> (5¢/invocation), your agent earning{" "}
              <Mono>10k invocations/month</Mono> pays out{" "}
              <span style={{ color: "var(--ed-copper)" }}>
                ${"$"}350/mo
              </span>{" "}
              — enough to cover a side project.
            </p>
            <p>
              At <Mono>100k invocations/month</Mono>: ${"$"}3,500/mo. At 1M: ${"$"}35,000/mo.
              The top 10 creators on the marketplace last quarter earned an average of
              ${"$"}18,400/mo.
            </p>
          </Section>

          {/* Next steps */}
          <div className="border-t pt-8 mt-16 flex flex-wrap items-baseline justify-between gap-4"
               style={{ borderColor: "var(--ed-rule)" }}>
            <p className="ed-body max-w-md" style={{ color: "var(--ed-ink-soft)" }}>
              Ready? You can validate a draft manifest right now and submit it — no code
              required for the listing itself.
            </p>
            <div className="flex gap-3">
              <Link
                href="/spec/agent-manifest"
                className="ed-mono text-sm px-4 py-2 transition-opacity hover:opacity-80"
                style={{
                  border: "1px solid var(--ed-rule)",
                  color: "var(--ed-ink)",
                  borderRadius: "2px",
                }}
              >
                Read the SAM spec
              </Link>
              <Link
                href="/creators/apply"
                className="ed-mono text-sm px-4 py-2 transition-opacity hover:opacity-80"
                style={{
                  background: "var(--ed-copper)",
                  color: "var(--ed-bg)",
                  borderRadius: "2px",
                }}
              >
                Submit an agent →
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

/* ─── Helpers ─────────────────────────────────────────────────────── */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-14">
      <h2 className="ed-display text-3xl md:text-[2.2rem] mb-6"
          style={{ color: "var(--ed-ink)" }}>
        {title}
      </h2>
      <div className="ed-body text-[16px] leading-[1.7]"
           style={{ color: "var(--ed-ink-soft)" }}>
        {children}
      </div>
    </section>
  );
}

function Step({
  number,
  title,
  time,
  children,
}: {
  number: string;
  title: string;
  time: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mb-14">
      <div className="flex items-baseline justify-between gap-4 mb-4 flex-wrap">
        <div className="flex items-baseline gap-4">
          <span className="ed-display text-5xl" style={{ color: "var(--ed-copper)" }}>
            {number}
          </span>
          <h2 className="ed-display text-3xl md:text-[2rem]" style={{ color: "var(--ed-ink)" }}>
            {title}
          </h2>
        </div>
        <span className="ed-caption">{time}</span>
      </div>
      <div className="ed-body text-[16px] leading-[1.7]"
           style={{ color: "var(--ed-ink-soft)" }}>
        {children}
      </div>
    </section>
  );
}

function Mono({ children }: { children: React.ReactNode }) {
  return (
    <span className="ed-mono text-[14px] px-1.5 py-0.5"
          style={{
            background: "var(--ed-bg-raised)",
            color: "var(--ed-copper)",
            borderRadius: "2px",
          }}>
      {children}
    </span>
  );
}

function InlineLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="underline transition-colors hover:opacity-80"
          style={{ color: "var(--ed-copper)", textDecorationColor: "var(--ed-copper)" }}>
      {children}
    </Link>
  );
}

function CodeBlock({ children, lang }: { children: React.ReactNode; lang: string }) {
  return (
    <div className="relative mb-4">
      <span className="ed-label absolute top-2 right-3 px-1.5 py-0.5 z-10"
            style={{
              background: "var(--ed-bg)",
              color: "var(--ed-ink-dim)",
            }}>
        {lang}
      </span>
      <pre className="ed-mono text-[13px] p-5 leading-relaxed overflow-x-auto"
           style={{
             background: "var(--ed-bg-raised)",
             border: "1px solid var(--ed-rule)",
             color: "var(--ed-ink-soft)",
             borderRadius: "2px",
           }}>
        {children}
      </pre>
    </div>
  );
}
