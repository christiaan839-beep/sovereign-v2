"use client";

import { useState, useEffect } from "react";

const STORAGE_KEY = "sovereign_cookie_consent";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem(STORAGE_KEY);
    if (!consent) {
      setVisible(true);
    }
  }, []);

  function handleAccept() {
    localStorage.setItem(STORAGE_KEY, "accepted");
    setVisible(false);
  }

  function handleReject() {
    localStorage.setItem(STORAGE_KEY, "rejected");
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9999] p-4">
      <div className="max-w-2xl mx-auto rounded-xl border border-white/10 bg-black/80 backdrop-blur-xl px-6 py-4 flex flex-col sm:flex-row items-center gap-4 shadow-2xl">
        <p className="text-sm text-neutral-400 flex-1">
          We use cookies for authentication and analytics. No tracking cookies
          are used without your consent.{" "}
          <a
            href="/privacy"
            className="text-emerald-400 hover:underline"
          >
            Privacy Policy
          </a>
        </p>
        <div className="flex gap-3 shrink-0">
          <button
            onClick={handleReject}
            className="px-4 py-2 text-xs uppercase tracking-widest text-neutral-400 hover:text-white border border-white/10 rounded-lg transition-colors cursor-pointer"
          >
            Reject
          </button>
          <button
            onClick={handleAccept}
            className="px-4 py-2 text-xs uppercase tracking-widest text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors cursor-pointer"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
