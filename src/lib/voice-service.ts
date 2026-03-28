/**
 * SOVEREIGN MATRIX — Voice Calling Infrastructure
 *
 * Wraps voice calling capabilities with:
 * - Twilio API integration (with graceful fallback)
 * - Call status tracking
 * - Recording consent management
 * - Kokoro TTS voice synthesis integration
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("voice-service");

// ── Types ──

export type CallStatus = "initiated" | "ringing" | "answered" | "completed" | "failed" | "busy" | "no-answer" | "canceled";

export interface CallConfig {
  /** Phone number to call (E.164 format, e.g. +14155551234) */
  to: string;
  /** Script or message for the call */
  script: string;
  /** Caller ID / from number (defaults to env TWILIO_PHONE_NUMBER) */
  from?: string;
  /** Voice to use for TTS (Kokoro voice ID) */
  voice?: string;
  /** Whether the callee has consented to recording */
  recordingConsent?: boolean;
  /** Enable call recording (requires consent) */
  record?: boolean;
  /** Maximum call duration in seconds (default: 300) */
  maxDuration?: number;
  /** Callback URL for status updates */
  statusCallbackUrl?: string;
  /** Custom metadata to attach to the call */
  metadata?: Record<string, string>;
}

export interface CallResult {
  success: boolean;
  callSid?: string;
  status: CallStatus;
  reason?: string;
  duration?: number;
  recordingUrl?: string;
}

export interface CallStatusUpdate {
  callSid: string;
  status: CallStatus;
  duration?: number;
  timestamp: string;
}

export interface VoiceSynthResult {
  success: boolean;
  audioUrl?: string;
  durationMs?: number;
  reason?: string;
}

// ── In-Memory Call Tracking ──
// In production, this would be backed by a database.

const callStatusMap: Map<string, CallStatusUpdate[]> = new Map();

// ── Configuration ──

function getTwilioConfig(): { accountSid: string; authToken: string; phoneNumber: string } | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const phoneNumber = process.env.TWILIO_PHONE_NUMBER;

  if (!accountSid || !authToken) return null;
  return { accountSid, authToken, phoneNumber: phoneNumber || "" };
}

function getKokoroConfig(): { apiUrl: string; apiKey: string } | null {
  const apiUrl = process.env.KOKORO_API_URL || process.env.KOKORO_TTS_URL;
  const apiKey = process.env.KOKORO_API_KEY || "";
  if (!apiUrl) return null;
  return { apiUrl, apiKey };
}

// ── Recording Consent ──

const consentLog: Map<string, { consented: boolean; timestamp: string }> = new Map();

export function recordConsent(phoneNumber: string, consented: boolean): void {
  consentLog.set(phoneNumber, {
    consented,
    timestamp: new Date().toISOString(),
  });
  log.info("Recording consent updated", { phone: phoneNumber.slice(0, 4) + "***", consented });
}

export function hasRecordingConsent(phoneNumber: string): boolean {
  return consentLog.get(phoneNumber)?.consented ?? false;
}

// ── Call Status Tracking ──

export function trackCallStatus(callSid: string, status: CallStatus, duration?: number): void {
  const update: CallStatusUpdate = {
    callSid,
    status,
    duration,
    timestamp: new Date().toISOString(),
  };

  const history = callStatusMap.get(callSid) || [];
  history.push(update);
  callStatusMap.set(callSid, history);

  log.info("Call status updated", { callSid, status, duration });
}

export function getCallHistory(callSid: string): CallStatusUpdate[] {
  return callStatusMap.get(callSid) || [];
}

export function getLatestCallStatus(callSid: string): CallStatus | null {
  const history = callStatusMap.get(callSid);
  if (!history || history.length === 0) return null;
  return history[history.length - 1].status;
}

// ── TwiML Generation ──

function buildTwiml(script: string, config: CallConfig): string {
  const voice = config.voice || "Polly.Matthew";
  const lines = script.split("\n").filter((l) => l.trim());

  let twiml = '<?xml version="1.0" encoding="UTF-8"?><Response>';

  if (config.record && config.recordingConsent) {
    twiml += '<Record maxLength="600" transcribe="true" />';
  }

  for (const line of lines) {
    twiml += `<Say voice="${voice}">${escapeXml(line)}</Say>`;
    twiml += '<Pause length="1"/>';
  }

  twiml += "</Response>";
  return twiml;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ── Core Call Function ──

export async function makeCall(to: string, script: string, options: Partial<CallConfig> = {}): Promise<CallResult> {
  const twilio = getTwilioConfig();
  if (!twilio) {
    return { success: false, status: "failed", reason: "Twilio not configured" };
  }

  const config: CallConfig = {
    to,
    script,
    from: options.from || twilio.phoneNumber,
    voice: options.voice,
    recordingConsent: options.recordingConsent ?? false,
    record: options.record ?? false,
    maxDuration: options.maxDuration ?? 300,
    statusCallbackUrl: options.statusCallbackUrl,
    metadata: options.metadata,
  };

  // Validate E.164 format
  if (!/^\+[1-9]\d{1,14}$/.test(config.to)) {
    return { success: false, status: "failed", reason: "Invalid phone number. Use E.164 format (e.g., +14155551234)" };
  }

  if (!config.from) {
    return { success: false, status: "failed", reason: "No from number configured. Set TWILIO_PHONE_NUMBER." };
  }

  // Recording consent check
  if (config.record && !config.recordingConsent && !hasRecordingConsent(config.to)) {
    return {
      success: false,
      status: "failed",
      reason: "Call recording requires explicit consent. Set recordingConsent: true or call recordConsent() first.",
    };
  }

  // Build TwiML
  const twiml = buildTwiml(config.script, config);

  // Make the call via Twilio REST API
  try {
    const authString = Buffer.from(`${twilio.accountSid}:${twilio.authToken}`).toString("base64");

    const params = new URLSearchParams({
      To: config.to,
      From: config.from,
      Twiml: twiml,
      Timeout: String(Math.min(config.maxDuration ?? 300, 600)),
    });

    if (config.statusCallbackUrl) {
      params.set("StatusCallback", config.statusCallbackUrl);
      params.set("StatusCallbackEvent", "initiated ringing answered completed");
    }

    if (config.record && config.recordingConsent) {
      params.set("Record", "true");
    }

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilio.accountSid}/Calls.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${authString}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      }
    );

    if (!response.ok) {
      const errorBody = await response.text();
      log.error("Twilio API error", { status: response.status, body: errorBody });
      return { success: false, status: "failed", reason: `Twilio returned ${response.status}` };
    }

    const data = (await response.json()) as { sid?: string; status?: string };
    const callSid = data.sid || "unknown";

    // Track initial status
    trackCallStatus(callSid, "initiated");

    log.info("Call initiated", { callSid, to: to.slice(0, 4) + "***" });

    return {
      success: true,
      callSid,
      status: "initiated",
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error("Call initiation failed", { error: message });
    return { success: false, status: "failed", reason: message };
  }
}

// ── Kokoro TTS Voice Synthesis ──

export async function synthesizeVoice(
  text: string,
  voice?: string
): Promise<VoiceSynthResult> {
  const kokoro = getKokoroConfig();
  if (!kokoro) {
    return { success: false, reason: "Kokoro TTS not configured. Set KOKORO_API_URL." };
  }

  try {
    const response = await fetch(`${kokoro.apiUrl}/synthesize`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(kokoro.apiKey ? { Authorization: `Bearer ${kokoro.apiKey}` } : {}),
      },
      body: JSON.stringify({
        text,
        voice: voice || "default",
        format: "mp3",
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      log.error("Kokoro TTS error", { status: response.status, body: errorBody });
      return { success: false, reason: `Kokoro TTS returned ${response.status}` };
    }

    const data = (await response.json()) as { audio_url?: string; duration_ms?: number };

    return {
      success: true,
      audioUrl: data.audio_url,
      durationMs: data.duration_ms,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    log.error("Voice synthesis failed", { error: message });
    return { success: false, reason: message };
  }
}

// ── Diagnostics ──

export function getVoiceServiceStatus(): {
  twilioConfigured: boolean;
  kokoroConfigured: boolean;
  activeCalls: number;
  totalCallsTracked: number;
  consentsRecorded: number;
} {
  return {
    twilioConfigured: getTwilioConfig() !== null,
    kokoroConfigured: getKokoroConfig() !== null,
    activeCalls: Array.from(callStatusMap.values()).filter(
      (history) => {
        const last = history[history.length - 1];
        return last && !["completed", "failed", "busy", "no-answer", "canceled"].includes(last.status);
      }
    ).length,
    totalCallsTracked: callStatusMap.size,
    consentsRecorded: consentLog.size,
  };
}
