"use client";

import React from "react";
import { ScanEye, Activity, Camera, Video, Zap, Database } from "lucide-react";


export default function GodEyeSurveillancePage() {

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 min-h-screen bg-[#050505]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-neutral-400 text-[10px] font-bold uppercase tracking-widest mb-4">
            <ScanEye className="w-3 h-3" /> Surveillance Module
          </div>
          <h1 className="text-4xl font-bold text-white tracking-tight mb-2 font-serif">God-Eye Spatial Array</h1>
          <p className="text-neutral-500 text-sm max-w-2xl">
            Connect RTSP security camera feeds for real-time object detection, behavioral analysis, and biometric mapping at the edge.
          </p>
        </div>
        <div className="flex items-center gap-4 bg-black/40 border border-white/5 p-4 rounded-xl">
          <div className="flex flex-col">
            <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold mb-1">Live FPS</span>
            <span className="text-2xl font-mono text-neutral-600 flex items-center gap-2">
              &mdash; <Zap className="w-4 h-4" />
            </span>
          </div>
          <div className="w-px h-8 bg-white/10 mx-2" />
          <div className="flex flex-col">
            <span className="text-[10px] text-neutral-500 uppercase tracking-widest font-bold mb-1">Active Nodes</span>
            <span className="text-2xl font-mono text-neutral-600 flex items-center gap-2">
              0/0 <Camera className="w-4 h-4" />
            </span>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Main Feed — No cameras connected */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-black/40 border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative">
            <div className="aspect-video bg-neutral-900 relative flex items-center justify-center">
              <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none" />
              <div className="relative z-10 text-center space-y-6 p-8 max-w-md">
                <div className="w-20 h-20 mx-auto rounded-full bg-white/5 border border-white/10 flex items-center justify-center">
                  <Camera className="w-10 h-10 text-neutral-600" />
                </div>
                <div>
                  <p className="text-lg font-bold text-white mb-2">No Cameras Connected</p>
                  <p className="text-sm text-neutral-500 leading-relaxed">
                    Connect your RTSP security cameras to enable real-time surveillance, object detection, and behavioral analysis.
                  </p>
                </div>
                <button className="inline-flex items-center gap-2 px-6 py-3 bg-[#00B7FF]/10 text-[#00B7FF] border border-[#00B7FF]/30 rounded-xl text-xs font-bold uppercase tracking-widest hover:bg-[#00B7FF]/20 transition-colors">
                  <Video className="w-4 h-4" /> Setup Camera Feeds
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
             {[1,2,3,4].map((i) => (
               <div key={i} className="bg-neutral-900 border border-white/5 rounded-xl aspect-video relative overflow-hidden flex items-center justify-center">
                 <Camera className="w-4 h-4 text-white/10" />
                 <div className="absolute bottom-2 left-2 text-[8px] font-mono text-white/20">SLOT_{i}</div>
               </div>
             ))}
          </div>
        </div>

        {/* Right Panel - Incidents */}
        <div className="bg-black/40 border border-white/5 rounded-2xl flex flex-col">
          <div className="p-6 border-b border-white/5 flex items-center justify-between">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest">Threat Telemetry</h3>
            <Database className="w-4 h-4 text-neutral-500" />
          </div>
          <div className="p-6 space-y-4 flex-1 overflow-y-auto flex flex-col items-center justify-center">
            <div className="text-center space-y-3">
              <Activity className="w-8 h-8 text-neutral-700 mx-auto" />
              <p className="text-xs text-neutral-600 font-mono uppercase tracking-widest">No threat data</p>
              <p className="text-[10px] text-neutral-700">Connect cameras to begin threat detection</p>
            </div>
          </div>
          <div className="p-6 border-t border-white/5">
             <button className="w-full bg-[#00B7FF] hover:bg-[#00B7FF]/80 text-white text-xs font-bold uppercase tracking-widest py-3 rounded-xl transition-colors">
                Analyze Archival Footage
             </button>
          </div>
        </div>
      </div>
    </div>
  );
}
