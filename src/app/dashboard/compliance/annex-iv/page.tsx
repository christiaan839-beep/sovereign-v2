import type { Metadata } from "next";
import {
  CompliancePageShell,
  type SchemaField,
} from "@/components/dashboard/compliance/CompliancePageShell";

export const metadata: Metadata = {
  title: "EU AI Act Annex IV · Compliance Dashboard · Sovereign Matrix",
};

const FIELDS: SchemaField[] = [
  {
    type: "text",
    key: "name",
    label: "System name",
    placeholder: "Acme Loan Underwriting AI",
    required: true,
    defaultValue: "Acme Loan Underwriting AI",
  },
  {
    type: "text",
    key: "identifier",
    label: "System identifier",
    placeholder: "acme-loan-2026",
    required: true,
    defaultValue: "acme-loan-2026",
    hint: "Stable id used by the EU AI Office for filings",
  },
  {
    type: "select",
    key: "riskCategory",
    label: "Risk category",
    options: [
      { value: "high-risk", label: "High-risk (Annex III)" },
      { value: "limited-risk", label: "Limited-risk" },
      { value: "minimal-risk", label: "Minimal-risk" },
      { value: "prohibited", label: "Prohibited" },
    ],
    required: true,
    defaultValue: "high-risk",
  },
  {
    type: "text",
    key: "provider",
    label: "Provider legal name",
    placeholder: "Acme Financial AI Ltd",
    required: true,
    defaultValue: "Acme Financial AI Ltd",
  },
  {
    type: "text",
    key: "euRep",
    label: "EU representative (Article 25)",
    placeholder: "Acme EU GmbH",
    hint: "Required if provider is outside the EU",
  },
  {
    type: "text",
    key: "annexIII",
    label: "Annex III use-case",
    placeholder: "creditworthiness assessment",
  },
  {
    type: "textarea",
    key: "intendedPurpose",
    label: "Intended purpose (Article 13(2))",
    placeholder:
      "Automated decisioning for consumer loan applications EUR 1k-50k.",
    required: true,
    defaultValue:
      "Automated decisioning for consumer loan applications EUR 1k-50k.",
  },
  {
    type: "text",
    key: "placedOnMarket",
    label: "Placed on market (ISO 8601)",
    placeholder: "2026-01-15T00:00:00Z",
    defaultValue: "2026-01-15T00:00:00Z",
  },
  {
    type: "text",
    key: "nextReportDue",
    label: "Next PMM report due",
    placeholder: "2026-08-15T00:00:00Z",
    hint: "Typically +90 days from this report",
  },
];

export default function AnnexIvDashboard() {
  return (
    <CompliancePageShell
      framework="annex-iv"
      frameworkLabel="EU AI Act Annex IV"
      description="Generate Article 11 + Annex IV technical documentation from your tenant's signed receipts. §3 (monitoring), §4 (performance), §6 (lifecycle changes), §9 (post-market monitoring) are derived directly from receipts; §1/§2/§5/§7/§8 emit as structured operator-authored stubs with regulation-clause schema hints."
      npmPackage="@sovereign-matrix/annex-iv"
      fields={FIELDS}
      dataMode="sample"
      receiptCount={512}
      reportingWindow="2026-01-15 → 2026-01-21 (sample window)"
    />
  );
}
