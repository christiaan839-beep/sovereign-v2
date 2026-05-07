"use client";

import { motion } from "framer-motion";
import { Building2, Rocket, ShoppingBag } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.5, ease: "easeOut" as const },
  }),
};

const CASE_STUDIES = [
  {
    icon: Building2,
    color: "text-blue-400",
    borderColor: "border-blue-500/20",
    type: "Digital Agency",
    headline: "How a 5-person agency handles 20 clients with AI",
    challenge:
      "The team was drowning in manual content creation across 20 client accounts. Lead response times averaged 6+ hours, causing lost deals. No capacity to take on new clients without hiring.",
    solution:
      "Deployed a workflow automation pipeline combining Lead Gen, Content Factory, and Email Sequence agents. Incoming leads are automatically qualified and responded to within minutes. Weekly content batches are generated, reviewed, and scheduled across all client accounts.",
    results: [
      { metric: "5x", label: "Client capacity" },
      { metric: "40 hrs/wk", label: "Time saved" },
      { metric: "R200K", label: "Additional monthly revenue" },
    ],
  },
  {
    icon: Rocket,
    color: "text-purple-400",
    borderColor: "border-purple-500/20",
    type: "SaaS Company",
    headline: "From 10 to 50 qualified meetings per month",
    challenge:
      "SDRs were spending 80% of their time on prospect research and manual outreach. Only 10 qualified meetings per month despite a team of 4. Research quality was inconsistent.",
    solution:
      "Built a Lead Gen + Voice Agent + Smart Router pipeline. The system researches prospects using multiple data sources, generates personalized outreach, and routes qualified leads to the right SDR based on territory and expertise.",
    results: [
      { metric: "3x", label: "Qualified meetings" },
      { metric: "60%", label: "Faster response time" },
      { metric: "R0", label: "Per-token cost" },
    ],
  },
  {
    icon: ShoppingBag,
    color: "text-orange-400",
    borderColor: "border-orange-500/20",
    type: "E-commerce Brand",
    headline: "500 product descriptions in one afternoon",
    challenge:
      "Launching 500 new SKUs with no in-house copywriting team. External agencies quoted 6+ weeks and R150K. Product data existed only in spreadsheets with basic specifications.",
    solution:
      "Used Content Factory + SEO Dominator + Programmatic SEO agents to generate unique, SEO-optimized product descriptions from spreadsheet data. Each description included meta tags, structured data, and internal linking.",
    results: [
      { metric: "500", label: "Pages generated" },
      { metric: "94", label: "Avg SEO score" },
      { metric: "4.2%", label: "AI detection rate" },
    ],
  },
];

/**
 * Curated example case studies — illustrative scenarios used as marketing
 * patterns ("here's what a Sovereign deployment looks like"). Real customer
 * wins live in the DB and render above this section via the RSC at
 * src/app/case-studies/page.tsx.
 */
export default function CuratedExamples() {
  return (
    <section>
      <div className="mb-8">
        <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-neutral-600 mb-2">
          Pattern Library
        </p>
        <h2 className="text-xl font-bold text-white">
          What a Sovereign deployment looks like
        </h2>
        <p className="text-sm text-neutral-500 mt-1">
          Illustrative scenarios. Real customer wins, with metrics, sit above.
        </p>
      </div>
      <div className="space-y-8">
        {CASE_STUDIES.map((study, i) => {
          const Icon = study.icon;
          return (
            <motion.div
              key={study.type}
              custom={i}
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              className={`rounded-xl border ${study.borderColor} bg-white/[0.02] backdrop-blur-xl overflow-hidden`}
            >
              {/* Header */}
              <div className="px-6 pt-6 pb-4 border-b border-white/[0.06]">
                <div className="flex items-center gap-3 mb-2">
                  <Icon className={`w-5 h-5 ${study.color}`} />
                  <span
                    className={`text-xs font-semibold uppercase tracking-wider ${study.color}`}
                  >
                    {study.type}
                  </span>
                </div>
                <h2 className="text-xl font-bold text-white">
                  {study.headline}
                </h2>
              </div>

              <div className="p-6 space-y-5">
                {/* Challenge */}
                <div>
                  <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                    Challenge
                  </h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    {study.challenge}
                  </p>
                </div>

                {/* Solution */}
                <div>
                  <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                    Solution
                  </h3>
                  <p className="text-sm text-neutral-400 leading-relaxed">
                    {study.solution}
                  </p>
                </div>

                {/* Results */}
                <div>
                  <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-3">
                    Results
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    {study.results.map((result) => (
                      <div
                        key={result.label}
                        className="rounded-lg bg-white/[0.03] border border-white/[0.06] p-4 text-center"
                      >
                        <div
                          className={`text-2xl font-bold ${study.color} mb-1`}
                        >
                          {result.metric}
                        </div>
                        <div className="text-xs text-neutral-500">
                          {result.label}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </section>
  );
}
