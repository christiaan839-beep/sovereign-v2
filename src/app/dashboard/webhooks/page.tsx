/**
 * /dashboard/webhooks — customer webhook subscription management.
 *
 * Sign-in required. Shows the caller's active subscriptions + a form
 * to register a new one. When a subscription is created, the server
 * returns the HMAC secret ONCE — rendered in a copy-on-hover box with
 * explicit "store this now" messaging.
 */

import type { Metadata } from "next";
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { WebhooksClient } from "./WebhooksClient";

export const metadata: Metadata = {
  title: "Webhooks — Sovereign Dashboard",
  description:
    "Register webhook subscriptions that trigger marketplace agents on external events. HMAC-signed both ways.",
  robots: { index: false, follow: false },
};

export default async function Page() {
  const { userId } = await auth();
  if (!userId) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "var(--ed-bg)" }}
      >
        <div className="text-center">
          <p className="ed-body mb-4" style={{ color: "var(--ed-ink)" }}>
            Sign in to manage webhook subscriptions.
          </p>
          <Link
            href="/sign-in?redirect_url=/dashboard/webhooks"
            className="ed-mono text-sm"
            style={{ color: "var(--ed-copper)" }}
          >
            Sign in →
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: "var(--ed-bg)" }}>
      <div className="max-w-5xl mx-auto px-6 pt-14 pb-24">
        <nav className="ed-caption mb-10">
          <Link
            href="/dashboard"
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            ← Dashboard
          </Link>
        </nav>

        <header className="mb-10">
          <p className="ed-label mb-2" style={{ color: "var(--ed-copper)" }}>
            Webhooks
          </p>
          <h1
            className="ed-display text-5xl mb-4"
            style={{ color: "var(--ed-ink)" }}
          >
            Reactive agents.
          </h1>
          <p
            className="ed-body max-w-2xl"
            style={{ color: "var(--ed-ink-soft)" }}
          >
            Register a webhook subscription to trigger a marketplace agent on
            external events. POST to{" "}
            <code className="ed-mono">
              /api/agents/trigger/&lt;slug&gt;
            </code>{" "}
            with an HMAC-SHA256 signature; the platform runs the agent and
            delivers the result to your callback URL (also HMAC-signed).
          </p>
        </header>

        <WebhooksClient />

        {/* How-to */}
        <section
          className="mt-14 pt-8"
          style={{ borderTop: "1px solid var(--ed-rule)" }}
        >
          <h2 className="ed-label mb-5">How to sign a trigger request</h2>
          <pre
            className="p-5 ed-mono text-[12px] overflow-auto"
            style={{
              border: "1px solid var(--ed-rule)",
              background: "var(--ed-bg-raised)",
              color: "var(--ed-ink-soft)",
              borderRadius: "2px",
            }}
          >{`# 1. Compute timestamp + body
TIMESTAMP=$(date +%s)
BODY='{"input":"extract invoice fields"}'

# 2. HMAC-SHA256 over \${timestamp}.\${body} with your secret
SIG=$(printf '%s.%s' "$TIMESTAMP" "$BODY" | \\
  openssl dgst -sha256 -hmac "<your-secret>" | \\
  awk '{print $2}')

# 3. POST with the three headers
curl -X POST https://sovereignmatrix.agency/api/agents/trigger/invoice-ocr \\
  -H "X-Sovereign-Subscription-Id: <your-sub-id>" \\
  -H "X-Sovereign-Signature: sha256=\${SIG}" \\
  -H "X-Sovereign-Timestamp: \${TIMESTAMP}" \\
  -H "Content-Type: application/json" \\
  -d "$BODY"`}
          </pre>

          <p
            className="ed-caption mt-4"
            style={{ color: "var(--ed-ink-soft)" }}
          >
            The platform rejects requests with timestamps older than 5 minutes
            (replay protection). Signature comparison is constant-time (no
            side-channel leaks).
          </p>
        </section>

        <footer
          className="mt-10 pt-6 ed-caption flex items-baseline gap-6 flex-wrap"
          style={{ borderTop: "1px solid var(--ed-rule)" }}
        >
          <Link
            href="/marketplace"
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            Browse agents →
          </Link>
          <Link
            href="/platform/verify"
            className="transition-colors hover:text-[var(--ed-copper)]"
          >
            Verify a delivery signature →
          </Link>
        </footer>
      </div>
    </div>
  );
}
