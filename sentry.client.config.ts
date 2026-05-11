import * as Sentry from "@sentry/nextjs";

/**
 * Sentry — Browser SDK
 *
 * Releases are tagged so every error in prod links to the exact commit
 * that produced the bundle. The release name MUST match what the
 * Sentry build plugin uploads source maps under (configured in
 * next.config.ts via withSentryConfig).
 */

const RELEASE =
  process.env.NEXT_PUBLIC_SENTRY_RELEASE ??
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ??
  process.env.VERCEL_GIT_COMMIT_SHA ??
  undefined;

const ENVIRONMENT =
  process.env.NEXT_PUBLIC_VERCEL_ENV ??
  process.env.VERCEL_ENV ??
  process.env.NODE_ENV;

// Only initialize Sentry if DSN is configured
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    release: RELEASE,
    environment: ENVIRONMENT,

    // Performance: capture 10% of transactions in production
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,

    // Session replay: capture 1% normally, 100% on errors
    replaysSessionSampleRate: 0.01,
    replaysOnErrorSampleRate: 1.0,

    // Don't send errors in development
    enabled: process.env.NODE_ENV === "production",

    // Filter out noisy errors
    ignoreErrors: [
      "ResizeObserver loop",
      "Non-Error exception captured",
      "Load failed",
      "ChunkLoadError",
    ],
  });
}
