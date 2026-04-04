"use client";

import { SignIn } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { SovereignLogo } from "@/components/ui/SovereignLogo";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
  const [clerkReady, setClerkReady] = useState(false);
  const [clerkFailed, setClerkFailed] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const clerkEl = document.querySelector('[class*="cl-rootBox"], [class*="cl-signIn"]');
      if (clerkEl) {
        setClerkReady(true);
      } else {
        setClerkFailed(true);
      }
    }, 4000);

    const interval = setInterval(() => {
      const clerkEl = document.querySelector('[class*="cl-rootBox"], [class*="cl-signIn"]');
      if (clerkEl) {
        setClerkReady(true);
        clearTimeout(timeout);
        clearInterval(interval);
      }
    }, 500);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, []);

  return (
    <main className="min-h-screen bg-[#010101] flex flex-col items-center justify-center px-4">
      {/* Logo */}
      <div className="mb-8 flex flex-col items-center gap-4">
        <Link href="/" className="flex items-center gap-2.5">
          <SovereignLogo size="sm" />
          <span className="text-sm font-semibold text-white">Sovereign Matrix</span>
        </Link>
        <p className="text-xs text-neutral-500">Sign in to your workspace</p>
      </div>

      {/* Loading state */}
      {!clerkReady && !clerkFailed && (
        <div className="flex flex-col items-center gap-4 py-12">
          <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
          <p className="text-xs text-neutral-500">Loading sign-in...</p>
        </div>
      )}

      {/* Clerk SignIn component */}
      <div className={clerkFailed && !clerkReady ? "hidden" : ""}>
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
      </div>

      {/* Fallback when Clerk can't load */}
      {clerkFailed && !clerkReady && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="p-8 rounded-2xl bg-[#0A0A0A] border border-white/10 shadow-2xl text-center space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white mb-2">Sign In</h2>
              <p className="text-sm text-neutral-400">Authentication is loading. If this persists, try the production site.</p>
            </div>
            <a
              href="https://sovereignmatrix.agency/login"
              className="block w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-colors"
            >
              Sign in at sovereignmatrix.agency
            </a>
            <p className="text-xs text-neutral-600">
              Don&apos;t have an account?{" "}
              <Link href="/signup" className="text-emerald-400 hover:text-emerald-300">Sign up</Link>
            </p>
          </div>
        </motion.div>
      )}

      {/* Footer */}
      <div className="mt-8 text-center">
        <Link href="/" className="text-xs text-neutral-500 hover:text-neutral-400 transition-colors">
          ← Back to home
        </Link>
      </div>
    </main>
  );
}
