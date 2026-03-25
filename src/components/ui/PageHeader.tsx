"use client";

import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: ReactNode;
  badge?: ReactNode;
  className?: string;
}

export function PageHeader({ title, description, actions, badge, className = "" }: PageHeaderProps) {
  return (
    <div className={`flex items-start justify-between gap-4 mb-8 ${className}`}>
      <div>
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-white tracking-tight">{title}</h1>
          {badge}
        </div>
        {description && <p className="text-sm text-neutral-400 mt-1">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}
