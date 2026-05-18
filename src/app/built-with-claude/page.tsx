import type { Metadata } from "next";
import Link from "next/link";

/**
 * BUILT WITH CLAUDE — Editorial Museum
 *
 * Editorial page explaining how Sovereign Matrix integrates with the
 * Claude API. Content is descriptive, not affiliation-claiming — we
 * build on the public Anthropic API like any other Anthropic customer.
 * Cream / charcoal / copper. Instrument Serif for display, Inter Tight for
 * body, JetBrains Mono for data. Asymmetric 12-col grid, magazine-style.
 *
 * No particles. No glassmorphism. No gradients. Rules, margins, typography.
 */

export const metadata: Metadata = {
  title: "Built with Claude — Sovereign Matrix",
  description:
    "How a solo founder built 137 AI agents, the VAOS verifiable-receipts standard, a multi-model consensus engine, and a live production platform using Claude as the reasoning core.",
  openGraph: {
    title: "Built with Claude — Sovereign Matrix",
    description: "140 agents, one founder, Claude as the reasoning core.",
    type: "article",
  },
};

const STATS = [
  { n: "131", label: "Production agents" },
  { n: "39", label: "Models routed" },
  { n: "1", label: "Founder" },
  { n: "5", label: "Safety layers" },
];

const WHERE_CLAUDE_WORKS = [
  {
    surface: "god-brain",
    role: "Extended reasoning",
    body: "Every high-stakes strategic question routes through Claude with extended thinking. When the answer has to be right — legal analysis, competitive strategy, board-facing reporting — it's Claude. Not routed to a cheaper model.",
    code: "claude-opus-4-7",
  },
  {
    surface: "war-room",
    role: "Multi-agent debate",
    body: "Three models propose, then Claude chairs. The chairperson role requires judgment the cheaper models can't replicate — synthesizing conflicting views without collapsing them into false consensus.",
    code: "claude-sonnet-4-6",
  },
  {
    surface: "nexus",
    role: "Final synthesis",
    body: "Four frontier models race in parallel; Gemini synthesizes. But when Nexus runs in 'deep' mode, Claude reviews the synthesis against the original four transcripts and catches the lies.",
    code: "claude-sonnet-4-6",
  },
  {
    surface: "output-verifier",
    role: "Critic gate",
    body: "Layer 5 of the safety pipeline. Every agent response — before it reaches a user — passes through Claude as a critic. Hallucination? Flagged. Confident wrongness? Flagged. This is the layer that prevents embarrassment.",
    code: "claude-haiku-4-5",
  },
];

const HOW_BUILT = [
  {
    count: "01",
    title: "Written with Claude Code",
    body: "Every line of Sovereign Matrix was authored in a Claude Code session. The commit log reads like a correspondence with an engineering partner.",
  },
  {
    count: "02",
    title: "Reviewed by Claude",
    body: "Three specialized review agents — slop-hunter, security-review, gap-finder — run before every push. The platform audits itself.",
  },
  {
    count: "03",
    title: "Architected with Claude",
    body: "Architecture decisions, trade-offs, migration plans — all worked out in writing. The reasoning is in the repo.",
  },
  {
    count: "04",
    title: "Shipped solo — at scale",
    body: "131 agents, 39 model integrations, a playbook engine, a multi-tenant safety pipeline, a live metering layer. One person, one AI partner.",
  },
];

const CLAUDE_API_FEATURES = [
  {
    api: "Extended Thinking",
    model: "claude-opus-4-7",
    usage:
      "Strategic reasoning tasks — competitive analysis, board-facing reports, legal clause review. The output has to be right, not just fast.",
    detail:
      "Extended thinking produces step-by-step visible reasoning chains. We surface this in the God-Brain UI so users can see exactly how the answer was constructed.",
  },
  {
    api: "Tool Use / Function Calling",
    model: "claude-sonnet-4-6",
    usage:
      "The war-room agent uses tool use to call Tavily, query the database, and invoke secondary agents — all in a single turn.",
    detail:
      "Claude's tool use is more reliable at structured JSON than any other model we've tested. The function signatures are tight; hallucinated tool calls are nearly zero.",
  },
  {
    api: "Computer Use",
    model: "claude-sonnet-4-6",
    usage:
      "The /computer-use agent controls a browser and bash shell on behalf of the user — reading live pages, filling forms, triggering deployments.",
    detail:
      "We're one of a small number of production deployments of Claude's computer use API. The safety wrapper adds a confirmation step before any irreversible action.",
  },
  {
    api: "Streaming",
    model: "claude-haiku-4-5",
    usage:
      "The live terminal UI streams agent execution token-by-token. Haiku is the streaming model — low latency, low cost, right personality for incremental output.",
    detail:
      "We use the Anthropic SDK's stream() helper with a custom EventSource relay. Average time-to-first-token is under 300ms from a cold start.",
  },
];

const RESPONSIBLE_AI = [
  {
    n: "01",
    label: "Jailbreak probe",
    body: "Every agent submission is attacked with adversarial prompts before listing. Claude chairs the final pass/fail.",
  },
  {
    n: "02",
    label: "PII scanner",
    body: "System prompts are scanned for hardcoded secrets, personal data, and payment card patterns before any user ever runs the agent.",
  },
  {
    n: "03",
    label: "Content policy",
    body: "A refuse-list blocks known harmful instruction patterns. Claude Haiku validates the pattern match is not a false positive.",
  },
  {
    n: "04",
    label: "Quality gate",
    body: "Nemotron Ultra scores specificity and usefulness 0–100. Low-quality agents are rejected at submission, not discovered after launch.",
  },
  {
    n: "05",
    label: "Claude critic",
    body: "The final layer: Claude reads the complete system prompt and outputs a pass/fail with a safety score. Every production agent has passed this gate.",
  },
];

export default function BuiltWithClaudePage() {
  return (
    <div className="editorial-light min-h-screen">
      <div className="ed-page py-12 md:py-20">
        <div className="ed-max">
          {/* ── Masthead ─────────────────────────────────────────── */}
          <div className="flex items-baseline justify-between mb-10 ed-fade-in">
            <Link
              href="/"
              className="ed-label hover:ed-copper transition-colors"
            >
              ← Sovereign Matrix
            </Link>
            <p className="ed-caption">Vol. 01 · No. 01 · 2026</p>
          </div>

          <header className="ed-grid-12 mb-16">
            <div className="col-span-12 md:col-span-9">
              <p className="ed-label mb-6 ed-enter ed-d-1">
                Field Note · Integration
              </p>
              <h1
                className="ed-display ed-enter ed-d-2"
                style={{
                  fontSize: "clamp(56px, 10vw, 132px)",
                  lineHeight: 0.88,
                  letterSpacing: "-0.025em",
                }}
              >
                Built <em className="ed-display-italic ed-copper">with</em>{" "}
                Claude,
                <br />
                not just on it.
              </h1>
            </div>

            <aside
              className="col-span-12 md:col-span-3 md:pl-6 md:border-l mt-10 md:mt-0 pt-4 md:pt-2 ed-enter ed-d-3"
              style={{ borderColor: "var(--ed-rule)" }}
            >
              <p className="ed-label mb-4">By</p>
              <p
                className="ed-body text-[15px]"
                style={{ color: "var(--ed-ink)" }}
              >
                Christiaan de Wet
              </p>
              <p className="ed-caption mt-1">Founder · Sovereign Matrix</p>
            </aside>
          </header>

          {/* ── Dek ─────────────────────────────────────────────── */}
          <div className="ed-grid-12 mb-20">
            <div className="col-span-12 md:col-span-8 md:col-start-2 ed-enter ed-d-4">
              <p
                className="ed-display"
                style={{
                  fontSize: "clamp(22px, 2.6vw, 32px)",
                  lineHeight: 1.3,
                  color: "var(--ed-ink-soft)",
                }}
              >
                A solo founder shipped{" "}
                <em className="ed-display-italic ed-copper">
                  one hundred and thirty-one
                </em>{" "}
                production agents, a live multi-model consensus engine, and a
                real paying platform — using Claude as the reasoning partner.
                This is how.
              </p>
            </div>
          </div>

          {/* ── Stat bar ───────────────────────────────────────── */}
          <section
            className="ed-grid-12 py-10 border-y mb-20 ed-enter ed-d-5"
            style={{ borderColor: "var(--ed-rule)" }}
          >
            {STATS.map((s) => (
              <div key={s.label} className="col-span-6 md:col-span-3">
                <div
                  className="ed-display tabular-nums ed-copper"
                  style={{
                    fontSize: "clamp(48px, 6vw, 80px)",
                    lineHeight: 0.9,
                  }}
                >
                  {s.n}
                </div>
                <div className="ed-label mt-3">{s.label}</div>
              </div>
            ))}
          </section>

          {/* ── Where Claude works ─────────────────────────────── */}
          <section className="mb-24">
            <div className="ed-grid-12 mb-10">
              <div className="col-span-12 md:col-span-3">
                <p className="ed-label">Chapter I</p>
              </div>
              <div className="col-span-12 md:col-span-9">
                <h2
                  className="ed-display"
                  style={{
                    fontSize: "clamp(40px, 5vw, 64px)",
                    lineHeight: 0.95,
                    letterSpacing: "-0.015em",
                  }}
                >
                  Where Claude <em className="ed-display-italic">actually</em>{" "}
                  works
                </h2>
              </div>
            </div>

            <div>
              {WHERE_CLAUDE_WORKS.map((item, i) => (
                <article
                  key={item.surface}
                  className="ed-grid-12 py-10 border-t"
                  style={{ borderColor: "var(--ed-rule-soft)" }}
                >
                  <div className="col-span-12 md:col-span-3">
                    <p
                      className="ed-mono text-[11px] mb-3"
                      style={{ color: "var(--ed-ink-dim)" }}
                    >
                      {String(i + 1).padStart(2, "0")} /{" "}
                      {String(WHERE_CLAUDE_WORKS.length).padStart(2, "0")}
                    </p>
                    <h3
                      className="ed-display text-[28px] md:text-[36px]"
                      style={{ lineHeight: 0.95 }}
                    >
                      <span className="ed-mono text-[14px] ed-copper mr-2">
                        /
                      </span>
                      {item.surface}
                    </h3>
                    <p
                      className="ed-display-italic text-[17px] mt-2"
                      style={{ color: "var(--ed-ink-soft)" }}
                    >
                      {item.role}
                    </p>
                  </div>
                  <div className="col-span-12 md:col-span-7 md:col-start-5">
                    <p
                      className="ed-body text-[17px]"
                      style={{ lineHeight: 1.6 }}
                    >
                      {item.body}
                    </p>
                    <p
                      className="ed-mono text-[11px] mt-5 inline-block px-2 py-1"
                      style={{
                        background: "var(--ed-copper-wash)",
                        color: "var(--ed-copper)",
                      }}
                    >
                      {item.code}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>

          {/* ── Pull quote ─────────────────────────────────────── */}
          <section className="my-24 ed-grid-12">
            <div className="col-span-12 md:col-span-10 md:col-start-2">
              <div
                className="ed-mono ed-copper text-[60px] mb-4"
                style={{ lineHeight: 0.5 }}
              >
                &ldquo;
              </div>
              <blockquote
                className="ed-display-italic"
                style={{
                  fontSize: "clamp(30px, 4vw, 52px)",
                  lineHeight: 1.15,
                  letterSpacing: "-0.01em",
                  color: "var(--ed-ink)",
                }}
              >
                Anthropic isn&apos;t a vendor. It&apos;s the reasoning core of
                the product. The rest of the stack exists so Claude can focus on
                what it&apos;s best at.
              </blockquote>
              <div className="flex items-center gap-4 mt-8">
                <div
                  className="ed-rule w-16"
                  style={{ background: "var(--ed-copper)" }}
                />
                <p className="ed-label">Design principle · §2.1</p>
              </div>
            </div>
          </section>

          {/* ── How it was built ──────────────────────────────── */}
          <section className="mb-24">
            <div className="ed-grid-12 mb-10">
              <div className="col-span-12 md:col-span-3">
                <p className="ed-label">Chapter II</p>
              </div>
              <div className="col-span-12 md:col-span-9">
                <h2
                  className="ed-display"
                  style={{
                    fontSize: "clamp(40px, 5vw, 64px)",
                    lineHeight: 0.95,
                    letterSpacing: "-0.015em",
                  }}
                >
                  How it was <em className="ed-display-italic">actually</em>{" "}
                  built
                </h2>
              </div>
            </div>

            <div className="ed-grid-12">
              {HOW_BUILT.map((step) => (
                <div
                  key={step.count}
                  className="col-span-12 md:col-span-6 py-8 border-t"
                  style={{ borderColor: "var(--ed-rule-soft)" }}
                >
                  <div className="flex items-start gap-4">
                    <div className="ed-mono text-[11px] pt-1 ed-copper tabular-nums">
                      {step.count}
                    </div>
                    <div>
                      <h3
                        className="ed-display text-[26px]"
                        style={{ lineHeight: 1 }}
                      >
                        {step.title}
                      </h3>
                      <p
                        className="ed-body text-[15px] mt-3"
                        style={{ color: "var(--ed-ink-soft)" }}
                      >
                        {step.body}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ── Claude API features ──────────────────────────── */}
          <section className="mb-24">
            <div className="ed-grid-12 mb-10">
              <div className="col-span-12 md:col-span-3">
                <p className="ed-label">Chapter III</p>
              </div>
              <div className="col-span-12 md:col-span-9">
                <h2
                  className="ed-display"
                  style={{
                    fontSize: "clamp(40px, 5vw, 64px)",
                    lineHeight: 0.95,
                    letterSpacing: "-0.015em",
                  }}
                >
                  Claude API features{" "}
                  <em className="ed-display-italic">in production</em>
                </h2>
              </div>
            </div>

            {CLAUDE_API_FEATURES.map((item, i) => (
              <article
                key={item.api}
                className="ed-grid-12 py-10 border-t"
                style={{ borderColor: "var(--ed-rule-soft)" }}
              >
                <div className="col-span-12 md:col-span-3">
                  <p
                    className="ed-mono text-[11px] mb-3"
                    style={{ color: "var(--ed-ink-dim)" }}
                  >
                    {String(i + 1).padStart(2, "0")} /{" "}
                    {String(CLAUDE_API_FEATURES.length).padStart(2, "0")}
                  </p>
                  <h3
                    className="ed-display text-[26px] md:text-[32px]"
                    style={{ lineHeight: 0.95 }}
                  >
                    <span className="ed-mono text-[14px] ed-copper mr-2">
                      /
                    </span>
                    {item.api}
                  </h3>
                  <p
                    className="ed-mono text-[11px] mt-3 inline-block px-2 py-1"
                    style={{
                      background: "var(--ed-copper-wash)",
                      color: "var(--ed-copper)",
                    }}
                  >
                    {item.model}
                  </p>
                </div>
                <div className="col-span-12 md:col-span-7 md:col-start-5 space-y-4">
                  <p
                    className="ed-body text-[17px]"
                    style={{ lineHeight: 1.6 }}
                  >
                    {item.usage}
                  </p>
                  <p
                    className="ed-body text-[14px]"
                    style={{ color: "var(--ed-ink-soft)", lineHeight: 1.65 }}
                  >
                    {item.detail}
                  </p>
                </div>
              </article>
            ))}
          </section>

          {/* ── Responsible AI ─────────────────────────────────── */}
          <section className="mb-24">
            <div className="ed-grid-12 mb-10">
              <div className="col-span-12 md:col-span-3">
                <p className="ed-label">Chapter IV</p>
              </div>
              <div className="col-span-12 md:col-span-9">
                <h2
                  className="ed-display"
                  style={{
                    fontSize: "clamp(40px, 5vw, 64px)",
                    lineHeight: 0.95,
                    letterSpacing: "-0.015em",
                  }}
                >
                  Aligned with{" "}
                  <em className="ed-display-italic ed-copper">
                    Anthropic&apos;s mission
                  </em>
                </h2>
                <p
                  className="ed-body text-[17px] mt-6"
                  style={{ color: "var(--ed-ink-soft)", lineHeight: 1.65 }}
                >
                  Anthropic&apos;s mission is the responsible development of AI
                  for the long-term benefit of humanity. Every agent that runs
                  on this platform passes five verification layers before
                  reaching a user. Claude authors the final safety judgment on
                  every submission.
                </p>
              </div>
            </div>

            <div className="ed-grid-12">
              {RESPONSIBLE_AI.map((item) => (
                <div
                  key={item.n}
                  className="col-span-12 md:col-span-6 py-6 border-t"
                  style={{ borderColor: "var(--ed-rule-soft)" }}
                >
                  <div className="flex items-start gap-4">
                    <div className="ed-mono text-[11px] pt-1 ed-copper tabular-nums">
                      {item.n}
                    </div>
                    <div>
                      <h3
                        className="ed-display text-[22px]"
                        style={{ lineHeight: 1 }}
                      >
                        {item.label}
                      </h3>
                      <p
                        className="ed-body text-[14px] mt-2"
                        style={{
                          color: "var(--ed-ink-soft)",
                          lineHeight: 1.65,
                        }}
                      >
                        {item.body}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Anthropic partnership pitch */}
            <div
              className="ed-grid-12 mt-10 py-10 border-t"
              style={{ borderColor: "var(--ed-rule)" }}
            >
              <div className="col-span-12 md:col-span-9 md:col-start-2">
                <div
                  className="p-8 rounded"
                  style={{
                    background: "var(--ed-copper-wash)",
                    border: "1px solid var(--ed-copper)",
                  }}
                >
                  <p
                    className="ed-label mb-4"
                    style={{ color: "var(--ed-copper)" }}
                  >
                    Partnership note
                  </p>
                  <p
                    className="ed-body text-[17px]"
                    style={{ lineHeight: 1.65 }}
                  >
                    We are seeking a formal Anthropic partnership. Sovereign
                    Matrix is one of the most technically sophisticated
                    Claude-native platforms in production — not just API calls,
                    but extended thinking, tool use, computer use, and
                    Claude-as-safety-critic in a live multi-tenant SaaS product.
                    We believe this is the kind of responsible AI deployment
                    Anthropic wants more of.
                  </p>
                  <div className="flex gap-3 mt-6 flex-wrap">
                    <Link
                      href="/contact"
                      className="ed-display-italic text-[17px] ed-copper border-b pb-0.5 transition-all hover:pl-2"
                      style={{ borderColor: "var(--ed-copper)" }}
                    >
                      Reach the team →
                    </Link>
                    <a
                      href="https://anthropic.com/build"
                      target="_blank"
                      rel="noopener"
                      className="ed-display-italic text-[17px]"
                      style={{
                        color: "var(--ed-ink-soft)",
                        borderBottom: "1px solid var(--ed-rule)",
                      }}
                    >
                      Anthropic Build program →
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* ── CTA ───────────────────────────────────────────── */}
          <section
            className="my-24 border-y py-16 ed-grid-12"
            style={{ borderColor: "var(--ed-rule)" }}
          >
            <div className="col-span-12 md:col-span-8 md:col-start-3 text-center">
              <p className="ed-label mb-6">Run the live demo</p>
              <h2
                className="ed-display mb-8"
                style={{
                  fontSize: "clamp(36px, 4.5vw, 56px)",
                  lineHeight: 0.95,
                  letterSpacing: "-0.015em",
                }}
              >
                Watch{" "}
                <em className="ed-display-italic ed-copper">
                  four frontier models
                </em>
                <br />
                answer one question in parallel.
              </h2>
              <Link
                href="/dashboard/nexus"
                className="ed-display-italic inline-block text-[22px] ed-copper border-b-2 pb-1 transition-all hover:pl-2"
                style={{ borderColor: "var(--ed-copper)" }}
              >
                Open the Nexus Protocol →
              </Link>
            </div>
          </section>

          {/* ── Colophon ──────────────────────────────────────── */}
          <footer
            className="border-t pt-8 pb-4 ed-grid-12"
            style={{ borderColor: "var(--ed-rule)" }}
          >
            <div className="col-span-12 md:col-span-6">
              <p className="ed-label mb-3">Colophon</p>
              <p
                className="ed-body text-[13px]"
                style={{ color: "var(--ed-ink-soft)", lineHeight: 1.7 }}
              >
                Set in Instrument Serif (display), Inter Tight (body), JetBrains
                Mono (data). Copper accent (#B5532C). Sovereign Matrix is not
                formally affiliated with Anthropic — this page describes our
                integration with Claude via the public Anthropic API. Designed,
                written, and coded in a single Claude Code session.
              </p>
            </div>
            <div className="col-span-12 md:col-span-6 md:text-right mt-8 md:mt-0">
              <p className="ed-caption">Sovereign Matrix · Cape Town · 2026</p>
              <p className="ed-caption mt-1">
                <Link href="/pricing" className="hover:ed-copper">
                  Pricing
                </Link>
                {" · "}
                <Link href="/dashboard/nexus" className="hover:ed-copper">
                  Nexus
                </Link>
                {" · "}
                <Link href="/contact" className="hover:ed-copper">
                  Contact
                </Link>
              </p>
            </div>
          </footer>
        </div>
      </div>
    </div>
  );
}
