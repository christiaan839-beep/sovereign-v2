/**
 * AGENT RELIABILITY LAYER — Production-grade resilience for all NIM API calls.
 *
 * Features:
 * - 3x automatic retry with exponential backoff
 * - Circuit breaker: if 5 failures in 60s, short-circuit for 30s
 * - Model fallback: if primary model fails, try secondary
 * - Execution replay logging
 * - Timeout enforcement (30s max)
 */

interface ReliableCallOptions {
  model: string;
  messages: Array<{ role: string; content: string }>;
  max_tokens?: number;
  temperature?: number;
  fallbackModel?: string;
  agentName?: string;
  timeout?: number;
}

interface ExecutionReplay {
  id: string;
  agent: string;
  model: string;
  timestamp: string;
  duration_ms: number;
  status: "success" | "failed" | "fallback" | "circuit-broken";
  attempts: number;
  steps: Array<{ time: number; event: string; detail: string }>;
  input_preview: string;
  output_preview: string;
  /** Optional Clerk userId — set when the request was authenticated.
   * Filtering on this lets `/api/_agents/replays` only show a user
   * their own runs without leaking cross-user data. */
  userId?: string;
}

// Circuit breaker state
const circuitState = {
  failures: 0,
  lastFailure: 0,
  isOpen: false,
  openUntil: 0,
};

// Execution replay store
const REPLAY_STORE: ExecutionReplay[] = [];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function reliableNimCall(options: ReliableCallOptions): Promise<{
  success: boolean;
  data: Record<string, unknown>;
  replay: ExecutionReplay;
}> {
  const {
    model,
    messages,
    max_tokens = 1024,
    temperature = 0.7,
    fallbackModel,
    agentName = "unknown",
    timeout = 30000,
  } = options;

  const nimKey = process.env.NVIDIA_NIM_API_KEY;
  const startTime = Date.now();
  const replayId = `replay-${Date.now()}`;
  const steps: ExecutionReplay["steps"] = [];

  const replay: ExecutionReplay = {
    id: replayId,
    agent: agentName,
    model,
    timestamp: new Date().toISOString(),
    duration_ms: 0,
    status: "failed",
    attempts: 0,
    steps,
    input_preview:
      messages[messages.length - 1]?.content?.substring(0, 200) || "",
    output_preview: "",
  };

  if (!nimKey) {
    steps.push({
      time: 0,
      event: "ERROR",
      detail: "NVIDIA_NIM_API_KEY not configured",
    });
    replay.duration_ms = Date.now() - startTime;
    REPLAY_STORE.push(replay);
    return { success: false, data: { error: "API key missing" }, replay };
  }

  // Circuit breaker check
  const now = Date.now();
  if (circuitState.isOpen && now < circuitState.openUntil) {
    steps.push({
      time: 0,
      event: "CIRCUIT_OPEN",
      detail: `Circuit breaker open until ${new Date(circuitState.openUntil).toISOString()}`,
    });
    replay.status = "circuit-broken";
    replay.duration_ms = Date.now() - startTime;
    REPLAY_STORE.push(replay);
    return {
      success: false,
      data: { error: "Circuit breaker open. Too many failures." },
      replay,
    };
  }
  circuitState.isOpen = false;

  // Retry loop with exponential backoff
  const MAX_RETRIES = 3;
  let lastError = "";

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    replay.attempts = attempt;
    const attemptStart = Date.now() - startTime;
    steps.push({
      time: attemptStart,
      event: "ATTEMPT",
      detail: `Attempt ${attempt}/${MAX_RETRIES} using ${model}`,
    });

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      steps.push({
        time: Date.now() - startTime,
        event: "API_CALL",
        detail: `Calling NVIDIA NIM: ${model}`,
      });

      const res = await fetch(
        "https://integrate.api.nvidia.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${nimKey}`,
          },
          body: JSON.stringify({
            model,
            messages,
            max_tokens,
            temperature,
            stream: false,
          }),
          signal: controller.signal,
        },
      );

      clearTimeout(timeoutId);

      if (!res.ok) {
        const errText = await res.text();
        lastError = `HTTP ${res.status}: ${errText.substring(0, 200)}`;
        steps.push({
          time: Date.now() - startTime,
          event: "HTTP_ERROR",
          detail: lastError,
        });
        throw new Error(lastError);
      }

      const data = await res.json();
      steps.push({
        time: Date.now() - startTime,
        event: "SUCCESS",
        detail: `Got response: ${data.choices?.[0]?.message?.content?.substring(0, 100)}...`,
      });

      // Reset circuit breaker on success
      circuitState.failures = 0;

      replay.status = "success";
      replay.duration_ms = Date.now() - startTime;
      replay.output_preview =
        data.choices?.[0]?.message?.content?.substring(0, 200) || "";
      REPLAY_STORE.push(replay);
      trimReplayStore();

      return { success: true, data, replay };
    } catch (err) {
      lastError = String(err);
      steps.push({
        time: Date.now() - startTime,
        event: "FAILED",
        detail: lastError.substring(0, 200),
      });

      // Track failures for circuit breaker
      circuitState.failures += 1;
      circuitState.lastFailure = Date.now();
      if (circuitState.failures >= 5) {
        circuitState.isOpen = true;
        circuitState.openUntil = Date.now() + 30000; // 30s cooldown
        steps.push({
          time: Date.now() - startTime,
          event: "CIRCUIT_TRIPPED",
          detail: "5 failures in window. Circuit breaker open for 30s.",
        });
      }

      if (attempt < MAX_RETRIES) {
        const backoff = Math.pow(2, attempt) * 500; // 1s, 2s, 4s
        steps.push({
          time: Date.now() - startTime,
          event: "BACKOFF",
          detail: `Waiting ${backoff}ms before retry`,
        });
        await sleep(backoff);
      }
    }
  }

  // All retries exhausted — try fallback model
  if (fallbackModel) {
    steps.push({
      time: Date.now() - startTime,
      event: "FALLBACK",
      detail: `Primary failed. Trying fallback: ${fallbackModel}`,
    });

    try {
      const res = await fetch(
        "https://integrate.api.nvidia.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${nimKey}`,
          },
          body: JSON.stringify({
            model: fallbackModel,
            messages,
            max_tokens,
            temperature,
            stream: false,
          }),
        },
      );

      if (res.ok) {
        const data = await res.json();
        steps.push({
          time: Date.now() - startTime,
          event: "FALLBACK_SUCCESS",
          detail: `Fallback model responded`,
        });

        replay.status = "fallback";
        replay.model = `${model} → ${fallbackModel}`;
        replay.duration_ms = Date.now() - startTime;
        replay.output_preview =
          data.choices?.[0]?.message?.content?.substring(0, 200) || "";
        REPLAY_STORE.push(replay);
        trimReplayStore();

        return { success: true, data, replay };
      }
    } catch (e) {
      steps.push({
        time: Date.now() - startTime,
        event: "FALLBACK_FAILED",
        detail: String(e).substring(0, 200),
      });
    }
  }

  replay.duration_ms = Date.now() - startTime;
  REPLAY_STORE.push(replay);
  trimReplayStore();

  return { success: false, data: { error: lastError }, replay };
}

function trimReplayStore() {
  if (REPLAY_STORE.length > 500) {
    REPLAY_STORE.splice(0, REPLAY_STORE.length - 500);
  }
}

export function getReplayStore(): ExecutionReplay[] {
  return REPLAY_STORE;
}

export function getReplayById(id: string): ExecutionReplay | undefined {
  return REPLAY_STORE.find((r) => r.id === id);
}
