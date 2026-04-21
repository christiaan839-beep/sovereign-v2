# Voice Agent — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real-time WebSocket voice loop with Grok-parity feel — sub-1s perceived latency, auto-turn via VAD, interruption support, 6 swappable personas. Replaces the current push-to-talk JarvisSocket stub.

**Architecture:** Three concurrent workers per connection — streaming ASR (Parakeet), streaming LLM (NIM), per-sentence TTS (Magpie). Client runs VAD locally (`@ricky0123/vad-web`, MIT, ~500KB) so the server only receives audio while the user is actually speaking. Barge-in detection cancels in-flight TTS when the user starts talking again. Persona = voice + system prompt tuple.

**Tech Stack:** Next.js Edge Runtime WebSocket (or Railway for persistent sockets) · Parakeet streaming ASR via NIM · Magpie TTS · NIM chat streaming · `@ricky0123/vad-web` · `ws` library.

**Depends on:** Plan 1 (Revenue Engine) for per-minute billing on paid tiers.

---

## File Structure

### Library
- `src/lib/voice-personas.ts` — 6 personas: voice ID + system prompt + description
- `src/lib/sentence-splitter.ts` — incremental sentence buffer for TTS chunking
- `src/lib/voice-stream.ts` — core streaming pipeline (ASR in, LLM out, TTS out)
- `src/lib/voice-billing.ts` — per-minute metering into the credit system

### API routes
- `src/app/api/voice/session/route.ts` — POST, returns signed session token
- `src/app/api/voice/ws/route.ts` — Edge WebSocket, audio in/out streaming

### Components
- `src/components/voice/VoiceAgent.tsx` — replaces JarvisSocket. VAD + WS client + AudioContext playback
- `src/components/voice/PersonaPicker.tsx` — dropdown picker
- `src/components/voice/VoiceStatusBar.tsx` — mic status indicator

### Tests
- `src/lib/__tests__/voice-personas.test.ts`
- `src/lib/__tests__/sentence-splitter.test.ts`
- `src/lib/__tests__/voice-stream.test.ts`
- `src/lib/__tests__/voice-billing.test.ts`
- `src/lib/__tests__/voice-session-route.test.ts`

---

## Task 1: Personas module

**Files:**
- Create: `src/lib/voice-personas.ts`
- Test: `src/lib/__tests__/voice-personas.test.ts`

- [ ] **Step 1: Failing test**

Assert 6 personas exist, each with `voice`, `systemPrompt >= 50 chars`, and `description`. `getPersona()` returns the default for unknown IDs.

- [ ] **Step 2: Run — FAIL**

- [ ] **Step 3: Implement**

Define the `Persona` interface (`id`, `name`, `description`, `voice`, `systemPrompt`, optional `speed`) and export a `PERSONAS` record with 6 entries:

| Persona | Voice | Character |
|---|---|---|
| `default` (Sovereign) | English-US.Female-1 | Calm, precise, direct, no filler |
| `architect` | English-US.Male-1 | Terse, technical, assumes engineer audience |
| `closer` | English-US.Female-1, 1.05× | Warm B2B sales energy, ends with questions |
| `therapist` | English-US.Female-2, 0.92× | Measured pace, one question at a time |
| `grok_mode` (Irreverent) | English-UK.Male-1, 1.05× | Witty, counter-take, zero sycophancy |
| `storyteller` | English-US.Male-2, 0.90× | Narrative, vivid detail, slower |

- [ ] **Step 4: Run — PASS**

- [ ] **Step 5: Commit** — `feat(voice): 6 personas (plan 3.1)`

---

## Task 2: Sentence boundary splitter

**Files:**
- Create: `src/lib/sentence-splitter.ts`
- Test: `src/lib/__tests__/sentence-splitter.test.ts`

Incremental token buffer that emits complete sentences as they're ready. Handles abbreviations (Dr., Mr., e.g., i.e., etc.). Used by the LLM→TTS pipeline so TTS can start speaking before the full reply is complete.

- [ ] **Step 1: Failing tests**
  - emits on `. ? !` followed by space or end-of-input
  - does NOT split on `Dr. Smith`, `e.g. see below`
  - handles rapid-fire token arrivals correctly
  - `flush()` returns any trailing fragment

- [ ] **Step 2: Run — FAIL**
- [ ] **Step 3: Implement** — `SentenceBuffer` class with `push(token): string[]` and `flush(): string[]`. Maintain a set of known abbreviations (~20). Use regex `/([.?!])(\s|$)/` to find boundaries; when last word before boundary is an abbreviation, skip and continue.
- [ ] **Step 4: Run — PASS**
- [ ] **Step 5: Commit** — `feat(voice): sentence buffer for TTS chunking (plan 3.2)`

---

## Task 3: Voice session endpoint

**Files:**
- Create: `src/app/api/voice/session/route.ts`
- Test: `src/lib/__tests__/voice-session-route.test.ts`

POST endpoint:
1. Verify Clerk auth → 401 if absent
2. Validate body `{personaId: string}` with Zod
3. Place a 5-minute credit hold (per Plan 1) — return 402 if insufficient
4. Sign a JWT `{userId, personaId, holdId, exp: now+60s}` with `process.env.VOICE_SESSION_SECRET`
5. Return `{token, wsUrl: "/api/voice/ws"}`

Commit — `feat(voice): session endpoint with signed token + credit hold (plan 3.3)`

---

## Task 4: Streaming pipeline module

**Files:**
- Create: `src/lib/voice-stream.ts`
- Test: `src/lib/__tests__/voice-stream.test.ts`

The heart of the plan — three coroutines that overlap:

**`VoiceSession` class** with methods:
- `handleTurn(finalTranscript, onAudioChunk)` — pipelines LLM→splitter→TTS
- `bargeIn()` — sets cancel flag, fresh sentence buffer

**`streamLLM(prompt, system, isCanceled)` async generator** — calls NIM `/v1/chat/completions` with `stream: true`, parses SSE `data:` lines, yields each content delta; exits immediately when `isCanceled()` returns true.

**`streamTTS(sentence, voice, onChunk, isCanceled)` function** — calls NIM `/v1/audio/speech` with `model: "nvidia/magpie-tts-flow"`, pipes the response body; calls `reader.cancel()` when `isCanceled()` returns true.

**Test coverage:** mock `fetch` to emit controlled SSE frames; verify sentences are chunked correctly; verify cancel propagates to both LLM + TTS.

Commit — `feat(voice): streaming pipeline with barge-in (plan 3.4)`

---

## Task 5: WebSocket route

**Files:**
- Create: `src/app/api/voice/ws/route.ts`

Edge Runtime WebSocket handler. Pattern (Next.js 16):
1. Upgrade request to WS
2. First message from client must be `{type: "auth", token}` — verify JWT, else close with code 1008
3. Extract `userId`, `personaId`, `holdId` from token
4. Create `VoiceSession`
5. Listen for messages:
   - `{type: "audio", chunk: base64}` → buffer for ASR
   - `{type: "turn-end"}` → finalize transcript (Parakeet), call `session.handleTurn(transcript, chunk => ws.send({type:"audio", chunk: base64(chunk)}))`
   - `{type: "barge-in"}` → `session.bargeIn()`
   - `{type: "close"}` → finalize hold
6. On close: call `captureHold(holdId, minutesUsed * 15)` for actual usage, `releaseHold` the rest

**Important:** If deploying to Vercel Edge, the 5-minute session limit is a real constraint — plan on deploying this single route to Railway or use OpenAI Realtime compatibility layer later.

Commit — `feat(voice): WebSocket route with barge-in + billing (plan 3.5)`

---

## Task 6: VoiceAgent client component

**Files:**
- Create: `src/components/voice/VoiceAgent.tsx`
- Modify: `src/app/dashboard/layout.tsx` (swap `<JarvisSocket />` for `<VoiceAgent />`)
- Install: `npm install @ricky0123/vad-web`

**Client flow:**
1. User taps mic → request mic permission via `getUserMedia`
2. Init VAD from `@ricky0123/vad-web` with `onSpeechStart`, `onSpeechEnd` callbacks
3. POST `/api/voice/session` with selected persona → receive token + WS URL
4. Open WS, send `{type:"auth", token}`
5. `onSpeechStart` → begin streaming audio chunks (250ms WebM Opus)
6. `onSpeechEnd` → send `{type:"turn-end"}`
7. Receive `{type:"audio", chunk: base64}` messages → MediaSource buffer → play via AudioContext
8. If `onSpeechStart` fires while audio is playing → send `{type:"barge-in"}` + fade current audio to 0 over 100ms + resume streaming

**UI states:** idle / listening / thinking / speaking — shown in `VoiceStatusBar` (Task 7).

Commit — `feat(voice): VoiceAgent client with VAD + playback (plan 3.6)`

---

## Task 7: Persona picker + status bar

**Files:**
- Create: `src/components/voice/PersonaPicker.tsx` — dropdown with 6 options
- Create: `src/components/voice/VoiceStatusBar.tsx` — top-bar mic indicator
- Modify: `src/app/dashboard/voice-assistant/page.tsx` — full-page voice UI

Commit — `feat(voice): persona picker + status bar (plan 3.7)`

---

## Task 8: Per-minute billing wiring

**Files:**
- Create: `src/lib/voice-billing.ts`
- Test: `src/lib/__tests__/voice-billing.test.ts`

Pricing: `15¢/minute` for Growth+, free for founder/enterprise. Free tier: 5 min/month.
Uses the hold/capture/release primitives from Plan 1 — on session close, capture `ceil(secondsUsed / 60) * 15` cents; release the rest.

Commit — `feat(voice): per-minute billing into credit system (plan 3.8)`

---

## Task 9: Remove JarvisSocket stub

Once VoiceAgent is live and tested end-to-end, delete the stub via `git rm src/components/JarvisSocket.tsx` and update the layout import.

Commit — `chore(voice): remove JarvisSocket stub (plan 3.9)`

---

## Quality Gate

- [ ] 6 personas present, each with distinct voice + prompt
- [ ] Sentence buffer handles abbreviations + rapid tokens
- [ ] WS endpoint auth-gated via signed session token
- [ ] Barge-in cancels LLM + TTS within 100ms
- [ ] Per-minute billing deducts from credits
- [ ] JarvisSocket stub deleted
- [ ] Typecheck + tests green
- [ ] Manual test: "Hello, tell me a joke" → persona responds in voice under 1.5s

## Open Questions

- Vercel Edge WS timeout (5 min) — do we ship this on Vercel and auto-reconnect, or split the WS server to Railway? Recommend Railway for long voice sessions, Vercel for the UI.
- Echo cancellation — default browser AEC is usable but not great on speakers. Do we add WebRTC's more aggressive AEC config later?
- Voice cloning (Chatterbox) — out of scope for this plan; separate future plan if user demand warrants.
