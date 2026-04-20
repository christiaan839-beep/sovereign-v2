import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { recordAcquisition } from "@/lib/acquisition";

/**
 * POST /api/_misc/acquisition
 *
 * Client-side attribution capture. Called once post-signup with the
 * user's inbound UTM + referrer context. Server-side
 * `recordAcquisition()` enforces first-write-wins so re-visiting
 * with different UTMs can't rewrite the original attribution.
 *
 * Body:
 *   { utmSource?, utmMedium?, utmCampaign?, referrer? }
 *
 * No PII in the payload — source/medium/campaign are marketing
 * taxonomy, not user data.
 */

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    referrer?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Length caps — an attacker flooding with megabyte-sized UTM strings
  // should be rejected at the front door. None of these fields should
  // exceed a couple hundred chars in legitimate use.
  const MAX_LEN = 500;
  if (
    (body.utmSource && body.utmSource.length > MAX_LEN) ||
    (body.utmMedium && body.utmMedium.length > MAX_LEN) ||
    (body.utmCampaign && body.utmCampaign.length > MAX_LEN) ||
    (body.referrer && body.referrer.length > MAX_LEN)
  ) {
    return NextResponse.json({ error: "Field too long" }, { status: 400 });
  }

  await recordAcquisition({
    userId,
    utmSource: body.utmSource?.slice(0, MAX_LEN),
    utmMedium: body.utmMedium?.slice(0, MAX_LEN),
    utmCampaign: body.utmCampaign?.slice(0, MAX_LEN),
    referrer: body.referrer?.slice(0, MAX_LEN),
  });

  return NextResponse.json({ ok: true });
}
