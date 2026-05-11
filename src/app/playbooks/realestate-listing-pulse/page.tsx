"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@clerk/nextjs";
import {
  ArrowRight,
  ArrowLeft,
  Home,
  FileText,
  Megaphone,
  Mail,
  TrendingUp,
  Map,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Sparkles,
} from "lucide-react";

interface ListingDescription {
  headline: string;
  body: string;
  wordCount: number;
  metaSnippet: string;
}
interface OpenHouseSocial {
  instagram: { caption: string; hashtags: string[] };
  facebook: { caption: string; hashtags: string[] };
  whatsapp: { message: string; segmentationCue: string };
}
interface BuyerEmail {
  subject: string;
  body: string;
  segment: string;
}
interface CompAnalysis {
  comps: Array<{
    descriptor: string;
    soldOrListed: string;
    differentiator: string;
  }>;
  positioningNote: string;
}
interface MarketUpdate {
  headline: string;
  bullets: string[];
  voiceNoteOpener: string;
}
interface Pulse {
  property: { address: string; suburb: string; priceLabel: string };
  generatedAt: string;
  durationMs: number;
  brandVoice: string;
  listing: ListingDescription | null;
  social: OpenHouseSocial | null;
  buyerEmail: BuyerEmail | null;
  comps: CompAnalysis | null;
  marketUpdate: MarketUpdate | null;
  errors: Array<{ asset: string; message: string }>;
}

const CURRENCIES = ["ZAR", "USD", "GBP", "EUR", "AUD"] as const;
const PROPERTY_TYPES = [
  "house",
  "apartment",
  "townhouse",
  "estate",
  "smallholding",
  "commercial",
] as const;
const VOICES = [
  { value: "luxury", label: "Luxury (restrained)" },
  { value: "warm", label: "Warm (lifestyle-led)" },
  { value: "professional", label: "Professional (factual)" },
  { value: "casual", label: "Casual (neighbourly)" },
  { value: "punchy", label: "Punchy (opinionated)" },
] as const;

const PROGRESS_STEPS = [
  "Writing the MLS-grade listing description",
  "Drafting open-house posts for IG / FB / WhatsApp",
  "Composing the buyer-list email blast",
  "Producing the 3-comparable analysis",
  "Generating the suburb market update",
];

export default function ListingPulsePage() {
  const { isSignedIn, isLoaded: authLoaded } = useUser();

  const [propertyAddress, setPropertyAddress] = useState("");
  const [suburb, setSuburb] = useState("");
  const [priceLabel, setPriceLabel] = useState("");
  const [currency, setCurrency] = useState<(typeof CURRENCIES)[number]>("ZAR");
  const [propertyType, setPropertyType] =
    useState<(typeof PROPERTY_TYPES)[number]>("house");
  const [bedrooms, setBedrooms] = useState(3);
  const [bathrooms, setBathrooms] = useState(2);
  const [areaLabel, setAreaLabel] = useState("");
  const [keyFeatures, setKeyFeatures] = useState("");
  const [targetBuyer, setTargetBuyer] = useState("");
  const [agentName, setAgentName] = useState("");
  const [brandVoice, setBrandVoice] =
    useState<(typeof VOICES)[number]["value"]>("warm");

  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">(
    "idle",
  );
  const [progressIdx, setProgressIdx] = useState(0);
  const [pulse, setPulse] = useState<Pulse | null>(null);
  const [error, setError] = useState("");

  const features = keyFeatures
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const formValid =
    propertyAddress.trim().length >= 5 &&
    suburb.trim().length >= 2 &&
    priceLabel.trim().length >= 2 &&
    features.length >= 1 &&
    features.length <= 8 &&
    agentName.trim().length >= 2;

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
      const res = await fetch("/api/agents/listing-pulse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyAddress: propertyAddress.trim(),
          suburb: suburb.trim(),
          priceLabel: priceLabel.trim(),
          currency,
          propertyType,
          bedrooms,
          bathrooms,
          areaLabel: areaLabel.trim() || undefined,
          keyFeatures: features.slice(0, 8),
          targetBuyer: targetBuyer.trim() || undefined,
          agentName: agentName.trim(),
          brandVoice,
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
            propertyAddress={propertyAddress}
            setPropertyAddress={setPropertyAddress}
            suburb={suburb}
            setSuburb={setSuburb}
            priceLabel={priceLabel}
            setPriceLabel={setPriceLabel}
            currency={currency}
            setCurrency={setCurrency}
            propertyType={propertyType}
            setPropertyType={setPropertyType}
            bedrooms={bedrooms}
            setBedrooms={setBedrooms}
            bathrooms={bathrooms}
            setBathrooms={setBathrooms}
            areaLabel={areaLabel}
            setAreaLabel={setAreaLabel}
            keyFeatures={keyFeatures}
            setKeyFeatures={setKeyFeatures}
            targetBuyer={targetBuyer}
            setTargetBuyer={setTargetBuyer}
            agentName={agentName}
            setAgentName={setAgentName}
            brandVoice={brandVoice}
            setBrandVoice={setBrandVoice}
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

function Nav() {
  return (
    <nav className="px-6 md:px-10 h-16 flex items-center justify-between max-w-5xl mx-auto">
      <Link href="/" className="text-sm font-semibold text-white">
        Sovereign Matrix
      </Link>
      <Link
        href="/for-realestate"
        className="px-4 py-2 rounded-full border border-white/15 text-xs font-semibold hover:border-white/30 transition-colors"
      >
        For real estate →
      </Link>
    </nav>
  );
}

function PageHeader() {
  return (
    <header className="mb-12">
      <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-[#B5532C] mb-4">
        Playbook · Listing pulse
      </p>
      <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-6 leading-tight max-w-3xl">
        One property →{" "}
        <em className="not-italic" style={{ color: "#B5532C" }}>
          a full week of listing assets
        </em>{" "}
        in 90 seconds.
      </h1>
      <p className="text-base text-neutral-400 leading-relaxed max-w-2xl">
        Drop a property&apos;s address, price, and key features. Get an
        MLS-grade listing description, open-house posts for Instagram / Facebook
        / WhatsApp, a buyer-list email blast, a 3-comparable analysis for your
        pricing conversation, and a one-page suburb market update — all anchored
        in your voice and ready to publish.
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
  propertyAddress: string;
  setPropertyAddress: (v: string) => void;
  suburb: string;
  setSuburb: (v: string) => void;
  priceLabel: string;
  setPriceLabel: (v: string) => void;
  currency: (typeof CURRENCIES)[number];
  setCurrency: (v: (typeof CURRENCIES)[number]) => void;
  propertyType: (typeof PROPERTY_TYPES)[number];
  setPropertyType: (v: (typeof PROPERTY_TYPES)[number]) => void;
  bedrooms: number;
  setBedrooms: (v: number) => void;
  bathrooms: number;
  setBathrooms: (v: number) => void;
  areaLabel: string;
  setAreaLabel: (v: string) => void;
  keyFeatures: string;
  setKeyFeatures: (v: string) => void;
  targetBuyer: string;
  setTargetBuyer: (v: string) => void;
  agentName: string;
  setAgentName: (v: string) => void;
  brandVoice: (typeof VOICES)[number]["value"];
  setBrandVoice: (v: (typeof VOICES)[number]["value"]) => void;
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
          <FieldLabel>Property address</FieldLabel>
          <input
            type="text"
            value={props.propertyAddress}
            onChange={(e) => props.setPropertyAddress(e.target.value)}
            placeholder="12 Beach Road, Sea Point"
            className={baseInput}
            maxLength={200}
            required
          />
        </div>
        <div>
          <FieldLabel>Suburb / neighborhood</FieldLabel>
          <input
            type="text"
            value={props.suburb}
            onChange={(e) => props.setSuburb(e.target.value)}
            placeholder="Sea Point"
            className={baseInput}
            maxLength={80}
            required
          />
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-5 mt-5">
        <div>
          <FieldLabel>Price (label)</FieldLabel>
          <input
            type="text"
            value={props.priceLabel}
            onChange={(e) => props.setPriceLabel(e.target.value)}
            placeholder="R3 950 000"
            className={baseInput}
            required
          />
        </div>
        <div>
          <FieldLabel>Currency</FieldLabel>
          <select
            value={props.currency}
            onChange={(e) =>
              props.setCurrency(e.target.value as (typeof CURRENCIES)[number])
            }
            className={baseInput}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c} className="bg-[#0A0A0A]">
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Type</FieldLabel>
          <select
            value={props.propertyType}
            onChange={(e) =>
              props.setPropertyType(
                e.target.value as (typeof PROPERTY_TYPES)[number],
              )
            }
            className={baseInput}
          >
            {PROPERTY_TYPES.map((t) => (
              <option key={t} value={t} className="bg-[#0A0A0A]">
                {t}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-5 mt-5">
        <div>
          <FieldLabel>Bedrooms</FieldLabel>
          <input
            type="number"
            min={0}
            max={20}
            value={props.bedrooms}
            onChange={(e) => props.setBedrooms(Number(e.target.value))}
            className={baseInput}
          />
        </div>
        <div>
          <FieldLabel>Bathrooms</FieldLabel>
          <input
            type="number"
            min={0}
            max={20}
            value={props.bathrooms}
            onChange={(e) => props.setBathrooms(Number(e.target.value))}
            className={baseInput}
          />
        </div>
        <div>
          <FieldLabel hint="Optional">Area</FieldLabel>
          <input
            type="text"
            value={props.areaLabel}
            onChange={(e) => props.setAreaLabel(e.target.value)}
            placeholder="180 m² or 1,940 ft²"
            className={baseInput}
          />
        </div>
      </div>

      <div className="mt-5">
        <FieldLabel hint="1–8, comma-separated">Key features</FieldLabel>
        <input
          type="text"
          value={props.keyFeatures}
          onChange={(e) => props.setKeyFeatures(e.target.value)}
          placeholder="north-facing, sea-view balcony, oak parquet, gas hob"
          className={baseInput}
          required
        />
      </div>

      <div className="grid md:grid-cols-2 gap-5 mt-5">
        <div>
          <FieldLabel hint="Optional">Target buyer</FieldLabel>
          <input
            type="text"
            value={props.targetBuyer}
            onChange={(e) => props.setTargetBuyer(e.target.value)}
            placeholder="Young families, downsizers, investors"
            className={baseInput}
          />
        </div>
        <div>
          <FieldLabel hint="Appears in CTAs">Your name</FieldLabel>
          <input
            type="text"
            value={props.agentName}
            onChange={(e) => props.setAgentName(e.target.value)}
            placeholder="Agent name"
            className={baseInput}
            required
          />
        </div>
      </div>

      <div className="mt-5">
        <FieldLabel>Voice</FieldLabel>
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

      <div className="flex flex-col sm:flex-row items-center gap-4 mt-8 pt-6 border-t border-white/[0.06]">
        {props.authLoaded && !props.isSignedIn ? (
          <p className="text-[13px] text-neutral-500 flex-1">
            Free tier covers 50 pulses / month.{" "}
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
            <span className="font-mono text-neutral-300">60–90s</span>.
          </p>
        )}

        {props.authLoaded && !props.isSignedIn ? (
          <Link
            href="/signup?redirect=/playbooks/realestate-listing-pulse"
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
            {pulse.property.address} <span className="text-neutral-500">·</span>{" "}
            <span className="text-neutral-400 font-mono text-[14px]">
              {pulse.property.priceLabel}
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

      {pulse.listing ? (
        <AssetCard
          icon={FileText}
          title="MLS-grade listing description"
          meta={`${pulse.listing.wordCount} words`}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-[15px] font-semibold text-white">
              {pulse.listing.headline}
            </p>
            <CopyButton text={pulse.listing.body} label="Copy markdown" />
          </div>
          <p className="text-[12px] text-neutral-500 italic mb-3">
            Meta: {pulse.listing.metaSnippet}
          </p>
          <pre className="text-[13px] text-neutral-300 whitespace-pre-wrap leading-relaxed font-sans">
            {pulse.listing.body}
          </pre>
        </AssetCard>
      ) : null}

      {pulse.social ? (
        <AssetCard icon={Megaphone} title="Open-house social posts">
          <div className="grid md:grid-cols-3 gap-4">
            <SocialBlock
              label="Instagram"
              text={pulse.social.instagram.caption}
              hashtags={pulse.social.instagram.hashtags}
            />
            <SocialBlock
              label="Facebook"
              text={pulse.social.facebook.caption}
              hashtags={pulse.social.facebook.hashtags}
            />
            <div className="rounded-xl border border-emerald-500/10 bg-emerald-500/[0.04] p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-mono uppercase tracking-wider text-emerald-300/80">
                  WhatsApp
                </p>
                <CopyButton text={pulse.social.whatsapp.message} />
              </div>
              <p className="text-[13px] text-neutral-200 leading-relaxed mb-3 whitespace-pre-wrap">
                {pulse.social.whatsapp.message}
              </p>
              <p className="text-[11px] text-neutral-500 italic leading-relaxed">
                Send to: {pulse.social.whatsapp.segmentationCue}
              </p>
            </div>
          </div>
        </AssetCard>
      ) : null}

      {pulse.buyerEmail ? (
        <AssetCard
          icon={Mail}
          title="Buyer-list email"
          meta={pulse.buyerEmail.segment}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-[14px] font-semibold text-white">
              {pulse.buyerEmail.subject}
            </p>
            <CopyButton
              text={`Subject: ${pulse.buyerEmail.subject}\n\n${pulse.buyerEmail.body}`}
            />
          </div>
          <p className="text-[13px] text-neutral-300 leading-relaxed whitespace-pre-wrap">
            {pulse.buyerEmail.body}
          </p>
        </AssetCard>
      ) : null}

      {pulse.comps ? (
        <AssetCard
          icon={TrendingUp}
          title="Comparable analysis"
          meta={`${pulse.comps.comps.length} comps`}
        >
          <ul className="space-y-3 mb-4">
            {pulse.comps.comps.map((c, i) => (
              <li
                key={`${c.descriptor}-${i}`}
                className="rounded-xl border border-white/[0.06] bg-black/20 p-4"
              >
                <p className="text-[13.5px] text-white font-medium mb-1">
                  {c.descriptor}
                </p>
                <p className="text-[12px] text-neutral-500 mb-2 font-mono">
                  {c.soldOrListed}
                </p>
                <p className="text-[12.5px] text-neutral-300 leading-relaxed">
                  <span className="text-neutral-500">Difference: </span>
                  {c.differentiator}
                </p>
              </li>
            ))}
          </ul>
          <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-4">
            <p className="text-[10px] font-mono uppercase tracking-wider text-amber-300/80 mb-1">
              Positioning note
            </p>
            <p className="text-[13px] text-neutral-200 leading-relaxed">
              {pulse.comps.positioningNote}
            </p>
          </div>
        </AssetCard>
      ) : null}

      {pulse.marketUpdate ? (
        <AssetCard icon={Map} title="Suburb market update">
          <p className="text-[15px] font-semibold text-white mb-4 leading-snug">
            {pulse.marketUpdate.headline}
          </p>
          <ul className="space-y-2 mb-4">
            {pulse.marketUpdate.bullets.map((b, i) => (
              <li
                key={`${i}-${b.slice(0, 20)}`}
                className="flex items-start gap-2 text-[13px] text-neutral-300"
              >
                <span className="text-[#B5532C] font-bold shrink-0 mt-0.5">
                  {i + 1}.
                </span>
                <span className="leading-relaxed">{b}</span>
              </li>
            ))}
          </ul>
          <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-mono uppercase tracking-wider text-neutral-500">
                Voice-note opener
              </p>
              <CopyButton text={pulse.marketUpdate.voiceNoteOpener} />
            </div>
            <p className="text-[13px] text-neutral-200 italic leading-relaxed">
              &ldquo;{pulse.marketUpdate.voiceNoteOpener}&rdquo;
            </p>
          </div>
        </AssetCard>
      ) : null}

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-[13px] text-neutral-400">
          <Sparkles className="inline w-3.5 h-3.5 text-[#B5532C] mr-1.5 align-text-bottom" />
          Schedule this pulse to run automatically every Monday for every active
          listing — available on the Array plan.
        </p>
        <Link
          href="/dashboard/playbooks"
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white text-black font-semibold text-[13px] hover:bg-neutral-200 transition-colors whitespace-nowrap"
        >
          Schedule weekly
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

function SocialBlock({
  label,
  text,
  hashtags,
}: {
  label: string;
  text: string;
  hashtags: string[];
}) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-black/20 p-4">
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-mono uppercase tracking-wider text-[#B5532C]">
          {label}
        </p>
        <CopyButton text={`${text}\n\n${hashtags.join(" ")}`} />
      </div>
      <p className="text-[13px] text-neutral-200 leading-relaxed mb-3 whitespace-pre-wrap">
        {text}
      </p>
      <p className="text-[11px] text-neutral-500 font-mono">
        {hashtags.join(" ")}
      </p>
    </div>
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
              title: "MLS-grade listing description",
              detail:
                "250–400 words, structured headline → key features → neighbourhood → close. No 'luxurious' or 'must-see'.",
            },
            {
              Icon: Megaphone,
              title: "IG / FB / WhatsApp open-house posts",
              detail:
                "Three platforms, one voice. WhatsApp template ready for your buyer-list broadcast.",
            },
            {
              Icon: Mail,
              title: "Buyer-list email",
              detail:
                "Targets buyers who registered interest in the suburb or price band. Leads with property, not platitudes.",
            },
            {
              Icon: TrendingUp,
              title: "3-comparable analysis",
              detail:
                "Three plausible comps + a positioning note for your pricing conversation. Honest about over- or under-pricing.",
            },
            {
              Icon: Map,
              title: "Suburb market update",
              detail:
                "Headline + 5 bullets you can drop into Stories or a buyer call, with a 50-word voice-note opener.",
            },
            {
              Icon: Home,
              title: "Brand-voice aware",
              detail:
                "Luxury / warm / professional / casual / punchy — the listing description matches the agent's brand.",
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
