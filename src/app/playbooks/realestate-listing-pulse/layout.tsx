import type { Metadata } from "next";

export const metadata: Metadata = {
  title:
    "Listing Pulse — MLS copy + open house + buyer email + comps + market in 90s | Sovereign Matrix",
  description:
    "The weekly deliverable for residential real-estate agents. One property → MLS-grade listing description, open-house Instagram / Facebook / WhatsApp posts, a buyer-list email, 3-comp analysis, and a suburb market update.",
  alternates: {
    canonical:
      "https://sovereignmatrix.agency/playbooks/realestate-listing-pulse",
  },
  openGraph: {
    title: "Listing Pulse — a full week of listing assets in 90 seconds",
    description:
      "MLS copy + open-house posts + buyer email + comp analysis + market update for one property. Drop the address, you get the assets.",
    url: "https://sovereignmatrix.agency/playbooks/realestate-listing-pulse",
    type: "website",
  },
};

export default function ListingPulseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
