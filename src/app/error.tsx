"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[Sovereign Matrix] Page error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#020202] flex items-center justify-center px-6">
      <div className="max-w-md text-center">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center mx-auto mb-6">
          <span className="text-red-400 text-lg font-bold">!</span>
        </div>
        <h2 className="text-xl font-bold text-white mb-3">Something went wrong</h2>
        <p className="text-sm text-neutral-500 mb-8 leading-relaxed">
          An unexpected error occurred. This has been logged automatically.
        </p>
        <button
          onClick={reset}
          className="px-6 py-2.5 bg-white text-black font-semibold rounded-full text-sm hover:bg-neutral-200 transition-colors"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
