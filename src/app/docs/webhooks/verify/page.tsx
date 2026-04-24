/**
 * /docs/webhooks/verify — copy-paste HMAC verification samples.
 *
 * We ship webhook subscriptions with an HMAC-SHA256 secret returned
 * ONCE at creation time. Customers need to verify every payload's
 * signature before trusting it.
 *
 * This page is the single source of truth for "how do I verify".
 * Ships runnable code in Node, Python, and Go. Stripe/Twilio both do
 * this — no platform that doesn't is "elite".
 *
 * SIGNING CONVENTION
 * ──────────────────
 * Signature header: X-Sovereign-Signature: t=<ts>,v1=<hex>
 * Computed as:      HMAC-SHA256(secret, "<ts>.<raw body>")
 *
 * Timestamp is Unix seconds. Window for accept: ±300s.
 *
 * TIMING-SAFE COMPARE
 * ───────────────────
 * Every sample uses timing-safe comparison. Naive `==` opens a timing
 * attack. The samples deliberately show the right way.
 */

import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Verify webhook signatures — Sovereign Matrix docs",
  description:
    "Node, Python, and Go code for verifying Sovereign Matrix webhook HMAC signatures. Timing-safe, replay-resistant, copy-paste ready.",
  alternates: {
    canonical: "https://sovereignmatrix.agency/docs/webhooks/verify",
  },
};

const NODE_SAMPLE = `// Node.js (Express or any handler with raw body access)
import crypto from "node:crypto";

const SIGNING_SECRET = process.env.SOVEREIGN_WEBHOOK_SECRET!;
const MAX_AGE_SECONDS = 300; // reject replays older than 5 min

function verifySovereignSignature(
  rawBody: string,
  signatureHeader: string,
): { valid: boolean; reason?: string } {
  // Header format: t=1724880000,v1=9c5...
  const parts = Object.fromEntries(
    signatureHeader.split(",").map((p) => p.split("=") as [string, string]),
  );
  const ts = Number(parts.t);
  const signature = parts.v1;
  if (!ts || !signature) return { valid: false, reason: "malformed_header" };

  // Reject stale signatures (replay protection).
  const age = Math.abs(Math.floor(Date.now() / 1000) - ts);
  if (age > MAX_AGE_SECONDS) return { valid: false, reason: "stale" };

  const signedPayload = \`\${ts}.\${rawBody}\`;
  const expected = crypto
    .createHmac("sha256", SIGNING_SECRET)
    .update(signedPayload, "utf8")
    .digest("hex");

  // Timing-safe compare. NEVER use === — that's a timing-attack vector.
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return { valid: false, reason: "signature_mismatch" };
  return crypto.timingSafeEqual(a, b)
    ? { valid: true }
    : { valid: false, reason: "signature_mismatch" };
}

// Express usage — requires express.raw() body parser so the request
// body is a Buffer, not already-parsed JSON. Parsing before verifying
// changes the bytes being hashed and will fail even for legit payloads.
app.post(
  "/webhooks/sovereign",
  express.raw({ type: "application/json" }),
  (req, res) => {
    const sig = req.header("X-Sovereign-Signature") ?? "";
    const { valid, reason } = verifySovereignSignature(
      req.body.toString("utf8"),
      sig,
    );
    if (!valid) return res.status(400).json({ error: reason });

    const event = JSON.parse(req.body.toString("utf8"));
    // …handle event…
    res.status(200).json({ received: true });
  },
);`;

const PYTHON_SAMPLE = `# Python (Flask / FastAPI pattern)
import hmac
import hashlib
import os
import time
from typing import Tuple

SIGNING_SECRET = os.environ["SOVEREIGN_WEBHOOK_SECRET"].encode("utf-8")
MAX_AGE_SECONDS = 300  # reject replays older than 5 min


def verify_sovereign_signature(raw_body: bytes, signature_header: str) -> Tuple[bool, str]:
    """Verify a Sovereign Matrix webhook signature. Timing-safe."""
    # Header format: t=1724880000,v1=9c5...
    parts = dict(p.split("=", 1) for p in signature_header.split(","))
    try:
        ts = int(parts["t"])
    except (KeyError, ValueError):
        return False, "malformed_header"
    signature = parts.get("v1", "")
    if not signature:
        return False, "malformed_header"

    # Replay protection.
    age = abs(int(time.time()) - ts)
    if age > MAX_AGE_SECONDS:
        return False, "stale"

    signed_payload = f"{ts}.".encode("utf-8") + raw_body
    expected = hmac.new(SIGNING_SECRET, signed_payload, hashlib.sha256).hexdigest()

    # Timing-safe compare. NEVER use == — that's a timing-attack vector.
    return hmac.compare_digest(expected, signature), "ok"


# Flask usage — use request.get_data() (NOT request.json) so we hash
# the raw bytes as received on the wire. Parsing before hashing
# changes whitespace/ordering and breaks verification even for legit payloads.
@app.post("/webhooks/sovereign")
def sovereign_webhook():
    sig = request.headers.get("X-Sovereign-Signature", "")
    raw = request.get_data()  # bytes, NOT parsed JSON
    ok, reason = verify_sovereign_signature(raw, sig)
    if not ok:
        return {"error": reason}, 400
    event = json.loads(raw)
    # …handle event…
    return {"received": True}, 200`;

const GO_SAMPLE = `// Go
package main

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
)

const maxAgeSeconds = 300 // reject replays older than 5 min

func verifySovereignSignature(rawBody []byte, signatureHeader string, secret []byte) error {
	// Header format: t=1724880000,v1=9c5...
	var ts int64
	var sig string
	for _, part := range strings.Split(signatureHeader, ",") {
		kv := strings.SplitN(part, "=", 2)
		if len(kv) != 2 {
			continue
		}
		switch kv[0] {
		case "t":
			n, err := strconv.ParseInt(kv[1], 10, 64)
			if err != nil {
				return errors.New("malformed_header")
			}
			ts = n
		case "v1":
			sig = kv[1]
		}
	}
	if ts == 0 || sig == "" {
		return errors.New("malformed_header")
	}

	// Replay protection.
	if age := time.Now().Unix() - ts; age > maxAgeSeconds || age < -maxAgeSeconds {
		return errors.New("stale")
	}

	mac := hmac.New(sha256.New, secret)
	mac.Write([]byte(strconv.FormatInt(ts, 10)))
	mac.Write([]byte{'.'})
	mac.Write(rawBody)
	expected := hex.EncodeToString(mac.Sum(nil))

	// Timing-safe compare. NEVER use == on strings — that's a timing-attack vector.
	if !hmac.Equal([]byte(expected), []byte(sig)) {
		return errors.New("signature_mismatch")
	}
	return nil
}

func webhookHandler(w http.ResponseWriter, r *http.Request) {
	secret := []byte(os.Getenv("SOVEREIGN_WEBHOOK_SECRET"))

	// Read raw bytes BEFORE any JSON parsing — parsing mutates the bytes being hashed.
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "read_error", 400)
		return
	}
	defer r.Body.Close()

	sig := r.Header.Get("X-Sovereign-Signature")
	if err := verifySovereignSignature(raw, sig, secret); err != nil {
		http.Error(w, err.Error(), 400)
		return
	}

	// …handle event…
	w.WriteHeader(http.StatusOK)
	w.Write([]byte(\`{"received":true}\`))
}`;

interface CodeTabProps {
  language: string;
  label: string;
  code: string;
}

function CodeTab({ language, label, code }: CodeTabProps) {
  return (
    <div className="mb-10">
      <div className="flex items-center gap-2 mb-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-neutral-500">
          {label}
        </span>
        <span className="h-px flex-1 bg-white/[0.04]" />
      </div>
      <pre className="font-mono text-[11.5px] leading-relaxed text-neutral-300 bg-[#060606] border border-white/[0.06] rounded-lg p-5 overflow-x-auto">
        {code}
      </pre>
      <p className="mt-2 text-[10px] font-mono text-neutral-600">{language}</p>
    </div>
  );
}

export default function VerifyWebhookDocsPage() {
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
            Webhooks · Signature verification
          </p>
          <h1 className="ed-display text-4xl md:text-6xl mb-5">
            Verify every payload.<br />
            <span className="ed-display-italic text-[#B5532C]">No exceptions.</span>
          </h1>
          <p className="text-neutral-400 text-base leading-relaxed max-w-2xl">
            Every Sovereign Matrix webhook ships an HMAC-SHA256 signature you
            can verify with the secret you received at subscription-create time.
            Three runnable samples below — Node, Python, Go — each{" "}
            <span className="text-white">timing-safe</span>,{" "}
            <span className="text-white">replay-resistant</span>, and ready to copy.
          </p>
        </div>
      </section>

      <section className="py-8 px-6 border-t border-white/[0.04]">
        <div className="max-w-4xl mx-auto">
          <p className="font-mono text-[10px] text-neutral-600 tracking-[0.22em] uppercase mb-5">
            Signing convention
          </p>
          <dl className="space-y-4 text-sm text-neutral-400 leading-relaxed">
            <div>
              <dt className="text-neutral-200 font-semibold mb-1">Header</dt>
              <dd className="font-mono text-xs text-[#B5532C]">X-Sovereign-Signature: t=&lt;unix-seconds&gt;,v1=&lt;hex&gt;</dd>
            </div>
            <div>
              <dt className="text-neutral-200 font-semibold mb-1">Computation</dt>
              <dd className="font-mono text-xs">
                HMAC-SHA256(secret, <span className="text-[#B5532C]">{`"${"${"}ts${"}"}.${"${"}raw body${"}"}"`}</span>)
              </dd>
            </div>
            <div>
              <dt className="text-neutral-200 font-semibold mb-1">Accept window</dt>
              <dd>
                ±300 seconds around the timestamp. Reject older payloads —
                that&apos;s your replay protection.
              </dd>
            </div>
            <div>
              <dt className="text-neutral-200 font-semibold mb-1">Comparison</dt>
              <dd>
                Use a timing-safe compare (<span className="font-mono text-[#B5532C]">crypto.timingSafeEqual</span> /{" "}
                <span className="font-mono text-[#B5532C]">hmac.compare_digest</span> /{" "}
                <span className="font-mono text-[#B5532C]">hmac.Equal</span>). String{" "}
                <span className="font-mono text-[#B5532C]">==</span> opens a timing attack.
              </dd>
            </div>
          </dl>
        </div>
      </section>

      <section className="py-8 px-6 border-t border-white/[0.04]">
        <div className="max-w-4xl mx-auto">
          <p className="font-mono text-[10px] text-neutral-600 tracking-[0.22em] uppercase mb-5">
            Code samples
          </p>
          <CodeTab language="Node 18+" label="Node.js" code={NODE_SAMPLE} />
          <CodeTab language="Python 3.10+" label="Python" code={PYTHON_SAMPLE} />
          <CodeTab language="Go 1.21+" label="Go" code={GO_SAMPLE} />
        </div>
      </section>

      <section className="py-8 px-6 border-t border-white/[0.04]">
        <div className="max-w-4xl mx-auto">
          <p className="font-mono text-[10px] text-neutral-600 tracking-[0.22em] uppercase mb-5">
            Common pitfalls
          </p>
          <ul className="space-y-3 text-sm text-neutral-300">
            <li className="flex gap-3">
              <span className="text-[#B5532C] shrink-0">·</span>
              <span>
                <span className="text-white font-semibold">Parsing before verifying.</span>{" "}
                If you <span className="font-mono text-[#B5532C]">JSON.parse(body)</span> then
                hash the stringified result, the whitespace/key order may differ from what we signed
                and verification fails. Hash the <span className="text-white">raw wire bytes</span>.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#B5532C] shrink-0">·</span>
              <span>
                <span className="text-white font-semibold">String ==.</span> Opens a timing-attack
                channel. Use the timing-safe helper your language ships.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#B5532C] shrink-0">·</span>
              <span>
                <span className="text-white font-semibold">Ignoring the timestamp.</span> Without a
                max-age check, an attacker can capture one valid payload + signature and replay
                forever.
              </span>
            </li>
            <li className="flex gap-3">
              <span className="text-[#B5532C] shrink-0">·</span>
              <span>
                <span className="text-white font-semibold">Logging the secret.</span> Store it in
                environment variables, never in source control. We return it exactly once — if lost,
                rotate via{" "}
                <Link
                  href="/dashboard/webhooks"
                  className="underline hover:text-white"
                >
                  /dashboard/webhooks
                </Link>
                .
              </span>
            </li>
          </ul>
        </div>
      </section>

      <section className="py-12 px-6 border-t border-white/[0.04]">
        <div className="max-w-4xl mx-auto flex flex-wrap gap-3">
          <Link
            href="/dashboard/webhooks"
            className="inline-flex items-center gap-2 px-5 py-3 bg-[#B5532C] text-white font-semibold rounded-[4px] text-sm hover:bg-[#C96234] transition-colors"
          >
            Create a webhook subscription →
          </Link>
          <Link
            href="/docs/errors"
            className="inline-flex items-center gap-2 px-5 py-3 border border-white/10 text-white font-semibold rounded-[4px] text-sm hover:bg-white/5 transition-colors"
          >
            Error codes reference
          </Link>
        </div>
      </section>
    </div>
  );
}
