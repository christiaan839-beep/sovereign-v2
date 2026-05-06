/**
 * /.well-known/security.txt — RFC 9116 vulnerability disclosure
 * pointer. Security researchers + automated scanners look for this
 * file before reporting issues; without it, well-meaning research
 * either lands in random support inboxes or gets dropped.
 *
 * The file points to /security for the full responsible-disclosure
 * policy and gives a direct contact address for urgent issues.
 *
 * Served as text/plain so curl + browser + automated scanners all
 * render it the same way.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
// Static for life — re-publish only when the policy changes.
export const dynamic = "force-static";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ?? "https://sovereignmatrix.agency";

// Per RFC 9116 §2, dates are ISO-8601 UTC. Updated annually or when
// any contact / scope changes. Keep this string in sync with the
// `Last-Modified` header below.
const POLICY_EXPIRES = "2027-05-06T00:00:00Z";

const BODY = `# Sovereign Matrix — Vulnerability Disclosure

# How to report a security issue
Contact: mailto:security@sovereignmatrix.agency
Contact: ${APP_URL}/security

# When this policy expires (renewed annually)
Expires: ${POLICY_EXPIRES}

# Preferred languages for reports
Preferred-Languages: en

# Full policy + scope + safe-harbor language
Policy: ${APP_URL}/security

# Acknowledgements (added after responsible disclosure + fix)
Acknowledgments: ${APP_URL}/security#acknowledgements
`;

export function GET() {
  return new NextResponse(BODY, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      // Cache aggressively — the file changes maybe once a year.
      "Cache-Control": "public, max-age=86400, s-maxage=604800",
    },
  });
}
