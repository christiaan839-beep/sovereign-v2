/**
 * /docs/errors — index of every structured error code.
 *
 * One row per code. Category grouping so clients can scan by concern
 * area (auth / input / rate-limit / upstream / config / internal).
 *
 * Source of truth: src/lib/error-codes.ts · ERROR_CODES.
 */

import Link from "next/link";
import type { Metadata } from "next";
import { ERROR_CODES, type ErrorCode, type ErrorCategory } from "@/lib/error-codes";

export const metadata: Metadata = {
  title: "Error codes — Sovereign Matrix docs",
  description:
    "Every API error code: category, HTTP status, user message, and recovery path. Stable IDs that never change.",
  alternates: { canonical: "https://sovereignmatrix.agency/docs/errors" },
};

const CATEGORY_ORDER: ErrorCategory[] = [
  "auth",
  "input",
  "rate-limit",
  "quota",
  "not-found",
  "conflict",
  "upstream",
  "config",
  "internal",
];

const CATEGORY_LABEL: Record<ErrorCategory, string> = {
  auth: "Authentication",
  input: "Input validation",
  "rate-limit": "Rate limits",
  quota: "Plan quotas",
  "not-found": "Resource not found",
  conflict: "Conflicts",
  upstream: "Upstream + safety",
  config: "Environment / config",
  internal: "Internal",
};

export default function ErrorIndexPage() {
  // Group by category + sort within each.
  const grouped = new Map<ErrorCategory, Array<{ code: ErrorCode; httpStatus: number; userMessage: string }>>();
  for (const [code, def] of Object.entries(ERROR_CODES) as [ErrorCode, typeof ERROR_CODES[ErrorCode]][]) {
    const arr = grouped.get(def.category) ?? [];
    arr.push({ code, httpStatus: def.httpStatus, userMessage: def.userMessage });
    grouped.set(def.category, arr);
  }
  for (const arr of grouped.values()) {
    arr.sort((a, b) => a.code.localeCompare(b.code));
  }

  const total = Object.keys(ERROR_CODES).length;

  return (
    <div className="min-h-screen bg-[#010101] text-white">
      <nav className="px-6 md:px-10 h-16 flex items-center justify-between max-w-5xl mx-auto">
        <Link href="/" className="text-sm font-semibold text-white">
          Sovereign Matrix
        </Link>
        <Link
          href="/developers/docs"
          className="text-[13px] text-neutral-400 hover:text-white transition-colors"
        >
          Developer docs →
        </Link>
      </nav>

      <section className="pt-20 pb-10 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="font-mono text-[10px] text-neutral-600 tracking-[0.22em] uppercase mb-4">
            Error taxonomy · {total} codes
          </p>
          <h1 className="ed-display text-4xl md:text-6xl mb-5">
            Every error has a<br />
            <span className="ed-display-italic text-[#B5532C]">doc page.</span>
          </h1>
          <p className="text-neutral-400 text-base leading-relaxed max-w-2xl">
            Every error the API returns carries a stable <code className="text-[#B5532C] font-mono text-sm">code</code>.
            Click any code below for the trigger scenarios, recovery path, and an example response
            body. Codes never rename — your switch statements are safe.
          </p>
        </div>
      </section>

      {CATEGORY_ORDER.map((cat) => {
        const rows = grouped.get(cat);
        if (!rows || rows.length === 0) return null;
        return (
          <section key={cat} className="py-8 px-6 border-t border-white/[0.04]">
            <div className="max-w-4xl mx-auto">
              <div className="flex items-center gap-4 mb-5">
                <p className="font-mono text-[10px] text-neutral-600 tracking-[0.22em] uppercase">
                  {CATEGORY_LABEL[cat]}
                </p>
                <span className="h-px flex-1 bg-white/[0.04]" />
                <span className="font-mono text-[10px] text-neutral-600">
                  {rows.length} {rows.length === 1 ? "code" : "codes"}
                </span>
              </div>
              <ul className="space-y-1">
                {rows.map((row) => (
                  <li key={row.code}>
                    <Link
                      href={`/docs/errors/${row.code}`}
                      className="group flex items-start gap-4 py-3 px-4 rounded-[4px] hover:bg-white/[0.02] transition-colors"
                    >
                      <span className="font-mono text-xs px-2 py-1 rounded-[3px] bg-rose-500/5 text-rose-400 shrink-0 mt-0.5">
                        {row.httpStatus}
                      </span>
                      <span className="font-mono text-sm text-white min-w-[220px] shrink-0 group-hover:text-[#B5532C] transition-colors">
                        {row.code}
                      </span>
                      <span className="text-sm text-neutral-500 leading-snug">
                        {row.userMessage}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        );
      })}
    </div>
  );
}
