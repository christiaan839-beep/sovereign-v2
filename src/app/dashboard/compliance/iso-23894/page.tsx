import type { Metadata } from "next";
import {
  CompliancePageShell,
  type SchemaField,
} from "@/components/dashboard/compliance/CompliancePageShell";

export const metadata: Metadata = {
  title: "ISO/IEC 23894 · Compliance Dashboard · Sovereign Matrix",
};

const FIELDS: SchemaField[] = [
  {
    type: "text",
    key: "organizationName",
    label: "Organization name",
    placeholder: "Acme AI Inc.",
    required: true,
    defaultValue: "Acme AI Inc.",
  },
  {
    type: "text",
    key: "systemName",
    label: "AI system name",
    placeholder: "Loan Underwriting AI",
    required: true,
    defaultValue: "Loan Underwriting AI",
  },
  {
    type: "select",
    key: "lifecyclePhase",
    label: "Lifecycle phase (§ 4.2)",
    options: [
      { value: "inception", label: "Inception" },
      { value: "design", label: "Design" },
      { value: "development", label: "Development" },
      { value: "verification-validation", label: "Verification / Validation" },
      { value: "deployment", label: "Deployment" },
      { value: "operation-monitoring", label: "Operation / Monitoring" },
      { value: "re-evaluation", label: "Re-evaluation" },
      { value: "retirement", label: "Retirement" },
    ],
    required: true,
    defaultValue: "operation-monitoring",
  },
  {
    type: "text",
    key: "policyVersion",
    label: "Risk-management policy version",
    placeholder: "RMP-2026-v3",
    required: true,
    defaultValue: "RMP-2026-v3",
  },
  {
    type: "text",
    key: "periodStart",
    label: "Reporting period start (ISO 8601)",
    placeholder: "2026-01-01T00:00:00Z",
    required: true,
    defaultValue: "2026-01-01T00:00:00Z",
  },
  {
    type: "text",
    key: "periodEnd",
    label: "Reporting period end (ISO 8601)",
    placeholder: "2026-12-31T23:59:59Z",
    required: true,
    defaultValue: "2026-12-31T23:59:59Z",
  },
];

export default function Iso23894Dashboard() {
  return (
    <CompliancePageShell
      framework="iso-23894"
      frameworkLabel="ISO/IEC 23894:2023 AI Risk Management"
      description="Generate the AI risk-management report from your tenant's signed receipts. Inherent risk scored via the 5×5 likelihood × impact matrix; residual risk attenuated by receipt evidence (10+ receipts → 1 band lower; 100+ → 2 bands lower). Operator-explainable arithmetic."
      npmPackage="@sovereign-matrix/iso-23894"
      fields={FIELDS}
      dataMode="sample"
      receiptCount={512}
      reportingWindow="Operator-configured window"
    />
  );
}
