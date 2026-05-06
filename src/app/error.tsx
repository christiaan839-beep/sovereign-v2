"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Best-effort Sentry capture so client-side errors that hit this
    // boundary surface in the same dashboard as server errors. Lazy
    // import keeps the cold-start fast — this code path is rare and
    // doesn't justify pulling Sentry into the homepage bundle.
    void (async () => {
      try {
        const { captureException } = await import("@/lib/sentry");
        captureException(error, {
          module: "global-error-boundary",
          extra: { digest: error.digest ?? "none" },
        });
      } catch {
        // If Sentry isn't wired we still want to fail the loud way
        // in dev. The console.error preserves the legacy signal.
      }
      console.error("[Sovereign Matrix] Page error:", error);
    })();
  }, [error]);

  // Classify the error for better UX
  const message = error.message?.toLowerCase() || "";
  const isNetwork =
    message.includes("fetch") ||
    message.includes("network") ||
    message.includes("timeout");
  const isAuth =
    message.includes("auth") ||
    message.includes("unauthorized") ||
    message.includes("sign in");
  const isUsage =
    message.includes("usage") ||
    message.includes("limit") ||
    message.includes("429");

  const title = isNetwork
    ? "Connection issue"
    : isAuth
      ? "Session expired"
      : isUsage
        ? "Usage limit reached"
        : "Unexpected error";

  const description = isNetwork
    ? "Could not reach the server. Check your internet connection and try again."
    : isAuth
      ? "Your session has expired. Please sign in again to continue."
      : isUsage
        ? "You have reached your plan limit for this month. Upgrade to keep going."
        : "An unexpected error occurred. This has been logged automatically.";

  return (
    <div className="min-h-screen bg-[#020202] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div
          className={`w-12 h-12 rounded-xl flex items-center justify-center mx-auto mb-6 ${
            isNetwork
              ? "bg-amber-500/10 border border-amber-500/20"
              : isAuth
                ? "bg-blue-500/10 border border-blue-500/20"
                : isUsage
                  ? "bg-violet-500/10 border border-violet-500/20"
                  : "bg-red-500/10 border border-red-500/20"
          }`}
        >
          <span
            className={`text-lg font-bold ${
              isNetwork
                ? "text-amber-400"
                : isAuth
                  ? "text-blue-400"
                  : isUsage
                    ? "text-violet-400"
                    : "text-red-400"
            }`}
          >
            !
          </span>
        </div>
        <h2 className="text-xl font-bold text-white mb-3">{title}</h2>
        <p className="text-sm text-neutral-400 mb-8 leading-relaxed">
          {description}
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-2.5 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-200 transition-colors"
          >
            Try Again
          </button>

          {isAuth ? (
            <Link
              href="/login"
              className="px-6 py-2.5 border border-white/10 text-neutral-400 font-semibold rounded-full text-sm hover:text-white hover:border-white/20 transition-colors"
            >
              Sign In
            </Link>
          ) : isUsage ? (
            <Link
              href="/pricing"
              className="px-6 py-2.5 border border-white/10 text-neutral-400 font-semibold rounded-full text-sm hover:text-white hover:border-white/20 transition-colors"
            >
              Upgrade Plan
            </Link>
          ) : (
            <Link
              href="/dashboard"
              className="px-6 py-2.5 border border-white/10 text-neutral-400 font-semibold rounded-full text-sm hover:text-white hover:border-white/20 transition-colors"
            >
              Go to Dashboard
            </Link>
          )}
        </div>

        {error.digest && (
          <p className="text-[10px] text-neutral-500 mt-8 font-mono">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
