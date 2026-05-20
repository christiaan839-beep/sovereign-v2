"use client";

import {
  GraduationCap,
  BookOpen,
  ClipboardList,
  Settings,
  BarChart3,
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
  slug: "education",
  label: "Education",
  EyebrowIcon: GraduationCap,
  accent: "cyan",
  heroLine1: "AI agents for",
  heroHighlight: "education.",
  heroBlurb:
    "FERPA-compliant. Curriculum generation. Student assessment. Runs locally.",
  capabilitiesHeadline: "Less busywork. More teaching.",
  capabilitiesBlurb:
    "Educators spend 50% of their time on non-teaching tasks. AI agents handle curriculum prep, assessment creation, and admin so your teachers can teach.",
  capabilities: [
    {
      icon: BookOpen,
      title: "Curriculum & lesson plan generation",
      desc: "Describe the course, grade level, and learning objectives. Agents generate week-by-week curricula aligned to standards (Common Core, AP, IB) — complete with lesson plans, activities, and resource lists.",
    },
    {
      icon: ClipboardList,
      title: "Student assessment creation",
      desc: "Generate unique, standards-aligned assessments in seconds. Multiple choice, short answer, essay prompts, and rubrics — each question tagged by difficulty level, Bloom's taxonomy tier, and learning objective.",
    },
    {
      icon: Settings,
      title: "Administrative automation",
      desc: "Agents handle parent communications, enrollment processing, attendance reporting, and scheduling. Every repetitive administrative task that pulls educators away from teaching — automated and logged.",
    },
    {
      icon: BarChart3,
      title: "Progress tracking & reporting",
      desc: "Aggregate student performance across assignments, assessments, and participation. Generate individual progress reports, class-wide analytics, and early intervention alerts for struggling students.",
    },
  ],
  workflowsHeadline: "Describe what you need. Get it done.",
  workflows: [
    {
      trigger: '"Create a 12-week curriculum for AP Computer Science"',
      steps: [
        "Agent pulls AP Computer Science A framework and exam format requirements",
        "Designs 12-week unit progression covering all required topics with scaffolding",
        "Generates weekly lesson plans with objectives, activities, code exercises, and homework",
        "Includes 3 practice exams, a midterm project spec, and a final project rubric",
      ],
      result:
        "Complete AP CS curriculum ready to teach. Aligned to College Board standards with differentiation notes.",
    },
    {
      trigger: '"Generate 30 unique assessment questions on photosynthesis"',
      steps: [
        "Agent identifies key concepts: light reactions, Calvin cycle, chloroplast structure, factors affecting rate",
        "Generates 10 multiple choice, 10 short answer, and 10 extended response questions",
        "Tags each question by difficulty (easy/medium/hard) and Bloom's taxonomy level",
        "Creates answer key with detailed explanations and a scoring rubric for open-ended questions",
      ],
      result:
        "30 unique questions with answer key and rubric. No two students get the same assessment.",
    },
    {
      trigger: '"Summarize progress reports for all 150 students in Grade 10"',
      steps: [
        "Pulls grade data, attendance records, and teacher comments for all 150 students",
        "Calculates performance trends, identifies students at risk, and highlights top performers",
        "Generates individual progress narratives for each student with specific, actionable feedback",
        "Produces a class-wide summary with distribution charts and intervention recommendations",
      ],
      result:
        "150 personalized progress reports generated in 4 minutes. Ready for parent-teacher conferences.",
    },
  ],
  archItems: [
    {
      icon: Database,
      label: "Pinecone",
      desc: "Vector memory — semantic search across curricula, assessments, and student records",
    },
    {
      icon: Layers,
      label: "Neon Postgres",
      desc: "Tenant-scoped relational store — per-school and per-district isolation",
    },
    {
      icon: Shield,
      label: "5-Layer Pipeline",
      desc: "Every output checked for age-appropriateness, accuracy, and PII protection",
    },
    {
      icon: Zap,
      label: "Ollama Local",
      desc: "Air-gapped mode — student data never leaves your school network",
    },
  ],
  ctaHeadline: "Less admin.",
  ctaHighlight: "More impact.",
  ctaBlurb:
    "Every curriculum generated saves hours of prep. Every assessment created is standards-aligned. Every progress report is personalized. Your agents handle the busywork so educators can educate.",
};

export default function ForEducationPage() {
  return <VerticalPageShell config={config} />;
}
