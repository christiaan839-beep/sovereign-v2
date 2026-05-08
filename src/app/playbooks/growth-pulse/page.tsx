"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@clerk/nextjs";
import {
  ArrowRight,
  ArrowLeft,
  Globe,
  MapPin,
  Megaphone,
  Mail,
  MessageCircle,
  Tag,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Sparkles,
} from "lucide-react";

/**
 * /playbooks/growth-pulse — Vertical 3 (African SMBs) cornerstone.
 *
 * Locale-aware monthly deliverable. Bills in ZAR / NGN / KES / EGP / GHS.
 * Same shipment shape as agency-content-packet and recruiting-sourcing-sprint.
 */

interface SeoChecklist {
  priorityFix: string;
  items: Array<{ task: string; why: string; estimatedMinutes: number }>;
  localKeywords: string[];
}
interface SocialPost {
  platform: "Instagram" | "Facebook" | "LinkedIn" | "X";
  caption: string;
  hashtags: string[];
  charCount: number;
}
interface ReEngagementEmail {
  subject: string;
  body: string;
  segment: string;
}
interface WhatsappBroadcast {
  template: string;
  segmentationCue: string;
  optInDisclaimer: string;
  charCount: number;
}
interface OfferCard {
  headline: string;
  description: string;
  priceLabel: string;
  validUntilSuggestion: string;
  redemptionMechanic: string;
  currency?: string;
}
interface Pulse {
  business: { name: string; locale: string; currency: string };
  generatedAt: string;
  durationMs: number;
  brandVoice: string;
  seo: SeoChecklist | null;
  socialPosts: SocialPost[] | null;
  reEngagementEmail: ReEngagementEmail | null;
  whatsapp: WhatsappBroadcast | null;
  offer: OfferCard | null;
  errors: Array<{ asset: string; message: string }>;
}

const LOCALES = [
  { value: "ZA", label: "South Africa (ZAR)" },
  { value: "NG", label: "Nigeria (NGN)" },
  { value: "KE", label: "Kenya (KES)" },
  { value: "EG", label: "Egypt (EGP)" },
  { value: "GH", label: "Ghana (GHS)" },
  { value: "ZM", label: "Zambia" },
  { value: "ZW", label: "Zimbabwe" },
  { value: "BW", label: "Botswana" },
  { value: "MA", label: "Morocco" },
  { value: "TN", label: "Tunisia" },
  { value: "global-emerging", label: "Other emerging market" },
] as const;

const VOICES = [
  { value: "warm", label: "Warm" },
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "playful", label: "Playful" },
  { value: "direct", label: "Direct" },
] as const;

const PROGRESS_STEPS = [
  "Auditing local SEO + Google Business signals",
  "Drafting 4 platform-specific social posts",
  "Writing the customer re-engagement email",
  "Composing the WhatsApp broadcast template",
  "Designing the limited-time offer card",
];

export default function GrowthPulsePage() {
  const { isSignedIn, isLoaded: authLoaded } = useUser();

  const [businessName, setBusinessName] = useState("");
  const [businessDescription, setBusinessDescription] = useState("");
  const [industry, setIndustry] = useState("");
  const [locale, setLocale] = useState<(typeof LOCALES)[number]["value"]>("ZA");
  const [topServices, setTopServices] = useState("");
  const [brandVoice, setBrandVoice] =
    useState<(typeof VOICES)[number]["value"]>("warm");
  const [websiteUrl, setWebsiteUrl] = useState("");

  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">(
    "idle",
  );
  const [progressIdx, setProgressIdx] = useState(0);
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [error, setError] = useState("");

  const services = topServices
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const formValid =
    businessName.trim().length >= 2 &&
    businessDescription.trim().length >= 20 &&
    industry.trim().length >= 2 &&
    services.length >= 1 &&
    services.length <= 3;

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!formValid) return;

    setPhase("running");
    setProgressIdx(0);
    setError("");
    setPulse(null);

    const timer = setInterval(() => {
      setProgressIdx((i) => Math.min(i + 1, PROGRESS_STEPS.length - 1));
    }, 6000);

    try {
      const res = await fetch("/api/agents/growth-pulse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessName: businessName.trim(),
          businessDescription: businessDescription.trim(),
          industry: industry.trim(),
          locale,
          topServices: services.slice(0, 3),
          brandVoice,
          websiteUrl: websiteUrl.trim() || undefined,
        }),
      });
      clearInterval(timer);

      if (res.status === 401) {
        setError("Sign in to run the full pulse.");
        setPhase("error");
        return;
      }
      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        setError(
          body?.message || "Quota reached — upgrade to keep generating.",
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

      const body = (await res.json()) as Pulse;
      setPulse(body);
      setPhase("done");
    } catch {
      clearInterval(timer);
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
            businessName={businessName}
            setBusinessName={setBusinessName}
            businessDescription={businessDescription}
            setBusinessDescription={setBusinessDescription}
            industry={industry}
            setIndustry={setIndustry}
            locale={locale}
            setLocale={setLocale}
            topServices={topServices}
            setTopServices={setTopServices}
            brandVoice={brandVoice}
            setBrandVoice={setBrandVoice}
            websiteUrl={websiteUrl}
            setWebsiteUrl={setWebsiteUrl}
            formValid={formValid}
            error={error}
            onSubmit={generate}
          />
        ) : null}

        {phase === "running" ? (
          <RunningState progressIdx={progressIdx} />
        ) : null}

        {phase === "done" && pulse ? (
          <PulseResult
            pulse={pulse}
            onReset={() => {
              setPulse(null);
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
        href="/pricing"
        className="px-4 py-2 rounded-full border border-white/15 text-xs font-semibold hover:border-white/30 transition-colors"
      >
        Pricing in Rands →
      </Link>
    </nav>
  );
}

function PageHeader() {
  return (
    <header className="mb-12">
      <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-[#B5532C] mb-4">
        Playbook · Growth pulse
      </p>
      <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-6 leading-tight max-w-3xl">
        Built for African SMBs.{" "}
        <em className="not-italic" style={{ color: "#B5532C" }}>
          Billed in Rands.
        </em>
      </h1>
      <p className="text-base text-neutral-400 leading-relaxed max-w-2xl">
        Drop your business name, locale, and top services. Get a local-SEO
        checklist, four platform-specific social posts, a customer re-engagement
        email, a WhatsApp broadcast template, and a limited-time offer card in
        your local currency. Monthly cadence, R349 / month.
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
  businessName: string;
  setBusinessName: (v: string) => void;
  businessDescription: string;
  setBusinessDescription: (v: string) => void;
  industry: string;
  setIndustry: (v: string) => void;
  locale: (typeof LOCALES)[number]["value"];
  setLocale: (v: (typeof LOCALES)[number]["value"]) => void;
  topServices: string;
  setTopServices: (v: string) => void;
  brandVoice: (typeof VOICES)[number]["value"];
  setBrandVoice: (v: (typeof VOICES)[number]["value"]) => void;
  websiteUrl: string;
  setWebsiteUrl: (v: string) => void;
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
          <FieldLabel>Business name</FieldLabel>
          <input
            type="text"
            value={props.businessName}
            onChange={(e) => props.setBusinessName(e.target.value)}
            placeholder="Ndlovu Hair & Beauty"
            className={baseInput}
            maxLength={80}
            required
          />
        </div>
        <div>
          <FieldLabel>Industry</FieldLabel>
          <input
            type="text"
            value={props.industry}
            onChange={(e) => props.setIndustry(e.target.value)}
            placeholder="salon, accounting, e-commerce"
            className={baseInput}
            maxLength={80}
            required
          />
        </div>
      </div>

      <div className="mt-5">
        <FieldLabel hint={`${props.businessDescription.length} / 2000`}>
          What does the business do?
        </FieldLabel>
        <textarea
          rows={3}
          value={props.businessDescription}
          onChange={(e) => props.setBusinessDescription(e.target.value)}
          placeholder="Two sentences — what you sell, who you serve, one thing that makes you different in your area."
          className={`${baseInput} resize-y min-h-[88px]`}
          maxLength={2000}
          required
        />
      </div>

      <div className="grid md:grid-cols-2 gap-5 mt-5">
        <div>
          <FieldLabel>Locale (drives currency + voice)</FieldLabel>
          <select
            value={props.locale}
            onChange={(e) =>
              props.setLocale(
                e.target.value as (typeof LOCALES)[number]["value"],
              )
            }
            className={baseInput}
          >
            {LOCALES.map((l) => (
              <option key={l.value} value={l.value} className="bg-[#0A0A0A]">
                {l.label}
              </option>
            ))}
          </select>
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
          <FieldLabel hint="1–3, comma-separated">Top services</FieldLabel>
          <input
            type="text"
            value={props.topServices}
            onChange={(e) => props.setTopServices(e.target.value)}
            placeholder="braids, manicure, hair colour"
            className={baseInput}
            required
          />
        </div>
        <div>
          <FieldLabel hint="Optional — sharpens local SEO">Website</FieldLabel>
          <input
            type="url"
            value={props.websiteUrl}
            onChange={(e) => props.setWebsiteUrl(e.target.value)}
            placeholder="https://yourbusiness.co.za"
            className={baseInput}
          />
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 mt-8 pt-6 border-t border-white/[0.06]">
        {props.authLoaded && !props.isSignedIn ? (
          <p className="text-[13px] text-neutral-500 flex-1">
            R349 / month covers 50 pulses.{" "}
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
            consumes one pulse credit.
          </p>
        )}

        {props.authLoaded && !props.isSignedIn ? (
          <Link
            href="/signup?redirect=/playbooks/growth-pulse"
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
            Generate pulse
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
        Five generators running in parallel. Total run time is bounded by the
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

function PulseResult({
  pulse,
  onReset,
}: {
  pulse: Pulse;
  onReset: () => void;
}) {
  const seconds = (pulse.durationMs / 1000).toFixed(1);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-300/80 mb-1">
            Pulse ready · {seconds}s
          </p>
          <h2 className="text-lg font-semibold text-white">
            {pulse.business.name} <span className="text-neutral-500">·</span>{" "}
            <span className="text-neutral-400 font-mono text-[14px]">
              {pulse.business.locale} / {pulse.business.currency}
            </span>
          </h2>
        </div>
        <button
          onClick={onReset}
          className="text-[12px] text-neutral-400 hover:text-white underline decoration-white/10 hover:decoration-white/40 underline-offset-4"
        >
          Run another pulse →
        </button>
      </div>

      {pulse.errors.length > 0 ? (
        <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-4">
          <p className="text-[11px] font-mono uppercase tracking-wider text-amber-300/80 mb-2">
            Partial result · {pulse.errors.length} sub-asset failed
          </p>
          <ul className="text-[13px] text-neutral-400 space-y-1">
            {pulse.errors.map((e) => (
              <li key={e.asset}>
                <span className="font-mono text-amber-200/70">{e.asset}:</span>{" "}
                {e.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {pulse.seo ? (
        <AssetCard
          icon={MapPin}
          title="Local-SEO checklist"
          meta={`${pulse.seo.items.length} items`}
        >
          <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.05] p-4 mb-4">
            <p className="text-[10px] font-mono uppercase tracking-wider text-amber-300/80 mb-1">
              Priority fix this month
            </p>
            <p className="text-[14px] text-white font-medium">
              {pulse.seo.priorityFix}
            </p>
          </div>
          <ul className="space-y-2 mb-4">
            {pulse.seo.items.map((it, i) => (
              <li
                key={`${it.task}-${i}`}
                className="flex items-start justify-between gap-3 rounded-lg border border-white/[0.06] bg-black/20 p-3"
              >
                <div className="flex-1">
                  <p className="text-[13.5px] text-white font-medium mb-1">
                    {it.task}
                  </p>
                  <p className="text-[12px] text-neutral-500 leading-relaxed">
                    {it.why}
                  </p>
                </div>
                <span className="text-[10px] font-mono text-neutral-600 whitespace-nowrap shrink-0 mt-1">
                  ~{it.estimatedMinutes}m
                </span>
              </li>
            ))}
          </ul>
          <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-2">
            Local keywords
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {pulse.seo.localKeywords.map((kw, i) => (
              <li
                key={`${kw}-${i}`}
                className="text-[12px] px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-neutral-300 font-mono"
              >
                {kw}
              </li>
            ))}
          </ul>
        </AssetCard>
      ) : null}

      {pulse.socialPosts ? (
        <AssetCard
          icon={Megaphone}
          title="Social posts"
          meta={`${pulse.socialPosts.length} platforms`}
        >
          <ul className="grid md:grid-cols-2 gap-4">
            {pulse.socialPosts.map((p) => (
              <li
                key={p.platform}
                className="rounded-xl border border-white/[0.06] bg-black/20 p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-[#B5532C]">
                    {p.platform} · {p.charCount} chars
                  </p>
                  <CopyButton
                    text={`${p.caption}\n\n${p.hashtags.join(" ")}`}
                  />
                </div>
                <p className="text-[13px] text-neutral-200 leading-relaxed mb-3 whitespace-pre-wrap">
                  {p.caption}
                </p>
                <p className="text-[11px] text-neutral-500 font-mono">
                  {p.hashtags.join(" ")}
                </p>
              </li>
            ))}
          </ul>
        </AssetCard>
      ) : null}

      {pulse.reEngagementEmail ? (
        <AssetCard
          icon={Mail}
          title="Customer re-engagement email"
          meta={pulse.reEngagementEmail.segment}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-[14px] font-semibold text-white">
              {pulse.reEngagementEmail.subject}
            </p>
            <CopyButton
              text={`Subject: ${pulse.reEngagementEmail.subject}\n\n${pulse.reEngagementEmail.body}`}
            />
          </div>
          <p className="text-[13px] text-neutral-300 leading-relaxed whitespace-pre-wrap">
            {pulse.reEngagementEmail.body}
          </p>
        </AssetCard>
      ) : null}

      {pulse.whatsapp ? (
        <AssetCard
          icon={MessageCircle}
          title="WhatsApp broadcast"
          meta={`${pulse.whatsapp.charCount} chars`}
        >
          <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-500 mb-2">
            Send to: {pulse.whatsapp.segmentationCue}
          </p>
          <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.04] p-4 mb-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[11px] font-mono uppercase tracking-wider text-emerald-300/80">
                Template
              </p>
              <CopyButton text={pulse.whatsapp.template} />
            </div>
            <p className="text-[13px] text-neutral-200 leading-relaxed whitespace-pre-wrap">
              {pulse.whatsapp.template}
            </p>
          </div>
          <p className="text-[12px] text-neutral-500 italic leading-relaxed">
            Opt-out: {pulse.whatsapp.optInDisclaimer}
          </p>
        </AssetCard>
      ) : null}

      {pulse.offer ? (
        <AssetCard icon={Tag} title="Limited-time offer card">
          <div className="rounded-xl border-2 border-[#B5532C]/30 bg-gradient-to-br from-[#B5532C]/[0.06] to-transparent p-6">
            <p className="text-2xl font-black text-white mb-2 leading-tight">
              {pulse.offer.headline}
            </p>
            <p className="text-[14px] text-neutral-300 leading-relaxed mb-4">
              {pulse.offer.description}
            </p>
            <div className="flex items-baseline gap-3 mb-4">
              <span className="text-3xl font-black text-[#B5532C] font-mono">
                {pulse.offer.priceLabel}
              </span>
              <span className="text-[12px] text-neutral-500">
                Valid until: {pulse.offer.validUntilSuggestion}
              </span>
            </div>
            <p className="text-[12px] font-mono text-emerald-300/90 mb-3">
              → {pulse.offer.redemptionMechanic}
            </p>
            <div className="flex justify-end">
              <CopyButton
                text={`${pulse.offer.headline}\n\n${pulse.offer.description}\n\n${pulse.offer.priceLabel} — Valid until ${pulse.offer.validUntilSuggestion}\n${pulse.offer.redemptionMechanic}`}
                label="Copy full card"
              />
            </div>
          </div>
        </AssetCard>
      ) : null}

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-[13px] text-neutral-400">
          <Sparkles className="inline w-3.5 h-3.5 text-[#B5532C] mr-1.5 align-text-bottom" />
          Schedule this pulse to run monthly. R349 / month, billed in Rands.
        </p>
        <Link
          href="/dashboard/playbooks"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-[13px] hover:bg-neutral-200 transition-colors whitespace-nowrap"
        >
          Schedule monthly
          <ArrowRight className="w-3.5 h-3.5" />
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
              Icon: MapPin,
              title: "Local-SEO checklist",
              detail:
                "Priority fix + 6 concrete tasks with estimated minutes + 5–8 local keywords. Built around your locale, not US suburbia.",
            },
            {
              Icon: Megaphone,
              title: "4 social posts",
              detail:
                "Instagram, Facebook, LinkedIn, X. Currency in Rands not dollars. Hashtags mix branded + local + service-specific.",
            },
            {
              Icon: Mail,
              title: "Re-engagement email",
              detail:
                "Targets 90+ day dormant customers. Leads with what's new, not a discount. One specific CTA.",
            },
            {
              Icon: MessageCircle,
              title: "WhatsApp broadcast",
              detail:
                "The dominant SMB channel in Africa. Template + segmentation cue + opt-out language for compliance.",
            },
            {
              Icon: Tag,
              title: "Limited-time offer card",
              detail:
                "Anchored on one of your top services. Price in your local currency (R, ₦, KSh, E£, GHS, $). Real redemption mechanic.",
            },
            {
              Icon: Globe,
              title: "Locale-aware everything",
              detail:
                "South Africa, Nigeria, Kenya, Egypt, Ghana, Zambia, Zimbabwe, Botswana, Morocco, Tunisia. Currency + voice + references match.",
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
