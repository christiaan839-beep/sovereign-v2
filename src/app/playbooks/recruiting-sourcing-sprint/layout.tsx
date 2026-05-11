import type { Metadata } from "next";
import {
  JsonLd,
  breadcrumbSchema,
  playbookServiceSchema,
} from "@/components/seo/JsonLd";

const URL =
  "https://sovereignmatrix.agency/playbooks/recruiting-sourcing-sprint";

export const metadata: Metadata = {
  title:
    "Recruiting sourcing sprint — ICP + booleans + outreach + objections in 90s | Sovereign Matrix",
  description:
    "The weekly deliverable for boutique recruiting agencies. One role brief → structured ICP, three boolean strings (LinkedIn / Google X-Ray / GitHub), three outreach variants, five non-LinkedIn channels, and a 4-objection playbook.",
  alternates: { canonical: URL },
  openGraph: {
    title:
      "Recruiting sourcing sprint — a full sourcing playbook in 90 seconds",
    description:
      "Sharper aim, not another scraped database. ICP + booleans + outreach + channels + objection plays for one open role, ready every Monday.",
    url: URL,
    type: "website",
    images: [
      {
        url: "https://sovereignmatrix.agency/api/og?slug=recruiting-sourcing-sprint",
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [
      "https://sovereignmatrix.agency/api/og?slug=recruiting-sourcing-sprint",
    ],
  },
};

export default function RecruitingSourcingSprintLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd
        data={playbookServiceSchema({
          name: "Recruiting Sourcing Sprint",
          description:
            "One role brief → structured ICP, three boolean strings, three outreach drafts, five non-LinkedIn channels, and a 4-objection playbook, ready every week.",
          url: URL,
          audienceType:
            "Boutique tech, finance, sales, healthcare recruiting agencies",
          priceLow: 499,
          priceHigh: 1500,
          priceCurrency: "USD",
        })}
      />
      <JsonLd
        data={breadcrumbSchema([
          { name: "Sovereign Matrix", url: "https://sovereignmatrix.agency/" },
          {
            name: "Playbooks",
            url: "https://sovereignmatrix.agency/playbooks",
          },
          { name: "Recruiting sourcing sprint", url: URL },
        ])}
      />
      {children}
    </>
  );
}
