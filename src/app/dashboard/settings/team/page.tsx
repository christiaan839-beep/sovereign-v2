"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Users, Mail, Shield, Pencil, Eye, Trash2, UserPlus, Crown,
  Loader2, AlertTriangle, RefreshCw, UserX, Lock, ChevronDown,
} from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  type Role,
  ROLE_META,
  ASSIGNABLE_ROLES,
  ALL_ROLES,
  canManageTeam,
  canEditSettings,
} from "@/lib/rbac";

/* ─── Types ─── */

interface TeamMember {
  id: number;
  name: string;
  email: string;
  role: Role;
  isOwner: boolean;
}

/* ─── Role icon lookup ─── */

const ROLE_ICONS: Record<Role, React.ComponentType<{ className?: string }>> = {
  owner: Crown,
  admin: Shield,
  editor: Pencil,
  viewer: Eye,
};

export default function TeamSettingsPage() {
  const [email, setEmail] = useState("");
  const [selectedRole, setSelectedRole] = useState<Role>("viewer");
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [inviteStatus, setInviteStatus] = useState<"idle" | "success" | "error">("idle");
  // Current user's role (fetched from API or inferred)
  const [currentUserRole, setCurrentUserRole] = useState<Role>("viewer");
  const [changingRole, setChangingRole] = useState<number | null>(null);

  const isManager = canManageTeam(currentUserRole);
  const isEditor = canEditSettings(currentUserRole);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "members" }),
      });
      if (!res.ok) throw new Error(`Server error (${res.status})`);
      const data = await res.json();
      if (data.members) {
        setMembers(data.members);
        // Determine current user's role from response
        if (data.currentUserRole) {
          setCurrentUserRole(data.currentUserRole as Role);
        } else if (data.members.length > 0) {
          // Fallback: find the owner or first member
          const owner = data.members.find((m: TeamMember) => m.isOwner);
          if (owner) setCurrentUserRole("owner");
        }
      } else {
        // Fallback for when API not fully wired
        setMembers([
          { id: 1, name: "You (Owner)", email: "\u2014", role: "owner", isOwner: true },
        ]);
        setCurrentUserRole("owner");
      }
    } catch {
      setError("Could not load team members. Please try again.");
      setMembers([
        { id: 1, name: "You (Owner)", email: "\u2014", role: "owner", isOwner: true },
      ]);
      setCurrentUserRole("owner");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMembers();
  }, [fetchMembers]);

  const handleInvite = async () => {
    if (!email.trim() || !email.includes("@")) return;
    setInviting(true);
    setInviteStatus("idle");
    try {
      const res = await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "invite",
          email: email.trim(),
          role: selectedRole,
        }),
      });
      if (res.ok) {
        setInviteStatus("success");
        setEmail("");
        fetchMembers();
        setTimeout(() => setInviteStatus("idle"), 3000);
      } else {
        setInviteStatus("error");
        setTimeout(() => setInviteStatus("idle"), 3000);
      }
    } catch {
      setInviteStatus("error");
      setTimeout(() => setInviteStatus("idle"), 3000);
    } finally {
      setInviting(false);
    }
  };

  const handleRoleChange = async (memberId: number, newRole: Role) => {
    setChangingRole(memberId);
    try {
      await fetch("/api/organizations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_role",
          memberId,
          role: newRole,
        }),
      });
      await fetchMembers();
    } catch {
      // Silently fail and refresh
      await fetchMembers();
    } finally {
      setChangingRole(null);
    }
  };

  const nonOwnerCount = members.filter((m) => !m.isOwner).length;

  /* ── Loading Skeleton ── */
  if (loading) {
    return (
      <div className="p-6 lg:p-10 space-y-8" aria-busy="true" aria-label="Loading team settings">
        <div className="space-y-2">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center space-y-2"
            >
              <Skeleton className="h-5 w-12 mx-auto" />
              <Skeleton className="h-3 w-16 mx-auto" />
            </div>
          ))}
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 max-w-2xl space-y-4">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden max-w-2xl">
          <div className="px-5 py-3 border-b border-white/[0.06]">
            <Skeleton className="h-4 w-28" />
          </div>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4">
              <Skeleton variant="circle" className="w-9 h-9" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-44" />
              </div>
              <Skeleton className="h-6 w-16 rounded-full" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      role="main"
      aria-label="Team settings"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      className="min-h-screen p-6 lg:p-10 space-y-8"
    >
      {/* Header with role badge */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">
            Team Settings
          </h1>
          <p className="text-sm text-neutral-400 mt-1">
            Manage members, roles, and shared access.
          </p>
        </div>
        {/* Current user role badge */}
        <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border ${ROLE_META[currentUserRole].bgColor} ${ROLE_META[currentUserRole].borderColor} ${ROLE_META[currentUserRole].color}`}>
          {(() => { const Icon = ROLE_ICONS[currentUserRole]; return <Icon className="w-3.5 h-3.5" />; })()}
          Your role: {ROLE_META[currentUserRole].label}
        </div>
      </div>

      {/* Read-only banner for viewers */}
      {!isEditor && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-xl border border-amber-500/20 bg-amber-500/5 max-w-2xl"
        >
          <Lock className="w-5 h-5 text-amber-400 shrink-0" />
          <p className="text-sm text-amber-300">
            You have read-only access. Contact an admin or owner to modify team settings.
          </p>
        </motion.div>
      )}

      {/* Error banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 max-w-2xl"
          role="alert"
        >
          <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
          <p className="text-sm text-rose-300 flex-1">{error}</p>
          <button
            onClick={fetchMembers}
            className="inline-flex items-center gap-1.5 text-xs text-rose-400 hover:text-rose-300 font-medium transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            Retry
          </button>
        </motion.div>
      )}

      {/* Stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-xl">
        {[
          { label: "Team Size", value: members.length },
          { label: "Seats Used", value: `${members.length}/10` },
          { label: "Plan Limit", value: "10 seats" },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4 text-center"
          >
            <p className="text-lg font-semibold text-white">{s.value}</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Invite section — only visible to managers */}
      {isManager && (
        <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 max-w-2xl">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2 mb-4">
            <UserPlus className="w-4 h-4 text-neutral-400" />
            Invite Team Member
          </h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@company.com"
                aria-label="Team member email address"
                className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-white/20 transition-colors"
              />
            </div>
            {/* Role dropdown for invite */}
            <div className="relative">
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value as Role)}
                aria-label="Select role for new team member"
                className="bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2.5 pr-8 text-sm text-white focus:outline-none focus:border-white/20 appearance-none cursor-pointer min-w-[120px]"
              >
                {ASSIGNABLE_ROLES.map((r) => (
                  <option key={r} value={r} className="bg-[#111]">
                    {ROLE_META[r].label}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-neutral-500 pointer-events-none" />
            </div>
            <button
              onClick={handleInvite}
              disabled={inviting || !email.trim()}
              aria-label="Send invite"
              className="px-5 py-2.5 bg-white text-black text-sm font-medium rounded-lg hover:bg-neutral-200 transition-colors shrink-0 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 justify-center"
            >
              {inviting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Sending...
                </>
              ) : (
                "Send Invite"
              )}
            </button>
          </div>
          {inviteStatus === "success" && (
            <p className="text-xs text-emerald-400 mt-2 font-medium" role="status">
              Invite sent successfully
            </p>
          )}
          {inviteStatus === "error" && (
            <p className="text-xs text-rose-400 mt-2 font-medium" role="alert">
              Failed to send invite. Please try again.
            </p>
          )}
        </div>
      )}

      {/* Role descriptions */}
      <div className="grid sm:grid-cols-4 gap-3 max-w-3xl">
        {ALL_ROLES.map((r) => {
          const meta = ROLE_META[r];
          const Icon = ROLE_ICONS[r];
          return (
            <div
              key={r}
              className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3"
            >
              <span
                className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${meta.bgColor} ${meta.borderColor} ${meta.color}`}
              >
                <Icon className="w-3 h-3" />
                {meta.label}
              </span>
              <p className="text-[11px] text-neutral-400 mt-2 leading-relaxed">
                {meta.description}
              </p>
            </div>
          );
        })}
      </div>

      {/* Members list */}
      <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] overflow-hidden max-w-2xl">
        <div className="px-5 py-3 border-b border-white/[0.06]">
          <h2 className="text-sm font-semibold text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-neutral-400" />
            Members ({members.length})
          </h2>
        </div>

        {members.length === 0 ? (
          <div className="text-center py-12 px-6">
            <UserX className="w-8 h-8 text-neutral-500 mx-auto mb-3" />
            <h3 className="text-sm font-semibold text-white mb-1">
              No team members yet
            </h3>
            <p className="text-xs text-neutral-400 max-w-sm mx-auto">
              Invite colleagues using the form above to start collaborating on
              your AI workflows.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-white/[0.04]">
            {members.map((m) => {
              const meta = ROLE_META[m.role] || ROLE_META.viewer;
              const Icon = ROLE_ICONS[m.role] || Eye;
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-4 px-5 py-4 hover:bg-white/[0.02] transition-colors"
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-white/[0.06] flex items-center justify-center text-xs font-bold text-neutral-300 shrink-0">
                    {m.name.charAt(0)}
                  </div>

                  {/* Name & email */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white truncate flex items-center gap-1.5">
                      {m.name}
                      {m.isOwner && (
                        <Crown className="w-3 h-3 text-amber-500" />
                      )}
                    </p>
                    <p className="text-xs text-neutral-400 truncate">
                      {m.email}
                    </p>
                  </div>

                  {/* Role badge / dropdown */}
                  {isManager && !m.isOwner ? (
                    // Managers can change roles of non-owners
                    <div className="relative">
                      <select
                        value={m.role}
                        onChange={(e) => handleRoleChange(m.id, e.target.value as Role)}
                        disabled={changingRole === m.id}
                        aria-label={`Change role for ${m.name}`}
                        className={`text-[11px] font-medium px-2.5 py-1 rounded-full border appearance-none cursor-pointer pr-6 ${meta.bgColor} ${meta.borderColor} ${meta.color} bg-transparent focus:outline-none`}
                      >
                        {ASSIGNABLE_ROLES.map((r) => (
                          <option key={r} value={r} className="bg-[#111] text-white">
                            {ROLE_META[r].label}
                          </option>
                        ))}
                      </select>
                      {changingRole === m.id ? (
                        <Loader2 className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 animate-spin text-neutral-400" />
                      ) : (
                        <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-neutral-500 pointer-events-none" />
                      )}
                    </div>
                  ) : (
                    // Static badge for owner or non-managers
                    <span
                      className={`inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full border ${meta.bgColor} ${meta.borderColor} ${meta.color}`}
                    >
                      <Icon className="w-3 h-3" />
                      {meta.label}
                    </span>
                  )}

                  {/* Remove button — only for managers and non-owners */}
                  {isManager && !m.isOwner && (
                    <button
                      aria-label={`Remove ${m.name}`}
                      className="p-1.5 rounded-lg text-neutral-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Empty state when solo */}
      {nonOwnerCount === 0 && members.length > 0 && (
        <div className="text-center py-8 rounded-xl border border-dashed border-white/[0.08] max-w-2xl">
          <Users className="w-6 h-6 text-neutral-500 mx-auto mb-2" />
          <p className="text-xs text-neutral-400">
            You are the only team member. Invite others to collaborate.
          </p>
        </div>
      )}
    </motion.div>
  );
}
