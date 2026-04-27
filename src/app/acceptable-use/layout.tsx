import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Acceptable Use Policy | Sovereign Matrix",
  description:
    "What you can and cannot do with Sovereign Matrix agents. Specific prohibitions, enforcement process, appeal path. The complement to our Terms of Service.",
  openGraph: {
    title: "Acceptable Use Policy | Sovereign Matrix",
    description:
      "What you can and cannot do with Sovereign Matrix agents. Specific prohibitions, enforcement process, appeal path.",
    siteName: "Sovereign Matrix",
  },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
