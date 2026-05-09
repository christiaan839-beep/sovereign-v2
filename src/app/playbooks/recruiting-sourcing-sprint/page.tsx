"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { useUser } from "@clerk/nextjs";
import {
  ArrowRight,
  ArrowLeft,
  Users,
  Target,
  Search,
  MessageSquare,
  Compass,
  Shield,
  Loader2,
  CheckCircle2,
  AlertTriangle,
  Copy,
  Sparkles,
} from "lucide-react";

/**
 * /playbooks/recruiting-sourcing-sprint — Vertical 2 (recruiting) cornerstone.
 *
 * Mirrors the agency-content-packet shape: anonymous visitors see the
 * intake form + sign-up CTA; signed-in users hit /api/agents/sourcing-sprint.
 */

interface IcpProfile {
  archetype: string;
  yearsExperienceMin: number;
  yearsExperienceMax: number;
  mustHaveSignals: string[];
  niceToHaveSignals: string[];
  motivators: string[];
  redFlags: string[];
}
interface BooleanSearches {
  linkedin: string;
  googleXRay: string;
  github: string;
}
interface OutreachPack {
  linkedinDm: { body: string; charCount: number };
  coldEmail: { subject: string; body: string; wordCount: number };
  voicemail: { script: string; estimatedSeconds: number };
}
interface SourcingChannel {
  channel: string;
  why: string;
  firstAction: string;
}
interface ObjectionPlay {
  objection: string;
  response: string;
  escalation: string;
}
interface Sprint {
  role: { title: string; company: string };
  generatedAt: string;
  durationMs: number;
  urgency: string;
  icp: IcpProfile | null;
  booleans: BooleanSearches | null;
  outreach: OutreachPack | null;
  channels: SourcingChannel[] | null;
  objections: ObjectionPlay[] | null;
  errors: Array<{ asset: string; message: string }>;
}

const SENIORITY = ["junior", "mid", "senior", "staff", "principal"] as const;
const URGENCY = [
  { value: "fast-hire", label: "Fast hire (30 days)" },
  { value: "perfect-fit", label: "Perfect fit (quality > speed)" },
  { value: "passive-talent", label: "Passive talent (long-game)" },
] as const;

const PROGRESS_STEPS = [
  "Defining the ideal candidate profile",
  "Building boolean strings for LinkedIn / Google / GitHub",
  "Drafting LinkedIn DM, cold email, and voicemail",
  "Naming the 5 non-LinkedIn sourcing channels",
  "Writing the 4-objection playbook",
];

export default function RecruitingSourcingSprintPage() {
  const { isSignedIn, isLoaded: authLoaded } = useUser();

  const [roleTitle, setRoleTitle] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [companyDescription, setCompanyDescription] = useState("");
  const [mustHaveSkills, setMustHaveSkills] = useState("");
  const [seniorityLevel, setSeniorityLevel] =
    useState<(typeof SENIORITY)[number]>("senior");
  const [urgency, setUrgency] =
    useState<(typeof URGENCY)[number]["value"]>("perfect-fit");
  const [locationPreferences, setLocationPreferences] = useState("");
  const [compensationRange, setCompensationRange] = useState("");

  const [phase, setPhase] = useState<"idle" | "running" | "done" | "error">(
    "idle",
  );
  const [progressIdx, setProgressIdx] = useState(0);
  const [sprint, setSprint] = useState<Sprint | null>(null);
  const [error, setError] = useState("");

  const skillsParsed = mustHaveSkills
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const formValid =
    roleTitle.trim().length >= 2 &&
    companyName.trim().length >= 2 &&
    companyDescription.trim().length >= 20 &&
    skillsParsed.length >= 1 &&
    skillsParsed.length <= 10;

  async function generate(e: React.FormEvent) {
    e.preventDefault();
    if (!formValid) return;

    setPhase("running");
    setProgressIdx(0);
    setError("");
    setSprint(null);

    const timer = setInterval(() => {
      setProgressIdx((i) => Math.min(i + 1, PROGRESS_STEPS.length - 1));
    }, 6000);

    try {
      const res = await fetch("/api/agents/sourcing-sprint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleTitle: roleTitle.trim(),
          companyName: companyName.trim(),
          companyDescription: companyDescription.trim(),
          mustHaveSkills: skillsParsed.slice(0, 10),
          seniorityLevel,
          urgency,
          locationPreferences: locationPreferences.trim() || undefined,
          compensationRange: compensationRange.trim() || undefined,
        }),
      });
      clearInterval(timer);

      if (res.status === 401) {
        setError("Sign in to run the full sprint.");
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

      const body = (await res.json()) as Sprint;
      setSprint(body);
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
            roleTitle={roleTitle}
            setRoleTitle={setRoleTitle}
            companyName={companyName}
            setCompanyName={setCompanyName}
            companyDescription={companyDescription}
            setCompanyDescription={setCompanyDescription}
            mustHaveSkills={mustHaveSkills}
            setMustHaveSkills={setMustHaveSkills}
            seniorityLevel={seniorityLevel}
            setSeniorityLevel={setSeniorityLevel}
            urgency={urgency}
            setUrgency={setUrgency}
            locationPreferences={locationPreferences}
            setLocationPreferences={setLocationPreferences}
            compensationRange={compensationRange}
            setCompensationRange={setCompensationRange}
            formValid={formValid}
            error={error}
            onSubmit={generate}
          />
        ) : null}

        {phase === "running" ? (
          <RunningState progressIdx={progressIdx} />
        ) : null}

        {phase === "done" && sprint ? (
          <SprintResult
            sprint={sprint}
            onReset={() => {
              setSprint(null);
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
        href="/for-recruiting"
        className="px-4 py-2 rounded-full border border-white/15 text-xs font-semibold hover:border-white/30 transition-colors"
      >
        For recruiters →
      </Link>
    </nav>
  );
}

function PageHeader() {
  return (
    <header className="mb-12">
      <p className="text-[11px] font-mono uppercase tracking-[0.3em] text-[#B5532C] mb-4">
        Playbook · Recruiting sourcing sprint
      </p>
      <h1 className="text-4xl md:text-5xl font-black tracking-tight mb-6 leading-tight max-w-3xl">
        One role brief →{" "}
        <em className="not-italic" style={{ color: "#B5532C" }}>
          a full sourcing playbook
        </em>{" "}
        in 90 seconds.
      </h1>
      <p className="text-base text-neutral-400 leading-relaxed max-w-2xl">
        Drop the role title, must-have skills, and seniority. Get a structured
        ICP, three platform-specific boolean strings, three outreach drafts,
        five non-LinkedIn sourcing channels, and a 4-objection playbook — ready
        to hand to your sourcing team.
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
  roleTitle: string;
  setRoleTitle: (v: string) => void;
  companyName: string;
  setCompanyName: (v: string) => void;
  companyDescription: string;
  setCompanyDescription: (v: string) => void;
  mustHaveSkills: string;
  setMustHaveSkills: (v: string) => void;
  seniorityLevel: (typeof SENIORITY)[number];
  setSeniorityLevel: (v: (typeof SENIORITY)[number]) => void;
  urgency: (typeof URGENCY)[number]["value"];
  setUrgency: (v: (typeof URGENCY)[number]["value"]) => void;
  locationPreferences: string;
  setLocationPreferences: (v: string) => void;
  compensationRange: string;
  setCompensationRange: (v: string) => void;
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
          <FieldLabel>Role title</FieldLabel>
          <input
            type="text"
            value={props.roleTitle}
            onChange={(e) => props.setRoleTitle(e.target.value)}
            placeholder="Senior Backend Engineer"
            className={baseInput}
            maxLength={120}
            required
          />
        </div>
        <div>
          <FieldLabel>Hiring company</FieldLabel>
          <input
            type="text"
            value={props.companyName}
            onChange={(e) => props.setCompanyName(e.target.value)}
            placeholder="Acme Corp"
            className={baseInput}
            maxLength={80}
            required
          />
        </div>
      </div>

      <div className="mt-5">
        <FieldLabel hint={`${props.companyDescription.length} / 2000`}>
          What does the company do?
        </FieldLabel>
        <textarea
          rows={3}
          value={props.companyDescription}
          onChange={(e) => props.setCompanyDescription(e.target.value)}
          placeholder="Two sentences — what they build, who they serve, one differentiator that matters to candidates."
          className={`${baseInput} resize-y min-h-[88px]`}
          maxLength={2000}
          required
        />
      </div>

      <div className="grid md:grid-cols-2 gap-5 mt-5">
        <div>
          <FieldLabel hint="1–10, comma-separated">Must-have skills</FieldLabel>
          <input
            type="text"
            value={props.mustHaveSkills}
            onChange={(e) => props.setMustHaveSkills(e.target.value)}
            placeholder="Go, distributed systems, Postgres"
            className={baseInput}
            required
          />
        </div>
        <div>
          <FieldLabel>Seniority</FieldLabel>
          <select
            value={props.seniorityLevel}
            onChange={(e) =>
              props.setSeniorityLevel(
                e.target.value as (typeof SENIORITY)[number],
              )
            }
            className={baseInput}
          >
            {SENIORITY.map((s) => (
              <option key={s} value={s} className="bg-[#0A0A0A]">
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5 mt-5">
        <div>
          <FieldLabel>Sourcing posture</FieldLabel>
          <select
            value={props.urgency}
            onChange={(e) =>
              props.setUrgency(
                e.target.value as (typeof URGENCY)[number]["value"],
              )
            }
            className={baseInput}
          >
            {URGENCY.map((u) => (
              <option key={u.value} value={u.value} className="bg-[#0A0A0A]">
                {u.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel hint="Optional">Location preference</FieldLabel>
          <input
            type="text"
            value={props.locationPreferences}
            onChange={(e) => props.setLocationPreferences(e.target.value)}
            placeholder="Remote (US) or London hybrid"
            className={baseInput}
          />
        </div>
      </div>

      <div className="mt-5">
        <FieldLabel hint="Optional — sharpens motivators">
          Compensation range
        </FieldLabel>
        <input
          type="text"
          value={props.compensationRange}
          onChange={(e) => props.setCompensationRange(e.target.value)}
          placeholder="$140K–$180K + equity"
          className={baseInput}
        />
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-4 mt-8 pt-6 border-t border-white/[0.06]">
        {props.authLoaded && !props.isSignedIn ? (
          <p className="text-[13px] text-neutral-500 flex-1">
            Free tier covers 50 sprints / month.{" "}
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
            consumes one sprint credit.
          </p>
        )}

        {props.authLoaded && !props.isSignedIn ? (
          <Link
            href="/signup?redirect=/playbooks/recruiting-sourcing-sprint"
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
            Generate sprint
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

function PillList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-wrap gap-1.5">
      {items.map((item, i) => (
        <li
          key={`${item}-${i}`}
          className="text-[12px] px-2.5 py-1 rounded-md bg-white/[0.04] border border-white/[0.08] text-neutral-300"
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

function SprintResult({
  sprint,
  onReset,
}: {
  sprint: Sprint;
  onReset: () => void;
}) {
  const seconds = (sprint.durationMs / 1000).toFixed(1);
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-5"
    >
      <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.04] p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-emerald-300/80 mb-1">
            Sprint ready · {seconds}s
          </p>
          <h2 className="text-lg font-semibold text-white">
            {sprint.role.title} <span className="text-neutral-500">·</span>{" "}
            <span className="text-neutral-400 font-mono text-[14px]">
              {sprint.role.company}
            </span>
          </h2>
        </div>
        <button
          onClick={onReset}
          className="text-[12px] text-neutral-400 hover:text-white underline decoration-white/10 hover:decoration-white/40 underline-offset-4"
        >
          Run another sprint →
        </button>
      </div>

      {sprint.errors.length > 0 ? (
        <div className="rounded-xl border border-amber-500/15 bg-amber-500/[0.04] p-4">
          <p className="text-[11px] font-mono uppercase tracking-wider text-amber-300/80 mb-2">
            Partial result · {sprint.errors.length} sub-asset failed
          </p>
          <ul className="text-[13px] text-neutral-400 space-y-1">
            {sprint.errors.map((e) => (
              <li key={e.asset}>
                <span className="font-mono text-amber-200/70">{e.asset}:</span>{" "}
                {e.message}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {sprint.icp ? (
        <AssetCard
          icon={Target}
          title="Ideal candidate profile"
          meta={`${sprint.icp.yearsExperienceMin}–${sprint.icp.yearsExperienceMax} yrs`}
        >
          <p className="text-[15px] font-semibold text-white mb-4">
            {sprint.icp.archetype}
          </p>
          <div className="grid md:grid-cols-2 gap-4 text-[12px]">
            <div>
              <p className="text-neutral-500 uppercase tracking-wider mb-2 text-[10px] font-mono">
                Must-have signals
              </p>
              <PillList items={sprint.icp.mustHaveSignals} />
            </div>
            <div>
              <p className="text-neutral-500 uppercase tracking-wider mb-2 text-[10px] font-mono">
                Nice-to-have signals
              </p>
              <PillList items={sprint.icp.niceToHaveSignals} />
            </div>
            <div>
              <p className="text-neutral-500 uppercase tracking-wider mb-2 text-[10px] font-mono">
                Motivators
              </p>
              <PillList items={sprint.icp.motivators} />
            </div>
            <div>
              <p className="text-neutral-500 uppercase tracking-wider mb-2 text-[10px] font-mono">
                Red flags
              </p>
              <PillList items={sprint.icp.redFlags} />
            </div>
          </div>
        </AssetCard>
      ) : null}

      {sprint.booleans ? (
        <AssetCard icon={Search} title="Boolean searches">
          <ul className="space-y-3">
            {(["linkedin", "googleXRay", "github"] as const).map((k) => (
              <li
                key={k}
                className="rounded-xl border border-white/[0.06] bg-black/30 p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[11px] font-mono uppercase tracking-wider text-[#B5532C]">
                    {k === "googleXRay" ? "Google X-Ray" : k}
                  </p>
                  <CopyButton text={sprint.booleans![k]} />
                </div>
                <pre className="text-[12.5px] font-mono text-neutral-200 whitespace-pre-wrap break-words leading-relaxed">
                  {sprint.booleans?.[k]}
                </pre>
              </li>
            ))}
          </ul>
        </AssetCard>
      ) : null}

      {sprint.outreach ? (
        <AssetCard icon={MessageSquare} title="Outreach pack">
          <div className="grid md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-white/[0.06] bg-black/30 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-mono uppercase tracking-wider text-[#B5532C]">
                  LinkedIn DM · {sprint.outreach.linkedinDm.charCount} chars
                </p>
                <CopyButton text={sprint.outreach.linkedinDm.body} />
              </div>
              <p className="text-[13px] text-neutral-300 leading-relaxed whitespace-pre-wrap">
                {sprint.outreach.linkedinDm.body}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-black/30 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-mono uppercase tracking-wider text-[#B5532C]">
                  Cold email · {sprint.outreach.coldEmail.wordCount} words
                </p>
                <CopyButton
                  text={`Subject: ${sprint.outreach.coldEmail.subject}\n\n${sprint.outreach.coldEmail.body}`}
                />
              </div>
              <p className="text-[12px] font-semibold text-white mb-2">
                {sprint.outreach.coldEmail.subject}
              </p>
              <p className="text-[13px] text-neutral-300 leading-relaxed whitespace-pre-wrap">
                {sprint.outreach.coldEmail.body}
              </p>
            </div>
            <div className="rounded-xl border border-white/[0.06] bg-black/30 p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-[11px] font-mono uppercase tracking-wider text-[#B5532C]">
                  Voicemail · ~{sprint.outreach.voicemail.estimatedSeconds}s
                </p>
                <CopyButton text={sprint.outreach.voicemail.script} />
              </div>
              <p className="text-[13px] text-neutral-300 leading-relaxed whitespace-pre-wrap">
                {sprint.outreach.voicemail.script}
              </p>
            </div>
          </div>
        </AssetCard>
      ) : null}

      {sprint.channels ? (
        <AssetCard
          icon={Compass}
          title="Sourcing channels"
          meta={`${sprint.channels.length} non-LinkedIn`}
        >
          <ul className="space-y-3">
            {sprint.channels.map((c, i) => (
              <li
                key={`${c.channel}-${i}`}
                className="rounded-xl border border-white/[0.06] bg-black/20 p-4"
              >
                <p className="text-[14px] font-semibold text-white mb-1">
                  {i + 1}. {c.channel}
                </p>
                <p className="text-[13px] text-neutral-400 leading-relaxed mb-2">
                  {c.why}
                </p>
                <p className="text-[12px] text-emerald-300/90">
                  → {c.firstAction}
                </p>
              </li>
            ))}
          </ul>
        </AssetCard>
      ) : null}

      {sprint.objections ? (
        <AssetCard
          icon={Shield}
          title="Objection playbook"
          meta={`${sprint.objections.length} plays`}
        >
          <ul className="space-y-4">
            {sprint.objections.map((o, i) => (
              <li
                key={`${o.objection}-${i}`}
                className="rounded-xl border border-white/[0.06] bg-black/20 p-4"
              >
                <p className="text-[13px] italic text-amber-200/80 mb-2">
                  &ldquo;{o.objection}&rdquo;
                </p>
                <p className="text-[13px] text-neutral-200 leading-relaxed mb-2">
                  <span className="text-neutral-500 font-mono text-[10px] uppercase tracking-wider mr-2">
                    Reply
                  </span>
                  {o.response}
                </p>
                <p className="text-[12px] text-neutral-400 leading-relaxed">
                  <span className="text-neutral-600 font-mono text-[10px] uppercase tracking-wider mr-2">
                    If still cold
                  </span>
                  {o.escalation}
                </p>
              </li>
            ))}
          </ul>
        </AssetCard>
      ) : null}

      <div className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-[13px] text-neutral-400">
          <Sparkles className="inline w-3.5 h-3.5 text-[#B5532C] mr-1.5 align-text-bottom" />
          Schedule this sprint to run weekly for every open role on your roster
          — available on the Array plan.
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
              Icon: Target,
              title: "Structured ICP profile",
              detail:
                "Archetype, years range, must-have signals, nice-to-haves, motivators, and red flags — drawn tight enough to filter.",
            },
            {
              Icon: Search,
              title: "Three boolean strings",
              detail:
                "LinkedIn Recruiter syntax, Google X-Ray (site:linkedin.com/in/), GitHub Advanced. Anchored to your must-have skills.",
            },
            {
              Icon: MessageSquare,
              title: "Three outreach drafts",
              detail:
                "LinkedIn DM ≤300 chars, cold email ≤180 words, voicemail script ≤30 sec. No generic openings, no false familiarity.",
            },
            {
              Icon: Compass,
              title: "Five non-LinkedIn channels",
              detail:
                "Subreddits, conference attendee lists, OSS communities, Slack groups — with rationale and the first concrete action.",
            },
            {
              Icon: Shield,
              title: "Four-objection playbook",
              detail:
                'Top 4 candidate objections ("not looking", "comp too low", "never heard of you", "too risky") + response + escalation.',
            },
            {
              Icon: Users,
              title: "Whitelabel-ready",
              detail:
                "Hand the artifact to your sourcer, your client, or yourself on Monday. Same shape every time — recruiter brain on tap.",
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
