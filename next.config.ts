import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
  // Standalone output for Docker/Railway — Vercel injects VERCEL=1 automatically
  // so this activates only for self-hosted deployments.
  output: process.env.VERCEL ? undefined : "standalone",

  // Allow build to proceed despite pre-existing strict-TS errors in legacy
  // agent routes under src/app/api/_agents/*. The CI workflow runs
  // `npm run typecheck` as an informational step so the residual error
  // count stays visible. Target: drive count to zero, then flip to false.
  // Run `npm run typecheck` locally to see the current error list.
  // Strict TypeScript ON — every error knocked down or `@ts-expect-error`'d
  // with a concrete reason in this branch (audit-2026-05).
  typescript: { ignoreBuildErrors: false },

  // Keep Node.js-only packages out of client/edge bundles
  serverExternalPackages: [
    "@pinecone-database/pinecone",
    "twilio",
    "drizzle-orm",
    "@neondatabase/serverless",
    "nodemailer",
  ],

  // Performance: compress responses
  compress: true,

  // Security: don't leak framework version in response headers
  poweredByHeader: false,

  // Image optimization for external domains
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "**.googleusercontent.com" },
      { protocol: "https", hostname: "**.clerk.com" },
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "**.nvidia.com" },
      { protocol: "https", hostname: "**.googleapis.com" },
      // White-label portal: agency logos from common storage providers
      { protocol: "https", hostname: "**.amazonaws.com" },
      { protocol: "https", hostname: "**.cloudinary.com" },
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "**.vercel-storage.com" },
      { protocol: "https", hostname: "**.blob.core.windows.net" },
    ],
  },

  // Experimental performance features
  experimental: {
    // Allow build to continue when prerendering fails (Next.js 16 + React 19 _global-error issue)
    prerenderEarlyExit: false,
  },

  // Security headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains; preload",
          },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(self), interest-cohort=()",
          },
          // Cross-origin isolation — pairs with the receipts-spec
          // promise that visitor verification runs without leaking
          // state to embedded third-party frames. Cook 182.
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin",
          },
          {
            key: "Cross-Origin-Resource-Policy",
            value: "same-site",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              // 'unsafe-eval' removed (Cook 182) — modern Next.js + Clerk do
              // not require eval(). 'unsafe-inline' kept until the nonce
              // middleware ships in a follow-up (would touch every
              // server-component render). PayPal checkout is a full-page
              // redirect, so it needs no script/frame allowance here.
              "script-src 'self' 'unsafe-inline' https://challenges.cloudflare.com https://plausible.io https://*.clerk.com https://*.clerk.accounts.dev https://va.vercel-scripts.com",
              // fonts.googleapis.com serves the brand-font stylesheet the
              // root layout loads (<link rel="stylesheet">). Without it
              // here the CSP blocks the stylesheet and every custom font
              // falls back to system defaults in production.
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: https: blob:",
              // fonts.gstatic.com serves the actual .woff2 files the above
              // stylesheet @font-face-references.
              "font-src 'self' data: https://fonts.gstatic.com",
              "connect-src 'self' https: wss:",
              "frame-src 'self' https://challenges.cloudflare.com https://*.clerk.com https://*.clerk.accounts.dev",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
              "upgrade-insecure-requests",
              "report-uri /api/_security/csp-report",
            ].join("; "),
          },
        ],
      },
      // The badge/embed endpoints exist to be loaded cross-origin from
      // customers' sites (<script src=".../badge/embed.js">, the
      // /badge/ping image beacon, /embed/verify.js). The global
      // Cross-Origin-Resource-Policy: same-site above blocks no-cors
      // cross-origin loads, killing the free-distribution badge — these
      // later, more-specific entries override CORP to cross-origin
      // (BACKLOG corp-badge).
      {
        source: "/badge/:path*",
        headers: [
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
      {
        source: "/embed/:path*",
        headers: [
          { key: "Cross-Origin-Resource-Policy", value: "cross-origin" },
        ],
      },
    ];
  },

  // Rewrites for white-label subdomain + portal routing
  async rewrites() {
    return [
      {
        source: "/client/:clientId/:path*",
        destination: "/portal/:clientId/:path*",
      },
      // White-label portal: /portal/d/:domain is the real route,
      // but external URLs can use /wl/:domain for a cleaner look.
      {
        source: "/wl/:domain/:path*",
        destination: "/portal/d/:domain/:path*",
      },
      {
        source: "/wl/:domain",
        destination: "/portal/d/:domain",
      },
    ];
  },

  // Redirects for previously-referenced marketing / dashboard routes
  // that never got their own page. Better to send the visitor to the
  // nearest equivalent than to render a 404. When we ship a dedicated
  // page for any of these, delete the corresponding entry.
  async redirects() {
    return [
      // Marketing aliases
      { source: "/platform", destination: "/marketplace", permanent: false },
      { source: "/customers", destination: "/case-studies", permanent: false },
      { source: "/sign-up", destination: "/signup", permanent: true },
      // Dashboard aliases
      {
        source: "/dashboard/agents/new",
        destination: "/dashboard/agent-builder",
        permanent: false,
      },
      {
        source: "/dashboard/blog-gen",
        destination: "/dashboard/content-factory",
        permanent: false,
      },
      {
        source: "/dashboard/nexus",
        destination: "/dashboard",
        permanent: false,
      },
    ];
  },
};

/**
 * Sentry — wrap the Next config to enable source map upload + release
 * tagging on every build. The plugin is a no-op when SENTRY_AUTH_TOKEN,
 * SENTRY_ORG, or SENTRY_PROJECT aren't set, so local + CI builds without
 * Sentry credentials still work.
 *
 * Required env vars (set in Vercel for the plugin to upload source maps):
 *   - SENTRY_AUTH_TOKEN  (Sentry → Settings → Auth Tokens)
 *   - SENTRY_ORG         (your Sentry org slug)
 *   - SENTRY_PROJECT     (e.g. "sovereign-matrix")
 *
 * Vercel injects VERCEL_GIT_COMMIT_SHA automatically — that becomes the
 * release name (matched by sentry.client/server/edge.config.ts).
 */
const sentryEnabled = !!(
  process.env.SENTRY_AUTH_TOKEN &&
  process.env.SENTRY_ORG &&
  process.env.SENTRY_PROJECT
);

export default sentryEnabled
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      // Suppress build-time noise; route through Vercel/CI logs instead.
      silent: true,
      // Upload source maps but don't expose them publicly — only Sentry
      // gets them, the bundle ships with `//# sourceMappingURL` stripped.
      sourcemaps: { disable: false, deleteSourcemapsAfterUpload: true },
      // Tunnel client-side errors through a local route to bypass ad blockers.
      tunnelRoute: "/monitoring",
      // Use the Vercel commit SHA as the release name (sentry.config.ts
      // files read the same env var so they line up).
      release: {
        name: process.env.SENTRY_RELEASE ?? process.env.VERCEL_GIT_COMMIT_SHA,
      },
      // Don't widen the build envelope with telemetry uploads.
      widenClientFileUpload: false,
    })
  : nextConfig;
