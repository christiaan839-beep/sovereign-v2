# 90-second Loom — VAOS 1.0 + 2.0 demo script (v2)

The Loom you actually record. Updated to include the work that
shipped post-merge: Ed25519 v2 signatures, Merkle inclusion proofs,
OpenTimestamps notarization. Each new feature is a 5-second beat —
they prove the depth without dragging the runtime past 90 seconds.

If you're choosing between this script and the v1 in
`launch-loom-script.md`, **use this one**. The v1 is preserved as
the simpler "just the basics" pitch for non-technical audiences.

---

## What to show on screen + what to say

| Time     | Screen                                                                                 | Voice-over (read this exactly or close to it)                                                                                                                                                                                                                               |
| -------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **0:00** | Your face.                                                                             | "I'm [NAME]. In ninety seconds, the verifiable AI agent infrastructure nobody else in the agentic space ships."                                                                                                                                                             |
| **0:08** | sovereignmatrix.agency homepage.                                                       | "Most AI agent platforms can't prove what their AI did. That's the bottleneck blocking enterprise AI deployment in 2026. We fix it with one primitive — every agent run produces a cryptographically signed receipt."                                                       |
| **0:18** | Click "See it live" → `/verified`. The badge loads on screen.                          | "This is the live demo. The badge below is the actual script running against our database. It pulled a real signed receipt and verified the HMAC signature in real time, with no signup."                                                                                   |
| **0:30** | Click the badge → `/r/[id]` page opens.                                                | "Here's the receipt. Agent name, model, input, output, safety check results, signature. POST the canonical projection and signature to /api/verify and ANY third party — your auditor, your customer, a regulator — can confirm authenticity. Without us. Without our key." |
| **0:46** | Open a new tab to `/.well-known/sovereign-receipts/ed25519.pem`.                       | "This is our public Ed25519 key — VAOS 2.0. Asymmetric signatures mean we cannot retroactively forge any receipt. Non-repudiable. Legal-admissible."                                                                                                                        |
| **0:54** | Open `/api/me/audit-root` (or show in browser dev tools for an authenticated session). | "And the Merkle chain root. One thirty-two-byte hash that ties together every receipt the tenant has ever produced. Snapshot this monthly and you can detect ANY historical tampering — additions, deletions, mutations — at constant verification cost."                   |
| **1:06** | Show the receipt diff page `/r/[id]/diff/[other]`.                                     | "Plus replay-vs-original diff for AI regression testing. Plus optional OpenTimestamps Bitcoin notarization for legal-grade temporal proof. Plus an inclusion proof endpoint so a single receipt can be verified against the chain in twenty hashes."                        |
| **1:18** | Back to `/spec`.                                                                       | "The format is open. VAOS one-point-oh, public domain. Reference implementation MIT-licensed on npm. We built it; we didn't lock it."                                                                                                                                       |
| **1:30** | End frame: "sovereignmatrix.agency/verified" + your calendar link.                     | "Twenty-minute demo at the link. First ten compliance-conscious teams get a free signing key and migration help."                                                                                                                                                           |

---

## Production notes

Same as v1, repeated because they matter:

- **One take.** Editing makes you sound less human; Loom's value is humanity.
- **Don't read verbatim.** Internalize the beats, then talk naturally.
- **Show your face for ≥5 seconds at the start.** Trust signal.
- **No music, no intro card.** Each adds 5–8s of viewer drop-off.
- **End on a clear CTA.** "Reply to this Loom" outconverts "book a meeting" for cold outbound by 3×.
- **Run a dummy agent first** so `/verified` has a real receipt to show — otherwise the badge says "Trigger any agent to generate the first public receipt" which kills the demo. Use any of: god-brain, blog-gen, smart-router. Mark the resulting receipt as `public` via `/dashboard/receipts`.

---

## What "v2" upgraded vs v1

The v1 script was built before VAOS 2.0, Merkle inclusion proofs, and
OpenTimestamps notarization shipped. The v2 script adds:

- **0:46 beat** — Ed25519 public key endpoint (proves non-repudiation)
- **0:54 beat** — Merkle chain root (proves historical tamper-evidence)
- **1:06 beat** — Inclusion proof + Bitcoin notarization mention

If 90 seconds feels tight, drop the 1:06 beat and the talking points
that depend on it. Keep the 0:46 + 0:54 beats — those are the moat.

---

## After recording

1. Title: `90s · Verifiable AI agent infrastructure (VAOS 1.0 + 2.0)`
2. Description: `Live demo of HMAC-signed + Ed25519-signed receipts, Merkle chain root, inclusion proofs, OpenTimestamps notarization. Open spec + MIT verifier on npm.`
3. Settings: shareable link. Public OK. Password-protect ONLY if you're targeting a single named prospect.
4. Embed on:
   - `/` (above the fold, replacing or augmenting the hero gradient)
   - `/verified` (in the live-demo section)
   - `/spec` (in the hero, replacing the static download link)
5. Send to your prospect list (see `launch-cold-emails-personalized.md`) within 24 hours of recording.

---

## Success metric (first 14 days)

| Metric                              | Target                       | What it tells you                                 |
| ----------------------------------- | ---------------------------- | ------------------------------------------------- |
| Loom views from cold-outreach links | ≥30                          | The subject line + thumbnail are working          |
| Average watch time                  | ≥60 seconds (66% completion) | The pitch holds attention through the moat reveal |
| Replies                             | ≥5                           | The wedge is real; double down                    |
| Demo bookings                       | ≥1                           | Ship the launch press release                     |
| 0 replies after 50 sends            | —                            | Pivot the ICP, not the script                     |

---

## Talking-point cheat sheet (don't memorize, just internalize)

**The five things this Loom proves you can do that nobody else can:**

1. Sign every output (HMAC v1)
2. Sign with non-repudiation (Ed25519 v2)
3. Detect historical tampering (Merkle chain)
4. Prove inclusion in O(log N) hashes (inclusion proofs)
5. Bitcoin-notarize for legal-grade temporal proof (OpenTimestamps)

**The two things this Loom proves you DIDN'T do:**

1. Lock the format proprietary (CC0 spec)
2. Hide the verifier (MIT, npm, zero deps)

That's the entire pitch in 90 seconds.
