import type { Metadata } from "next";
import { TOTAL_AGENTS } from "@/lib/platform-stats";

export const metadata: Metadata = {
  title: "Log In | Sovereign Matrix",
  description: `Access your Sovereign Matrix dashboard. ${TOTAL_AGENTS} autonomous AI agents ready to execute.`,
  alternates: { canonical: "https://sovereignmatrix.agency/login" },
  robots: { index: false, follow: true },
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
