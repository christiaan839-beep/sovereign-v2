/**
 * /developers/api-explorer — interactive OpenAPI explorer.
 *
 * Renders the spec at /api/openapi as a browsable, collapsible tree
 * grouped by tag. Developers can copy the cURL one-liner for any
 * endpoint without leaving the page.
 *
 * DESIGN INTENT
 * ─────────────
 * Not a full Swagger UI (which is 500KB of JS). A minimal, on-brand
 * reader that loads the spec + renders grouped endpoints + shows a
 * cURL template. Enough to unblock a developer who's evaluating.
 *
 * For power use (SDK gen, contract validation) the raw JSON is at
 * /api/openapi.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { ApiExplorerClient } from "./ApiExplorerClient";

export const metadata: Metadata = {
  title: "API Explorer — Sovereign Matrix",
  description:
    "Browse the Sovereign Matrix API. 223 agents + platform endpoints. Copy cURL for any endpoint. Feeds openapi-generator, Stainless, Speakeasy.",
  alternates: {
    canonical: "https://sovereignmatrix.agency/developers/api-explorer",
  },
};

export default function ApiExplorerPage() {
  return (
    <div className="min-h-screen bg-[#010101] text-white">
      <nav className="px-6 md:px-10 h-16 flex items-center justify-between max-w-6xl mx-auto">
        <Link href="/" className="text-sm font-semibold text-white">
          Sovereign Matrix
        </Link>
        <div className="flex items-center gap-5 text-[13px]">
          <Link
            href="/api/openapi"
            prefetch={false}
            className="text-neutral-400 hover:text-white transition-colors"
          >
            Raw OpenAPI JSON ↗
          </Link>
          <Link
            href="/docs/errors"
            className="text-neutral-400 hover:text-white transition-colors"
          >
            Error codes
          </Link>
        </div>
      </nav>

      <section className="pt-20 pb-10 px-6">
        <div className="max-w-4xl mx-auto">
          <p className="font-mono text-[10px] text-neutral-600 tracking-[0.22em] uppercase mb-4">
            Developer docs · OpenAPI 3.1
          </p>
          <h1 className="ed-display text-4xl md:text-6xl mb-5">
            Every endpoint.<br />
            <span className="ed-display-italic text-[#B5532C]">One spec.</span>
          </h1>
          <p className="text-neutral-400 text-base leading-relaxed max-w-2xl">
            Auto-generated from our static agent registry and zod input schemas.
            Feeds every SDK generator: openapi-generator, Stainless, Speakeasy,
            OpenAPI TS. Fetch the raw JSON directly at{" "}
            <Link
              href="/api/openapi"
              prefetch={false}
              className="underline decoration-[#B5532C]/50 hover:decoration-[#B5532C]"
            >
              /api/openapi
            </Link>
            .
          </p>
        </div>
      </section>

      <ApiExplorerClient />

      <section className="py-12 px-6 border-t border-white/[0.04]">
        <div className="max-w-4xl mx-auto">
          <p className="font-mono text-[10px] text-neutral-600 tracking-[0.22em] uppercase mb-5">
            Generate an SDK
          </p>
          <div className="space-y-4 text-sm text-neutral-400">
            <pre className="font-mono text-[11.5px] bg-[#060606] border border-white/[0.06] rounded-lg p-4 overflow-x-auto">
              {`# TypeScript (with openapi-typescript)
npx openapi-typescript https://sovereignmatrix.agency/api/openapi -o ./types.ts

# Python (with openapi-python-client)
openapi-python-client generate --url https://sovereignmatrix.agency/api/openapi

# Go (with oapi-codegen)
oapi-codegen -package sovereign -generate types,client \\
  https://sovereignmatrix.agency/api/openapi > sovereign.go`}
            </pre>
          </div>
        </div>
      </section>
    </div>
  );
}
