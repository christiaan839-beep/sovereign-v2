"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@clerk/nextjs";
import {
  ArrowRight,
  ArrowLeft,
  FileText,
  Mail,
  Megaphone,
  Crosshair,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Download,
  Sparkles,
} from "lucide-react";

/**
 * /playbooks/agency-content-packet — Vertical 1 (B2B agencies) cornerstone.
 *
 * Single-page intake form + result dashboard for the "Agency Content
 * Packet" deliverable. Anonymous visitors see the form and the proof
 * surface; submit redirects to /signup with the packet inputs preserved.
 * Signed-in users hit /api/agents/agency-packet and stream the result.
 */

interface BlogAsset {
  title: string;
  body: string;
  wordCount: number;
  metaDescription: string;
  primaryKeyword: string;
}
interface EmailAsset {
  sequenceName: string;
  emails: Array<{
    stepNumber: number;
    delayDays: number;
    subject: string;
    body: string;
  }>;
}
interface AdAsset {
  platform: "LinkedIn" | "Meta" | "Google";
  hook: string;
  headline: string;
  primaryText: string;
  callToAction: string;
}
interface CompetitorAsset {
  competitor: string;
  topWeakness: { issue: string; exploit: string; severity: string };
  topGap: { gap: string; opportunity: string };
}
interface AgencyPacket {
  client: { name: string; domain: string };
  generatedAt: string;
  durationMs: number;
  brandVoice: string;
  blog: BlogAsset | null;
  emailSequence: EmailAsset | null;
  ads: AdAsset[] | null;
  competitor: CompetitorAsset | null;
  errors: Array<{ asset: string; message: string }>;
}

const VOICES = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "technical", label: "Technical" },
  { value: "friendly", label: "Friendly" },
  { value: "bold", label: "Bold" },
] as const;

const PROGRESS_STEPS = [
  "Researching the topic + writing the SEO post",
  "Drafting the 3-email welcome sequence",
  "Generating LinkedIn / Meta / Google ad creatives",
  "Scanning the competitor + assembling the packet",
];

export default function AgencyContentPacketPage() {
  const { isSignedIn, isLoaded: authLoaded } = useUser();

  const [clientName, setClientName] = useState("");
  const [clientDomain, setClientDomain] = useState("");
  const [clientDescription, setClientDescription] = useState("");
  const [audience, setAudience] = useState("");
  const [brandVoice, setBrandVoice] =
    useState<(typeof VOICES)[number]["value"]>("professional");
  const [keywords, setKeywords] = useState("");
  const [competitorUrl, setCompetitorUrl] = useState("");

  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">(
    "idle",
  );
  const [progressIdx, setProgressIdx] = useState(0);
  const [packet, setPacket] = useState<AgencyPacket | null>(null);
  const [error, setError] = useState("");

  const formValid =
    clientName.trim().length >= 2 &&
    /^[a-z0-9.-]+\.[a-z]{2,}$/i.test(clientDomain.trim()) &&
    clientDescription.trim().length >= 20 &&
    audience.trim().length >= 5;

  async function generatePacket(e: React.FormEvent) {
    e.preventDefault();
    if (!formValid) return;

    setPhase("running");
    setProgressIdx(0);
    setError("");
    setPacket(null);

    const progressTimer = setInterval(() => {
      setProgressIdx((i) => Math.min(i + 1, PROGRESS_STEPS.length - 1));
    }, 8000);

    try {
      const res = await fetch("/api/agents/agency-packet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientName: clientName.trim(),
          clientDomain: clientDomain.trim().toLowerCase(),
          clientDescription: clientDescription.trim(),
          audience: audience.trim(),
          brandVoice,
          primaryKeywords: keywords
            .split(",")
            .map((k) => k.trim())
            .filter(Boolean)
            .slice(0, 5),
          competitorUrl: competitorUrl.trim() || undefined,
        }),
      });
      clearInterval(progressTimer);

      if (res.status === 401) {
        setError("Sign in to run the full packet.");
        setPhase("error");
        return;
      }
      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        setError(
          body?.message ||
            "You've hit your monthly quota — upgrade to keep generating.",
        );
        setPhase("error");
        return;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body?.error || `Generation failed (${res.status}).`);
        setPhase("error");
        return;
      }

      const body = (await res.json()) as AgencyPacket;
      setPacket(body);
      setPhase("done");
    } catch {
      clearInterval(progressTimer);
      setError("Network error. Try again.");
      setPhase("error");
    }
  }

  return (
    <main className="min-h-screen bg-[#030303] text-white">
      <Nav />

      <div className="max-w-5xl mx-auto px-6 md:px-10 pt-24 pb-24">
        <PageHeader />

        {phase === "idle" || phase === "error" ? (
          <IntakeForm
            authLoaded={authLoaded}
            isSignedIn={!!isSignedIn}
            clientName={clientName}
            setClientName={setClientName}
            clientDomain={clientDomain}
            setClientDomain={setClientDomain}
            clientDescription={clientDescription}
            setClientDescription={setClientDescription}
            audience={audience}
            setAudience={setAudience}
            brandVoice={brandVoice}
            setBrandVoice={setBrandVoice}
            keywords={keywords}
            setKeywords={setKeywords}
            competitorUrl={competitorUrl}
            setCompetitorUrl={setCompetitorUrl}
            formValid={formValid}
            error={error}
            onSubmit={generatePacket}
          />
        ) : null}

        {phase === "running" ? (
          <RunningState progressIdx={progressIdx} />
        ) : null}

        {phase === "done" && packet ? (
          <PacketResult
            packet={packet}
            onReset={() => {
              setPacket(null);
              setPhase("idle");
            }}
          />
        ) : null}

        <AssetTeaser visible={phase === "idle" || phase === "error"} />
      </div>
    </main>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────

function Nav() {
  return (
    <nav className="px-6 md:px-10 h-16 flex items-center justify-between max-w-5xl mx-auto">
      <Link href="/" className="text-sm font-semibold text-white">
        Sovereign Matrix
      </Link>
      <Link
        href="/for-agencies"
        className="px-4 py-2 rounded-full border border-white/15 text-xs font-semibold hover:border-white/30 transition-colors"
      >
        For agencies →
      </Link>
    </nav>
  );
}

function PageHeader() {
  return (
    <header className="mb-12">
      <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-[#B5532C] mb-4">
        Playbook · Agency content packet
      </p>
      <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-6 leading-tight max-w-3xl">
        One client &nbsp;→&nbsp;{" "}
        <em className="not-italic" style={{ color: "#B5532C" }}>
          a full week of deliverables
        </em>{" "}
        in 90 seconds.
      </h1>
      <p className="text-base text-neutral-400 leading-relaxed max-w-2xl">
        Drop your client&apos;s domain, audience, and brand voice. Get a
        1,500-word SEO post, a 3-email welcome sequence, three platform-specific
        ad creatives, and a competitor weakness teaser — whitelabel-ready, in
        your inbox in under two minutes.
      </p>
    </header>
  );
}

function FieldLabel({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="flex items-baseline justify-between mb-1.5">
      <label className="text-[12px] font-mono uppercase tracking-[0.15em] text-neutral-400">
        {children}
      </label>
      {hint ? (
        <span className="text-[11px] text-neutral-600">{hint}</span>
      ) : null}
    </div>
  );
}

interface IntakeFormProps {
  authLoaded: boolean;
  isSignedIn: boolean;
  clientName: string;
  setClientName: (v: string) => void;
  clientDomain: string;
  setClientDomain: (v: string) => void;
  clientDescription: string;
  setClientDescription: (v: string) => void;
  audience: string;
  setAudience: (v: string) => void;
  brandVoice: (typeof VOICES)[number]["value"];
  setBrandVoice: (v: (typeof VOICES)[number]["value"]) => void;
  keywords: string;
  setKeywords: (v: string) => void;
  competitorUrl: string;
  setCompetitorUrl: (v: string) => void;
  formValid: boolean;
  error: string;
  onSubmit: (e: React.FormEvent) => void;
}

function IntakeForm(props: IntakeFormProps) {
  const baseInput =
    "w-full px-4 py-3 rounded-xl bg-black/40 border border-white/[0.08] text-[14px] text-white placeholder:text-neutral-600 focus:outline-none focus:border-[#B5532C]/50 focus:ring-2 focus:ring-[#B5532C]/20 transition-colors";

  return (
    <motion.form
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      onSubmit={props.onSubmit}
      className="rounded-2xl border border-white/[0.07] bg-gradient-to-b from-white/[0.04] to-white/[0.01] backdrop-blur-xl p-6 md:p-10"
    >
      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <FieldLabel>Client name</FieldLabel>
          <input
            type="text"
            value={props.clientName}
            onChange={(e) => props.setClientName(e.target.value)}
            placeholder="Acme Corp"
            className={baseInput}
            maxLength={80}
            required
          />
        </div>
        <div>
          <FieldLabel hint="No protocol — just the domain">
            Client domain
          </FieldLabel>
          <input
            type="text"
            value={props.clientDomain}
            onChange={(e) => props.setClientDomain(e.target.value)}
            placeholder="acmecorp.com"
            className={baseInput}
            maxLength={120}
            required
            spellCheck={false}
          />
        </div>
      </div>

      <div className="mt-5">
        <FieldLabel hint={`${props.clientDescription.length} / 2000`}>
          What does the client do?
        </FieldLabel>
        <textarea
          rows={3}
          value={props.clientDescription}
          onChange={(e) => props.setClientDescription(e.target.value)}
          placeholder="Two sentences. Who they are, who they serve, one differentiator."
          className={`${baseInput} resize-y min-h-[88px]`}
          maxLength={2000}
          required
        />
      </div>

      <div className="grid md:grid-cols-2 gap-5 mt-5">
        <div>
          <FieldLabel>Target audience</FieldLabel>
          <input
            type="text"
            value={props.audience}
            onChange={(e) => props.setAudience(e.target.value)}
            placeholder="Mid-market HR leaders at 100–500 person SaaS companies"
            className={baseInput}
            maxLength={400}
            required
          />
        </div>
        <div>
          <FieldLabel>Brand voice</FieldLabel>
          <select
            value={props.brandVoice}
            onChange={(e) =>
              props.setBrandVoice(
                e.target.value as (typeof VOICES)[number]["value"],
              )
            }
            className={baseInput}
          >
            {VOICES.map((v) => (
              <option key={v.value} value={v.value} className="bg-[#0A0A0A]">
                {v.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5 mt-5">
        <div>
          <FieldLabel hint="Up to 5, comma-separated">
            Primary keywords
          </FieldLabel>
          <input
            type="text"
            value={props.keywords}
            onChange={(e) => props.setKeywords(e.target.value)}
            placeholder="applicant tracking, hiring funnel, recruiting ops"
            className={baseInput}
          />
        </div>
        <div>
          <FieldLabel hint="Optional — adds competitor teaser">
            Competitor URL
          </FieldLabel>
          <input
            type="url"
            value={props.competitorUrl}
            onChange={(e) => props.setCompetitorUrl(e.target.value)}
            placeholder="https://competitor.com"
            className={baseInput}
            spellCheck={false}
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 mt-8 pt-6 border-t border-white/[0.06]">
        {props.authLoaded && !props.isSignedIn ? (
          <p className="text-[13px] text-neutral-500 flex-1">
            Free tier covers 50 packets / month.{" "}
            <Link
              href="/signup"
              className="text-white underline decoration-white/30 hover:decoration-white/60"
            >
              Sign up
            </Link>{" "}
            to run.
          </p>
        ) : (
          <p className="text-[13px] text-neutral-500 flex-1">
            Average run:{" "}
            <span className="font-mono text-neutral-300">60–90s</span>. One run
            consumes one packet credit.
          </p>
        )}

        {props.authLoaded && !props.isSignedIn ? (
          <Link
            href="/signup?redirect=/playbooks/agency-content-packet"
            className="px-6 py-3 rounded-xl bg-[#B5532C] text-black font-semibold text-[14px] hover:bg-[#cd6234] transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            Sign up to generate
            <ArrowRight className="w-4 h-4" />
          </Link>
        ) : (
          <button
            type="submit"
            disabled={!props.formValid}
            className="px-6 py-3 rounded-xl bg-[#B5532C] text-black font-semibold text-[14px] hover:bg-[#cd6234] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center gap-2 whitespace-nowrap"
          >
            Generate packet
            <ArrowRight className="w-4 h-4" />
          </button>
        )}
      </div>

      {props.error ? (
        <p
          role="alert"
          className="flex items-center gap-2 text-[13px] text-red-400/90 mt-4"
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          {props.error}
        </p>
      ) : null}
    </motion.form>
  );
}

function RunningState({ progressIdx }: { progressIdx: number }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-8 md:p-12"
    >
      <div className="flex items-center gap-3 mb-6">
        <Loader2 className="w-5 h-5 animate-spin text-[#B5532C]" />
        <p className="text-[15px] font-medium text-white">
          {PROGRESS_STEPS[progressIdx]}
        </p>
      </div>
      <ul className="space-y-2 text-[13px] font-mono">
        {PROGRESS_STEPS.map((step, i) => (
          <li
            key={step}
            className={
              i < progressIdx
                ? "text-neutral-500"
                : i === progressIdx
                  ? "text-white"
                  : "text-neutral-700"
            }
          >
            {i < progressIdx ? "✓ " : i === progressIdx ? "▸ " : "  "}
            {step}
          </li>
        ))}
      </ul>
      <p className="text-[12px] text-neutral-600 mt-6">
        Four agents running in parallel. Total run time is bounded by the
        slowest sub-asset.
      </p>
    </motion.div>
  );
}

function AssetCard({
  icon: Icon,
  title,
  meta,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  meta?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-white/[0.07] bg-white/[0.02] overflow-hidden">
      <header className="px-5 py-4 border-b border-white/[0.06] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-[#B5532C]" />
          <h3 className="text-[13px] font-semibold text-white">{title}</h3>
        </div>
        {meta ? (
          <span className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
            {meta}
          </span>
        ) : null}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}

function CopyButton({
  text,
  label = "Copy",
}: {
  text: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={async () => {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-[11px] text-neutral-300 hover:bg-white/[0.08] hover:text-white transition-colors"
    >
      {copied ? (
        <>
          <CheckCircle2 className="w-3 h-3 text-emerald-400" />
          Copied
        </>
      ) : (
        <>
          <Copy className="w-3 h-3" />
          {label}
        </>
      )}
    </button>
  );
}

function PacketResult({
  packet,
  onReset,
}: {
  packet: AgencyPacket;
  onReset: () => void;
}) {
  const seconds = (packet.durationMs / 1000).toFixed(1);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      {/* Result header */}
      <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-300/80 mb-1">
            Packet ready · {seconds}s
          </p>
          <h2 className="text-lg font-semibold text-white">
            {packet.client.name} <span className="text-neutral-500">·</span>{" "}
            <span className="text-neutral-400 font-mono text-[14px]">
              {packet.client.domain}
            </span>
          </h2>
        </div>
        <button
          onClick={onReset}
          className="text-[12px] text-neutral-400 hover:text-white underline decoration-white/10 hover:decoration-white/40 underline-offset-4"
        >
          Run another packet →
        </button>
      </div>

      {packet.errors.length > 0 ? (
        <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-4">
          <p className="text-[11px] font-mono uppercase tracking-wider text-amber-300/80 mb-2">
            Partial result · {packet.errors.length} sub-asset{" "}
            {packet.errors.length === 1 ? "failed" : "failed"}
          </p>
          <ul className="text-[13px] text-neutral-400 space-y-1">
            {packet.errors.map((e) => (
              <li key={e.asset}>
                <span className="font-mono text-amber-200/70">{e.asset}:</span>{" "}
                {e.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {packet.blog ? (
        <AssetCard
          icon={FileText}
          title="SEO blog post"
          meta={`${packet.blog.wordCount} words · ${packet.blog.primaryKeyword}`}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-[15px] font-semibold text-white">
              {packet.blog.title}
            </p>
            <CopyButton text={packet.blog.body} label="Copy markdown" />
          </div>
          <p className="text-[12px] text-neutral-500 italic mb-3">
            Meta: {packet.blog.metaDescription}
          </p>
          <pre className="text-[13px] text-neutral-300 whitespace-pre-wrap leading-relaxed max-h-[420px] overflow-y-auto font-sans">
            {packet.blog.body}
          </pre>
        </AssetCard>
      ) : null}

      {packet.emailSequence ? (
        <AssetCard
          icon={Mail}
          title="Email sequence"
          meta={`${packet.emailSequence.emails.length} emails · ${packet.emailSequence.sequenceName}`}
        >
          <ul className="space-y-4">
            {packet.emailSequence.emails.map((em) => (
              <li
                key={em.stepNumber}
                className="rounded-xl border border-white/[0.06] bg-black/20 p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-neutral-500">
                    Email {em.stepNumber} · day +{em.delayDays}
                  </p>
                  <CopyButton
                    text={`Subject: ${em.subject}\n\n${em.body}`}
                    label="Copy"
                  />
                </div>
                <p className="text-[14px] font-semibold text-white mb-2">
                  {em.subject}
                </p>
                <p className="text-[13px] text-neutral-300 whitespace-pre-wrap leading-relaxed">
                  {em.body}
                </p>
              </li>
            ))}
          </ul>
        </AssetCard>
      ) : null}

      {packet.ads ? (
        <AssetCard
          icon={Megaphone}
          title="Ad creatives"
          meta={`${packet.ads.length} platforms`}
        >
          <ul className="grid md:grid-cols-3 gap-4">
            {packet.ads.map((ad) => (
              <li
                key={ad.platform}
                className="rounded-xl border border-white/[0.06] bg-black/20 p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-[#B5532C]">
                    {ad.platform}
                  </p>
                  <CopyButton
                    text={`${ad.headline}\n\n${ad.primaryText}\n\nCTA: ${ad.callToAction}`}
                  />
                </div>
                <p className="text-[12px] text-neutral-500 italic mb-2">
                  Hook: {ad.hook}
                </p>
                <p className="text-[14px] font-semibold text-white mb-2 leading-snug">
                  {ad.headline}
                </p>
                <p className="text-[13px] text-neutral-300 leading-relaxed mb-3">
                  {ad.primaryText}
                </p>
                <p className="text-[11px] font-mono uppercase tracking-wider text-emerald-300/80">
                  → {ad.callToAction}
                </p>
              </li>
            ))}
          </ul>
        </AssetCard>
      ) : null}

      {packet.competitor ? (
        <AssetCard
          icon={Crosshair}
          title="Competitor teaser"
          meta={packet.competitor.competitor}
        >
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-red-500/15 bg-red-500/[0.04] p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-mono uppercase tracking-wider text-red-300/80">
                  Top weakness
                </p>
                <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30">
                  {packet.competitor.topWeakness.severity}
                </span>
              </div>
              <p className="text-[14px] text-white font-medium mb-2 leading-snug">
                {packet.competitor.topWeakness.issue}
              </p>
              <p className="text-[13px] text-neutral-400 leading-relaxed">
                <span className="text-neutral-500">Exploit: </span>
                {packet.competitor.topWeakness.exploit}
              </p>
            </div>
            <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/[0.04] p-4">
              <p className="text-[11px] font-mono uppercase tracking-wider text-emerald-300/80 mb-2">
                Market gap
              </p>
              <p className="text-[14px] text-white font-medium mb-2 leading-snug">
                {packet.competitor.topGap.gap}
              </p>
              <p className="text-[13px] text-neutral-400 leading-relaxed">
                <span className="text-neutral-500">Opportunity: </span>
                {packet.competitor.topGap.opportunity}
              </p>
            </div>
          </div>
        </AssetCard>
      ) : null}

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-[13px] text-neutral-400">
          <Sparkles className="inline w-3.5 h-3.5 text-[#B5532C] mr-1.5 align-text-bottom" />
          Schedule this packet to run weekly for every client in your roster —
          available on the Array plan.
        </p>
        <Link
          href="/dashboard/playbooks"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-[13px] hover:bg-neutral-200 transition-colors whitespace-nowrap"
        >
          Schedule weekly
          <Download className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="mt-12">
        <Link
          href="/"
          className="inline-flex items-center gap-2 text-xs text-neutral-500 hover:text-white uppercase tracking-widest"
        >
          <ArrowLeft className="w-3 h-3" />
          Home
        </Link>
      </div>
    </motion.div>
  );
}

function AssetTeaser({ visible }: { visible: boolean }) {
  return (
    <AnimatePresence>
      {visible ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          className="grid md:grid-cols-2 gap-4 mt-12"
        >
          {[
            {
              Icon: FileText,
              title: "1,500-word SEO blog post",
              detail:
                "Live research, structured H2/H3, primary keyword woven 4–8×, meta description, no slop.",
            },
            {
              Icon: Mail,
              title: "3-email welcome sequence",
              detail:
                "Subject lines under 8 words, 120–220 word bodies, one CTA each, day-0 / day-2 / day-5 cadence.",
            },
            {
              Icon: Megaphone,
              title: "3 ad creatives",
              detail:
                "LinkedIn (B2B credibility), Meta (scroll-stopping pain), Google (transactional outcome).",
            },
            {
              Icon: Crosshair,
              title: "Competitor teaser",
              detail:
                "Optional — supply a competitor URL and get one specific weakness + one specific market gap.",
            },
          ].map(({ Icon, title, detail }) => (
            <div
              key={title}
              className="rounded-xl border border-white/[0.06] bg-white/[0.015] p-5 flex items-start gap-3"
            >
              <Icon className="w-4 h-4 text-[#B5532C] mt-0.5 shrink-0" />
              <div>
                <p className="text-[13px] font-semibold text-white mb-1">
                  {title}
                </p>
                <p className="text-[12px] text-neutral-500 leading-relaxed">
                  {detail}
                </p>
              </div>
            </div>
          ))}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
