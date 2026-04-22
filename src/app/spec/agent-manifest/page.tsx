/**
 * /spec/agent-manifest — The Sovereign Agent Manifest (SAM) v1.0 spec.
 *
 * This is the public protocol document. Any agent — built on Sovereign
 * Matrix or anywhere else — that conforms to SAM v1.0 can be listed on
 * the Sovereign marketplace, executed via the Sovereign runtime, and
 * paid via the A2E economy.
 *
 * Publishing this spec is the strategic move: it turns Sovereign from
 * a platform that runs agents into the infrastructure that every agent
 * runs on. Same move Shopify made with Liquid, Stripe made with their
 * Checkout schema, and OpenAI (late) tried with GPTs.
 *
 * The spec is deliberately minimal for v1. Every field is either
 * required-and-mechanical or optional-and-expressive. No convenience
 * fields. We'll resist the temptation to version-bump for a year.
 */

import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Sovereign Agent Manifest v1.0 — The Open Spec",
  description:
    "The open protocol for declaring AI agents. Any agent conforming to SAM v1.0 can run on the Sovereign Matrix runtime, list in the marketplace, and earn via the A2E economy. Published April 2026.",
  alternates: { canonical: "https://sovereignmatrix.agency/spec/agent-manifest" },
  openGraph: {
    title: "Sovereign Agent Manifest v1.0",
    description: "The open spec for AI agents. Conform once, run everywhere Sovereign runs.",
    url: "https://sovereignmatrix.agency/spec/agent-manifest",
    type: "article",
  },
};

export default function AgentManifestSpecPage() {
  return (
    <div className="editorial-dark min-h-screen">
      <main className="ed-page py-16 md:py-24 pb-32">
        <div className="ed-max-narrow">
          {/* Breadcrumb */}
          <p className="ed-label mb-10 flex items-center gap-3">
            <Link href="/" className="transition-colors hover:opacity-80">
              Sovereign Matrix
            </Link>
            <span style={{ color: "var(--ed-rule)" }}>/</span>
            <span>Spec</span>
            <span style={{ color: "var(--ed-rule)" }}>/</span>
            <span style={{ color: "var(--ed-copper)" }}>Agent Manifest v1.0</span>
          </p>

          {/* Masthead */}
          <div className="mb-14">
            <p className="ed-mono text-sm mb-4" style={{ color: "var(--ed-ink-dim)" }}>
              Published April 22, 2026 · Open protocol · MIT licensed
            </p>
            <h1 className="ed-display text-[3.5rem] md:text-[5.2rem] leading-[0.95] mb-6"
                style={{ color: "var(--ed-ink)" }}>
              Sovereign Agent
              <br />
              <span className="ed-display-italic" style={{ color: "var(--ed-copper)" }}>
                Manifest v1.0
              </span>
            </h1>
            <p className="ed-display-italic text-2xl leading-snug max-w-2xl"
               style={{ color: "var(--ed-ink-soft)" }}>
              The open protocol for declaring an AI agent. Conform once, run on any
              Sovereign-compatible runtime. List in the marketplace. Earn via A2E.
            </p>
          </div>

          {/* Copper rule */}
          <div className="h-px w-full mb-14" style={{ background: "var(--ed-copper)" }} />

          {/* Why this exists */}
          <Section title="Why this spec exists">
            <p className="mb-4">
              Every AI platform today defines its own agent shape. OpenAI&rsquo;s GPTs have one
              format. CrewAI agents have another. n8n nodes have a third. Zapier has a fourth.
              Every new platform means porting. Every port means compatibility debt.
            </p>
            <p className="mb-4">
              The Sovereign Agent Manifest (SAM) is our answer: one declarative format that
              describes what an agent DOES, not how it runs. Any runtime that supports SAM can
              execute any conforming agent. Any marketplace that accepts SAM can list any
              conforming agent.
            </p>
            <p>
              SAM v1.0 is a stable specification. We will not version-bump for at least one
              year. Extensions live in the <Mono>extensions</Mono> namespace, not in the core.
            </p>
          </Section>

          {/* Minimal example */}
          <Section title="Minimal example">
            <p className="mb-5">
              A complete SAM document for a simple agent. Required fields only. Valid for
              submission to the Sovereign marketplace as-is.
            </p>
            <CodeBlock>
{`{
  "sam": "1.0",
  "slug": "extract-invoice",
  "displayName": "Invoice Extractor",
  "purpose": "Extract structured data from invoice text",
  "category": "Finance",
  "version": "1.0.0",
  "inputs": [
    { "name": "text", "type": "string", "required": true,
      "description": "Raw invoice text or OCR'd content" }
  ],
  "output": {
    "type": "object",
    "schema": {
      "vendor": { "type": "object" },
      "totals": { "type": "object" },
      "lineItems": { "type": "array" }
    }
  },
  "guarantees": [
    "Never fabricates missing fields — absent values return null",
    "Line-item totals = quantity × unitPrice or flagged in warnings[]",
    "Currency codes use ISO 4217"
  ]
}`}
            </CodeBlock>
          </Section>

          {/* Full schema */}
          <Section title="Full schema">
            <FieldTable
              rows={[
                ["sam", "string (required)", "Spec version. Must be exactly \"1.0\" for this revision."],
                ["slug", "string (required)", "kebab-case identifier, unique across the marketplace. Must match ^[a-z][a-z0-9-]{2,63}$. The URL slug."],
                ["displayName", "string (required)", "Human-readable name. Title case. Under 60 characters."],
                ["purpose", "string (required)", "One-line description. Under 140 characters. What the agent DOES (verb-first)."],
                ["category", "string (required)", "One of: Growth, Content, Dev, Finance, HR, Legal, Ecommerce, Research, Cybersec, Real Estate, Gov, Productivity, Creative, Data, A2E, Meta, Integration, Safety."],
                ["version", "string (required)", "SemVer. Increment majorly on breaking input/output changes."],
                ["inputs", "array (required)", "Ordered list of input fields. Every field has name/type/required/description. Type is one of: string, number, boolean, object, array, url, email, date, enum."],
                ["output", "object (required)", "Output shape. type is one of: object, array, string, stream. Optional schema object for JSON-Schema validation of the response."],
                ["guarantees", "string[] (required)", "Machine-checkable promises. Bad: \"high quality\". Good: \"returns ≥5 items each with contact_angle field\". Runtime refunds credits on guarantee failure."],
                ["pricing", "object (optional)", "A2E pricing if publishing to marketplace. Shape: { cents: number, tier: \"free\"|\"basic\"|\"verified\"|\"premium\" }."],
                ["safety", "object (optional)", "{ trustTier: \"supervised\"|\"guided\"|\"autonomous\"|\"full-auto\", requiredApprovals: string[] }. Defaults to guided."],
                ["model", "string (optional)", "Preferred model hint. One of: claude, gemini, nim, groq, cerebras, ollama. Runtime may override via cost-optimizer."],
                ["creator", "object (optional)", "{ handle: string, url?: string, githubOrg?: string }. Required to earn via A2E."],
                ["tags", "string[] (optional)", "Free-form discovery tags. Lowercase. Max 10."],
                ["extensions", "object (optional)", "Namespaced extensions. e.g. extensions[\"sovereign.memory\"]. Safe to ignore by non-supporting runtimes."],
              ]}
            />
          </Section>

          {/* Runtime contract */}
          <Section title="Runtime contract">
            <p className="mb-4">
              A SAM-compliant runtime (Sovereign Matrix is one) MUST:
            </p>
            <ol className="space-y-3 ed-body" style={{ color: "var(--ed-ink-soft)" }}>
              <RuntimeRule num="1">
                Reject invocations whose inputs fail the declared input schema before
                any AI call is made.
              </RuntimeRule>
              <RuntimeRule num="2">
                Validate the output against <Mono>output.schema</Mono> before returning
                to the caller. Fail closed if invalid.
              </RuntimeRule>
              <RuntimeRule num="3">
                Check each <Mono>guarantees[]</Mono> clause via a deterministic predicate
                (regex, count, or explicit validator). Refund A2E credits on failure.
              </RuntimeRule>
              <RuntimeRule num="4">
                Pass the agent&rsquo;s declared <Mono>safety.trustTier</Mono> to the
                verification layer. Never auto-execute above the declared tier.
              </RuntimeRule>
              <RuntimeRule num="5">
                Emit an immutable audit entry per invocation. Log inputs, outputs, model
                used, verification verdict, and guarantee results.
              </RuntimeRule>
              <RuntimeRule num="6">
                Respect the A2E ledger: hold credits before invoking, capture on
                guarantee pass, refund on guarantee fail or verification block.
              </RuntimeRule>
            </ol>
          </Section>

          {/* Versioning promise */}
          <Section title="Versioning promise">
            <p className="mb-4">
              SAM v1.0 is frozen. We will not ship v1.1 or v2 for at least one year
              after publication (April 2026 → April 2027 earliest). This is a commitment
              to the ecosystem: agents conforming to v1.0 today will run on Sovereign
              runtimes through 2027 without modification.
            </p>
            <p className="mb-4">
              Extensions ship in the <Mono>extensions</Mono> namespace and are opt-in.
              A runtime that doesn&rsquo;t support a given extension MUST still execute
              the agent — ignoring only the extension fields.
            </p>
            <p>
              Breaking changes will require a v2 proposal with 90-day RFC window and
              at least two independent runtime implementations before general
              availability.
            </p>
          </Section>

          {/* Who can use it */}
          <Section title="License">
            <p className="mb-4">
              SAM v1.0 is published under the MIT License. Fork it, implement it,
              build a competing runtime, embed it in your docs. No royalty, no
              attribution beyond license notice.
            </p>
            <p>
              The Sovereign Matrix runtime is one implementation of SAM v1.0. Other
              implementations are welcomed and will be listed at{" "}
              <Link href="/spec/runtimes" className="underline transition-colors hover:opacity-80"
                    style={{ color: "var(--ed-copper)" }}>
                /spec/runtimes
              </Link>{" "}
              when published.
            </p>
          </Section>

          {/* CTA strip */}
          <div className="border-t pt-8 mt-16 flex flex-wrap items-baseline justify-between gap-4"
               style={{ borderColor: "var(--ed-rule)" }}>
            <p className="ed-body max-w-md" style={{ color: "var(--ed-ink-soft)" }}>
              Ready to publish an agent? Validate your manifest against the spec, then
              submit to the Sovereign marketplace.
            </p>
            <div className="flex gap-3">
              <a
                href="/api/public/sam/schema"
                className="ed-mono text-sm px-4 py-2 transition-opacity hover:opacity-80"
                style={{
                  border: "1px solid var(--ed-rule)",
                  color: "var(--ed-ink)",
                  borderRadius: "2px",
                }}
              >
                Download JSON Schema
              </a>
              <Link
                href="/sign-up"
                className="ed-mono text-sm px-4 py-2 transition-opacity hover:opacity-80"
                style={{
                  background: "var(--ed-copper)",
                  color: "var(--ed-bg)",
                  borderRadius: "2px",
                }}
              >
                Submit your agent →
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

function CodeBlock({ children }: { children: React.ReactNode }) {
  return (
    <pre className="ed-mono text-[13px] p-5 leading-relaxed overflow-x-auto mb-4"
         style={{
           background: "var(--ed-bg-raised)",
           border: "1px solid var(--ed-rule)",
           color: "var(--ed-ink-soft)",
           borderRadius: "2px",
         }}>
      {children}
    </pre>
  );
}

function FieldTable({ rows }: { rows: [string, string, string][] }) {
  return (
    <div className="mt-4" style={{ border: "1px solid var(--ed-rule)", borderRadius: "2px" }}>
      {rows.map(([field, type, description], i) => (
        <div
          key={field}
          className="grid grid-cols-12 gap-4 px-5 py-4"
          style={{
            borderBottom: i < rows.length - 1 ? "1px solid var(--ed-rule)" : "none",
            background: i % 2 === 0 ? "var(--ed-bg)" : "var(--ed-bg-raised)",
          }}
        >
          <div className="col-span-12 md:col-span-3">
            <span className="ed-mono text-[13px]" style={{ color: "var(--ed-copper)" }}>
              {field}
            </span>
          </div>
          <div className="col-span-12 md:col-span-3 ed-caption">{type}</div>
          <div className="col-span-12 md:col-span-6 ed-body text-[14px]"
               style={{ color: "var(--ed-ink-soft)" }}>
            {description}
          </div>
        </div>
      ))}
    </div>
  );
}

function RuntimeRule({ num, children }: { num: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="ed-mono flex-shrink-0 mt-1"
            style={{ color: "var(--ed-copper)" }}>
        {num}.
      </span>
      <span>{children}</span>
    </li>
  );
}
