"use client";

/**
 * WebhooksClient — list + create + delete subscriptions.
 *
 * After creating a new subscription, the freshly-generated HMAC
 * secret is shown exactly once in a copy-to-clipboard box. Closing
 * the box means the secret is gone forever — matching the Stripe /
 * GitHub pattern.
 */

import { useEffect, useState } from "react";

interface Subscription {
  id: string;
  label: string;
  agentSlug: string;
  callbackUrl: string;
  isActive: boolean;
  triggerCount: number;
  failureCount: number;
  lastTriggeredAt: string | null;
  createdAt: string;
}

interface CreatedSub {
  id: string;
  label: string;
  agentSlug: string;
  callbackUrl: string;
  secret: string;
  createdAt: string;
}

export function WebhooksClient() {
  const [subs, setSubs] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string>("");

  // Create form
  const [newLabel, setNewLabel] = useState("");
  const [newAgent, setNewAgent] = useState("");
  const [newCallback, setNewCallback] = useState("");
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string>("");
  // One-shot secret reveal
  const [justCreated, setJustCreated] = useState<CreatedSub | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    loadSubs();
  }, []);

  async function loadSubs() {
    try {
      const res = await fetch("/api/webhooks/subscriptions", {
        cache: "no-store",
      });
      const body = await res.json();
      if (!res.ok) {
        setErr(body.error ?? `HTTP ${res.status}`);
        return;
      }
      setSubs(body.subscriptions ?? []);
      setErr("");
    } catch {
      setErr("network_error");
    } finally {
      setLoading(false);
    }
  }

  async function create() {
    setCreateErr("");
    if (!newLabel.trim() || !newAgent.trim() || !newCallback.trim()) {
      setCreateErr("All fields are required");
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/webhooks/subscriptions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          label: newLabel.trim(),
          agentSlug: newAgent.trim(),
          callbackUrl: newCallback.trim(),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setCreateErr(body.error ?? `HTTP ${res.status}`);
        return;
      }
      setJustCreated(body.subscription);
      setNewLabel("");
      setNewAgent("");
      setNewCallback("");
      await loadSubs();
    } catch {
      setCreateErr("network_error");
    } finally {
      setCreating(false);
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this subscription? Delivery history is kept.")) return;
    try {
      const res = await fetch(`/api/webhooks/subscriptions/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) return;
      await loadSubs();
    } catch {
      /* silent */
    }
  }

  async function copySecret() {
    if (!justCreated) return;
    try {
      await navigator.clipboard.writeText(justCreated.secret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* older browsers */
    }
  }

  return (
    <div>
      {/* One-shot secret reveal */}
      {justCreated && (
        <div
          className="p-5 mb-8"
          style={{
            border: "1px solid var(--ed-copper)",
            background: "var(--ed-copper-wash)",
            borderRadius: "2px",
          }}
        >
          <p
            className="ed-label mb-3"
            style={{ color: "var(--ed-copper)" }}
          >
            🔐 Secret — shown once
          </p>
          <p
            className="ed-body mb-4"
            style={{ color: "var(--ed-ink)" }}
          >
            Store this somewhere safe NOW. The platform will not display it
            again — if you lose it, you&apos;ll need to delete this subscription
            and register a new one.
          </p>
          <div className="flex items-center gap-3 mb-4">
            <code
              className="ed-mono text-xs px-3 py-2 flex-1 break-all"
              style={{
                border: "1px solid var(--ed-rule)",
                background: "var(--ed-bg)",
                color: "var(--ed-ink)",
                borderRadius: "2px",
              }}
            >
              {justCreated.secret}
            </code>
            <button
              type="button"
              onClick={copySecret}
              className="px-4 py-2 ed-mono text-sm transition-opacity hover:opacity-80"
              style={{
                background: "var(--ed-copper)",
                color: "var(--ed-bg)",
                borderRadius: "2px",
              }}
            >
              {copied ? "✓ Copied" : "Copy"}
            </button>
          </div>
          <p
            className="ed-caption mb-4"
            style={{ color: "var(--ed-ink-soft)" }}
          >
            Subscription ID: <span className="ed-mono">{justCreated.id}</span>
            {" — "}
            include as <code className="ed-mono">X-Sovereign-Subscription-Id</code> in trigger requests.
          </p>
          <button
            type="button"
            onClick={() => setJustCreated(null)}
            className="ed-caption transition-colors hover:text-[var(--ed-copper)]"
            style={{ color: "var(--ed-ink-soft)" }}
          >
            I saved it — close this box
          </button>
        </div>
      )}

      {/* Create form */}
      <section className="mb-10">
        <h2 className="ed-label mb-5">Register a new subscription</h2>
        <div
          className="p-5"
          style={{
            border: "1px solid var(--ed-rule)",
            background: "var(--ed-bg-raised)",
            borderRadius: "2px",
          }}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div>
              <label
                className="ed-label block mb-2"
                style={{ color: "var(--ed-ink-soft)" }}
              >
                Label
              </label>
              <input
                type="text"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="stripe-fraud-webhook"
                className="w-full ed-mono text-sm bg-transparent p-3 outline-none"
                style={{
                  border: "1px solid var(--ed-rule)",
                  color: "var(--ed-ink)",
                  borderRadius: "2px",
                }}
                maxLength={100}
              />
            </div>
            <div>
              <label
                className="ed-label block mb-2"
                style={{ color: "var(--ed-ink-soft)" }}
              >
                Agent slug
              </label>
              <input
                type="text"
                value={newAgent}
                onChange={(e) => setNewAgent(e.target.value)}
                placeholder="invoice-ocr"
                className="w-full ed-mono text-sm bg-transparent p-3 outline-none"
                style={{
                  border: "1px solid var(--ed-rule)",
                  color: "var(--ed-ink)",
                  borderRadius: "2px",
                }}
              />
            </div>
          </div>
          <div className="mb-4">
            <label
              className="ed-label block mb-2"
              style={{ color: "var(--ed-ink-soft)" }}
            >
              Callback URL (https only)
            </label>
            <input
              type="url"
              value={newCallback}
              onChange={(e) => setNewCallback(e.target.value)}
              placeholder="https://your-app.com/webhooks/sovereign"
              className="w-full ed-mono text-sm bg-transparent p-3 outline-none"
              style={{
                border: "1px solid var(--ed-rule)",
                color: "var(--ed-ink)",
                borderRadius: "2px",
              }}
            />
          </div>
          <div className="flex items-center justify-between gap-4">
            <p className="ed-caption" style={{ color: "var(--ed-ink-soft)" }}>
              {createErr || "Result will POST here with X-Sovereign-Signature."}
            </p>
            <button
              type="button"
              onClick={create}
              disabled={creating}
              className="px-5 py-2 ed-mono text-sm transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{
                background: "var(--ed-copper)",
                color: "var(--ed-bg)",
                borderRadius: "2px",
              }}
            >
              {creating ? "Registering…" : "Register →"}
            </button>
          </div>
        </div>
      </section>

      {/* List */}
      <section>
        <h2 className="ed-label mb-5">Your subscriptions</h2>

        {loading && (
          <p
            className="ed-caption"
            style={{ color: "var(--ed-ink-soft)" }}
          >
            Loading…
          </p>
        )}

        {err && (
          <p
            className="ed-caption"
            style={{ color: "var(--ed-copper)" }}
          >
            Error: <span className="ed-mono">{err}</span>
          </p>
        )}

        {!loading && subs.length === 0 && !err && (
          <div
            className="p-8 text-center"
            style={{
              border: "1px solid var(--ed-rule)",
              background: "var(--ed-bg-raised)",
              color: "var(--ed-ink-soft)",
              borderRadius: "2px",
            }}
          >
            <p className="ed-body">No subscriptions yet.</p>
            <p className="ed-caption mt-2">
              Register one above to start receiving agent results on your
              callback URL.
            </p>
          </div>
        )}

        {subs.length > 0 && (
          <div style={{ border: "1px solid var(--ed-rule)", borderRadius: "2px" }}>
            <div
              className="grid grid-cols-[1.5fr_1fr_2fr_1fr_1fr_auto] gap-3 px-5 py-3 ed-label"
              style={{
                borderBottom: "1px solid var(--ed-rule)",
                background: "var(--ed-bg-raised)",
                color: "var(--ed-ink-soft)",
              }}
            >
              <span>Label</span>
              <span>Agent</span>
              <span>Callback</span>
              <span>Triggers</span>
              <span>Failures</span>
              <span></span>
            </div>
            {subs.map((s) => (
              <div
                key={s.id}
                className="grid grid-cols-[1.5fr_1fr_2fr_1fr_1fr_auto] gap-3 px-5 py-4 items-baseline"
                style={{ borderBottom: "1px solid var(--ed-rule)" }}
              >
                <span
                  className="ed-body text-sm"
                  style={{ color: "var(--ed-ink)" }}
                >
                  {s.label}
                </span>
                <span
                  className="ed-mono text-sm"
                  style={{ color: "var(--ed-copper)" }}
                >
                  {s.agentSlug}
                </span>
                <span
                  className="ed-mono text-xs break-all"
                  style={{ color: "var(--ed-ink-soft)" }}
                >
                  {s.callbackUrl}
                </span>
                <span
                  className="ed-mono text-sm"
                  style={{ color: "var(--ed-ink-soft)" }}
                >
                  {s.triggerCount}
                </span>
                <span
                  className="ed-mono text-sm"
                  style={{
                    color:
                      s.failureCount > 0 ? "var(--ed-copper)" : "var(--ed-ink-soft)",
                  }}
                >
                  {s.failureCount}
                </span>
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  className="ed-caption transition-colors hover:text-[var(--ed-copper)]"
                  style={{ color: "var(--ed-ink-soft)" }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
