import type { Metadata } from "next";
import {
  CompliancePageShell,
  type SchemaField,
} from "@/components/dashboard/compliance/CompliancePageShell";

export const metadata: Metadata = {
  title: "EU Cyber Resilience Act · Compliance Dashboard · Sovereign Matrix",
};

const FIELDS: SchemaField[] = [
  {
    type: "text",
    key: "manufacturer",
    label: "Manufacturer legal name",
    placeholder: "Acme AI Inc.",
    required: true,
    defaultValue: "Acme AI Inc.",
  },
  {
    type: "text",
    key: "productName",
    label: "Product name",
    placeholder: "Sovereign Receipt Mint",
    required: true,
    defaultValue: "Sovereign Receipt Mint",
  },
  {
    type: "text",
    key: "productIdentifier",
    label: "Product identifier",
    placeholder: "srm-1.0",
    required: true,
    defaultValue: "srm-1.0",
  },
  {
    type: "select",
    key: "category",
    label: "CRA category",
    options: [
      { value: "default", label: "Default (most products)" },
      { value: "important-class-I", label: "Important — Class I" },
      { value: "important-class-II", label: "Important — Class II" },
      { value: "critical", label: "Critical" },
    ],
    required: true,
    defaultValue: "important-class-II",
    hint: "See Annex III + IV of Regulation 2024/2847 for classification",
  },
  {
    type: "textarea",
    key: "intendedUse",
    label: "Intended use",
    placeholder:
      "Server-side mint of cryptographically signed receipts for autonomous AI agents.",
    required: true,
    defaultValue:
      "Server-side mint of cryptographically signed receipts for autonomous AI agents.",
  },
  {
    type: "text",
    key: "placedOnMarketAt",
    label: "Placed on market (ISO 8601)",
    placeholder: "2026-06-01T00:00:00Z",
    required: true,
    defaultValue: "2026-06-01T00:00:00Z",
  },
  {
    type: "text",
    key: "authorisedRepresentative",
    label: "EU authorised representative",
    placeholder: "Acme EU GmbH",
    hint: "Required if manufacturer is outside the EU",
  },
];

export default function EuCraDashboard() {
  return (
    <CompliancePageShell
      framework="eu-cra"
      frameworkLabel="EU Cyber Resilience Act"
      description="Generate the CRA compliance report from your tenant's signed receipts. Annex I Part I (13 cybersecurity requirements) + Part II (8 vulnerability-handling requirements) + Article 14 post-market obligations + Article 13/Annex VII technical documentation. Open findings for REQUIRED items without evidence."
      previewUrl="/compliance/eu-cra"
      npmPackage="@sovereign-matrix/compliance"
      fields={FIELDS}
      dataMode="sample"
      receiptCount={512}
      reportingWindow="Operator-configured window"
    />
  );
}
