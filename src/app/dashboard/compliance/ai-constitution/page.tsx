import type { Metadata } from "next";
import {
  CompliancePageShell,
  type SchemaField,
} from "@/components/dashboard/compliance/CompliancePageShell";

export const metadata: Metadata = {
  title:
    "Constitutional AI Anchoring · Compliance Dashboard · Sovereign Matrix",
};

const FIELDS: SchemaField[] = [
  {
    type: "text",
    key: "name",
    label: "Constitution name",
    placeholder: "Acme Healthcare AI Constitution",
    required: true,
    defaultValue: "Acme Healthcare AI Constitution",
  },
  {
    type: "text",
    key: "signedBy",
    label: "Signed by (operator legal name)",
    placeholder: "Acme Health AI Inc.",
    required: true,
    defaultValue: "Acme Health AI Inc.",
  },
  {
    type: "textarea",
    key: "preamble",
    label: "Preamble",
    placeholder:
      "This constitution governs all autonomous AI agents operating against patient ePHI within our clinical-decision-support stack.",
    defaultValue:
      "This constitution governs all autonomous AI agents operating against patient ePHI within our clinical-decision-support stack.",
    hint: "One paragraph stating the scope and purpose",
  },
];

export default function AiConstitutionDashboard() {
  return (
    <CompliancePageShell
      framework="ai-constitution"
      frameworkLabel="Constitutional AI Anchoring"
      description="Sign an immutable AI constitution and audit a receipt set against it. Every receipt commits to the constitution's SHA-256 hash. Articles can carry severity (advisory/warning/blocking) + measurable conditions (Guardian-pack rule ids); violations are flagged automatically. The inference-time analogue to Anthropic's Constitutional AI training methodology."
      previewUrl="/compliance/ai-constitution"
      npmPackage="@sovereign-matrix/ai-constitution"
      fields={FIELDS}
      dataMode="sample"
      receiptCount={512}
      reportingWindow="Receipt-window derived"
    />
  );
}
