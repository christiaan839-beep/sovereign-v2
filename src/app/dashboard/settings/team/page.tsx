"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Users, Mail, Shield, Pencil, Eye, Trash2, UserPlus, Crown } from "lucide-react";

const ROLES = ["Admin", "Editor", "Viewer"] as const;
type Role = (typeof ROLES)[number];

const ROLE_META: Record<Role, { color: string; icon: React.ComponentType<{ className?: string }>; desc: string }> = {
  Admin:  { color: "bg-amber-500/15 text-amber-400 border-amber-500/20", icon: Shield, desc: "Full access including billing & team management" },
  Editor: { color: "bg-blue-500/15 text-blue-400 border-blue-500/20", icon: Pencil, desc: "Run agents & edit content, no billing access" },
  Viewer: { color: "bg-neutral-500/15 text-neutral-400 border-neutral-500/20", icon: Eye, desc: "Read-only access to dashboards & reports" },
};

const MOCK_MEMBERS = [
  { id: 1, name: "You (Owner)", email: "you@sovereign.ai", role: "Admin" as Role, isOwner: true },
  { id: 2, name: "Sarah Chen", email: "sarah@company.com", role: "Editor" as Role, isOwner: false },
  { id: 3, name: "Marcus Lee", email: "marcus@company.com", role: "Viewer" as Role, isOwner: false },
];

export default function TeamSettingsPage() {
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role>("Viewer");
  const [members] = useState(MOCK_MEMBERS);

  return (
    <motion.div role="main" aria-label="Team settings" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }} className="min-h-screen bg-[#0A0A0A] p-6 lg:p-10 space-y-8">

      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight">Team Settings</h1>
        <p className="text-sm text-neutral-500 mt-1">Manage members, roles, and shared access.</p>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4 max-w-xl">
        {[{ label: "Team Size", value: members.length }, { label: "Seats Used", value: `${members.length}/10` }, { label: "Plan Limit", value: "10 seats" }].map((s) => (
          <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center">
            <p className="text-lg font-semibold text-white">{s.value}</p>
            <p className="text-[11px] text-neutral-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Invite section */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 max-w-2xl">
        <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4"><UserPlus className="w-4 h-4 text-neutral-400" />Invite Team Member</h2>
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="colleague@company.com"
              className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/20 transition-colors" />
          </div>
          <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value as Role)}
            className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-white/20 appearance-none cursor-pointer">
            {ROLES.map((r) => <option key={r} value={r} className="bg-[#111]">{r}</option>)}
          </select>
          <button aria-label="Send invite" className="px-5 py-2.5 bg-white text-black text-sm font-medium rounded-lg hover:bg-neutral-200 transition-colors shrink-0">
            Send Invite
          </button>
        </div>
      </div>

      {/* Role descriptions */}
      <div className="grid sm:grid-cols-3 gap-3 max-w-2xl">
        {ROLES.map((r) => { const m = ROLE_META[r]; return (
          <div key={r} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
            <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${m.color}`}>
              <m.icon className="w-3 h-3" />{r}
            </span>
            <p className="text-[11px] text-neutral-500 mt-2 leading-relaxed">{m.desc}</p>
          </div>
        )})}
      </div>

      {/* Members list */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden max-w-2xl">
        <div className="px-5 py-3 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2"><Users className="w-4 h-4 text-neutral-400" />Members ({members.length})</h2>
        </div>
        <div className="divide-y divide-white/[0.04]">
          {members.map((m) => { const rm = ROLE_META[m.role]; return (
            <div key={m.id} className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors">
              <div className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-bold text-neutral-400 shrink-0">
                {m.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate flex items-center gap-1.5">
                  {m.name}{m.isOwner && <Crown className="w-3 h-3 text-amber-500" />}
                </p>
                <p className="text-xs text-neutral-500 truncate">{m.email}</p>
              </div>
              <span className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border ${rm.color}`}>
                <rm.icon className="w-3 h-3" />{m.role}
              </span>
              {!m.isOwner && (
                <button aria-label={`Remove ${m.name}`} className="p-1.5 rounded-lg text-neutral-600 hover:text-red-400 hover:bg-red-500/10 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          )})}
        </div>
      </div>
    </motion.div>
  );
}
