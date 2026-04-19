import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Developers — Build on Sovereign Matrix",
  description:
    "Ship agents on Sovereign Matrix. 80% revenue share. REST + streaming APIs. Full SDK. Claude-native toolchain.",
  alternates: { canonical: "https://sovereignmatrix.agency/developers" },
  openGraph: {
    title: "Build on Sovereign Matrix — 80% revenue share",
    description: "Agent SDK, REST + streaming APIs, Claude-native toolchain. Earn 80% on every install.",
    url: "https://sovereignmatrix.agency/developers",
    type: "website",
  },
};

export default function DevelopersLayout({ children }: { children: React.ReactNode }) {
  return children;
}
