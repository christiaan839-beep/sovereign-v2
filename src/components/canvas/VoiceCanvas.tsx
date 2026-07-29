"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface VoiceCanvasProps {
  onResult: (text: string) => void;
  disabled?: boolean;
}

export function VoiceCanvas({ onResult, disabled }: VoiceCanvasProps) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = "";
      let final = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      setTranscript(final || interim);
      if (final) {
        onResult(final);
        setListening(false);
        recognition.stop();
      }
    };

    recognition.onerror = () => {
      setListening(false);
    };

    recognition.onend = () => {
      setListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
    setTranscript("");
  }, [onResult]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
    if (transcript) {
      onResult(transcript);
    }
  }, [transcript, onResult]);

  // Cleanup on unmount
  useEffect(() => {
    return () => { recognitionRef.current?.stop(); };
  }, []);

  return (
    <div className="relative">
      <button
        onClick={listening ? stopListening : startListening}
        disabled={disabled}
        aria-label={listening ? "Stop listening" : "Start voice input"}
        aria-pressed={listening}
        className={`p-2.5 rounded-xl transition-gpu shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white ${
          listening
            ? "bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse"
            : "hover:bg-white/[0.05] text-neutral-500 hover:text-white"
        } disabled:opacity-30`}
        title={listening ? "Stop listening" : "Voice input"}
      >
        {listening ? <MicOff className="w-4 h-4" aria-hidden="true" /> : <Mic className="w-4 h-4" aria-hidden="true" />}
      </button>

      {/* Live transcript tooltip */}
      <AnimatePresence>
        {listening && transcript && (
          <motion.div
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 5 }}
            className="absolute bottom-full right-0 mb-2 px-3 py-1.5 rounded-lg bg-[#0A0A0A] border border-white/[0.08] text-xs text-neutral-300 max-w-[200px] truncate shadow-lg"
          >
            {transcript}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Add declarations for webkit prefix
declare global {
  interface Window {
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}
