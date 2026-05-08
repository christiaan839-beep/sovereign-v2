import type { Metadata } from "next";
import {
  JsonLd,
  breadcrumbSchema,
  playbookServiceSchema,
} from "@/components/seo/JsonLd";

const URL = "https://sovereignmatrix.agency/playbooks/realestate-listing-pulse";

export const metadata: Metadata = {
  title:
    "Listing Pulse — MLS copy + open house + buyer email + comps + market in 90s | Sovereign Matrix",
  description:
    "The weekly deliverable for residential real-estate agents. One property → MLS-grade listing description, open-house Instagram / Facebook / WhatsApp posts, a buyer-list email, 3-comp analysis, and a suburb market update.",
  alternates: { canonical: URL },
  openGraph: {
    title: "Listing Pulse — a full week of listing assets in 90 seconds",
    description:
      "MLS copy + open-house posts + buyer email + comp analysis + market update for one property. Drop the address, you get the assets.",
    url: URL,
    type: "website",
    images: [
      {
        url: "https://sovereignmatrix.agency/api/og?slug=realestate-listing-pulse",
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: [
      "https://sovereignmatrix.agency/api/og?slug=realestate-listing-pulse",
    ],
  },
};

export default function ListingPulseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd
        data={playbookServiceSchema({
          name: "Real Estate Listing Pulse",
          description:
            "One property → MLS-grade description, open-house Instagram / Facebook / WhatsApp posts, buyer-list email, 3-comp analysis, and suburb market update with voice-note opener.",
          url: URL,
          audienceType:
            "Residential real-estate agents listing 3–15 properties per quarter",
          priceLow: 299,
          priceHigh: 799,
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
          { name: "Listing Pulse", url: URL },
        ])}
      />
      {children}
    </>
  );
}
