/**
 * Tests for src/lib/agent-circuit-breaker.ts — Agent-Level Circuit Breaker
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  isAgentAvailable,
  recordAgentSuccess,
  recordAgentFailure,
  getAgentCircuitState,
  resetAgentCircuit,
} from "@/lib/agent-circuit-breaker";

describe("agent-circuit-breaker.ts", () => {
  beforeEach(() => {
    resetAgentCircuit("test-agent");
  });

  // ── Closed State (Normal) ──

  it("new agent is available (closed state)", () => {
    expect(isAgentAvailable("test-agent")).toBe(true);
    expect(getAgentCircuitState("test-agent")).toEqual({ state: "closed", failures: 0 });
  });

  it("stays closed after a few failures", () => {
    recordAgentFailure("test-agent");
    recordAgentFailure("test-agent");
    recordAgentFailure("test-agent");
    expect(isAgentAvailable("test-agent")).toBe(true);
    expect(getAgentCircuitState("test-agent").state).toBe("closed");
    expect(getAgentCircuitState("test-agent").failures).toBe(3);
  });

  // ── Open State (Circuit Tripped) ──

  it("opens after 5 consecutive failures", () => {
    for (let i = 0; i < 5; i++) recordAgentFailure("test-agent");
    expect(isAgentAvailable("test-agent")).toBe(false);
    expect(getAgentCircuitState("test-agent").state).toBe("open");
  });

  it("blocks requests when open", () => {
    for (let i = 0; i < 5; i++) recordAgentFailure("test-agent");
    expect(isAgentAvailable("test-agent")).toBe(false);
    expect(isAgentAvailable("test-agent")).toBe(false);
    expect(isAgentAvailable("test-agent")).toBe(false);
  });

  // ── Success Resets ──

  it("success resets failure count", () => {
    recordAgentFailure("test-agent");
    recordAgentFailure("test-agent");
    recordAgentSuccess("test-agent");
    expect(getAgentCircuitState("test-agent").failures).toBe(0);
    expect(getAgentCircuitState("test-agent").state).toBe("closed");
  });

  // ── Independent Agents ──

  it("circuits are independent per agent", () => {
    for (let i = 0; i < 5; i++) recordAgentFailure("agent-a");
    expect(isAgentAvailable("agent-a")).toBe(false);
    expect(isAgentAvailable("agent-b")).toBe(true);
    resetAgentCircuit("agent-a");
  });

  // ── Manual Reset ──

  it("reset clears circuit state", () => {
    for (let i = 0; i < 5; i++) recordAgentFailure("test-agent");
    expect(isAgentAvailable("test-agent")).toBe(false);
    resetAgentCircuit("test-agent");
    expect(isAgentAvailable("test-agent")).toBe(true);
    expect(getAgentCircuitState("test-agent")).toEqual({ state: "closed", failures: 0 });
  });
});
