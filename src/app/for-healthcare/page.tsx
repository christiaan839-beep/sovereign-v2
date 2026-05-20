"use client";

import {
  Heart,
  CalendarCheck,
  FileText,
  Receipt,
  Shield,
  Database,
  Layers,
  Zap,
} from "lucide-react";
import {
  VerticalPageShell,
  type VerticalConfig,
} from "@/components/landing/VerticalPageShell";

const config: VerticalConfig = {
  slug: "healthcare",
  label: "Healthcare",
  EyebrowIcon: Heart,
  accent: "cyan",
  heroLine1: "AI agents for",
  heroHighlight: "healthcare.",
  heroBlurb:
    "HIPAA-compliant. Local execution. Patient data never leaves your machine.",
  capabilitiesHeadline: "Automate the admin. Focus on the patient.",
  capabilitiesBlurb:
    "Every task that pulls clinicians away from patient care — automated, verified, and audit-logged.",
  capabilities: [
    {
      icon: Heart,
      title: "Patient intake automation",
      desc: "Collect patient history, insurance details, and consent forms before the visit. Agents pre-populate records so your staff spends time on care, not clipboards.",
    },
    {
      icon: CalendarCheck,
      title: "Appointment scheduling",
      desc: "Voice and chat agents handle booking, rescheduling, and reminders 24/7. Patients get confirmed slots in seconds. No-shows drop when reminders go out automatically.",
    },
    {
      icon: FileText,
      title: "Medical record summarization",
      desc: "Summarize patient charts, lab results, and visit histories into concise briefs for physicians. What took 20 minutes of chart review now takes 10 seconds.",
    },
    {
      icon: Receipt,
      title: "Billing & coding assistance",
      desc: "Agents cross-reference diagnoses with ICD-10 codes, flag coding errors before submission, and process insurance claims in bulk. Fewer denials, faster reimbursement.",
    },
  ],
  workflowsHeadline: "Give the command. Get the outcome.",
  workflows: [
    {
      trigger:
        '"Schedule all follow-up appointments for this week\'s discharges"',
      steps: [
        "Agent pulls discharge list from this week's records",
        "Cross-references each patient's follow-up requirements and provider availability",
        "Books appointments and sends confirmation via patient's preferred channel",
        "Updates the EHR with scheduled follow-up dates",
      ],
      result:
        "42 follow-up appointments booked in under 3 minutes. Zero phone calls.",
    },
    {
      trigger: '"Summarize patient chart for Dr. Smith\'s 2pm"',
      steps: [
        "Retrieves full patient history, recent labs, and medication list",
        "Identifies key changes since last visit and outstanding concerns",
        "Generates a 1-page clinical summary with relevant vitals trending",
        "Flags drug interaction risks and overdue screenings",
      ],
      result:
        "Dr. Smith walks into the exam room prepared, not scrambling through charts.",
    },
    {
      trigger: '"Process 50 insurance claims from yesterday"',
      steps: [
        "Pulls all unbilled encounters from the previous day",
        "Maps diagnoses to ICD-10 codes and procedures to CPT codes",
        "Runs pre-submission validation to catch common denial triggers",
        "Submits clean claims to each payer's electronic portal",
      ],
      result: "50 claims submitted with 96% first-pass acceptance rate.",
    },
  ],
  archItems: [
    {
      icon: Database,
      label: "Pinecone",
      desc: "Vector memory — semantic search across patient records and protocols",
    },
    {
      icon: Layers,
      label: "Neon Postgres",
      desc: "Tenant-scoped relational store — PHI isolation per practice",
    },
    {
      icon: Shield,
      label: "5-Layer Pipeline",
      desc: "Every output passes through PII detection, content, and quality guardrails",
    },
    {
      icon: Zap,
      label: "Ollama Local",
      desc: "Air-gapped mode — patient data never leaves your infrastructure",
    },
  ],
  ctaHeadline: "Less paperwork.",
  ctaHighlight: "More patient care.",
  ctaBlurb:
    "Your staff shouldn't spend half their day on data entry. Deploy AI agents that handle the admin so your team can focus on what matters.",
};

export default function ForHealthcarePage() {
  return <VerticalPageShell config={config} />;
}
