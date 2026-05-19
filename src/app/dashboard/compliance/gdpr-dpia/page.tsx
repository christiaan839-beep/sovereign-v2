import type { Metadata } from "next";
import {
  CompliancePageShell,
  type SchemaField,
} from "@/components/dashboard/compliance/CompliancePageShell";

export const metadata: Metadata = {
  title: "GDPR DPIA + RoPA · Compliance Dashboard · Sovereign Matrix",
};

const FIELDS: SchemaField[] = [
  {
    type: "text",
    key: "controllerName",
    label: "Controller legal name",
    placeholder: "Acme Health AI Ltd",
    required: true,
    defaultValue: "Acme Health AI Ltd",
  },
  {
    type: "text",
    key: "address",
    label: "Registered address",
    placeholder: "Königsallee 1, Düsseldorf, Germany",
    required: true,
    defaultValue: "Königsallee 1, Düsseldorf, Germany",
  },
  {
    type: "text",
    key: "email",
    label: "Controller email",
    placeholder: "privacy@example.com",
    required: true,
    defaultValue: "privacy@acmehealth.example",
  },
  {
    type: "text",
    key: "dpoName",
    label: "Data Protection Officer (Art. 37)",
    placeholder: "Dr. Anna Müller",
    hint: "Mandatory if you process special-category data at scale",
  },
  {
    type: "text",
    key: "dpoEmail",
    label: "DPO email",
    placeholder: "dpo@example.com",
  },
  {
    type: "text",
    key: "activityName",
    label: "Primary processing activity name",
    placeholder: "AI-Assisted Diagnostic Triage",
    required: true,
    defaultValue: "AI-Assisted Diagnostic Triage",
  },
  {
    type: "textarea",
    key: "activityPurpose",
    label: "Activity purpose (Art. 30(1)(b))",
    placeholder:
      "Real-time triage recommendations to emergency-department clinicians.",
    required: true,
    defaultValue:
      "Real-time triage recommendations to emergency-department clinicians.",
  },
  {
    type: "text",
    key: "retention",
    label: "Retention period",
    placeholder: "90 days after discharge",
    defaultValue: "90 days after discharge",
  },
  {
    type: "textarea",
    key: "necessity",
    label: "Necessity & proportionality (Art. 35(7)(b))",
    placeholder:
      "Triage decisions save minutes that save lives. No less-intrusive alternative meets the latency budget.",
    defaultValue:
      "Triage decisions save minutes that save lives. No less-intrusive alternative meets the latency budget.",
  },
];

export default function GdprDpiaDashboard() {
  return (
    <CompliancePageShell
      framework="gdpr-dpia"
      frameworkLabel="GDPR Article 35 DPIA + Article 30 RoPA"
      description="Generate the DPIA + RoPA report from operator-declared processing activities + your tenant's signed receipts. High-residual-risk activities automatically flag for Article 36 prior consultation. RoPA documented per Article 30(1)."
      previewUrl="/compliance/gdpr-dpia"
      npmPackage="@sovereign-matrix/gdpr-dpia"
      fields={FIELDS}
      dataMode="sample"
      receiptCount={512}
      reportingWindow="Receipt-window derived"
    />
  );
}
