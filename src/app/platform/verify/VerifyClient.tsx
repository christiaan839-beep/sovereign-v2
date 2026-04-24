"use client";

/**
 * VerifyClient — paste-attestation verifier UI.
 *
 * State:
 *   idle      → user hasn't pasted yet
 *   verifying → POST in flight
 *   valid     → signature verified (copper indicator)
 *   invalid   → signature failed OR attestation unsigned (grey indicator)
 *   error     → HTTP error
 */

import { useState } from "react";

interface VerdictResponse {
  ok: boolean;
  signed?: boolean;
  valid?: boolean;
  reason?: string;
  publicKey?: string;
  claims?: Record<string, unknown>;
  error?: string;
  message?: string;
}

type Phase = "idle" | "verifying" | "done" | "error";

export function VerifyClient() {
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [verdict, setVerdict] = useState<VerdictResponse | null>(null);
  const [err, setErr] = useState<string>("");

  async function verify() {
    const trimmed = input.trim();
    if (!trimmed) {
      setErr("Paste an attestation JSON first");
      setPhase("error");
      return;
    }
    setPhase("verifying");
    setErr("");

    // Accept either stringified JSON OR the object itself.
    const payload = trimmed.startsWith("{")
      ? { attestationJson: trimmed }
      : { attestationJson: trimmed };
    try {
      const res = await fetch("/api/platform/verify-attestation", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = (await res.json()) as VerdictResponse;
      if (!res.ok || body.ok === false) {
        setErr(body.message ?? body.error ?? `HTTP ${res.status}`);
        setPhase("error");
        return;
      }
      setVerdict(body);
      setPhase("done");
    } catch {
      setErr("Network error");
      setPhase("error");
    }
  }

  function clear() {
    setInput("");
    setVerdict(null);
    setErr("");
    setPhase("idle");
  }

  const tone =
    verdict?.valid === true
      ? "valid"
      : verdict?.signed === true && verdict?.valid === false
      ? "invalid"
      : verdict?.signed === false
      ? "unsigned"
      : null;

  return (
    <div>
      <label
        className="ed-label block mb-3"
        style={{ color: "var(--ed-ink-soft)" }}
      >
        Paste the signed attestation JSON
      </label>
      <textarea
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder='{"agentId":"...","invocationId":"...","inputHash":"sha256-...","outputHash":"sha256-...", ..., "_sig":{"alg":"ed25519","publicKey":"...","signature":"..."}}'
        rows={10}
        className="w-full ed-mono text-xs bg-transparent p-4 outline-none"
        style={{
          border: "1px solid var(--ed-rule)",
          color: "var(--ed-ink)",
          borderRadius: "2px",
        }}
        disabled={phase === "verifying"}
      />

      <div className="flex items-center justify-between gap-4 mt-4 mb-8">
        <p className="ed-caption">
          Verification is local ed25519 against the platform public key. Hashes
          of input/output are signed — not the plaintext.
        </p>
        <div className="flex items-center gap-3">
          {phase === "done" && (
            <button
              type="button"
              onClick={clear}
              className="ed-caption transition-colors hover:text-[var(--ed-copper)]"
            >
              Clear
            </button>
          )}
          <button
            type="button"
            onClick={verify}
            disabled={phase === "verifying" || !input.trim()}
            className="px-5 py-2 ed-mono text-sm transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{
              background: "var(--ed-copper)",
              color: "var(--ed-bg)",
              borderRadius: "2px",
            }}
          >
            {phase === "verifying" ? "Verifying…" : "Verify →"}
          </button>
        </div>
      </div>

      {phase === "error" && err && (
        <div
          className="p-4 ed-caption"
          style={{
            border: "1px solid var(--ed-copper)",
            background: "var(--ed-copper-wash)",
            color: "var(--ed-ink)",
            borderRadius: "2px",
          }}
        >
          <span
            className="ed-label mr-2"
            style={{ color: "var(--ed-copper)" }}
          >
            ERROR
          </span>
          {err}
        </div>
      )}

      {phase === "done" && verdict && (
        <div
          className="p-6"
          style={{
            border:
              tone === "valid"
                ? "1px solid var(--ed-copper)"
                : "1px solid var(--ed-rule)",
            background:
              tone === "valid" ? "var(--ed-copper-wash)" : "var(--ed-bg-raised)",
            borderRadius: "2px",
          }}
        >
          <p className="ed-label mb-3" style={{ color: "var(--ed-copper)" }}>
            {tone === "valid"
              ? "✓ Signature valid"
              : tone === "invalid"
              ? "⚠ Signature did NOT verify"
              : tone === "unsigned"
              ? "— Attestation has no _sig block"
              : "Verdict"}
          </p>

          {verdict.reason && (
            <p
              className="ed-caption mb-4"
              style={{ color: "var(--ed-ink-soft)" }}
            >
              {verdict.reason}
            </p>
          )}

          {verdict.claims && (
            <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(verdict.claims).map(([k, v]) => (
                <div key={k}>
                  <dt
                    className="ed-label mb-1"
                    style={{ color: "var(--ed-ink-soft)" }}
                  >
                    {k}
                  </dt>
                  <dd
                    className="ed-mono text-[12px] break-all"
                    style={{ color: "var(--ed-ink)" }}
                  >
                    {String(v)}
                  </dd>
                </div>
              ))}
            </dl>
          )}

          {verdict.publicKey && (
            <p
              className="ed-caption pt-4 mt-4"
              style={{
                borderTop: "1px solid var(--ed-rule)",
                color: "var(--ed-ink-soft)",
              }}
            >
              Signed by public key{" "}
              <span
                className="ed-mono break-all"
                style={{ color: "var(--ed-copper)" }}
              >
                {verdict.publicKey}
              </span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
