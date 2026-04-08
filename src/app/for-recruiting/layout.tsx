import type { Metadata } from "next";
import { JsonLd, breadcrumbSchema } from "@/components/seo/JsonLd";

export const metadata: Metadata = {
  title: "AI Agents for Recruiting — Resume Screening & Outreach | Sovereign Matrix",
  description: "AI agents for recruiting. Screen 1,000 resumes, reach 500 candidates, schedule 50 interviews — before lunch. Resume scoring, candidate outreach, and talent pipeline management.",
  keywords: ["AI recruiting platform", "resume screening AI", "hiring AI agents", "candidate outreach automation", "talent pipeline AI"],
  alternates: { canonical: "https://sovereignmatrix.agency/for-recruiting" },
  openGraph: {
    title: "AI Agents for Recruiting — Sovereign Matrix",
    description: "Screen 1,000 resumes. Reach 500 candidates. Schedule 50 interviews. Before lunch.",
    url: "https://sovereignmatrix.agency/for-recruiting",
    type: "website",
  },
};

const crumbs = breadcrumbSchema([
  { name: "Home", url: "https://sovereignmatrix.agency" },
  { name: "For Recruiting", url: "https://sovereignmatrix.agency/for-recruiting" },
]);

export default function ForRecruitingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <JsonLd data={crumbs} />
      {children}
    </>
  );
}
