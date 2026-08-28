/**
 * ISO/IEC 42001:2023 — AI management system (AIMS), Annex A controls.
 *
 * Annex A control titles only. The standard's normative text is
 * copyright ISO and is deliberately not reproduced — the catalogue
 * carries identifiers and titles so evidence can be mapped, and the
 * reader is expected to hold a licensed copy of the standard.
 *
 * 38 controls. Data only — the engine renders it.
 *
 * @packageDocumentation
 */

import type { RegulationPack } from "../types.js";

export const ISO_42001_PACK: RegulationPack = {
  id: "iso-42001",
  standard: "ISO/IEC 42001:2023",
  reportTitle: "ISO/IEC 42001:2023 — AI Management System Report",
  schema: "vaos-iso-42001-v1",
  preamble:
    "This document maps the ISO/IEC 42001:2023 Annex A reference controls to receipt-derived evidence. Clauses 4–10 of the management system remain operator-authored and are not reproduced here. Control titles are the standard's own; the normative text is copyright ISO and is not reproduced.",
  controlNoun: { singular: "control", plural: "controls" },
  categories: [
    "A.2 Policies related to AI",
    "A.3 Internal organization",
    "A.4 Resources for AI systems",
    "A.5 Assessing impacts of AI systems",
    "A.6 AI system life cycle",
    "A.7 Data for AI systems",
    "A.8 Information for interested parties of AI systems",
    "A.9 Use of AI systems",
    "A.10 Third-party and customer relationships",
  ],
  controls: [
    // ── A.2 Policies related to AI ──────────────────────────────────
    {
      id: "A.2.2",
      category: "A.2 Policies related to AI",
      title: "AI policy",
      objective: "AI policy",
      evidencePackPrefixes: ["iso42001", "ai-policy"],
    },
    {
      id: "A.2.3",
      category: "A.2 Policies related to AI",
      title: "Alignment with other organizational policies",
      objective: "Alignment with other organizational policies",
      evidencePackPrefixes: ["iso42001"],
    },
    {
      id: "A.2.4",
      category: "A.2 Policies related to AI",
      title: "Review of the AI policy",
      objective: "Review of the AI policy",
      evidencePackPrefixes: ["iso42001"],
    },
    // ── A.3 Internal organization ───────────────────────────────────
    {
      id: "A.3.2",
      category: "A.3 Internal organization",
      title: "AI roles and responsibilities",
      objective: "AI roles and responsibilities",
      evidencePackPrefixes: ["iso42001"],
    },
    {
      id: "A.3.3",
      category: "A.3 Internal organization",
      title: "Reporting of concerns",
      objective: "Reporting of concerns",
      evidencePackPrefixes: ["iso42001"],
    },
    // ── A.4 Resources for AI systems ────────────────────────────────
    {
      id: "A.4.2",
      category: "A.4 Resources for AI systems",
      title: "Resource documentation",
      objective: "Resource documentation",
      evidencePackPrefixes: ["iso42001"],
    },
    {
      id: "A.4.3",
      category: "A.4 Resources for AI systems",
      title: "Data resources",
      objective: "Data resources",
      evidencePackPrefixes: ["iso42001", "gdpr", "popia"],
    },
    {
      id: "A.4.4",
      category: "A.4 Resources for AI systems",
      title: "Tooling resources",
      objective: "Tooling resources",
      evidencePackPrefixes: ["iso42001"],
    },
    {
      id: "A.4.5",
      category: "A.4 Resources for AI systems",
      title: "System and computing resources",
      objective: "System and computing resources",
      evidencePackPrefixes: ["iso42001"],
    },
    {
      id: "A.4.6",
      category: "A.4 Resources for AI systems",
      title: "Human resources",
      objective: "Human resources",
      evidencePackPrefixes: ["iso42001"],
    },
    // ── A.5 Assessing impacts of AI systems ─────────────────────────
    {
      id: "A.5.2",
      category: "A.5 Assessing impacts of AI systems",
      title: "AI system impact assessment process",
      objective: "AI system impact assessment process",
      evidencePackPrefixes: ["iso42001", "euAiAct", "eu-ai-act"],
    },
    {
      id: "A.5.3",
      category: "A.5 Assessing impacts of AI systems",
      title: "Documentation of AI system impact assessments",
      objective: "Documentation of AI system impact assessments",
      evidencePackPrefixes: ["iso42001", "euAiAct", "eu-ai-act"],
    },
    {
      id: "A.5.4",
      category: "A.5 Assessing impacts of AI systems",
      title: "Assessing AI system impact on individuals and groups",
      objective: "Assessing AI system impact on individuals and groups",
      evidencePackPrefixes: ["iso42001", "fairness"],
    },
    {
      id: "A.5.5",
      category: "A.5 Assessing impacts of AI systems",
      title: "Assessing societal impacts",
      objective: "Assessing societal impacts",
      evidencePackPrefixes: ["iso42001"],
    },
    // ── A.6 AI system life cycle ────────────────────────────────────
    {
      id: "A.6.1.2",
      category: "A.6 AI system life cycle",
      title: "Objectives for responsible development of AI system",
      objective: "Objectives for responsible development of AI system",
      evidencePackPrefixes: ["iso42001"],
    },
    {
      id: "A.6.1.3",
      category: "A.6 AI system life cycle",
      title: "Processes for responsible AI development",
      objective: "Processes for responsible AI development",
      evidencePackPrefixes: ["iso42001"],
    },
    {
      id: "A.6.2.2",
      category: "A.6 AI system life cycle",
      title: "AI system requirements and specification",
      objective: "AI system requirements and specification",
      evidencePackPrefixes: ["iso42001"],
    },
    {
      id: "A.6.2.3",
      category: "A.6 AI system life cycle",
      title: "Documentation of AI system design and development",
      objective: "Documentation of AI system design and development",
      evidencePackPrefixes: ["iso42001"],
    },
    {
      id: "A.6.2.4",
      category: "A.6 AI system life cycle",
      title: "AI system verification and validation",
      objective: "AI system verification and validation",
      evidencePackPrefixes: ["iso42001", "owasp", "red-team"],
    },
    {
      id: "A.6.2.5",
      category: "A.6 AI system life cycle",
      title: "AI system deployment",
      objective: "AI system deployment",
      evidencePackPrefixes: ["iso42001"],
    },
    {
      id: "A.6.2.6",
      category: "A.6 AI system life cycle",
      title: "AI system operation and monitoring",
      objective: "AI system operation and monitoring",
      evidencePackPrefixes: ["iso42001"],
    },
    {
      id: "A.6.2.7",
      category: "A.6 AI system life cycle",
      title: "AI system technical documentation",
      objective: "AI system technical documentation",
      evidencePackPrefixes: ["iso42001", "euAiAct", "eu-ai-act"],
    },
    {
      id: "A.6.2.8",
      category: "A.6 AI system life cycle",
      title: "AI system event logs",
      objective: "AI system event logs",
      evidencePackPrefixes: ["iso42001"],
    },
    // ── A.7 Data for AI systems ─────────────────────────────────────
    {
      id: "A.7.2",
      category: "A.7 Data for AI systems",
      title: "Data for development and enhancement of AI system",
      objective: "Data for development and enhancement of AI system",
      evidencePackPrefixes: ["iso42001", "gdpr", "popia"],
    },
    {
      id: "A.7.3",
      category: "A.7 Data for AI systems",
      title: "Acquisition of data",
      objective: "Acquisition of data",
      evidencePackPrefixes: ["iso42001", "gdpr", "popia"],
    },
    {
      id: "A.7.4",
      category: "A.7 Data for AI systems",
      title: "Quality of data for AI systems",
      objective: "Quality of data for AI systems",
      evidencePackPrefixes: ["iso42001"],
    },
    {
      id: "A.7.5",
      category: "A.7 Data for AI systems",
      title: "Data provenance",
      objective: "Data provenance",
      evidencePackPrefixes: ["iso42001", "c2pa"],
    },
    {
      id: "A.7.6",
      category: "A.7 Data for AI systems",
      title: "Data preparation",
      objective: "Data preparation",
      evidencePackPrefixes: ["iso42001"],
    },
    // ── A.8 Information for interested parties of AI systems ────────
    {
      id: "A.8.2",
      category: "A.8 Information for interested parties of AI systems",
      title: "System documentation and information for users",
      objective: "System documentation and information for users",
      evidencePackPrefixes: ["iso42001"],
    },
    {
      id: "A.8.3",
      category: "A.8 Information for interested parties of AI systems",
      title: "External reporting",
      objective: "External reporting",
      evidencePackPrefixes: ["iso42001"],
    },
    {
      id: "A.8.4",
      category: "A.8 Information for interested parties of AI systems",
      title: "Communication of incidents",
      objective: "Communication of incidents",
      evidencePackPrefixes: ["iso42001"],
    },
    {
      id: "A.8.5",
      category: "A.8 Information for interested parties of AI systems",
      title: "Information for interested parties",
      objective: "Information for interested parties",
      evidencePackPrefixes: ["iso42001"],
    },
    // ── A.9 Use of AI systems ───────────────────────────────────────
    {
      id: "A.9.2",
      category: "A.9 Use of AI systems",
      title: "Processes for responsible use of AI systems",
      objective: "Processes for responsible use of AI systems",
      evidencePackPrefixes: ["iso42001"],
    },
    {
      id: "A.9.3",
      category: "A.9 Use of AI systems",
      title: "Objectives for responsible use of AI systems",
      objective: "Objectives for responsible use of AI systems",
      evidencePackPrefixes: ["iso42001"],
    },
    {
      id: "A.9.4",
      category: "A.9 Use of AI systems",
      title: "Intended use of AI systems",
      objective: "Intended use of AI systems",
      evidencePackPrefixes: ["iso42001"],
    },
    // ── A.10 Third-party and customer relationships ─────────────────
    {
      id: "A.10.2",
      category: "A.10 Third-party and customer relationships",
      title: "Allocation of responsibilities",
      objective: "Allocation of responsibilities",
      evidencePackPrefixes: ["iso42001"],
    },
    {
      id: "A.10.3",
      category: "A.10 Third-party and customer relationships",
      title: "Suppliers",
      objective: "Suppliers",
      evidencePackPrefixes: ["iso42001"],
    },
    {
      id: "A.10.4",
      category: "A.10 Third-party and customer relationships",
      title: "Customers",
      objective: "Customers",
      evidencePackPrefixes: ["iso42001"],
    },
  ],
};
