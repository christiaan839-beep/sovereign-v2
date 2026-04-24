"use client";

import { AlertTriangle, RotateCcw, Home } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

/**
 * ScopedError — shared error UI for dashboard sub-route error.tsx files.
 *
 * Next.js calls error.tsx with { error, reset } when a descendant throws
 * during render, in a Server Action, or from an effect. Compared to the
 * top-level /dashboard/error.tsx, a sub-route boundary lets the rest of
 * the shell (sidebar, header) keep rendering while we recover the affected
 * panel. Pass `area` so the error message includes the scope.
 *
 * Usage in any /dashboard/<route>/error.tsx:
 *   "use client";
 *   import { ScopedError } from "@/components/dashboard/ScopedError";
 *   export default ScopedError("Billing History");
 */
export function ScopedError(area: string) {
  const Component = ({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) => {
    // Forward to Sentry (if configured) and log locally. Dynamic import
    // keeps the browser Sentry client out of initial bundles.
    useEffect(() => {
       
      console.error(`[dashboard:${area}]`, error);
      if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_SENTRY_DSN) {
        import("@sentry/nextjs").then((Sentry) => {
          Sentry.captureException(error, {
            tags: { area, surface: "dashboard" },
            extra: { digest: error.digest },
          });
        }).catch(() => { /* Sentry optional */ });
      }
    }, [error]);

    return (
      <div className="flex items-center justify-center min-h-[50vh] px-6">
        <div className="max-w-md text-center">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-5">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <p className="text-[10px] font-mono uppercase tracking-[0.18em] text-amber-400/80 mb-3">
            {area}
          </p>
          <h2 className="text-base font-semibold text-white mb-2">Couldn&apos;t load this panel.</h2>
          <p className="text-sm text-neutral-500 mb-6 leading-relaxed">
            {error.message || "An unexpected error occurred."}
            {error.digest && (
              <span className="block mt-2 font-mono text-[10px] text-neutral-600">
                trace: {error.digest}
              </span>
            )}
          </p>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={reset}
              className="flex items-center gap-1.5 px-4 py-2 bg-white/[0.06] border border-white/[0.1] text-white font-medium rounded-full text-xs hover:bg-white/[0.1] transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              Retry
            </button>
            <Link
              href="/dashboard"
              className="flex items-center gap-1.5 px-4 py-2 border border-white/[0.06] text-neutral-400 rounded-full text-xs hover:border-white/[0.12] hover:text-white transition-colors"
            >
              <Home className="w-3 h-3" />
              Home
            </Link>
          </div>
        </div>
      </div>
    );
  };
  Component.displayName = `ScopedError(${area})`;
  return Component;
}
