import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone output for Docker/Railway — Vercel injects VERCEL=1 automatically
  // so this activates only for self-hosted deployments.
  output: process.env.VERCEL ? undefined : "standalone",

  // Allow build to proceed despite pre-existing strict-TS errors in legacy
  // agent routes under src/app/api/_agents/*. The CI workflow runs
  // `npm run typecheck` as an informational step so the residual error
  // count stays visible. Target: drive count to zero, then flip to false.
  // Run `npm run typecheck` locally to see the current error list.
  typescript: { ignoreBuildErrors: true },

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
      { protocol: "https", hostname: "**.stripe.com" },
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
            value: "camera=(), microphone=(), geolocation=(self)",
          },
          {
            key: "Content-Security-Policy",
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://js.stripe.com https://challenges.cloudflare.com https://plausible.io https://*.clerk.com https://*.clerk.accounts.dev https://va.vercel-scripts.com",
              "style-src 'self' 'unsafe-inline'",
              "img-src 'self' data: https: blob:",
              "font-src 'self' data:",
              "connect-src 'self' https: wss:",
              "frame-src 'self' https://js.stripe.com https://challenges.cloudflare.com https://*.clerk.com https://*.clerk.accounts.dev",
              "frame-ancestors 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "object-src 'none'",
              "upgrade-insecure-requests",
            ].join("; "),
          },
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
};

export default nextConfig;
