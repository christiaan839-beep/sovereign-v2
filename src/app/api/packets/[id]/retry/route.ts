/**
 * POST /api/packets/[id]/retry — re-run a single failed sub-asset.
 *
 * Body: { asset: "blog" | "emailSequence" | "ads" | "competitor" |
 *                "icp" | "booleans" | "outreach" | "channels" | "objections" |
 *                "seo" | "socialPosts" | "reEngagementEmail" | "whatsapp" | "offer" |
 *                "listing" | "social" | "buyerEmail" | "comps" | "marketUpdate" }
 *
 * Re-uses the input that was saved with the original packet, calls the
 * matching generator, merges the result back into the persisted packet
 * row, and returns the updated packet. Costs one credit per successful
 * retry — if quality fails, no credit consumed.
 *
 * Auth + ownership scoping: every read goes through getPacketById(userId, id),
 * so retry on another user's packet returns 404. Quota enforcement runs
 * via the existing checkPlanLimits gate.
 */
import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { db } from "@/db";
import { packets } from "@/db/schema";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { getPacketById, type PacketKind } from "@/lib/packet-store";
import { checkPlanLimits } from "@/lib/plan-enforcement";
import { createLogger } from "@/lib/logger";

import {
  agencyPacketSchema,
  generateBlog,
  generateEmailSequence,
  generateAds,
  generateCompetitor,
} from "@/app/api/_agents/agency-packet/route";
import {
  sourcingSprintSchema,
  generateIcp,
  generateBooleans,
  generateOutreach,
  generateChannels,
  generateObjections,
} from "@/app/api/_agents/sourcing-sprint/route";
import {
  growthPulseSchema,
  generateSeo,
  generateSocialPosts,
  generateReEngagementEmail,
  generateWhatsapp,
  generateOfferCard,
} from "@/app/api/_agents/growth-pulse/route";
import {
  listingPulseSchema,
  generateListingDescription,
  generateOpenHouseSocial,
  generateBuyerEmail,
  generateCompAnalysis,
  generateMarketUpdate,
} from "@/app/api/_agents/listing-pulse/route";

const log = createLogger("packet-retry");

const retrySchema = z.object({
  asset: z.string().min(2).max(40),
});

/**
 * Map of (packet kind, asset key) → (input schema, generator fn).
 * Ordered to mirror the orchestrators so any drift is obvious.
 */
const RETRY_TABLE: Record<
  PacketKind,
  Record<
    string,
    {
      schema: { parse: (v: unknown) => unknown };
      run: (input: unknown) => Promise<unknown>;
    }
  >
> = {
  "agency-content-packet": {
    blog: { schema: agencyPacketSchema, run: (i) => generateBlog(i as never) },
    emailSequence: {
      schema: agencyPacketSchema,
      run: (i) => generateEmailSequence(i as never),
    },
    ads: { schema: agencyPacketSchema, run: (i) => generateAds(i as never) },
    competitor: {
      schema: agencyPacketSchema,
      run: (i) => generateCompetitor(i as never),
    },
  },
  "recruiting-sourcing-sprint": {
    icp: { schema: sourcingSprintSchema, run: (i) => generateIcp(i as never) },
    booleans: {
      schema: sourcingSprintSchema,
      run: (i) => generateBooleans(i as never),
    },
    outreach: {
      schema: sourcingSprintSchema,
      run: (i) => generateOutreach(i as never),
    },
    channels: {
      schema: sourcingSprintSchema,
      run: (i) => generateChannels(i as never),
    },
    objections: {
      schema: sourcingSprintSchema,
      run: (i) => generateObjections(i as never),
    },
  },
  "growth-pulse": {
    seo: { schema: growthPulseSchema, run: (i) => generateSeo(i as never) },
    socialPosts: {
      schema: growthPulseSchema,
      run: (i) => generateSocialPosts(i as never),
    },
    reEngagementEmail: {
      schema: growthPulseSchema,
      run: (i) => generateReEngagementEmail(i as never),
    },
    whatsapp: {
      schema: growthPulseSchema,
      run: (i) => generateWhatsapp(i as never),
    },
    offer: {
      schema: growthPulseSchema,
      run: (i) => generateOfferCard(i as never),
    },
  },
  "listing-pulse": {
    listing: {
      schema: listingPulseSchema,
      run: (i) => generateListingDescription(i as never),
    },
    social: {
      schema: listingPulseSchema,
      run: (i) => generateOpenHouseSocial(i as never),
    },
    buyerEmail: {
      schema: listingPulseSchema,
      run: (i) => generateBuyerEmail(i as never),
    },
    comps: {
      schema: listingPulseSchema,
      run: (i) => generateCompAnalysis(i as never),
    },
    marketUpdate: {
      schema: listingPulseSchema,
      run: (i) => generateMarketUpdate(i as never),
    },
  },
};

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "Authentication required" },
      { status: 401 },
    );
  }

  const planCheck = await checkPlanLimits(userId);
  if (!planCheck.allowed) {
    return NextResponse.json(
      {
        error: "Usage limit reached",
        message:
          planCheck.message ??
          `You've used all ${planCheck.limit} runs this month on the ${planCheck.planName} plan.`,
        code: "USAGE_LIMIT_REACHED",
      },
      { status: 429 },
    );
  }

  const { id } = await params;
  const packet = await getPacketById(userId, id);
  if (!packet) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = retrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Body must be { asset: string }" },
      { status: 400 },
    );
  }

  const assetKey = parsed.data.asset;
  const kindTable = RETRY_TABLE[packet.kind];
  const target = kindTable?.[assetKey];
  if (!target) {
    return NextResponse.json(
      {
        error: `Unknown asset for kind '${packet.kind}'. Valid: ${Object.keys(kindTable ?? {}).join(", ")}`,
      },
      { status: 400 },
    );
  }

  // Re-validate the saved input via the original schema. Defends against
  // schema-drift between when the packet was saved and now (a strict()
  // change could surface previously-tolerated keys; failing here is
  // safer than passing them downstream).
  let validatedInput: unknown;
  try {
    validatedInput = target.schema.parse(packet.input);
  } catch (err) {
    log.warn("retry input failed re-validation against current schema", {
      packetId: id,
      kind: packet.kind,
      asset: assetKey,
      error: (err as Error).message,
    });
    return NextResponse.json(
      {
        error:
          "Saved input no longer matches the current schema. Run the packet fresh from the playbook page.",
      },
      { status: 422 },
    );
  }

  const start = Date.now();
  let newAssetValue: unknown;
  try {
    newAssetValue = await target.run(validatedInput);
  } catch (err) {
    log.warn("retry generator threw", {
      packetId: id,
      kind: packet.kind,
      asset: assetKey,
      error: (err as Error).message,
    });
    return NextResponse.json(
      {
        error: `Retry failed: ${(err as Error).message}`,
        asset: assetKey,
      },
      { status: 502 },
    );
  }
  const durationMs = Date.now() - start;

  // Merge: replace the asset in the stored output, and remove its row
  // from errors[] if it was there.
  const oldOutput = packet.output as Record<string, unknown>;
  const oldErrors = Array.isArray(oldOutput.errors)
    ? (oldOutput.errors as Array<{ asset: string; message: string }>)
    : [];
  const newOutput: Record<string, unknown> = {
    ...oldOutput,
    [assetKey]: newAssetValue,
    errors: oldErrors.filter((e) => e.asset !== assetKey),
    // Bump duration to reflect the retry's contribution
    durationMs:
      (typeof oldOutput.durationMs === "number" ? oldOutput.durationMs : 0) +
      durationMs,
  };

  try {
    await db
      .update(packets)
      .set({
        outputJson: JSON.stringify(newOutput),
        errorCount: (newOutput.errors as unknown[]).length,
        durationMs: newOutput.durationMs as number,
      })
      .where(eq(packets.id, packet.id));
  } catch (err) {
    log.warn("retry persistence failed (response still returned)", {
      packetId: id,
      error: (err as Error).message,
    });
  }

  return NextResponse.json({
    packetId: packet.id,
    asset: assetKey,
    durationMs,
    output: newOutput,
  });
}
