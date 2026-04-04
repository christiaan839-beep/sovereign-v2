"use client";

import { SignUp } from "@clerk/nextjs";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { SovereignLogo } from "@/components/ui/SovereignLogo";
import { Loader2 } from "lucide-react";

export default function SignupPage() {
  const [clerkReady, setClerkReady] = useState(false);
  const [clerkFailed, setClerkFailed] = useState(false);

  useEffect(() => {
    // Give Clerk 4 seconds to render, then show fallback
    const timeout = setTimeout(() => {
      const clerkEl = document.querySelector('[class*="cl-rootBox"], [class*="cl-signUp"]');
      if (clerkEl) {
        setClerkReady(true);
      } else {
        setClerkFailed(true);
      }
    }, 4000);

    // Also check every 500ms for faster detection
    const interval = setInterval(() => {
      const clerkEl = document.querySelector('[class*="cl-rootBox"], [class*="cl-signUp"]');
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
        <p className="text-xs text-neutral-500">Create your account — free, no credit card</p>
      </div>

      {/* Loading state while Clerk initializes */}
      {!clerkReady && !clerkFailed && (
        <div className="flex flex-col items-center gap-4 py-12">
          <Loader2 className="w-6 h-6 text-emerald-500 animate-spin" />
          <p className="text-xs text-neutral-500">Loading sign-up...</p>
        </div>
      )}

      {/* Clerk SignUp component */}
      <div className={clerkFailed && !clerkReady ? "hidden" : ""}>
        <SignUp
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
            },
          }}
          fallbackRedirectUrl="/onboarding"
          signInUrl="/login"
        />
      </div>

      {/* Fallback when Clerk can't load (localhost, network issues) */}
      {clerkFailed && !clerkReady && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-sm"
        >
          <div className="p-8 rounded-2xl bg-[#0A0A0A] border border-white/10 shadow-2xl text-center space-y-6">
            <div>
              <h2 className="text-lg font-semibold text-white mb-2">Sign Up</h2>
              <p className="text-sm text-neutral-400">Authentication is loading. If this persists, try the production site.</p>
            </div>
            <a
              href="https://sovereignmatrix.agency/signup"
              className="block w-full py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-semibold text-sm transition-colors"
            >
              Sign up at sovereignmatrix.agency
            </a>
            <p className="text-xs text-neutral-600">
              Already have an account?{" "}
              <Link href="/login" className="text-emerald-400 hover:text-emerald-300">Sign in</Link>
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
