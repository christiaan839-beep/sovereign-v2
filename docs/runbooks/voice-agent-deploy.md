# Voice Agent — Deployment Runbook (Plan 3)

**Branch:** `claude/wizardly-benz`
**Plan:** `docs/superpowers/plans/2026-04-21-voice-agent.md`
**Commits:** 10 (plan 3.1 → 3.9)
**Tests:** 1477/1477 passing (+72 tests since Plan 2 completion)
**TypeScript:** 0 errors
**Human deploy time:** ~35 minutes (Railway voice-ws deploy + env sync)

---

## What Shipped

### Library (5 modules, all TDD)

| Module | Tests | Purpose |
|---|---|---|
| `src/lib/voice-personas.ts` | 8 | 6 persona tuples (voice + speed + system prompt). `getPersona()` falls back safely. |
| `src/lib/sentence-splitter.ts` | 19 | Streaming sentence boundary detector. Handles 30+ abbreviations. |
| `src/lib/voice-token.ts` | 10 | HMAC-SHA256 signed session tokens. No JWT dep. |
| `src/lib/voice-stream.ts` | 6 | `streamLLM` async generator + `streamTTS` + `VoiceSession` with barge-in |
| `src/lib/voice-ws-server.ts` | 10 | Platform-agnostic WebSocket protocol handler |
| `src/lib/voice-billing.ts` | 12 | `computeVoiceCharge` + `settleVoiceSession` (partial capture) |
| `src/lib/__tests__/voice-session-route.test.ts` | 7 | Session endpoint HTTP contract |

### API Routes

| Path | Runtime | Purpose |
|---|---|---|
| `POST /api/voice/session` | Node | Clerk auth + 75¢ hold + signed token + wsUrl |
| `GET /api/voice/ws` | Node | Informational shim (points at Railway URL or 501 with setup hint) |

### Standalone WebSocket Server

| File | Purpose |
|---|---|
| `server/voice-ws.ts` | Node + `ws` library. HTTP health + WS upgrade. Deploys to Railway/Fly. |

### Client UI

| Path | Purpose |
|---|---|
| `src/components/voice/VoiceAgent.tsx` | Full orchestrator — session start, WS, playback, barge-in |
| `src/components/voice/PersonaPicker.tsx` | Dropdown for the 6 personas |
| `src/components/voice/VoiceStatusBar.tsx` | 6-state indicator (idle/connecting/listening/thinking/speaking/error) |
| `src/app/dashboard/voice-assistant/page.tsx` | Full-page voice UI (replaces the 332-line Web Speech API page) |

### Removed

- `src/components/JarvisSocket.tsx` — the push-to-talk stub
- Its reference in `src/app/dashboard/layout.tsx`

---

## Architecture

```
Browser (VoiceAgent.tsx)
   │
   │  1. POST /api/voice/session { personaId }
   │     ← { token, wsUrl: "/api/voice/ws", ... }
   │
   │  2. WebSocket → NEXT_PUBLIC_VOICE_WS_URL
   │     → { type: "auth", token }
   │     ← { type: "ready" }
   │     → { type: "turn-end", transcript }
   │     ← { type: "sentence", text }   (per-sentence captions)
   │     ← { type: "audio", chunk }      (per-chunk MP3 base64)
   │     ← { type: "turn-done" }         (play accumulated audio)
   │
Railway (server/voice-ws.ts)
   │
   ├── handleVoiceWs (src/lib/voice-ws-server.ts)
   │   ├── verifyVoiceToken
   │   ├── VoiceSession (src/lib/voice-stream.ts)
   │   │   ├── streamLLM → NIM /v1/chat/completions SSE
   │   │   ├── SentenceBuffer (src/lib/sentence-splitter.ts)
   │   │   └── streamTTS → NIM /v1/audio/speech (Magpie) stream
   │   └── billOnClose (src/lib/voice-billing.ts)
   │       └── captureHold + topUp(refund) via Plan 1 credit primitives
   │
Neon Postgres (credits.ts, plan 1)
```

---

## Deployment Order

### Step 1 — Set VOICE_SESSION_SECRET (Vercel + Railway)

Generate a 32-char random secret:
```bash
openssl rand -base64 24
```

Set in BOTH environments (must match):
- Vercel: `Project Settings → Environment Variables → VOICE_SESSION_SECRET`
- Railway: `Service → Variables → VOICE_SESSION_SECRET`

### Step 2 — Deploy the Next.js app (5 min)

Merge `claude/wizardly-benz` to `main`. Vercel auto-deploys.

Verify:
```bash
curl -X POST https://sovereignmatrix.agency/api/voice/session \
  -H 'cookie: __session=...'
# Expect 401 without auth (or 200 + token with auth)
```

### Step 3 — Deploy the WS server to Railway (20 min)

```bash
# From the repo root:
railway login
railway init
railway up            # picks up Dockerfile or build scripts
railway variables set VOICE_SESSION_SECRET=<same as Vercel>
railway variables set NVIDIA_NIM_API_KEY=<your key>
railway variables set DATABASE_URL=<Neon URL — same as Vercel>
railway variables set VOICE_WS_PORT=9090
railway up --detach
```

Run command for the service:
```
npx tsx server/voice-ws.ts
```

Railway will assign a public hostname like `voice-production.up.railway.app`.
Confirm the health endpoint:
```bash
curl https://voice-production.up.railway.app/
# Expect: ok
```

### Step 4 — Point the client at the Railway URL (3 min)

In Vercel:
```
NEXT_PUBLIC_VOICE_WS_URL=wss://voice-production.up.railway.app
```

Redeploy (Vercel picks up the env change on next deploy or you can trigger one manually).

### Step 5 — Smoke test end-to-end (5 min)

1. Open `/dashboard/voice-assistant`
2. Pick a persona, click "Start session" — expect status → connecting → listening
3. Type a message, press Enter — expect status → thinking → speaking, audio plays
4. Click "Interrupt" mid-playback — audio stops, status → listening
5. Check `/dashboard/billing` — credits show the hold placed + partial refund after session ended

### Step 6 — Optional: local dev (2 min)

```bash
# Terminal 1 — WS server
VOICE_SESSION_SECRET=<same> \
NVIDIA_NIM_API_KEY=<your key> \
DATABASE_URL=<your url> \
VOICE_WS_PORT=9090 \
npx tsx server/voice-ws.ts

# Terminal 2 — Next.js app
NEXT_PUBLIC_VOICE_WS_URL=ws://localhost:9090 \
npm run dev
```

---

## Environment Variables

| Var | Scope | Purpose |
|---|---|---|
| `VOICE_SESSION_SECRET` | Both | HMAC secret for session tokens. Min 16 chars. MUST match between Vercel + Railway. |
| `NVIDIA_NIM_API_KEY` | Both | NIM Chat + Magpie TTS. Free tier works. |
| `DATABASE_URL` | Both | Credits ledger + hold settlement |
| `NEXT_PUBLIC_VOICE_WS_URL` | Vercel only | `wss://...` URL of the Railway service |
| `VOICE_WS_PORT` | Railway only | Default 9090 |
| `NIM_API_BASE` | Optional | Defaults to `https://integrate.api.nvidia.com/v1` |
| `VOICE_CHAT_MODEL` | Optional | Defaults to `nvidia/llama-3.1-nemotron-70b-instruct` |
| `VOICE_TTS_MODEL` | Optional | Defaults to `nvidia/magpie-tts-flow` |

---

## What's NOT Built Yet (Known Follow-ups)

### VAD + streaming ASR (auto-turn)
Spec called for `@ricky0123/vad-web` client-side VAD + Parakeet streaming ASR. First ship is **typed-transcript push-to-turn** so the loop is verifiable without pulling in a 500KB VAD library and a second streaming API. Follow-up plan will add:
  - Client VAD with `onSpeechStart`/`onSpeechEnd` callbacks
  - MediaRecorder feeding audio chunks to a new `{type:"audio-chunk"}` server message
  - Server-side Parakeet streaming ASR at `/v1/audio/transcribe` (NIM)

### Free tier metering
Pricing constant is flat 15¢/min for everyone right now. `voice-billing.ts` has the hook point — swap the `computeVoiceCharge` call for `computeVoiceChargeForPlan(plan, minutesThisMonth, secondsUsed, holdCents)`. Free users get 5 min/month (spec), founder/enterprise unlimited. Needs a `voice_usage_monthly` table + cron rollup.

### Per-sentence playback (reduce perceived latency)
Current client accumulates all audio chunks until `turn-done`, then plays. For snappier feel, play the audio for sentence #1 while the server is still synthesizing sentence #2. MediaSource Extensions on the client or `<audio>` chained blob URLs. Worth doing when VAD ships.

### Echo cancellation tuning
Browser default AEC is usable over headphones but degrades on speakers. Pass `echoCancellation: "system"` + `noiseSuppression: true` to `getUserMedia`. Currently disabled since we don't capture mic yet (typed input).

### Voice cloning (Chatterbox)
Out of scope for this plan. If demand materializes, a new persona type `custom` + clone-upload flow.

---

## Quality Gate Summary

| Metric | Value |
|---|---|
| Plan 3 commits | 10 (plan 3.1 → 3.9) |
| Tests added | +72 (1405 → 1477) |
| TypeScript errors | 0 |
| Lint errors on new files | 0 |
| New API endpoints | 2 (`/api/voice/session`, `/api/voice/ws` shim) |
| New standalone server | 1 (`server/voice-ws.ts`) |
| New client components | 3 (`VoiceAgent`, `PersonaPicker`, `VoiceStatusBar`) |
| New lib modules | 6 (personas, splitter, token, stream, ws-server, billing) |
| Files deleted | 1 (`JarvisSocket.tsx`) |

---

## Rollback

If the voice stack misbehaves:

1. **Hide the UI**: comment out the `<VoiceAgent />` in `/dashboard/voice-assistant/page.tsx` + redeploy. Zero backend impact.
2. **Disable sessions server-side**: in `/api/voice/session/route.ts`, return 503 unconditionally. Clients get a clean "unavailable" state.
3. **Stop Railway service**: `railway down`. Users see a WS connect error; `NEXT_PUBLIC_VOICE_WS_URL` stops resolving. Main app is unaffected.
4. **Reclaim stuck holds**: the existing `/api/cron/sweep-expired-holds` cron (Plan 1) releases any abandoned voice holds after their 5-minute TTL. Nothing to do manually.

Rollback is additive-safe — all new DB writes go through existing Plan 1 credit tables.

---

## All Five Plans — Platform Status

| Plan | Status | Commits | Tests added |
|---|---|---|---|
| Plan 1 — Revenue Engine | ✅ Shipped | 11 | Covered in Plan 1 runbook |
| Plan 2 — Sovereign World | ✅ Shipped | 15 | +64 |
| Plan 3 — Voice Agent | ✅ Shipped (this session) | 10 | +72 |
| Plan 4 — Observability + Evals | ✅ Shipped | 7 | — |
| Plan 5 — Scheduled Playbooks | ✅ Shipped | 6 | — |

**The month's plan is complete.** 1477 passing tests, 0 TS errors, 0 lint errors, ~50 commits across 5 independent plans.
