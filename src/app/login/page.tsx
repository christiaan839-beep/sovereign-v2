"use client";

import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { SovereignLogo } from "@/components/ui/SovereignLogo";

/**
 * Login Page — Uses Clerk's SignIn component for authentication.
 * Clerk handles email/password, Google, GitHub, and other social providers.
 * After sign-in, redirects to /dashboard.
 */
export default function LoginPage() {
  return (
    <div className="min-h-screen bg-[#010101] flex flex-col items-center justify-center px-4">
      {/* Logo + back link */}
      <div className="mb-8 flex flex-col items-center gap-4">
        <Link href="/" className="flex items-center gap-2.5">
          <SovereignLogo size="sm" />
          <span className="text-sm font-semibold text-white">Sovereign Matrix</span>
        </Link>
        <p className="text-xs text-neutral-500">Sign in to your command center</p>
      </div>

      {/* Clerk SignIn component */}
      <SignIn
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "bg-[#0A0A0A] border border-white/10 shadow-2xl",
            headerTitle: "text-white",
            headerSubtitle: "text-neutral-400",
            socialButtonsBlockButton: "bg-white/5 border-white/10 text-white hover:bg-white/10",
            formFieldLabel: "text-neutral-400",
            formFieldInput: "bg-[#111] border-white/10 text-white",
            formButtonPrimary: "bg-emerald-500 hover:bg-emerald-400 text-black font-semibold",
            footerActionLink: "text-emerald-400 hover:text-emerald-300",
            identityPreviewEditButton: "text-emerald-400",
          },
        }}
        fallbackRedirectUrl="/dashboard"
        signUpUrl="/signup"
      />

      {/* Footer */}
      <div className="mt-8 text-center">
        <Link href="/" className="text-xs text-neutral-600 hover:text-neutral-400 transition-colors">
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
