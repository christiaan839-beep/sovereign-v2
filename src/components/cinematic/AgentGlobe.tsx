"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";

// Major tech hubs where agents operate
const AGENT_HUBS = [
  { lat: 37.7749, lng: -122.4194, label: "San Francisco" },
  { lat: 40.7128, lng: -74.006, label: "New York" },
  { lat: 51.5074, lng: -0.1278, label: "London" },
  { lat: 52.52, lng: 13.405, label: "Berlin" },
  { lat: 1.3521, lng: 103.8198, label: "Singapore" },
  { lat: 35.6762, lng: 139.6503, label: "Tokyo" },
  { lat: -33.8688, lng: 151.2093, label: "Sydney" },
  { lat: 48.8566, lng: 2.3522, label: "Paris" },
  { lat: 25.2048, lng: 55.2708, label: "Dubai" },
  { lat: -23.5505, lng: -46.6333, label: "São Paulo" },
  { lat: 19.076, lng: 72.8777, label: "Mumbai" },
  { lat: 43.6532, lng: -79.3832, label: "Toronto" },
  { lat: 37.5665, lng: 126.978, label: "Seoul" },
  { lat: 55.7558, lng: 37.6173, label: "Moscow" },
  { lat: 31.2304, lng: 121.4737, label: "Shanghai" },
];

// Emerald = data flows, Cyan = AI inference, Violet = agent handoffs
type ArcColor = [number, number, number, number];
const EMERALD: ArcColor = [0.063, 0.725, 0.506, 0.8];
const CYAN: ArcColor    = [0.086, 0.827, 0.878, 0.7];
const VIOLET: ArcColor  = [0.651, 0.545, 0.984, 0.7];

const ARCS = [
  // Transatlantic — high volume
  { startLat: 37.7749, startLng: -122.4194, endLat: 51.5074, endLng: -0.1278, arcAlt: 0.35, color: EMERALD },
  { startLat: 40.7128, startLng: -74.006, endLat: 48.8566, endLng: 2.3522, arcAlt: 0.28, color: CYAN },
  { startLat: 40.7128, startLng: -74.006, endLat: 51.5074, endLng: -0.1278, arcAlt: 0.22, color: VIOLET },
  // Asia-Pacific
  { startLat: 1.3521, startLng: 103.8198, endLat: 35.6762, endLng: 139.6503, arcAlt: 0.2, color: CYAN },
  { startLat: 37.5665, startLng: 126.978, endLat: 31.2304, endLng: 121.4737, arcAlt: 0.12, color: EMERALD },
  { startLat: -33.8688, startLng: 151.2093, endLat: 1.3521, endLng: 103.8198, arcAlt: 0.28, color: VIOLET },
  // Europe
  { startLat: 51.5074, startLng: -0.1278, endLat: 52.52, endLng: 13.405, arcAlt: 0.1, color: EMERALD },
  { startLat: 48.8566, startLng: 2.3522, endLat: 55.7558, endLng: 37.6173, arcAlt: 0.18, color: CYAN },
  // Intercontinental long-haul
  { startLat: 37.7749, startLng: -122.4194, endLat: 1.3521, endLng: 103.8198, arcAlt: 0.55, color: EMERALD },
  { startLat: 40.7128, startLng: -74.006, endLat: -23.5505, endLng: -46.6333, arcAlt: 0.38, color: CYAN },
  { startLat: 37.7749, startLng: -122.4194, endLat: 43.6532, endLng: -79.3832, arcAlt: 0.15, color: VIOLET },
  // Middle East ↔ Asia
  { startLat: 25.2048, startLng: 55.2708, endLat: 19.076, endLng: 72.8777, arcAlt: 0.15, color: EMERALD },
  { startLat: 25.2048, startLng: 55.2708, endLat: 1.3521, endLng: 103.8198, arcAlt: 0.3, color: VIOLET },
  // Americas
  { startLat: 43.6532, startLng: -79.3832, endLat: -23.5505, endLng: -46.6333, arcAlt: 0.4, color: CYAN },
  { startLat: 37.7749, startLng: -122.4194, endLat: 19.076, endLng: 72.8777, arcAlt: 0.6, color: EMERALD },
  // Pacific diagonal
  { startLat: 35.6762, startLng: 139.6503, endLat: -33.8688, endLng: 151.2093, arcAlt: 0.2, color: VIOLET },
];

export function AgentGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const globeRef = useRef<ReturnType<typeof import("cobe")["default"]> | null>(null);
  const phiRef = useRef(0);

  useEffect(() => {
    let mounted = true;

    async function init() {
      if (!canvasRef.current || !mounted) return;
      const createGlobe = (await import("cobe")).default;

      globeRef.current = createGlobe(canvasRef.current, {
        devicePixelRatio: Math.min(window.devicePixelRatio, 2),
        width: 800,
        height: 800,
        phi: 0.5,
        theta: 0.25,
        dark: 1,
        diffuse: 1.8,
        mapSamples: 20000,
        mapBrightness: 8,
        baseColor: [0.04, 0.04, 0.05],
        markerColor: [0.063, 0.725, 0.506],
        glowColor: [0.063, 0.725, 0.506],
        scale: 1.1,
        markers: AGENT_HUBS.map((hub) => ({
          location: [hub.lat, hub.lng],
          size: 0.05,
        })),
        arcs: ARCS.map((arc) => ({
          startLat: arc.startLat,
          startLng: arc.startLng,
          endLat: arc.endLat,
          endLng: arc.endLng,
          arcAlt: arc.arcAlt,
          color: arc.color,
          strokeWidth: 0.5,
        })),
        onRender(state) {
          phiRef.current += 0.0025;
          state.phi = phiRef.current;
        },
      });
    }

    init();

    return () => {
      mounted = false;
      globeRef.current?.destroy();
    };
  }, []);

  return (
    <section className="py-24 px-6 relative overflow-hidden bg-[#010101]">
      {/* Ambient glow behind globe */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-emerald-500/[0.04] blur-[120px]" />
      </div>

      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-16 items-center">

          {/* Left — text */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-emerald-500/60 mb-4">Agent Network</p>
            <h2 className="text-3xl md:text-5xl font-black text-white tracking-tight leading-[1.1] mb-6">
              Your agents.<br />
              <span className="text-emerald-400">Operating everywhere.</span>
            </h2>
            <p className="text-neutral-400 text-sm leading-relaxed mb-8 max-w-sm">
              130 specialized agents deployed across 15 global data centers.
              Zero latency regardless of where your leads, content, or competitors are.
            </p>

            {/* Live stat pills */}
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: "Active agents", value: "130", accent: "emerald" },
                { label: "Data centers", value: "15", accent: "cyan" },
                { label: "Uptime", value: "99.9%", accent: "emerald" },
                { label: "Avg latency", value: "<180ms", accent: "violet" },
              ].map((stat) => (
                <div key={stat.label} className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.02]">
                  <div className={`text-lg font-black text-${stat.accent}-400 mb-0.5`}>{stat.value}</div>
                  <div className="text-[10px] text-neutral-500">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Animated pulse showing live activity */}
            <div className="mt-6 flex items-center gap-3">
              <div className="relative flex h-2 w-2">
                <span className="animate-ping absolute h-full w-full rounded-full bg-emerald-400 opacity-60" />
                <span className="relative rounded-full h-2 w-2 bg-emerald-400" />
              </div>
              <span className="text-xs text-neutral-500">
                <span className="text-emerald-400 font-semibold">Agents active now</span> — processing 24/7
              </span>
            </div>
          </motion.div>

          {/* Right — Globe */}
          <motion.div
            initial={{ opacity: 0, scale: 0.85 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex items-center justify-center"
          >
            {/* Outer ring */}
            <div className="absolute w-[360px] h-[360px] rounded-full border border-emerald-500/10 animate-spin-slow" />
            <div className="absolute w-[420px] h-[420px] rounded-full border border-white/[0.03]" />

            {/* Globe canvas — oversized then overflow:hidden for edge-bleed effect */}
            <div className="relative w-[380px] h-[380px] overflow-hidden rounded-full">
              <canvas
                ref={canvasRef}
                style={{
                  width: "100%",
                  height: "100%",
                  contain: "layout style size",
                }}
              />
              {/* Radial fade — tighter to show more globe */}
              <div className="absolute inset-0 rounded-full bg-[radial-gradient(ellipse_at_center,transparent_65%,#010101_100%)] pointer-events-none" />
            </div>

            {/* Floating city labels with pulsing dots */}
            {[
              { label: "SF", top: "18%", left: "4%", delay: 0 },
              { label: "NYC", top: "22%", left: "24%", delay: 0.6 },
              { label: "London", top: "12%", right: "18%", delay: 1.2 },
              { label: "Singapore", bottom: "30%", right: "6%", delay: 1.8 },
              { label: "Sydney", bottom: "16%", right: "20%", delay: 2.4 },
              { label: "Tokyo", top: "35%", right: "4%", delay: 0.9 },
            ].map((city) => (
              <motion.div
                key={city.label}
                className="absolute flex items-center gap-1 pointer-events-none"
                style={{ top: city.top, left: city.left, right: (city as { right?: string }).right, bottom: (city as { bottom?: string }).bottom }}
                animate={{ opacity: [0.4, 1, 0.4] }}
                transition={{ duration: 2.5, repeat: Infinity, delay: city.delay }}
              >
                <span className="w-1 h-1 rounded-full bg-emerald-400 block" />
                <span className="text-[9px] font-mono text-emerald-400/70">{city.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
