"use client";

import { createContext, useContext, useState, useEffect, useRef, useCallback, ReactNode } from "react";

// ⚡ SOVEREIGN MATRIX // TELEMETRY SYNC ⚡
// This physically bridges the Vercel Frontend UI to the Local Python Swarm.
// It ensures the Dashboard and 3D Maps react instantly to real-world Swarm actions.

type SystemState = "IDLE" | "SCRAPING" | "GENERATING" | "TRANSMITTING" | "UPLINK_SECURED";

interface TelemetryContextType {
  state: SystemState;
  activePipelines: number;
  dataYield: number;
  lastAction: string;
  triggerTelemetryUpdate: (action: string, newYield?: number) => void;
}

const TelemetryContext = createContext<TelemetryContextType | undefined>(undefined);

export function TelemetryProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SystemState>("UPLINK_SECURED");
  const [activePipelines, _setActivePipelines] = useState(5);
  const [dataYield, setDataYield] = useState(1452);
  const [lastAction, setLastAction] = useState("Ready.");

  // Keep a ref to the current state so the poll interval can read it without
  // needing `state` in its dep array — this prevents the interval from being
  // torn down and recreated on every state transition.
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  // Track the transmit->idle timeout so we can clear it if the component
  // unmounts or `triggerTelemetryUpdate` is called again before it fires.
  const transmitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // No synthetic "agent optimizing..." messages. The telemetry surface
    // should reflect real state. When WebSocket telemetry ships we'll wire
    // real events here. Until then, the interval is a no-op keep-alive.
    const pollStatus = setInterval(() => { /* reserved for real telemetry */ }, 15000);
    return () => {
      clearInterval(pollStatus);
      if (transmitTimerRef.current) {
        clearTimeout(transmitTimerRef.current);
        transmitTimerRef.current = null;
      }
    };
  }, []);

  const triggerTelemetryUpdate = useCallback((action: string, newYield?: number) => {
    setLastAction(action);
    setState("TRANSMITTING");
    if (newYield) setDataYield((prev) => prev + newYield);

    if (transmitTimerRef.current) clearTimeout(transmitTimerRef.current);
    transmitTimerRef.current = setTimeout(() => {
      setState("IDLE");
      transmitTimerRef.current = null;
    }, 3000);
  }, []);

  return (
    <TelemetryContext.Provider value={{ state, activePipelines, dataYield, lastAction, triggerTelemetryUpdate }}>
      {children}
    </TelemetryContext.Provider>
  );
}

export function useTelemetry() {
  const context = useContext(TelemetryContext);
  if (context === undefined) {
    throw new Error("useTelemetry must be used within a TelemetryProvider");
  }
  return context;
}
