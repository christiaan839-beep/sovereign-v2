"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FileText,
  Users,
  PenTool,
  Crosshair,
  BarChart3,
  Calendar,
  Loader2,
  Copy,
  Download,
  CheckCircle2,
  ChevronDown,
} from "lucide-react";

/* ─── Types ─── */

interface ReportType {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  promptTemplate: (range: string) => string;
}

interface GeneratedReport {
  reportId: string;
  range: string;
  content: string;
  generatedAt: string;
}

/* ─── Report Definitions ─── */

const REPORT_TYPES: ReportType[] = [
  {
    id: "lead-generation",
    title: "Lead Generation Report",
    description:
      "Summary of leads found, quality scores, top industries, and conversion funnel metrics.",
    icon: Users,
    color: "emerald",
    promptTemplate: (range: string) =>
      `Generate a structured Lead Generation Report for the last ${range}. Include these sections with bullet points:
1. Executive Summary (2-3 sentences)
2. Leads Found (total count estimate, breakdown by source)
3. Quality Score Distribution (High/Medium/Low percentages)
4. Top Industries (ranked list of 5 industries with lead counts)
5. Conversion Funnel (visitors -> leads -> qualified -> converted)
6. Recommendations (3 actionable next steps)
Format each section with a clear heading and bullet points. If underlying data is unavailable, state that explicitly — do NOT fabricate numbers. Return only what can be supported by actual platform metrics.`,
  },
  {
    id: "content-performance",
    title: "Content Performance Report",
    description:
      "Articles generated, SEO scores, AI detection rates, and engagement metrics.",
    icon: PenTool,
    color: "cyan",
    promptTemplate: (range: string) =>
      `Generate a structured Content Performance Report for the last ${range}. Include these sections with bullet points:
1. Executive Summary (2-3 sentences)
2. Content Output (articles generated, total word count, avg per piece)
3. SEO Score Distribution (90+ / 70-89 / below 70 breakdown)
4. AI Detection Rates (Originality.ai pass rate, avg humanization score)
5. Top Performing Content (3 best articles by engagement)
6. Channel Distribution (blog, social, email newsletter breakdown)
7. Recommendations (3 actionable next steps)
Format each section with a clear heading and bullet points. If underlying data is unavailable, state that explicitly — do NOT fabricate numbers.`,
  },
  {
    id: "competitive-intelligence",
    title: "Competitive Intelligence Report",
    description:
      "Competitor analyses run, weaknesses found, market positioning insights.",
    icon: Crosshair,
    color: "violet",
    promptTemplate: (range: string) =>
      `Generate a structured Competitive Intelligence Report for the last ${range}. Include these sections with bullet points:
1. Executive Summary (2-3 sentences)
2. Competitors Analyzed (list of companies monitored with analysis count)
3. Key Weaknesses Identified (top 5 competitor vulnerabilities found)
4. Market Positioning Map (where each competitor sits on value/price axes)
5. Pricing Intelligence (competitor pricing changes detected)
6. Feature Gap Analysis (features competitors have vs don't have)
7. Strategic Recommendations (3 actionable moves to exploit findings)
Format each section with a clear heading and bullet points. If underlying data is unavailable, state that explicitly — do NOT fabricate numbers.`,
  },
  {
    id: "platform-usage",
    title: "Platform Usage Report",
    description:
      "Agent executions, models used, safety pipeline stats, and system health.",
    icon: BarChart3,
    color: "amber",
    promptTemplate: (range: string) =>
      `Generate a structured Platform Usage Report for the last ${range}. Include these sections with bullet points:
1. Executive Summary (2-3 sentences)
2. Agent Executions (total runs, success rate, avg duration)
3. Model Usage Breakdown (top 5 models by request count with percentages)
4. Safety Pipeline Stats (jailbreak detection, PII scanning, content safety, quality scoring, critic QA pass rates)
5. Peak Usage Times (busiest hours/days)
6. Error Rate Analysis (common failure modes and frequency)
7. Cost Efficiency (tokens consumed, estimated cost savings vs manual)
8. Recommendations (3 optimization suggestions)
Format each section with a clear heading and bullet points. If underlying data is unavailable, state that explicitly — do NOT fabricate numbers.`,
  },
];

const DATE_RANGES = [
  { label: "Last 7 days", value: "7 days" },
  { label: "Last 30 days", value: "30 days" },
  { label: "Last 90 days", value: "90 days" },
] as const;

const COLOR_MAP: Record<string, { bg: string; border: string; text: string; badge: string; glow: string }> = {
  emerald: {
    bg: "bg-emerald-500/[0.04]",
    border: "border-emerald-500/10",
    text: "text-emerald-400",
    badge: "bg-emerald-500/10",
    glow: "shadow-emerald-500/5",
  },
  cyan: {
    bg: "bg-cyan-500/[0.04]",
    border: "border-cyan-500/10",
    text: "text-cyan-400",
    badge: "bg-cyan-500/10",
    glow: "shadow-cyan-500/5",
  },
  violet: {
    bg: "bg-violet-500/[0.04]",
    border: "border-violet-500/10",
    text: "text-violet-400",
    badge: "bg-violet-500/10",
    glow: "shadow-violet-500/5",
  },
  amber: {
    bg: "bg-amber-500/[0.04]",
    border: "border-amber-500/10",
    text: "text-amber-400",
    badge: "bg-amber-500/10",
    glow: "shadow-amber-500/5",
  },
};

/* ─── Helpers ─── */

function parseReportSections(raw: string): { heading: string; bullets: string[] }[] {
  const sections: { heading: string; bullets: string[] }[] = [];
  const lines = raw.split("\n");
  let currentSection: { heading: string; bullets: string[] } | null = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Detect headings: lines starting with a number+period, or "##", or bold "**heading**"
    const headingMatch =
      trimmed.match(/^\d+[\.\)]\s*\*{0,2}(.+?)\*{0,2}\s*$/) ||
      trimmed.match(/^#{1,3}\s+(.+)$/) ||
      trimmed.match(/^\*\*(.+?)\*\*\s*$/);

    if (headingMatch) {
      if (currentSection) sections.push(currentSection);
      currentSection = { heading: headingMatch[1].replace(/\*+/g, "").trim(), bullets: [] };
    } else if (currentSection) {
      // Bullet or continuation line
      const bulletText = trimmed.replace(/^[-*]\s+/, "").replace(/^\d+[\.\)]\s+/, "");
      if (bulletText) currentSection.bullets.push(bulletText);
    }
  }
  if (currentSection && (currentSection.heading || currentSection.bullets.length > 0)) {
    sections.push(currentSection);
  }

  // Fallback: if parsing found nothing, show the raw text as a single section
  if (sections.length === 0 && raw.trim()) {
    sections.push({ heading: "Report", bullets: raw.split("\n").filter((l) => l.trim()) });
  }

  return sections;
}

/* ─── Components ─── */

function ReportCard({
  report,
  selectedRanges,
  onRangeChange,
  onGenerate,
  generating,
}: {
  report: ReportType;
  selectedRanges: Record<string, string>;
  onRangeChange: (id: string, range: string) => void;
  onGenerate: (id: string) => void;
  generating: string | null;
}) {
  const colors = COLOR_MAP[report.color];
  const Icon = report.icon;
  const isGenerating = generating === report.id;
  const range = selectedRanges[report.id] || "30 days";
  const [rangeOpen, setRangeOpen] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`relative p-5 rounded-2xl border ${colors.border} ${colors.bg} shadow-lg ${colors.glow}`}
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        <div
          className={`w-9 h-9 rounded-xl ${colors.badge} border ${colors.border} flex items-center justify-center shrink-0`}
        >
          <Icon className={`w-4 h-4 ${colors.text}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-white">{report.title}</h3>
          <p className="text-xs text-neutral-500 mt-0.5 leading-relaxed">{report.description}</p>
        </div>
      </div>

      {/* Date range + Generate */}
      <div className="flex items-center gap-2 mt-4">
        {/* Date range selector */}
        <div className="relative">
          <button
            onClick={() => setRangeOpen((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-xs text-neutral-300 hover:border-white/15 transition-colors"
          >
            <Calendar className="w-3 h-3 text-neutral-500" />
            {DATE_RANGES.find((d) => d.value === range)?.label || range}
            <ChevronDown className="w-3 h-3 text-neutral-500" />
          </button>
          <AnimatePresence>
            {rangeOpen && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="absolute left-0 top-full mt-1 w-40 bg-[#0A0A0A] border border-white/10 rounded-lg shadow-xl z-20 overflow-hidden"
              >
                {DATE_RANGES.map((d) => (
                  <button
                    key={d.value}
                    onClick={() => {
                      onRangeChange(report.id, d.value);
                      setRangeOpen(false);
                    }}
                    className={`w-full px-3 py-2 text-left text-xs transition-colors ${
                      range === d.value
                        ? `${colors.text} bg-white/[0.04]`
                        : "text-neutral-400 hover:text-white hover:bg-white/[0.03]"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Generate button */}
        <button
          onClick={() => onGenerate(report.id)}
          disabled={isGenerating}
          className={`flex-1 flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
            isGenerating
              ? "bg-white/[0.04] text-neutral-500 cursor-wait"
              : `bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 hover:border-emerald-500/30`
          }`}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <FileText className="w-3.5 h-3.5" />
              Generate Report
            </>
          )}
        </button>
      </div>
    </motion.div>
  );
}

function GeneratedReportView({
  report,
  reportType,
}: {
  report: GeneratedReport;
  reportType: ReportType;
}) {
  const [copied, setCopied] = useState(false);
  const colors = COLOR_MAP[reportType.color];
  const sections = parseReportSections(report.content);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(report.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const ta = document.createElement("textarea");
      ta.value = report.content;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([report.content], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${reportType.id}-report-${report.range.replace(/\s/g, "-")}-${new Date().toISOString().split("T")[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={`p-6 rounded-2xl border ${colors.border} bg-[#060606] shadow-lg`}
    >
      {/* Report Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg ${colors.badge} border ${colors.border} flex items-center justify-center`}>
            <reportType.icon className={`w-4 h-4 ${colors.text}`} />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{reportType.title}</h3>
            <p className="text-[10px] text-neutral-500 mt-0.5">
              {report.range} &middot; Generated {new Date(report.generatedAt).toLocaleString()}
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-neutral-400 bg-white/[0.03] border border-white/[0.06] hover:text-white hover:border-white/10 transition-colors"
          >
            {copied ? (
              <>
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                <span className="text-emerald-400">Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3 h-3" />
                Copy to Clipboard
              </>
            )}
          </button>
          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs text-neutral-400 bg-white/[0.03] border border-white/[0.06] hover:text-white hover:border-white/10 transition-colors"
          >
            <Download className="w-3 h-3" />
            Download as Text
          </button>
        </div>
      </div>

      {/* Parsed Sections */}
      <div className="space-y-4">
        {sections.map((section, i) => (
          <div key={i}>
            {section.heading && (
              <h4 className={`text-xs font-semibold ${colors.text} uppercase tracking-wider mb-2`}>
                {section.heading}
              </h4>
            )}
            <ul className="space-y-1.5">
              {section.bullets.map((bullet, j) => (
                <li
                  key={j}
                  className="flex items-start gap-2 text-xs text-neutral-300 leading-relaxed"
                >
                  <span className={`w-1 h-1 rounded-full ${colors.text.replace("text-", "bg-")} mt-1.5 shrink-0`} />
                  {bullet}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/* ─── Main Page ─── */

export default function ReportsPage() {
  const [selectedRanges, setSelectedRanges] = useState<Record<string, string>>({});
  const [generating, setGenerating] = useState<string | null>(null);
  const [generatedReports, setGeneratedReports] = useState<GeneratedReport[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleRangeChange = (id: string, range: string) => {
    setSelectedRanges((prev) => ({ ...prev, [id]: range }));
  };

  const handleGenerate = async (reportId: string) => {
    const reportType = REPORT_TYPES.find((r) => r.id === reportId);
    if (!reportType) return;

    const range = selectedRanges[reportId] || "30 days";
    setGenerating(reportId);
    setError(null);

    try {
      const res = await fetch("/api/agents/smart-router", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: reportType.promptTemplate(range),
          agentId: `report-${reportId}`,
        }),
      });

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`);
      }

      const data = await res.json();
      const content = data.response || data.result || data.text || "Report generation completed but no content was returned. Please try again.";

      const newReport: GeneratedReport = {
        reportId,
        range,
        content,
        generatedAt: new Date().toISOString(),
      };

      // Prepend to keep newest first, remove old reports of same type
      setGeneratedReports((prev) => [
        newReport,
        ...prev.filter((r) => r.reportId !== reportId),
      ]);
    } catch (err) {
      setError(
        `Failed to generate ${reportType.title}. ${err instanceof Error ? err.message : "Please try again."}`
      );
    } finally {
      setGenerating(null);
    }
  };

  return (
    <div className="min-h-screen p-6 md:p-8 max-w-6xl mx-auto">
      {/* Page Header */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3 mb-8"
      >
        <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <FileText className="w-5 h-5 text-emerald-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-white">Reports</h1>
          <p className="text-xs text-neutral-500 mt-0.5">
            Generate downloadable reports from your agent data
          </p>
        </div>
      </motion.div>

      {/* Error Banner */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mb-6 px-4 py-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Report Type Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
        {REPORT_TYPES.map((report, i) => (
          <motion.div
            key={report.id}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <ReportCard
              report={report}
              selectedRanges={selectedRanges}
              onRangeChange={handleRangeChange}
              onGenerate={handleGenerate}
              generating={generating}
            />
          </motion.div>
        ))}
      </div>

      {/* Generated Reports */}
      <AnimatePresence>
        {generatedReports.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider">
              Generated Reports
            </h2>
            {generatedReports.map((report) => {
              const reportType = REPORT_TYPES.find((r) => r.id === report.reportId);
              if (!reportType) return null;
              return (
                <GeneratedReportView
                  key={`${report.reportId}-${report.generatedAt}`}
                  report={report}
                  reportType={reportType}
                />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state when no reports generated yet */}
      {generatedReports.length === 0 && !generating && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center py-12"
        >
          <FileText className="w-10 h-10 text-neutral-700 mx-auto mb-3" />
          <p className="text-sm text-neutral-500">
            No reports generated yet. Select a report type above and click &apos;Generate Report&apos; to get started.
          </p>
        </motion.div>
      )}
    </div>
  );
}
