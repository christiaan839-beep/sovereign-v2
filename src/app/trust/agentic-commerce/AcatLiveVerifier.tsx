"use client";

import { useState } from "react";

/**
 * Live ACAT verifier — paste an ACAT (base64url or JSON), expected
 * user public key, and cart context. Hits POST /api/health/acat-verify
 * which runs the SAME pure verifier shipped in @sovereign/inspector.
 *
 * Editorial museum aesthetic to match the parent /trust/agentic-commerce
 * page. Form fields are bordered cream insets; results render as a
 * verdict block with the 12-reason granularity exposed.
 */

interface VerifySuccess {
  valid: true;
  remainingMaxCents: number;
  reputation: { letterGrade: string; numericScore: number; snapshotAt: string } | null;
  summary: string;
  verifierNote: string;
}
interface VerifyFailure {
  valid: false;
  reason: string;
  summary: string;
  oneOfTwelveReasons: string[];
  verifierNote: string;
}
interface VerifyError {
  error: string;
  details?: string;
}
type VerifyResult = VerifySuccess | VerifyFailure | VerifyError;

const SAMPLE_HINT = `Sample ACAT (single-use, valid window 2026-04-01 → 2026-05-01,
  max $500 USD, marketplace_b2c).
Provide an ACAT minted by your deployment OR sign one locally
with src/lib/agentic-commerce/acat.ts mintACAT().`;

const CATEGORIES = [
  "marketplace_b2c",
  "marketplace_b2b",
  "saas_software",
  "subscription_services",
  "groceries",
  "restaurants",
  "fuel",
  "travel",
  "entertainment",
  "professional_services",
  "cloud_infrastructure",
  "ai_apis",
  "education",
  "healthcare",
  "charity",
  "other",
] as const;

export function AcatLiveVerifier() {
  const [acat, setAcat] = useState("");
  const [pubkey, setPubkey] = useState("");
  const [amount, setAmount] = useState("7342");
  const [currency, setCurrency] = useState("USD");
  const [merchant, setMerchant] = useState("acme-shop");
  const [category, setCategory] = useState<string>("marketplace_b2c");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<VerifyResult | null>(null);

  async function handleVerify(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setResult(null);
    try {
      // Auto-detect base64url vs JSON in the textarea.
      const trimmed = acat.trim();
      const acatField = trimmed.startsWith("{") ? JSON.parse(trimmed) : trimmed;
      const res = await fetch("/api/health/acat-verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          acat: acatField,
          expectedUserPublicKey: pubkey.trim(),
          cart: {
            amountCents: Number.parseInt(amount, 10),
            currency: currency.trim(),
            merchantId: merchant.trim(),
            category,
          },
        }),
      });
      const data = (await res.json()) as VerifyResult;
      setResult(data);
    } catch (err) {
      setResult({
        error: "client_error",
        details: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      onSubmit={handleVerify}
      className="space-y-6 rounded border border-[#D8CFBE] bg-[#EFE8D7] p-6 lg:p-8"
    >
      <div>
        <label className="block font-mono text-xs uppercase tracking-[0.14em] text-[#5A4F3F]">
          ACAT (base64url or JSON)
        </label>
        <textarea
          value={acat}
          onChange={(e) => setAcat(e.target.value)}
          placeholder={SAMPLE_HINT}
          className="mt-2 h-40 w-full resize-y rounded border border-[#D8CFBE] bg-[#F4EFE6] p-3 font-mono text-sm leading-relaxed text-[#1A1712] placeholder:text-[#9A8E7A] focus:border-[#5A4F3F] focus:outline-none"
          required
        />
      </div>

      <div>
        <label className="block font-mono text-xs uppercase tracking-[0.14em] text-[#5A4F3F]">
          Expected user public key (base64url Ed25519)
        </label>
        <input
          type="text"
          value={pubkey}
          onChange={(e) => setPubkey(e.target.value)}
          placeholder="e.g. UtMW3e7-6vveRATe9ZTG..."
          className="mt-2 w-full rounded border border-[#D8CFBE] bg-[#F4EFE6] p-3 font-mono text-sm text-[#1A1712] placeholder:text-[#9A8E7A] focus:border-[#5A4F3F] focus:outline-none"
          required
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-4">
        <div>
          <label className="block font-mono text-xs uppercase tracking-[0.14em] text-[#5A4F3F]">
            Cart amount (cents)
          </label>
          <input
            type="number"
            min={0}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="mt-2 w-full rounded border border-[#D8CFBE] bg-[#F4EFE6] p-3 font-mono text-sm text-[#1A1712] focus:border-[#5A4F3F] focus:outline-none"
            required
          />
        </div>
        <div>
          <label className="block font-mono text-xs uppercase tracking-[0.14em] text-[#5A4F3F]">
            Currency (ISO 4217)
          </label>
          <input
            type="text"
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="mt-2 w-full rounded border border-[#D8CFBE] bg-[#F4EFE6] p-3 font-mono text-sm uppercase text-[#1A1712] focus:border-[#5A4F3F] focus:outline-none"
            required
          />
        </div>
        <div>
          <label className="block font-mono text-xs uppercase tracking-[0.14em] text-[#5A4F3F]">
            Merchant id
          </label>
          <input
            type="text"
            value={merchant}
            onChange={(e) => setMerchant(e.target.value)}
            className="mt-2 w-full rounded border border-[#D8CFBE] bg-[#F4EFE6] p-3 font-mono text-sm text-[#1A1712] focus:border-[#5A4F3F] focus:outline-none"
            required
          />
        </div>
        <div>
          <label className="block font-mono text-xs uppercase tracking-[0.14em] text-[#5A4F3F]">
            MCC category
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="mt-2 w-full rounded border border-[#D8CFBE] bg-[#F4EFE6] p-3 font-mono text-sm text-[#1A1712] focus:border-[#5A4F3F] focus:outline-none"
          >
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <p className="font-serif text-sm italic text-[#5A4F3F]">
          Same pure function as <code>@sovereign/inspector</code>. No
          ACAT is stored. Result is the verifier verdict + reason.
        </p>
        <button
          type="submit"
          disabled={busy || !acat || !pubkey}
          className="rounded bg-[#1A1712] px-6 py-3 font-mono text-xs uppercase tracking-[0.18em] text-[#F4EFE6] transition disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[#3A3128]"
        >
          {busy ? "Verifying…" : "Verify offline →"}
        </button>
      </div>

      {result && <ResultBlock result={result} />}
    </form>
  );
}

function ResultBlock({ result }: { result: VerifyResult }) {
  if ("error" in result) {
    return (
      <div className="border-l-4 border-amber-700 bg-amber-50 p-5 font-serif text-base">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-amber-800">
          Bad request
        </p>
        <p className="mt-2">{result.details ?? result.error}</p>
      </div>
    );
  }
  if (result.valid) {
    return (
      <div className="border-l-4 border-emerald-700 bg-emerald-50 p-5">
        <p className="font-mono text-xs uppercase tracking-[0.14em] text-emerald-800">
          ✓ Valid · agent authorized for this cart
        </p>
        <p className="mt-2 font-serif text-lg text-[#1A1712]">
          Remaining authorized:{" "}
          <strong>{result.remainingMaxCents.toLocaleString()}</strong>{" "}
          cents.
        </p>
        {result.reputation && (
          <p className="mt-1 font-serif text-base text-[#3A3128]">
            Agent reputation at issuance:{" "}
            <strong>{result.reputation.letterGrade}</strong> (
            {result.reputation.numericScore}/100).
          </p>
        )}
        <pre className="mt-4 whitespace-pre-wrap rounded bg-[#1A1712] p-4 font-mono text-xs leading-relaxed text-[#F4EFE6]">
          {result.summary}
        </pre>
        <p className="mt-3 font-serif text-xs italic text-[#5A4F3F]">
          {result.verifierNote}
        </p>
      </div>
    );
  }
  // Invalid — show the specific reason + the full 12-reason taxonomy
  return (
    <div className="border-l-4 border-rose-700 bg-rose-50 p-5">
      <p className="font-mono text-xs uppercase tracking-[0.14em] text-rose-800">
        ✗ Invalid · do NOT proceed
      </p>
      <p className="mt-2 font-serif text-lg text-[#1A1712]">
        Failure reason:{" "}
        <strong className="font-mono">{result.reason}</strong>
      </p>
      <details className="mt-4 font-serif text-sm">
        <summary className="cursor-pointer font-mono text-xs uppercase tracking-[0.14em] text-[#5A4F3F]">
          All 12 verification reasons (procurement granularity)
        </summary>
        <ul className="mt-3 grid grid-cols-2 gap-1">
          {result.oneOfTwelveReasons.map((r) => (
            <li
              key={r}
              className={`font-mono text-xs ${
                r === result.reason
                  ? "font-bold text-rose-800"
                  : "text-[#5A4F3F]"
              }`}
            >
              {r === result.reason ? "→ " : "  "}
              {r}
            </li>
          ))}
        </ul>
      </details>
      <pre className="mt-4 whitespace-pre-wrap rounded bg-[#1A1712] p-4 font-mono text-xs leading-relaxed text-[#F4EFE6]">
        {result.summary}
      </pre>
      <p className="mt-3 font-serif text-xs italic text-[#5A4F3F]">
        {result.verifierNote}
      </p>
    </div>
  );
}
