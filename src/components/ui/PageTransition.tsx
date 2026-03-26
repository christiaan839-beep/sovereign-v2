"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

/**
 * PageTransition — Smooth fade+slide for route changes.
 * Wrap any page content for cinematic entry animations.
 */
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.25, 0.46, 0.45, 0.94] }}
    >
      {children}
    </motion.div>
  );
}
