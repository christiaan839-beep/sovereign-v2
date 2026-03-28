import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { COOKBOOKS, BLUEPRINTS, searchCookbooks, searchBlueprints } from "@/lib/blueprints";
import { executeCookbook } from "@/lib/cookbook-engine";

/**
 * COOKBOOK & BLUEPRINT API
 *
 * GET: List all available cookbooks and blueprints (with optional search)
 * POST: Execute a cookbook pipeline
 */

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get("q");
  const type = searchParams.get("type"); // "cookbook" | "blueprint" | null (both)

  const cookbooks = query ? searchCookbooks(query) : COOKBOOKS;
  const blueprints = query ? searchBlueprints(query) : BLUEPRINTS;

  return NextResponse.json({
    cookbooks: type === "blueprint" ? [] : cookbooks,
    blueprints: type === "cookbook" ? [] : blueprints,
    total: cookbooks.length + blueprints.length,
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth();
  if (auth.error) return auth.error;

  try {
    const { cookbookId, inputs } = await req.json();

    if (!cookbookId) {
      return NextResponse.json({ error: "cookbookId is required" }, { status: 400 });
    }

    const cookbook = COOKBOOKS.find((c) => c.id === cookbookId);
    if (!cookbook) {
      return NextResponse.json(
        { error: `Cookbook "${cookbookId}" not found`, available: COOKBOOKS.map((c) => c.id) },
        { status: 404 }
      );
    }

    // Determine base URL for internal agent calls
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000");

    const result = await executeCookbook(cookbook, inputs || {}, baseUrl);

    return NextResponse.json({
      success: result.status === "completed",
      ...result,
    });
  } catch (error) {
    console.error("[Cookbook Engine]", error);
    return NextResponse.json({ error: "Cookbook execution failed" }, { status: 500 });
  }
}
