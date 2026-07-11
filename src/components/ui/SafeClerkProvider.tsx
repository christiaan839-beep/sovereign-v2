"use client";

import React, { useEffect, useRef } from "react";
import { ClerkProvider } from "@clerk/nextjs";

/**
 * SafeClerkProvider — Wraps ClerkProvider with error suppression.
 *
 * ClerkProvider renders normally during SSR (required for auth to work).
 * Safety layers handle cases where Clerk is unavailable (offline dev, missing keys):
 * 1. React error boundary — catches component-level crashes
 * 2. console.error/warn patches — silence Clerk & Framer noise
 * 3. unhandledrejection handler — prevents promise rejection noise
 * 4. window.onerror handler — catches errors before Next.js dev overlay
 */

function useSuppressExternalErrors() {
  const installed = useRef(false);
  useEffect(() => {
    if (installed.current) return;
    installed.current = true;

    // 1. Patch console.error
    const origError = console.error;
    console.error = function (...args: unknown[]) {
      const first = args[0];
      if (first && typeof first === "object" && (first as { name?: string }).name === "ClerkRuntimeError") return;
      if (typeof first === "string" && first.includes("Clerk")) return;
      if (first && typeof first === "object" && (first as { message?: string }).message?.includes("Publishable key not valid")) return;
      if (typeof first === "string" && first.includes("Publishable key not valid")) return;
      return origError.apply(console, args);
    };

    // 2. Patch console.warn
    const origWarn = console.warn;
    console.warn = function (...args: unknown[]) {
      const first = args[0];
      if (typeof first === "string" && first.includes("non-static position")) return;
      if (typeof first === "string" && first.includes("has been deprecated")) return;
      return origWarn.apply(console, args);
    };

    // 3. Catch unhandled promise rejections
    const rejectionHandler = (e: PromiseRejectionEvent) => {
      const reason = e.reason;
      if (reason?.name === "ClerkRuntimeError" ||
        (reason?.message && reason.message.includes("Clerk"))) {
        e.preventDefault();
      }
    };
    window.addEventListener("unhandledrejection", rejectionHandler);

    // 4. Catch window errors before Next.js dev overlay
    const errorHandler = (e: ErrorEvent) => {
      if (e.message?.includes("Clerk") || e.message?.includes("clerk")) {
        e.preventDefault();
        e.stopImmediatePropagation();
        return true;
      }
    };
    window.addEventListener("error", errorHandler, true);

    return () => {
      window.removeEventListener("unhandledrejection", rejectionHandler);
      window.removeEventListener("error", errorHandler, true);
    };
  }, []);
}

export function SafeClerkProvider({ children }: { children: React.ReactNode }) {
  useSuppressExternalErrors();

  return (
    <ClerkSafetyBoundary>
      <ClerkProvider>
        {children}
      </ClerkProvider>
    </ClerkSafetyBoundary>
  );
}

class ClerkSafetyBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  componentDidCatch() {
    // Silently handled — Clerk unavailable, app continues without auth
  }

  render() {
    if (this.state.hasError) {
      return <>{this.props.children}</>;
    }
    return this.props.children;
  }
}
