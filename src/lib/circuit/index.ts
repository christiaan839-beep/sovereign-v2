/**
 * SOVEREIGN MATRIX — Circuit Breakers (canonical entry point)
 *
 * Three layers of fault isolation, each with a distinct scope. New code
 * should import from this barrel rather than the underlying modules.
 *
 * ┌───────────────────────────────┬───────────────────────────────────────────┐
 * │ Use case                      │ Entry point                               │
 * ├───────────────────────────────┼───────────────────────────────────────────┤
 * │ Per-MODEL breakers (gemini /  │ nimBreaker / geminiBreaker / claudeBreaker│
 * │ claude / nim / groq)          │ / groqBreaker / getCircuitStatus from     │
 * │                               │ `circuit-breaker`                         │
 * │                               │                                           │
 * │ Per-AGENT breakers (one bad   │ isAgentAvailable / recordAgentSuccess /   │
 * │ agent shouldn't sink siblings)│ recordAgentFailure / getAgentCircuitState │
 * │                               │ / resetAgentCircuit from                  │
 * │                               │ `agent-circuit-breaker`                   │
 * │                               │                                           │
 * │ High-level reliable wrapper   │ reliableNimCall / getReplayStore /        │
 * │ (retries + replay logging)    │ getReplayById from `agent-reliability`    │
 * └───────────────────────────────┴───────────────────────────────────────────┘
 *
 * Pick the layer whose verbs match your task — they are not interchangeable.
 */

// ── Per-model breakers ──────────────────────────────────────────────────────
export {
  nimBreaker,
  geminiBreaker,
  claudeBreaker,
  groqBreaker,
  getCircuitStatus,
} from "@/lib/circuit-breaker";

// ── Per-agent breakers ──────────────────────────────────────────────────────
export {
  isAgentAvailable,
  recordAgentSuccess,
  recordAgentFailure,
  getAgentCircuitState,
  resetAgentCircuit,
} from "@/lib/agent-circuit-breaker";

// ── Reliable wrapper (retries + replay) ─────────────────────────────────────
export {
  reliableNimCall,
  getReplayStore,
  getReplayById,
} from "@/lib/agent-reliability";
