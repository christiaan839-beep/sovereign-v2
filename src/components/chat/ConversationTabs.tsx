"use client";

import type { Conversation } from "./types";

interface ConversationTabsProps {
  conversations: Conversation[];
  activeId: string;
  onSelect: (id: string) => void;
  onNew: () => void;
  onClose: (id: string) => void;
}

export function ConversationTabs({ conversations, activeId, onSelect, onNew, onClose }: ConversationTabsProps) {
  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-white/[0.04] overflow-x-auto scrollbar-hide">
      {conversations.map((c) => (
        <button
          key={c.id}
          onClick={() => onSelect(c.id)}
          className={`group flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-gpu ${
            c.id === activeId
              ? "bg-white/[0.06] text-white border border-white/[0.08]"
              : "text-neutral-500 hover:text-neutral-300 hover:bg-white/[0.03]"
          }`}
        >
          <span className="max-w-[120px] truncate">{c.title}</span>
          {conversations.length > 1 && (
            <span
              onClick={(e) => {
                e.stopPropagation();
                onClose(c.id);
              }}
              className="opacity-0 group-hover:opacity-100 hover:text-red-400 transition-opacity cursor-pointer"
            >
              x
            </span>
          )}
        </button>
      ))}
      {conversations.length < 8 && (
        <button
          onClick={onNew}
          className="px-2 py-1.5 text-neutral-600 hover:text-emerald-400 text-sm transition-colors"
          title="New conversation"
        >
          +
        </button>
      )}
    </div>
  );
}
