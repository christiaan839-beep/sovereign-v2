import * as Sentry from "@sentry/nextjs";

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
    enabled: process.env.NODE_ENV === "production",

    // Tag every event with the deploy version so we can find regressions
    // to the release they shipped with.
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    environment: process.env.VERCEL_ENV || process.env.NODE_ENV,

    // Filter out expected failures we don't want pages for.
    ignoreErrors: [
      // Upstream provider rate-limit failures — user sees a clean retry UX,
      // no need to page on-call.
      /rate limit/i,
      // Clerk's webhook signature rejection is a security signal but not
      // an error we need to wake someone up for.
      "Invalid signature",
      // Plan-limit 429s are business logic, not bugs.
      "plan limit reached",
    ],

    // Scrub PII from captured events before they leave our server.
    beforeSend(event) {
      // Never forward Authorization headers or cookie values.
      if (event.request?.headers) {
        const headers = event.request.headers as Record<string, string>;
        delete headers.authorization;
        delete headers.cookie;
        delete headers["x-api-key"];
      }
      // Clerk session tokens can end up in query strings — strip them.
      if (event.request?.query_string && typeof event.request.query_string === "string") {
        event.request.query_string = event.request.query_string
          .replace(/__session=[^&]*/g, "__session=<redacted>");
      }
      return event;
    },
  });
}
