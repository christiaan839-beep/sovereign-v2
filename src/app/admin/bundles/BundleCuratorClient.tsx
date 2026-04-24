"use client";

/**
 * BundleCuratorClient — admin UI for creating + publishing bundles.
 *
 * State:
 *   draft     — form open with member editor
 *   creating  — POST in flight
 *   created   — toast shown, form cleared, list updates
 *   error     — server error surfaced
 *
 * Member shares sum validation is CLIENT-side too — prevents the round-trip
 * for the obvious mistake, keeps the server-side check as the security layer.
 */

import { useMemo, useState } from "react";

interface Bundle {
  id: string;
  slug: string;
  name: string;
  category: string;
  priceCents: number;
  creatorSharePct: number;
  isPublic: boolean;
  createdAt: string | Date | null;
}

interface MemberRow {
  agentSlug: string;
  sharePct: number;
}

interface Props {
  initialBundles: Bundle[];
}

export function BundleCuratorClient({ initialBundles }: Props) {
  const [bundles, setBundles] = useState<Bundle[]>(initialBundles);

  // Form state
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("Growth");
  const [priceCents, setPriceCents] = useState(50);
  const [members, setMembers] = useState<MemberRow[]>([
    { agentSlug: "", sharePct: 50 },
    { agentSlug: "", sharePct: 50 },
  ]);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string>("");
  const [success, setSuccess] = useState<string>("");

  const totalShare = useMemo(
    () => members.reduce((n, m) => n + (Number.isFinite(m.sharePct) ? m.sharePct : 0), 0),
    [members],
  );
  const sharesOk = totalShare === 100;

  function updateMember(idx: number, field: keyof MemberRow, value: string) {
    setMembers((prev) => {
      const next = [...prev];
      if (field === "sharePct") {
        next[idx] = { ...next[idx], sharePct: parseInt(value, 10) || 0 };
      } else {
        next[idx] = { ...next[idx], agentSlug: value };
      }
      return next;
    });
  }

  function addMember() {
    setMembers((prev) => [...prev, { agentSlug: "", sharePct: 0 }]);
  }

  function removeMember(idx: number) {
    setMembers((prev) => prev.filter((_, i) => i !== idx));
  }

  async function create() {
    setErr("");
    setSuccess("");

    if (!sharesOk) {
      setErr(`Member shares sum to ${totalShare} (must be exactly 100)`);
      return;
    }
    const validMembers = members.filter((m) => m.agentSlug.trim().length > 0);
    if (validMembers.length < 2) {
      setErr("Need at least 2 member agents");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/bundles", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          slug: slug.trim(),
          name: name.trim(),
          description: description.trim(),
          category: category.trim(),
          priceCents,
          creatorSharePct: 70,
          members: validMembers.map((m) => ({
            agentSlug: m.agentSlug.trim(),
            sharePct: m.sharePct,
          })),
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        const code = body.error ?? `HTTP ${res.status}`;
        if (code === "agent_not_found" && body.missingSlugs) {
          setErr(`Unknown agent slugs: ${body.missingSlugs.join(", ")}`);
        } else if (code === "agent_not_verified" && body.missingSlugs) {
          setErr(`Agents not yet approved: ${body.missingSlugs.join(", ")}`);
        } else if (code === "slug_taken") {
          setErr("This bundle slug is already taken.");
        } else {
          setErr(code);
        }
        return;
      }
      setSuccess(`Created bundle "${body.slug}". Publish it when ready.`);
      // Reset form
      setSlug("");
      setName("");
      setDescription("");
      setMembers([
        { agentSlug: "", sharePct: 50 },
        { agentSlug: "", sharePct: 50 },
      ]);
      // Refresh list
      const listRes = await fetch("/api/admin/bundles", { cache: "no-store" });
      const listBody = await listRes.json();
      if (listBody.ok) setBundles(listBody.bundles);
    } catch {
      setErr("network_error");
    } finally {
      setSubmitting(false);
    }
  }

  async function publish(id: string) {
    if (!confirm("Publish this bundle to the marketplace?")) return;
    try {
      const res = await fetch(`/api/admin/bundles/${id}/publish`, {
        method: "POST",
      });
      if (!res.ok) return;
      setBundles((prev) =>
        prev.map((b) => (b.id === id ? { ...b, isPublic: true } : b)),
      );
    } catch {
      /* silent */
    }
  }

  return (
    <div className="space-y-10">
      {/* Create form */}
      <section>
        <h2 className="ed-label mb-5">Create a new bundle</h2>
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
                Slug (kebab-case)
              </label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                placeholder="real-estate-listing-pack"
                className="w-full ed-mono text-sm bg-transparent p-3 outline-none"
                style={{
                  border: "1px solid var(--ed-rule)",
                  color: "var(--ed-ink)",
                  borderRadius: "2px",
                }}
              />
            </div>
            <div>
              <label
                className="ed-label block mb-2"
                style={{ color: "var(--ed-ink-soft)" }}
              >
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Real Estate Listing Pack"
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
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="w-full ed-body text-sm bg-transparent p-3 outline-none"
              style={{
                border: "1px solid var(--ed-rule)",
                color: "var(--ed-ink)",
                borderRadius: "2px",
              }}
            />
          </div>

          <div className="grid grid-cols-3 gap-4 mb-6">
            <div>
              <label
                className="ed-label block mb-2"
                style={{ color: "var(--ed-ink-soft)" }}
              >
                Category
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full ed-mono text-sm bg-transparent p-3 outline-none"
                style={{
                  border: "1px solid var(--ed-rule)",
                  color: "var(--ed-ink)",
                  borderRadius: "2px",
                }}
              />
            </div>
            <div>
              <label
                className="ed-label block mb-2"
                style={{ color: "var(--ed-ink-soft)" }}
              >
                Price (cents)
              </label>
              <input
                type="number"
                value={priceCents}
                onChange={(e) => setPriceCents(parseInt(e.target.value, 10) || 0)}
                min={0}
                className="w-full ed-mono text-sm bg-transparent p-3 outline-none"
                style={{
                  border: "1px solid var(--ed-rule)",
                  color: "var(--ed-ink)",
                  borderRadius: "2px",
                }}
              />
            </div>
          </div>

          {/* Members editor */}
          <div className="mb-4">
            <div className="flex items-baseline justify-between mb-2">
              <label
                className="ed-label"
                style={{ color: "var(--ed-ink-soft)" }}
              >
                Member agents ({members.length})
              </label>
              <span
                className="ed-mono text-sm"
                style={{
                  color: sharesOk ? "var(--ed-copper)" : "var(--ed-ink-soft)",
                }}
              >
                Shares sum: {totalShare} / 100 {sharesOk ? "✓" : ""}
              </span>
            </div>
            {members.map((m, idx) => (
              <div
                key={idx}
                className="flex items-center gap-3 mb-2"
              >
                <input
                  type="text"
                  value={m.agentSlug}
                  onChange={(e) => updateMember(idx, "agentSlug", e.target.value)}
                  placeholder="agent-slug"
                  className="flex-1 ed-mono text-sm bg-transparent p-2 outline-none"
                  style={{
                    border: "1px solid var(--ed-rule)",
                    color: "var(--ed-ink)",
                    borderRadius: "2px",
                  }}
                />
                <input
                  type="number"
                  value={m.sharePct}
                  onChange={(e) => updateMember(idx, "sharePct", e.target.value)}
                  min={0}
                  max={100}
                  className="w-20 ed-mono text-sm bg-transparent p-2 outline-none"
                  style={{
                    border: "1px solid var(--ed-rule)",
                    color: "var(--ed-ink)",
                    borderRadius: "2px",
                  }}
                />
                <span
                  className="ed-caption w-5"
                  style={{ color: "var(--ed-ink-soft)" }}
                >
                  %
                </span>
                {members.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeMember(idx)}
                    className="ed-caption transition-colors hover:text-[var(--ed-copper)]"
                    style={{ color: "var(--ed-ink-soft)" }}
                  >
                    remove
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addMember}
              className="ed-caption transition-colors hover:text-[var(--ed-copper)]"
              style={{ color: "var(--ed-copper)" }}
            >
              + Add member
            </button>
          </div>

          <div className="flex items-center justify-between gap-4">
            <p className="ed-caption" style={{ color: "var(--ed-ink-soft)" }}>
              {err && (
                <span style={{ color: "var(--ed-copper)" }}>⚠ {err}</span>
              )}
              {success && (
                <span style={{ color: "var(--ed-copper)" }}>✓ {success}</span>
              )}
              {!err && !success && "Bundle is created as draft. Publish separately."}
            </p>
            <button
              type="button"
              onClick={create}
              disabled={submitting || !sharesOk}
              className="px-5 py-2 ed-mono text-sm transition-opacity hover:opacity-80 disabled:opacity-40"
              style={{
                background: "var(--ed-copper)",
                color: "var(--ed-bg)",
                borderRadius: "2px",
              }}
            >
              {submitting ? "Creating…" : "Create draft →"}
            </button>
          </div>
        </div>
      </section>

      {/* List */}
      <section>
        <h2 className="ed-label mb-5">All bundles ({bundles.length})</h2>
        {bundles.length === 0 ? (
          <div
            className="p-8 text-center"
            style={{
              border: "1px solid var(--ed-rule)",
              background: "var(--ed-bg-raised)",
              color: "var(--ed-ink-soft)",
              borderRadius: "2px",
            }}
          >
            <p className="ed-body">No bundles yet. Create one above.</p>
          </div>
        ) : (
          <div style={{ border: "1px solid var(--ed-rule)", borderRadius: "2px" }}>
            <div
              className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_auto] gap-3 px-5 py-3 ed-label"
              style={{
                borderBottom: "1px solid var(--ed-rule)",
                background: "var(--ed-bg-raised)",
                color: "var(--ed-ink-soft)",
              }}
            >
              <span>Slug</span>
              <span>Name</span>
              <span>Category</span>
              <span>Price</span>
              <span>Status</span>
              <span></span>
            </div>
            {bundles.map((b) => (
              <div
                key={b.id}
                className="grid grid-cols-[1.5fr_1.5fr_1fr_1fr_1fr_auto] gap-3 px-5 py-3 items-baseline"
                style={{ borderBottom: "1px solid var(--ed-rule)" }}
              >
                <a
                  href={`/marketplace/bundles/${b.slug}`}
                  className="ed-mono text-sm transition-colors hover:text-[var(--ed-copper)]"
                  style={{ color: "var(--ed-ink)" }}
                >
                  {b.slug}
                </a>
                <span
                  className="ed-body text-sm"
                  style={{ color: "var(--ed-ink-soft)" }}
                >
                  {b.name}
                </span>
                <span
                  className="ed-caption"
                  style={{ color: "var(--ed-ink-soft)" }}
                >
                  {b.category}
                </span>
                <span
                  className="ed-mono text-sm"
                  style={{ color: "var(--ed-copper)" }}
                >
                  ${(b.priceCents / 100).toFixed(2)}
                </span>
                <span
                  className="ed-mono text-xs"
                  style={{
                    color: b.isPublic ? "var(--ed-copper)" : "var(--ed-ink-soft)",
                  }}
                >
                  {b.isPublic ? "public" : "draft"}
                </span>
                {!b.isPublic && (
                  <button
                    type="button"
                    onClick={() => publish(b.id)}
                    className="ed-caption transition-colors hover:text-[var(--ed-copper)]"
                    style={{ color: "var(--ed-copper)" }}
                  >
                    publish
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
