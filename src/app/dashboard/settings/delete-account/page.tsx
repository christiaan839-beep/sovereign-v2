"use client";

/**
 * /dashboard/settings/delete-account — GDPR right-to-erasure UI.
 *
 * Three deliberate friction points so accidental clicks don't delete
 * an account:
 *   1. Clear warning list showing exactly what will happen.
 *   2. "Download my data first" prompt linking to the export flow.
 *   3. Confirmation input — user must type the exact phrase
 *      "DELETE MY ACCOUNT" (case-sensitive) before the button enables.
 *
 * On success: the server nuked the Clerk session. We redirect to the
 * home page rather than the dashboard (which would 401 and feel broken).
 */

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Download, Loader2 } from "lucide-react";

const CONFIRMATION_PHRASE = "DELETE MY ACCOUNT";

type State = "idle" | "confirming" | "working" | "done" | "error";

export default function DeleteAccountPage() {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [state, setState] = useState<State>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const canSubmit = confirmation === CONFIRMATION_PHRASE;

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit || state === "working") return;
    setState("working");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/account", {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? `Deletion failed (${res.status})`);
      }
      setState("done");
      // Small pause so the user registers the done state, then bounce home.
      setTimeout(() => router.replace("/"), 1800);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  }

  if (state === "done") {
    return (
      <div className="min-h-[calc(100vh-60px)] bg-[#030303] text-white">
        <div className="max-w-xl mx-auto px-6 py-24 text-center">
          <h1 className="font-serif text-3xl mb-3 tracking-tight">
            Account deleted.
          </h1>
          <p className="text-[14px] text-neutral-400 leading-relaxed">
            Your data has been erased. Redirecting you home.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-60px)] bg-[#030303] text-white">
      <div className="max-w-xl mx-auto px-6 py-12">
        <p className="font-mono text-[10px] text-neutral-600 tracking-[0.22em] uppercase mb-3">
          Settings · Delete account
        </p>
        <h1 className="font-serif text-3xl md:text-4xl leading-tight tracking-[-0.02em] mb-3">
          Erase this account permanently.
        </h1>
        <p className="text-[14px] text-neutral-400 leading-relaxed mb-8 max-w-lg">
          This action is irreversible. Every trace of your account is
          removed from Sovereign Matrix per GDPR Article 17
          (right to erasure).
        </p>

        {/* Warning card */}
        <div className="mb-8 p-5 rounded-[6px] border border-red-500/30 bg-red-500/[0.05]">
          <div className="flex items-start gap-3 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <h2 className="text-[14px] font-semibold text-white">
              The following will happen immediately:
            </h2>
          </div>
          <ul className="space-y-2 text-[13px] text-neutral-300 leading-snug ml-7 list-disc marker:text-red-400/60">
            <li>Your active Stripe subscription is cancelled — no refund for the current cycle.</li>
            <li>Pending credit holds are released — your final balance is zero.</li>
            <li>Playbook runs, agent activity, credits history, reviews, and memory are all deleted.</li>
            <li>Any agents you published are kept (the ecosystem still references them) but your creator attribution is removed and they become private.</li>
            <li>Your Clerk identity is deleted — you cannot sign back in with this email.</li>
          </ul>
        </div>

        {/* Export first */}
        <div className="mb-8 p-4 rounded-[4px] border border-white/[0.08] bg-white/[0.02]">
          <p className="flex items-center gap-2 text-[12px] font-mono text-neutral-400 mb-2">
            <Download className="w-3.5 h-3.5" />
            Not sure? Export your data first.
          </p>
          <Link
            href="/dashboard/settings/export"
            className="inline-flex items-center gap-1 text-[13px] text-[#B5532C] hover:text-white transition-colors"
          >
            Download my data
            <ArrowRight className="w-3 h-3" />
          </Link>
        </div>

        {/* Confirmation form */}
        <form onSubmit={handleDelete} className="space-y-4">
          <label className="block">
            <span className="block text-[12px] font-mono text-neutral-400 tracking-wide mb-2 uppercase">
              Type the phrase below to confirm
            </span>
            <span className="block font-mono text-[15px] text-white mb-2">
              {CONFIRMATION_PHRASE}
            </span>
            <input
              type="text"
              value={confirmation}
              onChange={(e) => setConfirmation(e.target.value)}
              placeholder={CONFIRMATION_PHRASE}
              className="w-full bg-white/[0.03] border border-white/[0.08] focus:border-red-500/50 rounded-[4px] px-3 py-2 text-[13px] text-white placeholder:text-neutral-700 outline-none transition-colors"
              autoComplete="off"
              spellCheck={false}
              autoCapitalize="off"
              disabled={state === "working"}
            />
          </label>

          {errorMessage && (
            <p className="text-[12px] font-mono text-red-400">{errorMessage}</p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={!canSubmit || state === "working"}
              className="inline-flex items-center gap-2 px-4 py-2 bg-red-500 text-white font-medium text-[13px] tracking-tight rounded-[3px] hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {state === "working" && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {state === "working" ? "Deleting..." : "Delete my account"}
            </button>
            <Link
              href="/dashboard/settings"
              className="text-[12px] font-mono text-neutral-500 hover:text-white transition-colors"
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
