"use client";

import { ReactNode } from "react";
import { LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, action, className = "" }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center py-16 px-6 text-center ${className}`}>
      <div className="w-14 h-14 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-4">
        <Icon className="w-6 h-6 text-neutral-600" />
      </div>
      <h3 className="text-sm font-semibold text-neutral-300 mb-1">{title}</h3>
      <p className="text-xs text-neutral-500 max-w-xs mb-4">{description}</p>
      {action}
    </div>
  );
}
