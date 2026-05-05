"use client";

import { useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowRight,
  Check,
  Copy,
  Loader2,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";
import { SovereignLogo } from "@/components/ui/SovereignLogo";

/**
 * /admin/onboard — Operator-only form. Replaces the raw-SQL UPDATE
 * pattern from the /welcome/[id] page comment with a real, validated
 * UI. Posts to /api/_admin/onboard-customer which enforces
 * `requireAdmin()` server-side.
 *
 * The page itself does NOT enforce admin status — it just doesn't
 * call the protected endpoint until the user clicks Submit. The
 * server is the source of truth. We surface a 404 from the server
 * as "not authorised" in the UI without leaking allowlist details.
 *
 * Why a separate `/admin/*` route tree (not under /dashboard/admin):
 * the existing dashboard admin page is a stats overview. This one
 * is action-oriented and should live close to other write endpoints
 * we add later (/admin/customers, /admin/refunds, etc).
 */

interface FormState {
  tenantId: string;
  firstName: string;
  loomUrl: string;
  kickoffUrl: string;
  slackUrl: string;
  docUrl: string;
  firstDelivery: string;
}

const blank: FormState = {
  tenantId: "",
  firstName: "",
  loomUrl: "",
  kickoffUrl: "",
  slackUrl: "",
  docUrl: "",
  firstDelivery: "",
};

type SubmitState =
  | { kind: "idle" }
  | { kind: "submitting" }
  | { kind: "success"; welcomeUrl: string }
  | { kind: "error"; message: string };

export default function AdminOnboardPage() {
  const { isLoaded, isSignedIn } = useUser();
  const [form, setForm] = useState<FormState>(blank);
  const [state, setState] = useState<SubmitState>({ kind: "idle" });
  const [copied, setCopied] = useState(false);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setState({ kind: "submitting" });

    try {
      const res = await fetch("/api/_admin/onboard-customer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (res.ok) {
        const data = (await res.json()) as { welcomeUrl: string };
        setState({ kind: "success", welcomeUrl: data.welcomeUrl });
        return;
      }

      if (res.status === 401) {
        setState({
          kind: "error",
          message: "Sign in is required.",
        });
        return;
      }
      if (res.status === 404) {
        setState({
          kind: "error",
          message:
            "Not authorised. Your Clerk user id needs to be in ADMIN_USER_IDS.",
        });
        return;
      }
      if (res.status === 422) {
        const data = (await res.json()) as {
          issues?: { path: string[]; message: string }[];
        };
        const first = data.issues?.[0];
        setState({
          kind: "error",
          message: first
            ? `${first.path.join(".")}: ${first.message}`
            : "Validation failed",
        });
        return;
      }
      if (res.status === 503) {
        const data = (await res.json()) as { error: string };
        setState({ kind: "error", message: data.error });
        return;
      }

      setState({
        kind: "error",
        message: `Unexpected response: ${res.status}`,
      });
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }

  async function copyUrl() {
    if (state.kind !== "success") return;
    await navigator.clipboard.writeText(state.welcomeUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  function reset() {
    setForm(blank);
    setState({ kind: "idle" });
    setCopied(false);
  }

  if (!isLoaded) {
    return (
      <main className="min-h-screen bg-[#030303] text-neutral-100 flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
      </main>
    );
  }

  if (!isSignedIn) {
    return (
      <main className="min-h-screen bg-[#030303] text-neutral-100 flex items-center justify-center px-6">
        <div className="max-w-md text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-amber-400" />
          <h1 className="mt-6 text-2xl font-bold">Sign in required</h1>
          <p className="mt-3 text-neutral-400 text-sm">
            This page is operator-only. Sign in with the admin Clerk account.
          </p>
          <Link
            href="/sign-in?redirect_url=/admin/onboard"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400"
          >
            Sign in
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#030303] text-neutral-100">
      <nav className="border-b border-white/5">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <SovereignLogo className="h-7 w-7" />
            <span className="text-sm font-semibold tracking-wider text-neutral-200">
              SOVEREIGN MATRIX
            </span>
          </Link>
          <span className="text-xs text-neutral-500">
            Admin · Onboard customer
          </span>
        </div>
      </nav>

      <div className="mx-auto max-w-2xl px-6 py-16">
        <header>
          <p className="text-xs font-medium uppercase tracking-[0.3em] text-emerald-500/60">
            Admin
          </p>
          <h1 className="mt-3 text-3xl md:text-4xl font-bold tracking-tight">
            Onboard a new customer
          </h1>
          <p className="mt-4 text-neutral-400 leading-relaxed">
            Provisions the personal welcome page at{" "}
            <code className="rounded bg-white/5 px-1.5 py-0.5 text-xs">
              /welcome/[tenantId]
            </code>
            . Send the resulting URL to the customer the moment their setup
            payment lands.
          </p>
        </header>

        <form
          onSubmit={handleSubmit}
          className="mt-12 space-y-6 rounded-2xl border border-white/5 bg-white/[0.02] p-8"
        >
          <Field
            label="Tenant ID (UUID)"
            hint="From the tenants table — created when the customer signed up via Clerk."
          >
            <input
              type="text"
              required
              pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
              placeholder="00000000-0000-0000-0000-000000000000"
              value={form.tenantId}
              onChange={(e) => update("tenantId", e.target.value)}
              className="w-full rounded-lg bg-black/40 border border-white/10 px-4 py-2.5 text-sm font-mono text-neutral-200 outline-none focus:border-emerald-500/60"
            />
          </Field>

          <Field
            label="First name"
            hint="How the customer is greeted. Use the actual first name they go by."
          >
            <input
              type="text"
              required
              maxLength={80}
              placeholder="Sarah"
              value={form.firstName}
              onChange={(e) => update("firstName", e.target.value)}
              className="w-full rounded-lg bg-black/40 border border-white/10 px-4 py-2.5 text-sm text-neutral-200 outline-none focus:border-emerald-500/60"
            />
          </Field>

          <Field
            label="Loom share URL"
            hint="60-second personal welcome video. Record it AFTER you have their first name."
          >
            <input
              type="url"
              required
              placeholder="https://loom.com/share/abc123..."
              value={form.loomUrl}
              onChange={(e) => update("loomUrl", e.target.value)}
              className="w-full rounded-lg bg-black/40 border border-white/10 px-4 py-2.5 text-sm font-mono text-neutral-200 outline-none focus:border-emerald-500/60"
            />
          </Field>

          <Field
            label="Kickoff Calendly URL"
            hint="The 30-min kickoff call event. Use a different event from the public 15-min fit call."
          >
            <input
              type="url"
              required
              placeholder="https://calendly.com/.../kickoff"
              value={form.kickoffUrl}
              onChange={(e) => update("kickoffUrl", e.target.value)}
              className="w-full rounded-lg bg-black/40 border border-white/10 px-4 py-2.5 text-sm font-mono text-neutral-200 outline-none focus:border-emerald-500/60"
            />
          </Field>

          <Field
            label="Slack invite URL"
            hint="Private channel for this customer only. Slack → Channel → Manage → Get a link to invite."
          >
            <input
              type="url"
              required
              placeholder="https://join.slack.com/share/..."
              value={form.slackUrl}
              onChange={(e) => update("slackUrl", e.target.value)}
              className="w-full rounded-lg bg-black/40 border border-white/10 px-4 py-2.5 text-sm font-mono text-neutral-200 outline-none focus:border-emerald-500/60"
            />
          </Field>

          <Field
            label="Kickoff doc URL"
            hint="Notion / Google Doc you've prefilled with ICP / sample profiles / disqualifiers / voice."
          >
            <input
              type="url"
              required
              placeholder="https://notion.so/..."
              value={form.docUrl}
              onChange={(e) => update("docUrl", e.target.value)}
              className="w-full rounded-lg bg-black/40 border border-white/10 px-4 py-2.5 text-sm font-mono text-neutral-200 outline-none focus:border-emerald-500/60"
            />
          </Field>

          <Field
            label="First delivery date"
            hint="The Monday 9am their timezone they get their first 50 leads. Pick the next Monday after kickoff."
          >
            <input
              type="date"
              required
              value={form.firstDelivery}
              onChange={(e) => update("firstDelivery", e.target.value)}
              className="w-full rounded-lg bg-black/40 border border-white/10 px-4 py-2.5 text-sm text-neutral-200 outline-none focus:border-emerald-500/60"
            />
          </Field>

          <div className="pt-2">
            <button
              type="submit"
              disabled={state.kind === "submitting"}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-6 py-3 text-sm font-semibold text-black hover:bg-emerald-400 disabled:opacity-50 transition"
            >
              {state.kind === "submitting" ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Provisioning…
                </>
              ) : (
                <>
                  Provision welcome page
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </form>

        <AnimatePresence>
          {state.kind === "error" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-6 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/[0.06] p-5"
            >
              <AlertCircle className="h-5 w-5 mt-0.5 text-red-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-300">
                  Could not provision
                </p>
                <p className="mt-1 text-sm text-neutral-300">{state.message}</p>
              </div>
            </motion.div>
          )}

          {state.kind === "success" && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.05] p-6"
            >
              <div className="flex items-start gap-3">
                <Check className="h-5 w-5 mt-0.5 text-emerald-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-emerald-300">
                    Welcome page is live
                  </p>
                  <p className="mt-2 text-xs text-neutral-400">
                    Send this URL to the customer in their channel of choice. It
                    does not require sign-in to view.
                  </p>
                  <div className="mt-4 flex items-center gap-2 rounded-lg bg-black/40 border border-white/10 px-3 py-2 font-mono text-xs text-neutral-300 break-all">
                    {state.welcomeUrl}
                  </div>
                  <div className="mt-4 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={copyUrl}
                      className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 px-4 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-500/10 transition"
                    >
                      {copied ? (
                        <>
                          <Check className="h-3 w-3" />
                          Copied
                        </>
                      ) : (
                        <>
                          <Copy className="h-3 w-3" />
                          Copy URL
                        </>
                      )}
                    </button>
                    <a
                      href={state.welcomeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-neutral-400 hover:text-neutral-200"
                    >
                      Open in new tab &rarr;
                    </a>
                    <button
                      type="button"
                      onClick={reset}
                      className="ml-auto text-xs text-neutral-500 hover:text-neutral-300"
                    >
                      Onboard another
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </main>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-neutral-200">
        {label}
      </span>
      {hint && (
        <span className="block mt-1 text-xs text-neutral-500 leading-relaxed">
          {hint}
        </span>
      )}
      <div className="mt-3">{children}</div>
    </label>
  );
}
