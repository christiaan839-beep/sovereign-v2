import { createLogger } from "@/lib/logger";

const log = createLogger("circuit-breaker");

// ─── Circuit Breaker ─────────────────────────────────────────
// Prevents cascading failures when an AI provider is down.
// States: closed (normal) → open (failing fast) → half-open (probing)

type CircuitState = "closed" | "open" | "half-open";

interface CircuitConfig {
  /** Number of consecutive failures before the circuit opens */
  failureThreshold: number;
  /** Milliseconds to wait before probing again (half-open) */
  resetTimeout: number;
  /** Human-readable name for logging */
  name: string;
}

class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures: number = 0;
  private lastFailure: number = 0;
  private config: CircuitConfig;

  constructor(config: CircuitConfig) {
    this.config = config;
  }

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    // ── Open: fail fast unless reset timeout has elapsed ──
    if (this.state === "open") {
      const elapsed = Date.now() - this.lastFailure;
      if (elapsed < this.config.resetTimeout) {
        log.warn("Circuit open — failing fast", {
          breaker: this.config.name,
          retriesIn: `${Math.ceil((this.config.resetTimeout - elapsed) / 1000)}s`,
        });
        throw new Error(
          `Circuit breaker "${this.config.name}" is OPEN — provider unavailable. Retry in ${Math.ceil((this.config.resetTimeout - elapsed) / 1000)}s.`
        );
      }
      // Reset timeout elapsed — transition to half-open
      this.state = "half-open";
      log.info("Circuit half-open — probing", { breaker: this.config.name });
    }

    // ── Half-open: try one request ──
    if (this.state === "half-open") {
      try {
        const result = await fn();
        this.onSuccess();
        return result;
      } catch (err) {
        this.onFailure();
        throw err;
      }
    }

    // ── Closed: normal operation ──
    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess(): void {
    if (this.state !== "closed") {
      log.info("Circuit closed — provider recovered", { breaker: this.config.name });
    }
    this.failures = 0;
    this.state = "closed";
  }

  private onFailure(): void {
    this.failures++;
    this.lastFailure = Date.now();

    if (this.failures >= this.config.failureThreshold) {
      this.state = "open";
      log.error("Circuit opened — too many failures", {
        breaker: this.config.name,
        failures: String(this.failures),
        threshold: String(this.config.failureThreshold),
      });
    } else {
      log.warn("Circuit failure recorded", {
        breaker: this.config.name,
        failures: String(this.failures),
        threshold: String(this.config.failureThreshold),
      });
    }
  }

  getState(): { state: CircuitState; failures: number; name: string } {
    return {
      state: this.state,
      failures: this.failures,
      name: this.config.name,
    };
  }
}

// ─── Provider Breakers ───────────────────────────────────────
// One breaker per AI provider. Shared across all requests.

export const nimBreaker = new CircuitBreaker({
  name: "nvidia-nim",
  failureThreshold: 3,
  resetTimeout: 30_000, // 30s
});

export const geminiBreaker = new CircuitBreaker({
  name: "google-gemini",
  failureThreshold: 3,
  resetTimeout: 30_000,
});

export const claudeBreaker = new CircuitBreaker({
  name: "anthropic-claude",
  failureThreshold: 3,
  resetTimeout: 30_000,
});

export const groqBreaker = new CircuitBreaker({
  name: "groq",
  failureThreshold: 3,
  resetTimeout: 30_000,
});

/** Returns the health status of all circuit breakers (for /api/health). */
export function getCircuitStatus() {
  return {
    nim: nimBreaker.getState(),
    gemini: geminiBreaker.getState(),
    claude: claudeBreaker.getState(),
    groq: groqBreaker.getState(),
  };
}
