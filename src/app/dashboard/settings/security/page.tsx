"use client";

/**
 * /dashboard/settings/security — account security landing page.
 *
 * Destination for the W3C /.well-known/change-password redirect
 * (see next.config.ts redirects block). Password managers — 1Password,
 * iCloud Keychain, Bitwarden — deep-link here when they detect a
 * password breach.
 *
 * Password rotation itself is owned by Clerk, not by our app. We link
 * directly into Clerk's hosted UserProfile routes so users land on the
 * right tab immediately.
 */

import Link from "next/link";
import { useUser } from "@clerk/nextjs";
import { Shield, Key, Smartphone, LogOut, AlertCircle, ExternalLink } from "lucide-react";

export default function SecuritySettingsPage() {
  const { user, isLoaded } = useUser();

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white tracking-tight mb-1">
          Account Security
        </h1>
        <p className="text-sm text-neutral-400">
          Manage your password, two-factor authentication, and active sessions.
        </p>
      </div>

      {/* W3C notice — shown when arriving via /.well-known/change-password */}
      <div
        className="mb-6 rounded-xl px-4 py-3 flex items-start gap-3"
        style={{
          background: "rgba(181,83,44,0.08)",
          border: "1px solid rgba(181,83,44,0.25)",
        }}
      >
        <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" style={{ color: "#E08558" }} />
        <div className="text-xs text-neutral-300 leading-relaxed">
          Your password manager may have directed you here because a breach was detected
          involving the email on file{user?.primaryEmailAddress?.emailAddress ? (
            <> <span className="font-mono text-white">({user.primaryEmailAddress.emailAddress})</span></>
          ) : null}.
          Rotate your password below using the Change Password action in Clerk.
        </div>
      </div>

      <div className="grid gap-4">
        {/* Change Password */}
        <SecurityCard
          icon={<Key className="w-5 h-5" style={{ color: "#E08558" }} />}
          title="Change password"
          description="Update your account password. Your current password is required."
          action={{
            label: "Open in account settings",
            // Clerk's hosted UserProfile lives under the root /user-profile path
            // in this app (standard Clerk App Router integration).
            href: "/user-profile#/account",
            external: false,
          }}
        />

        {/* Two-factor auth */}
        <SecurityCard
          icon={<Smartphone className="w-5 h-5" style={{ color: "#E08558" }} />}
          title="Two-factor authentication"
          description="Add a second step to sign-in using an authenticator app, SMS, or security key."
          action={{
            label: "Manage 2FA",
            href: "/user-profile#/security",
            external: false,
          }}
          badge={isLoaded && user?.twoFactorEnabled ? "Enabled" : "Recommended"}
        />

        {/* Active sessions */}
        <SecurityCard
          icon={<LogOut className="w-5 h-5" style={{ color: "#E08558" }} />}
          title="Active sessions & devices"
          description="Review where you're signed in and revoke sessions you no longer recognize."
          action={{
            label: "Review sessions",
            href: "/user-profile#/active-devices",
            external: false,
          }}
        />

        {/* API key management */}
        <SecurityCard
          icon={<Shield className="w-5 h-5" style={{ color: "#E08558" }} />}
          title="API keys (BYOK)"
          description="Your own provider keys (NVIDIA NIM, Gemini, Claude, Groq) are stored encrypted at rest."
          action={{
            label: "Manage API keys",
            href: "/dashboard/settings/api-keys",
            external: false,
          }}
        />
      </div>

      <div className="mt-8 text-xs text-neutral-500 leading-relaxed">
        Sovereign Matrix never stores your password directly. Authentication is handled by
        Clerk with SOC 2 Type II compliance. See the{" "}
        <Link href="/security" className="text-neutral-300 hover:text-white underline underline-offset-2">
          security overview
        </Link>{" "}
        for architecture details.
      </div>
    </div>
  );
}

interface SecurityCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: { label: string; href: string; external: boolean };
  badge?: string;
}

function SecurityCard({ icon, title, description, action, badge }: SecurityCardProps) {
  return (
    <div
      className="rounded-xl p-5 border border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.03] transition-colors"
    >
      <div className="flex items-start gap-4">
        <div
          className="shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
          style={{ background: "rgba(181,83,44,0.08)" }}
        >
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-semibold text-white">{title}</h3>
            {badge ? (
              <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-white/[0.06] text-neutral-400">
                {badge}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-neutral-400 mb-3 leading-relaxed">{description}</p>
          <Link
            href={action.href}
            className="inline-flex items-center gap-1.5 text-xs font-medium transition-colors hover:text-white"
            style={{ color: "#B5532C" }}
          >
            {action.label}
            {action.external ? <ExternalLink className="w-3 h-3" /> : null}
          </Link>
        </div>
      </div>
    </div>
  );
}
