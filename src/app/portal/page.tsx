"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Link2, ArrowRight, ShieldCheck } from "lucide-react";
import { motion } from "framer-motion";

/**
 * /portal — portal link entry.
 *
 * Portal access is via signed links (wave 122): /portal/<clientId>?token=…
 * minted by the agency (POST /api/portal/link) or auto-onboard emails.
 * This page lets a client who has the link in an email paste it here —
 * it navigates to the link's own path on this origin (never a foreign
 * host, so no open redirect). There is no ID/email "login": an
 * identifier without its token renders the access-denied state.
 */
export default function ClientPortalEntry() {
  const [linkValue, setLinkValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleOpen = (e: React.FormEvent) => {
    e.preventDefault();
    const raw = linkValue.trim();
    if (!raw) return;

    // Accept a full URL or a bare /portal/... path; keep only path+query
    // from OUR portal namespace so a pasted foreign URL can't redirect.
    let pathAndQuery: string | null = null;
    try {
      const url = new URL(raw, window.location.origin);
      if (url.pathname.startsWith("/portal/")) {
        pathAndQuery = url.pathname + url.search;
      }
    } catch {
      // Not parseable as a URL at all.
    }

    if (!pathAndQuery) {
      setError(
        "That doesn't look like a portal link. It should start with " +
          "https://…/portal/ — copy the full link from your email.",
      );
      return;
    }

    setError(null);
    router.push(pathAndQuery);
  };

  return (
    <div className="min-h-screen bg-[#030303] flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-emerald-500/8 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-teal-500/5 rounded-full blur-[100px] pointer-events-none" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo & Title */}
        <div className="flex flex-col items-center mb-8">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.2)] mb-6"
          >
            <ShieldCheck className="w-8 h-8 text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold text-white tracking-widest uppercase">
            Client Portal
          </h1>
          <p className="text-neutral-500 text-sm mt-2 text-center max-w-xs">
            Your dashboard is reached through the secure link your agency sent
            you. Paste it below to open it.
          </p>
        </div>

        {/* Link Form */}
        <form
          onSubmit={handleOpen}
          className="backdrop-blur-xl bg-white/[0.03] rounded-2xl p-8 border border-white/[0.06]"
        >
          <div className="space-y-6">
            <div>
              <label
                htmlFor="portal-link"
                className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2"
              >
                Portal link
              </label>
              <div className="relative">
                <Link2 className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-500" />
                <input
                  id="portal-link"
                  type="text"
                  autoComplete="off"
                  value={linkValue}
                  onChange={(e) => setLinkValue(e.target.value)}
                  placeholder="https://…/portal/you?token=…"
                  className="w-full bg-white/[0.03] border border-white/[0.06] rounded-xl pl-12 pr-4 py-4 text-white placeholder:text-neutral-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 focus:border-emerald-500/40 transition-all"
                  required
                />
              </div>
              {error && (
                <p
                  className="text-xs text-amber-400 mt-2 leading-relaxed"
                  role="alert"
                >
                  {error}
                </p>
              )}
            </div>

            <motion.button
              type="submit"
              disabled={!linkValue.trim()}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className="w-full py-4 rounded-xl bg-white text-[#030303] font-bold flex items-center justify-center gap-2 hover:bg-neutral-200 transition-colors disabled:opacity-40 disabled:cursor-not-allowed group"
            >
              Open your dashboard
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </motion.button>

            <p className="text-[11px] text-neutral-500 leading-relaxed text-center">
              Lost your link? Ask your agency to issue a new one — links expire
              for your protection.
            </p>
          </div>
        </form>

        <p className="text-center text-[10px] text-neutral-500 mt-8 uppercase tracking-[0.2em]">
          Powered by Sovereign Autonomous Systems
        </p>
      </motion.div>
    </div>
  );
}
