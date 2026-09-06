import type { Metadata } from "next";
import {
  CompliancePageShell,
  type SchemaField,
} from "@/components/dashboard/compliance/CompliancePageShell";

export const metadata: Metadata = {
  title: "ISO/IEC 42001 AIMS · Compliance Dashboard · Sovereign Matrix",
};

const FIELDS: SchemaField[] = [
  {
    type: "text",
    key: "organizationName",
    label: "Organization name",
    placeholder: "Acme AI Operations Ltd",
    required: true,
    defaultValue: "Acme AI Operations Ltd",
  },
  {
    type: "textarea",
    key: "scopeStatement",
    label: "AIMS scope statement (§ 4.3)",
    placeholder:
      "All production AI agents serving consumer loan applicants in the EU.",
    required: true,
    defaultValue:
      "All production AI agents serving consumer loan applicants in the EU.",
    hint: "Free-text description of which systems and processes are inside the AIMS",
  },
  {
    type: "select",
    key: "aiSystemRole",
    label: "AI system role (Annex B)",
    options: [
      { value: "provider", label: "Provider" },
      { value: "user", label: "User" },
      { value: "partner", label: "Partner" },
      { value: "mixed", label: "Mixed" },
    ],
    required: true,
    defaultValue: "provider",
  },
  {
    type: "text",
    key: "certificationBody",
    label: "Certification body",
    placeholder: "BSI",
    hint: "BSI / TÜV SÜD / DNV / etc. — leave blank if not yet engaged",
  },
];

export default function Iso42001Dashboard() {
  return (
    <CompliancePageShell
      framework="iso-42001"
      frameworkLabel="ISO/IEC 42001:2023 AIMS"
      description="Generate the AI management system report from your tenant's signed receipts. Clauses 7-10 (Support / Operation / Performance evaluation / Improvement) + Annex A's 38-control matrix derive directly from receipts; clauses 4-6 emit as operator-authored stubs."
      npmPackage="@sovereign-matrix/iso-42001"
      fields={FIELDS}
      dataMode="sample"
      receiptCount={512}
      reportingWindow="2026-01-15 → 2026-01-21 (sample window)"
    />
  );
}
