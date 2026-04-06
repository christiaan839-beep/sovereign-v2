/**
 * SOVEREIGN MATRIX — Agent-Level Circuit Breaker
 *
 * Tracks consecutive failures per agent. After a threshold of failures,
 * the agent is temporarily disabled ("open" state) for a cooldown period.
 * After cooldown, one probe request is allowed ("half-open"). If it succeeds,
 * the circuit closes and normal traffic resumes.
 *
 * This complements the provider-level circuit breaker (circuit-breaker.ts)
 * by catching agent-specific issues (bad prompts, broken tool chains, etc.)
 */

import { createLogger } from "@/lib/logger";

const log = createLogger("agent-circuit-breaker");

type CircuitState = "closed" | "open" | "half-open";

interface CircuitInfo {
  state: CircuitState;
  failures: number;
  lastFailure: number;
  openedAt: number;
  /** True while a half-open probe is in flight — blocks additional probes */
  probing: boolean;
}

// ── Configuration ──
const FAILURE_THRESHOLD = 5;      // Open circuit after 5 consecutive failures
const COOLDOWN_MS = 60_000;       // 60 seconds before allowing a probe
const RESET_WINDOW_MS = 300_000;  // Reset failure count if no failure in 5 minutes

// In-memory state (per agent name)
const circuits = new Map<string, CircuitInfo>();

/**
 * Check if an agent is allowed to execute.
 * Returns true if the circuit is closed or half-open (probe allowed).
 * Returns false if the circuit is open (agent temporarily disabled).
 */
export function isAgentAvailable(agentName: string): boolean {
  const circuit = circuits.get(agentName);
  if (!circuit) return true; // No history = closed

  const now = Date.now();

  switch (circuit.state) {
    case "closed":
      return true;

    case "open":
      // Check if cooldown has elapsed
      if (now - circuit.openedAt >= COOLDOWN_MS) {
        circuit.state = "half-open";
        log.info(`Agent circuit half-open: ${agentName} (allowing probe request)`);
        return true;
      }
      return false;

    case "half-open":
      // Only one probe at a time — block additional concurrent requests
      if (circuit.probing) return false;
      circuit.probing = true;
      return true;
  }
}

/**
 * Record a successful agent execution.
 * Resets the circuit to closed state.
 */
export function recordAgentSuccess(agentName: string): void {
  const circuit = circuits.get(agentName);
  if (!circuit) return;

  if (circuit.state === "half-open") {
    log.info(`Agent circuit closed: ${agentName} (probe succeeded)`);
  }

  // Reset to healthy state
  circuit.state = "closed";
  circuit.failures = 0;
  circuit.probing = false;
}

/**
 * Record a failed agent execution.
 * Increments failure count and may open the circuit.
 */
export function recordAgentFailure(agentName: string): void {
  const now = Date.now();
  let circuit = circuits.get(agentName);

  if (!circuit) {
    circuit = { state: "closed", failures: 0, lastFailure: 0, openedAt: 0, probing: false };
    circuits.set(agentName, circuit);
  }

  // If the last failure was outside the reset window, start fresh
  if (now - circuit.lastFailure > RESET_WINDOW_MS) {
    circuit.failures = 0;
  }

  circuit.failures += 1;
  circuit.lastFailure = now;

  // Half-open probe failed — reopen immediately
  if (circuit.state === "half-open") {
    circuit.state = "open";
    circuit.openedAt = now;
    circuit.probing = false;
    log.warn(`Agent circuit reopened: ${agentName} (probe failed)`);
    return;
  }

  // Check threshold
  if (circuit.failures >= FAILURE_THRESHOLD) {
    circuit.state = "open";
    circuit.openedAt = now;
    log.warn(`Agent circuit opened: ${agentName} (${circuit.failures} consecutive failures)`);
  }
}

/**
 * Get the current state of an agent's circuit breaker (for monitoring).
 */
export function getAgentCircuitState(agentName: string): { state: CircuitState; failures: number } {
  const circuit = circuits.get(agentName);
  return circuit
    ? { state: circuit.state, failures: circuit.failures }
    : { state: "closed", failures: 0 };
}

/**
 * Reset a specific agent's circuit breaker (admin action).
 */
export function resetAgentCircuit(agentName: string): void {
  circuits.delete(agentName);
  log.info(`Agent circuit manually reset: ${agentName}`);
}
