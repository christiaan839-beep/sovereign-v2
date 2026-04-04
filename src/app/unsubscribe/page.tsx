"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

function UnsubscribeForm() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") || "";
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function handleUnsubscribe() {
    if (!email) {
      setStatus("error");
      setMessage("No email address provided.");
      return;
    }

    setStatus("loading");
    try {
      const res = await fetch("/api/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatus("success");
        setMessage(data.message || "You have been unsubscribed successfully.");
      } else {
        setStatus("error");
        setMessage(data.error || "Something went wrong. Please try again.");
      }
    } catch {
      setStatus("error");
      setMessage("Network error. Please try again later.");
    }
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
      <div className="max-w-md w-full mx-auto px-6 py-16">
        <Link
          href="/"
          className="text-xs text-neutral-500 hover:text-white transition-colors uppercase tracking-widest mb-8 block"
        >
          &larr; Back to Home
        </Link>

        <h1 className="text-2xl md:text-3xl font-bold text-white serif-text mb-4">
          Unsubscribe
        </h1>

        {status === "success" ? (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-6">
            <p className="text-emerald-400 text-sm">{message}</p>
            <p className="text-neutral-400 text-xs mt-3">
              You will no longer receive marketing emails from Sovereign Matrix.
              Transactional emails (billing, security) will still be sent.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <p className="text-sm text-neutral-400 leading-relaxed">
              You are requesting to unsubscribe from Sovereign Matrix marketing
              emails.
            </p>

            {email ? (
              <div className="rounded-xl border border-white/10 bg-white/5 backdrop-blur-xl p-4">
                <p className="text-xs text-neutral-400 uppercase tracking-widest mb-1">
                  Email Address
                </p>
                <p className="text-white text-sm font-mono">{email}</p>
              </div>
            ) : (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
                <p className="text-red-400 text-sm">
                  No email address found in the URL. Please use the unsubscribe
                  link from your email.
                </p>
              </div>
            )}

            {status === "error" && (
              <p className="text-red-400 text-sm">{message}</p>
            )}

            <button
              onClick={handleUnsubscribe}
              disabled={!email || status === "loading"}
              className="w-full px-6 py-3 text-sm uppercase tracking-widest text-white bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {status === "loading" ? "Processing..." : "Confirm Unsubscribe"}
            </button>

            <p className="text-xs text-neutral-600 leading-relaxed">
              This will remove you from marketing communications only.
              Transactional emails related to your account, billing, and
              security notifications will continue.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function UnsubscribePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center">
          <p className="text-neutral-400 text-sm">Loading...</p>
        </div>
      }
    >
      <UnsubscribeForm />
    </Suspense>
  );
}
