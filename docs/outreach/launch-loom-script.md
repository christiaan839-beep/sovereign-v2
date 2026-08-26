# 90-second Loom script — VAOS live demo

Record this ONCE. Embed on the homepage. Link in every cold email,
every partnership pitch, every standards-body submission. Single
highest-leverage marketing asset on the platform.

**Format:** screen + face. Loom or similar. 1080p ok, 720p fine.
No editing needed — single take. ≤ 90 seconds.

---

## What to show on screen + what to say

| Time | Screen                                                           | Voice-over (read this exactly or close to it)                                                                                                                                                                                                                                       |
| ---- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0:00 | Your face.                                                       | "Hi, I'm [NAME], building Sovereign Matrix. In ninety seconds, here's a verifiable AI receipt system — signed, replayable, and checkable without trusting us."                                                                                                                                     |
| 0:08 | Switch to `sovereignmatrix.agency` homepage.                     | "Most agent platforms can't prove what their AI did. That's why every compliance team blocks them. We fix that with one primitive — every agent run produces a cryptographically signed receipt."                                                                                   |
| 0:20 | Click "See it live" → `/verified` page.                          | "This is the live demo. The badge you see below is the real script running against our actual database. It pulled a real signed receipt from a real agent run, and verified the HMAC signature in real time."                                                                       |
| 0:32 | Click the badge → `/r/[id]` page opens.                          | "Here's the receipt. Agent name, model used, input, output, safety check results, HMAC-SHA256 signature. Click 'Verify' or POST this signature to /api/verify and anyone — your auditor, your customer, a regulator — can confirm it's authentic. Without us. Without our API key." |
| 0:50 | Scroll to the signature panel + canonical projection.            | "The canonical projection is byte-deterministic. The signature is constant-time verified. Tamper one character of any field and the signature breaks."                                                                                                                              |
| 1:02 | Back to `/spec` page.                                            | "The format is open. VAOS one-point-oh. Public domain spec, MIT-licensed reference verifier, published today. Any platform, any auditor, any compliance tool can adopt it. We built the reference implementation; we didn't lock the format."                                       |
| 1:18 | Show the npm install command on /spec OR show the README.        | "Three lines of code to verify any receipt. Zero dependencies. Works in Node, browsers, edge runtimes. Pair it with the embed badge for your customer-facing pages and they see a Verified-by-Sovereign chip with every AI output."                                                 |
| 1:30 | End frame: "sovereignmatrix.agency/verified" with calendar link. | "Twenty-minute demo at sovereignmatrix-dot-agency-slash-verified. Or reply to this Loom — first ten compliance-conscious teams get a free signing key and migration help."                                                                                                          |

---

## Production notes

- **Don't read this verbatim.** Internalize the beats then talk
  naturally. Stiff = doesn't convert.
- **One take.** Editing makes you sound less human and Loom's value
  is that you sound human.
- **No music, no intro card.** They eat 5–8 seconds and conversion
  drops linearly with intro length.
- **Show your face for at least the first 5 seconds.** Trust signal.
- **End on a clear CTA.** "Reply to this Loom" works better than
  "book a meeting" for cold outbound.

## After recording

1. Title: `90s · How Sovereign verifies every AI output`
2. Description: `Live demo of VAOS 1.0 — the open standard for verifiable AI agent receipts. /verified, /spec, npm verifier.`
3. Settings: shareable link, no password.
4. Embed on `/` (above the fold), `/verified` (replacing the live
   badge demo's caption), `/spec` (in the hero).
5. Send to the first 10 prospects same day. Track opens and replies
   in a spreadsheet (Loom shows view stats per link).

## Success metric (first 14 days)

- **≥30 views** from cold-outreach links = adequate
- **≥5 replies** = the wedge is real, double down
- **≥1 demo booked** = ship the launch press release
- **0 replies after 50 sends** = pivot the ICP or the pitch
