"use client";

/**
 * CreatorApplyClient — manifest paste + inline validation + submit.
 *
 * Client-side state machine:
 *   idle      — empty textarea, submit disabled
 *   validating — JSON + SAM checks running (synchronous, near-instant)
 *   invalid   — errors displayed in a copper-bordered table; submit disabled
 *   valid     — green summary + contact-email + enabled submit button
 *   submitting — POST in flight, submit disabled, spinner
 *   submitted — success panel with reference ID
 *   error     — submission failed (network or server error), can retry
 *
 * Client validation mirrors the server's validator at
 * /api/creators/submit. Server is the source of truth; client is for
 * fast feedback.
 */

import { useMemo, useState } from "react";

type Phase =
  | "idle"
  | "invalid"
  | "valid"
  | "submitting"
  | "submitted"
  | "error";

interface ValidationError {
  path: string;
  message: string;
}

type SubmitStatus = "live" | "queued";

interface SubmitResult {
  referenceId: string;
  status: SubmitStatus;
  policy: string;
  reason: string;
  liveUrl?: string;
  nextSteps: string[];
}

const VALID_CATEGORIES = new Set([
  "Growth", "Content", "Dev", "Finance", "HR", "Legal", "Ecommerce",
  "Research", "Cybersec", "Real Estate", "Gov", "Productivity",
  "Creative", "Data", "A2E", "Meta", "Integration", "Safety",
]);
const SLUG_PATTERN = /^[a-z][a-z0-9-]{2,63}$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/;
const REQUIRED = ["sam", "slug", "displayName", "purpose", "category", "version", "inputs", "output", "guarantees"];

function validateManifest(manifest: unknown): ValidationError[] {
  const errors: ValidationError[] = [];
  if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
    return [{ path: "/", message: "Manifest must be a JSON object." }];
  }
  const m = manifest as Record<string, unknown>;

  for (const field of REQUIRED) {
    if (!(field in m)) {
      errors.push({ path: `/${field}`, message: `Required field "${field}" is missing.` });
    }
  }
  if ("sam" in m && m.sam !== "1.0") {
    errors.push({ path: "/sam", message: `"sam" must be exactly "1.0".` });
  }
  if ("slug" in m && typeof m.slug === "string" && !SLUG_PATTERN.test(m.slug)) {
    errors.push({ path: "/slug", message: `"slug" must be kebab-case (3-64 chars, starts with letter).` });
  }
  if ("category" in m && typeof m.category === "string" && !VALID_CATEGORIES.has(m.category)) {
    errors.push({ path: "/category", message: `"category" must be one of the 18 official categories.` });
  }
  if ("version" in m && typeof m.version === "string" && !SEMVER_PATTERN.test(m.version)) {
    errors.push({ path: "/version", message: `"version" must be SemVer.` });
  }
  if ("guarantees" in m) {
    if (!Array.isArray(m.guarantees) || m.guarantees.length < 1) {
      errors.push({ path: "/guarantees", message: `"guarantees" must contain at least 1 clause.` });
    }
  }
  return errors;
}

const SAMPLE_MANIFEST = `{
  "sam": "1.0",
  "slug": "extract-invoice",
  "displayName": "Invoice Extractor",
  "purpose": "Extract structured data from invoice text",
  "category": "Finance",
  "version": "1.0.0",
  "inputs": [
    { "name": "text", "type": "string", "required": true }
  ],
  "output": { "type": "object" },
  "guarantees": [
    "Never fabricates missing fields — absent values return null"
  ],
  "pricing": { "cents": 5, "tier": "basic" }
}`;

export function CreatorApplyClient() {
  const [raw, setRaw] = useState("");
  const [email, setEmail] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [serverError, setServerError] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitResult | null>(null);

  // Live validation — re-runs on every keystroke. Pure functions, fast.
  const validation = useMemo(() => {
    const trimmed = raw.trim();
    if (!trimmed) return { valid: false, errors: [], parsed: null };

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (err) {
      return {
        valid: false,
        parsed: null,
        errors: [
          {
            path: "/",
            message: `Invalid JSON: ${err instanceof Error ? err.message : "parse failed"}`,
          },
        ],
      };
    }

    const errors = validateManifest(parsed);
    return { valid: errors.length === 0, errors, parsed };
  }, [raw]);

  // Each `phase === X` is written once and cached in a boolean. Repeating the
  // same comparison across the tree confuses TS's control-flow narrowing (it
  // shrinks `phase` to the positive arm of earlier checks and then refuses to
  // compare it to "submitting" later). One comparison per phase value = zero
  // ambiguity for the type checker.
  const emailOk =
    email.trim().length === 0 ||
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const phaseIsReady = phase === "idle" || phase === "valid";
  const phaseIsSubmitting = phase === "submitting";
  const canSubmit = validation.valid && phaseIsReady && emailOk;

  async function handleSubmit() {
    if (!validation.valid || !validation.parsed) return;
    setPhase("submitting");
    setServerError(null);

    try {
      const res = await fetch("/api/creators/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          manifest: validation.parsed,
          contactEmail: email.trim() || undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setServerError(body.error ?? "Submission failed.");
        setPhase("error");
        return;
      }
      setResult({
        referenceId: body.referenceId,
        status: body.status === "live" ? "live" : "queued",
        policy: body.policy ?? "curated",
        reason: body.reason ?? "",
        liveUrl: body.liveUrl,
        nextSteps: body.nextSteps ?? [],
      });
      setPhase("submitted");
    } catch {
      setServerError("Network error. Try again in a moment.");
      setPhase("error");
    }
  }

  // Submitted state — replaces the form with a success panel.
  if (phase === "submitted" && result) {
    return <SubmittedPanel result={result} onReset={() => {
      setRaw("");
      setEmail("");
      setPhase("idle");
      setResult(null);
    }} />;
  }

  return (
    <div>
      {/* Manifest textarea */}
      <div className="mb-6">
        <div className="flex items-baseline justify-between mb-3">
          <label className="ed-label">
            Paste your SAM v1.0 manifest
          </label>
          <button
            type="button"
            onClick={() => setRaw(SAMPLE_MANIFEST)}
            className="ed-caption transition-colors hover:text-[var(--ed-copper)]"
          >
            Insert sample →
          </button>
        </div>
        <textarea
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          placeholder='Paste JSON here. Starts with { "sam": "1.0", ... }'
          rows={14}
          className="w-full ed-mono text-[13px] bg-transparent p-5 outline-none transition-colors"
          style={{
            border: `1px solid ${
              raw && !validation.valid ? "var(--ed-copper)" : "var(--ed-rule)"
            }`,
            color: "var(--ed-ink)",
            borderRadius: "2px",
          }}
        />
      </div>

      {/* Validation report */}
      {raw.trim().length > 0 && (
        <ValidationReport validation={validation} />
      )}

      {/* Contact email + submit */}
      {validation.valid && (
        <div className="mt-8">
          <label className="ed-label block mb-3">
            Contact email (optional — we&rsquo;ll email the review verdict here)
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="w-full ed-mono text-[15px] bg-transparent p-4 outline-none mb-6"
            style={{
              border: "1px solid var(--ed-rule)",
              color: "var(--ed-ink)",
              borderRadius: "2px",
            }}
          />

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <p className="ed-caption">
              By submitting you agree to the 70/30 revenue split and the SAM v1.0 compliance
              terms.
            </p>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canSubmit || phaseIsSubmitting}
              className="group relative px-5 py-2.5 transition-all ed-mono text-sm disabled:opacity-40"
              style={{
                background: "var(--ed-copper)",
                color: "var(--ed-bg)",
                borderRadius: "2px",
                cursor: canSubmit && !phaseIsSubmitting ? "pointer" : "not-allowed",
              }}
            >
              {phaseIsSubmitting ? (
                <span className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 rounded-full animate-pulse"
                        style={{ background: "var(--ed-bg)" }} />
                  Submitting
                </span>
              ) : (
                <>Submit for review →</>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Server error */}
      {phase === "error" && serverError && (
        <div className="mt-6 p-5 ed-body"
             style={{
               border: "1px solid var(--ed-copper)",
               background: "var(--ed-copper-wash)",
               color: "var(--ed-ink)",
               borderRadius: "2px",
             }}>
          <span className="ed-label mr-2" style={{ color: "var(--ed-copper)" }}>ERROR</span>
          {serverError}
        </div>
      )}
    </div>
  );
}

/* ─── Validation report ───────────────────────────────────────── */

function ValidationReport({
  validation,
}: {
  validation: { valid: boolean; errors: ValidationError[] };
}) {
  if (validation.valid) {
    return (
      <div className="p-5"
           style={{
             border: "1px solid var(--ed-copper)",
             background: "var(--ed-copper-wash)",
             borderRadius: "2px",
           }}>
        <p className="ed-label mb-1" style={{ color: "var(--ed-copper)" }}>
          ✓ Valid SAM v1.0
        </p>
        <p className="ed-caption">
          Server-side revalidation runs on submit. Any discrepancy will be reported below.
        </p>
      </div>
    );
  }

  return (
    <div style={{
      border: "1px solid var(--ed-copper)",
      background: "var(--ed-bg-raised)",
      borderRadius: "2px",
    }}>
      <div className="p-4 border-b"
           style={{ borderColor: "var(--ed-copper)", background: "var(--ed-copper-wash)" }}>
        <p className="ed-label" style={{ color: "var(--ed-copper)" }}>
          ✗ {validation.errors.length} error{validation.errors.length === 1 ? "" : "s"}
        </p>
      </div>
      <ul>
        {validation.errors.map((err, i) => (
          <li
            key={i}
            className="px-5 py-3 flex items-baseline gap-4"
            style={{
              borderBottom: i < validation.errors.length - 1 ? "1px solid var(--ed-rule)" : "none",
            }}
          >
            <span className="ed-mono text-[13px] flex-shrink-0"
                  style={{ color: "var(--ed-copper)" }}>
              {err.path}
            </span>
            <span className="ed-body text-[14px]" style={{ color: "var(--ed-ink-soft)" }}>
              {err.message}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ─── Submitted state panel ───────────────────────────────────── */

function SubmittedPanel({
  result,
  onReset,
}: {
  result: SubmitResult;
  onReset: () => void;
}) {
  const isLive = result.status === "live";

  // Masthead copy is the single biggest UX signal of outcome — a live
  // agent gets a victory lap; a queued one gets the calmer "review
  // pending" framing. The rest of the panel shares structure so a
  // creator who flips between the two states over time sees familiar
  // scaffolding and notices only the meaningful differences.
  const masthead = isLive ? "Live — your agent is in the marketplace" : "Accepted — review pending";

  return (
    <div className="py-4">
      <div
        className="p-8"
        style={{
          border: "1px solid var(--ed-copper)",
          background: "var(--ed-copper-wash)",
          borderRadius: "2px",
        }}
      >
        <p className="ed-label mb-3" style={{ color: "var(--ed-copper)" }}>
          {masthead}
        </p>

        {isLive && result.liveUrl ? (
          <a
            href={result.liveUrl}
            className="ed-display text-4xl mb-2 block transition-opacity hover:opacity-75"
            style={{ color: "var(--ed-ink)" }}
          >
            {result.liveUrl}
            <span className="ed-mono text-base ml-3" style={{ color: "var(--ed-copper)" }}>
              →
            </span>
          </a>
        ) : (
          <p className="ed-display text-4xl mb-2" style={{ color: "var(--ed-ink)" }}>
            Reference{" "}
            <span className="ed-mono text-2xl" style={{ color: "var(--ed-copper)" }}>
              {result.referenceId}
            </span>
          </p>
        )}

        <p className="ed-caption mb-6">
          {isLive
            ? `Reference ${result.referenceId} — save for your records. Post-hoc audit runs silently.`
            : "Save this reference — you can quote it if anything needs follow-up."}
        </p>

        <ol className="space-y-3">
          {result.nextSteps.map((step, i) => (
            <li
              key={i}
              className="flex gap-3 ed-body text-[15px]"
              style={{ color: "var(--ed-ink-soft)" }}
            >
              <span className="ed-mono flex-shrink-0" style={{ color: "var(--ed-copper)" }}>
                {i + 1}.
              </span>
              <span>{step}</span>
            </li>
          ))}
        </ol>

        <p className="ed-caption mt-6 pt-4" style={{ borderTop: "1px solid var(--ed-rule)" }}>
          Policy in effect: <span className="ed-mono">{result.policy}</span>
          {" · "}
          {result.reason}
        </p>
      </div>

      <button
        type="button"
        onClick={onReset}
        className="mt-6 ed-caption transition-colors hover:text-[var(--ed-copper)]"
      >
        ← Submit another agent
      </button>
    </div>
  );
}
