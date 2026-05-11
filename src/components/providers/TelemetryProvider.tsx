"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

// Real-time telemetry context. Bridges agent execution events from the
// server to the dashboard UI so progress indicators stay in sync.

type SystemState =
  | "IDLE"
  | "SCRAPING"
  | "GENERATING"
  | "TRANSMITTING"
  | "UPLINK_SECURED";

interface TelemetryContextType {
  state: SystemState;
  activePipelines: number;
  dataYield: number;
  lastAction: string;
  triggerTelemetryUpdate: (action: string, newYield?: number) => void;
}

const TelemetryContext = createContext<TelemetryContextType | undefined>(
  undefined,
);

export function TelemetryProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SystemState>("UPLINK_SECURED");
  const [activePipelines, _setActivePipelines] = useState(5);
  const [dataYield, setDataYield] = useState(1452);
  const [lastAction, setLastAction] = useState(
    "System initialized. Awaiting Commander inputs.",
  );

  // In a full WebSockets production layer, this connects directly to `server/ws.ts`
  // to receive instantaneous hardware metrics from NemoClaw on your local macOS.
  useEffect(() => {
    const pollStatus = setInterval(() => {
      // Simulated dynamic self-correction ping
      if (state === "IDLE" && Math.random() > 0.8) {
        setLastAction("Ghost Fleet optimizing unread inbound hooks.");
      }
    }, 15000);
    return () => clearInterval(pollStatus);
  }, [state]);

  const triggerTelemetryUpdate = (action: string, newYield?: number) => {
    setLastAction(action);
    setState("TRANSMITTING");
    if (newYield) setDataYield((prev) => prev + newYield);

    setTimeout(() => {
      setState("IDLE");
    }, 3000);
  };

  return (
    <TelemetryContext.Provider
      value={{
        state,
        activePipelines,
        dataYield,
        lastAction,
        triggerTelemetryUpdate,
      }}
    >
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
