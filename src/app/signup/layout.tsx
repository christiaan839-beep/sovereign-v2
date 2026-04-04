import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign Up — Free Forever | Sovereign Matrix",
  description: "Start free. No credit card. 50 tasks/month on free plan. Deploy your first autonomous AI agent in under 60 seconds.",
  alternates: { canonical: "https://sovereignmatrix.agency/signup" },
  robots: { index: false, follow: true },
};

export default function SignupLayout({ children }: { children: React.ReactNode }) {
  return children;
}
