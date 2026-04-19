# ADR-0002: End-to-end encryption for BYOK customer keys

**Status:** Proposed
**Date:** 2026-04-19
**Deciders:** @christiaandewet (founder)
**Affects:** `src/lib/crypto.ts`, `src/app/dashboard/settings/page.tsx`,
`src/db/schema.ts:settings`, every agent route that reads user keys.

## Context

Today, customer BYOK keys (their Claude / Gemini / NIM / Groq API keys)
are stored encrypted on the server using a symmetric master key
(`ENCRYPTION_SECRET`). That master key lives in Vercel env. Any
operator with access to prod env can decrypt every customer's keys.

That's acceptable for a small platform but it's not acceptable for
enterprise buyers who have compliance requirements (SOC 2, ISO 27001
Annex A.10.1.1). It also creates a single large blast radius if
`ENCRYPTION_SECRET` ever leaks.

## Constraints

- Zero-knowledge is the goal: Sovereign Matrix operators never see
  plaintext customer keys.
- Solo-founder build budget. The design must ship in <4 hours.
- Can't break existing BYOK users — need a migration path.
- Server still needs to USE the keys (call Claude API on the user's
  behalf). This rules out pure client-side encryption with
  user-derived-only keys.

## Decision (pending)

Use **Clerk-session-derived envelope encryption** with per-user data
encryption keys (DEKs).

### How it works

1. User visits Settings → API Keys.
2. Client derives a **user data encryption key** (DEK) in the browser
   via `crypto.subtle.deriveKey` from `{ clerkUserId + sessionSecret }`
   using HKDF-SHA256.
3. Client encrypts the API key (AES-GCM) with the DEK, producing:
     - `ciphertext` (the encrypted key)
     - `iv` (12-byte nonce)
     - `tag` (GCM auth tag)
4. Client sends `{ciphertext, iv, tag}` to `/api/settings/byok/wrap`.
5. Server wraps the DEK using the server's master key (envelope
   encryption) and stores `{ciphertext, iv, tag, wrapped_dek}` in DB.
6. On agent invocation:
     - Server retrieves the row
     - Server unwraps the DEK with its master key
     - Server decrypts the API key with the DEK
     - Server calls Claude/Gemini/etc with the plaintext key
     - Plaintext is never logged; held in memory only for the duration
       of the outbound request

### Why envelope encryption instead of pure client-side

- The server needs the plaintext to call the upstream AI provider.
  Pure client-side encryption with user-only-derived keys would require
  the browser to proxy every agent call, which breaks streaming /
  scheduler / cron.
- Envelope pattern limits blast radius: compromising the server master
  gives you wrapped DEKs only; you'd still need to trick each user into
  re-entering their keys to unwrap.
- Compliance: envelope encryption is the AWS KMS / GCP KMS / Vault
  reference pattern. SOC 2 auditors recognize it.

### Trade-offs

- **UX:** Adds ~200ms of client-side crypto to the Settings save flow.
  Acceptable.
- **Rotation:** Rotating the server master key means unwrap-and-rewrap
  every DEK. Not ideal but cron-scriptable.
- **Compromised-server doesn't decrypt client-resident data, but DOES
  decrypt everything wrapped with that master.** To protect against
  malicious operators, we'd need HSM or KMS — out of scope today.

## Implementation plan

1. `src/lib/byok-crypto.ts` (client-side): `encryptKey(plaintext)` →
   `{ciphertext, iv, tag}`.
2. `src/lib/byok-server.ts` (server-side): `unwrapDek(row)` + `decryptKey(row)`.
3. `drizzle/0006_byok_envelope.sql`: add `wrapped_dek`, `key_version`
   columns to `settings`.
4. `src/app/api/settings/byok/wrap/route.ts`: accepts `{ciphertext, iv,
   tag}` from client, wraps DEK, writes row.
5. `src/app/api/settings/byok/unwrap/route.ts`: for server-side agent
   invocation, returns plaintext in-memory.
6. Migration: on first save-post-deploy, re-encrypt legacy symmetric-
   encrypted rows.

## Status

Scaffolded in commit. Not yet wired through; requires dashboard UI +
agent-side integration. This ADR tracks the design. Next step: ship
`src/lib/byok-crypto.ts` and `drizzle/0006_byok_envelope.sql`.
