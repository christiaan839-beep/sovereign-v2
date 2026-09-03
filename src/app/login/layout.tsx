import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log In | Sovereign Matrix",
  description: "Access your Sovereign Matrix dashboard. 140 autonomous AI agents ready to execute.",
  alternates: { canonical: "https://sovereignmatrix.agency/login" },
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
