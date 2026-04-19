# Third-Party Licenses

Sovereign Matrix is built on open-source software. This document
acknowledges the key projects we depend on and their licenses.

A complete, machine-readable dependency list is available in
`package.json` and `package-lock.json`. For any specific license text,
see `node_modules/<package>/LICENSE` after install.

## How to audit licenses yourself

```bash
# All direct and transitive dependencies with their licenses
npx license-checker --summary

# Focus on any non-MIT/ISC dependencies
npx license-checker --summary --excludePackages-startingWith MIT
```

---

## Major projects

### Framework & runtime

- **Next.js** — MIT — https://github.com/vercel/next.js
- **React** — MIT — https://github.com/facebook/react
- **TypeScript** — Apache 2.0 — https://github.com/microsoft/TypeScript

### Auth + data

- **Clerk (@clerk/nextjs)** — MIT — https://github.com/clerk/javascript
- **Drizzle ORM** — Apache 2.0 — https://github.com/drizzle-team/drizzle-orm
- **Neon serverless driver** — Apache 2.0 — https://github.com/neondatabase/serverless

### AI providers

- **@anthropic-ai/sdk** — MIT — https://github.com/anthropics/anthropic-sdk-typescript
- **@google/generative-ai** — Apache 2.0 — https://github.com/google/generative-ai-js
- **groq-sdk** — MIT — https://github.com/groq/groq-typescript
- **@tavily/core** — MIT — https://github.com/tavily-ai/tavily-js

### Infra + observability

- **@upstash/redis, @upstash/ratelimit** — MIT — https://github.com/upstash
- **@sentry/nextjs** — MIT — https://github.com/getsentry/sentry-javascript
- **stripe** — MIT — https://github.com/stripe/stripe-node

### UI

- **Tailwind CSS** — MIT — https://github.com/tailwindlabs/tailwindcss
- **Framer Motion** — MIT — https://github.com/framer/motion
- **Lucide icons** — ISC — https://github.com/lucide-icons/lucide
- **@xyflow/react** (React Flow) — MIT — https://github.com/xyflow/xyflow

### Fonts

- **Instrument Serif** — SIL Open Font License 1.1 — https://fonts.google.com/specimen/Instrument+Serif
- **Inter Tight** — SIL Open Font License 1.1 — https://fonts.google.com/specimen/Inter+Tight
- **JetBrains Mono** — SIL Open Font License 1.1 — https://fonts.google.com/specimen/JetBrains+Mono
- **Outfit, Cormorant Garamond** — SIL Open Font License 1.1

All fonts are loaded via Google Fonts' CDN, which handles delivery
under the OFL terms.

---

## Copyleft check

We do not directly depend on any GPL, AGPL, or SSPL-licensed
dependencies. If a future transitive dependency introduces a copyleft
license, it will show up in `npx license-checker --summary` and must
be either vendored under its terms or replaced.

---

## Attribution

If you find a dependency we're using that isn't acknowledged here,
please open an issue or email legal@sovereignmatrix.agency and we'll
correct this file.

*Last reviewed: April 19, 2026.*
