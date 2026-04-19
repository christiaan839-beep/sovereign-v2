"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";

/**
 * useAgentRun — one consistent way to invoke an agent endpoint.
 *
 * Every dashboard page in the product was handling fetch errors differently:
 * some showed spinners forever, some silently swallowed, some threw raw
 * JSON errors at the user. This hook standardizes the behavior so users
 * always know what happened.
 *
 * Responses it handles:
 *   - 200       → returns data, no toast
 *   - 401/403   → redirects to /login with a return URL
 *   - 429       → toast with upgrade CTA (plan limit)
 *   - 503       → toast "service unavailable — try again" (plan enforcer
 *                 fails closed when DB is down)
 *   - 5xx       → toast with the agent's error message if available,
 *                 otherwise a generic "Agent failed. Try again."
 *   - Network   → toast "lost connection — check your network"
 *
 * Usage:
 *   const { run, loading, error } = useAgentRun<LeadReport>("/api/agents/leads");
 *   const data = await run({ niche: "roofing", location: "Austin" });
 */

export interface AgentRunOptions {
  /** Agent endpoint path, e.g. "/api/agents/leads" */
  endpoint: string;
  /** Optional success message shown as a toast */
  successMessage?: string;
  /** Suppress the error toast — useful if the caller wants to render
   *  the error inline instead. */
  silent?: boolean;
  /** Request timeout in ms. Default: 60_000 (matches Vercel's default
   *  serverless function limit). Agents that stream or are known to
   *  exceed this should pass a larger value explicitly. */
  timeoutMs?: number;
}

interface AgentRunResult<T> {
  run: (body?: unknown) => Promise<T | null>;
  loading: boolean;
  error: string | null;
}

export function useAgentRun<T = unknown>(opts: AgentRunOptions | string): AgentRunResult<T> {
  const toast = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const endpoint = typeof opts === "string" ? opts : opts.endpoint;
  const silent = typeof opts === "string" ? false : opts.silent === true;
  const successMessage = typeof opts === "string" ? undefined : opts.successMessage;
  const timeoutMs = typeof opts === "string" ? 60_000 : opts.timeoutMs ?? 60_000;

  const run = useCallback(
    async (body?: unknown): Promise<T | null> => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body ?? {}),
          // Abort the request after timeoutMs so users never stare at
          // a spinner forever when the upstream agent hangs.
          signal: AbortSignal.timeout(timeoutMs),
        });

        // Auth — redirect to login preserving return URL
        if (res.status === 401 || res.status === 403) {
          const returnTo = typeof window !== "undefined" ? window.location.pathname : "/";
          router.push(`/login?redirect_url=${encodeURIComponent(returnTo)}`);
          return null;
        }

        // Parse the body even on error — agent routes return structured errors
        const data = await res.json().catch(() => ({} as Record<string, unknown>));

        // Plan limit — show upgrade toast
        if (res.status === 429) {
          const msg = (data as { error?: string; message?: string }).error
            || (data as { message?: string }).message
            || "You've hit your monthly plan limit.";
          const upgradeUrl = (data as { upgradeUrl?: string }).upgradeUrl ?? "/pricing";
          if (!silent) {
            toast.result("error", msg, upgradeUrl);
          }
          setError(msg);
          return null;
        }

        // Service unavailable — plan enforcer fail-closed path
        if (res.status === 503) {
          const msg = "Service is temporarily unavailable. Please try again in a moment.";
          if (!silent) toast.error(msg);
          setError(msg);
          return null;
        }

        // Any other non-OK — surface the specific error if present
        if (!res.ok) {
          const msg = (data as { error?: string; message?: string }).error
            || (data as { message?: string }).message
            || `Agent failed (${res.status}). Try again.`;
          if (!silent) toast.error(msg);
          setError(msg);
          return null;
        }

        // Success
        if (successMessage && !silent) toast.success(successMessage);
        return data as T;
      } catch (err) {
        // AbortSignal.timeout throws DOMException with name="TimeoutError";
        // AbortController.abort() throws name="AbortError".
        const isTimeout = err instanceof DOMException && err.name === "TimeoutError";
        const isAbort = err instanceof DOMException && err.name === "AbortError";

        const msg = isTimeout
          ? `Request timed out after ${Math.round(timeoutMs / 1000)}s. Try again.`
          : isAbort
            ? "Request cancelled."
            : err instanceof TypeError
              ? "Lost connection — check your network and try again."
              : err instanceof Error
                ? err.message
                : "Something went wrong.";

        if (!silent) toast.error(msg);
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [endpoint, silent, successMessage, router, toast],
  );

  return { run, loading, error };
}
