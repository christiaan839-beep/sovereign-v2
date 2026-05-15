import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { createLogger } from "@/lib/logger";

/**
 * /api/_security/csp-report — Cook 182.
 *
 * Receives Content-Security-Policy violation reports as
 * `application/csp-report` bodies (legacy) or `application/json`
 * (Reporting API v2). Logs the violation server-side so the
 * operator can monitor CSP drift before tightening directives
 * further.
 *
 * Rate-limited 60/min/IP — browsers can spam reports during a
 * misconfigured deploy.
 */

const log = createLogger("csp-report");
const limiter = rateLimit({ interval: 60, limit: 60 });

interface CspViolation {
  "blocked-uri"?: string;
  "violated-directive"?: string;
  "document-uri"?: string;
  "source-file"?: string;
  "line-number"?: number;
  "column-number"?: number;
  disposition?: string;
}

interface ReportBody {
  "csp-report"?: CspViolation;
  // Reporting API v2 sends an array of reports.
  type?: string;
  body?: CspViolation;
}

export async function POST(req: Request) {
  const limited = await limiter.check(req);
  if (limited) return limited;

  let raw: ReportBody | ReportBody[];
  try {
    raw = (await req.json()) as ReportBody | ReportBody[];
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const reports = Array.isArray(raw) ? raw : [raw];
  for (const r of reports) {
    const v = r["csp-report"] ?? r.body;
    if (!v) continue;
    log.warn("CSP violation", {
      directive: v["violated-directive"],
      blocked: v["blocked-uri"],
      document: v["document-uri"],
      source: v["source-file"],
      line: v["line-number"],
      disposition: v.disposition,
    });
  }

  return new NextResponse(null, { status: 204 });
}
