import type { Metadata } from "next";
import {
  CompliancePageShell,
  type SchemaField,
} from "@/components/dashboard/compliance/CompliancePageShell";

export const metadata: Metadata = {
  title: "NIST AI RMF · Compliance Dashboard · Sovereign Matrix",
};

const FIELDS: SchemaField[] = [
  {
    type: "text",
    key: "systemName",
    label: "AI system name",
    placeholder: "Acme Loan Underwriting AI",
    required: true,
    defaultValue: "Acme Loan Underwriting AI",
  },
  {
    type: "select",
    key: "lifecycleStage",
    label: "Lifecycle stage (Appendix B)",
    options: [
      { value: "design", label: "Design" },
      { value: "development", label: "Development" },
      { value: "deployment", label: "Deployment" },
      { value: "operation", label: "Operation" },
      { value: "monitoring", label: "Monitoring" },
      { value: "decommissioning", label: "Decommissioning" },
    ],
    required: true,
    defaultValue: "operation",
  },
  {
    type: "text",
    key: "organizationalRole",
    label: "AI Actor role",
    placeholder: "AI Operator (financial services)",
    required: true,
    defaultValue: "AI Operator (financial services)",
  },
  {
    type: "select",
    key: "profileType",
    label: "Profile type",
    options: [
      { value: "current", label: "Current state" },
      { value: "target", label: "Target state" },
      { value: "current-and-target", label: "Current + target" },
    ],
    required: true,
    defaultValue: "current",
  },
  {
    type: "select",
    key: "riskTolerance",
    label: "Risk tolerance (§ 5)",
    options: [
      { value: "low", label: "Low" },
      { value: "medium", label: "Medium" },
      { value: "high", label: "High" },
    ],
    required: true,
    defaultValue: "medium",
  },
  {
    type: "textarea",
    key: "intendedUse",
    label: "Intended use",
    placeholder:
      "Automated decisioning for consumer loan applications EUR 1k-50k.",
    required: true,
    defaultValue:
      "Automated decisioning for consumer loan applications EUR 1k-50k.",
  },
];

export default function NistAiRmfDashboard() {
  return (
    <CompliancePageShell
      framework="nist-ai-rmf"
      frameworkLabel="NIST AI RMF 1.0 profile"
      description="Generate the NIST AI RMF 1.0 GOVERN / MAP / MEASURE / MANAGE profile from your tenant's signed receipts. Subcategory evidence counts derive directly from Guardian-pack tags; trustworthy-AI characteristic coverage is computed across the 7 dimensions of NIST AI RMF Appendix B."
      npmPackage="@sovereign-matrix/nist-ai-rmf"
      fields={FIELDS}
      dataMode="sample"
      receiptCount={512}
      reportingWindow="2026-01-15 → 2026-01-21 (sample window)"
    />
  );
}
