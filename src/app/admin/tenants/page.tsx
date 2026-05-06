"use client";

import { useEffect, useState } from "react";
import { useUser } from "@clerk/nextjs";
import Link from "next/link";
import {
  Loader2,
  ShieldAlert,
  ArrowRight,
  Cloud,
  Cpu,
  Lock,
  Pause,
  Play,
} from "lucide-react";
import { SovereignLogo } from "@/components/ui/SovereignLogo";

/**
 * /admin/tenants — operator console for the per-tenant configuration
 * surface added in migrations 0023 + 0024.
 *
 *   - deployment_profile  cloud | byo-gpu | air-gapped
 *   - is_suspended        kill-switch with 423 response on next call
 *
 * Until this page existed the operator had to UPDATE in Neon Console
 * to flip either column. Postgres-by-hand is fine for one-off
 * compliance asks; it doesn't scale to a typical "did this customer
 * request air-gapped yet?" check.
 *
 * The page renders client-side so flips trigger an immediate refresh
 * without a hard reload — admin workflows are chatty by nature and a
 * reload-flash in the middle of a customer call is bad UX.
 */

type Profile = "cloud" | "byo-gpu" | "air-gapped";

interface AdminTenant {
  id: string;
  nodeId: string;
  clerkUserId: string;
  plan: string;
  deploymentProfile: Profile;
  isSuspended: boolean;
  suspensionReason: string | null;
  suspendedAt: string | null;
  firstName: string | null;
  firstDelivery: string | null;
  createdAt: string | null;
}

interface ListResponse {
  ok: true;
  generatedAt: string;
  count: number;
  tenants: AdminTenant[];
}

type LoadState =
  | { kind: "loading" }
  | { kind: "ok"; data: ListResponse }
  | { kind: "error"; message: string };

export default function AdminTenantsPage() {
  const { isLoaded, isSignedIn } = useUser();
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const [busy, setBusy] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "suspended" | "non-cloud">(
    "all",
  );

  async function fetchState(): Promise<LoadState> {
    try {
      const res = await fetch("/api/_admin/tenants", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as ListResponse;
        return { kind: "ok", data };
      }
      if (res.status === 401)
        return { kind: "error", message: "Sign in is required." };
      if (res.status === 404)
        return {
          kind: "error",
          message: "Not authorised. Add your Clerk user id to ADMIN_USER_IDS.",
        };
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      return {
        kind: "error",
        message: body.error ?? `Unexpected response: ${res.status}`,
      };
    } catch (err) {
      return {
        kind: "error",
        message: err instanceof Error ? err.message : "Network error",
      };
    }
  }

  async function load() {
    setState({ kind: "loading" });
    setState(await fetchState());
  }

  useEffect(() => {
    if (!isLoaded || !isSignedIn) return;
    let cancelled = false;
    fetchState().then((next) => {
      if (!cancelled) setState(next);
    });
    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn]);

  async function setProfile(tenantId: string, profile: Profile) {
    setBusy(tenantId);
    try {
      const res = await fetch("/api/_admin/set-deployment-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, profile }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        alert(body.error ?? `Failed: ${res.status}`);
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  async function toggleSuspension(tenant: AdminTenant) {
    const next = !tenant.isSuspended;
    let reason: string | undefined;
    if (next) {
      const input = window.prompt(
        `Suspend "${tenant.nodeId}" — what's the reason?\n\n` +
          `(Surfaced to the customer in the 423 response body. ` +
          `Be specific — they will read it.)`,
      );
      if (!input || !input.trim()) return;
      reason = input.trim();
    }
    setBusy(tenant.id);
    try {
      const res = await fetch("/api/_admin/suspend-tenant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tenantId: tenant.id,
          suspend: next,
          reason,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        alert(body.error ?? `Failed: ${res.status}`);
      }
      await load();
    } finally {
      setBusy(null);
    }
  }

  if (!isLoaded || state.kind === "loading") {
    return (
      <Shell>
        <div className="flex items-center justify-center py-32">
          <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
        </div>
      </Shell>
    );
  }

  if (!isSignedIn) {
    return (
      <Shell>
        <div className="py-32 text-center">
          <ShieldAlert className="mx-auto h-10 w-10 text-amber-400" />
          <h1 className="mt-6 text-2xl font-bold">Sign in required</h1>
          <Link
            href="/sign-in?redirect_url=/admin/tenants"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black hover:bg-emerald-400"
          >
            Sign in
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </Shell>
    );
  }

  if (state.kind === "error") {
    return (
      <Shell>
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">
          <h2 className="text-lg font-semibold text-red-300">
            Couldn&rsquo;t load tenants
          </h2>
          <p className="mt-2 text-sm text-red-200/80">{state.message}</p>
          <button
            onClick={load}
            className="mt-4 rounded-full border border-white/10 px-4 py-2 text-xs hover:bg-white/5"
          >
            Try again
          </button>
        </div>
      </Shell>
    );
  }

  const allTenants = state.data.tenants;
  const tenants = allTenants.filter((t) => {
    if (filter === "suspended") return t.isSuspended;
    if (filter === "non-cloud") return t.deploymentProfile !== "cloud";
    return true;
  });

  const counts = {
    total: allTenants.length,
    suspended: allTenants.filter((t) => t.isSuspended).length,
    cloud: allTenants.filter((t) => t.deploymentProfile === "cloud").length,
    byoGpu: allTenants.filter((t) => t.deploymentProfile === "byo-gpu").length,
    airGapped: allTenants.filter((t) => t.deploymentProfile === "air-gapped")
      .length,
  };

  return (
    <Shell>
      <header className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <p className="text-xs font-mono uppercase tracking-[0.3em] text-emerald-400">
            Operator
          </p>
          <h1 className="mt-2 text-3xl font-bold">Tenants</h1>
          <p className="mt-2 text-sm text-neutral-400">
            Deployment profile + kill-switch. {counts.total} total &middot;{" "}
            {counts.suspended} suspended &middot; {counts.cloud} cloud,{" "}
            {counts.byoGpu} byo-gpu, {counts.airGapped} air-gapped
          </p>
        </div>
        <div className="flex gap-2 text-xs">
          {(["all", "suspended", "non-cloud"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`rounded-full border px-3 py-1.5 transition ${
                filter === f
                  ? "border-emerald-500/40 bg-emerald-500/[0.08] text-emerald-300"
                  : "border-white/10 text-neutral-400 hover:border-white/20 hover:text-neutral-200"
              }`}
            >
              {f === "all"
                ? "All"
                : f === "suspended"
                  ? "Suspended"
                  : "Non-cloud"}
            </button>
          ))}
        </div>
      </header>

      {tenants.length === 0 ? (
        <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-12 text-center text-neutral-500">
          No tenants match the current filter.
        </div>
      ) : (
        <div className="space-y-3">
          {tenants.map((t) => (
            <TenantRow
              key={t.id}
              tenant={t}
              busy={busy === t.id}
              onSetProfile={setProfile}
              onToggleSuspension={toggleSuspension}
            />
          ))}
        </div>
      )}

      <p className="mt-12 text-center text-xs text-neutral-600">
        Snapshot: {new Date(state.data.generatedAt).toLocaleString()} &middot;{" "}
        <button onClick={load} className="underline hover:text-neutral-400">
          refresh
        </button>
      </p>
    </Shell>
  );
}

function TenantRow({
  tenant,
  busy,
  onSetProfile,
  onToggleSuspension,
}: {
  tenant: AdminTenant;
  busy: boolean;
  onSetProfile: (tenantId: string, profile: Profile) => void;
  onToggleSuspension: (tenant: AdminTenant) => void;
}) {
  return (
    <div
      className={`rounded-2xl border p-5 transition ${
        tenant.isSuspended
          ? "border-red-500/30 bg-red-500/[0.04]"
          : "border-white/5 bg-white/[0.02] hover:border-white/10"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-semibold text-white">
              {tenant.nodeId}
            </span>
            {tenant.firstName && (
              <span className="text-sm text-neutral-400">
                ({tenant.firstName})
              </span>
            )}
            {tenant.isSuspended && (
              <span className="rounded-full border border-red-500/30 bg-red-500/[0.1] px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider text-red-300">
                Suspended
              </span>
            )}
          </div>
          <p className="mt-1 font-mono text-[11px] text-neutral-500">
            {tenant.id}
          </p>
          {tenant.isSuspended && tenant.suspensionReason && (
            <p className="mt-2 max-w-2xl text-sm text-red-200/80">
              &ldquo;{tenant.suspensionReason}&rdquo;
            </p>
          )}
        </div>
        <button
          onClick={() => onToggleSuspension(tenant)}
          disabled={busy}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${
            tenant.isSuspended
              ? "bg-emerald-500 text-black hover:bg-emerald-400"
              : "border border-red-500/30 text-red-300 hover:bg-red-500/10"
          }`}
        >
          {busy ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : tenant.isSuspended ? (
            <>
              <Play className="h-3.5 w-3.5" /> Resume
            </>
          ) : (
            <>
              <Pause className="h-3.5 w-3.5" /> Suspend
            </>
          )}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <ProfilePill
          profile="cloud"
          active={tenant.deploymentProfile === "cloud"}
          disabled={busy}
          onClick={() => onSetProfile(tenant.id, "cloud")}
          icon={Cloud}
          label="Cloud"
          hint="all providers"
        />
        <ProfilePill
          profile="byo-gpu"
          active={tenant.deploymentProfile === "byo-gpu"}
          disabled={busy}
          onClick={() => onSetProfile(tenant.id, "byo-gpu")}
          icon={Cpu}
          label="BYO-GPU"
          hint="local NIM + Ollama"
        />
        <ProfilePill
          profile="air-gapped"
          active={tenant.deploymentProfile === "air-gapped"}
          disabled={busy}
          onClick={() => onSetProfile(tenant.id, "air-gapped")}
          icon={Lock}
          label="Air-gapped"
          hint="Ollama + on-prem NIM only"
        />
      </div>
    </div>
  );
}

function ProfilePill({
  active,
  disabled,
  onClick,
  icon: Icon,
  label,
  hint,
}: {
  profile: Profile;
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  icon: typeof Cloud;
  label: string;
  hint: string;
}) {
  return (
    <button
      disabled={disabled}
      onClick={onClick}
      className={`group inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs transition disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-emerald-500/40 bg-emerald-500/[0.08] text-emerald-300"
          : "border-white/10 text-neutral-400 hover:border-white/20 hover:text-neutral-200"
      }`}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="font-medium">{label}</span>
      <span className="text-[10px] text-neutral-500 group-hover:text-neutral-400">
        &middot; {hint}
      </span>
    </button>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-screen bg-[#030303] text-neutral-100">
      <nav className="border-b border-white/5">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2">
            <SovereignLogo className="h-7 w-7" />
            <span className="text-sm font-semibold tracking-wider text-neutral-200">
              SOVEREIGN MATRIX
            </span>
          </Link>
          <div className="flex items-center gap-4 text-xs text-neutral-500">
            <Link
              href="/admin/customers"
              className="hover:text-neutral-300 transition"
            >
              Customers
            </Link>
            <Link
              href="/admin/tenants"
              className="hover:text-neutral-300 transition"
            >
              Tenants
            </Link>
            <Link
              href="/admin/health"
              className="hover:text-neutral-300 transition"
            >
              Health
            </Link>
          </div>
        </div>
      </nav>
      <div className="mx-auto max-w-6xl px-6 py-12">{children}</div>
    </main>
  );
}
