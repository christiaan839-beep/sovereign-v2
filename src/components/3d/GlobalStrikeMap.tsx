"use client";

import createGlobe from "cobe";
import { useEffect, useRef } from "react";

// ⚡ SOVEREIGN ENTERPRISE //
// This renders a mathematically perfect 3D Earth, spinning at 60fps 
// using WebGL. It visualizes global data strikes running asynchronously.

export function GlobalStrikeMap() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let phi = 0;
    let width = 0;
    
    const onResize = () => {
      if (canvasRef.current) {
        // Account for high-DPI retina screens (MacBooks)
        width = canvasRef.current.offsetWidth;
      }
    };
    window.addEventListener("resize", onResize);
    onResize();

    if (!canvasRef.current) return;

    const globe = createGlobe(canvasRef.current, {
      devicePixelRatio: 2,
      width: width * 2,
      height: width * 2,
      phi: 0,
      theta: 0.2,
      dark: 1, // Absolute dark mode
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 6,
      baseColor: [0.1, 0.1, 0.1], // Jet black/dark grey base
      markerColor: [0.063, 0.725, 0.506], // Emerald 500 for Sovereign Matrix
      glowColor: [0.05, 0.05, 0.05],
      markers: [
        // Active Swarm Target Nodes (Longitude, Latitude)
        { location: [37.7595, -122.4367], size: 0.08 }, // San Francisco (HQ)
        { location: [40.7128, -74.0060], size: 0.05 },  // New York (Scraping node)
        { location: [51.5074, -0.1278], size: 0.04 },   // London (Ghost Fleet active)
        { location: [35.6762, 139.6503], size: 0.06 },  // Tokyo (N8N relay)
        { location: [-26.2041, 28.0473], size: 0.07 },  // Johannesburg (Origin)
      ],
      onRender: (state) => {
        // Spin globe mathematically
        state.phi = phi;
        phi += 0.003;
        state.width = width * 2;
        state.height = width * 2;
      },
    });

    return () => {
      globe.destroy();
      window.removeEventListener("resize", onResize);
    };
  }, []);

  return (
    <div className="relative w-full aspect-square max-w-[600px] mx-auto flex items-center justify-center">
       <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.15),transparent_70%)] z-0 rounded-full blur-3xl" />
       <canvas
         ref={canvasRef}
         className="w-full h-full object-contain opacity-90 z-10 transition-opacity duration-1000"
       />
       
       {/* Tactical HUD Overlay */}
       <div className="absolute bottom-8 left-8 z-20 flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-xs font-mono text-emerald-500 tracking-[0.2em] font-bold">GLOBAL SWARM UPLINK</span>
          </div>
          <span className="text-[10px] font-mono text-neutral-500 uppercase">5 Data Pipelines Active</span>
       </div>
    </div>
  );
}
