import type { Metadata } from "next";
import {
  JsonLd,
  breadcrumbSchema,
  playbookServiceSchema,
} from "@/components/seo/JsonLd";

const URL = "https://sovereignmatrix.agency/playbooks/growth-pulse";

export const metadata: Metadata = {
  title:
    "Growth Pulse — local SEO + social + WhatsApp + offer in Rands | Sovereign Matrix",
  description:
    "The monthly deliverable for African SMBs. Locale-aware (ZAR / NGN / KES / EGP / GHS), WhatsApp-first, billed in Rands. Local-SEO checklist + 4 social posts + re-engagement email + WhatsApp broadcast + offer card in your local currency.",
  alternates: { canonical: URL },
  openGraph: {
    title: "Growth Pulse — built for African SMBs, billed in Rands",
    description:
      "The AI tool USD-only competitors can't replicate. Locale-aware checklist + posts + email + WhatsApp + offer in your currency, every month, R997 / month.",
    url: URL,
    type: "website",
    images: [
      {
        url: "https://sovereignmatrix.agency/api/og?slug=growth-pulse",
        width: 1200,
        height: 630,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    images: ["https://sovereignmatrix.agency/api/og?slug=growth-pulse"],
  },
};

export default function GrowthPulseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <JsonLd
        data={playbookServiceSchema({
          name: "Growth Pulse",
          description:
            "Locale-aware monthly deliverable for African SMBs. Local-SEO checklist, 4 social posts, customer re-engagement email, WhatsApp broadcast template, and a limited-time offer card in your local currency.",
          url: URL,
          audienceType:
            "Solopreneurs and 1–20 person SMBs in South Africa, Nigeria, Kenya, Egypt, Ghana, and other emerging markets",
          priceLow: 19,
          priceHigh: 49,
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
          { name: "Growth Pulse", url: URL },
        ])}
      />
      {children}
    </>
  );
}
