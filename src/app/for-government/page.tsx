"use client";

import {
  Building2,
  FileCheck,
  Users,
  FileSearch,
  ShieldCheck,
  Database,
  Layers,
  Shield,
  Zap,
} from "lucide-react";
import {
  VerticalPageShell,
  type VerticalConfig,
} from "@/components/landing/VerticalPageShell";

const config: VerticalConfig = {
  slug: "government",
  label: "Government",
  EyebrowIcon: Building2,
  accent: "cyan",
  heroLine1: "AI agents for government",
  heroHighlight: "& public sector.",
  heroBlurb:
    "Permit processing. Benefits eligibility. FOIA responses. Tamper-proof audit trail for every decision. NIST AI RMF aligned.",
  capabilitiesHeadline: "Serve more constituents with the same team.",
  capabilitiesBlurb:
    "Every routine application processed, every eligibility check standardized, every records request fulfilled — without expanding headcount.",
  capabilities: [
    {
      icon: FileCheck,
      title: "Permit & application processing automation",
      desc: "Agents validate submissions, check completeness, cross-reference zoning rules and compliance requirements, and route to the right reviewer — in minutes, not months. Applicants get status updates automatically.",
    },
    {
      icon: Users,
      title: "Benefits eligibility determination",
      desc: "Agents process applications against program rules, cross-reference income and residency data, and surface eligibility determinations for officer review. Consistent decisions at scale — no case-by-case inconsistency.",
    },
    {
      icon: FileSearch,
      title: "Freedom of Information (FOIA) automation",
      desc: "Agents locate responsive documents across disparate systems, apply automated redactions for PII and exempt information, and draft the cover letter and response package. What took 20 staff-days now takes hours.",
    },
    {
      icon: ShieldCheck,
      title: "Policy compliance monitoring",
      desc: "Agents continuously scan operational data, procurement records, and public-facing outputs against current policy and regulatory requirements. Compliance gaps are flagged with evidence before they become audit findings.",
    },
  ],
  workflowsHeadline: "Give the command. Get the outcome.",
  workflows: [
    {
      trigger:
        '"Process the 47 pending building permit applications from this week"',
      steps: [
        "Ingests all 47 applications and validates completeness against the current submission checklist",
        "Cross-references each property against zoning maps, flood zones, and existing permit history",
        "Flags 6 applications with missing documentation — sends automated deficiency notices to applicants",
        "Routes 41 complete applications to the appropriate reviewer queues with pre-populated review summaries",
      ],
      result:
        "41 applications moving through the process by end of day. 6 applicants notified with specific corrections needed. Zero manual data entry.",
    },
    {
      trigger:
        '"Determine eligibility for the 120 housing assistance applications received this month"',
      steps: [
        "Pulls income, residency, and household composition data for each applicant",
        "Applies current program rules across 14 eligibility criteria with full audit trail",
        "Calculates benefit tier and flags edge cases requiring officer review (11 of 120)",
        "Generates determination notices for eligible applicants and denial letters with appeal information",
      ],
      result:
        "109 straightforward determinations processed in 22 minutes. 11 complex cases queued for officer review with AI-prepared case summaries.",
    },
    {
      trigger:
        '"Respond to the FOIA request for all correspondence on the Route 7 expansion project"',
      steps: [
        "Searches email, document management, and records systems for responsive documents",
        "Identifies 847 potentially responsive records across 6 systems",
        "Applies automated redactions for personal information and attorney-client exempt content",
        "Assembles the response package with index, redaction log, and cover letter draft",
      ],
      result:
        "Response package assembled in 3 hours. Legal review confirms redactions are appropriate. 18 staff-days of work completed before lunch.",
    },
  ],
  archItems: [
    {
      icon: Database,
      label: "Immutable Audit Log",
      desc: "Every agent action is timestamped and tamper-proof — ready for oversight committees and IG inquiries",
    },
    {
      icon: Layers,
      label: "Tenant Isolation",
      desc: "Department data is scoped per agency — no cross-contamination between programs or jurisdictions",
    },
    {
      icon: Shield,
      label: "NIST AI RMF",
      desc: "Architecture maps to the NIST AI Risk Management Framework — explainable outputs, human-in-the-loop gates",
    },
    {
      icon: Zap,
      label: "On-Premise Option",
      desc: "FedRAMP-aligned local deployment — sensitive citizen data never leaves government infrastructure",
    },
  ],
  ctaHeadline: "Less backlog.",
  ctaHighlight: "More service.",
  ctaBlurb:
    "Your civil servants shouldn't spend half their time on intake paperwork. Deploy AI agents that handle the routine so your team can focus on the cases that need judgment.",
};

export default function ForGovernmentPage() {
  return <VerticalPageShell config={config} />;
}
