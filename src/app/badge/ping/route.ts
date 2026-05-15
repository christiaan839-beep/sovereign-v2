/**
 * /badge/ping — 1×1 transparent GIF that pings install metrics
 * back to Sovereign every time a badge renders on a 3rd-party
 * site. Hostname + optional vertical-hint are captured for
 * distribution-channel analytics; no cookies are set.
 *
 * Pure module: no DB writes, just a logger line + the GIF.
 */

import { type NextRequest, NextResponse } from "next/server";
import { createLogger } from "@/lib/logger";

const log = createLogger("badge-ping");

const GIF_1X1 = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

export async function GET(req: NextRequest): Promise<Response> {
  const url = new URL(req.url);
  const hostname = url.searchParams.get("h") ?? "unknown";
  const vertical = url.searchParams.get("v") ?? null;
  log.info("Badge ping", { hostname, vertical });
  return new NextResponse(GIF_1X1 as unknown as BodyInit, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
