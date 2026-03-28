"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import {
  Rocket,
  Briefcase,
  CalendarClock,
  ShoppingBag,
  Mail,
  UserPlus,
  RefreshCw,
  BookOpen,
  List,
  Award,
  Share2,
  GitBranch,
  CalendarDays,
  Eye,
  LayoutGrid,
  FileText,
  Zap,
  Inbox,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

interface Template {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  category: Category;
  route: string;
}

type Category = "landing-pages" | "emails" | "content" | "workflows";

const CATEGORY_LABELS: Record<Category, string> = {
  "landing-pages": "Landing Pages",
  emails: "Emails",
  content: "Content",
  workflows: "Workflows",
};

type FilterKey = "all" | Category;

// ─── Template Data ───────────────────────────────────────────────────────────

const TEMPLATES: Template[] = [
  // Landing Pages
  {
    id: "saas-startup",
    title: "SaaS Startup",
    description: "Launch your product with a conversion-optimized page",
    icon: Rocket,
    category: "landing-pages",
    route: "/dashboard/build?template=saas-startup",
  },
  {
    id: "agency-portfolio",
    title: "Agency Portfolio",
    description: "Showcase your work and attract clients",
    icon: Briefcase,
    category: "landing-pages",
    route: "/dashboard/build?template=agency-portfolio",
  },
  {
    id: "event-webinar",
    title: "Event / Webinar",
    description: "Drive registrations with urgency",
    icon: CalendarClock,
    category: "landing-pages",
    route: "/dashboard/build?template=event-webinar",
  },
  {
    id: "ecommerce",
    title: "E-commerce",
    description: "Product showcase with social proof",
    icon: ShoppingBag,
    category: "landing-pages",
    route: "/dashboard/build?template=ecommerce",
  },

  // Email Sequences
  {
    id: "cold-outreach",
    title: "Cold Outreach",
    description: "Break through inbox noise with a 5-email sequence",
    icon: Mail,
    category: "emails",
    route: "/dashboard/content-factory?template=cold-outreach",
  },
  {
    id: "client-onboarding",
    title: "Client Onboarding",
    description: "Welcome and activate new clients in 3 emails",
    icon: UserPlus,
    category: "emails",
    route: "/dashboard/content-factory?template=client-onboarding",
  },
  {
    id: "re-engagement",
    title: "Re-engagement",
    description: "Win back dormant leads with a 4-email campaign",
    icon: RefreshCw,
    category: "emails",
    route: "/dashboard/content-factory?template=re-engagement",
  },

  // Content
  {
    id: "how-to-guide",
    title: "Blog: How-To Guide",
    description: "Step-by-step tutorial format",
    icon: BookOpen,
    category: "content",
    route: "/dashboard/content-factory?template=how-to-guide",
  },
  {
    id: "listicle",
    title: "Blog: Listicle",
    description: "Top X format that drives shares",
    icon: List,
    category: "content",
    route: "/dashboard/content-factory?template=listicle",
  },
  {
    id: "case-study",
    title: "Blog: Case Study",
    description: "Client success story template",
    icon: Award,
    category: "content",
    route: "/dashboard/content-factory?template=case-study",
  },
  {
    id: "social-media-pack",
    title: "Social Media Pack",
    description: "LinkedIn + Twitter + Instagram bundle",
    icon: Share2,
    category: "content",
    route: "/dashboard/content-factory?template=social-media-pack",
  },

  // Automation Workflows
  {
    id: "lead-gen",
    title: "Lead Gen Pipeline",
    description: "Scrape, enrich, score, and email automatically",
    icon: GitBranch,
    category: "workflows",
    route: "/dashboard/workflows?template=lead-gen",
  },
  {
    id: "content-calendar",
    title: "Content Calendar",
    description: "Research, write, schedule, and publish on autopilot",
    icon: CalendarDays,
    category: "workflows",
    route: "/dashboard/workflows?template=content-calendar",
  },
  {
    id: "competitor-monitor",
    title: "Competitor Monitor",
    description: "Track, analyze, and alert weekly",
    icon: Eye,
    category: "workflows",
    route: "/dashboard/workflows?template=competitor-monitor",
  },
];

const TABS: { key: FilterKey; label: string; icon: LucideIcon }[] = [
  { key: "all", label: "All", icon: LayoutGrid },
  { key: "landing-pages", label: "Landing Pages", icon: FileText },
  { key: "emails", label: "Emails", icon: Inbox },
  { key: "content", label: "Content", icon: BookOpen },
  { key: "workflows", label: "Workflows", icon: Zap },
];

// ─── Component ───────────────────────────────────────────────────────────────

export default function TemplatesPage() {
  const [filter, setFilter] = useState<FilterKey>("all");
  const router = useRouter();

  const visible =
    filter === "all"
      ? TEMPLATES
      : TEMPLATES.filter((t) => t.category === filter);

  return (
    <div className="min-h-screen bg-[#000000] px-4 py-10 sm:px-6 lg:px-10" role="main" aria-label="Template gallery">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-10"
      >
        <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
          Template Gallery
        </h1>
        <p className="mt-2 text-neutral-400 text-sm max-w-xl">
          Pre-built blueprints for landing pages, email sequences, content, and
          automation workflows. Pick one and start building instantly.
        </p>
      </motion.div>

      {/* Category Tabs */}
      <div className="flex flex-wrap gap-2 mb-8">
        {TABS.map((tab) => {
          const active = filter === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setFilter(tab.key)}
              className={`
                flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold
                transition-gpu duration-200
                ${
                  active
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
                    : "bg-white/[0.03] text-neutral-400 border border-white/[0.06] hover:border-white/10 hover:text-neutral-200"
                }
              `}
            >
              <tab.icon className="h-3.5 w-3.5" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Grid */}
      <motion.div
        layout
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
      >
        <AnimatePresence mode="popLayout">
          {visible.map((template, i) => {
            const Icon = template.icon;
            return (
              <motion.div
                key={template.id}
                layout
                initial={{ opacity: 0, y: 16, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.35, delay: i * 0.04 }}
                className="group relative flex flex-col justify-between rounded-2xl border border-white/[0.06] bg-white/[0.03] p-6 backdrop-blur-sm transition-gpu duration-300 hover:border-emerald-500/20 hover:scale-[1.02]"
              >
                {/* Icon + Category */}
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10">
                      <Icon className="h-5 w-5 text-emerald-400" />
                    </div>
                    <span className="rounded-lg bg-white/[0.04] px-2.5 py-1 text-[10px] font-medium uppercase tracking-wider text-neutral-500">
                      {CATEGORY_LABELS[template.category]}
                    </span>
                  </div>

                  {/* Title + Description */}
                  <h3 className="text-sm font-semibold text-white">
                    {template.title}
                  </h3>
                  <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                    {template.description}
                  </p>
                </div>

                {/* CTA */}
                <button
                  onClick={() => router.push(template.route)}
                  className="mt-5 w-full rounded-xl bg-white py-2 text-xs font-semibold text-black transition-gpu duration-200 hover:bg-neutral-200 active:scale-[0.98]"
                >
                  Use Template
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
