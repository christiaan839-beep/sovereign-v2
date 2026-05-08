import type { Metadata } from "next";
import {
  JsonLd,
  breadcrumbSchema,
  playbookServiceSchema,
} from "@/components/seo/JsonLd";

const URL = "https://sovereignmatrix.agency/playbooks/agency-content-packet";

export const metadata: Metadata = {
  title:
    "Agency content packet — blog + emails + ads + competitor intel in 90s | Sovereign Matrix",
  description:
    "The weekly deliverable for B2B agencies. Drop in a client's domain and brand voice — get a 1,500-word SEO blog post, a 3-email welcome sequence, three platform-specific ad creatives, and a competitor weakness teaser. Whitelabel-ready.",
  alternates: { canonical: URL },
  openGraph: {
    title: "Agency content packet — a full week of deliverables in 90 seconds",
    description:
      "Replace your $2K/mo stack of single-purpose AI tools. One client → SEO post + emails + ads + competitor intel, every week, whitelabel-ready.",
    url: URL,
    type: "website",
    images: [
      {
        url: "https://sovereignmatrix.agency/api/og?slug=agency-content-packet",
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [
      "https://sovereignmatrix.agency/api/og?slug=agency-content-packet",
    ],
  },
};

export default function AgencyContentPacketLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd
        data={playbookServiceSchema({
          name: "Agency Content Packet",
          description:
            "One client → SEO blog post, 3-email welcome sequence, three platform-specific ad creatives, and a competitor weakness teaser, every week.",
          url: URL,
          audienceType: "B2B SEO / content / ad agencies",
          priceLow: 499,
          priceHigh: 2000,
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
          { name: "Agency content packet", url: URL },
        ])}
      />
      {children}
    </>
  );
}
