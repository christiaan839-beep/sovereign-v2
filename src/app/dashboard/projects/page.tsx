"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Briefcase,
  Plus,
  Search,
  ArrowRight,
  Users,
  FileText,
  Target,
  Clock,
  CheckCircle2,
  Pause,
  Activity,
  FolderOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

type ProjectStatus = "Active" | "Paused" | "Complete";

interface ClientProject {
  id: string;
  clientName: string;
  logoInitial: string;
  logoColor: string;
  status: ProjectStatus;
  leadsFound: number;
  contentCreated: number;
  tasksCompleted: number;
  completionPercent: number;
  lastActivity: string;
}

const _DEMO_PROJECTS: ClientProject[] = [
  {
    id: "proj-001",
    clientName: "TechFlow Solutions",
    logoInitial: "T",
    logoColor: "from-violet-500 to-purple-600",
    status: "Active",
    leadsFound: 47,
    contentCreated: 12,
    tasksCompleted: 89,
    completionPercent: 89,
    lastActivity: "2 hours ago",
  },
  {
    id: "proj-002",
    clientName: "Meridian Capital",
    logoInitial: "M",
    logoColor: "from-blue-500 to-cyan-500",
    status: "Active",
    leadsFound: 23,
    contentCreated: 8,
    tasksCompleted: 64,
    completionPercent: 64,
    lastActivity: "5 hours ago",
  },
  {
    id: "proj-003",
    clientName: "Atlas Digital",
    logoInitial: "A",
    logoColor: "from-amber-500 to-orange-500",
    status: "Paused",
    leadsFound: 15,
    contentCreated: 5,
    tasksCompleted: 45,
    completionPercent: 45,
    lastActivity: "3 days ago",
  },
  {
    id: "proj-004",
    clientName: "Nexus Health",
    logoInitial: "N",
    logoColor: "from-emerald-500 to-teal-500",
    status: "Complete",
    leadsFound: 92,
    contentCreated: 34,
    tasksCompleted: 100,
    completionPercent: 100,
    lastActivity: "1 week ago",
  },
];

const STATUS_CONFIG: Record<
  ProjectStatus,
  { color: string; bg: string; border: string; icon: LucideIcon }
> = {
  Active: {
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/30",
    icon: Activity,
  },
  Paused: {
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    icon: Pause,
  },
  Complete: {
    color: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    icon: CheckCircle2,
  },
};

const FILTER_OPTIONS: Array<{ label: string; value: ProjectStatus | "All" }> = [
  { label: "All", value: "All" },
  { label: "Active", value: "Active" },
  { label: "Paused", value: "Paused" },
  { label: "Complete", value: "Complete" },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, delayChildren: 0.1 },
  },
};

const cardVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" as const } },
  exit: { opacity: 0, y: -10, transition: { duration: 0.2 } },
};

export default function ClientProjectsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | "All">("All");
  const [projects, setProjects] = useState<ClientProject[]>([]);
  const [_loading, setLoading] = useState(true);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.projects) && data.projects.length > 0) {
          setProjects(data.projects);
          return;
        }
      }
    } catch { /* use empty state */ }
    setProjects([]);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProjects().finally(() => setLoading(false));
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchProjects]);

  const filteredProjects = useMemo(() => {
    return projects.filter((project) => {
      const matchesSearch = project.clientName
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchesStatus =
        statusFilter === "All" || project.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [projects, searchQuery, statusFilter]);

  return (
    <div className="min-h-screen bg-[#000000] p-6 md:p-8 max-w-7xl mx-auto space-y-8" role="region" aria-label="Client projects">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col md:flex-row md:items-center justify-between gap-6"
      >
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Briefcase className="w-8 h-8 text-emerald-400" />
            Client Projects
          </h1>
          <p className="text-neutral-400 mt-2 max-w-2xl">
            Organize and track all agency work by client. Monitor leads, content
            output, and project milestones in one unified view.
          </p>
        </div>

        <button className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl text-white font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:opacity-90 transition-opacity whitespace-nowrap shadow-[0_0_20px_rgba(16,185,129,0.2)] border border-emerald-500/50">
          <Plus className="w-4 h-4" />
          New Project
        </button>
      </motion.div>

      {/* Search & Filter Bar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.15 }}
        className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center gap-4"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-500" />
          <input
            type="text"
            placeholder="Search clients..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search client projects"
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/20 transition-all"
          />
        </div>

        <div className="flex items-center gap-2">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setStatusFilter(option.value)}
              className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
                statusFilter === option.value
                  ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                  : "bg-white/[0.04] text-neutral-400 border border-white/10 hover:border-white/20 hover:text-neutral-300"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Project Grid */}
      <AnimatePresence mode="wait">
        {filteredProjects.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className="bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl p-6 min-h-[400px] flex flex-col items-center justify-center text-center"
          >
            <FolderOpen className="w-14 h-14 text-neutral-500 mb-4" />
            <h3 className="text-lg font-bold text-white mb-2">
              No projects found
            </h3>
            <p className="text-sm text-neutral-500 max-w-md mx-auto mb-6 leading-relaxed">
              {searchQuery || statusFilter !== "All"
                ? "No projects match your current filters. Try adjusting your search or clearing filters."
                : "Create your first client project to start tracking leads, content, and deliverables across your agency."}
            </p>
            {!searchQuery && statusFilter === "All" && (
              <button className="px-6 py-3 bg-gradient-to-r from-emerald-600 to-teal-600 rounded-xl text-white font-bold text-xs uppercase tracking-widest flex items-center gap-2 hover:opacity-90 transition-opacity shadow-[0_0_20px_rgba(16,185,129,0.2)] border border-emerald-500/50">
                <Plus className="w-4 h-4" />
                Create First Project
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="grid"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {filteredProjects.map((project) => {
              const statusCfg = STATUS_CONFIG[project.status];
              const StatusIcon = statusCfg.icon;

              return (
                <motion.div
                  key={project.id}
                  variants={cardVariants}
                  layout
                  className="group bg-white/[0.04] backdrop-blur-xl border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-300"
                >
                  {/* Card Header */}
                  <div className="flex items-start justify-between mb-5">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-12 rounded-xl bg-gradient-to-br ${project.logoColor} flex items-center justify-center text-white font-bold text-lg shadow-lg`}
                      >
                        {project.logoInitial}
                      </div>
                      <div>
                        <h3 className="text-base font-bold text-white">
                          {project.clientName}
                        </h3>
                        <div className="flex items-center gap-1.5 mt-1">
                          <Clock className="w-3 h-3 text-neutral-500" />
                          <span className="text-xs text-neutral-500">
                            {project.lastActivity}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div
                      className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${statusCfg.color} ${statusCfg.bg} border ${statusCfg.border}`}
                    >
                      <StatusIcon className="w-3 h-3" />
                      {project.status}
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="grid grid-cols-3 gap-3 mb-5">
                    <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 text-center">
                      <Target className="w-4 h-4 text-violet-400 mx-auto mb-1.5" />
                      <div className="text-lg font-bold text-white">
                        {project.leadsFound}
                      </div>
                      <div className="text-[10px] text-neutral-500 uppercase tracking-wider">
                        Leads
                      </div>
                    </div>
                    <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 text-center">
                      <FileText className="w-4 h-4 text-cyan-400 mx-auto mb-1.5" />
                      <div className="text-lg font-bold text-white">
                        {project.contentCreated}
                      </div>
                      <div className="text-[10px] text-neutral-500 uppercase tracking-wider">
                        Articles
                      </div>
                    </div>
                    <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl p-3 text-center">
                      <Users className="w-4 h-4 text-amber-400 mx-auto mb-1.5" />
                      <div className="text-lg font-bold text-white">
                        {project.tasksCompleted}
                      </div>
                      <div className="text-[10px] text-neutral-500 uppercase tracking-wider">
                        Tasks Done
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mb-5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-neutral-400 font-medium">
                        Completion
                      </span>
                      <span className="text-xs font-bold text-white">
                        {project.completionPercent}%
                      </span>
                    </div>
                    <div className="w-full h-2 bg-white/[0.06] rounded-full overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${project.completionPercent}%` }}
                        transition={{ duration: 1, delay: 0.3, ease: "easeOut" }}
                        className={`h-full rounded-full ${
                          project.completionPercent === 100
                            ? "bg-gradient-to-r from-emerald-500 to-teal-400"
                            : project.completionPercent >= 70
                            ? "bg-gradient-to-r from-blue-500 to-cyan-400"
                            : project.completionPercent >= 40
                            ? "bg-gradient-to-r from-amber-500 to-orange-400"
                            : "bg-gradient-to-r from-red-500 to-rose-400"
                        }`}
                      />
                    </div>
                  </div>

                  {/* View Project Button */}
                  <button className="w-full py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm font-semibold text-neutral-400 flex items-center justify-center gap-2 hover:bg-white/[0.08] hover:text-white hover:border-white/20 transition-all group/btn">
                    View Project
                    <ArrowRight className="w-4 h-4 group-hover/btn:translate-x-0.5 transition-transform" />
                  </button>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
