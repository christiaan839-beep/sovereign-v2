# Launch Checklist — Distribution-ready in 7 days

Today (2026-05-19) to launch (target: 2026-05-26). Owner column is empty
because the operator (Christiaan) does every external action — Claude
prepares the artifacts but cannot publish, post, or sign on the operator's
behalf.

## Day 0 — Today (pre-flight)

| Item                                                                 | Done | Owner | Notes                                                                   |
| -------------------------------------------------------------------- | ---- | ----- | ----------------------------------------------------------------------- |
| Verify `scripts/publish-all.sh --dry-run` reports 7 OK packages      | ✅   |       | Re-run any time: `./scripts/publish-all.sh --dry-run`                   |
| `/compliance/annex-iv` returns 200 OK on prod                        | ⏳   |       | Will go live with this commit                                           |
| `/compliance/iso-42001` returns 200 OK on prod                       | ⏳   |       | Will go live with this commit                                           |
| `/api/health/ping` returns 200 (DB connection works on Node runtime) | ⏳   |       | Edge-runtime gotcha fixed this commit                                   |
| GitHub repo set to public (`christiaan839-beep/sovereign-v2`)        | ⬜   |       | Currently private. Settings → General → Danger Zone → Change Visibility |
| Repo README polished for first-impression                            | ⬜   |       | Recommend a 30-line "what + why + install" version at the root          |

## Day 1 — Publish the 8 npm packages

| Item                                                              | Done | Owner | Notes                                                              |
| ----------------------------------------------------------------- | ---- | ----- | ------------------------------------------------------------------ |
| `npm login` as the @sovereign-matrix org owner                    | ⬜   |       |                                                                    |
| Confirm `npm org ls sovereign-matrix` shows you with "owner" role | ⬜   |       | If org doesn't exist: `npm org create sovereign-matrix`            |
| Enable 2FA on the npm account (required for publishing public)    | ⬜   |       | Account → Settings → Two-Factor Authentication                     |
| Run `./scripts/publish-all.sh` (interactive — confirms before)    | ⬜   |       | The script publishes verifiable-receipts FIRST (peer-dep ordering) |
| Spot-check each package on npm                                    | ⬜   |       | `npm view @sovereign-matrix/iso-42001 version` etc.                |
| Open the npm org page in incognito to verify discovery            | ⬜   |       | https://www.npmjs.com/org/sovereign-matrix                         |

## Day 2 — Public repo + docs

| Item                                                          | Done | Owner | Notes                                                                                               |
| ------------------------------------------------------------- | ---- | ----- | --------------------------------------------------------------------------------------------------- |
| Repo public                                                   | ⬜   |       |                                                                                                     |
| Repo description set to a tight one-liner                     | ⬜   |       | Suggest: "Apache 2.0 verifiable AI receipts. EU AI Act + ISO 42001 exporters. Post-quantum-signed." |
| Repo topics added                                             | ⬜   |       | `ai-governance`, `eu-ai-act`, `iso-42001`, `vaos`, `post-quantum`, `compliance`                     |
| GitHub Actions secrets unaffected by visibility flip          | ⬜   |       | Sanity check: trigger a fresh CI run                                                                |
| GitHub Pages or Mintlify docs site planned (optional, Day 4+) | ⬜   |       | nextra in `apps/docs/` is the natural location                                                      |

## Day 3 — Partnership outreach

The 5 sender-ready briefs at `docs/partnerships/` are already drafted.
Send them on the same day, all five, before any HN post:

| Partner   | Email                            | Brief                            | Sent? |
| --------- | -------------------------------- | -------------------------------- | ----- |
| Anthropic | partnerships@anthropic.com       | `docs/partnerships/anthropic.md` | ⬜    |
| NVIDIA    | partnerships@nvidia.com          | `docs/partnerships/nvidia.md`    | ⬜    |
| Google    | (per the brief — Cloud / Gemini) | `docs/partnerships/google.md`    | ⬜    |
| OpenAI    | partnerships@openai.com          | `docs/partnerships/openai.md`    | ⬜    |
| NIST      | (per the brief — AI RMF program) | `docs/partnerships/nist.md`      | ⬜    |

## Day 4 — Design-partner outreach

Sending the same day as HN gives no time to react. Send design-partner
outreach 24-48 hours BEFORE HN so 1-2 design partners are already in
conversation when the front-page splash hits:

| Vertical         | Suggested first-contact                            | Done? |
| ---------------- | -------------------------------------------------- | ----- |
| Healthcare       | A regional health system, not a giant; CTO direct  | ⬜    |
| Banking          | A challenger bank — easier to move than a SIFI     | ⬜    |
| Insurance        | An AI-E&O carrier — they're hunting signals        | ⬜    |
| Legal            | A mid-size litigation firm rolling out AI tooling  | ⬜    |
| EU public sector | The EU AI Office hotline + the AI Act Service Desk | ⬜    |

## Day 5 — Show HN

| Item                                                            | Done | Owner | Notes                                                                  |
| --------------------------------------------------------------- | ---- | ----- | ---------------------------------------------------------------------- |
| Re-confirm all packages on npm + both `/compliance/*` pages 200 | ⬜   |       | A 404 during the splash kills 90% of conversion                        |
| Post to HN at 09:00 ET (Tuesday-Thursday)                       | ⬜   |       | Variant A (regulatory framing) is primary — see SHOW-HN.md             |
| Mirror to Lobste.rs (if invite available)                       | ⬜   |       |                                                                        |
| Mirror to r/MachineLearning, r/cryptography, r/programming      | ⬜   |       | r/cryptography is the most receptive to the post-quantum angle         |
| Stay engaged 4+ hours after posting                             | ⬜   |       | Reply within 2-3 minutes of new comments — this is where ranking lives |

## Day 6-7 — Conversion + follow-up

| Item                                                         | Done | Owner | Notes                                                                    |
| ------------------------------------------------------------ | ---- | ----- | ------------------------------------------------------------------------ |
| Reach out to anyone who starred the repo                     | ⬜   |       | Filter by company email domain — `@bank.com`, `@hospital.org`, `@gov.eu` |
| Schedule design-partner intro calls for the 3-5 best replies | ⬜   |       | 15-minute Cal.com booking links work; don't ask for a full hour first    |
| Apply for relevant inclusion lists                           | ⬜   |       | OpenSSF, ai-safety.directory, eu-ai-act.directory if any                 |
| Submit the IETF Internet-Draft for VAOS                      | ⬜   |       | `docs/specs/ietf-draft-vaos-00.md` is sender-ready                       |

## Risks worth pre-mortem'ing

1. **npm publish fails with E403 on 2FA** — most common cause is the publishConfig.access being wrong. We've set `access: "public"` on every package.json. If it still fails, run `npm publish --access public` explicitly.

2. **HN gets the post but the GitHub repo 404s** — flipping repo to public DURING the splash is the worst possible time. Do Day 2 BEFORE Day 5.

3. **Vercel bandwidth pegs to free-tier ceiling** — landing page is ~500KB; 200k front-page-of-HN page loads fits inside 100GB/mo. If we got 10× that, upgrade to Vercel Pro mid-flight ($20/mo). Not blocking pre-launch.

4. **An EU AI Act enforcement action happens during launch week** — possible upside not downside. Have a Tweet drafted: "We shipped this 90 days ago" + link.

5. **Anthropic / OpenAI / Google object to the wrapper packages** — extraordinarily unlikely (these are thin Apache-2.0 wrappers around their official SDKs that strictly add behaviour, never modify it). If anyone does send a takedown demand, the wire-format design was specifically built so the wrappers stand on their own — we can remove their name from package descriptions if pressed.

## Single-pane-of-glass commands

```bash
# Verify everything is publish-ready (no actual publishing):
./scripts/publish-all.sh --dry-run

# Build all wrapper dists:
for pkg in openai-receipts anthropic-receipts google-receipts ai-sdk-receipts annex-iv iso-42001; do
  (cd packages/$pkg && npm run build)
done

# Confirm prod is serving the new preview pages:
curl -sS -o /dev/null -w "annex-iv → %{http_code}\n" https://sovereignmatrix.agency/compliance/annex-iv
curl -sS -o /dev/null -w "iso-42001 → %{http_code}\n" https://sovereignmatrix.agency/compliance/iso-42001
curl -sS -o /dev/null -w "/api/health/ping → %{http_code}\n" https://sovereignmatrix.agency/api/health/ping
```
