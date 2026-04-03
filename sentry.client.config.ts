import * as Sentry from "@sentry/nextjs";

// Only initialize Sentry if DSN is configured
if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

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
