"use client";

import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Network, ShieldCheck, Database, Zap, Terminal } from "lucide-react";
import { useUser } from "@clerk/nextjs";

const BOOT_SEQUENCE = [
  { id: 1, text: "Connecting to database...", icon: Database, delay: 0 },
  { id: 2, text: "Verifying authentication...", icon: ShieldCheck, delay: 0.8 },
  { id: 3, text: "Loading AI models...", icon: Network, delay: 1.6 },
  { id: 4, text: "Preparing agents...", icon: Zap, delay: 2.4 },
  { id: 5, text: "Checking system health...", icon: Activity, delay: 3.2 },
  { id: 6, text: "Ready.", icon: Terminal, delay: 4.0 },
];

export function CinematicOnboarding({ children }: { children: React.ReactNode }) {
  const { user, isLoaded } = useUser();
  const [showChildren, setShowChildren] = useState(false);
  const [activeStep, setActiveStep] = useState(0);
  const [hasRun, setHasRun] = useState(true); // Default true until mounted

  useEffect(() => {
    // Check session storage to only run once per session
    const ranThisSession = sessionStorage.getItem("sovereign_onboarded");
    if (!ranThisSession) {
      setHasRun(false);
    } else {
      setShowChildren(true);
    }
  }, []);

  useEffect(() => {
    if (hasRun || !isLoaded) return;

    // Run the boot sequence
    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < BOOT_SEQUENCE.length) {
        setActiveStep(currentStep);
        currentStep++;
      } else {
        clearInterval(interval);
        setTimeout(() => {
          sessionStorage.setItem("sovereign_onboarded", "true");
          setShowChildren(true);
        }, 1000);
      }
    }, 800);

    return () => clearInterval(interval);
  }, [hasRun, isLoaded]);

  // Don't block dashboard render on Clerk loading
  // Show children immediately for returning users (hasRun=true from sessionStorage)
  if (showChildren) return <>{children}</>;
  if (!isLoaded) return <>{children}</>; // Show content even while Clerk loads

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 1 }}
        exit={{ opacity: 0, scale: 1.05, filter: "blur(10px)" }}
        transition={{ duration: 1.2, ease: "easeInOut" }}
        className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center overflow-hidden"
      >
        {/* Background Grid */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 pointer-events-none mix-blend-overlay" />
        <div className="absolute inset-0 pointer-events-none opacity-[0.05] z-0" style={{ backgroundImage: 'linear-gradient(rgba(0,183,255,1) 1px, transparent 1px), linear-gradient(90deg, rgba(0,183,255,1) 1px, transparent 1px)', backgroundSize: '40px 40px', maskImage: 'radial-gradient(ellipse at center, black 20%, transparent 70%)' }} />

        <div className="relative z-10 w-full max-w-lg p-8">
          <div className="flex flex-col items-center space-y-8">
            
            {/* Logo Spinner */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 4, ease: "linear" }}
              className="relative w-24 h-24 rounded-full border border-[#00B7FF]/20 flex items-center justify-center shadow-[0_0_50px_rgba(0,183,255,0.2)]"
            >
              <div className="absolute inset-2 rounded-full border border-t-[#00B7FF] border-r-transparent border-b-transparent border-l-transparent animate-spin" />
              <Network className="w-8 h-8 text-[#00B7FF]" />
            </motion.div>

            <h1 className="text-xl font-mono text-white tracking-[0.2em] uppercase glow-text">
              Deploying Workspace
            </h1>

            {/* Terminal Steps */}
            <div className="w-full bg-black/50 border border-[#00B7FF]/10 rounded-xl p-4 font-mono text-xs space-y-3 shadow-2xl backdrop-blur-md">
              {BOOT_SEQUENCE.map((step, idx) => (
                <div key={step.id} className="h-6 flex items-center">
                  <AnimatePresence>
                    {activeStep >= idx && (
                      <motion.div
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-3 w-full"
                      >
                         <step.icon className={`w-4 h-4 shrink-0 ${activeStep === idx && idx !== BOOT_SEQUENCE.length - 1 ? "text-amber-400 animate-pulse" : "text-emerald-400"}`} />
                         <span className={`${activeStep === idx && idx !== BOOT_SEQUENCE.length - 1 ? "text-neutral-300" : "text-emerald-500/80"} flex-1`}>
                           {step.text}
                         </span>
                         {activeStep > idx ? (
                           <span className="text-emerald-400 shrink-0">[OK]</span>
                         ) : activeStep === idx && idx !== BOOT_SEQUENCE.length - 1 ? (
                           <span className="text-amber-400 shrink-0 font-bold animate-pulse">...</span>
                         ) : null}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>

            {/* Fake progress bar */}
            <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden mt-8">
              <motion.div 
                initial={{ width: "0%" }}
                animate={{ width: `${Math.min(((activeStep + 1) / BOOT_SEQUENCE.length) * 100, 100)}%` }}
                transition={{ duration: 0.5 }}
                className="h-full bg-gradient-to-r from-[#00B7FF] to-emerald-400 shadow-[0_0_10px_rgba(0,183,255,0.5)]"
              />
            </div>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
