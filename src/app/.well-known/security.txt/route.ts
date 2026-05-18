/**
 * GET /.well-known/security.txt
 *
 * RFC 9116 security.txt — the file responsible-disclosure crawlers,
 * vuln-management platforms (HackerOne, Bugcrowd, Intigriti), and
 * automated procurement scanners look for to find the security
 * contact + bounty scope + acknowledgments for a domain.
 *
 * Procurement teams running SIG Lite / CAIQ check this exists. So do
 * vuln databases. So do good actors deciding whether to send us a
 * report vs. ignore the issue. Cheap to publish, expensive to omit.
 *
 * Format per RFC 9116: text/plain key-value pairs, one per line,
 * UTF-8, LF line endings. `Expires:` MUST be set (we use a sliding
 * 12-month window).
 *
 * Open CORS — crawlers fetch this anonymously from anywhere.
 */
import { NextResponse } from "next/server";

export const revalidate = 86400; // 24h — security.txt rarely changes

function twelveMonthsFromNow(): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  // RFC 9116 requires ISO-8601 with 'Z' suffix.
  return d.toISOString().replace(/\.\d{3}Z$/, "Z");
}

export async function GET() {
  const body = [
    "# Sovereign Matrix security.txt (RFC 9116)",
    "#",
    "# If you've found a security issue, please report responsibly per",
    "# the policy at /security and SECURITY.md in this repository.",
    "",
    "Contact: mailto:security@sovereignmatrix.agency",
    "Contact: https://sovereignmatrix.agency/security",
    `Expires: ${twelveMonthsFromNow()}`,
    "Encryption: https://sovereignmatrix.agency/.well-known/security-pgp.asc",
    "Preferred-Languages: en",
    "Canonical: https://sovereignmatrix.agency/.well-known/security.txt",
    "Policy: https://sovereignmatrix.agency/security",
    "Acknowledgments: https://github.com/christiaan839-beep/sovereign-v2/blob/main/SECURITY.md#hall-of-fame",
    "Hiring: https://sovereignmatrix.agency/careers",
    "",
  ].join("\n");

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
      "Cache-Control": "public, max-age=86400, s-maxage=86400",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
