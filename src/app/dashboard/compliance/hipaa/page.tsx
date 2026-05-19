import type { Metadata } from "next";
import {
  CompliancePageShell,
  type SchemaField,
} from "@/components/dashboard/compliance/CompliancePageShell";

export const metadata: Metadata = {
  title: "HIPAA Security Rule · Compliance Dashboard · Sovereign Matrix",
};

const FIELDS: SchemaField[] = [
  {
    type: "text",
    key: "organizationName",
    label: "Organization name",
    placeholder: "Acme Health AI Inc.",
    required: true,
    defaultValue: "Acme Health AI Inc.",
  },
  {
    type: "select",
    key: "organizationType",
    label: "Organization type",
    options: [
      { value: "covered-entity", label: "Covered entity" },
      { value: "business-associate", label: "Business associate" },
      { value: "both", label: "Both" },
    ],
    required: true,
    defaultValue: "business-associate",
  },
  {
    type: "textarea",
    key: "ephiCategories",
    label: "ePHI categories handled",
    placeholder:
      "AI-derived triage recommendations + clinician question/answer logs.",
    required: true,
    defaultValue:
      "AI-derived triage recommendations + clinician question/answer logs.",
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
  },
  {
    type: "text",
    key: "securityOfficial",
    label: "Security Official (§ 164.308(a)(2))",
    placeholder: "Sarah Patel, CISO",
    hint: "Required appointment per the Security Rule",
  },
  {
    type: "text",
    key: "privacyOfficial",
    label: "Privacy Official (§ 164.530(a))",
    placeholder: "Dr. James Liu, Privacy Officer",
  },
];

export default function HipaaDashboard() {
  return (
    <CompliancePageShell
      framework="hipaa"
      frameworkLabel="HIPAA Security Rule"
      description="Generate the 45 CFR § 164.308-318 evidence binder from your tenant's signed receipts. Administrative + physical + technical safeguards per spec. REQUIRED specifications without evidence surface as open findings the OCR auditor will read first."
      previewUrl="/compliance/hipaa"
      npmPackage="@sovereign-matrix/hipaa-security"
      fields={FIELDS}
      dataMode="sample"
      receiptCount={512}
      reportingWindow="Operator-configured window"
    />
  );
}
