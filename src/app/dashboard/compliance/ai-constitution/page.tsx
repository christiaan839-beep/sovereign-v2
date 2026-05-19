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
    type: "file",
    key: "constitutionFile",
    label: "Signed constitution (JSON)",
    accept: "application/json,.json",
    hint: "Upload the output of buildConstitution() — the .hash + .articles must be intact. Leave blank to auto-generate a sample constitution from the fields below.",
    maxBytes: 1024 * 1024, // 1 MB
  },
  {
    type: "file",
    key: "receiptsFile",
    label: "Receipts (JSONL or JSON array)",
    accept: ".jsonl,.json,application/json",
    hint: "Upload your VAOS receipt set. One JSON object per line OR a single JSON array. Leave blank to audit a sample 512-receipt corpus instead.",
    maxBytes: 4 * 1024 * 1024, // 4 MB
  },
  {
    type: "text",
    key: "name",
    label: "Constitution name (fallback)",
    placeholder: "Acme Healthcare AI Constitution",
    defaultValue: "Acme Healthcare AI Constitution",
    hint: "Used only when no constitution file is uploaded",
  },
  {
    type: "text",
    key: "signedBy",
    label: "Signed by (fallback)",
    placeholder: "Acme Health AI Inc.",
    defaultValue: "Acme Health AI Inc.",
    hint: "Used only when no constitution file is uploaded",
  },
  {
    type: "textarea",
    key: "preamble",
    label: "Preamble (fallback)",
    placeholder:
      "This constitution governs all autonomous AI agents operating against patient ePHI within our clinical-decision-support stack.",
    defaultValue:
      "This constitution governs all autonomous AI agents operating against patient ePHI within our clinical-decision-support stack.",
    hint: "One paragraph stating the scope and purpose; only used when no constitution file is uploaded",
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
