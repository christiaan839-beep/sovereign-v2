import type { Metadata } from "next";
import {
  CompliancePageShell,
  type SchemaField,
} from "@/components/dashboard/compliance/CompliancePageShell";

export const metadata: Metadata = {
  title: "SOC 2 Evidence Binder · Compliance Dashboard · Sovereign Matrix",
};

const FIELDS: SchemaField[] = [
  {
    type: "text",
    key: "organizationName",
    label: "Service organization name",
    placeholder: "Acme AI Operations Ltd",
    required: true,
    defaultValue: "Acme AI Operations Ltd",
  },
  {
    type: "text",
    key: "auditPeriodStart",
    label: "Audit period start (ISO 8601)",
    placeholder: "2026-01-01T00:00:00Z",
    required: true,
    defaultValue: "2026-01-01T00:00:00Z",
  },
  {
    type: "text",
    key: "auditPeriodEnd",
    label: "Audit period end (ISO 8601)",
    placeholder: "2026-12-31T23:59:59Z",
    required: true,
    defaultValue: "2026-12-31T23:59:59Z",
    hint: "SOC 2 Type II typically requires a 6-12 month window",
  },
  {
    type: "text",
    key: "serviceAuditor",
    label: "Service auditor (CPA firm)",
    placeholder: "BDO USA LLP",
    hint: "Leave blank if not yet engaged",
  },
  {
    type: "textarea",
    key: "servicesDescription",
    label: "Services description (AT-C § 105.10)",
    placeholder:
      "AI-powered loan-underwriting platform delivering automated decisions with cryptographic receipts.",
    required: true,
    defaultValue:
      "AI-powered loan-underwriting platform delivering automated decisions with cryptographic receipts.",
  },
];

export default function Soc2Dashboard() {
  return (
    <CompliancePageShell
      framework="soc2"
      frameworkLabel="SOC 2 Evidence Binder"
      description="Generate the AICPA TSC 2017 evidence binder for your Type II audit from signed receipts. CC1-CC9 (security) + A1 (availability) + C1 (confidentiality) by default. Per-criterion days-of-coverage metric flags sparse evidence before the audit kickoff."
      previewUrl="/compliance/soc2"
      npmPackage="@sovereign-matrix/soc2-evidence"
      fields={FIELDS}
      dataMode="sample"
      receiptCount={512}
      reportingWindow="2026-01-01 → 2026-12-31 (operator-configurable)"
    />
  );
}
