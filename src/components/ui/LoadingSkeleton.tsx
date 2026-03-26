"use client";

import { motion } from "framer-motion";

/**
 * LoadingSkeleton — Shimmer placeholder for dashboard pages.
 * Shows a branded loading state instead of blank screens.
 */

function Shimmer({ className = "" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-xl bg-white/[0.03] ${className}`}>
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.04] to-transparent"
        animate={{ x: ["-100%", "100%"] }}
        transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
      />
    </div>
  );
}

export function PageSkeleton() {
  return (
    <div className="p-6 lg:p-8 space-y-6 animate-in fade-in duration-300">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Shimmer className="h-8 w-48" />
          <Shimmer className="h-4 w-72" />
        </div>
        <Shimmer className="h-10 w-32 rounded-full" />
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Shimmer key={i} className="h-24 rounded-xl" />
        ))}
      </div>

      {/* Main content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-4">
          <Shimmer className="h-64 rounded-xl" />
          <Shimmer className="h-48 rounded-xl" />
        </div>
        <div className="space-y-4">
          <Shimmer className="h-40 rounded-xl" />
          <Shimmer className="h-40 rounded-xl" />
          <Shimmer className="h-32 rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {[...Array(count)].map((_, i) => (
        <Shimmer key={i} className="h-48 rounded-xl" />
      ))}
    </div>
  );
}

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2">
      <Shimmer className="h-10 rounded-lg" />
      {[...Array(rows)].map((_, i) => (
        <Shimmer key={i} className="h-14 rounded-lg" />
      ))}
    </div>
  );
}

export { Shimmer };
