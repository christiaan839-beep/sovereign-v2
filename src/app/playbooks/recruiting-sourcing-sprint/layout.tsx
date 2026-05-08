import type { Metadata } from "next";

export const metadata: Metadata = {
  title:
    "Recruiting sourcing sprint — ICP + booleans + outreach + objections in 90s | Sovereign Matrix",
  description:
    "The weekly deliverable for boutique recruiting agencies. One role brief → structured ICP, three boolean strings (LinkedIn / Google X-Ray / GitHub), three outreach variants, five non-LinkedIn channels, and a 4-objection playbook.",
  alternates: {
    canonical:
      "https://sovereignmatrix.agency/playbooks/recruiting-sourcing-sprint",
  },
  openGraph: {
    title:
      "Recruiting sourcing sprint — a full sourcing playbook in 90 seconds",
    description:
      "Sharper aim, not another scraped database. ICP + booleans + outreach + channels + objection plays for one open role, ready every Monday.",
    url: "https://sovereignmatrix.agency/playbooks/recruiting-sourcing-sprint",
    type: "website",
  },
};

export default function RecruitingSourcingSprintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
