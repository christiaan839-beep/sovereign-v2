"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Activity } from "lucide-react";

export function JarvisSocket() {
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [response, setResponse] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    // Request permissions early if possible, or wait until click.
    // We'll wait until click to avoid annoying the user on load.
  }, []);

  const startRecording = async () => {
    if (isRecording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          audioChunksRef.current.push(e.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, {
          type: "audio/webm",
        });
        await processAudioCommand(audioBlob);

        // Stop all tracks to release microphone
        stream.getTracks().forEach((track) => track.stop());
      };

      mediaRecorder.start();
      setIsRecording(true);
      setTranscript("Listening...");
      setResponse(null);
    } catch {
      setResponse(
        "Microphone access denied. Please check your browser permissions.",
      );
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      setIsProcessing(true);
      setTranscript("Encrypting somatic vector...");
    }
  };

  const processAudioCommand = async (_blob: Blob) => {
    // In a true production environment, we'd send the blob physical WebM to Gemini 1.5 Pro via a FormData upload.
    // For the simulation / UI phase, we'll simulate the god-brain interpreting a payload.

    await new Promise((r) => setTimeout(r, 1200));
    setTranscript("Command parsed.");
    setResponse("Affirmative, Commander. Routing vectors to the Swarm.");

    await new Promise((r) => setTimeout(r, 1500));
    setIsProcessing(false);
    setTranscript(null);

    // Auto-hide response after 3 seconds
    setTimeout(() => setResponse(null), 3000);
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-end gap-4 shadow-2xl">
      {/* Status Tooltip */}
      <AnimatePresence>
        {(transcript || response) && (
          <motion.div
            initial={{ opacity: 0, x: 20, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 20, scale: 0.9 }}
            className="mb-2 bg-black/80 backdrop-blur-2xl border border-electric/30 rounded-xl p-4 min-w-[200px] shadow-[0_0_30px_rgba(0,183,255,0.15)]"
          >
            <p
              className={`text-xs font-mono uppercase tracking-widest ${response ? "text-emerald-400" : "text-electric"}`}
            >
              {response || transcript}
            </p>
            {isRecording && (
              <div className="mt-2 flex gap-1 h-2 items-center">
                <motion.div
                  animate={{ height: [4, 12, 4] }}
                  transition={{ repeat: Infinity, duration: 0.5 }}
                  className="w-1 bg-electric rounded-full"
                />
                <motion.div
                  animate={{ height: [4, 16, 4] }}
                  transition={{ repeat: Infinity, duration: 0.7 }}
                  className="w-1 bg-electric rounded-full"
                />
                <motion.div
                  animate={{ height: [4, 8, 4] }}
                  transition={{ repeat: Infinity, duration: 0.6 }}
                  className="w-1 bg-electric rounded-full"
                />
                <motion.div
                  animate={{ height: [4, 14, 4] }}
                  transition={{ repeat: Infinity, duration: 0.8 }}
                  className="w-1 bg-electric rounded-full"
                />
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* The Socket Button */}
      <motion.button
        onMouseDown={startRecording}
        onMouseUp={stopRecording}
        onMouseLeave={stopRecording}
        onTouchStart={startRecording}
        onTouchEnd={stopRecording}
        onKeyDown={(e) => {
          if (e.key === " " || e.key === "Enter") startRecording();
        }}
        onKeyUp={(e) => {
          if (e.key === " " || e.key === "Enter") stopRecording();
        }}
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        aria-label="Hold to record voice command"
        className={`w-16 h-16 rounded-full flex items-center justify-center relative cursor-pointer select-none transition-colors border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#00B7FF]
                    ${
                      isRecording
                        ? "bg-electric border-electric shadow-[0_0_40px_currentColor]"
                        : isProcessing
                          ? "bg-midnight border-electric/50 text-electric"
                          : "bg-black/60 border-glass-border backdrop-blur-xl text-white hover:border-electric/50 hover:bg-black/80"
                    }`}
      >
        {/* Sonar Pings when recording */}
        {isRecording && (
          <>
            <motion.div
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 2, opacity: 0 }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="absolute inset-0 rounded-full bg-electric"
            />
            <motion.div
              initial={{ scale: 1, opacity: 0.5 }}
              animate={{ scale: 2.5, opacity: 0 }}
              transition={{ repeat: Infinity, duration: 2, delay: 0.5 }}
              className="absolute inset-0 rounded-full bg-electric"
            />
          </>
        )}

        {isProcessing ? (
          <Activity className="w-6 h-6 animate-pulse" />
        ) : (
          <Mic className="w-6 h-6 relative z-10" />
        )}
      </motion.button>
    </div>
  );
}
