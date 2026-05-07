import { createAgentRoute } from "@/lib/agent-factory";
import { z } from "zod";
import { db } from "@/db";
import { voiceCalls } from "@/db/schema";
import { eq } from "drizzle-orm";
import { transcribeWithParakeet } from "@/lib/parakeet-asr";
import { fetchWithTimeout } from "@/lib/with-timeout";
import { captureException } from "@/lib/sentry";
import { createLogger } from "@/lib/logger";

const log = createLogger("transcribe-call-agent");

/**
 * TRANSCRIBE-CALL — turns a Twilio recording URL into a searchable
 * transcript via NVIDIA Parakeet (CC-BY-4.0, $0/min).
 *
 * Closes the gap noted in `voice-service.ts` — recorded calls land
 * as audio with no text. This agent:
 *
 *   1. Fetches the recording bytes from Twilio (with auth)
 *   2. Pipes the audio through Parakeet via NIM
 *   3. Writes the transcript back to `voice_calls.transcript` for
 *      that call (looked up by `callSid`)
 *
 * Inputs:
 *   - recordingUrl: full Twilio recording URL (e.g.
 *     `https://api.twilio.com/2010-04-01/Accounts/AC.../Recordings/RE...`)
 *   - callSid: optional Twilio call SID; when present the
 *     transcript is persisted into the `voice_calls` row whose
 *     id matches. When absent, the transcript is returned only
 *     to the caller.
 *   - language: optional BCP-47 language hint
 *
 * Output: the full transcript + word-level timing.
 *
 * Permissions: this is a tier-1 admin-only operation in practice
 * (operator-triggered after a call). The factory's standard
 * auth gate is sufficient — any authenticated user may transcribe
 * a Twilio URL they possess. PII handling (the transcript may
 * contain customer phone numbers / names) is delegated to the
 * downstream output-verifier on whoever displays the transcript.
 */

/**
 * Allowlist of Twilio hosts the route is permitted to call. Any
 * other host is rejected before the Authorization header is even
 * constructed — this prevents SSRF (172.16.0.0/12, 169.254.169.254
 * cloud metadata, file://, gopher://, etc.) and stops a confused-
 * deputy attack where the attacker tricks the route into sending
 * Twilio basic-auth credentials to an arbitrary endpoint they
 * control. `redirect: "manual"` further prevents the auth header
 * from being replayed on a redirect chain — a Twilio CDN URL that
 * 302s to attacker.com would otherwise still leak the header on
 * the second hop in some fetch implementations.
 */
const TWILIO_HOST_ALLOWLIST = new Set([
  "api.twilio.com",
  "media.twiliocdn.com",
]);

function isAllowedTwilioUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === "https:" && TWILIO_HOST_ALLOWLIST.has(u.host);
  } catch {
    return false;
  }
}

const schema = z.object({
  recordingUrl: z
    .string()
    .url()
    .refine(
      isAllowedTwilioUrl,
      "recordingUrl must be on api.twilio.com or media.twiliocdn.com",
    ),
  callSid: z.string().optional(),
  language: z.string().optional(),
});

function getTwilioAuth(): { sid: string; token: string } | null {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return { sid, token };
}

async function fetchTwilioRecording(
  recordingUrl: string,
): Promise<{ bytes: Uint8Array; contentType: string } | { error: string }> {
  // Defence-in-depth: schema validation already enforces this, but
  // re-check inside the fetch helper so any future internal caller
  // can't accidentally pass an arbitrary URL.
  if (!isAllowedTwilioUrl(recordingUrl)) {
    return { error: "recordingUrl not on the Twilio host allowlist" };
  }
  const auth = getTwilioAuth();
  if (!auth) {
    return { error: "TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN not configured" };
  }
  const basic = Buffer.from(`${auth.sid}:${auth.token}`).toString("base64");
  try {
    const res = await fetchWithTimeout(recordingUrl, {
      headers: { Authorization: `Basic ${basic}` },
      // Never auto-follow redirects — would replay the
      // Authorization header on the redirect target, leaking
      // Twilio creds to whoever Twilio redirected to.
      redirect: "manual",
      timeoutMs: 30_000,
      label: "twilio-recording-fetch",
    });
    if (!res.ok) {
      return { error: `Twilio fetch HTTP ${res.status}` };
    }
    const buf = new Uint8Array(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") ?? "audio/mpeg";
    return { bytes: buf, contentType };
  } catch (err) {
    captureException(err, {
      module: "transcribe-call",
      action: "fetch-twilio-recording",
    });
    return {
      error: err instanceof Error ? err.message : "Twilio fetch failed",
    };
  }
}

export const POST = createAgentRoute({
  name: "transcribe-call",
  schema,
  handler: async ({ input }) => {
    const data = input as z.infer<typeof schema>;

    // 1. Pull the recording bytes from Twilio
    const fetched = await fetchTwilioRecording(data.recordingUrl);
    if ("error" in fetched) {
      return { error: fetched.error };
    }

    // 2. Parakeet transcription
    const result = await transcribeWithParakeet({
      audio: fetched.bytes,
      contentType: fetched.contentType,
      language: data.language,
    });
    if (!result.ok) {
      log.warn("Parakeet transcription failed", { reason: result.reason });
      return { error: `Transcription failed: ${result.reason}` };
    }

    const transcript = result.transcript;

    // 3. Persist back to voice_calls when callSid was provided.
    // Best-effort — never fails the response on a DB write error.
    if (data.callSid) {
      try {
        await db
          .update(voiceCalls)
          .set({ transcript: transcript.text })
          .where(eq(voiceCalls.id, data.callSid));
      } catch (err) {
        const pgCode = (err as { code?: string })?.code;
        if (pgCode !== "42P01") {
          log.warn("voice_calls update failed", {
            error: err instanceof Error ? err.message : String(err),
            callSid: data.callSid,
          });
        }
      }
    }

    return {
      ok: true,
      transcript: transcript.text,
      language: transcript.language,
      durationSec: transcript.durationSec,
      wordCount: transcript.words.length,
      // Sample the first 25 words for the operator to skim — full
      // word array is large for long calls; the transcript text is
      // searchable and the durations log captures word counts.
      preview: transcript.words.slice(0, 25).map((w) => ({
        word: w.word,
        start: w.start,
        end: w.end,
      })),
    };
  },
});
