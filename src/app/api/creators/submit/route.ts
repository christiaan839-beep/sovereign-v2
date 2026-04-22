/**
 * POST /api/creators/submit
 *
 * Receives a Sovereign Agent Manifest (SAM v1.0) from a prospective
 * creator and enqueues it for safety review. Returns a reference ID
 * the creator can use to check status.
 *
 * The actual review queue is out of scope for v1 — this endpoint
 * validates the manifest server-side (defense in depth; the UI also
 * validates client-side), generates a reference ID, logs it, and
 * returns 202 Accepted. A follow-up migration + review dashboard
 * persists submissions for operator review.
 *
 * Server-side validation is a deliberate duplication of the client
 * validation. Never trust the client — a manifest submitted directly
 * to this endpoint via curl must fail the same way as one submitted
 * via the form.
 *
 * Rate limit: 10/hour/IP via a new rule. Low cap because a spam
 * submission burns operator-review time, not model tokens.
 */

import { NextResponse } from "next/server";

// Inline SAM v1.0 validator — mirrors the @sovereignmatrix/agent-validator
// package. Kept inline here to avoid cross-package import complications in
// Next.js App Router; the external package exists for third-party tooling.

const VALID_CATEGORIES = new Set([
  "Growth",
  "Content",
  "Dev",
  "Finance",
  "HR",
  "Legal",
  "Ecommerce",
  "Research",
  "Cybersec",
  "Real Estate",
  "Gov",
  "Productivity",
  "Creative",
  "Data",
  "A2E",
  "Meta",
  "Integration",
  "Safety",
]);

const SLUG_PATTERN = /^[a-z][a-z0-9-]{2,63}$/;
const SEMVER_PATTERN = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?$/;
const REQUIRED_FIELDS = [
  "sam",
  "slug",
  "displayName",
  "purpose",
  "category",
  "version",
  "inputs",
  "output",
  "guarantees",
];

interface ValidationError {
  path: string;
  message: string;
}

function validateManifest(manifest: unknown): ValidationError[] {
  const errors: ValidationError[] = [];

  if (typeof manifest !== "object" || manifest === null || Array.isArray(manifest)) {
    return [{ path: "/", message: "Manifest must be a JSON object." }];
  }

  const m = manifest as Record<string, unknown>;

  for (const field of REQUIRED_FIELDS) {
    if (!(field in m)) {
      errors.push({ path: `/${field}`, message: `Required field "${field}" is missing.` });
    }
  }

  if ("sam" in m && m.sam !== "1.0") {
    errors.push({ path: "/sam", message: `"sam" must be exactly "1.0".` });
  }

  if ("slug" in m && typeof m.slug === "string" && !SLUG_PATTERN.test(m.slug)) {
    errors.push({ path: "/slug", message: `"slug" must be kebab-case (3-64 chars, starts with letter).` });
  }

  if ("category" in m && typeof m.category === "string" && !VALID_CATEGORIES.has(m.category)) {
    errors.push({ path: "/category", message: `"category" must be one of the 18 official categories.` });
  }

  if ("version" in m && typeof m.version === "string" && !SEMVER_PATTERN.test(m.version)) {
    errors.push({ path: "/version", message: `"version" must be SemVer.` });
  }

  if ("guarantees" in m) {
    if (!Array.isArray(m.guarantees) || m.guarantees.length < 1) {
      errors.push({ path: "/guarantees", message: `"guarantees" must contain at least 1 clause.` });
    }
  }

  return errors;
}

function generateReferenceId(): string {
  // Short, human-friendly. 8 hex chars timestamp + 4 random.
  const time = Date.now().toString(16);
  const rand = Math.random().toString(16).slice(2, 6);
  return `SAM-${time.slice(-8)}-${rand}`;
}

export async function POST(request: Request): Promise<Response> {
  let manifest: unknown;
  let contactEmail: string | null = null;

  try {
    const body = (await request.json()) as {
      manifest?: unknown;
      contactEmail?: string;
    };
    manifest = body.manifest;
    if (typeof body.contactEmail === "string" && body.contactEmail.length <= 320) {
      contactEmail = body.contactEmail;
    }
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  if (manifest === undefined) {
    return NextResponse.json(
      { error: "Missing 'manifest' field in request body." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Server-side validation (defense in depth).
  const errors = validateManifest(manifest);
  if (errors.length > 0) {
    return NextResponse.json(
      {
        error: "Manifest failed SAM v1.0 validation.",
        errors,
      },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  // Basic email format sanity check (optional field).
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) {
    return NextResponse.json(
      { error: "contactEmail is not a valid email address." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  const referenceId = generateReferenceId();
  const m = manifest as { slug?: string; displayName?: string };

  // Log for operator follow-up. Persistence to a creator_submissions table
  // lands in a follow-up migration — for now, the log trail is the queue.
  console.log(
    JSON.stringify({
      event: "creator_submission",
      referenceId,
      slug: m.slug,
      displayName: m.displayName,
      contactEmail: contactEmail ?? "(not provided)",
      receivedAt: new Date().toISOString(),
    }),
  );

  return NextResponse.json(
    {
      success: true,
      referenceId,
      nextSteps: [
        "Operator will review within 24 hours (business days).",
        "You'll receive an email at the provided address with the verdict.",
        "Approved agents are listed in the Staff Directory + Marketplace immediately.",
      ],
    },
    {
      status: 202,
      headers: { "Cache-Control": "no-store" },
    },
  );
}
