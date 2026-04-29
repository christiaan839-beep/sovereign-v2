import type { Metadata } from "next";
import { LivePerceptionPlanner } from "./LivePerceptionPlanner";

export const metadata: Metadata = {
  title: "Perception Mesh — Sovereign Matrix",
  description:
    "The unified multimodal perception substrate. Five specialized Nemotron 3 Nano Omni node kinds + cross-modal correlation. Replaces fragmented vision/audio/speech model chains with one composable swarm.",
  alternates: {
    canonical: "https://sovereignmatrix.agency/trust/perception",
  },
  openGraph: {
    title: "Perception Mesh — Sovereign Matrix",
    description:
      "Multimodal perception swarm with cross-modal correlation. NVIDIA Nemotron 3 Nano Omni unified context. Air-gappable.",
    url: "https://sovereignmatrix.agency/trust/perception",
    type: "website",
  },
};

/**
 * /trust/perception — public live perception-plan composer.
 *
 * Audience: CTO, Head of AI Engineering, Head of Compliance,
 * Procurement evaluating the multimodal substrate.
 *
 * Aesthetic: editorial museum (matches /trust + /trust/agentic-commerce
 * + /trust/control-plane).
 */

const NODE_KINDS = [
  {
    id: "video-monitor",
    name: "Video Monitor",
    blurb:
      "Continuous video understanding. Up to 2-minute clips per call; longer streams via chunking.",
    inputs: ["video URL", "MP4 / WebM"],
  },
  {
    id: "audio-transcriber",
    name: "Audio Transcriber",
    blurb:
      "Speech-to-text with speaker labels, filler words preserved, 30s timestamps.",
    inputs: ["audio URL", "WAV / MP3 (up to 1 hour)"],
  },
  {
    id: "screenshot-analyzer",
    name: "Screenshot Analyzer",
    blurb:
      "Computer-use GUI extraction. Identifies application, interactive elements with coordinates, current state, error messages. Output is action-ready for downstream automation.",
    inputs: ["image URL", "PNG / JPEG"],
  },
  {
    id: "document-extractor",
    name: "Document Extractor",
    blurb:
      "Structured JSON from documents. ISO 8601 dates, ISO 4217 currencies, original casing preserved. Implies JSON output by default.",
    inputs: ["image URL of doc", "PDF rasterization"],
  },
  {
    id: "freeform-synthesizer",
    name: "Freeform Synthesizer",
    blurb:
      "Open-ended cross-input analysis. Best when you mix all four modalities and ask a free-form question.",
    inputs: ["any combination"],
  },
] as const;

const CORRELATION_KINDS = [
  {
    name: "keyword-overlap",
    purpose:
      "Alert when a keyword (e.g., \"earnings\", \"guidance\") appears in 2+ modalities at once.",
    example:
      "Trigger when video transcript AND audio transcript AND screenshot OCR all mention \"Q3 revenue\".",
  },
  {
    name: "entity-overlap",
    purpose:
      "Alert when a named entity (person, company, place) is mentioned across modalities.",
    example:
      "Detect when a face seen on screen + a name mentioned in audio refer to the same person.",
  },
  {
    name: "time-proximity",
    purpose:
      "Surface when 2+ nodes observed events within a configurable window.",
    example:
      "A video alert and an audio shout occurring within 5 seconds of each other.",
  },
  {
    name: "json-field-match",
    purpose:
      "Group nodes whose structured outputs agree at a JSON path.",
    example:
      "Two document-extractor nodes both surface the same invoice ID — duplicate detected.",
  },
] as const;

const ARCHITECTURE_VS = [
  {
    label: "Fragmented model chain",
    detail:
      "Vision model + transcription model + entity-resolution model + correlator. Context lost at every handoff. 4-6× more tokens. Brittle.",
    badge: "Most agent platforms",
    accent: "rose",
  },
  {
    label: "Single Omni model call",
    detail:
      "One unified call. Better than chains — but cannot run in parallel across streams or correlate across distinct input contexts.",
    badge: "Naive Omni adoption",
    accent: "amber",
  },
  {
    label: "Sovereign Perception Mesh",
    detail:
      "Specialized Omni instances, parallel per modality, correlated by deterministic pure functions. Cross-modal signals at scale. Inspector-replayable. Air-gappable.",
    badge: "Today (R110 + R111)",
    accent: "emerald",
  },
] as const;

const NEMOTRON_FACTS = [
  {
    label: "30B parameters / 3B active",
    detail:
      "Mixture-of-Experts architecture: per NVIDIA's announcement, only ~3B active per token, delivering large-model power at sparse-model cost.",
  },
  {
    label: "256K-token context",
    detail:
      "An entire financial report or hour-long meeting fits in one context window — no sliding-window stitching across model calls.",
  },
  {
    label: "Up to 9× higher throughput",
    detail:
      "Per NVIDIA's announcement, vs. other open omni-modal models. Your perception nodes process more tasks per second at lower cost.",
  },
  {
    label: "Open weights + dataset",
    detail:
      "Air-gappable. Customers can deploy on NVIDIA NIM, OpenRouter, vLLM, llama.cpp — or their own GPUs. No SDK lock-in.",
  },
] as const;

export default function PerceptionPage() {
  return (
    <main className="min-h-screen bg-[#F4EFE6] text-[#1A1712] px-6 py-20 lg:px-20 lg:py-28">
      <div className="mx-auto max-w-5xl">
        {/* ─── Hero ─────────────────────────────────────────────────── */}
        <header className="mb-20 lg:mb-28">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
            Sovereign Perception Mesh · R110 · R111
          </p>
          <h1 className="mt-4 font-serif text-5xl leading-[1.05] tracking-tight lg:text-7xl">
            One unified
            <br />
            <span className="italic text-[#5A4F3F]">sensory substrate</span>
            <br />
            for every agent.
          </h1>
          <p className="mt-8 max-w-2xl font-serif text-xl leading-relaxed text-[#3A3128]">
            Most agent platforms patch together separate models for
            video, audio, images, and text. Context is lost at every
            handoff.{" "}
            <strong>
              We replace the chain with a swarm of specialized
              NVIDIA Nemotron 3 Nano Omni nodes
            </strong>{" "}
            connected by deterministic cross-modal correlation rules.
          </p>
          <p className="mt-6 max-w-2xl font-serif text-xl leading-relaxed text-[#3A3128]">
            One model. Five node kinds. Four correlation rule types.
            All offline-verifiable via{" "}
            <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
              @sovereign/inspector
            </code>
            .
          </p>
        </header>

        {/* ─── Live planner ─────────────────────────────────────────── */}
        <section className="mb-24">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
            Live · deterministic plan composer
          </p>
          <h2 className="mt-3 font-serif text-3xl tracking-tight lg:text-4xl">
            Compose a mesh in this browser.
          </h2>
          <p className="mt-3 max-w-2xl font-serif text-lg text-[#3A3128]">
            Pick a pre-built mesh or describe your own. The planner
            returns the deterministic execution plan + correlation rules
            it would run.{" "}
            <em>No Sovereign trust required</em> — replay locally
            with <code>@sovereign/inspector</code>.
          </p>
          <div className="mt-10">
            <LivePerceptionPlanner />
          </div>
        </section>

        {/* ─── Architecture comparison ──────────────────────────────── */}
        <section className="mb-24 border-t border-[#D8CFBE] pt-20">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
            Why mesh beats chain (and beats single-call too)
          </p>
          <h2 className="mt-3 font-serif text-3xl tracking-tight lg:text-4xl">
            Three architectures.{" "}
            <em>Only one captures cross-modal signals.</em>
          </h2>
          <div className="mt-12 grid gap-6 lg:grid-cols-3">
            {ARCHITECTURE_VS.map((a) => (
              <article
                key={a.label}
                className={`rounded border-l-4 bg-[#EFE8D7] p-6 ${
                  a.accent === "rose"
                    ? "border-rose-700"
                    : a.accent === "amber"
                    ? "border-amber-700"
                    : "border-emerald-700"
                }`}
              >
                <p
                  className={`font-mono text-xs uppercase tracking-[0.18em] ${
                    a.accent === "rose"
                      ? "text-rose-700"
                      : a.accent === "amber"
                      ? "text-amber-700"
                      : "text-emerald-700"
                  }`}
                >
                  {a.badge}
                </p>
                <h3 className="mt-2 font-serif text-xl tracking-tight">
                  {a.label}
                </h3>
                <p className="mt-3 font-serif text-base leading-relaxed text-[#3A3128]">
                  {a.detail}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* ─── Five node kinds ──────────────────────────────────────── */}
        <section className="mb-24 border-t border-[#D8CFBE] pt-20">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
            Five specialized node kinds
          </p>
          <h2 className="mt-3 font-serif text-3xl tracking-tight lg:text-4xl">
            Each node is a tuned Omni invocation.{" "}
            <em>All composable.</em>
          </h2>
          <div className="mt-12 grid gap-px bg-[#D8CFBE] lg:grid-cols-1">
            {NODE_KINDS.map((n) => (
              <article
                key={n.id}
                className="bg-[#F4EFE6] px-6 py-6 lg:px-10 lg:py-8"
              >
                <div className="flex items-baseline gap-6">
                  <code className="font-mono text-sm uppercase tracking-[0.14em] text-[#5A4F3F]">
                    {n.id}
                  </code>
                  <h3 className="font-serif text-2xl tracking-tight">
                    {n.name}
                  </h3>
                </div>
                <p className="mt-3 max-w-3xl font-serif text-lg leading-relaxed text-[#3A3128]">
                  {n.blurb}
                </p>
                <p className="mt-2 font-mono text-xs uppercase tracking-[0.14em] text-[#5A4F3F]">
                  Inputs: {n.inputs.join(" · ")}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* ─── Cross-modal correlation rules ───────────────────────── */}
        <section className="mb-24 border-t border-[#D8CFBE] pt-20">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
            Cross-modal correlation rules
          </p>
          <h2 className="mt-3 font-serif text-3xl tracking-tight lg:text-4xl">
            <em>Signals only a swarm can find.</em>
          </h2>
          <ul className="mt-12 divide-y divide-[#D8CFBE] border-y border-[#D8CFBE]">
            {CORRELATION_KINDS.map((c) => (
              <li
                key={c.name}
                className="grid grid-cols-1 gap-4 py-6 lg:grid-cols-12"
              >
                <code className="font-mono text-sm uppercase tracking-[0.12em] text-[#5A4F3F] lg:col-span-3">
                  {c.name}
                </code>
                <div className="lg:col-span-9">
                  <p className="font-serif text-lg">{c.purpose}</p>
                  <p className="mt-1 font-serif text-base text-[#5A4F3F]">
                    Example: {c.example}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ─── Why Nemotron Omni ─────────────────────────────────── */}
        <section className="mb-24 border-t border-[#D8CFBE] pt-20">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
            Substrate of choice · NVIDIA Nemotron 3 Nano Omni
          </p>
          <h2 className="mt-3 font-serif text-3xl tracking-tight lg:text-4xl">
            <em>Open weights. Sparse cost. Massive context.</em>
          </h2>
          <div className="mt-12 grid gap-6 lg:grid-cols-2">
            {NEMOTRON_FACTS.map((f) => (
              <article
                key={f.label}
                className="rounded border border-[#D8CFBE] bg-[#EFE8D7] p-6"
              >
                <h3 className="font-serif text-xl tracking-tight">
                  {f.label}
                </h3>
                <p className="mt-3 font-serif text-base leading-relaxed text-[#3A3128]">
                  {f.detail}
                </p>
              </article>
            ))}
          </div>
        </section>

        {/* ─── Footer / Sources ────────────────────────────────────── */}
        <footer className="border-t border-[#D8CFBE] pt-12">
          <p className="font-mono text-xs uppercase tracking-[0.18em] text-[#5A4F3F]">
            Sources you can verify
          </p>
          <ul className="mt-6 space-y-2 font-serif text-base text-[#3A3128]">
            <li>
              <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
                src/lib/perception/nemotron-omni-client.ts
              </code>{" "}
              — R110 pure-function HTTP client (no SDK).
            </li>
            <li>
              <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
                src/lib/perception/mesh.ts
              </code>{" "}
              — R111 mesh + correlation primitives.
            </li>
            <li>
              <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
                docs/MULTIMODAL-PERCEPTION-MESH.md
              </code>{" "}
              — Strategic positioning.
            </li>
            <li>
              Public APIs:{" "}
              <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
                POST /api/perception/plan
              </code>{" "}
              and{" "}
              <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
                POST /api/perception/correlate
              </code>
              .
            </li>
            <li>
              Sister pages:{" "}
              <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
                /trust/agentic-commerce
              </code>{" "}
              ·{" "}
              <code className="rounded bg-[#E5DFD0] px-1 py-0.5 font-mono text-sm">
                /trust/control-plane
              </code>
            </li>
          </ul>
        </footer>
      </div>
    </main>
  );
}
