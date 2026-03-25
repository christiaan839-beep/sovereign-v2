"use client";

import React from "react";

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Error boundary specifically for Clerk auth provider.
 * If Clerk JS fails to load (network issue, misconfigured key, etc.),
 * this catches the error and renders a fallback instead of a blank page.
 */
export class ClerkErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    // Only log Clerk-specific errors, don't spam console
    if (error.message?.includes("Clerk") || error.name?.includes("Clerk")) {
      console.warn("[Sovereign] Clerk failed to load — running in offline mode.", error.message);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <html lang="en">
          <body className="bg-[#050505] text-white antialiased min-h-screen flex items-center justify-center">
            <div className="text-center px-6 max-w-md">
              <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl">🔒</span>
              </div>
              <h1 className="text-xl font-semibold mb-2">Authentication Loading</h1>
              <p className="text-sm text-neutral-400 mb-6">
                The authentication service is taking longer than usual. This typically resolves in a few seconds.
              </p>
              <button
                onClick={() => window.location.reload()}
                className="px-6 py-2.5 rounded-xl bg-[#00B7FF] text-white text-sm font-medium hover:bg-[#33C5FF] transition-colors"
              >
                Retry
              </button>
              <p className="text-[10px] text-neutral-600 mt-4">
                If this persists, check your internet connection or contact support.
              </p>
            </div>
          </body>
        </html>
      );
    }

    return this.props.children;
  }
}
